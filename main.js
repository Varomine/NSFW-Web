// Anisecret App Logic
const API_BASE = 'https://nsfw-api-3dsg.onrender.com/api';

// State Management
const state = {
  watchlist: JSON.parse(localStorage.getItem('anisecret_watchlist')) || [],
  history: JSON.parse(localStorage.getItem('anisecret_history')) || [],
  cinemaMode: JSON.parse(localStorage.getItem('anisecret_cinema')) || false,
  currentPopularPage: 1,
  popularCache: [],
  recentCache: [],
  activeVideo: null
};

// Utilities for UI state
const elements = {
  content: document.getElementById('app-content'),
  search: document.getElementById('search-bar'),
  badge: document.getElementById('watchlist-badge'),
  navHome: document.getElementById('nav-home'),
  navRecent: document.getElementById('nav-recent'),
  navGenres: document.getElementById('nav-genres'),
  navWatchlist: document.getElementById('nav-watchlist'),
  navHistory: document.getElementById('nav-history')
};

const genresList = [
  { name: '3D', slug: '3d', icon: 'fa-solid fa-cube' },
  { name: 'Anal', slug: 'anal', icon: 'fa-solid fa-heart' },
  { name: 'Babe', slug: 'babe', icon: 'fa-solid fa-venus' },
  { name: 'Big Dick', slug: 'bigdick', icon: 'fa-solid fa-mars' },
  { name: 'Big Tits', slug: 'bigtits', icon: 'fa-solid fa-star' },
  { name: 'Blowjob', slug: 'blowjob', icon: 'fa-solid fa-circle-dot' },
  { name: 'Cartoon', slug: 'cartoon', icon: 'fa-solid fa-palette' },
  { name: 'Comics', slug: 'comics', icon: 'fa-solid fa-book-open' },
  { name: 'Cumshot', slug: 'cumshot', icon: 'fa-solid fa-water' },
  { name: 'Fetish', slug: 'fetish', icon: 'fa-solid fa-masks-theater' },
  { name: 'Futanari', slug: 'futanari', icon: 'fa-solid fa-transgender' },
  { name: 'Gay', slug: 'gay', icon: 'fa-solid fa-mars-double' },
  { name: 'Groupsex', slug: 'groupsex', icon: 'fa-solid fa-users' },
  { name: 'Hentai', slug: 'hentai', icon: 'fa-solid fa-circle-play' },
  { name: 'Lesbian', slug: 'lesbian', icon: 'fa-solid fa-venus-double' },
  { name: 'Masturbation', slug: 'masturbation', icon: 'fa-solid fa-hand-fist' },
  { name: 'Mature', slug: 'mature', icon: 'fa-solid fa-crown' },
  { name: 'Monster', slug: 'monster', icon: 'fa-solid fa-spider' },
  { name: 'Rough Sex', slug: 'roughsex', icon: 'fa-solid fa-bolt' },
  { name: 'Teen', slug: 'teen', icon: 'fa-solid fa-user-graduate' },
  { name: 'Toys', slug: 'toys', icon: 'fa-solid fa-shapes' },
  { name: 'Voyeur', slug: 'voyeur', icon: 'fa-solid fa-binoculars' }
];

// Helper to hash a string to generate consistent fallback values
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Generate a stable view count based on video ID
function getFallbackViews(id) {
  const hash = hashCode(id);
  // Returns views between 75K and 2.5M
  return 75000 + (hash % 2425000);
}

