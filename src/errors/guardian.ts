/**
 * Guardian API errors
 * @module errors/guardian
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Base class for Guardian API errors
 */
export class GuardianApiError extends AegisError {
  /** HTTP status code if available */
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: AegisErrorCode = AegisErrorCode.GUARDIAN_API_ERROR,
    options?: {
      statusCode?: number;
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, code, {
      context: options?.context,
      hint: options?.hint || 'Guardian API request failed. Check the error details.',
      cause: options?.cause,
    });
    this.statusCode = options?.statusCode;
  }
}

/**
 * Resource not found in Guardian API
 */
export class GuardianNotFoundError extends GuardianApiError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.GUARDIAN_NOT_FOUND, {
      ...options,
      statusCode: 404,
      hint:
        options?.hint ||
        'The requested resource was not found in the Guardian database.',
    });
  }
}

/**
 * Guardian API request timed out
 */
export class GuardianTimeoutError extends GuardianApiError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.GUARDIAN_TIMEOUT, {
      ...options,
      statusCode: 408,
      hint:
        options?.hint ||
        'Guardian API request timed out. The service may be experiencing high load.',
    });
  }
}

/**
 * Unauthorized access to Guardian API
 */
export class GuardianUnauthorizedError extends GuardianApiError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.GUARDIAN_UNAUTHORIZED, {
      ...options,
      statusCode: 401,
      hint:
        options?.hint ||
        'Unauthorized access to Guardian API. Ensure proper authentication credentials are provided.',
    });
  }
}
