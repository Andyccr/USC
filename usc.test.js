var assert = require("assert");
var USC = require("./usc.js");
var Browser = require("./browser.js");

assert.deepStrictEqual(USC.parseLine(""), { type: "empty" });
assert.deepStrictEqual(USC.parseLine("help"), { type: "help" });
assert.deepStrictEqual(USC.parseLine("clear"), { type: "clear" });
assert.deepStrictEqual(USC.parseLine("g"), {
  type: "usage",
  message: "usage: g <query>"
});
assert.deepStrictEqual(USC.parseLine("hello world"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "hello world"
});
assert.deepStrictEqual(USC.parseLine("g 量子计算"), {
  type: "search",
  engines: ["google"],
  query: "量子计算"
});
assert.deepStrictEqual(USC.parseLine("b hello"), {
  type: "search",
  engines: ["bing"],
  query: "hello"
});
assert.deepStrictEqual(USC.parseLine("d hello"), {
  type: "search",
  engines: ["baidu"],
  query: "hello"
});
assert.deepStrictEqual(USC.parseLine("all g"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "g"
});
assert.deepStrictEqual(USC.parseLine("3"), { type: "follow", index: 3 });
assert.deepStrictEqual(USC.parseLine("open 2"), { type: "follow", index: 2 });
assert.deepStrictEqual(USC.parseLine("go example.com"), {
  type: "go",
  url: "example.com"
});
assert.deepStrictEqual(USC.parseLine("https://example.com/x"), {
  type: "go",
  url: "https://example.com/x"
});
assert.deepStrictEqual(USC.parseLine("back"), { type: "back" });
assert.deepStrictEqual(USC.parseLine("img 4"), { type: "img", which: 4 });
assert.deepStrictEqual(USC.parseLine("img all"), { type: "img", which: "all" });
assert.deepStrictEqual(USC.parseLine("images on"), { type: "images", mode: "on" });
assert.deepStrictEqual(USC.parseLine("find lynx"), { type: "find", query: "lynx" });

assert.strictEqual(Browser.looksLikeUrl("example.com"), true);
assert.strictEqual(Browser.looksLikeUrl("hello world"), false);
assert.strictEqual(Browser.looksLikeUrl("https://ex.com/a"), true);
assert.strictEqual(
  Browser.normalizeUrl("example.com"),
  "https://example.com"
);
assert.strictEqual(
  Browser.normalizeUrl("example.com", "https://usc.local/"),
  "https://example.com"
);
assert.strictEqual(
  Browser.normalizeUrl("/x", "https://ex.com/a/b"),
  "https://ex.com/x"
);
assert.strictEqual(
  Browser.resolveUrl("/x", "https://ex.com/a/b"),
  "https://ex.com/x"
);
assert.strictEqual(
  Browser.resolveUrl("//cdn.ex.com/a.png", "https://ex.com/"),
  "https://cdn.ex.com/a.png"
);

var html = [
  "<html><head><title>Hi &amp; Go</title></head><body>",
  "<nav><a href='/nav'>skip me</a></nav>",
  "<h1>Hello</h1>",
  "<p>See <a href='/x'>the link</a> now.</p>",
  '<img src="pic.png" alt="cat">',
  "<script>evil()</script>",
  "</body></html>"
].join("");

var doc = Browser.htmlToDocument(html, "https://ex.com/");
assert.strictEqual(doc.title, "Hi & Go");
assert.strictEqual(doc.links.length, 1);
assert.strictEqual(doc.links[0].text, "the link");
assert.strictEqual(doc.links[0].url, "https://ex.com/x");
assert.strictEqual(doc.images.length, 1);
assert.strictEqual(doc.images[0].alt, "cat");
assert.strictEqual(doc.images[0].url, "https://ex.com/pic.png");
assert.strictEqual(doc.images[0].loaded, false);

var plain = Browser.pageToPlainText(doc);
assert.ok(plain.indexOf("Hello") >= 0);
assert.ok(plain.indexOf("[1] the link") >= 0);
assert.ok(plain.indexOf("[img:1 cat]") >= 0);
assert.ok(plain.indexOf("evil") < 0);
assert.ok(plain.indexOf("skip me") < 0);

var md = Browser.markdownToDocument(
  "Title: Demo\nURL Source: https://ex.com/\n\nMarkdown Content:\nHello [there](/a)\n![pic](img.png)\n",
  "https://ex.com/"
);
assert.strictEqual(md.title, "Demo");
assert.strictEqual(md.links[0].url, "https://ex.com/a");
assert.strictEqual(md.images[0].url, "https://ex.com/img.png");

assert.strictEqual(
  USC.ENGINES.google.searchUrl("hello world"),
  "https://www.google.com/search?q=hello%20world"
);
assert.strictEqual(
  USC.ENGINES.bing.searchUrl("hello"),
  "https://www.bing.com/search?q=hello"
);
assert.strictEqual(
  USC.ENGINES.baidu.searchUrl("量子"),
  "https://www.baidu.com/s?wd=%E9%87%8F%E5%AD%90"
);
assert.strictEqual(
  USC.ENGINES.google.suggestUrl("hello", "cb1"),
  "https://suggestqueries.google.com/complete/search?client=chrome&hl=zh-CN&q=hello&callback=cb1"
);
assert.ok(USC.ENGINES.bing.suggestUrl("hello", "cb1").indexOf("JsonCallback=cb1") !== -1);
assert.ok(USC.ENGINES.baidu.suggestUrl("hello", "cb1").indexOf("cb=cb1") !== -1);
assert.deepStrictEqual(
  USC.ENGINES.google.parseSuggest(["hello", ["hello", "hello kitty", "hello fresh"]]),
  ["hello", "hello kitty", "hello fresh"]
);
assert.deepStrictEqual(
  USC.ENGINES.baidu.parseSuggest({ q: "hello", s: ["hello", "hellotalk"] }),
  ["hello", "hellotalk"]
);

console.log("ok");
