# moments

类似微信朋友圈的日常生活可分享网页。

纯静态、无需构建：打开即可浏览动态；本地编辑保存在浏览器 `localStorage`。通过管理面板「同步到 GitHub」可将动态写入仓库的 `posts.json`，让 GitHub Pages 访客看到同一份内容。**点赞与评论已从前端 UI 移除**（历史字段可仍存在于数据中，但不展示、不可交互）。

## 功能

- 顶部封面与个人简介（管理面板可改昵称/简介/封面图/头像，同步写入 `profile.json`）
- 朋友圈风格信息流（图文九宫格；点赞/评论 UI 已移除）
- **年月定位**：右侧「年月」入口，按有动态的年份/月份跳转到对应段落（类似微信朋友圈相册时间索引）
- 右下角「发布」：写文字、选假照片色块、填位置
- **本地管理面板**：密码解锁后可新建 / 编辑 / 删除动态，上传真实照片（自动压缩），修改地点与日期
- **同步到 GitHub**：新照片先上传到 `assets/uploads/`，再更新 `posts.json`；封面/头像写入 `assets/cover.*` / `assets/avatar.*` 与 `profile.json`，Pages 访客共享同一 feed 与资料
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
| 数据位置 | 动态使用 `moments_feed_v2`；资料使用 `moments_profile_v1`；同步用 Token 等存 `moments_gh_*`，全部在本浏览器 |
| 备份 | 用「导出 JSON」备份；「导入替换」覆盖本地，「导入合并」按 `id` 合并 |

管理面板上方有 **「封面与资料」**：可改昵称、简介，上传真实封面图与头像（可清除以恢复渐变封面 / 字母头像）。点「保存资料」写入本机；再点「同步」会把图片与 `profile.json` 推到仓库。

管理面板支持：多图上传（压缩后暂以 data URL 写入 localStorage 便于预览）、调整图片顺序、设置 `datetime-local` 发布时间、编辑文字与地点。保存后信息流立即刷新。右下角「发布」FAB 仍可快速发帖；管理面板是更完整的 CRUD 工具。

> 提示：本机编辑阶段图片可以是 data URL；点「同步到 GitHub」后会解码并上传到 `assets/uploads/`，`posts.json` 只保留相对路径。上传会自动缩放到最长边约 1600px、JPEG 质量约 0.82；单张超过约 5MB 会提示。

## 图片存储

- 动态上传目录：`assets/uploads/`（例如 `assets/uploads/20260917-abc123.jpg`）
- 个人封面 / 头像：同步时写入 `assets/cover.jpg`（或 `.png` 等）与 `assets/avatar.jpg`
- `posts.json` 的 `images[]` 只存相对路径（小 SVG 占位图仍可为 data URL）
- `profile.json` 存昵称、简介、`coverUrl` / `avatarUrl`（相对路径或空）、`coverHue`
- 既有示例图 `assets/first-meeting.jpg` 保持不变
- 同步流程：动态 data URL → `assets/uploads/`；资料封面/头像 data URL → `assets/cover.*` / `assets/avatar.*` → PUT 更新 `posts.json` 与 `profile.json`

## 同步到 GitHub（一键）

目标：你在本机管理面板改完动态 → 点「同步到 GitHub」→ 新照片写入 `assets/uploads/`，再更新根目录 `posts.json` → Pages 访客看到相同内容。

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
| 访客（Pages） | `posts.json` + `profile.json` → 写入本机 localStorage 以便离线 | 本机浏览/缓存（发布与管理通过面板同步回仓库） |
| 管理员 | 编辑 localStorage（可含临时 data URL） | 「同步」先 PUT 新图，再 PUT 更新 `posts.json` 与 `profile.json` |

## 技术说明

- 仅 HTML / CSS / JS，无 npm、无框架、无打包
- 发布源：`posts.json`（数组，字段：`id, author, text, images[], location, createdAt`；历史 `likes` / `likedByMe` / `comments` 可存在但 UI 忽略）
- 资料源：`profile.json`（`name, bio, initial, coverUrl, avatarUrl, coverHue`）
- `images[]` 优先为 `assets/uploads/...` 或 `assets/...` 相对路径；同步时会把光栅 data URL 抽成文件
- 示例种子见 `data.js`；交互见 `app.js`；管理 / 同步见 `admin.js`
- 勿把真实 Token 提交进仓库

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 页面结构 |
| `styles.css` | 样式 |
| `app.js` | 交互、本地存储、加载 `posts.json` |
| `admin.js` | 密码门、本地管理 CRUD、同步到 GitHub |
| `data.js` | 示例数据与占位图（fetch 失败时回退） |
| `posts.json` | **共享动态源**（路径引用图片；同步目标 / Pages 读取） |
| `profile.json` | **共享资料源**（昵称/简介/封面/头像路径；同步目标 / Pages 读取） |
| `assets/uploads/` | 管理面板同步上来的动态照片 |
| `assets/cover.*` / `assets/avatar.*` | 同步后的个人封面与头像（若已上传） |
| `assets/first-meeting.jpg` | 示例动态配图 |
| `favicon.svg` | 站点图标 |
