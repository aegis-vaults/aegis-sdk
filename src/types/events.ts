/**
 * Event types emitted by the Aegis Protocol
 * @module types/events
 */

import type { PublicKey } from '@solana/web3.js';
import type BN from 'bn.js';
import type { BlockReason, VaultTier } from './program.js';

/**
 * Emitted when a new vault is created and initialized
 */
export interface VaultCreatedEvent {
  /** Public key of the vault PDA */
  vault: PublicKey;

  /** Public key of the vault authority (human owner) */
  authority: PublicKey;

  /** Vault tier (0 = Personal, 1 = Team, 2 = Enterprise) */
  tier: VaultTier;

  /** Daily spending limit in lamports */
  dailyLimit: BN;
}

/**
 * Emitted when a vault is initialized (legacy compatibility)
 */
export interface VaultInitializedEvent {
  /** Public key of the vault PDA */
  vault: PublicKey;

  /** Public key of the vault authority (human owner) */
  authority: PublicKey;

  /** Daily spending limit in lamports */
  dailyLimit: BN;

  /** Unix timestamp of initialization */
  timestamp: BN;
}

/**
 * Emitted when a guarded transaction is successfully executed
 */
export interface TransactionExecutedEvent {
  /** Public key of the vault that executed the transaction */
  vault: PublicKey;

  /** Amount transferred in lamports (before fees) */
  amount: BN;

  /** Destination address that received the funds */
  destination: PublicKey;

  /** Protocol fee collected in lamports (0.05% = 5 basis points) */
  feeCollected: BN;

  /** Vault balance after transaction and fee deduction */
  newBalance: BN;

  /** Cumulative amount spent today after this transaction */
  spentToday: BN;
}

/**
 * Emitted when a transaction is blocked by vault policy
 */
export interface TransactionBlockedEvent {
  /** Public key of the vault that blocked the transaction */
  vault: PublicKey;

  /** Reason code for why the transaction was blocked */
  reason: BlockReason;

  /** Amount that was attempted to be transferred */
  amount: BN;

  /** Destination address that was blocked */
  destination: PublicKey;

  /** Optional override nonce for creating approval Blink (None if InsufficientFunds) */
  overrideNonce?: BN;
}

/**
 * Emitted when a pending override is created for a blocked transaction
 */
export interface OverrideCreatedEvent {
  /** Public key of the vault */
  vault: PublicKey;

  /** Unique nonce for this override request */
  nonce: BN;

  /** Amount of the blocked transaction */
  amount: BN;

  /** Destination address of the blocked transaction */
  destination: PublicKey;

  /** Unix timestamp when this override expires (default: 1 hour) */
  expiresAt: BN;
}

/**
 * Emitted when a vault authority approves a pending override
 */
export interface OverrideApprovedEvent {
  /** Public key of the vault */
  vault: PublicKey;

  /** Nonce of the override that was approved */
  nonce: BN;

  /** Unix timestamp of approval */
  timestamp: BN;
}

/**
 * Emitted when vault policy is updated (daily limit or whitelist changes)
 */
export interface PolicyUpdatedEvent {
  /** Public key of the vault */
  vault: PublicKey;

  /** Current daily spending limit in lamports */
  dailyLimit: BN;

  /** Current number of addresses in the whitelist */
  whitelistSize: number;
}

/**
 * Emitted when whitelist is modified
 */
export interface WhitelistUpdatedEvent {
  /** Public key of the vault */
  vault: PublicKey;

  /** Address that was added or removed */
  address: PublicKey;

  /** True if address was added, false if removed */
  added: boolean;

  /** Unix timestamp of the change */
  timestamp: BN;
}

/**
 * Emitted when a vault is paused by the authority
 */
export interface VaultPausedEvent {
  /** Public key of the vault that was paused */
  vault: PublicKey;
}

/**
 * Emitted when a paused vault is resumed by the authority
 */
export interface VaultResumedEvent {
  /** Public key of the vault that was resumed */
  vault: PublicKey;
}

/**
 * Emitted when the agent signer is updated
 */
export interface AgentSignerUpdatedEvent {
  /** Public key of the vault */
  vault: PublicKey;

  /** Old agent signer pubkey */
  oldSigner: PublicKey;

  /** New agent signer pubkey */
  newSigner: PublicKey;

  /** Unix timestamp of update */
  timestamp: BN;
}

/**
 * Emitted when the fee treasury is initialized
 */
export interface FeeTreasuryInitializedEvent {
  /** Public key of the fee treasury PDA */
  treasury: PublicKey;

  /** Public key of the treasury authority (protocol owner) */
  authority: PublicKey;

  /** Unix timestamp of initialization */
  timestamp: BN;
}

/**
 * Emitted when fees are withdrawn from the treasury
 */
export interface FeesWithdrawnEvent {
  /** Public key of the fee treasury */
  treasury: PublicKey;

  /** Amount withdrawn in lamports */
  amount: BN;

  /** Recipient of the withdrawn fees */
  recipient: PublicKey;

  /** Remaining balance in treasury after withdrawal */
  remainingBalance: BN;

  /** Unix timestamp of withdrawal */
  timestamp: BN;
}

/**
 * Union type of all possible events
 */
export type AegisEvent =
  | VaultCreatedEvent
  | VaultInitializedEvent
  | TransactionExecutedEvent
  | TransactionBlockedEvent
  | OverrideCreatedEvent
  | OverrideApprovedEvent
  | PolicyUpdatedEvent
  | WhitelistUpdatedEvent
  | VaultPausedEvent
  | VaultResumedEvent
  | AgentSignerUpdatedEvent
  | FeeTreasuryInitializedEvent
  | FeesWithdrawnEvent;

/**
 * Event discriminators for parsing
 */
export enum EventDiscriminator {
  VaultCreated = 'VaultCreated',
  VaultInitialized = 'VaultInitialized',
  TransactionExecuted = 'TransactionExecuted',
  TransactionBlocked = 'TransactionBlocked',
  OverrideCreated = 'OverrideCreated',
  OverrideApproved = 'OverrideApproved',
  PolicyUpdated = 'PolicyUpdated',
  WhitelistUpdated = 'WhitelistUpdated',
  VaultPaused = 'VaultPaused',
  VaultResumed = 'VaultResumed',
  AgentSignerUpdated = 'AgentSignerUpdated',
  FeeTreasuryInitialized = 'FeeTreasuryInitialized',
  FeesWithdrawn = 'FeesWithdrawn',
}
