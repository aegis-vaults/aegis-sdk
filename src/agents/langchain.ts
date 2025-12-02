/**
 * LangChain tool integration for Aegis SDK
 * @module agents/langchain
 *
 * This module provides LangChain-compatible tool wrappers for Aegis SDK.
 * Note: This requires @langchain/core as a peer dependency.
 */

import type { AegisClient } from '../client/AegisClient.js';

/**
 * Creates LangChain-compatible tool definitions for Aegis SDK
 *
 * @param client - Aegis SDK client instance
 * @returns Array of LangChain tool objects
 *
 * @example
 * ```typescript
 * import { AegisClient } from '@aegis/sdk';
 * import { createLangChainTools } from '@aegis/sdk/agents';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
 *
 * const aegis = new AegisClient({...});
 * const tools = createLangChainTools(aegis);
 * const llm = new ChatOpenAI({ model: 'gpt-4' });
 *
 * const agent = createOpenAIFunctionsAgent({ llm, tools, prompt });
 * const executor = new AgentExecutor({ agent, tools });
 *
 * const result = await executor.invoke({
 *   input: 'Send 0.5 SOL to Alice',
 * });
 * ```
 */
export function createLangChainTools(client: AegisClient): any[] {
  // Generic tool factory that works with LangChain's DynamicStructuredTool
  const createTool = (config: {
    name: string;
    description: string;
    schema: any;
    func: (input: any) => Promise<string>;
  }) => ({
    name: config.name,
    description: config.description,
    schema: config.schema,
    func: config.func,
  });

  return [
    createTool({
      name: 'aegis_execute_transaction',
      description: 'Execute a policy-guarded transaction from an Aegis vault',
      schema: {
        type: 'object',
        properties: {
          vault: { type: 'string', description: 'Vault address' },
          destination: { type: 'string', description: 'Destination address' },
          amount: { type: 'number', description: 'Amount in lamports' },
          purpose: { type: 'string', description: 'Transaction purpose' },
        },
        required: ['vault', 'destination', 'amount'],
      },
      func: async (input: any) => {
        try {
          const signature = await client.executeGuarded({
            vault: input.vault,
            destination: input.destination,
            amount: BigInt(input.amount),
            purpose: input.purpose,
          });
          return `Transaction executed successfully. Signature: ${signature}`;
        } catch (error) {
          return `Transaction failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }),

    createTool({
      name: 'aegis_get_vault',
      description: 'Fetch vault configuration and current state',
      schema: {
        type: 'object',
        properties: {
          vaultAddress: { type: 'string', description: 'Vault address' },
        },
        required: ['vaultAddress'],
      },
      func: async (input: any) => {
        try {
          const vault = await client.getVault(input.vaultAddress);
          return JSON.stringify({
            name: vault.name,
            dailyLimit: vault.dailyLimit.toString(),
            spentToday: vault.spentToday.toString(),
            whitelistCount: vault.whitelistCount,
            paused: vault.paused,
          }, null, 2);
        } catch (error) {
          return `Failed to fetch vault: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }),

    createTool({
      name: 'aegis_request_override',
      description: 'Request manual approval for a blocked transaction',
      schema: {
        type: 'object',
        properties: {
          vault: { type: 'string', description: 'Vault address' },
          destination: { type: 'string', description: 'Destination address' },
          amount: { type: 'number', description: 'Amount in lamports' },
          reason: { type: 'string', description: 'Reason for override' },
        },
        required: ['vault', 'destination', 'amount', 'reason'],
      },
      func: async (input: any) => {
        try {
          const result = await client.requestOverride({
            vault: input.vault,
            destination: input.destination,
            amount: BigInt(input.amount),
            reason: input.reason,
          });
          return `Override requested. Approve at: ${result.blinkUrl}`;
        } catch (error) {
          return `Failed to request override: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }),

    createTool({
      name: 'aegis_get_transaction_history',
      description: 'Fetch recent transaction history for a vault',
      schema: {
        type: 'object',
        properties: {
          vault: { type: 'string', description: 'Vault address (optional)' },
          limit: { type: 'number', description: 'Number of transactions to fetch' },
        },
        required: [],
      },
      func: async (input: any) => {
        try {
          const history = await client.getTransactionHistory({
            vault: input.vault,
            limit: input.limit || 10,
          });
          return JSON.stringify(history.data, null, 2);
        } catch (error) {
          return `Failed to fetch transaction history: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    }),
  ];
}
