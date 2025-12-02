/**
 * Guardian API HTTP client for off-chain data and analytics
 * @module guardian/GuardianClient
 */

import type {
  GuardianVault,
  GuardianTransaction,
  GuardianOverride,
  VaultAnalytics,
  PaginatedResponse,
  TransactionHistoryOptions,
  AnalyticsOptions,
} from '../types/index.js';
import { GuardianApiError, NetworkError } from '../errors/index.js';

/**
 * Guardian API client options
 */
export interface GuardianClientOptions {
  /**
   * Base URL for the Guardian API
   * @default 'http://localhost:3000'
   */
  baseUrl?: string;

  /**
   * API key for authentication (optional)
   */
  apiKey?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Enable automatic retry on transient failures
   * @default true
   */
  autoRetry?: boolean;

  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxRetries?: number;
}

/**
 * HTTP client for interacting with the Aegis Guardian API
 *
 * This client provides methods for querying off-chain data, transaction history,
 * analytics, and managing override requests through the Guardian backend.
 *
 * @example
 * ```typescript
 * const guardian = new GuardianClient({
 *   baseUrl: 'https://api.aegis.com',
 *   apiKey: 'your-api-key',
 * });
 *
 * const vault = await guardian.getVault('VaultPublicKey...');
 * console.log('Vault name:', vault.name);
 * ```
 */
export class GuardianClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly autoRetry: boolean;
  private readonly maxRetries: number;

  /**
   * Creates a new GuardianClient instance
   *
   * @param options - Client configuration options
   */
  constructor(options: GuardianClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
    this.autoRetry = options.autoRetry ?? true;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Fetches vault data from Guardian API (includes off-chain metadata)
   *
   * @param vaultAddress - Vault public key
   * @returns Guardian vault data
   *
   * @example
   * ```typescript
   * const vault = await guardian.getVault('VaultPublicKey...');
   * console.log('Daily limit:', vault.dailyLimit);
   * console.log('Whitelist:', vault.whitelist);
   * ```
   */
  public async getVault(vaultAddress: string): Promise<GuardianVault> {
    return this.request<GuardianVault>(`/api/vaults/${vaultAddress}`);
  }

  /**
   * Fetches transaction history from Guardian API
   *
   * @param options - Query options and filters
   * @returns Paginated transaction history
   *
   * @example
   * ```typescript
   * const history = await guardian.getTransactionHistory({
   *   vault: 'VaultPublicKey...',
   *   status: 'EXECUTED',
   *   page: 1,
   *   limit: 20,
   * });
   * ```
   */
  public async getTransactionHistory(
    options: TransactionHistoryOptions = {}
  ): Promise<PaginatedResponse<GuardianTransaction>> {
    const params = new URLSearchParams();

    if (options.vault) params.append('vault', options.vault);
    if (options.status) params.append('status', options.status);
    if (options.startDate) params.append('startDate', options.startDate.toISOString());
    if (options.endDate) params.append('endDate', options.endDate.toISOString());
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `/api/transactions?${queryString}` : '/api/transactions';

    return this.request<PaginatedResponse<GuardianTransaction>>(url);
  }

  /**
   * Fetches spending analytics for a vault
   *
   * @param vaultAddress - Vault public key
   * @param options - Analytics options
   * @returns Vault analytics data
   *
   * @example
   * ```typescript
   * const analytics = await guardian.getAnalytics('VaultPublicKey...', {
   *   timeframe: '30d',
   *   groupBy: 'day',
   * });
   * ```
   */
  public async getAnalytics(
    vaultAddress: string,
    options: AnalyticsOptions = {}
  ): Promise<VaultAnalytics> {
    const params = new URLSearchParams();

    if (options.timeframe) params.append('timeframe', options.timeframe);
    if (options.groupBy) params.append('groupBy', options.groupBy);

    const queryString = params.toString();
    const url = queryString
      ? `/api/vaults/${vaultAddress}/analytics?${queryString}`
      : `/api/vaults/${vaultAddress}/analytics`;

    return this.request<VaultAnalytics>(url);
  }

  /**
   * Creates an override request in the Guardian database
   *
   * This is typically called after the on-chain override is created
   * to register it in the Guardian database and generate a Blink URL.
   *
   * @param vaultAddress - Vault public key
   * @param nonce - Override nonce
   * @param data - Override request data
   * @returns Override data with Blink URL
   *
   * @example
   * ```typescript
   * const override = await guardian.createOverrideRequest('VaultPublicKey...', '1', {
   *   destination: 'DestinationPublicKey...',
   *   amount: '1000000000',
   *   reason: 'Emergency withdrawal',
   * });
   * console.log('Approve at:', override.blinkUrl);
   * ```
   */
  public async createOverrideRequest(
    vaultAddress: string,
    nonce: string,
    data: {
      destination: string;
      amount: string;
      reason: string;
    }
  ): Promise<GuardianOverride> {
    return this.request<GuardianOverride>(`/api/vaults/${vaultAddress}/overrides`, {
      method: 'POST',
      body: {
        nonce,
        ...data,
      },
    });
  }

  /**
   * Fetches override request details
   *
   * @param vaultAddress - Vault public key
   * @param nonce - Override nonce
   * @returns Override details
   *
   * @example
   * ```typescript
   * const override = await guardian.getOverride('VaultPublicKey...', '1');
   * console.log('Status:', override.status);
   * console.log('Blink URL:', override.blinkUrl);
   * ```
   */
  public async getOverride(vaultAddress: string, nonce: string): Promise<GuardianOverride> {
    return this.request<GuardianOverride>(`/api/vaults/${vaultAddress}/overrides/${nonce}`);
  }

  /**
   * Makes an HTTP request to the Guardian API
   *
   * @param path - API endpoint path
   * @param options - Request options
   * @returns Response data
   * @private
   */
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const method = options.method || 'GET';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (options.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    const fetchFn = async (): Promise<T> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const fetch = (await import('cross-fetch')).default;
        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new GuardianApiError(
            `Guardian API error: ${response.status} ${response.statusText}`,
            {
              context: {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
                url,
                method,
              },
            }
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof GuardianApiError) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw new NetworkError(`Request to ${url} timed out after ${this.timeout}ms`, {
            cause: error,
          });
        }

        throw new NetworkError(`Network request failed: ${error}`, {
          cause: error instanceof Error ? error : undefined,
          context: { url, method },
        });
      }
    };

    if (this.autoRetry) {
      const { withRetry, isRetryableError } = await import('../utils/retry.js');
      return await withRetry(fetchFn, {
        maxRetries: this.maxRetries,
        initialDelay: 1000,
        shouldRetry: (error) => {
          // Don't retry 4xx errors (client errors)
          if (error instanceof GuardianApiError) {
            const status = (error.context as any)?.status;
            return !status || status >= 500; // Only retry 5xx errors
          }
          return isRetryableError(error);
        },
      });
    } else {
      return await fetchFn();
    }
  }
}
