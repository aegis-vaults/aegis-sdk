# Aegis SDK Examples

This directory contains working examples demonstrating how to use the Aegis SDK.

## Prerequisites

1. **Solana CLI** installed and configured for devnet
2. **Node.js** 18+ installed
3. **Funded wallet** on devnet (for transaction fees)

## Setup

```bash
# Install dependencies
npm install

# Build the SDK
npm run build
```

## Environment Variables

Create a `.env` file or export these variables:

```bash
# Vault owner's wallet (for creating vaults, managing policy)
export OWNER_SECRET='[1,2,3,...]'  # JSON array of secret key bytes

# AI agent's wallet (for executing transactions)
export AGENT_SECRET='[1,2,3,...]'  # JSON array of secret key bytes

# After creating a vault:
export VAULT_ADDRESS="your-vault-address"
export VAULT_NONCE="your-vault-nonce"

# Transaction recipient
export DESTINATION="recipient-address"
```

## Examples

### 1. Quick Start (`quickstart.ts`)

Complete walkthrough: create vault, fund it, execute transaction.

```bash
npx tsx examples/quickstart.ts
```

### 2. Test Transaction Scenarios (`test-scenario.ts`)

Test valid and blocked transactions:

```bash
# Valid transaction (within daily limit)
VAULT_ADDRESS=xxx AGENT_SECRET='[...]' DESTINATION=xxx AMOUNT=0.01 TEST_TYPE=valid \
  npx tsx examples/test-scenario.ts

# Exceed daily limit (triggers override flow)
VAULT_ADDRESS=xxx AGENT_SECRET='[...]' DESTINATION=xxx AMOUNT=1.0 TEST_TYPE=exceed_limit \
  npx tsx examples/test-scenario.ts
```

### 3. Verify Setup (`verify-setup.ts`)

Check your vault configuration and agent setup:

```bash
VAULT_ADDRESS=xxx AGENT_SECRET='[...]' npx tsx examples/verify-setup.ts
```

### 4. Send SOL (`send-sol.ts`)

Simple SOL transfer using the SDK:

```bash
VAULT_ADDRESS=xxx AGENT_SECRET='[...]' DESTINATION=xxx AMOUNT=0.05 \
  npx tsx examples/send-sol.ts
```

### 5. Link Vault to Guardian (`link-vault.ts`)

Register an on-chain vault with the Guardian API:

```bash
VAULT_ADDRESS=xxx npx tsx examples/link-vault.ts
```

## Test Flow Sequence

For comprehensive testing, run in this order:

### Step 1: Create and Fund Vault

```bash
# Create vault (requires owner wallet)
npx tsx examples/quickstart.ts

# Note the output:
# - Vault Address: xxx
# - Deposit Address: xxx  
# - Vault Nonce: xxx

# Fund the vault
solana transfer <DEPOSIT_ADDRESS> 1 --url devnet
```

### Step 2: Configure Policy

```bash
# Add destination to whitelist (use frontend or SDK)
# Set desired daily limit (e.g., 0.1 SOL)
```

### Step 3: Test Valid Transaction

```bash
VAULT_ADDRESS="xxx" \
AGENT_SECRET='[...]' \
VAULT_NONCE="xxx" \
DESTINATION="xxx" \
AMOUNT="0.01" \
TEST_TYPE="valid" \
npx tsx examples/test-scenario.ts
```

Expected output:
```
✅ TRANSACTION SUCCESSFUL!
💰 New vault balance: 0.99 SOL
```

### Step 4: Test Blocked Transaction

```bash
VAULT_ADDRESS="xxx" \
AGENT_SECRET='[...]' \
VAULT_NONCE="xxx" \
DESTINATION="xxx" \
AMOUNT="0.5" \
TEST_TYPE="exceed_limit" \
npx tsx examples/test-scenario.ts
```

Expected output:
```
❌ TRANSACTION BLOCKED BY POLICY!
📲 Notifying Guardian API to send override request...
✅ OVERRIDE REQUEST CREATED!
📧 Check your email, Telegram, or Discord for the notification.
🔗 BLINK URL: https://dial.to/?action=solana-action:...
```

### Step 5: Approve Override

1. Click the Blink URL from the notification
2. Connect your vault owner wallet (not agent!)
3. Click "Approve Override"
4. Sign the transaction

⚠️ **Note**: On devnet, you may see "timeout reached" but the transaction often succeeds. Check your vault balance and notifications.

## File Reference

| File | Description |
|------|-------------|
| `quickstart.ts` | Complete getting started example |
| `test-scenario.ts` | Test valid/blocked transactions |
| `verify-setup.ts` | Verify vault and agent configuration |
| `send-sol.ts` | Simple SOL transfer |
| `link-vault.ts` | Link vault to Guardian API |
| `register-vault.ts` | Register vault with metadata |
| `request-override.ts` | Manually request override |
| `transfer-example.ts` | Transfer with error handling |
| `devnet-test.ts` | Devnet-specific testing |
| `test-blocked-transaction.ts` | Test policy violations |
| `test-override.ts` | Test override approval flow |

## Troubleshooting

### "Vault not found"

The vault hasn't synced with Guardian yet. Wait 30 seconds and try again, or manually trigger a sync.

### "NotWhitelisted" error

Add the destination address to your vault's whitelist before sending.

### "DailyLimitExceeded" error

Either:
1. Wait 24 hours for limit to reset
2. Increase daily limit via updatePolicy()
3. Request an override (owner must approve)

### "UnauthorizedSigner" error

You're using the wrong keypair. Agent transactions must be signed by the `agentSigner` specified at vault creation.

### Blink shows "timeout reached"

This is a devnet issue. The transaction often succeeds despite the timeout. Check:
1. Your vault balance (should have decreased)
2. Your notifications (you should receive a success notification)
3. Solana Explorer for the transaction

## Getting Help

- [Aegis Documentation](https://docs.aegis-vaults.xyz)
- [Discord Support](https://discord.gg/aegis)
- [GitHub Issues](https://github.com/aegis-vaults/aegis-sdk/issues)
