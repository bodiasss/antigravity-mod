/**
 * Antigravity Modding Framework - Mod Overview UI Component
 * Single vertical feed, night-black aesthetic, SVG circular rings, and smooth accordions.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ModOverview = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // SVG circular ring geometry constants
  // Radius r = 9.5, viewBox = 0 0 24 24, center = 12 12
  const RING_RADIUS = 9.5;
  const CIRCUMFERENCE = +(2 * Math.PI * RING_RADIUS).toFixed(2); // 59.69

  function getStatusClass(percent) {
    if (percent >= 80) return 'status-green';
    if (percent >= 20) return 'status-orange';
    return 'status-red';
  }

  function renderRing(percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    const offset = (CIRCUMFERENCE * (1 - clamped / 100)).toFixed(2);
    const statusClass = getStatusClass(clamped);

    return `
      <svg class="mod-ring-svg" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="mod-ring-bg" cx="12" cy="12" r="${RING_RADIUS}" fill="none" stroke-width="2.2" />
        <circle class="mod-ring-fill ${statusClass}" cx="12" cy="12" r="${RING_RADIUS}" fill="none"
          stroke-width="2.2" stroke-linecap="round"
          stroke-dasharray="${CIRCUMFERENCE}"
          stroke-dashoffset="${offset}" />
      </svg>
    `;
  }

  function renderMetricRow(label, percent) {
    return `
      <div class="mod-metric-row">
        <span class="mod-metric-label">${label}</span>
        <div class="mod-metric-value-wrap">
          <span class="mod-metric-pct">${percent}%</span>
          ${renderRing(percent)}
        </div>
      </div>
    `;
  }

  const DEFAULT_DATA = {
    card1: {
      title: 'GEMINI MODELS • SHARED',
      hasInfo: true,
      accounts: 'fortesy432, 11stoliarchuk, monsterph2',
      metrics: [
        { label: 'Weekly Limit Remaining', percent: 89 },
        { label: 'Five Hour Limit Remaining', percent: 100 }
      ],
      breakdown: [
        { name: 'fortesy432', note: 'Weekly 4% used · 5h 0% used' },
        { name: '11stoliarchuk', note: 'Weekly 5% used · 5h 0% used' },
        { name: 'monsterph2', note: 'Weekly 2% used · 5h 0% used' }
      ]
    },
    card2: {
      title: 'GEMINI MODELS (shared monsterph2 & fortesy432)',
      hasInfo: true,
      accounts: '',
      metrics: [
        { label: 'Weekly Limit Remaining', percent: 67 },
        { label: 'Five Hour Limit Remaining', percent: 100 }
      ],
      breakdown: [
        { name: 'monsterph2', note: 'Weekly 21% used · 5h 0% used' },
        { name: 'fortesy432', note: 'Weekly 12% used · 5h 0% used' }
      ]
    },
    card3: {
      title: 'CLAUDE & GPT models (без підписок)',
      hasInfo: false,
      accounts: '',
      metrics: [
        { label: 'Weekly Limit Remaining', percent: 0 },
        { label: 'Five Hour Limit Remaining', percent: 100 }
      ],
      breakdown: [
        { name: 'Claude 3.5 Sonnet', note: 'Quota exhausted (0% remaining)' },
        { name: 'GPT-4o Mini', note: '5h available (100% remaining)' }
      ]
    },
    card4: {
      title: 'Gemini 4 Argon',
      hasInfo: false,
      accounts: '',
      metrics: [
        { label: 'Weekly Limit', percent: 100 }
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
            { label: 'Weekly Limit Remaining', percent: 100 },
            { label: 'Five Hour Limit Remaining', percent: 100 }
          ]
        },
        {
          title: 'CLAUDE MODELS (Jio Account)',
          metrics: [
            { label: 'Weekly Limit Remaining', percent: 100 },
            { label: 'Five Hour Limit Remaining', percent: 100 }
          ]
        }
      ],
      breakdown: [
        { name: 'Gemini Backup Pro', note: 'Active · 100% capacity reserve' },
        { name: 'Claude Jio Node', note: 'Active · Standby standby pass' }
      ]
    }
  };

  class ModOverviewComponent {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      this.data = Object.assign({}, DEFAULT_DATA, options.data || {});
      this.init();
    }

    init() {
      if (!this.container) return;
      this.render();
      this.bindEvents();
    }

    render() {
      const d = this.data;

      this.container.innerHTML = `
        <div class="mod-overview-wrapper">
          <!-- Header -->
          <header class="mod-overview-header">
            <h1 class="mod-overview-title">Mod overview</h1>
            <p class="mod-overview-subtitle">Three saved accounts · small weekly / 5-hour bars</p>
          </header>

          <!-- Single Vertical Feed -->
          <main class="mod-overview-feed">
            <!-- Card 1 -->
            ${this.renderStandardCard(d.card1, 'card-1')}

            <!-- Card 2 -->
            ${this.renderStandardCard(d.card2, 'card-2')}

            <!-- Card 3 -->
            ${this.renderStandardCard(d.card3, 'card-3')}

            <!-- Card 4 (Weekly Limit Only) -->
            ${this.renderStandardCard(d.card4, 'card-4')}

            <!-- Card 5 (Multi-Section) -->
            ${this.renderSubsectionsCard(d.card5, 'card-5')}
          </main>
        </div>
      `;
    }

    renderStandardCard(item, id) {
      const metricsHtml = item.metrics.map(m => renderMetricRow(m.label, m.percent)).join('');
      const subtitleHtml = item.accounts ? `<span class="mod-card-accounts">${item.accounts}</span>` : '';
      const infoHtml = item.hasInfo ? `<span class="mod-info-icon" title="Shared pooled quota">ⓘ</span>` : '';
      const accordionHtml = item.breakdown ? this.renderAccordion(item.breakdown, id) : '';

      return `
        <article class="mod-card" id="${id}">
          <div class="mod-card-header">
            <div class="mod-card-title-group">
              <h2 class="mod-card-title">${item.title} ${infoHtml}</h2>
              ${subtitleHtml}
            </div>
          </div>
          <div class="mod-card-metrics">
            ${metricsHtml}
          </div>
          ${accordionHtml}
        </article>
      `;
    }

    renderSubsectionsCard(item, id) {
      const sectionsHtml = item.subsections.map(sub => `
        <div class="mod-subsection-item">
          <div class="mod-subsection-title">${sub.title}</div>
          <div class="mod-card-metrics">
            ${sub.metrics.map(m => renderMetricRow(m.label, m.percent)).join('')}
          </div>
        </div>
      `).join('');

      const accordionHtml = item.breakdown ? this.renderAccordion(item.breakdown, id) : '';

      return `
        <article class="mod-card" id="${id}">
          <div class="mod-card-header">
            <div class="mod-card-title-group">
              <h2 class="mod-card-title">${item.title}</h2>
            </div>
          </div>
          <div class="mod-subsections">
            ${sectionsHtml}
          </div>
          ${accordionHtml}
        </article>
      `;
    }

    renderAccordion(breakdown, id) {
      const rows = breakdown.map(b => `
        <div class="mod-breakdown-row">
          <span class="mod-breakdown-acc">${b.name}</span>
          <span class="mod-breakdown-val">${b.note}</span>
        </div>
      `).join('');

      return `
        <button type="button" class="mod-accordion-toggle" data-target="acc-${id}" aria-expanded="false">
          <span class="mod-toggle-text">Детальніше</span>
          <span class="mod-accordion-arrow">↓</span>
        </button>
        <div class="mod-accordion-content" id="acc-${id}">
          <div class="mod-breakdown-box">
            ${rows}
          </div>
        </div>
      `;
    }

    bindEvents() {
      const toggles = this.container.querySelectorAll('.mod-accordion-toggle');
      toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
          const targetId = toggle.getAttribute('data-target');
          const content = this.container.querySelector('#' + targetId);
          const textSpan = toggle.querySelector('.mod-toggle-text');
          const isExpanded = toggle.classList.toggle('expanded');

          toggle.setAttribute('aria-expanded', isExpanded);
          if (isExpanded) {
            content.classList.add('open');
            textSpan.textContent = 'Згорнути';
          } else {
            content.classList.remove('open');
            textSpan.textContent = 'Детальніше';
          }
        });
      });
    }

    update(newData) {
      this.data = Object.assign({}, this.data, newData);
      this.render();
      this.bindEvents();
    }
  }

  return {
    init: function (container, options) {
      return new ModOverviewComponent(container, options);
    }
  };
}));
