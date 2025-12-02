/**
 * Retry and backoff utilities for handling transient failures
 * @module utils/retry
 */

import { TimeoutError } from '../errors/index.js';

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Exponential backoff multiplier
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Maximum delay between retries in milliseconds
   * @default 30000 (30 seconds)
   */
  maxDelay?: number;

  /**
   * Predicate function to determine if an error is retryable
   * @default (error) => true
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
  shouldRetry: () => true,
};

/**
 * Executes an async function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function execution
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     return await connection.getAccountInfo(address);
 *   },
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     shouldRetry: (error) => error.message.includes('429'),
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  let attempt = 0;

  while (attempt <= opts.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = opts.shouldRetry(lastError, attempt);
      if (!shouldRetry || attempt === opts.maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      // Invoke retry callback if provided
      options.onRetry?.(lastError, attempt + 1, delay);

      // Wait before retrying
      await sleep(delay);

      attempt++;
    }
  }

  throw lastError!;
}

/**
 * Executes an async function with a timeout
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutError - Optional custom timeout error
 * @returns Result of the function execution
 * @throws TimeoutError if the operation times out
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   async () => {
 *     return await connection.getSignatureStatus(signature);
 *   },
 *   30000 // 30 seconds
 * );
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError?: Error
): Promise<T> {
  return Promise.race([
    fn(),
    sleep(timeoutMs).then(() => {
      throw (
        timeoutError ||
        new TimeoutError(`Operation timed out after ${timeoutMs}ms`)
      );
    }),
  ]);
}

/**
 * Sleeps for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```typescript
 * await sleep(1000); // Sleep for 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable based on common patterns
 *
 * This checks for common transient errors like network issues,
 * rate limiting, and timeouts.
 *
 * @param error - Error to check
 * @returns True if the error is likely retryable
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isRetryableError(error)) {
 *     // Retry the operation
 *   } else {
 *     // Handle as permanent failure
 *   }
 * }
 * ```
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  ) {
    return true;
  }

  // Rate limiting
  if (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return true;
  }

  // Timeouts
  if (message.includes('timeout') || name.includes('timeout')) {
    return true;
  }

  // Solana RPC errors
  if (
    message.includes('node is unhealthy') ||
    message.includes('blockhash not found') ||
    message.includes('request timed out')
  ) {
    return true;
  }

  return false;
}
