#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Antigravity Mod - LiteLLM Universal Execution Runner
Executes multi-provider model completions (DeepSeek V4, NVIDIA NIM, OpenRouter,
OpenAI, Anthropic, Gemini, Groq, Custom) via LiteLLM / OpenAI-compatible transport
with full JSON Schema sanitization, tool-calling, multimodal, and reasoning_content support.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

os.environ["LITELLM_LOG"] = "ERROR"

try:
    import litellm
    litellm.suppress_debug_info = True
    litellm.set_verbose = False
    litellm.drop_params = True
    HAS_LITELLM = True
except ImportError:
    HAS_LITELLM = False

DEEPSEEK_V4_MODELS = {
    "deepseek-flash",
    "deepseek-v4-pro",
    "deepseek-v4-flash",
    "deepseek-v4-flash-vision-exp",
    "deepseek-reasoner",
}

INT_SCHEMA_KEYS = {
    "minLength", "maxLength",
    "minItems", "maxItems",
    "minProperties", "maxProperties",
}

NUM_SCHEMA_KEYS = {
    "minimum", "maximum",
    "exclusiveMinimum", "exclusiveMaximum",
    "multipleOf",
}

STRIP_SCHEMA_KEYS = {
    "nullable",
    "propertyOrdering",
    "property_ordering",
    "example",
    "examples",
    "title",
}


def sanitize_json_schema(schema):
    """
    Recursively normalizes Gemini Protobuf JSON Schema into strict OpenAI / DeepSeek JSON Schema.
    Specifically converts Protobuf int64 string values (e.g. `"minLength": "1"`) into actual integers (`1`),
    preventing `Invalid schema for function 'send_message': "1" is not of type "integer"`.
    """
    if isinstance(schema, list):
        return [sanitize_json_schema(item) for item in schema]
    if not isinstance(schema, dict):
        return schema

    out = {}
    for k, v in schema.items():
        if k in STRIP_SCHEMA_KEYS:
            continue
        if k == "type" and isinstance(v, str):
            lower = v.lower()
            if lower in ("string", "number", "integer", "boolean", "array", "object", "null"):
                out["type"] = lower
            else:
                out["type"] = "string"
        elif k in INT_SCHEMA_KEYS:
            try:
                out[k] = int(v)
            except (ValueError, TypeError):
                pass
        elif k in NUM_SCHEMA_KEYS:
            try:
                fval = float(v)
                out[k] = int(fval) if fval.is_integer() else fval
            except (ValueError, TypeError):
                pass
        elif k == "properties" and isinstance(v, dict):
            out["properties"] = {pk: sanitize_json_schema(pv) for pk, pv in v.items()}
        elif k == "items" and isinstance(v, (dict, list)):
            out["items"] = sanitize_json_schema(v)
        elif k in ("anyOf", "oneOf", "allOf") and isinstance(v, list):
            out[k] = [sanitize_json_schema(sub) for sub in v]
        elif k == "required" and isinstance(v, list):
            out["required"] = [str(r) for r in v if isinstance(r, (str, int))]
        elif k == "enum" and isinstance(v, list):
            out["enum"] = v
        elif k == "format" and isinstance(v, str):
            # DeepSeek rejects Protobuf-specific formats like "int32", "int64", "enum", "double", "float"
            if v in ("date-time", "date", "time", "email", "uri", "uuid"):
                out["format"] = v
        else:
            out[k] = sanitize_json_schema(v) if isinstance(v, (dict, list)) else v

    if "type" not in out and "properties" in out:
        out["type"] = "object"
    return out


