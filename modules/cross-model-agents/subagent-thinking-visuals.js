'use strict';

/**
 * Antigravity Subagent & Thinking Visuals Engine
 * Real-time brand badge visualization (DeepSeek, Gemini, NVIDIA, OpenRouter, Claude, OpenAI)
 * for subagent cards, chat trajectories, task sidebars, and active/completed thinking states.
 */

// Try loading base SVGs from sibling icons.js if present
let SIBLING_ICONS = {};
try {
  SIBLING_ICONS = require('./icons');
} catch (_) {
  // Graceful fallback for standalone browser context
}

const BRAND_COLORS = {
  deepseek: '#1E88E5',
  geminiFlash: '#4285F4',
  geminiArgon: '#A855F7',
  gemini: '#4285F4',
  claude: '#D97706',
  nvidia: '#76B900',
  openrouter: '#6366F1',
  openai: '#10A37F',
  default: '#60A5FA'
};

const GLOW_COLORS = {
  deepseek: 'rgba(30, 136, 229, 0.85)',
  geminiFlash: 'rgba(66, 133, 244, 0.85)',
  geminiArgon: 'rgba(168, 85, 247, 0.85)',
  gemini: 'rgba(66, 133, 244, 0.85)',
  claude: 'rgba(217, 119, 6, 0.85)',
  nvidia: 'rgba(118, 185, 0, 0.85)',
  openrouter: 'rgba(99, 102, 241, 0.85)',
  openai: 'rgba(16, 163, 127, 0.85)',
  default: 'rgba(96, 165, 250, 0.75)'
};

const MODEL_DISPLAY_NAMES = {
  deepseek: 'DeepSeek',
  geminiFlash: 'Gemini 3.8 Flash',
  geminiArgon: 'Gemini 4 Argon',
  gemini: 'Google Gemini',
  nvidia: 'NVIDIA NIM',
  openrouter: 'OpenRouter',
  claude: 'Claude',
  openai: 'OpenAI'
};

const DEFAULT_MODEL_SVGS = {
  // Official DeepSeek Whale Emblem
  deepseek: `
    <span class="agm-badge agm-badge-deepseek" title="DeepSeek" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="#1E88E5" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45"/>
      </svg>
    </span>
  `.trim(),

  // Official Gemini Sparkle Star (Google Blue)
  geminiFlash: `
    <span class="agm-badge agm-badge-gemini-flash" title="Gemini 3.8 Flash" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="#4285F4" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
      </svg>
    </span>
  `.trim(),

  // Official Gemini Sparkle Star with Numeral 4 (Purple & Lilac)
  geminiArgon: `
    <span class="agm-badge agm-badge-gemini-argon" title="Gemini 4 Argon" style="display:inline-flex;align-items:center;gap:2px;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="#A855F7" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
      </svg>
      <span style="font-size:10px;font-weight:800;color:#C084FC;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">4</span>
    </span>
  `.trim(),

  // Generic Google Gemini Sparkle Star
  gemini: `
    <span class="agm-badge agm-badge-gemini" title="Google Gemini" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="#4285F4" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
      </svg>
    </span>
  `.trim(),

  // Official Anthropic Claude Spark (Warm Terracotta / Coral)
  claude: `
    <span class="agm-badge agm-badge-claude" title="Claude" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="#D97706" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
      </svg>
    </span>
  `.trim(),

  // Official NVIDIA Emblem (Vivid Green #76B900)
  nvidia: `
    <span class="agm-badge agm-badge-nvidia" title="NVIDIA NIM" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="#76B900" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.761 17.587c-2.476-.237-4.634-1.928-5.328-4.22-.505-1.666-.217-3.473.791-4.887 1.054-1.48 2.75-2.33 4.542-2.33 1.144 0 2.247.346 3.208 1.002l1.656-1.74A8.705 8.705 0 0 0 9.766 4c-2.613 0-5.07 1.205-6.625 3.251-1.464 1.928-1.942 4.417-1.31 6.83 1.011 3.86 4.398 6.577 8.397 6.726.836.031 1.688-.06 2.505-.27l-1.04-1.745a6.438 6.438 0 0 1-1.932.795zm6.81-4.707c-.43 2.115-2.22 3.69-4.37 3.69-.326 0-.649-.036-.963-.105l1.62-2.709c.645-.255 1.13-.77 1.32-1.436.19-.665.04-1.385-.4-1.916a2.43 2.43 0 0 0-1.84-.796c-.394 0-.78.106-1.12.308l1.65-2.76A5.578 5.578 0 0 1 15.6 8.35c1.47 1.18 2.21 3.01 1.88 4.88l-.91-.35zm-3.4-3.52c.24 0 .47.05.68.16l-2.02 3.39c-.11-.2-.17-.43-.17-.67 0-.78.43-1.49 1.1-1.86.13-.01.27-.02.41-.02zm6.26-2.08c1.78 1.66 2.76 3.99 2.68 6.41-.09 2.56-1.32 4.9-3.37 6.42l-1.47-1.63c1.55-1.15 2.49-2.93 2.56-4.88.06-1.85-.68-3.64-2.04-4.91a7.84 7.84 0 0 0-5.59-2.24c-1.36 0-2.68.32-3.88.94l-1.64-1.75a10.15 10.15 0 0 1 5.52-1.49c2.72 0 5.37 1.11 7.23 3.13z"/>
      </svg>
    </span>
  `.trim(),

  // Official OpenRouter Gateway Emblem (Indigo #6366F1)
  openrouter: `
    <span class="agm-badge agm-badge-openrouter" title="OpenRouter" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="#6366F1" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16.93V15h-2v3.93c-3.95-.49-7.06-3.6-7.55-7.55H7.38v-2H3.45c.49-3.95 3.6-7.06 7.55-7.55V5.7h2V3.45c3.95.49 7.06 3.6 7.55 7.55h-3.93v2h3.93c-.49 3.95-3.6 7.06-7.55 7.55zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
      </svg>
    </span>
  `.trim(),

  // Official OpenAI Spiral Rosette (Emerald #10A37F)
  openai: `
    <span class="agm-badge agm-badge-openai" title="OpenAI" style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;">
      <svg class="agm-badge-icon" viewBox="0 0 24 24" width="14" height="14" fill="#10A37F" style="vertical-align:middle;flex-shrink:0;" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1636a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.402-.6862zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.407 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1635a.0804.0804 0 0 1-.038-.0567V6.0748a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.4598a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.6069 1.4997-2.602-1.4997z"/>
      </svg>
    </span>
  `.trim()
};

