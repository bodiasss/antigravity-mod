'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const targetFile = process.env.ANTIGRAVITY_ACCOUNT_UI
  ? path.resolve(process.env.ANTIGRAVITY_ACCOUNT_UI)
  : path.join(os.homedir(), 'antigravity-seamless', 'resources', 'app', 'dist', 'accountUi.js');
let code = fs.readFileSync(targetFile, 'utf8');

const BADGES_CODE = `
  // --- Antigravity Mod: Model Badges for Subagents & Tasks ---
  const MODEL_SVGS = {
    claude: '<span title="Claude Sonnet/Opus 5.5" class="agm-badge" style="display:inline-flex;align-items:center;margin-right:5px;vertical-align:middle;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none"><circle cx="12" cy="12" r="11" fill="#140f0c" stroke="#4a2e1d" stroke-width="1.2"/><path d="M12 4.5V19.5M4.5 12H19.5M6.7 6.7L17.3 17.3M6.7 17.3L17.3 6.7" stroke="#E0A899" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="#F8C8BA"/></svg></span>',
    deepseek: '<span title="DeepSeek Flash" class="agm-badge" style="display:inline-flex;align-items:center;margin-right:5px;vertical-align:middle;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none"><circle cx="12" cy="12" r="11" fill="#081520" stroke="#0e3a54" stroke-width="1.2"/><path d="M6 16.5C8.8 16.5 10.8 14.8 13 11.2C15.2 7.6 18.5 6.5 20 6.5C19.2 9.5 17.2 13.5 13.5 15.2C10 16.8 7.5 17 6 16.5Z" fill="#38BDF8"/><path d="M13 11.2C11 8.5 8.5 7 5.5 7C7.2 9 8.8 11.5 10.5 13.2L13 11.2Z" fill="#0284C7"/></svg></span>',
    geminiFlash: '<span title="Gemini 3.8 Flash" class="agm-badge" style="display:inline-flex;align-items:center;margin-right:5px;vertical-align:middle;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none"><circle cx="12" cy="12" r="11" fill="#1a1406" stroke="#4a390e" stroke-width="1.2"/><path d="M12 3C12 7.97 7.97 12 3 12C7.97 12 12 16.03 12 21C12 16.03 16.03 12 21 12C16.03 12 12 7.97 12 3Z" fill="#F59E0B"/><circle cx="12" cy="12" r="1.8" fill="#FFF"/></svg></span>',
    geminiArgon: '<span title="Gemini 4 Argon" class="agm-badge" style="display:inline-flex;align-items:center;margin-right:5px;vertical-align:middle;"><svg viewBox="0 0 24 24" width="13" height="13" fill="none"><circle cx="12" cy="12" r="11" fill="#150b1f" stroke="#462264" stroke-width="1.2"/><path d="M12 2.5C12 7.75 7.75 12 2.5 12C7.75 12 12 16.25 12 21.5C12 16.25 16.25 12 21.5 12C16.25 12 12 7.75 12 2.5Z" fill="#A855F7"/><circle cx="12" cy="12" r="2.2" fill="#E9D5FF"/></svg></span>'
  };

  function updateTaskModelBadges() {
    const listItems = document.querySelectorAll('button, [role="listitem"], [role="button"], div');
    for (const item of listItems) {
      if (item.querySelector('.agm-badge')) continue;
      const text = (item.innerText || '').trim();
      if (!text || text.length > 90 || text.includes('\\n')) continue;

      const lower = text.toLowerCase();
      let badgeHtml = null;

      if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus')) {
        badgeHtml = MODEL_SVGS.claude;
      } else if (lower.includes('deepseek')) {
        badgeHtml = MODEL_SVGS.deepseek;
      } else if (lower.includes('argon') || lower.includes('modloader')) {
        badgeHtml = MODEL_SVGS.geminiArgon;
      } else if (lower.includes('flash') || lower.includes('dataservice') || lower.includes('verify') || lower.includes('test')) {
        badgeHtml = MODEL_SVGS.geminiFlash;
      }

      if (badgeHtml) {
        // Find circular spinner or first text node
        const spinner = item.querySelector('svg, .spinner, [class*="spin"], [class*="circle"]');
        const container = document.createElement('span');
        container.innerHTML = badgeHtml;
        const badgeEl = container.firstElementChild;

        if (spinner && spinner.parentElement) {
          spinner.insertAdjacentElement('afterend', badgeEl);
        } else {
          item.insertBefore(badgeEl, item.firstChild);
        }
      }
    }
  }
`;

if (!code.includes('updateTaskModelBadges()')) {
  // Replace the mutation observer to include updateTaskModelBadges
  code = code.replace(
    '    scheduleReassert();\r\n    scheduleModelMenuItem();',
    '    scheduleReassert();\r\n    scheduleModelMenuItem();\r\n    updateTaskModelBadges();'
  );
  code = code.replace(
    '    scheduleReassert();\n    scheduleModelMenuItem();',
    '    scheduleReassert();\n    scheduleModelMenuItem();\n    updateTaskModelBadges();'
  );

  // Append BADGES_CODE before modObserver
  code = code.replace('  const modObserver = new MutationObserver', BADGES_CODE + '\n  const modObserver = new MutationObserver');
  fs.writeFileSync(targetFile, code, 'utf8');
  console.log('accountUi.js successfully patched with Task & Subagent Model Badges!');
} else {
  console.log('Model badges already installed.');
}
