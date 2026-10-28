'use strict';

/**
 * Secrets & Provider Configuration Manager for Antigravity Mod (LiteLLM Kernel)
 * Synchronizes credentials across:
 * 1. %APPDATA%/AntigravitySwitcher/mod-settings.json (UI Settings)
 * 2. ~/.deepcode/settings.json & ~/.gemini/deepseek_api_key
 * 3. Process / Windows User Environment Variables (NVIDIA_API_KEY, DEEPSEEK_API_KEY, etc.)
 * 4. DPAPI secrets_store (OpenRouter)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const MOD_SETTINGS_FILE = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'AntigravitySwitcher',
  'mod-settings.json'
);

class SecretsManager {
  constructor() {
    this.cache = {};
    this.lastLoadAt = 0;
  }

  loadModSettings() {
    try {
      if (fs.existsSync(MOD_SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(MOD_SETTINGS_FILE, 'utf8')) || {};
      }
    } catch (_) {}
    return {};
  }

  getLitellmConfig() {
    const raw = this.loadModSettings();
    return (raw && raw.litellm) || {};
  }

  getProviderConfig(providerId) {
    const litellm = this.getLitellmConfig();
    const providers = litellm.providers || {};
    const saved = providers[providerId] || {};
    const apiKey = (saved.apiKey && String(saved.apiKey).trim()) || this.getKey(providerId) || '';
    return {
      id: providerId,
      enabled: saved.enabled !== false,
      apiKey,
      baseUrl: saved.baseUrl || this.getDefaultBaseUrl(providerId),
    };
  }

  getDefaultBaseUrl(providerId) {
    switch (providerId) {
      case 'deepseek':
        return 'https://api.deepseek.com/v1';
      case 'nvidia_nim':
      case 'nvidia':
        return 'https://integrate.api.nvidia.com/v1';
      case 'openrouter':
        return 'https://openrouter.ai/api/v1';
      case 'gemini':
        return 'https://generativelanguage.googleapis.com/v1beta/openai';
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'groq':
        return 'https://api.groq.com/openai/v1';
      case 'custom':
        return 'http://127.0.0.1:4000/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  getKey(providerId) {
    const id = String(providerId || '').toLowerCase();
    // Always check mod-settings.json first so UI edits take immediate effect
    const litellm = this.getLitellmConfig();
    const savedKey = litellm?.providers?.[id]?.apiKey;
    if (savedKey && String(savedKey).trim()) {
      return String(savedKey).trim();
    }

    switch (id) {
      case 'deepseek':
        return this.getDeepSeekKey();
      case 'nvidia':
      case 'nvidia_nim':
        return this.getNvidiaKey();
      case 'openrouter':
        return this.getOpenRouterKey();
      case 'gemini':
        return this.getGeminiKey();
      case 'openai':
        return process.env.OPENAI_API_KEY || null;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || null;
      case 'groq':
        return process.env.GROQ_API_KEY || null;
      case 'custom':
        return process.env.LITELLM_API_KEY || '';
      default:
        return null;
    }
  }

  getDeepSeekKey() {
    const litellm = this.getLitellmConfig();
    if (litellm?.providers?.deepseek?.apiKey) {
      return litellm.providers.deepseek.apiKey.trim();
    }
    if (this.cache.deepseek) return this.cache.deepseek;

    if (process.env.DEEPSEEK_API_KEY) {
      this.cache.deepseek = process.env.DEEPSEEK_API_KEY.trim();
      return this.cache.deepseek;
    }

    const deepcodePath = path.join(os.homedir(), '.deepcode', 'settings.json');
    if (fs.existsSync(deepcodePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(deepcodePath, 'utf8'));
        const k = data?.env?.API_KEY || data?.deepseek_api_key;
        if (k) {
          this.cache.deepseek = String(k).trim();
          return this.cache.deepseek;
        }
      } catch (_) {}
    }

    const geminiKeyPath = path.join(os.homedir(), '.gemini', 'deepseek_api_key');
    if (fs.existsSync(geminiKeyPath)) {
      try {
        this.cache.deepseek = fs.readFileSync(geminiKeyPath, 'utf8').trim();
        return this.cache.deepseek;
      } catch (_) {}
    }

    return null;
  }

  getNvidiaKey() {
    const litellm = this.getLitellmConfig();
    if (litellm?.providers?.nvidia_nim?.apiKey) {
      return litellm.providers.nvidia_nim.apiKey.trim();
    }
    if (this.cache.nvidia_nim) return this.cache.nvidia_nim;

    const envKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY;
    if (envKey) {
      this.cache.nvidia_nim = envKey.trim();
      return this.cache.nvidia_nim;
    }

    return null;
  }

  getGeminiKey() {
    const litellm = this.getLitellmConfig();
    if (litellm?.providers?.gemini?.apiKey) {
      return litellm.providers.gemini.apiKey.trim();
    }
    return process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
  }

  getOpenRouterKey() {
    const litellm = this.getLitellmConfig();
    if (litellm?.providers?.openrouter?.apiKey) {
      return litellm.providers.openrouter.apiKey.trim();
    }
    if (this.cache.openrouter) return this.cache.openrouter;

    if (process.env.OPENROUTER_API_KEY) {
      this.cache.openrouter = process.env.OPENROUTER_API_KEY.trim();
      return this.cache.openrouter;
    }

    const pyPaths = [
      path.join(os.homedir(), '.gemini', 'config', 'plugins', 'multipurpose-work-center', 'scripts', 'secrets_store.py'),
      path.join(os.homedir(), 'plugins', 'multipurpose-work-center', 'scripts', 'secrets_store.py'),
    ];
    for (const pyScript of pyPaths) {
      if (fs.existsSync(pyScript)) {
        try {
          const dir = path.dirname(pyScript);
          const out = execFileSync(
            'python',
            [
              '-c',
              `import sys; sys.path.insert(0, ${JSON.stringify(dir)}); import secrets_store; res = secrets_store.load(); print(res if isinstance(res, str) else (res.get('openrouter', '') if isinstance(res, dict) else ''))`,
            ],
            { encoding: 'utf8', timeout: 4000, windowsHide: true }
          ).trim();
          if (out && out.startsWith('sk-or-')) {
            this.cache.openrouter = out;
            return this.cache.openrouter;
          }
        } catch (_) {}
      }
    }

    return null;
  }
}

module.exports = new SecretsManager();
