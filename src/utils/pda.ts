/**
 * PDA (Program Derived Address) utilities
 * @module utils/pda
 */

import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * Derives the vault PDA for a given authority and nonce
 *
 * Seeds: ["vault", authority.toBuffer(), nonce.toBuffer('le', 8)]
 *
 * Note: Users can create unlimited vaults by using different nonce values.
 * The nonce is typically generated using Date.now() + random for uniqueness.
 *
 * @param authority - The vault authority public key
 * @param programId - The Aegis program ID
 * @param nonce - Optional nonce for the vault (default 0 for backwards compatibility)
 * @returns Vault PDA and bump seed
 *
 * @example
 * ```typescript
 * const authority = new PublicKey('...');
 * const programId = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
 * 
 * // Create first vault (nonce = 0)
 * const [vault1Pda, bump1] = deriveVaultPda(authority, programId);
 * 
 * // Create additional vaults with unique nonces
 * const nonce = generateVaultNonce();
 * const [vault2Pda, bump2] = deriveVaultPda(authority, programId, nonce);
 * ```
 */
export function deriveVaultPda(
  authority: PublicKey,
  programId: PublicKey,
  nonce: BN | bigint | number = 0
): [PublicKey, number] {
  const nonceBN = nonce instanceof BN ? nonce : new BN(nonce.toString());
  const nonceBuffer = Buffer.alloc(8);
  nonceBN.toArrayLike(Buffer, 'le', 8).copy(nonceBuffer);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), authority.toBuffer(), nonceBuffer],
    programId
  );
}

/**
 * Generates a unique nonce for vault creation
 * 
 * Uses timestamp + random to ensure uniqueness even for rapid vault creation.
 *
 * @returns A unique nonce as BN
 *
 * @example
 * ```typescript
 * const nonce = generateVaultNonce();
 * const [vaultPda, bump] = deriveVaultPda(authority, programId, nonce);
 * ```
 */
export function generateVaultNonce(): BN {
  const timestamp = BigInt(Date.now());
  const random = BigInt(Math.floor(Math.random() * 1000000));
  return new BN((timestamp * BigInt(1000000) + random).toString());
}

/**
 * Derives the vault authority PDA that holds the vault's funds
 *
 * Seeds: ["vault_authority", vault.toBuffer()]
 *
 * IMPORTANT: This is the address where you should send funds to deposit into your vault.
 * Do NOT send funds to the vault PDA itself (which stores configuration only).
 *
 * @param vault - The vault PDA public key
 * @param programId - The Aegis program ID
 * @returns Vault authority PDA and bump seed
 *
 * @example
 * ```typescript
 * const vault = new PublicKey('...');
 * const programId = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
 * const [vaultAuthPda, bump] = deriveVaultAuthorityPda(vault, programId);
 * 
 * // Send SOL to fund the vault
 * console.log('Send funds to:', vaultAuthPda.toBase58());
 * ```
 */
export function deriveVaultAuthorityPda(
  vault: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority'), vault.toBuffer()],
    programId
  );
}

/**
 * Derives the pending override PDA for a given vault and nonce
 *
 * Seeds: ["override", vault.toBuffer(), nonce.toBuffer('le', 8)]
 *
 * @param vault - The vault PDA public key
 * @param nonce - The override nonce
 * @param programId - The Aegis program ID
 * @returns Override PDA and bump seed
 *
 * @example
 * ```typescript
 * const vault = new PublicKey('...');
 * const nonce = new BN(1);
 * const programId = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
 * const [overridePda, bump] = deriveOverridePda(vault, nonce, programId);
 * ```
 */
export function deriveOverridePda(
  vault: PublicKey,
  nonce: BN,
  programId: PublicKey
): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonce.toArrayLike(Buffer, 'le', 8).copy(nonceBuffer);

  return PublicKey.findProgramAddressSync(
    [Buffer.from('override'), vault.toBuffer(), nonceBuffer],
    programId
  );
}

/**
 * Derives the fee treasury PDA (singleton)
 *
 * Seeds: ["treasury"]
 *
 * @param programId - The Aegis program ID
 * @returns Treasury PDA and bump seed
 *
 * @example
 * ```typescript
 * const programId = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
 * const [treasuryPda, bump] = deriveFeeTreasuryPda(programId);
 * ```
 */
export function deriveFeeTreasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    programId
  );
}

/**
 * Helper to get the deposit address for a vault
 * 
 * This is a convenience method that derives the vault authority PDA
 * where funds should be sent.
 *
 * @param vaultAddress - The vault PDA address (string or PublicKey)
 * @param programId - The Aegis program ID
 * @returns The deposit address as a string
 *
 * @example
 * ```typescript
 * const depositAddress = getDepositAddress('VaultPDA...', programId);
 * console.log('Send SOL to:', depositAddress);
 * ```
 */
export function getDepositAddress(
  vaultAddress: string | PublicKey,
  programId: PublicKey
): string {
  const vaultPubkey = typeof vaultAddress === 'string' 
    ? new PublicKey(vaultAddress) 
    : vaultAddress;
  const [vaultAuthority] = deriveVaultAuthorityPda(vaultPubkey, programId);
  return vaultAuthority.toBase58();
}
