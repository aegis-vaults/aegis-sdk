# @aegis-vaults/sdk

> TypeScript SDK for Aegis Protocol - On-chain operating system for AI finance on Solana

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-9945FF)](https://solana.com/)

## Overview

Aegis SDK enables AI agents to autonomously execute on-chain transactions with human-in-the-loop safety controls. Give your AI agent controlled access to Solana funds through smart vaults with:

- **Policy Guards**: Daily spending limits and address whitelists enforced on-chain
- **Override System**: Blocked transactions trigger notifications to vault owners who can approve via Solana Blinks
- **Multi-Channel Notifications**: Email, Telegram, Discord, and webhook alerts for blocked transactions
- **AI Framework Integration**: Drop-in tools for OpenAI, LangChain, and Anthropic Claude

## Table of Contents

- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [For Vault Owners](#for-vault-owners)
- [For AI Agents](#for-ai-agents)
- [Override Flow](#override-flow)
- [AI Framework Integration](#ai-framework-integration)
- [API Reference](#api-reference)
- [Error Handling](#error-handling)
- [Utilities](#utilities)
- [Testing](#testing)
- [Architecture](#architecture)

## Installation

```bash
npm install @aegis-vaults/sdk @solana/web3.js @coral-xyz/anchor bn.js
```

## Core Concepts

### Two Types of Users

| Role | Description | Signs Transactions With |
|------|-------------|------------------------|
| **Vault Owner** | Human who creates and funds vaults, sets policies | Browser wallet (Phantom, etc.) |
| **AI Agent** | AI system that executes transactions autonomously | Server-side keypair |

### Key Addresses

Each vault has TWO important addresses:

| Address | Purpose | Use Case |
|---------|---------|----------|
| **Vault Address** | Configuration PDA | Pass to SDK methods |
| **Deposit Address** | Holds actual SOL | Send funds HERE to fund vault |

⚠️ **IMPORTANT**: Always send SOL to the **Deposit Address**, not the Vault Address!

### Transaction Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Agent      │───▶│  Aegis Protocol  │───▶│   Destination   │
│   (Signer)      │    │  (Policy Check)  │    │    Wallet       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              ✅ PASSES            ❌ BLOCKED
           (Tx Executes)         (Notify Owner)
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Blink URL    │
                              │  (Approve/    │
                              │   Deny)       │
                              └───────────────┘
```

## Quick Start

### 1. Create a Vault (Vault Owner)

```typescript
import { AegisClient } from '@aegis-vaults/sdk';
import { Keypair } from '@solana/web3.js';

// Initialize client
const client = new AegisClient({
  cluster: 'devnet',
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
});

// Connect your wallet (browser wallet or keypair)
const ownerKeypair = Keypair.fromSecretKey(/* your secret key */);
client.setWallet(ownerKeypair);

// Create vault
const result = await client.createVault({
  name: 'My AI Agent Treasury',
  agentSigner: 'AGENT_PUBLIC_KEY_HERE', // Your AI agent's public key
  dailyLimit: 100_000_000, // 0.1 SOL per day
});

console.log('Vault Address:', result.vaultAddress);
console.log('Deposit Address:', result.depositAddress);
console.log('Vault Nonce:', result.nonce); // Save this! Needed for transactions
```

### 2. Fund the Vault

```bash
# Using Solana CLI
solana transfer <DEPOSIT_ADDRESS> 1 --url devnet
```

Or programmatically:
```typescript
const depositAddress = client.getVaultDepositAddress(vaultAddress);
// Send SOL to depositAddress via your preferred method
```

### 3. Execute Agent Transaction (AI Agent)

```typescript
import { AegisClient } from '@aegis-vaults/sdk';
import { Keypair } from '@solana/web3.js';

// Initialize client with agent keypair
const client = new AegisClient({
  cluster: 'devnet',
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
});

// Load your AI agent's keypair (keep this secure!)
const agentKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.AGENT_SECRET_KEY!))
);
client.setWallet(agentKeypair);

// Execute transaction (auto-notifies Guardian if blocked)
try {
  const signature = await client.executeAgent({
    vault: 'VAULT_ADDRESS',
    destination: 'RECIPIENT_ADDRESS', // Must be whitelisted!
    amount: 10_000_000, // 0.01 SOL
    vaultNonce: 'VAULT_NONCE', // From vault creation
  });
  
  console.log('✅ Transaction successful:', signature);
} catch (error: any) {
  if (error.overrideRequested) {
    console.log('⏳ Transaction blocked. Override requested.');
    console.log('📱 Blink URL:', error.blinkUrl);
    // Vault owner will receive notification to approve
  }
}
```

## For Vault Owners

### Creating a Vault

```typescript
const result = await client.createVault({
  name: 'Production AI Treasury',
  agentSigner: agentPublicKey.toBase58(),
  dailyLimit: 1_000_000_000, // 1 SOL per day
});

// SAVE THESE VALUES:
// - result.vaultAddress: Pass to your AI agent
// - result.depositAddress: Fund this address
// - result.nonce: Agent needs this for transactions
```

### Managing Whitelist

Only whitelisted addresses can receive funds:

```typescript
// Add address to whitelist
await client.addToWhitelist(vaultAddress, vaultNonce, recipientAddress);

// Remove from whitelist
await client.removeFromWhitelist(vaultAddress, vaultNonce, oldAddress);

// View current whitelist
const vault = await client.getVault(vaultAddress);
console.log('Whitelisted addresses:', vault.whitelist.map(pk => pk.toBase58()));
```

### Updating Daily Limit

```typescript
await client.updatePolicy({
  vault: vaultAddress,
  dailyLimit: 2_000_000_000, // 2 SOL
});
```

### Emergency Controls

```typescript
// Pause vault (blocks ALL transactions)
await client.pauseVault(vaultAddress, vaultNonce);

// Resume vault
await client.resumeVault(vaultAddress, vaultNonce);

// Rotate agent signer key (security)
await client.updateAgentSigner(vaultAddress, vaultNonce, newAgentPublicKey);
```

### Checking Vault Status

```typescript
const vault = await client.getVault(vaultAddress);

console.log('Name:', vault.name);
console.log('Daily Limit:', vault.dailyLimit.toString(), 'lamports');
console.log('Spent Today:', vault.spentToday.toString(), 'lamports');
console.log('Paused:', vault.paused);
console.log('Whitelist Count:', vault.whitelistCount);

// Get balance
const balance = await client.getVaultBalance(vaultAddress);
console.log('Balance:', balance / 1e9, 'SOL');
```

## For AI Agents

### Setup

Your AI agent needs:
1. **Agent Keypair**: A Solana keypair for signing transactions
2. **Vault Address**: The vault PDA address
3. **Vault Nonce**: Used for PDA derivation (from vault creation)

```typescript
const client = new AegisClient({
  cluster: 'devnet',
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
  autoRequestOverride: true, // Automatically notify Guardian on blocked tx
});

// Load agent keypair from environment
const agentKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.AGENT_SECRET_KEY!))
);
client.setWallet(agentKeypair);
```

### Executing Transactions

```typescript
import { DailyLimitExceededError, NotWhitelistedError } from '@aegis-vaults/sdk';

try {
  const signature = await client.executeAgent({
    vault: process.env.VAULT_ADDRESS!,
    destination: recipientAddress,
    amount: 50_000_000, // 0.05 SOL
    vaultNonce: process.env.VAULT_NONCE!,
    purpose: 'Payment for service', // Optional metadata
  });
  
  console.log('Transaction executed:', signature);
  console.log('Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
} catch (error: any) {
  // Error includes Blink URL for vault owner to approve
  if (error.overrideRequested) {
    console.log('Transaction blocked. Vault owner notified.');
    console.log('Blink URL:', error.blinkUrl);
  } else {
    console.error('Transaction failed:', error.message);
  }
}
```

### Pre-flight Checks

Check vault state before attempting transactions:

```typescript
async function canExecute(vault: string, amount: number): Promise<boolean> {
  const vaultData = await client.getVault(vault);
  const balance = await client.getVaultBalance(vault);
  
  // Check if vault is paused
  if (vaultData.paused) {
    console.log('Vault is paused');
    return false;
  }
  
  // Check balance
  if (balance < amount) {
    console.log('Insufficient balance');
    return false;
  }
  
  // Check daily limit
  const remaining = BigInt(vaultData.dailyLimit.toString()) - BigInt(vaultData.spentToday.toString());
  if (remaining < BigInt(amount)) {
    console.log('Would exceed daily limit');
    return false;
  }
  
  return true;
}
```

## Override Flow

When a transaction is blocked by policy (daily limit exceeded, not whitelisted, etc.):

### 1. SDK Notifies Guardian

The SDK automatically notifies the Guardian API when a transaction is blocked:

```typescript
// This happens automatically when autoRequestOverride: true (default)
const response = await client.executeAgent({...});
// If blocked, error.overrideRequested will be true
// error.blinkUrl contains the approval link
```

### 2. Owner Receives Notification

The vault owner receives notifications via:
- 📧 Email (SendGrid)
- 📱 Telegram
- 💬 Discord
- 🔗 Webhook

### 3. Owner Approves via Blink

The owner clicks the Blink URL and approves in their wallet. The Blink:
1. Creates the override request on-chain
2. Approves the override
3. Executes the transfer

All in one transaction!

### Manual Override Request

If needed, you can manually request an override:

```typescript
const override = await client.requestOverride({
  vault: vaultAddress,
  destination: recipientAddress,
  amount: 2_000_000_000, // 2 SOL (exceeds daily limit)
  reason: 'Emergency payment required',
});

console.log('Override Blink URL:', override.blinkUrl);
```

## AI Framework Integration

### OpenAI Function Calling

```typescript
import OpenAI from 'openai';
import { AegisClient } from '@aegis-vaults/sdk';
import { createOpenAITools, executeAegisTool } from '@aegis-vaults/sdk/agents';

const openai = new OpenAI();
const aegis = new AegisClient({...});
aegis.setWallet(agentKeypair);

// Get Aegis tool definitions
const tools = createOpenAITools(aegis);

// Chat completion with tools
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a financial agent with access to an Aegis vault. Use it to send SOL payments when requested.' },
    { role: 'user', content: 'Send 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
  ],
  tools,
  tool_choice: 'auto',
});

// Handle tool calls
if (response.choices[0].message.tool_calls) {
  for (const toolCall of response.choices[0].message.tool_calls) {
    const result = await executeAegisTool(aegis, toolCall);
    console.log('Tool result:', result);
  }
}
```

### Available OpenAI Tools

| Tool | Description |
|------|-------------|
| `aegis_create_vault` | Create a new vault |
| `aegis_execute_transaction` | Execute agent transaction |
| `aegis_request_override` | Request manual approval |
| `aegis_get_vault` | Get vault configuration |
| `aegis_get_vault_balance` | Get vault balance |
| `aegis_get_transaction_history` | Get transaction history |
| `aegis_add_to_whitelist` | Add address to whitelist |
| `aegis_update_daily_limit` | Update daily limit |

### LangChain Integration

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AegisClient } from '@aegis-vaults/sdk';

const aegis = new AegisClient({...});
aegis.setWallet(agentKeypair);

const aegisTransferTool = new DynamicStructuredTool({
  name: 'aegis_transfer',
  description: 'Transfer SOL from the Aegis vault to a destination address',
  schema: z.object({
    destination: z.string().describe('Recipient Solana address'),
    amount_sol: z.number().describe('Amount in SOL'),
    purpose: z.string().optional(),
  }),
  func: async ({ destination, amount_sol, purpose }) => {
    try {
      const signature = await aegis.executeAgent({
        vault: process.env.VAULT_ADDRESS!,
        destination,
        amount: Math.floor(amount_sol * 1e9),
        vaultNonce: process.env.VAULT_NONCE!,
        purpose,
      });
      return JSON.stringify({ success: true, signature });
    } catch (error: any) {
      if (error.overrideRequested) {
        return JSON.stringify({
          success: false,
          blocked: true,
          message: 'Transaction blocked. Vault owner has been notified.',
          blinkUrl: error.blinkUrl,
        });
      }
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});
```

## API Reference

### AegisClient

#### Constructor

```typescript
const client = new AegisClient({
  // Network configuration
  cluster?: 'devnet' | 'mainnet-beta' | 'testnet',
  connection?: Connection, // Or provide custom connection
  programId?: string, // Default: devnet program ID
  
  // Guardian API
  guardianApiUrl?: string,
  
  // Transaction settings
  commitment?: Commitment,
  confirmTimeout?: number,
  autoRetry?: boolean,
  maxRetries?: number,
  
  // Override behavior
  autoRequestOverride?: boolean, // Auto-notify Guardian on blocked tx
});
```

#### Vault Management

| Method | Description | Signer |
|--------|-------------|--------|
| `createVault(options)` | Create new vault | Owner |
| `getVault(address)` | Get vault config | - |
| `listVaults(owner)` | List owner's vaults | - |
| `getVaultBalance(address)` | Get SOL balance | - |
| `getVaultDepositAddress(address)` | Get deposit address | - |

#### Policy Management

| Method | Description | Signer |
|--------|-------------|--------|
| `updatePolicy(options)` | Update daily limit | Owner |
| `addToWhitelist(vault, nonce, address)` | Add to whitelist | Owner |
| `removeFromWhitelist(vault, nonce, address)` | Remove from whitelist | Owner |
| `pauseVault(vault, nonce)` | Pause all transactions | Owner |
| `resumeVault(vault, nonce)` | Resume transactions | Owner |
| `updateAgentSigner(vault, nonce, newSigner)` | Rotate agent key | Owner |

#### Transaction Execution

| Method | Description | Signer |
|--------|-------------|--------|
| `executeGuarded(options)` | Execute owner-signed tx | Owner |
| `executeAgent(options)` | Execute agent-signed tx | Agent |
| `requestOverride(options)` | Request manual approval | Owner |
| `approveOverride(vault, vaultNonce, overrideNonce)` | Approve override | Owner |
| `executeOverride(vault, vaultNonce)` | Execute approved override | Owner |

#### Guardian API

| Method | Description |
|--------|-------------|
| `getGuardianVault(address)` | Get vault from Guardian (includes metadata) |
| `getTransactionHistory(options)` | Get transaction history |
| `getAnalytics(vault, options)` | Get spending analytics |

## Error Handling

```typescript
import {
  AegisError,
  DailyLimitExceededError,
  NotWhitelistedError,
  VaultPausedError,
  InsufficientBalanceError,
  UnauthorizedSignerError,
  MissingWalletError,
  NetworkError,
  TransactionTimeoutError,
} from '@aegis-vaults/sdk';

try {
  await client.executeAgent({...});
} catch (error) {
  if (error instanceof DailyLimitExceededError) {
    // Transaction exceeded daily limit
    // error.overrideRequested = true if Guardian was notified
    // error.blinkUrl = URL for owner to approve
  } else if (error instanceof NotWhitelistedError) {
    // Destination not in whitelist
    // Ask vault owner to whitelist the address
  } else if (error instanceof VaultPausedError) {
    // Vault is paused
    // Owner needs to resume the vault
  } else if (error instanceof InsufficientBalanceError) {
    // Not enough SOL in vault
    // Need to fund the deposit address
  } else if (error instanceof UnauthorizedSignerError) {
    // Wrong keypair used
    // Must use the authorized agent_signer
  }
}
```

## Utilities

### Amount Conversions

```typescript
import { solToLamports, lamportsToSol, formatLamports } from '@aegis-vaults/sdk';

const lamports = solToLamports(1.5);       // BN(1500000000)
const sol = lamportsToSol(lamports);        // 1.5
const formatted = formatLamports(lamports); // "1.5000 SOL"
```

### PDA Derivation

```typescript
import {
  deriveVaultPda,
  deriveVaultAuthorityPda,
  deriveOverridePda,
  deriveFeeTreasuryPda,
  generateVaultNonce,
} from '@aegis-vaults/sdk';

// Generate unique nonce for new vault
const nonce = generateVaultNonce();

// Derive vault PDA
const [vaultPda, bump] = deriveVaultPda(ownerPubkey, programId, nonce);

// Derive deposit address (vault authority)
const [depositAddress] = deriveVaultAuthorityPda(vaultPda, programId);
```

## Testing

### Environment Setup

```bash
# Set environment variables
export VAULT_ADDRESS="your-vault-address"
export VAULT_NONCE="your-vault-nonce"
export AGENT_SECRET='[1,2,3,...]'  # JSON array of secret key bytes
export DESTINATION="recipient-address"
```

### Run Test Scenarios

```bash
# Valid transaction (within limits)
AMOUNT=0.01 TEST_TYPE=valid npx tsx examples/test-scenario.ts

# Exceed daily limit (triggers override flow)
AMOUNT=1.0 TEST_TYPE=exceed_limit npx tsx examples/test-scenario.ts
```

### Unit Tests

```bash
npm test
```

## Architecture

```
@aegis-vaults/sdk
├── src/
│   ├── client/           # AegisClient main class
│   ├── agents/           # AI framework integrations
│   │   ├── openai.ts     # OpenAI function calling
│   │   ├── langchain.ts  # LangChain tools
│   │   └── anthropic.ts  # Anthropic Claude
│   ├── guardian/         # Guardian API client
│   ├── types/            # TypeScript types
│   ├── errors/           # Typed error classes
│   └── utils/            # Utilities (PDA, amounts, retry)
├── examples/             # Usage examples
└── tests/                # Test suite
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VAULT_ADDRESS` | Your vault PDA address | Yes |
| `VAULT_NONCE` | Nonce from vault creation | Yes |
| `AGENT_SECRET_KEY` | Agent keypair (JSON array) | Yes |
| `GUARDIAN_URL` | Guardian API URL | No (defaults to production) |

## Important Notes

1. **Deposit Address**: Always send SOL to the **deposit address** (vault authority PDA), not the vault address itself.

2. **Agent Keypair Security**: Keep your agent's secret key secure. Use environment variables or secret management services.

3. **Vault Nonce**: Save the nonce from vault creation. It's required for all agent transactions.

4. **Daily Limit Resets**: Limits reset 24 hours after the first transaction of the day.

5. **Devnet vs Mainnet**: Override Blinks may show "timeout" on devnet due to slow confirmation. The transaction usually succeeds - check your vault balance.

## Documentation

For comprehensive guides, tutorials, and API documentation, visit:

- **Documentation Site**: https://docs.aegis-vaults.xyz
- **GitHub Docs**: https://github.com/aegis-vaults/aegis-docs

## Support & Community

- **Issues**: https://github.com/aegis-vaults/aegis-sdk/issues
- **Discord**: [Join our community](https://discord.gg/aegis-vaults)
- **Twitter**: [@aegis_vaults](https://twitter.com/aegis_vaults)

## License

MIT License

---

Made with ❤️ by the Aegis team

**Guardian API**: https://aegis-guardian-production.up.railway.app
**Program ID (Devnet)**: `ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ`
