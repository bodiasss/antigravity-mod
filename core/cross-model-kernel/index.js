'use strict';

/**
 * Antigravity Cross-Model Subagent Kernel
 * Main export: enables any active model (Gemini 4 Pro, etc.) to invoke subagents
 * running on Claude Sonnet 3.5, DeepSeek, GPT-4o, Gemini 3.8 Flash, or Qwen.
 */

const runner = require('./subagent-runner');
const router = require('./model-router');
const secrets = require('./secrets-manager');

async function invokeCrossAgent({ targetModel, role, prompt, workspace, maxTurns, onProgress }) {
  if (!targetModel) targetModel = 'claude-sonnet-3.5';
  if (!role) role = 'Cross-Model Assistant';
  if (!prompt) throw new Error('Prompt is required to invoke cross-agent');

  return runner.run({
    targetModel,
    role,
    prompt,
    workspace: workspace || process.cwd(),
    maxTurns: maxTurns || 8,
    onProgress
  });
}

function listSupportedModels() {
  return router.listSupportedModels();
}

module.exports = {
  invokeCrossAgent,
  listSupportedModels,
  runner,
  router,
  secrets
};
