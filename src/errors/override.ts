/**
 * Override-related errors
 * @module errors/override
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Base class for override errors
 */
export class OverrideError extends AegisError {
  constructor(
    message: string,
    code: AegisErrorCode = AegisErrorCode.OVERRIDE_ERROR,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, code, options);
  }
}

/**
 * Override request has expired
 */
export class OverrideExpiredError extends OverrideError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.OVERRIDE_EXPIRED, {
      ...options,
      hint:
        options?.hint ||
        'The override request has expired. Create a new override request.',
    });
  }
}

/**
 * Override has already been executed
 */
export class OverrideAlreadyExecutedError extends OverrideError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.OVERRIDE_ALREADY_EXECUTED, {
      ...options,
      hint: options?.hint || 'This override has already been executed.',
    });
  }
}

/**
 * Override not found
 */
export class OverrideNotFoundError extends OverrideError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.OVERRIDE_NOT_FOUND, {
      ...options,
      hint:
        options?.hint ||
        'Override request not found. Verify the vault address and nonce.',
    });
  }
}
