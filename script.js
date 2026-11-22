(() => {
  'use strict';

  const SITE = 'Kristyna Gottvald';
  const TAGLINE = 'Brand Design';

  const $ = (sel, root = document) => root.querySelector(sel);
  const views = { home: $('#view-home'), case: $('#view-case'), projects: $('#view-projects'), about: $('#view-about') };
  const cardsEl = $('#cards');
  const stackEl = $('#case-stack');
  const footerEl = $('#contact');
  const navLinks = document.querySelectorAll('[data-nav]');

  let projects = [];
  let currentView = null;
  let homeScroll = 0;
  let projectsScroll = 0;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Data ---------- */

  async function load() {
    try {
      const res = await fetch('projects.json?v=20261107a');
      if (!res.ok) throw new Error(res.status);
      projects = (await res.json()).filter((p) => !p.hidden);  // set "hidden": true on a project in projects.json to hide it everywhere
      projects.forEach((p) => { p.slug = String(p.title).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); });
    } catch (err) {
      console.error(err);
    }
    if (!projects.length) {
      cardsEl.innerHTML = '<p class="load-error">Could not load projects.json. If you opened index.html straight from disk, serve the folder instead (for example <code>python3 -m http.server</code>).</p>';
      return;
    }
    renderGrid();
    renderServices();
    route();
  }

  const firstHeading = (p) => ((p.caseStudyContent || []).find((b) => b.type === 'text' && b.heading) || {}).heading || '';
  // The line under a card never repeats the title, year or classifier.
  const subtitle = (p) => {
    if (p.blurb) return p.blurb;
    const h = firstHeading(p), t = p.title.toLowerCase(), l = h.toLowerCase();
    return h && !l.includes(t) && !t.includes(l) ? h : '';
  };

  /* ---------- Home: work list ---------- */

  const ARROW = '<svg class="card-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.3 7.7l5.1-5.1M2.3 2.1h5.5v5.5" fill="none" stroke="currentColor"/></svg>';
  const SERVICES = ['Brand Identity', 'Creative Coding', 'Creative Direction', 'Art Direction', 'Campaigns', 'Motion Design', 'Brand Tools'];
  const SERVICE_LINKS = { 'Brand Tools': 'https://kristynagottvald.github.io/sketches/' };   // a small arrow opens the sketches page

  // Card caption: client on the first line, project name on the second.
  const cardLines = (p) => {
    if (p.cardTitle) return [p.cardTitle, p.cardSub || ''];   // hand-written caption from projects.json
    const client = String(p.clientName || '').trim();
    if (!client) return [p.title, subtitle(p)];
    const name = [p.listTitle, p.pageTitle, p.title].find((t) => t && t.trim() && t.trim().toLowerCase() !== client.toLowerCase());
    return [client, name || subtitle(p)];
  };
  const EYE = '<svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d="M1 7s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10" cy="7" r="2.6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  const cardHTML = (p, current = false) => {
    const [l1, l2] = cardLines(p);
    return `
      <article class="card${current ? ' is-current' : ''}" data-pid="${esc(p.id)}">
        <a href="#${esc(p.slug)}" aria-label="${esc(p.title)}${current ? ' (currently viewing)' : ''}"${current ? ' aria-current="page"' : ''}>
          <div class="card-media"><img src="${esc(p.thumbnail)}" alt="" loading="lazy">${current ? `<div class="card-viewing">${EYE}<span>Viewing</span></div>` : ''}</div>
          <div class="card-meta">
            <h3 class="card-title">${esc(l1)}</h3>
            ${l2 ? `<p class="card-sub">${esc(l2)}</p>` : ''}${ARROW}
          </div>
        </a>
      </article>`;
  };

  function renderGrid() {
    cardsEl.innerHTML = projects.map((q) => cardHTML(q)).join('');
    const serviceItems = SERVICES.map((t, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${SERVICE_LINKS[t] ? `<a class="svc-link" href="${SERVICE_LINKS[t]}" target="_blank" rel="noopener noreferrer">${esc(t)}<span class="svc-go" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.3 7.7l5.1-5.1M2.3 2.1h5.5v5.5" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"/></svg></span><span class="sr-only"> (opens in a new tab)</span></a>` : esc(t)}</span></li>`).join('');
    $('#service-list').innerHTML = serviceItems;
    $('#about-service-list').innerHTML = serviceItems;
    renderProjectsPage();
    bindPreviews();
  }
  // Hover preview on the home grid: the card steps through the project's images, sketches (code) and videos.
  const PV_DWELL = 1000;   // each preview stays for 1 second before the next one fades in
  function previewItems(p) {
    const items = [], seen = new Set([p.thumbnail]);
    const ratio = (a) => { const m = String(a || '').match(/([\d.]+)\s*\/\s*([\d.]+)/); return m ? m[1] / m[2] : 16 / 9; };
    (p.caseStudyContent || []).forEach((b) => {
      if (b.type === 'image' && b.src && !seen.has(b.src) && !/placeholder/.test(b.src)) { seen.add(b.src); items.push({ t: 'img', src: b.src, dwell: PV_DWELL }); }
      else if (b.type === 'sketch' && b.src && !b.noPreview) items.push({ t: 'sketch', src: b.src, ar: ratio(b.aspect), bg: b.bg, dwell: PV_DWELL });
      else if (b.type === 'vimeo' && b.id) items.push({ t: 'vimeo', id: String(b.id).replace(/\D/g, ''), hash: b.hash, dwell: PV_DWELL });
    });
    return items;
  }
  const pv = { card: null, timer: null, start: null, idx: 0 };
  // Videos are not loaded with the page: a card's preview videos start loading (hidden) when the card scrolls near the viewport,
  // and are dropped again when it scrolls away, so a video is ready by the time it is hovered without every video loading up front.
  const pvPre = new Map();   // card -> Map(item index -> hidden layer)
  let pvZ = 1, pvObserver = null;
  function pvPreload(card) {
    if (pvPre.has(card)) return;
    const p = projects.find((x) => x.id === card.dataset.pid);
    const media = card.querySelector('.card-media');
    if (!p || !media) return;
    const m = new Map();
    previewItems(p).forEach((it, i) => {
      if (it.t !== 'vimeo' || m.size >= 2) return;   // the first two videos per card: enough to be ready, light on bandwidth
      const el = pvLayer(it);
      el.dataset.cached = '1';
      el.firstChild.addEventListener('load', () => { el.dataset.ready = '1'; });
      media.appendChild(el);
      m.set(i, el);
    });
    pvPre.set(card, m);
  }
  function pvUnload(card) {
    if (pv.card === card) return;
    const m = pvPre.get(card);
    if (!m) return;
    m.forEach((el) => el.remove());
    pvPre.delete(card);
  }
  function pvLayer(it) {
    let el;
    if (it.t === 'img') { el = document.createElement('img'); el.alt = ''; el.src = it.src; }
    else {
      el = document.createElement('div');
      el.style.background = it.bg || '#1e1e1e';
      const f = document.createElement('iframe');
      f.tabIndex = -1; f.setAttribute('aria-hidden', 'true');
      if (it.t === 'sketch') { f.style.setProperty('--ar', it.ar); f.className = 'pv-sketch'; f.src = it.src; }
      else { f.className = 'pv-vimeo'; f.allow = 'autoplay'; f.src = `https://player.vimeo.com/video/${it.id}?background=1&autoplay=1&muted=1&loop=1&autopause=0&dnt=1${it.hash ? '&h=' + it.hash : ''}`; }
      el.appendChild(f);
    }
    el.className = 'pv-layer';
    return el;
  }
  // Once a layer has faded in, drop only the layers underneath it (never one that was added after it).
  function pvClearBefore(el) {
    let o = el.previousElementSibling;
    while (o) { const prev = o.previousElementSibling; if (o.classList.contains('pv-layer')) { if (o.dataset.cached) o.classList.remove('is-on'); else o.remove(); } o = prev; }   // a preloaded video layer is only hidden, so it stays loaded
  }
  function pvStep(card, items) {
    if (pv.card !== card) return;
    const media = card.querySelector('.card-media');
    const i = pv.idx % items.length, it = items[i];
    pv.idx++;
    const pre = (pvPre.get(card) || new Map()).get(i);   // a video that was preloaded when the card scrolled into view
    const el = pre || pvLayer(it);
    if (pre) { delete el.dataset.shown; el.style.zIndex = ++pvZ; }
    const show = () => {
      if (pv.card !== card || el.dataset.shown) return;
      el.dataset.shown = '1';
      media.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-on')));
      setTimeout(() => pvClearBefore(el), 700);
      pv.timer = setTimeout(() => pvStep(card, items), it.dwell);
    };
    if (it.t === 'img') { el.onload = show; el.onerror = () => { pv.timer = setTimeout(() => pvStep(card, items), 0); }; }
    else { if (!pre) media.appendChild(el); el.dataset.shown = '1'; const f = el.firstChild; let done = false; const go = () => { if (done) return; done = true; if (pv.card !== card) return; requestAnimationFrame(() => el.classList.add('is-on')); setTimeout(() => pvClearBefore(el), 700); pv.timer = setTimeout(() => pvStep(card, items), it.dwell); }; if (pre && el.dataset.ready) setTimeout(go, 0); else { f.addEventListener('load', () => setTimeout(go, 400)); setTimeout(go, 2500); } }
  }
  function pvStop() {
    clearTimeout(pv.timer); clearTimeout(pv.start);
    const card = pv.card; pv.card = null;
    if (!card) return;
    const layers = card.querySelectorAll('.pv-layer');
    layers.forEach((l) => l.classList.remove('is-on'));
    setTimeout(() => { if (pv.card !== card) layers.forEach((l) => { if (!l.dataset.cached) l.remove(); }); }, 450);
  }
  function bindPreviews(root = cardsEl) {
    if (!matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (pvObserver) pvObserver.disconnect();
    pvPre.forEach((m) => m.forEach((el) => el.remove()));
    pvPre.clear();
    if ('IntersectionObserver' in window) {
      pvObserver = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? pvPreload(e.target) : pvUnload(e.target))), { rootMargin: '120px 0px' });
    }
    root.querySelectorAll('.card:not(.is-current)').forEach((card) => {
      if (pvObserver) pvObserver.observe(card);
      card.addEventListener('mouseenter', () => {
        pvStop();
        const p = projects.find((x) => x.id === card.dataset.pid);
        const items = p ? previewItems(p) : [];
        if (!items.length) return;
        pv.card = card; pv.idx = 0;
        pv.start = setTimeout(() => pvStep(card, items), 250);   // a brief pause so passing over a card does nothing
      });
      card.addEventListener('mouseleave', pvStop);
    });
  }

  // Projects index: two columns, landscape and portrait tiles staggered so the columns never line up.
  function renderProjectsPage() {
    const cols = [[], []];
    projects.forEach((p, i) => {
      const c = i % 2, r = Math.floor(i / 2);
      const kind = (r + c) % 2 === 0 ? 'is-p' : 'is-l';
      const titleCase = (t) => String(t || '').replace(/\b([a-z])/g, (m) => m.toUpperCase());   // Visual Identity, Art Direction
      const name = p.listTitle || p.title;   // shorter name for the caption when the full title is long
      const right = p.clientName && p.clientName.toLowerCase() !== name.toLowerCase() ? p.clientName : titleCase(p.category);
      cols[c].push(`<a class="pj-tile ${kind}" href="#${esc(p.slug)}" style="--o:${i}" data-i="${i}" data-urls="${esc(JSON.stringify(nextImages(p)))}" aria-label="${esc(p.title)}">
        <div class="pj-media"><img class="is-active" src="${esc(p.thumbnail)}" alt="" loading="lazy"></div>
        <div class="pj-cap"><span>${esc(name)}</span><span class="grey">${esc(right || '')}</span></div>
      </a>`);
    });
    $('#pj-grid').innerHTML = cols.map((col) => `<div class="pj-col">${col.join('')}</div>`).join('');
    if (currentView === 'projects') startProjectsCycle();
  }

  // Projects page: each tile cycles through its project's images every 3 seconds. Only one tile changes at a
  // time, working through the tiles that are on screen in order, and tiles off screen are left alone.
  const pjVisible = new Set();
  let pjObserver = null, pjTimer = null, pjLast = -1;
  function stopProjectsCycle() {
    clearTimeout(pjTimer);
    pjTimer = null;
    if (pjObserver) pjObserver.disconnect();
    pjObserver = null;
    pjVisible.clear();
  }
  function startProjectsCycle() {
    stopProjectsCycle();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    pjObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? pjVisible.add(e.target) : pjVisible.delete(e.target)));
      if (pjTimer === null) schedulePjTick();
    }, { threshold: 0.15 });
    document.querySelectorAll('.pj-tile').forEach((t) => pjObserver.observe(t));
  }
  function schedulePjTick() {
    clearTimeout(pjTimer);
    pjTimer = null;
    if (!pjVisible.size || currentView !== 'projects') return;
    // n tiles on screen, one change per tick: each tile comes round every 3 seconds
    pjTimer = setTimeout(pjTick, Math.max(250, 3000 / pjVisible.size));
  }
  function pjTick() {
    pjTimer = null;
    if (currentView !== 'projects') return;
    if (!document.hidden) {
      const shown = [...pjVisible].sort((a, b) => a.dataset.i - b.dataset.i);
      const next = shown.find((t) => +t.dataset.i > pjLast) || shown[0];
      if (next) { pjLast = +next.dataset.i; advanceTile(next); }
    }
    schedulePjTick();
  }
  function advanceTile(tile) {
    const urls = JSON.parse(tile.dataset.urls || '[]');
    if (urls.length < 2) return;
    const media = tile.querySelector('.pj-media');
    const i = ((+tile.dataset.idx || 0) + 1) % urls.length;
    const probe = new Image();
    probe.onload = () => {
      const img = document.createElement('img');
      img.alt = '';
      img.src = urls[i];
      media.appendChild(img);
      tile.dataset.idx = i;
      // the new image fades in over the old one, which is removed once it is fully covered
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('is-active')));
      setTimeout(() => media.querySelectorAll('img').forEach((o) => { if (o !== img) o.remove(); }), 1100);
    };
    probe.onerror = () => { urls.splice(i, 1); tile.dataset.urls = JSON.stringify(urls); };
    probe.src = urls[i];
  }
  const renderServices = () => {};

  /* ---------- Case study ---------- */

  const SMALL = new Set(['and', 'of', 'the', 'for', 'to', 'in', '&']);
  const titleCase = (r) => r.replace(/\S+/g, (w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));
  const LABELED = /^\s*(role:|key results:?\s)/i;
  const CREDIT_ANY = /^\s*[A-Z][A-Za-z '’&\/]{2,30}:\s/;
  const CREDIT = /^\s*(creative direction|art direction|design(ed)? by|production|producer|animation|motion|photography|copy(writing)?|illustration|agency|credits?|team|studio|also on the team)\b[^:]{0,40}:/i;

  function roleRow(text) {
    const kr = /^\s*key results:?\s*/i.test(text);
    const items = kr
      ? text.replace(/^\s*key results:?\s*/i, '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
      : text.replace(/^\s*role:\s*/i, '').split(',').map((x) => x.trim()).filter(Boolean).map(titleCase);
    const row = `<div class="role-row"><div class="role-label">${kr ? 'Key results' : 'Role'}</div><ul class="role-list${kr ? ' body' : ''}">${items.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
    return kr ? `<div class="kr-wrap">${row}</div>` : row;
  }

  function textBlock(b) {
    const paras = [].concat(b.body || []);
    const labeled = paras.filter((t) => LABELED.test(t));
    const rest = paras.filter((t) => !LABELED.test(t)).sort((x, y) => (CREDIT.test(x) || CREDIT_ANY.test(x)) - (CREDIT.test(y) || CREDIT_ANY.test(y)));
    const row = b.heading || rest.length
      ? `<div class="text-row${b.noLine ? ' no-line' : ''}"><div class="text-left">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ''}</div><div class="text-right">${rest.map((t) => `<p${CREDIT_ANY.test(t) && t.length < 200 ? ' class="credit"' : ''}>${esc(t)}</p>`).join('')}</div></div>`
      : '';
    if (!row && !labeled.length) return '';
    return `<div class="block-text">${row}${labeled.map(roleRow).join('')}</div>`;
  }

  function blockHTML(b) {
    if (b.aside) return `<div class="aside-row"><div class="aside-text">${[].concat(b.aside).map((t) => `<p>${esc(t)}</p>`).join('')}</div>${blockHTML({ ...b, aside: null, half: false })}</div>`;
    switch (b.type) {
      case 'text':
        return textBlock(b);
      case 'image':
        return `<figure class="block-media${b.half ? (b.half === 'left' ? ' half-left' : ' half-right') : ''}"><img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy">${b.caption ? `<figcaption class="figcap">${esc(b.caption)}</figcaption>` : ''}</figure>`;
      case 'vimeo': {
        const id = String(b.id || '').replace(/\D/g, '');
        if (!id) return '';
        const hash = b.hash ? ` data-hash="${esc(b.hash)}"` : '';
        return `<figure class="block-media"><div class="embed" data-vimeo="${id}"${hash} data-title="${esc(b.title || 'Video')}"></div></figure>`;
      }
      case 'pair':
        return `<div class="pair-row">${b.images.map((m) => m.sketch
          ? `<figure class="block-media"><div class="embed sketch" style="aspect-ratio: ${esc(m.aspect || '16 / 9')}${m.bg ? `; background: ${esc(m.bg)}` : ''}"><iframe src="${esc(m.sketch)}" title="${esc(m.title || 'Interactive sketch')}" loading="lazy" allow="autoplay"></iframe></div></figure>`
          : `<figure class="block-media"><img src="${esc(m.src)}" alt="${esc(m.alt || '')}" loading="lazy"></figure>`).join('')}</div>`;
      case 'sketch':
        return `<figure class="block-media${b.half ? (b.half === 'left' ? ' half-left' : ' half-right') : ''}"><div class="embed sketch"${b.aspect || b.bg ? ` style="${b.aspect ? `aspect-ratio: ${esc(b.aspect)};` : ''}${b.bg ? ` background: ${esc(b.bg)};` : ''}"` : ''}><iframe src="${esc(b.src)}" title="${esc(b.title || 'Interactive sketch')}" loading="lazy" allow="autoplay; camera"></iframe>${b.noHint ? '' : `<span class="reel-hint"><span class="hint-cta">Interactive <svg class="ptr-svg" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle class="ripple" cx="7.2" cy="6.4" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/><path class="ptr" d="M7.2 6.4l8.4 3.3-3.6 1.4-1.4 3.6z" fill="currentColor"/></svg></span></span>`}</div></figure>`;
      case 'video':
        return `<figure class="block-media"><video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} controls playsinline preload="metadata"></video>${b.caption ? `<figcaption class="figcap">${esc(b.caption)}</figcaption>` : ''}</figure>`;
      default:
        return '';
    }
  }

  // Letters become spans with a staggered delay so a hover lifts them one after another.
  const wave = (t) => { let n = 0; return t.split(' ').map((w) => `<span class="w" aria-hidden="true">${[...w].map((c) => `<span class="ch" style="--i:${n++}">${esc(c)}</span>`).join('')}</span>`).join(' '); };

  const pageTitle = (p) => p.pageTitle || p.title;

  // Every image of a project, thumbnail first, for the "Next up" cycle.
  function nextImages(q) {
    const list = [q.thumbnail];
    (q.caseStudyContent || []).forEach((b) => { if (b.type === 'image' && b.src && !list.includes(b.src) && !/placeholder/.test(b.src)) list.push(b.src); });
    return list.filter(Boolean);
  }

  // On desktop the "Next up" image grows from 25% of the page to the second tile's left edge while it scrolls into view (its text column slides down beside it, see CSS), and cycles every 3 seconds.
  let nextTimer = null;
  function stopNextMedia() { clearInterval(nextTimer); nextTimer = null; }
  function updateNextMedia() {
    const m = $('.next-media');
    if (!m || currentView !== 'case') return;
    if (!matchMedia('(min-width: 900px)').matches) { m.style.width = ''; m.parentElement.style.minHeight = ''; return; }
    // Grows from 25% of the page to the full right column, whose left edge lines up with the Overview column above.
    const span = (m.parentElement.clientWidth - 40) / 2;   // the right column of a two-column split with a 40px gap, like the project intro
    const from = Math.min(1, (window.innerWidth * 0.25) / span);
    m.parentElement.style.minHeight = span * 9 / 16 + 'px';   // reserve the full-size image so the divider below never jumps
    const t = Math.min(1, Math.max(0, (window.innerHeight - m.getBoundingClientRect().top) / (window.innerHeight * 0.8)));
    m.style.width = (from + (1 - from) * t) * 100 + '%';
  }
  function startNextMedia() {
    stopNextMedia();
    const m = $('.next-media');
    if (!m) return;
    const urls = JSON.parse(m.dataset.urls || '[]');
    let i = 0;
    updateNextMedia();
    if (urls.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    nextTimer = setInterval(() => {
      const r = m.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;   // only while on screen
      i = (i + 1) % urls.length;
      const probe = new Image();
      probe.onload = () => {
        const img = document.createElement('img');
        img.alt = '';
        img.src = urls[i];
        m.appendChild(img);
        // The new image fades in over the old one, which is removed once it is fully covered.
        requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('is-active')));
        setTimeout(() => m.querySelectorAll('img').forEach((o) => { if (o !== img) o.remove(); }), 1100);
      };
      probe.onerror = () => { urls.splice(i, 1); i = Math.max(0, i - 1); };
      probe.src = urls[i];
    }, 3000);
  }
  window.addEventListener('scroll', updateNextMedia, { passive: true });
  window.addEventListener('resize', updateNextMedia);

  // While the "Next up" block is hovered the title dances, rests for 2 seconds, then dances again.
  // A dance that has started always finishes; it only stops looping once the pointer leaves.
  function bindDance() {
    const a = $('.case-end a.next');
    if (!a) return;
    const title = a.querySelector('.next-title');
    const total = 500 + title.querySelectorAll('.ch').length * 28 + 40;   // one dance: last letter's delay + its 0.5s lift
    let hovering = false, active = false;
    const run = () => {
      active = true;
      title.classList.remove('dance');
      void title.offsetWidth;
      title.classList.add('dance');
      setTimeout(() => {
        title.classList.remove('dance');
        setTimeout(() => { if (hovering) run(); else active = false; }, 2000);   // 2 second rest
      }, total);
    };
    a.addEventListener('mouseenter', () => { hovering = true; if (!active) run(); });
    a.addEventListener('mouseleave', () => { hovering = false; });
  }

  // Case study intro: hero image first, then the title, details (client, industry, role) and overview.
  const ROLE_RE = /^\s*role:\s*/i;
  function caseIntro(p, content) {
    const ti = content.findIndex((b) => b.type === 'text');
    const tb = ti >= 0 ? content[ti] : null;
    const summary = (p.summary || '').trim();
    const intro = tb && ti <= 3 && (tb.heading || !summary) ? tb : null;
    const clean = (arr) => [].concat(arr || []).filter((t) => !LABELED.test(t) && !CREDIT.test(t) && !CREDIT_ANY.test(t));
    const overview = intro ? clean(intro.body) : summary ? [summary] : [];
    const client = (p.clientName || '').trim();
    const heading = intro && intro.heading && intro.heading.trim().toLowerCase() !== client.toLowerCase() ? intro.heading : '';
    const title = heading || pageTitle(p);
    const roleText = content.flatMap((b) => (b.type === 'text' ? [].concat(b.body || []) : [])).find((t) => ROLE_RE.test(t));
    const roles = roleText ? roleText.replace(ROLE_RE, '').split(',').map((x) => x.trim()).filter(Boolean).map(titleCase) : [];
    const detail = (label, value) => (value ? `<div class="ci-detail"><span class="ci-label">${label}</span><span class="ci-value">${esc(value)}</span></div>` : '');
    const html = `<section class="case-intro" aria-label="Project overview">
      <h1 class="ci-title">${esc(title)}</h1>
      <div class="ci-details">${detail('Client', client)}${detail('Industry', p.industry)}${detail('Role', roles.join(', '))}</div>
      ${overview.length ? `<div class="ci-overview"><span class="ci-label">Overview</span>${overview.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
    </section>`;
    // Everything the intro already shows is removed from the rest of the page.
    const rest = content.filter((b) => b !== intro).map((b) => (b.type === 'text' ? { ...b, body: [].concat(b.body || []).filter((t) => !ROLE_RE.test(t)) } : b));
    return { html, rest };
  }

  function caseHTML(p) {
    const { html: introHTML, rest: content } = caseIntro(p, p.caseStudyContent || []);
    const blocks = content.map(blockHTML);
    const heroAt = content.findIndex((b) => b.type === 'image' || b.type === 'vimeo');
    const hero = heroAt >= 0 ? blocks.splice(heroAt, 1)[0] : '';
    const i = projects.indexOf(p);
    const next = projects[(i + 1) % projects.length];
    return `
      <article class="case" aria-label="${esc(pageTitle(p))}">
        <div class="case-body">${hero}${introHTML}${blocks.join('')}</div>
        <footer class="case-end">
          <a class="next" href="#${esc(next.slug)}">
            <div class="next-text">
              <div class="caps next-label">Next up</div>
              <div class="next-title" aria-label="${esc(next.title)}">${wave(next.title)}</div>
            </div>
            <div class="next-media" data-urls="${esc(JSON.stringify(nextImages(next)))}"><img class="is-active" src="${esc(nextImages(next)[0])}" alt=""><span class="reel-hint next-hint">View project <svg class="hint-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.3 7.7l5.1-5.1M2.3 2.1h5.5v5.5" fill="none" stroke="currentColor" stroke-linecap="square"/></svg></span></div>
          </a>
          <section class="work case-work" aria-label="Selected Work">
            <div class="work-side"><h2 class="t-condensed">Selected Work</h2></div>
            <div class="work-list">${projects.map((q) => (q === p ? cardHTML(q, true) : cardHTML(q))).join('')}</div>
          </section>
        </footer>
      </article>`;
  }

  // Vimeo embeds autoplay muted and loop; the iframe is only created near the viewport.
  const embedObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          embedObserver.unobserve(e.target);
          loadEmbed(e.target);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  function loadEmbed(box) {
    const params = new URLSearchParams({ autoplay: '1', muted: '1', loop: '1', autopause: '0', playsinline: '1', dnt: '1' });
    if (box.dataset.hash) params.set('h', box.dataset.hash);
    const frame = document.createElement('iframe');
    frame.src = `https://player.vimeo.com/video/${box.dataset.vimeo}?${params}`;
    frame.title = box.dataset.title;
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    box.replaceChildren(frame);
  }

  function showCase(id) {
    const p = projects.find((x) => x.slug === id || x.id === id);
    if (!p) { location.hash = ''; return false; }
    stackEl.innerHTML = caseHTML(p);
    stackEl.querySelectorAll('.embed[data-vimeo]').forEach((box) => (embedObserver ? embedObserver.observe(box) : loadEmbed(box)));
    document.title = `${pageTitle(p)} • ${SITE}`;
    startNextMedia();
    bindDance();
    bindPreviews(stackEl);
    return true;
  }

  /* ---------- Routing (hash based) ---------- */
  // ""          -> home      "#about"  -> about
  // "#work"     -> home, scrolled to the work list
  // "#services" / "#contact" -> home / footer anchors
  // "#<id>"     -> case study

  const setNav = (key) => navLinks.forEach((a) => {
    const on = a.dataset.nav === key;
    if (on) { a.setAttribute('aria-current', 'page'); const l = $('#nav-jump-label'); if (l) l.textContent = a.textContent; }   // the mobile toggle names the current page
    else a.removeAttribute('aria-current');
  });

  function show(name) {
    if (currentView === 'home') homeScroll = window.scrollY;
    if (currentView === 'projects') projectsScroll = window.scrollY;
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    if (name !== 'case') { stopNextMedia(); stackEl.innerHTML = ''; }
    if (name === 'projects') startProjectsCycle(); else stopProjectsCycle();
    setNav(name === 'about' ? 'about' : 'projects');
    currentView = name;
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - $('#nav').offsetHeight, behavior: 'smooth' });   // land just under the sticky nav
  }

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const returning = currentView === 'case';

    if (hash === 'projects') {
      const back = currentView === 'case';
      show('projects');
      document.title = `Selected Work • ${SITE}`;
      window.scrollTo(0, back ? projectsScroll : 0);
    } else if (hash === 'about') {
      show('about');
      document.title = `About • ${SITE}`;
      window.scrollTo(0, 0);
    } else if (hash === 'contact') {
      if (currentView !== 'home') show('home');   // contact lives on the home page
      document.title = `${SITE} • ${TAGLINE}`;
      scrollToId('contact');
      setNav('contact');
    } else if (hash === 'work' || hash === 'services') {
      if (currentView !== 'home') show('home');
      document.title = `${SITE} • ${TAGLINE}`;
      scrollToId(hash);
    } else if (hash) {
      show('case');
      if (showCase(hash)) window.scrollTo(0, 0);
    } else {
      show('home');
      document.title = `${SITE} • ${TAGLINE}`;
      window.scrollTo(0, returning ? homeScroll : 0);
    }
  }

  // A missing image falls back to a grey placeholder.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = 'placeholder.svg';
  }, true);

  // Mobile: "Selected Work" opens a stacked list of the pages.
  const navEl = $('#nav'), jump = $('#nav-jump');
  const setMenu = (open) => { navEl.classList.toggle('open', open); jump.setAttribute('aria-expanded', String(open)); };
  jump.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!navEl.classList.contains('open')); });
  document.addEventListener('click', (e) => { if (!navEl.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.addEventListener('hashchange', () => setMenu(false));
  navEl.querySelectorAll('.nav-links a, .nav-status').forEach((a) => a.addEventListener('click', () => {
    setMenu(false);
    if (a.getAttribute('href') === location.hash) scrollToId(location.hash.slice(1));   // already on that hash: no hashchange fires, so scroll by hand
  }));

  // Hero slideshow: each sketch shows for 4 seconds, then the next fades in.
  // Phones: the Mavenoid slide is left out of the slideshow (its frame and its dot are removed before the slideshow is set up).
  if (matchMedia('(max-width: 760px)').matches) {
    const mv = document.querySelector('.reel-frame[data-src*="mavenoid-hero-sketch"]');
    if (mv) {
      const i = [...document.querySelectorAll('.reel-frame')].indexOf(mv);
      const dot = document.querySelectorAll('.reel-dots .dot')[i];
      mv.remove(); if (dot) dot.remove();
    }
  }
  const frames = [...document.querySelectorAll('.reel-frame')];
  const dots = [...document.querySelectorAll('.reel-dots .dot')];
  let slide = 0, slideTimer = null;
  // Only the first sketch loads at page load; the others (data-src) wait until it is running, so six iframes
  // don't fight over bandwidth while the first one is trying to start. Clicking a dot loads its slide at once.
  const loadFrame = (f) => { if (f.dataset.src) { f.src = f.dataset.src; f.removeAttribute('data-src'); } };
  let restQueued = false;
  // They start only after the first sketch's opening pop-in has finished (about 3s), then one at a time, so loading
  // never competes with the animation that is playing; slide 2 is still ready well before its turn at 10s.
  const loadRest = () => { if (restQueued) return; restQueued = true; frames.forEach((f, k) => { if (k) setTimeout(() => loadFrame(f), 3000 + (k - 1) * 1500); }); };
  window.addEventListener('message', (e) => { if (e.data === 'lob-ready') loadRest(); });
  setTimeout(loadRest, 5000);   // fallback in case the ready message never arrives
  function showSlide(i) {
    slide = (i + frames.length) % frames.length;
    loadFrame(frames[slide]);
    frames.forEach((f, k) => f.classList.toggle('is-on', k === slide));
    // A video slide has been playing (muted, looping) in the background since it loaded: start it over from the beginning as it comes in.
    const vf = frames[slide];
    if (vf.dataset.restart === '1' && /vimeo\.com/.test(vf.src || '')) {
      const cmd = (m) => { try { vf.contentWindow.postMessage(JSON.stringify(m), '*'); } catch (e) {} };
      cmd({ method: 'setCurrentTime', value: 0 }); cmd({ method: 'play' });
    }
    $('#hint-title').textContent = frames[slide].dataset.label || '';
    // Non-interactive slides show only the title: no dash, no "Interactive" text, no pointer.
    const hint = $('#hint-title').closest('.reel-hint');
    hint.classList.toggle('is-plain', frames[slide].dataset.plain === '1');
    // Slides tied to a project turn the whole label into a link to that project, with an arrow.
    const href = frames[slide].dataset.href;
    hint.classList.toggle('is-link', !!href);
    if (href) hint.setAttribute('href', href); else hint.removeAttribute('href');
    // The dither sketch starts over each time the slideshow comes back to it.
    if (['reprise-prompt-demos-sketch.html?hero=1', 'mavenoid-hero-sketch.html?hero=1', 'lob-send-sketch.html?hero=1', 'postal-fix-spot-sketch.html?hero=1', 'lob-template-card-sketch.html?hero=1'].includes(frames[slide].getAttribute('src'))) { try { frames[slide].contentWindow.postMessage('reset', '*'); } catch (e) {} }
    dots.forEach((d, k) => {
      d.classList.remove('is-on');
      if (k === slide) { void d.offsetWidth; d.classList.add('is-on'); }
    });
    clearTimeout(slideTimer);
    const dwell = +frames[slide].dataset.duration || 4000;   // the replatforming sketch gets 15s (its sequence runs 17s, the next slide cuts in early)
    dots[slide].style.setProperty('--dur', dwell + 'ms');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) slideTimer = setTimeout(() => showSlide(slide + 1), dwell);
  }
  dots.forEach((d, k) => d.addEventListener('click', () => showSlide(k)));
  showSlide(0);

  $('#copy-mail').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1500); };
    (navigator.clipboard ? navigator.clipboard.writeText($('#mail').textContent) : Promise.reject()).then(done, () => {});
  });

  window.addEventListener('hashchange', route);
  load();
})();