// Generate a stable duration based on video ID
function getFallbackDuration(id) {
  const hash = hashCode(id);
  // Returns duration between 11 and 35 minutes
  const mins = 11 + (hash % 25);
  const secs = hash % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Retrieve full metadata from any cache/storage or reconstruct it
function getOrReconstructVideoMeta(id, apiDetails = null) {
  let cached = null;

  // Try finding in current page popular list
  if (state.popularCache && state.popularCache.length > 0) {
    cached = state.popularCache.find(v => v.id === id);
  }
  // Try recent list
  if (!cached && state.recentCache && state.recentCache.length > 0) {
    cached = state.recentCache.find(v => v.id === id);
  }
  // Try watchlist
  if (!cached && state.watchlist && state.watchlist.length > 0) {
    cached = state.watchlist.find(v => v.id === id);
  }
  // Try history
  if (!cached && state.history && state.history.length > 0) {
    cached = state.history.find(v => v.id === id);
  }

  if (cached) {
    return {
      id: cached.id,
      title: cached.title,
      thumbnail: cached.thumbnail,
      views: cached.views,
      duration: cached.duration,
      trailer: cached.trailer
    };
  }

  // Fallback to API Watch details reconstruction
  if (apiDetails) {
    let thumbnail = apiDetails.thumbnail;
    let views = apiDetails.views || 0;
    let duration = apiDetails.duration || '';
    const trailer = apiDetails.trailer || '';

    // If thumbnail is empty or just "h", reconstruct from HLS source url
    if ((!thumbnail || thumbnail.length < 5) && apiDetails.source && apiDetails.source.length > 0) {
      const src = apiDetails.source[0].src;
      const parts = src.split('/');
      const flvIndex = parts.indexOf('flv');
      if (flvIndex !== -1 && parts[flvIndex + 1] && parts[flvIndex + 2]) {
        thumbnail = `https://cdn1.images.hentaicity.com/videos/${parts[flvIndex + 1]}/${parts[flvIndex + 2]}/main.jpg`;
      }
    }

    if (!views) {
      views = getFallbackViews(id);
    }
    if (!duration) {
      duration = getFallbackDuration(id);
    }

    return {
      id: apiDetails.id,
      title: apiDetails.title,
      thumbnail: thumbnail,
      views: views,
      duration: duration,
      trailer: trailer
    };
  }

  return null;
}

// Format large numbers (e.g. 100000 -> 100K)
function formatViews(views) {
  if (!views) return '0 views';
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(0)}K views`;
  }
  return `${views} views`;
}

// Global Header Scroll Effect
window.addEventListener('scroll', () => {
  const header = document.getElementById('app-header');
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Update Badge Count
function updateWatchlistBadge() {
  if (state.watchlist.length > 0) {
    elements.badge.textContent = state.watchlist.length;
    elements.badge.style.display = 'block';
  } else {
    elements.badge.style.display = 'none';
  }
}

// Watchlist operations
function toggleWatchlist(video) {
  const index = state.watchlist.findIndex(v => v.id === video.id);
  let added = false;
  if (index === -1) {
    state.watchlist.unshift(video);
    added = true;
  } else {
    state.watchlist.splice(index, 1);
  }
  localStorage.setItem('anisecret_watchlist', JSON.stringify(state.watchlist));
  updateWatchlistBadge();
  return added;
}

function inWatchlist(id) {
  return state.watchlist.some(v => v.id === id);
}

// History operations
function addToHistory(video) {
  // Remove existing instance
  state.history = state.history.filter(v => v.id !== video.id);
  // Add to front
  state.history.unshift(video);
  // Limit to 50 items
  if (state.history.length > 50) {
    state.history.pop();
  }
  localStorage.setItem('anisecret_history', JSON.stringify(state.history));
}

function clearHistory() {
  state.history = [];
  localStorage.setItem('anisecret_history', JSON.stringify(state.history));
  renderHistory();
}

// Active Nav Link Styling helper
function setActiveNavLink(activeId) {
  [elements.navHome, elements.navRecent, elements.navGenres, elements.navWatchlist, elements.navHistory].forEach(link => {
    if (link) link.classList.remove('active');
  });
  const activeLink = document.getElementById(activeId);
  if (activeLink) activeLink.classList.add('active');
}

// API Fetches
async function fetchPopular(page = 1) {
  try {
    const res = await fetch(`${API_BASE}/hentaicity/popular?page=${page}`);
    if (!res.ok) throw new Error('API server error');
    return await res.json();
  } catch (error) {
    console.error('Fetch Popular Error:', error);
    return null;
  }
}

async function fetchRecent() {
  try {
    const res = await fetch(`${API_BASE}/hentaicity/recent`);
    if (!res.ok) throw new Error('API server error');
    return await res.json();
  } catch (error) {
    console.error('Fetch Recent Error:', error);
    return null;
  }
}

async function fetchVideoDetails(id) {
  try {
    const res = await fetch(`${API_BASE}/hentaicity/watch/${id}`);
    if (!res.ok) throw new Error('API server error');
    return await res.json();
  } catch (error) {
    console.error('Fetch Details Error:', error);
    return null;
  }
}

// Fetch and parse real HTML search page from Hentaicity (CORS proxied locally via Vite)
async function fetchSearch(query) {
  try {
    const res = await fetch(`/hentaicity-search/search/video/${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to fetch search page');
    const html = await res.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('.outer-item');
    
    return Array.from(items).map(item => {
      const linkEl = item.querySelector('a.thumb-img');
      const titleEl = item.querySelector('a.video-title');
      const imgEl = item.querySelector('img');
      const timeEl = item.querySelector('.time');
      const videoEl = item.querySelector('video');
      const infoSpans = item.querySelectorAll('.info span');
      
      let id = '';
      if (linkEl) {
        const href = linkEl.getAttribute('href');
        const match = href.match(/\/video\/([^.]+)\.html/);
        if (match) id = match[1];
      }
      
      let views = 0;
      if (infoSpans && infoSpans.length > 1) {
        const viewsRaw = infoSpans[1].textContent.trim();
        views = parseInt(viewsRaw.replace(/\D/g, '')) || 0;
      }
      
      return {
        id: id,
        title: titleEl ? titleEl.getAttribute('title') || titleEl.textContent : '',
        thumbnail: imgEl ? imgEl.getAttribute('src') : '',
        duration: timeEl ? timeEl.textContent : '00:00',
        trailer: videoEl ? videoEl.getAttribute('src') : '',
        views: views
      };
    }).filter(video => video.id);
  } catch (error) {
    console.error('Fetch Search Error:', error);
    return null;
  }
}

