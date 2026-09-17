// Service worker do Dispatcher.
//
// Existe por um motivo só: receber notificação push quando o navegador está
// fechado. Não faz cache de nada de propósito — a plataforma mostra dados de
// disparo em tempo real, e servir tela velha de cache seria pior que lento.

self.addEventListener("install", () => {
  // Assume o controle sem esperar a aba antiga fechar.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Dispatcher", body: event.data.text() };
  }

  const title = payload.title || "Dispatcher";
  const options = {
    body: payload.body || "",
    icon: "/autoprocs-logo.png",
    badge: "/autoprocs-logo.png",
    // `tag` faz a notificação do mesmo comunicado substituir a anterior em vez
    // de empilhar, caso o worker reenvie.
    tag: payload.tag || "dispatcher",
    data: { url: payload.url || "/comunicados" },
    // Vibração curta: o aviso é informativo, não urgente.
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/comunicados";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Se já existe uma aba do Dispatcher aberta, leva ela pro comunicado em
      // vez de abrir mais uma.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
