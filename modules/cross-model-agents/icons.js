'use strict';

/**
 * Cross-model agents — SVG brand badges.
 *
 * Every entry in ICONS is a self-contained badge <span> wrapping an inline
 * <svg width="14" height="14">, so it can be injected into any innerHTML sink
 * without extra CSS or asset requests.
 *
 * Markup contract:
 *   <span class="agm-badge agm-badge-<key>" data-ag-badge-key="<key>"
 *         style="display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;flex-shrink:0;">
 *     <svg ... width="14" height="14" style="vertical-align:middle;flex-shrink:0;">...</svg>
 *   </span>
 */

/* ------------------------------------------------------------------ */
/* Raw SVG bodies (inner markup only, no <svg> wrapper)                */
/* ------------------------------------------------------------------ */

const ICON_BODIES = {
  /* DeepSeek whale mark. */
  deepseek:
    '<path fill="#3898FF" d="M12 2.1c.42.72.72 1.5.9 2.32.14.62.2 1.26.16 1.9 1.02-.42 2.16-.52 3.24-.28 1.2.26 2.3.88 3.14 1.78-1.02-.32-2.1-.4-3.16-.2-.9.16-1.74.54-2.46 1.1.9.24 1.72.72 2.38 1.38-.98-.36-2.04-.5-3.08-.42a6.4 6.4 0 0 1 1.7 2.5c.3.92.34 1.9.12 2.84-.44-1.34-1.24-2.52-2.3-3.4.28 1.04.3 2.14.06 3.2a7.4 7.4 0 0 0-1.9-3.1c-.7-.72-1.56-1.26-2.5-1.6.86.86 1.44 1.96 1.68 3.14-.96-.98-2.16-1.7-3.48-2.1.74.9 1.2 1.98 1.34 3.12a7.8 7.8 0 0 0-2.86-1.86c.44.9.6 1.9.46 2.88a6.4 6.4 0 0 0-2.3-1.9c.18.86.16 1.76-.06 2.6A5.6 5.6 0 0 0 2.3 15.1c-.3.9-.36 1.86-.18 2.78.8-1.18 1.9-2.12 3.18-2.7a6.7 6.7 0 0 0-1.3 3.02c1.06-1.02 2.34-1.74 3.74-2.1-1.2.94-2.1 2.2-2.6 3.62 1.32-.66 2.78-1 4.26-1-.86.66-1.56 1.5-2.04 2.46 1.44.3 2.9.3 4.34 0 1.04-.22 2.02-.66 2.9-1.28-.78.14-1.58.12-2.34-.06.9-.38 1.68-.98 2.28-1.74-.84.22-1.72.28-2.58.18.94-.5 1.74-1.22 2.32-2.1a7.8 7.8 0 0 1-3.3 1.12c1.06-.6 1.94-1.46 2.56-2.48 1.06.34 2.2.36 3.26.06 1.34-.38 2.5-1.2 3.28-2.32a8.2 8.2 0 0 1-4.4 1.16c1.06-.5 2-1.22 2.74-2.12 1.06.28 2.18.3 3.24.06a7.6 7.6 0 0 0-2.4-4.42c.9-.38 1.7-.98 2.3-1.76a8.8 8.8 0 0 0-3.36-4.16 8.6 8.6 0 0 0-5.2-1.4z"/>',

  /* Google Gemini four-pointed spark. */
  geminiFlash:
    '<path fill="#4285F4" d="M12 2c.5 3 1.42 5.28 2.96 6.86C16.5 10.44 18.78 11.4 22 12c-3.22.6-5.5 1.56-7.04 3.14C13.42 16.72 12.5 19 12 22c-.5-3-1.42-5.28-2.96-6.86C7.5 13.56 5.22 12.6 2 12c3.22-.6 5.5-1.56 7.04-3.14C10.58 7.28 11.5 5 12 2z"/>',

  /* Gemini spark (Argon violet) + compact "4" badge. */
  geminiArgon:
    '<path fill="#A855F7" d="M11 2c.45 2.7 1.28 4.75 2.66 6.17 1.4 1.42 3.44 2.28 6.34 2.83-2.9.55-4.94 1.41-6.34 2.83C12.28 15.25 11.45 17.3 11 20c-.45-2.7-1.28-4.75-2.66-6.17C6.94 12.41 4.9 11.55 2 11c2.9-.55 4.94-1.41 6.34-2.83C9.72 6.75 10.55 4.7 11 2z"/>' +
    '<text x="15.4" y="21.4" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="7.4" font-weight="700" fill="#C084FC" text-anchor="middle">4</text>',

  /* Anthropic Claude radial asterisk. */
  claude:
    '<g stroke="#D97706" stroke-width="1.9" stroke-linecap="round">' +
    '<path d="M12 3.4v5.1M12 15.5v5.1M3.4 12h5.1M15.5 12h5.1"/>' +
    '<path d="M5.9 5.9l3.6 3.6M14.5 14.5l3.6 3.6M18.1 5.9l-3.6 3.6M9.5 14.5l-3.6 3.6"/>' +
    '</g>' +
    '<circle cx="12" cy="12" r="2.5" fill="#D97706"/>',

  /* NVIDIA eye / swirl mark. */
  nvidia:
    '<path fill="#76B900" d="M9.1 4.9v2.24c.19-.02.38-.03.57-.03 3.56 0 6.14 2.9 6.14 5 0 1.48-1.18 2.76-2.7 2.76a2.66 2.66 0 0 1-2.1-1.04v2.88c.45.1.92.16 1.4.16 3.22 0 5.6-2.44 5.6-5.46 0-4.1-4-6.04-7.1-6.5-.42-.06-.86-.07-1.81-.01z"/>' +
    '<path fill="#76B900" d="M7.02 5.36C4.63 5.97 2.47 7.84 2.47 11.23c0 3.22 2.53 5.22 4.55 5.7v-2.46c-1.22-.44-1.94-1.55-1.94-2.88 0-1.33.73-2.44 1.94-2.9z"/>' +
    '<path fill="#76B900" d="M9.1 8.98v2.11c.14-.05.3-.08.45-.08.62 0 1.08.49 1.08 1.05s-.46 1.04-1.08 1.04a1 1 0 0 1-.45-.1v2.11c.29.07.59.1.89.1 1.66 0 2.94-1.38 2.94-3.14s-1.28-3.14-2.94-3.14c-.3 0-.6.03-.89.1z"/>',

  /* OpenRouter: split routing with diverging arrows. */
  openrouter:
    '<path fill="#A855F7" d="M2.4 11.1h5.3l1.1 1.8H2.4z" opacity=".6"/>' +
    '<path fill="#A855F7" d="M7.7 11.1L2.4 6.2h4.1l3.9 3.3v1.6H7.7zM7.7 12.9L2.4 17.8h4.1l3.9-3.3v-1.6H7.7z" opacity=".6"/>' +
    '<path fill="#A855F7" d="M14.4 4.4l1.9 1.9-2.3 2.3h5.6V5.9l-2.1-2.1zM14.4 19.6l1.9-1.9-2.3-2.3h5.6v2.7l-2.1 2.1z"/>' +
    '<path fill="#A855F7" d="M12 10.6l2 1.4-2 1.4-2-1.4z"/>',

  /* OpenAI knot / hexagonal flower mark. */
  openai:
    '<g fill="none" stroke="#10A37F" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M12 2.9l6.2 3.6v7.1L12 17.2 5.8 13.6V6.5z"/>' +
    '<path d="M12 7.1l3.2 1.85v3.7L12 14.5l-3.2-1.85v-3.7z" opacity=".5"/>' +
    '<path d="M5.8 6.5l6.2 3.6 6.2-3.6M12 10.1v7.1M12 17.2l6.2 3.6M12 17.2l-6.2 3.6"/>' +
    '</g>',

  /* Groq bolt (brand orange). */
  groq:
    '<path fill="#F55036" d="M13.9 2.2L4.6 13.4h5.3L8.1 21.8l9.3-11.2h-5.3z"/>',
};

