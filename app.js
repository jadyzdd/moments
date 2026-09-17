/**
 * 朋友圈 — 前端逻辑（localStorage 持久化 + posts.json 共享源）
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'moments_feed_v2';
  const D = window.MomentsData;
  const ME = D.ME;

  const els = {
    feed: document.getElementById('feed'),
    emptyState: document.getElementById('emptyState'),
    nickname: document.getElementById('nickname'),
    bio: document.getElementById('bio'),
    myAvatar: document.getElementById('myAvatar'),
    btnPublish: document.getElementById('btnPublish'),
    btnClear: document.getElementById('btnClear'),
    btnRestore: document.getElementById('btnRestore'),
    btnRestoreEmpty: document.getElementById('btnRestoreEmpty'),
    composeMask: document.getElementById('composeMask'),
    composeText: document.getElementById('composeText'),
    composePhotos: document.getElementById('composePhotos'),
    composeLocation: document.getElementById('composeLocation'),
    btnComposeCancel: document.getElementById('btnComposeCancel'),
    btnComposeSubmit: document.getElementById('btnComposeSubmit'),
    cover: document.getElementById('cover'),
    lightbox: document.getElementById('lightbox'),
    lightboxImg: document.getElementById('lightboxImg'),
    lightboxClose: document.getElementById('lightboxClose'),
    lightboxPrev: document.getElementById('lightboxPrev'),
    lightboxNext: document.getElementById('lightboxNext'),
    lightboxCounter: document.getElementById('lightboxCounter'),
    btnYm: document.getElementById('btnYm'),
    ymMask: document.getElementById('ymMask'),
    ymList: document.getElementById('ymList'),
    ymEmptyHint: document.getElementById('ymEmptyHint'),
    btnYmClose: document.getElementById('btnYmClose'),
    toast: document.getElementById('toast'),
  };

  let posts = [];
  let selectedPhotos = new Set();
  let coverHue = 200;

  /* lightbox state */
  let lbImages = [];
  let lbIndex = 0;
  let lbOpen = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;
  let toastTimer = null;
  let ymExpandedYear = null;

  function normalizePosts(list) {
    if (!Array.isArray(list)) return null;
    return list
      .filter(function (p) {
        return p && typeof p === 'object' && p.id;
      })
      .map(function (p) {
        return {
          id: p.id,
          author: p.author && typeof p.author === 'object'
            ? { name: p.author.name || '匿名', initial: p.author.initial || '匿' }
            : { name: '匿名', initial: '匿' },
          text: typeof p.text === 'string' ? p.text : '',
          images: Array.isArray(p.images) ? p.images.slice() : [],
          location: typeof p.location === 'string' ? p.location : '',
          likes: Array.isArray(p.likes) ? p.likes.slice() : [],
          likedByMe: !!p.likedByMe,
          comments: Array.isArray(p.comments)
            ? p.comments.map(function (c) {
                return Object.assign({}, c);
              })
            : [],
          createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
        };
      })
      .sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  /* —— Storage —— */
  function loadFromLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.posts)) {
        posts = normalizePosts(data.posts) || [];
        if (typeof data.coverHue === 'number') coverHue = data.coverHue;
        return true;
      }
    } catch (e) {
      console.warn('load local failed', e);
    }
    return false;
  }

  function loadSeed() {
    posts = D.buildSeedPosts();
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ posts: posts, coverHue: coverHue, savedAt: Date.now() })
      );
    } catch (e) {
      console.warn('save failed', e);
    }
  }

  /**
   * 优先拉取仓库根目录 posts.json（GitHub Pages 共享源）；
   * 成功则写入 localStorage；失败则沿用本地 / 示例。
   */
  function fetchPublishedPosts() {
    var url = 'posts.json?v=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var list = Array.isArray(data) ? data : data && data.posts;
        var normalized = normalizePosts(list);
        if (!normalized) throw new Error('invalid posts.json');
        posts = normalized;
        save();
        return true;
      })
      .catch(function (err) {
        console.warn('posts.json fetch failed, using local/seed', err);
        return false;
      });
  }

  /* —— Time format —— */
  /** 左侧时间槽：固定显示具体年月日 */
  function formatDateYMD(ts) {
    const date = new Date(ts);
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    return {
      year: String(yyyy),
      md: mm + '月' + dd + '日',
      full: yyyy + '年' + mm + '月' + dd + '日',
    };
  }

  function formatTime(ts) {
    return formatDateYMD(ts).full;
  }

  /** 本地时区年月键 YYYY-MM */
  function ymFromTs(ts) {
    const date = new Date(ts);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const mm = m < 10 ? '0' + m : String(m);
    return {
      year: y,
      month: m,
      key: y + '-' + mm,
      label: y + '年' + m + '月',
    };
  }

  /** 从当前 posts 构建 { years: number[], monthsByYear: { [year]: number[] } } */
  function buildYmIndex(list) {
    const map = {};
    (list || []).forEach(function (p) {
      const ym = ymFromTs(p.createdAt);
      if (!map[ym.year]) map[ym.year] = {};
      map[ym.year][ym.month] = true;
    });
    const years = Object.keys(map)
      .map(Number)
      .sort(function (a, b) {
        return b - a;
      });
    const monthsByYear = {};
    years.forEach(function (y) {
      monthsByYear[y] = Object.keys(map[y])
        .map(Number)
        .sort(function (a, b) {
          return b - a;
        });
    });
    return { years: years, monthsByYear: monthsByYear };
  }

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.add('hidden');
      toastTimer = null;
    }, 1600);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  /* —— Render —— */
  function renderProfile() {
    els.nickname.textContent = ME.name;
    els.bio.textContent = ME.bio;
    els.myAvatar.textContent = ME.initial;
    els.myAvatar.style.cssText += ';' + D.avatarStyle(ME.name);
    applyCover();
  }

  function applyCover() {
    const bg = els.cover.querySelector('.cover-bg');
    if (!bg) return;
    const h = coverHue % 360;
    bg.style.background =
      'linear-gradient(160deg, rgba(0,0,0,0.2) 0%, transparent 45%),' +
      'linear-gradient(135deg, hsl(' +
      h +
      ',45%,35%) 0%, hsl(' +
      ((h + 40) % 360) +
      ',50%,55%) 50%, hsl(' +
      ((h + 80) % 360) +
      ',55%,60%) 100%)';
  }

  function renderFeed() {
    if (!posts.length) {
      els.feed.innerHTML = '';
      els.emptyState.classList.remove('hidden');
      if (els.btnYm) els.btnYm.classList.add('hidden');
      renderYmPanel();
      return;
    }
    els.emptyState.classList.add('hidden');
    if (els.btnYm) els.btnYm.classList.remove('hidden');

    let html = '';
    let lastKey = null;
    posts.forEach(function (post) {
      const ym = ymFromTs(post.createdAt);
      if (ym.key !== lastKey) {
        html +=
          '<div class="ym-sticky" data-ym="' +
          escapeHtml(ym.key) +
          '" id="ym-anchor-' +
          escapeHtml(ym.key) +
          '"><span class="ym-sticky-label">' +
          escapeHtml(ym.label) +
          '</span></div>';
        lastKey = ym.key;
      }
      html += renderPost(post, ym.key);
    });
    els.feed.innerHTML = html;
    renderYmPanel();
  }

  function renderArtisticTime(ts) {
    const d = formatDateYMD(ts);
    const title = d.full;
    return (
      '<div class="post-time-art" title="' +
      escapeHtml(title) +
      '" aria-label="' +
      escapeHtml(title) +
      '">' +
      '<span class="time-year">' +
      escapeHtml(d.year) +
      '</span>' +
      '<span class="time-md">' +
      escapeHtml(d.md) +
      '</span></div>'
    );
  }

  function renderPost(post, ymKey) {
    const ymAttr = ymKey || ymFromTs(post.createdAt).key;
    const n = (post.images && post.images.length) || 0;
    const gridClass = n === 0 ? '' : 'n' + Math.min(n, 9);
    const imagesHtml =
      n > 0
        ? '<div class="img-grid ' +
          gridClass +
          '">' +
          post.images
            .slice(0, 9)
            .map(function (src, idx) {
              return (
                '<div class="img-cell">' +
                '<img src="' +
                escapeHtml(src) +
                '" alt="" loading="lazy" data-post-id="' +
                escapeHtml(post.id) +
                '" data-img-index="' +
                idx +
                '" /></div>'
              );
            })
            .join('') +
          '</div>'
        : '';

    const locRaw = (post.location || '').trim();
    const nameHtml = locRaw
      ? '<div class="post-name post-location">' + escapeHtml(locRaw) + '</div>'
      : '<div class="post-name post-location muted">未标注地点</div>';

    return (
      '<article class="post" data-id="' +
      escapeHtml(post.id) +
      '" data-ym="' +
      escapeHtml(ymAttr) +
      '">' +
      '<div class="post-header">' +
      renderArtisticTime(post.createdAt) +
      '<div class="post-body">' +
      nameHtml +
      (post.text ? '<div class="post-text">' + escapeHtml(post.text) + '</div>' : '') +
      imagesHtml +
      '</div></div></article>'
    );
  }

  /* —— Lightbox —— */
  function openLightbox(postId, index) {
    const post = findPost(postId);
    if (!post || !post.images || !post.images.length) return;
    lbImages = post.images.slice(0, 9);
    lbIndex = Math.max(0, Math.min(index | 0, lbImages.length - 1));
    lbOpen = true;
    updateLightboxUI();
    els.lightbox.classList.remove('hidden');
    document.body.classList.add('lightbox-open');
  }

  function closeLightbox() {
    if (!lbOpen) return;
    lbOpen = false;
    els.lightbox.classList.add('hidden');
    document.body.classList.remove('lightbox-open');
    lbImages = [];
    lbIndex = 0;
    els.lightboxImg.removeAttribute('src');
  }

  function showLightboxIndex(i) {
    if (!lbImages.length) return;
    lbIndex = ((i % lbImages.length) + lbImages.length) % lbImages.length;
    updateLightboxUI();
  }

  function lightboxPrev() {
    if (lbImages.length <= 1) return;
    showLightboxIndex(lbIndex - 1);
  }

  function lightboxNext() {
    if (lbImages.length <= 1) return;
    showLightboxIndex(lbIndex + 1);
  }

  function updateLightboxUI() {
    const src = lbImages[lbIndex];
    els.lightboxImg.src = src;
    const multi = lbImages.length > 1;
    els.lightboxCounter.textContent = multi ? lbIndex + 1 + ' / ' + lbImages.length : '';
    els.lightboxCounter.classList.toggle('hidden', !multi);
    els.lightboxPrev.classList.toggle('hidden', !multi);
    els.lightboxNext.classList.toggle('hidden', !multi);
  }

  /* —— Interactions —— */
  function findPost(id) {
    for (let i = 0; i < posts.length; i++) {
      if (posts[i].id === id) return posts[i];
    }
    return null;
  }

  /* —— Compose —— */
  function openCompose() {
    selectedPhotos = new Set();
    els.composeText.value = '';
    els.composeLocation.value = '';
    els.btnComposeSubmit.disabled = true;
    renderPhotoChips();
    els.composeMask.classList.remove('hidden');
    setTimeout(function () {
      els.composeText.focus();
    }, 100);
  }

  function closeCompose() {
    els.composeMask.classList.add('hidden');
  }

  function renderPhotoChips() {
    els.composePhotos.innerHTML = D.PHOTO_PRESETS.map(function (p) {
      const selected = selectedPhotos.has(p.id) ? ' selected' : '';
      return (
        '<button type="button" class="photo-chip' +
        selected +
        '" data-photo="' +
        p.id +
        '" style="background:linear-gradient(135deg,' +
        p.c1 +
        ',' +
        p.c2 +
        ');border-style:solid;border-color:transparent;font-size:28px;" aria-label="照片' +
        p.emoji +
        '">' +
        p.emoji +
        '</button>'
      );
    }).join('');
  }

  function updateComposeSubmit() {
    const hasText = els.composeText.value.trim().length > 0;
    const hasPhoto = selectedPhotos.size > 0;
    els.btnComposeSubmit.disabled = !(hasText || hasPhoto);
  }

  function submitCompose() {
    const text = els.composeText.value.trim();
    const location = els.composeLocation.value.trim();
    const images = [];
    D.PHOTO_PRESETS.forEach(function (p) {
      if (selectedPhotos.has(p.id)) images.push(D.photoSrc(p));
    });
    if (!text && !images.length) return;

    const post = {
      id: uid('post'),
      author: { name: ME.name, initial: ME.initial },
      text: text,
      images: images,
      location: location,
      likes: [],
      likedByMe: false,
      comments: [],
      createdAt: Date.now(),
    };
    posts.unshift(post);
    save();
    closeCompose();
    renderFeed();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearData() {
    if (!confirm('确定清空本地全部动态？此操作不可撤销（可再点「恢复示例」）。')) return;
    posts = [];
    save();
    renderFeed();
  }

  function restoreSeed() {
    if (posts.length && !confirm('将用示例数据覆盖当前本地动态，继续？')) return;
    posts = D.buildSeedPosts();
    save();
    renderFeed();
  }

  /* —— Year/Month locator —— */
  function renderYmPanel() {
    if (!els.ymList) return;
    const index = buildYmIndex(posts);
    if (!index.years.length) {
      els.ymList.innerHTML = '';
      if (els.ymEmptyHint) els.ymEmptyHint.classList.remove('hidden');
      return;
    }
    if (els.ymEmptyHint) els.ymEmptyHint.classList.add('hidden');

    if (ymExpandedYear == null || index.years.indexOf(ymExpandedYear) === -1) {
      ymExpandedYear = index.years[0];
    }

    els.ymList.innerHTML = index.years
      .map(function (y) {
        const open = y === ymExpandedYear;
        const months = index.monthsByYear[y] || [];
        const monthsHtml = open
          ? '<div class="ym-months">' +
            months
              .map(function (m) {
                const mm = m < 10 ? '0' + m : String(m);
                const key = y + '-' + mm;
                return (
                  '<button type="button" class="ym-month-btn" data-ym-jump="' +
                  escapeHtml(key) +
                  '">' +
                  m +
                  '月</button>'
                );
              })
              .join('') +
            '</div>'
          : '';
        return (
          '<div class="ym-year-block' +
          (open ? ' open' : '') +
          '">' +
          '<button type="button" class="ym-year-btn" data-ym-year="' +
          y +
          '" aria-expanded="' +
          (open ? 'true' : 'false') +
          '">' +
          '<span class="ym-year-label">' +
          y +
          '年</span>' +
          '<span class="ym-year-meta">' +
          months.length +
          '个月</span>' +
          '<span class="ym-year-chevron" aria-hidden="true">' +
          (open ? '▾' : '▸') +
          '</span></button>' +
          monthsHtml +
          '</div>'
        );
      })
      .join('');
  }

  function openYmPanel() {
    if (!els.ymMask) return;
    renderYmPanel();
    els.ymMask.classList.remove('hidden');
  }

  function closeYmPanel() {
    if (!els.ymMask) return;
    els.ymMask.classList.add('hidden');
  }

  function jumpToYm(key) {
    closeYmPanel();
    const anchor =
      document.getElementById('ym-anchor-' + key) ||
      document.querySelector('.post[data-ym="' + key + '"], .ym-sticky[data-ym="' + key + '"]');
    if (!anchor) {
      showToast('该月暂无动态');
      return;
    }
    const top = anchor.getBoundingClientRect().top + window.pageYOffset - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  /* —— Events —— */
  els.feed.addEventListener('click', function (e) {
    const img = e.target.closest('.img-grid img[data-post-id]');
    if (img) {
      e.preventDefault();
      openLightbox(img.getAttribute('data-post-id'), parseInt(img.getAttribute('data-img-index'), 10) || 0);
    }
  });

  els.btnPublish.addEventListener('click', openCompose);
  els.btnComposeCancel.addEventListener('click', closeCompose);
  els.btnComposeSubmit.addEventListener('click', submitCompose);
  els.composeText.addEventListener('input', updateComposeSubmit);

  els.composePhotos.addEventListener('click', function (e) {
    const chip = e.target.closest('[data-photo]');
    if (!chip) return;
    const id = chip.getAttribute('data-photo');
    if (selectedPhotos.has(id)) selectedPhotos.delete(id);
    else {
      if (selectedPhotos.size >= 9) {
        alert('最多选择 9 张');
        return;
      }
      selectedPhotos.add(id);
    }
    renderPhotoChips();
    updateComposeSubmit();
  });

  els.composeMask.addEventListener('click', function (e) {
    if (e.target === els.composeMask) closeCompose();
  });


  els.btnClear.addEventListener('click', clearData);
  els.btnRestore.addEventListener('click', restoreSeed);
  els.btnRestoreEmpty.addEventListener('click', restoreSeed);

  const cam = document.querySelector('.cover-camera');
  if (cam) {
    cam.addEventListener('click', function () {
      coverHue = (coverHue + 47) % 360;
      applyCover();
      save();
    });
  }

  /* year/month locator events */
  if (els.btnYm) {
    els.btnYm.addEventListener('click', openYmPanel);
  }
  if (els.btnYmClose) {
    els.btnYmClose.addEventListener('click', closeYmPanel);
  }
  if (els.ymMask) {
    els.ymMask.addEventListener('click', function (e) {
      if (e.target === els.ymMask) closeYmPanel();
    });
  }
  if (els.ymList) {
    els.ymList.addEventListener('click', function (e) {
      const yearBtn = e.target.closest('[data-ym-year]');
      if (yearBtn) {
        const y = parseInt(yearBtn.getAttribute('data-ym-year'), 10);
        ymExpandedYear = ymExpandedYear === y ? null : y;
        renderYmPanel();
        return;
      }
      const monthBtn = e.target.closest('[data-ym-jump]');
      if (monthBtn) {
        jumpToYm(monthBtn.getAttribute('data-ym-jump'));
      }
    });
  }

  /* lightbox events */
  if (els.lightbox) {
    els.lightboxClose.addEventListener('click', function (e) {
      e.stopPropagation();
      closeLightbox();
    });
    els.lightboxPrev.addEventListener('click', function (e) {
      e.stopPropagation();
      lightboxPrev();
    });
    els.lightboxNext.addEventListener('click', function (e) {
      e.stopPropagation();
      lightboxNext();
    });
    els.lightbox.addEventListener('click', function (e) {
      if (e.target === els.lightbox || e.target.classList.contains('lightbox-backdrop')) {
        closeLightbox();
      }
    });
    els.lightboxImg.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    els.lightbox.addEventListener(
      'touchstart',
      function (e) {
        if (!lbOpen || e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchDeltaX = 0;
      },
      { passive: true }
    );
    els.lightbox.addEventListener(
      'touchmove',
      function (e) {
        if (!lbOpen || e.touches.length !== 1) return;
        touchDeltaX = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (Math.abs(touchDeltaX) > Math.abs(dy) && Math.abs(touchDeltaX) > 10) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
    els.lightbox.addEventListener(
      'touchend',
      function () {
        if (!lbOpen || lbImages.length <= 1) return;
        if (Math.abs(touchDeltaX) > 50) {
          if (touchDeltaX < 0) lightboxNext();
          else lightboxPrev();
        }
        touchDeltaX = 0;
      },
      { passive: true }
    );
  }

  document.addEventListener('keydown', function (e) {
    if (lbOpen) {
      if (e.key === 'Escape') {
        closeLightbox();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        lightboxPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        lightboxNext();
        return;
      }
    }
    if (e.key === 'Escape') {
      if (els.ymMask && !els.ymMask.classList.contains('hidden')) {
        closeYmPanel();
        return;
      }
      if (!els.composeMask.classList.contains('hidden')) closeCompose();
    }
  });

  /* —— Init —— */
  // 先本地/示例渲染，再尝试覆盖为 posts.json（访客共享源）
  if (!loadFromLocal()) {
    loadSeed();
    save();
  }
  renderProfile();
  renderFeed();

  fetchPublishedPosts().then(function (ok) {
    if (ok) renderFeed();
  });

  /* Public API for admin panel */
  window.MomentsApp = {
    STORAGE_KEY: STORAGE_KEY,
    get ME() { return ME; },
    getPosts: function () { return posts; },
    setPosts: function (next) {
      posts = Array.isArray(next) ? next : [];
      save();
      renderFeed();
    },
    save: save,
    renderFeed: renderFeed,
    uid: uid,
    escapeHtml: escapeHtml,
    formatDateYMD: formatDateYMD,
    findPost: findPost,
    fetchPublishedPosts: fetchPublishedPosts,
  };
})();
