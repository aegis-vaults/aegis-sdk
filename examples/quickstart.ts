/**
 * Quick Start Example - Create a vault and execute a transaction
 *
 * This is a minimal example showing the basic SDK workflow.
 *
 * Prerequisites:
 * - Devnet SOL (get from https://faucet.solana.com/)
 *
 * Usage:
 *   npx ts-node examples/quickstart.ts
 */

import { AegisClient } from '../src/index.js';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

async function main() {
  console.log('🚀 Aegis SDK Quick Start\n');

  // 1. Initialize client
  console.log('📡 Connecting to devnet...');
  const client = new AegisClient({
    cluster: 'devnet',
    programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
    guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
  });

  // 2. Set wallet (in production, use wallet-adapter or similar)
  const wallet = Keypair.generate(); // Replace with your wallet
  client.setWallet(wallet as any);
  console.log(`💼 Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`   Get devnet SOL from: https://faucet.solana.com/\n`);

  // 3. Create agent signer
  const agentSigner = Keypair.generate();
  console.log(`🤖 Agent: ${agentSigner.publicKey.toBase58()}\n`);

  // 4. Create a vault
  console.log('📦 Creating vault...');
  try {
    const { vaultAddress, signature } = await client.createVault({
      name: 'My First Vault',
      agentSigner: agentSigner.publicKey.toBase58(),
      dailyLimit: (1 * LAMPORTS_PER_SOL).toString(), // 1 SOL daily limit
    });

    console.log(`✅ Vault created!`);
    console.log(`   Address: ${vaultAddress}`);
    console.log(`   Transaction: ${signature}`);
    console.log(`   View: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    // 5. Execute a guarded transaction
    console.log('💸 Executing guarded transaction...');
    const recipient = Keypair.generate();
    const txSignature = await client.executeGuarded({
      vault: vaultAddress,
      destination: recipient.publicKey.toBase58(),
      amount: (0.1 * LAMPORTS_PER_SOL).toString(), // 0.1 SOL
      purpose: 'Test transaction',
    });

    console.log(`✅ Transaction executed!`);
    console.log(`   Signature: ${txSignature}`);
    console.log(`   View: https://explorer.solana.com/tx/${txSignature}?cluster=devnet\n`);

    // 6. Check vault balance
    console.log('📊 Fetching vault data...');
    const vault = await client.getVault(vaultAddress);
    console.log(`✅ Vault status:`);
    console.log(`   Daily limit: ${vault.dailyLimit.toString()} lamports`);
    console.log(`   Spent today: ${vault.spentToday.toString()} lamports`);
    console.log(`   Paused: ${vault.isPaused}\n`);

    console.log('🎉 Quick start complete!');
    console.log(`\nYour vault: ${vaultAddress}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main().catch(console.error);
