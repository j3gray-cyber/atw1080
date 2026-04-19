/**
 * dest.js — Shared rendering engine for all destination pages.
 * Each destinations/XXX.html sets <body data-dest="XXX">.
 */

(function () {
  'use strict';

  // ─── DOM helper ──────────────────────────────────────────────────────────

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null) continue;
      typeof c === 'string' ? e.append(document.createTextNode(c)) : e.append(c);
    }
    return e;
  }

  function icon(name, extra) {
    return el('span', { class: `icon${extra ? ' ' + extra : ''}` }, name);
  }

  function shimmer(w, h) {
    return el('div', {
      class: 'shimmer',
      style: `width:${w||'100%'};height:${h||'13px'};border-radius:4px;margin:4px 0;`
    });
  }

  // ─── Safety maps ─────────────────────────────────────────────────────────

  const SAFETY_CLASS = { 1:'safe', 2:'caution', 3:'warn', 4:'danger' };
  const SAFETY_ICON  = { 1:'check_circle', 2:'info', 3:'warning', 4:'dangerous' };

  // ─── Builders ────────────────────────────────────────────────────────────

  function sectionTitle(iconName, label) {
    return el('div', { class: 'section-title' }, icon(iconName), label);
  }

  function section(iconName, label, ...children) {
    return el('div', { class: 'section' }, sectionTitle(iconName, label), ...children);
  }

  function cardList(items) {
    return el('ul', { class: 'list' }, ...items.map(i => el('li', {}, i)));
  }

  function panelTitle(iconName, label) {
    return el('div', { class: 'panel-title' }, icon(iconName), label);
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  function render(d) {
    document.title = `${d.title} | Travel Guides`;

    // Update header breadcrumb
    const crumb = document.getElementById('nav-crumb');
    if (crumb) crumb.textContent = d.title;

    const page = document.querySelector('.page');

    // Keep the site-header, remove everything else
    const header = page.querySelector('.site-header');
    page.innerHTML = '';
    if (header) page.append(header);

    // Hero
    const hero = el('div', { class: 'hero' });
    if (d.hero_image) {
      const img = el('img', { src: d.hero_image, alt: d.title, loading: 'eager' });
      img.onerror = () => {
        hero.innerHTML = '';
        hero.append(el('div', { class: 'hero-placeholder' }, icon('landscape', 'icon-xl')));
      };
      hero.append(img);
    } else {
      hero.append(el('div', { class: 'hero-placeholder' }, icon('landscape', 'icon-xl')));
    }
    page.append(hero);

    // Title + tagline
    page.append(
      el('h1', { class: 'dest-title' }, d.title),
      el('p',  { class: 'dest-tagline' }, d.tagline),
    );

    // Snapshot pills
    const snapItems = [
      { ic: 'calendar_month', text: `Best time: ${d.snapshot.best_time}` },
      { ic: 'schedule',       text: d.snapshot.duration },
      { ic: 'payments',       text: d.snapshot.cost },
      { ic: 'category',       text: d.snapshot.type },
      { ic: 'fitness_center', text: d.snapshot.intensity },
    ];
    page.append(el('div', { class: 'snapshot' },
      ...snapItems.map(s => el('div', { class: 'tag' }, icon(s.ic, 'icon-sm'), s.text))
    ));

    // Quick facts
    const facts = [
      { ic: 'schedule',     label: 'Timezone',  val: d.quick_facts.timezone  },
      { ic: 'travel_explore', label: 'Visa',    val: d.quick_facts.visa      },
      { ic: 'record_voice_over', label: 'Language', val: d.quick_facts.language },
      { ic: 'credit_card',  label: 'Payments',  val: d.quick_facts.payments  },
    ];
    page.append(el('div', { class: 'quick-facts' },
      ...facts.map(f =>
        el('div', { class: 'qf-item' },
          el('div', { class: 'qf-icon' }, icon(f.ic)),
          el('div', {},
            el('span', { class: 'qf-label' }, f.label),
            el('span', { class: 'qf-value' }, f.val),
          )
        )
      )
    ));

    // Sidebar panels (rendered now, data filled async)
    const safetyPanelEl  = makeSafetyPanel();
    const weatherPanelEl = makeWeatherPanel();
    const ratePanelEl    = makeRatePanel(d);

    // Two-column grid
    page.append(
      el('div', { class: 'grid' },

        el('div', {},
          section('star',            'Why go',              cardList(d.why_go)),
          section('hotel_class',     'Essential experiences', cardList(d.essential_experiences)),
          renderSeasonality(d),
          section('restaurant',      'Food & drink',        cardList(d.food_and_drink)),
          section('directions',      'Logistics',           cardList(d.logistics)),
          section('report',          'Friction factors',    cardList(d.friction_factors)),
          section('tips_and_updates','Tips & watchouts',    cardList(d.tips)),
          renderItinerary(d),
        ),

        el('div', { class: 'sidebar' },
          safetyPanelEl,
          makeWaterPanel(d.water_safety),
          weatherPanelEl,
          ratePanelEl,
        ),
      )
    );

    // Verdict
    page.append(
      el('div', { class: 'verdict' },
        el('div', { class: 'verdict-label' }, icon('verified', 'icon-sm'), 'Verdict'),
        el('p', {}, d.verdict),
      )
    );

    // Async panel data
    fetchSafety(d, safetyPanelEl);
    fetchWeather(d, weatherPanelEl);
    fetchRate(d, ratePanelEl);
  }

  // ─── Seasonality ─────────────────────────────────────────────────────────

  function renderSeasonality(d) {
    const months = el('div', { class: 'months' },
      ...Object.entries(d.seasonality).map(([m, s]) =>
        el('span', { class: s }, m)
      )
    );
    const legend = el('div', { class: 'season-legend' },
      ...[
        { cls: 'good', dot: '#86efac', label: 'Good' },
        { cls: 'ok',   dot: '#fde047', label: 'OK'   },
        { cls: 'bad',  dot: '#fca5a5', label: 'Avoid'},
      ].map(({ dot, label }) =>
        el('span', {},
          el('span', { class: 's-dot', style: `background:${dot}` }),
          label,
        )
      )
    );
    const note = el('p', { class: 'season-note' }, d.seasonality_note);
    const wrap = el('div', { class: 'months-wrap' }, months, legend, note);
    return section('calendar_today', 'When to go', wrap);
  }

  // ─── Itinerary ───────────────────────────────────────────────────────────

  function renderItinerary(d) {
    const list = el('ul', { class: 'itinerary-list' },
      ...d.itinerary.map(item =>
        el('li', {},
          el('span', { class: 'day-num' }, `D${item.day}`),
          el('span', { class: 'day-label' }, item.label),
        )
      )
    );
    return section('route', 'Itinerary ideas', list);
  }

  // ─── Sidebar panels ──────────────────────────────────────────────────────

  function makeSafetyPanel() {
    return el('div', { class: 'panel caution', id: 'safety-panel' },
      panelTitle('shield', 'Safety advice'),
      shimmer('65%', '15px'),
      shimmer('100%', '11px'),
      shimmer('75%', '11px'),
    );
  }

  function makeWaterPanel(w) {
    const cls     = { safe:'safe', caution:'caution', unsafe:'danger' }[w.status] || 'caution';
    const iconName = { safe:'water_drop', caution:'water_drop', unsafe:'do_not_disturb_on' }[w.status] || 'water_drop';
    return el('div', { class: `panel ${cls}` },
      panelTitle(iconName, 'Water safety'),
      el('div', { class: 'badge' }, w.label),
      el('p', {}, w.note),
    );
  }

  function makeWeatherPanel() {
    return el('div', { class: 'panel', id: 'weather-panel' },
      panelTitle('thermostat', 'Climate'),
      shimmer('80%', '11px'),
      shimmer('100%', '60px'),
    );
  }

  function makeRatePanel(d) {
    return el('div', { class: 'panel', id: 'rate-panel' },
      panelTitle('currency_exchange', `AUD → ${d.currency.code}`),
      shimmer('55%', '11px'),
    );
  }

  // ─── Async: Smartraveller ─────────────────────────────────────────────────
  // Strategy: nightly cache only. The live CORS proxy (allorigins) is too
  // unreliable to be worth a round-trip — if the cache misses, show fallback.

  async function fetchSafety(d, panel) {
    try {
      let country;

      // Try nightly cache (written by GitHub Action)
      try {
        const r = await fetch('../data/safety-cache.json');
        if (r.ok) {
          const cache = await r.json();
          country = cache[d.smartraveller_country];
        }
      } catch (_) {}

      if (!country) throw new Error('Not in cache');

      const level = country.advice_level;
      panel.className = `panel ${SAFETY_CLASS[level] || 'caution'}`;
      panel.innerHTML = '';
      panel.append(
        panelTitle(SAFETY_ICON[level], 'Safety advice'),
        el('div', { class: 'badge' }, `Level ${level}: ${country.advice_text}`),
        el('p', {}, `Updated ${country.last_updated}`),
        el('a', { href: country.url, target: '_blank', rel: 'noopener' },
          'Full Smartraveller advice', icon('open_in_new', 'icon-sm')),
      );

    } catch (_) {
      // Graceful fallback — link directly to Smartraveller
      const slug = d.smartraveller_country.toLowerCase().replace(/ /g, '-');
      panel.className = 'panel caution';
      panel.innerHTML = '';
      panel.append(
        panelTitle('warning', 'Safety advice'),
        el('div', { class: 'badge' }, 'Check before travel'),
        el('p', {}, 'Live advice unavailable — check Smartraveller directly.'),
        el('a', {
          href: `https://www.smartraveller.gov.au/destinations/${slug}`,
          target: '_blank', rel: 'noopener',
        }, 'Smartraveller', icon('open_in_new', 'icon-sm')),
      );
    }
  }

  // ─── Async: Open-Meteo climate ────────────────────────────────────────────
  // Uses the open-meteo forecast API with past data (free, no key, CORS-safe).
  // We fetch the last 12 months of daily data and bucket by month ourselves,
  // which is far more reliable than the climate normals endpoint.

  async function fetchWeather(d, panel) {
    if (!d.climate) return;
    try {
      // Use the standard forecast API in "past" mode — always works, no model arg needed
      const url = [
        'https://api.open-meteo.com/v1/forecast',
        `?latitude=${d.climate.lat}&longitude=${d.climate.lon}`,
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum',
        '&past_days=365',
        '&forecast_days=1',
        '&timezone=auto',
      ].join('');

      const data = await fetch(url).then(r => r.json());
      if (!data.daily || !data.daily.time) throw new Error('No data');

      const times = data.daily.time;           // "YYYY-MM-DD"
      const hiArr = data.daily.temperature_2m_max;
      const loArr = data.daily.temperature_2m_min;
      const rnArr = data.daily.precipitation_sum;

      // Bucket daily values into calendar months (0–11)
      const buckets = Array.from({ length: 12 }, () => ({ hi: [], lo: [], rn: [] }));
      times.forEach((t, i) => {
        const mo = parseInt(t.slice(5, 7), 10) - 1;
        if (hiArr[i] != null) buckets[mo].hi.push(hiArr[i]);
        if (loArr[i] != null) buckets[mo].lo.push(loArr[i]);
        if (rnArr[i] != null) buckets[mo].rn.push(rnArr[i]);
      });

      const avg  = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const sum  = arr => arr.length ? arr.reduce((a, b) => a + b, 0) : null;
      const MO   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      // Pick 4 representative months: Jan, Apr, Jul, Oct
      const keys = [0, 3, 6, 9];

      const grid = el('div', { class: 'weather-grid' },
        ...keys.map(i => {
          const hi = avg(buckets[i].hi);
          const lo = avg(buckets[i].lo);
          const rn = sum(buckets[i].rn) != null
            ? Math.round(sum(buckets[i].rn) / Math.max(buckets[i].rn.length / 30, 1))
            : null;
          return el('div', { class: 'weather-month' },
            el('div', { class: 'wm-name' }, MO[i]),
            el('div', { class: 'wm-hi' },   hi != null ? `${Math.round(hi)}°` : '–'),
            el('div', { class: 'wm-lo' },   lo != null ? `${Math.round(lo)}° lo` : '–'),
            el('div', { class: 'wm-rain' },
              icon('water_drop', 'icon-sm'),
              rn != null ? `${rn}mm` : '–',
            ),
          );
        })
      );

      panel.innerHTML = '';
      panel.append(
        panelTitle('thermostat', 'Climate'),
        grid,
        el('p', { style: 'margin-top:8px;font-size:0.74rem;' }, 'Past-year averages · Jan / Apr / Jul / Oct'),
      );
    } catch (_) {
      panel.innerHTML = '';
      panel.append(panelTitle('thermostat', 'Climate'), el('p', {}, 'Data unavailable.'));
    }
  }

  // ─── Async: Exchange rate ──────────────────────────────────────────────────
  // Frankfurter redirects to HTTPS and loses CORS headers on the 301.
  // Use the ExchangeRate-API open endpoint instead — no key, proper CORS.

  async function fetchRate(d, panel) {
    const code = d.currency.code;
    if (code === 'AUD') {
      panel.innerHTML = '';
      panel.append(panelTitle('currency_exchange', 'Currency'), el('p', {}, 'Local currency is AUD.'));
      return;
    }
    try {
      // open.er-api.com — free tier, no key, correct CORS headers
      const data = await fetch(`https://open.er-api.com/v6/latest/AUD`).then(r => r.json());
      if (data.result !== 'success') throw new Error('API error');
      const rate = data.rates[code];
      if (!rate) throw new Error('Currency not found');

      panel.innerHTML = '';
      panel.append(
        panelTitle('currency_exchange', `AUD → ${code}`),
        el('div', { class: 'rate-display' }, `${rate.toFixed(2)} ${code}`),
        el('div', { class: 'rate-sub' }, `per 1 AUD · ${d.currency.label} · live`),
        el('p', { style: 'margin-top:6px;font-size:0.82rem;' },
          `100 AUD ≈ ${(rate * 100).toFixed(0)} ${code}`),
      );
    } catch (_) {
      panel.innerHTML = '';
      panel.append(
        panelTitle('currency_exchange', `AUD → ${code}`),
        el('p', {}, 'Rate unavailable.'),
        el('a', {
          href: `https://www.xe.com/currencyconverter/convert/?From=AUD&To=${code}`,
          target: '_blank', rel: 'noopener',
        }, 'Check on XE.com', icon('open_in_new', 'icon-sm')),
      );
    }
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  async function boot() {
    const destId = document.body.getAttribute('data-dest');
    if (!destId) {
      document.querySelector('.page').innerHTML = `
        <div class="error-state">
          <span class="icon icon-xl">travel_explore</span>
          <h2>No destination set</h2>
          <p><a href="../index.html">← All destinations</a></p>
        </div>`;
      return;
    }
    try {
      const res = await fetch(`../data/${destId}.json`);
      if (!res.ok) throw new Error(res.status);
      render(await res.json());
    } catch (e) {
      document.querySelector('.page').innerHTML = `
        <div class="error-state">
          <span class="icon icon-xl">search_off</span>
          <h2>Destination not found</h2>
          <p>Could not load <code>${destId}</code>. <a href="../index.html">← All destinations</a></p>
        </div>`;
    }
  }

  boot();
})();