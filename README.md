# @aegis-vaults/sdk

> TypeScript SDK for Aegis Protocol - On-chain operating system for AI finance on Solana

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-9945FF)](https://solana.com/)

## Overview

Aegis SDK provides a production-ready TypeScript client for interacting with the Aegis Protocol on Solana. Give AI agents controlled access to on-chain funds through smart vaults with policy-based guards, spending limits, whitelists, and human-in-the-loop overrides.

### Features

- **Unlimited Vaults**: Create as many vaults as you need per wallet
- **Smart Vault Management**: Configure vaults with daily spending limits and whitelist controls
- **Policy-Based Guards**: Automatic transaction validation against vault policies
- **AI Agent Integration**: Easy integration with OpenAI, LangChain, and Anthropic Claude
- **Override System**: Human-in-the-loop approval workflow for blocked transactions
- **Real-Time Events**: Subscribe to vault events via WebSocket
- **Guardian API**: Query transaction history and analytics
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Typed error classes with remediation hints

## Installation

```bash
npm install @aegis-vaults/sdk @solana/web3.js @coral-xyz/anchor bn.js
```

## Quick Start

### 1. Initialize the Client

```typescript
import { AegisClient } from '@aegis-vaults/sdk';
import { Keypair } from '@solana/web3.js';

// Create client (connects to devnet by default)
const client = new AegisClient({
  cluster: 'devnet',
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
});

// Load your agent's keypair
const agentKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.AGENT_SECRET_KEY!))
);

// Set wallet for signing transactions
client.setWallet(agentKeypair);
```

### 2. Create a Vault

Users can create **unlimited vaults**. Each vault has a unique deposit address.

```typescript
const result = await client.createVault({
  name: 'My AI Agent Vault',
  agentSigner: agentKeypair.publicKey.toBase58(),
  dailyLimit: 1_000_000_000, // 1 SOL per day (in lamports)
});

console.log('Vault Address:', result.vaultAddress);
console.log('Deposit Address:', result.depositAddress);
console.log('Nonce:', result.nonce);
console.log('Transaction:', result.signature);

// IMPORTANT: Send SOL to the DEPOSIT ADDRESS to fund your vault
console.log(`\n⚠️  Send SOL to: ${result.depositAddress}`);
console.log('Do NOT send to the vault address directly!');
```

### 3. Fund Your Vault

**IMPORTANT**: Send SOL to the **deposit address**, not the vault address!

```typescript
// Get the deposit address for an existing vault
const depositAddress = client.getVaultDepositAddress(vaultAddress);
console.log('Send SOL to:', depositAddress);

// Check vault balance
const balance = await client.getVaultBalance(vaultAddress);
console.log('Vault balance:', balance / 1e9, 'SOL');
```

### 4. Execute Guarded Transactions

```typescript
import { DailyLimitExceededError, NotWhitelistedError } from '@aegis-vaults/sdk';

try {
  const signature = await client.executeGuarded({
    vault: vaultAddress,
    destination: recipientAddress,
    amount: 100_000_000, // 0.1 SOL
    purpose: 'Payment for AI services',
  });
  
  console.log('Transaction executed:', signature);
} catch (error) {
  if (error instanceof DailyLimitExceededError) {
    console.log('Daily limit exceeded! Requesting override...');
    
    const override = await client.requestOverride({
      vault: vaultAddress,
      destination: recipientAddress,
      amount: 100_000_000,
      reason: 'Emergency payment needed',
    });
    
    console.log('Override requested. Approve at:', override.blinkUrl);
  } else if (error instanceof NotWhitelistedError) {
    console.log('Destination not whitelisted. Adding...');
    await client.addToWhitelist(vaultAddress, recipientAddress);
  }
}
```

### 5. Manage Vault Policy

```typescript
// Update daily limit
await client.updatePolicy({
  vault: vaultAddress,
  dailyLimit: 2_000_000_000, // 2 SOL
});

// Add address to whitelist
await client.addToWhitelist(vaultAddress, trustedAddress);

// Remove from whitelist
await client.removeFromWhitelist(vaultAddress, oldAddress);

// Pause vault (emergency stop)
await client.pauseVault(vaultAddress);

// Resume vault
await client.resumeVault(vaultAddress);
```

### 6. Query Vault Data

```typescript
// Get vault configuration (on-chain)
const vault = await client.getVault(vaultAddress);
console.log('Daily limit:', vault.dailyLimit.toString());
console.log('Spent today:', vault.spentToday.toString());
console.log('Paused:', vault.paused);
console.log('Whitelist:', vault.whitelist);

// Get vault data from Guardian (includes off-chain metadata)
const guardianVault = await client.getGuardianVault(vaultAddress);
console.log('Name:', guardianVault.name);

// Get transaction history
const history = await client.getTransactionHistory({
  vault: vaultAddress,
  status: 'EXECUTED',
  limit: 20,
});
console.log(`Found ${history.data.length} transactions`);

// Get spending analytics
const analytics = await client.getAnalytics(vaultAddress, {
  timeframe: '30d',
  groupBy: 'day',
});
console.log('Total volume:', analytics.totalVolume);
```

## AI Agent Integration

### OpenAI Function Calling

```typescript
import OpenAI from 'openai';
import { AegisClient } from '@aegis-vaults/sdk';
import { Keypair } from '@solana/web3.js';

const openai = new OpenAI();
const client = new AegisClient({ cluster: 'devnet' });

// Load agent keypair
const agentKeypair = Keypair.fromSecretKey(/* your secret key */);
client.setWallet(agentKeypair);

// Define Aegis tool for OpenAI
const tools = [
  {
    type: 'function',
    function: {
      name: 'aegis_transfer',
      description: 'Transfer SOL from the AI agent vault to a destination address',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'Solana wallet address' },
          amount_sol: { type: 'number', description: 'Amount in SOL' },
          purpose: { type: 'string', description: 'Reason for transfer' },
        },
        required: ['destination', 'amount_sol'],
      },
    },
  },
];

// Handle tool calls
async function handleAegisTransfer(args: any) {
  try {
    const signature = await client.executeGuarded({
      vault: process.env.VAULT_ADDRESS!,
      destination: args.destination,
      amount: Math.floor(args.amount_sol * 1e9), // Convert to lamports
      purpose: args.purpose,
    });
    return { success: true, signature };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Use in conversation
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a financial assistant with access to an Aegis vault.' },
    { role: 'user', content: 'Send 0.1 SOL to 7xKX...' },
  ],
  tools,
});

if (response.choices[0].message.tool_calls) {
  for (const call of response.choices[0].message.tool_calls) {
    if (call.function.name === 'aegis_transfer') {
      const result = await handleAegisTransfer(JSON.parse(call.function.arguments));
      console.log('Transfer result:', result);
    }
  }
}
```

### LangChain Integration

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AegisClient } from '@aegis-vaults/sdk';

