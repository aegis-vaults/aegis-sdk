/**
 * OpenAI function calling integration for Aegis SDK
 * @module agents/openai
 */

import type { AegisClient } from '../client/AegisClient.js';

/**
 * OpenAI function calling tool definition
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * Creates OpenAI function calling tool definitions for the Aegis SDK
 *
 * These tool definitions can be used with OpenAI's function calling API
 * to enable AI agents to interact with vaults and execute transactions.
 *
 * @param client - Aegis SDK client instance
 * @returns Array of OpenAI tool definitions
 *
 * @example
 * ```typescript
 * import { AegisClient } from '@aegis-vaults/sdk';
 * import { createOpenAITools } from '@aegis-vaults/sdk/agents';
 * import OpenAI from 'openai';
 *
 * const aegis = new AegisClient({...});
 * const tools = createOpenAITools(aegis);
 * const openai = new OpenAI({...});
 *
 * const completion = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Send 0.1 SOL to Alice' }],
 *   tools,
 *   tool_choice: 'auto',
 * });
 *
 * // Handle function calls
 * for (const choice of completion.choices) {
 *   if (choice.message.tool_calls) {
 *     for (const toolCall of choice.message.tool_calls) {
 *       const result = await executeAegisTool(aegis, toolCall);
 *       console.log('Result:', result);
 *     }
 *   }
 * }
 * ```
 */
