# Testing the Aegis SDK with Devnet

This guide walks you through testing the fully implemented Aegis SDK against the live devnet deployment.

## 🎯 Quick Start (5 minutes)

```bash
# 1. Verify your setup
npm run verify:setup

# 2. Get devnet SOL
# Visit https://faucet.solana.com/ with your wallet address

# 3. Run the quick start example
npm run example:quickstart

# 4. Run comprehensive tests
npm run test:devnet
```

## 📋 Prerequisites

### 1. Devnet Configuration

Your devnet deployment should have:
- ✅ **Protocol**: Deployed at `ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ`
- ✅ **Guardian**: Running at `https://aegis-guardian-production.up.railway.app`
- ✅ **Network**: Solana Devnet

### 2. Get Devnet SOL

You need devnet SOL to pay for transactions:

**Method 1 - Web Faucet (Easiest)**
```
1. Visit https://faucet.solana.com/
2. Paste your wallet address
3. Request 2 SOL
```

**Method 2 - CLI**
```bash
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet
```

**Method 3 - Auto-airdrop**
```typescript
// The devnet-test.ts script automatically requests airdrops
npm run test:devnet
```

### 3. Install Dependencies

```bash
cd /Users/ryankaelle/dev/aegis/aegis-sdk
npm install
npm run build
```

## 🧪 Testing Scenarios

### Test 1: Verify Setup (30 seconds)

Checks that everything is configured correctly:

```bash
npm run verify:setup
```

**What it checks:**
- ✅ SDK is built and importable
- ✅ Devnet is accessible
- ✅ RPC endpoint is responsive
- ✅ Program is deployed on-chain
- ✅ Guardian API is healthy

**Expected output:**
```
✓ SDK Build
✓ Devnet Connection
✓ RPC Performance
✓ Program Deployment
✓ Guardian API

🎉 All checks passed!
```

### Test 2: Quick Start Example (2 minutes)

Basic workflow demonstrating core functionality:

```bash
npm run example:quickstart
```

**What it does:**
1. Connects to devnet
2. Creates a vault with 1 SOL daily limit
3. Executes a guarded transaction (0.1 SOL)
4. Fetches and displays vault status

**Expected output:**
```
🚀 Aegis SDK Quick Start

📡 Connecting to devnet...
💼 Wallet: <address>
🤖 Agent: <address>

📦 Creating vault...
✅ Vault created!
   Address: <vault-address>
   Transaction: <signature>

💸 Executing guarded transaction...
✅ Transaction executed!
   Signature: <signature>

📊 Fetching vault data...
✅ Vault status:
   Daily limit: 1000000000 lamports
   Spent today: 100000000 lamports
   Paused: false

🎉 Quick start complete!
```

### Test 3: Comprehensive Integration Tests (5 minutes)

Full test suite covering all SDK features:

```bash
npm run test:devnet
```

**Test Coverage:**

| # | Test | What It Verifies |
|---|------|------------------|
| 1 | Initialize Client | Connection to devnet, client setup |
| 2 | Create Vault | On-chain vault creation with policies |
| 3 | Get Vault | Fetch vault data from chain |
| 4 | Guardian Vault | Query Guardian API for vault metadata |
| 5 | Execute Valid Transaction | Policy-compliant transaction succeeds |
| 6 | Add to Whitelist | Whitelist management works |
| 7 | Update Policy | Policy updates propagate on-chain |
| 8 | Blocked Transaction | Policy violations are caught |
| 9 | Request Override | Override workflow initiates |
| 10 | Get Transaction History | Guardian indexes transactions |
| 11 | Get Analytics | Analytics aggregation works |
| 12 | List Vaults | Multi-vault queries work |

**Expected output:**
```
🧪 AEGIS SDK DEVNET INTEGRATION TEST

TEST 1: Initialize AegisClient
✓ Connected to Solana devnet
✓ AegisClient initialized
ℹ Program ID: ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ
✓ Balance sufficient: 2.5 SOL

TEST 2: Create Vault
✓ Vault created: <address>
ℹ Transaction: <signature>

[... 10 more tests ...]

✅ TEST SUITE COMPLETED SUCCESSFULLY

All core functionality verified:
  ✓ Client initialization
  ✓ Vault creation
  ✓ Transaction execution
  ✓ Policy enforcement
  ✓ Guardian integration
```

### Test 4: AI Agent Integration Tests

Test AI framework integrations:

