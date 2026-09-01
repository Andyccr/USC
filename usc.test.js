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
assert.deepStrictEqual(USC.parseLine("proxy auto"), { type: "proxy", mode: "auto" });
assert.deepStrictEqual(USC.parseLine("proxy off"), { type: "proxy", mode: "off" });
assert.deepStrictEqual(USC.parseLine("theme light"), { type: "theme", mode: "light" });
assert.deepStrictEqual(USC.parseLine("theme"), { type: "theme", mode: "cycle" });
assert.deepStrictEqual(USC.parseLine("theme auto"), { type: "theme", mode: "system" });
assert.deepStrictEqual(USC.parseLine("about"), { type: "about" });
assert.strictEqual(USC.nextTheme("dark"), "light");
assert.strictEqual(USC.nextTheme("light"), "system");
assert.strictEqual(USC.nextTheme("system"), "dark");
assert.strictEqual(USC.themeLabel("system"), "auto");
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

var titledMd = Browser.markdownToDocument(
  "Title: t\nURL Source: https://ex.com/\n\nMarkdown Content:\nSee [salutation](https://en.wikipedia.org/wiki/Salutation \"Salutation\") now.\n",
  "https://ex.com/"
);
assert.strictEqual(titledMd.links[0].url, "https://en.wikipedia.org/wiki/Salutation");
assert.strictEqual(titledMd.links[0].text, "salutation");
assert.ok(Browser.pageToPlainText(titledMd).indexOf("[1] salutation") >= 0);
assert.ok(Browser.pageToPlainText(titledMd).indexOf("](") < 0);

var citeMd = Browser.markdownToDocument(
  "Title: t\nURL Source: https://en.wikipedia.org/wiki/Hello\n\nMarkdown Content:\nHello.[[1]](https://en.wikipedia.org/wiki/Hello#cite_note-1) Next.\n",
  "https://en.wikipedia.org/wiki/Hello"
);
assert.strictEqual(citeMd.links.length, 0);
assert.ok(Browser.pageToPlainText(citeMd).indexOf("Hello.") >= 0);
assert.ok(Browser.pageToPlainText(citeMd).indexOf("cite_note") < 0);

var emphMd = Browser.markdownToDocument(
  "Title: t\nURL Source: https://ex.com/\n\nMarkdown Content:\n_**Hello**_ is a word.\n",
  "https://ex.com/"
);
assert.ok(Browser.pageToPlainText(emphMd).indexOf("Hello is a word") >= 0);
assert.ok(Browser.pageToPlainText(emphMd).indexOf("**") < 0);

var pairEmph = Browser.markdownToDocument(
  "Title: t\nURL Source: https://ex.com/\n\nMarkdown Content:\nan alteration of _hallo_, _hollo_, which came\n",
  "https://ex.com/"
);
assert.ok(Browser.pageToPlainText(pairEmph).indexOf("hallo, hollo, which") >= 0);
assert.ok(Browser.pageToPlainText(pairEmph).indexOf("hollo_") < 0);

var tableMd = Browser.markdownToDocument(
  "Title: t\nURL Source: https://ex.com/\n\nMarkdown Content:\n| Released | 23 October 2015 |\n| --- | --- |\n",
  "https://ex.com/"
);
var tablePlain = Browser.pageToPlainText(tableMd);
assert.ok(tablePlain.indexOf("Released") >= 0);
assert.ok(tablePlain.indexOf("23 October 2015") >= 0);
assert.ok(tablePlain.indexOf("| ---") < 0);

var wrappedImg = Browser.markdownToDocument(
  "Title: t\nURL Source: https://ex.com/\n\nMarkdown Content:\n[![Image 1: cat](https://ex.com/cat.png)](https://ex.com/file)\n",
  "https://ex.com/"
);
assert.strictEqual(wrappedImg.images.length, 1);
assert.strictEqual(wrappedImg.images[0].url, "https://ex.com/cat.png");

var escaped = Browser.markdownToDocument(
  "Title: t\nURL Source: https://en.wikipedia.org/wiki/Hello\n\nMarkdown Content:\nthe _[Norwich Courier](https://en.wikipedia.org/wiki/Norwich\\_Courier \"Norwich Courier\")_ of town\n",
  "https://en.wikipedia.org/wiki/Hello"
);
assert.strictEqual(escaped.links[0].url, "https://en.wikipedia.org/wiki/Norwich_Courier");
assert.ok(Browser.pageToPlainText(escaped).indexOf("Norwich Courier") >= 0);
assert.ok(Browser.pageToPlainText(escaped).indexOf("_Courier") < 0);

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
assert.strictEqual(USC.isInternalSearchUrl("https://usc.local/"), false);
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
  "1.   [![Image 12: Global web icon](https://th.bing.com/th/id/ODLS.ABC?w=32) wikipedia.org https://en.wikipedia.org › wiki › Hello](https://www.bing.com/ck/a?!&&u=a1aHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVsbG8&ntb=1)\n" +
  "## [**Hello** - **Wikipedia**](https://www.bing.com/ck/a?!&&u=a1aHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSGVsbG8&ntb=1)\n" +
  "Hello is a greeting.\n" +
  "## [Skip to content](https://www.bing.com/search?q=hello#)\n";
