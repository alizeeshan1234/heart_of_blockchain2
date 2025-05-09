use anchor_lang::prelude::*;
use crate::state::Campaign;
use crate::error::CampaignError;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct GetTotalDonation<'info> {
    #[account(
        seeds = [b"campaign".as_ref(), creator.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    /// CHECK: Only used for PDA derivation
    pub creator: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn get_total_donation(ctx: Context<GetTotalDonation>, name: String) -> Result<()> {
    require!(!name.is_empty(), CampaignError::NameCannotBeEmpty);

    let campaign_account_info = &ctx.accounts.campaign;
    let total_donations = campaign_account_info.amount_donated;
    let target_amount = campaign_account_info.target_amount;

    msg!("Total Donation Received: {}", total_donations);
    msg!("Campaign Donation Target: {}", target_amount);

    let remaining = target_amount.saturating_sub(total_donations);

    msg!("Remaining Amount to Reach Goal: {}", remaining);

    Ok(())
}
