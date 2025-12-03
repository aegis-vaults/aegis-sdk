/**
 * Aegis SDK - Request Override Example
 * 
 * This example creates an override request for a blocked transaction.
 * When a transaction exceeds daily limits or targets a non-whitelisted address,
 * an override request can be created. This generates a Blink URL that the
 * vault owner can use to approve the transaction.
 * 
 * Usage:
 *   VAULT_ADDRESS=xxx AGENT_SECRET=xxx AMOUNT=0.25 DESTINATION=xxx npx tsx examples/request-override.ts
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
import BN from 'bn.js';

// Configuration
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');

// Block reasons enum (matches protocol)
enum BlockReason {
  ExceededDailyLimit = 0,
  NotWhitelisted = 1,
  VaultPaused = 2,
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         AEGIS SDK - Request Override (Devnet)                  ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Get environment variables
  const vaultAddress = process.env.VAULT_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET;
  const amountSol = parseFloat(process.env.AMOUNT || '0.25');
  const destination = process.env.DESTINATION;

  if (!vaultAddress || !agentSecretKey || !destination) {
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=<vault_pubkey> \\');
    console.log('  AGENT_SECRET=<base64_secret> \\');
    console.log('  AMOUNT=0.25 \\');
    console.log('  DESTINATION=<recipient_pubkey> \\');
    console.log('  npx tsx examples/request-override.ts');
    process.exit(1);
  }

  // Parse agent keypair
  let agentKeypair: Keypair;
  try {
    const decoded = Buffer.from(agentSecretKey, 'base64');
    agentKeypair = Keypair.fromSecretKey(decoded);
  } catch (e) {
    console.error('❌ Failed to parse AGENT_SECRET');
    process.exit(1);
  }

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  
  console.log('📡 Connected to Solana Devnet');
  console.log(`🤖 Agent Signer: ${agentKeypair.publicKey.toBase58()}`);
  console.log(`📦 Vault Address: ${vaultAddress}`);
  console.log(`🎯 Destination: ${destination}`);
  console.log(`💸 Amount: ${amountSol} SOL`);
  console.log('');

  const vaultPubkey = new PublicKey(vaultAddress);
  const destinationPubkey = new PublicKey(destination);
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  // Get vault account to read nonce and override_nonce
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  if (!vaultAccount) {
    console.error('❌ Vault account not found');
    process.exit(1);
  }

  // Parse vault data
  const data = vaultAccount.data;
  
  // Read override_nonce for creating the override PDA
  // Offset: 8 + 32 + 32 + 8 + 8 + 8 + 640 + 1 + 1 + 2 + 50 + 1 + 1 = 802
  const overrideNonceOffset = 8 + 32 + 32 + 8 + 8 + 8 + 640 + 1 + 1 + 2 + 50 + 1 + 1;
  const overrideNonce = data.readBigUInt64LE(overrideNonceOffset);
  
  // Read vault_nonce (8 bytes after override_nonce)
  const vaultNonce = data.readBigUInt64LE(overrideNonceOffset + 8);
  
  // Read authority (vault owner)
  const authority = new PublicKey(data.slice(8, 40));
  
  console.log(`📋 Vault Authority: ${authority.toBase58()}`);
  console.log(`🔢 Vault Nonce: ${vaultNonce}`);
  console.log(`📝 Override Nonce: ${overrideNonce}`);
  console.log('');

  // Derive pending override PDA
  // Seeds: ["override", vault, nonce]
  const [pendingOverridePda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('override'),
      vaultPubkey.toBuffer(),
      new BN(overrideNonce.toString()).toArrayLike(Buffer, 'le', 8),
    ],
    AEGIS_PROGRAM_ID
  );

  console.log(`📄 Pending Override PDA: ${pendingOverridePda.toBase58()}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📤 Creating override request...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // create_override discriminator: first 8 bytes of sha256("global:create_override")
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    hash.update('global:create_override');
    const discriminator = hash.digest().slice(0, 8);
    
    console.log('Discriminator:', Array.from(discriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '));

    // Instruction data:
    // - discriminator (8 bytes)
    // - vault_nonce (u64, 8 bytes)
    // - destination (pubkey, 32 bytes)
    // - amount (u64, 8 bytes)
    // - reason (enum, 1 byte) - ExceededDailyLimit = 0
    const instructionData = Buffer.alloc(8 + 8 + 32 + 8 + 1);
    discriminator.copy(instructionData, 0);
    instructionData.writeBigUInt64LE(vaultNonce, 8);
    destinationPubkey.toBuffer().copy(instructionData, 16);
    instructionData.writeBigUInt64LE(BigInt(amountLamports), 48);
    instructionData.writeUInt8(BlockReason.ExceededDailyLimit, 56);

    // Account metas for create_override
    const keys = [
      { pubkey: vaultPubkey, isSigner: false, isWritable: true },                    // vault
      { pubkey: authority, isSigner: true, isWritable: true },                       // authority (must be vault owner)
      { pubkey: pendingOverridePda, isSigner: false, isWritable: true },             // pending_override
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },       // system_program
    ];

    const createOverrideIx = new TransactionInstruction({
      keys,
      programId: AEGIS_PROGRAM_ID,
      data: instructionData,
    });

    // NOTE: create_override requires the AUTHORITY (vault owner) to sign, not the agent!
    // The agent can propose an override via the Guardian API, which then generates a Blink
    // for the owner to approve.
    
    console.log('⚠️  Note: create_override requires the vault OWNER to sign.');
    console.log('   In production, the agent would call the Guardian API to request an override,');
    console.log('   which generates a Blink URL for the owner to approve.');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Generating Blink URL for manual approval...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Generate a Blink URL that the owner can use to approve
    // In production, this would be generated by the Guardian backend
    const blinkBaseUrl = 'https://dial.to';
    const actionUrl = encodeURIComponent(
      `https://aegis-guardian-production.up.railway.app/api/blinks/override?` +
      `vault=${vaultAddress}&` +
      `destination=${destination}&` +
      `amount=${amountLamports}&` +
      `reason=exceeded_daily_limit`
    );
    
    const blinkUrl = `${blinkBaseUrl}/?action=solana-action:${actionUrl}`;

    console.log('🔗 Blink URL for owner approval:');
    console.log('');
    console.log(`   ${blinkUrl}`);
    console.log('');
    console.log('📋 Override Details:');
    console.log(`   • Vault: ${vaultAddress}`);
    console.log(`   • Destination: ${destination}`);
    console.log(`   • Amount: ${amountSol} SOL (${amountLamports} lamports)`);
    console.log(`   • Reason: Exceeded daily limit`);
    console.log('');
    console.log('💡 The vault owner should:');
    console.log('   1. Open the Blink URL in a Solana wallet that supports Actions');
    console.log('   2. Review the override request');
    console.log('   3. Sign the approval transaction');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Override request prepared!');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('');
    console.error('❌ Error creating override request:', error.message || error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

