/**
 * Main client class for interacting with the Aegis Protocol
 * @module client/AegisClient
 */

import { Connection, PublicKey, clusterApiUrl, Commitment, Cluster } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import BN from 'bn.js';
import type {
  AegisConfig,
  CreateVaultOptions,
  ExecuteGuardedOptions,
  RequestOverrideOptions,
  UpdatePolicyOptions,
  TransactionHistoryOptions,
  AnalyticsOptions,
  SubscriptionOptions,
  TransactionOptions,
  VaultConfig,
  PendingOverride,
  GuardianVault,
  GuardianTransaction,
  VaultAnalytics,
  PaginatedResponse,
} from '../types/index.js';
import {
  AegisError,
  ConfigError,
  InvalidProgramIdError,
  MissingWalletError,
  NetworkError,
  TransactionRejectedError,
  TransactionFailedError,
  TransactionTimeoutError,
  InsufficientBalanceError,
  NotWhitelistedError,
  DailyLimitExceededError,
  VaultPausedError,
  UnauthorizedSignerError,
} from '../errors/index.js';
import { deriveVaultPda, deriveVaultAuthorityPda, deriveFeeTreasuryPda, deriveOverridePda, generateVaultNonce, getDepositAddress } from '../utils/pda.js';
import idl from '../idl/aegis_core.json';

/**
 * Default Aegis program ID on devnet
 */
export const DEFAULT_PROGRAM_ID = 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ';

/**
 * Main client for interacting with the Aegis Protocol
 *
 * This class provides a high-level API for:
 * - Creating and managing vaults
 * - Executing guarded transactions with policy enforcement
 * - Requesting and approving override requests
 * - Subscribing to real-time events
 * - Querying transaction history and analytics
 *
 * @example
 * ```typescript
 * import { AegisClient } from '@aegis-vaults/sdk';
 * import { Connection, Keypair } from '@solana/web3.js';
 *
 * const connection = new Connection('https://api.devnet.solana.com');
 * const wallet = Keypair.generate();
 *
 * const client = new AegisClient({
 *   connection,
 *   programId: 'ET9WDoFE2bf4bSmciLL7q7sKdeSYeNkWbNMHbAMBu2ZJ',
 *   guardianApiUrl: 'http://localhost:3000',
 * });
 *
 * // Create a vault
 * const vault = await client.createVault({
 *   name: 'My AI Treasury',
 *   agentSigner: agentPublicKey.toBase58(),
 *   dailyLimit: 1000000000, // 1 SOL
 * });
 * ```
 */
export class AegisClient {
  /** Solana connection instance */
  private readonly connection: Connection;

  /** Aegis Protocol program instance */
  private readonly program: any;

  /** Program ID */
  private readonly programId: PublicKey;

  /** Guardian API base URL */
  private readonly guardianApiUrl: string;

  /** Guardian WebSocket URL */
  private readonly _guardianWsUrl: string;

  /** Default commitment level */
  private readonly commitment: Commitment;

  /** Confirmation timeout in milliseconds */
  private readonly _confirmTimeout: number;

  /** Enable automatic retry */
  private readonly autoRetry: boolean;

  /** Maximum retry attempts */
  private readonly maxRetries: number;

  /** Retry delay in milliseconds */
  private readonly retryDelay: number;

  /** Wallet instance (optional) */
  private wallet?: Wallet;

  /** Guardian API client */
  private guardianClient?: any; // Will be lazily initialized

  /**
   * Creates a new AegisClient instance
   *
   * @param config - Client configuration options
   * @throws ConfigError if configuration is invalid
   *
   * @example
   * ```typescript
   * const client = new AegisClient({
   *   cluster: 'devnet',
   *   guardianApiUrl: 'http://localhost:3000',
   * });
   * ```
   */
  constructor(config: AegisConfig = {}) {
    // Setup connection
    if (config.connection) {
      this.connection = config.connection;
    } else {
      const cluster = (config.cluster || 'devnet') as Cluster;
      const endpoint = clusterApiUrl(cluster);
      this.connection = new Connection(endpoint, config.commitment || 'confirmed');
    }

    // Setup program ID
    try {
      this.programId = new PublicKey(config.programId || DEFAULT_PROGRAM_ID);
    } catch (error) {
      throw new InvalidProgramIdError(
        `Invalid program ID: ${config.programId}`,
        { cause: error instanceof Error ? error : undefined }
      );
    }

    // Setup Guardian URLs
    this.guardianApiUrl = config.guardianApiUrl || 'http://localhost:3000';
    this._guardianWsUrl = config.guardianWsUrl || 'ws://localhost:3000';

    // Setup options
    this.commitment = config.commitment || 'confirmed';
    this._confirmTimeout = config.confirmTimeout || 60000;
    this.autoRetry = config.autoRetry ?? true;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;

    // Setup program (with dummy wallet for read-only operations)
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async () => {
        throw new Error('Wallet not connected');
      },
      signAllTransactions: async () => {
        throw new Error('Wallet not connected');
      },
    } as unknown as Wallet;

