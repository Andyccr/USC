# USC

浏览器内纯文本 CUI。输入查询后调用 Google、Bing、百度的联想接口，并打开对应搜索页。没有自建索引，所以是半搜索引擎。

用浏览器打开 `index.html` 即可，不需要服务器。

```
usc> 量子计算
usc> g hello
usc> b hello
usc> d hello
usc> help
```

Enter 会做三件事：

1. 立刻打开所选引擎的搜索页，并在终端里打印 URL（可点击）
2. 用 JSONP 向 Google / Bing / 百度请求联想词
3. 把联想结果打在终端里

浏览器可能拦截多个新标签。被拦时点终端里的 URL。

| 命令 | 作用 |
|---|---|
| `<query>` | 三个引擎一起搜 |
| `g <query>` | 只调 Google |
| `b <query>` | 只调 Bing |
| `d <query>` | 只调百度 |
| `all <query>` | 三个引擎一起搜 |
| `help` | 命令说明 |
| `clear` | 清屏 |