```bash
# Coming soon - OpenAI integration
npm run test:openai

# Coming soon - LangChain integration
npm run test:langchain

# Coming soon - Anthropic integration
npm run test:anthropic
```

## 🔍 Verifying Results

### 1. Check On-Chain Data

View your transactions and vaults on Solana Explorer:

```bash
# View vault account
https://explorer.solana.com/address/<VAULT_ADDRESS>?cluster=devnet

# View transaction
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet

# View program
https://explorer.solana.com/address/ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ?cluster=devnet
```

### 2. Query Guardian API

Check that Guardian indexed your data:

```bash
# Health check
curl https://aegis-guardian-production.up.railway.app/api/health | jq

# List all vaults
curl https://aegis-guardian-production.up.railway.app/api/vaults | jq

# Get specific vault
curl https://aegis-guardian-production.up.railway.app/api/vaults/<VAULT_ADDRESS> | jq

# Get transactions
curl https://aegis-guardian-production.up.railway.app/api/transactions | jq

# Get analytics
curl https://aegis-guardian-production.up.railway.app/api/analytics/fees | jq
```

### 3. Check Guardian Logs

Monitor Guardian event processing:

```bash
cd /Users/ryankaelle/dev/Aegis/aegis-guardian
railway logs | grep -i "event"
```

Expected logs:
```
[INFO] Event listener initialized
[INFO] WebSocket connected to devnet
[INFO] Listening for program: ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ
[INFO] Received event: VaultInitialized
[INFO] Received event: TransactionExecuted
```

## 🎯 Test Scenarios by Use Case

### Scenario 1: Create and Fund a Vault

```typescript
import { AegisClient } from '@aegis/sdk';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

const client = new AegisClient({
  cluster: 'devnet',
  programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
});

const wallet = Keypair.generate();
client.setWallet(wallet as any);

// Create vault
const { vaultAddress } = await client.createVault({
  name: 'Trading Bot Vault',
  agentSigner: agentKeypair.publicKey.toBase58(),
  dailyLimit: (10 * LAMPORTS_PER_SOL).toString(), // 10 SOL/day
});

console.log('Vault created:', vaultAddress);
```

### Scenario 2: Execute Multiple Transactions

```typescript
// Execute several transactions within the limit
for (let i = 0; i < 5; i++) {
  await client.executeGuarded({
    vault: vaultAddress,
    destination: recipient.toBase58(),
    amount: (0.1 * LAMPORTS_PER_SOL).toString(),
    purpose: `Transaction ${i + 1}`,
  });
}

// Check spending
const vault = await client.getVault(vaultAddress);
console.log('Spent today:', vault.spentToday.toString());
```

### Scenario 3: Test Policy Violation and Override

```typescript
// Try to exceed limit (should be blocked)
try {
  await client.executeGuarded({
    vault: vaultAddress,
    destination: recipient.toBase58(),
    amount: (100 * LAMPORTS_PER_SOL).toString(), // Way over limit
    purpose: 'Large transaction',
  });
} catch (error) {
  console.log('Transaction blocked:', error.message);

  // Request override
  const { blinkUrl, nonce } = await client.requestOverride({
    vault: vaultAddress,
    destination: recipient.toBase58(),
    amount: (100 * LAMPORTS_PER_SOL).toString(),
    reason: 'Emergency withdrawal',
  });

  console.log('Override requested. Approve at:', blinkUrl);

  // Later, after approval:
  await client.approveOverride(vaultAddress, nonce);
  await client.executeOverride(vaultAddress, nonce);
}
```

### Scenario 4: Manage Whitelist

```typescript
// Add addresses to whitelist
const trustedAddresses = [
  'Jupiter1111111111111111111111111111111111111',
  'Raydium1111111111111111111111111111111111111',
];

for (const address of trustedAddresses) {
  await client.addToWhitelist(vaultAddress, address);
}

// Verify whitelist
const vault = await client.getVault(vaultAddress);
console.log('Whitelist:', vault.whitelist.map(pk => pk.toBase58()));

// Remove an address
await client.removeFromWhitelist(vaultAddress, trustedAddresses[0]);
```

### Scenario 5: Update Policies

```typescript
// Increase daily limit
await client.updatePolicy({
  vault: vaultAddress,
  dailyLimit: (20 * LAMPORTS_PER_SOL).toString(), // 20 SOL/day
});

// Pause vault (emergency stop)
await client.pauseVault(vaultAddress);

// Later, resume
await client.resumeVault(vaultAddress);
```

