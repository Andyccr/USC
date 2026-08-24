(function (root, factory) {
  var api = factory();
  root.USCBrowser = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var SKIP = {
    script: 1,
    style: 1,
    noscript: 1,
    svg: 1,
    iframe: 1,
    template: 1,
    object: 1,
    canvas: 1,
    nav: 1,
    footer: 1,
    header: 1,
    aside: 1,
    form: 1,
    button: 1,
    select: 1,
    option: 1
  };
  var BLOCK = {
    p: 1,
    div: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
    li: 1,
    tr: 1,
    br: 1,
    hr: 1,
    pre: 1,
    blockquote: 1,
    section: 1,
    article: 1,
    ul: 1,
    ol: 1,
    table: 1,
    dt: 1,
    dd: 1,
    figure: 1,
    figcaption: 1,
    main: 1,
    center: 1,
    address: 1,
    td: 1,
    th: 1,
    summary: 1
  };
  var MAX_CHARS = 120000;
  var MAX_LINKS = 800;
  var MAX_IMAGES = 80;

  function looksLikeUrl(text) {
    var s = String(text || "").trim();
    if (!s || /\s/.test(s)) return false;
    if (/^https?:\/\//i.test(s) || /^\/\//.test(s)) return true;
    if (/^localhost(:\d+)?(\/.*)?$/i.test(s)) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(s)) return true;
    return /^(www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?(\/[^\s]*)?$/i.test(s);
  }

  function normalizeUrl(text, base) {
    var s = String(text || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) return "https:" + s;
    if (looksLikeUrl(s) && s.charAt(0) !== "/" && s.charAt(0) !== "?" && s.charAt(0) !== "#") {
      return "https://" + s.replace(/^https?:\/\//i, "");
    }
    if (base) {
      try {
        return new URL(s, base).href;
      } catch (e) {}
    }
    return s;
  }

  function resolveUrl(href, base) {
    var s = String(href || "").trim();
    if (!s) return "";
    try {
      return new URL(s, base || "https://example.com/").href;
    } catch (e) {
      return "";
    }
  }

  function isSafeHttpUrl(url) {
    try {
      var u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function decodeEntities(text) {
    return String(text || "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
        return fromCode(parseInt(hex, 16));
      })
      .replace(/&#(\d+);/g, function (_, n) {
        return fromCode(parseInt(n, 10));
      });
  }

  function fromCode(code) {
    if (!code || code < 32 && code !== 9 && code !== 10 && code !== 13) return "";
    try {
      return String.fromCodePoint(code);
    } catch (e) {
      return "";
    }
  }

  function parseAttrs(raw) {
    var attrs = {};
    var re = /([:@a-zA-Z_][\w:.-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|(\S+)))?/g;
    var m;
    while ((m = re.exec(raw))) {
      attrs[m[1].toLowerCase()] = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : "";
    }
    return attrs;
  }

  function srcFromAttrs(attrs, base) {
    var src = attrs.src || attrs["data-src"] || "";
    if (!src && attrs.srcset) {
      src = attrs.srcset.split(",")[0].trim().split(/\s+/)[0];
    }
    return resolveUrl(src, base);
  }

  function extractTitle(html) {
    var m = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return decodeEntities(m ? m[1].replace(/<[^>]+>/g, "") : "").replace(/\s+/g, " ").trim();
  }

  function extractMainHtml(html) {
    var s = String(html || "");
    var patterns = [
      /<main\b[^>]*>([\s\S]*?)<\/main>/i,
      /id="mw-content-text"[^>]*>([\s\S]*?)<div class="printfooter"/i,
      /<article\b[^>]*>([\s\S]*?)<\/article>/i,
      /<body\b[^>]*>([\s\S]*?)<\/body>/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = s.match(patterns[i]);
      if (m && m[1] && m[1].length > 40) return m[1];
    }
    return s;
  }

  function walkHtml(body, baseUrl) {
    var tokens = [];
    var links = [];
    var images = [];
    var linkMap = {};
    var pre = 0;
    var skip = 0;
    var skipName = "";
    var linkStack = [];
    var chars = 0;
    var pendingBreak = true;

    function pushText(value, preserveWhitespace) {
      if (!value) return;
      if (!pre) value = value.replace(/\s+/g, " ");
      if (!value || (!pre && value === " " && pendingBreak)) return;
      if (linkStack.length) {
        linkStack[linkStack.length - 1].text += value;
        return;
      }
      tokens.push({ t: "text", v: value });
      chars += value.length;
      pendingBreak = false;
    }

    function pushBreak() {
      if (linkStack.length) {
        linkStack[linkStack.length - 1].text += " ";
        return;
      }
      if (pendingBreak) return;
      tokens.push({ t: "nl" });
      pendingBreak = true;
    }

    function addLink(url, text) {
      text = text.replace(/\s+/g, " ").trim();
      if (!text || !isSafeHttpUrl(url) || links.length >= MAX_LINKS) {
        if (text) {
          tokens.push({ t: "text", v: text });
          pendingBreak = false;
        }
        return;
      }
      var key = url + "\n" + text;
      var n = linkMap[key];
      if (!n) {
        n = links.length + 1;
        linkMap[key] = n;
        links.push({ n: n, text: text, url: url });
      }
      tokens.push({ t: "link", n: n, v: text, url: url });
      chars += text.length;
      pendingBreak = false;
    }

    var i = 0;
    while (i < body.length && chars < MAX_CHARS) {
      if (skip) {
        var close = "</" + skipName + ">";
        var cix = body.toLowerCase().indexOf(close, i);
        i = cix < 0 ? body.length : cix + close.length;
        skip = 0;
        skipName = "";
        continue;
      }
      var lt = body.indexOf("<", i);
      if (lt < 0) {
        pushText(decodeEntities(body.slice(i)));
        break;
      }
      if (lt > i) pushText(decodeEntities(body.slice(i, lt)));
      if (body.slice(lt, lt + 4) === "<!--") {
        var endc = body.indexOf("-->", lt + 4);
        i = endc < 0 ? body.length : endc + 3;
        continue;
      }
      var gt = body.indexOf(">", lt + 1);
      if (gt < 0) break;
      var tagRaw = body.slice(lt + 1, gt);
      i = gt + 1;
      if (!tagRaw || tagRaw.charAt(0) === "!" || tagRaw.charAt(0) === "?") continue;
      var closing = tagRaw.charAt(0) === "/";
      if (closing) tagRaw = tagRaw.slice(1);
      var space = tagRaw.search(/\s/);
      var name = (space < 0 ? tagRaw : tagRaw.slice(0, space)).toLowerCase().replace(/\/$/, "");
      var attrRaw = space < 0 ? "" : tagRaw.slice(space);
      var selfClose =
        /\/$/.test(tagRaw) ||
        name === "br" ||
        name === "hr" ||
        name === "img" ||
        name === "input" ||
        name === "meta" ||
        name === "link";
      if (closing) {
        if (name === "a") {
          var item = linkStack.pop();
          if (item) addLink(item.url, item.text);
        }
        if (name === "pre") pre = Math.max(0, pre - 1);
        if (BLOCK[name]) pushBreak();
        continue;
      }
      if (SKIP[name]) {
        if (!selfClose) {
          skip = 1;
          skipName = name;
        }
        continue;
      }
      if (name === "br") {
        pushBreak();
        continue;
      }
      if (name === "hr") {
        pushBreak();
        if (!linkStack.length) {
          tokens.push({ t: "text", v: "-----" });
          pendingBreak = false;
          pushBreak();
        }
        continue;
      }
      if (name === "img") {
        if (images.length < MAX_IMAGES) {
          var attrs = parseAttrs(attrRaw);
          var src = srcFromAttrs(attrs, baseUrl);
          var w = parseInt(attrs.width, 10) || 0;
          var h = parseInt(attrs.height, 10) || 0;
          if (isSafeHttpUrl(src) && !(w === 1 && h === 1)) {
            var alt = decodeEntities(attrs.alt || attrs.title || "").replace(/\s+/g, " ").trim();
            var nImg = images.length + 1;
            images.push({ n: nImg, alt: alt, url: src, loaded: false });
            if (linkStack.length && !alt) alt = "image";
            tokens.push({ t: "img", n: nImg, alt: alt, url: src });
            pendingBreak = false;
          }
        }
        continue;
      }
      if (name === "a") {
        var a = parseAttrs(attrRaw);
        var href = resolveUrl(a.href || "", baseUrl);
        if (isSafeHttpUrl(href)) linkStack.push({ url: href, text: "" });
        continue;
      }
      if (name === "pre") pre += 1;
      if (BLOCK[name]) {
        pushBreak();
        if (!linkStack.length) {
          if (/^h[1-6]$/.test(name)) pushText("######".slice(0, parseInt(name.charAt(1), 10)) + " ");
          if (name === "li") pushText("* ");
          if (name === "blockquote") pushText("| ");
        }
      }
    }
    while (linkStack.length) {
      var leftover = linkStack.pop();
      addLink(leftover.url, leftover.text);
    }
    var truncated = chars >= MAX_CHARS && i < body.length;
    if (truncated) {
      tokens.push({ t: "nl" }, { t: "text", v: "[page truncated]" });
    }
    return { tokens: tokens, links: links, images: images, truncated: truncated };
  }

  function finalizeDoc(title, baseUrl, walked) {
    return {
      title: title || hostOf(baseUrl) || "untitled",
      url: baseUrl || "",
      tokens: walked.tokens,
      links: walked.links,
      images: walked.images,
      truncated: !!walked.truncated
    };
  }

  function hostOf(url) {
    try {
      return new URL(url).host;
    } catch (e) {
      return "";
    }
  }

  function markdownToDocument(text, baseUrl) {
    var raw = String(text || "").replace(/\r\n/g, "\n");
    var title = "";
    var source = baseUrl || "";
    var mTitle = raw.match(/^Title:\s*(.+)$/m);
    if (mTitle) title = mTitle[1].trim();
    var mUrl = raw.match(/^URL Source:\s*(.+)$/m);
    if (mUrl) source = mUrl[1].trim();
    var idx = raw.indexOf("Markdown Content:");
    var md = idx >= 0 ? raw.slice(idx + "Markdown Content:".length) : raw;
    var tokens = [];
    var links = [];
    var images = [];
    var linkMap = {};

    function addLink(label, url) {
      url = resolveUrl(url, source);
      if (!isSafeHttpUrl(url)) return;
      var text = decodeEntities(label).replace(/\s+/g, " ").trim() || url;
      var key = url + "\n" + text;
      var n = linkMap[key];
      if (!n) {
        n = links.length + 1;
        linkMap[key] = n;
        links.push({ n: n, text: text, url: url });
      }
      tokens.push({ t: "link", n: n, v: text, url: url });
    }

    var lines = md.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (tokens.length) tokens.push({ t: "nl" });
      var rest = line;
      var re = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
      var last = 0;
      var mm;
      while ((mm = re.exec(line))) {
        if (mm.index > last) tokens.push({ t: "text", v: line.slice(last, mm.index) });
        if (mm[2]) {
          var imgUrl = resolveUrl(mm[2], source);
          if (isSafeHttpUrl(imgUrl) && images.length < MAX_IMAGES) {
            var alt = (mm[1] || "").trim();
            var n = images.length + 1;
            images.push({ n: n, alt: alt, url: imgUrl, loaded: false });
            tokens.push({ t: "img", n: n, alt: alt, url: imgUrl });
          }
        } else {
          addLink(mm[3], mm[4]);
        }
        last = mm.index + mm[0].length;
      }
      rest = line.slice(last);
      if (rest) tokens.push({ t: "text", v: rest });
    }
    return {
      title: title || hostOf(source) || "untitled",
      url: source,
      tokens: tokens,
      links: links,
      images: images
    };
  }

  function looksLikeHtml(text) {
    var s = String(text || "").slice(0, 4000).toLowerCase();
    return s.indexOf("<html") >= 0 || s.indexOf("<body") >= 0 || s.indexOf("<div") >= 0 || s.indexOf("<p") >= 0;
  }

  function parseFetched(text, url) {
    if (looksLikeHtml(text)) return htmlToDocument(text, url);
    return markdownToDocument(text, url);
  }

  function pageToPlainText(doc) {
    var out = [];
    var tokens = doc.tokens || [];
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok.t === "nl") out.push("\n");
      else if (tok.t === "text") out.push(tok.v);
      else if (tok.t === "link") out.push("[" + tok.n + "] " + tok.v);
      else if (tok.t === "img") out.push("[img:" + tok.n + (tok.alt ? " " + tok.alt : "") + "]");
    }
    return out.join("").replace(/\n{3,}/g, "\n\n").trim();
  }

  function outlineText(doc) {
    var lines = [];
    var tokens = doc.tokens || [];
    var buf = "";
    function flush(force) {
      var s = buf.replace(/\s+/g, " ").trim();
      buf = "";
      if (!s) return;
      if (force || /^#+ /.test(s)) lines.push(s);
    }
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok.t === "nl") flush(false);
      else if (tok.t === "text") buf += tok.v;
      else if (tok.t === "link") buf += tok.v;
    }
    flush(false);
    return lines.filter(function (l) {
      return /^#+ /.test(l);
    }).join("\n");
  }

  function fetchPage(url, opts) {
    opts = opts || {};
    var signal = opts.signal;
    var abs = normalizeUrl(url);
    if (!isSafeHttpUrl(abs)) {
      return Promise.reject(new Error("blocked url"));
    }
    if (opts.forceProxy) {
      return fetchJina(abs, signal, opts.format === "html" ? "html" : "markdown").catch(function (err) {
        if (err && err.name === "AbortError") throw err;
        if (opts.format === "html") throw err;
        return fetchJina(abs, signal, "html");
      });
    }
    return fetchDirect(abs, signal)
      .catch(function (err) {
        if (err && err.name === "AbortError") throw err;
        if (!opts.proxy) {
          var blocked = new Error("cross-origin blocked · type proxy auto to use Jina");
          blocked.proxyDisabled = true;
          throw blocked;
        }
        return fetchJina(abs, signal, "html");
      })
      .catch(function (err) {
        if (err && (err.name === "AbortError" || err.proxyDisabled)) throw err;
        return fetchJina(abs, signal, "markdown");
      });
  }

  function fetchDirect(url, signal) {
    return fetch(url, { signal: signal, credentials: "omit" }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      var type = (res.headers.get("content-type") || "").toLowerCase();
      if (type.indexOf("image/") === 0) {
        var imageUrl = res.url || url;
        return {
          url: imageUrl,
          text:
            "<html><head><title>image</title></head><body><img src=\"" +
            imageUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;") +
            "\" alt=\"image\"></body></html>",
          via: "direct-image"
        };
      }
      if (
        type &&
        type.indexOf("text/") !== 0 &&
        type.indexOf("json") < 0 &&
        type.indexOf("xml") < 0 &&
        type.indexOf("html") < 0
      ) {
        throw new Error("unsupported " + type.split(";")[0]);
      }
      return res.text().then(function (text) {
        if (!text) throw new Error("empty");
        return { url: res.url || url, text: text, via: "direct" };
      });
    });
  }

  function fetchJina(url, signal, format) {
    var headers = { Accept: format === "html" ? "text/html,text/plain;q=0.9" : "text/plain" };
    if (format === "html") headers["X-Return-Format"] = "html";
    return fetch("https://r.jina.ai/" + url, {
      signal: signal,
      credentials: "omit",
      headers: headers
    }).then(function (res) {
      if (!res.ok) throw new Error("jina " + res.status);
      return res.text().then(function (text) {
        if (!text) throw new Error("empty");
        return { url: url, text: text, via: "jina-" + format };
      });
    });
  }

  function domToDocument(html, baseUrl) {
    var parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
    var baseNode = parsed.querySelector("base[href]");
    var effectiveBase = baseNode
      ? resolveUrl(baseNode.getAttribute("href"), baseUrl)
      : baseUrl;
    var root =
      parsed.querySelector("main, article, #mw-content-text, [role='main']") ||
      parsed.body ||
      parsed.documentElement;
    var tokens = [];
    var links = [];
    var images = [];
    var linkMap = {};
    var chars = 0;
    var pendingBreak = true;
    var truncated = false;

    function pushText(value) {
      if (chars >= MAX_CHARS) {
        truncated = true;
        return;
      }
      var text = String(value || "");
      if (!preserveWhitespace) text = text.replace(/\s+/g, " ");
      if (!text || (text === " " && pendingBreak)) return;
      var room = MAX_CHARS - chars;
      if (text.length > room) {
        text = text.slice(0, room);
        truncated = true;
      }
      tokens.push({ t: "text", v: text });
      chars += text.length;
      pendingBreak = false;
    }

    function pushBreak() {
      if (pendingBreak) return;
      tokens.push({ t: "nl" });
      pendingBreak = true;
    }

    function addLink(element) {
      var url = resolveUrl(element.getAttribute("href") || "", effectiveBase);
      var text = (element.textContent || "").replace(/\s+/g, " ").trim();
      if (links.length >= MAX_LINKS) {
        pushText(text);
        return;
      }
      if (!text || !isSafeHttpUrl(url)) {
        pushText(text);
        return;
      }
      if (chars + text.length > MAX_CHARS) {
        pushText(text);
        return;
      }
      var key = url + "\n" + text;
      var n = linkMap[key];
      if (!n) {
        n = links.length + 1;
        linkMap[key] = n;
        links.push({ n: n, text: text, url: url });
      }
      tokens.push({ t: "link", n: n, v: text, url: url });
      chars += text.length;
      pendingBreak = false;
    }

    function addImage(element) {
      if (images.length >= MAX_IMAGES) return;
      var attrs = {
        src: element.getAttribute("src") || "",
        "data-src": element.getAttribute("data-src") || "",
        srcset: element.getAttribute("srcset") || ""
      };
      var src = srcFromAttrs(attrs, effectiveBase);
      var width = parseInt(element.getAttribute("width"), 10) || element.width || 0;
      var height = parseInt(element.getAttribute("height"), 10) || element.height || 0;
      if (!isSafeHttpUrl(src) || (width === 1 && height === 1)) return;
      var alt = (element.getAttribute("alt") || element.getAttribute("title") || "")
        .replace(/\s+/g, " ")
        .trim();
      var n = images.length + 1;
      images.push({ n: n, alt: alt, url: src, loaded: false });
      tokens.push({ t: "img", n: n, alt: alt, url: src });
      pendingBreak = false;
    }

    function walk(node, inPre) {
      if (!node || truncated) return;
      if (node.nodeType === 3) {
        var value = node.nodeValue || "";
        pushText(value, inPre);
        return;
      }
      if (node.nodeType !== 1) return;
      var name = node.tagName.toLowerCase();
      if (
        SKIP[name] ||
        node.hasAttribute("hidden") ||
        node.getAttribute("aria-hidden") === "true"
      ) {
        return;
      }
      if (name === "br") {
        pushBreak();
        return;
      }
      if (name === "hr") {
        pushBreak();
        pushText("-----");
        pushBreak();
        return;
      }
      if (name === "img") {
        addImage(node);
        return;
      }
      if (name === "a") {
        var nestedImages = node.querySelectorAll("img");
        for (var imageIndex = 0; imageIndex < nestedImages.length; imageIndex++) {
          addImage(nestedImages[imageIndex]);
        }
        addLink(node);
        return;
      }
      var block = !!BLOCK[name];
      if (block) {
        pushBreak();
        if (/^h[1-6]$/.test(name)) {
          pushText("######".slice(0, parseInt(name.charAt(1), 10)) + " ");
        } else if (name === "li") {
          pushText("* ");
        } else if (name === "blockquote") {
          pushText("| ");
        }
      }
      for (var child = node.firstChild; child; child = child.nextSibling) {
        walk(child, inPre || name === "pre");
        if (truncated) break;
      }
      if (block) pushBreak();
    }

    walk(root, false);
    if (truncated) {
      pushBreak();
      tokens.push({ t: "text", v: "[page truncated]" });
    }
    return {
      title: (parsed.title || "").replace(/\s+/g, " ").trim() || hostOf(baseUrl) || "untitled",
      url: baseUrl || "",
      tokens: tokens,
      links: links,
      images: images,
      truncated: truncated
    };
  }

  function htmlToDocument(html, baseUrl) {
    if (typeof DOMParser !== "undefined") {
      try {
        return domToDocument(html, baseUrl);
      } catch (e) {
        // Keep the small tokenizer as a fallback for old browsers and malformed input.
      }
    }
    var title = extractTitle(html);
    var body = extractMainHtml(html);
    var baseMatch = String(html || "").match(/<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i);
    var effectiveBase = baseMatch ? resolveUrl(decodeEntities(baseMatch[1]), baseUrl) : baseUrl;
    return finalizeDoc(title, baseUrl, walkHtml(body, effectiveBase || baseUrl));
  }

  return {
    looksLikeUrl: looksLikeUrl,
    normalizeUrl: normalizeUrl,
    resolveUrl: resolveUrl,
    isSafeHttpUrl: isSafeHttpUrl,
    decodeEntities: decodeEntities,
    htmlToDocument: htmlToDocument,
    markdownToDocument: markdownToDocument,
    parseFetched: parseFetched,
    pageToPlainText: pageToPlainText,
    outlineText: outlineText,
    fetchPage: fetchPage,
    extractTitle: extractTitle
  };
});
