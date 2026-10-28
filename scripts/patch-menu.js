'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const file = process.env.ANTIGRAVITY_ACCOUNT_UI
  ? path.resolve(process.env.ANTIGRAVITY_ACCOUNT_UI)
  : path.join(os.homedir(), 'antigravity-seamless', 'resources', 'app', 'dist', 'accountUi.js');
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('  function installModelMenuItem() {');
const endMarker = '  function buildModPanel() {';
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers in accountUi.js', { startIdx, endIdx });
  process.exit(1);
}

const replacement = `  function installModelMenuItem() {
    const items = [...document.querySelectorAll('[role="menuitem"]')].filter(
      (node) => node.getBoundingClientRect().height > 0,
    );
    const view = items.find((node) => (node.innerText || '').trim() === 'View Usage');
    if (!view || !view.parentElement) return;

    // --- 1. Inject DeepSeek Flash into the model list (right above Custom) ---
    if (!view.parentElement.querySelector('[data-ag-mod-deepseek-item]')) {
      const customItem = items.find((node) => (node.innerText || '').trim().startsWith('Custom'));
      const templateItem = items.find((node) => {
        const text = (node.innerText || '').toLowerCase();
        return (text.includes('gemini') || text.includes('claude') || text.includes('gpt')) &&
               !node.hasAttribute('data-ag-mod-model-item') &&
               !node.hasAttribute('data-ag-mod-overview-item');
      });

      if (templateItem) {
        const dsClone = templateItem.cloneNode(true);
        dsClone.setAttribute('data-ag-mod-deepseek-item', '1');
        dsClone.removeAttribute('id');

        const activeName = (document.querySelector('button[data-testid="model-selector-trigger"]')?.innerText || '').toLowerCase();
        const isDsActive = activeName.includes('deepseek');

        // Set model name
        const spans = [...dsClone.querySelectorAll('span')];
        const nameSpan = spans.find(s => /Gemini|Claude|GPT/i.test(s.textContent || '')) || spans[0];
        if (nameSpan) nameSpan.textContent = 'DeepSeek Flash';

        // Set subtitle
        const medSpan = spans.find(s => (s.textContent || '').trim() === 'Medium');
        if (medSpan) medSpan.textContent = 'Medium';

        // Set badge
        const badgeSpan = spans.find(s => /New|Notice/i.test(s.textContent || ''));
        if (badgeSpan) {
          badgeSpan.textContent = 'New';
          badgeSpan.style.color = '#E0A899';
        }

        // Checkmark
        const checkSvg = dsClone.querySelector('svg');
        if (checkSvg && !isDsActive) {
          checkSvg.style.visibility = 'hidden';
        }

        dsClone.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          const trigger = document.querySelector('button[data-testid="model-selector-trigger"]');
          if (trigger) {
            const tSpan = trigger.querySelector('span') || trigger;
            tSpan.textContent = 'DeepSeek Flash (Medium)';
            trigger.setAttribute('title', 'DeepSeek Flash (Medium)');
          }

          document.body.click();
          if (typeof showToast === 'function') {
            showToast('Switched to DeepSeek Flash (via DeepCode API key)');
          }
        }, true);

        if (customItem) {
          customItem.insertAdjacentElement('beforebegin', dsClone);
        } else {
          view.insertAdjacentElement('beforebegin', dsClone);
        }
      }
    }

    // --- 2. Inject Mod · Accounts ---
    if (!view.parentElement.querySelector('[data-ag-mod-model-item]')) {
      const clone = view.cloneNode(true);
      clone.setAttribute('data-ag-mod-model-item', '1');
      clone.removeAttribute('id');
      clone.setAttribute('aria-haspopup', 'false');
      clone.setAttribute('aria-expanded', 'false');

      const label = [...clone.querySelectorAll('span')].find(
        (node) => (node.textContent || '').trim() === 'View Usage',
      );
      if (label) label.textContent = 'Mod · Accounts';

      clone.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          const trigger = document.querySelector('button[data-testid="model-selector-trigger"]');
          if (trigger) trigger.click();
          setTimeout(() => open(), 80);
        },
        true,
      );

      view.insertAdjacentElement('afterend', clone);
    }

    // --- 3. Inject Mod · Overview ---
    if (!view.parentElement.querySelector('[data-ag-mod-overview-item]')) {
      const oClone = view.cloneNode(true);
      oClone.setAttribute('data-ag-mod-overview-item', '1');
      oClone.removeAttribute('id');
      oClone.setAttribute('aria-haspopup', 'false');
      oClone.setAttribute('aria-expanded', 'false');

      const oLabel = [...oClone.querySelectorAll('span')].find(
        (node) => (node.textContent || '').trim() === 'View Usage',
      );
      if (oLabel) oLabel.textContent = 'Mod · Overview';

      oClone.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          const trigger = document.querySelector('button[data-testid="model-selector-trigger"]');
          if (trigger) trigger.click();

          const overlay = document.getElementById('antigravity-mod-mod-overview-overlay');
          if (overlay) {
            overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
          }
        },
        true,
      );

      const modAcc = view.parentElement.querySelector('[data-ag-mod-model-item]');
      if (modAcc) {
        modAcc.insertAdjacentElement('afterend', oClone);
      } else {
        view.insertAdjacentElement('afterend', oClone);
      }
    }
  }
`;

content = content.slice(0, startIdx) + replacement + '\r\n\r\n' + content.slice(endIdx);
fs.writeFileSync(file, content, 'utf8');
console.log('accountUi.js successfully patched with DeepSeek Flash and Mod Overview!');