// Render search results grid
async function renderSearchPage(query) {
  [elements.navHome, elements.navRecent, elements.navWatchlist, elements.navHistory].forEach(l => l && l.classList.remove('active'));
  showLoading(`Searching database for "${query}"...`);
  
  elements.search.value = query;

  const results = await fetchSearch(query);
  if (!results) {
    showError(`Error searching database for "${query}".`, () => renderSearchPage(query));
    return;
  }

  // Cache in popularCache so when we click a search card, we can pull its details
  state.popularCache = [...results, ...state.popularCache];

  if (results.length === 0) {
    elements.content.innerHTML = `
      <div class="container" style="margin-top: 40px;">
        <div class="empty-view">
          <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
          <div class="empty-text">No database matches found for "${query}"</div>
          <p style="color:var(--text-muted); font-size:14px; margin-top:8px;">Try searching another keyword (e.g. "marika", "wife", "teacher").</p>
          <a href="#/" class="hero-btn" style="margin-top: 24px;"><i class="fa-solid fa-house"></i> Go Home</a>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="container" style="margin-top: 30px;">
      <div class="section-header">
        <h2 class="section-title">Search Results</h2>
        <span style="color:var(--text-muted); font-size:14px;">Found ${results.length} matches for "${query}"</span>
      </div>

      <div class="grid" id="search-grid">
        ${results.map(createCardHTML).join('')}
      </div>
    </div>
  `;

  elements.content.innerHTML = html;
  bindGridEvents(document.getElementById('search-grid'), results);
}

// Fetch category videos page (CORS proxied locally via Vite)
async function fetchCategoryVideos(slug, page = 1) {
  try {
    const url = page === 1 
      ? `/hentaicity-search/videos/straight/${slug}-popular.html` 
      : `/hentaicity-search/videos/straight/${slug}-popular-${page}.html`;
      
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch category page');
    const html = await res.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('.outer-item');
    
    // Extract total pages from hentaicity pagination elements
    const maxPageEl = doc.getElementById('maxpage') || doc.querySelector('.total_pages');
    const lastPage = maxPageEl ? parseInt(maxPageEl.textContent.trim()) : 1;
    
    const videos = Array.from(items).map(item => {
      const linkEl = item.querySelector('a.thumb-img');
      const titleEl = item.querySelector('a.video-title');
      const imgEl = item.querySelector('img');
      const timeEl = item.querySelector('.time');
      const videoEl = item.querySelector('video');
      const infoSpans = item.querySelectorAll('.info span');
      
      let id = '';
      if (linkEl) {
        const href = linkEl.getAttribute('href');
        const match = href.match(/\/video\/([^.]+)\.html/);
        if (match) id = match[1];
      }
      
      let views = 0;
      if (infoSpans && infoSpans.length > 1) {
        const viewsRaw = infoSpans[1].textContent.trim();
        views = parseInt(viewsRaw.replace(/\D/g, '')) || 0;
      }
      
      return {
        id: id,
        title: titleEl ? titleEl.getAttribute('title') || titleEl.textContent : '',
        thumbnail: imgEl ? imgEl.getAttribute('src') : '',
        duration: timeEl ? timeEl.textContent : '00:00',
        trailer: videoEl ? videoEl.getAttribute('src') : '',
        views: views
      };
    }).filter(video => video.id);

    return {
      videos: videos,
      pagination: {
        current: page,
        last: lastPage
      }
    };
  } catch (error) {
    console.error('Fetch Category Videos Error:', error);
    return null;
  }
}

// Render Genres categories list view
function renderGenres() {
  setActiveNavLink('nav-genres');
  
  let html = `
    <div class="container" style="margin-top: 30px;">
      <div class="section-header">
        <h2 class="section-title">Database Genres</h2>
        <span style="color:var(--text-muted); font-size:14px;">Total Categories: ${genresList.length}</span>
      </div>

      <div class="genres-grid">
        ${genresList.map(genre => `
          <div class="genre-card" onclick="location.hash='#/genres/${genre.slug}'">
            <i class="${genre.icon} genre-icon"></i>
            <span class="genre-name">${genre.name}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  elements.content.innerHTML = html;
}

// Render category videos grid view
async function renderCategoryVideos(slug, page = 1) {
  setActiveNavLink('nav-genres');
  
  const genre = genresList.find(g => g.slug === slug);
  const genreName = genre ? genre.name : slug;
  
  showLoading(`Loading ${genreName} videos (Page ${page})...`);
  
  const data = await fetchCategoryVideos(slug, page);
  if (!data || !data.videos) {
    showError(`Error loading ${genreName} videos from database.`, () => renderCategoryVideos(slug, page));
    return;
  }

  const results = data.videos;
  const pagination = data.pagination;

  // Cache in popularCache so detail lookup works
  state.popularCache = [...results, ...state.popularCache];

  if (results.length === 0) {
    elements.content.innerHTML = `
      <div class="container" style="margin-top: 40px;">
        <div class="empty-view">
          <div class="empty-icon"><i class="fa-solid fa-folder-open"></i></div>
          <div class="empty-text">No videos found under genre "${genreName}"</div>
          <a href="#/genres" class="hero-btn" style="margin-top: 24px;"><i class="fa-solid fa-arrow-left"></i> All Genres</a>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="container" style="margin-top: 30px;">
      <div class="section-header">
        <h2 class="section-title">Genre: ${genreName}</h2>
        <a href="#/genres" class="control-btn"><i class="fa-solid fa-arrow-left"></i> Back to Genres</a>
      </div>

      <div class="grid" id="genre-grid">
        ${results.map(createCardHTML).join('')}
      </div>

      <!-- Pagination UI -->
      <div class="pagination-container">
  `;

  // Render pagination buttons
  // Prev button
  const hasPrev = pagination.current > 1;
  html += `
    <button class="page-btn" ${hasPrev ? '' : 'disabled'} onclick="location.hash='#/genres/${slug}?page=${pagination.current - 1}'" title="Previous Page">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Page Numbers: We can display surrounding pages
  const startPage = Math.max(1, pagination.current - 2);
  const endPage = Math.min(pagination.last, pagination.current + 2);

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="location.hash='#/genres/${slug}?page=1'">1</button>`;
    if (startPage > 2) html += `<span class="page-dots">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="page-btn ${i === pagination.current ? 'active' : ''}" onclick="location.hash='#/genres/${slug}?page=${i}'">
        ${i}
      </button>
    `;
  }

  if (endPage < pagination.last) {
    if (endPage < pagination.last - 1) html += `<span class="page-dots">...</span>`;
    html += `<button class="page-btn" onclick="location.hash='#/genres/${slug}?page=${pagination.last}'">${pagination.last}</button>`;
  }

  // Next button
  const hasNext = pagination.current < pagination.last;
  html += `
    <button class="page-btn" ${hasNext ? '' : 'disabled'} onclick="location.hash='#/genres/${slug}?page=${pagination.current + 1}'" title="Next Page">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  html += `
      </div>
    </div>
  `;

  elements.content.innerHTML = html;
  bindGridEvents(document.getElementById('genre-grid'), results);
}

// Hover Trailer Player Handler
function setupTrailerHover(card, trailerUrl) {
  if (!trailerUrl) return;
  
  let videoEl = null;
  let playTimeout = null;

  card.addEventListener('mouseenter', () => {
    // Deliberate small timeout (150ms) to prevent play requests during fast mouse sweeping
    playTimeout = setTimeout(() => {
      videoEl = document.createElement('video');
      videoEl.className = 'card-trailer';
      videoEl.src = trailerUrl;
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.setAttribute('playsinline', '');
      
      const mediaContainer = card.querySelector('.card-media');
      mediaContainer.appendChild(videoEl);
      
      videoEl.play()
        .then(() => {
          card.classList.add('hovered');
          videoEl.style.opacity = '1';
        })
        .catch(err => console.log('Trailer play failed/aborted:', err));
    }, 200);
  });

  card.addEventListener('mouseleave', () => {
    if (playTimeout) clearTimeout(playTimeout);
    if (videoEl) {
      card.classList.remove('hovered');
      videoEl.style.opacity = '0';
      const tempVideo = videoEl;
      videoEl = null;
      setTimeout(() => {
        if (tempVideo && tempVideo.parentNode) {
          tempVideo.pause();
          tempVideo.parentNode.removeChild(tempVideo);
        }
      }, 300);
    }
  });
}

// Card Renderer Utility
function createCardHTML(video) {
  const isFav = inWatchlist(video.id);
  const durationText = video.duration || '00:00';
  const viewsText = formatViews(video.views);

  return `
    <div class="video-card" data-id="${video.id}" data-trailer="${video.trailer || ''}">
      <div class="card-media" onclick="location.hash = '#/watch/${video.id}'">
        <img class="card-thumbnail" src="${video.thumbnail}" alt="${video.title}" loading="lazy">
        <span class="card-badge badge-views"><i class="fa-solid fa-eye"></i> ${viewsText}</span>
        <span class="card-badge badge-duration">${durationText}</span>
      </div>
      <div class="card-info">
        <h3 class="card-title" onclick="location.hash = '#/watch/${video.id}'" title="${video.title}">${video.title}</h3>
        <div class="card-footer">
          <span style="font-size:12px; color:var(--text-muted);">Hentaicity</span>
          <button class="watchlist-btn ${isFav ? 'in-watchlist' : ''}" data-id="${video.id}" title="Toggle Watchlist">
            <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Bind Watchlist buttons in grids
function bindGridEvents(container, dataset) {
  // Bind Watchlist toggle buttons
  container.querySelectorAll('.watchlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = dataset.find(v => v.id === id);
      if (item) {
        const added = toggleWatchlist(item);
        btn.classList.toggle('in-watchlist', added);
        const icon = btn.querySelector('i');
        if (added) {
          icon.className = 'fa-solid fa-bookmark';
        } else {
          icon.className = 'fa-regular fa-bookmark';
        }
      }
    });
  });

  // Bind trailer hover system
  container.querySelectorAll('.video-card').forEach(card => {
    const trailerUrl = card.getAttribute('data-trailer');
    setupTrailerHover(card, trailerUrl);
  });
}

