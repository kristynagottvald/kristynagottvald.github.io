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
  const sentinelEl = $('#case-sentinel');
  const navLinks = document.querySelectorAll('[data-nav]');

  let projects = [];
  let order = [];          // project ids shown in the current case study stack
  let startIndex = 0;      // index in `projects` of the project that was opened
  let activeId = null;     // project currently centred in the viewport
  let currentView = null;
  let gridScroll = 0;
  let sentinelObserver = null;
  let activeObserver = null;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Data ---------- */

  async function load() {
    try {
      const res = await fetch('projects.json');
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
      return `<video class="post-bg" src="${esc(p.thumbnailVideo)}" poster="${esc(p.thumbnail)}" muted loop playsinline preload="metadata"></video>`;
    }
    return `<img class="post-bg" src="${esc(p.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }

  function renderGrid() {
    cardsEl.innerHTML = projects
      .map(
        (p) => `
      <article class="post">
        <a class="post-link" href="#${esc(p.id)}" aria-label="${esc(p.title)}">
          <div class="post-media-container">${mediaHTML(p)}</div>
          <div class="post-metadata">
            <div class="post-title">${[p.category, p.year].filter(Boolean).map(esc).join(' · ')}</div>
            ${p.client ? `<div class="post-client">${esc(p.client)}</div>` : ''}
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
  }

  /* ---------- Case study ---------- */

  function blockHTML(b) {
    switch (b.type) {
      case 'text': {
        const paras = [].concat(b.body || []).map((t) => `<p>${esc(t)}</p>`).join('');
        return `<div class="block-text">${b.heading ? `<h3>${esc(b.heading)}</h3>` : ''}${paras}</div>`;
      }
      case 'image':
        return `<figure class="block-media"><img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy" referrerpolicy="no-referrer">${
          b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''
        }</figure>`;
      case 'vimeo': {
        const id = String(b.id || '').replace(/\D/g, '');
        if (!id) return '';
        const hash = b.hash ? ` data-hash="${esc(b.hash)}"` : '';
        return `<figure class="block-media"><div class="embed" data-vimeo="${id}"${hash} data-title="${esc(b.title || 'Video')}"></div></figure>`;
      }
      case 'video':
        return `<figure class="block-media"><video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} controls playsinline preload="metadata"></video>${
          b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''
        }</figure>`;
      default:
        return '';
    }
  }

  function caseHTML(p, isNext) {
    return `
      <article class="case${isNext ? ' is-next' : ''}" data-id="${esc(p.id)}" aria-labelledby="t-${esc(p.id)}">
        <header class="case-head">
          <div class="meta-row">
            ${isNext ? '<span class="next-label">Next project</span>' : ''}
            ${[p.category, p.year, p.client].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join('')}
          </div>
          <h2 id="t-${esc(p.id)}">${esc(p.title)}</h2>
          ${p.summary ? `<p class="lede">${esc(p.summary)}</p>` : ''}
        </header>
        ${(p.caseStudyContent || []).map(blockHTML).join('')}
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

  function appendNext() {
    if (order.length >= projects.length) return false;
    const p = projects[(startIndex + order.length) % projects.length];
    order.push(p.id);
    stackEl.insertAdjacentHTML('beforeend', caseHTML(p, order.length > 1));
    activeObserver.observe(stackEl.lastElementChild);
    watchEmbeds(stackEl.lastElementChild);
    return order.length < projects.length;
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    const p = projects.find((x) => x.id === id);
    history.replaceState(null, '', `#${id}`);
    if (p) document.title = `${p.title} • ${SITE}`;
  }

  function showCase(id) {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx < 0) { location.hash = ''; return; }

    teardownCase();
    startIndex = idx;
    order = [];
    activeId = id;
    stackEl.innerHTML = '';

    // The case that crosses a thin band at the middle of the screen is the "current" one.
    activeObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.isIntersecting && setActive(e.target.dataset.id));
    }, { rootMargin: '-45% 0px -50% 0px' });

    // When the bottom of the stack nears the viewport, append the next project.
    sentinelObserver = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (!appendNext()) { sentinelObserver.disconnect(); return; }
      // Re-arm in case the new project is short enough that the sentinel is still in view.
      sentinelObserver.unobserve(sentinelEl);
      sentinelObserver.observe(sentinelEl);
    }, { rootMargin: '0px 0px 400px 0px' });

    appendNext();
    document.title = `${projects[idx].title} • ${SITE}`;
    window.scrollTo(0, 0);
    sentinelObserver.observe(sentinelEl);
  }

  function teardownCase() {
    sentinelObserver && sentinelObserver.disconnect();
    activeObserver && activeObserver.disconnect();
    sentinelObserver = activeObserver = null;
    stackEl.innerHTML = '';
    order = [];
  }

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

  window.addEventListener('hashchange', route);
  load();
})();