const client = new AegisClient({ cluster: 'devnet' });
client.setWallet(agentKeypair);

const aegisTransferTool = new DynamicStructuredTool({
  name: 'aegis_transfer',
  description: 'Transfer SOL via Aegis vault with policy enforcement',
  schema: z.object({
    destination: z.string().describe('Recipient Solana address'),
    amount_sol: z.number().describe('Amount to send in SOL'),
    purpose: z.string().optional().describe('Purpose of transfer'),
  }),
  func: async ({ destination, amount_sol, purpose }) => {
    try {
      const signature = await client.executeGuarded({
        vault: process.env.VAULT_ADDRESS!,
        destination,
        amount: Math.floor(amount_sol * 1e9),
        purpose,
      });
      return `Transfer successful. Signature: ${signature}`;
    } catch (error: any) {
      if (error.message.includes('Daily limit')) {
        return 'Transfer blocked: Daily limit exceeded. Override requested.';
      }
      return `Transfer failed: ${error.message}`;
    }
  },
});
```

## Utilities

### PDA Derivation

```typescript
import { 
  deriveVaultPda, 
  deriveVaultAuthorityPda,
  generateVaultNonce,
  getDepositAddress 
} from '@aegis-vaults/sdk';

// Derive vault PDA with nonce (for unlimited vaults)
const nonce = generateVaultNonce();
const [vaultPda, bump] = deriveVaultPda(ownerPubkey, programId, nonce);

// Get deposit address (where to send SOL)
const depositAddress = getDepositAddress(vaultPda, programId);
```

### Amount Conversions

```typescript
import { solToLamports, lamportsToSol, formatLamports } from '@aegis-vaults/sdk';

const lamports = solToLamports(1.5);      // BN(1500000000)
const sol = lamportsToSol(lamports);       // 1.5
const formatted = formatLamports(lamports); // "1.5000 SOL"
```

## Error Handling

The SDK provides typed error classes:

```typescript
import {
  DailyLimitExceededError,
  NotWhitelistedError,
  VaultPausedError,
  InsufficientBalanceError,
  UnauthorizedSignerError,
  NetworkError,
} from '@aegis-vaults/sdk';

try {
  await client.executeGuarded({...});
} catch (error) {
  if (error instanceof DailyLimitExceededError) {
    // Request override approval
    await client.requestOverride({...});
  } else if (error instanceof NotWhitelistedError) {
    // Add destination to whitelist
    await client.addToWhitelist(vault, destination);
  } else if (error instanceof VaultPausedError) {
    // Vault owner needs to resume
    console.log('Vault is paused');
  } else if (error instanceof InsufficientBalanceError) {
    // Need to fund the vault
    console.log('Send SOL to:', client.getVaultDepositAddress(vault));
  }
}
```

## Configuration

```typescript
const client = new AegisClient({
  // Solana cluster
  cluster: 'devnet',               // or 'mainnet-beta', 'testnet'
  
  // Or provide custom connection
  connection: myConnection,
  
  // Program ID (defaults to deployed devnet address)
  programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
  
  // Guardian API URL
  guardianApiUrl: 'https://aegis-guardian-production.up.railway.app',
  
  // Transaction settings
  commitment: 'confirmed',
  confirmTimeout: 60000,
  autoRetry: true,
  maxRetries: 3,
});
```

## Architecture

```
@aegis-vaults/sdk
├── client/          # Main AegisClient class
├── types/           # TypeScript type definitions
├── errors/          # Typed error classes
├── utils/           # Utilities (PDA, amounts, retry)
├── guardian/        # Guardian API client
└── agents/          # AI framework adapters
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Type check
npm run type-check
```

## Important Notes

1. **Deposit Address**: Always send funds to the **deposit address** (vault authority PDA), not the vault address itself.

2. **Unlimited Vaults**: Users can create unlimited vaults by using different nonces.

3. **Agent Signer**: The agent signer is the keypair your AI uses to sign transactions. Keep it secure!

4. **Daily Limits**: Limits are enforced on-chain. Use overrides for transactions exceeding limits.

## License

MIT License

---

Made with ❤️ by the Aegis team
