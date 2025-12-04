/**
 * Aegis SDK - Complete Quickstart Example
 * 
 * This example demonstrates the complete Aegis workflow:
 * 1. Create a vault (as owner)
 * 2. Fund the vault
 * 3. Add an address to the whitelist
 * 4. Execute a transaction (as agent)
 * 5. Handle blocked transactions
 * 
 * Run with:
 *   npx tsx examples/quickstart.ts
 */

import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AegisClient } from '../src';

// Configuration
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const GUARDIAN_URL = 'https://aegis-guardian-production.up.railway.app';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    AEGIS SDK QUICKSTART');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // ============================================================================
  // STEP 1: Create Keypairs
  // ============================================================================
  
  console.log('📝 STEP 1: Creating keypairs...');
  console.log('');
  
  // In production, load these from secure storage
  // Owner = human who controls the vault
  // Agent = AI that executes transactions
  
  // Check if keypairs are provided via environment
  let ownerKeypair: Keypair;
  let agentKeypair: Keypair;
  
  if (process.env.OWNER_SECRET) {
    try {
      const ownerSecret = JSON.parse(process.env.OWNER_SECRET);
      ownerKeypair = Keypair.fromSecretKey(Uint8Array.from(ownerSecret));
      console.log('   ✅ Loaded owner keypair from environment');
    } catch {
      console.log('   ⚠️  Invalid OWNER_SECRET, generating new keypair');
      ownerKeypair = Keypair.generate();
    }
  } else {
    console.log('   ℹ️  No OWNER_SECRET provided, generating new keypair');
    ownerKeypair = Keypair.generate();
  }
  
  if (process.env.AGENT_SECRET) {
    try {
      const agentSecret = JSON.parse(process.env.AGENT_SECRET);
      agentKeypair = Keypair.fromSecretKey(Uint8Array.from(agentSecret));
      console.log('   ✅ Loaded agent keypair from environment');
    } catch {
      console.log('   ⚠️  Invalid AGENT_SECRET, generating new keypair');
      agentKeypair = Keypair.generate();
    }
  } else {
    console.log('   ℹ️  No AGENT_SECRET provided, generating new keypair');
    agentKeypair = Keypair.generate();
  }
  
  console.log('');
  console.log('   Owner Public Key:', ownerKeypair.publicKey.toBase58());
  console.log('   Agent Public Key:', agentKeypair.publicKey.toBase58());
  console.log('');
  
  // ============================================================================
  // STEP 2: Initialize Client
  // ============================================================================
  
  console.log('📝 STEP 2: Initializing Aegis client...');
  console.log('');
  
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  
  const client = new AegisClient({
    connection,
    guardianApiUrl: GUARDIAN_URL,
    autoRequestOverride: true, // Auto-notify Guardian on blocked transactions
  });
  
  console.log('   ✅ Client initialized');
  console.log('   Program ID:', client.getProgramId().toBase58());
  console.log('   Guardian URL:', client.getGuardianApiUrl());
  console.log('');
  
  // ============================================================================
  // STEP 3: Check Owner Balance
  // ============================================================================
  
  console.log('📝 STEP 3: Checking owner balance...');
  console.log('');
  
  const ownerBalance = await connection.getBalance(ownerKeypair.publicKey);
  console.log('   Owner balance:', ownerBalance / LAMPORTS_PER_SOL, 'SOL');
  
  if (ownerBalance < 0.01 * LAMPORTS_PER_SOL) {
    console.log('');
    console.log('   ⚠️  Owner needs SOL for transaction fees!');
    console.log('');
    console.log('   To airdrop devnet SOL:');
    console.log(`   solana airdrop 2 ${ownerKeypair.publicKey.toBase58()} --url devnet`);
    console.log('');
    console.log('   Or save this keypair and fund it:');
    console.log('   export OWNER_SECRET=\'[' + Array.from(ownerKeypair.secretKey).join(',') + ']\'');
    console.log('');
    
    // Try to airdrop
    console.log('   Attempting airdrop...');
    try {
      const airdropSig = await connection.requestAirdrop(ownerKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdropSig);
      console.log('   ✅ Airdrop successful!');
    } catch (e: any) {
      console.log('   ❌ Airdrop failed:', e.message);
      console.log('   Please fund the owner wallet manually and re-run.');
      return;
    }
  }
  
  console.log('');
  
  // ============================================================================
  // STEP 4: Create Vault
  // ============================================================================
  
  console.log('📝 STEP 4: Creating vault...');
  console.log('');
  
  // Connect owner wallet
  client.setWallet(ownerKeypair as any);
  
  try {
    const vaultResult = await client.createVault({
      name: 'My AI Agent Vault',
      agentSigner: agentKeypair.publicKey.toBase58(),
      dailyLimit: 100_000_000, // 0.1 SOL per day
    });
    
    console.log('   ✅ Vault created!');
    console.log('');
    console.log('   ┌─────────────────────────────────────────────────────────────┐');
    console.log('   │                    IMPORTANT - SAVE THESE!                  │');
    console.log('   ├─────────────────────────────────────────────────────────────┤');
    console.log('   │ Vault Address:   ', vaultResult.vaultAddress.padEnd(44), '│');
    console.log('   │ Deposit Address: ', vaultResult.depositAddress.padEnd(44), '│');
    console.log('   │ Vault Nonce:     ', vaultResult.nonce.padEnd(44), '│');
    console.log('   └─────────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('   Transaction:', vaultResult.signature);
    console.log('');
    
    // ============================================================================
    // STEP 5: Fund Vault
    // ============================================================================
    
    console.log('📝 STEP 5: Funding vault...');
    console.log('');
    console.log('   ⚠️  IMPORTANT: Send SOL to the DEPOSIT ADDRESS, not the vault address!');
    console.log('');
    console.log('   Deposit Address:', vaultResult.depositAddress);
    console.log('');
    console.log('   Command to fund:');
    console.log(`   solana transfer ${vaultResult.depositAddress} 0.5 --url devnet`);
    console.log('');
    
    // Check if we should fund it automatically
    const vaultBalance = await client.getVaultBalance(vaultResult.vaultAddress);
    console.log('   Current vault balance:', vaultBalance / LAMPORTS_PER_SOL, 'SOL');
    
    if (vaultBalance < 0.01 * LAMPORTS_PER_SOL && ownerBalance > 0.1 * LAMPORTS_PER_SOL) {
      console.log('');
      console.log('   Funding vault with 0.1 SOL from owner...');
      
      const { Transaction, SystemProgram } = await import('@solana/web3.js');
      const fundTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: ownerKeypair.publicKey,
          toPubkey: new (await import('@solana/web3.js')).PublicKey(vaultResult.depositAddress),
          lamports: 0.1 * LAMPORTS_PER_SOL,
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      fundTx.recentBlockhash = blockhash;
      fundTx.feePayer = ownerKeypair.publicKey;
      fundTx.sign(ownerKeypair);
      
      const fundSig = await connection.sendRawTransaction(fundTx.serialize());
      await connection.confirmTransaction(fundSig);
      
      console.log('   ✅ Vault funded!');
      console.log('   Transaction:', fundSig);
      
      const newBalance = await client.getVaultBalance(vaultResult.vaultAddress);
      console.log('   New vault balance:', newBalance / LAMPORTS_PER_SOL, 'SOL');
    }
    
    console.log('');
    
    // ============================================================================
    // STEP 6: Save Environment Variables
    // ============================================================================
    
    console.log('📝 STEP 6: Environment setup for agent...');
    console.log('');
    console.log('   Add these to your .env file or export them:');
    console.log('');
    console.log('   # Vault configuration');
    console.log(`   export VAULT_ADDRESS="${vaultResult.vaultAddress}"`);
    console.log(`   export VAULT_NONCE="${vaultResult.nonce}"`);
    console.log('');
    console.log('   # Agent keypair (keep secure!)');
    console.log(`   export AGENT_SECRET='[${Array.from(agentKeypair.secretKey).join(',')}]'`);
    console.log('');
    
    // ============================================================================
    // STEP 7: Add destination to whitelist
    // ============================================================================
    
    console.log('📝 STEP 7: Adding sample destination to whitelist...');
    console.log('');
    
    // Generate a sample destination
    const sampleDestination = Keypair.generate().publicKey.toBase58();
    
    try {
      const whitelistSig = await client.addToWhitelist(vaultResult.vaultAddress, sampleDestination);
      console.log('   ✅ Address whitelisted!');
      console.log('   Address:', sampleDestination);
      console.log('   Transaction:', whitelistSig);
    } catch (e: any) {
      console.log('   ⚠️  Whitelist update failed:', e.message);
    }
    
    console.log('');
    
    // ============================================================================
    // STEP 8: Test agent transaction
    // ============================================================================
    
    console.log('📝 STEP 8: Testing agent transaction...');
    console.log('');
    
    // Switch to agent wallet
    client.setWallet(agentKeypair as any);
    
    // First, fund the agent for transaction fees
    console.log('   Checking agent balance for tx fees...');
    const agentBalance = await connection.getBalance(agentKeypair.publicKey);
    
    if (agentBalance < 0.01 * LAMPORTS_PER_SOL) {
      console.log('   Agent needs SOL for tx fees, transferring...');
      
      // Switch back to owner to fund agent
      client.setWallet(ownerKeypair as any);
      
      const { Transaction, SystemProgram, PublicKey } = await import('@solana/web3.js');
      const fundAgentTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: ownerKeypair.publicKey,
          toPubkey: agentKeypair.publicKey,
          lamports: 0.05 * LAMPORTS_PER_SOL,
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      fundAgentTx.recentBlockhash = blockhash;
      fundAgentTx.feePayer = ownerKeypair.publicKey;
      fundAgentTx.sign(ownerKeypair);
      
      const fundAgentSig = await connection.sendRawTransaction(fundAgentTx.serialize());
      await connection.confirmTransaction(fundAgentSig);
      console.log('   ✅ Agent funded for tx fees');
      
      // Switch back to agent
      client.setWallet(agentKeypair as any);
    }
    
    console.log('');
    console.log('   Executing agent transaction...');
    console.log('   Sending 0.01 SOL to whitelisted address...');
    console.log('');
    
    try {
      const txSig = await client.executeAgent({
        vault: vaultResult.vaultAddress,
        destination: sampleDestination,
        amount: 10_000_000, // 0.01 SOL
        vaultNonce: vaultResult.nonce,
        purpose: 'Test transaction from quickstart',
      });
      
      console.log('   ✅ Transaction successful!');
      console.log('   Signature:', txSig);
      console.log('   Explorer: https://explorer.solana.com/tx/' + txSig + '?cluster=devnet');
      
    } catch (error: any) {
      if (error.overrideRequested) {
        console.log('   ⏳ Transaction blocked by policy!');
        console.log('   Override notification sent to vault owner.');
        console.log('');
        console.log('   Blink URL (for approval):', error.blinkUrl);
      } else {
        console.log('   ❌ Transaction failed:', error.message);
      }
    }
    
    console.log('');
    
    // ============================================================================
    // DONE
    // ============================================================================
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                        QUICKSTART COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Next steps:');
    console.log('');
    console.log('1. Export environment variables (shown above)');
    console.log('2. Add more addresses to whitelist as needed');
    console.log('3. Adjust daily limit via updatePolicy()');
    console.log('4. Integrate with your AI agent using the SDK');
    console.log('');
    console.log('For more examples, see the examples/ directory.');
    console.log('');
    
  } catch (error: any) {
    console.log('   ❌ Vault creation failed:', error.message);
    if (error.logs) {
      console.log('   Logs:');
      error.logs.forEach((log: string) => console.log('     ', log));
    }
  }
}

main().catch(console.error);
