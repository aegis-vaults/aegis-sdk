/**
 * Aegis - Complete Override Flow Test
 *
 * This tests the full override flow:
 * 1. Attempt transaction that exceeds limit (fails)
 * 2. Create override request (emits TransactionBlocked event)
 * 3. Guardian captures event and sends notifications
 * 4. User approves override via Blink
 * 5. Agent executes override
 *
 * Usage:
 *   VAULT_ADDRESS=xxx AGENT_SECRET=xxx OWNER_SECRET=xxx npx tsx examples/test-complete-override-flow.ts
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
import { deriveVaultAuthorityPda, deriveFeeTreasuryPda, deriveOverridePda } from '../src';
import BN from 'bn.js';

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
const DEFAULT_DESTINATION = 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA';

// BlockReason enum
enum BlockReason {
  DailyLimitExceeded = 0,
  NotWhitelisted = 1,
  VaultPaused = 2,
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   AEGIS - Complete Override Flow Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const vaultAddress = process.env.VAULT_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET;
  const ownerSecretKey = process.env.OWNER_SECRET;
  const destination = process.env.DESTINATION || DEFAULT_DESTINATION;

  if (!vaultAddress || !agentSecretKey || !ownerSecretKey) {
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=<vault_pubkey> \\');
    console.log('  AGENT_SECRET=<agent_base64_secret> \\');
    console.log('  OWNER_SECRET=<owner_base64_secret> \\');
    console.log('  npx tsx examples/test-complete-override-flow.ts');
    console.log('');
    console.log('Note: OWNER_SECRET is your vault owner keypair (base64)');
    process.exit(1);
  }

  // Parse keypairs
  let agentKeypair: Keypair;
  let ownerKeypair: Keypair;

  try {
    const agentDecoded = Buffer.from(agentSecretKey, 'base64');
    agentKeypair = Keypair.fromSecretKey(agentDecoded);

    const ownerDecoded = Buffer.from(ownerSecretKey, 'base64');
    ownerKeypair = Keypair.fromSecretKey(ownerDecoded);
  } catch (e) {
    console.error('❌ Failed to parse secrets');
    process.exit(1);
  }

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const vaultPubkey = new PublicKey(vaultAddress);

  console.log('Configuration:');
  console.log(`  Vault: ${vaultAddress}`);
  console.log(`  Owner: ${ownerKeypair.publicKey.toBase58()}`);
  console.log(`  Agent: ${agentKeypair.publicKey.toBase58()}`);
  console.log(`  Destination: ${destination}`);
  console.log('');

  // Get vault data
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  if (!vaultAccount) {
    console.error('❌ Vault not found');
    process.exit(1);
  }

  const dailyLimit = vaultAccount.data.readBigUInt64LE(72);
  const dailySpent = vaultAccount.data.readBigUInt64LE(80);
  const remainingLimit = dailyLimit - dailySpent;

  const vaultNonceOffset = 8 + 32 + 32 + 8 + 8 + 8 + 640 + 1 + 1 + 2 + 50 + 1 + 1 + 8;
  const vaultNonce = vaultAccount.data.readBigUInt64LE(vaultNonceOffset);
  const overrideNonceOffset = vaultNonceOffset - 8;
  const overrideNonce = vaultAccount.data.readBigUInt64LE(overrideNonceOffset);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Check Vault State');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Daily Spent: ${(Number(dailySpent) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Remaining: ${(Number(remainingLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Override Nonce: ${overrideNonce}`);
  console.log('');

  // Calculate amount that exceeds limit
  const amountSol = (Number(remainingLimit) / LAMPORTS_PER_SOL) + 0.05;
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 2: Create Override Request');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Amount: ${amountSol.toFixed(4)} SOL (exceeds limit by 0.05 SOL)`);
  console.log(`This will emit TransactionBlocked event`);
  console.log('');

  try {
    // Derive PDAs
    const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
    const [pendingOverridePda] = deriveOverridePda(
      vaultPubkey,
      new BN(overrideNonce.toString()),
      AEGIS_PROGRAM_ID
    );

    // Build create_override instruction
    // Discriminator from IDL
    const discriminator = Buffer.from([155, 251, 76, 3, 17, 208, 181, 67]);

    // Instruction data: discriminator + vault_nonce (u64) + destination (pubkey) + amount (u64) + reason (u8)
    const data = Buffer.alloc(8 + 8 + 32 + 8 + 1);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(vaultNonce, 8);
    new PublicKey(destination).toBuffer().copy(data, 16);
    data.writeBigUInt64LE(BigInt(amountLamports), 48);
    data.writeUInt8(BlockReason.DailyLimitExceeded, 56);

    const keys = [
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },
      { pubkey: ownerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: pendingOverridePda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const createOverrideIx = new TransactionInstruction({
      keys,
      programId: AEGIS_PROGRAM_ID,
      data,
    });

    // Build transaction
    const transaction = new Transaction();
    transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    transaction.add(createOverrideIx);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = ownerKeypair.publicKey;

    console.log('📤 Sending create_override instruction...');
    transaction.sign(ownerKeypair);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`🔗 Transaction: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('');

    console.log('⏳ Waiting for confirmation...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      console.error('');
      console.error('❌ Transaction failed:', confirmation.value.err);
      process.exit(1);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Override Request Created!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Transaction Details:');
    console.log(`  Signature: ${signature}`);
    console.log(`  Override Nonce: ${overrideNonce}`);
    console.log(`  Amount: ${amountSol.toFixed(4)} SOL`);
    console.log(`  Destination: ${destination}`);
    console.log(`  Reason: Daily limit exceeded`);
    console.log('');

    console.log('Expected Guardian Actions:');
    console.log('  1. 📡 Event listener captures TransactionBlocked event');
    console.log('  2. 💾 Stores override request in database');
    console.log('  3. 🔗 Generates Blink URL');
    console.log('  4. 📧 Sends notifications via:');
    console.log('     - Email: rkaelle@umich.edu');
    console.log('     - Telegram: @ryankaelle');
    console.log('     - Discord webhook');
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Next Steps:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. Check your notifications (should arrive within 10 seconds)');
    console.log('2. Click the Blink URL in the notification');
    console.log('3. Sign the override approval transaction');
    console.log('4. Wait for timelock period (1 hour)');
    console.log('5. Execute the override');
    console.log('');

    // Wait a bit to give the event listener time to process
    console.log('⏳ Waiting 15 seconds for Guardian to process event...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check if override was captured
    console.log('');
    console.log('📊 Checking Guardian database...');

    const guardianUrl = 'https://aegis-guardian-production.up.railway.app';
    const response = await fetch(`${guardianUrl}/api/vaults/${vaultAddress}/overrides`);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data.items.length > 0) {
        const latestOverride = data.data.items[0];
        console.log('✅ Override found in Guardian database!');
        console.log(`   Status: ${latestOverride.status}`);
        console.log(`   Blink URL: ${latestOverride.blinkUrl || '(generating...)'}`);
      } else {
        console.log('⚠️  Override not yet in database (may take a few seconds)');
      }
    }
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('❌ Error:', error.message);

    if (error.logs) {
      console.error('');
      console.error('Program logs:');
      error.logs.forEach((log: string) => console.error(`  ${log}`));
    }

    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
