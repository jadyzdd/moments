# moments

类似微信朋友圈的日常生活可分享网页。

纯静态、无需构建：打开即可浏览示例动态，点赞、评论、发布都会保存在浏览器 `localStorage` 中。

## 功能

- 顶部封面与个人简介
- 朋友圈风格信息流（图文九宫格、点赞、评论）
- 右下角「发布」：写文字、选假照片色块、填位置
- **本地管理面板**：密码解锁后可新建 / 编辑 / 删除动态，上传真实照片，修改地点与日期
- 导出 / 导入 JSON 备份（数据仅存本机，换设备或清缓存会丢失）
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

## 管理面板（本地）

页脚有隐蔽入口 **「管理」**。点击后输入密码即可进入。

| 项 | 说明 |
|----|------|
| 默认密码 | `moments` |
| 会话 | 解锁状态存在 `sessionStorage`，同一标签页刷新仍保持解锁，关闭标签后需重新输入 |
| 改密码 | 管理面板内「改密码」；明文保存在 `localStorage` 键 `moments_admin_pw_v1`（演示级门禁，**不是**真正安全） |
| 数据位置 | 动态仍使用 `moments_feed_v2`，全部在本浏览器，**无服务器、无共享数据库** |
| 备份 | 用「导出 JSON」备份；「导入替换」覆盖本地，「导入合并」按 `id` 合并 |

管理面板支持：多图上传（FileReader → data URL 写入 localStorage）、调整图片顺序、设置 `datetime-local` 发布时间、编辑文字与地点。保存后信息流立即刷新。右下角「发布」FAB 仍可快速发帖；管理面板是更完整的 CRUD 工具。

> 提示：图片以 data URL 存本地，体积大时可能触及浏览器配额；请定期导出 JSON。

## 技术说明

- 仅 HTML / CSS / JS，无 npm、无框架、无打包
- 示例图为 SVG data-URI 占位图；管理面板可上传真实照片（亦存为 data URL）
- 演示数据见 `data.js`，交互逻辑见 `app.js`，管理面板见 `admin.js`

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 页面结构 |
| `styles.css` | 样式 |
| `app.js` | 交互与本地存储 |
| `admin.js` | 密码门与本地管理 CRUD |
| `data.js` | 示例数据与占位图 |
| `favicon.svg` | 站点图标 |
