# dsh-plugin-global-search

DeepSeek Harness 的**全局会话搜索**插件：在左侧栏增加一个搜索入口，按 **⌘⇧F** 以
**macOS 聚焦（Spotlight）式浮层**直接弹出搜索框，输入文字即可跨 **所有会话** 检索消息内容；
在结果上按 **回车** 会打开对应会话，自动加载历史并**定位到命中位置、用 `#F78A30` 高亮匹配文字**，
同时浮出「上一个 / 下一个 / ×」胶囊便于在本次会话内跳转。

面向 **macOS Desktop（Electron）** 设计。

## 功能

- **左侧栏入口**：左侧导航多一行「全局搜索」（放大镜图标），与 Plugins / 自动化任务同级；点开是停靠式全页搜索。
- **Spotlight 浮层**：`⌘⇧F`（macOS）在界面中央偏下弹出带背景遮罩的圆角搜索框，并自动聚焦；每次唤起都会清空输入框内容，再按一次关闭。
- **跨会话全文检索**：字面、大小写不敏感的子串匹配，中文 1~2 个字也能命中；
  结果按命中次数、消息时间、会话创建时间排序，每个会话给出 240 字上下文片段。
- **回车跳转 + 定位 + 高亮**：`↑↓` 选择结果，`↵` 打开会话；插件会翻历史直到命中出现，
  第一个命中优先滚动到**视口中间**，无法居中时（如命中位于会话最开头）对齐到**顶部**；
  并用 CSS Custom Highlight API 以 `#F78A30` 高亮，命中行闪一次描边。
- 全局结果跳转后，右上角会打开与 `⌘F` **完全相同**的对话内查找条（预填关键词 + `n/m` + ↑↓ + ×），`↵` 直接跳到下一个命中；`Esc` 或 `×` 关闭并清除高亮。
- **对话内查找（⌘F）**：打开某个会话后按 `⌘F`，在对话**右上角**浮出查找条，边输入边在当前对话内匹配并高亮；
  `↵` 下一个、`⇧↵` 上一个、`Esc` 关闭，高亮颜色与全局搜索一致（`#F78A30`）。

## 组成

| 半边 | 文件 | 作用 |
|---|---|---|
| Host | `index.js` | 包装 `ctx.sessionQuery.searchSessions`，用内存字面子串扫描替换 FTS5（中文友好）。其余能力（精确读取、标题、trace、filter）保持不变。 |
| Browser | `lib/client.js` | 注册左侧栏 `sidebar.panellist` + `main` 面板、`shell.overlay` Spotlight 浮层、`⌘⇧F` / `⌘F` 快捷键、搜索 UI 与跳转高亮逻辑。 |
| Bundle | `cordis.patch.yml` | `dsh.bundle.patch` 插入 Host 行。 |

`package.json` 中 `dsh.client.inject` + `exports["./client"]` 让 Web 组合把 `lib/client.js`
送进浏览器 boot graph。

## 安装到 Desktop profile

这是一个「Host 半边 + 浏览器半边」的单包插件，安装只需要把包加入 profile 的 dependencies 与
`dsh.profile.bundles`，不需要单独编译。下面几种方式任选其一。

### 方式 A：发布到 npm 后安装（推荐给其他人用）

维护者发布一次：

```sh
cd dsh-plugin-global-search
npm publish --access public        # 需要 npm 账号；包名 dsh-plugin-global-search
```

其他人安装：

```sh
dsh plugin --profile desktop add dsh-plugin-global-search
```

### 方式 B：直接分享打包好的 tgz

仓库内已生成 `dsh-plugin-global-search-1.0.0.tgz`。发给对方后：

```sh
dsh plugin --profile desktop add ./dsh-plugin-global-search-1.0.0.tgz
```

### 方式 C：从 Git 仓库安装

```sh
dsh plugin --profile desktop add git+https://github.com/<you>/dsh-plugin-global-search.git
```

### 方式 D：本地开发用 link

```sh
dsh plugin --profile desktop add link:/absolute/path/to/dsh-plugin-global-search
```

> 以上命令都会把包写入 `~/.dsh/profiles/desktop`，并把 `dsh-plugin-global-search` 追加到
> `dsh.profile.bundles`。首次安装需要让 Web 组合重新扫描 `dsh.client` 声明；若当前页面没有
> 立即出现入口，**重启一次 App** 即可。之后修改 `lib/client.js` 由 `dsh-client-hmr` 热替换。
> 也可以在 Desktop 的 **Plugins** 页面确认该 bundle 已启用。

### 发布前检查

```sh
npm pack --dry-run     # 确认打包内容（index.js / lib/client.js / cordis.patch.yml / icon / locale）
```

- `package.json` 的 `engines.dsh` 限定兼容的 DSH 版本（当前 `>=0.2.1-rc.2 <0.3.0`），对方版本不符时需调整。
- 该包为纯 JS，无构建产物依赖；`files` 已白名单包含运行必需文件。

## 关闭 / 卸载

```sh
dsh plugin --profile desktop remove dsh-plugin-global-search
```

或在 Plugins 页面关闭该 bundle。

## 已知限制

- 只索引当前 surface 的 `user/message` 与 `assistant/message`，与侧边栏搜索范围一致；
  tool 调用/结果不参与。
- 内存缓存：App 重启后需要重新预热（启动约 2 秒后后台进行），首次搜索也会按需建缓存。
- 只做大小写不敏感的字面子串匹配，不支持正则/分词；空格分隔的多词为 AND 语义。
- 跳转定位到「该会话内第一个命中」；命中导航可继续用「上一个 / 下一个」浏览其余命中。
- 搜索输入框有意不绘制焦点描边/外发光，只由外层查找条的中性边框提示聚焦，避免与主题（如
  `@nonamelego/dsh-catppuccin` 的玻璃皮肤全局 `:focus-visible` 规则）产生冲突的彩色边框。
