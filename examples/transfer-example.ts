/**
 * Aegis SDK Transfer Example
 * 
 * This example demonstrates both:
 * 1. A BLOCKED transaction (exceeds daily limit)
 * 2. A VIABLE transaction (within policy constraints)
 * 
 * Target: APu4og6CE5uocyKHrb6fNw7RukVaTtceH4wKoxfMoALs (Devnet)
 * 
 * Prerequisites:
 * - A vault must exist with funds
 * - The agent signer private key must be available
 * 
 * Usage:
 *   VAULT_ADDRESS=xxx AGENT_SECRET=xxx npx tsx examples/transfer-example.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { AegisClient, generateVaultNonce, deriveVaultPda, deriveVaultAuthorityPda } from '../src';
import * as bs58 from 'bs58';

// Configuration
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const TARGET_ADDRESS = 'APu4og6CE5uocyKHrb6fNw7RukVaTtceH4wKoxfMoALs';

// Aegis Program ID (devnet) - matches SDK default
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('             AEGIS SDK - Transfer Example (Devnet)              ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Initialize connection
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  console.log('📡 Connected to Solana Devnet');
  console.log(`   RPC: ${DEVNET_RPC.split('?')[0]}...`);
  console.log('');

  // Get environment variables
  const vaultAddress = process.env.VAULT_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET;
  const ownerSecretKey = process.env.OWNER_SECRET;

  if (!vaultAddress) {
    console.log('⚠️  No VAULT_ADDRESS provided. Running in DEMO mode.');
    console.log('');
    await runDemoMode(connection);
    return;
  }

  if (!agentSecretKey) {
    console.error('❌ Missing AGENT_SECRET environment variable');
    console.log('   Set AGENT_SECRET=<base64_or_base58_private_key>');
    process.exit(1);
  }

  // Parse agent keypair
  let agentKeypair: Keypair;
  try {
    // Try base64 first (from the vault creation dialog)
    const decoded = Buffer.from(agentSecretKey, 'base64');
    if (decoded.length === 64) {
      agentKeypair = Keypair.fromSecretKey(decoded);
    } else {
      // Try base58
      agentKeypair = Keypair.fromSecretKey(bs58.decode(agentSecretKey));
    }
  } catch (e) {
    console.error('❌ Failed to parse AGENT_SECRET. Expected base64 or base58 encoded private key.');
    process.exit(1);
  }

  console.log('🔑 Agent Signer:', agentKeypair.publicKey.toBase58());
  console.log('📦 Vault Address:', vaultAddress);
  console.log('🎯 Target Address:', TARGET_ADDRESS);
  console.log('');

  // Get vault info
  const vaultPubkey = new PublicKey(vaultAddress);
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  
  if (!vaultAccount) {
    console.error('❌ Vault account not found on-chain');
    console.log('   Make sure the vault has been created on devnet');
    process.exit(1);
  }

  console.log('✅ Vault exists on-chain');
  console.log(`   Data size: ${vaultAccount.data.length} bytes`);
  console.log(`   Owner: ${vaultAccount.owner.toBase58()}`);
  console.log('');

  // Derive vault authority (where funds are held)
  const [vaultAuthority] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
  console.log('💰 Vault Authority (deposit address):', vaultAuthority.toBase58());

  // Get vault balance
  const balance = await connection.getBalance(vaultAuthority);
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('');

  if (balance === 0) {
    console.log('⚠️  Vault has no balance. Please fund it first:');
    console.log(`   solana transfer ${vaultAuthority.toBase58()} 0.5 --url devnet`);
    console.log('');
    console.log('Running demo mode instead...');
    console.log('');
    await runDemoMode(connection);
    return;
  }

  // Parse vault data to get daily limit
  const dailyLimit = parseVaultDailyLimit(vaultAccount.data);
  console.log(`📊 Vault Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    TRANSACTION EXAMPLES                         ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Example 1: Blocked Transaction (exceeds daily limit)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚫 EXAMPLE 1: BLOCKED TRANSACTION (Exceeds Daily Limit)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const blockedAmount = dailyLimit + BigInt(LAMPORTS_PER_SOL); // 1 SOL over limit
  console.log(`   Amount: ${(Number(blockedAmount) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Status: ❌ WOULD BE BLOCKED`);
  console.log('');
  console.log('   Reason: Transaction amount exceeds the vault\'s daily spending limit.');
  console.log('   The Aegis program will reject this transaction with:');
  console.log('   "Error: DailyLimitExceeded"');
  console.log('');

  // Example 2: Viable Transaction (within limits)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ EXAMPLE 2: VIABLE TRANSACTION (Within Policy)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Use 10% of the daily limit or 0.01 SOL, whichever is smaller
  const viableAmount = BigInt(Math.min(
    Number(dailyLimit) / 10,
    0.01 * LAMPORTS_PER_SOL,
    balance - 5000 // Leave some for rent
  ));
  
  if (viableAmount <= 0) {
    console.log('   ⚠️ Vault balance too low for transfer');
    return;
  }

  console.log(`   Amount: ${(Number(viableAmount) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log(`   Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Target: ${TARGET_ADDRESS}`);
  console.log(`   Status: ✅ WITHIN POLICY`);
  console.log('');

  // Ask for confirmation before sending
  const shouldSend = process.env.CONFIRM_SEND === 'true';
  
  if (!shouldSend) {
    console.log('   To actually send this transaction, run with:');
    console.log('   CONFIRM_SEND=true VAULT_ADDRESS=xxx AGENT_SECRET=xxx npx tsx examples/transfer-example.ts');
    console.log('');
  } else {
    console.log('   📤 Attempting to execute transaction via Aegis...');
    console.log('');
    
    try {
      // Create the transfer instruction
      const transferIx = SystemProgram.transfer({
        fromPubkey: vaultAuthority,
        toPubkey: new PublicKey(TARGET_ADDRESS),
        lamports: viableAmount,
      });

      // In a real implementation, you would use the Aegis program's
      // executeGuarded instruction to wrap this transfer
      console.log('   ⚡ Transaction would be submitted via executeGuarded instruction');
      console.log('   (Full implementation requires owner signature for first-time setup)');
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY                                ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Aegis Policy Enforcement:');
  console.log('');
  console.log('  ┌─────────────────┬────────────────────────────────────────┐');
  console.log('  │ Scenario        │ Result                                 │');
  console.log('  ├─────────────────┼────────────────────────────────────────┤');
  console.log('  │ Over daily limit│ 🚫 BLOCKED - DailyLimitExceeded error  │');
  console.log('  │ Within limit    │ ✅ ALLOWED - Transaction executes      │');
  console.log('  │ Not whitelisted │ 🚫 BLOCKED - NotWhitelisted error     │');
  console.log('  │ Vault paused    │ 🚫 BLOCKED - VaultPaused error        │');
  console.log('  │ Wrong signer    │ 🚫 BLOCKED - InvalidAgentSigner error │');
  console.log('  └─────────────────┴────────────────────────────────────────┘');
  console.log('');
}

/**
 * Demo mode - shows what transactions would look like
 */
