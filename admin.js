/**
 * 朋友圈本地管理面板（密码门 + CRUD + 导入导出）
 * 依赖 window.MomentsApp（由 app.js 暴露）
 */
(function () {
  'use strict';

  var PW_KEY = 'moments_admin_pw_v1';
  var SESSION_KEY = 'moments_admin_unlocked';
  var DEFAULT_PW = 'moments';

  var App = null;
  var editImages = []; // data URLs currently in editor
  var editingId = null; // null = new post

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
      box.innerHTML = '<p class="admin-img-hint">尚未添加图片（最多 9 张）</p>';
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

  function readFilesAsDataURLs(fileList) {
    var files = Array.prototype.slice.call(fileList || [], 0);
    var room = 9 - editImages.length;
    if (room <= 0) {
      alert('最多 9 张图片');
      return Promise.resolve();
    }
    files = files.slice(0, room);
    var readers = files.map(function (file) {
      return new Promise(function (resolve, reject) {
        if (!file.type || file.type.indexOf('image/') !== 0) {
          resolve(null);
          return;
        }
        var fr = new FileReader();
        fr.onload = function () {
          resolve(fr.result);
        };
        fr.onerror = function () {
          reject(fr.error);
        };
        fr.readAsDataURL(file);
      });
    });
    return Promise.all(readers).then(function (urls) {
      urls.forEach(function (u) {
        if (u && editImages.length < 9) editImages.push(u);
      });
      renderEditorImages();
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
      // re-sort by createdAt after date change
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
    $('adminEditAddImg').addEventListener('click', function () {
      $('adminEditFiles').click();
    });
    $('adminEditFiles').addEventListener('change', function () {
      var files = this.files;
      this.value = '';
      readFilesAsDataURLs(files).catch(function () {
        alert('读取图片失败');
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
