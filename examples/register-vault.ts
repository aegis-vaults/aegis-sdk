/**
 * Aegis - Register Vault in Guardian
 *
 * This script registers an existing on-chain vault in the Guardian database.
 * Normally this happens automatically via the event listener, but this script
 * can be used to manually sync a vault.
 *
 * Usage:
 *   VAULT_ADDRESS=xxx npx tsx examples/register-vault.ts
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const GUARDIAN_URL = process.env.GUARDIAN_URL || 'https://aegis-guardian-production.up.railway.app';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         AEGIS - Register Vault in Guardian');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const vaultAddress = process.env.VAULT_ADDRESS;

  if (!vaultAddress) {
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=<vault_pubkey> npx tsx examples/register-vault.ts');
    console.log('');
    console.log('Example:');
    console.log('  VAULT_ADDRESS="3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja" \\');
    console.log('  npx tsx examples/register-vault.ts');
    process.exit(1);
  }

  console.log(`📦 Vault Address: ${vaultAddress}`);
  console.log(`🌐 Guardian URL: ${GUARDIAN_URL}`);
  console.log('');

  // Step 1: Fetch vault data from blockchain
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Reading vault from Solana blockchain...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const vaultPubkey = new PublicKey(vaultAddress);
  const accountInfo = await connection.getAccountInfo(vaultPubkey);

  if (!accountInfo) {
    console.error('❌ Vault not found on-chain');
    process.exit(1);
  }

  console.log('✅ Vault found on-chain');
  console.log(`   Data size: ${accountInfo.data.length} bytes`);
  console.log('');

  // Parse vault data
  // VaultConfig structure:
  // - discriminator: 8 bytes
  // - authority: 32 bytes (pubkey)
  // - agent_signer: 32 bytes (pubkey)
  // - daily_limit: 8 bytes (u64)
  // - spent_today: 8 bytes (u64)
  // - last_reset: 8 bytes (i64)
  // - whitelist: 640 bytes (20 * 32)
  // - whitelist_count: 1 byte
  // - tier: 1 byte
  // - fee_basis_points: 2 bytes
  // - name: 50 bytes
  // - name_len: 1 byte
  // - paused: 1 byte
  // - override_nonce: 8 bytes
  // - vault_nonce: 8 bytes
  // - bump: 1 byte

  const data = accountInfo.data;

  let offset = 8; // Skip discriminator
  const authority = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  const agentSigner = new PublicKey(data.slice(offset, offset + 32)).toBase58();
  offset += 32;

  const dailyLimit = data.readBigUInt64LE(offset);
  offset += 8;

  // Skip other fields, we just need the basics
  console.log('Vault Details:');
  console.log(`  Owner (Authority): ${authority}`);
  console.log(`  Agent Signer: ${agentSigner}`);
  console.log(`  Daily Limit: ${(Number(dailyLimit) / 1e9).toFixed(4)} SOL`);
  console.log('');

  // Step 2: Register vault in Guardian
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 2: Registering vault in Guardian database...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    const response = await fetch(`${GUARDIAN_URL}/api/vaults`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicKey: vaultAddress,
        owner: authority,
        guardian: authority,  // Use authority as guardian
        agentSigner: agentSigner,
        dailyLimit: dailyLimit.toString(),
        overrideDelay: 3600,  // 1 hour default
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Vault successfully registered in Guardian!');
      console.log('');
      console.log('Vault ID:', result.data.id);
      console.log('Public Key:', result.data.publicKey);
      console.log('');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Next Steps');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('1. Set up notification channels for the vault owner:');
      console.log('');
      console.log('   Option A: Telegram');
      console.log('   - Visit: https://t.me/AegisBlinkBot');
      console.log('   - Send /start to get your chat ID');
      console.log('   - Update User record with telegramChatId');
      console.log('');
      console.log('   Option B: Discord');
      console.log('   - Create a webhook in Discord server settings');
      console.log('   - Update User record with discordWebhook');
      console.log('');
      console.log('   Option C: Email');
      console.log('   - Update User record with email address');
      console.log('');
      console.log('2. Test the override flow:');
      console.log('');
      console.log('   FORCE=true VAULT_ADDRESS="' + vaultAddress + '" \\');
      console.log('   AGENT_SECRET="..." \\');
      console.log('   npx tsx examples/test-blocked-transaction.ts');
      console.log('');
      console.log('3. Check Guardian logs for event processing:');
      console.log('');
      console.log('   railway logs | grep -i "transaction blocked"');
      console.log('');

    } else if (result.error?.code === 'VAULT_EXISTS') {
      console.log('✅ Vault already registered in Guardian!');
      console.log('');
      console.log('You can now test the override flow.');
      console.log('');

    } else {
      console.error('❌ Failed to register vault:', result.error);
      console.log('');
      console.log('Error details:', JSON.stringify(result.error, null, 2));
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Failed to register vault:', error.message);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
