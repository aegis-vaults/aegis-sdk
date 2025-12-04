/**
 * Program-level types derived from the Aegis Core IDL
 * @module types/program
 */

import type { PublicKey } from '@solana/web3.js';
import type BN from 'bn.js';

/**
 * Vault tier determining available features and limits
 */
export enum VaultTier {
  Personal = 0,
  Team = 1,
  Enterprise = 2,
}

/**
 * Reasons why a transaction can be blocked by vault policy
 */
export enum BlockReason {
  NotWhitelisted = 0,
  ExceededDailyLimit = 1,
  InsufficientFunds = 2,
}

/**
 * Override type indicating why manual approval is needed
 */
export enum OverrideType {
  ExceededLimit = 0,
  Emergency = 1,
}

/**
 * Main vault configuration account structure
 *
 * This mirrors the on-chain VaultConfig account and stores all
 * configuration and state for a user's vault.
 */
export interface VaultConfig {
  /** Authority that controls this vault (owner) */
  authority: PublicKey;

  /** AI agent signer that can propose transactions */
  agentSigner: PublicKey;

  /** Maximum amount that can be spent per day (in lamports) */
  dailyLimit: BN;

  /** Amount spent in the current day period (in lamports) */
  spentToday: BN;

  /** Unix timestamp of when the current day period started */
  lastReset: BN;

  /** Fixed-size array of whitelisted destination addresses (max 20) */
  whitelist: PublicKey[];

  /** Number of active addresses in the whitelist */
  whitelistCount: number;

  /** Vault tier determining available features */
  tier: VaultTier;

  /** Protocol fee in basis points (e.g., 5 = 0.05%) */
  feeBasisPoints: number;

  /** Human-readable name for this vault (max 50 UTF-8 bytes) */
  name: string;

  /** Actual length of the name in bytes */
  nameLen: number;

  /** Whether the vault is paused (all transactions blocked) */
  paused: boolean;

  /** Nonce for generating unique override PDAs */
  overrideNonce: BN;

  /** Vault nonce (unique per user, allows multiple vaults) */
  vaultNonce: BN;

  /** PDA bump seed for verification */
  bump: number;
}

/**
 * Pending override request for a blocked transaction
 *
 * When a transaction is blocked by policy, a PendingOverride is created
 * to allow the vault authority to approve or reject the transaction manually.
 */
export interface PendingOverride {
  /** Vault this override belongs to */
  vault: PublicKey;

  /** Unique nonce for this override (from vault.override_nonce) */
  nonce: BN;

  /** Hash of the blocked instruction for verification (32 bytes) */
  instructionHash: Uint8Array;

  /** Amount of the blocked transaction (in lamports) */
  requestedAmount: BN;

  /** Destination address of the blocked transaction */
  destination: PublicKey;

  /** Unix timestamp when this override expires */
  expiresAt: BN;

  /** Whether this override has been executed */
  executed: boolean;

  /** Type of override (exceeded limit or emergency) */
  overrideType: OverrideType;

  /** PDA bump seed for verification */
  bump: number;
}

/**
 * Fee treasury account for collecting protocol fees
 *
 * This is a singleton account that collects all protocol fees.
 */
export interface FeeTreasury {
  /** Authority that can withdraw from the treasury (protocol owner) */
  authority: PublicKey;

  /** Total fees collected lifetime (in lamports) */
  totalCollected: BN;

  /** PDA bump seed for verification */
  bump: number;
}
