use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod error;

use instructions::*;

declare_id!("3pgACwNx4AjBnqJzoeaXH26rLG9hVKqePTuaz64KXaQR");

#[program]
pub mod heartofblockchain {
    use super::*;

    // Instruction to initialize the global configuration
    pub fn initialize_global_config(ctx: Context<InitializeGlobalConfig>) -> Result<()> {
        instructions::initialize_global_config::initialize_global_config(ctx)
    }

    // Instruction to update the global admin
    pub fn update_global_admin(ctx: Context<UpdateGlobalAdmin>, new_admin: Pubkey) -> Result<()> {
        instructions::update_global_admin::update_global_admin(ctx, new_admin)
    }

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        name: String,
        description: String,
        target_amount: u64,
    ) -> Result<()> {
        instructions::create_campaign::create_campaign(ctx, name, description, target_amount)
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        instructions::donate::donate(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw::withdraw(ctx)
    }

    pub fn close_campaign(ctx: Context<CloseCampaign>, name: String) -> Result<()> {
        instructions::close_campaign::close_campaign(ctx, name)
    }

    pub fn get_campaign_donation_info(ctx: Context<GetTotalDonation>, name: String) -> Result<()> {
        instructions::get_donation_info::get_total_donation(ctx, name)
    }
} 
