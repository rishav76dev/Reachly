#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env,
    String, Vec,
};

#[contract]
pub struct CampaignFactory;

#[contracttype]
#[derive(Clone)]
pub struct Submission {
    pub creator: Address,
    pub link: String,
    pub views: u64,
    pub reward: i128,
    pub paid: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub name: String,
    pub brand: Address,
    pub token: Address,
    pub deadline: u64,
    pub total_budget: i128,
    pub total_views: u64,
    pub results_finalized: bool,
    pub submissions: Vec<Submission>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    CampaignCount,
    Campaign(u32),
}

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    BudgetMustBePositive = 1,
    DurationMustBePositive = 2,
    CampaignDoesNotExist = 3,
    CampaignEnded = 4,
    CampaignStillActive = 5,
    ResultsAlreadyFinalized = 6,
    InvalidSubmissionIndex = 7,
    NoViewsRecorded = 8,
    ResultsNotFinalized = 9,
    OnlyCreatorCanClaim = 10,
    RewardAlreadyClaimed = 11,
    NoRewardToClaim = 12,
    ViewsCannotDecrease = 13,
}

#[contractimpl]
impl CampaignFactory {
    pub fn create_campaign(
        env: Env,
        name: String,
        brand: Address,
        token_address: Address,
        duration: u64,
        total_budget: i128,
    ) -> u32 {
        brand.require_auth();

        if total_budget <= 0 {
            panic_with_error!(&env, Error::BudgetMustBePositive);
        }
        if duration == 0 {
            panic_with_error!(&env, Error::DurationMustBePositive);
        }

        let campaign_id = Self::get_campaign_count(env.clone());
        let deadline = env.ledger().timestamp().saturating_add(duration);

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&brand, &env.current_contract_address(), &total_budget);

        let campaign = Campaign {
            name,
            brand,
            token: token_address,
            deadline,
            total_budget,
            total_views: 0,
            results_finalized: false,
            submissions: Vec::new(&env),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage()
            .persistent()
            .set(&DataKey::CampaignCount, &(campaign_id + 1));

        campaign_id
    }

    pub fn submit(env: Env, campaign_id: u32, creator: Address, link: String) {
        creator.require_auth();
        let mut campaign = Self::load_campaign(&env, campaign_id);

        if env.ledger().timestamp() >= campaign.deadline {
            panic_with_error!(&env, Error::CampaignEnded);
        }

        campaign.submissions.push_back(Submission {
            creator,
            link,
            views: 0,
            reward: 0,
            paid: false,
        });

        Self::save_campaign(&env, campaign_id, &campaign);
    }

    pub fn set_views(env: Env, campaign_id: u32, index: u32, views: u64) {
        let mut campaign = Self::load_campaign(&env, campaign_id);

        if env.ledger().timestamp() < campaign.deadline {
            panic_with_error!(&env, Error::CampaignStillActive);
        }
        if campaign.results_finalized {
            panic_with_error!(&env, Error::ResultsAlreadyFinalized);
        }
        if index >= campaign.submissions.len() {
            panic_with_error!(&env, Error::InvalidSubmissionIndex);
        }

        let mut submission = campaign
            .submissions
            .get(index)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidSubmissionIndex));

        if views < submission.views {
            panic_with_error!(&env, Error::ViewsCannotDecrease);
        }
        campaign.total_views = campaign.total_views - submission.views + views;
        submission.views = views;
        campaign.submissions.set(index, submission);

        Self::save_campaign(&env, campaign_id, &campaign);
    }

    pub fn finalize_results(env: Env, campaign_id: u32) {
        let mut campaign = Self::load_campaign(&env, campaign_id);

        if env.ledger().timestamp() < campaign.deadline {
            panic_with_error!(&env, Error::CampaignStillActive);
        }
        if campaign.results_finalized {
            panic_with_error!(&env, Error::ResultsAlreadyFinalized);
        }
        if campaign.submissions.len() == 0 {
            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(
                &env.current_contract_address(),
                &campaign.brand,
                &campaign.total_budget,
            );
            campaign.results_finalized = true;
            Self::save_campaign(&env, campaign_id, &campaign);
            return;
        }

        if campaign.total_views == 0 {
            panic_with_error!(&env, Error::NoViewsRecorded);
        }

        for i in 0..campaign.submissions.len() {
            let mut submission = campaign
                .submissions
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidSubmissionIndex));

            submission.reward = (submission.views as i128 * campaign.total_budget)
                / (campaign.total_views as i128);

            campaign.submissions.set(i, submission);
        }

        campaign.results_finalized = true;
        Self::save_campaign(&env, campaign_id, &campaign);
    }

    pub fn claim_reward(env: Env, campaign_id: u32, index: u32, creator: Address) {
        creator.require_auth();
        let mut campaign = Self::load_campaign(&env, campaign_id);

        if !campaign.results_finalized {
            panic_with_error!(&env, Error::ResultsNotFinalized);
        }
        if index >= campaign.submissions.len() {
            panic_with_error!(&env, Error::InvalidSubmissionIndex);
        }

        let mut submission = campaign
            .submissions
            .get(index)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidSubmissionIndex));

        if submission.creator != creator {
            panic_with_error!(&env, Error::OnlyCreatorCanClaim);
        }
        if submission.paid {
            panic_with_error!(&env, Error::RewardAlreadyClaimed);
        }
        if submission.reward <= 0 {
            panic_with_error!(&env, Error::NoRewardToClaim);
        }

        submission.paid = true;
        campaign.submissions.set(index, submission.clone());
        Self::save_campaign(&env, campaign_id, &campaign);

        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &creator, &submission.reward);
    }

    pub fn get_campaign_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0)
    }

    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        Self::load_campaign(&env, campaign_id)
    }

    pub fn get_submission(env: Env, campaign_id: u32, index: u32) -> Submission {
        let campaign = Self::load_campaign(&env, campaign_id);
        campaign
            .submissions
            .get(index)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidSubmissionIndex))
    }

    pub fn get_submission_count(env: Env, campaign_id: u32) -> u32 {
        Self::load_campaign(&env, campaign_id).submissions.len()
    }
}

impl CampaignFactory {
    fn load_campaign(env: &Env, campaign_id: u32) -> Campaign {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .unwrap_or_else(|| panic_with_error!(env, Error::CampaignDoesNotExist))
    }

    fn save_campaign(env: &Env, campaign_id: u32, campaign: &Campaign) {
        env.storage()
            .persistent()
            .set(&DataKey::Campaign(campaign_id), campaign);
    }
}

#[cfg(test)]
mod test;
