'use strict';

/**
 * Antigravity Modding Framework - Electron Runtime Injector
 * Connects the mod loader, IPC channels, hotkeys, and UI injection
 * into the running Antigravity Electron process.
 */

const fs = require('fs');
const path = require('path');
const dataService = require('./data-service');

class Injector {
  constructor(loader) {
    this.loader = loader;
    this.installed = false;
    this.overlayVisible = false;
  }

  /**
   * Hook called from Antigravity's main process.
   */
  init(electronApp, electronSession, BrowserWindow, globalShortcut, ipcMain) {
    if (this.installed) return;
    this.installed = true;

    console.log('[AntigravityMod] Injector active. Booting modules...');
    this.loader.discoverModules();

    // 1. IPC Handlers
    if (ipcMain) {
      ipcMain.handle('antigravity-mod:get-overview', async () => {
        return dataService.getOverviewData();
      });

      ipcMain.handle('antigravity-mod:list-modules', async () => {
        return this.loader.listModules();
      });

      ipcMain.handle('antigravity-mod:toggle-overview', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) this.toggleOverlay(win);
      });
    }

    // 2. Global Hotkey for Mod Overview (Ctrl+Alt+M)
    const registerHotkeys = () => {
      if (globalShortcut) {
        try {
          const registered = globalShortcut.register('CommandOrControl+Alt+M', () => {
            const focused = BrowserWindow.getFocusedWindow();
            if (focused) {
              this.toggleOverlay(focused);
            }
          });
          if (registered) {
            console.log('[AntigravityMod] Registered hotkey: Ctrl+Alt+M for Mod Overview');
          }
        } catch (e) {
          console.warn('[AntigravityMod] Failed to register hotkey:', e.message);
        }
      }
    };

    // 3. WebContents injection
    const setupWebContents = (win) => {
      win.webContents.on('did-finish-load', () => {
        this.injectModuleAssets(win);
      });
      if (win.webContents && typeof win.webContents.isLoading === 'function' && !win.webContents.isLoading()) {
        this.injectModuleAssets(win);
      }
    };

    if (electronApp) {
      if (electronApp.isReady()) {
        registerHotkeys();
        BrowserWindow.getAllWindows().forEach(setupWebContents);
      } else {
        electronApp.whenReady().then(() => {
          registerHotkeys();
          electronApp.on('browser-window-created', (_, win) => setupWebContents(win));
        });
      }
    }
  }

  /**
   * Injects CSS and JS for registered modules into a BrowserWindow.
   */
  async injectModuleAssets(win) {
    for (const [id, mod] of this.loader.modules.entries()) {
      // Inject module style if present
      if (mod.stylePath && fs.existsSync(mod.stylePath)) {
        try {
          const css = fs.readFileSync(mod.stylePath, 'utf8');
          await win.webContents.insertCSS(css);
        } catch (err) {
          console.error(`[AntigravityMod] Failed to inject CSS for "${id}":`, err.message);
        }
      }

      // If it's a UI widget, inject container & bootstrap
      if (mod.manifest.type === 'ui-widget') {
        const widgetBundlePath = path.join(mod.path, 'index.js');
        if (fs.existsSync(widgetBundlePath)) {
          try {
            const widgetScript = fs.readFileSync(widgetBundlePath, 'utf8');
            const safeKey = JSON.stringify('__antigravity_mod_' + id);
            const injectionScript = `
              (function() {
                try {
                  if (window[${safeKey}]) return;
                  window[${safeKey}] = true;
                  
                  ${widgetScript}

                  // Create container overlay
                  let overlay = document.getElementById('antigravity-mod-${id}-overlay');
                  if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'antigravity-mod-${id}-overlay';
                    overlay.style.position = 'fixed';
                    overlay.style.top = '16px';
                    overlay.style.right = '16px';
                    overlay.style.width = '420px';
                    overlay.style.maxHeight = 'calc(100vh - 32px)';
                    overlay.style.overflowY = 'auto';
                    overlay.style.zIndex = '999999';
                    overlay.style.display = 'none';
                    overlay.style.boxShadow = '0 12px 36px rgba(0,0,0,0.85)';
                    overlay.style.borderRadius = '10px';
                    document.body.appendChild(overlay);

                    if (window.ModOverview) {
                      const comp = window.ModOverview.init(overlay);
                      // Hook into live data via IPC if available
                      if (window.electronNativeAPI || window.ipcRenderer) {
                        const ipc = window.ipcRenderer || (window.require ? window.require('electron').ipcRenderer : null);
                        if (ipc) {
                          ipc.invoke('antigravity-mod:get-overview').then(data => {
                            if (data) comp.update(data);
                          }).catch(() => {});
                        }
                      }
                    }
                  }
                } catch(e) {
                  console.warn('[AntigravityMod Widget Bootstrap]', e);
                }
              })();
            `;
            await win.webContents.executeJavaScript(injectionScript);
          } catch (err) {
            console.error(`[AntigravityMod] Failed to bootstrap UI widget "${id}":`, err.message);
          }
        }
      }
    }
  }

  /**
   * Toggles visibility of the Mod Overview overlay.
   */
  async toggleOverlay(win) {
    try {
      await win.webContents.executeJavaScript(`
        (function() {
          const el = document.getElementById('antigravity-mod-mod-overview-overlay');
          if (el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
          }
        })();
      `);
    } catch (_) {}
  }
}

module.exports = Injector;
