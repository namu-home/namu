/* NAMU 설치용 서비스 워커: 앱 화면 파일만 저장해 두고, 데이터는 항상 Firebase에서 받습니다. */
const CACHE = "namu-shell-v17";
const SHELL = ["./", "./index.html", "./firebase-app.js", "./manifest.webmanifest", "./icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; /* Firebase·폰트 요청은 건드리지 않음 */
  /* 새 버전을 먼저 받고, 인터넷이 없을 때만 저장해 둔 화면을 씀 */
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html"))));
});
