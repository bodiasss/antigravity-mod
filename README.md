# Antigravity Mod

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://github.com/bodiasss/antigravity-mod)
[![Release](https://img.shields.io/badge/Release-One--Click%20Setup-green.svg)](https://github.com/bodiasss/antigravity-mod/releases)

**Antigravity Mod** is an extensible architecture framework, multi-model gateway, and multi-account manager for Google Antigravity. It enables seamless per-conversation model switching, transparent quota failover, and native integration for third-party models (DeepSeek, Claude, GPT, NVIDIA NIM, OpenRouter).

---

## Highlights

- **Per-Conversation Model Binding**: Bind distinct models (DeepSeek, Claude 3.7 / 3.5 Sonnet, GPT-4o, Gemini 3.8 Flash, NVIDIA Nemotron) to specific chats. Each conversation remembers its active model across app restarts and navigation.
- **Smart Quota Failover & Auto-Resume**: Real-time classification of quota exhaustion (`HTTP 429`, `RESOURCE_EXHAUSTED`, rate limits). Automatically cycles to a healthy account, verifies credential propagation, and replays the last prompt without losing context or chat history.
- **Local CCPA LiteLLM Gateway**: Integrated local reverse proxy that translates Antigravity / Gemini protocol into OpenAI-compatible completions with tool calling, extended thinking parameters, and streaming support.
- **Visual Brand Badges & Thinking Traces**: Rich brand indicators (DeepSeek whale, Anthropic asterisk, NVIDIA eye, Gemini spark, OpenAI mark) integrated into model selection triggers, menus, and subagent reasoning outputs.
- **Native Polish Settings UI**: Modern settings interface styled to blend seamlessly with Antigravity's dark palette using native design tokens.
- **Zero-Friction One-Click Installer**: Single self-contained Windows executable (`AntigravityModSetup.exe`) with auto-detection of Antigravity installations, atomic backups, and one-click uninstall.

---

## Quick Installation

### Method 1: One-Click Executable (Recommended)

1. Download **`AntigravityModSetup.exe`** from the [Latest Release](https://github.com/bodiasss/antigravity-mod/releases).
2. Run the executable.
3. The installer automatically detects your Antigravity installation. Click **Install Mod**.
4. Restart Antigravity.

### Method 2: Manual Installation (Developers)

```powershell
# Clone repository
git clone https://github.com/bodiasss/antigravity-mod.git
cd antigravity-mod

# Inject loader hook into Antigravity
node scripts/install-mod.js
```

To uninstall:
```powershell
node scripts/uninstall-mod.js
```

---

## Configuration & Usage

1. Open **Antigravity**.
2. Press `Ctrl+,` (or open **Settings**) and navigate to **Mod · Models**.
3. Configure your API keys for desired providers:
   - **DeepSeek** (`https://api.deepseek.com/v1`)
   - **OpenRouter** (`https://openrouter.ai/api/v1`)
   - **NVIDIA NIM** (`https://integrate.api.nvidia.com/v1`)
   - **OpenAI** / **Anthropic** / Custom endpoints
4. Open any chat and click the model selector trigger at the bottom right. Choose any model under **Another Models**.

---

## Architecture

```
antigravity-mod/
├── core/
│   ├── cross-model-kernel/       # CCPA gateway, LiteLLM runner, model router
│   │   ├── ccpa-litellm-gateway.js # Local HTTP & SSE translation bridge
│   │   ├── model-router.js       # Target provider resolver & error classifier
│   │   ├── secrets-manager.js    # Provider API key discovery
│   │   └── subagent-runner.js    # Specialized subagent orchestrator
│   ├── index.js                  # Mod bootstrap entry point
│   ├── injector.js               # Electron runtime injector & hotkey manager
│   ├── mod-loader.js             # Dynamic module lifecycle manager
│   └── data-service.js           # Quota and statistics aggregator
├── modules/
│   ├── cross-model-agents/       # Visual badges, thinking states, SVG assets
│   │   ├── icons.js              # Brand SVG definitions & badge builders
│   │   └── subagent-thinking-visuals.js # Real-time subagent trace decorator
│   └── mod-overview/             # Account switcher overlay dashboard (Ctrl+Alt+M)
├── scripts/
│   ├── install-mod.js            # Node injection script
│   └── uninstall-mod.js          # Clean restore script
└── package.json
```

---

## Security & Privacy

- All API keys and tokens are stored exclusively in your local Antigravity application directory (`%APPDATA%/AntigravitySwitcher/mod-settings.json`).
- No telemetry, keys, or personal identifiers are collected or transmitted externally.
- Built-in automatic backups preserve original binaries (`main.js.stock_backup`) before modifying any files.

---

## License

This project is distributed under the [MIT License](LICENSE).