export function createOpenAITools(_client: AegisClient): OpenAITool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'aegis_create_vault',
        description: 'Create a new Aegis vault with spending limits and policy controls',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Human-readable name for the vault (max 50 characters)',
            },
            agentSigner: {
              type: 'string',
              description: 'Public key of the AI agent authorized to propose transactions',
            },
            dailyLimit: {
              type: 'number',
              description: 'Maximum amount that can be spent per day in lamports (1 SOL = 1,000,000,000 lamports)',
            },
          },
          required: ['name', 'agentSigner', 'dailyLimit'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aegis_execute_transaction',
        description: 'Execute an agent-signed transaction from a vault. The agent can autonomously execute transactions within policy constraints (daily limits, whitelist).',
        parameters: {
          type: 'object',
          properties: {
            vault: {
              type: 'string',
              description: 'Vault address (public key)',
            },
            destination: {
              type: 'string',
              description: 'Destination wallet address (public key) - must be whitelisted',
            },
            amount: {
              type: 'number',
              description: 'Amount to send in lamports (1 SOL = 1,000,000,000 lamports)',
            },
            vaultNonce: {
              type: 'number',
              description: 'Vault nonce used for PDA derivation (from vault creation)',
            },
            purpose: {
              type: 'string',
              description: 'Optional description of the transaction purpose',
            },
          },
          required: ['vault', 'destination', 'amount', 'vaultNonce'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aegis_request_override',
        description: 'Request manual approval for a transaction that was blocked by policy (daily limit exceeded or not whitelisted)',
        parameters: {
          type: 'object',
          properties: {
            vault: {
              type: 'string',
              description: 'Vault address (public key)',
            },
            destination: {
              type: 'string',
              description: 'Destination wallet address (public key)',
            },
            amount: {
              type: 'number',
              description: 'Amount to send in lamports (1 SOL = 1,000,000,000 lamports)',
            },
            reason: {
              type: 'string',
              description: 'Reason for requesting the override (e.g., "Emergency withdrawal", "Daily limit exceeded")',
            },
          },
          required: ['vault', 'destination', 'amount', 'reason'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aegis_get_vault',
        description: 'Fetch vault configuration including balance, daily limit, spent today, and whitelist',
        parameters: {
          type: 'object',
          properties: {
            vaultAddress: {
              type: 'string',
              description: 'Vault address (public key)',
            },
          },
          required: ['vaultAddress'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aegis_get_vault_balance',
        description: 'Get the current balance of a vault in SOL',
        parameters: {
          type: 'object',
          properties: {
            vaultAddress: {
              type: 'string',
              description: 'Vault address (public key)',
            },
          },
          required: ['vaultAddress'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aegis_get_transaction_history',
        description: 'Fetch transaction history for a vault with optional filters',
        parameters: {
          type: 'object',
          properties: {
            vault: {
              type: 'string',
              description: 'Vault address to filter by (optional)',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'EXECUTED', 'BLOCKED', 'FAILED'],
              description: 'Filter by transaction status (optional)',
            },
            limit: {
              type: 'number',
              description: 'Number of transactions to return (default: 20)',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aegis_add_to_whitelist',
        description: 'Add an address to the vault whitelist. Only whitelisted addresses can receive funds.',
        parameters: {
          type: 'object',
          properties: {
            vault: {
              type: 'string',
              description: 'Vault address (public key)',
            },
            vaultNonce: {
              type: 'number',
              description: 'Vault nonce used for PDA derivation (from vault creation)',
            },
            address: {
              type: 'string',
              description: 'Address to whitelist (public key)',
            },
          },
          required: ['vault', 'vaultNonce', 'address'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'aegis_update_daily_limit',
        description: 'Update the daily spending limit for a vault',
        parameters: {
          type: 'object',
          properties: {
            vault: {
              type: 'string',
              description: 'Vault address (public key)',
            },
            dailyLimit: {
              type: 'number',
              description: 'New daily limit in lamports (1 SOL = 1,000,000,000 lamports)',
            },
          },
          required: ['vault', 'dailyLimit'],
        },
      },
    },
  ];
}

/**
 * Executes an Aegis tool function call from OpenAI
 *
 * @param aegisClient - Aegis SDK client instance
 * @param toolCall - OpenAI tool call object
 * @returns Tool execution result
 *
 * @example
 * ```typescript
 * const result = await executeAegisTool(aegis, {
 *   id: 'call_123',
 *   type: 'function',
 *   function: {
 *     name: 'aegis_execute_transaction',
 *     arguments: '{"vault": "...", "destination": "...", "amount": 100000000}'
 *   }
 * });
 * ```
 */
export async function executeAegisTool(
  aegisClient: AegisClient,
  toolCall: {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }
): Promise<any> {
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr);

  try {
    switch (name) {
      case 'aegis_create_vault':
        return await aegisClient.createVault({
          name: args.name,
          agentSigner: args.agentSigner,
          dailyLimit: BigInt(args.dailyLimit),
        });

      case 'aegis_execute_transaction':
        // Use executeAgent for agent-signed transactions
        // If the transaction is blocked, the SDK will automatically notify Guardian
        // and the error will contain the blinkUrl for the vault owner to approve
        try {
          return await aegisClient.executeAgent({
            vault: args.vault,
            destination: args.destination,
            amount: BigInt(args.amount),
            vaultNonce: BigInt(args.vaultNonce || 0),
            purpose: args.purpose,
          });
        } catch (error: any) {
          // Check if this is a blocked transaction with override requested
          if (error.overrideRequested) {
            return {
              success: false,
              blocked: true,
              overrideRequested: true,
              transactionId: error.transactionId,
              blinkUrl: error.blinkUrl,
              actionUrl: error.actionUrl,
              reason: error.code || 'PolicyViolation',
              message: `Transaction blocked: ${error.code || 'Policy violation'}. ` +
                       `An override request has been sent to the vault owner. ` +
                       `They can approve it using this Blink URL: ${error.blinkUrl}`,
            };
          }
          throw error;
        }

      case 'aegis_request_override':
        return await aegisClient.requestOverride({
          vault: args.vault,
          destination: args.destination,
          amount: BigInt(args.amount),
          reason: args.reason,
        });

      case 'aegis_get_vault': {
        const vault = await aegisClient.getVault(args.vaultAddress);
        // Convert BN values to strings for JSON serialization
        return {
          authority: vault.authority.toBase58(),
          agentSigner: vault.agentSigner.toBase58(),
          dailyLimit: vault.dailyLimit.toString(),
          spentToday: vault.spentToday.toString(),
          lastReset: vault.lastReset.toString(),
          whitelist: vault.whitelist.map(addr => addr.toBase58()),
          name: vault.name,
          paused: vault.paused,
        };
      }

      case 'aegis_get_vault_balance': {
        const [vaultAuthorityPda] = aegisClient.deriveVaultAuthorityAddress(args.vaultAddress);
        const balance = await aegisClient.getConnection().getBalance(vaultAuthorityPda);
        return {
          balance,
          balanceSOL: balance / 1_000_000_000,
        };
      }

      case 'aegis_get_transaction_history':
        return await aegisClient.getTransactionHistory(args);

      case 'aegis_add_to_whitelist':
        return await aegisClient.addToWhitelist(args.vault, args.vaultNonce, args.address);

      case 'aegis_update_daily_limit':
        return await aegisClient.updatePolicy({
          vault: args.vault,
          dailyLimit: BigInt(args.dailyLimit),
        });

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : String(error),
      code: (error as any).code,
    };
  }
}
