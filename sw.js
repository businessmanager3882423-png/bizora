const C = "bizora-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "firebase.js", "i18n.js", "categories.js", "manifest.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || !u.protocol.startsWith("http")) return;
  if (/firestore\.googleapis|identitytoolkit|securetoken|googleapis\.com\/google\.firestore/.test(u.hostname + u.pathname)) return;
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(C).then((c) => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then((m) => m || caches.match("index.html"))));
});
