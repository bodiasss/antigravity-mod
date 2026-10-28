'use strict';

/**
 * Autonomous Subagent Runner
 * Runs a full multi-turn reasoning and tool execution loop on ANY target model
 * (Claude, DeepSeek, GPT-4o, Gemini) and returns the final synthesis.
 */

const modelRouter = require('./model-router');
const ToolExecutor = require('./tool-executor');

class SubagentRunner {
  async run({ targetModel, role, prompt, workspace = process.cwd(), maxTurns = 8, onProgress }) {
    const executor = new ToolExecutor(workspace);
    const tools = executor.getToolDeclarations();

    const systemPrompt = `You are an expert autonomous subagent acting as: "${role}".
Workspace directory: ${workspace}

You have direct access to workspace tools:
- read_file: inspect code and configs
- write_file: create or overwrite files
- edit_file: modify existing code
- run_command: execute PowerShell commands to test, build, or verify

Rules:
1. Carry out the user prompt completely and rigorously.
2. Use tools when needed to inspect or modify code.
3. When your task is complete, summarize what you accomplished, the files changed, and evidence of verification.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    const executionLog = [];
    let turn = 0;

    if (onProgress) {
      onProgress(`[Subagent] Launching subagent "${role}" on model [${targetModel}]`);
    }

    while (turn < maxTurns) {
      turn++;
      let response;
      try {
        response = await modelRouter.sendChatCompletion({
          model: targetModel,
          messages,
          tools
        });
      } catch (err) {
        throw new Error(`Subagent on model [${targetModel}] encountered API error at turn ${turn}: ${err.message}`);
      }

      const choice = response?.choices?.[0];
      if (!choice) {
        throw new Error(`No response choices received from [${targetModel}] at turn ${turn}`);
      }

      const msg = choice.message;
      messages.push(msg);

      // Check if tool calls were requested
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          const fnName = tc.function?.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(tc.function?.arguments || '{}');
          } catch (_) {}

          const logMsg = `Tool Call [turn ${turn}]: ${fnName}(${JSON.stringify(fnArgs).slice(0, 80)})`;
          executionLog.push(logMsg);
          if (onProgress) onProgress(logMsg);

          const result = await executor.executeTool(fnName, fnArgs);

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: fnName,
            content: typeof result === 'string' ? result : JSON.stringify(result)
          });
        }
      } else {
        // Subagent finished
        const finalContent = msg.content || '';
        return {
          success: true,
          targetModel,
          role,
          turns: turn,
          finalContent,
          executionLog
        };
      }
    }

    // Reached max turns
    return {
      success: true,
      targetModel,
      role,
      turns: turn,
      finalContent: messages[messages.length - 1]?.content || 'Max turns reached without final response.',
      executionLog,
      maxTurnsReached: true
    };
  }
}

module.exports = new SubagentRunner();
