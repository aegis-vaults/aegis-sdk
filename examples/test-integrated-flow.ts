/**
 * Test Fully Integrated Override Flow
 *
 * This demonstrates the seamless flow where:
 * 1. Agent tries transaction → fails automatically
 * 2. SDK auto-creates override request
 * 3. Event emitted → Guardian captures → notifications sent
 * 4. User receives Blink URL to approve
 */

import { AegisClient } from '../src';
import { Keypair } from '@solana/web3.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   AEGIS - Fully Integrated Override Flow');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Parse agent keypair
  const agentSecretKey = process.env.AGENT_SECRET!;
  const agentDecoded = Buffer.from(agentSecretKey, 'base64');
  const agentKeypair = Keypair.fromSecretKey(agentDecoded);

  // Initialize client with auto-override enabled (default)
  const client = new AegisClient({
    cluster: 'devnet',
    guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
    autoRequestOverride: true, // This is the magic setting!
  });

  client.setWallet(agentKeypair);

  console.log('Configuration:');
  console.log('  Agent: ' + agentKeypair.publicKey.toBase58());
  console.log('  Vault: 3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja');
  console.log('  Auto-Override: ENABLED ✓');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Attempting transaction that exceeds limit...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Agent just calls executeAgent - everything else is automatic!
    const signature = await client.executeAgent({
      vault: '3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja',
      destination: 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA',
      amount: 250_000_000, // 0.25 SOL - exceeds limit
      vaultNonce: 1764749552556345750n,
    });

    console.log('✅ Transaction succeeded:', signature);

  } catch (error: any) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Transaction Blocked (Expected)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (error.overrideRequested) {
      console.log('✅ Override Request Created Automatically!');
      console.log('');
      console.log('Details:');
      console.log(`  Override Nonce: ${error.overrideNonce}`);
      console.log(`  Blink URL: ${error.blinkUrl}`);
      console.log('');
      console.log('Expected Notifications:');
      console.log('  📧 Email to rkaelle@umich.edu');
      console.log('  💬 Telegram to @ryankaelle');
      console.log('  💬 Discord webhook');
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ INTEGRATION SUCCESSFUL!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('The agent just called executeAgent() and:');
      console.log('  1. ✅ Transaction was blocked by policy');
      console.log('  2. ✅ Override request created automatically');
      console.log('  3. ✅ TransactionBlocked event emitted');
      console.log('  4. ⏳ Guardian should capture event and send notifications');
      console.log('');
      console.log('Check your notifications now!');
    } else {
      console.log('⚠️  Transaction failed but auto-override did not trigger');
      console.log('Error:', error.message);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error);
