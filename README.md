# USC

浏览器里的纯文本浏览器，带 Google / Bing / 百度搜索入口。没有后端、没有数据库、没有自建索引：用浏览器打开 `index.html` 即可。

页面被收成可阅读的文本，链接编成 `[1] [2] …`。图片默认只显示占位符 `[img:1]`，由你决定是否加载。

## 打开

直接用浏览器打开仓库里的 `index.html`，或在本目录起一个静态服务：

```bash
python3 -m http.server 8765
```

然后访问 `http://127.0.0.1:8765/`。不需要安装依赖。

## 界面

从上到下四块：

1. **页面**：当前文档（纯文本 + 编号链接；按需出现图片）
2. **状态栏**：URL、标题、链接数、图片数、图片模式
3. **消息**：命令回显、加载进度、错误
4. **提示符** `usc>`：输入命令

提示符为空时，空格 / PageDown / PageUp 滚动当前页。点页面里的 `[n]` 会在本浏览器里打开；Ctrl 或 Cmd 点击则用系统浏览器。

## 快速上手

```
usc> example.com
usc> 1
usc> back
usc> img 1
usc> images on
usc> g hello
usc> help
```

## 命令

### 打开与导航

| 命令 | 作用 |
|---|---|
| `go <url>` / `open <url>` / `visit <url>` | 打开页面 |
| 直接输入 URL（如 `example.com`） | 同上 |
| `<n>` / `open <n>` | 跟随第 n 个链接 |
| `back` / `forward` | 历史后退 / 前进 |
| `reload` | 重新抓取当前页 |
| `stop` | 中止正在进行的抓取 |
| `home` | 回到起始页 |
| `real` | 用系统浏览器打开当前页 |
| `real <n>` | 用系统浏览器打开链接 n |

### 页面视图

| 命令 | 作用 |
|---|---|
| `page` | 回到渲染后的正文 |
| `links` | 列出全部链接 |
| `imgs` / `images` | 列出全部图片及加载状态 |
| `outline` | 只看标题 |
| `source` | 看抓到的原始内容（截断） |
| `find <text>` | 页内查找并高亮 |
| `url` / `where` | 显示当前 URL |
| `title` | 显示当前标题 |
| `history` | 列出本次会话历史 |
| `save` | 把当前页存成 `.txt` |

### 图片

默认 **不加载** 任何图片，只显示 `[img:n 说明]`。

| 命令 | 作用 |
|---|---|
| `images off` | 以后打开的页面也不自动出图（默认） |
| `images on` | 以后打开的页面自动加载图片 |
| `img <n>` | 只加载当前页第 n 张图 |
| `img all` | 加载当前页全部图片 |

`images on/off` 会记在浏览器的 `localStorage` 里，下次打开仍有效。

### 搜索

没有自建索引。查询会交给 Google、Bing、百度。

| 命令 | 作用 |
|---|---|
| `<query>` 或 `all <query>` | 打开三家引擎的搜索枢纽，并列出联想词 |
| `g <query>` / `google <query>` | 在本浏览器打开 Google |
| `b <query>` / `bing <query>` | 在本浏览器打开 Bing |
| `d <query>` / `baidu <query>` | 在本浏览器打开百度 |

搜索页若被目标站拦截，仍会留下可点的 URL 和联想词；再用 `real` 可到系统浏览器里看完整结果。

### 书签

存在本机 `localStorage`，不会上传。

| 命令 | 作用 |
|---|---|
| `bookmark` | 收藏当前页 |
| `bookmarks` | 列出书签 |
| `bookmark <n>` | 打开第 n 条书签 |
| `unbookmark <n>` | 删除第 n 条 |

### 其他

| 命令 | 作用 |
|---|---|
| `help` / `?` | 命令说明 |
| `clear` | 清掉底部消息，页面不动 |

## 它如何工作

1. 先尝试直接 `fetch` 目标页（站点允许跨域时）。
2. 失败则走 [Jina Reader](https://r.jina.ai/)，把 HTML 或 Markdown 拿回来。
3. 去掉导航、脚本等噪音，抽正文，编成编号链接和图片占位符。
4. 只接受 `http` / `https` 地址；`javascript:` 一类会被丢掉。

搜索联想走各引擎的 JSONP 接口，同样不需要自己的服务器。

## 仓库结构

```
index.html    界面
browser.js    抓取、HTML/Markdown 转文本、链接与图片
usc.js        命令、历史、书签、搜索、渲染
usc.test.js   命令解析与渲染的单元测试
```

```bash
node usc.test.js
```

## 限制

- 不是全网搜索引擎，不会爬站、不会建索引。
- 部分站点（尤其是 Google 结果页）会拒绝抓取，这时只能看 URL / 联想词，或用 `real` 打开。
- Jina 有频率限制；同一 URL 在本次会话里会缓存。
- 复杂页面（大量侧栏、引用模板）转成文本后会有噪音。
- 书签和图片偏好只存在当前浏览器，换设备不会带过去。

## 许可

见仓库设置。个人实验项目。
