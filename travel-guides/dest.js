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

    const crumb = document.getElementById('nav-crumb');
    if (crumb) crumb.textContent = d.title;

    const page = document.querySelector('.page');
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

    page.append(
      el('h1', { class: 'dest-title' }, d.title),
      el('p',  { class: 'dest-tagline' }, d.tagline),
    );

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

    const facts = [
      { ic: 'schedule',          label: 'Timezone',  val: d.quick_facts.timezone  },
      { ic: 'travel_explore',    label: 'Visa',      val: d.quick_facts.visa      },
      { ic: 'record_voice_over', label: 'Language',  val: d.quick_facts.language  },
      { ic: 'credit_card',       label: 'Payments',  val: d.quick_facts.payments  },
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

    const safetyPanelEl  = makeSafetyPanel();
    const weatherPanelEl = makeWeatherPanel();
    const ratePanelEl    = makeRatePanel(d);
    const costPanelEl    = makeCostPanel(d);

    page.append(
      el('div', { class: 'grid' },

        el('div', {},
          section('star',            'Why go',               cardList(d.why_go)),
          section('hotel_class',     'Essential experiences', cardList(d.essential_experiences)),
          renderSeasonality(d),
          section('restaurant',      'Food & drink',         cardList(d.food_and_drink)),
          section('directions',      'Logistics',            cardList(d.logistics)),
          section('report',          'Friction factors',     cardList(d.friction_factors)),
          section('tips_and_updates','Tips & watchouts',     cardList(d.tips)),
          renderItinerary(d),
        ),

        el('div', { class: 'sidebar' },
          safetyPanelEl,
          makeWaterPanel(d.water_safety),
          weatherPanelEl,
          ratePanelEl,
          costPanelEl,
        ),
      )
    );

    page.append(
      el('div', { class: 'verdict' },
        el('div', { class: 'verdict-label' }, icon('verified', 'icon-sm'), 'Verdict'),
        el('p', {}, d.verdict),
      )
    );

    fetchSafety(d, safetyPanelEl);
    fetchWeather(d, weatherPanelEl);
    fetchRate(d, ratePanelEl);
    fetchCost(d, document.getElementById('cost-panel'));
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
        { dot: '#86efac', label: 'Good' },
        { dot: '#fde047', label: 'OK'   },
        { dot: '#fca5a5', label: 'Avoid'},
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
    const cls      = { safe:'safe', caution:'caution', unsafe:'danger' }[w.status] || 'caution';
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

  // Cost of living — reads from nightly-cached Numbeo data.
  // Headline % vs Australia derived from country-level Cost of Living Index.
  // Sub-rows show groceries, eating out, and rent differentials.
  // City price points (meal, coffee, transport) added if numbeo_city is set in JSON.
  function makeCostPanel(d) {
    return el('div', { class: 'panel', id: 'cost-panel' },
      panelTitle('shopping_cart', 'Cost of living vs Australia'),
      shimmer('70%', '20px'),
      shimmer('90%', '11px'),
      shimmer('75%', '11px'),
      shimmer('80%', '11px'),
    );
  }

  async function fetchCost(d, panel) {
    try {
      const r = await fetch('../data/cost-cache.json');
      if (!r.ok) throw new Error('Cache fetch failed');
      const cache = await r.json();
      if (!cache._fetched_at) throw new Error('Cache not yet populated');

      const countryName = d.numbeo_country || d.country;
      const dest = cache.countries && cache.countries[countryName];
      if (!dest) throw new Error(`${countryName} not in cache`);

      const ausCol  = cache._australia_col;
      const destCol = dest.col;
      const pctDiff = Math.round(((destCol - ausCol) / ausCol) * 100);
      const cheaper = pctDiff < 0;
      const absPct  = Math.abs(pctDiff);

      const headlineText = cheaper
        ? `~${absPct}% cheaper than Australia`
        : pctDiff === 0 ? 'Similar cost to Australia'
        : `~${absPct}% pricier than Australia`;
      const headlineIcon = cheaper ? 'trending_down' : 'trending_up';
      const headlineCls  = cheaper ? 'cost-cheaper' : 'cost-pricier';

      // Sub-index comparisons (% diff from Australia)
      const subs = [
        { label: 'Groceries',  dest: dest.grocery,    aus: cache._australia_grocery    },
        { label: 'Eating out', dest: dest.restaurant, aus: cache._australia_restaurant },
        { label: 'Rent',       dest: dest.rent,       aus: cache._australia_rent       },
      ].map(s => ({
        label: s.label,
        pct: Math.round(((s.dest - s.aus) / s.aus) * 100),
      }));

      // City-level price points from cache (optional)
      const cityPrices = (cache.city_prices && cache.city_prices[d.id]) || {};
      const pricePoints = ['meal', 'coffee', 'transport'].map(k => cityPrices[k]).filter(Boolean);

      panel.innerHTML = '';
      panel.append(panelTitle('shopping_cart', 'Cost of living vs Australia'));

      // Headline badge
      panel.append(
        el('div', { class: `cost-headline ${headlineCls}` },
          icon(headlineIcon, 'icon-sm'), ` ${headlineText}`,
        )
      );

      // Sub-index breakdown
      const subWrap = el('div', { class: 'cost-subs' });
      subs.forEach(({ label, pct }) => {
        const sign = pct > 0 ? '+' : '';
        const cls  = pct < 0 ? 'cost-down' : pct > 0 ? 'cost-up' : 'cost-flat';
        subWrap.append(
          el('div', { class: 'cost-sub-row' },
            el('span', { class: 'cost-sub-label' }, label),
            el('span', { class: `cost-sub-val ${cls}` }, `${sign}${pct}%`),
          )
        );
      });
      panel.append(subWrap);

      // Price point samples
      if (pricePoints.length > 0) {
        panel.append(el('div', { class: 'cost-prices-title' }, 'Sample prices (local currency)'));
        pricePoints.forEach(p => {
          panel.append(
            el('div', { class: 'cost-sub-row' },
              el('span', { class: 'cost-sub-label' }, p.label),
              el('span', { class: 'cost-price-val' }, p.value),
            )
          );
        });
      }

      const numbeoUrl = d.numbeo_city
        ? `https://www.numbeo.com/cost-of-living/in/${d.numbeo_city}`
        : `https://www.numbeo.com/cost-of-living/country_result.jsp?country=${encodeURIComponent(countryName)}`;
      panel.append(
        el('a', { href: numbeoUrl, target: '_blank', rel: 'noopener', style: 'margin-top:8px;display:inline-flex;' },
          'Full breakdown on Numbeo', icon('open_in_new', 'icon-sm')),
      );

    } catch (_) {
      const countryName = d.numbeo_country || d.country;
      const numbeoUrl = `https://www.numbeo.com/cost-of-living/country_result.jsp?country=${encodeURIComponent(countryName)}`;
      panel.innerHTML = '';
      panel.append(
        panelTitle('shopping_cart', 'Cost of living'),
        el('p', { style: 'font-size:0.81rem;color:var(--muted);margin-bottom:6px;' }, 'Data not yet synced.'),
        el('a', { href: numbeoUrl, target: '_blank', rel: 'noopener' },
          `${countryName} on Numbeo`, icon('open_in_new', 'icon-sm')),
      );
    }
  }

  // ─── Async: Smartraveller ─────────────────────────────────────────────────
  // Cache-only. The nightly GitHub Action populates data/safety-cache.json.
  // If _fetched_at is null the Action hasn't run yet — show fallback link.

  async function fetchSafety(d, panel) {
    try {
      const r = await fetch('../data/safety-cache.json');
      if (!r.ok) throw new Error('Cache fetch failed');
      const cache = await r.json();

      if (!cache._fetched_at) throw new Error('Cache not yet populated');

      const country = cache[d.smartraveller_country];
      if (!country) throw new Error('Country not in cache');

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
      const slug = d.smartraveller_country.toLowerCase().replace(/ /g, '-');
      panel.className = 'panel caution';
      panel.innerHTML = '';
      panel.append(
        panelTitle('warning', 'Safety advice'),
        el('div', { class: 'badge' }, 'Check before travel'),
        el('p', {}, 'Safety data not yet synced — check Smartraveller directly.'),
        el('a', {
          href: `https://www.smartraveller.gov.au/destinations/${slug}`,
          target: '_blank', rel: 'noopener',
        }, 'Smartraveller', icon('open_in_new', 'icon-sm')),
      );
    }
  }

  // ─── Async: Open-Meteo historical archive ────────────────────────────────
  // archive-api.open-meteo.com requires explicit start_date + end_date.
  // We use the previous full calendar year for clean 12-month coverage.

  async function fetchWeather(d, panel) {
    if (!d.climate) return;
    try {
      const year  = new Date().getFullYear() - 1;
      const start = `${year}-01-01`;
      const end   = `${year}-12-31`;

      const url = [
        'https://archive-api.open-meteo.com/v1/archive',
        `?latitude=${d.climate.lat}`,
        `&longitude=${d.climate.lon}`,
        `&start_date=${start}`,
        `&end_date=${end}`,
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum',
      ].join('');

      const data = await fetch(url).then(r => r.json());
      if (data.error) throw new Error(data.reason || 'API error');
      if (!data.daily || !data.daily.time) throw new Error('No data');

      const times = data.daily.time;
      const hiArr = data.daily.temperature_2m_max;
      const loArr = data.daily.temperature_2m_min;
      const rnArr = data.daily.precipitation_sum;

      // Bucket into months
      const buckets = Array.from({ length: 12 }, () => ({ hi: [], lo: [], rn: [] }));
      times.forEach((t, i) => {
        const mo = parseInt(t.slice(5, 7), 10) - 1;
        if (hiArr[i] != null) buckets[mo].hi.push(hiArr[i]);
        if (loArr[i] != null) buckets[mo].lo.push(loArr[i]);
        if (rnArr[i] != null) buckets[mo].rn.push(rnArr[i]);
      });

      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const sum = arr => arr.length ? arr.reduce((a, b) => a + b, 0) : null;
      const MO  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      const grid = el('div', { class: 'weather-grid' },
        ...[0, 3, 6, 9].map(i => {
          const hi = avg(buckets[i].hi);
          const lo = avg(buckets[i].lo);
          const rn = sum(buckets[i].rn);
          return el('div', { class: 'weather-month' },
            el('div', { class: 'wm-name' }, MO[i]),
            el('div', { class: 'wm-hi' },   hi != null ? `${Math.round(hi)}°` : '–'),
            el('div', { class: 'wm-lo' },   lo != null ? `${Math.round(lo)}° lo` : '–'),
            el('div', { class: 'wm-rain' },
              icon('water_drop', 'icon-sm'),
              rn != null ? `${Math.round(rn)}mm` : '–',
            ),
          );
        })
      );

      panel.innerHTML = '';
      panel.append(
        panelTitle('thermostat', 'Climate'),
        grid,
        el('p', { style: 'margin-top:8px;font-size:0.74rem;' },
          `${year} actuals · Jan / Apr / Jul / Oct`),
      );
    } catch (_) {
      panel.innerHTML = '';
      panel.append(
        panelTitle('thermostat', 'Climate'),
        el('p', {}, 'Weather data unavailable.'),
      );
    }
  }

  // ─── Async: Exchange rate (open.er-api.com) ───────────────────────────────
  // Frankfurter's HTTP→HTTPS 301 redirect strips CORS headers.
  // open.er-api.com is free, keyless, and returns proper CORS headers.

  async function fetchRate(d, panel) {
    const code = d.currency.code;
    if (code === 'AUD') {
      panel.innerHTML = '';
      panel.append(panelTitle('currency_exchange', 'Currency'), el('p', {}, 'Local currency is AUD.'));
      return;
    }
    try {
      const data = await fetch('https://open.er-api.com/v6/latest/AUD').then(r => r.json());
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