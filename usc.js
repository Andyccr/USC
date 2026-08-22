(function (root, factory) {
  var api = factory();
  root.USC = api;
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") api.mount(document);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var ALL = ["google", "bing", "baidu"];
  var SUGGEST_LIMIT = 8;
  var JSONP_TIMEOUT = 5000;

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
    if (lower === "help" || lower === "?" || lower === ":help") {
      return { type: "help" };
    }
    if (lower === "clear" || lower === "cls" || lower === ":clear") {
      return { type: "clear" };
    }

    var parts = text.split(/\s+/);
    var head = parts[0].toLowerCase();
    var rest = text.slice(parts[0].length).replace(/^\s+/, "");

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
    return Promise.all(engines.map(function (name) {
      return suggestOne(name, query);
    }));
  }

  function openUrl(url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function mount(doc) {
    var term = doc.getElementById("term");
    var form = doc.getElementById("prompt");
    var input = doc.getElementById("q");
    if (!term || !form || !input) return;

    var history = [];
    var histPos = -1;
    var draft = "";
    var pending = 0;

    function printLine(text, className, href) {
      if (href) {
        var link = doc.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = text;
        if (className) link.className = className;
        term.appendChild(link);
        term.appendChild(doc.createTextNode("\n"));
      } else {
        var span = doc.createElement("span");
        if (className) span.className = className;
        span.textContent = text + "\n";
        term.appendChild(span);
      }
      term.scrollTop = term.scrollHeight;
    }

    function printBlock(lines) {
      for (var i = 0; i < lines.length; i++) printLine(lines[i].text, lines[i].cls, lines[i].href);
    }

    function banner() {
      printBlock([
        { text: "USC" },
        { text: "pure-text cui  ·  google  bing  baidu", cls: "muted" },
        { text: "enter a query to call all three engines", cls: "muted" },
        { text: "g / b / d <query> for one engine   help for commands", cls: "muted" },
        { text: "" }
      ]);
    }

    function help() {
      printBlock([
        { text: "commands", cls: "muted" },
        { text: "  <query>         google + bing + baidu" },
        { text: "  g <query>       google" },
        { text: "  b <query>       bing" },
        { text: "  d <query>       baidu" },
        { text: "  all <query>     all three" },
        { text: "  help            this text" },
        { text: "  clear           clear screen" },
        { text: "" }
      ]);
    }

    function runSearch(cmd) {
      var ticket = ++pending;
      printLine("usc> " + cmd.query);
      printLine("open", "muted");
      for (var i = 0; i < cmd.engines.length; i++) {
        var name = cmd.engines[i];
        var url = ENGINES[name].searchUrl(cmd.query);
        printLine("  " + name + "  " + url, "", url);
        openUrl(url);
      }
      printLine("suggest " + cmd.engines.join(" · ") + " …", "muted");

      suggestMany(cmd.engines, cmd.query).then(function (results) {
        if (ticket !== pending) return;
        for (var r = 0; r < results.length; r++) {
          var row = results[r];
          printLine("");
          printLine(row.name);
          if (row.error) printLine("  (" + row.error + ")", "err");
          if (!row.suggestions.length && !row.error) printLine("  (no suggestions)", "muted");
          for (var j = 0; j < row.suggestions.length; j++) {
            printLine("  " + row.suggestions[j]);
          }
        }
        printLine("");
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var line = input.value;
      var cmd = parseLine(line);
      if (cmd.type === "empty") return;

      if (cmd.type !== "clear") {
        history.push(line);
        histPos = history.length;
        draft = "";
      }
      input.value = "";

      if (cmd.type === "help") help();
      else if (cmd.type === "clear") {
        term.textContent = "";
        banner();
      } else if (cmd.type === "usage") {
        printLine(cmd.message, "muted");
      } else if (cmd.type === "search") {
        runSearch(cmd);
      }
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!history.length) return;
        if (histPos === history.length) draft = input.value;
        histPos = Math.max(0, histPos - 1);
        input.value = history[histPos];
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (histPos < history.length) histPos += 1;
        input.value = histPos === history.length ? draft : history[histPos];
      }
    });

    doc.addEventListener("click", function (event) {
      var target = event.target;
      if (target && target.closest && target.closest("a")) return;
      input.focus();
    });

    banner();
    input.focus();
  }

  return {
    ALL: ALL,
    ENGINES: ENGINES,
    parseLine: parseLine,
    suggestMany: suggestMany,
    mount: mount
  };
});
