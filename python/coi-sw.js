/*
 * Cross-origin isolation service worker.
 *
 * GitHub Pages can't send custom HTTP headers, but interactive input()
 * needs SharedArrayBuffer, which browsers only enable on pages served with
 * COOP/COEP headers. This worker re-serves every response with those headers
 * added. It only affects pages inside this folder.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;

  event.respondWith(
    fetch(req).then((res) => {
      if (res.status === 0) return res; // opaque responses can't be modified
      const headers = new Headers(res.headers);
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    })
  );
});
