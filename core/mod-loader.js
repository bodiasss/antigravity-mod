'use strict';

/**
 * Antigravity Modding Framework - Core Mod Loader
 * Discovers, validates, initializes, and coordinates custom modules.
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ModLoader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rootDir = options.rootDir || path.resolve(__dirname, '..');
    this.modulesDir = options.modulesDir || path.join(this.rootDir, 'modules');
    this.modules = new Map();
    this.hooks = {
      onAppReady: [],
      onPreload: [],
      onWebContents: [],
      onUIInject: [],
      onModelRequest: []
    };
  }

  /**
   * Discover and register all modules located in the modules directory.
   */
  discoverModules() {
    console.log('[ModLoader] Scanning modules in:', this.modulesDir);
    if (!fs.existsSync(this.modulesDir)) {
      fs.mkdirSync(this.modulesDir, { recursive: true });
      return [];
    }

    const entries = fs.readdirSync(this.modulesDir, { withFileTypes: true });
    const discovered = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const modPath = path.join(this.modulesDir, entry.name);
        const manifestPath = path.join(modPath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const loaded = this.registerModule(manifest, modPath);
            if (loaded) discovered.push(loaded);
          } catch (err) {
            console.error(`[ModLoader] Failed to parse manifest for "${entry.name}":`, err.message);
          }
        }
      }
    }

    console.log(`[ModLoader] Successfully loaded ${this.modules.size} module(s).`);
    return discovered;
  }

  /**
   * Register a module given its manifest and root path.
   */
  registerModule(manifest, modPath) {
    if (!manifest.id || !manifest.name) {
      console.warn('[ModLoader] Invalid module manifest, missing id or name:', modPath);
      return null;
    }

    const entryFile = manifest.entry || 'index.js';
    const fullEntryPath = path.join(modPath, entryFile);
    let exportsObj = null;

    if (fs.existsSync(fullEntryPath)) {
      try {
        exportsObj = require(fullEntryPath);
      } catch (err) {
        console.error(`[ModLoader] Error executing module entry "${manifest.id}":`, err);
      }
    }

    const styleFile = manifest.style || (fs.existsSync(path.join(modPath, 'style.css')) ? 'style.css' : null);
    const fullStylePath = styleFile ? path.join(modPath, styleFile) : null;

    const moduleRecord = {
      manifest,
      path: modPath,
      entryPath: fullEntryPath,
      stylePath: fullStylePath,
      exports: exportsObj,
      enabled: true
    };

    this.modules.set(manifest.id, moduleRecord);

    // Register hooks if the module exposes them
    if (exportsObj && typeof exportsObj === 'object') {
      for (const hookName of Object.keys(this.hooks)) {
        if (typeof exportsObj[hookName] === 'function') {
          this.hooks[hookName].push({
            moduleId: manifest.id,
            fn: exportsObj[hookName].bind(exportsObj)
          });
        }
      }
    }

    this.emit('moduleRegistered', moduleRecord);
    return moduleRecord;
  }

  /**
   * Run a specific lifecycle hook across all subscribed modules safely.
   */
  async runHook(hookName, ...args) {
    const list = this.hooks[hookName] || [];
    for (const item of list) {
      try {
        await item.fn(...args);
      } catch (err) {
        console.error(`[ModLoader] Error in hook "${hookName}" from module "${item.moduleId}":`, err);
      }
    }
  }

  getModule(id) {
    return this.modules.get(id);
  }

  listModules() {
    return Array.from(this.modules.values()).map(m => ({
      id: m.manifest.id,
      name: m.manifest.name,
      version: m.manifest.version,
      type: m.manifest.type,
      description: m.manifest.description,
      path: m.path
    }));
  }
}

module.exports = ModLoader;
