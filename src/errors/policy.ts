/**
 * Policy violation errors
 * @module errors/policy
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Base class for policy violation errors
 */
export class PolicyViolationError extends AegisError {
  constructor(
    message: string,
    code: AegisErrorCode = AegisErrorCode.POLICY_VIOLATION,
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
        'Transaction was blocked by vault policy. Request an override or adjust the vault policy.',
    });
  }
}

/**
 * Daily spending limit exceeded
 */
export class DailyLimitExceededError extends PolicyViolationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.DAILY_LIMIT_EXCEEDED, {
      ...options,
      hint:
        options?.hint ||
        'Daily spending limit exceeded. Request an override approval or wait for the daily limit to reset.',
    });
  }
}

/**
 * Destination address not whitelisted
 */
export class NotWhitelistedError extends PolicyViolationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.NOT_WHITELISTED, {
      ...options,
      hint:
        options?.hint ||
        'Destination address is not whitelisted. Add the address to the whitelist or request an override.',
    });
  }
}

/**
 * Vault is paused
 */
export class VaultPausedError extends PolicyViolationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.VAULT_PAUSED, {
      ...options,
      hint:
        options?.hint ||
        'Vault is paused. Resume the vault to execute transactions.',
    });
  }
}

/**
 * Unauthorized signer
 */
export class UnauthorizedSignerError extends PolicyViolationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.UNAUTHORIZED_SIGNER, {
      ...options,
      hint:
        options?.hint ||
        'The signer is not authorized for this operation. Ensure the correct wallet is connected.',
    });
  }
}
