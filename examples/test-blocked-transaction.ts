/**
 * Aegis SDK - Test Blocked Transaction Flow
 *
 * This script INTENTIONALLY sends a transaction that exceeds the daily limit
 * to trigger the override flow and test notifications.
 *
 * Expected Flow:
 * 1. Transaction is submitted on-chain
 * 2. Protocol blocks it with DailyLimitExceeded error
 * 3. TransactionBlocked event emitted
 * 4. Guardian event listener captures event
 * 5. Blink generated and stored
 * 6. Notifications sent (Telegram/Discord/Email)
 *
 * Usage:
 *   VAULT_ADDRESS=xxx AGENT_SECRET=xxx npx tsx examples/test-blocked-transaction.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { deriveVaultAuthorityPda, deriveFeeTreasuryPda } from '../src';

// Configuration
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
const DEFAULT_DESTINATION = 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   AEGIS - Test BLOCKED Transaction & Override Flow');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  This script INTENTIONALLY sends a transaction that will be');
  console.log('   BLOCKED by the protocol to test the override notification flow.');
  console.log('');

  // Get environment variables
  const vaultAddress = process.env.VAULT_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET;
  const destination = process.env.DESTINATION || DEFAULT_DESTINATION;

  if (!vaultAddress || !agentSecretKey) {
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=<vault_pubkey> \\');
    console.log('  AGENT_SECRET=<base64_secret> \\');
    console.log('  npx tsx examples/test-blocked-transaction.ts');
    console.log('');
    console.log('Example:');
    console.log('  VAULT_ADDRESS="3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja" \\');
    console.log('  AGENT_SECRET="e7WOIpiYxY6p+3bhVGU73P5yLria3fK63aS75VkoHMIIrVFm2rYQy/5j1G207ff5QXmgS4T1qcMuMaN0vV1BRA==" \\');
    console.log('  npx tsx examples/test-blocked-transaction.ts');
    process.exit(1);
  }

  // Parse agent keypair
  let agentKeypair: Keypair;
  try {
    const decoded = Buffer.from(agentSecretKey, 'base64');
    if (decoded.length === 64) {
      agentKeypair = Keypair.fromSecretKey(decoded);
    } else {
      const jsonArray = JSON.parse(agentSecretKey);
      agentKeypair = Keypair.fromSecretKey(Uint8Array.from(jsonArray));
    }
  } catch (e) {
    console.error('❌ Failed to parse AGENT_SECRET');
    console.error('   Expected base64 string or JSON array of bytes');
    process.exit(1);
  }

  // Initialize connection
  const connection = new Connection(DEVNET_RPC, 'confirmed');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Check Vault State');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📦 Vault: ${vaultAddress}`);
  console.log(`🤖 Agent: ${agentKeypair.publicKey.toBase58()}`);
  console.log(`🎯 Destination: ${destination}`);
  console.log('');

  // Get vault data
  const vaultPubkey = new PublicKey(vaultAddress);
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);

  if (!vaultAccount) {
    console.error('❌ Vault account not found on-chain');
    process.exit(1);
  }

  // Derive vault authority PDA
  const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
  const [feeTreasury] = deriveFeeTreasuryPda(AEGIS_PROGRAM_ID);

  // Parse vault data
  const dailyLimit = vaultAccount.data.readBigUInt64LE(72);
  const dailySpent = vaultAccount.data.readBigUInt64LE(80);
  const remainingLimit = dailyLimit - dailySpent;

  // Parse vault nonce
  const vaultNonceOffset = 8 + 32 + 32 + 8 + 8 + 8 + 640 + 1 + 1 + 2 + 50 + 1 + 1 + 8;
  const vaultNonce = vaultAccount.data.readBigUInt64LE(vaultNonceOffset);

  console.log(`📊 Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Daily Spent: ${(Number(dailySpent) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Remaining: ${(Number(remainingLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Vault Nonce: ${vaultNonce}`);
  console.log('');

  // Calculate amount that will EXCEED the limit
  const blockedAmountSol = (Number(remainingLimit) / LAMPORTS_PER_SOL) + 0.05; // 0.05 SOL over limit
  const blockedAmountLamports = Math.floor(blockedAmountSol * LAMPORTS_PER_SOL);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 2: Send Transaction That EXCEEDS Limit');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`💸 Attempting: ${blockedAmountSol.toFixed(4)} SOL`);
  console.log(`   Remaining Limit: ${(Number(remainingLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Amount Over Limit: 0.0500 SOL`);
  console.log('');
  console.log('⚠️  This transaction WILL BE BLOCKED by the protocol!');
  console.log('');

  // Confirm before proceeding
  if (process.env.FORCE !== 'true') {
    console.log('To proceed with this blocked transaction test, run:');
    console.log('');
    console.log(`FORCE=true VAULT_ADDRESS="${vaultAddress}" AGENT_SECRET="..." \\`);
    console.log('  npx tsx examples/test-blocked-transaction.ts');
    console.log('');
    console.log('Expected result:');
    console.log('  1. ❌ Transaction will FAIL on-chain (DailyLimitExceeded)');
    console.log('  2. 📡 Guardian captures TransactionBlocked event');
    console.log('  3. 🔗 Blink URL generated');
    console.log('  4. 📧 Notifications sent to vault owner');
    console.log('');
    process.exit(0);
  }

  console.log('🚀 Sending blocked transaction...');
  console.log('');

  try {
    // Build execute_agent instruction
    const discriminator = Buffer.from([0x11, 0xbd, 0x67, 0xf4, 0xce, 0xe9, 0x2b, 0x9b]);
    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(vaultNonce, 8);
    data.writeBigUInt64LE(BigInt(blockedAmountLamports), 16);

    const keys = [
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },
      { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: false },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(destination), isSigner: false, isWritable: true },
      { pubkey: feeTreasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const executeAgentIx = new TransactionInstruction({
      keys,
      programId: AEGIS_PROGRAM_ID,
      data,
    });

    // Add priority fees
    const transaction = new Transaction();
    transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    transaction.add(executeAgentIx);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = agentKeypair.publicKey;

    // Sign and send
    transaction.sign(agentKeypair);

    console.log('📤 Sending transaction (expecting it to fail)...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`🔗 Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('');

    // Wait for confirmation
    console.log('⏳ Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Transaction BLOCKED as Expected!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      // Get transaction details
      const txDetails = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (txDetails?.meta?.logMessages) {
        console.log('Program logs:');
        txDetails.meta.logMessages.forEach(log => {
          if (log.includes('DailyLimitExceeded') || log.includes('Error')) {
            console.log(`  🚫 ${log}`);
          } else if (log.includes('Program log:')) {
            console.log(`  ${log}`);
          }
        });
        console.log('');
      }

      console.log('Expected Guardian Actions:');
      console.log('  1. 📡 Event listener captures TransactionBlocked event');
      console.log('  2. 💾 Stores transaction in database');
      console.log('  3. 🔗 Generates Blink URL for override approval');
      console.log('  4. 📧 Sends notifications to vault owner');
      console.log('');
      console.log('Check Guardian logs:');
      console.log('  railway logs | grep -i "transaction blocked"');
      console.log('');
      console.log('Expected Blink URL format:');
      console.log(`  https://dial.to/?action=solana-action:https://aegis-guardian-production.up.railway.app/api/blinks/override?vault=${vaultAddress}&destination=${destination}&amount=${blockedAmountLamports}&reason=exceeded_daily_limit`);
      console.log('');

    } else {
      console.log('');
      console.log('⚠️  Unexpected: Transaction succeeded!');
      console.log('   This should not happen if the amount exceeds the daily limit.');
      console.log('');
    }

  } catch (error: any) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Transaction Error (Expected)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (error.logs) {
      console.log('Program logs:');
      error.logs.forEach((log: string) => {
        if (log.includes('DailyLimitExceeded')) {
          console.log(`  🚫 ${log}`);
        } else {
          console.log(`  ${log}`);
        }
      });
      console.log('');
    }

    if (error.message?.includes('DailyLimitExceeded')) {
      console.log('✅ SUCCESS! Transaction was blocked by Aegis policy.');
      console.log('');
      console.log('Next Steps:');
      console.log('  1. Check Guardian logs for event processing');
      console.log('  2. Verify Blink was generated');
      console.log('  3. Check for notifications (Telegram/Discord/Email)');
      console.log('');
    } else {
      console.log('❌ Unexpected error:', error.message);
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