def sanitize_tools(tools):
    """Sanitize OpenAI tools array so every function parameter schema passes strict validation."""
    if not tools or not isinstance(tools, list):
        return None
    cleaned = []
    for t in tools:
        if not isinstance(t, dict):
            continue
        fn = t.get("function")
        if not isinstance(fn, dict) or not fn.get("name"):
            continue
        raw_params = fn.get("parameters") or {"type": "object", "properties": {}}
        clean_params = sanitize_json_schema(raw_params)
        if not isinstance(clean_params, dict):
            clean_params = {"type": "object", "properties": {}}
        if "type" not in clean_params:
            clean_params["type"] = "object"
        if "properties" not in clean_params:
            clean_params["properties"] = {}
        cleaned.append({
            "type": "function",
            "function": {
                "name": str(fn["name"]),
                "description": str(fn.get("description") or "")[:1024],
                "parameters": clean_params,
            }
        })
    return cleaned if cleaned else None


def sanitize_messages(messages, clean_model: str, provider: str):
    """
    Mirrors @vegamo/deepcode-cli message preparation for DeepSeek V4 models:
    - Ensures every `assistant` message has `reasoning_content` (even `""`) when thinking is enabled.
    - Ensures multimodal `image_url` parts are preserved for vision models (`deepseek-flash`, `*-vision*`)
      and safely converted to text placeholders for text-only models.
    """
    if not isinstance(messages, list):
        return [{"role": "user", "content": "Hello"}]

    is_deepseek_v4 = provider == "deepseek" or clean_model in DEEPSEEK_V4_MODELS
    supports_vision = (
        clean_model == "deepseek-flash"
        or "-vision" in clean_model
        or provider in ("gemini", "openai", "openrouter", "anthropic")
    )

    out = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        msg = dict(m)
        role = msg.get("role", "user")

        if role == "assistant" and is_deepseek_v4:
            if not isinstance(msg.get("reasoning_content"), str):
                msg["reasoning_content"] = ""

        content = msg.get("content")
        if isinstance(content, list) and not supports_vision:
            text_parts = []
            for p in content:
                if isinstance(p, dict):
                    if p.get("type") == "text" and p.get("text"):
                        text_parts.append(str(p["text"]))
                    elif p.get("type") == "image_url":
                        text_parts.append("[Image attached]")
            msg["content"] = "\n".join(text_parts) if text_parts else ""

        out.append(msg)
    return out


def normalize_litellm_model(model: str, provider: str = "") -> str:
    """Ensure model has the proper LiteLLM provider prefix."""
    model = (model or "").strip()
    provider = (provider or "").strip().lower()

    if "/" in model:
        prefix = model.split("/", 1)[0].lower()
        if prefix in (
            "deepseek", "nvidia_nim", "openrouter", "openai",
            "anthropic", "gemini", "groq", "ollama", "together_ai", "fireworks_ai"
        ):
            return model

    if provider == "deepseek" or model.startswith("deepseek-"):
        return f"deepseek/{model}"
    if provider in ("nvidia", "nvidia_nim"):
        return f"nvidia_nim/{model}"
    if provider == "openrouter":
        return f"openrouter/{model}"
    if provider == "gemini" or model.startswith("gemini-"):
        return f"gemini/{model}"
    if provider == "anthropic" or model.startswith("claude-"):
        return f"anthropic/{model}"
    if provider == "groq":
        return f"groq/{model}"
    if provider in ("openai", "custom"):
        return f"openai/{model}"

    return model


def strip_provider_prefix(litellm_model: str) -> str:
    for pfx in ("deepseek/", "nvidia_nim/", "openrouter/", "openai/", "groq/", "gemini/", "anthropic/"):
        if litellm_model.startswith(pfx):
            return litellm_model[len(pfx):]
    return litellm_model


def direct_http_completion(clean_model: str, messages: list, api_key: str, api_base: str, tools=None, max_tokens=8192, temperature=0.2, provider=""):
    """Direct OpenAI-compatible HTTP transport (mirrors @vegamo/deepcode-cli for DeepSeek V4)."""
    url = (api_base or "https://api.deepseek.com/v1").rstrip("/")
    if not url.endswith("/v1") and "deepseek.com" in url:
        url = url + "/v1"
    endpoint = url + "/chat/completions"

    payload = {
        "model": clean_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    if provider == "deepseek" or clean_model in DEEPSEEK_V4_MODELS:
        payload["thinking"] = {"type": "enabled"}

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "Antigravity-LiteLLM/2.0",
        "HTTP-Referer": "https://antigravity.google",
        "X-Title": "Antigravity Mod LiteLLM",
    }
    req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"API error ({e.code}): {err_body[:500]}")