// Loading state renderer
function showLoading(msg = 'Fetching Content...') {
  elements.content.innerHTML = `
    <div class="container">
      <div class="loading-view">
        <div class="spinner"></div>
        <div class="loading-text">${msg}</div>
      </div>
    </div>
  `;
}

// Error state renderer
function showError(msg = 'Failed to load data. Please check your connection.', retryCallback = null) {
  elements.content.innerHTML = `
    <div class="container">
      <div class="empty-view">
        <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation" style="color: #ffb703;"></i></div>
        <div class="empty-text">${msg}</div>
        ${retryCallback ? '<button id="retry-btn" class="hero-btn" style="margin-top: 20px;"><i class="fa-solid fa-arrows-rotate"></i> Retry</button>' : ''}
      </div>
    </div>
  `;
  if (retryCallback) {
    document.getElementById('retry-btn').addEventListener('click', retryCallback);
  }
}

// --- Home / Popular View ---
async function renderPopular(page = 1) {
  setActiveNavLink('nav-home');
  showLoading('Loading popular videos...');
  state.currentPopularPage = page;
  
  const data = await fetchPopular(page);
  if (!data || !data.results || data.results.length === 0) {
    showError('Could not fetch popular videos from database.', () => renderPopular(page));
    return;
  }
  
  state.popularCache = data.results;
  const results = data.results;
  const pagination = data.pagination;

  // Select 5 random items from results to feature in Netflix-style slider
  const sliderItems = [...results].sort(() => 0.5 - Math.random()).slice(0, Math.min(results.length, 5));

  let html = `
    <div class="container">
      <!-- Hero Banner (Slideshow Slider) -->
      <div class="hero" id="hero-slider">
        ${sliderItems.map((video, idx) => `
          <div class="hero-slide ${idx === 0 ? 'active' : ''}" style="background-image: url('${video.thumbnail}')">
            <div class="hero-slide-overlay"></div>
            <div class="hero-slide-content">
              <span class="hero-tag"><i class="fa-solid fa-fire"></i> Featured Popular</span>
              <h1 class="hero-title">${video.title}</h1>
              <div class="hero-meta">
                <span><i class="fa-solid fa-eye"></i> ${formatViews(video.views)}</span>
                <span><i class="fa-solid fa-clock"></i> ${video.duration || '00:00'}</span>
                <span><i class="fa-solid fa-film"></i> Hentaicity</span>
              </div>
              <button class="hero-btn" onclick="location.hash='#/watch/${video.id}'">
                <i class="fa-solid fa-play"></i> Watch Now
              </button>
            </div>
          </div>
        `).join('')}
        
        <!-- Arrows -->
        <button class="hero-nav-btn prev" id="slider-prev-btn" title="Previous Slide"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="hero-nav-btn next" id="slider-next-btn" title="Next Slide"><i class="fa-solid fa-chevron-right"></i></button>
        
        <!-- Indicators -->
        <div class="hero-indicators">
          ${sliderItems.map((_, idx) => `
            <div class="hero-dot-indicator ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>
          `).join('')}
        </div>
      </div>

      <!-- Video Grid Header -->
      <div class="section-header">
        <h2 class="section-title">Trending database</h2>
        <span style="color:var(--text-muted); font-size:14px;">Showing page ${pagination.current} of ${pagination.last}</span>
      </div>

      <!-- Video Grid -->
      <div class="grid" id="popular-grid">
        ${results.map(createCardHTML).join('')}
      </div>

      <!-- Pagination UI -->
      <div class="pagination-container">
  `;

  // Render pagination buttons
  // Prev button
  const hasPrev = pagination.current > 1;
  html += `
    <button class="page-btn" ${hasPrev ? '' : 'disabled'} onclick="location.hash='#/?page=${pagination.current - 1}'" title="Previous Page">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Page Numbers: We can display surrounding pages
  const startPage = Math.max(1, pagination.current - 2);
  const endPage = Math.min(pagination.last, pagination.current + 2);

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="location.hash='#/?page=1'">1</button>`;
    if (startPage > 2) html += `<span class="page-dots">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="page-btn ${i === pagination.current ? 'active' : ''}" onclick="location.hash='#/?page=${i}'">
        ${i}
      </button>
    `;
  }

  if (endPage < pagination.last) {
    if (endPage < pagination.last - 1) html += `<span class="page-dots">...</span>`;
    html += `<button class="page-btn" onclick="location.hash='#/?page=${pagination.last}'">${pagination.last}</button>`;
  }

  // Next button
  const hasNext = pagination.current < pagination.last;
  html += `
    <button class="page-btn" ${hasNext ? '' : 'disabled'} onclick="location.hash='#/?page=${pagination.current + 1}'" title="Next Page">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  html += `
      </div>
    </div>
  `;

  elements.content.innerHTML = html;
  
  // Bind card elements
  bindGridEvents(document.getElementById('popular-grid'), results);

  // Initialize Slider Controllers
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot-indicator');
  const prevBtn = document.getElementById('slider-prev-btn');
  const nextBtn = document.getElementById('slider-next-btn');
  
  let currentSlide = 0;
  let autoPlayInterval = null;

  function showSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;
    currentSlide = index;
    
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlayInterval = setInterval(() => {
      showSlide(currentSlide + 1);
    }, 6000); // Shift every 6 seconds
  }

  function stopAutoPlay() {
    if (autoPlayInterval) clearInterval(autoPlayInterval);
  }

  if (slides.length > 1) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSlide(currentSlide - 1);
      startAutoPlay();
    });
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSlide(currentSlide + 1);
      startAutoPlay();
    });
    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(dot.getAttribute('data-index'));
        showSlide(idx);
        startAutoPlay();
      });
    });
    
    // Start autoplay
    startAutoPlay();
    
    // Pause on hover
    const sliderEl = document.getElementById('hero-slider');
    sliderEl.addEventListener('mouseenter', stopAutoPlay);
    sliderEl.addEventListener('mouseleave', startAutoPlay);
  }
}

// --- Recent View ---
async function renderRecent() {
  setActiveNavLink('nav-recent');
  showLoading('Loading recent releases...');
  
  const results = await fetchRecent();
  if (!results || results.length === 0) {
    showError('Could not load recent database entries.', () => renderRecent());
    return;
  }

  state.recentCache = results;

  let html = `
    <div class="container" style="margin-top: 30px;">
      <div class="section-header">
        <h2 class="section-title">Recently Released</h2>
        <span style="color:var(--text-muted); font-size:14px;">Total: ${results.length} entries</span>
      </div>

      <div class="grid" id="recent-grid">
        ${results.map(createCardHTML).join('')}
      </div>
    </div>
  `;

  elements.content.innerHTML = html;
  bindGridEvents(document.getElementById('recent-grid'), results);
}

// --- Watch/Streaming View ---
async function renderWatch(id) {
  // We don't active specific navigation tags unless it maps, watch is isolated
  [elements.navHome, elements.navRecent, elements.navWatchlist, elements.navHistory].forEach(l => l && l.classList.remove('active'));
  showLoading('Configuring streaming links...');

  const video = await fetchVideoDetails(id);
  if (!video || !video.source || video.source.length === 0) {
    showError('Stream is currently unavailable or API returned empty links.', () => renderWatch(id));
    return;
  }

  state.activeVideo = video;
  
  // Find HLS source
  const source = video.source[0];
  const sourceUrl = source.src;
  
  // Get correct metadata (from cache or reconstruct from source)
  const meta = getOrReconstructVideoMeta(id, video);

  // Save to history using full resolved metadata
  addToHistory(meta);

  const isFav = inWatchlist(video.id);

  // Recommendations: sidebar items. Load popular or recent cache as base.
  let recs = [];
  if (state.popularCache.length > 0) {
    recs = state.popularCache.filter(v => v.id !== video.id).slice(0, 8);
  } else {
    // If cache empty, load some popular list in background or fetch
    const popData = await fetchPopular(1);
    if (popData && popData.results) {
      state.popularCache = popData.results;
      recs = state.popularCache.filter(v => v.id !== video.id).slice(0, 8);
    }
  }

  const viewsText = formatViews(meta.views);

  let html = `
    <div class="container" style="margin-top: 24px;">
      <div class="watch-container ${state.cinemaMode ? 'cinema-mode' : ''}" id="watch-layout">
        
        <!-- Main Watch Area -->
        <div class="watch-main">
          
          <!-- Beautiful Styled Player iframe Container -->
          <div class="player-container-wrapper">
            <iframe 
              id="stream-iframe"
              class="watch-iframe" 
              src="./player.html?src=${encodeURIComponent(sourceUrl)}&title=${encodeURIComponent(video.title)}" 
              allowfullscreen 
              allow="autoplay; encrypted-media; picture-in-picture">
            </iframe>
          </div>

          <!-- Cinema Mode and Controls -->
          <div class="watch-controls">
            <button id="cinema-toggle" class="control-btn ${state.cinemaMode ? 'active' : ''}">
              <i class="fa-solid fa-expand"></i> Cinema Mode
            </button>
            <button id="fullscreen-iframe-btn" class="control-btn">
              <i class="fa-solid fa-maximize"></i> Fullscreen
            </button>
          </div>

          <!-- Details Panel -->
          <div class="video-meta-details">
            <h1 class="watch-title">${video.title}</h1>
            <div class="watch-stats">
              <span><i class="fa-solid fa-eye"></i> ${viewsText}</span>
              <span><i class="fa-solid fa-clock"></i> ${meta.duration || 'N/A'}</span>
              <span><i class="fa-solid fa-server"></i> Server: Hentaicity HLS</span>
              <span><i class="fa-solid fa-check-double" style="color:var(--accent-neon);"></i> Full Speed</span>
            </div>
            <div class="watch-actions-bar">
              <button id="watchlist-toggle-btn" class="action-btn-main ${isFav ? 'added' : ''}">
                <i class="fa-${isFav ? 'solid' : 'regular'} fa-bookmark"></i> 
                ${isFav ? 'Added to Watchlist' : 'Add to Watchlist'}
              </button>
            </div>
          </div>
        </div>

        <!-- Sidebar Recommendations -->
        <div class="watch-sidebar">
          <h3 class="sidebar-title">Recommended Database</h3>
          <div class="sidebar-list">
            ${recs.map(item => `
              <div class="horizontal-card" onclick="location.hash='#/watch/${item.id}'">
                <div class="card-media">
                  <img class="card-thumbnail" src="${item.thumbnail}" alt="${item.title}" loading="lazy">
                </div>
                <div class="card-info">
                  <h4 class="card-title" title="${item.title}">${item.title}</h4>
                  <div class="card-meta">
                    <span><i class="fa-solid fa-eye"></i> ${formatViews(item.views)}</span>
                    <span><i class="fa-solid fa-clock"></i> ${item.duration || '00:00'}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    </div>
  `;

  elements.content.innerHTML = html;

  // Cinema Mode handler
  const layout = document.getElementById('watch-layout');
  const cinemaBtn = document.getElementById('cinema-toggle');
  cinemaBtn.addEventListener('click', () => {
    state.cinemaMode = !state.cinemaMode;
    localStorage.setItem('anisecret_cinema', JSON.stringify(state.cinemaMode));
    layout.classList.toggle('cinema-mode', state.cinemaMode);
    cinemaBtn.classList.toggle('active', state.cinemaMode);
  });

  // Watchlist toggle button
  const watchlistBtn = document.getElementById('watchlist-toggle-btn');
  watchlistBtn.addEventListener('click', () => {
    // Generate object compatible with card lists using resolved metadata
    const cardVideo = {
      id: meta.id,
      title: meta.title,
      thumbnail: meta.thumbnail,
      views: meta.views,
      duration: meta.duration,
      trailer: meta.trailer
    };
    const added = toggleWatchlist(cardVideo);
    watchlistBtn.classList.toggle('added', added);
    watchlistBtn.innerHTML = added 
      ? '<i class="fa-solid fa-bookmark"></i> Added to Watchlist' 
      : '<i class="fa-regular fa-bookmark"></i> Add to Watchlist';
  });

  // Native fullscreen call to player iframe (uses mobile CSS fallback if on phone/tablet)
  const fullscreenBtn = document.getElementById('fullscreen-iframe-btn');
  const playerWrapper = document.querySelector('.player-container-wrapper');
  
  fullscreenBtn.addEventListener('click', () => {
    const isMobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      const isActive = playerWrapper.classList.toggle('mobile-fullscreen-active');
      fullscreenBtn.innerHTML = isActive 
        ? '<i class="fa-solid fa-minimize"></i> Exit Fullscreen' 
        : '<i class="fa-solid fa-maximize"></i> Fullscreen';
        
      if (isActive) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    } else {
      const iframe = document.getElementById('stream-iframe');
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      } else if (iframe.webkitRequestFullscreen) { /* Safari */
        iframe.webkitRequestFullscreen();
      } else if (iframe.msRequestFullscreen) { /* IE11 */
        iframe.msRequestFullscreen();
      }
    }
  });
}

