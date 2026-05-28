// ═══════════════════════════════════════════════════════
//  AniSecret — Main Application (Router + Pages)
// ═══════════════════════════════════════════════════════

import {
  fetchLatest,
  fetchSearch,
  fetchEpisodes,
  resolveStream,
  fetchSynopsis,
  toBase64,
  fromBase64,
} from './api.js';

import {
  Icons,
  renderAnimeCard,
  renderSkeletonGrid,
  renderEpisodeRow,
  renderPagination,
  renderQualitySelector,
  renderGenreTags,
  renderBackButton,
  renderError,
  renderEmpty,
  renderDetailSkeleton,
  renderWatchSkeleton,
} from './components.js';

import { initPlayer, switchQuality, destroyPlayer } from './player.js';

// ── State ───────────────────────────────────────────────
const state = {
  currentRoute: '',
  animeCache: new Map(), // url -> card data for quicker detail loads
};

// ── DOM Reference ───────────────────────────────────────
const app = () => document.getElementById('app');

// ── Router ──────────────────────────────────────────────
function parseHash() {
  const hash = location.hash.slice(1) || '/';
  const [path, queryStr] = hash.split('?');
  const segments = path.split('/').filter(Boolean);
  const params = {};

  if (queryStr) {
    for (const pair of queryStr.split('&')) {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }

  return { path, segments, params };
}

async function route() {
  destroyPlayer(); // always clean up player on navigation

  const { segments, params } = parseHash();
  const root = segments[0] || '';

  // Scroll to top on route change
  window.scrollTo({ top: 0, behavior: 'instant' });

  try {
    switch (root) {
      case '':
        await renderHomePage(parseInt(params.page) || 1);
        break;

      case 'anime':
        if (segments[1]) {
          const url = fromBase64(segments[1]);
          await renderDetailPage(url);
        }
        break;

      case 'watch':
        if (segments[1]) {
          const url = fromBase64(segments[1]);
          await renderWatchPage(url);
        }
        break;

      case 'search':
        if (segments[1]) {
          const query = decodeURIComponent(segments[1]);
          const page = parseInt(segments[2]) || 1;
          await renderSearchPage(query, page);
        }
        break;

      default:
        await renderHomePage(1);
    }
  } catch (err) {
    console.error('[Route Error]', err);
    app().innerHTML = `<div class="container">${renderError('Page failed to load', err.message)}</div>`;
  }
}

// ═══════════════════════════════════════════════════════
//  PAGE RENDERERS
// ═══════════════════════════════════════════════════════

// ── Home Page ───────────────────────────────────────────
async function renderHomePage(page = 1) {
  updateActiveNav('home');
  const container = app();

  container.innerHTML = `
    <div class="container page-enter">
      <div class="section-header">
        <h1 class="section-title">Latest Releases</h1>
      </div>
      <div class="anime-grid" id="anime-grid">
        ${renderSkeletonGrid(12)}
      </div>
      <div id="pagination-area"></div>
    </div>`;

  try {
    const data = await fetchLatest(page);

    // Cache anime card data
    for (const anime of data.results) {
      state.animeCache.set(anime.url, anime);
    }

    const grid = document.getElementById('anime-grid');
    if (!grid) return;

    if (!data.results || data.results.length === 0) {
      grid.innerHTML = renderEmpty('No anime found', 'Check back later for new releases.');
      return;
    }

    grid.innerHTML = data.results.map(renderAnimeCard).join('');

    // Pagination
    const pagArea = document.getElementById('pagination-area');
    if (pagArea) {
      pagArea.innerHTML = renderPagination(
        data.currentPage,
        data.totalPages,
        '#/?page='
      );
    }
  } catch (err) {
    console.error('[Home]', err);
    const grid = document.getElementById('anime-grid');
    if (grid) grid.innerHTML = renderError('Failed to load anime', err.message);
  }
}

// ── Detail Page ─────────────────────────────────────────
async function renderDetailPage(seriesUrl) {
  updateActiveNav('');
  const container = app();

  // Show skeleton
  container.innerHTML = `
    <div class="container page-enter">
      ${renderBackButton('Back to Home')}
      ${renderDetailSkeleton()}
    </div>`;

  try {
    // Fetch episodes + Jikan synopsis in parallel
    const cachedCard = state.animeCache.get(seriesUrl);
    const title = cachedCard?.title || '';

    const [episodeData, jikanData] = await Promise.all([
      fetchEpisodes(seriesUrl),
      title ? fetchSynopsis(title) : Promise.resolve(null),
    ]);

    const episodes = episodeData?.episodes || [];
    const thumbnail = cachedCard?.thumbnail || jikanData?.images?.jpg?.large_image_url || '';
    const displayTitle = cachedCard?.title || episodes[0]?.title || 'Unknown';
    const score = jikanData?.score || cachedCard?.score || '—';
    const synopsis = jikanData?.synopsis || 'No synopsis available for this title.';
    const genres = jikanData?.genres || [];
    const epCount = cachedCard?.episodes || `${episodes.length}`;
    const status = cachedCard?.status || (jikanData?.status || '');
    const language = cachedCard?.language || '';

    const sc = parseFloat(score);
    const scoreCol = isNaN(sc) ? 'var(--text-muted)' : sc >= 7 ? 'var(--score-high)' : sc >= 5 ? 'var(--score-mid)' : 'var(--score-low)';

    container.innerHTML = `
      <div class="container page-enter">
        ${renderBackButton('Back')}
        <div class="detail-page">
          <div class="detail-hero">
            <div class="detail-poster">
              <img src="${thumbnail}" alt="${escHtml(displayTitle)}"
                   onerror="this.style.display='none'" />
            </div>
            <div class="detail-info">
              <h1 class="detail-title">${escHtml(displayTitle)}</h1>

              <div class="detail-stats">
                <div class="stat-item">
                  <span class="stat-icon" style="color:${scoreCol}">${Icons.star}</span>
                  <span class="stat-value" style="color:${scoreCol}">${score}</span>
                </div>
                <span class="stat-divider"></span>
                <div class="stat-item">
                  <span class="stat-icon">${Icons.tv}</span>
                  <span class="stat-value">${escHtml(epCount)}</span>
                  <span>Episodes</span>
                </div>
                ${status ? `
                <span class="stat-divider"></span>
                <div class="stat-item">
                  <span class="stat-value">${escHtml(status)}</span>
                </div>` : ''}
                ${language ? `
                <span class="stat-divider"></span>
                <div class="stat-item">
                  <span class="stat-icon">${Icons.globe}</span>
                  <span class="stat-value">${escHtml(language)}</span>
                </div>` : ''}
              </div>

              ${renderGenreTags(genres)}

              <div class="detail-synopsis">
                <h3>Synopsis</h3>
                <p>${escHtml(synopsis)}</p>
              </div>
            </div>
          </div>

          <div class="episodes-section">
            <div class="section-header">
              <h2 class="section-title">Episodes</h2>
            </div>
            <div class="episode-list">
              ${episodes.length > 0
                ? episodes.map(ep => renderEpisodeRow(ep)).join('')
                : '<p style="padding:20px;color:var(--text-muted)">No episodes found.</p>'
              }
            </div>
          </div>
        </div>
      </div>`;

  } catch (err) {
    console.error('[Detail]', err);
    container.innerHTML = `<div class="container">${renderBackButton('Back')}${renderError('Failed to load anime details', err.message)}</div>`;
  }
}

// ── Watch Page ──────────────────────────────────────────
async function renderWatchPage(episodeUrl) {
  updateActiveNav('');
  const container = app();

  // Show skeleton
  container.innerHTML = `<div class="container page-enter">${renderWatchSkeleton()}</div>`;

  try {
    // We need the series URL to fetch the episode list
    // Try to extract it from the episode URL
    // Episode URL format: https://www.alpha-hen.com/watch/SLUG-ตอนที่-XX/
    // Series URL format: https://www.alpha-hen.com/SLUG/

    const resolveData = await resolveStream(episodeUrl);
    const qualities = resolveData?.qualities || {};
    const qualityKeys = Object.keys(qualities);

    if (qualityKeys.length === 0) {
      container.innerHTML = `<div class="container">${renderBackButton('Back')}${renderError('No streams found', 'Could not resolve video streams for this episode.')}</div>`;
      return;
    }

    // Find the series URL from cache
    let seriesUrl = '';
    let seriesEpisodes = [];
    let currentEpTitle = '';

    // Try to find the series this episode belongs to by checking cached episodes
    for (const [url, card] of state.animeCache) {
      try {
        const epData = await fetchEpisodes(url);
        const match = epData?.episodes?.find(e => e.url === episodeUrl);
        if (match) {
          seriesUrl = url;
          seriesEpisodes = epData.episodes;
          currentEpTitle = match.episode;
          break;
        }
      } catch {
        continue;
      }
    }

    // If we couldn't find the series, just show the player
    const seriesTitle = state.animeCache.get(seriesUrl)?.title || '';

    // Pick best quality by default (highest resolution)
    const defaultQuality = qualityKeys.includes('1080p')
      ? '1080p'
      : qualityKeys.includes('720p')
        ? '720p'
        : qualityKeys[qualityKeys.length - 1];

    container.innerHTML = `
      <div class="container page-enter">
        <div class="watch-page">
          ${renderBackButton('Back')}

          <div class="watch-header">
            <h1 class="watch-title">${escHtml(seriesTitle || 'Now Playing')}</h1>
            <div class="watch-episode-label">${escHtml(currentEpTitle || '')}</div>
          </div>

          <div class="player-wrapper">
            <video id="video-player" controls playsinline></video>
            <div class="player-loading" id="player-loading">
              <div class="player-spinner"></div>
              <span class="player-loading-text">Loading stream…</span>
            </div>
          </div>

          <div id="quality-area">
            ${renderQualitySelector(qualities, defaultQuality)}
          </div>

          ${seriesEpisodes.length > 0 ? `
          <div class="watch-content">
            <div class="watch-episodes-panel episodes-section">
              <div class="section-header">
                <h2 class="section-title">All Episodes</h2>
              </div>
              <div class="episode-list">
                ${seriesEpisodes.map(ep => renderEpisodeRow(ep, episodeUrl)).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>
      </div>`;

    // Initialize player
    const videoEl = document.getElementById('video-player');
    const q = qualities[defaultQuality];
    if (videoEl && q) {
      initPlayer(videoEl, q.url, q.referer);
    }

    // Quality button event delegation
    const qualityArea = document.getElementById('quality-area');
    if (qualityArea) {
      qualityArea.addEventListener('click', (e) => {
        const btn = e.target.closest('.quality-btn');
        if (!btn || btn.classList.contains('active')) return;

        const streamUrl = btn.dataset.streamUrl;
        const referer = btn.dataset.referer;
        const label = btn.dataset.quality;

        // Update active state
        qualityArea.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Switch quality
        const vid = document.getElementById('video-player');
        if (vid) {
          document.getElementById('player-loading').style.display = 'flex';
          switchQuality(vid, streamUrl, referer);
        }
      });
    }

  } catch (err) {
    console.error('[Watch]', err);
    container.innerHTML = `<div class="container">${renderBackButton('Back')}${renderError('Failed to load player', err.message)}</div>`;
  }
}

// ── Search Page ─────────────────────────────────────────
async function renderSearchPage(query, page = 1) {
  updateActiveNav('');
  const container = app();

  // Update search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = query;

  container.innerHTML = `
    <div class="container page-enter">
      <div class="section-header">
        <h1 class="section-title">Search: "${escHtml(query)}"</h1>
      </div>
      <div class="anime-grid" id="anime-grid">
        ${renderSkeletonGrid(12)}
      </div>
      <div id="pagination-area"></div>
    </div>`;

  try {
    const data = await fetchSearch(query, page);

    for (const anime of (data.results || [])) {
      state.animeCache.set(anime.url, anime);
    }

    const grid = document.getElementById('anime-grid');
    if (!grid) return;

    if (!data.results || data.results.length === 0) {
      grid.innerHTML = renderEmpty('No results', `No anime found for "${query}". Try a different term.`);
      return;
    }

    grid.innerHTML = data.results.map(renderAnimeCard).join('');

    const pagArea = document.getElementById('pagination-area');
    if (pagArea) {
      pagArea.innerHTML = renderPagination(
        data.currentPage,
        data.totalPages,
        `#/search/${encodeURIComponent(query)}/`
      );
    }
  } catch (err) {
    console.error('[Search]', err);
    const grid = document.getElementById('anime-grid');
    if (grid) grid.innerHTML = renderError('Search failed', err.message);
  }
}

// ═══════════════════════════════════════════════════════
//  NAV & SEARCH
// ═══════════════════════════════════════════════════════

function updateActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });
}

function setupSearch() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q) {
        location.hash = `#/search/${encodeURIComponent(q)}`;
        input.blur();
      }
    });
  }
}

// ── Escape helper ───────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  setupSearch();
  route();
});

window.addEventListener('hashchange', route);
