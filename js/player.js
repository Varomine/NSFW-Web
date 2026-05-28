// ═══════════════════════════════════════════════════════
//  AniSecret — HLS Video Player + Custom Controls
// ═══════════════════════════════════════════════════════

import { getProxyUrl } from './api.js';

let hlsInstance = null;
let _controlsTimer = null;
let _cleanupFns = [];

// ── SVG Icons for Player ────────────────────────────────
export const PlayerIcons = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>',
  volHigh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  volLow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  volMute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  exitFs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  back5: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><text x="12" y="15.5" font-size="7" font-weight="bold" fill="currentColor" stroke="none" text-anchor="middle">5</text></svg>',
  forward5: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><text x="12" y="15.5" font-size="7" font-weight="bold" fill="currentColor" stroke="none" text-anchor="middle">5</text></svg>',
};

// ── Initialize HLS ──────────────────────────────────────
export function initPlayer(videoEl, streamUrl, referer) {
  destroyPlayer();
  const proxyUrl = getProxyUrl(streamUrl, referer);

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      startLevel: -1,
      enableWorker: true,
    });
    hlsInstance.loadSource(proxyUrl);
    hlsInstance.attachMedia(videoEl);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      videoEl.play().catch(() => {});
      _hideLoading();
    });

    hlsInstance.on(Hls.Events.ERROR, (_evt, data) => {
      console.error('[HLS]', data.type, data.details);
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hlsInstance.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hlsInstance.recoverMediaError();
        else { destroyPlayer(); _showError(); }
      }
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = proxyUrl;
    videoEl.addEventListener('loadedmetadata', () => {
      videoEl.play().catch(() => {});
      _hideLoading();
    }, { once: true });
  } else {
    _showError('Your browser does not support HLS playback.');
  }
}

// ── Switch Quality ──────────────────────────────────────
export function switchQuality(videoEl, streamUrl, referer) {
  const time = videoEl.currentTime;
  const playing = !videoEl.paused;
  _showLoading();
  const proxyUrl = getProxyUrl(streamUrl, referer);

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, startLevel: -1, enableWorker: true });
    hlsInstance.loadSource(proxyUrl);
    hlsInstance.attachMedia(videoEl);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      videoEl.currentTime = time;
      if (playing) videoEl.play().catch(() => {});
      _hideLoading();
    });
    hlsInstance.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { destroyPlayer(); _showError(); } });
  } else {
    videoEl.src = proxyUrl;
    videoEl.currentTime = time;
    if (playing) videoEl.play().catch(() => {});
  }
}

// ── Destroy ─────────────────────────────────────────────
export function destroyPlayer() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  clearTimeout(_controlsTimer);
  _cleanupFns.forEach(fn => fn());
  _cleanupFns = [];
}

// ═══════════════════════════════════════════════════════
//  CUSTOM CONTROLS
// ═══════════════════════════════════════════════════════

