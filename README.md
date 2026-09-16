# moments

类似微信朋友圈的日常生活可分享网页。

纯静态、无需构建：打开即可浏览示例动态，点赞、评论、发布都会保存在浏览器 `localStorage` 中。

## 功能

- 顶部封面与个人简介
- 朋友圈风格信息流（图文九宫格、点赞、评论）
- 右下角「发布」：写文字、选假照片色块、填位置
- 数据本地持久化；可清空或恢复示例
- 手机优先，桌面居中约手机宽度

## 本地打开

直接双击或用浏览器打开仓库根目录的 `index.html`：

```bash
# 可选：用本地静态服务器
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

也可用 VS Code / Cursor 的 Live Preview 等插件预览。

## GitHub Pages

本仓库为静态站点，可将 **Pages** 源设为 `main` 分支根目录，即可通过

`https://jadyzdd.github.io/moments/`

访问（需在仓库 Settings → Pages 中开启；开启后首页即为 `index.html`）。

## 技术说明

- 仅 HTML / CSS / JS，无 npm、无框架、无打包
- 图片为 SVG data-URI 占位图，离线也可正常展示
- 演示数据见 `data.js`，交互逻辑见 `app.js`

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 页面结构 |
| `styles.css` | 样式 |
| `app.js` | 交互与本地存储 |
| `data.js` | 示例数据与占位图 |
| `favicon.svg` | 站点图标 |