var extracted = USC.extractSearchResults(bingSample, "bing");
assert.strictEqual(extracted.length, 1, "icon/thumbnail links must not become results");
assert.strictEqual(extracted[0].title, "Hello - Wikipedia");
assert.strictEqual(extracted[0].url, "https://en.wikipedia.org/wiki/Hello");
assert.strictEqual(
  USC.extractSearchResults(
    "Title: t\nURL Source: https://www.bing.com/search?q=x\n\nMarkdown Content:\n## [Hello (Adele song) - Wikipedia](https://en.wikipedia.org/wiki/Hello_(Adele_song))\nA piano ballad.\n",
    "bing"
  )[0].url,
  "https://en.wikipedia.org/wiki/Hello_(Adele_song)"
);
assert.ok(extracted[0].snippet.indexOf("greeting") >= 0);
assert.strictEqual(USC.isImageUrl("https://th.bing.com/th/id/ODLS.ABC"), true);
assert.strictEqual(USC.isImageUrl("https://en.wikipedia.org/wiki/Hello"), false);

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
assert.ok(
  USC.mergeSearchResults([
    {
      results: [
        { title: "Video", url: "https://www.youtube.com/watch?v=1", snippet: "" },
        { title: "Hello", url: "https://en.wikipedia.org/wiki/Hello", snippet: "" }
      ]
    }
  ])[0].url.indexOf("wikipedia") >= 0
);
assert.ok(built.links.some(function (link) {
  return link.url.indexOf("usc.local/search") >= 0;
}));

assert.strictEqual(
  Browser.markdownToDocument(
    "Title: t\nURL Source: https://ex.com/\n\nMarkdown Content:\n[Python (programming language)](https://en.wikipedia.org/wiki/Python_(programming_language))\n",
    "https://ex.com/"
  ).links[0].url,
  "https://en.wikipedia.org/wiki/Python_(programming_language)"
);
assert.strictEqual(
  Browser.markdownToDocument(
    "Title: t\nURL Source: https://ex.com/\n\nMarkdown Content:\n[x](<https://en.wikipedia.org/wiki/Foo_(bar)>)\n",
    "https://ex.com/"
  ).links[0].url,
  "https://en.wikipedia.org/wiki/Foo_(bar)"
);

var builtParen = USC.buildSearchDocument(
  "python",
  [{ title: "Python (programming language)", url: "https://en.wikipedia.org/wiki/Python_(programming_language)", snippet: "A language." }],
  {}
);
assert.strictEqual(
  builtParen.links[0].url,
  "https://en.wikipedia.org/wiki/Python_(programming_language)"
);

assert.deepStrictEqual(USC.parseLine("settings"), { type: "settings" });
assert.deepStrictEqual(USC.parseLine("prefs"), { type: "settings" });
assert.deepStrictEqual(USC.parseLine("resume"), { type: "resume" });
assert.deepStrictEqual(USC.parseLine("continue"), { type: "resume" });
assert.deepStrictEqual(USC.parseLine("star"), { type: "bookmark", index: 0 });
assert.deepStrictEqual(USC.parseLine("recents"), { type: "home" });
assert.deepStrictEqual(USC.parseLine("history"), { type: "history" });
assert.deepStrictEqual(USC.parseLine("bookmarks"), { type: "bookmarks" });

var Library = require("./library.js");
assert.strictEqual(Library.isLocalHost("https://usc.local/settings"), true);
assert.strictEqual(Library.isLocalHost("https://en.wikipedia.org/wiki/Hello"), false);
assert.strictEqual(
  Library.shouldRemember({ url: "https://en.wikipedia.org/wiki/X", title: "X", via: "loading" }),
  false
);
assert.ok(Library.loadingMarkdown("https://ex.com/", "Hello").indexOf("loading") >= 0);
assert.ok(Library.errorMarkdown("https://ex.com/", "timeout").indexOf("fetch failed") >= 0);
assert.ok(Library.errorMarkdown("https://ex.com/", "timeout").indexOf("usc.local") >= 0);
assert.strictEqual(Library.isHomeUrl("https://usc.local"), true);
assert.strictEqual(Library.isHomeUrl("https://en.wikipedia.org/wiki/Hello"), false);
assert.strictEqual(Library.isSettingsUrl("https://usc.local/settings"), true);
assert.strictEqual(Library.isHistoryUrl("https://usc.local/history"), true);
assert.strictEqual(Library.isBookmarksUrl("https://usc.local/bookmarks"), true);
assert.strictEqual(Library.isHelpUrl("https://usc.local/help"), true);
assert.strictEqual(Library.isAppUrl("https://usc.local/settings"), true);
assert.strictEqual(Library.isAppUrl("https://usc.local/search?q=hi"), false);
assert.strictEqual(Library.isSurfaceUrl("https://usc.local/"), true);
assert.strictEqual(Library.isSurfaceUrl("https://en.wikipedia.org/"), false);
assert.deepStrictEqual(Library.parseSetUrl("https://usc.local/set?k=theme&v=dark"), {
  key: "theme",
  value: "dark"
});
assert.strictEqual(Library.setUrl("proxy", "auto"), "https://usc.local/set?k=proxy&v=auto");