    const provider = new AnchorProvider(
      this.connection,
      dummyWallet,
      {
        commitment: this.commitment,
      }
    );

    this.program = new Program(idl as any, provider) as any;
  }

  /**
   * Sets the wallet for signing transactions
   *
   * @param wallet - Wallet instance (must implement signTransaction and signAllTransactions)
   *
   * @example
   * ```typescript
   * import { Keypair } from '@solana/web3.js';
   *
   * const wallet = Keypair.generate();
   * client.setWallet(wallet);
   * ```
   */
  public setWallet(wallet: Wallet): void {
    this.wallet = wallet;

    // Update provider with new wallet
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: this.commitment,
    });

    (this.program as any).provider = provider;
  }

  /**
   * Gets the current wallet public key
   *
   * @returns Wallet public key or undefined if no wallet is set
   */
  public getWalletPublicKey(): PublicKey | undefined {
    return this.wallet?.publicKey;
  }

  // ============================================================================
  // VAULT MANAGEMENT
  // ============================================================================

  /**
   * Creates a new vault with specified configuration
   *
   * Users can create unlimited vaults by providing different nonce values.
   * If no nonce is provided, a unique one is generated automatically.
   *
   * @param options - Vault creation options
   * @returns Vault address, deposit address, nonce, and transaction signature
   * @throws MissingWalletError if no wallet is connected
   *
   * @example
   * ```typescript
   * const result = await client.createVault({
   *   name: 'My AI Treasury',
   *   agentSigner: 'AgentPublicKey...',
   *   dailyLimit: 1000000000, // 1 SOL in lamports
   * });
   *
   * console.log('Vault created:', result.vaultAddress);
   * console.log('Deposit address:', result.depositAddress);
   * console.log('Send SOL to the deposit address to fund your vault!');
   * ```
   */
  public async createVault(options: CreateVaultOptions): Promise<{
    vaultAddress: string;
    depositAddress: string;
    nonce: string;
    signature: string;
  }> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to create a vault');
    }

    try {
      const authority = this.wallet.publicKey;
      const agentSigner = new PublicKey(options.agentSigner);

      // Generate a unique nonce for this vault (allows unlimited vaults per user)
      const nonce = options.nonce ? new BN(options.nonce.toString()) : generateVaultNonce();

      // Derive vault PDA with nonce
      const [vaultPda] = deriveVaultPda(authority, this.programId, nonce);

      // Derive vault authority PDA (will hold the funds - THIS IS THE DEPOSIT ADDRESS)
      const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPda, this.programId);

      // Build instruction with nonce as first argument
      const ix = await this.program.methods
        .initializeVault(
          nonce,
          agentSigner,
          new BN(options.dailyLimit.toString()),
          options.name
        )
        .accounts({
          vault: vaultPda,
          vaultAuthority: vaultAuthorityPda,
          authority: authority,
          systemProgram: PublicKey.default,
        })
        .instruction();

      // Send transaction with retry logic if enabled
      const signature = await this.sendTransaction([ix], options.transactionOptions);

      return {
        vaultAddress: vaultPda.toBase58(),
        depositAddress: vaultAuthorityPda.toBase58(),
        nonce: nonce.toString(),
        signature,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to create vault');
    }
  }

  /**
   * Fetches vault configuration from on-chain account
   *
   * @param vaultAddress - Vault PDA address
   * @returns Vault configuration
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const vault = await client.getVault('VaultPublicKey...');
   *
   * console.log('Daily limit:', vault.dailyLimit.toString());
   * console.log('Spent today:', vault.spentToday.toString());
   * console.log('Whitelist:', vault.whitelist);
   * ```
   */
  public async getVault(vaultAddress: string): Promise<VaultConfig> {
    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const accountInfo = await this.program.account.vaultConfig.fetch(vaultPubkey);

      // Transform the raw account data to our VaultConfig type
      return {
        authority: accountInfo.authority as PublicKey,
        agentSigner: accountInfo.agentSigner as PublicKey,
        dailyLimit: accountInfo.dailyLimit as BN,
        spentToday: accountInfo.spentToday as BN,
        lastReset: accountInfo.lastReset as BN,
        whitelist: (accountInfo.whitelist as PublicKey[]).slice(0, accountInfo.whitelistCount),
        whitelistCount: accountInfo.whitelistCount,
        tier: accountInfo.tier as any,
        feeBasisPoints: accountInfo.feeBasisPoints,
        name: Buffer.from(accountInfo.name.slice(0, accountInfo.nameLen)).toString('utf8'),
        nameLen: accountInfo.nameLen,
        paused: accountInfo.paused,
        overrideNonce: accountInfo.overrideNonce as BN,
        bump: accountInfo.bump,
      };
    } catch (error) {
      throw this.handleError(error, `Failed to fetch vault ${vaultAddress}`);
    }
  }

  /**
   * Lists all vaults owned by a specific address
   *
   * @param owner - Owner wallet address
   * @returns Array of vault addresses
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const vaults = await client.listVaults('OwnerPublicKey...');
   *
   * console.log(`Found ${vaults.length} vaults`);
   * for (const vaultAddr of vaults) {
   *   const vault = await client.getVault(vaultAddr);
   *   console.log(`Vault ${vaultAddr}: ${vault.name}`);
   * }
   * ```
   */
  public async listVaults(owner: string): Promise<string[]> {
    try {
      const ownerPubkey = new PublicKey(owner);

      // Use getProgramAccounts to find all vaults for this owner
      const accounts = await this.program.account.vaultConfig.all([
        {
          memcmp: {
            offset: 8, // Discriminator is 8 bytes
            bytes: ownerPubkey.toBase58(),
          },
        },
      ]);

      return accounts.map((account: { publicKey: PublicKey }) => account.publicKey.toBase58());
    } catch (error) {
      throw this.handleError(error, `Failed to list vaults for owner ${owner}`);
    }
  }

  /**
   * Derives the vault PDA for a given owner and nonce
   *
   * @param owner - Owner wallet address
   * @param nonce - Optional nonce for multiple vaults (default 0)
   * @returns Vault PDA address and bump seed
   *
   * @example
   * ```typescript
   * // First vault (nonce = 0)
   * const [vault1Pda, bump1] = client.deriveVaultAddress('OwnerPublicKey...');
   * 
   * // Additional vaults with nonce
   * const [vault2Pda, bump2] = client.deriveVaultAddress('OwnerPublicKey...', '1234567890');
   * ```
   */
  public deriveVaultAddress(owner: string, nonce?: string | number | bigint): [PublicKey, number] {
    const ownerPubkey = new PublicKey(owner);
    const nonceBN = nonce ? new BN(nonce.toString()) : new BN(0);
    return deriveVaultPda(ownerPubkey, this.programId, nonceBN);
  }

  /**
   * Derives the vault authority PDA that holds vault funds (DEPOSIT ADDRESS)
   *
   * IMPORTANT: This is where you send SOL to fund your vault!
   * Do NOT send funds to the vault PDA itself.
   *
   * @param vaultAddress - Vault PDA address
   * @returns Vault authority PDA and bump seed
   *
   * @example
   * ```typescript
   * const [depositAddress, bump] = client.deriveVaultAuthorityAddress('VaultPDA...');
   * console.log('Send SOL to:', depositAddress.toBase58());
   * 
   * // Check vault balance
   * const balance = await connection.getBalance(depositAddress);
   * console.log('Vault balance:', balance / 1e9, 'SOL');
   * ```
   */
  public deriveVaultAuthorityAddress(vaultAddress: string): [PublicKey, number] {
    const vaultPubkey = new PublicKey(vaultAddress);
    return deriveVaultAuthorityPda(vaultPubkey, this.programId);
  }

  /**
   * Gets the deposit address for a vault
   *
   * This is a convenience method that returns the address where you should
   * send SOL to fund your vault.
   *
   * @param vaultAddress - The vault PDA address
   * @returns The deposit address as a string
   *
   * @example
   * ```typescript
   * const depositAddress = client.getDepositAddress('VaultPDA...');
   * console.log('Send SOL to:', depositAddress);
   * ```
   */
  public getVaultDepositAddress(vaultAddress: string): string {
    return getDepositAddress(vaultAddress, this.programId);
  }

  /**
   * Gets the balance of a vault
   *
   * @param vaultAddress - The vault PDA address
   * @returns Balance in lamports
   *
   * @example
   * ```typescript
   * const balance = await client.getVaultBalance('VaultPDA...');
   * console.log('Balance:', balance / 1e9, 'SOL');
   * ```
   */
  public async getVaultBalance(vaultAddress: string): Promise<number> {
    const depositAddress = this.getVaultDepositAddress(vaultAddress);
    return this.connection.getBalance(new PublicKey(depositAddress));
  }

  // ============================================================================
  // POLICY MANAGEMENT
  // ============================================================================

  /**
   * Updates vault policy configuration
   *
   * @param options - Policy update options
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const signature = await client.updatePolicy({
   *   vault: 'VaultPublicKey...',
   *   dailyLimit: 2000000000, // 2 SOL
   * });
   *
   * console.log('Policy updated:', signature);
   * ```
   */
  public async updatePolicy(options: UpdatePolicyOptions): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to update policy');
    }

    try {
      const vaultPubkey = new PublicKey(options.vault);
      const authority = this.wallet.publicKey;

      if (!options.dailyLimit) {
        throw new ConfigError('At least one policy parameter must be provided');
      }

      // Build instruction for updating daily limit
      const ix = await this.program.methods
        .updateDailyLimit(new BN(options.dailyLimit.toString()))
        .accounts({
          vault: vaultPubkey,
          authority: authority,
        })
        .instruction();

      return await this.sendTransaction([ix], options.transactionOptions);
    } catch (error) {
      throw this.handleError(error, 'Failed to update policy');
    }
  }

  /**
   * Adds an address to the vault's whitelist
   *
   * @param vaultAddress - Vault address
   * @param address - Address to whitelist
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const signature = await client.addToWhitelist(
   *   'VaultPublicKey...',
   *   'DestinationPublicKey...'
   * );
   * ```
   */
  public async addToWhitelist(vaultAddress: string, address: string): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to modify whitelist');
    }

    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const addressPubkey = new PublicKey(address);
      const authority = this.wallet.publicKey;

      const ix = await this.program.methods
        .addToWhitelist(addressPubkey)
        .accounts({
          vault: vaultPubkey,
          authority: authority,
        })
        .instruction();

      return await this.sendTransaction([ix]);
    } catch (error) {
      throw this.handleError(error, `Failed to add ${address} to whitelist`);
    }
  }

  /**
   * Removes an address from the vault's whitelist
   *
   * @param vaultAddress - Vault address
   * @param address - Address to remove
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const signature = await client.removeFromWhitelist(
   *   'VaultPublicKey...',
   *   'DestinationPublicKey...'
   * );
   * ```
   */
  public async removeFromWhitelist(vaultAddress: string, address: string): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to modify whitelist');
    }

    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const addressPubkey = new PublicKey(address);
      const authority = this.wallet.publicKey;

      const ix = await this.program.methods
        .removeFromWhitelist(addressPubkey)
        .accounts({
          vault: vaultPubkey,
          authority: authority,
        })
        .instruction();

      return await this.sendTransaction([ix]);
    } catch (error) {
      throw this.handleError(error, `Failed to remove ${address} from whitelist`);
    }
  }

  /**
   * Pauses a vault, blocking all transactions
   *
   * @param vaultAddress - Vault address
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const signature = await client.pauseVault('VaultPublicKey...');
   * console.log('Vault paused:', signature);
   * ```
   */
  public async pauseVault(vaultAddress: string): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to pause vault');
    }

    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const authority = this.wallet.publicKey;

      const ix = await this.program.methods
        .pauseVault()
        .accounts({
          vault: vaultPubkey,
          authority: authority,
        })
        .instruction();

      return await this.sendTransaction([ix]);
    } catch (error) {
      throw this.handleError(error, `Failed to pause vault ${vaultAddress}`);
    }
  }

  /**
   * Resumes a paused vault
   *
   * @param vaultAddress - Vault address
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const signature = await client.resumeVault('VaultPublicKey...');
   * console.log('Vault resumed:', signature);
   * ```
   */
  public async resumeVault(vaultAddress: string): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to resume vault');
    }

    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const authority = this.wallet.publicKey;

      const ix = await this.program.methods
        .resumeVault()
        .accounts({
          vault: vaultPubkey,
          authority: authority,
        })
        .instruction();

      return await this.sendTransaction([ix]);
    } catch (error) {
      throw this.handleError(error, `Failed to resume vault ${vaultAddress}`);
    }
  }

  // ============================================================================
  // TRANSACTION EXECUTION
  // ============================================================================

  /**
   * Executes a guarded transaction with policy validation
   *
   * The transaction will be checked against vault policies (whitelist, daily limits).
   * If blocked, a PolicyViolationError is thrown with details on why it was blocked.
   * You can then use requestOverride() to request manual approval.
   *
   * @param options - Transaction execution options
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws PolicyViolationError if transaction violates vault policy
   * @throws InsufficientBalanceError if vault has insufficient funds
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * try {
   *   const signature = await client.executeGuarded({
   *     vault: 'VaultPublicKey...',
   *     destination: 'RecipientPublicKey...',
   *     amount: 500000000, // 0.5 SOL
   *     purpose: 'Payment for services',
   *   });
   *
   *   console.log('Transaction executed:', signature);
   * } catch (error) {
   *   if (error instanceof DailyLimitExceededError) {
   *     // Request override
   *     const override = await client.requestOverride({...});
   *   }
   * }
   * ```
   */
  public async executeGuarded(options: ExecuteGuardedOptions): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to execute transactions');
    }

    try {
      const vaultPubkey = new PublicKey(options.vault);
      const destinationPubkey = new PublicKey(options.destination);
      const authority = this.wallet.publicKey;

      // Derive required PDAs
      const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, this.programId);
      const [feeTreasuryPda] = deriveFeeTreasuryPda(this.programId);

      // Build execute_guarded instruction
      const ix = await this.program.methods
        .executeGuarded(new BN(options.amount.toString()))
        .accounts({
          vault: vaultPubkey,
          authority: authority,
          vaultAuthority: vaultAuthorityPda,
          destination: destinationPubkey,
          feeTreasury: feeTreasuryPda,
          systemProgram: PublicKey.default,
        })
        .instruction();

      return await this.sendTransaction([ix], options.transactionOptions);
    } catch (error) {
      throw this.handleError(error, 'Failed to execute guarded transaction');
    }
  }

  // ============================================================================
  // OVERRIDE MANAGEMENT
  // ============================================================================

  /**
   * Requests an override for a blocked transaction
   *
   * Creates a pending override request that can be approved by the vault authority.
   * The Guardian backend will generate a Blink URL for approval.
   *
   * @param options - Override request options
   * @returns Override nonce and Blink URL
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const result = await client.requestOverride({
   *   vault: 'VaultPublicKey...',
   *   destination: 'RecipientPublicKey...',
   *   amount: 2000000000, // 2 SOL (exceeds limit)
   *   reason: 'Emergency withdrawal',
   * });
   *
   * console.log('Override requested. Approve at:', result.blinkUrl);
   * ```
   */
  public async requestOverride(options: RequestOverrideOptions): Promise<{
    nonce: string;
    blinkUrl: string;
    signature: string;
  }> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to request override');
    }

    try {
      const vaultPubkey = new PublicKey(options.vault);
      const destinationPubkey = new PublicKey(options.destination);
      const authority = this.wallet.publicKey;

      // First, fetch the vault to get the current override nonce
      const vault = await this.getVault(options.vault);
      const nonce = vault.overrideNonce;

      // Derive pending override PDA
      const [pendingOverridePda] = deriveOverridePda(vaultPubkey, nonce, this.programId);

      // Determine block reason based on the reason string
      // Map user-friendly reason to protocol BlockReason enum
      let blockReason: any;
      const reasonLower = options.reason.toLowerCase();
      if (reasonLower.includes('whitelist') || reasonLower.includes('not whitelisted')) {
        blockReason = { notWhitelisted: {} };
      } else if (reasonLower.includes('limit') || reasonLower.includes('exceeded')) {
        blockReason = { exceededDailyLimit: {} };
      } else {
        blockReason = { insufficientFunds: {} };
      }

      // Build create_override instruction
      const ix = await this.program.methods
        .createOverride(
          destinationPubkey,
          new BN(options.amount.toString()),
          blockReason
        )
        .accounts({
          vault: vaultPubkey,
          authority: authority,
          pendingOverride: pendingOverridePda,
          systemProgram: PublicKey.default,
        })
        .instruction();

      const signature = await this.sendTransaction([ix], options.transactionOptions);

      // TODO: Call Guardian API to register override and get blink URL
      const blinkUrl = `${this.guardianApiUrl}/actions/${options.vault}/${nonce.toString()}`;

      return {
        nonce: nonce.toString(),
        blinkUrl,
        signature,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to request override');
    }
  }

  /**
   * Approves a pending override request
   *
   * @param vaultAddress - Vault address
   * @param nonce - Override nonce
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const signature = await client.approveOverride('VaultPublicKey...', '1');
   * console.log('Override approved:', signature);
   * ```
   */
  public async approveOverride(vaultAddress: string, nonce: string): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to approve override');
    }

    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const authority = this.wallet.publicKey;
      const nonceBN = new BN(nonce);

      // Derive pending override PDA
      const [pendingOverridePda] = deriveOverridePda(vaultPubkey, nonceBN, this.programId);

      // Build approve_override instruction
      const ix = await this.program.methods
        .approveOverride()
        .accounts({
          vault: vaultPubkey,
          authority: authority,
          pendingOverride: pendingOverridePda,
        })
        .instruction();

      return await this.sendTransaction([ix]);
    } catch (error) {
      throw this.handleError(error, `Failed to approve override ${nonce}`);
    }
  }

  /**
   * Executes an approved override
   *
   * @param vaultAddress - Vault address
   * @param nonce - Override nonce
   * @returns Transaction signature
   * @throws MissingWalletError if no wallet is connected
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const signature = await client.executeOverride('VaultPublicKey...', '1');
   * console.log('Override executed:', signature);
   * ```
   */
  public async executeOverride(vaultAddress: string, nonce: string): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to execute override');
    }

    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const authority = this.wallet.publicKey;
      const nonceBN = new BN(nonce);

      // Derive required PDAs
      const [pendingOverridePda] = deriveOverridePda(vaultPubkey, nonceBN, this.programId);
      const [vaultAuthorityPda] = deriveVaultAuthorityPda(vaultPubkey, this.programId);
      const [feeTreasuryPda] = deriveFeeTreasuryPda(this.programId);

      // Fetch override to get destination
      const override = await this.getOverride(vaultAddress, nonce);
      const destinationPubkey = override.destination;

      // Build execute_approved_override instruction
      const ix = await this.program.methods
        .executeApprovedOverride()
        .accounts({
          vault: vaultPubkey,
          pendingOverride: pendingOverridePda,
          authority: authority,
          vaultAuthority: vaultAuthorityPda,
          destination: destinationPubkey,
          feeTreasury: feeTreasuryPda,
          systemProgram: PublicKey.default,
        })
        .instruction();

      return await this.sendTransaction([ix]);
    } catch (error) {
      throw this.handleError(error, `Failed to execute override ${nonce}`);
    }
  }

  /**
   * Fetches a pending override by vault and nonce
   *
   * @param vaultAddress - Vault address
   * @param nonce - Override nonce
   * @returns Pending override data
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const override = await client.getOverride('VaultPublicKey...', '1');
   * console.log('Override status:', override.executed ? 'executed' : 'pending');
   * ```
   */
  public async getOverride(vaultAddress: string, nonce: string): Promise<PendingOverride> {
    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      const nonceBN = new BN(nonce);

      // Derive pending override PDA
      const [pendingOverridePda] = deriveOverridePda(vaultPubkey, nonceBN, this.programId);

      const accountInfo = await this.program.account.pendingOverride.fetch(pendingOverridePda);

      // Transform the raw account data to our PendingOverride type
      return {
        vault: accountInfo.vault as PublicKey,
        nonce: accountInfo.nonce as BN,
        instructionHash: new Uint8Array(accountInfo.instructionHash as any),
        requestedAmount: accountInfo.requestedAmount as BN,
        destination: accountInfo.destination as PublicKey,
        expiresAt: accountInfo.expiresAt as BN,
        executed: accountInfo.executed,
        overrideType: accountInfo.overrideType as any,
        bump: accountInfo.bump,
      };
    } catch (error) {
      throw this.handleError(error, `Failed to fetch override ${nonce} for vault ${vaultAddress}`);
    }
  }

  // ============================================================================
  // GUARDIAN API QUERIES
  // ============================================================================

  /**
   * Fetches vault data from Guardian API (includes off-chain metadata)
   *
   * @param vaultAddress - Vault address
   * @returns Guardian vault data
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const vaultData = await client.getGuardianVault('VaultPublicKey...');
   * console.log('Vault name:', vaultData.name);
   * console.log('Total transactions:', vaultData.transactions?.length);
   * ```
   */
  public async getGuardianVault(vaultAddress: string): Promise<GuardianVault> {
    const guardian = await this.getGuardianClient();
    return guardian.getVault(vaultAddress);
  }

  /**
   * Fetches transaction history from Guardian API
   *
   * @param options - Query options and filters
   * @returns Paginated transaction history
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const history = await client.getTransactionHistory({
   *   vault: 'VaultPublicKey...',
   *   status: 'EXECUTED',
   *   page: 1,
   *   limit: 20,
   * });
   *
   * console.log(`Page ${history.pagination.page} of ${history.pagination.totalPages}`);
   * for (const tx of history.data) {
   *   console.log(`${tx.signature}: ${tx.amount} lamports to ${tx.to}`);
   * }
   * ```
   */
  public async getTransactionHistory(
    options: TransactionHistoryOptions = {}
  ): Promise<PaginatedResponse<GuardianTransaction>> {
    const guardian = await this.getGuardianClient();
    return guardian.getTransactionHistory(options);
  }

  /**
   * Fetches spending analytics for a vault
   *
   * @param vaultAddress - Vault address
   * @param options - Analytics options
   * @returns Vault analytics data
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const analytics = await client.getAnalytics('VaultPublicKey...', {
   *   timeframe: '30d',
   *   groupBy: 'day',
   * });
   *
   * console.log('Total volume:', analytics.totalVolume);
   * console.log('Transaction count:', analytics.transactionCount);
   * console.log('Blocked count:', analytics.blockedCount);
   * ```
   */
  public async getAnalytics(
    vaultAddress: string,
    options: AnalyticsOptions = {}
  ): Promise<VaultAnalytics> {
    const guardian = await this.getGuardianClient();
    return guardian.getAnalytics(vaultAddress, options);
  }

  // ============================================================================
  // EVENT SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribes to real-time vault events via WebSocket
   *
   * @param vaultAddress - Vault address to subscribe to
   * @param callback - Callback invoked when events are received
   * @param options - Subscription options
   * @returns Unsubscribe function
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const unsubscribe = await client.subscribeToVault(
   *   'VaultPublicKey...',
   *   (event) => {
   *     console.log('Event received:', event.type, event.data);
   *   },
   *   { autoReconnect: true }
   * );
   *
   * // Later: unsubscribe()
   * ```
   */
  public async subscribeToVault(
    vaultAddress: string,
    callback: (event: any) => void,
    options: SubscriptionOptions = {}
  ): Promise<() => void> {
    // For now, implement using on-chain logs subscription
    // In a full implementation, this would also connect to Guardian WebSocket
    const vaultPubkey = new PublicKey(vaultAddress);

    const subscriptionId = this.connection.onLogs(
      vaultPubkey,
      (logs) => {
        // Parse logs and invoke callback with structured event data
        callback({
          type: 'log',
          data: logs,
          vault: vaultAddress,
        });
      },
      options.commitment || this.commitment
    );

    // Return unsubscribe function
    return () => {
      this.connection.removeOnLogsListener(subscriptionId);
    };
  }

  /**
   * Subscribes to program-level events (all vaults)
   *
   * @param eventType - Event type to filter ('transaction', 'override', 'all')
   * @param callback - Callback invoked when events are received
   * @param options - Subscription options
   * @returns Unsubscribe function
   * @throws NotImplementedError - This method is not yet implemented
   *
   * @example
   * ```typescript
   * const unsubscribe = await client.subscribeToEvents(
   *   'transaction',
   *   (event) => {
   *     if (event.type === 'TransactionExecuted') {
   *       console.log('Transaction executed:', event.data);
   *     }
   *   }
   * );
   * ```
   */
  public async subscribeToEvents(
    eventType: 'transaction' | 'override' | 'all',
    callback: (event: any) => void,
    options: SubscriptionOptions = {}
  ): Promise<() => void> {
    // Subscribe to all logs for the program
    const subscriptionId = this.connection.onLogs(
      this.programId,
      (logs) => {
        // Parse logs and filter by event type
        callback({
          type: eventType,
          data: logs,
        });
      },
      options.commitment || this.commitment
    );

    // Return unsubscribe function
    return () => {
      this.connection.removeOnLogsListener(subscriptionId);
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Gets the Solana connection instance
   *
   * @returns Connection instance
   */
  public getConnection(): Connection {
    return this.connection;
  }

  /**
   * Gets the program ID
   *
   * @returns Program ID public key
   */
  public getProgramId(): PublicKey {
    return this.programId;
  }

  /**
   * Gets the Guardian API base URL
   *
   * @returns Guardian API URL
   */
  public getGuardianApiUrl(): string {
    return this.guardianApiUrl;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Gets or initializes the Guardian API client
   *
   * @returns Guardian client instance
   * @private
   */
  private async getGuardianClient(): Promise<any> {
    if (!this.guardianClient) {
      const { GuardianClient } = await import('../guardian/GuardianClient.js');
      this.guardianClient = new GuardianClient({
        baseUrl: this.guardianApiUrl,
        autoRetry: this.autoRetry,
        maxRetries: this.maxRetries,
      });
    }
    return this.guardianClient;
  }

  /**
   * Sends a transaction with retry logic and confirmation
   *
   * @param instructions - Transaction instructions
   * @param options - Transaction options
   * @returns Transaction signature
   * @private
   */
  private async sendTransaction(
    instructions: any[],
    options?: TransactionOptions
  ): Promise<string> {
    if (!this.wallet) {
      throw new MissingWalletError('Wallet must be connected to send transactions');
    }

    const { Transaction } = await import('@solana/web3.js');

    // Create transaction
    const tx = new Transaction();
    instructions.forEach((ix) => tx.add(ix));

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(
      options?.commitment || this.commitment
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.wallet.publicKey;

    // Sign transaction
    const signed = await this.wallet.signTransaction(tx);

    // Send with or without retry
    const shouldRetry = options?.autoRetry ?? this.autoRetry;
    const maxRetries = options?.maxRetries ?? this.maxRetries;

    const sendFn = async () => {
      const signature = await this.connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: options?.skipPreflight ?? false,
        maxRetries: 0, // We handle retries ourselves
      });

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        options?.commitment || this.commitment
      );

      if (confirmation.value.err) {
        throw new TransactionRejectedError(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          { context: { signature, error: confirmation.value.err } }
        );
      }

      return signature;
    };

    if (shouldRetry) {
      const { withRetry, isRetryableError } = await import('../utils/retry.js');
      return await withRetry(sendFn, {
        maxRetries,
        initialDelay: this.retryDelay,
        shouldRetry: isRetryableError,
      });
    } else {
      return await sendFn();
    }
  }

  /**
   * Handles errors and wraps them in appropriate Aegis error types
   *
   * @param error - Original error
   * @param context - Error context message
   * @returns Aegis error
   * @private
   */
  private handleError(error: unknown, context: string): Error {
    if (error instanceof AegisError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `${context}: ${errorMessage}`;

    // Check for specific Anchor/Solana errors and map to our error types
    const errorStr = errorMessage.toLowerCase();

    // Policy violations
    if (errorStr.includes('notwhitelisted') || errorStr.includes('12000')) {
      return new NotWhitelistedError(fullMessage, { cause: error as Error });
    }
    if (errorStr.includes('dailylimitexceeded') || errorStr.includes('12001')) {
      return new DailyLimitExceededError(fullMessage, { cause: error as Error });
    }
    if (errorStr.includes('vaultpaused') || errorStr.includes('12002')) {
      return new VaultPausedError(fullMessage, { cause: error as Error });
    }
    if (errorStr.includes('unauthorizedsigner') || errorStr.includes('12003')) {
      return new UnauthorizedSignerError(fullMessage, { cause: error as Error });
    }

    // Transaction errors
    if (errorStr.includes('insufficientfunds') || errorStr.includes('12008')) {
      return new InsufficientBalanceError(fullMessage, { cause: error as Error });
    }
    if (errorStr.includes('timeout')) {
      return new TransactionTimeoutError(fullMessage, { cause: error as Error });
    }

    // Network errors
    if (errorStr.includes('network') || errorStr.includes('connection')) {
      return new NetworkError(fullMessage, { cause: error as Error });
    }

    // Generic transaction error
    return new TransactionFailedError(fullMessage, { cause: error as Error });
  }
}
