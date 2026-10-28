'use strict';

/**
 * Antigravity Mod Uninstaller
 * Safely removes the mod hook and restores stock files.
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

function uninstall() {
  for (const target of TARGETS) {
    if (fs.existsSync(target)) {
      const backupPath = target + '.stock_backup';
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, target);
        fs.unlinkSync(backupPath);
        console.log(`[Uninstaller] Restored backup: ${target}`);
      } else {
        let content = fs.readFileSync(target, 'utf8');
        content = content.replace(/\/\* ANTIGRAVITY-MOD-LOADER \*\/[\s\S]*?\n/g, '');
        fs.writeFileSync(target, content, 'utf8');
        console.log(`[Uninstaller] Cleaned hook from: ${target}`);
      }
    }
  }
  console.log('[Uninstaller] Complete.');
}

uninstall();
