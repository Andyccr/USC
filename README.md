# USC

[中文](#中文) · [English](#english)

## 中文

USC 是运行在浏览器里的**极简纯文本浏览器**，也是 Google、Bing、百度的站内搜索入口。

没有后端、数据库或自建索引。网页被整理成可阅读文字；链接显示为 `[1] [2]`；**图片默认只显示为文本链接** `[img:n]`，由你决定是否加载。

### 启动

推荐用本地 HTTP 打开（不要依赖 `file://`）：

```bash
python3 -m http.server 8765
```

访问 `http://127.0.0.1:8765/`。无第三方依赖。

### 基本使用

底部输入框同时是搜索框和地址栏：

- 输入文字并回车 → 在 **USC 内**汇总搜索结果（标题 / 站点 / 摘要）
- 输入编号或点击结果 → 打开**二级页面正文**（纯文本，仍留在 USC）
- 输入网址并回车 → 读取该页正文
- 图片以 `[img:n …]` 链接展示；点击或 `i n` 才加载

```text
› 量子计算
› 1
› i 1
› back
```

搜索引擎自己的结果页 UI **不会**成为 USC 的页面；需要系统浏览器时用 `real` / `real <n>`。

### 常用命令

| 命令 | 作用 |
|---|---|
| `back` / `forward` / `home` | 后退、前进、首页 |
| `help` | 简短帮助 |
| `i 1` / `i all` | 加载一张 / 全部图片链接 |
| `i on` / `i off` | 以后自动 / 不自动加载图片 |
| `g <词>` / `b <词>` / `d <词>` | 只使用 Google / Bing / 百度 |
| `s <词>` | 强制搜索与命令同名的词，例如 `s back` |
| `real` / `real <n>` | 在系统浏览器中打开当前页 / 链接 n |
| `find <词>` | 页内查找 |
| `bookmark` / `bookmarks` | 保存当前页 / 查看书签 |
| `proxy auto` / `on` / `off` | 自动 / 允许 / 禁止 Jina（默认 `auto`） |
| `theme` / `theme dark` / `light` / `system` | 循环或指定明暗（也可用右下角按钮或 `Alt+T`） |
| `font +` / `-` / `reset` | 字号 |
| `copy` / `copy <n>` | 复制当前 URL / 链接 n |
| `share` | 系统分享，失败则复制 URL |
| `top` / `bottom` | 跳到顶部 / 底部 |

输入 `:` 打开命令联想。空输入时按空格翻页；`Esc` 停止加载。`Ctrl/Cmd + L` 聚焦输入，`Alt + T` 循环主题。

右下角 `dark` / `light` / `auto` 可点：暗色 → 亮色 → 跟随系统。偏好保存在本机。

### 跨域与隐私

默认 `proxy auto`：

1. 先由浏览器**直接**请求目标页  
2. 若 CORS / 网络失败，再经 [Jina Reader](https://r.jina.ai/) 取**可读文本（markdown 优先）**  
3. 状态栏出现 `via jina` 表示走了代理  

站内搜索、以及从搜索结果打开的二级页，为了稳定拿到正文，会优先经 Jina 取 markdown。  
`proxy off` 完全禁止代理；`proxy on` 始终允许。偏好存在 `localStorage`。

---

### 架构

#### 文件职责

```text
index.html     纯文本 UI、明暗主题、手机适配
favicon.svg    图标
manifest.json  可安装为应用
browser.js     取页、CORS/Jina、HTML/Markdown → 文档模型、纯文本导出
usc.js         命令解析、搜索流水线、历史/书签、主题、渲染与交互
usc.test.js    无依赖单元测试
```

#### 总览

```mermaid
flowchart TB
  subgraph UI["界面 index.html"]
    PAGE["#page 正文"]
    CHROME["#chrome 状态 / 提示 / 输入"]
  end

  subgraph APP["usc.js"]
    PARSE["parseLine 命令解析"]
    SEARCH["站内搜索流水线"]
    NAV["go / 历史栈 / History API"]
    PAINT["paint 纯文本渲染"]
  end

  subgraph CORE["browser.js"]
    FETCH["fetchPage"]
    DIRECT["fetchDirect"]
    JINA["fetchJina markdown→html"]
    DOC["parseFetched → tokens/links/images"]
  end

  CHROME -->|Enter| PARSE
  PARSE -->|search| SEARCH
  PARSE -->|go / follow| NAV
  SEARCH -->|结果页文档| PAINT
  NAV --> FETCH
  FETCH --> DIRECT
  DIRECT -->|失败且允许代理| JINA
  DIRECT --> DOC
  JINA --> DOC
  DOC --> PAINT
  PAINT --> PAGE
```

#### 搜索 → 二级正文（核心路径）

```mermaid
sequenceDiagram
  actor U as 用户
  participant USC as usc.js
  participant BR as browser.js
  participant E as Google/Bing/百度/DDG
  participant J as r.jina.ai

  U->>USC: 输入查询并回车
  USC->>USC: 立即展示 searching… 页
  par 并行抓 SERP
    USC->>BR: forceProxy + markdown
    BR->>J: 引擎搜索 URL
    J->>E: 读取结果页
    E-->>J: HTML
    J-->>BR: Markdown
    BR-->>USC: SERP 文本
  end
  USC->>USC: extractSearchResults<br/>去图标/缩略图/噪声<br/>unwrap 跳转 → 真实 URL
  USC->>USC: 渐进渲染 [1][2]… 结果列表
  U->>USC: 点击 [1] 或输入 1
  USC->>BR: fetchPage(真实 URL, markdown 优先)
  BR->>J: 二级页面
  J-->>BR: 正文 Markdown/HTML
  BR->>BR: parseFetched → 文档模型
  USC->>USC: paint：链接 [n]、图片 [img:n] 链接
  USC-->>U: 纯文本二级页（仍在本站）
```

#### 单页读取（地址栏 URL）

```mermaid
flowchart LR
  A["输入 URL"] --> B{"proxy 模式"}
  B -->|off| C["仅 direct"]
  B -->|auto / on| D["direct"]
  D -->|成功| E["parseFetched"]
  D -->|CORS/失败| F["Jina markdown"]
  F -->|失败| G["Jina html"]
  C -->|失败| H["错误页 + 提示"]
  E --> I["paint 纯文本"]
  F --> I
  G --> I
```

#### 文档模型与渲染

```text
Fetched text
    │
    ├─ HTML  → DOMParser（或小型 tokenizer）
    └─ Markdown → markdownToDocument
            │
            ▼
     Document {
       title, url, via,
       tokens: text | nl | link{n,url} | img{n,url,alt,loaded},
       links[], images[]
     }
            │
            ▼
     paint():
       link  → [n] 标题     （data-url，点击站内打开）
       img   → [img:n alt] （文本链接；点击或 i n 才加载 <img>）
```

#### 模块边界

| 层 | 负责 | 不负责 |
|---|---|---|
| `index.html` | 布局、主题变量、手机安全区/键盘 | 业务逻辑 |
| `browser.js` | HTTP(S) 安全、取页、解析、纯文本 | 命令、历史、搜索策略 |
| `usc.js` | 命令、搜索抽取/去噪、历史、书签、渲染交互 | 原始 HTML 解析细节 |

```bash
node usc.test.js
```

### 限制

- 半搜索引擎：不建索引、不执行目标站 JavaScript。  
- 依赖浏览器网络；Jina 不可用时部分站点读不到。  
- 加载超时 15s；缓存最多 20 页、每页 2MB；正文约 12 万字符后截断。

---

## English

USC is a **minimal plain-text browser** that runs entirely in your browser, plus an in-app entry point for Google, Bing, and Baidu.

There is no backend or private index. Pages become readable text; links are `[1] [2]`; **images are text links** `[img:n]` until you choose to load them.

### Start

Prefer a local HTTP server (avoid `file://`):

```bash
python3 -m http.server 8765
```

Visit `http://127.0.0.1:8765/`. No third-party dependencies.

### Basic use

The bottom field is both search box and address bar:

- Type text → in-app result list (title / host / snippet)  
- Type a number or click a result → open the **secondary page as text** inside USC  
- Type a URL → read that page as text  
- Images stay `[img:n …]` links until click / `i n`

Type `:` to open command suggestions. With an empty prompt, Space scrolls; `Esc` stops loading. `Ctrl/Cmd + L` focuses the prompt, `Alt + T` cycles the theme.

The `dark` / `light` / `auto` control at the bottom right cycles appearance. The choice is stored in this browser.

### Common commands

| Command | Action |
|---|---|
| `back` / `forward` / `home` | History / home |
| `help` | Short help |
| `i 1` / `i all` | Load one / all image links |
| `i on` / `i off` | Always / never auto-load images |
| `g` / `b` / `d` | Google / Bing / Baidu only |
| `s <query>` | Search a reserved word |
| `real` / `real <n>` | Open outside |
| `find` / `bookmark(s)` / `proxy auto\|on\|off` | Find / bookmarks / proxy |
| `theme` / `theme dark` / `light` / `system` | Cycle or set appearance (also the bottom-right control or `Alt+T`) |

### Cross-origin and privacy

Default `proxy auto`: try a direct fetch, then [Jina Reader](https://r.jina.ai/) (markdown first) when blocked. In-app search and secondary pages from search prefer Jina markdown for stable article text. `proxy off` disables the proxy; `proxy on` always allows it.

---

### Architecture

#### Files

```text
index.html     Text UI, light/dark theme, mobile chrome
favicon.svg    Icon
manifest.json  Installable app shell
browser.js     Fetch, Jina, HTML/Markdown → document model
usc.js         Commands, search pipeline, history, theme, paint
usc.test.js    Dependency-free tests
```

#### Overview

```mermaid
flowchart TB
  subgraph UI["index.html"]
    PAGE["#page"]
    CHROME["prompt / status"]
  end

  subgraph APP["usc.js"]
    PARSE["parseLine"]
    SEARCH["search pipeline"]
    NAV["go + history"]
    PAINT["paint"]
  end

  subgraph CORE["browser.js"]
    FETCH["fetchPage"]
    DIRECT["direct"]
    JINA["Jina markdown→html"]
    DOC["parseFetched"]
  end

  CHROME --> PARSE
  PARSE -->|search| SEARCH
  PARSE -->|follow| NAV
  SEARCH --> PAINT
  NAV --> FETCH
  FETCH --> DIRECT
  DIRECT -->|fail + proxy| JINA
  DIRECT --> DOC
  JINA --> DOC
  DOC --> PAINT
  PAINT --> PAGE
```

#### Search → secondary article text

```mermaid
sequenceDiagram
  actor U as User
  participant USC as usc.js
  participant BR as browser.js
  participant J as r.jina.ai

  U->>USC: query
  USC->>BR: SERP via Jina markdown
  BR->>J: engine search URL
  J-->>USC: markdown
  USC->>USC: extract results (drop thumbs/icons)<br/>unwrap redirects
  USC-->>U: [1][2] text list
  U->>USC: open [1]
  USC->>BR: article URL, markdown preferred
  BR->>J: secondary page
  J-->>USC: article text
  USC-->>U: plain-text page; images as [img:n] links
```

#### Document model

```text
tokens: text | nl | link | img(loaded flag)
paint:  [n] title     → in-app navigation
        [img:n alt]   → text link until user loads it
```

```bash
node usc.test.js
```

### Limitations

- Half search engine: no crawl/index; target-page JS is not executed.  
- Needs network; if Jina is unreachable some sites cannot be read.  
- 15s load timeout; 20 cached pages; ~120k character truncation.
