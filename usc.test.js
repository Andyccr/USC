var assert = require("assert");
var USC = require("./usc.js");
var Browser = require("./browser.js");

assert.deepStrictEqual(USC.parseLine(""), { type: "empty" });
assert.deepStrictEqual(USC.parseLine("help"), { type: "help" });
assert.deepStrictEqual(USC.parseLine("clear"), { type: "clear" });
assert.deepStrictEqual(USC.parseLine("g"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "g"
});
assert.deepStrictEqual(USC.parseLine("hello world"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "hello world"
});
assert.deepStrictEqual(USC.parseLine("help me"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "help me"
});
assert.deepStrictEqual(USC.parseLine("i think"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "i think"
});
assert.deepStrictEqual(USC.parseLine("i 1"), { type: "img", which: 1 });
assert.deepStrictEqual(USC.parseLine("i on"), { type: "images", mode: "on" });
assert.deepStrictEqual(USC.parseLine(":back"), { type: "back" });
assert.deepStrictEqual(USC.parseLine("s back"), {
  type: "search",
  engines: ["google", "bing", "baidu"],
  query: "back"
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
assert.deepStrictEqual(USC.parseLine("proxy on"), { type: "proxy", mode: "on" });
assert.deepStrictEqual(USC.parseLine("theme light"), { type: "theme", mode: "light" });
assert.deepStrictEqual(USC.parseLine("font +"), { type: "font", value: "+" });
assert.deepStrictEqual(USC.parseLine("font 18"), { type: "font", value: "18" });
assert.deepStrictEqual(USC.parseLine("copy"), { type: "copy", index: 0 });
assert.deepStrictEqual(USC.parseLine("copy 3"), { type: "copy", index: 3 });
assert.deepStrictEqual(USC.parseLine("share"), { type: "share" });
assert.deepStrictEqual(USC.parseLine("top"), { type: "scroll", edge: "top" });
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

var based = Browser.htmlToDocument(
  '<html><head><base href="/assets/"></head><body><a href="next">next</a><img src="pic.png"></body></html>',
  "https://ex.com/path/page"
);
assert.strictEqual(based.links[0].url, "https://ex.com/assets/next");
assert.strictEqual(based.images[0].url, "https://ex.com/assets/pic.png");

var longDoc = Browser.htmlToDocument(
  "<html><body>" + "<p>xxxxxxxxxx</p>".repeat(13000) + "</body></html>",
  "https://ex.com/"
);
assert.strictEqual(longDoc.truncated, true);
assert.ok(Browser.pageToPlainText(longDoc).indexOf("[page truncated]") >= 0);

var md = Browser.markdownToDocument(
  "Title: Demo\nURL Source: https://ex.com/\n\nMarkdown Content:\nHello [there](/a)\n![pic](img.png)\n",
  "https://ex.com/"
);
assert.strictEqual(md.title, "Demo");
assert.strictEqual(md.links[0].url, "https://ex.com/a");
assert.strictEqual(md.images[0].url, "https://ex.com/img.png");

assert.strictEqual(
  USC.ENGINES.google.searchUrl("hello world"),
  "https://www.google.com/search?q=hello%20world&hl=zh-CN"
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

assert.strictEqual(
  USC.internalSearchUrl("hello world"),
  "https://usc.local/search?q=hello%20world"
);
assert.strictEqual(USC.isInternalSearchUrl("https://usc.local/search?q=hi"), true);
assert.strictEqual(USC.internalSearchQuery("https://usc.local/search?q=hi"), "hi");
assert.strictEqual(USC.isInternalSearchUrl("https://www.google.com/search?q=hi"), false);
assert.strictEqual(USC.isSearchEngineUrl("https://www.google.com/search?q=hi"), true);
assert.strictEqual(USC.isSearchEngineUrl("https://www.google.co.uk/search?q=hi"), true);
assert.strictEqual(USC.isSearchEngineUrl("https://www.bing.com/search?q=hi"), true);
assert.strictEqual(USC.isSearchEngineUrl("https://www.baidu.com/s?wd=hi"), true);
assert.strictEqual(USC.isSearchEngineUrl("https://example.com/"), false);
assert.strictEqual(USC.isSearchEngineResultPage("https://www.bing.com/search?q=hello"), true);
assert.strictEqual(USC.engineQueryFromUrl("https://www.bing.com/search?q=hello+world"), "hello world");
assert.strictEqual(USC.engineQueryFromUrl("https://www.baidu.com/s?wd=%E9%87%8F%E5%AD%90"), "量子");
assert.strictEqual(
  USC.unwrapRedirectUrl(
    "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FQuantum_computing&rut=abc"
  ),
  "https://en.wikipedia.org/wiki/Quantum_computing"
);
assert.strictEqual(
  USC.unwrapRedirectUrl(
    "https://www.bing.com/ck/a?!&&u=a1aHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUXVhbnR1bV9jb21wdXRpbmc&ntb=1"
  ),
  "https://en.wikipedia.org/wiki/Quantum_computing"
);

var bingSample =
  "Title: hello - Bing\nURL Source: https://www.bing.com/search?q=hello\n\nMarkdown Content:\n" +
  "## [**Hello** - **Wikipedia**](https://www.bing.com/ck/a?!&&u=a1aHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVsbG8&ntb=1)\n" +
  "Hello is a greeting.\n" +
  "## [Skip to content](https://www.bing.com/search?q=hello#)\n";
var extracted = USC.extractSearchResults(bingSample, "bing");
assert.strictEqual(extracted.length, 1);
assert.strictEqual(extracted[0].title, "Hello - Wikipedia");
assert.strictEqual(extracted[0].url, "https://en.wikipedia.org/wiki/Hello");
assert.ok(extracted[0].snippet.indexOf("greeting") >= 0);

var ddgSample =
  "1.[Quantum computing - Wikipedia](https://duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FQuantum_computing&rut=x)\n" +
  "A quantum computer is a computer.\n" +
  "en.wikipedia.org/wiki/Quantum_computing\n";
var ddgExtracted = USC.extractSearchResults(ddgSample, "duckduckgo");
assert.strictEqual(ddgExtracted.length, 1);
assert.strictEqual(ddgExtracted[0].url, "https://en.wikipedia.org/wiki/Quantum_computing");

var built = USC.buildSearchDocument("hello", extracted, { related: ["hello world"] });
assert.strictEqual(built.url.indexOf("usc.local/search") >= 0, true);
assert.ok(built.links.some(function (link) {
  return link.url === "https://en.wikipedia.org/wiki/Hello";
}));
assert.ok(built.links.some(function (link) {
  return link.url.indexOf("usc.local/search") >= 0;
}));

var originalFetch = global.fetch;

(async function () {
  var calls = 0;
  global.fetch = function () {
    calls += 1;
    var err = new Error("aborted");
    err.name = "AbortError";
    return Promise.reject(err);
  };
  await assert.rejects(Browser.fetchPage("https://example.com"), function (err) {
    return err.name === "AbortError";
  });
  assert.strictEqual(calls, 1, "abort must not fall through to Jina");

  calls = 0;
  global.fetch = function () {
    calls += 1;
    return Promise.reject(new TypeError("cors"));
  };
  await assert.rejects(Browser.fetchPage("https://example.com"), /proxy on/);
  assert.strictEqual(calls, 1, "proxy must be opt-in");

  global.fetch = function () {
    return Promise.resolve({
      ok: true,
      url: "https://example.com/pic.png",
      headers: { get: function () { return "image/png"; } }
    });
  };
  var imagePage = await Browser.fetchPage("https://example.com/pic.png");
  var imageDoc = Browser.parseFetched(imagePage.text, imagePage.url);
  assert.strictEqual(imagePage.via, "direct-image");
  assert.strictEqual(imageDoc.images.length, 1);

  global.fetch = originalFetch;
  console.log("ok");
})().catch(function (err) {
  global.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
