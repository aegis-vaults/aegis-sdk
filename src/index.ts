/**
 * @aegis/sdk - TypeScript SDK for Aegis Protocol
 *
 * On-chain operating system for AI finance on Solana
 *
 * @packageDocumentation
 */

// Main client
export { AegisClient, DEFAULT_PROGRAM_ID } from './client/AegisClient.js';

// Types
export * from './types/index.js';

// Errors
export * from './errors/index.js';

// Utilities
export * from './utils/index.js';

// Version
export const VERSION = '0.1.0';
