/**
 * Aegis SDK - Single Scenario Test
 * 
 * Run with:
 *   TEST_TYPE=valid|exceed_limit AMOUNT=0.01 npx tsx examples/test-scenario.ts
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

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
const GUARDIAN_URL = process.env.GUARDIAN_URL || 'https://aegis-guardian-production.up.railway.app';

async function main() {
  const vaultAddress = process.env.VAULT_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET;
  const destination = process.env.DESTINATION;
  const amountSol = parseFloat(process.env.AMOUNT || '0.01');
  const testType = process.env.TEST_TYPE || 'valid';

  if (!vaultAddress || !agentSecretKey || !destination) {
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=xxx AGENT_SECRET=xxx DESTINATION=xxx AMOUNT=0.01 TEST_TYPE=valid npx tsx examples/test-scenario.ts');
    process.exit(1);
  }

  // Parse agent keypair
  let agentKeypair: Keypair;
  try {
    if (agentSecretKey.startsWith('[')) {
      const jsonArray = JSON.parse(agentSecretKey);
      agentKeypair = Keypair.fromSecretKey(Uint8Array.from(jsonArray));
    } else {
      const decoded = Buffer.from(agentSecretKey, 'base64');
      agentKeypair = Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    console.error('❌ Failed to parse AGENT_SECRET');
    process.exit(1);
  }

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const vaultPubkey = new PublicKey(vaultAddress);
  const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
  const [feeTreasury] = deriveFeeTreasuryPda(AEGIS_PROGRAM_ID);
  const destinationPubkey = new PublicKey(destination);

  // Get vault data
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  if (!vaultAccount) {
    console.error('❌ Vault not found');
    process.exit(1);
  }

  const vaultNonce = vaultAccount.data.readBigUInt64LE(800);
  const dailyLimit = vaultAccount.data.readBigUInt64LE(72);
  const dailySpent = vaultAccount.data.readBigUInt64LE(80);
  const balance = await connection.getBalance(vaultAuthorityPda);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`TEST: ${testType.toUpperCase()} TRANSACTION`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`💰 Vault Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`📊 Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Spent Today: ${(Number(dailySpent) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`💸 Sending: ${amountSol} SOL to ${destination.slice(0,8)}...`);
  console.log('');

  const amountLamports = BigInt(Math.floor(amountSol * LAMPORTS_PER_SOL));

  // Build execute_agent instruction
  const discriminator = Buffer.from([0x11, 0xbd, 0x67, 0xf4, 0xce, 0xe9, 0x2b, 0x9b]);
  const data = Buffer.alloc(24);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(vaultNonce, 8);
  data.writeBigUInt64LE(amountLamports, 16);

  const keys = [
    { pubkey: vaultPubkey, isSigner: false, isWritable: true },
    { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: false },
    { pubkey: vaultAuthorityPda, isSigner: false, isWritable: true },
    { pubkey: destinationPubkey, isSigner: false, isWritable: true },
    { pubkey: feeTreasury, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const executeAgentIx = new TransactionInstruction({
    keys,
    programId: AEGIS_PROGRAM_ID,
    data,
  });

  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 });
  const computeUnitsIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 });

  const transaction = new Transaction();
  transaction.add(priorityFeeIx);
  transaction.add(computeUnitsIx);
  transaction.add(executeAgentIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = agentKeypair.publicKey;
  transaction.sign(agentKeypair);

  console.log('📤 Sending transaction...');

  try {
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`🔗 Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('');
    console.log('⏳ Waiting for confirmation...');

    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      const txDetails = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      const logs = txDetails?.meta?.logMessages || [];
      console.log('');
      console.log('❌ TRANSACTION BLOCKED BY POLICY!');
      console.log('');
      console.log('Logs:');
      logs.forEach(log => {
        if (log.includes('Error') || log.includes('failed') || log.includes('Exceeded') || log.includes('Whitelist')) {
          console.log(`  ⚠️  ${log}`);
        }
      });

      // Notify Guardian
      console.log('');
      console.log('📲 Notifying Guardian API to send override request...');
      
      const response = await fetch(`${GUARDIAN_URL}/api/transactions/blocked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultPublicKey: vaultAddress,
          destination,
          amount: amountLamports.toString(),
          reason: 'DailyLimitExceeded',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('');
        console.log('✅ OVERRIDE REQUEST CREATED!');
        console.log('');
        console.log('📧 Check your email, Telegram, or Discord for the notification.');
        console.log('');
        console.log('🔗 BLINK URL (click to approve/deny):');
        console.log(`   ${result.data?.blinkUrl}`);
        console.log('');
      } else {
        console.log(`⚠️  Guardian notification failed: ${result.error?.message || 'Unknown error'}`);
      }
    } else {
      console.log('');
      console.log('✅ TRANSACTION SUCCESSFUL!');
      console.log('');
      const newBalance = await connection.getBalance(vaultAuthorityPda);
      console.log(`💰 New vault balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    }
  } catch (error: any) {
    console.log('');
    console.log('❌ TRANSACTION FAILED (likely blocked by policy)');
    console.log('');
    
    if (error.logs) {
      console.log('Program logs:');
      error.logs.forEach((log: string) => console.log(`  ${log}`));
    }
    
    // Check for policy errors and notify Guardian
    const isBlocked = error.logs?.some((log: string) => 
      log.includes('DailyLimitExceeded') || 
      log.includes('NotWhitelisted') ||
      log.includes('VaultPaused')
    );

    if (isBlocked) {
      console.log('');
      console.log('📲 Notifying Guardian API to send override request...');
      
      let reason = 'DailyLimitExceeded';
      if (error.logs?.some((log: string) => log.includes('NotWhitelisted'))) {
        reason = 'NotWhitelisted';
      } else if (error.logs?.some((log: string) => log.includes('VaultPaused'))) {
        reason = 'VaultPaused';
      }

      try {
        const response = await fetch(`${GUARDIAN_URL}/api/transactions/blocked`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vaultPublicKey: vaultAddress,
            destination,
            amount: amountLamports.toString(),
            reason,
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('');
          console.log('✅ OVERRIDE REQUEST CREATED!');
          console.log('');
          console.log('📧 Check your email, Telegram, or Discord for the notification.');
          console.log('');
          console.log('🔗 BLINK URL (click to approve/deny):');
          console.log(`   ${result.data?.blinkUrl}`);
          console.log('');
        } else {
          console.log(`⚠️  Guardian notification failed: ${result.error?.message}`);
        }
      } catch (e: any) {
        console.log(`⚠️  Failed to notify Guardian: ${e.message}`);
      }
    }
  }
}

main().catch(console.error);

