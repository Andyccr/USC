/* USC shell: cache the app so home / settings / help work offline. */
var CACHE = "usc-shell-v1";
var ASSETS = [
  "./",
  "index.html",
  "browser.js",
  "library.js",
  "search.js",
  "usc.js",
  "manifest.json",
  "favicon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        ASSETS.map(function (url) {
          return cache.add(url).catch(function () {});
        })
      );
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0) {
            return caches.match("index.html").then(function (page) {
              return page || caches.match("./") || caches.match("/");
            });
          }
          return Response.error();
        });
      })
  );
});
