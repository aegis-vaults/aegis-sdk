/**
 * Not implemented error
 * @module errors/not-implemented
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Functionality not yet implemented
 *
 * This error is thrown for methods that are stubs and need implementation.
 */
export class NotImplementedError extends AegisError {
  constructor(
    methodName: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(
      `Method '${methodName}' is not yet implemented`,
      AegisErrorCode.NOT_IMPLEMENTED,
      {
        ...options,
        hint:
          options?.hint ||
          'This functionality is under development. Check the SDK roadmap or contribute to the implementation.',
      }
    );
  }
}
