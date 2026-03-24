#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env, String,
};

#[test]
fn campaign_flow_works() {
    let env = Env::default();
    env.mock_all_auths();

    env.ledger().set(LedgerInfo {
        timestamp: 1_000,
        protocol_version: 23,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 1_000_000,
    });

    let admin = Address::generate(&env);
    let brand = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    let token_admin = token::StellarAssetClient::new(
        &env,
        &env.register_stellar_asset_contract_v2(admin.clone()),
    );
    let token_id = token_admin.address();
    let token = token::Client::new(&env, &token_id);

    token_admin.mint(&brand, &1_000);

    let contract_id = env.register(CampaignFactory, ());
    let client = CampaignFactoryClient::new(&env, &contract_id);

    let campaign_id = client.create_campaign(&brand, &token_id, &100, &1_000);
    assert_eq!(campaign_id, 0);

    client.submit(
        &campaign_id,
        &creator_a,
        &String::from_str(&env, "https://video-a"),
    );
    client.submit(
        &campaign_id,
        &creator_b,
        &String::from_str(&env, "https://video-b"),
    );

    assert_eq!(client.get_submission_count(&campaign_id), 2);

    env.ledger().set(LedgerInfo {
        timestamp: 1_101,
        protocol_version: 23,
        sequence_number: 2,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 1_000_000,
    });

    client.set_views(&campaign_id, &0, &300);
    client.set_views(&campaign_id, &1, &700);
    client.finalize_results(&campaign_id);

    client.claim_reward(&campaign_id, &0, &creator_a);
    client.claim_reward(&campaign_id, &1, &creator_b);

    assert_eq!(token.balance(&creator_a), 300);
    assert_eq!(token.balance(&creator_b), 700);

    let s0 = client.get_submission(&campaign_id, &0);
    let s1 = client.get_submission(&campaign_id, &1);
    assert!(s0.paid);
    assert!(s1.paid);
}
