/**
 * PDA (Program Derived Address) utilities
 * @module utils/pda
 */

import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * Derives the vault PDA for a given authority
 *
 * Seeds: ["vault", authority.toBuffer()]
 *
 * @param authority - The vault authority public key
 * @param programId - The Aegis program ID
 * @returns Vault PDA and bump seed
 *
 * @example
 * ```typescript
 * const authority = new PublicKey('...');
 * const programId = new PublicKey('ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ');
 * const [vaultPda, bump] = deriveVaultPda(authority, programId);
 * ```
 */
export function deriveVaultPda(
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), authority.toBuffer()],
    programId
  );
}

/**
 * Derives the vault authority PDA that holds the vault's funds
 *
 * Seeds: ["vault_authority", vault.toBuffer()]
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
