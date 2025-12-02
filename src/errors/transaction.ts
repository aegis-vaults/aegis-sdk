/**
 * Transaction-related errors
 * @module errors/transaction
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Transaction was rejected by the network
 */
export class TransactionRejectedError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.TRANSACTION_REJECTED, {
      ...options,
      hint:
        options?.hint ||
        'Transaction was rejected. Check the transaction logs for more details.',
    });
  }
}

/**
 * Transaction failed during execution
 */
export class TransactionFailedError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.TRANSACTION_FAILED, {
      ...options,
      hint:
        options?.hint ||
        'Transaction failed to execute. Review the error details and transaction parameters.',
    });
  }
}

/**
 * Transaction timed out waiting for confirmation
 */
export class TransactionTimeoutError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.TRANSACTION_TIMEOUT, {
      ...options,
      hint:
        options?.hint ||
        'Transaction confirmation timed out. It may still be pending. Check the transaction signature on a Solana explorer.',
    });
  }
}

/**
 * Insufficient balance for transaction
 */
export class InsufficientBalanceError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INSUFFICIENT_BALANCE, {
      ...options,
      hint:
        options?.hint ||
        'Vault has insufficient funds. Add more SOL to the vault or reduce the transaction amount.',
    });
  }
}

/**
 * Invalid signature provided
 */
export class InvalidSignatureError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_SIGNATURE, {
      ...options,
      hint:
        options?.hint ||
        'The transaction signature is invalid or does not match the required signer.',
    });
  }
}