// --- Watchlist View ---
function renderWatchlist() {
  setActiveNavLink('nav-watchlist');
  
  if (state.watchlist.length === 0) {
    elements.content.innerHTML = `
      <div class="container" style="margin-top: 40px;">
        <div class="empty-view">
          <div class="empty-icon"><i class="fa-regular fa-bookmark"></i></div>
          <div class="empty-text">Your watchlist is currently empty.</div>
          <p style="color:var(--text-muted); font-size:14px; margin-top:8px;">Bookmark videos on home pages to watch them later.</p>
          <a href="#/" class="hero-btn" style="margin-top: 24px;"><i class="fa-solid fa-compass"></i> Discover Popular</a>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="container" style="margin-top: 30px;">
      <div class="section-header">
        <h2 class="section-title">My Watchlist</h2>
        <span style="color:var(--text-muted); font-size:14px;">Total: ${state.watchlist.length} videos</span>
      </div>

      <div class="grid" id="watchlist-grid">
        ${state.watchlist.map(createCardHTML).join('')}
      </div>
    </div>
  `;

  elements.content.innerHTML = html;
  
  // Bind actions
  bindGridEvents(document.getElementById('watchlist-grid'), state.watchlist);
  
  // Re-bind click event to refresh page if items are removed in watchlist
  document.querySelectorAll('#watchlist-grid .watchlist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Re-render after state changes (delay slightly for smooth removal)
      setTimeout(renderWatchlist, 150);
    });
  });
}

