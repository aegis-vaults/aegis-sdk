# Aegis SDK Examples

This directory contains example scripts demonstrating how to use the Aegis SDK.

## Prerequisites

1. **Devnet SOL**: Get free devnet SOL from https://faucet.solana.com/
2. **Node.js**: Version 18 or higher
3. **Dependencies**: Run `npm install` in the SDK root directory

## Examples

### 1. Quick Start (`quickstart.ts`)

A minimal example showing basic vault creation and transaction execution.

```bash
npx ts-node examples/quickstart.ts
```

**What it does:**
- Connects to Solana devnet
- Creates a new vault with 1 SOL daily limit
- Executes a guarded transaction for 0.1 SOL
- Fetches and displays vault status

**Perfect for:** First-time users, understanding basic workflows

---

### 2. Comprehensive Integration Test (`devnet-test.ts`)

A full test suite covering all SDK functionality.

```bash
npx ts-node examples/devnet-test.ts
```

**What it tests:**
1. Client initialization and connection
2. Vault creation with policies
3. On-chain vault data retrieval
4. Guardian API integration
5. Valid transaction execution
6. Whitelist management
7. Policy updates
8. Transaction blocking (policy violations)
9. Override request workflow
10. Transaction history queries
11. Analytics queries
12. Listing all vaults for an owner

**Perfect for:** Thorough testing, CI/CD integration, verifying deployments

---

## Running Examples

### Option 1: Using npm scripts (Recommended)

```bash
# Run the quickstart example
npm run example:quickstart

# Run the comprehensive test suite
npm run test:devnet

# Verify setup first
npm run verify:setup
```

### Option 2: Using tsx directly

```bash
# Install tsx globally (optional)
npm install -g tsx

# Run an example
npx tsx examples/quickstart.ts
```

## Getting Devnet SOL

The examples require devnet SOL to pay for transactions. Get free devnet SOL:

### Method 1: Web Faucet
Visit https://faucet.solana.com/ and enter your wallet address

### Method 2: CLI
```bash
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet
```

### Method 3: Auto-airdrop (in devnet-test.ts)
The comprehensive test script automatically requests airdrops if needed

## Wallet Management

### Using Generated Wallets

The `devnet-test.ts` script automatically creates and saves a wallet to `.devnet-wallet.json`:

```typescript
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

// Load existing wallet
const keypairData = JSON.parse(fs.readFileSync('.devnet-wallet.json', 'utf-8'));
const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
```

### Using Your Own Wallet

```typescript
import { Keypair } from '@solana/web3.js';

// From secret key array
const wallet = Keypair.fromSecretKey(new Uint8Array([...]));

// From wallet file (Phantom export, etc.)
import walletFile from './my-wallet.json';
const wallet = Keypair.fromSecretKey(new Uint8Array(walletFile));
```

### Using Wallet Adapters (Browser)

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

function MyComponent() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  const client = new AegisClient({
    cluster: 'devnet',
    programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
  });

  if (publicKey && signTransaction && signAllTransactions) {
    client.setWallet({
      publicKey,
      signTransaction,
      signAllTransactions,
    } as any);
  }
}
```

## Verifying Results

### 1. On-Chain (Solana Explorer)

View transactions and accounts:
```
https://explorer.solana.com/address/<VAULT_ADDRESS>?cluster=devnet
https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet
```

### 2. Guardian API

Query the Guardian backend:

```bash
# Get all vaults
curl https://aegis-guardian-production.up.railway.app/api/vaults | jq

# Get specific vault
curl https://aegis-guardian-production.up.railway.app/api/vaults/<VAULT_ADDRESS> | jq

# Get transactions
curl https://aegis-guardian-production.up.railway.app/api/transactions?vault=<VAULT_ADDRESS> | jq

# Get analytics
curl https://aegis-guardian-production.up.railway.app/api/analytics/fees | jq
```

### 3. Using the SDK

```typescript
// Fetch vault data
const vault = await client.getVault(vaultAddress);

// Get transaction history
const history = await client.getTransactionHistory({
  vault: vaultAddress,
  limit: 10,
});

// Get analytics
const analytics = await client.getAnalytics(vaultAddress, {
  timeframe: '7d',
});
```

## Troubleshooting

### Error: "Insufficient balance"

**Solution:** Get devnet SOL from https://faucet.solana.com/

### Error: "Transaction failed"

**Possible causes:**
- Devnet might be experiencing issues (check https://status.solana.com/)
- Try using a different RPC endpoint
- Increase the `commitment` level to 'finalized'

### Error: "Program not found"

**Solution:** Verify the program ID matches your deployment:
```bash
solana program show ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ --url devnet
```

### Error: "Guardian API timeout"

**Possible causes:**
- Guardian backend might be restarting
- Network connectivity issues
- Vault not indexed yet (wait 5-10 seconds after creation)

### Error: "Daily limit exceeded"

**This is expected behavior!** It means the policy engine is working correctly.

**Solution:**
- Request an override: `client.requestOverride(...)`
- Or update the policy: `client.updatePolicy({ dailyLimit: ... })`

## Next Steps

After running the examples:

1. **Integrate with your AI agent**
   - See `src/agents/openai.ts` for OpenAI integration
   - See `src/agents/langchain.ts` for LangChain integration
   - See `src/agents/anthropic.ts` for Claude integration

2. **Build a custom application**
   - Use the SDK in your Next.js/React app
   - Connect with wallet adapters
   - Build custom UIs for vault management

3. **Test in production**
   - Switch `cluster` from 'devnet' to 'mainnet-beta'
   - Update `programId` to your mainnet deployment
   - Use real SOL (be careful!)

## Support

- **Documentation**: See main README.md
- **Issues**: https://github.com/aegis/aegis-sdk/issues
- **Guardian Status**: https://aegis-guardian-production.up.railway.app/api/health
- **Solana Status**: https://status.solana.com/

## Example Output

When you run `devnet-test.ts`, you should see output like:

```
🧪 AEGIS SDK DEVNET INTEGRATION TEST
============================================================

TEST 1: Initialize AegisClient
============================================================
✓ Connected to Solana devnet
✓ AegisClient initialized
ℹ Program ID: ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ
ℹ Guardian API: https://aegis-guardian-production.up.railway.app
✓ Balance sufficient: 2.5 SOL

TEST 2: Create Vault
============================================================
ℹ Creating vault with 1 SOL daily limit...
✓ Vault created: 8xK2m...
ℹ Transaction: 3Hk9L...
ℹ View on explorer: https://explorer.solana.com/tx/3Hk9L...

[... more tests ...]

✅ TEST SUITE COMPLETED SUCCESSFULLY
```

Happy coding! 🚀
