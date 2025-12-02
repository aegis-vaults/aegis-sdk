/**
 * Validation errors
 * @module errors/validation
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Base class for validation errors
 */
export class ValidationError extends AegisError {
  constructor(
    message: string,
    code: AegisErrorCode = AegisErrorCode.VALIDATION_ERROR,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, code, {
      ...options,
      hint:
        options?.hint ||
        'Input validation failed. Check the error message for details.',
    });
  }
}

/**
 * Invalid amount
 */
export class InvalidAmountError extends ValidationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_AMOUNT, {
      ...options,
      hint:
        options?.hint ||
        'Amount must be greater than zero and within valid range.',
    });
  }
}

/**
 * Invalid address
 */
export class InvalidAddressError extends ValidationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_ADDRESS, {
      ...options,
      hint:
        options?.hint ||
        'The address is not a valid Solana public key. Provide a valid base58-encoded address.',
    });
  }
}

/**
 * Invalid daily limit
 */
export class InvalidDailyLimitError extends ValidationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_DAILY_LIMIT, {
      ...options,
      hint:
        options?.hint ||
        'Daily limit must be greater than zero.',
    });
  }
}

/**
 * Whitelist is full
 */
export class WhitelistFullError extends ValidationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.WHITELIST_FULL, {
      ...options,
      hint:
        options?.hint ||
        'Whitelist is full (maximum 20 addresses). Remove an address before adding a new one.',
    });
  }
}
