'use strict';

/**
 * Cross-Model Agents Module for Antigravity Modding Framework
 * Bridges parent conversational models with multi-model autonomous agents.
 */

const kernel = require('../../core/cross-model-kernel');

module.exports = {
  invokeCrossAgent: (options) => kernel.invokeCrossAgent(options),
  listSupportedModels: () => kernel.listSupportedModels(),

  onAppReady(app) {
    console.log('[CrossModelAgents] Kernel initialized. Available engines:',
      kernel.listSupportedModels().filter(m => m.ready).map(m => m.id).join(', ')
    );
  }
};
