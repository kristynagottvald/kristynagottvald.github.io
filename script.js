(() => {
  'use strict';

  const SITE = 'Kristyna Gottvald';
  const TAGLINE = 'Graphic Designer';

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
      const res = await fetch('projects.json?v=20261030n');
      if (!res.ok) throw new Error(res.status);
      projects = await res.json();
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
  const SERVICES = ['Brand Identity', 'Creative Coding', 'Creative Direction', 'Art Direction', 'Campaigns', 'Motion Design', 'Interactive Brand Tools'];
  const SERVICE_LINKS = { 'Interactive Brand Tools': 'https://kristynagottvald.github.io/sketches/' };   // a small arrow opens the sketches page

  function renderGrid() {
    cardsEl.innerHTML = projects
      .map((p) => `
      <article class="card" data-pid="${esc(p.id)}">
        <a href="#${esc(p.slug)}" aria-label="${esc(p.title)}">
          <div class="card-media"><img src="${esc(p.thumbnail)}" alt="" loading="lazy"></div>
          <div class="card-meta">
            <h3 class="card-title">${esc(p.title)}</h3>
            ${subtitle(p) ? `<p class="card-sub">${esc(subtitle(p))}</p>` : ''}${ARROW}
          </div>
        </a>
      </article>`)
      .join('');
    const serviceItems = SERVICES.map((t, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${SERVICE_LINKS[t] ? `<a class="svc-link" href="${SERVICE_LINKS[t]}" target="_blank" rel="noopener noreferrer">${esc(t)}<span class="svc-go" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.3 7.7l5.1-5.1M2.3 2.1h5.5v5.5" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"/></svg></span><span class="sr-only"> (opens in a new tab)</span></a>` : esc(t)}</span></li>`).join('');
    $('#service-list').innerHTML = serviceItems;
    $('#about-service-list').innerHTML = serviceItems;
    watchWork();
    renderProjectsPage();
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

  // The card nearest the middle of the screen is "active": it stays bright and fills the sticky side column.
  const firstBody = (p) => (((p.caseStudyContent || []).find((b) => b.type === 'text' && (b.body || []).length) || {}).body || []).filter((t) => !/^\s*(role:|key results)/i.test(t)).join('\n\n');
  function setWork(card) {
    const p = projects.find((x) => x.id === card.dataset.pid);
    if (!p) return;
    cardsEl.querySelectorAll('.card').forEach((c) => c.classList.toggle('is-active', c === card));
    $('#work-active').textContent = p.title;
    $('#work-desc').textContent = firstBody(p);
    $('#work-thumb').src = p.squareThumbnail || p.thumbnail;
    $('#work-tag').textContent = [p.year, p.category].filter(Boolean).join(' – ');
  }
  let workTick = false;
  function updateWork() {
    workTick = false;
    if (currentView !== 'home') return;
    const mid = window.innerHeight * 0.5;
    let best = null, bd = Infinity;
    cardsEl.querySelectorAll('.card').forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bd) { bd = d; best = c; }
    });
    if (best && !best.classList.contains('is-active')) setWork(best);
  }
  function watchWork() {
    const first = cardsEl.querySelector('.card');
    first && setWork(first);
    window.addEventListener('scroll', () => { if (!workTick) { workTick = true; requestAnimationFrame(updateWork); } }, { passive: true });
  }

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
      ? `<div class="text-row${b.noLine ? ' no-line' : ''}"><div class="text-left">${b.heading ? `<h3>${esc(b.heading)}</h3>` : ''}</div><div class="text-right">${rest.map((t) => `<p${CREDIT_ANY.test(t) && t.length < 200 ? ' class="credit"' : ''}>${esc(t)}</p>`).join('')}</div></div>`
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

  // Six other projects as image tiles, never the current project or the Next up project.
  function tilesHTML(p) {
    const i = projects.indexOf(p);
    // starts two after the current project: the one right after it is already shown as "Next up"
    return Array.from({ length: Math.min(6, projects.length - 2) }, (_, k) => projects[(i + 2 + k) % projects.length])
      .map((q) => `<a class="tile" href="#${esc(q.slug)}"><div class="tile-media"><img src="${esc(q.thumbnail)}" alt="" loading="lazy"></div><span class="tile-title">${esc(q.title)}</span></a>`)
      .join('');
  }

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
    // Grows from 25% of the page to the full two-column span, whose left edge is the second tile's edge below.
    const span = m.parentElement.clientWidth * 2 / 3 - 4;   // (A - 24) / 3 * 2 + 12 with the 12px gaps
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

  function caseHTML(p) {
    const content = p.caseStudyContent || [];
    const blocks = content.map(blockHTML);
    const heroAt = content.findIndex((b) => b.type === 'image' || b.type === 'vimeo');
    const hero = heroAt >= 0 ? blocks.splice(heroAt, 1)[0] : '';
    const i = projects.indexOf(p);
    const next = projects[(i + 1) % projects.length];
    const meta = [p.year, p.category, p.client].filter(Boolean).map(esc).map((m) => `<span>${m}</span>`).join('');
    return `
      <article class="case" aria-label="${esc(pageTitle(p))}">
        <header class="case-top">
          <div class="case-meta">${meta}</div>
          <h1>${esc(pageTitle(p))}</h1>
          ${p.summary && p.summary.trim() ? `<p class="case-lede">${esc(p.summary)}</p>` : ''}
        </header>
        <div class="case-body">${hero}${blocks.join('')}</div>
        <footer class="case-end">
          <a class="next" href="#${esc(next.slug)}">
            <div class="next-text">
              <div class="caps next-label">Next up</div>
              <div class="next-title" aria-label="${esc(next.title)}">${wave(next.title)}</div>
            </div>
            <div class="next-media" data-urls="${esc(JSON.stringify(nextImages(next)))}"><img class="is-active" src="${esc(nextImages(next)[0])}" alt=""><span class="reel-hint next-hint">View project <svg class="hint-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.3 7.7l5.1-5.1M2.3 2.1h5.5v5.5" fill="none" stroke="currentColor" stroke-linecap="square"/></svg></span></div>
          </a>
          <div class="all-projects">
            <h2 class="t-condensed">All projects</h2>
            <div class="tiles">${tilesHTML(p)}</div>
          </div>
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
    return true;
  }

  /* ---------- Routing (hash based) ---------- */
  // ""          -> home      "#about"  -> about
  // "#work"     -> home, scrolled to the work list
  // "#services" / "#contact" -> home / footer anchors
  // "#<id>"     -> case study

  // Letters light up one after another (white on the menu, grey on the pill label).
  function lightUp(el, text) {
    const t = text || el.dataset.t || el.textContent;
    el.dataset.t = t;
    el.setAttribute('aria-label', t);
    el.innerHTML = [...t].map((ch, i) => `<span class="lu" aria-hidden="true" style="--i:${i}">${esc(ch)}</span>`).join('');
  }

  function show(name) {
    if (currentView === 'home') homeScroll = window.scrollY;
    if (currentView === 'projects') projectsScroll = window.scrollY;
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    if (name !== 'case') { stopNextMedia(); stackEl.innerHTML = ''; }
    if (name === 'projects') startProjectsCycle(); else stopProjectsCycle();
    const navKey = name === 'case' ? 'projects' : name;
    navLinks.forEach((a) => {
      const b = a.querySelector('b');
      if (a.dataset.nav === navKey) {
        if (!a.hasAttribute('aria-current')) { a.setAttribute('aria-current', 'page'); b && lightUp(b); }
      } else {
        a.removeAttribute('aria-current');
        if (b && b.dataset.t) { b.textContent = b.dataset.t; delete b.dataset.t; }
      }
    });
    currentView = name;
    lightUp($('#hb-label'), { home: 'Home', case: 'Projects', projects: 'Projects', about: 'About' }[name]);
    $('#hb').classList.remove('open');
    requestAnimationFrame(updateWork);
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
  }

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const returning = currentView === 'case';

    if (hash === 'projects') {
      const back = currentView === 'case';
      show('projects');
      document.title = `Projects • ${SITE}`;
      window.scrollTo(0, back ? projectsScroll : 0);
    } else if (hash === 'about') {
      show('about');
      document.title = `About • ${SITE}`;
      window.scrollTo(0, 0);
    } else if (hash === 'contact') {
      if (!currentView || currentView === 'case') show('home');
      document.title = `${SITE} • ${TAGLINE}`;
      scrollToId('contact');
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

  // The menu shows on hover and hides as soon as the pointer leaves (the click toggle is for touch screens).
  $('.hb-pill').addEventListener('mouseleave', () => {
    $('#hb').classList.remove('open');
    $('#hb-toggle').setAttribute('aria-expanded', 'false');
    if ($('.hb-pill').contains(document.activeElement)) document.activeElement.blur();
  });

  $('#hb-toggle').addEventListener('click', () => {
    const hb = $('#hb');
    $('#hb-toggle').setAttribute('aria-expanded', String(hb.classList.toggle('open')));
  });

  // Hero slideshow: each sketch shows for 4 seconds, then the next fades in.
  const frames = [...document.querySelectorAll('.reel-frame')];
  const dots = [...document.querySelectorAll('.reel-dots .dot')];
  let slide = 0, slideTimer = null;
  function showSlide(i) {
    slide = (i + frames.length) % frames.length;
    frames.forEach((f, k) => f.classList.toggle('is-on', k === slide));
    $('#hint-title').textContent = frames[slide].dataset.label || '';
    // Non-interactive slides show only the title: no dash, no "Interactive" text, no pointer.
    const hint = $('#hint-title').closest('.reel-hint');
    hint.classList.toggle('is-plain', frames[slide].dataset.plain === '1');
    // Slides tied to a project turn the whole label into a link to that project, with an arrow.
    const href = frames[slide].dataset.href;
    hint.classList.toggle('is-link', !!href);
    if (href) hint.setAttribute('href', href); else hint.removeAttribute('href');
    // The dither sketch starts over each time the slideshow comes back to it.
    if (['reprise-hero-sketch.html', 'clearco-guide-sketch.html', 'lob-send-sketch.html?hero=1', 'postal-fix-spot-sketch.html', 'lob-template-card-sketch.html'].includes(frames[slide].getAttribute('src'))) { try { frames[slide].contentWindow.postMessage('reset', '*'); } catch (e) {} }
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
