// ═══════════════════════════════════════════════════════
//  AniSecret — API Service Layer
// ═══════════════════════════════════════════════════════

const BASE_URL = 'https://alpha-hen-worker-v2.sapis.workers.dev';
const JIKAN_URL = 'https://api.jikan.moe/v4';

// ── Simple in-memory cache ──────────────────────────────
const _cache = {
  latest: new Map(),
  search: new Map(),
  episodes: new Map(),
  resolve: new Map(),
  jikan: new Map(),
  schedule: null,
  filter: new Map(),
};

// ── Base64 helpers (UTF-8 safe) ─────────────────────────
export function toBase64(str) {
  return btoa(
    encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export function fromBase64(b64) {
  return decodeURIComponent(
    Array.from(atob(b64), (c) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')
  );
}

// ── Fetch Latest (paginated) ────────────────────────────
export async function fetchLatest(page = 1) {
  const key = `latest_${page}`;
  if (_cache.latest.has(key)) return _cache.latest.get(key);

  const res = await fetch(`${BASE_URL}/api/latest?page=${page}`);
  if (!res.ok) throw new Error(`Failed to fetch latest (page ${page})`);
  const data = await res.json();
  _cache.latest.set(key, data);
  return data;
}

// ── Search (paginated, with advanced filters support) ──
export async function fetchSearch(query, page = 1, params = {}) {
  const qp = new URLSearchParams({ q: query, page });
  for (const [k, v] of Object.entries(params)) {
    if (v) qp.set(k, v);
  }
  const key = qp.toString();
  if (_cache.search.has(key)) return _cache.search.get(key);

  const res = await fetch(`${BASE_URL}/api/search?${key}`);
  if (!res.ok) throw new Error(`Search failed for "${query}"`);
  const data = await res.json();
  _cache.search.set(key, data);
  return data;
}

// ── Episodes for a series ───────────────────────────────
export async function fetchEpisodes(seriesUrl) {
  if (_cache.episodes.has(seriesUrl))
    return _cache.episodes.get(seriesUrl);

  const res = await fetch(
    `${BASE_URL}/api/episodes?url=${encodeURIComponent(seriesUrl)}`
  );
  if (!res.ok) throw new Error('Failed to fetch episodes');
  const data = await res.json();
  _cache.episodes.set(seriesUrl, data);
  return data;
}

// ── Resolve stream qualities ────────────────────────────
export async function resolveStream(episodeUrl) {
  if (_cache.resolve.has(episodeUrl))
    return _cache.resolve.get(episodeUrl);

  const res = await fetch(
    `${BASE_URL}/api/resolve?url=${encodeURIComponent(episodeUrl)}`
  );
  if (!res.ok) throw new Error('Failed to resolve stream');
  const data = await res.json();
  _cache.resolve.set(episodeUrl, data);
  return data;
}

// ── Build HLS proxy URL ────────────────────────────────
export function getProxyUrl(streamUrl, referer) {
  return `${BASE_URL}/proxy/master.m3u8?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(referer)}`;
}

// ── Jikan synopsis lookup ───────────────────────────────
export async function fetchSynopsis(title) {
  // Strip Thai suffixes for better MAL matching
  const clean = title
    .replace(/\s*(ตอนที่|ซับไทย|พากย์ไทย|ภาค\s*\d*)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (_cache.jikan.has(clean)) return _cache.jikan.get(clean);

  try {
    const res = await fetch(
      `${JIKAN_URL}/anime?q=${encodeURIComponent(clean)}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.data?.[0] || null;
    _cache.jikan.set(clean, result);
    return result;
  } catch {
    return null;
  }
}

// ── Fetch Schedule ──────────────────────────────────────
export async function fetchSchedule() {
  if (_cache.schedule) return _cache.schedule;

  const res = await fetch(`${BASE_URL}/api/schedule`);
  if (!res.ok) throw new Error('Failed to fetch schedule');
  const data = await res.json();
  _cache.schedule = data;
  return data;
}

// ── Fetch Filters Options ────────────────────────────────
export async function fetchFilters() {
  if (_cache.filters) return _cache.filters;

  const res = await fetch(`${BASE_URL}/api/filters`);
  if (!res.ok) throw new Error('Failed to fetch filter options');
  const data = await res.json();
  _cache.filters = data;
  return data;
}

// ── Fetch Filter (paginated, with query params) ─────────
export async function fetchFilter(page = 1, params = {}) {
  const qp = new URLSearchParams({ page });
  for (const [k, v] of Object.entries(params)) {
    if (v) qp.set(k, v);
  }
  const key = qp.toString();
  if (_cache.filter.has(key)) return _cache.filter.get(key);

  const res = await fetch(`${BASE_URL}/api/filter?${key}`);
  if (!res.ok) throw new Error('Failed to fetch filtered results');
  const data = await res.json();
  _cache.filter.set(key, data);
  return data;
}

