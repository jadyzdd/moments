/**
 * 朋友圈 — 前端逻辑（localStorage 持久化）
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'moments_feed_v1';
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
    commentMask: document.getElementById('commentMask'),
    commentText: document.getElementById('commentText'),
    btnCommentCancel: document.getElementById('btnCommentCancel'),
    btnCommentSubmit: document.getElementById('btnCommentSubmit'),
    cover: document.getElementById('cover'),
  };

  let posts = [];
  let selectedPhotos = new Set();
  let commentTargetId = null;
  let coverHue = 200;

  /* —— Storage —— */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        posts = D.buildSeedPosts();
        save();
        return;
      }
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.posts)) {
        posts = data.posts;
        if (typeof data.coverHue === 'number') coverHue = data.coverHue;
      } else {
        posts = D.buildSeedPosts();
        save();
      }
    } catch (e) {
      console.warn('load failed, using seed', e);
      posts = D.buildSeedPosts();
    }
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

  /* —— Time format —— */
  function formatTime(ts) {
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return m + '分钟前';
    const h = Math.floor(m / 60);
    if (h < 24) return h + '小时前';
    const d = Math.floor(h / 24);
    if (d < 7) return d + '天前';
    const date = new Date(ts);
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    return mm + '月' + dd + '日';
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
      return;
    }
    els.emptyState.classList.add('hidden');
    els.feed.innerHTML = posts.map(renderPost).join('');
  }

  function renderPost(post) {
    const author = post.author || { name: '匿名', initial: '?' };
    const n = (post.images && post.images.length) || 0;
    const gridClass = n === 0 ? '' : 'n' + Math.min(n, 9);
    const imagesHtml =
      n > 0
        ? '<div class="img-grid ' +
          gridClass +
          '">' +
          post.images
            .slice(0, 9)
            .map(function (src) {
              return (
                '<div class="img-cell"><img src="' +
                escapeHtml(src) +
                '" alt="" loading="lazy" /></div>'
              );
            })
            .join('') +
          '</div>'
        : '';

    const likes = post.likes || [];
    const comments = post.comments || [];
    let social = '';
    if (likes.length || comments.length) {
      let likesRow = '';
      if (likes.length) {
        likesRow =
          '<div class="likes-row"><span class="heart-icon">♥</span><span class="likes-names">' +
          escapeHtml(likes.join('、')) +
          '</span></div>';
      }
      let commentsHtml = '';
      if (comments.length) {
        commentsHtml =
          '<div class="comments-list">' +
          comments
            .map(function (c) {
              return (
                '<div class="comment-item"><span class="comment-name">' +
                escapeHtml(c.name) +
                '</span><span class="comment-sep">：</span><span class="comment-content">' +
                escapeHtml(c.text) +
                '</span></div>'
              );
            })
            .join('') +
          '</div>';
      }
      social = '<div class="social-box">' + likesRow + commentsHtml + '</div>';
    }

    const likedClass = post.likedByMe ? ' liked' : '';
    const heart = post.likedByMe ? '♥' : '♡';
    const loc = post.location
      ? '<span class="post-loc">' + escapeHtml(post.location) + '</span>'
      : '';

    return (
      '<article class="post" data-id="' +
      escapeHtml(post.id) +
      '">' +
      '<div class="post-header">' +
      '<div class="avatar post-avatar" style="' +
      D.avatarStyle(author.name) +
      '">' +
      escapeHtml(author.initial || D.avatarInitial(author.name)) +
      '</div>' +
      '<div class="post-body">' +
      '<div class="post-name">' +
      escapeHtml(author.name) +
      '</div>' +
      (post.text ? '<div class="post-text">' + escapeHtml(post.text) + '</div>' : '') +
      imagesHtml +
      '<div class="post-meta">' +
      '<div class="post-time-loc"><span>' +
      formatTime(post.createdAt) +
      '</span>' +
      loc +
      '</div>' +
      '<div class="post-actions">' +
      '<button type="button" class="action-btn' +
      likedClass +
      '" data-action="like" title="赞" aria-label="赞"><span class="heart">' +
      heart +
      '</span></button>' +
      '<button type="button" class="action-btn" data-action="comment" title="评论" aria-label="评论">💬</button>' +
      '</div></div>' +
      social +
      '</div></div></article>'
    );
  }

  /* —— Interactions —— */
  function findPost(id) {
    for (let i = 0; i < posts.length; i++) {
      if (posts[i].id === id) return posts[i];
    }
    return null;
  }

  function toggleLike(id) {
    const post = findPost(id);
    if (!post) return;
    post.likes = post.likes || [];
    if (post.likedByMe) {
      post.likedByMe = false;
      post.likes = post.likes.filter(function (n) {
        return n !== ME.name;
      });
    } else {
      post.likedByMe = true;
      if (post.likes.indexOf(ME.name) === -1) post.likes.push(ME.name);
    }
    save();
    renderFeed();
  }

  function openComment(id) {
    commentTargetId = id;
    els.commentText.value = '';
    els.btnCommentSubmit.disabled = true;
    els.commentMask.classList.remove('hidden');
    setTimeout(function () {
      els.commentText.focus();
    }, 100);
  }

  function submitComment() {
    const text = els.commentText.value.trim();
    if (!text || !commentTargetId) return;
    const post = findPost(commentTargetId);
    if (!post) return;
    post.comments = post.comments || [];
    post.comments.push({ id: uid('c'), name: ME.name, text: text });
    save();
    closeComment();
    renderFeed();
  }

  function closeComment() {
    els.commentMask.classList.add('hidden');
    commentTargetId = null;
    els.commentText.value = '';
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

  /* —— Events —— */
  els.feed.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const article = btn.closest('.post');
    if (!article) return;
    const id = article.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'like') toggleLike(id);
    if (action === 'comment') openComment(id);
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

  els.btnCommentCancel.addEventListener('click', closeComment);
  els.btnCommentSubmit.addEventListener('click', submitComment);
  els.commentText.addEventListener('input', function () {
    els.btnCommentSubmit.disabled = !els.commentText.value.trim();
  });
  els.commentMask.addEventListener('click', function (e) {
    if (e.target === els.commentMask) closeComment();
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

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!els.composeMask.classList.contains('hidden')) closeCompose();
      if (!els.commentMask.classList.contains('hidden')) closeComment();
    }
  });

  /* —— Init —— */
  load();
  renderProfile();
  renderFeed();
})();
