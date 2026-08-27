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
    if (entry.via === "error" || entry.via === "image-link") return false;
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
    if (/^(continue|recent|bookmarks|session|this session)$/.test(t)) return true;
    if (/^(theme|proxy|images|font)\b/.test(t)) return true;
    if (/^nothing here/.test(t) || /^star a page/.test(t) || /^no bookmarks/.test(t)) return true;
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

  return {
    MAX_RECENTS: MAX_RECENTS,
    HOME: HOME,
    SETTINGS: SETTINGS,
    RESUME: RESUME,
    HISTORY: HISTORY,
    BOOKMARKS: BOOKMARKS,
    HELP: HELP,
    ABOUT: ABOUT,
    mdHref: mdHref,
    hostOf: hostOf,
    isHomeUrl: isHomeUrl,
    isSettingsUrl: isSettingsUrl,
    isResumeUrl: isResumeUrl,
    isSetUrl: isSetUrl,
    isHistoryUrl: isHistoryUrl,
    isBookmarksUrl: isBookmarksUrl,
    isHelpUrl: isHelpUrl,
    isAboutUrl: isAboutUrl,
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
    textMarkdown: textMarkdown
  };
});