// --- History View ---
function renderHistory() {
  setActiveNavLink('nav-history');

  if (state.history.length === 0) {
    elements.content.innerHTML = `
      <div class="container" style="margin-top: 40px;">
        <div class="empty-view">
          <div class="empty-icon"><i class="fa-solid fa-history"></i></div>
          <div class="empty-text">No watch history found.</div>
          <p style="color:var(--text-muted); font-size:14px; margin-top:8px;">Videos you stream will appear here.</p>
          <a href="#/" class="hero-btn" style="margin-top: 24px;"><i class="fa-solid fa-compass"></i> Browse Videos</a>
        </div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="container" style="margin-top: 30px;">
      <div class="section-header">
        <h2 class="section-title">Watch History</h2>
        <button id="clear-history-btn" class="control-btn" style="border-color:#ff4d4d; color:#ff4d4d;"><i class="fa-solid fa-trash-can"></i> Clear History</button>
      </div>

      <div class="grid" id="history-grid">
        ${state.history.map(createCardHTML).join('')}
      </div>
    </div>
  `;

  elements.content.innerHTML = html;
  bindGridEvents(document.getElementById('history-grid'), state.history);

  document.getElementById('clear-history-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your entire watch history?')) {
      clearHistory();
    }
  });
}

// --- Router ---
function router() {
  const hash = window.location.hash || '#/';
  
  // Scroll to top on navigation
  window.scrollTo(0, 0);

  // Clear search bar value when swapping views (except search itself)
  if (!hash.startsWith('#/search/')) {
    elements.search.value = '';
  }

  if (hash.startsWith('#/watch/')) {
    const id = hash.replace('#/watch/', '');
    renderWatch(id);
  } else if (hash.startsWith('#/search/')) {
    const query = decodeURIComponent(hash.replace('#/search/', ''));
    renderSearchPage(query);
  } else if (hash === '#/genres') {
    renderGenres();
  } else if (hash.startsWith('#/genres/')) {
    const parts = hash.split('?');
    const slug = parts[0].replace('#/genres/', '');
    const params = new URLSearchParams(parts[1]);
    const pageNum = parseInt(params.get('page')) || 1;
    renderCategoryVideos(slug, pageNum);
  } else if (hash.startsWith('#/recent')) {
    renderRecent();
  } else if (hash.startsWith('#/watchlist')) {
    renderWatchlist();
  } else if (hash.startsWith('#/history')) {
    renderHistory();
  } else {
    // Default or Popular list with pagination parse
    const params = new URLSearchParams(hash.split('?')[1]);
    const pageNum = parseInt(params.get('page')) || 1;
    renderPopular(pageNum);
  }
}

