/**
 * Unpause/Resume a vault
 * 
 * Run with:
 *   VAULT_ADDRESS=xxx npx tsx examples/unpause-vault.ts
 * 
 * This will use your default Solana CLI wallet (~/.config/solana/id.json)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');

async function main() {
  const vaultAddress = process.env.VAULT_ADDRESS;
  
  if (!vaultAddress) {
    console.log('Usage: VAULT_ADDRESS=xxx npx tsx examples/unpause-vault.ts');
    process.exit(1);
  }

  // Load owner wallet from Solana CLI config
  const walletPath = process.env.WALLET_PATH || `${os.homedir()}/.config/solana/id.json`;
  let ownerKeypair: Keypair;
  
  try {
    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
    ownerKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData));
    console.log(`🔑 Using wallet: ${ownerKeypair.publicKey.toBase58()}`);
  } catch (e) {
    console.error(`❌ Could not load wallet from ${walletPath}`);
    console.log('Set WALLET_PATH to your wallet file or use Solana CLI default');
    process.exit(1);
  }

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const vaultPubkey = new PublicKey(vaultAddress);

  // Get vault data to extract the nonce
  const vaultAccount = await connection.getAccountInfo(vaultPubkey);
  if (!vaultAccount) {
    console.error('❌ Vault not found');
    process.exit(1);
  }

  // Read vault fields
  const owner = new PublicKey(vaultAccount.data.slice(8, 40));
  const vaultNonce = vaultAccount.data.readBigUInt64LE(800);
  const paused = vaultAccount.data[88] !== 0;
  const bump = vaultAccount.data[96];

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('UNPAUSE VAULT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Vault:       ${vaultAddress}`);
  console.log(`Owner:       ${owner.toBase58()}`);
  console.log(`Vault Nonce: ${vaultNonce.toString()}`);
  console.log(`Currently:   ${paused ? '⏸️  PAUSED' : '▶️  ACTIVE'}`);
  console.log('');

  if (!paused) {
    console.log('✅ Vault is already active! No action needed.');
    return;
  }

  // Check if we're the owner
  if (!owner.equals(ownerKeypair.publicKey)) {
    console.error('❌ Your wallet is not the vault owner!');
    console.log(`   Your wallet: ${ownerKeypair.publicKey.toBase58()}`);
    console.log(`   Vault owner: ${owner.toBase58()}`);
    process.exit(1);
  }

  // Build resume_vault instruction
  // Discriminator for resume_vault (from anchor)
  const discriminator = Buffer.from([0xde, 0xd8, 0x8d, 0x55, 0x2f, 0xbf, 0x6a, 0x51]); // resume_vault
  
  // Actually, let's compute the discriminator properly
  // anchor discriminator = first 8 bytes of sha256("global:resume_vault")
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update('global:resume_vault').digest();
  const resumeDiscriminator = hash.slice(0, 8);

  const data = Buffer.alloc(16);
  resumeDiscriminator.copy(data, 0);
  data.writeBigUInt64LE(vaultNonce, 8);

  const keys = [
    { pubkey: vaultPubkey, isSigner: false, isWritable: true },
    { pubkey: ownerKeypair.publicKey, isSigner: true, isWritable: false },
  ];

  const resumeVaultIx = new TransactionInstruction({
    keys,
    programId: AEGIS_PROGRAM_ID,
    data,
  });

  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 });
  const computeUnitsIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 });

  const transaction = new Transaction();
  transaction.add(priorityFeeIx);
  transaction.add(computeUnitsIx);
  transaction.add(resumeVaultIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = ownerKeypair.publicKey;
  transaction.sign(ownerKeypair);

  console.log('📤 Sending unpause transaction...');

  try {
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`🔗 Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log('');
    console.log('⏳ Waiting for confirmation...');

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log('');
    console.log('✅ VAULT UNPAUSED SUCCESSFULLY!');
    console.log('');
    
    // Verify
    const updatedVault = await connection.getAccountInfo(vaultPubkey);
    if (updatedVault) {
      const nowPaused = updatedVault.data[88] !== 0;
      console.log(`Status: ${nowPaused ? '⏸️  PAUSED' : '▶️  ACTIVE'}`);
    }
  } catch (error: any) {
    console.error('❌ Failed to unpause vault:', error.message);
    if (error.logs) {
      console.log('Logs:');
      error.logs.forEach((log: string) => console.log(`  ${log}`));
    }
  }
}

main().catch(console.error);



