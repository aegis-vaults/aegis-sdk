/**
 * Input validation utilities
 * @module utils/validation
 */

import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import {
  InvalidAddressError,
  InvalidAmountError,
  InvalidDailyLimitError,
} from '../errors/index.js';

/**
 * Validates a Solana public key address
 *
 * @param address - Address string to validate
 * @param fieldName - Name of the field for error messages
 * @returns Valid PublicKey instance
 * @throws InvalidAddressError if the address is invalid
 *
 * @example
 * ```typescript
 * const pubkey = validateAddress('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ', 'vault');
 * ```
 */
export function validateAddress(address: string, fieldName: string = 'address'): PublicKey {
  try {
    return new PublicKey(address);
  } catch (error) {
    throw new InvalidAddressError(
      `Invalid ${fieldName}: ${address}`,
      {
        context: { address, fieldName },
        cause: error instanceof Error ? error : undefined,
      }
    );
  }
}

/**
 * Validates a transaction amount
 *
 * @param amount - Amount to validate (number, bigint, or BN)
 * @param fieldName - Name of the field for error messages
 * @param min - Minimum allowed amount (default: 1)
 * @returns Valid BN instance
 * @throws InvalidAmountError if the amount is invalid
 *
 * @example
 * ```typescript
 * const amountBN = validateAmount(1000000, 'transaction amount');
 * ```
 */
export function validateAmount(
  amount: number | bigint | BN,
  fieldName: string = 'amount',
  min: BN = new BN(1)
): BN {
  let amountBN: BN;

  try {
    if (amount instanceof BN) {
      amountBN = amount;
    } else {
      amountBN = new BN(amount.toString());
    }
  } catch (error) {
    throw new InvalidAmountError(
      `Invalid ${fieldName}: ${amount}`,
      {
        context: { amount, fieldName },
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  if (amountBN.lt(min)) {
    throw new InvalidAmountError(
      `${fieldName} must be at least ${min.toString()} lamports`,
      {
        context: { amount: amountBN.toString(), min: min.toString(), fieldName },
      }
    );
  }

  if (amountBN.isNeg()) {
    throw new InvalidAmountError(
      `${fieldName} cannot be negative`,
      {
        context: { amount: amountBN.toString(), fieldName },
      }
    );
  }

  return amountBN;
}

/**
 * Validates a daily limit
 *
 * @param limit - Daily limit to validate (number, bigint, or BN)
 * @returns Valid BN instance
 * @throws InvalidDailyLimitError if the limit is invalid
 *
 * @example
 * ```typescript
 * const limitBN = validateDailyLimit(1000000000); // 1 SOL
 * ```
 */
export function validateDailyLimit(limit: number | bigint | BN): BN {
  let limitBN: BN;

  try {
    if (limit instanceof BN) {
      limitBN = limit;
    } else {
      limitBN = new BN(limit.toString());
    }
  } catch (error) {
    throw new InvalidDailyLimitError(
      `Invalid daily limit: ${limit}`,
      {
        context: { limit },
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  if (limitBN.lte(new BN(0))) {
    throw new InvalidDailyLimitError(
      'Daily limit must be greater than zero',
      {
        context: { limit: limitBN.toString() },
      }
    );
  }

  return limitBN;
}

/**
 * Validates a vault name
 *
 * @param name - Vault name to validate
 * @returns Valid vault name
 * @throws ValidationError if the name is invalid
 *
 * @example
 * ```typescript
 * const validName = validateVaultName('My Treasury Vault');
 * ```
 */
export function validateVaultName(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error('Vault name cannot be empty');
  }

  const trimmed = name.trim();

  // Check UTF-8 byte length (max 50 bytes)
  const byteLength = new TextEncoder().encode(trimmed).length;
  if (byteLength > 50) {
    throw new Error(
      `Vault name is too long (${byteLength} bytes, max 50 bytes)`
    );
  }

  return trimmed;
}

/**
 * Checks if a string is a valid Solana address without throwing
 *
 * @param address - Address string to check
 * @returns True if valid, false otherwise
 *
 * @example
 * ```typescript
 * if (isValidAddress('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ')) {
 *   // Process address
 * }
 * ```
 */
export function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}