// --- Remote Database Search on Enter ---
elements.search.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      location.hash = `#/search/${encodeURIComponent(query)}`;
    }
  }
});

// --- Client-Side Grid Filter (Search Bar) ---
elements.search.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const activeGrid = document.querySelector('.grid');
  
  if (!activeGrid) return;
  
  const cards = activeGrid.querySelectorAll('.video-card');
  let matchCount = 0;

  cards.forEach(card => {
    const title = card.querySelector('.card-title').textContent.toLowerCase();
    if (title.includes(query)) {
      card.style.display = 'flex';
      matchCount++;
    } else {
      card.style.display = 'none';
    }
  });

  // Toggle empty search results message
  let noResultsEl = document.getElementById('no-search-results');
  if (matchCount === 0) {
    if (!noResultsEl) {
      noResultsEl = document.createElement('div');
      noResultsEl.id = 'no-search-results';
      noResultsEl.className = 'empty-view';
      noResultsEl.innerHTML = `
        <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <div class="empty-text">No matches found for "${e.target.value}"</div>
        <p style="color:var(--text-muted); font-size:14px; margin-top:8px;">Try searching another keyword.</p>
      `;
      activeGrid.parentNode.appendChild(noResultsEl);
    }
  } else {
    if (noResultsEl) {
      noResultsEl.remove();
    }
  }
});

// App Initialization
window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
  updateWatchlistBadge();
  router();
});
