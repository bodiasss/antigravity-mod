'use strict';

/**
 * Antigravity Mod — LiteLLM CCPA / CloudCode Gateway
 *
 * Intercepts `language_server.exe` calls to `--cloud_code_endpoint`
 * (`/v1internal:streamGenerateContent` & `/v1internal:generateContent`).
 *
 * - When `activeExternalModel` is null (standard Antigravity model selected):
 *   Transparently proxies 100% of traffic directly to `https://daily-cloudcode-pa.googleapis.com`.
 * - When `activeExternalModel` is set (user selected a model under "Another Models",
 *   such as `deepseek-flash`, `deepseek-v4-pro`, `nvidia_nim/...`, `openrouter/...`):
 *   Translates CCPA/Gemini `GenerateContentRequest` (including systemInstruction, multi-turn
 *   contents, functionDeclarations, functionCall, and functionResponse) into LiteLLM/OpenAI
 *   format, invokes the external model via `model-router.js`, and returns a valid CCPA SSE/JSON
 *   `GenerateContentResponse`.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const modelRouter = require('./model-router');
const secretsManager = require('./secrets-manager');

const UPSTREAM_HOST = 'daily-cloudcode-pa.googleapis.com';
const DEFAULT_GATEWAY_PORT = Number(process.env.AG_LITELLM_GATEWAY_PORT) || 58444;

let serverInstance = null;

const INT_SCHEMA_KEYS = new Set([
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minProperties',
  'maxProperties',
]);

const NUM_SCHEMA_KEYS = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
]);

const STRIP_SCHEMA_KEYS = new Set([
  'nullable',
  'propertyOrdering',
  'property_ordering',
  'example',
  'examples',
  'title',
]);

/**
 * Recursively normalizes Gemini Protobuf JSON Schema into standard OpenAI JSON Schema
 * (converts `STRING` -> `string`, `OBJECT` -> `object`, stringified int64 `"1"` -> integer `1`, etc.).
 */
function sanitizeSchemaForOpenAI(schema) {
  if (!schema || typeof schema !== 'object') {
    return { type: 'object', properties: {} };
  }
  if (Array.isArray(schema)) {
    return schema.map(sanitizeSchemaForOpenAI);
  }
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (STRIP_SCHEMA_KEYS.has(k)) {
      continue;
    }
    if (k === 'type' && typeof v === 'string') {
      const lower = v.toLowerCase();
      if (['string', 'number', 'integer', 'boolean', 'array', 'object'].includes(lower)) {
        out.type = lower;
      } else {
        out.type = 'string';
      }
    } else if (INT_SCHEMA_KEYS.has(k)) {
      const parsed = parseInt(String(v), 10);
      if (!Number.isNaN(parsed)) {
        out[k] = parsed;
      }
    } else if (NUM_SCHEMA_KEYS.has(k)) {
      const parsed = Number(v);
      if (!Number.isNaN(parsed)) {
        out[k] = parsed;
      }
    } else if (k === 'format' && typeof v === 'string') {
      if (['date-time', 'date', 'time', 'email', 'uri', 'uuid'].includes(v)) {
        out.format = v;
      }
    } else if (k === 'properties' && v && typeof v === 'object') {
      out.properties = {};
      for (const [pk, pv] of Object.entries(v)) {
        out.properties[pk] = sanitizeSchemaForOpenAI(pv);
      }
    } else if (k === 'items' && v && typeof v === 'object') {
      out.items = sanitizeSchemaForOpenAI(v);
    } else if (k === 'anyOf' || k === 'oneOf' || k === 'allOf') {
      if (Array.isArray(v)) out[k] = v.map(sanitizeSchemaForOpenAI);
    } else {
      out[k] = v;
    }
  }
  if (!out.type && out.properties) {
    out.type = 'object';
  }
  return out;
}

/**
 * Converts Gemini `tools` array (`[{ functionDeclarations: [...] }]`) to OpenAI `tools`.
 */
