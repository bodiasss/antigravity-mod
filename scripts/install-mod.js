'use strict';

/**
 * Antigravity Mod Installer
 * Injects the mod loader into the Antigravity distribution.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// Resolved at runtime so the repo carries no machine-specific paths. Override
// with ANTIGRAVITY_APP_DIST when the app lives elsewhere.
const TARGETS = process.env.ANTIGRAVITY_APP_DIST
  ? [path.resolve(process.env.ANTIGRAVITY_APP_DIST)]
  : [
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'antigravity', 'resources', 'app', 'dist', 'main.js'),
      path.join(os.homedir(), 'antigravity-seamless', 'resources', 'app', 'dist', 'main.js'),
    ];

const MOD_ENTRY = path.resolve(__dirname, '../core/index.js').replace(/\\/g, '/');
const HOOK_SIGNATURE = '/* ANTIGRAVITY-MOD-LOADER */';
const HOOK_CODE = `\n${HOOK_SIGNATURE}\ntry { require('${MOD_ENTRY}').init(); } catch(e) { console.error('[AntigravityMod Loader]', e); }\n`;

function install() {
  let patchedCount = 0;

  for (const target of TARGETS) {
    if (fs.existsSync(target)) {
      console.log(`[Installer] Found Antigravity target: ${target}`);
      const content = fs.readFileSync(target, 'utf8');

      if (content.includes(HOOK_SIGNATURE)) {
        console.log(`[Installer] Mod hook already installed in: ${target}`);
        patchedCount++;
        continue;
      }

      // Create stock backup
      const backupPath = target + '.stock_backup';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, 'utf8');
        console.log(`[Installer] Created stock backup: ${backupPath}`);
      }

      // Inject hook after "use strict";
      let patchedContent;
      if (content.includes('"use strict";')) {
        patchedContent = content.replace('"use strict";', `"use strict";${HOOK_CODE}`);
      } else {
        patchedContent = HOOK_CODE + content;
      }

      fs.writeFileSync(target, patchedContent, 'utf8');
      console.log(`[Installer] Successfully patched: ${target}`);
      patchedCount++;
    }
  }

  if (patchedCount === 0) {
    console.warn('[Installer] No Antigravity target found. Make sure antigravity-seamless or the app is unpacked.');
  } else {
    console.log(`\n=== Antigravity Mod successfully installed into ${patchedCount} target(s)! ===`);
  }
}

install();
