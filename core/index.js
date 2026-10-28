'use strict';

/**
 * Antigravity Modding Framework - Main Entry Point
 * Exposes core singleton instances and one-line initialization for Electron.
 */

const ModLoader = require('./mod-loader');
const dataService = require('./data-service');
const Injector = require('./injector');

const loader = new ModLoader();
const injector = new Injector(loader);

function init(options = {}) {
  try {
    require('./cross-model-kernel/ccpa-litellm-gateway').startGateway();
  } catch (err) {
    console.error('[AntigravityMod] Failed to start LiteLLM CCPA Gateway:', err.message);
  }

  let electron = null;
  try {
    electron = require('electron');
  } catch (_) {
    // Standalone or non-electron runtime
  }

  if (electron && electron.app) {
    injector.init(
      electron.app,
      electron.session,
      electron.BrowserWindow,
      electron.globalShortcut,
      electron.ipcMain
    );
  } else {
    loader.discoverModules();
  }

  return {
    loader,
    dataService,
    injector
  };
}

module.exports = {
  init,
  loader,
  dataService,
  injector
};