/* ------------------------------------------------------------------ */
/* Badge builder                                                       */
/* ------------------------------------------------------------------ */

const BADGE_STYLE =
  'display:inline-flex;align-items:center;margin-right:6px;vertical-align:middle;flex-shrink:0;';
const SVG_STYLE = 'vertical-align:middle;flex-shrink:0;';

/**
 * Render the standalone <svg> for a given icon key.
 * @param {string} key
 * @returns {string}
 */
function buildSvg(key) {
  const body = ICON_BODIES[key];
  if (!body) return '';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
    'width="14" height="14" role="img" aria-hidden="true" focusable="false" ' +
    'style="' + SVG_STYLE + '">' + body + '</svg>'
  );
}

/**
 * Render the canonical badge <span> around an icon.
 * @param {string} key
 * @param {string} [extraClass] Space separated extra class names.
 * @param {string} [extraStyle] Extra inline CSS appended to the badge style.
 * @returns {string}
 */
function buildBadge(key, extraClass, extraStyle) {
  const cls = 'agm-badge agm-badge-' + key + (extraClass ? ' ' + extraClass : '');
  const style = BADGE_STYLE + (extraStyle ? ' ' + extraStyle : '');
  return (
    '<span class="' + cls + '" data-ag-badge-key="' + key + '" style="' + style + '">' +
    buildSvg(key) +
    '</span>'
  );
}

