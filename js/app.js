// ═══════════════════════════════════════════════════════
//  AniSecret — Main Application (Router + Pages)
// ═══════════════════════════════════════════════════════

import {
  fetchLatest,
  fetchSearch,
  fetchEpisodes,
  resolveStream,
  fetchSynopsis,
  fetchSchedule,
  fetchFilter,
  fetchFilters,
  toBase64,
  fromBase64,
} from './api.js';

import {
  Icons,
  renderAnimeCard,
  renderSkeletonGrid,
  renderEpisodeRow,
  renderPagination,
  renderGenreTags,
  renderBackButton,
  renderError,
  renderEmpty,
  renderDetailSkeleton,
  renderWatchSkeleton,
} from './components.js';

import { initPlayer, switchQuality, destroyPlayer, setupControls, PlayerIcons } from './player.js';

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

      case 'schedule':
        await renderSchedulePage();
        break;

      case 'filter':
        await renderFilterPage(parseInt(params.page) || 1, params);
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

    const episodes = (episodeData?.episodes || []).filter(ep => (ep.type || 'sub').toLowerCase() !== 'dub');
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

  container.innerHTML = `<div class="container page-enter">${renderWatchSkeleton()}</div>`;

  try {
    const resolveData = await resolveStream(episodeUrl);
    const qualities = resolveData?.qualities || {};
    const qualityKeys = Object.keys(qualities);

    if (qualityKeys.length === 0) {
      container.innerHTML = `<div class="container">${renderBackButton('Back')}${renderError('No streams found', 'Could not resolve video streams for this episode.')}</div>`;
      return;
    }

    // Find series from cache
    let seriesUrl = '';
    let currentEpTitle = '';

    let allEpisodes = [];
    for (const [url] of state.animeCache) {
      try {
        const epData = await fetchEpisodes(url);
        const match = epData?.episodes?.find(e => e.url === episodeUrl);
        if (match) {
          seriesUrl = url;
          allEpisodes = epData.episodes || [];
          currentEpTitle = match.episode;
          break;
        }
      } catch { continue; }
    }

    // Fallback: derive series URL if not in cache (direct load / refresh)
    if (!seriesUrl) {
      const derivedUrl = deriveSeriesUrl(episodeUrl);
      if (derivedUrl) {
        try {
          const epData = await fetchEpisodes(derivedUrl);
          const match = epData?.episodes?.find(e => e.url === episodeUrl);
          if (match) {
            seriesUrl = derivedUrl;
            allEpisodes = epData.episodes || [];
            currentEpTitle = match.episode;
          }
        } catch (err) {
          console.error('[Watch Direct Fetch Error]', err);
        }
      }
    }

    // Resolve SUB vs DUB (RAW) versions of the current episode
    const currentEpisode = allEpisodes.find(ep => ep.url === episodeUrl);
    const seriesTitle = state.animeCache.get(seriesUrl)?.title || currentEpisode?.title || allEpisodes[0]?.title || 'Unknown Anime';
    const currentEpNum = currentEpisode?.episode || '';
    const currentEpType = (currentEpisode?.type || 'sub').toLowerCase();

    let langToggleData = null;
    if (currentEpNum) {
      const subEpisode = allEpisodes.find(ep => ep.episode === currentEpNum && (ep.type || 'sub').toLowerCase() === 'sub');
      const dubEpisode = allEpisodes.find(ep => ep.episode === currentEpNum && (ep.type || '').toLowerCase() === 'dub');

      if (subEpisode && dubEpisode) {
        langToggleData = {
          current: currentEpType,
          subUrl: `#/watch/${toBase64(subEpisode.url)}`,
          dubUrl: `#/watch/${toBase64(dubEpisode.url)}`
        };
      }
    }

    const seriesEpisodes = allEpisodes.filter(ep => (ep.type || 'sub').toLowerCase() !== 'dub');

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
            <div class="watch-header-main">
              <h1 class="watch-title">${escHtml(seriesTitle || 'Now Playing')}</h1>
              <div class="watch-episode-label">${escHtml(currentEpTitle || '')}</div>
            </div>
          </div>

          <div class="player-wrapper controls-visible is-paused" id="player-wrapper">
            <video id="video-player" playsinline></video>

            <div class="player-center-play" id="player-center-play">
              ${PlayerIcons.play}
            </div>

            <div class="player-loading" id="player-loading">
              <div class="player-spinner"></div>
              <span class="player-loading-text">Loading stream…</span>
            </div>

            <div class="player-controls" id="player-controls">
              <div class="player-progress-wrap" id="progress-wrap">
                <div class="player-progress-track">
                  <div class="player-progress-buffer" id="progress-buffer"></div>
                  <div class="player-progress-played" id="progress-played"></div>
                </div>
                <div class="player-progress-thumb" id="progress-thumb"></div>
              </div>
              <div class="player-controls-row">
                <div class="player-controls-left">
                  <button class="player-ctrl-btn" id="ctrl-play" aria-label="Play">${PlayerIcons.play}</button>
                  <div class="player-volume-group">
                    <button class="player-ctrl-btn" id="ctrl-volume" aria-label="Volume">${PlayerIcons.volHigh}</button>
                    <div class="player-volume-slider-wrap">
                      <input type="range" class="player-volume-slider" id="volume-slider" min="0" max="100" value="100" />
                    </div>
                  </div>
                  <span class="player-time" id="player-time">0:00 / 0:00</span>
                </div>
                <div class="player-controls-right">
                  ${langToggleData ? `
                    <div class="player-lang-group">
                      <a href="${langToggleData.subUrl}" class="player-lang-btn ${langToggleData.current === 'sub' ? 'active' : ''}">SUB</a>
                      <a href="${langToggleData.dubUrl}" class="player-lang-btn ${langToggleData.current === 'dub' ? 'active' : ''}">RAW</a>
                    </div>
                  ` : ''}
                  <div class="player-quality-wrap">
                    <button class="player-ctrl-btn player-quality-btn" id="ctrl-quality">
                      <span id="quality-label">${escHtml(defaultQuality)}</span>
                    </button>
                    <div class="player-quality-popup" id="quality-popup"></div>
                  </div>
                  <button class="player-ctrl-btn" id="ctrl-fullscreen" aria-label="Fullscreen">${PlayerIcons.fullscreen}</button>
                </div>
              </div>
            </div>
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

    // Initialize player + custom controls
    const videoEl = document.getElementById('video-player');
    const q = qualities[defaultQuality];
    if (videoEl && q) {
      initPlayer(videoEl, q.url, q.referer);
      setupControls(videoEl, qualities, defaultQuality, episodeUrl, langToggleData);
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
  document.querySelectorAll('.mobile-menu-link').forEach(link => {
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
        location.hash = `#/filter?q=${encodeURIComponent(q)}`;
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

// ── Derive Series URL from Episode URL fallback ──────────
function deriveSeriesUrl(episodeUrl) {
  try {
    const decoded = decodeURIComponent(episodeUrl);
    let seriesDecoded = decoded.replace('/watch/', '/');
    seriesDecoded = seriesDecoded.replace(/-th-ตอนที่-\d+\/?$/, '/');
    seriesDecoded = seriesDecoded.replace(/-ตอนที่-\d+\/?$/, '/');
    return seriesDecoded;
  } catch (e) {
    return '';
  }
}

// ═══════════════════════════════════════════════════════
//  SCHEDULE PAGE
// ═══════════════════════════════════════════════════════

async function renderSchedulePage() {
  updateActiveNav('schedule');
  const container = app();

  container.innerHTML = `
    <div class="container page-enter">
      <div class="section-header">
        <h1 class="section-title">Release Schedule</h1>
      </div>
      <div id="schedule-content">
        <div class="schedule-loading">
          ${renderSkeletonGrid(6)}
        </div>
      </div>
    </div>`;

  try {
    const months = await fetchSchedule();

    // Cache schedule items
    for (const month of months) {
      for (const item of month.results) {
        if (item.url && item.url !== '#') {
          state.animeCache.set(item.url, {
            title: item.title,
            thumbnail: item.thumbnail,
            url: item.url,
          });
        }
      }
    }

    const content = document.getElementById('schedule-content');
    if (!content) return;

    if (!months || months.length === 0) {
      content.innerHTML = renderEmpty('No schedule data', 'Schedule information is not available right now.');
      return;
    }

    // Find the first non-past month to auto-scroll to
    const currentIdx = months.findIndex(m => !m.isPast);

    content.innerHTML = `
      <div class="schedule-tabs" id="schedule-tabs">
        ${months.map((m, i) => `
          <button class="schedule-tab ${i === (currentIdx >= 0 ? currentIdx : 0) ? 'active' : ''} ${m.isPast ? 'past' : ''}" data-idx="${i}">
            <span class="tab-month">${escHtml(m.month)}</span>
            <span class="tab-count">${m.results.length}</span>
          </button>
        `).join('')}
      </div>
      <div class="schedule-panels" id="schedule-panels">
        ${months.map((m, i) => `
          <div class="schedule-panel ${i === (currentIdx >= 0 ? currentIdx : 0) ? 'active' : ''}" data-idx="${i}">
            ${m.results.length > 0 ? `
              <div class="schedule-grid">
                ${m.results.map(item => {
                  const encoded = item.url && item.url !== '#' ? toBase64(item.url) : '';
                  const href = encoded ? `#/anime/${encoded}` : '#';
                  return `
                    <a href="${href}" class="schedule-card ${item.url === '#' ? 'upcoming' : ''}">
                      <div class="schedule-card-img">
                        <img src="${item.thumbnail}" alt="${escHtml(item.title)}" loading="lazy" onerror="this.style.display='none'" />
                        <span class="schedule-ep-badge">${escHtml(item.episode)}</span>
                      </div>
                      <div class="schedule-card-info">
                        <h4 class="schedule-card-title">${escHtml(item.title)}</h4>
                        <span class="schedule-card-date">${escHtml(item.releaseDate)}</span>
                      </div>
                    </a>`;
                }).join('')}
              </div>
            ` : '<p style="padding:20px;color:var(--text-muted)">No releases this month.</p>'}
          </div>
        `).join('')}
      </div>`;

    // Tab switching
    const tabs = document.getElementById('schedule-tabs');
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.schedule-tab');
      if (!tab) return;
      const idx = tab.dataset.idx;

      tabs.querySelectorAll('.schedule-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.schedule-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.idx === idx);
      });
    });

    // Scroll active tab into view
    const activeTab = tabs.querySelector('.schedule-tab.active');
    if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  } catch (err) {
    console.error('[Schedule]', err);
    const content = document.getElementById('schedule-content');
    if (content) content.innerHTML = renderError('Failed to load schedule', err.message);
  }
}

// ═══════════════════════════════════════════════════════
//  FILTER PAGE
// ═══════════════════════════════════════════════════════

async function renderFilterPage(page = 1, params = {}) {
  updateActiveNav('filter');
  const container = app();

  const isSearching = !!params.q;

  // Show dynamic skeleton loading layout
  container.innerHTML = `
    <div class="container page-enter">
      <div class="section-header">
        <h1 class="section-title">${isSearching ? 'Search Results' : 'Browse Anime'}</h1>
      </div>
      
      <div class="filter-panel skeleton">
        <div class="skeleton-block" style="height: 50px; width: 100%; border-radius: var(--radius-md); mb: 12px;"></div>
        <div class="skeleton-block" style="height: 40px; width: 100%; border-radius: var(--radius-md)"></div>
      </div>

      <div class="anime-grid" id="anime-grid">
        ${renderSkeletonGrid(12)}
      </div>
      <div id="pagination-area"></div>
    </div>`;

  try {
    // 1. Fetch filter options and page results in parallel
    const filtersPromise = fetchFilters().catch(err => {
      console.error('[API Filters Load Failed]', err);
      // Fallback values in case API endpoint fails
      return {
        genres: ["Hentai เฮ็นไต", "Big Breasts หน้าอกใหญ่", "Censored เซ็นเซอร์", "Uncensored อันเซ็นเซอร์"],
        years: ["2026", "2025", "2024", "2023", "2022", "2021", "2020"],
        status: ["จบแล้ว", "ยังไม่จบ"],
        sort: ["latest", "title"]
      };
    });

    const filterParams = {};
    if (params.genres) filterParams.genres = params.genres;
    if (params.years) filterParams.years = params.years;
    if (params.status) filterParams.status = params.status;
    if (params.sort) filterParams.sort = params.sort;

    let resultsPromise;
    if (isSearching) {
      resultsPromise = fetchSearch(params.q, page, filterParams);
    } else {
      resultsPromise = fetchFilter(page, filterParams);
    }

    const [filters, data] = await Promise.all([filtersPromise, resultsPromise]);

    // Cache anime items for faster detail loading
    for (const anime of (data.results || [])) {
      state.animeCache.set(anime.url, anime);
    }

    // Custom dropdown renderer helper
    const renderCustomDropdown = (id, defaultLabel, items, selectedValue, showSearch = false) => {
      let displayLabel = defaultLabel;
      let activeVal = selectedValue || '';
      
      if (id === 'sort' && !activeVal) {
        activeVal = 'latest';
      }

      if (activeVal) {
        if (id === 'sort') {
          displayLabel = activeVal === 'latest' ? 'Latest Releases' : activeVal === 'title' ? 'Alphabetical' : activeVal;
        } else {
          displayLabel = activeVal;
        }
      }

      return `
        <div class="custom-dropdown" id="dropdown-${id}" data-value="${escHtml(activeVal)}">
          <div class="dropdown-trigger">
            <span class="dropdown-selected-label">${escHtml(displayLabel)}</span>
            <span class="dropdown-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
          <div class="dropdown-menu">
            ${showSearch ? `
              <div class="dropdown-search-wrapper">
                <input type="text" class="dropdown-search-input" placeholder="Search..." />
              </div>
            ` : ''}
            <div class="dropdown-options">
              ${id !== 'sort' ? `<div class="dropdown-option ${!activeVal ? 'active' : ''}" data-val="">${escHtml(defaultLabel)}</div>` : ''}
              ${items.map(item => {
                const isActive = item === activeVal;
                let label = item;
                if (id === 'sort') {
                  label = item === 'latest' ? 'Latest Releases' : item === 'title' ? 'Alphabetical' : item;
                }
                return `<div class="dropdown-option ${isActive ? 'active' : ''}" data-val="${escHtml(item)}">${escHtml(label)}</div>`;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    };

    // 2. Render actual browse layout with populated filters
    container.innerHTML = `
      <div class="container page-enter">
        <div class="section-header">
          <h1 class="section-title">${isSearching ? `Search: "${escHtml(params.q)}"` : 'Browse Anime'}</h1>
        </div>
        
        <div class="filter-panel">
          <div class="filter-row main-row">
            <div class="filter-search-box">
              <span class="search-box-icon">${Icons.search}</span>
              <input type="text" id="filter-search" class="filter-search-input" placeholder="Search anime title..." value="${escHtml(params.q || '')}" />
            </div>
            <button class="btn-apply-filters" id="btn-apply-filters">
              <span>Apply Filters</span>
            </button>
          </div>
          
          <div class="filter-row dropdowns-row">
            <div class="filter-select-wrapper">
              ${renderCustomDropdown('genre', 'All Genres', filters.genres || [], params.genres, true)}
            </div>
            <div class="filter-select-wrapper">
              ${renderCustomDropdown('year', 'All Years', filters.years || [], params.years, false)}
            </div>
            <div class="filter-select-wrapper">
              ${renderCustomDropdown('status', 'All Status', filters.status || [], params.status, false)}
            </div>
            <div class="filter-select-wrapper">
              ${renderCustomDropdown('sort', 'Sort By', filters.sort || [], params.sort, false)}
            </div>
            ${(params.q || params.genres || params.years || params.status || params.sort) ? `
              <button class="btn-clear-filters" id="btn-clear-filters" title="Clear all filters">
                Clear Filters
              </button>
            ` : ''}
          </div>
        </div>

        <div class="anime-grid" id="anime-grid">
          <!-- Results populated here -->
        </div>
        <div id="pagination-area"></div>
      </div>`;

    // 3. Bind Custom Dropdown Events
    const setupCustomDropdown = (id) => {
      const el = document.getElementById(`dropdown-${id}`);
      if (!el) return;
      const trigger = el.querySelector('.dropdown-trigger');
      const searchInput = el.querySelector('.dropdown-search-input');
      const options = el.querySelectorAll('.dropdown-option');
      const selectedLabel = el.querySelector('.dropdown-selected-label');

      // Toggle dropdown
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-dropdown').forEach(d => {
          if (d !== el) d.classList.remove('open');
        });
        el.classList.toggle('open');
        if (el.classList.contains('open') && searchInput) {
          searchInput.focus();
          searchInput.value = '';
          el.querySelectorAll('.dropdown-option').forEach(opt => opt.style.display = '');
        }
      });

      // Filter options on search input
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase().trim();
          options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (opt.dataset.val === '') {
              opt.style.display = query ? 'none' : '';
            } else {
              opt.style.display = text.includes(query) ? '' : 'none';
            }
          });
        });
      }

      // Option selection
      el.querySelector('.dropdown-options').addEventListener('click', (e) => {
        const option = e.target.closest('.dropdown-option');
        if (!option) return;

        const val = option.dataset.val;
        el.dataset.value = val;
        selectedLabel.textContent = option.textContent;

        el.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        el.classList.remove('open');
      });
    };

    setupCustomDropdown('genre');
    setupCustomDropdown('year');
    setupCustomDropdown('status');
    setupCustomDropdown('sort');

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
      }
    });

    // 4. Bind Search & Filter Triggers
    const filterSearchInput = document.getElementById('filter-search');
    const genreSelect = document.getElementById('dropdown-genre');
    const yearSelect = document.getElementById('dropdown-year');
    const statusSelect = document.getElementById('dropdown-status');
    const sortSelect = document.getElementById('dropdown-sort');
    const applyBtn = document.getElementById('btn-apply-filters');
    const clearBtn = document.getElementById('btn-clear-filters');

    const handleApply = () => {
      const q = filterSearchInput.value.trim();
      const genre = genreSelect ? genreSelect.dataset.value : '';
      const year = yearSelect ? yearSelect.dataset.value : '';
      const status = statusSelect ? statusSelect.dataset.value : '';
      const sort = sortSelect ? sortSelect.dataset.value : '';

      const newParams = new URLSearchParams();
      newParams.set('page', '1');

      if (q) newParams.set('q', q);
      if (genre) newParams.set('genres', genre);
      if (year) newParams.set('years', year);
      if (status) newParams.set('status', status);
      if (sort) newParams.set('sort', sort);

      location.hash = `#/filter?${newParams.toString()}`;
    };

    applyBtn.addEventListener('click', handleApply);
    filterSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleApply();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        location.hash = `#/filter`;
      });
    }

    // 5. Fill results and setup pagination
    const grid = document.getElementById('anime-grid');
    if (!grid) return;

    if (!data.results || data.results.length === 0) {
      grid.innerHTML = renderEmpty('No results found', 'Try checking other filters or clear the search query.');
      return;
    }

    grid.innerHTML = data.results.map(renderAnimeCard).join('');

    const pagArea = document.getElementById('pagination-area');
    if (pagArea) {
      const queryParams = new URLSearchParams({
        ...(params.q ? { q: params.q } : {}),
        ...(params.genres ? { genres: params.genres } : {}),
        ...(params.years ? { years: params.years } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.sort ? { sort: params.sort } : {}),
      });
      const paginationBase = `#/filter?${queryParams.toString()}&page=`;
      pagArea.innerHTML = renderPagination(data.currentPage, data.totalPages, paginationBase);
    }

  } catch (err) {
    console.error('[Filter Page Render Failed]', err);
    const grid = document.getElementById('anime-grid');
    if (grid) grid.innerHTML = renderError('Failed to load browse results', err.message);
  }
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  setupSearch();

  // Mobile Search Toggle
  const searchToggleBtn = document.getElementById('mobile-search-toggle');
  const searchWrapper = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  
  if (searchToggleBtn && searchWrapper) {
    searchToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = searchWrapper.classList.toggle('open');
      searchToggleBtn.classList.toggle('active', isOpen);
      if (isOpen && searchInput) {
        searchInput.focus();
      }
    });
    
    // Close search when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#search-form') && !e.target.closest('#mobile-search-toggle')) {
        searchWrapper.classList.remove('open');
        searchToggleBtn.classList.remove('active');
      }
    });
  }

  // Mobile Menu Dropdown Toggle
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu-dropdown');
  
  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileMenu.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
      toggleBtn.classList.toggle('active', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#mobile-menu-dropdown') && !e.target.closest('#mobile-menu-toggle')) {
        mobileMenu.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
    
    // Close menu when clicking a link
    mobileMenu.querySelectorAll('.mobile-menu-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  route();
});

window.addEventListener('hashchange', route);
