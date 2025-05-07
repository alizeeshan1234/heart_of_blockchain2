use anchor_lang::prelude::*;

#[error_code]
pub enum CampaignError {
    #[msg("Invalid mint provided.")]
    InvalidMint,
    #[msg("Invalid mint decimals.")]
    InvalidMintDecimals,
    #[msg("Unauthorized: Signer is not the campaign creator.")]
    Unauthorized,
    #[msg("Campaign threshold has not been reached yet.")]
    ThresholdNotReached,
    #[msg("Arithmetic overflow occurred.")]
    Overflow,
    #[msg("No funds available to withdraw.")]
    NoFundsToWithdraw,
    #[msg("Unauthorized: Signer is not the global admin.")]
    UnauthorizedAdmin,
    #[msg("New admin cannot be the same as the current admin.")]
    AdminCannotBeSame,
    #[msg("Campaign name cannot be empty.")]
    NameCannotBeEmpty,
    #[msg("Campaign name is too long.")]
    NameTooLong,
    #[msg("Campaign description cannot be empty.")]
    DescriptionCannotBeEmpty,
    #[msg("Campaign description is too long.")]
    DescriptionTooLong,
    #[msg("Target amount must be greater than zero.")]
    TargetAmountMustBePositive,
    #[msg("Donation amount must be greater than zero.")]
    DonationAmountMustBePositive,
    #[msg("Invalid token account owner.")]
    InvalidTokenAccountOwner,
    #[msg("Invalid system program.")]
    InvalidSystemProgram,
    #[msg("Invalid token program.")]
    InvalidTokenProgram,
    #[msg("Invalid associated token program.")]
    InvalidAssociatedTokenProgram,
    #[msg("Invalid campaign name provided")]
    InvalidCampaignName
} 