// Merged master SVG repository
const MODEL_SVGS = Object.assign({}, DEFAULT_MODEL_SVGS, SIBLING_ICONS);

/**
 * Injects the animation and styling for thinking badges and glow effects.
 */
function injectThinkingStyles(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  const STYLE_ID = 'agm-thinking-visuals-style';
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes agmPulseGlow {
      0% {
        transform: scale(1);
        filter: drop-shadow(0 0 2px var(--agm-glow-color, rgba(66, 133, 244, 0.4))) brightness(1);
        opacity: 0.92;
      }
      50% {
        transform: scale(1.15);
        filter: drop-shadow(0 0 8px var(--agm-glow-color, rgba(66, 133, 244, 0.85))) brightness(1.28);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        filter: drop-shadow(0 0 2px var(--agm-glow-color, rgba(66, 133, 244, 0.4))) brightness(1);
        opacity: 0.92;
      }
    }

    .agm-badge-thinking-pulse {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
      animation: agmPulseGlow 1.8s ease-in-out infinite !important;
      will-change: transform, filter !important;
      transform-origin: center center !important;
    }

    .agm-badge-thinking-done {
      display: inline-flex !important;
      align-items: center !important;
      vertical-align: middle !important;
      opacity: 0.86;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .agm-badge-thinking-done:hover {
      opacity: 1;
      transform: scale(1.06);
    }

    .agm-badge {
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
      flex-shrink: 0;
      line-height: 1;
    }

    .agm-badge-icon {
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }
  `.trim();

  const target = doc.head || doc.documentElement;
  if (target) {
    target.appendChild(style);
  }
}

/**
 * Returns the currently active model key from chat UI or settings cache.
 */
function getActiveChatModelKey(context = {}) {
  // 1. Check modSettingsCache passed via context or global window
  const settings = context.modSettingsCache ||
    (typeof window !== 'undefined' && (window.modSettingsCache || window.__modSettingsCache));

  if (settings && settings.litellm) {
    const activeId = settings.litellm.activeExternalModel || settings.litellm.defaultModel;
    if (activeId) {
      const lower = String(activeId).toLowerCase();
      if (lower.includes('deepseek')) return 'deepseek';
      if (lower.includes('nvidia') || lower.includes('nemotron')) return 'nvidia';
      if (lower.includes('argon')) return 'geminiArgon';
      if (lower.includes('flash') || lower.includes('gemini-3.8') || lower.includes('gemini 3.8')) return 'geminiFlash';
      if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus')) return 'claude';
      if (lower.includes('openrouter')) return 'openrouter';
      if (lower.includes('openai') || lower.includes('gpt')) return 'openai';
      if (lower.includes('gemini')) return 'geminiFlash';
    }
  }

  // 2. Check DOM trigger button: button[data-testid="model-selector-trigger"]
  if (typeof document !== 'undefined') {
    const trigger = document.querySelector('button[data-testid="model-selector-trigger"]');
    if (trigger) {
      const text = (trigger.innerText || trigger.textContent || '').trim().toLowerCase();
      const title = (trigger.getAttribute('title') || '').toLowerCase();
      const combined = `${text} ${title}`;

      if (combined.includes('deepseek')) return 'deepseek';
      if (combined.includes('nvidia') || combined.includes('nemotron')) return 'nvidia';
      if (combined.includes('argon')) return 'geminiArgon';
      if (combined.includes('flash') || combined.includes('gemini-3.8') || combined.includes('gemini 3.8')) return 'geminiFlash';
      if (combined.includes('claude') || combined.includes('sonnet') || combined.includes('opus')) return 'claude';
      if (combined.includes('openrouter')) return 'openrouter';
      if (combined.includes('openai') || combined.includes('gpt')) return 'openai';
      if (combined.includes('gemini')) return 'geminiFlash';
    }
  }

  // 3. Default fallback
  return 'geminiFlash';
}

/**
 * Resolves any model alias, text snippet, or identifier into a canonical model key.
 */
function resolveModelKey(rawInput, context = {}) {
  if (!rawInput) return getActiveChatModelKey(context);
  const str = String(rawInput).toLowerCase().trim();

  // 1. Direct canonical names
  if (str === 'deepseek' || str === 'deepseek-flash' || str === 'deepseek-v4-pro' || str === 'deepseek-v4-flash' || str === 'deepseek-chat' || str === 'deepseek-r1') {
    return 'deepseek';
  }
  if (str === 'geminiargon' || str === 'gemini-4-argon' || str === 'gemini-argon' || str === 'argon') {
    return 'geminiArgon';
  }
  if (str === 'geminiflash' || str === 'gemini-3.8-flash' || str === 'gemini-flash' || str === 'flash') {
    return 'geminiFlash';
  }
  if (str === 'nvidia' || str === 'nvidia-nim' || str === 'nvidia_nim') {
    return 'nvidia';
  }
  if (str === 'openrouter') {
    return 'openrouter';
  }
  if (str === 'claude' || str === 'anthropic') {
    return 'claude';
  }
  if (str === 'openai' || str === 'chatgpt') {
    return 'openai';
  }

  // 2. Pattern matching priority
  if (str.includes('deepseek')) return 'deepseek';
  if (str.includes('nvidia') || str.includes('nemotron')) return 'nvidia';
  if (str.includes('argon')) return 'geminiArgon';
  if (str.includes('flash') || str.includes('gemini-3.8') || str.includes('gemini 3.8')) return 'geminiFlash';
  if (str.includes('claude') || str.includes('sonnet') || str.includes('opus') || str.includes('haiku') || str.includes('anthropic')) return 'claude';
  if (str.includes('openrouter')) return 'openrouter';
  if (str.includes('openai') || str.includes('gpt-4') || str.includes('gpt-3') || str.includes('chatgpt') || str.includes('o1') || str.includes('o3')) return 'openai';
  if (str.includes('gemini')) return 'geminiFlash';

  // 3. Context-aware fallback
  return getActiveChatModelKey(context);
}

/**
 * Inspects a DOM element, its attributes, and its ancestors to deduce the intended model.
 * If no explicit model is mentioned in the element, returns the current active chat model.
 */
function resolveModelForElement(el, context = {}) {
  if (!el) return getActiveChatModelKey(context);

  // 1. Direct model attribute check
  const attrModel = el.getAttribute('data-model') || el.getAttribute('data-subagent-model') || el.getAttribute('data-agent-model');
  if (attrModel) {
    return resolveModelKey(attrModel, context);
  }

  // 2. Text of element itself
  const selfText = (el.innerText || el.textContent || '').trim().toLowerCase();
  if (selfText.includes('deepseek')) return 'deepseek';
  if (selfText.includes('nvidia') || selfText.includes('nemotron')) return 'nvidia';
  if (selfText.includes('argon')) return 'geminiArgon';
  if (selfText.includes('flash') || selfText.includes('gemini-3.8')) return 'geminiFlash';
  if (selfText.includes('claude') || selfText.includes('sonnet') || selfText.includes('opus')) return 'claude';
  if (selfText.includes('openrouter')) return 'openrouter';
  if (selfText.includes('openai') || selfText.includes('gpt-4') || selfText.includes('chatgpt')) return 'openai';

  // 3. Check ancestor tree (up to 6 levels)
  let parent = el.parentElement;
  let depth = 0;
  while (parent && depth < 6) {
    const parentAttr = parent.getAttribute('data-model') || parent.getAttribute('data-subagent-model');
    if (parentAttr) {
      return resolveModelKey(parentAttr, context);
    }
    const pText = (parent.innerText || parent.textContent || '').slice(0, 300).toLowerCase();
    if (pText.includes('deepseek')) return 'deepseek';
    if (pText.includes('nvidia') || pText.includes('nemotron')) return 'nvidia';
    if (pText.includes('argon')) return 'geminiArgon';
    if (pText.includes('flash') || pText.includes('gemini-3.8')) return 'geminiFlash';
    if (pText.includes('claude') || pText.includes('sonnet') || pText.includes('opus')) return 'claude';
    if (pText.includes('openrouter')) return 'openrouter';
    if (pText.includes('openai') || pText.includes('gpt-4')) return 'openai';

    parent = parent.parentElement;
    depth++;
  }

  // 4. Default to current active model of the chat
  return getActiveChatModelKey(context);
}

/**
 * Creates a brand badge DOM element with appropriate classes, styles, and animation.
 */
function createBadgeElement(modelKey, isActivelyThinking = false, customSvg = null) {
  if (typeof document === 'undefined') return null;

  const svgTemplate = customSvg || MODEL_SVGS[modelKey] || MODEL_SVGS.geminiFlash || '';
  const temp = document.createElement('div');
  temp.innerHTML = svgTemplate.trim();
  const el = temp.firstElementChild;
  if (!el) return null;

  el.setAttribute('data-agm-model-badge', modelKey);
  el.setAttribute('data-agm-thinking', isActivelyThinking ? 'active' : 'done');

  const glowColor = GLOW_COLORS[modelKey] || GLOW_COLORS.default;
  el.style.setProperty('--agm-glow-color', glowColor);

  const modelName = MODEL_DISPLAY_NAMES[modelKey] || modelKey;
  if (isActivelyThinking) {
    el.classList.add('agm-badge-thinking-pulse');
    el.classList.remove('agm-badge-thinking-done');
    el.setAttribute('title', `${modelName} is thinking...`);
  } else {
    el.classList.remove('agm-badge-thinking-pulse');
    el.classList.add('agm-badge-thinking-done');
    el.setAttribute('title', modelName);
  }

  return el;
}

/**
 * Inserts badge into the best DOM anchor position within host.
 */
function insertBadgeIntoHost(host, badge) {
  if (!host || !badge) return;

  // If host is a link (e.g., conversation://)
  if (host.tagName === 'A') {
    host.prepend(badge);
    return;
  }

  // Check if host is or contains a <summary>
  const summary = host.tagName === 'SUMMARY' ? host : host.querySelector('summary');
  const target = summary || host;

  // 1. Next to active spinner if present
  const spinner = target.querySelector(
    'svg.animate-spin, svg[class*="spin"], .spinner, [class*="spinner"], .codicon-loading, [class*="circle-notch"]'
  );
  if (spinner && spinner.parentNode) {
    spinner.insertAdjacentElement('afterend', badge);
    return;
  }

  // 2. Next to existing icon/avatar if present
  const icon = target.querySelector('svg, .codicon, [class*="icon"], [class*="avatar"]');
  if (icon && icon.parentNode && !icon.closest('[data-agm-model-badge]')) {
    icon.insertAdjacentElement('afterend', badge);
    return;
  }

  // 3. Fallback: prepend to target
  target.prepend(badge);
}

/**
 * Attaches or updates a badge on a given host element idempotently and reactively.
 */
function attachOrUpdateBadge(host, targetModelKey, isActivelyThinking, context = {}) {
  if (!host || !targetModelKey) return;

  const existingBadge = host.querySelector('[data-agm-model-badge]');
  if (existingBadge) {
    const curModel = existingBadge.getAttribute('data-agm-model-badge');
    const curThinking = existingBadge.getAttribute('data-agm-thinking') === 'active';

    if (curModel === targetModelKey && curThinking === isActivelyThinking) {
      return;
    }

    if (curModel === targetModelKey) {
      // Thinking state changed: update animation and tooltip
      existingBadge.setAttribute('data-agm-thinking', isActivelyThinking ? 'active' : 'done');
      const modelName = MODEL_DISPLAY_NAMES[targetModelKey] || targetModelKey;
      if (isActivelyThinking) {
        existingBadge.classList.add('agm-badge-thinking-pulse');
        existingBadge.classList.remove('agm-badge-thinking-done');
        existingBadge.setAttribute('title', `${modelName} is thinking...`);
      } else {
        existingBadge.classList.remove('agm-badge-thinking-pulse');
        existingBadge.classList.add('agm-badge-thinking-done');
        existingBadge.setAttribute('title', modelName);
      }
      return;
    }

    // Model changed: replace existing badge
    const customSvgs = (context && context.MODEL_SVGS) || {};
    const newBadge = createBadgeElement(targetModelKey, isActivelyThinking, customSvgs[targetModelKey]);
    if (newBadge && existingBadge.parentNode) {
      existingBadge.parentNode.replaceChild(newBadge, existingBadge);
    }
    return;
  }

  // Create new badge and insert
  const customSvgs = (context && context.MODEL_SVGS) || {};
  const badge = createBadgeElement(targetModelKey, isActivelyThinking, customSvgs[targetModelKey]);
  if (!badge) return;

  insertBadgeIntoHost(host, badge);
}

/**
 * Scans and decorates all thinking states (Thinking..., Thought for ..., Reasoning...).
 */
function applyThinkingVisuals(context = {}, root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;

  const candidates = root.querySelectorAll(
    'details, summary, [class*="thought"], [class*="thinking"], [class*="reasoning"], [data-testid*="thought"], [data-testid*="thinking"], [data-testid*="reasoning"]'
  );

  for (const el of candidates) {
    const host = el.tagName === 'DETAILS' ? (el.querySelector('summary') || el) : el;
    if (!host) continue;

    const text = (host.innerText || host.textContent || '').trim();
    if (!text || text.length > 200) continue;

    const lower = text.toLowerCase();
    const isThinkingText =
      lower.startsWith('thinking') ||
      lower.startsWith('thought') ||
      lower.startsWith('reasoning') ||
      lower.startsWith('думає') ||
      lower.startsWith('думает') ||
      lower.startsWith('обдумування') ||
      lower.startsWith('мислить') ||
      lower.startsWith('подумав') ||
      lower.startsWith('подумал') ||
      lower.includes('thought for') ||
      lower.includes('reasoned for') ||
      lower.includes('thinking...') ||
      lower.includes('reasoning...');

    const hasSpinner = Boolean(
      host.querySelector('svg.animate-spin, svg[class*="spin"], .spinner, [class*="spinner"], .codicon-loading, [class*="circle-notch"]')
    );

    if (!isThinkingText && !hasSpinner) continue;

    const isActivelyThinking =
      hasSpinner ||
      lower.includes('thinking...') ||
      lower.includes('reasoning...') ||
      lower.includes('running...') ||
      lower.includes('working...') ||
      lower.includes('думає...') ||
      lower.includes('думает...') ||
      (lower.startsWith('thinking') && !lower.includes('thought for')) ||
      (lower.startsWith('reasoning') && !lower.includes('reasoned for'));

    const modelKey = resolveModelForElement(host, context);
    attachOrUpdateBadge(host, modelKey, isActivelyThinking, context);
  }
}

/**
 * Scans and decorates subagent cards in chat, sidebar, tool headers, and links.
 */
function applySubagentVisuals(context = {}, root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;

  // 1. Explicit subagent elements & conversation links
  const subagentElements = root.querySelectorAll(
    '[data-subagent], [class*="subagent"], [data-testid*="subagent"], [class*="cross-agent"], [data-agent-type], a[href^="conversation://"]'
  );

  for (const el of subagentElements) {
    if (el.classList.contains('agm-badge') || el.closest('[data-agm-model-badge]')) continue;
    const modelKey = resolveModelForElement(el, context);
    attachOrUpdateBadge(el, modelKey, false, context);
  }

  // 2. Tool invocation headers (invoke_subagent / invoke_cross_agent)
  const toolHeaders = root.querySelectorAll(
    '[data-testid*="tool"], [class*="tool-call"], [class*="toolcall"], [class*="step-header"], summary, [role="button"]'
  );

  for (const item of toolHeaders) {
    if (item.classList.contains('agm-badge') || item.closest('[data-agm-model-badge]')) continue;
    const text = (item.innerText || item.textContent || '').trim();
    if (!text || text.length > 150) continue;

    if (text.includes('invoke_subagent') || text.includes('invoke_cross_agent') || text.includes('Subagent Response')) {
      const modelKey = resolveModelForElement(item, context);
      attachOrUpdateBadge(item, modelKey, false, context);
    }
  }

  // 3. Sidebar subagent list items
  const listItems = root.querySelectorAll('[role="listitem"]');
  for (const item of listItems) {
    if (item.classList.contains('agm-badge') || item.closest('[data-agm-model-badge]')) continue;
    const text = (item.innerText || item.textContent || '').trim();
    if (!text || text.length > 90 || text.includes('\n')) continue;
    const lower = text.toLowerCase();

    if (
      lower.includes('subagent') ||
      lower.includes('agent') ||
      lower.includes('claude') ||
      lower.includes('deepseek') ||
      lower.includes('argon') ||
      lower.includes('flash') ||
      lower.includes('nvidia') ||
      lower.includes('openrouter') ||
      lower.includes('task #')
    ) {
      const modelKey = resolveModelForElement(item, context);
      attachOrUpdateBadge(item, modelKey, false, context);
    }
  }
}

/**
 * Main export: scans document and decorates all subagents and thinking states with brand badges.
 */
function applySubagentAndThinkingVisuals(context = {}) {
  try {
    if (typeof document === 'undefined') return;

    injectThinkingStyles(document);
    applyThinkingVisuals(context, document);
    applySubagentVisuals(context, document);
  } catch (err) {
    if (context && context.debug) {
      console.warn('[SubagentThinkingVisuals] applySubagentAndThinkingVisuals error:', err);
    }
  }
}

// Observer state
let visualsObserver = null;
let visualsInterval = null;
let rafHandle = null;

/**
 * Starts continuous DOM observation with 60fps debounce and fallback heartbeat.
 */
function startSubagentVisualsObserver(context = {}) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  if (visualsObserver) return;

  injectThinkingStyles(document);
  applySubagentAndThinkingVisuals(context);

  const scheduleApply = () => {
    if (rafHandle) return;
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      applySubagentAndThinkingVisuals(context);
    });
  };

  visualsObserver = new MutationObserver(() => {
    scheduleApply();
  });

  const root = document.documentElement || document.body;
  if (root) {
    visualsObserver.observe(root, { childList: true, subtree: true, characterData: true });
  }

  visualsInterval = setInterval(() => {
    applySubagentAndThinkingVisuals(context);
  }, 1800);
}

/**
 * Disconnects continuous observer and clears heartbeat timer.
 */
function stopSubagentVisualsObserver() {
  if (visualsObserver) {
    visualsObserver.disconnect();
    visualsObserver = null;
  }
  if (visualsInterval) {
    clearInterval(visualsInterval);
    visualsInterval = null;
  }
  if (rafHandle && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
}

const exportedModule = {
  applySubagentAndThinkingVisuals,
  resolveModelKey,
  getActiveChatModelKey,
  resolveModelForElement,
  injectThinkingStyles,
  createBadgeElement,
  startSubagentVisualsObserver,
  stopSubagentVisualsObserver,
  MODEL_SVGS,
  BRAND_COLORS,
  GLOW_COLORS,
  MODEL_DISPLAY_NAMES
};

if (typeof window !== 'undefined') {
  window.applySubagentAndThinkingVisuals = applySubagentAndThinkingVisuals;
  window.AntigravitySubagentVisuals = exportedModule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportedModule;
}
