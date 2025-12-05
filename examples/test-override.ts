/**
 * Aegis SDK - Test Override Flow
 * 
 * This script tests the complete override flow:
 * 1. Check vault state
 * 2. Attempt blocked transaction
 * 3. Generate Blink URL
 * 4. Test Blink endpoints
 */

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const AEGIS_PROGRAM_ID = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
const GUARDIAN_URL = 'https://aegis-guardian-production.up.railway.app';

const VAULT_ADDRESS = process.env.VAULT_ADDRESS || '3DK1x5h8ivW93f4Xc1aiVyvyNDQ5xcwgt6rJaddRegja';
const DESTINATION = process.env.DESTINATION || 'HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA';
const VAULT_OWNER = process.env.VAULT_OWNER || 'HVc1LQjdJJbGkZqkwA8kD2sJrYEoGAY2cT8ztSZr2f7c';

async function checkVaultState() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 1: Checking Vault State');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const connection = new Connection(DEVNET_RPC);
  const vaultPubkey = new PublicKey(VAULT_ADDRESS);
  const accountInfo = await connection.getAccountInfo(vaultPubkey);

  if (!accountInfo) {
    console.error('❌ Vault not found on-chain');
    process.exit(1);
  }

  const data = accountInfo.data;
  const dailyLimit = data.readBigUInt64LE(72);
  const dailySpent = data.readBigUInt64LE(80);
  const remaining = dailyLimit - dailySpent;

  console.log(`📦 Vault: ${VAULT_ADDRESS}`);
  console.log(`📊 Daily Limit: ${(Number(dailyLimit) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Daily Spent: ${(Number(dailySpent) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`   Remaining: ${(Number(remaining) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('');

  return { dailyLimit, dailySpent, remaining };
}

async function generateBlinkUrl(amountSol: number) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 2: Generating Blink URL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const actionUrl = encodeURIComponent(
    `${GUARDIAN_URL}/api/blinks/override?` +
    `vault=${VAULT_ADDRESS}&` +
    `destination=${DESTINATION}&` +
    `amount=${amountLamports}&` +
    `reason=exceeded_daily_limit`
  );

  const blinkUrl = `https://dial.to/?action=solana-action:${actionUrl}`;

  console.log('🔗 Blink URL:');
  console.log('');
  console.log(`   ${blinkUrl}`);
  console.log('');
  console.log('📋 Override Details:');
  console.log(`   • Vault: ${VAULT_ADDRESS}`);
  console.log(`   • Destination: ${DESTINATION}`);
  console.log(`   • Amount: ${amountSol} SOL (${amountLamports} lamports)`);
  console.log(`   • Reason: Exceeded daily limit`);
  console.log('');

  return blinkUrl;
}

async function testBlinkGet() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 3: Testing Blink GET (Metadata)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const amountLamports = Math.floor(0.25 * LAMPORTS_PER_SOL);
  const url = `${GUARDIAN_URL}/api/blinks/override?vault=${VAULT_ADDRESS}&destination=${DESTINATION}&amount=${amountLamports}&reason=exceeded_daily_limit`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error(`❌ GET failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text);
      return false;
    }

    const data = await response.json();
    console.log('✅ GET successful!');
    console.log('');
    console.log('Metadata:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    return true;
  } catch (error: any) {
    console.error('❌ GET error:', error.message);
    return false;
  }
}

async function testBlinkPost() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Step 4: Testing Blink POST (Transaction)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const amountLamports = Math.floor(0.25 * LAMPORTS_PER_SOL);
  const url = `${GUARDIAN_URL}/api/blinks/override?vault=${VAULT_ADDRESS}&destination=${DESTINATION}&amount=${amountLamports}&reason=exceeded_daily_limit`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        account: VAULT_OWNER,
      }),
    });

    if (!response.ok) {
      console.error(`❌ POST failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text);
      return false;
    }

    const data = await response.json();
    console.log('✅ POST successful!');
    console.log('');
    console.log('Transaction Type:', data.type);
    console.log('Message:', data.message);
    console.log('Transaction Length:', data.transaction?.length || 0, 'characters (base64)');
    console.log('');

    if (data.transaction) {
      console.log('💡 This transaction can be signed by the vault owner to approve the override.');
      console.log('   The transaction creates a pending override on-chain.');
    }

    return true;
  } catch (error: any) {
    console.error('❌ POST error:', error.message);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('         AEGIS - Override Flow Test');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Step 1: Check vault state
  const { remaining } = await checkVaultState();

  // Step 2: Generate Blink URL
  const amountSol = 0.25; // Amount that exceeds limit
  const blinkUrl = await generateBlinkUrl(amountSol);

  // Step 3: Test Blink GET
  const getSuccess = await testBlinkGet();

  // Step 4: Test Blink POST
  const postSuccess = await testBlinkPost();

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`✅ Vault State: OK (${(Number(remaining) / LAMPORTS_PER_SOL).toFixed(4)} SOL remaining)`);
  console.log(`${getSuccess ? '✅' : '❌'} Blink GET: ${getSuccess ? 'OK' : 'FAILED'}`);
  console.log(`${postSuccess ? '✅' : '❌'} Blink POST: ${postSuccess ? 'OK' : 'FAILED'}`);
  console.log('');

  if (getSuccess && postSuccess) {
    console.log('🎉 All tests passed!');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Open the Blink URL in a Solana wallet:');
    console.log(`   ${blinkUrl}`);
    console.log('');
    console.log('2. Review and sign the override approval transaction');
    console.log('');
    console.log('3. After signing, verify the override was created on-chain');
    console.log('   (You can check the pending override PDA)');
    console.log('');
    console.log('4. Once approved, the agent can execute the override');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});




