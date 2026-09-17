/**
 * 朋友圈 — 前端逻辑（localStorage 持久化 + posts.json 共享源）
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'moments_feed_v2';
  const PROFILE_KEY = 'moments_profile_v1';
  const D = window.MomentsData;

  function defaultProfile() {
    return {
      name: D.ME.name,
      bio: D.ME.bio,
      initial: D.ME.initial || (D.ME.name ? D.ME.name.slice(0, 1) : '?'),
      coverUrl: '',
      avatarUrl: '',
      coverHue: 200,
    };
  }

  /** Live profile (nickname / bio / cover / avatar); also used as ME for new posts */
  let profile = defaultProfile();
  const ME = profile;

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
    ymYearCol: document.getElementById('ymYearCol'),
    ymMonthCol: document.getElementById('ymMonthCol'),
    ymEmptyHint: document.getElementById('ymEmptyHint'),
    btnYmClose: document.getElementById('btnYmClose'),
    btnYmConfirm: document.getElementById('btnYmConfirm'),
    toast: document.getElementById('toast'),
    btnScrollTop: document.getElementById('btnScrollTop'),
    btnScrollBottom: document.getElementById('btnScrollBottom'),
  };

  let posts = [];
  let selectedPhotos = new Set();

  /* lightbox state */
  let lbImages = [];
  let lbIndex = 0;
  let lbOpen = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;
  let toastTimer = null;

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
        // migrate legacy coverHue into profile if profile not yet saved
        if (typeof data.coverHue === 'number' && !localStorage.getItem(PROFILE_KEY)) {
          profile.coverHue = data.coverHue;
        }
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
        JSON.stringify({ posts: posts, coverHue: profile.coverHue, savedAt: Date.now() })
      );
    } catch (e) {
      console.warn('save failed', e);
    }
  }

  function normalizeProfile(raw) {
    var base = defaultProfile();
    if (!raw || typeof raw !== 'object') return base;
    var name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : base.name;
    var bio = typeof raw.bio === 'string' ? raw.bio : base.bio;
    var initial =
      typeof raw.initial === 'string' && raw.initial.trim()
        ? raw.initial.trim().slice(0, 2)
        : name.slice(0, 1);
    var coverUrl = typeof raw.coverUrl === 'string' ? raw.coverUrl : '';
    var avatarUrl = typeof raw.avatarUrl === 'string' ? raw.avatarUrl : '';
    var coverHue =
      typeof raw.coverHue === 'number' && !isNaN(raw.coverHue) ? raw.coverHue : base.coverHue;
    return {
      name: name,
      bio: bio,
      initial: initial,
      coverUrl: coverUrl,
      avatarUrl: avatarUrl,
      coverHue: coverHue,
    };
  }

  function applyProfileObject(next) {
    var n = normalizeProfile(next);
    profile.name = n.name;
    profile.bio = n.bio;
    profile.initial = n.initial;
    profile.coverUrl = n.coverUrl;
    profile.avatarUrl = n.avatarUrl;
    profile.coverHue = n.coverHue;
    return profile;
  }

  function loadProfileLocal() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return false;
      applyProfileObject(JSON.parse(raw));
      return true;
    } catch (e) {
      console.warn('load profile local failed', e);
      return false;
    }
  }

  function saveProfile() {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          name: profile.name,
          bio: profile.bio,
          initial: profile.initial,
          coverUrl: profile.coverUrl || '',
          avatarUrl: profile.avatarUrl || '',
          coverHue: profile.coverHue,
          savedAt: Date.now(),
        })
      );
    } catch (e) {
      console.warn('save profile failed', e);
    }
  }

  /**
   * 拉取仓库 profile.json（封面/昵称/简介）；成功则写入 localStorage。
   */
  function fetchPublishedProfile() {
    var url = 'profile.json?v=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        applyProfileObject(data);
        saveProfile();
        return true;
      })
      .catch(function (err) {
        console.warn('profile.json fetch failed, using local/defaults', err);
        return false;
      });
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
    els.nickname.textContent = profile.name;
    els.bio.textContent = profile.bio;
    var av = els.myAvatar;
    if (profile.avatarUrl) {
      av.textContent = '';
      av.classList.add('has-photo');
      av.style.background = 'transparent';
      av.style.backgroundImage = 'url("' + profile.avatarUrl.replace(/"/g, '%22') + '")';
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
    } else {
      av.classList.remove('has-photo');
      av.textContent = profile.initial;
      av.style.backgroundImage = '';
      av.style.backgroundSize = '';
      av.style.backgroundPosition = '';
      av.style.background = '';
      // avatarStyle returns "background:linear-gradient(...)"
      var styleFrag = D.avatarStyle(profile.name);
      var m = /^background:(.*)$/i.exec(styleFrag);
      av.style.background = m ? m[1] : styleFrag;
    }
    applyCover();
  }

  function applyCover() {
    const bg = els.cover.querySelector('.cover-bg');
    if (!bg) return;
    if (profile.coverUrl) {
      bg.classList.add('has-image');
      bg.style.backgroundImage =
        'linear-gradient(160deg, rgba(0,0,0,0.25) 0%, transparent 45%), url("' +
        profile.coverUrl.replace(/"/g, '%22') +
        '")';
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
      bg.style.backgroundColor = '#222';
      return;
    }
    bg.classList.remove('has-image');
    bg.style.backgroundImage = '';
    bg.style.backgroundSize = '';
    bg.style.backgroundPosition = '';
    const h = profile.coverHue % 360;
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
    posts.forEach(function (post) {
      const ym = ymFromTs(post.createdAt);
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
    /* 发布已迁至管理页「发布」 */
    if (!els.composeMask) {
      if (window.MomentsAdmin && typeof window.MomentsAdmin.openNew === 'function') {
        window.MomentsAdmin.openNew();
      } else {
        var adminBtn = document.getElementById('btnAdmin');
        if (adminBtn) adminBtn.click();
      }
      return;
    }
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
    if (!els.composeMask) return;
    els.composeMask.classList.add('hidden');
  }

  function renderPhotoChips() {
    if (!els.composePhotos) return;
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
    if (!els.composeText || !els.btnComposeSubmit) return;
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
  var ymPickerYears = [];
  var ymScrollTimers = { year: null, month: null };
  var YM_ITEM_H = 44;

  function pad2(n) {
    n = Number(n);
    return n < 10 ? '0' + n : String(n);
  }

  function renderYmPanel() {
    /* kept for callers; drum picker rebuilds on open */
    return;
  }

  function buildYmYearList(posts) {
    var index = buildYmIndex(posts);
    if (!index.years.length) return [];
    var maxY = index.years[0];
    var minY = index.years[index.years.length - 1];
    // pad one year above/below for wheel feel (desc: high → low)
    var years = [];
    for (var y = maxY + 1; y >= minY - 1; y--) years.push(y);
    return years;
  }

  function fillYmCol(col, values, formatter) {
    if (!col) return;
    var html = '<div class="ym-picker-spacer" aria-hidden="true"></div>';
    values.forEach(function (v, i) {
      html +=
        '<div class="ym-picker-item" role="option" data-value="' +
        escapeHtml(String(v)) +
        '" data-index="' +
        i +
        '">' +
        escapeHtml(formatter(v)) +
        '</div>';
    });
    html += '<div class="ym-picker-spacer" aria-hidden="true"></div>';
    col.innerHTML = html;
  }

  function ymColIndexFromScroll(col) {
    if (!col) return 0;
    var idx = Math.round(col.scrollTop / YM_ITEM_H);
    var max = Math.max(0, col.querySelectorAll('.ym-picker-item').length - 1);
    if (idx < 0) idx = 0;
    if (idx > max) idx = max;
    return idx;
  }

  function syncYmColActive(col) {
    if (!col) return;
    var idx = ymColIndexFromScroll(col);
    var items = col.querySelectorAll('.ym-picker-item');
    items.forEach(function (el, i) {
      if (i === idx) el.classList.add('is-active');
      else el.classList.remove('is-active');
    });
    return idx;
  }

  function scrollYmColToIndex(col, index, smooth) {
    if (!col) return;
    var max = Math.max(0, col.querySelectorAll('.ym-picker-item').length - 1);
    if (index < 0) index = 0;
    if (index > max) index = max;
    col.scrollTo({
      top: index * YM_ITEM_H,
      behavior: smooth ? 'smooth' : 'auto',
    });
    window.setTimeout(function () {
      syncYmColActive(col);
    }, smooth ? 220 : 0);
  }

  function getYmSelection() {
    var yi = ymColIndexFromScroll(els.ymYearCol);
    var mi = ymColIndexFromScroll(els.ymMonthCol);
    var year = ymPickerYears[yi];
    var month = mi + 1; // months 1..12 ascending in list
    if (!year) year = new Date().getFullYear();
    return { year: year, month: month, key: year + '-' + pad2(month) };
  }

  function bindYmColScroll(col, which) {
    if (!col || col.getAttribute('data-bound')) return;
    col.setAttribute('data-bound', '1');
    col.addEventListener(
      'scroll',
      function () {
        syncYmColActive(col);
        if (ymScrollTimers[which]) clearTimeout(ymScrollTimers[which]);
        ymScrollTimers[which] = setTimeout(function () {
          var idx = ymColIndexFromScroll(col);
          scrollYmColToIndex(col, idx, true);
        }, 80);
      },
      { passive: true }
    );
  }

  function openYmPanel() {
    if (!els.ymMask) return;
    var posts = sortNewest(posts);
    ymPickerYears = buildYmYearList(posts);
    if (!ymPickerYears.length) {
      if (els.ymYearCol) els.ymYearCol.innerHTML = '';
      if (els.ymMonthCol) els.ymMonthCol.innerHTML = '';
      if (els.ymEmptyHint) els.ymEmptyHint.classList.remove('hidden');
      if (els.btnYmConfirm) els.btnYmConfirm.disabled = true;
    } else {
      if (els.ymEmptyHint) els.ymEmptyHint.classList.add('hidden');
      if (els.btnYmConfirm) els.btnYmConfirm.disabled = false;
      fillYmCol(els.ymYearCol, ymPickerYears, function (y) {
        return String(y);
      });
      var months = [];
      for (var m = 1; m <= 12; m++) months.push(m);
      fillYmCol(els.ymMonthCol, months, function (mo) {
        return pad2(mo);
      });
      bindYmColScroll(els.ymYearCol, 'year');
      bindYmColScroll(els.ymMonthCol, 'month');

      // default: latest post's year/month
      var defY = ymPickerYears[1] != null ? ymPickerYears[1] : ymPickerYears[0]; // skip pad year
      var defM = 1;
      if (posts.length) {
        var ym = ymFromTs(posts[0].createdAt);
        defY = ym.year;
        defM = ym.month;
      }
      var yIdx = ymPickerYears.indexOf(defY);
      if (yIdx < 0) yIdx = 0;
      els.ymMask.classList.remove('hidden');
      // wait layout then scroll
      window.requestAnimationFrame(function () {
        scrollYmColToIndex(els.ymYearCol, yIdx, false);
        scrollYmColToIndex(els.ymMonthCol, defM - 1, false);
      });
      return;
    }
    els.ymMask.classList.remove('hidden');
  }

  function closeYmPanel() {
    if (!els.ymMask) return;
    els.ymMask.classList.add('hidden');
  }

  function confirmYmPanel() {
    var sel = getYmSelection();
    jumpToYm(sel.key);
  }

    function jumpToYm(key) {
    closeYmPanel();
    const anchor =
      document.querySelector('.post[data-ym="' + key + '"]');
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

  if (els.btnPublish) els.btnPublish.addEventListener('click', openCompose);
  if (els.btnComposeCancel) els.btnComposeCancel.addEventListener('click', closeCompose);
  if (els.btnComposeSubmit) els.btnComposeSubmit.addEventListener('click', submitCompose);
  if (els.composeText) els.composeText.addEventListener('input', updateComposeSubmit);

  if (els.composePhotos) els.composePhotos.addEventListener('click', function (e) {
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

  if (els.composeMask) {
    els.composeMask.addEventListener('click', function (e) {
      if (e.target === els.composeMask) closeCompose();
    });
  }


  els.btnClear.addEventListener('click', clearData);
  els.btnRestore.addEventListener('click', restoreSeed);
  els.btnRestoreEmpty.addEventListener('click', restoreSeed);

  const cam = document.querySelector('.cover-camera');
  if (cam) {
    cam.addEventListener('click', function () {
      // 有封面图时点相机只换色无效观感；仍更新 hue 供去掉封面后使用
      profile.coverHue = (profile.coverHue + 47) % 360;
      if (!profile.coverUrl) {
        applyCover();
      }
      saveProfile();
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
  if (els.btnYmConfirm) {
    els.btnYmConfirm.addEventListener('click', confirmYmPanel);
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
      if (els.composeMask && !els.composeMask.classList.contains('hidden')) closeCompose();
    }
  });


  /* —— Scroll jump —— */
  function getScrollY() {
    return (
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function getScrollMax() {
    var doc = document.documentElement;
    var body = document.body;
    var height = Math.max(
      doc.scrollHeight,
      body ? body.scrollHeight : 0,
      doc.offsetHeight,
      body ? body.offsetHeight : 0
    );
    return Math.max(0, height - window.innerHeight);
  }

  function scrollPageTo(top, behavior) {
    top = Math.max(0, top || 0);
    behavior = behavior || 'smooth';
    try {
      window.scrollTo({ top: top, left: 0, behavior: behavior });
    } catch (e) {
      window.scrollTo(0, top);
    }
    // Fallbacks for stubborn mobile WebViews
    document.documentElement.scrollTop = top;
    if (document.body) document.body.scrollTop = top;
  }

  function updateScrollFabs() {
    var topBtn = els.btnScrollTop || document.getElementById('btnScrollTop');
    var bottomBtn = els.btnScrollBottom || document.getElementById('btnScrollBottom');
    if (!topBtn || !bottomBtn) return;
    var y = getScrollY();
    var max = getScrollMax();
    var nearTop = y < 120;
    var nearBottom = max - y < 160;
    if (nearTop) topBtn.classList.add('hidden');
    else topBtn.classList.remove('hidden');
    if (nearBottom || max < 80) bottomBtn.classList.add('hidden');
    else bottomBtn.classList.remove('hidden');
  }

  function bindScrollFabs() {
    var topBtn = els.btnScrollTop || document.getElementById('btnScrollTop');
    var bottomBtn = els.btnScrollBottom || document.getElementById('btnScrollBottom');
    if (bottomBtn && !bottomBtn.getAttribute('data-bound')) {
      bottomBtn.setAttribute('data-bound', '1');
      bottomBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var footer = document.querySelector('.footer');
        var max = getScrollMax();
        scrollPageTo(max, 'smooth');
        if (footer) {
          try {
            footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
          } catch (err) {}
        }
        // ensure after layout/smooth settles
        window.setTimeout(function () {
          scrollPageTo(getScrollMax(), 'auto');
          updateScrollFabs();
        }, 400);
      });
    }
    if (topBtn && !topBtn.getAttribute('data-bound')) {
      topBtn.setAttribute('data-bound', '1');
      topBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        scrollPageTo(0, 'smooth');
        window.setTimeout(updateScrollFabs, 400);
      });
    }
    window.addEventListener('scroll', updateScrollFabs, { passive: true });
    window.addEventListener('resize', updateScrollFabs);
    updateScrollFabs();
  }

  bindScrollFabs();

  /* —— Init —— */
  // 先本地/示例渲染，再尝试覆盖为 posts.json / profile.json（访客共享源）
  if (!loadFromLocal()) {
    loadSeed();
    save();
  }
  loadProfileLocal();
  renderProfile();
  renderFeed();

  fetchPublishedPosts().then(function (ok) {
    if (ok) renderFeed();
  });
  fetchPublishedProfile().then(function (ok) {
    if (ok) renderProfile();
  });

  /* Public API for admin panel */
  window.MomentsApp = {
    STORAGE_KEY: STORAGE_KEY,
    PROFILE_KEY: PROFILE_KEY,
    get ME() { return profile; },
    getPosts: function () { return posts; },
    setPosts: function (next) {
      posts = Array.isArray(next) ? next : [];
      save();
      renderFeed();
    },
    getProfile: function () {
      return {
        name: profile.name,
        bio: profile.bio,
        initial: profile.initial,
        coverUrl: profile.coverUrl || '',
        avatarUrl: profile.avatarUrl || '',
        coverHue: profile.coverHue,
      };
    },
    setProfile: function (next) {
      applyProfileObject(next);
      saveProfile();
      renderProfile();
      return profile;
    },
    saveProfile: saveProfile,
    renderProfile: renderProfile,
    save: save,
    renderFeed: renderFeed,
    uid: uid,
    escapeHtml: escapeHtml,
    formatDateYMD: formatDateYMD,
    findPost: findPost,
    fetchPublishedPosts: fetchPublishedPosts,
    fetchPublishedProfile: fetchPublishedProfile,
  };
})();
