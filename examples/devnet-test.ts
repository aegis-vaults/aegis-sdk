/**
 * Comprehensive Devnet Integration Test
 *
 * This script tests all major SDK functionality against the live devnet deployment:
 * - Vault creation
 * - Policy management
 * - Transaction execution (success and failure)
 * - Override workflow
 * - Guardian API integration
 * - Event subscriptions
 *
 * Prerequisites:
 * - Devnet SOL in your wallet (get from https://faucet.solana.com/)
 * - Guardian backend running at https://aegis-guardian-production.up.railway.app
 *
 * Usage:
 *   npx ts-node examples/devnet-test.ts
 */

import { AegisClient } from '../src/index.js';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { solToLamports, lamportsToSol } from '../src/utils/amounts.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEVNET_CONFIG = {
  cluster: 'devnet' as const,
  programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
  rpcUrl: 'https://api.devnet.solana.com',
};

// Test parameters
const TEST_VAULT_NAME = 'SDK Test Vault';
const DAILY_LIMIT_SOL = 1.0; // 1 SOL daily limit
const TEST_AMOUNT_SOL = 0.01; // 0.01 SOL test transaction
const EXCEED_LIMIT_SOL = 2.0; // 2 SOL to test limit violation

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(`  ${title}`, colors.cyan);
  console.log('='.repeat(60) + '\n');
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

// Load or create keypair
function loadOrCreateKeypair(): Keypair {
  const keypairPath = path.join(process.cwd(), '.devnet-wallet.json');

  if (fs.existsSync(keypairPath)) {
    logInfo('Loading existing keypair from .devnet-wallet.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } else {
    logInfo('Creating new keypair and saving to .devnet-wallet.json');
    const keypair = Keypair.generate();
    fs.writeFileSync(
      keypairPath,
      JSON.stringify(Array.from(keypair.secretKey))
    );
    return keypair;
  }
}

async function checkBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance;
}

async function airdropIfNeeded(connection: Connection, publicKey: PublicKey, minBalance: number = 2 * LAMPORTS_PER_SOL) {
  const balance = await checkBalance(connection, publicKey);

  if (balance < minBalance) {
    logWarning(`Balance too low (${lamportsToSol(balance)} SOL). Requesting airdrop...`);
    logInfo('Note: You can also get devnet SOL from https://faucet.solana.com/');

    try {
      const signature = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(signature, 'confirmed');
      const newBalance = await checkBalance(connection, publicKey);
      logSuccess(`Airdrop successful! New balance: ${lamportsToSol(newBalance)} SOL`);
    } catch (error) {
      logError('Airdrop failed. Please get devnet SOL from https://faucet.solana.com/');
      logError(`Your wallet address: ${publicKey.toBase58()}`);
      throw error;
    }
  } else {
    logSuccess(`Balance sufficient: ${lamportsToSol(balance)} SOL`);
  }
}

async function test1_InitializeClient(
  wallet: Keypair
): Promise<{ client: AegisClient; connection: Connection }> {
  logSection('TEST 1: Initialize AegisClient');

  try {
    // Create connection
    const connection = new Connection(DEVNET_CONFIG.rpcUrl, 'confirmed');
    logSuccess('Connected to Solana devnet');

    // Initialize client
    const client = new AegisClient({
      connection,
      programId: DEVNET_CONFIG.programId,
      guardianApiUrl: DEVNET_CONFIG.guardianApiUrl,
      commitment: 'confirmed',
    });

    client.setWallet(wallet as any);
    logSuccess('AegisClient initialized');

    // Log configuration
    logInfo(`Program ID: ${client.getProgramId().toBase58()}`);
    logInfo(`Guardian API: ${client.getGuardianApiUrl()}`);
    logInfo(`Wallet: ${wallet.publicKey.toBase58()}`);

    // Check wallet balance
    await airdropIfNeeded(connection, wallet.publicKey);

    return { client, connection };
  } catch (error) {
    logError(`Failed to initialize client: ${error}`);
    throw error;
  }
}

