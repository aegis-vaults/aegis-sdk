/**
 * Amount conversion utilities for Solana lamports and SOL
 * @module utils/amounts
 */

import BN from 'bn.js';

/** Number of lamports in 1 SOL */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Converts SOL amount to lamports
 *
 * @param sol - Amount in SOL
 * @returns Amount in lamports as a BN
 *
 * @example
 * ```typescript
 * const lamports = solToLamports(1.5); // 1_500_000_000 lamports
 * ```
 */
export function solToLamports(sol: number): BN {
  return new BN(Math.floor(sol * LAMPORTS_PER_SOL));
}

/**
 * Converts lamports to SOL
 *
 * @param lamports - Amount in lamports (BN, number, or bigint)
 * @returns Amount in SOL
 *
 * @example
 * ```typescript
 * const sol = lamportsToSol(new BN(1_500_000_000)); // 1.5 SOL
 * ```
 */
export function lamportsToSol(lamports: BN | number | bigint): number {
  if (typeof lamports === 'number') {
    return lamports / LAMPORTS_PER_SOL;
  }
  if (typeof lamports === 'bigint') {
    return Number(lamports) / LAMPORTS_PER_SOL;
  }
  return lamports.toNumber() / LAMPORTS_PER_SOL;
}

/**
 * Formats lamports as a human-readable SOL string
 *
 * @param lamports - Amount in lamports (BN, number, or bigint)
 * @param decimals - Number of decimal places to show (default: 4)
 * @returns Formatted string with SOL suffix
 *
 * @example
 * ```typescript
 * const formatted = formatLamports(new BN(1_500_000_000)); // "1.5000 SOL"
 * const formatted2 = formatLamports(new BN(1_500_000_000), 2); // "1.50 SOL"
 * ```
 */
export function formatLamports(
  lamports: BN | number | bigint,
  decimals: number = 4
): string {
  const sol = lamportsToSol(lamports);
  return `${sol.toFixed(decimals)} SOL`;
}

/**
 * Parses a SOL string to lamports
 *
 * @param solString - String representation of SOL amount (e.g., "1.5" or "1.5 SOL")
 * @returns Amount in lamports as a BN
 * @throws Error if the string is not a valid number
 *
 * @example
 * ```typescript
 * const lamports = parseSolString("1.5"); // 1_500_000_000 lamports
 * const lamports2 = parseSolString("1.5 SOL"); // 1_500_000_000 lamports
 * ```
 */
export function parseSolString(solString: string): BN {
  const cleaned = solString.trim().replace(/ SOL$/i, '');
  const sol = parseFloat(cleaned);

  if (isNaN(sol)) {
    throw new Error(`Invalid SOL amount: ${solString}`);
  }

  return solToLamports(sol);
}

/**
 * Calculates the protocol fee for a given amount
 *
 * @param amount - Transaction amount in lamports
 * @param feeBasisPoints - Fee in basis points (e.g., 5 = 0.05%)
 * @returns Fee amount in lamports
 *
 * @example
 * ```typescript
 * const fee = calculateFee(new BN(1_000_000_000), 5); // 500_000 lamports (0.05%)
 * ```
 */
export function calculateFee(amount: BN, feeBasisPoints: number): BN {
  return amount.mul(new BN(feeBasisPoints)).div(new BN(10000));
}

/**
 * Calculates the net amount after deducting the protocol fee
 *
 * @param amount - Gross transaction amount in lamports
 * @param feeBasisPoints - Fee in basis points (e.g., 5 = 0.05%)
 * @returns Net amount in lamports after fee deduction
 *
 * @example
 * ```typescript
 * const netAmount = calculateNetAmount(new BN(1_000_000_000), 5);
 * // 999_500_000 lamports
 * ```
 */
export function calculateNetAmount(amount: BN, feeBasisPoints: number): BN {
  const fee = calculateFee(amount, feeBasisPoints);
  return amount.sub(fee);
}

/**
 * Validates that an amount is within valid range
 *
 * @param amount - Amount to validate
 * @param min - Minimum allowed amount (default: 1)
 * @param max - Maximum allowed amount (default: 2^64 - 1)
 * @returns True if valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = isValidAmount(new BN(1_000_000)); // true
 * const isValid2 = isValidAmount(new BN(0)); // false (less than min)
 * ```
 */
export function isValidAmount(
  amount: BN | number | bigint,
  min: BN = new BN(1),
  max: BN = new BN('18446744073709551615') // u64::MAX
): boolean {
  const amountBN = typeof amount === 'number' || typeof amount === 'bigint'
    ? new BN(amount.toString())
    : amount;

  return amountBN.gte(min) && amountBN.lte(max);
}
