'use strict';

/**
 * LiteLLM Multi-Provider Model Router for Antigravity Mod
 * Supports DeepSeek, NVIDIA NIM, OpenRouter, Google Gemini, OpenAI,
 * Anthropic, Groq, and Custom LiteLLM/OpenAI endpoints.
 */

const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');
const secretsManager = require('./secrets-manager');

const LITELLM_RUNNER = path.join(__dirname, 'litellm-runner.py');

/**
 * Single source of truth for "did this failure mean the quota/rate limit ran out?".
 * Accepts an Error, a string, or a plain object. Never throws.
 */
const QUOTA_PATTERNS = [
  '429',
  'resource_exhausted',
  'resource exhausted',
  'quota exceeded',
  'quota_exceeded',
  'rate limit',
  'rate_limit',
  'limit reached',
  'usage limit',
  "you've reached your limit",
  'insufficient_quota',
  'billing quota',
  'too many requests',
];

function isQuotaExhausted(err) {
  try {
    if (err === null || err === undefined) return false;

    if (typeof err === 'string') {
      const text = err.toLowerCase();
      return QUOTA_PATTERNS.some((p) => text.includes(p));
    }

    if (typeof err !== 'object') return false;

    const numeric = [err.status, err.statusCode, err.code, err.httpStatus];
    for (const value of numeric) {
      if (Number(value) === 429) return true;
    }

    const typeText = [err.type, err.code, err.name]
      .filter((v) => typeof v === 'string')
      .join(' ')
      .toLowerCase();
    if (typeText.includes('resource_exhausted') || typeText.includes('resource exhausted')) return true;

    const parts = [];
    if (typeof err.message === 'string') parts.push(err.message);
    if (typeof err.body === 'string') parts.push(err.body);
    if (typeof err.error === 'string') parts.push(err.error);
    if (err.error && typeof err.error === 'object') {
      if (typeof err.error.message === 'string') parts.push(err.error.message);
      if (typeof err.error.status === 'string') parts.push(err.error.status);
      if (Number(err.error.code) === 429) return true;
    }
    const text = parts.join(' ').toLowerCase();
    if (!text) return false;
    return QUOTA_PATTERNS.some((p) => text.includes(p));
  } catch (_) {
    return false;
  }
}

function asQuotaError(err, extra) {
  const message = err && err.message ? err.message : String(err);
  const wrapped = err instanceof Error ? err : new Error(message);
  if (extra && typeof extra === 'object') {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) wrapped[key] = value;
    }
  }
  wrapped.isQuota = isQuotaExhausted(wrapped);
  return wrapped;
}

