/**
 * SDK configuration and options types
 * @module types/config
 */

import type { Connection, Commitment, ConfirmOptions } from '@solana/web3.js';

/**
 * Solana cluster type
 */
export type Cluster = 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet';

/**
 * Configuration for the AegisClient
 */
export interface AegisConfig {
  /**
   * Solana cluster to connect to
   * @default 'devnet'
   */
  cluster?: Cluster;

  /**
   * Custom Solana connection instance
   * If provided, this takes precedence over cluster
   */
  connection?: Connection;

  /**
   * Aegis Protocol program ID
   * @default 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ' (devnet)
   */
  programId?: string;

  /**
   * Guardian API base URL
   * @default 'http://localhost:3000'
   */
  guardianApiUrl?: string;

  /**
   * Guardian WebSocket URL for real-time updates
   * @default 'ws://localhost:3000'
   */
  guardianWsUrl?: string;

  /**
   * Commitment level for Solana transactions
   * @default 'confirmed'
   */
  commitment?: Commitment;

  /**
   * Transaction confirmation timeout in milliseconds
   * @default 60000 (60 seconds)
   */
  confirmTimeout?: number;

  /**
   * Enable automatic retry on transient failures
   * @default true
   */
  autoRetry?: boolean;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Exponential backoff base delay in milliseconds
   * @default 1000
   */
  retryDelay?: number;
}

/**
 * Options for transaction execution
 */
export interface TransactionOptions {
  /**
   * Commitment level for this specific transaction
   * Overrides default from config
   */
  commitment?: Commitment;

  /**
   * Transaction confirmation timeout in milliseconds
   * Overrides default from config
   */
  confirmTimeout?: number;

  /**
   * Skip preflight simulation
   * @default false
   */
  skipPreflight?: boolean;

  /**
   * Enable automatic retry for this transaction
   * Overrides default from config
   */
  autoRetry?: boolean;

  /**
   * Maximum retries for this transaction
   * Overrides default from config
   */
  maxRetries?: number;
}

/**
 * Options for creating a vault
 */
export interface CreateVaultOptions {
  /**
   * Human-readable name for the vault (max 50 UTF-8 bytes)
   */
  name: string;

  /**
   * AI agent public key authorized to propose transactions
   */
  agentSigner: string;

  /**
   * Maximum amount that can be spent per day (in lamports)
   */
  dailyLimit: number | bigint;

  /**
   * Transaction execution options
   */
  transactionOptions?: TransactionOptions;
}

/**
 * Options for executing a guarded transaction
 */
export interface ExecuteGuardedOptions {
  /**
   * Vault address
   */
  vault: string;

  /**
   * Destination address
   */
  destination: string;

  /**
   * Amount to transfer (in lamports)
   */
  amount: number | bigint;

  /**
   * Optional purpose/memo for the transaction
   */
  purpose?: string;

  /**
   * Transaction execution options
   */
  transactionOptions?: TransactionOptions;
}

/**
 * Options for requesting an override
 */
export interface RequestOverrideOptions {
  /**
   * Vault address
   */
  vault: string;

  /**
   * Destination address
   */
  destination: string;

  /**
   * Amount to transfer (in lamports)
   */
  amount: number | bigint;

  /**
   * Reason for requesting the override
   */
  reason: string;

  /**
   * Transaction execution options
   */
  transactionOptions?: TransactionOptions;
}

/**
 * Options for updating vault policy
 */
export interface UpdatePolicyOptions {
  /**
   * Vault address
   */
  vault: string;

  /**
   * New daily limit (in lamports)
   */
  dailyLimit?: number | bigint;

  /**
   * Transaction execution options
   */
  transactionOptions?: TransactionOptions;
}

/**
 * Options for subscribing to vault events
 */
export interface SubscriptionOptions {
  /**
   * Commitment level for event subscription
   * @default 'confirmed'
   */
  commitment?: Commitment;

  /**
   * Automatically reconnect on disconnect
   * @default true
   */
  autoReconnect?: boolean;

  /**
   * Reconnection delay in milliseconds
   * @default 5000
   */
  reconnectDelay?: number;
}

/**
 * Options for querying transaction history
 */
export interface TransactionHistoryOptions {
  /**
   * Vault address to filter by
   */
  vault?: string;

  /**
   * Transaction status filter
   */
  status?: 'PENDING' | 'EXECUTED' | 'BLOCKED' | 'FAILED';

  /**
   * Start date for time range filter
   */
  startDate?: Date;

  /**
   * End date for time range filter
   */
  endDate?: Date;

  /**
   * Page number (1-indexed)
   * @default 1
   */
  page?: number;

  /**
   * Number of items per page
   * @default 20
   */
  limit?: number;

  /**
   * Sort by field
   * @default 'createdAt'
   */
  sortBy?: string;

  /**
   * Sort direction
   * @default 'desc'
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Options for fetching spending analytics
 */
export interface AnalyticsOptions {
  /**
   * Time frame for analytics
   * @default '30d'
   */
  timeframe?: '24h' | '7d' | '30d' | '90d' | 'all';

  /**
   * Group by period
   * @default 'day'
   */
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}
