(function (root, factory) {
  var Browser = root.USCBrowser;
  var Library = root.USCLibrary;
  if (!Browser && typeof require === "function") Browser = require("./browser.js");
  if (!Library && typeof require === "function") Library = require("./library.js");
  var api = factory(Browser, Library);
  root.USCSearch = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Browser, Library) {
  var ALL = ["google", "bing", "baidu"];
  var SUGGEST_LIMIT = 8;
  var JSONP_TIMEOUT = 5000;
  var ENGINE_TIMEOUT = 9000;
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

  function listFrom(value) {
    if (!Array.isArray(value)) return [];
    var out = [];
    for (var i = 0; i < value.length && out.length < SUGGEST_LIMIT; i++) {
      var item = value[i];
      if (typeof item === "string" && item) out.push(item);
    }
    return out;
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
    })
      .then(function (data) {
        return { name: name, suggestions: engine.parseSuggest(data), url: engine.searchUrl(query) };
      })
      .catch(function (err) {
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
    var raw = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
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
      if (Browser.isNoiseWikiUrl && Browser.isNoiseWikiUrl(url)) return false;
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

    for (var i = 0; i < lines.length && results.length < RESULT_LIMIT; i++) {
      var headingLine = stripMarkdownImages(lines[i]);
      if (!/^#{1,6}\s*\[/.test(headingLine)) continue;
      var heading = Browser.firstMarkdownLink(headingLine.replace(/^#{1,6}\s*/, ""));
      if (!heading || !/^https?:/i.test(heading.url)) continue;
      pushResult(heading.text, heading.url, snippetAfter(i));
    }

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

  function buildSearchDocument(query, results, meta) {
    meta = meta || {};
    var hubUrl = Library.searchUrl(query);
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
      var host = Library.hostOf(item.url);
      if (host) label += " · " + host;
      md += "[" + label + "](" + Library.mdHref(item.url) + ")\n";
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
          Library.mdHref(Library.searchUrl(meta.related[r])) +
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

  return {
    ALL: ALL,
    ENGINES: ENGINES,
    listFrom: listFrom,
    suggestMany: suggestMany,
    engineHostKind: engineHostKind,
    isSearchEngineUrl: isSearchEngineUrl,
    unwrapRedirectUrl: unwrapRedirectUrl,
    engineQueryFromUrl: engineQueryFromUrl,
    isSearchEngineResultPage: isSearchEngineResultPage,
    isSearchEngineChromeUrl: isSearchEngineChromeUrl,
    isImageUrl: isImageUrl,
    extractSearchResults: extractSearchResults,
    mergeSearchResults: mergeSearchResults,
    fetchEngineResults: fetchEngineResults,
    buildSearchDocument: buildSearchDocument
  };
});
