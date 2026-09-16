/**
 * 朋友圈本地管理面板（密码门 + CRUD + 导入导出 + 同步到 GitHub）
 * 依赖 window.MomentsApp（由 app.js 暴露）
 */
(function () {
  'use strict';

  var PW_KEY = 'moments_admin_pw_v1';
  var SESSION_KEY = 'moments_admin_unlocked';
  var DEFAULT_PW = 'moments';

  var GH_TOKEN_KEY = 'moments_gh_token';
  var GH_OWNER_KEY = 'moments_gh_owner';
  var GH_REPO_KEY = 'moments_gh_repo';
  var GH_BRANCH_KEY = 'moments_gh_branch';
  var GH_LAST_SYNC_KEY = 'moments_last_sync_at';

  var DEFAULT_OWNER = 'jadyzdd';
  var DEFAULT_REPO = 'moments';
  var DEFAULT_BRANCH = 'main';

  /** Soft limit for posts.json UTF-8 size before sync (GitHub Contents API practical) */
  var MAX_SYNC_BYTES = 900 * 1024;
  var IMG_MAX_EDGE = 1600;
  var IMG_JPEG_QUALITY = 0.82;

  var App = null;
  var editImages = []; // data URLs currently in editor
  var editingId = null; // null = new post
  var syncing = false;

  function $(id) {
    return document.getElementById(id);
  }

  function getStoredPassword() {
    try {
      var p = localStorage.getItem(PW_KEY);
      return p != null && p !== '' ? p : DEFAULT_PW;
    } catch (e) {
      return DEFAULT_PW;
    }
  }

  function setStoredPassword(pw) {
    localStorage.setItem(PW_KEY, pw);
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setUnlocked(v) {
    try {
      if (v) sessionStorage.setItem(SESSION_KEY, '1');
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function toDatetimeLocalValue(ts) {
    var d = new Date(ts || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  function fromDatetimeLocalValue(v) {
    if (!v) return Date.now();
    var t = new Date(v).getTime();
    return isNaN(t) ? Date.now() : t;
  }

  function previewText(s, n) {
    s = String(s || '').trim();
    if (!s) return '（无文字）';
    if (s.length <= (n || 48)) return s;
    return s.slice(0, n || 48) + '…';
  }

  function sortNewest(posts) {
    return posts.slice().sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function utf8ByteLength(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    return unescape(encodeURIComponent(str)).length;
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* —— Image compress —— */
  function compressImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve(null);
        return;
      }
      var mime = file.type || '';
      if (!mime) {
        var fname = (file.name || '').toLowerCase();
        if (/\.(jpe?g|png|gif|webp|bmp)$/.test(fname)) mime = 'image/jpeg';
        else if (/\.heic$/.test(fname)) mime = 'image/heic';
      }
      if (!mime || mime.indexOf('image/') !== 0) {
        resolve(null);
        return;
      }
      if (mime === 'image/heic' || mime === 'image/heif') {
        reject(new Error('暂不支持 HEIC，请先转为 JPG/PNG 再上传'));
        return;
      }
      var fr = new FileReader();
      fr.onerror = function () {
        reject(fr.error || new Error('read failed'));
      };
      fr.onload = function () {
        var dataUrl = fr.result;
        var img = new Image();
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h) {
              resolve(dataUrl);
              return;
            }
            var scale = 1;
            var maxEdge = Math.max(w, h);
            if (maxEdge > IMG_MAX_EDGE) scale = IMG_MAX_EDGE / maxEdge;
            var tw = Math.max(1, Math.round(w * scale));
            var th = Math.max(1, Math.round(h * scale));
            var canvas = document.createElement('canvas');
            canvas.width = tw;
            canvas.height = th;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, tw, th);
            var out;
            if (mime === 'image/png' && scale === 1 && file.size < 200 * 1024) {
              out = canvas.toDataURL('image/png');
            } else {
              out = canvas.toDataURL('image/jpeg', IMG_JPEG_QUALITY);
            }
            resolve(out);
          } catch (e) {
            resolve(dataUrl);
          }
        };
        img.onerror = function () {
          reject(new Error('图片无法解码，请换 JPG/PNG 再试'));
        };
        img.src = dataUrl;
      };
      fr.readAsDataURL(file);
    });
  }

  /* —— Password gate —— */
  function openPasswordGate() {
    var err = $('adminPwError');
    if (err) {
      err.textContent = '';
      err.classList.add('hidden');
    }
    var input = $('adminPwInput');
    if (input) input.value = '';
    $('adminPwMask').classList.remove('hidden');
    setTimeout(function () {
      if (input) input.focus();
    }, 80);
  }

  function closePasswordGate() {
    $('adminPwMask').classList.add('hidden');
  }

  function tryUnlock() {
    var input = $('adminPwInput');
    var pw = (input && input.value) || '';
    var err = $('adminPwError');
    if (pw === getStoredPassword()) {
      setUnlocked(true);
      closePasswordGate();
      openAdminPanel();
      return;
    }
    if (err) {
      err.textContent = '密码错误，请重试';
      err.classList.remove('hidden');
    }
    if (input) {
      input.select();
      input.focus();
    }
  }

  function requestAdmin() {
    if (isUnlocked()) openAdminPanel();
    else openPasswordGate();
  }

  /* —— Admin panel list —— */
  function openAdminPanel() {
    closeEditor();
    $('adminPanel').classList.remove('hidden');
    document.body.classList.add('admin-open');
    renderAdminList();
    loadGhForm();
    updateSyncButtonState();
    renderLastSync();
  }

  function closeAdminPanel() {
    $('adminPanel').classList.add('hidden');
    document.body.classList.remove('admin-open');
    closeEditor();
  }

  function renderAdminList() {
    var list = $('adminList');
    if (!list || !App) return;
    var posts = sortNewest(App.getPosts());
    $('adminCount').textContent = '共 ' + posts.length + ' 条';
    if (!posts.length) {
      list.innerHTML =
        '<div class="admin-empty">暂无动态。点上方「新建」添加，或从右下角「发布」写入。</div>';
      return;
    }
    list.innerHTML = posts
      .map(function (p) {
        var d = App.formatDateYMD(p.createdAt);
        var loc = (p.location || '').trim() || '未标注地点';
        var likes = (p.likes && p.likes.length) || 0;
        var comments = (p.comments && p.comments.length) || 0;
        var thumbs = (p.images || [])
          .slice(0, 4)
          .map(function (src) {
            return (
              '<img class="admin-thumb" src="' +
              App.escapeHtml(src) +
              '" alt="" />'
            );
          })
          .join('');
        var more =
          (p.images || []).length > 4
            ? '<span class="admin-thumb-more">+' +
              ((p.images || []).length - 4) +
              '</span>'
            : '';
        return (
          '<article class="admin-item" data-id="' +
          App.escapeHtml(p.id) +
          '">' +
          '<div class="admin-item-main">' +
          '<div class="admin-item-meta">' +
          '<span class="admin-item-date">' +
          App.escapeHtml(d.full) +
          '</span>' +
          '<span class="admin-item-loc">📍 ' +
          App.escapeHtml(loc) +
          '</span>' +
          '</div>' +
          '<div class="admin-item-text">' +
          App.escapeHtml(previewText(p.text, 60)) +
          '</div>' +
          (thumbs
            ? '<div class="admin-item-thumbs">' + thumbs + more + '</div>'
            : '') +
          '<div class="admin-item-stats">♥ ' +
          likes +
          ' · 💬 ' +
          comments +
          '</div>' +
          '</div>' +
          '<div class="admin-item-actions">' +
          '<button type="button" class="admin-btn-sm" data-admin-act="edit">编辑</button>' +
          '<button type="button" class="admin-btn-sm danger" data-admin-act="del">删除</button>' +
          '</div></article>'
        );
      })
      .join('');
  }

  function deletePost(id) {
    if (!confirm('确定删除这条动态？此操作不可撤销。')) return;
    var next = App.getPosts().filter(function (p) {
      return p.id !== id;
    });
    App.setPosts(next);
    renderAdminList();
  }

  /* —— Editor —— */
  function openEditor(post) {
    editingId = post ? post.id : null;
    editImages = post && post.images ? post.images.slice() : [];
    $('adminEditorTitle').textContent = post ? '编辑动态' : '新建动态';
    $('adminEditText').value = post ? post.text || '' : '';
    $('adminEditLocation').value = post ? post.location || '' : '';
    $('adminEditDatetime').value = toDatetimeLocalValue(
      post ? post.createdAt : Date.now()
    );
    renderEditorImages();
    $('adminEditor').classList.remove('hidden');
  }

  function closeEditor() {
    var ed = $('adminEditor');
    if (ed) ed.classList.add('hidden');
    editingId = null;
    editImages = [];
    var file = $('adminEditFiles');
    if (file) file.value = '';
  }

  function renderEditorImages() {
    var box = $('adminEditImages');
    if (!box) return;
    if (!editImages.length) {
      box.innerHTML = '<p class="admin-img-hint">尚未添加图片（最多 9 张；上传会自动压缩）</p>';
      return;
    }
    box.innerHTML = editImages
      .map(function (src, i) {
        return (
          '<div class="admin-img-item" data-idx="' +
          i +
          '">' +
          '<img src="' +
          App.escapeHtml(src) +
          '" alt="" />' +
          '<div class="admin-img-bar">' +
          '<button type="button" data-img-act="left" title="左移"' +
          (i === 0 ? ' disabled' : '') +
          '>‹</button>' +
          '<button type="button" data-img-act="right" title="右移"' +
          (i === editImages.length - 1 ? ' disabled' : '') +
          '>›</button>' +
          '<button type="button" data-img-act="remove" title="移除">×</button>' +
          '</div></div>'
        );
      })
      .join('');
  }

  function moveImage(idx, dir) {
    var j = idx + dir;
    if (j < 0 || j >= editImages.length) return;
    var tmp = editImages[idx];
    editImages[idx] = editImages[j];
    editImages[j] = tmp;
    renderEditorImages();
  }

  function removeImage(idx) {
    editImages.splice(idx, 1);
    renderEditorImages();
  }

  function setUploadTip(msg, isErr) {
    var tip = $('adminUploadTip');
    if (!tip) return;
    tip.textContent = msg || '支持一次选多张（最多 9 张），手机也可从相册选图；保存后再同步到 GitHub。';
    tip.style.color = isErr ? '#e64340' : '';
  }

  function readFilesAsDataURLs(fileList) {
    var files = Array.prototype.slice.call(fileList || [], 0);
    var room = 9 - editImages.length;
    if (room <= 0) {
      alert('最多 9 张图片');
      return Promise.resolve();
    }
    files = files.slice(0, room);
    if (!files.length) return Promise.resolve();
    setUploadTip('正在处理图片…', false);
    var addBtn = $('adminEditAddImg');
    if (addBtn) addBtn.setAttribute('aria-busy', 'true');
    var jobs = files.map(function (file) {
      return compressImageFile(file).then(
        function (u) {
          return { ok: !!u, url: u, name: file.name };
        },
        function (err) {
          return { ok: false, url: null, name: file.name, err: err };
        }
      );
    });
    return Promise.all(jobs).then(function (results) {
      var added = 0;
      var errors = [];
      results.forEach(function (r) {
        if (r.ok && r.url && editImages.length < 9) {
          editImages.push(r.url);
          added++;
        } else if (!r.ok) {
          errors.push(
            (r.name || '图片') +
              (r.err && r.err.message ? '：' + r.err.message : '')
          );
        }
      });
      renderEditorImages();
      if (addBtn) addBtn.removeAttribute('aria-busy');
      if (added && !errors.length) {
        setUploadTip('已添加 ' + added + ' 张，记得点「保存」，需要给别人看时再「同步到 GitHub」。', false);
      } else if (added && errors.length) {
        setUploadTip('已添加 ' + added + ' 张；部分失败：' + errors.join('；'), true);
      } else if (errors.length) {
        setUploadTip('上传失败：' + errors.join('；'), true);
        alert('上传失败：' + errors[0]);
      } else {
        setUploadTip('没有可用的图片（请选 JPG/PNG/WebP）', true);
      }
    });
  }

  function saveEditor() {
    var text = ($('adminEditText').value || '').trim();
    var location = ($('adminEditLocation').value || '').trim();
    var createdAt = fromDatetimeLocalValue($('adminEditDatetime').value);
    var images = editImages.slice(0, 9);
    if (!text && !images.length) {
      alert('请填写文字或添加至少一张图片');
      return;
    }

    var posts = App.getPosts().slice();
    if (editingId) {
      var found = false;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].id === editingId) {
          posts[i].text = text;
          posts[i].location = location;
          posts[i].images = images;
          posts[i].createdAt = createdAt;
          found = true;
          break;
        }
      }
      if (!found) {
        alert('未找到该动态');
        return;
      }
      posts.sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    } else {
      var ME = App.ME;
      var post = {
        id: App.uid('post'),
        author: { name: ME.name, initial: ME.initial },
        text: text,
        images: images,
        location: location,
        likes: [],
        likedByMe: false,
        comments: [],
        createdAt: createdAt,
      };
      posts.unshift(post);
      posts.sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }
    App.setPosts(posts);
    closeEditor();
    renderAdminList();
  }

  /* —— Export / Import —— */
  function exportJson() {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      storageKey: App.STORAGE_KEY,
      posts: App.getPosts(),
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download =
      'moments-backup-' +
      new Date().toISOString().slice(0, 10) +
      '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function importJson(file, mode) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var incoming = null;
        if (Array.isArray(data)) incoming = data;
        else if (data && Array.isArray(data.posts)) incoming = data.posts;
        else throw new Error('JSON 中没有 posts 数组');

        incoming = incoming.filter(function (p) {
          return p && typeof p === 'object' && p.id;
        });

        var next;
        if (mode === 'merge') {
          var map = {};
          App.getPosts().forEach(function (p) {
            map[p.id] = p;
          });
          incoming.forEach(function (p) {
            map[p.id] = p;
          });
          next = Object.keys(map).map(function (k) {
            return map[k];
          });
        } else {
          if (
            !confirm(
              '将用导入的 ' +
                incoming.length +
                ' 条动态【完全替换】当前本地数据，继续？'
            )
          ) {
            return;
          }
          next = incoming;
        }
        next.sort(function (a, b) {
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
        App.setPosts(next);
        renderAdminList();
        alert(
          (mode === 'merge' ? '合并完成，现有 ' : '替换完成，现有 ') +
            next.length +
            ' 条'
        );
      } catch (e) {
        alert('导入失败：' + (e && e.message ? e.message : e));
      }
    };
    reader.onerror = function () {
      alert('读取文件失败');
    };
    reader.readAsText(file);
  }

  function changePassword() {
    var cur = prompt('请输入当前密码：');
    if (cur === null) return;
    if (cur !== getStoredPassword()) {
      alert('当前密码不正确');
      return;
    }
    var np = prompt('请输入新密码（勿过长；仅演示级保护，明文存于 localStorage）：');
    if (np === null) return;
    np = String(np);
    if (!np) {
      alert('新密码不能为空');
      return;
    }
    var again = prompt('再输入一次新密码：');
    if (again === null) return;
    if (again !== np) {
      alert('两次输入不一致');
      return;
    }
    setStoredPassword(np);
    alert('密码已更新（保存在本机 localStorage）');
  }

  function lockAdmin() {
    setUnlocked(false);
    closeAdminPanel();
  }

  /* —— GitHub sync —— */
  function lsGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v != null && v !== '' ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, val) {
    try {
      if (val == null || val === '') localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) {}
  }

  function getGhToken() {
    return lsGet(GH_TOKEN_KEY, '');
  }

  function maskToken(token) {
    if (!token) return '';
    if (token.length <= 8) return '••••••••';
    return token.slice(0, 4) + '••••••••' + token.slice(-4);
  }

  function loadGhForm() {
    var owner = $('ghOwner');
    var repo = $('ghRepo');
    var branch = $('ghBranch');
    var tokenInput = $('ghToken');
    var masked = $('ghTokenMasked');
    if (owner) owner.value = lsGet(GH_OWNER_KEY, DEFAULT_OWNER);
    if (repo) repo.value = lsGet(GH_REPO_KEY, DEFAULT_REPO);
    if (branch) branch.value = lsGet(GH_BRANCH_KEY, DEFAULT_BRANCH);
    var token = getGhToken();
    if (tokenInput) tokenInput.value = '';
    if (masked) {
      if (token) {
        masked.textContent = '已保存 Token：' + maskToken(token);
        masked.classList.remove('hidden');
      } else {
        masked.textContent = '';
        masked.classList.add('hidden');
      }
    }
  }

  function persistGhFields() {
    var owner = ($('ghOwner') && $('ghOwner').value.trim()) || DEFAULT_OWNER;
    var repo = ($('ghRepo') && $('ghRepo').value.trim()) || DEFAULT_REPO;
    var branch = ($('ghBranch') && $('ghBranch').value.trim()) || DEFAULT_BRANCH;
    lsSet(GH_OWNER_KEY, owner);
    lsSet(GH_REPO_KEY, repo);
    lsSet(GH_BRANCH_KEY, branch);
    var tokenInput = $('ghToken');
    var typed = tokenInput && tokenInput.value.trim();
    if (typed) {
      lsSet(GH_TOKEN_KEY, typed);
      tokenInput.value = '';
    }
    loadGhForm();
    updateSyncButtonState();
  }

  function clearGhToken() {
    if (!confirm('清除本机保存的 GitHub Token？')) return;
    lsSet(GH_TOKEN_KEY, '');
    var tokenInput = $('ghToken');
    if (tokenInput) tokenInput.value = '';
    loadGhForm();
    updateSyncButtonState();
    setSyncStatus('', '');
  }

  function updateSyncButtonState() {
    var btn = $('ghSyncBtn');
    if (!btn) return;
    var hasToken = !!getGhToken() || !!( $('ghToken') && $('ghToken').value.trim() );
    btn.disabled = !hasToken || syncing;
  }

  function renderLastSync() {
    var el = $('ghLastSync');
    if (!el) return;
    var ts = lsGet(GH_LAST_SYNC_KEY, '');
    if (!ts) {
      el.textContent = '尚未同步';
      return;
    }
    var n = parseInt(ts, 10);
    if (isNaN(n)) {
      el.textContent = '上次同步：' + ts;
      return;
    }
    var d = new Date(n);
    var pad2 = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    el.textContent =
      '上次同步：' +
      d.getFullYear() +
      '-' +
      pad2(d.getMonth() + 1) +
      '-' +
      pad2(d.getDate()) +
      ' ' +
      pad2(d.getHours()) +
      ':' +
      pad2(d.getMinutes()) +
      ':' +
      pad2(d.getSeconds());
  }

  function setSyncStatus(msg, kind) {
    var el = $('ghSyncStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'gh-sync-status' + (kind ? ' ' + kind : '');
    if (!msg) el.classList.add('hidden');
    else el.classList.remove('hidden');
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function buildPostsJsonText() {
    var posts = sortNewest(App.getPosts());
    return JSON.stringify(posts, null, 2) + '\n';
  }

  function mapGhError(status, body) {
    var detail = '';
    try {
      var j = typeof body === 'string' ? JSON.parse(body) : body;
      if (j && j.message) detail = j.message;
    } catch (e) {
      if (typeof body === 'string' && body.length < 200) detail = body;
    }
    if (status === 401) {
      return '认证失败（401）：Token 无效或已过期，请重新创建并粘贴。';
    }
    if (status === 403) {
      return (
        '权限不足（403）：请确认 Token 对该仓库有 Contents 读写权限。' +
        (detail ? ' ' + detail : '')
      );
    }
    if (status === 404) {
      return '未找到（404）：请检查 Owner / Repo / Branch 是否正确，或 Token 是否有权访问该仓库。';
    }
    if (status === 409 || status === 422) {
      return (
        '提交冲突或校验失败（' +
        status +
        '）：可能文件已被他人更新，请刷新后重试。' +
        (detail ? ' ' + detail : '')
      );
    }
    return (
      '同步失败（HTTP ' +
      status +
      '）' +
      (detail ? '：' + detail : '')
    );
  }

  function syncToGitHub() {
    if (syncing) return;
    persistGhFields();
    var token = getGhToken();
    if (!token) {
      setSyncStatus('请先填写并保存 GitHub Token', 'error');
      updateSyncButtonState();
      return;
    }
    var owner = lsGet(GH_OWNER_KEY, DEFAULT_OWNER);
    var repo = lsGet(GH_REPO_KEY, DEFAULT_REPO);
    var branch = lsGet(GH_BRANCH_KEY, DEFAULT_BRANCH);
    var text = buildPostsJsonText();
    var bytes = utf8ByteLength(text);
    if (bytes > MAX_SYNC_BYTES) {
      setSyncStatus(
        '内容过大（约 ' +
          formatBytes(bytes) +
          '），超过建议上限 ' +
          formatBytes(MAX_SYNC_BYTES) +
          '。请减少含 data URL 的大图，或改用 assets/ 相对路径后再同步。',
        'error'
      );
      return;
    }

    syncing = true;
    updateSyncButtonState();
    setSyncStatus('正在同步到 GitHub…（' + formatBytes(bytes) + '）', 'pending');

    var apiBase =
      'https://api.github.com/repos/' +
      encodeURIComponent(owner) +
      '/' +
      encodeURIComponent(repo) +
      '/contents/posts.json';
    var headers = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    fetch(apiBase + '?ref=' + encodeURIComponent(branch), {
      method: 'GET',
      headers: headers,
    })
      .then(function (res) {
        if (res.status === 404) {
          return { sha: null };
        }
        if (!res.ok) {
          return res.text().then(function (t) {
            throw { status: res.status, body: t };
          });
        }
        return res.json().then(function (j) {
          return { sha: j.sha || null };
        });
      })
      .then(function (info) {
        var body = {
          message: 'Sync posts.json from Moments admin',
          content: utf8ToBase64(text),
          branch: branch,
        };
        if (info.sha) body.sha = info.sha;
        return fetch(apiBase, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(body),
        }).then(function (res) {
          return res.text().then(function (t) {
            var parsed = null;
            try {
              parsed = JSON.parse(t);
            } catch (e) {}
            if (!res.ok) {
              throw { status: res.status, body: t, json: parsed };
            }
            return parsed;
          });
        });
      })
      .then(function (result) {
        // Ensure localStorage matches what was pushed
        App.setPosts(JSON.parse(text));
        var now = Date.now();
        lsSet(GH_LAST_SYNC_KEY, String(now));
        renderLastSync();
        renderAdminList();
        var commitUrl =
          result &&
          result.commit &&
          (result.commit.html_url || (result.commit.sha ? null : null));
        var html =
          '同步成功！GitHub Pages 通常约 1 分钟后生效，请刷新访客页面查看。';
        if (result && result.commit && result.commit.html_url) {
          html +=
            ' 提交：' +
            result.commit.html_url;
        } else if (result && result.content && result.content.html_url) {
          html += ' 文件：' + result.content.html_url;
        }
        setSyncStatus(html, 'success');
      })
      .catch(function (err) {
        if (err && err.status) {
          setSyncStatus(mapGhError(err.status, err.body || err.json), 'error');
        } else {
          setSyncStatus(
            '网络或浏览器错误：' +
              (err && err.message ? err.message : String(err)),
            'error'
          );
        }
      })
      .then(function () {
        syncing = false;
        updateSyncButtonState();
      });
  }

  /* —— Wire events —— */
  function bind() {
    var btnAdmin = $('btnAdmin');
    if (btnAdmin) btnAdmin.addEventListener('click', requestAdmin);

    $('adminPwCancel').addEventListener('click', closePasswordGate);
    $('adminPwSubmit').addEventListener('click', tryUnlock);
    $('adminPwInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryUnlock();
      }
    });
    $('adminPwMask').addEventListener('click', function (e) {
      if (e.target === $('adminPwMask')) closePasswordGate();
    });

    $('adminClose').addEventListener('click', closeAdminPanel);
    $('adminNew').addEventListener('click', function () {
      openEditor(null);
    });
    $('adminExport').addEventListener('click', exportJson);
    $('adminImportReplace').addEventListener('click', function () {
      $('adminImportFile').setAttribute('data-mode', 'replace');
      $('adminImportFile').click();
    });
    $('adminImportMerge').addEventListener('click', function () {
      $('adminImportFile').setAttribute('data-mode', 'merge');
      $('adminImportFile').click();
    });
    $('adminImportFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      var mode = this.getAttribute('data-mode') || 'replace';
      this.value = '';
      importJson(f, mode);
    });
    $('adminChangePw').addEventListener('click', changePassword);
    $('adminLock').addEventListener('click', lockAdmin);

    $('adminList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-admin-act]');
      if (!btn) return;
      var item = btn.closest('.admin-item');
      if (!item) return;
      var id = item.getAttribute('data-id');
      var act = btn.getAttribute('data-admin-act');
      if (act === 'del') deletePost(id);
      if (act === 'edit') {
        var post = App.findPost(id);
        if (post) openEditor(post);
      }
    });

    $('adminEditCancel').addEventListener('click', closeEditor);
    $('adminEditSave').addEventListener('click', saveEditor);
    // Label[for=adminEditFiles] opens the picker (works even when input is visually hidden).
    // Keep a JS fallback click for older markup.
    var addImgBtn = $('adminEditAddImg');
    if (addImgBtn && addImgBtn.tagName === 'BUTTON') {
      addImgBtn.addEventListener('click', function () {
        var inp = $('adminEditFiles');
        if (inp) inp.click();
      });
    }
    $('adminEditFiles').addEventListener('change', function () {
      var files = this.files;
      // copy FileList before clearing
      var list = files ? Array.prototype.slice.call(files, 0) : [];
      this.value = '';
      readFilesAsDataURLs(list).catch(function (e) {
        setUploadTip('读取图片失败', true);
        alert('读取图片失败' + (e && e.message ? '：' + e.message : ''));
      });
    });
    $('adminEditImages').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-img-act]');
      if (!btn) return;
      var item = btn.closest('.admin-img-item');
      if (!item) return;
      var idx = parseInt(item.getAttribute('data-idx'), 10);
      var act = btn.getAttribute('data-img-act');
      if (act === 'left') moveImage(idx, -1);
      if (act === 'right') moveImage(idx, 1);
      if (act === 'remove') removeImage(idx);
    });

    // GitHub sync form
    if ($('ghSaveToken')) {
      $('ghSaveToken').addEventListener('click', function () {
        persistGhFields();
        setSyncStatus('已保存到本机 localStorage（不会提交到仓库）', 'success');
      });
    }
    if ($('ghClearToken')) {
      $('ghClearToken').addEventListener('click', clearGhToken);
    }
    if ($('ghSyncBtn')) {
      $('ghSyncBtn').addEventListener('click', syncToGitHub);
    }
    if ($('ghToken')) {
      $('ghToken').addEventListener('input', updateSyncButtonState);
    }
    ['ghOwner', 'ghRepo', 'ghBranch'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('change', persistGhFields);
        el.addEventListener('blur', persistGhFields);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('adminEditor').classList.contains('hidden')) {
        closeEditor();
        return;
      }
      if (!$('adminPwMask').classList.contains('hidden')) {
        closePasswordGate();
        return;
      }
      if (!$('adminPanel').classList.contains('hidden')) {
        closeAdminPanel();
      }
    });
  }

  function init() {
    App = window.MomentsApp;
    if (!App) {
      console.warn('MomentsApp not ready');
      return;
    }
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
