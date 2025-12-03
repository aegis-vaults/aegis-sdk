/**
 * Aegis SDK - Send SOL Example (Agent-Signed)
 * 
 * This example sends SOL from a vault using the Aegis execute_agent instruction.
 * The AI agent can execute transactions autonomously within policy limits.
 * 
 * Policy checks enforced:
 * - Vault not paused
 * - Destination is whitelisted
 * - Amount within daily limit
 * 
 * Usage:
 *   VAULT_ADDRESS=xxx AGENT_SECRET=xxx AMOUNT=0.01 DESTINATION=xxx npx tsx examples/send-sol.ts
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

// Configuration
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');

// Default destination
const DEFAULT_DESTINATION = 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         AEGIS SDK - Agent-Signed Transaction (Devnet)          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Get environment variables
  const vaultAddress = process.env.VAULT_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET;
  const amountSol = parseFloat(process.env.AMOUNT || '0.01');
  const destination = process.env.DESTINATION || DEFAULT_DESTINATION;

  if (!vaultAddress || !agentSecretKey) {
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=<vault_pubkey> \\');
    console.log('  AGENT_SECRET=<base64_or_json_secret> \\');
    console.log('  AMOUNT=0.01 \\');
    console.log('  DESTINATION=<recipient_pubkey> \\');
    console.log('  npx tsx examples/send-sol.ts');
    console.log('');
    console.log('Note: The agent can execute transactions autonomously!');
    console.log('      Policy checks (whitelist, daily limit) are enforced on-chain.');
    console.log('');
    console.log('Example:');
    console.log('  VAULT_ADDRESS="3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja" \\');
    console.log('  AGENT_SECRET="e7WOIpiYxY6p+3bhVGU73P5yLria3fK63aS75VkoHMIIrVFm2rYQy/5j1G207ff5QXmgS4T1qcMuMaN0vV1BRA==" \\');
    console.log('  AMOUNT=0.01 \\');
    console.log('  DESTINATION="HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA" \\');
    console.log('  npx tsx examples/send-sol.ts');
    process.exit(1);
  }

  // Parse agent keypair
  let agentKeypair: Keypair;
  try {
    // Try base64 first
    const decoded = Buffer.from(agentSecretKey, 'base64');
    if (decoded.length === 64) {
      agentKeypair = Keypair.fromSecretKey(decoded);
    } else {
      // Try JSON array format
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
  
  console.log('📡 Connected to Solana Devnet');
  console.log(`🤖 Agent Signer: ${agentKeypair.publicKey.toBase58()}`);
  console.log(`📦 Vault Address: ${vaultAddress}`);
  console.log(`🎯 Destination: ${destination}`);
  console.log(`💸 Amount: ${amountSol} SOL`);
  console.log('');

  // Derive vault authority PDA (where funds are held)
  const vaultPubkey = new PublicKey(vaultAddress);
  const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, AEGIS_PROGRAM_ID);
  const [feeTreasury] = deriveFeeTreasuryPda(AEGIS_PROGRAM_ID);

  console.log(`💰 Vault Authority PDA: ${vaultAuthorityPda.toBase58()}`);

  // Check vault balance
  const balance = await connection.getBalance(vaultAuthorityPda);
  console.log(`   Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('');

  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  if (balance < amountLamports + 10000) {
    console.error(`❌ Insufficient balance. Need at least ${amountSol} SOL + fees`);
    process.exit(1);
  }

  // Get vault data to verify agent signer matches
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  if (!vaultAccount) {
    console.error('❌ Vault account not found on-chain');
    process.exit(1);
  }

  // Parse agent_signer from vault data (offset: 8 discriminator + 32 authority = 40)
  const vaultAgentSigner = new PublicKey(vaultAccount.data.slice(40, 72));
  console.log(`📋 Vault Agent Signer: ${vaultAgentSigner.toBase58()}`);
  
  if (!vaultAgentSigner.equals(agentKeypair.publicKey)) {
    console.error('');
    console.error('❌ Agent signer mismatch!');
    console.error(`   Your agent: ${agentKeypair.publicKey.toBase58()}`);
    console.error(`   Vault expects: ${vaultAgentSigner.toBase58()}`);
    process.exit(1);
  }

  console.log('✅ Agent signer matches vault configuration');
  console.log('');

  // Parse daily limit and vault nonce from vault
  const dailyLimit = vaultAccount.data.readBigUInt64LE(72);
  const dailySpent = vaultAccount.data.readBigUInt64LE(80);
  const remainingLimit = dailyLimit - dailySpent;
  
  // Parse vault_nonce - it's after all the other fields
  // VaultConfig layout (from IDL):
  // 8 (discriminator) + 32 (authority) + 32 (agent_signer) + 8 (daily_limit) + 8 (spent_today) 
  // + 8 (last_reset) + 640 (whitelist: 32*20) + 1 (whitelist_count) + 1 (tier) + 2 (fee_basis_points)
  // + 50 (name) + 1 (name_len) + 1 (paused) + 8 (override_nonce) + 8 (vault_nonce) + 1 (bump)
  const vaultNonceOffset = 8 + 32 + 32 + 8 + 8 + 8 + 640 + 1 + 1 + 2 + 50 + 1 + 1 + 8;
  const vaultNonce = vaultAccount.data.readBigUInt64LE(vaultNonceOffset);
  console.log(`🔢 Vault Nonce: ${vaultNonce}`);

  console.log(`📊 Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Daily Spent: ${(Number(dailySpent) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Remaining: ${(Number(remainingLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('');

  if (BigInt(amountLamports) > remainingLimit) {
    console.error('❌ Amount exceeds remaining daily limit!');
    console.error(`   Requested: ${amountSol} SOL`);
    console.error(`   Remaining: ${(Number(remainingLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log('');
    console.log('💡 This transaction would be BLOCKED by Aegis policy.');
    console.log('   You need to either:');
    console.log('   1. Reduce the amount to be within the limit');
    console.log('   2. Wait for the daily limit to reset (24 hours)');
    console.log('   3. Request an override from the vault owner');
    process.exit(1);
  }

  console.log('✅ Amount within daily limit');
  console.log('');

  // Build the execute_agent instruction
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📤 Building execute_agent transaction (agent-signed)...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Build instruction manually
    // execute_agent discriminator: first 8 bytes of sha256("global:execute_agent")
    const discriminator = Buffer.from([0x11, 0xbd, 0x67, 0xf4, 0xce, 0xe9, 0x2b, 0x9b]);
    
    // Instruction data: discriminator + vault_nonce (u64) + amount (u64)
    const data = Buffer.alloc(24);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(vaultNonce, 8);     // vault_nonce comes first
    data.writeBigUInt64LE(BigInt(amountLamports), 16);

    // Account metas for execute_agent
    const keys = [
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },           // vault
      { pubkey: agentKeypair.publicKey, isSigner: true, isWritable: false }, // agent_signer
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: true },     // vault_authority (PDA holding funds)
      { pubkey: new PublicKey(destination), isSigner: false, isWritable: true }, // destination
      { pubkey: feeTreasury, isSigner: false, isWritable: true },           // fee_treasury
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ];

    const executeAgentIx = new TransactionInstruction({
      keys,
      programId: AEGIS_PROGRAM_ID,
      data,
    });

    // Add priority fees
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000,
    });

    const computeUnitsIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 200000,
    });

    // Build transaction
    const transaction = new Transaction();
    transaction.add(priorityFeeIx);
    transaction.add(computeUnitsIx);
    transaction.add(executeAgentIx);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = agentKeypair.publicKey;

    console.log('');
    console.log('Transaction details:');
    console.log(`  • From: ${vaultAuthorityPda.toBase58()} (vault authority PDA)`);
    console.log(`  • To: ${destination}`);
    console.log(`  • Amount: ${amountSol} SOL (${amountLamports} lamports)`);
    console.log(`  • Vault Nonce: ${vaultNonce}`);
    console.log(`  • Fee Treasury: ${feeTreasury.toBase58()}`);
    console.log(`  • Signed by: Agent (${agentKeypair.publicKey.toBase58().slice(0, 8)}...)`);
    console.log('');

    // Sign and send
    console.log('📝 Signing transaction with AGENT keypair...');
    transaction.sign(agentKeypair);

    console.log('📤 Sending transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`🔗 Transaction sent: ${signature}`);
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
      console.error('');
      console.error('❌ Transaction failed:', confirmation.value.err);
      
      // Try to get more details
      const txDetails = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      if (txDetails?.meta?.logMessages) {
        console.error('');
        console.error('Program logs:');
        txDetails.meta.logMessages.forEach(log => {
          if (log.includes('Error') || log.includes('failed')) {
            console.error(`  ❌ ${log}`);
          } else {
            console.log(`  ${log}`);
          }
        });
      }
      process.exit(1);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ AGENT TRANSACTION SUCCESSFUL!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Amount sent: ${amountSol} SOL`);
    console.log(`  Destination: ${destination}`);
    console.log(`  Signed by: Agent (autonomous)`);
    console.log(`  Signature: ${signature}`);
    console.log(`  Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('');

    // Check new balance
    const newBalance = await connection.getBalance(vaultAuthorityPda);
    console.log(`💰 New vault balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    // Check destination balance
    const destBalance = await connection.getBalance(new PublicKey(destination));
    console.log(`🎯 Destination balance: ${(destBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  } catch (error: any) {
    console.error('');
    console.error('❌ Transaction failed!');
    console.error('');
    
    if (error.logs) {
      console.error('Program logs:');
      error.logs.forEach((log: string) => {
        console.error(`  ${log}`);
      });
    } else {
      console.error('Error:', error.message || error);
    }

    // Check for common errors
    if (error.message?.includes('DailyLimitExceeded')) {
      console.log('');
      console.log('💡 The transaction was BLOCKED because it exceeds the daily limit.');
    } else if (error.message?.includes('VaultPaused')) {
      console.log('');
      console.log('💡 The transaction was BLOCKED because the vault is paused.');
    } else if (error.message?.includes('InvalidAgentSigner')) {
      console.log('');
      console.log('💡 The transaction was BLOCKED because the signer is not the authorized agent.');
    } else if (error.message?.includes('NotWhitelisted')) {
      console.log('');
      console.log('💡 The transaction was BLOCKED because the destination is not whitelisted.');
      console.log('   The vault owner needs to add the destination to the whitelist first.');
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
