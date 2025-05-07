use anchor_lang::prelude::*;
use crate::state::Campaign;
use crate::error::CampaignError;
use anchor_spl::{
    associated_token::AssociatedToken, token::{self, Mint, Token, TokenAccount, Transfer} 
};

pub fn close_campaign(ctx: Context<CloseCampaign>, name: String) -> Result<()> {

    let campaign = &mut ctx.accounts.campaign;

    require!(!name.is_empty(), CampaignError::NameCannotBeEmpty);
    require!(name == campaign.name, CampaignError::InvalidCampaignName);

    let campaign_token_account = &mut ctx.accounts.campaign_token_account;
    let amount = campaign_token_account.amount;

    let bump = campaign.bump; 
    let seeds = &[
        b"campaign".as_ref(),
        campaign.creator.as_ref(),
        campaign.name.as_bytes(),
        &[bump],
    ];

    let signer_seeds = &[&seeds[..]];

    let cpi_program = ctx.accounts.token_program.to_account_info();

    let cpi_accounts = Transfer {
        from: ctx.accounts.campaign_token_account.to_account_info(),
        to: ctx.accounts.creator_token_account.to_account_info(),
        authority: campaign.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

    token::transfer(cpi_ctx, amount)?;

    msg!("Campaign account closed successfully");
    msg!("Remaining funds are transferred to the campaign creator's token account");

    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String)] 
pub struct CloseCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"campaign".as_ref(), creator.key().as_ref(), name.as_bytes()],
        bump,
        close = creator
    )]
    pub campaign: Account<'info, Campaign>,
  
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = campaign,
        token::token_program = token_program,
        close = creator
    )]
    pub campaign_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

