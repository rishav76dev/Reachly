#![cfg(test)]

use crate::{CampaignFactory, CampaignFactoryClient};
use soroban_sdk::{
	testutils::{Address as _, Ledger, LedgerInfo},
	token, Address, Env, String,
};

fn set_ledger(env: &Env, timestamp: u64, sequence_number: u32) {
	env.ledger().set(LedgerInfo {
		timestamp,
		protocol_version: 25,
		sequence_number,
		network_id: Default::default(),
		base_reserve: 10,
		min_temp_entry_ttl: 16,
		min_persistent_entry_ttl: 16,
		max_entry_ttl: 1_000_000,
	});
}

#[test]
fn campaign_flow_distributes_rewards_proportionally() {
	let env = Env::default();
	env.mock_all_auths();
	set_ledger(&env, 1_000, 1);

	let admin = Address::generate(&env);
	let brand = Address::generate(&env);
	let creator_a = Address::generate(&env);
	let creator_b = Address::generate(&env);

	let asset_contract = env.register_stellar_asset_contract_v2(admin.clone());
	let token_id = asset_contract.address();
	let token_admin = token::StellarAssetClient::new(&env, &token_id);
	let token = token::Client::new(&env, &token_id);

	token_admin.mint(&brand, &1_000);

	let contract_id = env.register(CampaignFactory, ());
	let client = CampaignFactoryClient::new(&env, &contract_id);

	let campaign_id = client.create_campaign(
		&String::from_str(&env, "Launch push"),
		&brand,
		&token_id,
		&100,
		&1_000,
	);
	assert_eq!(campaign_id, 0);
	assert_eq!(client.get_campaign_count(), 1);

	client.submit(
		&campaign_id,
		&creator_a,
		&String::from_str(&env, "https://x.com/a/status/1"),
	);
	client.submit(
		&campaign_id,
		&creator_b,
		&String::from_str(&env, "https://x.com/b/status/2"),
	);
	assert_eq!(client.get_submission_count(&campaign_id), 2);

	set_ledger(&env, 1_101, 2);
	client.set_views(&campaign_id, &0, &300);
	client.set_views(&campaign_id, &1, &700);
	client.finalize_results(&campaign_id);

	let submission_a = client.get_submission(&campaign_id, &0);
	let submission_b = client.get_submission(&campaign_id, &1);
	assert_eq!(submission_a.reward, 300);
	assert_eq!(submission_b.reward, 700);

	client.claim_reward(&campaign_id, &0, &creator_a);
	client.claim_reward(&campaign_id, &1, &creator_b);

	assert_eq!(token.balance(&creator_a), 300);
	assert_eq!(token.balance(&creator_b), 700);

	let paid_a = client.get_submission(&campaign_id, &0);
	let paid_b = client.get_submission(&campaign_id, &1);
	assert!(paid_a.paid);
	assert!(paid_b.paid);
}

#[test]
fn views_cannot_decrease() {
	let env = Env::default();
	env.mock_all_auths();
	set_ledger(&env, 5_000, 1);

	let admin = Address::generate(&env);
	let brand = Address::generate(&env);
	let creator = Address::generate(&env);

	let asset_contract = env.register_stellar_asset_contract_v2(admin.clone());
	let token_id = asset_contract.address();
	let token_admin = token::StellarAssetClient::new(&env, &token_id);
	token_admin.mint(&brand, &10_000);

	let contract_id = env.register(CampaignFactory, ());
	let client = CampaignFactoryClient::new(&env, &contract_id);

	let campaign_id = client.create_campaign(
		&String::from_str(&env, "No decrease"),
		&brand,
		&token_id,
		&10,
		&1_000,
	);

	client.submit(
		&campaign_id,
		&creator,
		&String::from_str(&env, "https://x.com/creator/status/9"),
	);

	set_ledger(&env, 5_100, 2);
	client.set_views(&campaign_id, &0, &100);

	let result = client.try_set_views(&campaign_id, &0, &99);
	assert!(result.is_err());
}

#[test]
fn create_campaign_stores_state_and_escrows_budget() {
	let env = Env::default();
	env.mock_all_auths();
	set_ledger(&env, 9_000, 1);

	let admin = Address::generate(&env);
	let brand = Address::generate(&env);

	let asset_contract = env.register_stellar_asset_contract_v2(admin.clone());
	let token_id = asset_contract.address();
	let token_admin = token::StellarAssetClient::new(&env, &token_id);
	let token = token::Client::new(&env, &token_id);
	token_admin.mint(&brand, &2_000);

	let contract_id = env.register(CampaignFactory, ());
	let client = CampaignFactoryClient::new(&env, &contract_id);

	let campaign_id = client.create_campaign(
		&String::from_str(&env, "Create only"),
		&brand,
		&token_id,
		&120,
		&1_500,
	);

	assert_eq!(campaign_id, 0);
	assert_eq!(client.get_campaign_count(), 1);
	assert_eq!(token.balance(&brand), 500);
	assert_eq!(token.balance(&contract_id), 1_500);

	let campaign = client.get_campaign(&campaign_id);
	assert_eq!(campaign.name, String::from_str(&env, "Create only"));
	assert_eq!(campaign.brand, brand);
	assert_eq!(campaign.token, token_id);
	assert_eq!(campaign.total_budget, 1_500);
	assert_eq!(campaign.total_views, 0);
	assert!(!campaign.results_finalized);
	assert_eq!(campaign.deadline, 9_120);
}

#[test]
fn submit_fails_after_deadline() {
	let env = Env::default();
	env.mock_all_auths();
	set_ledger(&env, 11_000, 1);

	let admin = Address::generate(&env);
	let brand = Address::generate(&env);
	let creator = Address::generate(&env);

	let asset_contract = env.register_stellar_asset_contract_v2(admin.clone());
	let token_id = asset_contract.address();
	let token_admin = token::StellarAssetClient::new(&env, &token_id);
	token_admin.mint(&brand, &1_000);

	let contract_id = env.register(CampaignFactory, ());
	let client = CampaignFactoryClient::new(&env, &contract_id);

	let campaign_id = client.create_campaign(
		&String::from_str(&env, "Deadline test"),
		&brand,
		&token_id,
		&5,
		&500,
	);

	set_ledger(&env, 11_005, 2);
	let submit_result = client.try_submit(
		&campaign_id,
		&creator,
		&String::from_str(&env, "https://x.com/fail/status/1"),
	);
	assert!(submit_result.is_err());
}

#[test]
fn claim_fails_before_results_are_finalized() {
	let env = Env::default();
	env.mock_all_auths();
	set_ledger(&env, 21_000, 1);

	let admin = Address::generate(&env);
	let brand = Address::generate(&env);
	let creator = Address::generate(&env);

	let asset_contract = env.register_stellar_asset_contract_v2(admin.clone());
	let token_id = asset_contract.address();
	let token_admin = token::StellarAssetClient::new(&env, &token_id);
	token_admin.mint(&brand, &1_000);

	let contract_id = env.register(CampaignFactory, ());
	let client = CampaignFactoryClient::new(&env, &contract_id);

	let campaign_id = client.create_campaign(
		&String::from_str(&env, "Finalize guard"),
		&brand,
		&token_id,
		&100,
		&1_000,
	);

	client.submit(
		&campaign_id,
		&creator,
		&String::from_str(&env, "https://x.com/claim/status/1"),
	);

	let claim_result = client.try_claim_reward(&campaign_id, &0, &creator);
	assert!(claim_result.is_err());
}
