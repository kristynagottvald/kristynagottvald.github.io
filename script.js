(() => {
  'use strict';

  const SITE = 'Kristyna Gottvald';
  const TAGLINE = 'Graphic Designer';

  const $ = (sel, root = document) => root.querySelector(sel);
  const views = { home: $('#view-home'), case: $('#view-case'), about: $('#view-about') };
  const cardsEl = $('#cards');
  const stackEl = $('#case-stack');
  const footerEl = $('#contact');
  const navLinks = document.querySelectorAll('[data-nav]');

  let projects = [];
  let currentView = null;
  let homeScroll = 0;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Data ---------- */

  async function load() {
    try {
      const res = await fetch('projects.json?v=20261022w');
      if (!res.ok) throw new Error(res.status);
      projects = await res.json();
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
  const SERVICES = ['Creative coding', 'Brand identity', 'Creative direction', 'Art direction', 'Campaigns', 'Illustration & motion'];

  function renderGrid() {
    cardsEl.innerHTML = projects
      .map((p) => `
      <article class="card" data-pid="${esc(p.id)}">
        <a href="#${esc(p.id)}" aria-label="${esc(p.title)}">
          <div class="card-media"><img src="${esc(p.thumbnail)}" alt="" loading="lazy"></div>
          <div class="card-meta">
            <h3 class="card-title">${esc(p.title)}</h3>
            ${subtitle(p) ? `<p class="card-sub">${esc(subtitle(p))}</p>` : ''}${ARROW}
          </div>
        </a>
      </article>`)
      .join('');
    $('#service-list').innerHTML = SERVICES.map((t, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${esc(t)}</span></li>`).join('');
    watchWork();
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
    $('#work-thumb').src = p.thumbnail;
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
      case 'sketch':
        return `<figure class="block-media"><div class="embed sketch"><iframe src="${esc(b.src)}" title="${esc(b.title || 'Interactive sketch')}" loading="lazy" allow="autoplay"></iframe><span class="reel-hint">Interactive <svg class="ptr-svg" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path class="ptr" d="M7.2 6.4l8.4 3.3-3.6 1.4-1.4 3.6z" fill="currentColor"/><path class="trace t1" pathLength="1" d="M6.4 5.4C5 3.8 3.4 2.8 1.4 2.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path class="trace t2" pathLength="1" d="M5.8 7.6C4 7.6 2.4 8 .8 9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span></div></figure>`;
      case 'video':
        return `<figure class="block-media"><video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} controls playsinline preload="metadata"></video>${b.caption ? `<figcaption class="figcap">${esc(b.caption)}</figcaption>` : ''}</figure>`;
      default:
        return '';
    }
  }

  // Letters become spans with a staggered delay so a hover lifts them one after another.
  const wave = (t) => { let n = 0; return t.split(' ').map((w) => `<span class="w" aria-hidden="true">${[...w].map((c) => `<span class="ch" style="--i:${n++}">${esc(c)}</span>`).join('')}</span>`).join(' '); };

  const pageTitle = (p) => p.pageTitle || p.title;

  // Six other projects as image tiles, starting after the current one.
  function tilesHTML(p) {
    const i = projects.indexOf(p);
    return Array.from({ length: Math.min(6, projects.length - 1) }, (_, k) => projects[(i + 1 + k) % projects.length])
      .map((q) => `<a class="tile" href="#${esc(q.id)}"><div class="tile-media"><img src="${esc(q.thumbnail)}" alt="" loading="lazy"></div><span class="tile-title">${esc(q.title)}</span></a>`)
      .join('');
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
          <a class="next" href="#${esc(next.id)}">
            <div class="caps next-label">Next up</div>
            <div class="next-title" aria-label="${esc(next.title)}">${wave(next.title)}</div>
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
    const p = projects.find((x) => x.id === id);
    if (!p) { location.hash = ''; return false; }
    stackEl.innerHTML = caseHTML(p);
    stackEl.querySelectorAll('.embed[data-vimeo]').forEach((box) => (embedObserver ? embedObserver.observe(box) : loadEmbed(box)));
    document.title = `${pageTitle(p)} • ${SITE}`;
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
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    if (name !== 'case') stackEl.innerHTML = '';
    const navKey = name === 'case' ? 'work' : name === 'home' ? 'work' : name;
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
    lightUp($('#hb-label'), { home: 'Home', case: 'Projects', about: 'About' }[name]);
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

    if (hash === 'about') {
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
    // The dither sketch starts over each time the slideshow comes back to it.
    if (frames[slide].getAttribute('src') === 'dither-sketch.html') { try { frames[slide].contentWindow.postMessage('reset', '*'); } catch (e) {} }
    dots.forEach((d, k) => {
      d.classList.remove('is-on');
      if (k === slide) { void d.offsetWidth; d.classList.add('is-on'); }
    });
    clearTimeout(slideTimer);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) slideTimer = setTimeout(() => showSlide(slide + 1), 4000);
  }
  dots.forEach((d, k) => d.addEventListener('click', () => showSlide(k)));
  showSlide(0);

  /* ---------- Logo tone: white, or charcoal over light content ---------- */

  const logoEl = $('.logo');
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Brightness of an <img> at a viewport point, mapping object-fit: cover when set.
  function imgLuma(img, x, y) {
    if (!img.complete || !img.naturalWidth) return null;
    const r = img.getBoundingClientRect();
    let u = (x - r.left) / r.width, v = (y - r.top) / r.height;
    if (getComputedStyle(img).objectFit === 'cover') {
      const k = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
      u = ((x - r.left) - (r.width - img.naturalWidth * k) / 2) / (img.naturalWidth * k);
      v = ((y - r.top) - (r.height - img.naturalHeight * k) / 2) / (img.naturalHeight * k);
    }
    try {
      probe.canvas.width = probe.canvas.height = 1;
      probe.clearRect(0, 0, 1, 1);
      probe.drawImage(img, Math.max(0, Math.min(img.naturalWidth - 1, u * img.naturalWidth)), Math.max(0, Math.min(img.naturalHeight - 1, v * img.naturalHeight)), 1, 1, 0, 0, 1, 1);
      const d = probe.getImageData(0, 0, 1, 1).data;
      return d[3] < 20 ? null : luma(d[0], d[1], d[2]);
    } catch (e) { return null; }
  }

  function lumaAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest('.hb')) continue;
      if (el.tagName === 'IMG') { const l = imgLuma(el, x, y); if (l !== null) return l; continue; }
      if (el.tagName === 'IFRAME') return 40;
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (m && (m[3] === undefined || +m[3] > 0.5)) return luma(+m[0], +m[1], +m[2]);
    }
    return 0;
  }

  let toneTick = false;
  function updateTone() {
    toneTick = false;
    const r = logoEl.getBoundingClientRect();
    const pts = [[r.left + 6, r.top + r.height / 2], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 6, r.top + r.height / 2]];
    const avg = pts.reduce((a, [x, y]) => a + lumaAt(x, y), 0) / pts.length;
    $('#hb').style.setProperty('--hb-ink', avg > 150 ? '#2c2c2c' : '#fff');
  }
  const queueTone = () => { if (!toneTick) { toneTick = true; requestAnimationFrame(updateTone); } };
  window.addEventListener('scroll', queueTone, { passive: true });
  window.addEventListener('resize', queueTone);
  window.addEventListener('hashchange', () => setTimeout(queueTone, 50));
  document.addEventListener('load', queueTone, true);
  setTimeout(queueTone, 300);

  $('#copy-mail').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1500); };
    (navigator.clipboard ? navigator.clipboard.writeText($('#mail').textContent) : Promise.reject()).then(done, () => {});
  });

  window.addEventListener('hashchange', route);
  load();
})();