async function runDemoMode(connection: Connection) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    DEMO MODE - No Real Vault                   ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const dailyLimit = 1 * LAMPORTS_PER_SOL; // 1 SOL example limit
  
  console.log('Simulated vault configuration:');
  console.log(`  • Daily Limit: 1 SOL (${dailyLimit} lamports)`);
  console.log(`  • Target: ${TARGET_ADDRESS}`);
  console.log('');

  // Example 1: BLOCKED - Over daily limit
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚫 EXAMPLE 1: BLOCKED TRANSACTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('   // Attempt to send 5 SOL (over 1 SOL daily limit)');
  console.log('   const blockedTx = {');
  console.log(`     to: "${TARGET_ADDRESS}",`);
  console.log('     amount: 5_000_000_000, // 5 SOL');
  console.log('   };');
  console.log('');
  console.log('   Result: ❌ BLOCKED');
  console.log('   Error: "DailyLimitExceeded"');
  console.log('   Reason: 5 SOL > 1 SOL daily limit');
  console.log('');
  console.log('   Code that would block this:');
  console.log('   ┌─────────────────────────────────────────────────────────┐');
  console.log('   │ // In aegis_core program:                               │');
  console.log('   │ if amount > vault.daily_limit - vault.daily_spent {    │');
  console.log('   │     return Err(AegisError::DailyLimitExceeded);         │');
  console.log('   │ }                                                       │');
  console.log('   └─────────────────────────────────────────────────────────┘');
  console.log('');

  // Example 2: ALLOWED - Within limit
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ EXAMPLE 2: ALLOWED TRANSACTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('   // Send 0.1 SOL (within 1 SOL daily limit)');
  console.log('   const allowedTx = {');
  console.log(`     to: "${TARGET_ADDRESS}",`);
  console.log('     amount: 100_000_000, // 0.1 SOL');
  console.log('   };');
  console.log('');
  console.log('   Result: ✅ ALLOWED');
  console.log('   Status: Transaction would execute successfully');
  console.log('   Daily spent after: 0.1 SOL / 1 SOL limit');
  console.log('');

  // Example 3: BLOCKED - Wrong signer
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚫 EXAMPLE 3: BLOCKED - UNAUTHORIZED SIGNER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('   // Attempt from non-agent signer');
  console.log('   const unauthorizedTx = {');
  console.log(`     to: "${TARGET_ADDRESS}",`);
  console.log('     amount: 100_000_000, // 0.1 SOL');
  console.log('     signer: randomKeypair.publicKey, // Not the authorized agent');
  console.log('   };');
  console.log('');
  console.log('   Result: ❌ BLOCKED');
  console.log('   Error: "InvalidAgentSigner"');
  console.log('   Reason: Transaction signer is not the vault\'s authorized agent');
  console.log('');

  // Example 4: BLOCKED - Vault paused
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚫 EXAMPLE 4: BLOCKED - VAULT PAUSED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('   // Owner has paused the vault');
  console.log('   await aegisClient.pauseVault(vaultAddress);');
  console.log('');
  console.log('   // Any transfer attempt when paused');
  console.log('   const pausedTx = {');
  console.log(`     to: "${TARGET_ADDRESS}",`);
  console.log('     amount: 100_000_000, // 0.1 SOL');
  console.log('   };');
  console.log('');
  console.log('   Result: ❌ BLOCKED');
  console.log('   Error: "VaultPaused"');
  console.log('   Reason: Vault is in paused state, no transactions allowed');
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                  SDK INTEGRATION CODE                          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('```typescript');
  console.log('import { AegisClient } from "@aegis-vaults/sdk";');
  console.log('');
  console.log('// Initialize client');
  console.log('const client = new AegisClient({');
  console.log('  rpcUrl: "https://devnet.helius-rpc.com/?api-key=YOUR_KEY",');
  console.log('  cluster: "devnet"');
  console.log('});');
  console.log('');
  console.log('// Connect agent wallet');
  console.log('client.connect(agentWallet);');
  console.log('');
  console.log('// Execute a guarded transfer (with policy checks)');
  console.log('try {');
  console.log('  const result = await client.executeGuardedTransfer({');
  console.log('    vault: vaultAddress,');
  console.log(`    to: "${TARGET_ADDRESS}",`);
  console.log('    amount: 100_000_000, // 0.1 SOL in lamports');
  console.log('  });');
  console.log('  console.log("✅ Transfer successful:", result.signature);');
  console.log('} catch (error) {');
  console.log('  if (error.code === "DAILY_LIMIT_EXCEEDED") {');
  console.log('    console.log("🚫 Blocked: Daily limit exceeded");');
  console.log('  } else if (error.code === "VAULT_PAUSED") {');
  console.log('    console.log("🚫 Blocked: Vault is paused");');
  console.log('  }');
  console.log('}');
  console.log('```');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('To run with a real vault:');
  console.log('');
  console.log('  VAULT_ADDRESS=<your_vault> \\');
  console.log('  AGENT_SECRET=<base64_private_key> \\');
  console.log('  npx tsx examples/transfer-example.ts');
  console.log('');
}

/**
 * Parse daily limit from vault account data
 */
function parseVaultDailyLimit(data: Buffer): bigint {
  // VaultConfig layout:
  // 8 bytes - discriminator
  // 32 bytes - authority
  // 32 bytes - agent_signer
  // 8 bytes - daily_limit <-- we want this
  
  const offset = 8 + 32 + 32;
  return data.readBigUInt64LE(offset);
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