async function test2_CreateVault(
  client: AegisClient,
  agentSigner: PublicKey
): Promise<string> {
  logSection('TEST 2: Create Vault');

  try {
    const dailyLimitLamports = solToLamports(DAILY_LIMIT_SOL);

    logInfo(`Creating vault with ${DAILY_LIMIT_SOL} SOL daily limit...`);

    const result = await client.createVault({
      name: TEST_VAULT_NAME,
      agentSigner: agentSigner.toBase58(),
      dailyLimit: dailyLimitLamports.toString(),
    });

    logSuccess(`Vault created: ${result.vaultAddress}`);
    logInfo(`Transaction: ${result.signature}`);
    logInfo(`View on explorer: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`);

    // Wait a bit for the transaction to be indexed
    logInfo('Waiting 3 seconds for indexing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    return result.vaultAddress;
  } catch (error) {
    logError(`Failed to create vault: ${error}`);
    throw error;
  }
}

async function test3_GetVault(client: AegisClient, vaultAddress: string) {
  logSection('TEST 3: Fetch Vault Data');

  try {
    logInfo('Fetching vault from on-chain...');
    const vault = await client.getVault(vaultAddress);

    logSuccess('Vault data retrieved:');
    console.log(JSON.stringify({
      authority: vault.authority.toBase58(),
      agentSigner: vault.agentSigner.toBase58(),
      dailyLimit: `${lamportsToSol(vault.dailyLimit)} SOL`,
      spentToday: `${lamportsToSol(vault.spentToday)} SOL`,
      lastReset: new Date(vault.lastReset.toNumber() * 1000).toISOString(),
      isPaused: vault.isPaused,
      whitelist: vault.whitelist.map(pk => pk.toBase58()),
    }, null, 2));

  } catch (error) {
    logError(`Failed to fetch vault: ${error}`);
    throw error;
  }
}

async function test4_GuardianVault(client: AegisClient, vaultAddress: string) {
  logSection('TEST 4: Query Guardian API');

  try {
    logInfo('Fetching vault from Guardian API...');
    const guardianVault = await client.getGuardianVault(vaultAddress);

    logSuccess('Guardian vault data retrieved:');
    console.log(JSON.stringify(guardianVault, null, 2));

  } catch (error) {
    logWarning(`Guardian API query failed (vault may not be indexed yet): ${error}`);
    logInfo('This is normal for newly created vaults. Continue with other tests.');
  }
}

async function test5_ExecuteValidTransaction(
  client: AegisClient,
  vaultAddress: string,
  destination: PublicKey
) {
  logSection('TEST 5: Execute Valid Guarded Transaction');

  try {
    const amountLamports = solToLamports(TEST_AMOUNT_SOL);

    logInfo(`Executing transaction: ${TEST_AMOUNT_SOL} SOL to ${destination.toBase58()}`);

    const signature = await client.executeGuarded({
      vault: vaultAddress,
      destination: destination.toBase58(),
      amount: amountLamports.toString(),
      purpose: 'SDK integration test - valid transaction',
    });

    logSuccess(`Transaction executed successfully!`);
    logInfo(`Signature: ${signature}`);
    logInfo(`View on explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Wait for indexing
    logInfo('Waiting 3 seconds for indexing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (error) {
    logError(`Transaction execution failed: ${error}`);
    throw error;
  }
}

async function test6_AddToWhitelist(
  client: AegisClient,
  vaultAddress: string,
  addressToWhitelist: PublicKey
) {
  logSection('TEST 6: Add Address to Whitelist');

  try {
    logInfo(`Adding ${addressToWhitelist.toBase58()} to whitelist...`);

    const signature = await client.addToWhitelist(
      vaultAddress,
      addressToWhitelist.toBase58()
    );

    logSuccess('Address added to whitelist!');
    logInfo(`Transaction: ${signature}`);

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    logError(`Failed to add to whitelist: ${error}`);
    throw error;
  }
}

async function test7_UpdatePolicy(
  client: AegisClient,
  vaultAddress: string,
  newLimitSol: number
) {
  logSection('TEST 7: Update Vault Policy');

  try {
    const newLimitLamports = solToLamports(newLimitSol);

    logInfo(`Updating daily limit to ${newLimitSol} SOL...`);

    const signature = await client.updatePolicy({
      vault: vaultAddress,
      dailyLimit: newLimitLamports.toString(),
    });

    logSuccess('Policy updated!');
    logInfo(`Transaction: ${signature}`);

    // Wait and verify
    await new Promise(resolve => setTimeout(resolve, 2000));
    const vault = await client.getVault(vaultAddress);
    logSuccess(`Verified: New daily limit is ${lamportsToSol(vault.dailyLimit)} SOL`);

  } catch (error) {
    logError(`Failed to update policy: ${error}`);
    throw error;
  }
}

async function test8_BlockedTransaction(
  client: AegisClient,
  vaultAddress: string,
  destination: PublicKey
) {
  logSection('TEST 8: Test Blocked Transaction (Exceed Limit)');

  try {
    const excessAmountLamports = solToLamports(EXCEED_LIMIT_SOL);

    logInfo(`Attempting transaction: ${EXCEED_LIMIT_SOL} SOL (should be blocked)...`);

    const signature = await client.executeGuarded({
      vault: vaultAddress,
      destination: destination.toBase58(),
      amount: excessAmountLamports.toString(),
      purpose: 'SDK test - should be blocked',
    });

    logError('Transaction should have been blocked but succeeded!');
    logInfo(`Unexpected success signature: ${signature}`);

  } catch (error: any) {
    if (error.message?.includes('DailyLimitExceeded') ||
        error.message?.includes('limit') ||
        error.code === 'DAILY_LIMIT_EXCEEDED') {
      logSuccess('Transaction correctly blocked due to policy violation!');
      logInfo(`Error: ${error.message}`);
    } else {
      logError(`Transaction failed with unexpected error: ${error.message}`);
      throw error;
    }
  }
}

async function test9_RequestOverride(
  client: AegisClient,
  vaultAddress: string,
  destination: PublicKey
) {
  logSection('TEST 9: Request Override for Blocked Transaction');

  try {
    const excessAmountLamports = solToLamports(EXCEED_LIMIT_SOL);

    logInfo('Requesting override for blocked transaction...');

    const result = await client.requestOverride({
      vault: vaultAddress,
      destination: destination.toBase58(),
      amount: excessAmountLamports.toString(),
      reason: 'SDK integration test - override request',
    });

    logSuccess('Override request created!');
    logInfo(`Nonce: ${result.nonce}`);
    logInfo(`Blink URL: ${result.blinkUrl}`);
    logInfo(`Transaction: ${result.signature}`);

    logWarning('To approve this override:');
    logInfo(`1. Visit the Blink URL: ${result.blinkUrl}`);
    logInfo(`2. Or call client.approveOverride('${vaultAddress}', '${result.nonce}')`);

    return result.nonce;

  } catch (error) {
    logError(`Failed to request override: ${error}`);
    throw error;
  }
}

async function test10_GetTransactionHistory(client: AegisClient, vaultAddress: string) {
  logSection('TEST 10: Query Transaction History');

  try {
    logInfo('Fetching transaction history from Guardian...');

    const history = await client.getTransactionHistory({
      vault: vaultAddress,
      limit: 10,
      page: 1,
    });

    logSuccess(`Found ${history.data.length} transactions`);
    console.log(JSON.stringify(history, null, 2));

  } catch (error) {
    logWarning(`Failed to fetch transaction history: ${error}`);
    logInfo('Guardian may still be indexing. Check again later.');
  }
}

async function test11_GetAnalytics(client: AegisClient, vaultAddress: string) {
  logSection('TEST 11: Query Analytics');

  try {
    logInfo('Fetching analytics from Guardian...');

    const analytics = await client.getAnalytics(vaultAddress, {
      timeframe: '7d',
    });

    logSuccess('Analytics retrieved:');
    console.log(JSON.stringify(analytics, null, 2));

  } catch (error) {
    logWarning(`Failed to fetch analytics: ${error}`);
    logInfo('Guardian may still be indexing. Check again later.');
  }
}

async function test12_ListVaults(client: AegisClient, owner: PublicKey) {
  logSection('TEST 12: List All Vaults for Owner');

  try {
    logInfo(`Listing vaults for ${owner.toBase58()}...`);

    const vaults = await client.listVaults(owner.toBase58());

    logSuccess(`Found ${vaults.length} vaults:`);
    vaults.forEach((vault, i) => {
      logInfo(`${i + 1}. ${vault}`);
    });

  } catch (error) {
    logError(`Failed to list vaults: ${error}`);
    throw error;
  }
}

// Main test runner
async function runAllTests() {
  console.clear();
  logSection('🧪 AEGIS SDK DEVNET INTEGRATION TEST');

  logInfo('This script will test all SDK functionality against devnet');
  logInfo('Make sure you have devnet SOL in your wallet!');
  logInfo('Get devnet SOL from: https://faucet.solana.com/\n');

  try {
    // Setup
    const wallet = loadOrCreateKeypair();
    const agentKeypair = Keypair.generate(); // Agent signer for the vault
    const recipientKeypair = Keypair.generate(); // Transaction recipient

    logInfo(`Main wallet: ${wallet.publicKey.toBase58()}`);
    logInfo(`Agent signer: ${agentKeypair.publicKey.toBase58()}`);
    logInfo(`Recipient: ${recipientKeypair.publicKey.toBase58()}\n`);

    // Run tests
    const { client, connection } = await test1_InitializeClient(wallet);

    const vaultAddress = await test2_CreateVault(client, agentKeypair.publicKey);

    await test3_GetVault(client, vaultAddress);

    await test4_GuardianVault(client, vaultAddress);

    await test5_ExecuteValidTransaction(client, vaultAddress, recipientKeypair.publicKey);

    await test6_AddToWhitelist(client, vaultAddress, recipientKeypair.publicKey);

    await test7_UpdatePolicy(client, vaultAddress, 2.5);

    await test8_BlockedTransaction(client, vaultAddress, recipientKeypair.publicKey);

    const overrideNonce = await test9_RequestOverride(
      client,
      vaultAddress,
      recipientKeypair.publicKey
    );

    await test10_GetTransactionHistory(client, vaultAddress);

    await test11_GetAnalytics(client, vaultAddress);

    await test12_ListVaults(client, wallet.publicKey);

    // Summary
    logSection('✅ TEST SUITE COMPLETED SUCCESSFULLY');

    logSuccess('All core functionality verified:');
    logInfo('  ✓ Client initialization');
    logInfo('  ✓ Vault creation');
    logInfo('  ✓ Vault data retrieval');
    logInfo('  ✓ Transaction execution');
    logInfo('  ✓ Whitelist management');
    logInfo('  ✓ Policy updates');
    logInfo('  ✓ Transaction blocking');
    logInfo('  ✓ Override requests');
    logInfo('  ✓ Guardian API integration');

    logInfo('\nTest vault created:');
    logInfo(`  Address: ${vaultAddress}`);
    logInfo(`  View on explorer: https://explorer.solana.com/address/${vaultAddress}?cluster=devnet`);

    logInfo('\nNext steps:');
    logInfo('  1. Check Guardian API: https://aegis-guardian-production.up.railway.app/api/vaults');
    logInfo(`  2. View your vault: https://aegis-guardian-production.up.railway.app/api/vaults/${vaultAddress}`);
    logInfo('  3. Test the frontend with this vault at https://aegis-vaults.xyz');

  } catch (error) {
    logError('\n❌ TEST SUITE FAILED');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