export function setupControls(videoEl, qualities, activeQuality, episodeUrl) {
  const W = videoEl.closest('.player-wrapper');
  if (!W) return;

  const $ = (s) => W.querySelector(s);
  const progressWrap  = $('#progress-wrap');
  const progressBar   = $('#progress-played');
  const bufferBar     = $('#progress-buffer');
  const thumb         = $('#progress-thumb');
  const playBtn       = $('#ctrl-play');
  const back5Btn      = $('#ctrl-back-5');
  const forward5Btn   = $('#ctrl-forward-5');
  const timeEl        = $('#player-time');
  const volBtn        = $('#ctrl-volume');
  const volSlider     = $('#volume-slider');
  const qBtn          = $('#ctrl-quality');
  const qPopup        = $('#quality-popup');
  const qLabel        = $('#quality-label');
  const fsBtn         = $('#ctrl-fullscreen');
  const centerPlay    = $('#player-center-play');

  let curQ = activeQuality;
  let seeking = false;

  // Load saved volume settings
  const savedVolume = localStorage.getItem('player-volume');
  if (savedVolume !== null) {
    videoEl.volume = parseFloat(savedVolume);
  }
  const savedMuted = localStorage.getItem('player-muted');
  if (savedMuted !== null) {
    videoEl.muted = savedMuted === 'true';
  }

  // ── Helpers ──────────────────────
  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  // Show Resume Playback banner if progress exists
  if (episodeUrl) {
    const savedTimeVal = localStorage.getItem(`resume_${episodeUrl}`);
    if (savedTimeVal) {
      const resumeTime = parseFloat(savedTimeVal);
      if (resumeTime > 5) {
        const banner = document.createElement('div');
        banner.className = 'player-resume-banner';
        banner.innerHTML = `
          <div class="resume-banner-text">Resume watching from ${fmt(resumeTime)}?</div>
          <div class="resume-banner-actions">
            <button class="btn-resume-action yes" id="btn-resume-yes">Resume</button>
            <button class="btn-resume-action no" id="btn-resume-no">Start Over</button>
          </div>
        `;
        W.appendChild(banner);

        const removeBanner = () => {
          banner.classList.add('hide');
          setTimeout(() => banner.remove(), 300);
        };

        banner.querySelector('#btn-resume-yes').addEventListener('click', () => {
          videoEl.currentTime = resumeTime;
          videoEl.play().catch(() => {});
          removeBanner();
        });

        banner.querySelector('#btn-resume-no').addEventListener('click', () => {
          localStorage.removeItem(`resume_${episodeUrl}`);
          removeBanner();
        });

        // Auto remove banner after 8s
        const bannerTimeout = setTimeout(removeBanner, 8000);
        banner.addEventListener('click', () => clearTimeout(bannerTimeout));
      }
    }
  }

  function syncPlay() {
    const playing = !videoEl.paused && !videoEl.ended;
    playBtn.innerHTML = playing ? PlayerIcons.pause : PlayerIcons.play;
    if (centerPlay) {
      centerPlay.style.opacity = playing ? '0' : '1';
      centerPlay.style.pointerEvents = playing ? 'none' : 'auto';
    }
    W.classList.toggle('is-playing', playing);
    W.classList.toggle('is-paused', !playing);
  }

  function syncVolume() {
    const v = videoEl.muted ? 0 : videoEl.volume;
    volBtn.innerHTML = v === 0 ? PlayerIcons.volMute : v < 0.5 ? PlayerIcons.volLow : PlayerIcons.volHigh;
    if (volSlider) {
      volSlider.value = Math.round(v * 100);
      volSlider.style.setProperty('--fill', `${v * 100}%`);
    }
    // Save to localStorage
    localStorage.setItem('player-volume', videoEl.volume);
    localStorage.setItem('player-muted', videoEl.muted);
  }

  // Save progress periodically to localStorage
  let lastSaveTime = 0;
  function saveProgress() {
    const cur = videoEl.currentTime;
    const dur = videoEl.duration;
    if (episodeUrl && dur && cur > 5 && cur < dur - 15) {
      if (Math.abs(cur - lastSaveTime) > 3) {
        localStorage.setItem(`resume_${episodeUrl}`, cur);
        lastSaveTime = cur;
      }
    } else if (episodeUrl && dur && cur >= dur - 15) {
      localStorage.removeItem(`resume_${episodeUrl}`);
    }
  }

  function syncProgress() {
    if (seeking || !videoEl.duration) return;
    const pct = (videoEl.currentTime / videoEl.duration) * 100;
    progressBar.style.width = `${pct}%`;
    thumb.style.left = `${pct}%`;
    timeEl.textContent = `${fmt(videoEl.currentTime)} / ${fmt(videoEl.duration)}`;
    saveProgress();
  }

  function syncBuffer() {
    if (!videoEl.duration || !videoEl.buffered.length) return;
    bufferBar.style.width = `${(videoEl.buffered.end(videoEl.buffered.length - 1) / videoEl.duration) * 100}%`;
  }

  // ── Play / Pause ────────────────
  const toggle = (e) => { if (e) e.stopPropagation(); videoEl.paused ? videoEl.play().catch(() => {}) : videoEl.pause(); };

  videoEl.addEventListener('play', syncPlay);
  videoEl.addEventListener('pause', syncPlay);
  videoEl.addEventListener('ended', syncPlay);
  videoEl.addEventListener('timeupdate', syncProgress);
  videoEl.addEventListener('progress', syncBuffer);

  playBtn.addEventListener('click', toggle);
  if (centerPlay) centerPlay.addEventListener('click', toggle);
  videoEl.addEventListener('click', toggle);

  // ── +5s and -5s Skip ────────────
  if (back5Btn) {
    back5Btn.addEventListener('click', (e) => {
      e.stopPropagation();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 5);
      syncProgress();
      showCtrls();
    });
  }
  if (forward5Btn) {
    forward5Btn.addEventListener('click', (e) => {
      e.stopPropagation();
      videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 5);
      syncProgress();
      showCtrls();
    });
  }

  // ── Seek ────────────────────────
  function seekAt(e) {
    const r = progressWrap.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    progressBar.style.width = `${p * 100}%`;
    thumb.style.left = `${p * 100}%`;
    return p * videoEl.duration;
  }

  progressWrap.addEventListener('pointerdown', (e) => {
    seeking = true;
    videoEl.currentTime = seekAt(e);
    progressWrap.setPointerCapture(e.pointerId);

    const onMove = (ev) => { videoEl.currentTime = seekAt(ev); };
    const onUp = () => { seeking = false; progressWrap.removeEventListener('pointermove', onMove); progressWrap.removeEventListener('pointerup', onUp); };
    progressWrap.addEventListener('pointermove', onMove);
    progressWrap.addEventListener('pointerup', onUp);
  });

  // ── Volume ──────────────────────
  volBtn.addEventListener('click', () => { videoEl.muted = !videoEl.muted; syncVolume(); });
  if (volSlider) volSlider.addEventListener('input', () => { videoEl.volume = volSlider.value / 100; videoEl.muted = videoEl.volume === 0; syncVolume(); });

  // ── Quality ─────────────────────
  function buildQMenu() {
    qPopup.innerHTML = Object.keys(qualities).map(k =>
      `<button class="quality-option${k === curQ ? ' active' : ''}" data-q="${k}"><span>${k}</span>${k === curQ ? '<span class="quality-check">✓</span>' : ''}</button>`
    ).join('');
    qLabel.textContent = curQ;
  }
  buildQMenu();

  qBtn.addEventListener('click', (e) => { e.stopPropagation(); qPopup.classList.toggle('show'); });

  qPopup.addEventListener('click', (e) => {
    const opt = e.target.closest('.quality-option');
    if (!opt) return;
    const q = opt.dataset.q;
    if (q === curQ) { qPopup.classList.remove('show'); return; }
    curQ = q;
    buildQMenu();
    qPopup.classList.remove('show');
    const d = qualities[q];
    if (d) { _showLoading(); switchQuality(videoEl, d.url, d.referer); }
  });

  const closePopup = () => qPopup.classList.remove('show');
  document.addEventListener('click', closePopup);

  // ── Fullscreen ──────────────────
  const toggleFullscreen = () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || W.classList.contains('is-pseudo-fullscreen'));
    if (isFs) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else {
        W.classList.remove('is-pseudo-fullscreen');
        onFs();
      }
    } else {
      if (W.requestFullscreen) {
        W.requestFullscreen().catch(() => {});
      } else if (W.webkitRequestFullscreen) {
        W.webkitRequestFullscreen().catch(() => {});
      } else if (videoEl.webkitEnterFullscreen) {
        // iOS Safari Fullscreen (iPhone)
        videoEl.webkitEnterFullscreen();
      } else if (videoEl.webkitEnterFullScreen) {
        videoEl.webkitEnterFullScreen();
      } else {
        // Fallback: pseudo fullscreen
        W.classList.add('is-pseudo-fullscreen');
        onFs();
      }
    }
  };

  fsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFullscreen();
  });
  videoEl.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleFullscreen();
  });

  const onFs = () => {
    const fs = !!(document.fullscreenElement || document.webkitFullscreenElement || W.classList.contains('is-pseudo-fullscreen'));
    fsBtn.innerHTML = fs ? PlayerIcons.exitFs : PlayerIcons.fullscreen;
    W.classList.toggle('is-fullscreen', fs);
  };

  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  const onWebkitBeginFs = () => {
    W.classList.add('is-fullscreen');
    fsBtn.innerHTML = PlayerIcons.exitFs;
  };
  const onWebkitEndFs = () => {
    W.classList.remove('is-fullscreen');
    fsBtn.innerHTML = PlayerIcons.fullscreen;
  };
  videoEl.addEventListener('webkitbeginfullscreen', onWebkitBeginFs);
  videoEl.addEventListener('webkitendfullscreen', onWebkitEndFs);

  // ── Auto-hide ───────────────────
  function showCtrls() {
    W.classList.add('controls-visible');
    W.style.cursor = '';
    clearTimeout(_controlsTimer);
    _controlsTimer = setTimeout(() => {
      if (!videoEl.paused) { W.classList.remove('controls-visible'); W.style.cursor = 'none'; }
    }, 3000);
  }
  W.addEventListener('mousemove', showCtrls);
  W.addEventListener('mouseenter', showCtrls);
  W.addEventListener('mouseleave', () => { if (!videoEl.paused) W.classList.remove('controls-visible'); });

  // ── Keyboard ────────────────────
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); toggle(); break;
      case 'ArrowRight': e.preventDefault(); videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 10); showCtrls(); break;
      case 'ArrowLeft':  e.preventDefault(); videoEl.currentTime = Math.max(0, videoEl.currentTime - 10); showCtrls(); break;
      case 'ArrowUp':    e.preventDefault(); videoEl.volume = Math.min(1, videoEl.volume + 0.1); syncVolume(); showCtrls(); break;
      case 'ArrowDown':  e.preventDefault(); videoEl.volume = Math.max(0, videoEl.volume - 0.1); syncVolume(); showCtrls(); break;
      case 'f': toggleFullscreen(); break;
      case 'm': videoEl.muted = !videoEl.muted; syncVolume(); break;
    }
  };
  document.addEventListener('keydown', onKey);

  // Init state
  syncPlay();
  syncVolume();
  showCtrls();

  // Cleanup
  _cleanupFns.push(() => {
    videoEl.removeEventListener('play', syncPlay);
    videoEl.removeEventListener('pause', syncPlay);
    videoEl.removeEventListener('ended', syncPlay);
    videoEl.removeEventListener('timeupdate', syncProgress);
    videoEl.removeEventListener('progress', syncBuffer);
    videoEl.removeEventListener('webkitbeginfullscreen', onWebkitBeginFs);
    videoEl.removeEventListener('webkitendfullscreen', onWebkitEndFs);
    document.removeEventListener('click', closePopup);
    document.removeEventListener('fullscreenchange', onFs);
    document.removeEventListener('webkitfullscreenchange', onFs);
    document.removeEventListener('keydown', onKey);
  });
}

// ── UI Helpers ───────────────────────────────────────────
function _showLoading() { const el = document.getElementById('player-loading'); if (el) el.style.display = 'flex'; }
function _hideLoading() { const el = document.getElementById('player-loading'); if (el) el.style.display = 'none'; }
function _showError(msg = 'Failed to load video stream.') {
  const w = document.querySelector('.player-wrapper');
  if (!w) return;
  w.querySelector('.player-error')?.remove();
  const d = document.createElement('div');
  d.className = 'state-message player-error';
  d.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.9);z-index:10;';
  d.innerHTML = `<div class="state-icon">📺</div><h2 class="state-title">Playback Error</h2><p class="state-desc">${msg}</p>`;
  w.appendChild(d);
}
