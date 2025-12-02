/**
 * Network-related errors
 * @module errors/network
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * General network error (connection issues, DNS failures, etc.)
 */
export class NetworkError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.NETWORK_ERROR, {
      ...options,
      hint:
        options?.hint ||
        'Check your internet connection and ensure the RPC endpoint is accessible.',
    });
  }
}

/**
 * RPC-specific error (rate limiting, invalid response, etc.)
 */
export class RpcError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.RPC_ERROR, {
      ...options,
      hint:
        options?.hint ||
        'RPC request failed. Consider using a dedicated RPC provider (Helius, Alchemy) for better reliability.',
    });
  }
}

/**
 * Connection error (failed to establish connection)
 */
export class ConnectionError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.CONNECTION_ERROR, {
      ...options,
      hint:
        options?.hint ||
        'Failed to connect to Solana cluster. Verify the RPC endpoint URL and your network connectivity.',
    });
  }
}

/**
 * Timeout error (request took too long)
 */
export class TimeoutError extends AegisError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.TIMEOUT_ERROR, {
      ...options,
      hint:
        options?.hint ||
        'Request timed out. Try increasing the timeout value or check if the network is congested.',
    });
  }
}
