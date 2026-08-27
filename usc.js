(function (root, factory) {
  var Browser = root.USCBrowser;
  var Library = root.USCLibrary;
  if (!Browser && typeof require === "function") Browser = require("./browser.js");
  if (!Library && typeof require === "function") Library = require("./library.js");
  var api = factory(Browser, Library);
  root.USC = api;
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount(document);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Browser, Library) {
  var ALL = ["google", "bing", "baidu"];
  var SUGGEST_LIMIT = 8;
  var JSONP_TIMEOUT = 5000;
  var MAX_STACK = 40;
  var MAX_CACHE = 20;
  var MAX_RAW = 2000000;
  var LOAD_TIMEOUT = 15000;
  var SEARCH_TIMEOUT = 22000;
  var ENGINE_TIMEOUT = 9000;
  var BOOKMARK_KEY = "usc.bookmarks";
  var IMAGE_KEY = "usc.images";
  var PROXY_KEY = "usc.proxy";
  var THEME_KEY = "usc.theme";
  var FONT_KEY = "usc.font";
  var SESSION_KEY = "usc.session";
  var COMMANDS = [
    ":back",
    ":forward",
    ":home",
    ":reload",
    ":stop",
    ":find ",
    ":links",
    ":images",
    ":i ",
    ":bookmark",
    ":bookmarks",
    ":copy",
    ":share",
    ":save",
    ":top",
    ":bottom",
    ":theme",
    ":theme dark",
    ":theme light",
    ":theme system",
    ":font +",
    ":font -",
    ":font reset",
    ":proxy auto",
    ":proxy on",
    ":proxy off",
    ":settings",
    ":resume",
    ":history",
    ":bookmarks",
    ":about",
    ":star",
    ":help"
  ];

  var ENGINES = {
    google: {
      aliases: ["g", "google"],
      searchUrl: function (q) {
        return "https://www.google.com/search?q=" + encodeURIComponent(q) + "&hl=zh-CN";
      },
      suggestUrl: function (q, cb) {
        return (
          "https://suggestqueries.google.com/complete/search?client=chrome&hl=zh-CN&q=" +
          encodeURIComponent(q) +
          "&callback=" +
          encodeURIComponent(cb)
        );
      },
      parseSuggest: function (data) {
        return listFrom(data && data[1]);
      }
    },
    bing: {
      aliases: ["b", "bing"],
      searchUrl: function (q) {
        return "https://www.bing.com/search?q=" + encodeURIComponent(q);
      },
      suggestUrl: function (q, cb) {
        return (
          "https://api.bing.com/osjson.aspx?query=" +
          encodeURIComponent(q) +
          "&JsonType=callback&JsonCallback=" +
          encodeURIComponent(cb)
        );
      },
      parseSuggest: function (data) {
        return listFrom(data && data[1]);
      }
    },
    baidu: {
      aliases: ["d", "bd", "baidu"],
      searchUrl: function (q) {
        return "https://www.baidu.com/s?wd=" + encodeURIComponent(q);
      },
      suggestUrl: function (q, cb) {
        return (
          "https://suggestion.baidu.com/su?ie=utf-8&oe=utf-8&p=3&wd=" +
          encodeURIComponent(q) +
          "&cb=" +
          encodeURIComponent(cb)
        );
      },
      parseSuggest: function (data) {
        return listFrom(data && data.s);
      }
    },
    duckduckgo: {
      aliases: ["ddg", "duck"],
      searchUrl: function (q) {
        return "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q);
      },
      suggestUrl: function () {
        return "";
      },
      parseSuggest: function () {
        return [];
      }
    }
  };

  var RESULT_LIMIT = 24;
  var NOISE_TITLES = {
    "skip to content": 1,
    "accessibility feedback": 1,
    rewards: 1,
    images: 1,
    videos: 1,
    maps: 1,
    news: 1,
    shopping: 1,
    flights: 1,
    more: 1,
    tools: 1,
    all: 1,
    search: 1,
    "any time": 1,
    "open links in new tab": 1,
    "查看更多": 1,
    "查看更多相关信息": 1,
    hao123: 1
  };

  var HELP =
    "type to search\n" +
    "url to open\n" +
    "number to follow a link\n" +
    "\n" +
    "back     home     help\n" +
    "i 1      load image link 1\n" +
    "i on     always load images\n" +
    "proxy     auto / on / off\n" +
    "theme     tap / Alt+T · dark light auto\n" +
    "settings  appearance · proxy · font\n" +
    "resume    reopen last page\n" +
    "star      bookmark / unbookmark\n" +
    "history   this session\n" +
    "font +    adjust text size\n" +
    "copy      copy current URL\n" +
    "share     share current page\n" +
    "g hello  google only\n" +
    "s back   search a command word\n" +
    "real     open outside\n" +
    "about     product info\n" +
    ":cmd     any command\n" +
    "\n" +
    "pages stay as text · images stay as links\n";

  var ABOUT =
    "USC  plain-text browser\n" +
    "search · read · stay in-page\n" +
    "\n" +
    "theme    dark / light / auto\n" +
    "         tap the label · Alt+T · theme\n" +
    "settings  theme · proxy · images · font\n" +
    "resume    last page after refresh\n" +
    "star      save this page\n" +
    "history   this session\n" +
    "proxy    auto (Jina when blocked)\n" +
    "images   links until you load them\n" +
    "\n" +
    "no backend · no index · no account\n" +
    "help     commands\n";

  function nextTheme(mode) {
    if (mode === "dark") return "light";
    if (mode === "light") return "system";
    return "dark";
  }

  function themeLabel(mode) {
    return mode === "system" ? "auto" : mode === "light" ? "light" : "dark";
  }

  function listFrom(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    for (var i = 0; i < value.length && out.length < SUGGEST_LIMIT; i++) {
      var item = value[i];
      if (typeof item === "string" && item) out.push(item);
    }
    return out;
  }

  function parseLine(line) {
    var text = String(line || "").replace(/^\s+|\s+$/g, "");
    if (!text) return { type: "empty" };
    if (text.charAt(0) === ":") return parseLine(text.slice(1));

    var lower = text.toLowerCase();
    if (lower === "help" || lower === "?") return { type: "help" };
    if (lower === "clear" || lower === "cls") return { type: "clear" };
    if (lower === "back") return { type: "back" };
    if (lower === "forward" || lower === "fwd") return { type: "forward" };
    if (lower === "reload" || lower === "refresh") return { type: "reload" };
    if (lower === "stop") return { type: "stop" };
    if (lower === "home") return { type: "home" };
    if (lower === "links") return { type: "view", view: "links" };
    if (lower === "imgs" || lower === "images") return { type: "images", mode: "show" };
    if (lower === "outline") return { type: "view", view: "outline" };
    if (lower === "source") return { type: "view", view: "source" };
    if (lower === "page") return { type: "view", view: "page" };
    if (lower === "url" || lower === "where") return { type: "where" };
    if (lower === "title") return { type: "title" };
    if (lower === "history") return { type: "history" };
    if (lower === "bookmarks") return { type: "bookmarks" };
    if (lower === "bookmark") return { type: "bookmark", index: 0 };
    if (lower === "save") return { type: "save" };
    if (lower === "real") return { type: "real", index: 0 };
    if (lower === "proxy") return { type: "proxy", mode: "show" };
    if (lower === "theme") return { type: "theme", mode: "cycle" };
    if (lower === "about") return { type: "about" };
    if (lower === "settings" || lower === "prefs") return { type: "settings" };
    if (lower === "resume" || lower === "continue") return { type: "resume" };
    if (lower === "star") return { type: "bookmark", index: 0 };
    if (lower === "recents" || lower === "recent") return { type: "home" };
    if (lower === "font") return { type: "font", value: "show" };
    if (lower === "copy") return { type: "copy", index: 0 };
    if (lower === "share") return { type: "share" };
    if (lower === "top") return { type: "scroll", edge: "top" };
    if (lower === "bottom") return { type: "scroll", edge: "bottom" };
    if (/^\d+$/.test(text)) return { type: "follow", index: parseInt(text, 10) };

    var parts = text.split(/\s+/);
    var head = parts[0].toLowerCase();
    var rest = text.slice(parts[0].length).replace(/^\s+/, "");

    if (head === "go" || head === "open" || head === "visit") {
      if (!rest) return { type: "usage", message: "url or number" };
      if (/^\d+$/.test(rest)) return { type: "follow", index: parseInt(rest, 10) };
      return { type: "go", url: rest };
    }
    if (head === "theme") {
      if (rest === "auto") rest = "system";
      if (rest === "dark" || rest === "light" || rest === "system") {
        return { type: "theme", mode: rest };
      }
      if (rest === "cycle" || rest === "toggle") return { type: "theme", mode: "cycle" };
      return { type: "usage", message: "theme dark|light|system" };
    } else if (head === "font") {
      if (rest === "+" || rest === "-" || rest === "reset" || /^\d{2}$/.test(rest)) {
        return { type: "font", value: rest };
      }
      return { type: "usage", message: "font +|-|reset|12..20" };
    } else if (head === "copy") {
      if (!rest) return { type: "copy", index: 0 };
      if (/^\d+$/.test(rest)) return { type: "copy", index: parseInt(rest, 10) };
      return { type: "usage", message: "copy [n]" };
    } else if (head === "proxy") {
      if (rest === "on" || rest === "off" || rest === "auto") return { type: "proxy", mode: rest };
      return { type: "usage", message: "proxy auto|on|off" };
    } else if (head === "img" || head === "i") {
      if (!rest) return { type: "images", mode: "show" };
      if (rest === "on" || rest === "off") return { type: "images", mode: rest };
      if (rest === "all") return { type: "img", which: "all" };
      if (/^\d+$/.test(rest)) return { type: "img", which: parseInt(rest, 10) };
    } else if (head === "images") {
      if (rest === "on" || rest === "off") return { type: "images", mode: rest };
    } else if (head === "find" || head === "/") {
      if (!rest) return { type: "usage", message: "find <text>" };
      return { type: "find", query: rest };
    } else if (head === "real" && /^\d+$/.test(rest)) {
      return { type: "real", index: parseInt(rest, 10) };
    } else if (head === "bookmark" && /^\d+$/.test(rest)) {
      return { type: "bookmark", index: parseInt(rest, 10) };
    } else if (head === "unbookmark") {
      if (!/^\d+$/.test(rest)) return { type: "usage", message: "unbookmark <n>" };
      return { type: "unbookmark", index: parseInt(rest, 10) };
    } else if (head === "all" || head === "s" || head === "search") {
      if (!rest) return { type: "search", engines: ALL.slice(), query: head };
      return { type: "search", engines: ALL.slice(), query: rest };
    } else {
      for (var name in ENGINES) {
        if (ENGINES[name].aliases.indexOf(head) !== -1 && rest) {
          return { type: "search", engines: [name], query: rest };
        }
      }
    }
    if (Browser.looksLikeUrl(text)) return { type: "go", url: text };
    return { type: "search", engines: ALL.slice(), query: text };
  }

  var jsonpSeq = 0;

  function jsonp(urlForCallback, timeoutMs) {
    timeoutMs = timeoutMs || JSONP_TIMEOUT;
    return new Promise(function (resolve, reject) {
      if (typeof document === "undefined") {
        reject(new Error("no document"));
        return;
      }
      var cb = "_usc" + Date.now() + "_" + jsonpSeq++;
      var settled = false;
      var script = document.createElement("script");
      var timer = setTimeout(function () {
        finish(new Error("timeout"));
      }, timeoutMs);

      function finish(err, data) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          delete window[cb];
        } catch (e) {
          window[cb] = undefined;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
        if (err) reject(err);
        else resolve(data);
      }

      window[cb] = function (data) {
        finish(null, data);
      };
      script.onerror = function () {
        finish(new Error("blocked"));
      };
      script.src = urlForCallback(cb);
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function suggestOne(name, query) {
    var engine = ENGINES[name];
    if (!engine || !engine.suggestUrl(query, "cb")) {
      return Promise.resolve({
        name: name,
        suggestions: [],
        url: engine ? engine.searchUrl(query) : ""
      });
    }
    return jsonp(function (cb) {
      return engine.suggestUrl(query, cb);
    }).then(function (data) {
      return { name: name, suggestions: engine.parseSuggest(data), url: engine.searchUrl(query) };
    }).catch(function (err) {
      return {
        name: name,
        suggestions: [],
        url: engine.searchUrl(query),
        error: err && err.message ? err.message : "failed"
      };
    });
  }

  function suggestMany(engines, query) {
    return Promise.all(
      engines.map(function (name) {
        return suggestOne(name, query);
      })
    );
  }

  function openExternal(url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function engineHostKind(host) {
    host = String(host || "")
      .replace(/^www\./, "")
      .toLowerCase();
    if (/(^|\.)google\./i.test(host)) return "google";
    if (/(^|\.)bing\./i.test(host)) return "bing";
    if (/(^|\.)baidu\./i.test(host)) return "baidu";
    if (/(^|\.)duckduckgo\./i.test(host)) return "duckduckgo";
    return "";
  }

  function isSearchEngineUrl(url) {
    try {
      return !!engineHostKind(new URL(url).hostname);
    } catch (e) {
      return false;
    }
  }

  function decodeBase64Url(value) {
    var raw = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    var pad = (4 - (raw.length % 4)) % 4;
    while (pad--) raw += "=";
    try {
      if (typeof atob === "function") return atob(raw);
      if (typeof Buffer !== "undefined") return Buffer.from(raw, "base64").toString("utf8");
    } catch (e) {}
    return "";
  }

  function unwrapRedirectUrl(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host.indexOf("duckduckgo.com") >= 0) {
        var uddg = u.searchParams.get("uddg");
        if (uddg) return uddg;
      }
      if (host.indexOf("bing.com") >= 0) {
        var bingU = u.searchParams.get("u");
        if (bingU && bingU.indexOf("a1") === 0) {
          var decoded = decodeBase64Url(bingU.slice(2));
          if (/^https?:\/\//i.test(decoded)) return decoded;
        }
      }
      if (host.indexOf("google.") >= 0 || /\.google\./i.test(host)) {
        var gq = u.searchParams.get("q") || u.searchParams.get("url");
        if (gq && /^https?:\/\//i.test(gq)) return gq;
      }
      return u.href;
    } catch (e) {
      return url;
    }
  }

  function engineQueryFromUrl(url) {
    try {
      var u = new URL(url);
      var kind = engineHostKind(u.hostname);
      if (!kind) return "";
      var path = u.pathname || "";
      if (kind === "baidu") {
        if (path.indexOf("/s") !== 0 && path.indexOf("/baidu") !== 0) return "";
        return u.searchParams.get("wd") || u.searchParams.get("word") || "";
      }
      if (kind === "duckduckgo") {
        if (path.indexOf("/l/") === 0) return "";
        return u.searchParams.get("q") || "";
      }
      if (path.indexOf("/search") !== 0 && path !== "/" && path !== "/url") return "";
      if (path === "/url") return "";
      return u.searchParams.get("q") || u.searchParams.get("query") || "";
    } catch (e) {
      return "";
    }
  }

  function isSearchEngineResultPage(url) {
    return !!engineQueryFromUrl(url);
  }

  function isSearchEngineChromeUrl(url) {
    try {
      var u = new URL(url);
      var kind = engineHostKind(u.hostname);
      if (!kind) return false;
      if (engineQueryFromUrl(url)) return true;
      var path = u.pathname || "";
      if (kind === "bing" && path.indexOf("/ck/") === 0) return true;
      if (kind === "duckduckgo" && path.indexOf("/l/") === 0) return false;
      if (kind === "baidu" && (path.indexOf("/link") === 0 || path.indexOf("/baidu.php") === 0)) {
        return false;
      }
      if (kind === "google" && path === "/url") return false;
      return (
        path === "/" ||
        path === "/webhp" ||
        path.indexOf("/img") === 0 ||
        path.indexOf("/maps") === 0 ||
        path.indexOf("/videos") === 0 ||
        path.indexOf("/news") === 0
      );
    } catch (e) {
      return false;
    }
  }

  function isImageUrl(url) {
    try {
      var u = new URL(url);
      var host = u.hostname.replace(/^www\./, "").toLowerCase();
      var path = u.pathname.toLowerCase();
      if (/\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)(\?|$)/i.test(path)) return true;
      if (host.indexOf("th.bing.com") >= 0) return true;
      if (host.indexOf("tse") === 0 && host.indexOf("bing.net") >= 0) return true;
      if (host.indexOf("gstatic.com") >= 0) return true;
      if (host.indexOf("googleusercontent.com") >= 0 && path.indexOf("/images") >= 0) return true;
      if (host.indexOf("bdstatic.com") >= 0) return true;
      if (host.indexOf("duckduckgo.com") >= 0 && (path.indexOf("/i/") >= 0 || path.indexOf("/iu/") >= 0)) {
        return true;
      }
      if (host.indexOf("external-content.duckduckgo.com") >= 0) return true;
      if (path.indexOf("/y.js") >= 0) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function stripMarkdownImages(line) {
    return String(line || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanResultTitle(title) {
    return String(title || "")
      .replace(/\*+/g, "")
      .replace(/!\[[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .replace(/^#+\s*/, "")
      .trim();
  }

  function resultKey(url) {
    try {
      var u = new URL(url);
      return (u.hostname.replace(/^www\./, "") + u.pathname).toLowerCase().replace(/\/$/, "");
    } catch (e) {
      return String(url || "").toLowerCase();
    }
  }

  function isUsefulResult(title, url) {
    title = cleanResultTitle(title);
    if (!title || title.length < 2) return false;
    if (NOISE_TITLES[title.toLowerCase()]) return false;
    if (/^!\[/.test(title) || /^image\s*\d*/i.test(title)) return false;
    if (/^https?:\/\//i.test(title) && title === url) return false;
    if (isImageUrl(url)) return false;
    try {
      var u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      if (u.hostname === "usc.local") return false;
      var kind = engineHostKind(u.hostname);
      if (kind && isSearchEngineResultPage(url)) return false;
      if (kind === "bing" && (u.pathname.indexOf("/ck/") === 0 || u.pathname === "/")) return false;
      if (kind === "google" && (u.pathname === "/" || u.pathname === "/webhp")) return false;
      if (kind === "baidu" && (u.pathname.indexOf("/baidu.php") === 0 || u.hostname.indexOf("hao123") >= 0)) {
        return false;
      }
      if (kind === "duckduckgo" && u.pathname.indexOf("/l/") !== 0 && !u.searchParams.get("uddg")) {
        if (u.pathname === "/" || u.pathname.indexOf("/lite") === 0 || u.pathname.indexOf("/html") === 0) {
          return false;
        }
      }
      if (u.pathname.indexOf("/y.js") >= 0) return false;
      if (u.hostname.indexOf("bing.com") >= 0 && u.pathname.indexOf("/th") === 0) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function extractSearchResults(text, engine) {
    var raw = String(text || "").replace(/\r\n/g, "\n");
    var idx = raw.indexOf("Markdown Content:");
    var md = idx >= 0 ? raw.slice(idx + "Markdown Content:".length) : raw;
    var lines = md.split("\n");
    var results = [];
    var seen = {};

    function pushResult(title, href, snippet) {
      var url = unwrapRedirectUrl(href);
      title = cleanResultTitle(title);
      // Nested image-markdown often leaves junk titles like "wikipedia.org https://…"
      title = title
        .replace(/\s*https?:\/\/\S+/g, "")
        .replace(/\s*[›>].*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      snippet = String(snippet || "")
        .replace(/\*+/g, "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!isUsefulResult(title, url)) return;
      var key = resultKey(url);
      if (seen[key]) return;
      seen[key] = 1;
      results.push({
        title: title,
        url: url,
        snippet: snippet.slice(0, 220),
        engine: engine || ""
      });
    }

    function snippetAfter(start) {
      for (var j = start + 1; j < Math.min(start + 5, lines.length); j++) {
        var next = stripMarkdownImages(lines[j]);
        if (!next) continue;
        if (/^#{1,6}\s*\[/.test(next) || /^\d+\.\s*\[/.test(next)) break;
        if (/^\[[^\]]{1,40}\]\(https?:/.test(next) && next.length < 90) continue;
        next = next.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
        if (next) return next;
      }
      return "";
    }

    // Pass 1: heading links are the cleanest SERP signal (Bing/Google/Baidu).
    for (var i = 0; i < lines.length && results.length < RESULT_LIMIT; i++) {
      var headingLine = stripMarkdownImages(lines[i]);
      if (!/^#{1,6}\s*\[/.test(headingLine)) continue;
      var heading = Browser.firstMarkdownLink(headingLine.replace(/^#{1,6}\s*/, ""));
      if (!heading || !/^https?:/i.test(heading.url)) continue;
      pushResult(heading.text, heading.url, snippetAfter(i));
    }

    // Pass 2: numbered / plain links after stripping nested icons.
    if (results.length < 3) {
      for (var n = 0; n < lines.length && results.length < RESULT_LIMIT; n++) {
        var line = stripMarkdownImages(lines[n]);
        if (!line) continue;
        var rest = line.replace(/^\d+\.\s*/, "");
        var hit = Browser.firstMarkdownLink(rest);
        if (!hit || !/^https?:/i.test(hit.url)) continue;
        pushResult(hit.text, hit.url, snippetAfter(n));
      }
    }

    // Pass 3: last-resort scan, still image-filtered.
    if (!results.length) {
      var cleaned = stripMarkdownImages(md);
      var pos = 0;
      while (results.length < RESULT_LIMIT) {
        var chunk = cleaned.slice(pos);
        var found = Browser.firstMarkdownLink(chunk);
        if (!found) break;
        pos += found.end;
        pushResult(found.text, found.url, "");
      }
    }
    return results;
  }

  function withTimeout(promise, ms, signal) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        var err = new Error("timeout");
        err.name = "TimeoutError";
        reject(err);
      }, ms);
      function finish(fn, value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn(value);
      }
      if (signal) {
        if (signal.aborted) {
          finish(reject, Object.assign(new Error("aborted"), { name: "AbortError" }));
          return;
        }
        signal.addEventListener(
          "abort",
          function () {
            finish(reject, Object.assign(new Error("aborted"), { name: "AbortError" }));
          },
          { once: true }
        );
      }
      promise.then(
        function (value) {
          finish(resolve, value);
        },
        function (err) {
          finish(reject, err);
        }
      );
    });
  }

  function fetchEngineResults(name, query, signal) {
    var engine = ENGINES[name];
    if (!engine) {
      return Promise.resolve({ name: name, results: [], error: "unknown engine" });
    }
    return withTimeout(
      Browser.fetchPage(engine.searchUrl(query), {
        signal: signal,
        proxy: true,
        forceProxy: true,
        format: "markdown"
      }),
      ENGINE_TIMEOUT,
      signal
    )
      .then(function (fetched) {
        return {
          name: name,
          results: extractSearchResults(fetched.text, name),
          via: fetched.via
        };
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") throw err;
        return {
          name: name,
          results: [],
          error: err && err.message ? err.message : "error"
        };
      });
  }

  function resultWeight(item) {
    try {
      var host = new URL(item.url).hostname.replace(/^www\./, "").toLowerCase();
      if (/wikipedia\.org|wiktionary\.org|github\.com|developer\.mozilla\.org/.test(host)) return 0;
      if (/youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com/.test(host)) return 2;
    } catch (e) {}
    return 1;
  }

  function mergeSearchResults(batches) {
    var seen = {};
    var out = [];
    for (var i = 0; i < batches.length; i++) {
      var list = batches[i].results || [];
      for (var j = 0; j < list.length; j++) {
        var item = list[j];
        var key = resultKey(item.url);
        if (seen[key]) continue;
        seen[key] = 1;
        out.push(item);
        if (out.length >= RESULT_LIMIT) break;
      }
      if (out.length >= RESULT_LIMIT) break;
    }
    out.sort(function (a, b) {
      return resultWeight(a) - resultWeight(b);
    });
    return out;
  }

  function mdHref(url) {
    return "<" + String(url || "").replace(/[<>]/g, "") + ">";
  }

  function buildSearchDocument(query, results, meta) {
    meta = meta || {};
    var hubUrl = internalSearchUrl(query);
    var md =
      "Title: " +
      query +
      "\nURL Source: " +
      hubUrl +
      "\n\nMarkdown Content:\n" +
      query +
      "\n\n";
    if (meta.status) md += meta.status + "\n\n";
    if (!results.length && !meta.status) {
      md += "no results\n";
    }
    for (var i = 0; i < results.length; i++) {
      var item = results[i];
      var label = item.title.replace(/[\[\]]/g, "");
      var host = "";
      try {
        host = new URL(item.url).hostname.replace(/^www\./, "");
      } catch (e) {}
      if (host) label += " · " + host;
      md += "[" + label + "](" + mdHref(item.url) + ")\n";
      if (item.snippet) {
        md += item.snippet.replace(/\[/g, "(").replace(/\]/g, ")") + "\n";
      }
      md += "\n";
    }
    if (meta.related && meta.related.length) {
      md += "related\n";
      for (var r = 0; r < meta.related.length; r++) {
        md +=
          "[" +
          meta.related[r].replace(/[\[\]]/g, "") +
          "](" +
          mdHref(internalSearchUrl(meta.related[r])) +
          ")\n";
      }
    }
    if (meta.footer) md += "\n" + meta.footer + "\n";
    var documentModel = Browser.markdownToDocument(md, hubUrl);
    documentModel.via = meta.via || "search";
    documentModel.searchQuery = query;
    documentModel.searchEngines = meta.engines || ALL.slice();
    return documentModel;
  }

  function eventElement(target) {
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
  }

  function isInternalSearchUrl(url) {
    try {
      var u = new URL(url);
      return u.hostname === "usc.local" && u.pathname === "/search";
    } catch (e) {
      return false;
    }
  }

  function internalSearchQuery(url) {
    try {
      var u = new URL(url);
      if (u.hostname !== "usc.local") return "";
      if (u.pathname === "/search") return u.searchParams.get("q") || "";
      return "";
    } catch (e) {
      return "";
    }
  }

  function internalSearchUrl(query) {
    return "https://usc.local/search?q=" + encodeURIComponent(query);
  }

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : raw;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  function readBookmarks() {
    try {
      var list = JSON.parse(storageGet(BOOKMARK_KEY, "[]"));
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeBookmarks(list) {
    storageSet(BOOKMARK_KEY, JSON.stringify(list));
  }

  function readSession() {
    try {
      var data = JSON.parse(storageGet(SESSION_KEY, "{}"));
      var recents = data && Array.isArray(data.recents) ? data.recents : [];
      return { recents: recents, last: data && data.last ? data.last : null };
    } catch (e) {
      return { recents: [], last: null };
    }
  }

  function writeSession(state) {
    storageSet(
      SESSION_KEY,
      JSON.stringify({
        recents: (state && state.recents) || [],
        last: (state && state.last) || null
      })
    );
  }

  function mount(doc) {
    var page = doc.getElementById("page");
    var status = doc.getElementById("status");
    var msg = doc.getElementById("msg");
    var hint = doc.getElementById("hint");
    var progress = doc.querySelector("#progress span");
    var form = doc.getElementById("prompt");
    var input = doc.getElementById("q");
    var promptLabel = form && form.querySelector("label");
    var themeBtn = doc.getElementById("theme");
    if (!page || !status || !msg || !form || !input) return;
    if (!Browser || !Library) return;

    var cmdHistory = [];
    var cmdPos = -1;
    var draft = "";
    var stack = [];
    var stackPos = -1;
    var current = null;
    var view = "page";
    var imagesMode = storageGet(IMAGE_KEY, "off") === "on" ? "on" : "off";
    var proxyMode = storageGet(PROXY_KEY, "auto");
    if (proxyMode !== "on" && proxyMode !== "off") proxyMode = "auto";
    var themeMode = storageGet(THEME_KEY, "system");
    var fontSize = parseInt(storageGet(FONT_KEY, "15"), 10);
    if (themeMode !== "dark" && themeMode !== "light") themeMode = "system";
    if (!fontSize || fontSize < 12 || fontSize > 20) fontSize = 15;
    var abortCtrl = null;
    var findQuery = "";
    var findMatches = 0;
    var cache = {};
    var cacheOrder = [];
    var going = 0;
    var suggestTimer = null;
    var tabComplete = "";
    var suggestionWords = [];
    var suggestionIndex = -1;
    var historySeq = 0;
    var nativeHistory =
      typeof window !== "undefined" && window.history && window.history.pushState;
    var session = readSession();

    function homeDocument() {
      return Browser.markdownToDocument(
        Library.homeMarkdown({
          recents: session.recents,
          last: session.last,
          bookmarks: readBookmarks()
        }),
        Library.HOME
      );
    }

    function settingsDocument() {
      return Browser.markdownToDocument(
        Library.settingsMarkdown({
          theme: themeMode,
          proxy: proxyMode,
          images: imagesMode,
          font: fontSize
        }),
        Library.SETTINGS
      );
    }

    function historyDocument() {
      var items = [];
      for (var i = stack.length - 1; i >= 0; i--) {
        if (!stack[i]) continue;
        items.push({
          title: stack[i].title,
          url: stack[i].url,
          current: i === stackPos
        });
      }
      return Browser.markdownToDocument(Library.historyMarkdown(items), Library.HISTORY);
    }

    function bookmarksDocument() {
      return Browser.markdownToDocument(Library.bookmarksMarkdown(readBookmarks()), Library.BOOKMARKS);
    }

    function helpDocument() {
      return Browser.markdownToDocument(
        Library.textMarkdown(
          "help",
          Library.HELP,
          "help\n\n" + HELP + "\n[settings](" + Library.mdHref(Library.SETTINGS) + ")\n[home](" + Library.mdHref(Library.HOME) + ")\n"
        ),
        Library.HELP
      );
    }

    function aboutDocument() {
      return Browser.markdownToDocument(
        Library.textMarkdown(
          "about",
          Library.ABOUT,
          ABOUT + "\n[settings](" + Library.mdHref(Library.SETTINGS) + ")\n[help](" + Library.mdHref(Library.HELP) + ")\n[home](" + Library.mdHref(Library.HOME) + ")\n"
        ),
        Library.ABOUT
      );
    }

    function loadingDocument(url, title) {
      var docModel = Browser.markdownToDocument(Library.loadingMarkdown(url, title), url);
      docModel.via = "loading";
      return docModel;
    }

    function errorDocument(url, message) {
      var docModel = Browser.markdownToDocument(Library.errorMarkdown(url, message), url);
      docModel.via = "error";
      docModel.raw = "";
      return docModel;
    }

    function rememberCurrent(doc) {
      if (!doc) return;
      session = Library.remember(session, {
        title: doc.title,
        url: doc.url,
        via: doc.via
      });
      writeSession(session);
    }

    function resumeLast() {
      if (session.last && session.last.url) {
        go(session.last.url, "push");
        return true;
      }
      printMsg("nothing to resume", "err");
      return false;
    }

    function applyLocalUrl(abs, nav) {
      if (Library.isHomeUrl(abs) || abs === "https://usc.local") {
        cancelPending();
        setCurrent(homeDocument(), nav || "push");
        return true;
      }
      if (Library.isSettingsUrl(abs)) {
        cancelPending();
        setCurrent(settingsDocument(), nav || "push");
        return true;
      }
      if (Library.isHistoryUrl(abs)) {
        cancelPending();
        setCurrent(historyDocument(), nav || "push");
        return true;
      }
      if (Library.isBookmarksUrl(abs)) {
        cancelPending();
        setCurrent(bookmarksDocument(), nav || "push");
        return true;
      }
      if (Library.isHelpUrl(abs)) {
        cancelPending();
        setCurrent(helpDocument(), nav || "push");
        return true;
      }
      if (Library.isAboutUrl(abs)) {
        cancelPending();
        setCurrent(aboutDocument(), nav || "push");
        return true;
      }
      if (Library.isResumeUrl(abs)) {
        return resumeLast();
      }
      if (Library.isSetUrl(abs)) {
        var change = Library.parseSetUrl(abs);
        if (!change) return true;
        if (change.key === "theme") {
          var themeVal = change.value === "auto" ? "system" : change.value;
          setTheme(themeVal, true);
        } else if (change.key === "proxy" && (change.value === "on" || change.value === "off" || change.value === "auto")) {
          proxyMode = change.value;
          storageSet(PROXY_KEY, proxyMode);
        } else if (change.key === "images" && (change.value === "on" || change.value === "off")) {
          imagesMode = change.value;
          storageSet(IMAGE_KEY, imagesMode);
        } else if (change.key === "font") {
          if (change.value === "+") fontSize += 1;
          else if (change.value === "-") fontSize -= 1;
          else if (change.value === "reset") fontSize = 15;
          fontSize = Math.max(12, Math.min(20, fontSize));
          storageSet(FONT_KEY, String(fontSize));
          applyAppearance();
        } else if (change.key === "recents" && change.value === "clear") {
          session = Library.clearSession();
          writeSession(session);
        }
        cancelPending();
        setCurrent(settingsDocument(), "replace");
        printMsg(
          change.key === "recents"
            ? "recents cleared"
            : change.key + " " + (change.key === "theme" ? themeLabel(themeMode) : change.value)
        );
        return true;
      }
      return false;
    }

    function setStatus(text) {
      status.textContent = text;
    }

    function applyAppearance() {
      if (themeMode === "system") doc.documentElement.removeAttribute("data-theme");
      else doc.documentElement.setAttribute("data-theme", themeMode);
      doc.documentElement.style.setProperty("--font-size", fontSize + "px");
      var light =
        themeMode === "light" ||
        (themeMode === "system" &&
          typeof matchMedia === "function" &&
          matchMedia("(prefers-color-scheme: light)").matches);
      var themeMeta = doc.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute("content", light ? "#f2f0e9" : "#141413");
      var appleBar = doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (appleBar) appleBar.setAttribute("content", light ? "default" : "black-translucent");
      if (themeBtn) {
        themeBtn.textContent = themeLabel(themeMode);
        themeBtn.setAttribute(
          "aria-label",
          "Theme " + themeLabel(themeMode) + " · tap to cycle dark, light, auto"
        );
      }
    }

    function setTheme(mode, quiet) {
      if (mode !== "dark" && mode !== "light" && mode !== "system") return;
      themeMode = mode;
      storageSet(THEME_KEY, themeMode);
      applyAppearance();
      if (!quiet) printMsg("theme " + themeLabel(themeMode));
    }

    function updateProgress() {
      if (!progress) return;
      var max = page.scrollHeight - page.clientHeight;
      var percent = max > 0 ? Math.round((page.scrollTop / max) * 100) : 0;
      progress.style.width = Math.max(0, Math.min(100, percent)) + "%";
    }

    function setLoading(active) {
      if (promptLabel) promptLabel.textContent = active ? "…" : "›";
      if (page) page.setAttribute("aria-busy", active ? "true" : "false");
    }

    function printMsg(text, className, href) {
      if (href) {
        var link = doc.createElement("a");
        link.className = (className ? className + " " : "") + "ln";
        link.href = "javascript:void(0)";
        link.setAttribute("data-url", href);
        link.title = href;
        link.textContent = text;
        msg.appendChild(link);
        msg.appendChild(doc.createTextNode("\n"));
      } else {
        var span = doc.createElement("span");
        if (className) span.className = className;
        span.textContent = text + "\n";
        msg.appendChild(span);
      }
      while (msg.childNodes.length > 40) msg.removeChild(msg.firstChild);
      msg.scrollTop = msg.scrollHeight;
    }

    function setHint(text) {
      if (hint) hint.textContent = text || "";
    }

    function copyText(text) {
      if (!text) return Promise.reject(new Error("nothing to copy"));
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        var area = doc.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        doc.body.appendChild(area);
        area.select();
        try {
          if (!doc.execCommand("copy")) throw new Error("copy failed");
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          area.remove();
        }
      });
    }

    function clearSuggestions() {
      suggestionWords = [];
      suggestionIndex = -1;
      tabComplete = "";
      setHint("");
    }

    function renderSuggestions() {
      var words = suggestionWords.slice(0, 6);
      setHint(
        words
          .map(function (word, index) {
            return (index === suggestionIndex ? "› " : "") + word;
          })
          .join("    ")
      );
    }

    function cachePut(url, fetched) {
      if (!url) return;
      if (!cache[url]) cacheOrder.push(url);
      cache[url] = fetched;
      while (cacheOrder.length > MAX_CACHE) {
        delete cache[cacheOrder.shift()];
      }
    }

    function cancelPending() {
      going += 1;
      if (abortCtrl) abortCtrl.abort();
      setLoading(false);
    }

    function applyImageMode(documentModel) {
      if (!documentModel || !documentModel.images) return;
      for (var i = 0; i < documentModel.images.length; i++) {
        if (imagesMode === "on") documentModel.images[i].loaded = true;
      }
    }

    function paintStatus() {
      if (!current || Library.isHomeUrl(current.url)) {
        setStatus(
          "theme " + themeLabel(themeMode) + "    proxy " + proxyMode + (session.last ? "    resume" : "")
        );
        return;
      }
      if (Library.isSurfaceUrl(current.url)) {
        var surface = "settings";
        if (Library.isHistoryUrl(current.url)) surface = "history";
        else if (Library.isBookmarksUrl(current.url)) surface = "bookmarks";
        else if (Library.isHelpUrl(current.url)) surface = "help";
        else if (Library.isAboutUrl(current.url)) surface = "about";
        setStatus(surface);
        return;
      }
      var host = current.url;
      try {
        host = new URL(current.url).host.replace(/^www\./, "");
      } catch (e) {}
      if (current.url.indexOf("usc.local/search") >= 0) host = "search";
      var bits = [current.title || host];
      if (current.title && current.title !== host) bits.push(host);
      if (current.links && current.links.length) bits.push(String(current.links.length));
      var mins = Library.readingMinutes(Browser.pageToPlainText(current));
      if (mins) bits.push(mins + " min");
      if (view !== "page") bits.push(view);
      if (imagesMode === "on") bits.push("img");
      if (current.via && current.via.indexOf("jina-") === 0) bits.push("via jina");
      else if (current.via && current.via.indexOf("search:") === 0) bits.push(current.via.slice(7));
      if (current.truncated) bits.push("cut");
      setStatus(bits.join("    "));
    }

    function appendFindText(parent, text) {
      if (!findQuery) {
        parent.appendChild(doc.createTextNode(text));
        return;
      }
      var q = findQuery;
      var lower = text.toLowerCase();
      var needle = q.toLowerCase();
      var from = 0;
      var at;
      while ((at = lower.indexOf(needle, from)) >= 0) {
        findMatches += 1;
        if (at > from) parent.appendChild(doc.createTextNode(text.slice(from, at)));
        var mark = doc.createElement("span");
        mark.className = "find";
        mark.textContent = text.slice(at, at + q.length);
        parent.appendChild(mark);
        from = at + q.length;
      }
      if (from < text.length) parent.appendChild(doc.createTextNode(text.slice(from)));
    }

    function paintTextView(text) {
      page.textContent = "";
      var span = doc.createElement("span");
      appendFindText(span, text);
      page.appendChild(span);
      page.scrollTop = 0;
    }

    function paintDoc(documentModel) {
      page.textContent = "";
      var loaded = {};
      for (var i = 0; i < documentModel.images.length; i++) {
        loaded[documentModel.images[i].n] = documentModel.images[i].loaded;
      }
      var tokens = documentModel.tokens || [];
      var homeSurface = Library.isHomeUrl(documentModel.url);
      var sawMark = false;
      for (var t = 0; t < tokens.length; t++) {
        var tok = tokens[t];
        if (tok.t === "nl") {
          page.appendChild(doc.createTextNode("\n"));
        } else if (tok.t === "text") {
          if (homeSurface && !sawMark && String(tok.v || "").replace(/^\s+/, "")) {
            var mark = doc.createElement("span");
            mark.className = "mark";
            mark.textContent = tok.v;
            page.appendChild(mark);
            sawMark = true;
          } else if (Library.isSurfaceUrl(documentModel.url) && Library.isSectionLabel(tok.v)) {
            var sec = doc.createElement("span");
            sec.className = "sec";
            sec.textContent = tok.v;
            page.appendChild(sec);
          } else {
            appendFindText(page, tok.v);
          }
        } else if (tok.t === "link") {
          var a = doc.createElement("a");
          a.className = "ln";
          // Avoid href="#" which rewrites the History API hash (#usc-N → #).
          a.href = "javascript:void(0)";
          a.setAttribute("data-url", tok.url);
          a.title = tok.url;
          a.setAttribute("draggable", "false");
          a.setAttribute("role", "link");
          appendFindText(a, "[" + tok.n + "] " + tok.v);
          page.appendChild(a);
        } else if (tok.t === "img") {
          if (loaded[tok.n]) {
            page.appendChild(doc.createTextNode("\n"));
            var label = doc.createElement("span");
            label.className = "imgph";
            label.textContent = "[img:" + tok.n + (tok.alt ? " " + tok.alt : "") + "]";
            page.appendChild(label);
            var img = doc.createElement("img");
            img.className = "pic";
            img.alt = tok.alt || "";
            img.loading = "lazy";
            img.decoding = "async";
            img.onerror = (function (image, imageLabel, imageNumber) {
              return function () {
                imageLabel.textContent += " failed";
                image.remove();
                if (documentModel.images[imageNumber - 1]) {
                  documentModel.images[imageNumber - 1].loaded = false;
                }
              };
            })(img, label, tok.n);
            img.src = tok.url;
            page.appendChild(img);
            page.appendChild(doc.createTextNode("\n"));
          } else {
            var ph = doc.createElement("a");
            ph.className = "ln imgph";
            ph.href = "javascript:void(0)";
            ph.setAttribute("data-image", String(tok.n));
            ph.setAttribute("aria-label", "Load image " + tok.n);
            ph.title = tok.url;
            ph.setAttribute("role", "link");
            ph.textContent = "[img:" + tok.n + (tok.alt ? " " + tok.alt : "") + "]";
            page.appendChild(ph);
          }
        }
      }
      page.scrollTop = 0;
    }

    function paint() {
      findMatches = 0;
      var home = current && Library.isHomeUrl(current.url) && view === "page";
      var libraryPage = current && Library.isSurfaceUrl(current.url) && !home && view === "page";
      var searchPage =
        current && current.url && String(current.url).indexOf("usc.local/search") >= 0 && view === "page";
      if (doc.body && doc.body.classList) {
        doc.body.classList.toggle("home", !!home);
        doc.body.classList.toggle("library", !!libraryPage);
        doc.body.classList.toggle("search-results", !!searchPage);
      }
      if (view === "help") {
        paintTextView(HELP);
      } else if (view === "about") {
        paintTextView(ABOUT);
      } else if (!current) {
        paintTextView("");
      } else if (view === "links") {
        paintTextView(
          current.links
            .map(function (l) {
              return "[" + l.n + "] " + l.text + "\n    " + l.url;
            })
            .join("\n") || "(no links)"
        );
      } else if (view === "imgs") {
        paintTextView(
          current.images
            .map(function (im) {
              return (
                "[img:" +
                im.n +
                "] " +
                (im.loaded ? "loaded" : "off") +
                "  " +
                (im.alt || "") +
                "\n    " +
                im.url
              );
            })
            .join("\n") || "(no images)"
        );
      } else if (view === "outline") {
        paintTextView(Browser.outlineText(current) || "(no headings)");
      } else if (view === "source") {
        paintTextView((current.raw || Browser.pageToPlainText(current)).slice(0, 24000));
      } else {
        paintDoc(current);
      }
      paintStatus();
      updateProgress();
    }

    function setCurrent(documentModel, nav) {
      current = documentModel;
      view = "page";
      findQuery = "";
      if (nav === "initial") {
        stack = [documentModel];
        stackPos = 0;
        documentModel._historySeq = historySeq;
        if (nativeHistory) {
          window.history.replaceState({ usc: true, seq: historySeq }, "", window.location.pathname);
        }
      } else if (nav === "replace") {
        var replaceSeq =
          stackPos >= 0 && stack[stackPos]._historySeq != null
            ? stack[stackPos]._historySeq
            : historySeq;
        if (stackPos >= 0) stack[stackPos] = documentModel;
        else {
          stack.push(documentModel);
          stackPos = 0;
        }
        stack[stackPos]._historySeq = replaceSeq;
        if (nativeHistory) {
          window.history.replaceState(
            { usc: true, seq: stack[stackPos]._historySeq },
            "",
            "#usc-" + stack[stackPos]._historySeq
          );
        }
      } else if (nav === "push") {
        stack = stack.slice(0, stackPos + 1);
        historySeq += 1;
        documentModel._historySeq = historySeq;
        stack.push(documentModel);
        if (stack.length > MAX_STACK) stack.shift();
        stackPos = stack.length - 1;
        if (nativeHistory) {
          window.history.pushState({ usc: true, seq: historySeq }, "", "#usc-" + historySeq);
        }
      }
      if (documentModel.title) doc.title = documentModel.title + " · USC";
      if (nav !== "initial") rememberCurrent(documentModel);
      paint();
    }

    function go(rawUrl, nav, title) {
      var abs = rawUrl;
      if (current && current.url && (rawUrl.charAt(0) === "/" || rawUrl.charAt(0) === "?" || rawUrl.charAt(0) === "#")) {
        abs = Browser.resolveUrl(rawUrl, current.url);
      } else {
        abs = Browser.normalizeUrl(rawUrl, current && current.url);
      }
      var stackNav = nav || "push";

      if (Library.isLocalHost(abs)) {
        if (isInternalSearchUrl(abs)) {
          var internalQuery = internalSearchQuery(abs);
          if (internalQuery) {
            showSearchResults(internalQuery);
            return;
          }
          cancelPending();
          setCurrent(homeDocument(), stackNav);
          return;
        }
        if (applyLocalUrl(abs, stackNav)) return;
        cancelPending();
        setCurrent(homeDocument(), stackNav);
        return;
      }

      if (applyLocalUrl(abs, stackNav)) return;

      var engineQuery = engineQueryFromUrl(abs);
      if (engineQuery) {
        var kind = engineHostKind(new URL(abs).hostname);
        showSearchResults(engineQuery, kind ? [kind] : ALL.slice());
        return;
      }
      var unwrapped = unwrapRedirectUrl(abs);
      if (unwrapped && unwrapped !== abs) {
        abs = unwrapped;
      }
      if (!Browser.isSafeHttpUrl(abs)) {
        printMsg("blocked url", "err");
        return;
      }
      if (isSearchEngineChromeUrl(abs)) {
        printMsg("search engine UI skipped · stay in USC", "err");
        return;
      }
      if (isImageUrl(abs)) {
        cancelPending();
        var imageDoc = Browser.markdownToDocument(
          "Title: image\nURL Source: " +
            abs +
            "\n\nMarkdown Content:\nimage\n\n![image](" +
            abs +
            ")\n\n" +
            abs +
            "\n\ni 1  load this image\n",
          abs
        );
        imageDoc.via = "image-link";
        applyImageMode(imageDoc);
        setCurrent(imageDoc, stackNav);
        return;
      }

      var fromSearch =
        (current && current.url && String(current.url).indexOf("usc.local/search") >= 0) ||
        isSearchEngineUrl(abs);
      var allowProxy = proxyMode !== "off" || isSearchEngineUrl(abs);
      var hit = cache[abs];

      cancelPending();
      setCurrent(loadingDocument(abs, title), stackNav);
      setLoading(true);
      setStatus(abs.replace(/^https?:\/\//, ""));
      msg.textContent = "";

      var controller = typeof AbortController === "function" ? new AbortController() : null;
      abortCtrl = controller;
      var ticket = going;
      var timedOut = false;
      var loadTimer = setTimeout(function () {
        timedOut = true;
        if (controller) controller.abort();
      }, LOAD_TIMEOUT);

      function finishPage(documentModel) {
        if (ticket !== going) return;
        clearTimeout(loadTimer);
        setLoading(false);
        applyImageMode(documentModel);
        setCurrent(documentModel, "replace");
      }

      function failPage(err) {
        clearTimeout(loadTimer);
        if (ticket !== going) return;
        setLoading(false);
        if (err && err.name === "AbortError" && !timedOut) {
          printMsg("stopped");
          return;
        }
        var message = timedOut ? "timeout" : err && err.message ? err.message : "error";
        printMsg("fetch failed: " + message, "err");
        setCurrent(errorDocument(abs, message), "replace");
      }

      var req = hit
        ? Promise.resolve(hit)
        : Browser.fetchPage(abs, {
            signal: controller && controller.signal,
            proxy: allowProxy,
            forceProxy: allowProxy && fromSearch,
            format: "markdown"
          });
      req
        .then(function (fetched) {
          if (ticket !== going) return;
          if (fetched.via === "direct-image" || isImageUrl(fetched.url || abs)) {
            var onlyImage = Browser.markdownToDocument(
              "Title: image\nURL Source: " +
                (fetched.url || abs) +
                "\n\nMarkdown Content:\nimage\n\n![image](" +
                (fetched.url || abs) +
                ")\n",
              fetched.url || abs
            );
            onlyImage.via = fetched.via || "image-link";
            finishPage(onlyImage);
            return;
          }
          var raw = fetched.text.slice(0, MAX_RAW);
          var stored = { url: fetched.url || abs, text: raw, via: fetched.via };
          cachePut(abs, stored);
          cachePut(stored.url, stored);
          var documentModel = Browser.parseFetched(raw, fetched.url || abs);
          documentModel.raw = raw;
          documentModel.via = fetched.via;
          var plain = Browser.pageToPlainText(documentModel).replace(/\s+/g, " ").trim();
          if (allowProxy && fetched.via.indexOf("jina-") !== 0 && plain.length < 120) {
            setStatus("retry text…");
            return Browser.fetchPage(abs, {
              signal: controller && controller.signal,
              forceProxy: true,
              format: "markdown"
            }).then(function (again) {
              if (ticket !== going) return;
              var raw2 = again.text.slice(0, MAX_RAW);
              cachePut(abs, { url: again.url || abs, text: raw2, via: again.via });
              var retryDoc = Browser.parseFetched(raw2, again.url || abs);
              retryDoc.raw = raw2;
              retryDoc.via = again.via;
              finishPage(retryDoc);
            });
          }
          finishPage(documentModel);
        })
        .catch(failPage);
    }

    function follow(index) {
      if (!current || !current.links[index - 1]) {
        showSearchResults(String(index));
        return;
      }
      var link = current.links[index - 1];
      go(link.url, "push", link.text);
    }

    function loadImages(which) {
      if (!current || !current.images.length) {
        printMsg("no images");
        return;
      }
      var n = 0;
      for (var i = 0; i < current.images.length; i++) {
        if (which === "all" || current.images[i].n === which) {
          current.images[i].loaded = true;
          n += 1;
        }
      }
      if (!n) printMsg("no such image", "err");
      else {
        printMsg("loaded " + (which === "all" ? "all images" : "img " + which));
        paint();
      }
    }

    function showSearchResults(query, selectedEngines) {
      cancelPending();
      var engines = (selectedEngines || ALL).filter(function (name) {
        return !!ENGINES[name];
      });
      if (!engines.length) engines = ALL.slice();
      // Multi-engine search also queries DuckDuckGo in parallel — reliable SERP via Jina.
      var fetchList = engines.slice();
      if (engines.length > 1 && fetchList.indexOf("duckduckgo") < 0) {
        fetchList.push("duckduckgo");
      }
      var ticket = ++going;
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      abortCtrl = controller;
      var timedOut = false;
      var loadTimer = setTimeout(function () {
        timedOut = true;
        if (controller) controller.abort();
      }, SEARCH_TIMEOUT);
      var loadingDoc = buildSearchDocument(query, [], {
        status: "searching…",
        engines: engines
      });
      setCurrent(loadingDoc, "push");
      var hubPos = stackPos;
      setLoading(true);
      setStatus("search");

      var batches = [];
      var related = [];
      var paintedOnce = false;
      var suggestEngines = engines.filter(function (name) {
        return name !== "duckduckgo";
      });
      if (!suggestEngines.length) suggestEngines = ALL.slice();

      function stillHere() {
        return ticket === going && stack[hubPos] && stackPos === hubPos;
      }

      function sourcesOf() {
        var sources = [];
        for (var i = 0; i < batches.length; i++) {
          if (batches[i].results && batches[i].results.length) sources.push(batches[i].name);
        }
        return sources;
      }

      function paintSearch(statusText, isFinal) {
        if (ticket !== going) return;
        if (stackPos !== hubPos) return;
        var merged = mergeSearchResults(batches);
        var sources = sourcesOf();
        var keepScroll = paintedOnce ? page.scrollTop : 0;
        var documentModel = buildSearchDocument(query, merged, {
          status: statusText || "",
          related: related,
          via: sources.length ? "search:" + sources.join("+") : "search",
          engines: engines,
          footer: merged.length
            ? "number / click → open text inside USC · real → outside"
            : isFinal
              ? "no results · try another query · real opens outside"
              : ""
        });
        documentModel._historySeq = loadingDoc._historySeq;
        current = documentModel;
        stack[hubPos] = documentModel;
        if (documentModel.title) doc.title = documentModel.title + " · USC";
        if (view === "page") paint();
        if (paintedOnce) page.scrollTop = keepScroll;
        paintedOnce = true;
        if (isFinal) {
          setLoading(false);
          clearTimeout(loadTimer);
        }
      }

      suggestMany(suggestEngines, query)
        .then(function (suggestions) {
          if (ticket !== going) return;
          var seen = {};
          related = [];
          for (var r = 0; r < suggestions.length; r++) {
            var list = suggestions[r].suggestions || [];
            for (var j = 0; j < list.length; j++) {
              var word = list[j];
              if (!word || word === query || seen[word]) continue;
              seen[word] = 1;
              related.push(word);
              if (related.length >= 8) break;
            }
            if (related.length >= 8) break;
          }
          if (!paintedOnce && related.length) paintSearch("searching…", false);
        })
        .catch(function () {});

      var pending = fetchList.length;
      if (!pending) {
        paintSearch("no engines", true);
        return;
      }

      fetchList.forEach(function (name) {
        fetchEngineResults(name, query, controller && controller.signal)
          .then(function (batch) {
            if (ticket !== going) return;
            batches.push(batch);
            pending -= 1;
            var merged = mergeSearchResults(batches);
            if (merged.length) {
              paintSearch(pending ? "searching…" : "", pending === 0);
            } else if (pending === 0) {
              paintSearch(timedOut ? "search timeout" : "", true);
            }
          })
          .catch(function (err) {
            if (ticket !== going) return;
            if (err && err.name === "AbortError" && !timedOut) {
              pending -= 1;
              if (pending <= 0) {
                setLoading(false);
                clearTimeout(loadTimer);
                printMsg("stopped");
              }
              return;
            }
            batches.push({
              name: name,
              results: [],
              error: err && err.message ? err.message : "error"
            });
            pending -= 1;
            if (pending === 0) paintSearch(timedOut ? "search timeout" : "", true);
          });
      });
    }

    function runSearch(cmd) {
      showSearchResults(cmd.query, cmd.engines);
    }

    function handle(cmd, line) {
      if (cmd.type === "help") {
        cancelPending();
        setCurrent(helpDocument(), "push");
        return;
      }
      if (cmd.type === "about") {
        cancelPending();
        setCurrent(aboutDocument(), "push");
        return;
      }
      if (cmd.type === "settings") {
        cancelPending();
        setCurrent(settingsDocument(), "push");
        return;
      }
      if (cmd.type === "resume") {
        resumeLast();
        return;
      }
      if (cmd.type === "clear") {
        msg.textContent = "";
        return;
      }
      if (cmd.type === "usage") {
        printMsg(cmd.message);
        return;
      }
      if (cmd.type === "home") {
        cancelPending();
        setCurrent(homeDocument(), "push");
        return;
      }
      if (cmd.type === "go") {
        go(cmd.url, "push");
        return;
      }
      if (cmd.type === "follow") {
        follow(cmd.index);
        return;
      }
      if (cmd.type === "back") {
        cancelPending();
        if (stackPos <= 0) {
          printMsg("no back");
          return;
        }
        if (nativeHistory) {
          window.history.back();
          return;
        }
        stackPos -= 1;
        current = stack[stackPos];
        view = "page";
        paint();
        return;
      }
      if (cmd.type === "forward") {
        cancelPending();
        if (stackPos >= stack.length - 1) {
          printMsg("no forward");
          return;
        }
        if (nativeHistory) {
          window.history.forward();
          return;
        }
        stackPos += 1;
        current = stack[stackPos];
        view = "page";
        paint();
        return;
      }
      if (cmd.type === "reload") {
        if (!current || !current.url || Library.isAppUrl(current.url)) {
          paint();
          return;
        }
        delete cache[current.url];
        go(current.url, "replace");
        return;
      }
      if (cmd.type === "stop") {
        var loading = current && current.via === "loading";
        cancelPending();
        printMsg("stopped");
        if (loading && stackPos > 0) {
          stack = stack.slice(0, stackPos);
          stackPos -= 1;
          current = stack[stackPos];
          view = "page";
          paint();
        }
        return;
      }
      if (cmd.type === "view") {
        view = cmd.view;
        paint();
        return;
      }
      if (cmd.type === "images") {
        if (cmd.mode === "on" || cmd.mode === "off") {
          imagesMode = cmd.mode;
          storageSet(IMAGE_KEY, imagesMode);
          if (imagesMode === "on" && current) applyImageMode(current);
          printMsg("images " + imagesMode);
          paint();
          return;
        }
        view = "imgs";
        paint();
        printMsg("images " + imagesMode + "  ·  img <n> to load one");
        return;
      }
      if (cmd.type === "proxy") {
        if (cmd.mode === "on" || cmd.mode === "off" || cmd.mode === "auto") {
          proxyMode = cmd.mode;
          storageSet(PROXY_KEY, proxyMode);
          printMsg(
            proxyMode === "off"
              ? "proxy off"
              : proxyMode === "on"
                ? "proxy on · pages may use r.jina.ai"
                : "proxy auto · Jina only when a site blocks direct reads"
          );
        } else {
          printMsg("proxy " + proxyMode);
        }
        return;
      }
      if (cmd.type === "theme") {
        if (cmd.mode === "cycle") setTheme(nextTheme(themeMode));
        else if (cmd.mode === "dark" || cmd.mode === "light" || cmd.mode === "system") {
          setTheme(cmd.mode);
        } else {
          printMsg("theme " + themeLabel(themeMode));
        }
        if (current && current.url === "https://usc.local/" && view === "page") paint();
        return;
      }
      if (cmd.type === "font") {
        if (cmd.value === "+") fontSize += 1;
        else if (cmd.value === "-") fontSize -= 1;
        else if (cmd.value === "reset") fontSize = 15;
        else if (/^\d{2}$/.test(cmd.value)) fontSize = parseInt(cmd.value, 10);
        fontSize = Math.max(12, Math.min(20, fontSize));
        storageSet(FONT_KEY, String(fontSize));
        applyAppearance();
        printMsg("font " + fontSize);
        return;
      }
      if (cmd.type === "copy") {
        var copyTarget = current && current.url;
        if (cmd.index) {
          copyTarget =
            current && current.links[cmd.index - 1] && current.links[cmd.index - 1].url;
        }
        if (!copyTarget || copyTarget.indexOf("usc.local") >= 0) {
          printMsg("nothing to copy", "err");
          return;
        }
        copyText(copyTarget)
          .then(function () {
            printMsg("copied");
          })
          .catch(function () {
            printMsg("copy failed", "err");
          });
        return;
      }
      if (cmd.type === "share") {
        var shareUrl = current && current.url;
        if (!shareUrl || shareUrl.indexOf("usc.local") >= 0) {
          printMsg("nothing to share", "err");
          return;
        }
        if (navigator.share) {
          navigator
            .share({ title: current.title || "USC", url: shareUrl })
            .catch(function (err) {
              if (!err || err.name !== "AbortError") printMsg("share failed", "err");
            });
        } else {
          copyText(shareUrl)
            .then(function () {
              printMsg("share unavailable · URL copied");
            })
            .catch(function () {
              printMsg("share unavailable", "err");
            });
        }
        return;
      }
      if (cmd.type === "scroll") {
        page.scrollTo({ top: cmd.edge === "top" ? 0 : page.scrollHeight, behavior: "smooth" });
        return;
      }
      if (cmd.type === "img") {
        loadImages(cmd.which);
        return;
      }
      if (cmd.type === "find") {
        findQuery = cmd.query;
        view = "page";
        paint();
        printMsg(findMatches + (findMatches === 1 ? " match" : " matches"));
        var hit = page.querySelector(".find");
        if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: "center" });
        return;
      }
      if (cmd.type === "where") {
        printMsg(current && current.url ? current.url : "(none)", "", current && current.url);
        return;
      }
      if (cmd.type === "title") {
        printMsg(current && current.title ? current.title : "(none)");
        return;
      }
      if (cmd.type === "history") {
        cancelPending();
        setCurrent(historyDocument(), "push");
        return;
      }
      if (cmd.type === "save") {
        if (!current) return;
        var blob = new Blob([Browser.pageToPlainText(current)], { type: "text/plain;charset=utf-8" });
        var a = doc.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (current.title || "page").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) + ".txt";
        a.click();
        printMsg("saved");
        return;
      }
      if (cmd.type === "real") {
        var target = current && current.url;
        if (cmd.index) {
          target = current && current.links[cmd.index - 1] && current.links[cmd.index - 1].url;
        }
        if (!target || target.indexOf("usc.local") >= 0) {
          printMsg("nothing to open", "err");
          return;
        }
        openExternal(target);
        printMsg(target, "", target);
        return;
      }
      if (cmd.type === "bookmark") {
        var marks = readBookmarks();
        if (cmd.index) {
          if (!marks[cmd.index - 1]) {
            printMsg("no such bookmark", "err");
            return;
          }
          go(marks[cmd.index - 1].url, "push");
          return;
        }
        if (!current || !current.url || current.url.indexOf("usc.local") >= 0) {
          printMsg("nothing to bookmark", "err");
          return;
        }
        for (var markIndex = 0; markIndex < marks.length; markIndex++) {
          if (marks[markIndex].url === current.url) {
            var dropped = marks.splice(markIndex, 1)[0];
            writeBookmarks(marks);
            printMsg("unstarred " + dropped.title);
            if (Library.isBookmarksUrl(current.url) || Library.isHomeUrl(current.url)) {
              setCurrent(Library.isHomeUrl(current.url) ? homeDocument() : bookmarksDocument(), "replace");
            }
            return;
          }
        }
        marks.push({ title: current.title, url: current.url });
        writeBookmarks(marks);
        printMsg("starred " + current.title);
        return;
      }
      if (cmd.type === "bookmarks") {
        cancelPending();
        setCurrent(bookmarksDocument(), "push");
        return;
      }
      if (cmd.type === "unbookmark") {
        var bm = readBookmarks();
        if (!bm[cmd.index - 1]) {
          printMsg("no such bookmark", "err");
          return;
        }
        var removed = bm.splice(cmd.index - 1, 1)[0];
        writeBookmarks(bm);
        printMsg("removed " + removed.title);
        if (current && (Library.isBookmarksUrl(current.url) || Library.isHomeUrl(current.url))) {
          setCurrent(Library.isHomeUrl(current.url) ? homeDocument() : bookmarksDocument(), "replace");
        }
        return;
      }
      if (cmd.type === "search") {
        runSearch(cmd);
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var line = input.value;
      var cmd = parseLine(line);
      if (cmd.type === "empty") return;
      if (cmd.type !== "clear") {
        cmdHistory.push(line);
        cmdPos = cmdHistory.length;
        draft = "";
      }
      clearSuggestions();
      input.value = "";
      handle(cmd, line);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && suggestionIndex >= 0 && tabComplete) {
        input.value = tabComplete;
        return;
      }
      if (event.key === "Tab" && tabComplete) {
        event.preventDefault();
        input.value = tabComplete;
        clearSuggestions();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        input.value = "";
        clearSuggestions();
        cancelPending();
        return;
      }
      if (!input.value && (event.key === " " || event.key === "PageDown")) {
        event.preventDefault();
        page.scrollBy(0, Math.round(page.clientHeight * 0.9));
        return;
      }
      if (!input.value && event.key === "PageUp") {
        event.preventDefault();
        page.scrollBy(0, -Math.round(page.clientHeight * 0.9));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (suggestionWords.length) {
          suggestionIndex =
            suggestionIndex <= 0 ? Math.min(5, suggestionWords.length - 1) : suggestionIndex - 1;
          tabComplete = suggestionWords[suggestionIndex] || "";
          renderSuggestions();
          return;
        }
        if (!cmdHistory.length) return;
        if (cmdPos === cmdHistory.length) draft = input.value;
        cmdPos = Math.max(0, cmdPos - 1);
        input.value = cmdHistory[cmdPos];
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (suggestionWords.length) {
          suggestionIndex = (suggestionIndex + 1) % Math.min(6, suggestionWords.length);
          tabComplete = suggestionWords[suggestionIndex] || "";
          renderSuggestions();
          return;
        }
        if (cmdPos < cmdHistory.length) cmdPos += 1;
        input.value = cmdPos === cmdHistory.length ? draft : cmdHistory[cmdPos];
      }
    });

    input.addEventListener("input", function () {
      var q = input.value.replace(/^\s+|\s+$/g, "");
      suggestionWords = [];
      suggestionIndex = -1;
      tabComplete = "";
      if (suggestTimer) clearTimeout(suggestTimer);
      if (q.charAt(0) === ":") {
        var commandQuery = q.toLowerCase();
        suggestionWords = COMMANDS.filter(function (command) {
          return command.indexOf(commandQuery) === 0;
        });
        tabComplete = suggestionWords[0] || "";
        renderSuggestions();
        return;
      }
      if (!q || parseLine(q).type !== "search") {
        setHint("");
        return;
      }
      suggestTimer = setTimeout(function () {
        suggestMany(ALL, q).then(function (results) {
          if (input.value.replace(/^\s+|\s+$/g, "") !== q) return;
          var seen = {};
          var words = [];
          for (var r = 0; r < results.length; r++) {
            var list = results[r].suggestions || [];
            for (var j = 0; j < list.length; j++) {
              var w = list[j];
              if (w && !seen[w]) {
                seen[w] = 1;
                words.push(w);
              }
            }
          }
          suggestionWords = words;
          suggestionIndex = -1;
          tabComplete = words[0] || "";
          renderSuggestions();
        });
      }, 280);
    });

    var lastActivateAt = 0;

    function followDataLink(event) {
      var el = eventElement(event.target);
      if (!el || !el.closest) return false;
      var imageButton = el.closest("[data-image]");
      if (imageButton) {
        event.preventDefault();
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        var nowImg = Date.now();
        if (nowImg - lastActivateAt < 450) return true;
        lastActivateAt = nowImg;
        loadImages(parseInt(imageButton.getAttribute("data-image"), 10));
        return true;
      }
      var a = el.closest("a.ln");
      if (!a) return false;
      event.preventDefault();
      if (typeof event.stopPropagation === "function") event.stopPropagation();
      var target = a.getAttribute("data-url");
      if (!target) return true;
      var now = Date.now();
      if (now - lastActivateAt < 450) return true;
      lastActivateAt = now;
      var label = (a.textContent || "").replace(/^\s*\[\d+\]\s*/, "");
      go(target, "push", label);
      return true;
    }

    page.addEventListener("click", followDataLink, true);
    msg.addEventListener("click", followDataLink, true);
    // Mobile browsers sometimes drop click after a DOM refresh; pointerup is more reliable.
    page.addEventListener(
      "pointerup",
      function (event) {
        if (event.pointerType === "mouse") return;
        followDataLink(event);
      },
      true
    );
    page.addEventListener(
      "auxclick",
      function (event) {
        if (event.button === 1) followDataLink(event);
      },
      true
    );

    if (nativeHistory) {
      window.addEventListener("popstate", function (event) {
        cancelPending();
        var state = event.state;
        if (!state || !state.usc) return;
        for (var i = 0; i < stack.length; i++) {
          if (stack[i]._historySeq === state.seq) {
            stackPos = i;
            current = stack[i];
            view = "page";
            findQuery = "";
            if (current.title) doc.title = current.title + " · USC";
            paint();
            return;
          }
        }
      });
    }

    if (themeBtn) {
      themeBtn.addEventListener("click", function (event) {
        event.preventDefault();
        setTheme(nextTheme(themeMode), true);
        if (current && current.url === "https://usc.local/" && view === "page") paint();
      });
    }

    doc.addEventListener("click", function (event) {
      var target = event.target;
      if (
        target.closest &&
        (target.closest("#page") ||
          target.closest("a") ||
          target.closest("#theme") ||
          target.closest("button") ||
          target.closest("#q"))
      ) {
        return;
      }
      input.focus();
    });

    page.addEventListener("scroll", updateProgress, { passive: true });

    doc.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && (event.key === "l" || event.key === "k")) {
        event.preventDefault();
        input.focus();
        input.select();
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        handle({ type: "back" }, "back");
        return;
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        handle({ type: "forward" }, "forward");
        return;
      }
      if (event.altKey && (event.key === "t" || event.key === "T")) {
        event.preventDefault();
        handle({ type: "theme", mode: "cycle" }, "theme");
        return;
      }
      if (
        event.key === "/" &&
        event.target !== input &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        input.focus();
      }
    });

    applyAppearance();
    setCurrent(homeDocument(), "initial");
    input.focus();

    if (typeof matchMedia === "function") {
      var scheme = matchMedia("(prefers-color-scheme: light)");
      var onScheme = function () {
        if (themeMode === "system") applyAppearance();
      };
      if (scheme.addEventListener) scheme.addEventListener("change", onScheme);
      else if (scheme.addListener) scheme.addListener(onScheme);
    }

    // Keep the prompt above the soft keyboard on mobile browsers.
    if (window.visualViewport) {
      var syncViewport = function () {
        var vv = window.visualViewport;
        var inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        doc.body.style.setProperty("--keyboard-inset", inset + "px");
        doc.documentElement.style.height = vv.height + "px";
        doc.body.style.height = vv.height + "px";
      };
      window.visualViewport.addEventListener("resize", syncViewport);
      window.visualViewport.addEventListener("scroll", syncViewport);
      syncViewport();
    }
  }

  return {
    ALL: ALL,
    ENGINES: ENGINES,
    parseLine: parseLine,
    nextTheme: nextTheme,
    themeLabel: themeLabel,
    suggestMany: suggestMany,
    isSearchEngineUrl: isSearchEngineUrl,
    isSearchEngineResultPage: isSearchEngineResultPage,
    engineQueryFromUrl: engineQueryFromUrl,
    unwrapRedirectUrl: unwrapRedirectUrl,
    extractSearchResults: extractSearchResults,
    mergeSearchResults: mergeSearchResults,
    buildSearchDocument: buildSearchDocument,
    isImageUrl: isImageUrl,
    isInternalSearchUrl: isInternalSearchUrl,
    internalSearchQuery: internalSearchQuery,
    internalSearchUrl: internalSearchUrl,
    Library: Library,
    mount: mount,
    Browser: Browser
  };
});
