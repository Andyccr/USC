# USC

[中文](#中文) · [English](#english)

## 中文

USC 是运行在浏览器里的极简纯文本浏览器，也是一个 Google、Bing、百度搜索入口。

它没有后端、数据库或自建索引。网页会被整理成可阅读的文字，链接显示为 `[1] [2]`；图片默认不加载，由用户决定是否显示。

### 启动

直接打开 `index.html`，或者运行：

```bash
python3 -m http.server 8765
```

然后访问 `http://127.0.0.1:8765/`。项目没有第三方依赖。

### 基本使用

底部输入框同时是搜索框和地址栏：

- 输入文字并回车：同时查询 Google、Bing、百度
- 输入网址并回车：在 USC 中读取页面
- 输入链接编号并回车：打开对应链接；没有这个编号时按普通数字搜索
- 输入时：显示联想；`↑` / `↓` 选择，`Tab` 补全，回车搜索

```text
› 量子计算
› example.com
› 1
› back
```

搜索结果页和普通链接都在 USC 内以纯文本打开；需要系统浏览器时用 `real` / `real <n>`。联想词会再次打开站内搜索页。浏览器自身的后退/前进按钮也与 USC 历史同步。

### 常用命令

| 命令 | 作用 |
|---|---|
| `back` / `forward` / `home` | 后退、前进、首页 |
| `help` | 简短帮助 |
| `i 1` / `i all` | 加载一张 / 全部图片 |
| `i on` / `i off` | 以后自动 / 不自动加载图片 |
| `g <词>` / `b <词>` / `d <词>` | 只使用 Google / Bing / 百度 |
| `s <词>` | 强制搜索与命令同名的词，例如 `s back` |
| `real` / `real <n>` | 在系统浏览器中打开当前页 / 链接 n |
| `find <词>` | 页内查找并报告匹配数量 |
| `bookmark` / `bookmarks` | 保存当前页 / 查看书签 |
| `proxy on` / `proxy off` | 允许 / 禁止 Jina 跨域后备读取 |
| `theme dark/light/system` | 切换并记住界面主题 |
| `font +` / `font -` / `font reset` | 调整并记住正文字号 |
| `copy` / `copy <n>` | 复制当前 URL / 链接 n |
| `share` | 调用系统分享；不支持时复制 URL |
| `top` / `bottom` | 跳到页面顶部 / 底部 |

输入 `:` 会打开命令联想，继续输入可筛选，使用方向键和 `Tab` 选择。图片占位符 `[img:n]` 也可以直接点击。输入 `help` 可查看大纲、源码、保存文本等其他操作。

输入框为空时按空格翻页；`Esc` 清空输入并停止加载。`Ctrl/Cmd + L` 或 `Ctrl/Cmd + K` 聚焦输入框，`Alt + ←/→` 后退或前进。正文底部的细线显示阅读进度。

### 跨域与隐私

USC 默认只尝试从本机浏览器直接读取目标网页。许多网站不允许跨域读取，此时 USC 不会自动把 URL 交给第三方。

只有输入 `proxy on` 后，失败的 URL 才可能发送给 [Jina Reader](https://r.jina.ai/)；成功时状态栏显示 `via jina`。输入 `proxy off` 可关闭。代理、书签和图片偏好只保存在当前浏览器的 `localStorage`。

### 实现

```text
index.html    极简界面
browser.js    获取页面、HTML/Markdown 解析、文本排版
usc.js        搜索、命令、历史、书签和交互
usc.test.js   无依赖测试
```

浏览器环境优先使用 `DOMParser` 处理真实 HTML；无法使用时退回内置的小型解析器。脚本、导航栏、表单等内容不会进入正文，`javascript:` 等非 HTTP(S) 链接会被丢弃。

```bash
node usc.test.js
```

### 限制

- USC 是“半搜索引擎”，不会爬取全网或建立搜索索引。
- 部分网站会拒绝直接读取；用户可以选择 Jina 或系统浏览器。
- 页面加载 15 秒后停止；内存缓存最多 20 页、每页最多 2 MB。
- 正文超过约 12 万字符会显示 `[page truncated]`。
- 复杂的交互式网页不会执行其 JavaScript，因此只能看到可提取的正文。

---

## English

USC is a minimal text-mode browser that runs entirely in your browser. It also acts as a search entry point for Google, Bing, and Baidu.

There is no backend, database, or private search index. Pages are reduced to readable text, links become `[1] [2]`, and images stay unloaded until you choose to display them.

### Start

Open `index.html` directly, or run:

```bash
python3 -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`. There are no third-party dependencies.

### Basic use

The bottom input is both a search box and an address bar:

- Enter text: query Google, Bing, and Baidu
- Enter a URL: read the page inside USC
- Enter a link number: follow that link; if the number does not exist, search for it
- While typing: use `↑` / `↓` to select a suggestion, `Tab` to complete, and Enter to search

```text
› quantum computing
› example.com
› 1
› back
```

Search results and ordinary links open as plain text inside USC. Use `real` / `real <n>` when you need the system browser. Suggestion links reopen an in-app search page. Native browser Back and Forward buttons are synchronized with USC history.

### Common commands

| Command | Action |
|---|---|
| `back` / `forward` / `home` | Navigate history or return home |
| `help` | Show concise help |
| `i 1` / `i all` | Load one image / every image |
| `i on` / `i off` | Enable / disable automatic image loading |
| `g <query>` / `b <query>` / `d <query>` | Use Google / Bing / Baidu only |
| `s <query>` | Search a reserved command word, for example `s back` |
| `real` / `real <n>` | Open the current page / link n in the system browser |
| `find <text>` | Find text and report the match count |
| `bookmark` / `bookmarks` | Save the current page / list bookmarks |
| `proxy on` / `proxy off` | Enable / disable the Jina cross-origin fallback |
| `theme dark/light/system` | Switch and remember the color theme |
| `font +` / `font -` / `font reset` | Adjust and remember text size |
| `copy` / `copy <n>` | Copy the current URL / link n |
| `share` | Use system sharing, or copy the URL as a fallback |
| `top` / `bottom` | Jump to the top / bottom |

Type `:` to open command suggestions; keep typing to filter, then use arrow keys and `Tab`. Image placeholders such as `[img:n]` are clickable. Type `help` for outline, source, text export, and other commands.

With an empty prompt, Space scrolls down; `Esc` clears input and stops loading. `Ctrl/Cmd + L` or `Ctrl/Cmd + K` focuses the prompt, and `Alt + ←/→` navigates history. The fine line above the prompt shows reading progress.

### Cross-origin access and privacy

By default, USC only attempts a direct request from your browser. Many sites block cross-origin reads; USC does not silently disclose their URLs to a third party.

Only after `proxy on` may failed URLs be sent to [Jina Reader](https://r.jina.ai/). Successful proxied pages show `via jina` in the status line. Use `proxy off` to disable it. Proxy choice, bookmarks, and image preference stay in this browser's `localStorage`.

### Implementation

```text
index.html    Minimal interface
browser.js    Fetching, HTML/Markdown parsing, text layout
usc.js        Search, commands, history, bookmarks, interaction
usc.test.js   Dependency-free tests
```

In a browser, USC prefers `DOMParser` for robust HTML parsing and falls back to its small built-in tokenizer when needed. Scripts, navigation, and forms are omitted; non-HTTP(S) links such as `javascript:` are rejected.

```bash
node usc.test.js
```

### Limitations

- USC is a “half search engine”; it does not crawl the web or build an index.
- Some sites block direct reads; users can opt into Jina or open them normally.
- Loads stop after 15 seconds; the in-memory cache holds up to 20 pages and 2 MB per page.
- Main content beyond roughly 120,000 characters is marked `[page truncated]`.
- Interactive page JavaScript is not executed, so USC only shows extractable content.
