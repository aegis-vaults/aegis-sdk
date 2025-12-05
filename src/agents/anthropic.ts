/**
 * Anthropic Claude tool integration for Aegis SDK
 * @module agents/anthropic
 */

import type { AegisClient } from '../client/AegisClient.js';

/**
 * Anthropic Claude tool definition
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Creates Anthropic Claude tool definitions for Aegis SDK
 *
 * @param client - Aegis SDK client instance
 * @returns Array of Anthropic tool definitions
 *
 * @example
 * ```typescript
 * import { AegisClient } from '@aegis-vaults/sdk';
 * import { createAnthropicTools, executeAegisAnthropicTool } from '@aegis-vaults/sdk/agents';
 * import Anthropic from '@anthropic-ai/sdk';
 *
 * const aegis = new AegisClient({...});
 * const tools = createAnthropicTools(aegis);
 * const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * const message = await anthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20251022',
 *   max_tokens: 1024,
 *   tools,
 *   messages: [{ role: 'user', content: 'Send 0.1 SOL to Alice' }],
 * });
 *
 * // Handle tool uses
 * for (const block of message.content) {
 *   if (block.type === 'tool_use') {
 *     const result = await executeAegisAnthropicTool(aegis, block);
 *     console.log('Result:', result);
 *   }
 * }
 * ```
 */
export function createAnthropicTools(_client: AegisClient): AnthropicTool[] {
  return [
    {
      name: 'aegis_execute_transaction',
      description: 'Execute an agent-signed transaction from an Aegis vault. The agent can autonomously execute transactions within policy constraints (daily limits, whitelist).',
      input_schema: {
        type: 'object',
        properties: {
          vault: {
            type: 'string',
            description: 'The vault address (Solana public key) to send funds from',
          },
          destination: {
            type: 'string',
            description: 'The destination wallet address (Solana public key) - must be whitelisted',
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
            description: 'Optional description of why this transaction is being made',
          },
        },
        required: ['vault', 'destination', 'amount', 'vaultNonce'],
      },
    },
    {
      name: 'aegis_get_vault',
      description: 'Fetch complete vault configuration and current state including balance, spending limits, whitelist, and policy settings',
      input_schema: {
        type: 'object',
        properties: {
          vaultAddress: {
            type: 'string',
            description: 'The vault address (Solana public key) to query',
          },
        },
        required: ['vaultAddress'],
      },
    },
    {
      name: 'aegis_request_override',
      description: 'Request manual approval for a transaction that was blocked by policy. This generates a Blink URL for human approval.',
      input_schema: {
        type: 'object',
        properties: {
          vault: {
            type: 'string',
            description: 'The vault address (Solana public key)',
          },
          destination: {
            type: 'string',
            description: 'The destination wallet address (Solana public key)',
          },
          amount: {
            type: 'number',
            description: 'Amount to send in lamports (1 SOL = 1,000,000,000 lamports)',
          },
          reason: {
            type: 'string',
            description: 'Explanation of why this override is needed (e.g., "Emergency withdrawal", "Daily limit exceeded for vendor payment")',
          },
        },
        required: ['vault', 'destination', 'amount', 'reason'],
      },
    },
    {
      name: 'aegis_get_transaction_history',
      description: 'Fetch recent transaction history with optional filtering by status, date range, and pagination',
      input_schema: {
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
            description: 'Number of transactions to return (default: 20, max: 100)',
          },
        },
        required: [],
      },
    },
    {
      name: 'aegis_get_analytics',
      description: 'Fetch spending analytics and insights for a vault including total volume, transaction counts, and trends',
      input_schema: {
        type: 'object',
        properties: {
          vaultAddress: {
            type: 'string',
            description: 'The vault address (Solana public key)',
          },
          timeframe: {
            type: 'string',
            enum: ['24h', '7d', '30d', '90d', 'all'],
            description: 'Time range for analytics (default: 30d)',
          },
        },
        required: ['vaultAddress'],
      },
    },
  ];
}

/**
 * Executes an Aegis tool function call from Anthropic Claude
 *
 * @param client - Aegis SDK client instance
 * @param toolUse - Anthropic tool use block
 * @returns Tool execution result
 *
 * @example
 * ```typescript
 * const result = await executeAegisAnthropicTool(aegis, {
 *   type: 'tool_use',
 *   id: 'toolu_123',
 *   name: 'aegis_execute_transaction',
 *   input: {
 *     vault: '...',
 *     destination: '...',
 *     amount: 100000000
 *   }
 * });
 * ```
 */
