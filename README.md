# moments

类似微信朋友圈的日常生活可分享网页。

纯静态、无需构建：打开即可浏览动态；点赞、评论、本地编辑保存在浏览器 `localStorage`。通过管理面板「同步到 GitHub」可将动态写入仓库的 `posts.json`，让 GitHub Pages 访客看到同一份内容。

## 功能

- 顶部封面与个人简介
- 朋友圈风格信息流（图文九宫格、点赞、评论）
- **年月定位**：右侧「年月」入口，按有动态的年份/月份跳转到对应段落（类似微信朋友圈相册时间索引）
- 右下角「发布」：写文字、选假照片色块、填位置
- **本地管理面板**：密码解锁后可新建 / 编辑 / 删除动态，上传真实照片（自动压缩），修改地点与日期
- **同步到 GitHub**：将本地动态推送到仓库 `posts.json`，Pages 访客共享同一 feed
- 导出 / 导入 JSON 备份
- 数据本地持久化；可清空或恢复示例
- 手机优先，桌面居中约手机宽度

## 年月定位

信息流右侧有半透明 **「年月」** 按钮。点开后列出当前动态中出现过的年份（新→旧）；展开某年后只显示有内容的月份。点选月份会关闭面板并平滑滚动到该月第一条动态（带「2024年7月」式粘性分组标题）。若目标月无动态，会提示「该月暂无动态」。索引随 `posts.json` / localStorage 刷新后自动重算。

## 本地打开

直接双击或用浏览器打开仓库根目录的 `index.html`：

```bash
# 推荐：用本地静态服务器（才能 fetch posts.json）
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

也可用 VS Code / Cursor 的 Live Preview 等插件预览。注意：用 `file://` 打开时，`fetch('posts.json')` 可能因浏览器安全策略失败，此时会回退到 localStorage / 示例数据。

## GitHub Pages

本仓库为静态站点，可将 **Pages** 源设为 `main` 分支根目录，即可通过

`https://jadyzdd.github.io/moments/`

访问（需在仓库 Settings → Pages 中开启；开启后首页即为 `index.html`）。

访客打开站点时，前端会请求 `posts.json`（带缓存破坏参数）。同步成功后，Pages 通常约 **1 分钟** 内更新。

## 管理面板（本地）

页脚有隐蔽入口 **「管理」**。点击后输入密码即可进入。

| 项 | 说明 |
|----|------|
| 默认密码 | `moments` |
| 会话 | 解锁状态存在 `sessionStorage`，同一标签页刷新仍保持解锁，关闭标签后需重新输入 |
| 改密码 | 管理面板内「改密码」；明文保存在 `localStorage` 键 `moments_admin_pw_v1`（演示级门禁，**不是**真正安全） |
| 数据位置 | 动态使用 `moments_feed_v2`；同步用 Token 等存 `moments_gh_*`，全部在本浏览器 |
| 备份 | 用「导出 JSON」备份；「导入替换」覆盖本地，「导入合并」按 `id` 合并 |

管理面板支持：多图上传（压缩后以 data URL 写入 localStorage）、调整图片顺序、设置 `datetime-local` 发布时间、编辑文字与地点。保存后信息流立即刷新。右下角「发布」FAB 仍可快速发帖；管理面板是更完整的 CRUD 工具。

> 提示：图片以 data URL 存本地 / 同步到 `posts.json` 时体积可能很大；上传会自动缩放到最长边约 1600px、JPEG 质量约 0.82。若同步提示过大，请减少大图或改用 `assets/` 相对路径。

## 同步到 GitHub（一键）

目标：你在本机管理面板改完动态 → 点「同步到 GitHub」→ 仓库根目录 `posts.json` 更新 → Pages 访客看到相同内容。

### 1. 创建 Token（仅一次）

1. 打开 [GitHub Token 设置](https://github.com/settings/tokens)
2. **推荐 Fine-grained PAT**：只选仓库 `jadyzdd/moments`，权限 **Contents: Read and write**
3. 或 Classic Token：勾选 **`repo`** 范围
4. 生成后复制 Token（只显示一次）

### 2. 在管理面板填写并保存

1. 打开站点 → 页脚「管理」→ 输入密码
2. 在「同步到 GitHub」区域粘贴 Token，确认 Owner=`jadyzdd`、Repo=`moments`、Branch=`main`
3. 点 **保存设置**（写入本机 `localStorage`：`moments_gh_token` 等；**不会**提交进 Git）
4. 点 **同步到 GitHub**

成功后会显示提交链接与上次同步时间；Pages 约 1 分钟后生效。Token 等同写权限，请仅保存在可信本机，可用「清除 Token」随时删除。

### 3. 数据流说明

| 角色 | 读什么 | 写什么 |
|------|--------|--------|
| 访客（Pages） | `posts.json` → 写入本机 localStorage 以便离线 | 仅本机点赞/评论（不同步回仓库，除非你再点同步） |
| 管理员 | 编辑 localStorage | 「同步到 GitHub」PUT 更新 `posts.json` |

## 技术说明

- 仅 HTML / CSS / JS，无 npm、无框架、无打包
- 发布源：`posts.json`（数组，字段：`id, author, text, images[], location, likes, likedByMe, comments, createdAt`）
- 示例种子见 `data.js`；交互见 `app.js`；管理 / 同步见 `admin.js`
- `assets/*.jpg` 等相对路径可继续用在 `images` 中；勿把真实 Token 提交进仓库

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 页面结构 |
| `styles.css` | 样式 |
| `app.js` | 交互、本地存储、加载 `posts.json` |
| `admin.js` | 密码门、本地管理 CRUD、同步到 GitHub |
| `data.js` | 示例数据与占位图（fetch 失败时回退） |
| `posts.json` | **共享动态源**（同步目标 / Pages 读取） |
| `favicon.svg` | 站点图标 |
