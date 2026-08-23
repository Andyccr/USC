(function (root, factory) {
  var Browser = root.USCBrowser;
  if (!Browser && typeof require === "function") Browser = require("./browser.js");
  var api = factory(Browser);
  root.USC = api;
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount(document);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Browser) {
  var ALL = ["google", "bing", "baidu"];
  var SUGGEST_LIMIT = 8;
  var JSONP_TIMEOUT = 5000;
  var MAX_STACK = 40;
  var MAX_CACHE = 20;
  var MAX_RAW = 2000000;
  var LOAD_TIMEOUT = 15000;
  var BOOKMARK_KEY = "usc.bookmarks";
  var IMAGE_KEY = "usc.images";
  var PROXY_KEY = "usc.proxy";
  var THEME_KEY = "usc.theme";
  var FONT_KEY = "usc.font";
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
    ":theme dark",
    ":theme light",
    ":theme system",
    ":font +",
    ":font -",
    ":font reset",
    ":proxy on",
    ":proxy off",
    ":help"
  ];

  var ENGINES = {
    google: {
      aliases: ["g", "google"],
      searchUrl: function (q) {
        return "https://www.google.com/search?q=" + encodeURIComponent(q);
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
    }
  };

  var HELP =
    "type to search\n" +
    "url to open\n" +
    "number to follow a link\n" +
    "\n" +
    "back     home     help\n" +
    "i 1      load image 1\n" +
    "i on     always load images\n" +
    "proxy on  allow Jina fallback\n" +
    "theme     dark / light / system\n" +
    "font +    adjust text size\n" +
    "copy      copy current URL\n" +
    "share     share current page\n" +
    "g hello  google only\n" +
    "s back   search a command word\n" +
    "real     open outside\n" +
    ":cmd     any command\n" +
    "\n" +
    "links stay as text inside USC\n";

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
    if (lower === "theme") return { type: "theme", mode: "show" };
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
      if (rest === "dark" || rest === "light" || rest === "system") {
        return { type: "theme", mode: rest };
      }
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
      if (rest === "on" || rest === "off") return { type: "proxy", mode: rest };
      return { type: "usage", message: "proxy on|off" };
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

  function isSearchEngineUrl(url) {
    try {
      var host = new URL(url).hostname.replace(/^www\./, "");
      return (
        host === "google.com" ||
        host === "bing.com" ||
        host === "baidu.com" ||
        /\.google\.[a-z.]+$/i.test(host)
      );
    } catch (e) {
      return false;
    }
  }

  function isInternalSearchUrl(url) {
    try {
      var u = new URL(url);
      return u.hostname === "usc.local" && (u.pathname === "/search" || u.pathname === "/");
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

  function homeDocument() {
    return Browser.markdownToDocument(
      "Title: USC\nURL Source: https://usc.local/\n\nMarkdown Content:\nUSC\n",
      "https://usc.local/"
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
    if (!page || !status || !msg || !form || !input) return;

    var cmdHistory = [];
    var cmdPos = -1;
    var draft = "";
    var stack = [];
    var stackPos = -1;
    var current = null;
    var view = "page";
    var imagesMode = storageGet(IMAGE_KEY, "off") === "on" ? "on" : "off";
    var proxyMode = storageGet(PROXY_KEY, "off") === "on" ? "on" : "off";
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

    function setStatus(text) {
      status.textContent = text;
    }

    function applyAppearance() {
      if (themeMode === "system") doc.documentElement.removeAttribute("data-theme");
      else doc.documentElement.setAttribute("data-theme", themeMode);
      doc.documentElement.style.setProperty("--font-size", fontSize + "px");
      var themeMeta = doc.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        var light =
          themeMode === "light" ||
          (themeMode === "system" &&
            typeof matchMedia === "function" &&
            matchMedia("(prefers-color-scheme: light)").matches);
        themeMeta.setAttribute("content", light ? "#f2f0e9" : "#141413");
      }
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
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;
        if (className) link.className = className;
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
      if (!current || current.url === "https://usc.local/") {
        setStatus("");
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
      if (view !== "page") bits.push(view);
      if (imagesMode === "on") bits.push("img");
      if (current.via && current.via.indexOf("jina-") === 0) bits.push("via jina");
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
      for (var t = 0; t < tokens.length; t++) {
        var tok = tokens[t];
        if (tok.t === "nl") {
          page.appendChild(doc.createTextNode("\n"));
        } else if (tok.t === "text") {
          appendFindText(page, tok.v);
        } else if (tok.t === "link") {
          var a = doc.createElement("a");
          a.className = "ln";
          a.href = tok.url;
          a.rel = "noopener noreferrer";
          a.setAttribute("data-url", tok.url);
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
            var ph = doc.createElement("button");
            ph.type = "button";
            ph.className = "imgph";
            ph.setAttribute("data-image", String(tok.n));
            ph.setAttribute("aria-label", "Load image " + tok.n);
            ph.textContent = "[img:" + tok.n + (tok.alt ? " " + tok.alt : "") + "]";
            page.appendChild(ph);
          }
        }
      }
      page.scrollTop = 0;
    }

    function paintHome() {
      page.textContent = "";
      var wrap = doc.createElement("div");
      var mark = doc.createElement("div");
      mark.className = "mark";
      mark.textContent = "USC";
      var hintLine = doc.createElement("div");
      hintLine.className = "hint";
      hintLine.textContent = "search or url";
      wrap.appendChild(mark);
      wrap.appendChild(hintLine);
      page.appendChild(wrap);
    }

    function paint() {
      findMatches = 0;
      var home = current && current.url === "https://usc.local/" && view === "page";
      if (doc.body && doc.body.classList) doc.body.classList.toggle("home", !!home);
      if (home) {
        paintHome();
        paintStatus();
        updateProgress();
        return;
      }
      if (view === "help") {
        paintTextView(HELP);
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
      paint();
    }

    function go(rawUrl, nav) {
      var abs = rawUrl;
      if (current && current.url && (rawUrl.charAt(0) === "/" || rawUrl.charAt(0) === "?" || rawUrl.charAt(0) === "#")) {
        abs = Browser.resolveUrl(rawUrl, current.url);
      } else {
        abs = Browser.normalizeUrl(rawUrl, current && current.url);
      }
      if (isInternalSearchUrl(abs)) {
        var internalQuery = internalSearchQuery(abs);
        if (internalQuery) {
          showSearchHub(internalQuery);
          return;
        }
        cancelPending();
        setCurrent(homeDocument(), nav || "push");
        return;
      }
      if (!Browser.isSafeHttpUrl(abs) && abs !== "https://usc.local/") {
        printMsg("blocked url", "err");
        return;
      }
      if (abs === "https://usc.local/") {
        cancelPending();
        setCurrent(homeDocument(), nav || "push");
        return;
      }
      if (abortCtrl) abortCtrl.abort();
      var controller = typeof AbortController === "function" ? new AbortController() : null;
      abortCtrl = controller;
      var ticket = ++going;
      var timedOut = false;
      var loadTimer = setTimeout(function () {
        timedOut = true;
        if (controller) controller.abort();
      }, LOAD_TIMEOUT);
      setLoading(true);
      setStatus(abs.replace(/^https?:\/\//, ""));
      msg.textContent = "";
      var hit = cache[abs];
      var req = hit
        ? Promise.resolve(hit)
        : Browser.fetchPage(abs, {
            signal: controller && controller.signal,
            proxy: proxyMode === "on"
          });
      req
        .then(function (fetched) {
          clearTimeout(loadTimer);
          if (ticket !== going) return;
          setLoading(false);
          var raw = fetched.text.slice(0, MAX_RAW);
          var stored = { url: fetched.url || abs, text: raw, via: fetched.via };
          cachePut(abs, stored);
          cachePut(stored.url, stored);
          var documentModel = Browser.parseFetched(raw, fetched.url || abs);
          documentModel.raw = raw;
          documentModel.via = fetched.via;
          applyImageMode(documentModel);
          setCurrent(documentModel, nav || "push");
        })
        .catch(function (err) {
          clearTimeout(loadTimer);
          if (ticket !== going) return;
          setLoading(false);
          if (err && err.name === "AbortError" && !timedOut) {
            printMsg("stopped");
            return;
          }
          var message = timedOut ? "timeout" : err && err.message ? err.message : "error";
          printMsg("fetch failed: " + message, "err");
          printMsg(abs, "", abs);
          var hint =
            "real  opens this URL in a normal browser\n" +
            (proxyMode === "on"
              ? ""
              : "proxy on  retry via Jina when the site blocks direct reads\n");
          var stub = Browser.markdownToDocument(
            "Title: " +
              abs +
              "\nURL Source: " +
              abs +
              "\n\nMarkdown Content:\nfetch failed: " +
              message +
              "\n\n[" +
              abs +
              "](" +
              abs +
              ")\n\n" +
              hint,
            abs
          );
          stub.via = "error";
          stub.raw = "";
          setCurrent(stub, nav || "push");
        });
    }

    function follow(index) {
      if (!current || !current.links[index - 1]) {
        showSearchHub(String(index));
        return;
      }
      go(current.links[index - 1].url, "push");
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

    function showSearchHub(query, selectedEngines) {
      cancelPending();
      var ticket = ++going;
      var engines = selectedEngines || ALL;
      var hubUrl = internalSearchUrl(query);
      var md =
        "Title: " +
        query +
        "\nURL Source: " +
        hubUrl +
        "\n\nMarkdown Content:\n" +
        query +
        "\n\nnumber opens as text · real opens outside · proxy on if blocked\n\n";
      for (var i = 0; i < engines.length; i++) {
        var name = engines[i];
        md += "[" + name + "](" + ENGINES[name].searchUrl(query) + ")\n";
      }
      var documentModel = Browser.markdownToDocument(md, hubUrl);
      setCurrent(documentModel, "push");
      var hubPos = stackPos;
      suggestMany(engines, query).then(function (results) {
        if (ticket !== going || current !== documentModel || stack[hubPos] !== documentModel) return;
        var extra = "\n";
        for (var r = 0; r < results.length; r++) {
          extra += "\n" + results[r].name + "\n";
          for (var j = 0; j < results[r].suggestions.length; j++) {
            var word = results[r].suggestions[j];
            extra += "[" + word + "](" + internalSearchUrl(word) + ")\n";
          }
        }
        var merged = Browser.markdownToDocument(md + extra, hubUrl);
        merged.via = "suggest";
        merged._historySeq = documentModel._historySeq;
        current = merged;
        stack[hubPos] = merged;
        if (view === "page") paint();
      });
    }

    function runSearch(cmd) {
      showSearchHub(cmd.query, cmd.engines);
    }

    function handle(cmd, line) {
      if (cmd.type === "help") {
        cancelPending();
        view = "help";
        paint();
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
        if (!current || !current.url || current.url.indexOf("usc.local") >= 0) {
          paint();
          return;
        }
        delete cache[current.url];
        go(current.url, "replace");
        return;
      }
      if (cmd.type === "stop") {
        cancelPending();
        printMsg("stopped");
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
        if (cmd.mode === "on" || cmd.mode === "off") {
          proxyMode = cmd.mode;
          storageSet(PROXY_KEY, proxyMode);
          printMsg(
            proxyMode === "on"
              ? "proxy on · failed pages may be sent to r.jina.ai"
              : "proxy off"
          );
        } else {
          printMsg("proxy " + proxyMode);
        }
        return;
      }
      if (cmd.type === "theme") {
        if (cmd.mode === "dark" || cmd.mode === "light" || cmd.mode === "system") {
          themeMode = cmd.mode;
          storageSet(THEME_KEY, themeMode);
          applyAppearance();
        }
        printMsg("theme " + themeMode);
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
        if (!stack.length) printMsg("(empty)");
        for (var h = 0; h < stack.length; h++) {
          printMsg((h === stackPos ? "* " : "  ") + stack[h].title + "  " + stack[h].url);
        }
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
            printMsg("already bookmarked");
            return;
          }
        }
        marks.push({ title: current.title, url: current.url });
        writeBookmarks(marks);
        printMsg("bookmarked " + current.title);
        return;
      }
      if (cmd.type === "bookmarks") {
        var list = readBookmarks();
        if (!list.length) printMsg("(no bookmarks)");
        for (var b = 0; b < list.length; b++) {
          printMsg("[" + (b + 1) + "] " + list[b].title + "  " + list[b].url);
        }
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

    page.addEventListener("click", function (event) {
      var imageButton = event.target.closest ? event.target.closest("button[data-image]") : null;
      if (imageButton) {
        loadImages(parseInt(imageButton.getAttribute("data-image"), 10));
        return;
      }
      var a = event.target.closest ? event.target.closest("a.ln") : null;
      if (!a) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      go(a.getAttribute("data-url"), "push");
    });

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

    doc.addEventListener("click", function (event) {
      var target = event.target;
      if (target.closest && (target.closest("#page") || target.closest("a"))) return;
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
  }

  return {
    ALL: ALL,
    ENGINES: ENGINES,
    parseLine: parseLine,
    suggestMany: suggestMany,
    isSearchEngineUrl: isSearchEngineUrl,
    isInternalSearchUrl: isInternalSearchUrl,
    internalSearchQuery: internalSearchQuery,
    internalSearchUrl: internalSearchUrl,
    mount: mount,
    Browser: Browser
  };
});
