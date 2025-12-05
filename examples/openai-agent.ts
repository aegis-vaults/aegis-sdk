/**
 * Aegis SDK - OpenAI Agent Example
 * 
 * This example shows how to integrate Aegis vaults with OpenAI function calling.
 * The AI agent can autonomously execute transactions within policy constraints.
 * 
 * Run with:
 *   OPENAI_API_KEY=xxx VAULT_ADDRESS=xxx AGENT_SECRET=xxx npx tsx examples/openai-agent.ts
 */

import { Keypair, Connection } from '@solana/web3.js';
import { AegisClient } from '../src';
import { createOpenAITools, executeAegisTool } from '../src/agents/openai';

// Configuration
const DEVNET_RPC = 'https://devnet.helius-rpc.com/?api-key=d0bb1f98-b8e3-4f52-9108-778ff3d7dcf1';
const GUARDIAN_URL = 'https://aegis-guardian-production.up.railway.app';

// OpenAI-compatible interface (you can use the actual OpenAI SDK)
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                  AEGIS + OPENAI AGENT EXAMPLE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Load configuration
  const vaultAddress = process.env.VAULT_ADDRESS;
  const vaultNonce = process.env.VAULT_NONCE || '0';
  const agentSecret = process.env.AGENT_SECRET;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!vaultAddress || !agentSecret) {
    console.log('Usage:');
    console.log('  VAULT_ADDRESS=xxx VAULT_NONCE=xxx AGENT_SECRET=xxx npx tsx examples/openai-agent.ts');
    console.log('');
    console.log('Optional:');
    console.log('  OPENAI_API_KEY=xxx  (for real OpenAI calls)');
    process.exit(1);
  }

  // Parse agent keypair
  let agentKeypair: Keypair;
  try {
    const jsonArray = JSON.parse(agentSecret);
    agentKeypair = Keypair.fromSecretKey(Uint8Array.from(jsonArray));
  } catch {
    console.error('❌ Failed to parse AGENT_SECRET');
    process.exit(1);
  }

  // Initialize Aegis client
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const aegis = new AegisClient({
    connection,
    guardianApiUrl: GUARDIAN_URL,
    autoRequestOverride: true,
  });
  aegis.setWallet(agentKeypair as any);

  console.log('✅ Aegis client initialized');
  console.log('   Vault:', vaultAddress);
  console.log('   Agent:', agentKeypair.publicKey.toBase58());
  console.log('');

  // Create OpenAI tools for Aegis
  const tools = createOpenAITools(aegis);
  console.log('📦 Available Aegis tools:');
  tools.forEach(tool => {
    console.log(`   - ${tool.function.name}: ${tool.function.description.slice(0, 60)}...`);
  });
  console.log('');

  // Simulate an AI conversation
  const userPrompt = process.argv[2] || 'Check my vault balance';
  console.log('💬 User prompt:', userPrompt);
  console.log('');

  // In a real implementation, you would call OpenAI here:
  //
  // const response = await openai.chat.completions.create({
  //   model: 'gpt-4',
  //   messages: [
  //     { role: 'system', content: systemPrompt },
  //     { role: 'user', content: userPrompt },
  //   ],
  //   tools,
  //   tool_choice: 'auto',
  // });
  //
  // Then process tool_calls and execute them with executeAegisTool()

  // For this example, we'll simulate the tool calls based on keywords
  console.log('🤖 Processing request...');
  console.log('');

  const promptLower = userPrompt.toLowerCase();

  if (promptLower.includes('balance')) {
    // Simulate: get vault balance
    const toolCall: ToolCall = {
      id: 'call_1',
      type: 'function',
      function: {
        name: 'aegis_get_vault_balance',
        arguments: JSON.stringify({ vaultAddress }),
      },
    };

    console.log('🔧 Calling tool:', toolCall.function.name);
    const result = await executeAegisTool(aegis, toolCall);
    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));
  }

  if (promptLower.includes('vault') && (promptLower.includes('info') || promptLower.includes('config') || promptLower.includes('status'))) {
    // Simulate: get vault info
    const toolCall: ToolCall = {
      id: 'call_2',
      type: 'function',
      function: {
        name: 'aegis_get_vault',
        arguments: JSON.stringify({ vaultAddress }),
      },
    };

    console.log('🔧 Calling tool:', toolCall.function.name);
    const result = await executeAegisTool(aegis, toolCall);
    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));
  }

  if (promptLower.includes('send') || promptLower.includes('transfer') || promptLower.includes('pay')) {
    // Parse amount and destination from prompt
    const amountMatch = userPrompt.match(/(\d+\.?\d*)\s*(sol|SOL)/);
    const addressMatch = userPrompt.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);

    if (!amountMatch || !addressMatch) {
      console.log('❓ Could not parse transfer request. Please include amount in SOL and destination address.');
      console.log('   Example: "Send 0.1 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"');
    } else {
      const amount = parseFloat(amountMatch[1]) * 1e9;
      const destination = addressMatch[1];

      const toolCall: ToolCall = {
        id: 'call_3',
        type: 'function',
        function: {
          name: 'aegis_execute_transaction',
          arguments: JSON.stringify({
            vault: vaultAddress,
            destination,
            amount,
            vaultNonce: parseInt(vaultNonce),
            purpose: userPrompt,
          }),
        },
      };

      console.log('🔧 Calling tool:', toolCall.function.name);
      console.log('   Destination:', destination);
      console.log('   Amount:', amount / 1e9, 'SOL');
      console.log('');

      const result = await executeAegisTool(aegis, toolCall);
      console.log('📊 Result:');
      console.log(JSON.stringify(result, null, 2));

      if (result.blocked) {
        console.log('');
        console.log('⏳ Transaction was blocked by vault policy.');
        console.log('   The vault owner has been notified and can approve at:');
        console.log('   ', result.blinkUrl);
      }
    }
  }

  if (promptLower.includes('history') || promptLower.includes('transactions')) {
    const toolCall: ToolCall = {
      id: 'call_4',
      type: 'function',
      function: {
        name: 'aegis_get_transaction_history',
        arguments: JSON.stringify({ vault: vaultAddress, limit: 5 }),
      },
    };

    console.log('🔧 Calling tool:', toolCall.function.name);
    const result = await executeAegisTool(aegis, toolCall);
    console.log('📊 Result:');
    console.log(JSON.stringify(result, null, 2));
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Example prompts to try:');
  console.log('  "Check my vault balance"');
  console.log('  "Show vault info"');
  console.log('  "Send 0.01 SOL to HMrBkPPnedC5qzeZfXcyaWxiBk74utEqGPGGJSos4MzA"');
  console.log('  "Show transaction history"');
  console.log('');
}

// System prompt for AI agent
const systemPrompt = `You are an AI financial assistant with access to an Aegis vault on Solana.
You can check balances, view vault configuration, send SOL transfers, and view transaction history.

IMPORTANT RULES:
1. Always check the vault balance before suggesting large transfers
2. If a transaction is blocked, explain that the vault owner will be notified to approve it
3. Amounts should be specified in SOL (1 SOL = 1,000,000,000 lamports)
4. Only send to addresses provided by the user
5. If unsure, ask for clarification before executing transactions

Available tools:
- aegis_get_vault_balance: Check vault balance
- aegis_get_vault: Get vault configuration (daily limit, whitelist, etc.)
- aegis_execute_transaction: Send SOL from the vault
- aegis_get_transaction_history: View past transactions
- aegis_request_override: Request approval for blocked transactions`;

main().catch(console.error);




