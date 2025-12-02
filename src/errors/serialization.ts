/**
 * Serialization and deserialization errors
 * @module errors/serialization
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Base class for serialization errors
 */
export class SerializationError extends AegisError {
  constructor(
    message: string,
    code: AegisErrorCode = AegisErrorCode.SERIALIZATION_ERROR,
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
 * Failed to deserialize data
 */
export class DeserializationError extends SerializationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.DESERIALIZATION_ERROR, {
      ...options,
      hint:
        options?.hint ||
        'Failed to deserialize data. The account data may be corrupted or in an unexpected format.',
    });
  }
}

/**
 * Invalid account data
 */
export class InvalidAccountDataError extends SerializationError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_ACCOUNT_DATA, {
      ...options,
      hint:
        options?.hint ||
        'The account data is invalid or does not match the expected structure.',
    });
  }
}