const THINKING_STYLE = 'animation:agm-badge-pulse 1.1s ease-in-out infinite;';

/* ------------------------------------------------------------------ */
/* Public ICONS map                                                    */
/* ------------------------------------------------------------------ */

const ICONS = {
  deepseek: buildBadge('deepseek'),
  geminiFlash: buildBadge('geminiFlash'),
  geminiArgon: buildBadge('geminiArgon'),
  claude: buildBadge('claude'),
  nvidia: buildBadge('nvidia'),
  openrouter: buildBadge('openrouter'),
  openai: buildBadge('openai'),
  groq: buildBadge('groq'),
};

/* ------------------------------------------------------------------ */
/* Provider / model resolution                                         */
/* ------------------------------------------------------------------ */

/**
 * Normalise an arbitrary model id, label, or free text into a known icon key.
 *
 * @param {string} input Model name, model id, or free text.
 * @param {string} [providerHint] Provider id, e.g. 'openrouter', 'nvidia_nim', 'deepseek'.
 * @returns {'deepseek'|'geminiFlash'|'geminiArgon'|'claude'|'nvidia'|'openrouter'|'openai'|'groq'}
 */
function resolveIconKey(input, providerHint) {
  const hint = String(providerHint == null ? '' : providerHint).toLowerCase().trim();
  const s = String(input == null ? '' : input).toLowerCase();

  const has = function (needles) {
    for (let i = 0; i < needles.length; i++) {
      if (s.indexOf(needles[i]) !== -1) return true;
    }
    return false;
  };

  // Provider hints describe the transport, so they win over the model name.
  if (hint === 'openrouter' || hint.indexOf('openrouter') !== -1) return 'openrouter';
  if (
    hint === 'nvidia_nim' ||
    hint === 'nvidia' ||
    hint.indexOf('nvidia') !== -1 ||
    hint.indexOf('nim') !== -1
  ) {
    return 'nvidia';
  }
  if (hint === 'deepseek' || hint.indexOf('deepseek') !== -1) return 'deepseek';
  if (hint === 'claude' || hint.indexOf('anthropic') !== -1) return 'claude';
  if (hint === 'groq' || hint.indexOf('groq') !== -1) return 'groq';
  if (hint === 'openai' || hint.indexOf('openai') !== -1) return 'openai';
  if (hint === 'gemini' || hint.indexOf('gemini') !== -1) {
    return has(['argon', 'gemini 4', 'gemini-4', 'gemini4']) ? 'geminiArgon' : 'geminiFlash';
  }

  // Text resolution.
  if (has(['openrouter'])) return 'openrouter';
  if (has(['nvidia', 'nemotron', 'mistral', 'nim'])) return 'nvidia';
  if (has(['deepseek'])) return 'deepseek';
  if (has(['claude', 'sonnet', 'opus', 'anthropic'])) return 'claude';
  if (has(['argon', 'gemini 4', 'gemini-4', 'gemini4'])) return 'geminiArgon';
  if (has(['gemini', 'flash'])) return 'geminiFlash';
  if (has(['gpt', 'openai', 'chatgpt'])) return 'openai';
  if (has(['groq'])) return 'groq';

  return 'geminiFlash';
}

/* ------------------------------------------------------------------ */
/* HTML helper                                                         */
/* ------------------------------------------------------------------ */

/**
 * Return the badge HTML for a model / provider pair.
 *
 * @param {string} input
 * @param {string} [providerHint]
 * @param {{thinking?: boolean, title?: string, className?: string}} [options]
 * @returns {string}
 */
function getBadgeHtml(input, providerHint, options) {
  const opts = options || {};
  const key = resolveIconKey(input, providerHint);

  const extras = [];
  if (opts.thinking === true) extras.push('agm-badge-thinking');
  if (opts.className) extras.push(String(opts.className));

  let html = buildBadge(
    key,
    extras.join(' '),
    opts.thinking === true ? THINKING_STYLE : ''
  );

  if (opts.title) {
    const safeTitle = String(opts.title)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace('<span ', '<span title="' + safeTitle + '" ');
  }

  return html;
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

module.exports = {
  ICONS: ICONS,
  ICON_BODIES: ICON_BODIES,
  resolveIconKey: resolveIconKey,
  getBadgeHtml: getBadgeHtml,
  buildSvg: buildSvg,
  buildBadge: buildBadge,
};
