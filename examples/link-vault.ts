/**
 * Link Vault to User Account
 *
 * This script links your on-chain vault to your Aegis user account.
 * This is required for notifications to work.
 *
 * Prerequisites:
 * - You must be logged into the Aegis app and have an API key
 * - The vault must already exist on-chain
 *
 * Usage:
 *   API_KEY=ak_live_xxx VAULT_ADDRESS=xxx npx tsx examples/link-vault.ts
 */

const GUARDIAN_URL = process.env.GUARDIAN_URL || 'https://aegis-guardian-production.up.railway.app';
const API_KEY = process.env.API_KEY;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         AEGIS - Link Vault to User Account');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  if (!API_KEY || !VAULT_ADDRESS) {
    console.log('Usage:');
    console.log('  API_KEY=<your_api_key> VAULT_ADDRESS=<vault_pubkey> npx tsx examples/link-vault.ts');
    console.log('');
    console.log('Steps:');
    console.log('  1. Log into Aegis app: https://aegis-guardian-production.up.railway.app');
    console.log('  2. Go to Settings > API Keys');
    console.log('  3. Create a new API key');
    console.log('  4. Run this script with your API key');
    console.log('');
    console.log('Example:');
    console.log('  API_KEY="ak_live_abc123..." \\');
    console.log('  VAULT_ADDRESS="3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja" \\');
    console.log('  npx tsx examples/link-vault.ts');
    process.exit(1);
  }

  console.log(`📦 Vault: ${VAULT_ADDRESS}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 15)}...`);
  console.log(`🌐 Guardian: ${GUARDIAN_URL}`);
  console.log('');

  try {
    console.log('🔗 Linking vault to your user account...');
    console.log('');

    const response = await fetch(`${GUARDIAN_URL}/api/vaults/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        vaultPublicKey: VAULT_ADDRESS,
        name: 'my trading bot', // Optional name
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Vault successfully linked to your account!');
      console.log('');
      console.log('Vault Details:');
      console.log(`  ID: ${result.data.id}`);
      console.log(`  Public Key: ${result.data.publicKey}`);
      console.log(`  Owner: ${result.data.owner}`);
      console.log(`  User ID: ${result.data.userId}`);
      console.log(`  Name: ${result.data.name || '(no name)'}`);
      console.log('');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Setup Complete!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('Your vault is now linked and notifications are enabled.');
      console.log('');
      console.log('Next: Test the override flow');
      console.log('');
      console.log('  FORCE=true \\');
      console.log('  VAULT_ADDRESS="' + VAULT_ADDRESS + '" \\');
      console.log('  AGENT_SECRET="..." \\');
      console.log('  npx tsx examples/test-blocked-transaction.ts');
      console.log('');
      console.log('You should receive notifications via:');
      console.log('  📧 Email (if configured)');
      console.log('  💬 Telegram (if configured)');
      console.log('  💬 Discord (if configured)');
      console.log('');

    } else {
      console.error('❌ Failed to link vault:', result.error.message);
      console.error('');

      if (result.error.code === 'AUTHENTICATION_REQUIRED') {
        console.log('💡 Your API key may be invalid or expired.');
        console.log('   Create a new one in Settings > API Keys');
        console.log('');
      } else if (result.error.code === 'UNAUTHORIZED') {
        console.log('💡 You are not the owner of this vault.');
        console.log('   Make sure you\'re using the correct vault address.');
        console.log('');
      } else if (result.error.code === 'VAULT_ALREADY_LINKED') {
        console.log('✅ Vault is already linked to your account!');
        console.log('   You can proceed with testing the override flow.');
        console.log('');
      } else if (result.error.code === 'VAULT_NOT_FOUND') {
        console.log('💡 Vault not found in Guardian database.');
        console.log('   The vault may need time to sync from the blockchain.');
        console.log('   Wait a few seconds and try again.');
        console.log('');
      }

      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
