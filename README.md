# USC

浏览器里的纯文本浏览器。无服务器：页面通过直连或 Jina 拉取，再渲染成可跟的编号链接。图片默认不加载，按你的选择再显示。

用浏览器打开 `index.html`。

```
usc> example.com
usc> 1
usc> img 1
usc> images on
usc> g hello
usc> help
```

提示符为空时，空格 / PageDown / PageUp 滚动当前页。点页面里的 `[n]` 会在本浏览器里打开；Ctrl/Cmd 点击则用系统浏览器。

| 命令 | 作用 |
|---|---|
| `go <url>` 或直接输入 URL | 打开页面 |
| `<n>` / `open <n>` | 跟随第 n 个链接 |
| `back` / `forward` | 历史 |
| `reload` / `stop` / `home` | 重载、中止、首页 |
| `links` / `imgs` / `outline` / `source` / `page` | 切换视图 |
| `find <text>` | 页内查找 |
| `images on\|off` | 以后是否自动加载图片 |
| `img <n>` / `img all` | 加载当前页指定/全部图片 |
| `<query>` | Google + Bing + 百度 搜索枢纽 |
| `g\|b\|d <query>` | 在本浏览器打开对应搜索引擎 |
| `real [n]` | 用系统浏览器打开当前页或链接 n |
| `bookmark` / `bookmarks` / `unbookmark <n>` | 书签（存在 localStorage） |
| `save` | 下载当前页为 txt |
| `help` / `clear` | 帮助 / 清消息 |

没有自建索引。搜索页若被目标站拦截，终端里仍会留下 URL 和联想词。
