#!/usr/bin/env node
'use strict';

/**
 * Antigravity Cross-Model MCP Server (LiteLLM Engine)
 * Standard JSON-RPC MCP server over STDIO.
 * Registers invoke_cross_agent and list_cross_models into Antigravity.
 */

const readline = require('readline');
const kernel = require('./index');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function getDynamicTools() {
  let supportedIds = [
    'deepseek-chat',
    'deepseek-reasoner',
    'nvidia-llama-3.3-70b',
    'nvidia-deepseek-r1',
    'nvidia-qwen-coder-32b',
    'claude-sonnet-4.5',
    'claude-opus-4.5',
    'gemini-2.5-flash',
    'gpt-4o'
  ];
  try {
    const models = kernel.listSupportedModels();
    if (Array.isArray(models) && models.length > 0) {
      supportedIds = models.map((m) => m.id);
    }
  } catch (_) {}

  return [
    {
      name: 'invoke_cross_agent',
      description:
        'Invoke an autonomous subagent powered by any external AI model via LiteLLM (DeepSeek API, NVIDIA NIM API, OpenRouter, Gemini, OpenAI, Anthropic, Groq, or custom LiteLLM model IDs). The subagent executes with full workspace tools (read, write, edit, run command) and returns synthesized results to the parent model.',
      inputSchema: {
        type: 'object',
        properties: {
          targetModel: {
            type: 'string',
            description: `Target model ID or LiteLLM model string (e.g. 'deepseek-chat', 'deepseek-reasoner', 'nvidia-llama-3.3-70b', 'nvidia-deepseek-r1', 'nvidia-qwen-coder-32b', 'nvidia_nim/meta/llama-3.3-70b-instruct', 'deepseek/deepseek-chat', 'claude-sonnet-4.5'). Configured models: ${supportedIds.join(', ')}`
          },
          role: {
            type: 'string',
            description: "Descriptive role for the subagent, e.g. 'Senior Refactorer', 'Test Engineer', 'Deep Reasoner'."
          },
          prompt: {
            type: 'string',
            description: 'Detailed instructions and task description for the subagent.'
          },
          workspace: {
            type: 'string',
            description: 'Absolute path to the workspace directory. Defaults to current workspace.'
          }
        },
        required: ['targetModel', 'role', 'prompt']
      }
    },
    {
      name: 'list_cross_models',
      description: 'List all available LiteLLM cross-model engines, providers, and their current authentication readiness.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch (err) {
    return;
  }

  const { id, method, params } = req;

  switch (method) {
    case 'initialize': {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'antigravity-cross-model',
            version: '2.0.0'
          }
        }
      });
      break;
    }

    case 'notifications/initialized': {
      break;
    }

    case 'ping': {
      send({ jsonrpc: '2.0', id, result: {} });
      break;
    }

    case 'tools/list': {
      send({
        jsonrpc: '2.0',
        id,
        result: { tools: getDynamicTools() }
      });
      break;
    }

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName === 'list_cross_models') {
        const models = kernel.listSupportedModels();
        send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(models, null, 2)
              }
            ]
          }
        });
        return;
      }

      if (toolName === 'invoke_cross_agent') {
        try {
          const outcome = await kernel.invokeCrossAgent({
            targetModel: args.targetModel,
            role: args.role,
            prompt: args.prompt,
            workspace: args.workspace || process.cwd()
          });

          const summary = [
            `### Cross-Model Subagent Execution Completed (LiteLLM)`,
            `- **Model**: \`${outcome.targetModel}\``,
            `- **Role**: ${outcome.role}`,
            `- **Turns**: ${outcome.turns}`,
            outcome.executionLog && outcome.executionLog.length
              ? `\n**Tool Executions:**\n${outcome.executionLog.map((l) => `- ${l}`).join('\n')}\n`
              : '',
            `\n**Subagent Response:**\n${outcome.finalContent}`
          ].join('\n');

          send({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: summary
                }
              ]
            }
          });
        } catch (err) {
          send({
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Failed to execute cross-model agent: ${err.message}`
                }
              ]
            }
          });
        }
        return;
      }

      send({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Tool not found: ${toolName}`
        }
      });
      break;
    }

    default: {
      send({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      });
      break;
    }
  }
});