export async function executeAegisAnthropicTool(
  client: AegisClient,
  toolUse: {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, any>;
  }
): Promise<any> {
  const { name, input } = toolUse;

  try {
    switch (name) {
      case 'aegis_execute_transaction': {
        // Use executeAgent for agent-signed transactions
        const signature = await client.executeAgent({
          vault: input.vault,
          destination: input.destination,
          amount: BigInt(input.amount),
          vaultNonce: BigInt(input.vaultNonce || 0),
          purpose: input.purpose,
        });
        return {
          success: true,
          signature,
          message: `Agent transaction executed successfully. Signature: ${signature}`,
        };
      }

      case 'aegis_get_vault': {
        const vault = await client.getVault(input.vaultAddress);
        const [vaultAuthorityPda] = client.deriveVaultAuthorityAddress(input.vaultAddress);
        const balance = await client.getConnection().getBalance(vaultAuthorityPda);

        return {
          success: true,
          vault: {
            address: input.vaultAddress,
            name: vault.name,
            balance: balance,
            balanceSOL: balance / 1_000_000_000,
            dailyLimit: vault.dailyLimit.toString(),
            dailyLimitSOL: Number(vault.dailyLimit.toString()) / 1_000_000_000,
            spentToday: vault.spentToday.toString(),
            spentTodaySOL: Number(vault.spentToday.toString()) / 1_000_000_000,
            remainingToday: vault.dailyLimit.sub(vault.spentToday).toString(),
            remainingTodaySOL: Number(vault.dailyLimit.sub(vault.spentToday).toString()) / 1_000_000_000,
            whitelist: vault.whitelist.map(addr => addr.toBase58()),
            paused: vault.paused,
          },
        };
      }

      case 'aegis_request_override': {
        const result = await client.requestOverride({
          vault: input.vault,
          destination: input.destination,
          amount: BigInt(input.amount),
          reason: input.reason,
        });
        return {
          success: true,
          nonce: result.nonce,
          blinkUrl: result.blinkUrl,
          signature: result.signature,
          message: `Override requested. Human approval required at: ${result.blinkUrl}`,
        };
      }

      case 'aegis_get_transaction_history': {
        const history = await client.getTransactionHistory({
          vault: input.vault,
          status: input.status,
          limit: input.limit || 20,
        });
        return {
          success: true,
          transactions: history.data,
          pagination: history.pagination,
        };
      }

      case 'aegis_get_analytics': {
        const analytics = await client.getAnalytics(input.vaultAddress, {
          timeframe: input.timeframe || '30d',
        });
        return {
          success: true,
          analytics,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: (error as any).code,
    };
  }
}

/**
 * Creates a system prompt template for Claude with Aegis context
 *
 * @param vaultInfo - Optional vault information to include in the prompt
 * @returns System prompt string
 *
 * @example
 * ```typescript
 * const vault = await client.getVault('...');
 * const systemPrompt = createAegisSystemPrompt({
 *   vaultAddress: '...',
 *   name: vault.name,
 *   dailyLimit: vault.dailyLimit.toString(),
 * });
 *
 * const message = await anthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20251022',
 *   system: systemPrompt,
 *   messages: [...]
 * });
 * ```
 */
export function createAegisSystemPrompt(vaultInfo?: {
  vaultAddress?: string;
  name?: string;
  dailyLimit?: string;
  balance?: string;
}): string {
  let prompt = `You are an AI financial assistant with access to an Aegis vault on Solana. Aegis vaults provide secure, policy-controlled access to on-chain funds with the following features:

- **Daily Spending Limits**: Automatic enforcement of maximum daily spending
- **Whitelist Controls**: Only approved addresses can receive funds
- **Manual Override**: Blocked transactions can request human approval
- **Transaction History**: Full audit trail of all operations

When handling financial requests:
1. Always verify vault balance before attempting transactions
2. Check if the destination is whitelisted
3. Respect daily spending limits
4. If a transaction is blocked, explain why and offer to request an override
5. Convert between SOL and lamports correctly (1 SOL = 1,000,000,000 lamports)
6. Provide transaction signatures for verification

Safety guidelines:
- Never execute transactions without explicit user confirmation
- Always explain what you're about to do before taking action
- If something seems suspicious, ask for clarification
- Recommend using whitelists for recurring payments`;

  if (vaultInfo) {
    prompt += `\n\nCurrent Vault Information:\n`;
    if (vaultInfo.name) prompt += `- Name: ${vaultInfo.name}\n`;
    if (vaultInfo.vaultAddress) prompt += `- Address: ${vaultInfo.vaultAddress}\n`;
    if (vaultInfo.balance) {
      const balanceSOL = Number(vaultInfo.balance) / 1_000_000_000;
      prompt += `- Balance: ${balanceSOL.toFixed(4)} SOL (${vaultInfo.balance} lamports)\n`;
    }
    if (vaultInfo.dailyLimit) {
      const limitSOL = Number(vaultInfo.dailyLimit) / 1_000_000_000;
      prompt += `- Daily Limit: ${limitSOL.toFixed(4)} SOL (${vaultInfo.dailyLimit} lamports)\n`;
    }
  }

  return prompt;
}
