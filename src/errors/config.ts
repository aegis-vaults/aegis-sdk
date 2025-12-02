/**
 * Configuration errors
 * @module errors/config
 */

import { AegisError, AegisErrorCode } from './base.js';

/**
 * Base class for configuration errors
 */
export class ConfigError extends AegisError {
  constructor(
    message: string,
    code: AegisErrorCode = AegisErrorCode.CONFIG_ERROR,
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
        'Check the SDK configuration and ensure all required parameters are provided.',
    });
  }
}

/**
 * Invalid program ID
 */
export class InvalidProgramIdError extends ConfigError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_PROGRAM_ID, {
      ...options,
      hint:
        options?.hint ||
        'The program ID is invalid. Verify the program ID matches the deployed Aegis Protocol program.',
    });
  }
}

/**
 * Invalid cluster
 */
export class InvalidClusterError extends ConfigError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_CLUSTER, {
      ...options,
      hint:
        options?.hint ||
        'The cluster is invalid. Use one of: mainnet-beta, devnet, testnet, or localnet.',
    });
  }
}

/**
 * Missing wallet
 */
export class MissingWalletError extends ConfigError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.MISSING_WALLET, {
      ...options,
      hint:
        options?.hint ||
        'No wallet provided. Ensure a wallet is connected before executing transactions.',
    });
  }
}

/**
 * Invalid Guardian URL
 */
export class InvalidGuardianUrlError extends ConfigError {
  constructor(
    message: string,
    options?: {
      context?: Record<string, unknown>;
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, AegisErrorCode.INVALID_GUARDIAN_URL, {
      ...options,
      hint:
        options?.hint ||
        'The Guardian API URL is invalid. Provide a valid HTTP(S) URL.',
    });
  }
}
