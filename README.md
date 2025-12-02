# @aegis-vaults/sdk

> TypeScript SDK for Aegis Protocol - On-chain operating system for AI finance on Solana

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-9945FF)](https://solana.com/)

## Overview

Aegis SDK provides a production-ready TypeScript client for interacting with the Aegis Protocol on Solana. Give AI agents controlled access to on-chain funds through smart vaults with policy-based guards, spending limits, whitelists, and human-in-the-loop overrides.

### Features

- **Smart Vault Management**: Create and configure vaults with daily spending limits and whitelist controls
- **Policy-Based Guards**: Automatic transaction validation against vault policies
- **AI Agent Integration**: Optional adapters for OpenAI, LangChain, and Anthropic Claude
- **Override System**: Human-in-the-loop approval workflow for blocked transactions
- **Real-Time Events**: Subscribe to vault events via WebSocket
- **Guardian API**: Query transaction history and analytics
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Typed error classes with remediation hints
- **Dual Build**: ESM and CommonJS support for Node.js and browser

## Installation

```bash
npm install @aegis-vaults/sdk @solana/web3.js @coral-xyz/anchor
```

or with yarn:

```bash
yarn add @aegis-vaults/sdk @solana/web3.js @coral-xyz/anchor
```

## Quick Start

### 1. Initialize the Client

```typescript
import { AegisClient } from '@aegis-vaults/sdk';
import { Connection, Keypair } from '@solana/web3.js';

// Connect to Solana devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Create client
const client = new AegisClient({
  connection,
  programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
  guardianApiUrl: 'http://localhost:3000',
});

// Set wallet for signing transactions
const wallet = Keypair.generate();
client.setWallet(wallet);
```

### 2. Create a Vault

```typescript
// Create a new vault with daily spending limit
const vault = await client.createVault({
  name: 'My AI Treasury',
  agentSigner: agentPublicKey.toBase58(),
  dailyLimit: 1000000000, // 1 SOL per day
});

console.log('Vault created:', vault.vaultAddress);
console.log('Transaction:', vault.signature);
```

### 3. Execute Guarded Transactions

```typescript
import { DailyLimitExceededError } from '@aegis-vaults/sdk';

try {
  // Execute a transaction (checked against vault policy)
  const signature = await client.executeGuarded({
    vault: vault.vaultAddress,
    destination: recipientAddress.toBase58(),
    amount: 500000000, // 0.5 SOL
    purpose: 'Payment for services',
  });

  console.log('Transaction executed:', signature);
} catch (error) {
  if (error instanceof DailyLimitExceededError) {
    console.log('Daily limit exceeded!', error.context);

    // Request override approval
    const override = await client.requestOverride({
      vault: vault.vaultAddress,
      destination: recipientAddress.toBase58(),
      amount: 500000000,
      reason: 'Emergency payment',
    });

    console.log('Override requested. Approve at:', override.blinkUrl);
  }
}
```

### 4. Query Vault Data

```typescript
// Get vault configuration
const vaultData = await client.getVault(vault.vaultAddress);

console.log('Daily limit:', vaultData.dailyLimit.toString());
console.log('Spent today:', vaultData.spentToday.toString());
console.log('Whitelist:', vaultData.whitelist);

// Get transaction history
const history = await client.getTransactionHistory({
  vault: vault.vaultAddress,
  status: 'EXECUTED',
  limit: 20,
});

console.log(`Found ${history.data.length} transactions`);
```

### 5. Subscribe to Real-Time Events

```typescript
// Subscribe to vault events
const unsubscribe = await client.subscribeToVault(
  vault.vaultAddress,
  (event) => {
    console.log('Event received:', event);

    if (event.type === 'TransactionExecuted') {
      console.log('Amount:', event.data.amount);
      console.log('Destination:', event.data.destination);
    }

    if (event.type === 'TransactionBlocked') {
      console.log('Reason:', event.data.reason);
      console.log('Override nonce:', event.data.overrideNonce);
    }
  },
  { autoReconnect: true }
);

// Later: unsubscribe()
```

## Utilities

### Amount Conversions

```typescript
import { solToLamports, lamportsToSol, formatLamports } from '@aegis-vaults/sdk';

const lamports = solToLamports(1.5); // BN(1500000000)
const sol = lamportsToSol(lamports); // 1.5
const formatted = formatLamports(lamports); // "1.5000 SOL"
```

### PDA Derivation

```typescript
import { deriveVaultPda, deriveVaultAuthorityPda } from '@aegis-vaults/sdk';

const [vaultPda, bump] = deriveVaultPda(ownerPubkey, programId);
const [vaultAuthPda, authBump] = deriveVaultAuthorityPda(vaultPda, programId);
```

### Retry Logic

```typescript
import { withRetry, isRetryableError } from '@aegis-vaults/sdk';

const result = await withRetry(
  async () => connection.getAccountInfo(address),
  {
    maxRetries: 3,
    initialDelay: 1000,
    shouldRetry: isRetryableError,
  }
);
```

## Error Handling

The SDK provides typed error classes with remediation hints:

```typescript
import {
  DailyLimitExceededError,
  NotWhitelistedError,
  NetworkError,
} from '@aegis-vaults/sdk';

try {
  await client.executeGuarded({...});
} catch (error) {
  if (error instanceof DailyLimitExceededError) {
    console.error('Daily limit exceeded:', error.message);
    console.log('Hint:', error.hint);

    // Request override
    await client.requestOverride({...});
  } else if (error instanceof NotWhitelistedError) {
    // Add to whitelist
    await client.addToWhitelist(vaultAddress, destinationAddress);
  }
}
```

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Type Check

```bash
npm run type-check
```

## Architecture

### Module Structure

```
@aegis-vaults/sdk
├── client/          # Main AegisClient class
├── types/           # TypeScript type definitions
│   ├── program.ts   # On-chain account types
│   ├── events.ts    # Event types
│   ├── guardian.ts  # Guardian API types
│   └── config.ts    # Configuration types
├── errors/          # Typed error classes
├── utils/           # Utility functions
│   ├── pda.ts       # PDA derivation
│   ├── amounts.ts   # Amount conversions
│   ├── retry.ts     # Retry logic
│   ├── polling.ts   # Polling utilities
│   └── validation.ts # Input validation
└── agents/          # AI framework adapters (optional)
```

## License

MIT License

## Support

- **Documentation**: Full API docs coming soon
- **Issues**: [GitHub Issues](https://github.com/aegis/aegis-sdk/issues)

## Roadmap

- [x] Core vault management
- [x] Transaction execution with policy guards
- [x] Override request system
- [x] Guardian API integration
- [x] Real-time event subscriptions
- [ ] Complete implementation of all stub methods
- [ ] AI agent adapters (OpenAI, LangChain, Anthropic)
- [ ] Advanced analytics and reporting
- [ ] Multi-signature vault support
- [ ] Token vault support (SPL tokens)

---

Made with ❤️ by the Aegis team
