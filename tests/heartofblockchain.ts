import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Heartofblockchain } from "../target/types/heartofblockchain";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram, MAX_SEED_LENGTH } from "@solana/web3.js";
import { assert, expect } from "chai";
import {
  createMint,
  mintTo,
  getAccount,
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("heartofblockchain", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .Heartofblockchain as Program<Heartofblockchain>;
  const provider = anchor.getProvider();
  const wallet = anchor.workspace.Heartofblockchain.provider.wallet;

  // State to store between tests
  let globalConfigPda: PublicKey;
  let mint: PublicKey;
  let campaignPda: PublicKey;
  let campaignTokenAccountPda: PublicKey;
  let serviceProviderKeypair: Keypair;
  let serviceProviderAssociatedTokenAccount: PublicKey;
  let donorKeypair: Keypair;
  let donorTokenAccount: PublicKey;
  let newAdminKeypair: Keypair;

  // Campaign constants
  const CAMPAIGN_NAME = "Test Campaign";
  const CAMPAIGN_DESCRIPTION = "A test campaign created for testing purposes";
  const TARGET_AMOUNT = new anchor.BN(1000000000); // 1000 tokens with 6 decimals

  before(async () => {
    // Generate keypairs for testing
    serviceProviderKeypair = Keypair.generate();
    donorKeypair = Keypair.generate();
    newAdminKeypair = Keypair.generate();

    // Fund the keypairs
    for (const kp of [serviceProviderKeypair, donorKeypair, newAdminKeypair]) {
      const tx = await provider.connection.requestAirdrop(
        kp.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(tx);
    }

    console.log("Funded test accounts");

    // Create token mint for all tests
    mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      wallet.publicKey,
      6 // decimals
    );
    console.log("Created mint:", mint.toString());

    // Create donor token account
    donorTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      donorKeypair.publicKey
    );
    console.log("Donor token account:", donorTokenAccount.toString());

    // Create service provider token account
    serviceProviderAssociatedTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      serviceProviderKeypair.publicKey
    );
    console.log(
      "Service provider token account:",
      serviceProviderAssociatedTokenAccount.toString()
    );

    // Mint initial tokens to donor
    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      donorTokenAccount,
      wallet.payer,
      2000000000 // 2000 tokens
    );
    console.log("Successfully minted tokens to donor account");

    // Find PDAs that will be used in multiple tests
    [globalConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      program.programId
    );

    [campaignPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("campaign"),
        serviceProviderKeypair.publicKey.toBuffer(),
        Buffer.from(CAMPAIGN_NAME),
      ],
      program.programId
    );

    [campaignTokenAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("campaign_token_account"), campaignPda.toBuffer()],
      program.programId
    );
  });

  it("Initialize global config", async () => {
    const admin = provider.publicKey;

    const tx = await program.methods
      .initializeGlobalConfig()
      .accounts({
        admin: admin,
      })
      .rpc();

    console.log("Global config initialized with signature:", tx);

    const globalConfig = await program.account.globalConfig.fetch(
      globalConfigPda
    );
    assert.equal(globalConfig.admin.toString(), admin.toString());
  });

  it("Update global admin", async () => {
    const globalConfig = await program.account.globalConfig.fetch(
      globalConfigPda
    );
    const currentAdmin = globalConfig.admin;

    const tx = await program.methods
      .updateGlobalAdmin(newAdminKeypair.publicKey)
      .accounts({
        globalConfig: globalConfigPda,
        admin: currentAdmin,
      })
      .rpc();

    console.log("Update admin transaction signature:", tx);

    const updatedGlobalConfig = await program.account.globalConfig.fetch(
      globalConfigPda
    );
    assert.equal(
      updatedGlobalConfig.admin.toString(),
      newAdminKeypair.publicKey.toString()
    );

    // Reset the admin back to the original for other tests
    await program.methods
      .updateGlobalAdmin(currentAdmin)
      .accounts({
        globalConfig: globalConfigPda,
        admin: newAdminKeypair.publicKey,
      })
      .signers([newAdminKeypair])
      .rpc();
  });

  it("Create a new campaign", async () => {
    try {
      const tx = await program.methods
        .createCampaign(CAMPAIGN_NAME, CAMPAIGN_DESCRIPTION, TARGET_AMOUNT)
        .accounts({
          creator: serviceProviderKeypair.publicKey,
          mint: mint,
        })
        .signers([serviceProviderKeypair])
        .rpc();

      console.log("Campaign created with transaction signature:", tx);
    } catch (error) {
      console.error("Error during campaign creation:", error);
      if (error.logs) {
        console.error("Simulation Logs:\n", error.logs.join("\n"));
      }
      throw error;
    }

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.equal(campaign.name, CAMPAIGN_NAME);
    assert.equal(campaign.description, CAMPAIGN_DESCRIPTION);
    assert(campaign.targetAmount.eq(TARGET_AMOUNT));
    assert.equal(
      campaign.creator.toString(),
      serviceProviderKeypair.publicKey.toString()
    );
    assert.equal(campaign.mint.toString(), mint.toString());
    assert.equal(campaign.thresholdReached, false);
    assert.equal(campaign.amountDonated.toNumber(), 0);
  });

  it("Donate to a campaign", async () => {
    // Initial account balance check
    const donorAccount = await getAccount(
      provider.connection,
      donorTokenAccount
    );
    const initialDonorBalance = Number(donorAccount.amount);

    // First donation - 500 tokens
    const donationAmount = new anchor.BN(500000000);

    const tx = await program.methods
      .donate(donationAmount)
      .accounts({
        campaign: campaignPda,
        donor: donorKeypair.publicKey,
        mint: mint,
      })
      .signers([donorKeypair])
      .rpc();

    console.log("Donation transaction:", tx);

    // Fetch updated campaign
    const updatedCampaign = await program.account.campaign.fetch(campaignPda);
    assert.equal(
      updatedCampaign.amountDonated.toNumber(),
      donationAmount.toNumber()
    );
    assert.equal(updatedCampaign.thresholdReached, false);

    // Check donor balance after donation
    const updatedDonorAccount = await getAccount(
      provider.connection,
      donorTokenAccount
    );
    assert.equal(
      Number(updatedDonorAccount.amount),
      initialDonorBalance - donationAmount.toNumber()
    );

    // Second donation to reach threshold - 600 tokens
    const secondDonationAmount = new anchor.BN(600000000);

    await program.methods
      .donate(secondDonationAmount)
      .accounts({
        campaign: campaignPda,
        donor: donorKeypair.publicKey,
        mint: mint,
      })
      .signers([donorKeypair])
      .rpc();

    // Verify threshold was reached
    const finalCampaign = await program.account.campaign.fetch(campaignPda);
    assert.equal(finalCampaign.amountDonated.toNumber(), 1100000000); // Total of both donations
    assert.equal(finalCampaign.thresholdReached, true);
  });

  it("Withdraw from campaign", async () => {
    // Check service provider token balance before withdrawal
    const creatorTokenAccountBefore = await getAccount(
      provider.connection,
      serviceProviderAssociatedTokenAccount
    );
    const balanceBefore = Number(creatorTokenAccountBefore.amount);

    // Perform withdrawal
    const tx = await program.methods
      .withdraw()
      .accounts({
        campaign: campaignPda,
        creator: serviceProviderKeypair.publicKey,
        mint: mint,
      })
      .signers([serviceProviderKeypair])
      .rpc();

    console.log("Withdrawal transaction:", tx);

    // Check creator token account balance after withdrawal
    const creatorTokenAccountAfter = await getAccount(
      provider.connection,
      serviceProviderAssociatedTokenAccount
    );
    const balanceAfter = Number(creatorTokenAccountAfter.amount);

    // Verify withdrawal - should have received 1,100,000,000 tokens
    assert.equal(
      balanceAfter,
      balanceBefore + 1100000000,
      "Creator should have received exactly the donated funds"
    );

    // Verify campaign was reset
    const updatedCampaign = await program.account.campaign.fetch(campaignPda);
    assert.equal(
      updatedCampaign.amountDonated.toNumber(),
      0,
      "Campaign amount should be reset to 0"
    );
    assert.equal(
      updatedCampaign.thresholdReached,
      false,
      "Threshold reached flag should be reset"
    );
  });

  describe("Failure cases", () => {
    let testCampaignPda: PublicKey;
    let testCampaignTokenPda: PublicKey;
    const TEST_CAMPAIGN_NAME = "Failure Test Campaign";

    before(async () => {
      // Create a campaign specifically for testing failures
      [testCampaignPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("campaign"),
          serviceProviderKeypair.publicKey.toBuffer(),
          Buffer.from(TEST_CAMPAIGN_NAME),
        ],
        program.programId
      );

      [testCampaignTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("campaign_token_account"), testCampaignPda.toBuffer()],
        program.programId
      );

      // Create the campaign with a large target amount
      await program.methods
        .createCampaign(
          TEST_CAMPAIGN_NAME,
          "Campaign for testing failure cases",
          new anchor.BN(2000000000) // 2000 tokens - higher than we'll donate
        )
        .accounts({
          creator: serviceProviderKeypair.publicKey,
          mint: mint,
        })
        .signers([serviceProviderKeypair])
        .rpc();

      // Make a small donation to this campaign
      await program.methods
        .donate(new anchor.BN(100000000)) // Only 100 tokens
        .accounts({
          campaign: testCampaignPda,
          donor: donorKeypair.publicKey,
          mint: mint,
        })
        .signers([donorKeypair])
        .rpc();
    });

    it("Should fail to withdraw if threshold not reached", async () => {
      try {
        await program.methods
          .withdraw()
          .accounts({
            campaign: testCampaignPda,
            creator: serviceProviderKeypair.publicKey,
            mint: mint,
          })
          .signers([serviceProviderKeypair])
          .rpc();

        assert.fail("Withdrawal should have failed, but it succeeded");
      } catch (err) {
        console.log("Expected error occurred:", err.message);
        assert(err, "Expected withdrawal to fail when threshold not reached");
      }
    });

    it("Should fail if non-creator tries to withdraw", async () => {
      // Create a campaign that will reach threshold
      const successCampaignName = "Success Test Campaign";

      // Find the campaign PDA
      const [successCampaignPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("campaign"),
          serviceProviderKeypair.publicKey.toBuffer(),
          Buffer.from(successCampaignName),
        ],
        program.programId
      );

      // Find the campaign token account PDA
      const [successCampaignTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("campaign_token_account"), successCampaignPda.toBuffer()],
        program.programId
      );

      // Create the campaign with achievable target
      await program.methods
        .createCampaign(
          successCampaignName,
          "Campaign for testing unauthorized withdrawal",
          new anchor.BN(500000000) // 500 tokens
        )
        .accounts({
          creator: serviceProviderKeypair.publicKey,
          mint: mint,
        })
        .signers([serviceProviderKeypair])
        .rpc();

      // Make donation to reach threshold
      await program.methods
        .donate(new anchor.BN(500000000))
        .accounts({
          campaign: successCampaignPda,
          donor: donorKeypair.publicKey,
          mint: mint,
        })
        .signers([donorKeypair])
        .rpc();

      // Verify threshold is reached
      const campaign = await program.account.campaign.fetch(successCampaignPda);
      assert.equal(
        campaign.thresholdReached,
        true,
        "Campaign threshold should be reached"
      );

      // Try to withdraw as non-creator (donor)
      try {
        await program.methods
          .withdraw()
          .accounts({
            campaign: successCampaignPda,
            creator: donorKeypair.publicKey, // Using donor instead of creator
            mint: mint,
          })
          .signers([donorKeypair])
          .rpc();

        assert.fail(
          "Non-creator withdrawal should have failed, but it succeeded"
        );
      } catch (err) {
        console.log("Expected error occurred:", err.message);
        assert(err, "Expected an error when non-creator tries to withdraw");
      }
    });
  });

  it("Close campaign", async () => {
    try {
      const tx = await program.methods.closeCampaign(CAMPAIGN_NAME).accounts({
        creator: serviceProviderKeypair.publicKey,
        mint: mint,
        campaign: campaignPda,
        campaignTokenAccount: campaignTokenAccountPda,
        creatorTokenAccount: serviceProviderAssociatedTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      }).signers([serviceProviderKeypair]).rpc();

      console.log("Campaign account closed successfully");
    } catch (e) {
      console.log("Failed to close campaign account");
      console.log(`Error : ${e}`);
    }
  })
});
