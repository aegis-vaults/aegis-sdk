/**
 * Base error class and error hierarchy for the Aegis SDK
 * @module errors/base
 */

/**
 * Error codes for categorizing different types of errors
 */
export enum AegisErrorCode {
  // Network errors (1xxx)
  NETWORK_ERROR = 1000,
  RPC_ERROR = 1001,
  CONNECTION_ERROR = 1002,
  TIMEOUT_ERROR = 1003,

  // Transaction errors (2xxx)
  TRANSACTION_REJECTED = 2000,
  TRANSACTION_FAILED = 2001,
  TRANSACTION_TIMEOUT = 2002,
  INSUFFICIENT_BALANCE = 2003,
  INVALID_SIGNATURE = 2004,

  // Policy violation errors (3xxx)
  POLICY_VIOLATION = 3000,
  DAILY_LIMIT_EXCEEDED = 3001,
  NOT_WHITELISTED = 3002,
  VAULT_PAUSED = 3003,
  UNAUTHORIZED_SIGNER = 3004,

  // Override errors (4xxx)
  OVERRIDE_ERROR = 4000,
  OVERRIDE_EXPIRED = 4001,
  OVERRIDE_ALREADY_EXECUTED = 4002,
  OVERRIDE_NOT_FOUND = 4003,

  // Configuration errors (5xxx)
  CONFIG_ERROR = 5000,
  INVALID_PROGRAM_ID = 5001,
  INVALID_CLUSTER = 5002,
  MISSING_WALLET = 5003,
  INVALID_GUARDIAN_URL = 5004,

  // Serialization errors (6xxx)
  SERIALIZATION_ERROR = 6000,
  DESERIALIZATION_ERROR = 6001,
  INVALID_ACCOUNT_DATA = 6002,

  // Validation errors (7xxx)
  VALIDATION_ERROR = 7000,
  INVALID_AMOUNT = 7001,
  INVALID_ADDRESS = 7002,
  INVALID_DAILY_LIMIT = 7003,
  WHITELIST_FULL = 7004,

  // Guardian API errors (8xxx)
  GUARDIAN_API_ERROR = 8000,
  GUARDIAN_NOT_FOUND = 8001,
  GUARDIAN_TIMEOUT = 8002,
  GUARDIAN_UNAUTHORIZED = 8003,

  // Not implemented (9xxx)
  NOT_IMPLEMENTED = 9000,

  // Unknown errors
  UNKNOWN_ERROR = 9999,
}

/**
 * Base error class for all Aegis SDK errors
 *
 * All SDK errors extend this class and provide:
 * - Machine-readable error codes
 * - Human-friendly messages
 * - Contextual metadata
 * - Remediation hints where applicable
 */
export class AegisError extends Error {
  /** Error code for programmatic error handling */
  public readonly code: AegisErrorCode;

  /** Additional context about the error */
  public readonly context?: Record<string, unknown>;

  /** Hint for how to remediate the error */
  public readonly hint?: string;

  /** Original error that caused this error (if any) */
  public readonly cause?: Error;

  constructor(
    message: string,
    code: AegisErrorCode = AegisErrorCode.UNKNOWN_ERROR,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = options?.context;
    this.hint = options?.hint;
    this.cause = options?.cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a detailed error object for logging/debugging
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      hint: this.hint,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    };
  }

  /**
   * Returns a user-friendly error message with hint if available
   */
  public toString(): string {
    let str = `${this.name} [${this.code}]: ${this.message}`;
    if (this.hint) {
      str += `\n💡 ${this.hint}`;
    }
    return str;
  }
}
