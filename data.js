/**
 * 朋友圈示例数据与 SVG 占位图工具
 */
(function (global) {
  'use strict';

  /** 生成纯色/渐变 SVG data-URI 占位图 */
  function svgPlaceholder(opts) {
    const {
      w = 400,
      h = 400,
      c1 = '#07c160',
      c2 = null,
      label = '',
      emoji = '',
    } = opts || {};
    const gradId = 'g' + Math.abs(hashCode(c1 + (c2 || '') + label)).toString(36);
    let fill;
    if (c2) {
      fill = `url(#${gradId})`;
    } else {
      fill = c1;
    }
    const defs = c2
      ? `<defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient></defs>`
      : '';
    const text =
      emoji || label
        ? `<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
            font-family="system-ui,sans-serif" font-size="${emoji ? Math.min(w, h) * 0.28 : 28}"
            fill="rgba(255,255,255,0.92)">${escapeXml(emoji || label)}</text>`
        : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${defs}<rect width="100%" height="100%" fill="${fill}"/>${text}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 头像色盘 */
  const AVATAR_COLORS = [
    ['#07c160', '#10a37f'],
    ['#576b95', '#3d5a80'],
    ['#fa9d3b', '#e67e22'],
    ['#e64340', '#c0392b'],
    ['#10aeff', '#0984e3'],
    ['#9b59b6', '#8e44ad'],
    ['#00b894', '#00a884'],
    ['#fd79a8', '#e84393'],
  ];

  function avatarStyle(name) {
    const i = Math.abs(hashCode(name || '?')) % AVATAR_COLORS.length;
    const [c1, c2] = AVATAR_COLORS[i];
    return `background:linear-gradient(145deg,${c1},${c2})`;
  }

  function avatarInitial(name) {
    if (!name) return '?';
    return name.slice(0, 1);
  }

  /** 预设假照片色块（发布用） */
  const PHOTO_PRESETS = [
    { id: 'p1', c1: '#ff9a9e', c2: '#fecfef', emoji: '🌸' },
    { id: 'p2', c1: '#a18cd1', c2: '#fbc2eb', emoji: '🌆' },
    { id: 'p3', c1: '#fad0c4', c2: '#ffd1ff', emoji: '☕' },
    { id: 'p4', c1: '#ffecd2', c2: '#fcb69f', emoji: '🍜' },
    { id: 'p5', c1: '#84fab0', c2: '#8fd3f4', emoji: '🏞' },
    { id: 'p6', c1: '#a6c1ee', c2: '#fbc2eb', emoji: '🐱' },
    { id: 'p7', c1: '#667eea', c2: '#764ba2', emoji: '📚' },
    { id: 'p8', c1: '#f093fb', c2: '#f5576c', emoji: '🎉' },
    { id: 'p9', c1: '#4facfe', c2: '#00f2fe', emoji: '✈️' },
  ];

  function photoSrc(preset) {
    return svgPlaceholder({
      w: 400,
      h: 400,
      c1: preset.c1,
      c2: preset.c2,
      emoji: preset.emoji,
    });
  }

  const ME = {
    id: 'me',
    name: '小明',
    bio: '记录生活的点滴 · 今天也要开心呀',
    initial: '明',
  };

  /** 示例动态（相对时间戳，加载时换算） */
  const SEED_POSTS = [
    {
      id: 'seed-first-meeting',
      author: { name: '小明', initial: '明' },
      text: '第一次见面\n2013年7月30号 我的阳历生日\n特别的日子遇见你即是缘分的开始\n看看小伙伴们开心的表情\n86路的剧情由我们书写',
      images: ['assets/first-meeting.jpg'],
      location: '大学城 · 86路车站',
      likes: ['阿花', '阿杰', '喵呜酱', '小雨'],
      likedByMe: false,
      comments: [],
      minutesAgo: 5,
    },
    {
      id: 'seed-1',
      author: { name: '阿花', initial: '花' },
      text: '周末终于把欠了很久的书看完了📖\n《人间草木》里那句「一花一世界」又读哭了。\n雨天配茶，刚刚好。',
      images: [
        svgPlaceholder({ c1: '#667eea', c2: '#764ba2', emoji: '📚' }),
        svgPlaceholder({ c1: '#fad0c4', c2: '#ffd1ff', emoji: '☕' }),
      ],
      location: '杭州 · 西湖边小馆',
      likes: ['小明', '阿东', '小雨'],
      likedByMe: true,
      comments: [
        { id: 'c1', name: '小明', text: '借我看看！' },
        { id: 'c2', name: '阿花', text: '好呀，下周带给你～' },
      ],
      minutesAgo: 35,
    },
    {
      id: 'seed-2',
      author: { name: '阿杰', initial: '杰' },
      text: '今天公司团建去了郊外徒步，腿都不是自己的了😅 但是风景真的绝！',
      images: [
        svgPlaceholder({ c1: '#84fab0', c2: '#8fd3f4', emoji: '🏞' }),
        svgPlaceholder({ c1: '#43e97b', c2: '#38f9d7', emoji: '🌲' }),
        svgPlaceholder({ c1: '#fa709a', c2: '#fee140', emoji: '☀️' }),
        svgPlaceholder({ c1: '#30cfd0', c2: '#330867', emoji: '🥾' }),
      ],
      location: '莫干山',
      likes: ['阿花', '老王', '小明', 'Cathy'],
      likedByMe: false,
      comments: [{ id: 'c3', name: '老王', text: '下次喊上我啊！' }],
      minutesAgo: 120,
    },
    {
      id: 'seed-3',
      author: { name: '喵呜酱', initial: '喵' },
      text: '我家主子又在窗台晒太阳了，摆出一副「朕很忙」的表情🐈',
      images: [svgPlaceholder({ c1: '#a6c1ee', c2: '#fbc2eb', emoji: '🐱' })],
      location: '家里窗台',
      likes: ['小明', '阿花'],
      likedByMe: true,
      comments: [
        { id: 'c4', name: '阿花', text: '好可爱！！求多图' },
        { id: 'c5', name: '喵呜酱', text: '明天再拍一张哈' },
      ],
      minutesAgo: 280,
    },
    {
      id: 'seed-4',
      author: { name: '小雨', initial: '雨' },
      text: '加班到现在……外卖已经点了第三顿。\n同事说：年轻人不要太拼。我说：房租不会自己付啊。',
      images: [],
      location: '上海 · 陆家嘴',
      likes: ['阿杰', '老王'],
      likedByMe: false,
      comments: [{ id: 'c6', name: '阿杰', text: '心疼，记得早点休息' }],
      minutesAgo: 420,
    },
    {
      id: 'seed-5',
      author: { name: 'Cathy', initial: 'C' },
      text: '第一次自己做麻辣香锅成功🎉 辣得够味，洗碗也够呛～',
      images: [
        svgPlaceholder({ c1: '#ffecd2', c2: '#fcb69f', emoji: '🍜' }),
        svgPlaceholder({ c1: '#f093fb', c2: '#f5576c', emoji: '🌶️' }),
        svgPlaceholder({ c1: '#fad0c4', c2: '#ff9a9e', emoji: '🥘' }),
      ],
      location: '家里厨房',
      likes: ['小明', '喵呜酱', '阿花', '阿杰', '小雨'],
      likedByMe: true,
      comments: [
        { id: 'c7', name: '小明', text: '下次我来蹭饭！' },
        { id: 'c8', name: 'Cathy', text: '欢迎欢迎，多带双筷子' },
      ],
      minutesAgo: 800,
    },
    {
      id: 'seed-6',
      author: { name: '老王', initial: '王' },
      text: '出差落地成都，第一件事：火锅。没有什么是一顿火锅解决不了的，如果有，就两顿。',
      images: [
        svgPlaceholder({ c1: '#e64340', c2: '#fa9d3b', emoji: '🍲' }),
        svgPlaceholder({ c1: '#fd79a8', c2: '#e84393', emoji: '🌶️' }),
      ],
      location: '成都 · 宽窄巷子附近',
      likes: ['阿杰'],
      likedByMe: false,
      comments: [],
      minutesAgo: 1440,
    },
    {
      id: 'seed-7',
      author: { name: '阿东', initial: '东' },
      text: '清晨跑完 5 公里，整个人都清醒了。坚持打卡第 30 天✅',
      images: [],
      location: '滨江跑道',
      likes: ['小明', '阿杰', 'Cathy'],
      likedByMe: true,
      comments: [{ id: 'c9', name: '阿杰', text: '厉害了东哥，向你看齐' }],
      minutesAgo: 1800,
    },
    {
      id: 'seed-8',
      author: { name: '小明', initial: '明' },
      text: '试用了一下这个「朋友圈」网页，居然可以离线收藏心情～\n大家随便点赞评论玩玩吧 💚',
      images: [
        svgPlaceholder({ c1: '#07c160', c2: '#10a37f', emoji: '💚' }),
        svgPlaceholder({ c1: '#4facfe', c2: '#00f2fe', emoji: '📱' }),
        svgPlaceholder({ c1: '#a18cd1', c2: '#fbc2eb', emoji: '✨' }),
        svgPlaceholder({ c1: '#ff9a9e', c2: '#fecfef', emoji: '🌈' }),
        svgPlaceholder({ c1: '#84fab0', c2: '#8fd3f4', emoji: '🍃' }),
      ],
      location: '家里书桌',
      likes: ['阿花', '阿杰', '喵呜酱', '小雨', 'Cathy', '老王', '阿东'],
      likedByMe: false,
      comments: [
        { id: 'c10', name: '阿花', text: '界面好熟悉哈哈哈' },
        { id: 'c11', name: '阿杰', text: '可以当个人日记本了' },
      ],
      minutesAgo: 60,
    },
  ];

  function buildSeedPosts(now) {
    const t = now || Date.now();
    return SEED_POSTS.map(function (p) {
      return {
        id: p.id,
        author: Object.assign({}, p.author),
        text: p.text,
        images: p.images.slice(),
        location: p.location || '',
        likes: p.likes.slice(),
        likedByMe: !!p.likedByMe,
        comments: p.comments.map(function (c) {
          return Object.assign({}, c);
        }),
        createdAt: t - p.minutesAgo * 60 * 1000,
      };
    }).sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });
  }

  global.MomentsData = {
    ME: ME,
    PHOTO_PRESETS: PHOTO_PRESETS,
    svgPlaceholder: svgPlaceholder,
    photoSrc: photoSrc,
    avatarStyle: avatarStyle,
    avatarInitial: avatarInitial,
    buildSeedPosts: buildSeedPosts,
  };
})(typeof window !== 'undefined' ? window : globalThis);
