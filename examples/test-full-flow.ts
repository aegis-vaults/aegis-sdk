/**
 * Aegis SDK - Full Flow Test
 * 
 * This script tests the complete Aegis flow:
 * 1. ✅ Valid transaction (within policy) - should succeed
 * 2. ❌ Invalid transaction (exceeds limit) - blocked, owner denies
 * 3. ✅ Valid transaction (within policy) - should succeed
 * 4. ❌ Invalid transaction (exceeds limit) - blocked, owner approves override
 * 
 * Prerequisites:
 * - Vault must be funded (send SOL to the deposit address)
 * - Agent secret key must be provided
 * - Destination should be whitelisted (or whitelist disabled)
 * 
 * Usage:
 *   VAULT_ADDRESS=xxx AGENT_SECRET=xxx npx tsx examples/test-full-flow.ts
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
import * as readline from 'readline';

// Configuration
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
const GUARDIAN_URL = process.env.GUARDIAN_URL || 'https://aegis-guardian-production.up.railway.app';

// Test destination (this could be any address - for testing we'll use a known one)
const TEST_DESTINATION = process.env.DESTINATION || 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA';

interface VaultInfo {
  authority: PublicKey;
  agentSigner: PublicKey;
  dailyLimit: bigint;
  dailySpent: bigint;
  vaultNonce: bigint;
  paused: boolean;
  whitelistCount: number;
  whitelist: PublicKey[];
}

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseVaultData(data: Buffer): VaultInfo {
  // VaultConfig layout:
  // 8 (discriminator) + 32 (authority) + 32 (agent_signer) + 8 (daily_limit) + 8 (spent_today) 
  // + 8 (last_reset) + 640 (whitelist: 32*20) + 1 (whitelist_count) + 1 (tier) + 2 (fee_basis_points)
  // + 50 (name) + 1 (name_len) + 1 (paused) + 8 (override_nonce) + 8 (vault_nonce) + 1 (bump)
  
  const authority = new PublicKey(data.slice(8, 40));
  const agentSigner = new PublicKey(data.slice(40, 72));
  const dailyLimit = data.readBigUInt64LE(72);
  const dailySpent = data.readBigUInt64LE(80);
  
  // Whitelist starts at offset 96 (8+32+32+8+8+8=96)
  const whitelistCount = data.readUInt8(96 + 640); // After the 640 bytes of whitelist storage
  const whitelist: PublicKey[] = [];
  for (let i = 0; i < whitelistCount; i++) {
    whitelist.push(new PublicKey(data.slice(96 + i * 32, 96 + (i + 1) * 32)));
  }
  
  // Paused is at offset: 8+32+32+8+8+8+640+1+1+2+50+1 = 791
  const paused = data.readUInt8(791) === 1;
  
  // Vault nonce is at offset: 791 + 1 + 8 = 800
  const vaultNonce = data.readBigUInt64LE(800);
  
  return {
    authority,
    agentSigner,
    dailyLimit,
    dailySpent,
    vaultNonce,
    paused,
    whitelistCount,
    whitelist,
  };
}

async function sendAgentTransaction(
  connection: Connection,
  vaultPubkey: PublicKey,
  agentKeypair: Keypair,
  destination: PublicKey,
  amountLamports: bigint,
  vaultNonce: bigint
): Promise<{ success: boolean; signature?: string; error?: string; blocked?: boolean }> {
  try {
    const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
    const [feeTreasury] = deriveFeeTreasuryPda(AEGIS_PROGRAM_ID);

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
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: feeTreasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const executeAgentIx = new TransactionInstruction({
      keys,
      programId: AEGIS_PROGRAM_ID,
      data,
    });

    // Add priority fees
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

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      // Get transaction logs to understand the error
      const txDetails = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      const logs = txDetails?.meta?.logMessages || [];
      const errorLog = logs.find(log => 
        log.includes('DailyLimitExceeded') || 
        log.includes('NotWhitelisted') || 
        log.includes('VaultPaused') ||
        log.includes('InsufficientFunds')
      );
      
      if (errorLog) {
        return { 
          success: false, 
          signature, 
          error: errorLog,
          blocked: true,
        };
      }
      
      return { 
        success: false, 
        signature, 
        error: JSON.stringify(confirmation.value.err),
      };
    }

    return { success: true, signature };
  } catch (error: any) {
    // Check if it's a simulation error with logs
    if (error.logs) {
      const errorLog = error.logs.find((log: string) => 
        log.includes('DailyLimitExceeded') || 
        log.includes('NotWhitelisted') || 
        log.includes('VaultPaused') ||
        log.includes('InsufficientFunds')
      );
      
      if (errorLog) {
        return { 
          success: false, 
          error: errorLog,
          blocked: true,
        };
      }
    }
    
    return { success: false, error: error.message };
  }
}

async function notifyGuardianBlockedTransaction(
  vaultPublicKey: string,
  destination: string,
  amount: string,
  reason: string
): Promise<{ success: boolean; blinkUrl?: string; error?: string }> {
  try {
    const response = await fetch(`${GUARDIAN_URL}/api/transactions/blocked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vaultPublicKey,
        destination,
        amount,
        reason,
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return { 
        success: true, 
        blinkUrl: data.data?.blinkUrl,
      };
    }
    
    return { success: false, error: data.error?.message || 'Unknown error' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           AEGIS - Full Override Flow Test                        ║');
  console.log('║                                                                  ║');
  console.log('║  This test simulates an AI agent sending transactions through   ║');
  console.log('║  an Aegis vault with policy enforcement and override approval.  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Get configuration
  const vaultAddress = process.env.VAULT_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET;
  const destination = process.env.DESTINATION || TEST_DESTINATION;

  if (!vaultAddress) {
    console.log('❌ Missing VAULT_ADDRESS environment variable');
    console.log('');
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=<vault_address> \\');
    console.log('  AGENT_SECRET=<base64_secret_key> \\');
    console.log('  npx tsx examples/test-full-flow.ts');
    console.log('');
    console.log('Example with your vault:');
    console.log('  VAULT_ADDRESS="2eSRPHgV61V6x1i75UJJdvyDRjPWPGRCmeJNoo6PvK1L" \\');
    console.log('  AGENT_SECRET="<your_agent_secret_key_base64>" \\');
    console.log('  npx tsx examples/test-full-flow.ts');
    process.exit(1);
  }

  if (!agentSecretKey) {
    console.log('❌ Missing AGENT_SECRET environment variable');
    console.log('');
    console.log('You need the agent\'s secret key (private key) to sign transactions.');
    console.log('This should be the keypair for: 43y7p1hX1fixXTka5tUCEByp8keNp3joVt8bg5pWjvCK');
    console.log('');
    console.log('If you generated the agent keypair, you should have saved the secret.');
    console.log('If not, you\'ll need to update the vault with a new agent keypair.');
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
  const vaultPubkey = new PublicKey(vaultAddress);
  const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
  const destinationPubkey = new PublicKey(destination);

  console.log('📡 Connected to Solana Devnet');
  console.log('');
  console.log('Configuration:');
  console.log(`  Vault Address:     ${vaultAddress}`);
  console.log(`  Deposit Address:   ${vaultAuthorityPda.toBase58()}`);
  console.log(`  Agent Public Key:  ${agentKeypair.publicKey.toBase58()}`);
  console.log(`  Test Destination:  ${destination}`);
  console.log(`  Guardian URL:      ${GUARDIAN_URL}`);
  console.log('');

  // Load vault data
  console.log('📋 Loading vault data from chain...');
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  if (!vaultAccount) {
    console.error('❌ Vault not found on-chain');
    process.exit(1);
  }

  const vaultInfo = parseVaultData(vaultAccount.data);
  
  // Verify agent signer
  if (!vaultInfo.agentSigner.equals(agentKeypair.publicKey)) {
    console.error('');
    console.error('❌ Agent signer mismatch!');
    console.error(`   Your agent: ${agentKeypair.publicKey.toBase58()}`);
    console.error(`   Vault expects: ${vaultInfo.agentSigner.toBase58()}`);
    process.exit(1);
  }
  console.log('✅ Agent signer verified');

  // Check balance
  const balance = await connection.getBalance(vaultAuthorityPda);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log(`💰 Vault Balance: ${balanceSol.toFixed(4)} SOL`);
  
  const dailyLimitSol = Number(vaultInfo.dailyLimit) / LAMPORTS_PER_SOL;
  const dailySpentSol = Number(vaultInfo.dailySpent) / LAMPORTS_PER_SOL;
  const remainingSol = dailyLimitSol - dailySpentSol;
  
  console.log(`📊 Daily Limit: ${dailyLimitSol.toFixed(4)} SOL`);
  console.log(`   Spent Today: ${dailySpentSol.toFixed(4)} SOL`);
  console.log(`   Remaining:   ${remainingSol.toFixed(4)} SOL`);
  console.log(`🔢 Vault Nonce: ${vaultInfo.vaultNonce}`);
  console.log(`⏸️  Paused: ${vaultInfo.paused ? 'Yes' : 'No'}`);
  console.log(`📝 Whitelist: ${vaultInfo.whitelistCount} addresses`);
  console.log('');

  if (balanceSol < 0.01) {
    console.log('⚠️  WARNING: Vault has low balance!');
    console.log(`   Please send at least 0.1 SOL to: ${vaultAuthorityPda.toBase58()}`);
    console.log('');
    console.log('   You can use:');
    console.log(`   solana transfer ${vaultAuthorityPda.toBase58()} 0.1 --allow-unfunded-recipient`);
    console.log('');
  }

  // Create readline interface for interactive prompts
  const rl = createReadlineInterface();

  try {
    // Calculate test amounts
    const validAmount = Math.min(remainingSol * 0.3, 0.01); // 30% of remaining or 0.01 SOL
    const invalidAmount = dailyLimitSol * 1.5; // 150% of daily limit (will exceed)

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                        TEST SCENARIOS                              ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Test 1: Valid transaction     - ${validAmount.toFixed(4)} SOL (within limit)`);
    console.log(`  Test 2: Invalid transaction   - ${invalidAmount.toFixed(4)} SOL (exceeds limit) → DENY override`);
    console.log(`  Test 3: Valid transaction     - ${validAmount.toFixed(4)} SOL (within limit)`);
    console.log(`  Test 4: Invalid transaction   - ${invalidAmount.toFixed(4)} SOL (exceeds limit) → APPROVE override`);
    console.log('');

    await prompt(rl, 'Press Enter to start Test 1 (Valid Transaction)...');

    // ═══════════════════════════════════════════════════════════════════
    // TEST 1: Valid Transaction
    // ═══════════════════════════════════════════════════════════════════
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: VALID TRANSACTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📤 Sending ${validAmount.toFixed(4)} SOL to ${destination.slice(0, 8)}...`);
    console.log('   Expected: SUCCESS (within daily limit)');
    console.log('');

    if (balanceSol >= validAmount + 0.001) {
      const result1 = await sendAgentTransaction(
        connection,
        vaultPubkey,
        agentKeypair,
        destinationPubkey,
        BigInt(Math.floor(validAmount * LAMPORTS_PER_SOL)),
        vaultInfo.vaultNonce
      );

      if (result1.success) {
        console.log('✅ TEST 1 PASSED: Transaction succeeded!');
        console.log(`   Signature: ${result1.signature}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${result1.signature}?cluster=devnet`);
      } else {
        console.log('❌ TEST 1 FAILED: Transaction should have succeeded');
        console.log(`   Error: ${result1.error}`);
      }
    } else {
      console.log('⏭️  TEST 1 SKIPPED: Insufficient balance');
    }

    await prompt(rl, '\nPress Enter to start Test 2 (Invalid Transaction - DENY)...');

    // ═══════════════════════════════════════════════════════════════════
    // TEST 2: Invalid Transaction (Exceed Limit) - DENY Override
    // ═══════════════════════════════════════════════════════════════════
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: INVALID TRANSACTION (Exceed Limit) - DENY OVERRIDE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📤 Attempting to send ${invalidAmount.toFixed(4)} SOL to ${destination.slice(0, 8)}...`);
    console.log('   Expected: BLOCKED (exceeds daily limit)');
    console.log('');

    const result2 = await sendAgentTransaction(
      connection,
      vaultPubkey,
      agentKeypair,
      destinationPubkey,
      BigInt(Math.floor(invalidAmount * LAMPORTS_PER_SOL)),
      vaultInfo.vaultNonce
    );

    if (!result2.success && result2.blocked) {
      console.log('✅ Transaction correctly BLOCKED by policy!');
      console.log(`   Reason: ${result2.error}`);
      console.log('');
      
      // Notify Guardian API to create override request and send notifications
      console.log('📲 Notifying Guardian API...');
      const guardianResult = await notifyGuardianBlockedTransaction(
        vaultAddress,
        destination,
        Math.floor(invalidAmount * LAMPORTS_PER_SOL).toString(),
        'DailyLimitExceeded'
      );

      if (guardianResult.success) {
        console.log('✅ Guardian notified! Owner will receive override request.');
        console.log('');
        console.log('🔗 BLINK URL (for owner to approve/deny):');
        console.log(`   ${guardianResult.blinkUrl}`);
        console.log('');
        console.log('📧 Check your email, Telegram, or Discord for the notification!');
        console.log('');
        console.log('👉 For this test, we will DENY the override.');
        console.log('   (In production, you would click "Deny" in the Blink)');
      } else {
        console.log(`⚠️  Guardian notification failed: ${guardianResult.error}`);
        console.log('   (This may happen if the vault is not linked to a user)');
      }
    } else if (result2.success) {
      console.log('❌ TEST 2 FAILED: Transaction should have been blocked!');
      console.log(`   Signature: ${result2.signature}`);
    } else {
      console.log('⚠️  Transaction failed with unexpected error');
      console.log(`   Error: ${result2.error}`);
    }

    await prompt(rl, '\nPress Enter to start Test 3 (Valid Transaction)...');

    // ═══════════════════════════════════════════════════════════════════
    // TEST 3: Another Valid Transaction
    // ═══════════════════════════════════════════════════════════════════
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: VALID TRANSACTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Re-fetch vault to get updated daily spent
    const vaultAccount2 = await connection.getAccountInfo(vaultPubkey);
    const vaultInfo2 = vaultAccount2 ? parseVaultData(vaultAccount2.data) : vaultInfo;
    const dailySpentSol2 = Number(vaultInfo2.dailySpent) / LAMPORTS_PER_SOL;
    const remainingSol2 = dailyLimitSol - dailySpentSol2;
    const validAmount2 = Math.min(remainingSol2 * 0.3, 0.01);

    console.log(`   Current daily spent: ${dailySpentSol2.toFixed(4)} SOL`);
    console.log(`   Remaining: ${remainingSol2.toFixed(4)} SOL`);
    console.log('');
    console.log(`📤 Sending ${validAmount2.toFixed(4)} SOL to ${destination.slice(0, 8)}...`);
    console.log('   Expected: SUCCESS (within remaining limit)');
    console.log('');

    const currentBalance = await connection.getBalance(vaultAuthorityPda);
    if (currentBalance >= validAmount2 * LAMPORTS_PER_SOL + 1000 && remainingSol2 > validAmount2) {
      const result3 = await sendAgentTransaction(
        connection,
        vaultPubkey,
        agentKeypair,
        destinationPubkey,
        BigInt(Math.floor(validAmount2 * LAMPORTS_PER_SOL)),
        vaultInfo.vaultNonce
      );

      if (result3.success) {
        console.log('✅ TEST 3 PASSED: Transaction succeeded!');
        console.log(`   Signature: ${result3.signature}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${result3.signature}?cluster=devnet`);
      } else {
        console.log('❌ TEST 3 FAILED: Transaction should have succeeded');
        console.log(`   Error: ${result3.error}`);
      }
    } else {
      console.log('⏭️  TEST 3 SKIPPED: Insufficient balance or daily limit exhausted');
    }

    await prompt(rl, '\nPress Enter to start Test 4 (Invalid Transaction - APPROVE)...');

    // ═══════════════════════════════════════════════════════════════════
    // TEST 4: Invalid Transaction - APPROVE Override
    // ═══════════════════════════════════════════════════════════════════
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 4: INVALID TRANSACTION (Exceed Limit) - APPROVE OVERRIDE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📤 Attempting to send ${invalidAmount.toFixed(4)} SOL to ${destination.slice(0, 8)}...`);
    console.log('   Expected: BLOCKED (exceeds daily limit)');
    console.log('');

    const result4 = await sendAgentTransaction(
      connection,
      vaultPubkey,
      agentKeypair,
      destinationPubkey,
      BigInt(Math.floor(invalidAmount * LAMPORTS_PER_SOL)),
      vaultInfo.vaultNonce
    );

    if (!result4.success && result4.blocked) {
      console.log('✅ Transaction correctly BLOCKED by policy!');
      console.log(`   Reason: ${result4.error}`);
      console.log('');
      
      // Notify Guardian API
      console.log('📲 Notifying Guardian API...');
      const guardianResult4 = await notifyGuardianBlockedTransaction(
        vaultAddress,
        destination,
        Math.floor(invalidAmount * LAMPORTS_PER_SOL).toString(),
        'DailyLimitExceeded'
      );

      if (guardianResult4.success) {
        console.log('✅ Guardian notified! Owner will receive override request.');
        console.log('');
        console.log('🔗 BLINK URL (for owner to approve):');
        console.log(`   ${guardianResult4.blinkUrl}`);
        console.log('');
        console.log('📧 Check your email, Telegram, or Discord for the notification!');
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('                     APPROVE THE OVERRIDE                           ');
        console.log('═══════════════════════════════════════════════════════════════════');
        console.log('');
        console.log('To complete Test 4, you need to approve the override:');
        console.log('');
        console.log('1. Open the Blink URL above in your Solana wallet');
        console.log('   (Or click the link in your email/Telegram notification)');
        console.log('');
        console.log('2. Review the transaction details');
        console.log('');
        console.log('3. Click "Approve Override" and sign the transaction');
        console.log('');
        console.log('4. Once approved, the override is stored on-chain');
        console.log('');
        console.log('Note: The override creates a pending approval on-chain.');
        console.log('      The agent can then execute the approved transaction.');
        console.log('');
        
        await prompt(rl, 'After approving the override, press Enter to continue...');
        
        // In a full implementation, we would now execute the approved override
        // This would call the execute_approved_override instruction
        console.log('');
        console.log('💡 In production, the agent would now execute the approved override');
        console.log('   using the execute_approved_override instruction.');
        console.log('');
      } else {
        console.log(`⚠️  Guardian notification failed: ${guardianResult4.error}`);
      }
    } else if (result4.success) {
      console.log('❌ TEST 4 FAILED: Transaction should have been blocked!');
      console.log(`   Signature: ${result4.signature}`);
    } else {
      console.log('⚠️  Transaction failed with unexpected error');
      console.log(`   Error: ${result4.error}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                        TEST SUMMARY                                ');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('The Aegis protocol provides:');
    console.log('');
    console.log('✅ Autonomous Agent Transactions - Agents can send SOL within limits');
    console.log('✅ Policy Enforcement - Daily limits and whitelists are enforced on-chain');
    console.log('✅ Override Flow - Blocked transactions can request owner approval');
    console.log('✅ Multi-Channel Notifications - Email, Telegram, Discord alerts');
    console.log('✅ Blink Integration - One-click approval via Solana Actions');
    console.log('');
    console.log('This is the "Corporate Expense Card for AI Agents" - agents have');
    console.log('autonomy within bounds, with human oversight when needed.');
    console.log('');

  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