assert.strictEqual(
  Library.shouldRemember({ url: "https://usc.local/", title: "USC" }),
  false
);
assert.strictEqual(
  Library.shouldRemember({ url: "https://usc.local/settings", title: "settings" }),
  false
);
assert.strictEqual(
  Library.shouldRemember({ url: "https://usc.local/search?q=hi", title: "hi" }),
  true
);
assert.strictEqual(
  Library.shouldRemember({ url: "https://en.wikipedia.org/wiki/X", title: "X" }),
  true
);
assert.strictEqual(
  Library.shouldRemember({ url: "https://ex.com/a.png", title: "image", via: "image-link" }),
  false
);

var remembered = Library.remember({ recents: [], last: null }, {
  title: "Hello",
  url: "https://en.wikipedia.org/wiki/Hello"
});
assert.strictEqual(remembered.last.kind, "page");
assert.strictEqual(remembered.recents.length, 1);
remembered = Library.remember(remembered, {
  title: "quantum",
  url: "https://usc.local/search?q=quantum"
});
assert.strictEqual(remembered.last.kind, "search");
assert.strictEqual(remembered.last.title, "search · quantum");
assert.strictEqual(remembered.recents.length, 2);
assert.strictEqual(remembered.recents[0].url, "https://usc.local/search?q=quantum");

var homeMd = Library.homeMarkdown({
  recents: remembered.recents,
  last: remembered.last,
  bookmarks: [{ title: "Saved", url: "https://example.com/saved" }]
});
assert.ok(homeMd.indexOf("continue") >= 0);
assert.ok(homeMd.indexOf("usc.local/search?q=quantum") >= 0);
assert.ok(homeMd.indexOf("recent") >= 0);
assert.ok(homeMd.indexOf("en.wikipedia.org/wiki/Hello") >= 0);
assert.ok(homeMd.indexOf("bookmarks") >= 0);
assert.ok(homeMd.indexOf("example.com/saved") >= 0);
assert.ok(homeMd.indexOf("usc.local/settings") >= 0);
assert.ok(homeMd.indexOf("usc.local/history") >= 0);
assert.ok(homeMd.indexOf("usc.local/help") >= 0);

var emptyHome = Library.homeMarkdown({});
assert.ok(emptyHome.indexOf("type to search") >= 0);
assert.ok(emptyHome.indexOf("continue") < 0);

var homeDoc = Browser.markdownToDocument(homeMd, Library.HOME);
assert.ok(homeDoc.links.some(function (link) {
  return link.url === "https://en.wikipedia.org/wiki/Hello";
}));
assert.ok(homeDoc.links.some(function (link) {
  return link.url === "https://usc.local/settings";
}));

var settingsDoc = Browser.markdownToDocument(
  Library.settingsMarkdown({ theme: "dark", proxy: "auto", images: "off", font: 15 }),
  Library.SETTINGS
);
assert.ok(settingsDoc.links.some(function (link) {
  return link.url.indexOf("k=theme") >= 0 && link.url.indexOf("v=light") >= 0;
}));
assert.ok(settingsDoc.links.some(function (link) {
  return link.url.indexOf("k=recents") >= 0;
}));

var historyDoc = Browser.markdownToDocument(
  Library.historyMarkdown([
    { title: "history", url: Library.HISTORY, current: true },
    { title: "Hello", url: "https://en.wikipedia.org/wiki/Hello", current: false },
    { title: "USC", url: Library.HOME }
  ]),
  Library.HISTORY
);
assert.strictEqual(historyDoc.links.filter(function (link) {
  return link.url.indexOf("wikipedia") >= 0;
}).length, 1);
assert.ok(historyDoc.links.some(function (link) {
  return link.url === Library.HOME;
}));

var emptyMarks = Browser.markdownToDocument(Library.bookmarksMarkdown([]), Library.BOOKMARKS);
assert.ok(Browser.pageToPlainText(emptyMarks).indexOf("star a page") >= 0);

assert.strictEqual(Library.readingMinutes("abcd"), 0);
assert.ok(Library.readingMinutes("x".repeat(1600)) >= 2);
assert.strictEqual(Library.isSectionLabel("continue"), true);
assert.strictEqual(Library.isSectionLabel("theme  auto"), true);
assert.strictEqual(Library.isSectionLabel("Hello world"), false);

var cleared = Library.clearSession();
assert.deepStrictEqual(cleared, { recents: [], last: null });

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
  await assert.rejects(Browser.fetchPage("https://example.com"), /proxy auto/);
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
