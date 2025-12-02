/**
 * AI agent integration helpers (OpenAI, LangChain, Anthropic)
 *
 * This module provides optional adapters for integrating Aegis SDK
 * with popular AI frameworks. These are exported separately to avoid
 * requiring AI provider dependencies for users who don't need them.
 *
 * @module agents
 *
 * @example
 * ```typescript
 * import { createOpenAITools } from '@aegis/sdk/agents';
 * import { AegisClient } from '@aegis/sdk';
 *
 * const client = new AegisClient({...});
 * const tools = createOpenAITools(client);
 *
 * // Use with OpenAI function calling
 * const completion = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [...],
 *   tools,
 * });
 * ```
 */

// Re-export all agent integrations
export * from './openai.js';
export * from './langchain.js';
export * from './anthropic.js';
