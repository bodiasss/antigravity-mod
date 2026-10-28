---
name: antigravity-mod-customization
description: >-
  Керує кастомізацією Antigravity Mod — підключення зовнішніх моделей через LiteLLM/CCA,
  провайдери (DeepSeek, Gemini, Claude, NVIDIA NIM, OpenRouter, OpenAI, Groq),
  per-conversation вибір моделі, reasoning effort, брендові іконки,
  авто-своп акаунтів при ліміті.
---

# Antigravity Mod Customization

Цей скіл описує, як влаштована кастомізація Antigravity Mod: підключення зовнішніх
моделей через LiteLLM/CCA-шлюз, реєстрація провайдерів і моделей, per-conversation
вибір моделі, reasoning effort та автоматичний своп акаунтів при вичерпанні ліміту.

## Де що лежить

| Що | Шлях / поле |
|---|---|
| Конфіг і дефолти | `C:\Users\11sto\antigravity-seamless\resources\app\dist\modConfig.js` → `DEFAULTS.litellm` |
| Файл налаштувань | `%APPDATA%\AntigravitySwitcher\mod-settings.json` |
| Провайдери | `litellm.providers.<id>` — поля `apiKey`, `baseUrl`, `prefix`, `enabled` |
| Моделі | `litellm.models[]` — поля `id`, `litellmModel`, `name`, `provider`, `maxTokens`, `reasoning`, `showInMenu`, `builtin` |
| Модель для чату | `litellm.perConversationModels { conversationId: modelId }` |
| Хелпери per-chat | `modConfig.js` → `getModelForConversation`, `setModelForConversation` |
| Глобальний fallback | `litellm.activeExternalModel` |
| Reasoning effort | `litellm.reasoningEffort` — `off` \| `low` \| `high` \| `max` |
| Роутер | `C:\Users\11sto\antigravity-mod\core\cross-model-kernel\model-router.js` → `resolveTarget`, `sendChatCompletion` |
| Шлюз | `C:\Users\11sto\antigravity-mod\core\cross-model-kernel\ccpa-litellm-gateway.js` |
| Іконки | `C:\Users\11sto\antigravity-mod\modules\cross-model-agents\icons.js` → `ICONS`, `ICON_BODIES`, `resolveIconKey`, `getBadgeHtml`, `buildSvg`, `buildBadge` |
| Своп акаунтів | `C:\Users\11sto\antigravity-seamless\resources\app\dist\accountSwitcher.js` → `performAutoSwitch`, `handleQuotaReport`, `switchToAccount` |

## Як додати провайдера

1. Додати запис у `DEFAULT_PROVIDERS` у `modConfig.js`: `id`, `name`, `baseUrl`, `prefix`, `placeholder`, `docsUrl`.
2. `baseUrl` — OpenAI-сумісний endpoint (без слеша в кінці); `prefix` — те, що стоїть перед `/` у `litellmModel`.
3. Ключ: або вставити в `Settings → Mod → External Models`, або виставити env-змінну —
   `DEEPSEEK_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`.

## Як додати модель

Додати об'єкт у `litellm.models`:

```json
{
  "id": "my-model",
  "litellmModel": "<provider prefix>/<api model>",
  "name": "My Model",
  "provider": "openrouter",
  "maxTokens": 8192,
  "reasoning": false,
  "showInMenu": true
}
```

`litellmModel` мусить бути `<provider prefix>/<api model>`. `id` — унікальний, `provider` має існувати в `litellm.providers`.

## Валідація

- `maxTokens` затискається до `256..131072` у `normalizeLitellmConfig` і до `256..128000` у `setModSettings`.
- `reasoningEffort` — лише з білого списку `off`, `low`, `high`, `max`.
- `temperature` затискається до `0..2`.
- `apiKey` не перезаписується, якщо введене значення містить символ маски (`••••`).
- Моделі зі списку `OBSOLETE_IDS` відкидаються при нормалізації.

## Per-conversation поведінка

Селектор записує вибір у `perConversationModels[поточнийConversationId]`. Клік по рідній
моделі Antigravity чистить лише поточний чат, не глобальний дефолт. Чати без запису
падають на `activeExternalModel`. `resolveActiveConversationId()` визначає чат з
`data-conversation-id` / `data-chat-id`, потім з query/hash (`conversationId`, `conversation`,
`chat`, `thread`), потім з останнього сегмента `location.pathname`.
