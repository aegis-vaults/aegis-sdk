/**
 * Polling utilities for waiting on transaction confirmations and state changes
 * @module utils/polling
 */

import { Connection, TransactionSignature, SignatureStatus } from '@solana/web3.js';
import { TimeoutError } from '../errors/index.js';
import { sleep } from './retry.js';

/**
 * Options for polling operations
 */
export interface PollingOptions {
  /**
   * Polling interval in milliseconds
   * @default 1000
   */
  interval?: number;

  /**
   * Timeout in milliseconds
   * @default 60000 (60 seconds)
   */
  timeout?: number;

  /**
   * Callback invoked on each poll iteration
   */
  onPoll?: (attempt: number) => void;
}

/**
 * Default polling options
 */
export const DEFAULT_POLLING_OPTIONS: Required<Omit<PollingOptions, 'onPoll'>> = {
  interval: 1000,
  timeout: 60000,
};

/**
 * Polls until a condition is met or timeout occurs
 *
 * @param checkFn - Async function that returns true when condition is met
 * @param options - Polling options
 * @returns Promise that resolves when condition is met
 * @throws TimeoutError if polling times out
 *
 * @example
 * ```typescript
 * await pollUntil(
 *   async () => {
 *     const account = await connection.getAccountInfo(address);
 *     return account !== null;
 *   },
 *   { interval: 1000, timeout: 30000 }
 * );
 * ```
 */
export async function pollUntil(
  checkFn: () => Promise<boolean>,
  options: PollingOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_POLLING_OPTIONS, ...options };
  const startTime = Date.now();
  let attempt = 0;

  while (true) {
    attempt++;
    options.onPoll?.(attempt);

    // Check if condition is met
    const conditionMet = await checkFn();
    if (conditionMet) {
      return;
    }

    // Check if timed out
    const elapsed = Date.now() - startTime;
    if (elapsed >= opts.timeout) {
      throw new TimeoutError(
        `Polling timed out after ${opts.timeout}ms (${attempt} attempts)`,
        {
          context: { attempts: attempt, elapsedMs: elapsed },
        }
      );
    }

    // Wait before next poll
    await sleep(opts.interval);
  }
}

/**
 * Polls for transaction confirmation
 *
 * @param connection - Solana connection
 * @param signature - Transaction signature to confirm
 * @param options - Polling options
 * @returns Signature status when confirmed
 * @throws TimeoutError if confirmation times out
 *
 * @example
 * ```typescript
 * const signature = await connection.sendTransaction(transaction);
 * const status = await pollForSignatureStatus(
 *   connection,
 *   signature,
 *   { timeout: 60000 }
 * );
 * console.log('Transaction confirmed:', status.confirmationStatus);
 * ```
 */
export async function pollForSignatureStatus(
  connection: Connection,
  signature: TransactionSignature,
  options: PollingOptions = {}
): Promise<SignatureStatus> {
  const opts = { ...DEFAULT_POLLING_OPTIONS, ...options };
  const startTime = Date.now();
  let attempt = 0;

  while (true) {
    attempt++;
    options.onPoll?.(attempt);

    // Check signature status
    const response = await connection.getSignatureStatus(signature);
    const status = response.value;

    // If we have a status and it's confirmed/finalized, return it
    if (status && status.confirmationStatus) {
      const isConfirmed =
        status.confirmationStatus === 'confirmed' ||
        status.confirmationStatus === 'finalized';

      if (isConfirmed) {
        return status;
      }

      // If status indicates an error, throw immediately
      if (status.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(status.err)}`
        );
      }
    }

    // Check if timed out
    const elapsed = Date.now() - startTime;
    if (elapsed >= opts.timeout) {
      throw new TimeoutError(
        `Transaction confirmation timed out after ${opts.timeout}ms`,
        {
          context: {
            signature,
            attempts: attempt,
            elapsedMs: elapsed,
            lastStatus: status,
          },
          hint:
            'The transaction may still be pending. Check the signature on a Solana explorer.',
        }
      );
    }

    // Wait before next poll
    await sleep(opts.interval);
  }
}

/**
 * Polls until an account exists and is initialized
 *
 * @param connection - Solana connection
 * @param address - Account address to check
 * @param options - Polling options
 * @returns Promise that resolves when account exists
 * @throws TimeoutError if polling times out
 *
 * @example
 * ```typescript
 * await pollForAccountCreation(
 *   connection,
 *   vaultAddress,
 *   { timeout: 30000 }
 * );
 * console.log('Vault account created');
 * ```
 */
export async function pollForAccountCreation(
  connection: Connection,
  address: import('@solana/web3.js').PublicKey,
  options: PollingOptions = {}
): Promise<void> {
  await pollUntil(async () => {
    const account = await connection.getAccountInfo(address);
    return account !== null;
  }, options);
}

/**
 * Polls a value from a function until it changes
 *
 * @param getValue - Async function that returns the current value
 * @param initialValue - Initial value to compare against
 * @param options - Polling options
 * @returns New value when it changes
 * @throws TimeoutError if polling times out
 *
 * @example
 * ```typescript
 * const newBalance = await pollForValueChange(
 *   async () => {
 *     const account = await connection.getAccountInfo(vault);
 *     return account?.lamports || 0;
 *   },
 *   currentBalance,
 *   { timeout: 30000 }
 * );
 * console.log('Balance changed to:', newBalance);
 * ```
 */
export async function pollForValueChange<T>(
  getValue: () => Promise<T>,
  initialValue: T,
  options: PollingOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_POLLING_OPTIONS, ...options };
  const startTime = Date.now();
  let attempt = 0;

  while (true) {
    attempt++;
    options.onPoll?.(attempt);

    const currentValue = await getValue();

    // Check if value has changed
    if (currentValue !== initialValue) {
      return currentValue;
    }

    // Check if timed out
    const elapsed = Date.now() - startTime;
    if (elapsed >= opts.timeout) {
      throw new TimeoutError(
        `Value did not change after ${opts.timeout}ms`,
        {
          context: { attempts: attempt, elapsedMs: elapsed },
        }
      );
    }

    // Wait before next poll
    await sleep(opts.interval);
  }
}
