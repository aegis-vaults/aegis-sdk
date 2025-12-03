/**
 * Aegis SDK - Test Blocked Transaction Flow
 * 
 * This script tests the complete flow from SDK -> Guardian -> Notifications:
 * 1. SDK attempts a transaction that will be blocked
 * 2. Guardian API receives the blocked transaction notification
 * 3. Guardian generates a Blink URL and sends notifications
 * 4. We verify the Blink URL works correctly
 * 
 * This flow is critical for the Human-in-the-Loop override system.
 */

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
} from '@solana/web3.js';

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const GUARDIAN_URL = process.env.GUARDIAN_URL || 'https://aegis-guardian-production.up.railway.app';

// Test vault - replace with actual vault for production testing
const TEST_VAULT = process.env.TEST_VAULT || '3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja';
const TEST_DESTINATION = process.env.TEST_DESTINATION || 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function log(step: string, success: boolean, message: string, data?: any) {
  results.push({ step, success, message, data });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2).replace(/\n/g, '\n   '));
  }
}

async function testGuardianHealth() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Verify Guardian API is healthy');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const response = await fetch(`${GUARDIAN_URL}/api/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      log('Guardian Health', true, 'Guardian API is healthy', { 
        status: data.status,
        version: data.version,
      });
      return true;
    } else {
      log('Guardian Health', false, 'Guardian API returned unhealthy status', data);
      return false;
    }
  } catch (error: any) {
    log('Guardian Health', false, `Failed to reach Guardian API: ${error.message}`);
    return false;
  }
}

async function testBlockedTransactionNotification() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 2: Test Blocked Transaction Notification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testAmount = Math.floor(1.5 * LAMPORTS_PER_SOL); // 1.5 SOL

  console.log('📤 Sending blocked transaction notification to Guardian...');
  console.log(`   Vault: ${TEST_VAULT}`);
  console.log(`   Destination: ${TEST_DESTINATION}`);
  console.log(`   Amount: ${testAmount} lamports (${testAmount / LAMPORTS_PER_SOL} SOL)`);
  console.log(`   Reason: DailyLimitExceeded\n`);

  try {
    const response = await fetch(`${GUARDIAN_URL}/api/transactions/blocked`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vaultPublicKey: TEST_VAULT,
        destination: TEST_DESTINATION,
        amount: testAmount.toString(),
        reason: 'DailyLimitExceeded',
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      log('Blocked Tx Notification', true, 'Guardian processed the blocked transaction', {
        transactionId: data.data?.transactionId,
        actionUrl: data.data?.actionUrl,
        blinkUrl: data.data?.blinkUrl,
      });

      return {
        success: true,
        transactionId: data.data?.transactionId,
        actionUrl: data.data?.actionUrl,
        blinkUrl: data.data?.blinkUrl,
      };
    } else {
      log('Blocked Tx Notification', false, 'Guardian API returned error', data);
      return { success: false };
    }
  } catch (error: any) {
    log('Blocked Tx Notification', false, `Request failed: ${error.message}`);
    return { success: false };
  }
}

async function testBlinkEndpoint(actionUrl: string) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 3: Test Blink Endpoint (GET - Metadata)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`📤 Fetching Blink metadata from: ${actionUrl}\n`);

  try {
    const response = await fetch(actionUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.type === 'action') {
      log('Blink GET', true, 'Blink metadata retrieved successfully', {
        type: data.type,
        title: data.title,
        description: data.description?.slice(0, 100) + '...',
        label: data.label,
        actionsCount: data.links?.actions?.length,
      });
      return { success: true, data };
    } else {
      log('Blink GET', false, 'Blink endpoint returned unexpected data', data);
      return { success: false };
    }
  } catch (error: any) {
    log('Blink GET', false, `Request failed: ${error.message}`);
    return { success: false };
  }
}

async function testBlinkPost(actionUrl: string, signerPubkey: string) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 4: Test Blink Endpoint (POST - Transaction)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`📤 Requesting transaction from Blink endpoint...`);
  console.log(`   Signer: ${signerPubkey}\n`);

  try {
    const response = await fetch(actionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        account: signerPubkey,
      }),
    });

    const data = await response.json();

    if (response.ok && data.transaction) {
      log('Blink POST', true, 'Transaction generated successfully', {
        type: data.type,
        message: data.message,
        transactionLength: data.transaction?.length,
      });
      return { success: true, data };
    } else {
      // Note: This might fail if the signer is not the vault owner, which is expected
      log('Blink POST', false, 'Transaction generation failed (may be expected if signer != owner)', data);
      return { success: false, data };
    }
  } catch (error: any) {
    log('Blink POST', false, `Request failed: ${error.message}`);
    return { success: false };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AEGIS - Blocked Transaction & Override Flow Test         ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Guardian URL: ${GUARDIAN_URL.padEnd(42)}║`);
  console.log(`║  Test Vault:   ${TEST_VAULT.slice(0, 20)}...${TEST_VAULT.slice(-10).padEnd(11)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Step 1: Check Guardian health
  const healthOk = await testGuardianHealth();
  if (!healthOk) {
    console.log('\n❌ Guardian API is not healthy. Aborting tests.\n');
    process.exit(1);
  }

  // Step 2: Send blocked transaction notification
  const notificationResult = await testBlockedTransactionNotification();
  if (!notificationResult.success) {
    console.log('\n⚠️  Blocked transaction notification failed. This might be expected if vault is not linked to a user.\n');
  }

  // Step 3: Test Blink GET endpoint (if we have an actionUrl)
  if (notificationResult.actionUrl) {
    const blinkGetResult = await testBlinkEndpoint(notificationResult.actionUrl);

    // Step 4: Test Blink POST endpoint
    if (blinkGetResult.success) {
      // Generate a random keypair for testing (will fail authorization check)
      const testSigner = Keypair.generate().publicKey.toBase58();
      await testBlinkPost(notificationResult.actionUrl, testSigner);
    }
  } else {
    console.log('\n⚠️  No actionUrl returned. Testing direct Blink endpoint...\n');
    
    // Test the blink endpoint directly with query params
    const testAmount = Math.floor(0.5 * LAMPORTS_PER_SOL);
    const directUrl = `${GUARDIAN_URL}/api/blinks/override?vault=${TEST_VAULT}&destination=${TEST_DESTINATION}&amount=${testAmount}&reason=exceeded_daily_limit`;
    
    await testBlinkEndpoint(directUrl);
  }

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`  ${icon} ${r.step}`);
  });

  console.log(`\n  Total: ${passed} passed, ${failed} failed\n`);

  // Show Blink URL if available
  if (notificationResult.blinkUrl) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      BLINK URL                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('  Open this URL in a Solana wallet to approve the override:\n');
    console.log(`  ${notificationResult.blinkUrl}\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