function convertGeminiToolsToOpenAI(geminiTools) {
  if (!Array.isArray(geminiTools) || geminiTools.length === 0) return undefined;
  const openAiTools = [];
  const seenNames = new Set();

  for (const group of geminiTools) {
    const decls = (group && (group.functionDeclarations || group.function_declarations)) || [];
    for (const fn of decls) {
      if (!fn || !fn.name || seenNames.has(fn.name)) continue;
      seenNames.add(fn.name);
      const rawParams = fn.parameters || fn.parametersJsonSchema || { type: 'object', properties: {} };
      const cleanParams = sanitizeSchemaForOpenAI(rawParams);
      if (!cleanParams.type) cleanParams.type = 'object';
      if (!cleanParams.properties) cleanParams.properties = {};
      openAiTools.push({
        type: 'function',
        function: {
          name: String(fn.name),
          description: String(fn.description || '').slice(0, 1024),
          parameters: cleanParams,
        },
      });
    }
  }

  return openAiTools.length > 0 ? openAiTools : undefined;
}

/**
 * Converts Gemini `systemInstruction` and `contents` into OpenAI `messages`.
 * Preserves tool call / tool response pairing required by DeepSeek and OpenAI.
 */
function convertGeminiContentsToOpenAIMessages(innerReq, resolvedModel) {
  const messages = [];

  // 1. System Instruction
  let sysText = '';
  const sysInst = innerReq.systemInstruction || innerReq.system_instruction;
  if (sysInst && Array.isArray(sysInst.parts)) {
    sysText = sysInst.parts
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n\n');
  }

  const identityBanner = [
    `[RUNTIME MODEL OVERRIDE]`,
    `You are currently powered by **${resolvedModel.name}** (LiteLLM ID: \`${resolvedModel.litellmModel}\`, Provider: \`${resolvedModel.provider}\`) running inside Google Antigravity IDE via the Antigravity Mod LiteLLM Engine.`,
    `If the user asks what model you are (e.g. "what model are you", "who are you", "яка ти модель"), ALWAYS state clearly that you are **${resolvedModel.name}** (\`${resolvedModel.litellmModel}\`) routed via LiteLLM, and NOT Gemini 4 Argon.`,
  ].join('\n');

  if (sysText) {
    messages.push({
      role: 'system',
      content: `${identityBanner}\n\n${sysText}`,
    });
  } else {
    messages.push({
      role: 'system',
      content: identityBanner,
    });
  }

  // 2. Conversation turns
  const contents = Array.isArray(innerReq.contents) ? innerReq.contents : [];
  let callCounter = 1;
  const pendingCallQueue = []; // [{ id, name }]

  for (const turn of contents) {
    if (!turn || !Array.isArray(turn.parts)) continue;
    const role = turn.role === 'model' ? 'assistant' : 'user';

    const textChunks = [];
    const thoughtChunks = [];
    const imageParts = [];
    const functionCalls = [];
    const functionResponses = [];

    for (const part of turn.parts) {
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string' && part.text) {
        if (part.thought) {
          thoughtChunks.push(part.text);
        } else {
          textChunks.push(part.text);
        }
      } else if (part.inlineData || part.inline_data) {
        const idata = part.inlineData || part.inline_data;
        if (idata && idata.data) {
          const mime = idata.mimeType || idata.mime_type || 'image/png';
          imageParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${mime};base64,${idata.data}`,
            },
          });
        }
      } else if (part.functionCall || part.function_call) {
        const fc = part.functionCall || part.function_call;
        if (fc && fc.name) {
          const callId = fc.id || `call_${callCounter++}_${fc.name}`;
          const argsObj = fc.args !== undefined ? fc.args : {};
          functionCalls.push({
            id: callId,
            type: 'function',
            function: {
              name: String(fc.name),
              arguments: typeof argsObj === 'string' ? argsObj : JSON.stringify(argsObj || {}),
            },
          });
          pendingCallQueue.push({ id: callId, name: String(fc.name) });
        }
      } else if (part.functionResponse || part.function_response) {
        const fr = part.functionResponse || part.function_response;
        if (fr && fr.name) {
          functionResponses.push({
            id: fr.id || null,
            name: String(fr.name),
            response: fr.response !== undefined ? fr.response : {},
          });
        }
      }
    }

    if (role === 'assistant') {
      const msg = {
        role: 'assistant',
        content: textChunks.join('\n') || (functionCalls.length ? null : ''),
        reasoning_content: thoughtChunks.join('\n') || '',
      };
      if (functionCalls.length > 0) {
        msg.tool_calls = functionCalls;
      }
      if (msg.content || msg.reasoning_content || (msg.tool_calls && msg.tool_calls.length > 0)) {
        messages.push(msg);
      }
    } else {
      // If this user turn contains functionResponses, emit `role: 'tool'` messages first
      if (functionResponses.length > 0) {
        for (const fr of functionResponses) {
          let matchedId = fr.id;
          if (!matchedId) {
            const qIdx = pendingCallQueue.findIndex((item) => item.name === fr.name);
            if (qIdx !== -1) {
              matchedId = pendingCallQueue.splice(qIdx, 1)[0].id;
            } else if (pendingCallQueue.length > 0) {
              matchedId = pendingCallQueue.shift().id;
            } else {
              matchedId = `call_fallback_${callCounter++}`;
            }
          }
          let contentStr = '';
          if (typeof fr.response === 'string') {
            contentStr = fr.response;
          } else {
            try {
              contentStr = JSON.stringify(fr.response);
            } catch (_) {
              contentStr = String(fr.response);
            }
          }
          messages.push({
            role: 'tool',
            tool_call_id: matchedId,
            name: fr.name,
            content: contentStr || '{}',
          });
        }
      }
      if (textChunks.length > 0 || imageParts.length > 0) {
        if (imageParts.length > 0) {
          const contentArr = [];
          if (textChunks.length > 0) {
            contentArr.push({ type: 'text', text: textChunks.join('\n') });
          }
          contentArr.push(...imageParts);
          messages.push({
            role: 'user',
            content: contentArr,
          });
        } else {
          messages.push({
            role: 'user',
            content: textChunks.join('\n'),
          });
        }
      }
    }
  }

  // Strict OpenAI/DeepSeek sequencing: every assistant.tool_calls must be followed immediately by
  // exactly one tool message per tool_call_id; orphan/extra tool messages become user text.
  const asUser = (t) => ({
    role: 'user',
    content: '[Tool Output (' + (t.name || 'tool') + ')]: ' + t.content,
  });
  const validated = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'tool') {
      validated.push(asUser(m));
      continue;
    }
    validated.push(m);
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const wanted = new Map(m.tool_calls.map((tc) => [tc.id, null]));
      const extras = [];
      let j = i + 1;
      while (j < messages.length && messages[j].role === 'tool') {
        const t = messages[j];
        if (wanted.has(t.tool_call_id) && wanted.get(t.tool_call_id) === null) {
          wanted.set(t.tool_call_id, t);
        } else {
          extras.push(asUser(t));
        }
        j++;
      }
      for (const tc of m.tool_calls) {
        validated.push(
          wanted.get(tc.id) || {
            role: 'tool',
            tool_call_id: tc.id,
            content: '{"status":"no result"}',
          }
        );
      }
      validated.push(...extras);
      i = j - 1;
    }
  }

  return validated;
}

/**
 * Converts LiteLLM/OpenAI completion response into CCPA `GenerateContentResponse` envelope.
 */
function buildCcpaResponse(completion, resolvedModel) {
  const choice = (completion && completion.choices && completion.choices[0]) || {};
  const msg = choice.message || {};
  const parts = [];

  if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
    parts.push({
      text: msg.reasoning_content,
      thought: true,
    });
  }

  if (typeof msg.content === 'string' && msg.content.length > 0) {
    parts.push({
      text: msg.content,
    });
  }

  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      if (!tc || !tc.function || !tc.function.name) continue;
      let parsedArgs = {};
      if (typeof tc.function.arguments === 'string') {
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch (_) {
          parsedArgs = { raw: tc.function.arguments };
        }
      } else if (tc.function.arguments && typeof tc.function.arguments === 'object') {
        parsedArgs = tc.function.arguments;
      }
      parts.push({
        functionCall: {
          name: tc.function.name,
          args: parsedArgs,
        },
      });
    }
  }

  if (parts.length === 0) {
    parts.push({ text: msg.content || '' });
  }

  const usage = completion.usage || {};
  return {
    response: {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      modelVersion: resolvedModel.litellmModel,
      usageMetadata: {
        promptTokenCount: Number(usage.prompt_tokens) || 100,
        candidatesTokenCount: Number(usage.completion_tokens) || 50,
        totalTokenCount: Number(usage.total_tokens) || 150,
      },
    },
    traceId: `litellm-${Date.now()}`,
  };
}

/**
 * Transparently forwards a request to `https://daily-cloudcode-pa.googleapis.com`.
 */
function forwardToUpstream(clientReq, clientRes, rawBodyBuffer) {
  const forwardHeaders = { ...clientReq.headers };
  forwardHeaders.host = UPSTREAM_HOST;
  if (rawBodyBuffer) {
    forwardHeaders['content-length'] = Buffer.byteLength(rawBodyBuffer);
  }

  const upstreamReq = https.request(
    {
      hostname: UPSTREAM_HOST,
      port: 443,
      path: clientReq.url,
      method: clientReq.method,
      headers: forwardHeaders,
    },
    (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
      upstreamRes.pipe(clientRes);
    }
  );

  upstreamReq.on('error', (err) => {
    console.error('[LiteLLM-CCPA-Gateway] Upstream error:', err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
    }
    clientRes.end(JSON.stringify({ error: { message: err.message } }));
  });

  if (rawBodyBuffer) {
    upstreamReq.write(rawBodyBuffer);
    upstreamReq.end();
  } else {
    clientReq.pipe(upstreamReq);
  }
}

/**
 * Determines whether a GenerateContent request is an internal background task
 * (e.g. `sir_flash_lite` safety monitor or title summarizer) rather than the main user chat.
 */
function isInternalBackgroundCall(parsedBody) {
  const modelName = String(parsedBody.model || '').toLowerCase();
  if (modelName.includes('flash-lite') || modelName.includes('lite')) {
    return true;
  }
  const inner = parsedBody.request || parsedBody;
  const sysInst = inner.systemInstruction || inner.system_instruction;
  if (sysInst && Array.isArray(sysInst.parts)) {
    const sysText = sysInst.parts.map((p) => p.text || '').join(' ');
    if (
      sysText.includes('Monitor ') ||
      sysText.includes('severity') ||
      (sysText.includes('trajectory') && !sysText.includes('<identity>'))
    ) {
      return true;
    }
  }
  return false;
}

function handleGatewayRequest(req, res) {
  const urlStr = String(req.url || '');
  const isGenerate =
    req.method === 'POST' &&
    (urlStr.includes(':streamGenerateContent') || urlStr.includes(':generateContent'));

  if (!isGenerate) {
    return forwardToUpstream(req, res, null);
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const rawBuf = Buffer.concat(chunks);
    const litellmCfg = secretsManager.getLitellmConfig();
    const activeExternal = litellmCfg && litellmCfg.activeExternalModel;

    // If no external model is selected in "Another Models", forward 100% natively to Google CloudCode
    if (!activeExternal) {
      return forwardToUpstream(req, res, rawBuf);
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBuf.toString('utf8'));
    } catch (_) {
      return forwardToUpstream(req, res, rawBuf);
    }

    // Keep internal safety monitor / flash-lite calls on upstream so they don't slow down or confuse external models
    if (isInternalBackgroundCall(parsedBody)) {
      return forwardToUpstream(req, res, rawBuf);
    }

    const resolved = modelRouter.resolveTarget(activeExternal);
    const innerReq = parsedBody.request || parsedBody;
    const isSse = urlStr.includes('alt=sse') || urlStr.includes(':streamGenerateContent');

    try {
      const messages = convertGeminiContentsToOpenAIMessages(innerReq, resolved);
      const tools = convertGeminiToolsToOpenAI(innerReq.tools);

      console.log(
        `[LiteLLM-CCPA-Gateway] Routing main chat turn -> ${resolved.name} (${resolved.litellmModel}) [messages=${messages.length}, tools=${tools ? tools.length : 0}]`
      );

      const completion = await modelRouter.sendChatCompletion({
        model: resolved.litellmModel,
        provider: resolved.provider,
        messages,
        tools,
        maxTokens: resolved.maxTokens || 8192,
      });

      const ccpaEnvelope = buildCcpaResponse(completion, resolved);

      if (isSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(`data: ${JSON.stringify(ccpaEnvelope)}\r\n\r\n`);
        res.end();
      } else {
        const jsonBytes = Buffer.from(JSON.stringify(ccpaEnvelope), 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': jsonBytes.length,
        });
        res.end(jsonBytes);
      }
    } catch (err) {
      try {
        const quota = modelRouter.isQuotaExhausted(err) || err.isQuota === true;
        if (quota) {
          const status = Number(err.status || err.statusCode) || 429;
          const body = JSON.stringify({
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'quota exhausted',
              detail: String(err.message || '').slice(0, 400),
              provider: err.provider || resolved.provider,
              upstreamStatus: status,
              model: resolved.litellmModel,
            },
          });
          console.warn(`[LiteLLM-CCPA-Gateway] Quota exhausted for ${resolved.litellmModel} (upstream ${status})`);
          if (!res.headersSent) {
            res.writeHead(429, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': Buffer.byteLength(body),
              'Retry-After': '5',
            });
          }
          res.end(body);
          return;
        }
      } catch (quotaErr) {
        console.error('[LiteLLM-CCPA-Gateway] Quota classification failed:', quotaErr.message);
        // fall through to the legacy envelope below
      }

      console.error(`[LiteLLM-CCPA-Gateway] Error calling ${resolved.litellmModel}:`, err.message);
      const errEnvelope = {
        response: {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    text: `⚠️ **LiteLLM External Model Error (${resolved.name} / \`${resolved.litellmModel}\`)**:\n\`\`\`\n${err.message}\n\`\`\`\nCheck your API key or model availability in **Settings → Mod · Models**, or switch back to a native Antigravity model.`,
                  },
                ],
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          modelVersion: resolved.litellmModel,
        },
        traceId: `litellm-err-${Date.now()}`,
      };
      if (isSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.write(`data: ${JSON.stringify(errEnvelope)}\r\n\r\n`);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(errEnvelope));
      }
    }
  });
}

function startGateway(port = DEFAULT_GATEWAY_PORT) {
  if (serverInstance) return serverInstance;
  const server = http.createServer(handleGatewayRequest);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[LiteLLM-CCPA-Gateway] Port ${port} already active.`);
    } else {
      console.error('[LiteLLM-CCPA-Gateway] Server error:', err.message);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`[LiteLLM-CCPA-Gateway] Listening on http://127.0.0.1:${port} -> upstream https://${UPSTREAM_HOST}`);
  });
  serverInstance = server;
  return server;
}

if (require.main === module) {
  startGateway();
}

module.exports = {
  DEFAULT_GATEWAY_PORT,
  startGateway,
  handleGatewayRequest,
  convertGeminiContentsToOpenAIMessages,
  convertGeminiToolsToOpenAI,
  buildCcpaResponse,
};
