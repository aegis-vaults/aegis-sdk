/**
 * Guardian API types for off-chain data and analytics
 * @module types/guardian
 */

/**
 * Transaction status from Guardian database
 */
export enum TransactionStatus {
  Pending = 'PENDING',
  Executed = 'EXECUTED',
  Blocked = 'BLOCKED',
  Failed = 'FAILED',
}

/**
 * Override status from Guardian database
 */
export enum OverrideStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Executed = 'EXECUTED',
  Cancelled = 'CANCELLED',
  Expired = 'EXPIRED',
}

/**
 * Webhook event types that Guardian can send
 */
export enum WebhookEvent {
  TransactionBlocked = 'TRANSACTION_BLOCKED',
  TransactionExecuted = 'TRANSACTION_EXECUTED',
  OverrideRequested = 'OVERRIDE_REQUESTED',
  OverrideApproved = 'OVERRIDE_APPROVED',
  OverrideExecuted = 'OVERRIDE_EXECUTED',
  VaultCreated = 'VAULT_CREATED',
  VaultUpdated = 'VAULT_UPDATED',
  PolicyUpdated = 'POLICY_UPDATED',
}

/**
 * Vault data from Guardian API (includes off-chain metadata)
 */
export interface GuardianVault {
  /** Database ID */
  id: string;

  /** On-chain PDA address */
  publicKey: string;

  /** Owner wallet address */
  owner: string;

  /** Guardian wallet address */
  guardian: string;

  /** User-friendly vault name */
  name?: string;

  /** Policy configuration */
  dailyLimit: string;
  dailySpent: string;
  lastResetTime: string;
  whitelistEnabled: boolean;
  whitelist: string[];

  /** Override configuration */
  overrideDelay: number;
  pendingOverride: boolean;

  /** Status */
  isActive: boolean;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * Transaction data from Guardian API
 */
export interface GuardianTransaction {
  /** Database ID */
  id: string;

  /** Transaction signature */
  signature: string;

  /** Vault ID */
  vaultId: string;

  /** Transaction details */
  from: string;
  to: string;
  amount: string;
  instruction?: string;

  /** Status */
  status: TransactionStatus;
  blockReason?: string;
  executedAt?: string;
  blockedAt?: string;

  /** Blockchain data */
  slot?: string;
  blockTime?: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * Override request data from Guardian API
 */
export interface GuardianOverride {
  /** Database ID */
  id: string;

  /** Vault ID */
  vaultId: string;

  /** Override details */
  transactionId: string;
  nonce: string;
  requestedBy: string;
  requestedAmount?: string;
  destination?: string;
  blinkUrl?: string;

  /** Execution window */
  canExecuteAfter: string;
  expiresAt: string;

  /** Status */
  status: OverrideStatus;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  cancelledAt?: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/**
 * Analytics data for a vault
 */
export interface VaultAnalytics {
  /** Total volume across all transactions (in lamports) */
  totalVolume: string;

  /** Total number of transactions */
  transactionCount: number;

  /** Number of blocked transactions */
  blockedCount: number;

  /** Number of override requests */
  overrideCount: number;

  /** Top destination addresses by volume */
  topDestinations: Array<{
    address: string;
    volume: string;
    count: number;
  }>;

  /** Spending trend over time */
  spendingTrend: Array<{
    date: string;
    volume: string;
    count: number;
  }>;

  /** Current daily usage */
  dailyUsage: string;

  /** Remaining daily limit */
  remainingLimit: string;
}

/**
 * Global analytics across all vaults
 */
export interface GlobalAnalytics {
  /** Total number of vaults */
  totalVaults: number;

  /** Active vaults (not paused) */
  activeVaults: number;

  /** Total volume across all vaults */
  totalVolume: string;

  /** Total transactions */
  totalTransactions: number;

  /** Total fees collected */
  totalFeesCollected: string;

  /** Transactions by status */
  transactionsByStatus: {
    executed: number;
    blocked: number;
    pending: number;
    failed: number;
  };
}

/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;

  /** Number of items per page */
  limit?: number;

  /** Sort field */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Items in this page */
  data: T[];

  /** Pagination metadata */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
