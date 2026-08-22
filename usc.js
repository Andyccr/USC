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
  var BOOKMARK_KEY = "usc.bookmarks";
  var IMAGE_KEY = "usc.images";

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
    "USC  pure-text browser\n" +
    "\n" +
    "open\n" +
    "  go <url>            open a page\n" +
    "  <url>               same as go\n" +
    "  <n>  |  open <n>    follow link n\n" +
    "  back  |  forward    history\n" +
    "  reload  |  stop     reload or abort\n" +
    "  home                start screen\n" +
    "  real [n]            open current (or link n) in a real browser\n" +
    "\n" +
    "page\n" +
    "  links  |  imgs      list links / images\n" +
    "  outline | source    headings / raw dump\n" +
    "  page                back to rendered page\n" +
    "  find <text>         find in page\n" +
    "  save                download page as .txt\n" +
    "  url  |  title       show current location\n" +
    "  history             session history\n" +
    "\n" +
    "images  (off by default)\n" +
    "  images on|off       auto-load images on later pages\n" +
    "  img <n>             load image n on this page\n" +
    "  img all             load every image on this page\n" +
    "\n" +
    "search\n" +
    "  <query>             google + bing + baidu hub\n" +
    "  g|b|d <query>       open that engine in this browser\n" +
    "  all <query>         same as a bare query\n" +
    "\n" +
    "bookmarks\n" +
    "  bookmark            save current page\n" +
    "  bookmarks           list\n" +
    "  bookmark <n>        open bookmark n\n" +
    "  unbookmark <n>      remove\n" +
    "\n" +
    "  help  |  clear\n" +
    "  space / pageup / pagedown scroll the page when the prompt is empty\n";

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

    var lower = text.toLowerCase();
    if (lower === "help" || lower === "?" || lower === ":help") return { type: "help" };
    if (lower === "clear" || lower === "cls" || lower === ":clear") return { type: "clear" };
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
    if (/^\d+$/.test(text)) return { type: "follow", index: parseInt(text, 10) };

    var parts = text.split(/\s+/);
    var head = parts[0].toLowerCase();
    var rest = text.slice(parts[0].length).replace(/^\s+/, "");

    if (head === "go" || head === "open" || head === "visit") {
      if (!rest) return { type: "usage", message: "usage: " + head + " <url|n>" };
      if (/^\d+$/.test(rest)) return { type: "follow", index: parseInt(rest, 10) };
      return { type: "go", url: rest };
    }
    if (head === "img") {
      if (rest === "all") return { type: "img", which: "all" };
      if (/^\d+$/.test(rest)) return { type: "img", which: parseInt(rest, 10) };
      return { type: "usage", message: "usage: img <n|all>" };
    }
    if (head === "images") {
      if (rest === "on" || rest === "off") return { type: "images", mode: rest };
      return { type: "usage", message: "usage: images [on|off]" };
    }
    if (head === "find" || head === "/") {
      if (!rest) return { type: "usage", message: "usage: find <text>" };
      return { type: "find", query: rest };
    }
    if (head === "real") {
      if (/^\d+$/.test(rest)) return { type: "real", index: parseInt(rest, 10) };
      return { type: "usage", message: "usage: real [n]" };
    }
    if (head === "bookmark") {
      if (/^\d+$/.test(rest)) return { type: "bookmark", index: parseInt(rest, 10) };
      return { type: "usage", message: "usage: bookmark [n]" };
    }
    if (head === "unbookmark") {
      if (!/^\d+$/.test(rest)) return { type: "usage", message: "usage: unbookmark <n>" };
      return { type: "unbookmark", index: parseInt(rest, 10) };
    }
    if (head === "all") {
      if (!rest) return { type: "usage", message: "usage: all <query>" };
      return { type: "search", engines: ALL.slice(), query: rest };
    }
    for (var name in ENGINES) {
      if (ENGINES[name].aliases.indexOf(head) !== -1) {
        if (!rest) return { type: "usage", message: "usage: " + head + " <query>" };
        return { type: "search", engines: [name], query: rest };
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
      "Title: USC\nURL Source: https://usc.local/\n\nMarkdown Content:\n" +
        "# USC\n" +
        "pure-text browser  ·  google · bing · baidu\n\n" +
        "type a URL, a query, or help\n" +
        "images are off until you say otherwise\n\n" +
        "[example.com](https://example.com/)\n" +
        "[Wikipedia / Lynx](https://en.wikipedia.org/wiki/Lynx_(web_browser))\n",
      "https://usc.local/"
    );
  }

  function mount(doc) {
    var page = doc.getElementById("page");
    var status = doc.getElementById("status");
    var msg = doc.getElementById("msg");
    var form = doc.getElementById("prompt");
    var input = doc.getElementById("q");
    if (!page || !status || !msg || !form || !input) return;

    var cmdHistory = [];
    var cmdPos = -1;
    var draft = "";
    var stack = [];
    var stackPos = -1;
    var current = null;
    var view = "page";
    var imagesMode = storageGet(IMAGE_KEY, "off") === "on" ? "on" : "off";
    var abortCtrl = null;
    var findQuery = "";
    var cache = {};
    var going = 0;

    function setStatus(text) {
      status.textContent = text;
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

    function echo(line) {
      printMsg("usc> " + line);
    }

    function applyImageMode(documentModel) {
      if (!documentModel || !documentModel.images) return;
      for (var i = 0; i < documentModel.images.length; i++) {
        if (imagesMode === "on") documentModel.images[i].loaded = true;
      }
    }

    function paintStatus() {
      if (!current) {
        setStatus("usc  ·  img:" + imagesMode);
        return;
      }
      var bits = [
        current.url || "",
        current.title || "",
        current.links.length + " links",
        current.images.length + " images",
        "img:" + imagesMode
      ];
      if (view !== "page") bits.push("view:" + view);
      setStatus(bits.filter(Boolean).join("  ·  "));
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
            img.src = tok.url;
            page.appendChild(img);
            page.appendChild(doc.createTextNode("\n"));
          } else {
            var ph = doc.createElement("span");
            ph.className = "imgph";
            ph.textContent = "[img:" + tok.n + (tok.alt ? " " + tok.alt : "") + "]";
            page.appendChild(ph);
          }
        }
      }
      page.scrollTop = 0;
    }

    function paint() {
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
    }

    function setCurrent(documentModel, nav) {
      current = documentModel;
      view = "page";
      if (nav === "replace") {
        if (stackPos >= 0) stack[stackPos] = documentModel;
        else {
          stack.push(documentModel);
          stackPos = 0;
        }
      } else if (nav === "push") {
        stack = stack.slice(0, stackPos + 1);
        stack.push(documentModel);
        if (stack.length > MAX_STACK) stack.shift();
        stackPos = stack.length - 1;
      }
      paint();
    }

    function go(rawUrl, nav) {
      var abs = rawUrl;
      if (current && current.url && (rawUrl.charAt(0) === "/" || rawUrl.charAt(0) === "?" || rawUrl.charAt(0) === "#")) {
        abs = Browser.resolveUrl(rawUrl, current.url);
      } else {
        abs = Browser.normalizeUrl(rawUrl, current && current.url);
      }
      if (!Browser.isSafeHttpUrl(abs) && abs !== "https://usc.local/") {
        printMsg("blocked url", "err");
        return;
      }
      if (abs === "https://usc.local/") {
        setCurrent(homeDocument(), nav || "push");
        return;
      }
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = typeof AbortController === "function" ? new AbortController() : null;
      var ticket = ++going;
      printMsg("loading " + abs + " …");
      var hit = cache[abs];
      var req = hit
        ? Promise.resolve(hit)
        : Browser.fetchPage(abs, { signal: abortCtrl && abortCtrl.signal });
      req
        .then(function (fetched) {
          if (ticket !== going) return;
          cache[fetched.url || abs] = fetched;
          var documentModel = Browser.parseFetched(fetched.text, fetched.url || abs);
          documentModel.raw = fetched.text;
          documentModel.via = fetched.via;
          applyImageMode(documentModel);
          setCurrent(documentModel, nav || "push");
          printMsg((documentModel.title || abs) + "  via " + fetched.via);
        })
        .catch(function (err) {
          if (ticket !== going) return;
          if (err && err.name === "AbortError") {
            printMsg("stopped");
            return;
          }
          printMsg("fetch failed: " + (err && err.message ? err.message : "error"), "err");
          printMsg(abs, "", abs);
        });
    }

    function follow(index) {
      if (!current || !current.links[index - 1]) {
        printMsg("no such link", "err");
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

    function showSearchHub(query) {
      var md =
        "Title: search " +
        query +
        "\nURL Source: https://usc.local/search\n\nMarkdown Content:\n# search  " +
        query +
        "\n\n";
      for (var i = 0; i < ALL.length; i++) {
        var name = ALL[i];
        md += "[" + name + "](" + ENGINES[name].searchUrl(query) + ")\n";
      }
      var documentModel = Browser.markdownToDocument(md, "https://usc.local/search");
      setCurrent(documentModel, "push");
      suggestMany(ALL, query).then(function (results) {
        var extra = "\n## suggest\n";
        for (var r = 0; r < results.length; r++) {
          extra += "\n" + results[r].name + "\n";
          if (results[r].error) extra += "(" + results[r].error + ")\n";
          for (var j = 0; j < results[r].suggestions.length; j++) {
            extra += "* " + results[r].suggestions[j] + "\n";
          }
        }
        var merged = Browser.markdownToDocument(md + extra, "https://usc.local/search");
        merged.via = "suggest";
        current = merged;
        stack[stackPos] = merged;
        if (view === "page") paint();
      });
    }

    function runSearch(cmd) {
      if (cmd.engines.length === 1) {
        go(ENGINES[cmd.engines[0]].searchUrl(cmd.query), "push");
        suggestMany(cmd.engines, cmd.query).then(function (results) {
          var row = results[0];
          if (!row) return;
          if (row.error) printMsg(row.name + ": " + row.error, "err");
          for (var j = 0; j < row.suggestions.length; j++) printMsg("  " + row.suggestions[j]);
        });
        return;
      }
      showSearchHub(cmd.query);
    }

    function handle(cmd, line) {
      if (cmd.type === "help") {
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
        if (stackPos <= 0) {
          printMsg("no back");
          return;
        }
        stackPos -= 1;
        current = stack[stackPos];
        view = "page";
        paint();
        return;
      }
      if (cmd.type === "forward") {
        if (stackPos >= stack.length - 1) {
          printMsg("no forward");
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
        going += 1;
        if (abortCtrl) abortCtrl.abort();
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
      if (cmd.type === "img") {
        loadImages(cmd.which);
        return;
      }
      if (cmd.type === "find") {
        findQuery = cmd.query;
        view = "page";
        paint();
        printMsg("find " + findQuery);
        var hit = page.querySelector(".find");
        if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: "center" });
        else printMsg("not found");
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
        echo(line);
      }
      input.value = "";
      handle(cmd, line);
    });

    input.addEventListener("keydown", function (event) {
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
        if (!cmdHistory.length) return;
        if (cmdPos === cmdHistory.length) draft = input.value;
        cmdPos = Math.max(0, cmdPos - 1);
        input.value = cmdHistory[cmdPos];
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (cmdPos < cmdHistory.length) cmdPos += 1;
        input.value = cmdPos === cmdHistory.length ? draft : cmdHistory[cmdPos];
      }
    });

    page.addEventListener("click", function (event) {
      var a = event.target.closest ? event.target.closest("a.ln") : null;
      if (!a) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      go(a.getAttribute("data-url"), "push");
    });

    doc.addEventListener("click", function (event) {
      var target = event.target;
      if (target.closest && (target.closest("#page") || target.closest("a"))) return;
      input.focus();
    });

    setCurrent(homeDocument(), "push");
    input.focus();
  }

  return {
    ALL: ALL,
    ENGINES: ENGINES,
    parseLine: parseLine,
    suggestMany: suggestMany,
    mount: mount,
    Browser: Browser
  };
});
