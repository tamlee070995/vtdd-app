const SW_VERSION = "vtdd-pwa-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(fetch(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data === "VTDD_SW_VERSION") {
    event.source?.postMessage({ version: SW_VERSION });
  }
});