### Scenario 6: Query and Monitor

```typescript
// Get transaction history
const history = await client.getTransactionHistory({
  vault: vaultAddress,
  status: 'EXECUTED',
  limit: 20,
  page: 1,
});

console.log('Found', history.data.length, 'transactions');

// Get analytics
const analytics = await client.getAnalytics(vaultAddress, {
  timeframe: '7d',
  groupBy: 'day',
});

console.log('Total volume:', analytics.totalVolume);
console.log('Transaction count:', analytics.transactionCount);

// Subscribe to events
const unsubscribe = await client.subscribeToVault(
  vaultAddress,
  (event) => {
    console.log('Event received:', event.type, event.data);
  }
);

// Later: unsubscribe()
```

## 🐛 Troubleshooting

### Issue: "Insufficient balance"

**Solution:**
```bash
# Get devnet SOL
solana airdrop 2 <YOUR_WALLET> --url devnet

# Or visit
https://faucet.solana.com/
```

### Issue: "Transaction failed with error: 0x1"

**Possible causes:**
- Program not deployed correctly
- Wrong program ID
- Account doesn't exist

**Solution:**
```bash
# Verify program deployment
solana program show ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ --url devnet

# Check program ID in SDK
grep -r "ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ" src/
```

### Issue: "Guardian API timeout"

**Possible causes:**
- Guardian is restarting
- Network issues
- Vault not indexed yet

**Solution:**
```bash
# Check Guardian health
curl https://aegis-guardian-production.up.railway.app/api/health

# Wait 5-10 seconds after creating vault
# Check Guardian logs
cd /Users/ryankaelle/dev/Aegis/aegis-guardian
railway logs
```

### Issue: "Daily limit exceeded" (expected behavior!)

This means the policy engine is working correctly.

**Solution:**
```typescript
// Request an override
const { blinkUrl } = await client.requestOverride({
  vault: vaultAddress,
  destination: recipient,
  amount: largeAmount,
  reason: 'Need more funds',
});

// Or update the policy
await client.updatePolicy({
  vault: vaultAddress,
  dailyLimit: higherLimit,
});
```

### Issue: "Wallet not connected"

**Solution:**
```typescript
// Make sure to set wallet before operations
const wallet = Keypair.generate();
client.setWallet(wallet as any);
```

### Issue: Events not appearing in Guardian

**Check:**
```bash
# 1. Verify Guardian is on devnet
railway variables --json | jq '.SOLANA_CLUSTER'

# 2. Check event listener logs
railway logs | grep -i "event listener"

# 3. Verify program ID matches
railway variables --json | jq '.PROGRAM_ID'
```

## 📊 Success Metrics

After running the tests, verify:

- [ ] ✅ All vaults created successfully
- [ ] ✅ Valid transactions execute within 2 seconds
- [ ] ✅ Policy violations are blocked
- [ ] ✅ Overrides can be requested
- [ ] ✅ Guardian API indexes events within 5 seconds
- [ ] ✅ Analytics queries return data
- [ ] ✅ Whitelist management works
- [ ] ✅ Policy updates propagate correctly

## 🚀 Next Steps

After successful testing:

1. **Integrate with AI Agent**
   ```typescript
   import { createAegisTools } from '@aegis/sdk/agents';
   ```

2. **Build Custom UI**
   - Use SDK in React/Next.js app
   - Connect with wallet adapters
   - Display real-time vault status

3. **Deploy to Production**
   - Switch to mainnet-beta
   - Update program ID
   - Use production RPC endpoints

## 📚 Additional Resources

- **SDK Documentation**: See main README.md
- **Examples**: See `/examples` directory
- **Guardian API**: `/Users/ryankaelle/dev/Aegis/aegis-guardian/API_DOCUMENTATION.md`
- **Protocol Docs**: `/Users/ryankaelle/dev/Aegis/aegis-protocol/README.md`
- **Solana Explorer**: https://explorer.solana.com/?cluster=devnet
- **Solana Status**: https://status.solana.com/

## 🎉 Conclusion

You now have a fully operational SDK tested against live devnet infrastructure. All core functionality has been verified:

- ✅ Vault creation and management
- ✅ Policy-enforced transactions
- ✅ Override workflow
- ✅ Guardian API integration
- ✅ Event subscriptions
- ✅ Analytics queries

The SDK is ready for:
- ✅ AI agent integration
- ✅ Frontend application development
- ✅ Production deployment (mainnet)

Happy building! 🚀
