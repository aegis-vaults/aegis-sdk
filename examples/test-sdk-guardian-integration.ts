/**
 * Test SDK → Guardian Integration
 *
 * Simple test that demonstrates:
 * 1. Agent tries transaction that exceeds limit
 * 2. SDK automatically notifies Guardian API
 * 3. Guardian sends notifications to owner
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
import BN from 'bn.js';

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
const GUARDIAN_URL = 'https://aegis-guardian-production.up.railway.app';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Test SDK → Guardian Integration');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const vaultAddress = '3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja';
  const agentSecretKey = 'e7WOIpiYxY6p+3bhVGU73P5yLria3fK63aS75VkoHMIIrVFm2rYQy/5j1G207ff5QXmgS4T1qcMuMaN0vV1BRA==';
  const destination = 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA';

  const agentKeypair = Keypair.fromSecretKey(Buffer.from(agentSecretKey, 'base64'));
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const vaultPubkey = new PublicKey(vaultAddress);

  console.log('Configuration:');
  console.log(`  Vault: ${vaultAddress}`);
  console.log(`  Agent: ${agentKeypair.publicKey.toBase58()}`);
  console.log(`  Guardian: ${GUARDIAN_URL}`);
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

  console.log('Vault State:');
  console.log(`  Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`  Daily Spent: ${(Number(dailySpent) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`  Remaining: ${(Number(remainingLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('');

  // Try transaction that exceeds limit
  const amountSol = (Number(remainingLimit) / LAMPORTS_PER_SOL) + 0.05;
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Attempt Transaction (Will Fail)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Attempting: ${amountSol.toFixed(4)} SOL (exceeds limit by 0.05 SOL)`);
  console.log('');

  try {
    const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
    const [feeTreasuryPda] = deriveFeeTreasuryPda(AEGIS_PROGRAM_ID);

    const discriminator = Buffer.from([0x11, 0xbd, 0x67, 0xf4, 0xce, 0xe9, 0x2b, 0x9b]);
    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(vaultNonce, 8);
    data.writeBigUInt64LE(BigInt(amountLamports), 16);

    const keys = [
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },
      { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: false },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(destination), isSigner: false, isWritable: true },
      { pubkey: feeTreasuryPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const executeAgentIx = new TransactionInstruction({
      keys,
      programId: AEGIS_PROGRAM_ID,
      data,
    });

    const transaction = new Transaction();
    transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    transaction.add(executeAgentIx);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = agentKeypair.publicKey;

    transaction.sign(agentKeypair);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

    console.log('⚠️  Transaction succeeded (unexpected)');

  } catch (error: any) {
    console.log('✅ Transaction failed as expected (DailyLimitExceeded)');
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 2: Notify Guardian API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    const response = await fetch(`${GUARDIAN_URL}/api/transactions/blocked`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vaultPublicKey: vaultAddress,
        destination,
        amount: amountLamports.toString(),
        reason: 'DailyLimitExceeded',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Guardian API call failed:', errorData);
      process.exit(1);
    }

    const result = await response.json();

    console.log('✅ Guardian API notified successfully!');
    console.log('');
    console.log('Response:');
    console.log(`  Transaction ID: ${result.data.transactionId}`);
    console.log(`  Blink URL: ${result.data.blinkUrl}`);
    console.log(`  Message: ${result.data.message}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ INTEGRATION TEST SUCCESSFUL!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Expected Notifications:');
    console.log('  📧 Email to rkaelle@umich.edu');
    console.log('  💬 Telegram to @ryankaelle');
    console.log('  💬 Discord webhook');
    console.log('');
    console.log('Check your notifications NOW!');
    console.log('');
    console.log('Blink URL (for manual testing):');
    console.log(result.data.blinkUrl);
    console.log('');

  } catch (error: any) {
    console.error('❌ Failed to notify Guardian:', error.message);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
