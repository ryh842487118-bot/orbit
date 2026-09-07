// A cache belongs to the fetch implementation so injected clients stay isolated.
const clients = new WeakMap();

function abortError() {
  return new DOMException('数据请求已取消', 'AbortError');
}

function clientState(fetchImpl) {
  if (!clients.has(fetchImpl)) clients.set(fetchImpl, { cache: new Map(), pending: new Map() });
  return clients.get(fetchImpl);
}

function request(url, { fetchImpl, timeoutMs, ttl, validate }, state) {
  const controller = new AbortController();
  const entry = { controller, subscribers: 0, settled: false, promise: null };
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  entry.promise = Promise.resolve().then(async () => {
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const error = new Error(`数据源返回 HTTP ${response.status}`);
        error.name = 'HttpError';
        error.status = response.status;
        throw error;
      }
      const value = await response.json();
      validate?.(value);
      if (controller.signal.aborted) throw abortError();
      if (ttl > 0) state.cache.set(url, { value, expiresAt: Date.now() + ttl });
      return value;
    } catch (error) {
      if (timedOut) {
        const timeout = new Error('数据源响应超时，请稍后重试');
        timeout.name = 'TimeoutError';
        throw timeout;
      }
      if (controller.signal.aborted) throw abortError();
      throw error;
    } finally {
      clearTimeout(timer);
      entry.settled = true;
      if (state.pending.get(url) === entry) state.pending.delete(url);
    }
  });
  state.pending.set(url, entry);
  return entry;
}

function subscribe(entry, signal, state, url) {
  entry.subscribers++;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      signal?.removeEventListener('abort', onAbort);
      entry.subscribers--;
      return true;
    };
    const onAbort = () => {
      if (!finish()) return;
      reject(abortError());
      // One panel cancelling must not cancel another consumer of the same feed.
      if (!entry.settled && entry.subscribers === 0) {
        if (state.pending.get(url) === entry) state.pending.delete(url);
        entry.controller.abort();
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    entry.promise.then(
      value => { if (finish()) resolve(value); },
      error => { if (finish()) reject(error); },
    );
  });
}

export function fetchJson(url, {
  signal, ttl = 0, fetchImpl = globalThis.fetch, force = false, timeoutMs = 18000, validate,
} = {}) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (typeof fetchImpl !== 'function') return Promise.reject(new Error('浏览器不支持公开数据请求'));
  const state = clientState(fetchImpl);
  const cached = state.cache.get(url);
  if (!force && cached && cached.expiresAt > Date.now()) {
    try { validate?.(cached.value); return Promise.resolve(cached.value); }
    catch (error) { state.cache.delete(url); return Promise.reject(error); }
  }
  if (cached && cached.expiresAt <= Date.now()) state.cache.delete(url);
  const entry = state.pending.get(url) || request(url, { fetchImpl, ttl, timeoutMs, validate }, state);
  return subscribe(entry, signal, state, url);
}