def run_completion(req: dict) -> dict:
    started = time.time()
    raw_model = req.get("model") or "deepseek/deepseek-flash"
    provider = (req.get("provider") or "").strip().lower()
    api_key = (req.get("apiKey") or req.get("api_key") or "").strip()
    api_base = req.get("apiBase") or req.get("api_base") or None
    raw_messages = req.get("messages") or [{"role": "user", "content": "Hello"}]
    raw_tools = req.get("tools") or None
    max_tokens = int(req.get("maxTokens") or req.get("max_tokens") or 8192)
    temperature = float(req.get("temperature", 0.2))

    litellm_model = normalize_litellm_model(raw_model, provider)
    clean_model = strip_provider_prefix(litellm_model)
    if not provider and "/" in litellm_model:
        provider = litellm_model.split("/", 1)[0].lower()

    tools = sanitize_tools(raw_tools)
    messages = sanitize_messages(raw_messages, clean_model, provider)

    # Set provider environment variables for LiteLLM
    if api_key:
        if litellm_model.startswith("deepseek/"):
            os.environ["DEEPSEEK_API_KEY"] = api_key
        elif litellm_model.startswith("nvidia_nim/"):
            os.environ["NVIDIA_NIM_API_KEY"] = api_key
        elif litellm_model.startswith("openrouter/"):
            os.environ["OPENROUTER_API_KEY"] = api_key
        elif litellm_model.startswith("gemini/"):
            os.environ["GEMINI_API_KEY"] = api_key
        elif litellm_model.startswith("anthropic/"):
            os.environ["ANTHROPIC_API_KEY"] = api_key
        elif litellm_model.startswith("groq/"):
            os.environ["GROQ_API_KEY"] = api_key
        elif litellm_model.startswith("openai/"):
            os.environ["OPENAI_API_KEY"] = api_key

    data = None
    engine_used = "litellm-python"

    if HAS_LITELLM:
        try:
            kwargs = {
                "model": litellm_model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "timeout": int(req.get("timeout") or 90),
            }
            if api_key:
                kwargs["api_key"] = api_key
            if api_base and provider == "custom":
                kwargs["api_base"] = api_base
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            response = litellm.completion(**kwargs)
            if hasattr(response, "model_dump"):
                data = response.model_dump()
            elif hasattr(response, "dict"):
                data = response.dict()
            else:
                data = json.loads(response.json())
        except Exception:
            # Fallback to direct OpenAI-compatible transport (supports newest DeepSeek V4 models & thinking mode)
            engine_used = "deepseek-v4-direct"
            data = direct_http_completion(
                clean_model, messages, api_key, api_base, tools, max_tokens, temperature, provider
            )
    else:
        engine_used = "http-fallback"
        data = direct_http_completion(
            clean_model, messages, api_key, api_base, tools, max_tokens, temperature, provider
        )

    elapsed_ms = int((time.time() - started) * 1000)
    data["_litellm_meta"] = {
        "engine": engine_used,
        "resolved_model": litellm_model,
        "latency_ms": elapsed_ms,
    }
    return data


def main():
    try:
        if hasattr(sys.stdin, "reconfigure"):
            sys.stdin.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        raw_in = sys.stdin.buffer.read().decode("utf-8", errors="replace")
        if not raw_in.strip():
            print(json.dumps({"error": "Empty request payload on stdin"}))
            sys.exit(1)
        req = json.loads(raw_in)
        action = req.get("action", "completion")

        if action == "health":
            print(json.dumps({
                "ok": True,
                "has_litellm": HAS_LITELLM,
                "version": getattr(litellm, "__version__", "builtin") if HAS_LITELLM else "http-fallback"
            }))
            return

        result = run_completion(req)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
