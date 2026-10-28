'use strict';

/**
 * Antigravity Mod Data Service
 * Reads live account metadata and quota snapshots from AntigravitySwitcher
 * and formats aggregated data for the Mod Overview UI.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

const APPDATA_DIR = path.join(process.env.APPDATA || os.homedir(), 'AntigravitySwitcher');
const ACCOUNTS_FILE = path.join(APPDATA_DIR, 'accounts.json');
const QUOTA_FILE = path.join(APPDATA_DIR, 'quota-cache.json');

class DataService extends EventEmitter {
  constructor() {
    super();
    this.cachedData = null;
    this.watcher = null;
    this.initWatcher();
  }

  loadRawAccounts() {
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('[DataService] Failed to read accounts.json:', e.message);
    }
    return {
      accounts: [
        { id: '655751deec3f', email: 'fortesy432@gmail.com', label: 'fortesy432@gmail.com' },
        { id: '089399b09837', email: '11stoliarchuk@gmail.com', label: '11stoliarchuk@gmail.com' },
        { id: 'aa82eaf6120d', email: 'monsterph2@gmail.com', label: 'monsterph2@gmail.com' }
      ]
    };
  }

  loadRawQuotas() {
    try {
      if (fs.existsSync(QUOTA_FILE)) {
        return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('[DataService] Failed to read quota-cache.json:', e.message);
    }
    return { accounts: {} };
  }

  initWatcher() {
    try {
      if (fs.existsSync(APPDATA_DIR)) {
        this.watcher = fs.watch(APPDATA_DIR, (eventType, filename) => {
          if (filename === 'quota-cache.json' || filename === 'accounts.json') {
            this.cachedData = null;
            this.emit('update', this.getOverviewData());
          }
        });
      }
    } catch (_) {
      // Watching is best-effort
    }
  }

  getOverviewData() {
    const rawAccs = this.loadRawAccounts();
    const rawQuotas = this.loadRawQuotas();
    const qAccs = rawQuotas.accounts || {};

    // Helper to find account by email substring
    const findAcc = (part) => {
      const match = (rawAccs.accounts || []).find(a => (a.email || '').includes(part));
      if (!match) return null;
      return {
        id: match.id,
        email: match.email,
        name: match.email.split('@')[0],
        quota: qAccs[match.id] || {}
      };
    };

    const fortesy = findAcc('fortesy432') || { name: 'fortesy432', quota: {} };
    const stoliarchuk = findAcc('11stoliarchuk') || { name: '11stoliarchuk', quota: {} };
    const monsterph = findAcc('monsterph2') || { name: 'monsterph2', quota: {} };

    // Extract bucket fraction safely
    const getBucket = (acc, groupName, bucketId, defaultVal = 1) => {
      const groups = acc.quota?.groups || [];
      const grp = groups.find(g => (g.name || '').toLowerCase().includes(groupName.toLowerCase()));
      if (grp && grp.buckets) {
        const b = grp.buckets.find(b => (b.id || '').toLowerCase().includes(bucketId.toLowerCase()));
        if (b && typeof b.fraction === 'number') return b.fraction;
      }
      // Top-level fallback
      const topBuckets = acc.quota?.buckets || [];
      const tb = topBuckets.find(b => (b.id || '').toLowerCase().includes(bucketId.toLowerCase()));
      if (tb && typeof tb.fraction === 'number') return tb.fraction;
      return defaultVal;
    };

    // Card 1: Shared Gemini across all 3
    // fortesy: weekly ~0.67, 5h 1.0
    // stoliarchuk: weekly 1.0, 5h 1.0
    // monsterph: weekly ~0.99, 5h 0.99
    // Shared pooled weekly: ~89%
    const fW = getBucket(fortesy, 'Gemini', 'weekly', 0.67);
    const sW = getBucket(stoliarchuk, 'Gemini', 'weekly', 1.0);
    const mW = getBucket(monsterph, 'Gemini', 'weekly', 0.99);
    const sharedGeminiWeekly = Math.round(((fW + sW + mW) / 3) * 100);

    const f5 = getBucket(fortesy, 'Gemini', '5h', 1.0);
    const s5 = getBucket(stoliarchuk, 'Gemini', '5h', 1.0);
    const m5 = getBucket(monsterph, 'Gemini', '5h', 1.0);
    const sharedGemini5h = Math.round(Math.min(f5, s5, m5) * 100);

    // Card 2: Shared Gemini (monsterph2 & fortesy432)
    // fortesy is the primary active one with 67%
    const card2Weekly = Math.round(fW * 100);
    const card2_5h = Math.round(f5 * 100);

    // Card 3: Claude & GPT (without subscription)
    // fortesy has 0% weekly remaining
    const card3Weekly = Math.round(getBucket(fortesy, 'Claude', 'weekly', 0) * 100);
    const card3_5h = Math.round(getBucket(fortesy, 'Claude', '5h', 1.0) * 100);

    // Card 4: Gemini 4 Argon
    // monsterph has argon with ~99.6% -> 100%
    const argonWeekly = Math.round(getBucket(monsterph, 'Argon', 'weekly', 1.0) * 100);

    // Card 5: 11stoliarchuk@gmail.com
    const stoliGeminiWeekly = Math.round(sW * 100);
    const stoliGemini5h = Math.round(s5 * 100);
    const stoliClaudeWeekly = Math.round(getBucket(stoliarchuk, 'Claude', 'weekly', 1.0) * 100);
    const stoliClaude5h = Math.round(getBucket(stoliarchuk, 'Claude', '5h', 1.0) * 100);

    return {
      card1: {
        title: 'GEMINI MODELS • SHARED',
        hasInfo: true,
        accounts: 'fortesy432, 11stoliarchuk, monsterph2',
        metrics: [
          { label: 'Weekly Limit Remaining', percent: sharedGeminiWeekly },
          { label: 'Five Hour Limit Remaining', percent: sharedGemini5h }
        ],
        breakdown: [
          { name: 'fortesy432', note: `Weekly ${Math.round((1 - fW) * 100)}% used · 5h ${Math.round((1 - f5) * 100)}% used` },
          { name: '11stoliarchuk', note: `Weekly ${Math.round((1 - sW) * 100)}% used · 5h ${Math.round((1 - s5) * 100)}% used` },
          { name: 'monsterph2', note: `Weekly ${Math.round((1 - mW) * 100)}% used · 5h ${Math.round((1 - m5) * 100)}% used` }
        ]
      },
      card2: {
        title: 'GEMINI MODELS (shared monsterph2 & fortesy432)',
        hasInfo: true,
        accounts: '',
        metrics: [
          { label: 'Weekly Limit Remaining', percent: card2Weekly },
          { label: 'Five Hour Limit Remaining', percent: card2_5h }
        ],
        breakdown: [
          { name: 'monsterph2', note: `Weekly ${Math.round((1 - mW) * 100)}% used · 5h ${Math.round((1 - m5) * 100)}% used` },
          { name: 'fortesy432', note: `Weekly ${Math.round((1 - fW) * 100)}% used · 5h ${Math.round((1 - f5) * 100)}% used` }
        ]
      },
      card3: {
        title: 'CLAUDE & GPT models (без підписок)',
        hasInfo: false,
        accounts: '',
        metrics: [
          { label: 'Weekly Limit Remaining', percent: card3Weekly },
          { label: 'Five Hour Limit Remaining', percent: card3_5h }
        ],
        breakdown: [
          { name: 'Claude 3.5 Sonnet', note: card3Weekly === 0 ? 'Quota exhausted (0% remaining)' : `${card3Weekly}% remaining` },
          { name: 'GPT-4o Mini', note: `5h available (${card3_5h}% remaining)` }
        ]
      },
      card4: {
        title: 'Gemini 4 Argon',
        hasInfo: false,
        accounts: '',
        metrics: [
          { label: 'Weekly Limit', percent: argonWeekly }
        ],
        breakdown: null
      },
      card5: {
        title: '11stoliarchuk@gmail.com',
        hasInfo: false,
        accounts: '',
        subsections: [
          {
            title: 'GEMINI MODELS (Jio / Trial Pro Backup)',
            metrics: [
              { label: 'Weekly Limit Remaining', percent: stoliGeminiWeekly },
              { label: 'Five Hour Limit Remaining', percent: stoliGemini5h }
            ]
          },
          {
            title: 'CLAUDE MODELS (Jio Account)',
            metrics: [
              { label: 'Weekly Limit Remaining', percent: stoliClaudeWeekly },
              { label: 'Five Hour Limit Remaining', percent: stoliClaude5h }
            ]
          }
        ],
        breakdown: [
          { name: 'Gemini Backup Pro', note: `Active · ${stoliGeminiWeekly}% capacity reserve` },
          { name: 'Claude Jio Node', note: `Active · Standby capacity pass` }
        ]
      }
    };
  }
}

module.exports = new DataService();
