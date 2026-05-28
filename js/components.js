// ═══════════════════════════════════════════════════════
//  AniSecret — UI Components
// ═══════════════════════════════════════════════════════

import { toBase64 } from './api.js';

// ── Score color helper ──────────────────────────────────
function scoreColor(score) {
  const n = parseFloat(score);
  if (isNaN(n)) return 'var(--text-muted)';
  if (n >= 7) return 'var(--score-high)';
  if (n >= 5) return 'var(--score-mid)';
  return 'var(--score-low)';
}

// ── SVG Icons ───────────────────────────────────────────
export const Icons = {
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  film: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
};

// ── Anime Card ──────────────────────────────────────────
export function renderAnimeCard(anime) {
  const encoded = toBase64(anime.url);
  const sc = scoreColor(anime.score);

  return `
    <a href="#/anime/${encoded}" class="anime-card" id="card-${encoded.slice(0, 12)}">
      <div class="card-image">
        <img src="${anime.thumbnail}" alt="${escapeHtml(anime.title)}"
             loading="lazy"
             onload="this.classList.add('loaded')"
             onerror="this.parentElement.classList.add('img-error');this.remove();" />
        <div class="card-overlay">
          <span class="card-play-icon">${Icons.play}</span>
        </div>
        <span class="card-score" style="--score-color:${sc}">${anime.score || '—'}</span>
      </div>
      <div class="card-info">
        <h3 class="card-title">${escapeHtml(anime.title)}</h3>
        <div class="card-meta">
          <span class="badge badge-episodes">${anime.episodes || '?'} EP</span>
          <span class="badge badge-status">${escapeHtml(anime.status || '')}</span>
          <span class="badge badge-lang">${escapeHtml(anime.language || '')}</span>
        </div>
      </div>
    </a>`;
}

// ── Skeleton Grid ───────────────────────────────────────
export function renderSkeletonGrid(count = 12) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="anime-card skeleton">
        <div class="card-image skeleton-image"></div>
        <div class="card-info">
          <div class="skeleton-text skeleton-title"></div>
          <div class="skeleton-text skeleton-meta"></div>
        </div>
      </div>`;
  }
  return html;
}

// ── Episode Row ─────────────────────────────────────────
export function renderEpisodeRow(episode, activeUrl = '') {
  const encoded = toBase64(episode.url);
  const isActive = episode.url === activeUrl;
  const rawType = (episode.type || 'sub').toUpperCase();
  const displayType = rawType === 'DUB' ? 'RAW' : rawType;
  const badgeClass = rawType === 'DUB' ? 'raw' : rawType.toLowerCase();

  return `
    <a href="#/watch/${encoded}" class="episode-row ${isActive ? 'active' : ''}" id="ep-${encoded.slice(0, 12)}">
      <div class="episode-info">
        <span class="episode-number">${escapeHtml(episode.episode)}</span>
        <span class="episode-title">${escapeHtml(episode.title)}</span>
      </div>
      <div class="episode-meta">
        <span class="episode-duration">${escapeHtml(episode.duration || '')}</span>
        <span class="badge badge-${badgeClass}">${displayType}</span>
      </div>
    </a>`;
}

// ── Pagination ──────────────────────────────────────────
export function renderPagination(currentPage, totalPages, hashBase) {
  if (totalPages <= 1) return '';

  const pages = [];
  const range = 2;

  // Always show first
  pages.push(1);

  // Left ellipsis
  if (currentPage - range > 2) pages.push('...');

  // Middle range
  for (let i = Math.max(2, currentPage - range); i <= Math.min(totalPages - 1, currentPage + range); i++) {
    pages.push(i);
  }

  // Right ellipsis
  if (currentPage + range < totalPages - 1) pages.push('...');

  // Always show last
  if (totalPages > 1) pages.push(totalPages);

  let html = '<div class="pagination">';

  // Prev button
  html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="window.location.hash='${hashBase}${currentPage - 1}'">‹</button>`;

  for (const p of pages) {
    if (p === '...') {
      html += '<span class="page-ellipsis">…</span>';
    } else {
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="window.location.hash='${hashBase}${p}'">${p}</button>`;
    }
  }

  // Next button
  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="window.location.hash='${hashBase}${currentPage + 1}'">›</button>`;

  html += '</div>';
  return html;
}

// ── Quality Selector ────────────────────────────────────
export function renderQualitySelector(qualities, activeQuality) {
  let html = '<div class="quality-bar"><span class="quality-label">Quality:</span>';

  for (const [label, data] of Object.entries(qualities)) {
    const isActive = label === activeQuality;
    html += `<button class="quality-btn ${isActive ? 'active' : ''}" data-quality="${escapeHtml(label)}" data-stream-url="${escapeHtml(data.url)}" data-referer="${escapeHtml(data.referer)}">${escapeHtml(label)}</button>`;
  }

  html += '</div>';
  return html;
}

// ── Genre Tags ──────────────────────────────────────────
export function renderGenreTags(genres) {
  if (!genres || genres.length === 0) return '';
  return `<div class="detail-genres">${genres.map(g => `<span class="genre-tag">${escapeHtml(g.name)}</span>`).join('')}</div>`;
}

// ── Back Button ─────────────────────────────────────────
export function renderBackButton(text = 'Back') {
  return `<button class="back-btn" onclick="history.back()"><span class="back-arrow">←</span> ${escapeHtml(text)}</button>`;
}

// ── State Messages ──────────────────────────────────────
export function renderError(title = 'Something went wrong', desc = 'Please try again later.') {
  return `
    <div class="state-message">
      <div class="state-icon">⚠️</div>
      <h2 class="state-title">${escapeHtml(title)}</h2>
      <p class="state-desc">${escapeHtml(desc)}</p>
      <button class="state-action" onclick="location.reload()">Retry</button>
    </div>`;
}

export function renderEmpty(title = 'Nothing found', desc = 'Try a different search term.') {
  return `
    <div class="state-message">
      <div class="state-icon">🔍</div>
      <h2 class="state-title">${escapeHtml(title)}</h2>
      <p class="state-desc">${escapeHtml(desc)}</p>
    </div>`;
}

// ── Detail Page Skeleton ────────────────────────────────
export function renderDetailSkeleton() {
  return `
    <div class="detail-page">
      <div class="detail-hero">
        <div class="detail-poster"><div class="skeleton-block" style="width:100%;height:100%"></div></div>
        <div class="detail-info">
          <div class="skeleton-line" style="height:32px;width:60%"></div>
          <div class="skeleton-line" style="height:18px;width:40%"></div>
          <div class="skeleton-line" style="height:18px;width:50%"></div>
          <div style="margin-top:16px">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Watch Page Skeleton ─────────────────────────────────
export function renderWatchSkeleton() {
  return `
    <div class="watch-page">
      <div class="skeleton-line" style="height:24px;width:40%"></div>
      <div class="skeleton-line" style="height:16px;width:25%;margin-bottom:16px"></div>
      <div class="skeleton-block" style="width:100%;aspect-ratio:16/9;border-radius:var(--radius-lg)"></div>
    </div>`;
}

// ── Escape HTML ─────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
