(function (root, factory) {
  var api = factory();
  root.USCLibrary = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var MAX_RECENTS = 12;
  var MAX_HOME_RECENTS = 8;
  var MAX_HOME_BOOKMARKS = 6;
  var HOME = "https://usc.local/";
  var SETTINGS = "https://usc.local/settings";
  var RESUME = "https://usc.local/resume";
  var HISTORY = "https://usc.local/history";
  var BOOKMARKS = "https://usc.local/bookmarks";
  var HELP = "https://usc.local/help";
  var ABOUT = "https://usc.local/about";
  var SEARCH = "https://usc.local/search";

  var HELP_BODY =
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
    "install   add to Home Screen\n" +
    "g hello  google only\n" +
    "s back   search a command word\n" +
    "real     open outside\n" +
    "about     product info\n" +
    ":cmd     any command\n" +
    "\n" +
    "pages stay as text · images stay as links\n";

  var ABOUT_BODY =
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
    "install   add to home screen\n" +
    "share     send a link into USC\n" +
    "offline   home and settings still work\n" +
    "help     commands\n";

  function mdHref(url) {
    return "<" + String(url || "").replace(/[<>]/g, "") + ">";
  }

  function safeLabel(text) {
    return String(text || "")
      .replace(/[\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return "";
    }
  }

  function localPath(url) {
    try {
      var u = new URL(url);
      if (u.hostname !== "usc.local") return "";
      return u.pathname || "/";
    } catch (e) {
      return "";
    }
  }

  function isLocalHost(url) {
    try {
      return new URL(url).hostname === "usc.local";
    } catch (e) {
      return false;
    }
  }

  function isHomeUrl(url) {
    return localPath(url) === "/";
  }

  function isSettingsUrl(url) {
    return localPath(url) === "/settings";
  }

  function isResumeUrl(url) {
    return localPath(url) === "/resume";
  }

  function isSetUrl(url) {
    return localPath(url) === "/set";
  }

  function isHistoryUrl(url) {
    return localPath(url) === "/history";
  }

  function isBookmarksUrl(url) {
    return localPath(url) === "/bookmarks";
  }

  function isHelpUrl(url) {
    return localPath(url) === "/help";
  }

  function isAboutUrl(url) {
    return localPath(url) === "/about";
  }

  function isSearchUrl(url) {
    return localPath(url) === "/search";
  }

  function searchUrl(query) {
    return SEARCH + "?q=" + encodeURIComponent(query || "");
  }

  function searchQuery(url) {
    try {
      var u = new URL(url);
      if (u.hostname !== "usc.local" || u.pathname !== "/search") return "";
      return u.searchParams.get("q") || "";
    } catch (e) {
      return "";
    }
  }

  function surface(url) {
    var path = localPath(url);
    if (!path) return "";
    if (path === "/") return "home";
    if (path === "/settings") return "settings";
    if (path === "/search") return "search";
    if (path === "/history") return "history";
    if (path === "/bookmarks") return "bookmarks";
    if (path === "/help") return "help";
    if (path === "/about") return "about";
    if (path === "/resume") return "resume";
    if (path === "/set") return "set";
    return "local";
  }

  function isAppUrl(url) {
    var path = localPath(url);
    if (!path) return false;
    return path !== "/search";
  }

  function isSurfaceUrl(url) {
    var path = localPath(url);
    return (
      path === "/" ||
      path === "/settings" ||
      path === "/history" ||
      path === "/bookmarks" ||
      path === "/help" ||
      path === "/about"
    );
  }

  function parseSetUrl(url) {
    try {
      var u = new URL(url);
      if (u.hostname !== "usc.local" || u.pathname !== "/set") return null;
      return { key: u.searchParams.get("k") || "", value: u.searchParams.get("v") || "" };
    } catch (e) {
      return null;
    }
  }

  function setUrl(key, value) {
    return "https://usc.local/set?k=" + encodeURIComponent(key) + "&v=" + encodeURIComponent(value);
  }

  function shouldRemember(entry) {
    if (!entry || !entry.url) return false;
    if (entry.via === "error" || entry.via === "image-link" || entry.via === "loading") return false;
    try {
      var u = new URL(entry.url);
      if (u.hostname === "usc.local") return u.pathname === "/search";
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function remember(state, entry) {
    state = state || { recents: [], last: null };
    var recents = Array.isArray(state.recents) ? state.recents.slice() : [];
    var last = state.last || null;
    if (!shouldRemember(entry)) return { recents: recents, last: last };
    var kind = String(entry.url).indexOf("usc.local/search") >= 0 ? "search" : "page";
    var title = safeLabel(entry.title) || hostOf(entry.url) || entry.url;
    if (kind === "search" && title.indexOf("search · ") !== 0) title = "search · " + title;
    var item = {
      title: title,
      url: entry.url,
      kind: kind,
      at: entry.at || Date.now()
    };
    recents = [item].concat(
      recents.filter(function (row) {
        return row && row.url && row.url !== item.url;
      })
    ).slice(0, MAX_RECENTS);
    return { recents: recents, last: item };
  }

  function clearSession() {
    return { recents: [], last: null };
  }

  function readingMinutes(text) {
    var n = String(text || "").replace(/\s+/g, "").length;
    if (n < 200) return 0;
    return Math.max(1, Math.round(n / 800));
  }

  function isSectionLabel(text) {
    var t = String(text || "").replace(/^\s+|\s+$/g, "");
    if (!t) return false;
    if (/^type to search/.test(t)) return true;
    if (/^(continue|recent|bookmarks|session|this session|related)$/.test(t)) return true;
    if (/^searching/.test(t) || /^no results/.test(t)) return true;
    if (/^(theme|proxy|images|font)\b/.test(t)) return true;
    if (/^nothing here/.test(t) || /^star a page/.test(t) || /^no bookmarks/.test(t)) return true;
    if (/^loading/.test(t) || /^fetch failed/.test(t) || /^real  open/.test(t)) return true;
    if (/^offline$/.test(t) || /^retry when back online/.test(t)) return true;
    return false;
  }

  function homeMarkdown(opts) {
    opts = opts || {};
    var recents = Array.isArray(opts.recents) ? opts.recents : [];
    var last = opts.last || null;
    var bookmarks = Array.isArray(opts.bookmarks) ? opts.bookmarks : [];
    var md = "Title: USC\nURL Source: " + HOME + "\n\nMarkdown Content:\nUSC\n\n";
    var used = {};

    function addLink(label, url) {
      if (!url || used[url]) return false;
      used[url] = 1;
      md += "[" + safeLabel(label) + "](" + mdHref(url) + ")\n";
      return true;
    }

    if (last && last.url) {
      md += "continue\n";
      addLink(last.title || last.url, last.url);
      md += "\n";
    }

    var recentLines = [];
    for (var i = 0; i < recents.length && recentLines.length < MAX_HOME_RECENTS; i++) {
      var row = recents[i];
      if (!row || !row.url || used[row.url]) continue;
      recentLines.push(row);
    }
    if (recentLines.length) {
      md += "recent\n";
      for (var r = 0; r < recentLines.length; r++) {
        addLink(recentLines[r].title, recentLines[r].url);
      }
      md += "\n";
    }

    var marked = [];
    for (var b = 0; b < bookmarks.length && marked.length < MAX_HOME_BOOKMARKS; b++) {
      if (!bookmarks[b] || !bookmarks[b].url || used[bookmarks[b].url]) continue;
      marked.push(bookmarks[b]);
    }
    if (marked.length) {
      md += "bookmarks\n";
      for (var m = 0; m < marked.length; m++) {
        addLink(marked[m].title || marked[m].url, marked[m].url);
      }
      if (bookmarks.length > marked.length) addLink("all bookmarks", BOOKMARKS);
      md += "\n";
    }

    if (!recentLines.length && !marked.length && !(last && last.url)) {
      md += "type to search · url to open\n\n";
    }

    addLink("settings", SETTINGS);
    addLink("history", HISTORY);
    if (bookmarks.length && !marked.length) addLink("bookmarks", BOOKMARKS);
    addLink("help", HELP);
    return md;
  }

  function settingsMarkdown(opts) {
    opts = opts || {};
    var theme = opts.theme || "system";
    var proxy = opts.proxy || "auto";
    var images = opts.images || "off";
    var font = opts.font || 15;
    var themeNow = theme === "system" ? "auto" : theme;
    return (
      "Title: settings\nURL Source: " +
      SETTINGS +
      "\n\nMarkdown Content:\nsettings\n\n" +
      "theme  " +
      themeNow +
      "\n" +
      "[dark](" +
      mdHref(setUrl("theme", "dark")) +
      ")  [light](" +
      mdHref(setUrl("theme", "light")) +
      ")  [auto](" +
      mdHref(setUrl("theme", "system")) +
      ")\n\n" +
      "proxy  " +
      proxy +
      "\n" +
      "[auto](" +
      mdHref(setUrl("proxy", "auto")) +
      ")  [on](" +
      mdHref(setUrl("proxy", "on")) +
      ")  [off](" +
      mdHref(setUrl("proxy", "off")) +
      ")\n\n" +
      "images  " +
      images +
      "\n" +
      "[on](" +
      mdHref(setUrl("images", "on")) +
      ")  [off](" +
      mdHref(setUrl("images", "off")) +
      ")\n\n" +
      "font  " +
      font +
      "\n" +
      "[+](" +
      mdHref(setUrl("font", "+")) +
      ")  [-](" +
      mdHref(setUrl("font", "-")) +
      ")  [reset](" +
      mdHref(setUrl("font", "reset")) +
      ")\n\n" +
      "session\n" +
      "[clear recents](" +
      mdHref(setUrl("recents", "clear")) +
      ")\n\n" +
      "[home](" +
      mdHref(HOME) +
      ")\n"
    );
  }

  function historyMarkdown(items) {
    var md = "Title: history\nURL Source: " + HISTORY + "\n\nMarkdown Content:\nhistory\n\n";
    var used = {};
    var n = 0;
    var list = Array.isArray(items) ? items : [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (!row || !row.url || used[row.url]) continue;
      if (isHistoryUrl(row.url) || isHomeUrl(row.url)) continue;
      used[row.url] = 1;
      var label = safeLabel(row.title || hostOf(row.url) || row.url);
      if (row.current) label = "· " + label;
      md += "[" + label + "](" + mdHref(row.url) + ")\n";
      n += 1;
    }
    if (!n) md += "nothing here yet\n";
    md += "\n[home](" + mdHref(HOME) + ")\n";
    return md;
  }

  function bookmarksMarkdown(list) {
    var md = "Title: bookmarks\nURL Source: " + BOOKMARKS + "\n\nMarkdown Content:\nbookmarks\n\n";
    var marks = Array.isArray(list) ? list : [];
    var n = 0;
    var used = {};
    for (var i = 0; i < marks.length; i++) {
      var row = marks[i];
      if (!row || !row.url || used[row.url]) continue;
      used[row.url] = 1;
      md += "[" + safeLabel(row.title || row.url) + "](" + mdHref(row.url) + ")\n";
      n += 1;
    }
    if (!n) md += "star a page to save it\n";
    md += "\n[home](" + mdHref(HOME) + ")\n";
    return md;
  }

  function loadingMarkdown(url, title) {
    var label = safeLabel(title) || hostOf(url) || String(url || "");
    return (
      "Title: " +
      label +
      "\nURL Source: " +
      url +
      "\n\nMarkdown Content:\n" +
      label +
      "\n\nloading…\n"
    );
  }

  function errorMarkdown(url, message) {
    var host = hostOf(url) || String(url || "");
    var detail = safeLabel(message) || "error";
    if (detail === "offline") {
      return (
        "Title: " +
        host +
        "\nURL Source: " +
        url +
        "\n\nMarkdown Content:\n" +
        host +
        "\n\noffline\n\nretry when back online\n\n[home](" +
        mdHref(HOME) +
        ")\n"
      );
    }
    return (
      "Title: " +
      host +
      "\nURL Source: " +
      url +
      "\n\nMarkdown Content:\n" +
      host +
      "\n\nfetch failed: " +
      detail +
      "\n\n" +
      String(url || "") +
      "\n\nreal  open outside\n\n[home](" +
      mdHref(HOME) +
      ")\n"
    );
  }

  function extractHttpUrl(text) {
    var m = String(text || "").match(/https?:\/\/[^\s<>"']+/i);
    if (!m) return "";
    return m[0].replace(/[.,);]+$/, "");
  }

  function parseLaunch(search, pageUrl) {
    var raw = String(search || "");
    if (!raw) return null;
    if (raw.charAt(0) === "?") raw = raw.slice(1);
    var params;
    try {
      params = new URLSearchParams(raw);
    } catch (e) {
      return null;
    }
    var page = String(params.get("p") || params.get("page") || "")
      .replace(/^\s+|\s+$/g, "")
      .toLowerCase();
    if (
      page === "home" ||
      page === "settings" ||
      page === "help" ||
      page === "about" ||
      page === "history" ||
      page === "bookmarks"
    ) {
      return { type: "surface", page: page };
    }
    var q = String(params.get("q") || "").replace(/^\s+|\s+$/g, "");
    if (q) return { type: "search", query: q };
    var url = String(params.get("url") || "").replace(/^\s+|\s+$/g, "");
    if (url) {
      if (pageUrl) {
        try {
          var abs = new URL(url, pageUrl);
          var here = new URL(pageUrl);
          if (abs.origin === here.origin) {
            var inner = parseLaunch(abs.search, pageUrl);
            if (inner) return inner;
          }
        } catch (e) {}
      }
      return { type: "go", url: url };
    }
    var text = String(params.get("text") || "").replace(/^\s+|\s+$/g, "");
    var title = String(params.get("title") || "").replace(/^\s+|\s+$/g, "");
    var extracted = extractHttpUrl(text) || extractHttpUrl(title);
    if (extracted) return { type: "go", url: extracted };
    if (text) return { type: "search", query: text };
    if (title) return { type: "search", query: title };
    return null;
  }

  function surfaceUrl(page) {
    if (page === "settings") return SETTINGS;
    if (page === "help") return HELP;
    if (page === "about") return ABOUT;
    if (page === "history") return HISTORY;
    if (page === "bookmarks") return BOOKMARKS;
    return HOME;
  }

  function launchHref(url, path) {
    var base = String(path || "/");
    if (!base) base = "/";
    function withQuery(query) {
      return base + "?" + query;
    }
    if (!url) return base;
    if (isSearchUrl(url)) {
      var q = searchQuery(url);
      return q ? withQuery("q=" + encodeURIComponent(q)) : base;
    }
    var kind = surface(url);
    if (
      kind === "settings" ||
      kind === "help" ||
      kind === "about" ||
      kind === "history" ||
      kind === "bookmarks"
    ) {
      return withQuery("p=" + encodeURIComponent(kind));
    }
    if (kind === "home" || kind === "resume" || kind === "set" || kind === "local") return base;
    try {
      var abs = String(url);
      if (/^https?:\/\//i.test(abs) && !isLocalHost(abs)) {
        return withQuery("url=" + encodeURIComponent(abs));
      }
    } catch (e) {}
    return base;
  }

  function textMarkdown(title, url, body) {
    return (
      "Title: " +
      title +
      "\nURL Source: " +
      url +
      "\n\nMarkdown Content:\n" +
      String(body || "").replace(/^\s+/, "") +
      "\n"
    );
  }

  function helpMarkdown() {
    return textMarkdown(
      "help",
      HELP,
      "help\n\n" + HELP_BODY + "\n[settings](" + mdHref(SETTINGS) + ")\n[home](" + mdHref(HOME) + ")\n"
    );
  }

  function aboutMarkdown() {
    return textMarkdown(
      "about",
      ABOUT,
      ABOUT_BODY + "\n[settings](" + mdHref(SETTINGS) + ")\n[help](" + mdHref(HELP) + ")\n[home](" + mdHref(HOME) + ")\n"
    );
  }

  function imageMarkdown(url) {
    var abs = String(url || "");
    return (
      "Title: image\nURL Source: " +
      abs +
      "\n\nMarkdown Content:\nimage\n\n![image](" +
      abs +
      ")\n\n" +
      abs +
      "\n\ni 1  load this image\n"
    );
  }

  return {
    MAX_RECENTS: MAX_RECENTS,
    HOME: HOME,
    SETTINGS: SETTINGS,
    RESUME: RESUME,
    HISTORY: HISTORY,
    BOOKMARKS: BOOKMARKS,
    HELP: HELP,
    ABOUT: ABOUT,
    SEARCH: SEARCH,
    mdHref: mdHref,
    hostOf: hostOf,
    surface: surface,
    isHomeUrl: isHomeUrl,
    isLocalHost: isLocalHost,
    isSettingsUrl: isSettingsUrl,
    isResumeUrl: isResumeUrl,
    isSetUrl: isSetUrl,
    isHistoryUrl: isHistoryUrl,
    isBookmarksUrl: isBookmarksUrl,
    isHelpUrl: isHelpUrl,
    isAboutUrl: isAboutUrl,
    isSearchUrl: isSearchUrl,
    searchUrl: searchUrl,
    searchQuery: searchQuery,
    isAppUrl: isAppUrl,
    isSurfaceUrl: isSurfaceUrl,
    parseSetUrl: parseSetUrl,
    setUrl: setUrl,
    shouldRemember: shouldRemember,
    remember: remember,
    clearSession: clearSession,
    readingMinutes: readingMinutes,
    isSectionLabel: isSectionLabel,
    homeMarkdown: homeMarkdown,
    settingsMarkdown: settingsMarkdown,
    historyMarkdown: historyMarkdown,
    bookmarksMarkdown: bookmarksMarkdown,
    textMarkdown: textMarkdown,
    helpMarkdown: helpMarkdown,
    aboutMarkdown: aboutMarkdown,
    imageMarkdown: imageMarkdown,
    loadingMarkdown: loadingMarkdown,
    errorMarkdown: errorMarkdown,
    extractHttpUrl: extractHttpUrl,
    parseLaunch: parseLaunch,
    surfaceUrl: surfaceUrl,
    launchHref: launchHref
  };
});
