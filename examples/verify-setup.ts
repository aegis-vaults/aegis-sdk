/**
 * Verify Devnet Setup
 *
 * This script verifies that:
 * - The SDK is properly built
 * - Devnet is accessible
 * - The program is deployed
 * - Guardian API is responding
 *
 * Run this before executing the full test suite.
 *
 * Usage:
 *   npx ts-node examples/verify-setup.ts
 */

import { Connection, PublicKey } from '@solana/web3.js';

const DEVNET_CONFIG = {
  programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
  rpcUrl: 'https://api.devnet.solana.com',
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkDevnetConnection(): Promise<boolean> {
  try {
    log('\n📡 Checking Devnet connection...', colors.cyan);
    const connection = new Connection(DEVNET_CONFIG.rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    log(`✓ Connected to Solana devnet`, colors.green);
    log(`  Version: ${version['solana-core']}`, colors.reset);
    return true;
  } catch (error) {
    log(`✗ Failed to connect to devnet: ${error}`, colors.red);
    return false;
  }
}

async function checkProgramDeployment(): Promise<boolean> {
  try {
    log('\n🔍 Checking program deployment...', colors.cyan);
    const connection = new Connection(DEVNET_CONFIG.rpcUrl, 'confirmed');
    const programId = new PublicKey(DEVNET_CONFIG.programId);
    const accountInfo = await connection.getAccountInfo(programId);

    if (!accountInfo) {
      log(`✗ Program not found at ${DEVNET_CONFIG.programId}`, colors.red);
      return false;
    }

    log(`✓ Program found on devnet`, colors.green);
    log(`  Program ID: ${DEVNET_CONFIG.programId}`, colors.reset);
    log(`  Owner: ${accountInfo.owner.toBase58()}`, colors.reset);
    log(`  Data length: ${accountInfo.data.length} bytes`, colors.reset);
    log(`  Executable: ${accountInfo.executable}`, colors.reset);

    if (!accountInfo.executable) {
      log(`⚠ Warning: Account is not marked as executable`, colors.yellow);
    }

    return true;
  } catch (error) {
    log(`✗ Failed to check program: ${error}`, colors.red);
    return false;
  }
}

async function checkGuardianAPI(): Promise<boolean> {
  try {
    log('\n🏥 Checking Guardian API health...', colors.cyan);

    const response = await fetch(`${DEVNET_CONFIG.guardianApiUrl}/api/health`);

    if (!response.ok) {
      log(`✗ Guardian API returned status ${response.status}`, colors.red);
      return false;
    }

    const data = await response.json();
    log(`✓ Guardian API is healthy`, colors.green);
    log(`  Status: ${data.status}`, colors.reset);
    log(`  Database: ${data.database?.status}`, colors.reset);
    log(`  Redis: ${data.redis?.status}`, colors.reset);
    log(`  Cluster: ${data.cluster}`, colors.reset);
    log(`  Program ID: ${data.programId}`, colors.reset);

    // Verify configuration matches
    if (data.cluster !== 'devnet') {
      log(`⚠ Warning: Guardian is configured for ${data.cluster}, not devnet`, colors.yellow);
    }

    if (data.programId !== DEVNET_CONFIG.programId) {
      log(`⚠ Warning: Guardian program ID (${data.programId}) doesn't match expected (${DEVNET_CONFIG.programId})`, colors.yellow);
    }

    return true;
  } catch (error) {
    log(`✗ Failed to connect to Guardian API: ${error}`, colors.red);
    log(`  Make sure Guardian is running at ${DEVNET_CONFIG.guardianApiUrl}`, colors.yellow);
    return false;
  }
}

async function checkSDKBuild(): Promise<boolean> {
  try {
    log('\n📦 Checking SDK build...', colors.cyan);

    // Try to import the SDK
    const { AegisClient } = await import('../src/index.js');

    if (!AegisClient) {
      log(`✗ Failed to import AegisClient`, colors.red);
      return false;
    }

    log(`✓ SDK imported successfully`, colors.green);

    // Try to instantiate
    try {
      const client = new AegisClient({
        cluster: 'devnet',
        programId: DEVNET_CONFIG.programId,
      });
      log(`✓ AegisClient instantiated successfully`, colors.green);
      log(`  Program ID: ${client.getProgramId().toBase58()}`, colors.reset);
      return true;
    } catch (error) {
      log(`✗ Failed to instantiate AegisClient: ${error}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`✗ Failed to import SDK: ${error}`, colors.red);
    log(`  Run 'npm run build' to build the SDK first`, colors.yellow);
    return false;
  }
}

async function checkRPCEndpoint(): Promise<boolean> {
  try {
    log('\n⚡ Checking RPC performance...', colors.cyan);
    const connection = new Connection(DEVNET_CONFIG.rpcUrl, 'confirmed');

    const start = Date.now();
    const slot = await connection.getSlot();
    const latency = Date.now() - start;

    log(`✓ RPC endpoint is responding`, colors.green);
    log(`  Current slot: ${slot}`, colors.reset);
    log(`  Latency: ${latency}ms`, colors.reset);

    if (latency > 1000) {
      log(`⚠ Warning: High latency (${latency}ms). Consider using a different RPC`, colors.yellow);
    }

    return true;
  } catch (error) {
    log(`✗ Failed to query RPC: ${error}`, colors.red);
    return false;
  }
}

async function main() {
  console.clear();
  log('═══════════════════════════════════════════════════════════', colors.cyan);
  log('  AEGIS SDK - DEVNET SETUP VERIFICATION', colors.cyan);
  log('═══════════════════════════════════════════════════════════', colors.cyan);

  const checks = {
    sdk: await checkSDKBuild(),
    devnet: await checkDevnetConnection(),
    rpc: await checkRPCEndpoint(),
    program: await checkProgramDeployment(),
    guardian: await checkGuardianAPI(),
  };

  log('\n═══════════════════════════════════════════════════════════', colors.cyan);
  log('  VERIFICATION SUMMARY', colors.cyan);
  log('═══════════════════════════════════════════════════════════', colors.cyan);

  const results = [
    ['SDK Build', checks.sdk],
    ['Devnet Connection', checks.devnet],
    ['RPC Performance', checks.rpc],
    ['Program Deployment', checks.program],
    ['Guardian API', checks.guardian],
  ];

  results.forEach(([name, passed]) => {
    const status = passed ? '✓' : '✗';
    const color = passed ? colors.green : colors.red;
    log(`  ${status} ${name}`, color);
  });

  const allPassed = Object.values(checks).every(Boolean);

  if (allPassed) {
    log('\n🎉 All checks passed! You\'re ready to run the test suite.', colors.green);
    log('\nNext steps:', colors.cyan);
    log('  1. Get devnet SOL: https://faucet.solana.com/', colors.reset);
    log('  2. Run quickstart: npm run example:quickstart', colors.reset);
    log('  3. Run full tests: npm run test:devnet', colors.reset);
  } else {
    log('\n❌ Some checks failed. Please fix the issues above.', colors.red);
    log('\nTroubleshooting:', colors.yellow);
    if (!checks.sdk) {
      log('  - Run: npm install && npm run build', colors.reset);
    }
    if (!checks.devnet || !checks.rpc) {
      log('  - Check https://status.solana.com/', colors.reset);
      log('  - Try a different RPC endpoint', colors.reset);
    }
    if (!checks.program) {
      log('  - Verify program ID: ' + DEVNET_CONFIG.programId, colors.reset);
      log('  - Check deployment in aegis-protocol/', colors.reset);
    }
    if (!checks.guardian) {
      log('  - Check Guardian logs: railway logs', colors.reset);
      log('  - Verify Guardian URL: ' + DEVNET_CONFIG.guardianApiUrl, colors.reset);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Verification failed: ${error}`, colors.red);
  process.exit(1);
});
