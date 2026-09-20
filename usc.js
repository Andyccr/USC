(function (root, factory) {
  var Browser = root.USCBrowser;
  var Library = root.USCLibrary;
  var Search = root.USCSearch;
  if (!Browser && typeof require === "function") Browser = require("./browser.js");
  if (!Library && typeof require === "function") Library = require("./library.js");
  if (!Search && typeof require === "function") Search = require("./search.js");
  var api = factory(Browser, Library, Search);
  root.USC = api;
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount(document);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Browser, Library, Search) {
  var ALL = Search.ALL;
  var ENGINES = Search.ENGINES;
  var MAX_STACK = 40;
  var MAX_CACHE = 20;
  var MAX_RAW = 2000000;
  var LOAD_TIMEOUT = 15000;
  var SEARCH_TIMEOUT = 22000;
  var BOOKMARK_KEY = "usc.bookmarks";
  var IMAGE_KEY = "usc.images";
  var PROXY_KEY = "usc.proxy";
  var THEME_KEY = "usc.theme";
  var FONT_KEY = "usc.font";
  var SESSION_KEY = "usc.session";
  var PAGE_DB = "usc-pages";
  var PAGE_STORE = "pages";
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
    ":install",
    ":help"
  ];

  function nextTheme(mode) {
    if (mode === "dark") return "light";
    if (mode === "light") return "system";
    return "dark";
  }

  function themeLabel(mode) {
    return mode === "system" ? "auto" : mode === "light" ? "light" : "dark";
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
    if (lower === "install") return { type: "install" };
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

  function openExternal(url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function eventElement(target) {
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
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
    if (!Browser || !Library || !Search) return;

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
    var scrolls = {};
    var dbPromise = null;
    var scrollTimer = null;
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
      return Browser.markdownToDocument(Library.helpMarkdown(), Library.HELP);
    }

    function aboutDocument() {
      return Browser.markdownToDocument(Library.aboutMarkdown(), Library.ABOUT);
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

    function localDocument(kind) {
      if (kind === "settings") return settingsDocument();
      if (kind === "history") return historyDocument();
      if (kind === "bookmarks") return bookmarksDocument();
      if (kind === "help") return helpDocument();
      if (kind === "about") return aboutDocument();
      return homeDocument();
    }

    function applyLocalUrl(abs, nav) {
      var kind = Library.surface(abs);
      if (!kind || kind === "search") return false;
      if (kind === "resume") return resumeLast();
      if (kind === "set") {
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
          clearSavedPages();
        }
        cancelPending();
        setCurrent(settingsDocument(), "replace");
        printMsg(
          change.key === "recents"
            ? "recents and saved pages cleared"
            : change.key + " " + (change.key === "theme" ? themeLabel(themeMode) : change.value)
        );
        return true;
      }
      cancelPending();
      setCurrent(localDocument(kind), nav || "push");
      return true;
    }

    function refreshSurface() {
      if (!current || !Library.isSurfaceUrl(current.url)) return;
      applyLocalUrl(current.url, "replace");
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
      var themeMetas = doc.querySelectorAll('meta[name="theme-color"]');
      for (var ti = 0; ti < themeMetas.length; ti++) {
        themeMetas[ti].setAttribute("content", light ? "#f2f0e9" : "#141413");
      }
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
        link.href = hrefFor(href);
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

    function cachePut(url, fetched, skipPersist) {
      if (!url || !fetched) return;
      cacheOrder = cacheOrder.filter(function (item) {
        return item !== url;
      });
      cacheOrder.push(url);
      cache[url] = fetched;
      while (cacheOrder.length > MAX_CACHE) {
        var drop = cacheOrder.shift();
        if (drop && drop !== url) delete cache[drop];
      }
      if (!skipPersist) persistPage(fetched);
    }

    function openPagesDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve) {
        if (typeof indexedDB === "undefined") {
          resolve(null);
          return;
        }
        try {
          var req = indexedDB.open(PAGE_DB, 1);
          req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains(PAGE_STORE)) {
              db.createObjectStore(PAGE_STORE, { keyPath: "url" });
            }
          };
          req.onsuccess = function () {
            resolve(req.result);
          };
          req.onerror = function () {
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
      return dbPromise;
    }

    function persistPage(fetched) {
      var record = Library.packPage(fetched, {
        scroll: fetched && fetched.url ? scrolls[fetched.url] || 0 : 0
      });
      if (!record) return;
      openPagesDb().then(function (db) {
        if (!db) return;
        try {
          var tx = db.transaction(PAGE_STORE, "readwrite");
          var store = tx.objectStore(PAGE_STORE);
          store.put(record);
          if (typeof store.getAll !== "function") return;
          var all = store.getAll();
          all.onsuccess = function () {
            var rows = all.result || [];
            if (rows.length <= MAX_CACHE) return;
            rows.sort(function (a, b) {
              return (a.at || 0) - (b.at || 0);
            });
            var extra = rows.length - MAX_CACHE;
            for (var i = 0; i < extra; i++) {
              if (rows[i] && rows[i].url && rows[i].url !== record.url) store.delete(rows[i].url);
            }
          };
        } catch (e) {}
      });
    }

    function persistScroll(url, ratio) {
      if (!url) return;
      openPagesDb().then(function (db) {
        if (!db) return;
        try {
          var store = db.transaction(PAGE_STORE, "readwrite").objectStore(PAGE_STORE);
          var req = store.get(url);
          req.onsuccess = function () {
            var row = req.result;
            if (!row) return;
            row.scroll = Library.clampScroll(ratio);
            store.put(row);
          };
        } catch (e) {}
      });
    }

    function idbGet(url) {
      return openPagesDb().then(function (db) {
        if (!db || !url) return null;
        return new Promise(function (resolve) {
          try {
            var req = db.transaction(PAGE_STORE, "readonly").objectStore(PAGE_STORE).get(url);
            req.onsuccess = function () {
              resolve(req.result || null);
            };
            req.onerror = function () {
              resolve(null);
            };
          } catch (e) {
            resolve(null);
          }
        });
      });
    }

    function idbDelete(url) {
      openPagesDb().then(function (db) {
        if (!db || !url) return;
        try {
          db.transaction(PAGE_STORE, "readwrite").objectStore(PAGE_STORE).delete(url);
        } catch (e) {}
      });
    }

    function clearSavedPages() {
      cache = {};
      cacheOrder = [];
      scrolls = {};
      openPagesDb().then(function (db) {
        if (!db) return;
        try {
          db.transaction(PAGE_STORE, "readwrite").objectStore(PAGE_STORE).clear();
        } catch (e) {}
      });
    }

    function hydratePages() {
      return openPagesDb().then(function (db) {
        if (!db) return;
        return new Promise(function (resolve) {
          try {
            var store = db.transaction(PAGE_STORE, "readonly").objectStore(PAGE_STORE);
            if (typeof store.getAll !== "function") {
              resolve();
              return;
            }
            var req = store.getAll();
            req.onsuccess = function () {
              var list = req.result || [];
              list.sort(function (a, b) {
                return (a.at || 0) - (b.at || 0);
              });
              if (list.length > MAX_CACHE) list = list.slice(list.length - MAX_CACHE);
              for (var i = 0; i < list.length; i++) {
                var row = list[i];
                if (!row || !row.url || !row.text) continue;
                cachePut(row.url, { url: row.url, text: row.text, via: row.via }, true);
                if (row.scroll) scrolls[row.url] = row.scroll;
              }
              resolve();
            };
            req.onerror = function () {
              resolve();
            };
          } catch (e) {
            resolve();
          }
        });
      });
    }

    function canRestoreScroll(doc) {
      if (!doc || !doc.url) return false;
      if (doc.via === "loading" || doc.via === "error") return false;
      if (Library.isHomeUrl(doc.url) || Library.isSurfaceUrl(doc.url)) return false;
      return true;
    }

    function snapshotScroll() {
      if (!page || !canRestoreScroll(current)) return;
      var max = page.scrollHeight - page.clientHeight;
      var ratio = max > 0 ? page.scrollTop / max : 0;
      current._scroll = ratio;
      scrolls[current.url] = ratio;
      persistScroll(current.url, ratio);
    }

    function restoreScroll() {
      if (!page || !canRestoreScroll(current)) return;
      var ratio = current._scroll;
      if (ratio == null && current.url) ratio = scrolls[current.url];
      ratio = Library.clampScroll(ratio);
      if (!ratio) return;
      var max = page.scrollHeight - page.clientHeight;
      if (max > 0) page.scrollTop = Math.round(max * ratio);
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
        setStatus("");
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
      var bits = [];
      if (Library.isSearchUrl(current.url)) {
        bits.push("search");
        if (current.links && current.links.length) bits.push(String(current.links.length));
      } else {
        var host = "";
        try {
          host = new URL(current.url).host.replace(/^www\./, "");
        } catch (e) {}
        bits.push(current.title || host || "");
        var mins = Library.readingMinutes(Browser.pageToPlainText(current));
        if (mins) bits.push(mins + " min");
      }
      if (view !== "page") bits.push(view);
      if (imagesMode === "on") bits.push("img");
      if (current.via && current.via.indexOf("jina-") === 0) bits.push("via jina");
      else if (current.via && current.via.indexOf("search:") === 0) bits.push(current.via.slice(7));
      if (current.truncated) bits.push("cut");
      setStatus(
        bits
          .filter(function (bit) {
            return bit;
          })
          .join("    ")
      );
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
          } else if (
            (Library.isSurfaceUrl(documentModel.url) || Library.isSearchUrl(documentModel.url)) &&
            Library.isSectionLabel(tok.v)
          ) {
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
          a.href = hrefFor(tok.url);
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
            ph.href = hrefFor(tok.url);
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
      var searchPage = current && Library.isSearchUrl(current.url) && view === "page";
      if (doc.body && doc.body.classList) {
        doc.body.classList.toggle("home", !!home);
        doc.body.classList.toggle("library", !!libraryPage);
        doc.body.classList.toggle("search-results", !!searchPage);
      }
      if (!current) {
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
      restoreScroll();
      updateProgress();
    }

    function historyHref() {
      var path = "./";
      try {
        path = window.location.pathname || "./";
      } catch (e) {}
      if (!current || !current.url) return path;
      return Library.launchHref(current.url, path);
    }

    function publicHref() {
      if (!current || !current.url) return "";
      if (!Library.isLocalHost(current.url)) return current.url;
      try {
        var path = window.location.pathname || "/";
        return window.location.origin + Library.launchHref(current.url, path);
      } catch (e) {
        return "";
      }
    }

    function hrefFor(url) {
      try {
        return Library.launchHref(url, window.location.pathname || "/");
      } catch (e) {
        return Library.launchHref(url, "/");
      }
    }

    function setCurrent(documentModel, nav) {
      snapshotScroll();
      current = documentModel;
      view = "page";
      findQuery = "";
      if (nav === "initial") {
        stack = [documentModel];
        stackPos = 0;
        documentModel._historySeq = historySeq;
        if (nativeHistory) {
          window.history.replaceState({ usc: true, seq: historySeq }, "", historyHref());
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
            historyHref()
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
          window.history.pushState({ usc: true, seq: historySeq }, "", historyHref());
        }
      }
      if (documentModel.title) doc.title = documentModel.title + " · USC";
      if (nav !== "initial") rememberCurrent(documentModel);
      paint();
    }

    function documentFromFetched(abs, fetched) {
      if (fetched.via === "direct-image" || Search.isImageUrl(fetched.url || abs)) {
        var onlyImage = Browser.markdownToDocument(
          Library.imageMarkdown(fetched.url || abs),
          fetched.url || abs
        );
        onlyImage.via = fetched.via || "image-link";
        return onlyImage;
      }
      var raw = String(fetched.text || "").slice(0, MAX_RAW);
      var documentModel = Browser.parseFetched(raw, fetched.url || abs);
      documentModel.raw = raw;
      documentModel.via = fetched.via;
      return documentModel;
    }

    function showCached(abs, hit, stackNav) {
      var documentModel = documentFromFetched(abs, hit);
      applyImageMode(documentModel);
      setLoading(false);
      setCurrent(documentModel, stackNav);
    }

    function go(rawUrl, nav, title) {
      var abs = rawUrl;
      if (current && current.url && (rawUrl.charAt(0) === "/" || rawUrl.charAt(0) === "?" || rawUrl.charAt(0) === "#")) {
        abs = Browser.resolveUrl(rawUrl, current.url);
      } else {
        abs = Browser.normalizeUrl(rawUrl, current && current.url);
      }
      var stackNav = nav || "push";
      var kind = Library.surface(abs);

      if (kind === "search") {
        var internalQuery = Library.searchQuery(abs);
        if (internalQuery) {
          showSearchResults(internalQuery);
          return;
        }
        applyLocalUrl(Library.HOME, stackNav);
        return;
      }
      if (kind) {
        applyLocalUrl(abs, stackNav);
        return;
      }

      var engineQuery = Search.engineQueryFromUrl(abs);
      if (engineQuery) {
        var engineKind = Search.engineHostKind(new URL(abs).hostname);
        showSearchResults(engineQuery, engineKind ? [engineKind] : ALL.slice());
        return;
      }
      var unwrapped = Search.unwrapRedirectUrl(abs);
      if (unwrapped && unwrapped !== abs) abs = unwrapped;
      if (!Browser.isSafeHttpUrl(abs)) {
        printMsg("blocked url", "err");
        return;
      }
      if (Search.isSearchEngineChromeUrl(abs)) {
        printMsg("search engine UI skipped · stay in USC", "err");
        return;
      }
      if (Search.isImageUrl(abs)) {
        cancelPending();
        var imageDoc = Browser.markdownToDocument(Library.imageMarkdown(abs), abs);
        imageDoc.via = "image-link";
        applyImageMode(imageDoc);
        setCurrent(imageDoc, stackNav);
        return;
      }

      var fromSearch = Library.isSearchUrl(current && current.url) || Search.isSearchEngineUrl(abs);
      var allowProxy = proxyMode !== "off" || Search.isSearchEngineUrl(abs);
      var hit = cache[abs];
      var offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (hit) {
        cancelPending();
        cachePut(abs, hit);
        showCached(abs, hit, stackNav);
        return;
      }

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
        if (typeof navigator !== "undefined" && navigator.onLine === false) message = "offline";
        printMsg("fetch failed: " + message, "err");
        setCurrent(errorDocument(abs, message), "replace");
      }

      function fetchRemote() {
        if (offline) {
          failPage({ message: "offline" });
          return;
        }
        Browser.fetchPage(abs, {
          signal: controller && controller.signal,
          proxy: allowProxy,
          forceProxy: allowProxy && fromSearch,
          format: "markdown"
        })
          .then(function (fetched) {
            if (ticket !== going) return;
            if (fetched.via === "direct-image" || Search.isImageUrl(fetched.url || abs)) {
              finishPage(documentFromFetched(abs, fetched));
              return;
            }
            var raw = fetched.text.slice(0, MAX_RAW);
            var stored = { url: fetched.url || abs, text: raw, via: fetched.via };
            cachePut(abs, stored);
            cachePut(stored.url, stored);
            var documentModel = documentFromFetched(abs, stored);
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
                finishPage(documentFromFetched(abs, { url: again.url || abs, text: raw2, via: again.via }));
              });
            }
            finishPage(documentModel);
          })
          .catch(failPage);
      }

      idbGet(abs).then(function (row) {
        if (ticket !== going) return;
        if (row && row.text) {
          clearTimeout(loadTimer);
          var stored = { url: row.url || abs, text: row.text, via: row.via };
          cachePut(abs, stored, true);
          if (row.scroll) scrolls[abs] = row.scroll;
          showCached(abs, stored, "replace");
          return;
        }
        fetchRemote();
      }).catch(function () {
        if (ticket !== going) return;
        fetchRemote();
      });
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

    function showSearchResults(query, selectedEngines, nav) {
      cancelPending();
      var stackNav = nav || "push";
      var engines = (selectedEngines || ALL).filter(function (name) {
        return !!ENGINES[name];
      });
      if (!engines.length) engines = ALL.slice();
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        var offlineDoc = Search.buildSearchDocument(query, [], {
          status: "offline",
          footer: "retry when back online"
        });
        setCurrent(offlineDoc, stackNav);
        printMsg("offline", "err");
        return;
      }
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
      var loadingDoc = Search.buildSearchDocument(query, [], {
        status: "searching…",
        engines: engines
      });
      setCurrent(loadingDoc, stackNav);
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
        var merged = Search.mergeSearchResults(batches);
        var sources = sourcesOf();
        var keepScroll = paintedOnce ? page.scrollTop : 0;
        var documentModel = Search.buildSearchDocument(query, merged, {
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

      Search.suggestMany(suggestEngines, query)
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
        Search.fetchEngineResults(name, query, controller && controller.signal)
          .then(function (batch) {
            if (ticket !== going) return;
            batches.push(batch);
            pending -= 1;
            var merged = Search.mergeSearchResults(batches);
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
        go(Library.HELP, "push");
        return;
      }
      if (cmd.type === "about") {
        go(Library.ABOUT, "push");
        return;
      }
      if (cmd.type === "settings") {
        go(Library.SETTINGS, "push");
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
        go(Library.HOME, "push");
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
        snapshotScroll();
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
        snapshotScroll();
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
        delete scrolls[current.url];
        idbDelete(current.url);
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
          refreshSurface();
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
        refreshSurface();
        return;
      }
      if (cmd.type === "theme") {
        if (cmd.mode === "cycle") setTheme(nextTheme(themeMode));
        else if (cmd.mode === "dark" || cmd.mode === "light" || cmd.mode === "system") {
          setTheme(cmd.mode);
        } else {
          printMsg("theme " + themeLabel(themeMode));
        }
        refreshSurface();
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
        refreshSurface();
        return;
      }
      if (cmd.type === "install") {
        printMsg("browser menu · add to Home Screen");
        return;
      }
      if (cmd.type === "copy") {
        var copyTarget = publicHref();
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
        var shareUrl = publicHref();
        if (!shareUrl) {
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
        go(Library.HISTORY, "push");
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
            refreshSurface();
            return;
          }
        }
        marks.push({ title: current.title, url: current.url });
        writeBookmarks(marks);
        printMsg("starred " + current.title);
        return;
      }
      if (cmd.type === "bookmarks") {
        go(Library.BOOKMARKS, "push");
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
        refreshSurface();
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
        Search.suggestMany(ALL, q).then(function (results) {
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
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
      if (event.button && event.button !== 0) return false;
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

    if (nativeHistory) {
      window.addEventListener("popstate", function (event) {
        cancelPending();
        var state = event.state;
        if (!state || !state.usc) return;
        for (var i = 0; i < stack.length; i++) {
          if (stack[i]._historySeq === state.seq) {
            snapshotScroll();
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
        refreshSurface();
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

    page.addEventListener(
      "scroll",
      function () {
        updateProgress();
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(snapshotScroll, 240);
      },
      { passive: true }
    );

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

    function consumeLaunch(launch) {
      if (!launch) return;
      if (launch.type === "search") showSearchResults(launch.query, null, "initial");
      else if (launch.type === "go") go(launch.url, "initial");
      else if (launch.type === "surface") go(Library.surfaceUrl(launch.page), "initial");
    }

    function registerShell() {
      if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
      try {
        if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return;
        navigator.serviceWorker.register("sw.js").catch(function () {});
      } catch (e) {}
    }

    applyAppearance();
    hydratePages();
    var pendingLaunch = null;
    try {
      pendingLaunch = Library.parseLaunch(window.location.search, window.location.href);
    } catch (e) {}
    if (pendingLaunch) consumeLaunch(pendingLaunch);
    if (!current) setCurrent(homeDocument(), "initial");
    registerShell();
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
    suggestMany: Search.suggestMany,
    isSearchEngineUrl: Search.isSearchEngineUrl,
    isSearchEngineResultPage: Search.isSearchEngineResultPage,
    engineQueryFromUrl: Search.engineQueryFromUrl,
    unwrapRedirectUrl: Search.unwrapRedirectUrl,
    extractSearchResults: Search.extractSearchResults,
    mergeSearchResults: Search.mergeSearchResults,
    buildSearchDocument: Search.buildSearchDocument,
    isImageUrl: Search.isImageUrl,
    isInternalSearchUrl: Library.isSearchUrl,
    internalSearchQuery: Library.searchQuery,
    internalSearchUrl: Library.searchUrl,
    Search: Search,
    Library: Library,
    mount: mount,
    Browser: Browser
  };
});