const MODEL_ALIASES = {
  // DeepSeek Live V4 API models
  deepseek: { provider: 'deepseek', model: 'deepseek-flash', litellmModel: 'deepseek/deepseek-flash' },
  'deepseek-flash': { provider: 'deepseek', model: 'deepseek-flash', litellmModel: 'deepseek/deepseek-flash' },
  'deepseek-v4-pro': { provider: 'deepseek', model: 'deepseek-v4-pro', litellmModel: 'deepseek/deepseek-v4-pro' },
  'deepseek-v4-flash': { provider: 'deepseek', model: 'deepseek-v4-flash', litellmModel: 'deepseek/deepseek-v4-flash' },
  'deepseek-v4-flash-vision-exp': {
    provider: 'deepseek',
    model: 'deepseek-v4-flash-vision-exp',
    litellmModel: 'deepseek/deepseek-v4-flash-vision-exp',
  },
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-flash', litellmModel: 'deepseek/deepseek-flash' },
  'deepseek-v3': { provider: 'deepseek', model: 'deepseek-flash', litellmModel: 'deepseek/deepseek-flash' },
  'deepseek-r1': { provider: 'deepseek', model: 'deepseek-v4-pro', litellmModel: 'deepseek/deepseek-v4-pro' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-v4-pro', litellmModel: 'deepseek/deepseek-v4-pro' },

  // NVIDIA NIM
  'nvidia-nemotron-70b': {
    provider: 'nvidia_nim',
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    litellmModel: 'nvidia_nim/nvidia/llama-3.1-nemotron-70b-instruct',
  },
  'nvidia-mistral-large-2': {
    provider: 'nvidia_nim',
    model: 'mistralai/mistral-large-2-instruct',
    litellmModel: 'nvidia_nim/mistralai/mistral-large-2-instruct',
  },
  'nvidia-gemma-3-27b': {
    provider: 'nvidia_nim',
    model: 'google/gemma-3-27b-it',
    litellmModel: 'nvidia_nim/google/gemma-3-27b-it',
  },

  // OpenRouter / Claude / GPT / Qwen
  'claude-sonnet-5.5': {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    litellmModel: 'openrouter/anthropic/claude-sonnet-4',
  },
  'claude-opus-5.5': {
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4',
    litellmModel: 'openrouter/anthropic/claude-opus-4',
  },
  'claude-sonnet': {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    litellmModel: 'openrouter/anthropic/claude-sonnet-4',
  },
  claude: {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    litellmModel: 'openrouter/anthropic/claude-sonnet-4',
  },
  'gpt-4o': {
    provider: 'openrouter',
    model: 'openai/gpt-4o',
    litellmModel: 'openrouter/openai/gpt-4o',
  },
  'qwen-coder': {
    provider: 'openrouter',
    model: 'qwen/qwen-2.5-coder-32b-instruct',
    litellmModel: 'openrouter/qwen/qwen-2.5-coder-32b-instruct',
  },

  // Gemini
  'gemini-3.8-flash': {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    litellmModel: 'gemini/gemini-2.5-flash',
  },
  'gemini-2.5-flash': {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    litellmModel: 'gemini/gemini-2.5-flash',
  },
  'gemini-2.5-pro': {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    litellmModel: 'gemini/gemini-2.5-pro',
  },
};

class ModelRouter {
  /**
   * Resolves a model ID, alias, or LiteLLM string into { provider, apiModel, litellmModel, maxTokens }.
   */
  resolveTarget(modelOrAlias, explicitProvider, conversationId) {
    const litellmCfg = secretsManager.getLitellmConfig();
    const configuredModels = Array.isArray(litellmCfg.models) ? litellmCfg.models : [];
    const perConvModel =
      typeof conversationId === 'string' && conversationId.trim() &&
      litellmCfg.perConversationModels &&
      litellmCfg.perConversationModels[conversationId]
        ? litellmCfg.perConversationModels[conversationId]
        : null;
    const raw = String(modelOrAlias || perConvModel || litellmCfg.defaultModel || 'deepseek-chat').trim();
    const lower = raw.toLowerCase();

    // 1. Check user-configured models in mod-settings.json
    const customMatch = configuredModels.find(
      (m) =>
        String(m.id || '').toLowerCase() === lower ||
        String(m.litellmModel || '').toLowerCase() === lower ||
        String(m.name || '').toLowerCase() === lower
    );
    if (customMatch) {
      const provider = explicitProvider || customMatch.provider || 'deepseek';
      const lm = customMatch.litellmModel || `${provider}/${customMatch.id}`;
      const apiModel = this.stripProviderPrefix(lm, provider);
      return {
        id: customMatch.id,
        name: customMatch.name || customMatch.id,
        provider,
        apiModel,
        litellmModel: lm,
        maxTokens: customMatch.maxTokens || 4096,
      };
    }

    // 2. Check built-in aliases
    if (MODEL_ALIASES[lower]) {
      const entry = MODEL_ALIASES[lower];
      const provider = explicitProvider || entry.provider;
      // If Gemini alias requested but no direct Gemini key, fall back to OpenRouter if available
      if (provider === 'gemini' && !secretsManager.getKey('gemini') && secretsManager.getKey('openrouter')) {
        return {
          id: lower,
          name: raw,
          provider: 'openrouter',
          apiModel: `google/${entry.model}`,
          litellmModel: `openrouter/google/${entry.model}`,
          maxTokens: 4096,
        };
      }
      return {
        id: lower,
        name: raw,
        provider,
        apiModel: entry.model,
        litellmModel: entry.litellmModel,
        maxTokens: 4096,
      };
    }

    // 3. Check LiteLLM prefix syntax: <provider>/<model>
    if (raw.includes('/')) {
      const firstSlash = raw.indexOf('/');
      const prefix = raw.slice(0, firstSlash).toLowerCase();
      const rest = raw.slice(firstSlash + 1);
      if (
        ['deepseek', 'nvidia_nim', 'nvidia', 'openrouter', 'gemini', 'openai', 'anthropic', 'groq', 'custom'].includes(
          prefix
        )
      ) {
        const prov = prefix === 'nvidia' ? 'nvidia_nim' : prefix;
        return {
          id: raw,
          name: raw,
          provider: explicitProvider || prov,
          apiModel: rest,
          litellmModel: `${prov}/${rest}`,
          maxTokens: 4096,
        };
      }
      // If it looks like `meta/llama-3.3-70b-instruct` or `deepseek-ai/deepseek-r1`, infer provider
      if (explicitProvider) {
        return {
          id: raw,
          name: raw,
          provider: explicitProvider,
          apiModel: raw,
          litellmModel: `${explicitProvider}/${raw}`,
          maxTokens: 4096,
        };
      }
      if (/^(meta|nvidia|deepseek-ai|qwen|mistralai|google|microsoft)\//i.test(raw) && secretsManager.getKey('nvidia_nim')) {
        return {
          id: raw,
          name: raw,
          provider: 'nvidia_nim',
          apiModel: raw,
          litellmModel: `nvidia_nim/${raw}`,
          maxTokens: 4096,
        };
      }
    }

    const fallbackProvider = explicitProvider || 'deepseek';
    return {
      id: raw,
      name: raw,
      provider: fallbackProvider,
      apiModel: raw,
      litellmModel: `${fallbackProvider}/${raw}`,
      maxTokens: 4096,
    };
  }

  stripProviderPrefix(litellmModel, provider) {
    const prefixes = [
      `${provider}/`,
      'deepseek/',
      'nvidia_nim/',
      'openrouter/',
      'gemini/',
      'openai/',
      'anthropic/',
      'groq/',
    ];
    for (const pfx of prefixes) {
      if (litellmModel.toLowerCase().startsWith(pfx.toLowerCase())) {
        return litellmModel.slice(pfx.length);
      }
    }
    return litellmModel;
  }

  async sendChatCompletion({
    model,
    modelId,
    litellmModel,
    provider: explicitProvider,
    providerId,
    apiKey: explicitKey,
    baseUrl: explicitBaseUrl,
    messages,
    tools,
    maxTokens,
    temperature,
  }) {
    const resolved = this.resolveTarget(
      litellmModel || model || modelId,
      explicitProvider || providerId
    );
    const provConfig = secretsManager.getProviderConfig(resolved.provider);
    const apiKey = explicitKey || provConfig.apiKey;
    const baseUrl = (explicitBaseUrl || provConfig.baseUrl || '').replace(/\/+$/, '');
    const litellmCfg = secretsManager.getLitellmConfig();
    const usePythonLiteLLM = litellmCfg.usePythonLiteLLM !== false && resolved.provider !== 'deepseek';
    const reasoningEffort = ['off', 'low', 'high', 'max'].includes(litellmCfg.reasoningEffort) ? litellmCfg.reasoningEffort : 'high';
    const finalMaxTokens = maxTokens || resolved.maxTokens || 2500;
    const finalTemp = temperature !== undefined ? temperature : (litellmCfg.temperature ?? 0.2);

    if (!apiKey && resolved.provider !== 'custom') {
      throw new Error(
        `No API key configured for provider "${resolved.provider}" (model "${resolved.litellmModel}"). Open Settings → Mod → External Models to set your API key.`
      );
    }

    const enrichResponse = (res) => {
      if (res && typeof res === 'object') {
        const msg = (res.choices && res.choices[0] && res.choices[0].message) || {};
        if (res.content === undefined) {
          res.content = msg.content || msg.reasoning_content || '';
        }
        res.provider = resolved.provider;
        res.litellmModel = resolved.litellmModel;
      }
      return res;
    };

    // 1. Try Python LiteLLM engine if enabled
    if (usePythonLiteLLM) {
      try {
        const pyRes = await this.callPythonLiteLLM({
          model: resolved.litellmModel,
          provider: resolved.provider,
          apiKey,
          apiBase: baseUrl,
          messages,
          tools,
          maxTokens: finalMaxTokens,
          temperature: finalTemp,
          reasoningEffort,
        });
        return enrichResponse(pyRes);
      } catch (pyErr) {
        // Fall through to direct OpenAI-compatible HTTP transport if python runner fails on transport/env
        console.warn(`[ModelRouter] Python LiteLLM fallback triggered for ${resolved.litellmModel}:`, pyErr.message);
      }
    }

    // 2. Direct OpenAI-compatible HTTP/HTTPS transport (works for DeepSeek, NVIDIA NIM, OpenRouter, Gemini OpenAI endpoint, OpenAI, Groq, Custom Proxy)
    const httpRes = await this.callOpenAICompatible({
      baseUrl,
      apiKey,
      model: resolved.apiModel,
      provider: resolved.provider,
      messages,
      tools,
      maxTokens: finalMaxTokens,
      temperature: finalTemp,
      reasoningEffort,
    });
    return enrichResponse(httpRes);
  }

  callPythonLiteLLM(payload) {
    return new Promise((resolve, reject) => {
      const child = spawn('python', [LITELLM_RUNNER], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('LiteLLM python runner timed out after 95s'));
      }, 95000);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const trimmed = stdout.trim();
        if (!trimmed) {
          return reject(
            asQuotaError(new Error(stderr.trim() || `LiteLLM exited with code ${code}`), { exitCode: code })
          );
        }
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.error) {
            const detail =
              typeof parsed.error === 'string'
                ? parsed.error
                : parsed.error.message || JSON.stringify(parsed.error);
            return reject(
              asQuotaError(new Error(detail), {
                provider: 'litellm-python-runner',
                body: String(detail).slice(0, 2000),
                error: parsed.error,
              })
            );
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse LiteLLM output: ${trimmed.slice(0, 300)}`));
        }
      });

      child.stdin.write(JSON.stringify({ action: 'completion', ...payload }));
      child.stdin.end();
    });
  }

  callOpenAICompatible({ baseUrl, apiKey, model, provider, messages, tools, maxTokens = 2500, temperature = 0.2, reasoningEffort = 'high' }) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      let endpoint = baseUrl || 'https://api.deepseek.com/v1';
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(endpoint);
      } catch (e) {
        return reject(new Error(`Invalid base URL: ${endpoint}`));
      }

      const payload = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      };

      if (tools && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
      }
      if (provider === 'deepseek') {
        const thinkingOn = reasoningEffort !== 'off';
        payload.thinking = { type: thinkingOn ? 'enabled' : 'disabled' };
        if (thinkingOn) payload.reasoning_effort = reasoningEffort;
        payload.messages = messages.map((m) => {
          if (m.role !== 'assistant') return m;
          const n = { ...m };
          if (thinkingOn) { if (typeof n.reasoning_content !== 'string') n.reasoning_content = ''; }
          else delete n.reasoning_content;
          return n;
        });
      }

      const body = JSON.stringify(payload);
      const reqHeaders = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Antigravity-Mod-LiteLLM/2.0',
      };

      if (apiKey) {
        reqHeaders['Authorization'] = `Bearer ${apiKey}`;
      }
      if (provider === 'openrouter') {
        reqHeaders['HTTP-Referer'] = 'https://antigravity.google';
        reqHeaders['X-Title'] = 'Antigravity Mod LiteLLM';
      }

      const transport = parsedUrl.protocol === 'http:' ? http : https;
      const req = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: reqHeaders,
          timeout: 90000,
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const resText = Buffer.concat(chunks).toString('utf8');

            // Adaptive token budgeting auto-retry for OpenRouter 402 credits warning
            if ((res.statusCode === 402 || res.statusCode === 400) && resText.includes('can only afford')) {
              const match = resText.match(/can only afford (\d+)/);
              if (match && maxTokens > 300) {
                const affordable = Math.max(250, parseInt(match[1], 10) - 100);
                return this.callOpenAICompatible({
                  baseUrl,
                  apiKey,
                  model,
                  provider,
                  messages,
                  tools,
                  maxTokens: affordable,
                  temperature,
                  reasoningEffort,
                })
                  .then(resolve)
                  .catch(reject);
              }
            }

            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(
                asQuotaError(
                  new Error(`API error (${res.statusCode}) from ${parsedUrl.hostname}: ${resText.slice(0, 400)}`),
                  {
                    status: res.statusCode,
                    provider: parsedUrl.hostname,
                    body: resText.slice(0, 2000),
                  }
                )
              );
              return;
            }
            try {
              const parsed = JSON.parse(resText);
              parsed._litellm_meta = {
                engine: 'litellm-http',
                resolved_model: `${provider}/${model}`,
                latency_ms: Date.now() - started,
              };
              resolve(parsed);
            } catch (e) {
              reject(new Error(`Invalid JSON from ${parsedUrl.hostname}: ${resText.slice(0, 200)}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout calling model "${model}" at ${parsedUrl.hostname}`));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Tests a specific provider or model with a fast ping via LiteLLM.
   */
  async testModel({ model, modelId, litellmModel, provider, providerId, apiKey, baseUrl }) {
    const started = Date.now();
    const prov = provider || providerId;
    const defaultTestModels = {
      deepseek: 'deepseek/deepseek-chat',
      nvidia_nim: 'nvidia_nim/deepseek-ai/deepseek-v4.1-flash',
      openrouter: 'openrouter/openai/gpt-4o-mini',
      gemini: 'gemini/gemini-2.5-flash',
      openai: 'openai/gpt-4o-mini',
      anthropic: 'anthropic/claude-3-5-haiku-latest',
      groq: 'groq/llama-3.3-70b-versatile',
      custom: litellmModel || model || modelId || 'gpt-4o-mini',
    };
    const targetModel =
      litellmModel || model || modelId || defaultTestModels[prov] || 'deepseek/deepseek-chat';
    try {
      const response = await this.sendChatCompletion({
        model: targetModel,
        provider: prov,
        apiKey,
        baseUrl,
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        maxTokens: 32,
        temperature: 0,
      });
      const choice = response?.choices?.[0]?.message || {};
      const reply = (choice.content || choice.reasoning_content || 'OK').trim().slice(0, 120);
      const latencyMs = response?._litellm_meta?.latency_ms || Date.now() - started;
      const engine = response?._litellm_meta?.engine || 'litellm';
      return {
        ok: true,
        model: response?.model || targetModel,
        litellmModel: response?.litellmModel || targetModel,
        engine,
        latencyMs,
        reply,
      };
    } catch (err) {
      return {
        ok: false,
        model: targetModel,
        litellmModel: targetModel,
        latencyMs: Date.now() - started,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Queries a provider's /v1/models endpoint to discover available models.
   */
  fetchProviderModels({ provider, providerId, apiKey, baseUrl }) {
    return new Promise((resolve, reject) => {
      const prov = provider || providerId || 'deepseek';
      const provConfig = secretsManager.getProviderConfig(prov);
      const finalKey = apiKey || provConfig.apiKey;
      const finalBase = (baseUrl || provConfig.baseUrl || '').replace(/\/+$/, '');
      const modelsUrl = finalBase.endsWith('/models') ? finalBase : `${finalBase}/models`;

      let parsedUrl;
      try {
        parsedUrl = new URL(modelsUrl);
      } catch (e) {
        return reject(new Error(`Invalid base URL: ${modelsUrl}`));
      }

      const headers = {
        Accept: 'application/json',
        'User-Agent': 'Antigravity-Mod-LiteLLM/2.0',
      };
      if (finalKey) {
        headers['Authorization'] = `Bearer ${finalKey}`;
      }

      const transport = parsedUrl.protocol === 'http:' ? http : https;
      const req = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers,
          timeout: 15000,
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(
                asQuotaError(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 250)}`), {
                  status: res.statusCode,
                  provider: parsedUrl.hostname,
                  body: text.slice(0, 2000),
                })
              );
            }
            try {
              const json = JSON.parse(text);
              const list = Array.isArray(json.data)
                ? json.data
                : Array.isArray(json.models)
                ? json.models
                : [];
              const models = list
                .map((item) => String(item.id || item.name || '').replace(/^models\//, ''))
                .filter(Boolean)
                .slice(0, 250);
              resolve({ ok: true, provider: prov, count: models.length, models });
            } catch (e) {
              reject(new Error(`Failed to parse models response: ${e.message}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout fetching models list'));
      });
      req.end();
    });
  }

  listSupportedModels() {
    const litellmCfg = secretsManager.getLitellmConfig();
    const configured = Array.isArray(litellmCfg.models) && litellmCfg.models.length > 0
      ? litellmCfg.models
      : [
          { id: 'deepseek-chat', litellmModel: 'deepseek/deepseek-chat', name: 'DeepSeek V3 / Flash', provider: 'deepseek' },
          { id: 'deepseek-reasoner', litellmModel: 'deepseek/deepseek-reasoner', name: 'DeepSeek R1 Reasoner', provider: 'deepseek' },
          { id: 'nvidia-llama-3.3-70b', litellmModel: 'nvidia_nim/meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (NVIDIA)', provider: 'nvidia_nim' },
          { id: 'nvidia-deepseek-r1', litellmModel: 'nvidia_nim/deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (NVIDIA NIM)', provider: 'nvidia_nim' },
          { id: 'nvidia-qwen-coder-32b', litellmModel: 'nvidia_nim/qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B (NVIDIA)', provider: 'nvidia_nim' },
          { id: 'claude-sonnet-5.5', litellmModel: 'openrouter/anthropic/claude-sonnet-4', name: 'Claude Sonnet (OpenRouter)', provider: 'openrouter' },
          { id: 'gpt-4o', litellmModel: 'openrouter/openai/gpt-4o', name: 'GPT-4o (OpenRouter)', provider: 'openrouter' },
        ];

    return configured.map((m) => {
      const prov = m.provider || 'deepseek';
      const key = secretsManager.getKey(prov);
      return {
        id: m.id,
        litellmModel: m.litellmModel || `${prov}/${m.id}`,
        name: m.name || m.id,
        provider: prov,
        ready: prov === 'custom' ? true : Boolean(key),
        showInMenu: m.showInMenu !== false,
      };
    });
  }
}

const router = new ModelRouter();
router.isQuotaExhausted = isQuotaExhausted;

module.exports = router;
module.exports.isQuotaExhausted = isQuotaExhausted;
module.exports.asQuotaError = asQuotaError;
