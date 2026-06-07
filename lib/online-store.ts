type OnlinePageKey = "home" | "staff" | "customer";

type OnlineSession = {
  page: OnlinePageKey;
  visitorId: string;
  lastSeen: number;
  userAgent: string;
};

type OnlineStoreGlobal = {
  sessions: Map<string, OnlineSession>;
};

const ACTIVE_WINDOW_MS = 70 * 1000;

const globalForOnline = globalThis as typeof globalThis & {
  __VTDD_ONLINE_STORE__?: OnlineStoreGlobal;
};

function getStore() {
  if (!globalForOnline.__VTDD_ONLINE_STORE__) {
    globalForOnline.__VTDD_ONLINE_STORE__ = {
      sessions: new Map<string, OnlineSession>(),
    };
  }

  return globalForOnline.__VTDD_ONLINE_STORE__;
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalizePage(value: any): OnlinePageKey | "" {
  const page = clean(value).toLowerCase();

  if (page === "home" || page === "staff" || page === "customer") {
    return page;
  }

  return "";
}

function pruneExpiredSessions() {
  const store = getStore();
  const now = Date.now();

  Array.from(store.sessions.entries()).forEach(([key, session]) => {
    if (now - session.lastSeen > ACTIVE_WINDOW_MS) {
      store.sessions.delete(key);
    }
  });
}

export function touchOnlineSession(params: {
  page: string;
  visitorId: string;
  userAgent?: string;
}) {
  pruneExpiredSessions();

  const page = normalizePage(params.page);
  const visitorId = clean(params.visitorId);

  if (!page || !visitorId) {
    return getOnlineStats();
  }

  const store = getStore();
  const key = `${page}:${visitorId}`;

  store.sessions.set(key, {
    page,
    visitorId,
    lastSeen: Date.now(),
    userAgent: clean(params.userAgent),
  });

  return getOnlineStats();
}

export function removeOnlineSession(params: {
  page: string;
  visitorId: string;
}) {
  const page = normalizePage(params.page);
  const visitorId = clean(params.visitorId);

  if (!page || !visitorId) {
    return getOnlineStats();
  }

  const store = getStore();
  store.sessions.delete(`${page}:${visitorId}`);

  return getOnlineStats();
}

export function getOnlineStats() {
  pruneExpiredSessions();

  const store = getStore();
  const stats = {
    total: 0,
    home: 0,
    staff: 0,
    customer: 0,
    updatedAt: new Date().toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };

  store.sessions.forEach((session) => {
    stats.total += 1;
    stats[session.page] += 1;
  });

  return stats;
}
