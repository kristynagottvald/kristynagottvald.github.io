(() => {
  'use strict';

  const SITE = 'Kristyna Gottvald';
  const TAGLINE = 'Art Direction, Design, Brand Systems';

  const $ = (sel, root = document) => root.querySelector(sel);
  const views = {
    work: $('#view-grid'),
    case: $('#view-case'),
    about: $('#view-about'),
  };
  const cardsEl = $('#cards');
  const stackEl = $('#case-stack');
  const navLinks = document.querySelectorAll('[data-nav]');

  let projects = [];
  let order = [];          // project ids shown in the current case study stack
  let startIndex = 0;      // index in `projects` of the project that was opened
  let activeId = null;     // project currently centred in the viewport
  let currentView = null;
  let gridScroll = 0;
  let activeObserver = null;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Data ---------- */

  async function load() {
    try {
      const res = await fetch('projects.json?v=20261022d');
      if (!res.ok) throw new Error(res.status);
      projects = await res.json();
    } catch (err) {
      console.error(err);
    }
    if (!projects.length) {
      cardsEl.innerHTML =
        '<p class="load-error">Could not load projects.json. If you opened index.html straight from disk, serve the folder instead (for example <code>npx serve</code>).</p>';
      return;
    }
    renderGrid();
    route();
  }

  /* ---------- Home grid ---------- */

  function mediaHTML(p) {
    if (p.mediaType === 'video' && p.thumbnailVideo) {
      return `<video class="post-bg is-active" src="${esc(p.thumbnailVideo)}" poster="${esc(p.thumbnail)}" muted loop playsinline preload="metadata"></video>`;
    }
    return `<img class="post-bg is-active" src="${esc(p.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }

  // The whole home grid, shown once after the last project of the continuous scroll.
  function endGridHTML() {
    return `<section class="stack-end" aria-label="All projects"><div class="stack-end-label">All projects</div><div class="posts-container">${projects
      .map((p) => `<article class="post"><a class="post-link" href="#${esc(p.id)}" aria-label="${esc(p.title)}">
          <div class="post-media-container"><img class="post-bg is-active" src="${esc(p.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>
          <div class="post-metadata">
            <div class="post-title">${[p.category, p.client].filter(Boolean).map(esc).join(' · ')}</div>
            <h3 class="post-heading">${esc(p.title)}</h3>
          </div>
        </a></article>`)
      .join('')}</div></section>`;
  }

  function appendEnd() {
    if (!stackEl.querySelector('.stack-end')) stackEl.insertAdjacentHTML('beforeend', endGridHTML());
  }

  function renderGrid() {
    stopCycling();
    cardsEl.innerHTML = projects
      .map(
        (p) => `
      <article class="post" data-pid="${esc(p.id)}">
        <a class="post-link" href="#${esc(p.id)}" aria-label="${esc(p.title)}">
          <div class="post-media-container">${mediaHTML(p)}</div>
          <div class="post-metadata">
            <div class="post-title">${[p.category, p.client].filter(Boolean).map(esc).join(' · ')}</div>
            <h3 class="post-heading">${esc(p.title)}</h3>
          </div>
        </a>
      </article>`
      )
      .join('');

    // Play looping card videos only while they are on screen.
    const videos = cardsEl.querySelectorAll('video');
    if (videos.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()));
      }, { threshold: 0.25 });
      videos.forEach((v) => io.observe(v));
    }
    startCycling();
  }

  /* ---------- Home grid: cards cycle through the project's images ---------- */

  let cycleTimers = [];
  let cycleIO = null;

  // Thumbnail first, then each distinct image from the case study.
  function cardImages(p) {
    const list = [p.thumbnail];
    (p.caseStudyContent || []).forEach((b) => {
      if (b.type === 'image' && b.src && !list.includes(b.src) && !/placeholder/.test(b.src)) list.push(b.src);
    });
    return list.filter(Boolean).slice(0, 8);
  }

  function stopCycling() {
    cycleTimers.forEach(clearTimeout);
    cycleTimers = [];
    cycleIO && cycleIO.disconnect();
    cycleIO = null;
  }

  // One card changes at a time, in grid order, spaced so each card still changes every 2 seconds.
  function swapImage(c) {
    c.i = (c.i + 1) % c.urls.length;
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => {
      const img = document.createElement('img');
      img.className = 'post-bg';
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.src = c.urls[c.i];
      c.box.appendChild(img);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        c.box.querySelectorAll('.post-bg.is-active').forEach((o) => o.classList.remove('is-active'));
        img.classList.add('is-active');
      }));
      new Image().src = c.urls[(c.i + 1) % c.urls.length];
      setTimeout(() => c.box.querySelectorAll('.post-bg:not(.is-active)').forEach((o) => o.remove()), 1500);
    };
    probe.onerror = () => { c.urls.splice(c.i, 1); c.i = Math.max(0, c.i - 1); };
    probe.src = c.urls[c.i];
  }

  function startCycling() {
    stopCycling();
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const visible = new Set();
    cycleIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    }, { threshold: 0.2 });
    const cards = [];
    cardsEl.querySelectorAll('.post[data-pid]').forEach((card) => {
      const urls = (() => { const p = projects.find((x) => x.id === card.dataset.pid); return p ? cardImages(p) : []; })();
      if (urls.length < 2) return;
      cards.push({ card, urls, box: card.querySelector('.post-media-container'), i: 0 });
      cycleIO.observe(card);
    });
    // A wave through the cards in view, in grid order: first card steps to its next image, then the
    // second card, then the third, and on, wrapping back to the first visible card.
    let pos = -1;
    const tick = () => {
      const n = cards.length;
      const live = cards.filter((c) => visible.has(c.card) && c.urls.length > 1).length;
      let hit = null;
      for (let k = 1; k <= n && !hit; k++) {
        const c = cards[(pos + k) % n];
        if (visible.has(c.card) && c.urls.length > 1) { hit = c; pos = (pos + k) % n; }
      }
      if (hit) swapImage(hit);
      cycleTimers[0] = setTimeout(tick, hit ? Math.max(250, 2000 / live) : 1000);
    };
    cycleTimers[0] = setTimeout(tick, 1500);
  }

  /* ---------- Case study ---------- */

  // "Role: a, b, c" and "Key results ..." become a label on the left and one item per line on the right.
  const SMALL = new Set(['and', 'of', 'the', 'for', 'to', 'in', '&']);
  const titleCase = (r) =>
    r.replace(/\S+/g, (w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));
  const LABELED = /^\s*(role:|key results:?\s)/i;
  const CREDIT = /^\s*(creative direction|art direction|design(ed)? by|production|producer|animation|motion|photography|copy(writing)?|illustration|agency|credits?|team|studio|also on the team)\b[^:]{0,40}:/i;

  function roleRow(text, noLine) {
    const kr = /^\s*key results:?\s*/i.test(text);
    const items = kr
      ? text.replace(/^\s*key results:?\s*/i, '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
      : text.replace(/^\s*role:\s*/i, '').split(',').map((x) => x.trim()).filter(Boolean).map(titleCase);
    const row = `<div class="role-row${kr ? ' key-results' : ''}"><div class="role-label">${kr ? 'Key results' : 'Role'}</div><ul class="role-list${kr ? ' body' : ''}">${items.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
    return kr ? `<div class="kr-wrap${noLine ? ' no-line' : ''}">${row}</div>` : row.replace('role-row"', `role-row${noLine ? ' no-line' : ''}"`);
  }

  // Heading on the left, body on the right under a divider line; credits go last.
  function textBlock(b) {
    const paras = [].concat(b.body || []);
    const labeled = paras.filter((t) => LABELED.test(t));
    const rest = paras.filter((t) => !LABELED.test(t)).sort((x, y) => CREDIT.test(x) - CREDIT.test(y));
    const row = b.heading || rest.length
      ? `<div class="text-row${b.noLine ? ' no-line' : ''}"><div class="text-left">${b.heading ? `<h3>${esc(b.heading)}</h3>` : ''}</div><div class="text-right">${rest.map((t) => `<p>${esc(t)}</p>`).join('')}</div></div>`
      : '';
    if (!row && !labeled.length) return '';
    return `<div class="block-text">${row}${labeled.map((t) => roleRow(t, b.noLine)).join('')}</div>`;
  }

  function blockHTML(b) {
    switch (b.type) {
      case 'text':
        return textBlock(b);
      case 'image':
        return `<figure class="block-media${b.half ? (b.half === 'left' ? ' half-left' : ' half-right') : ''}"><img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy" referrerpolicy="no-referrer">${
          b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''
        }</figure>`;
      case 'vimeo': {
        const id = String(b.id || '').replace(/\D/g, '');
        if (!id) return '';
        const hash = b.hash ? ` data-hash="${esc(b.hash)}"` : '';
        return `<figure class="block-media"><div class="embed" data-vimeo="${id}"${hash} data-title="${esc(b.title || 'Video')}"></div></figure>`;
      }
      case 'sketch':
        return `<figure class="block-media"><div class="embed sketch"><iframe src="${esc(b.src)}" title="${esc(b.title || 'Interactive sketch')}" loading="lazy" allow="autoplay"></iframe><span class="pill">Interactive <svg class="pill-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path class="pill-ray" d="M8 5.8V1.5" pathLength="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path class="pill-ray" d="M5.8 8H1.5" pathLength="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path class="pill-cursor" d="M8 8l10.5 4.2-4.4 1.8-1.8 4.5z" fill="currentColor"/></svg></span></div></figure>`;
      case 'video':
        return `<figure class="block-media"><video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} controls playsinline preload="metadata"></video>${
          b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''
        }</figure>`;
      default:
        return '';
    }
  }

  const pageTitle = (p) => p.pageTitle || p.title;

  // First image or video, then the title row (title left, description right), then the rest.
  // Projects after the opened one start with a "Next up" block: text beside the first image.
  function caseHTML(p, isNext, preview) {
    const content = p.caseStudyContent || [];
    const blocks = content.map(blockHTML);
    content.forEach((b, i) => {
      const n = content[i + 1];
      if (b.type === 'text' && b.side === 'left' && n && n.type === 'image' && n.half === true) { blocks[i] = `<div class="pair">${blocks[i]}${blocks[i + 1]}</div>`; blocks[i + 1] = ''; }
    });
    const heroAt = content.findIndex((b) => b.type === 'image' || b.type === 'vimeo');
    const hero = heroAt >= 0 ? blocks.splice(heroAt, 1)[0] : '';
    const hasDesc = !!(p.summary && p.summary.trim());
    const head = p.hideTitle && !hasDesc
      ? ''
      : `<header class="case-head"><div class="case-inner${p.noLine ? ' no-line' : ''}">
          <div class="case-left">${p.hideTitle ? '' : `<h2 id="t-${esc(p.id)}">${esc(pageTitle(p))}</h2>`}</div>
          <div class="case-right">${hasDesc ? `<p class="lede">${esc(p.summary)}</p>` : ''}</div>
        </div></header>`;
    const top = isNext
      ? `<div class="next-up">
          <div class="next-up-text">
            <div class="next-up-label">Next up</div>
            <div class="next-up-title">${esc(p.title)}</div>
          </div>
          <div class="next-up-media">${hero}</div>
        </div>`
      : hero;
    return `
      <article class="case${isNext ? ' is-next' : ''}${preview ? ' preview' : ''}" data-id="${esc(p.id)}" aria-label="${esc(pageTitle(p))}">
        ${top}<div class="case-rest">${head}${blocks.join('')}</div>
      </article>`;
  }

  // Vimeo embeds autoplay muted and loop. The iframe is only created once it nears the viewport,
  // so a long case study does not start every video at once.
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

  function watchEmbeds(root) {
    root.querySelectorAll('.embed[data-vimeo]').forEach((box) => (embedObserver ? embedObserver.observe(box) : loadEmbed(box)));
  }

  const revealed = new Set();   // next projects that have grown to full width

  // The first project is shown in full. Each one after it starts as a preview directly under the
  // previous project and only turns into the full project once it has grown to 100% width.
  // The next project to show: the one after the last one shown, in list order. There is no wrap-around;
  // after the last project in the list the scroll ends with the home grid.
  function nextProject() {
    const present = new Set([...order, ...[...document.querySelectorAll('#case-stack .case')].map((c) => c.dataset.id)]);
    const from = projects.findIndex((p) => p.id === order[order.length - 1]);
    const p = projects[from + 1];
    return p && !present.has(p.id) ? p : null;
  }

  function appendProject(p) {
    order.push(p.id);
    stackEl.insertAdjacentHTML('beforeend', caseHTML(p, order.length > 1, order.length > 1));
    const el = stackEl.lastElementChild;
    const img = el.querySelector('.next-up-media img');
    img && img.setAttribute('loading', 'eager');
    activeObserver.observe(el);
    watchEmbeds(el);
  }

  function appendNext() {
    const p = nextProject();
    if (!p) return false;
    appendProject(p);
    return !!nextProject();
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    const p = projects.find((x) => x.id === id);
    history.replaceState(null, '', `#${id}`);
    if (p) document.title = `${pageTitle(p)} • ${SITE}`;
  }

  function showCase(id) {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx < 0) { location.hash = ''; return; }

    teardownCase();
    startIndex = idx;
    order = [];
    activeId = id;
    revealed.clear();
    stackEl.innerHTML = '';

    // The case that crosses a thin band at the middle of the screen is the "current" one.
    activeObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.isIntersecting && setActive(e.target.dataset.id));
    }, { rootMargin: '-45% 0px -50% 0px' });

    appendProject(projects[idx]);   // the project itself
    appendNext();                   // the "Next up" preview directly underneath it
    if (!stackEl.querySelector('.case.preview')) appendEnd();   // a single project: straight to the end grid
    document.title = `${pageTitle(projects[idx])} • ${SITE}`;
    window.scrollTo(0, 0);
    updatePreview();
  }

  function teardownCase() {
    activeObserver && activeObserver.disconnect();
    activeObserver = null;
    stackEl.innerHTML = '';
    order = [];
  }

  /* ---------- "Next up" preview: grows to the full-width next project as you scroll ---------- */

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const lerp = (a, b, k) => a + (b - a) * k;

  // The "Next up" block sits directly under the divider line at the bottom of the current project. It starts
  // as a 50%-wide pop-out on the right (text at full size on top, image below at 50% scale) and its left side
  // moves out to the left as it grows, until the text box and image fill 100% of the width.
  function measurePreview(el) {
    const nu = el.querySelector('.next-up');
    const media = el.querySelector('.next-up-media');
    const text = el.querySelector('.next-up-text');
    const small = nu.clientWidth < 640;
    const prev = text.style.width;
    text.style.width = '100%';
    const full = nu.offsetHeight;                      // layout height of the finished block
    text.style.width = prev;
    const top = nu.getBoundingClientRect().top;
    return { nu, media, text, small, t: full ? clamp01((window.innerHeight - top) / full) : 0 };
  }

  function applyPreview(m) {
    const e = smooth(0, 1, m.t);
    m.media.style.transform = `scale(${lerp(0.5, 1, e)})`;
    m.text.style.width = m.small ? '100%' : lerp(50, 100, e) + '%';
    m.nu.style.setProperty('--w', (m.small ? 100 : lerp(50, 100, e)) + '%');   // the dark panel grows with the text box
  }

  function revealPreview(el) {
    el.classList.remove('preview');
    ['.next-up', '.next-up-media', '.next-up-text'].forEach((sel) => el.querySelector(sel).removeAttribute('style'));
    revealed.add(el.dataset.id);
    const next = nextProject();
    if (next) appendProject(next); else appendEnd();
  }

  // Scrolling back up turns the last full next project back into a preview, which shrinks again.
  function revertPreview(el) {
    while (el.nextElementSibling) {
      if (el.nextElementSibling.classList.contains('case')) order.pop();
      el.nextElementSibling.remove();
    }
    el.classList.add('preview');
    revealed.delete(el.dataset.id);
  }

  function updatePreview() {
    if (!(currentView === 'case')) return;
    const stack = stackEl;
    const pv = stack.querySelector('.case.preview');
    if (pv) {
      const m = measurePreview(pv);
      if (m.t >= 0.985) return revealPreview(pv);
      applyPreview(m);
    }
    const cases = [...stack.querySelectorAll('.case')];
    for (let i = cases.length - 1; i > 0; i--) {
      if (cases[i].classList.contains('preview')) continue;
      if (measurePreview(cases[i]).t < 0.96) { revertPreview(cases[i]); updatePreview(); }
      break;
    }
  }

  stackEl.addEventListener('click', (e) => {
    const nu = e.target.closest('.case.preview .next-up');
    if (nu) nu.closest('.case').scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  let previewTick = false;
  const onPreviewScroll = () => {
    if (previewTick) return;
    previewTick = true;
    requestAnimationFrame(() => { previewTick = false; updatePreview(); });
  };
  window.addEventListener('scroll', onPreviewScroll, { passive: true });
  window.addEventListener('resize', onPreviewScroll);

  /* ---------- Routing (hash based, no reloads) ---------- */
  // ""            -> grid
  // "#about"      -> about
  // "#<id>"       -> case study for that project

  function show(name) {
    if (currentView === 'work') gridScroll = window.scrollY;
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    navLinks.forEach((a) => {
      const on = a.dataset.nav === (name === 'case' ? 'work' : name);
      a.toggleAttribute('aria-current', on);
      if (on) a.setAttribute('aria-current', 'page');
    });
    $('.site-footer').hidden = name === 'case';
    currentView = name;
  }

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));

    // Scrolling already updated the hash to a project inside the open stack.
    if (currentView === 'case' && hash === activeId) return;

    if (hash === 'about') {
      teardownCase();
      show('about');
      document.title = `About • ${SITE}`;
      window.scrollTo(0, 0);
    } else if (hash) {
      show('case');
      showCase(hash);
    } else {
      const returning = currentView === 'case';
      teardownCase();
      show('work');
      document.title = `${SITE} • ${TAGLINE}`;
      window.scrollTo(0, returning ? gridScroll : 0);
    }
  }

  // Any image that fails to load (for example a removed Tumblr URL) falls back to a grey 16:9 placeholder.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = 'placeholder.svg';
  }, true);

  window.addEventListener('hashchange', route);
  load();
})();
