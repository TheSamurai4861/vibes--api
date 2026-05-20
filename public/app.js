document.addEventListener('DOMContentLoaded', () => {
  // Navigation elements
  const navSearch = document.getElementById('nav-search');
  const navCache = document.getElementById('nav-cache');
  const searchView = document.getElementById('search-view');
  const cacheView = document.getElementById('cache-view');

  // Interactive search elements
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const resultsGrid = document.getElementById('results-grid');
  const welcomeState = document.getElementById('welcome-state');
  const loadingState = document.getElementById('loading-state');
  const latencyBadge = document.getElementById('latency-badge');
  const quickTags = document.querySelectorAll('.quick-tag');

  // Sorting elements
  const resultsControls = document.getElementById('results-controls');
  const resultsCount = document.getElementById('results-count');
  const sortSelect = document.getElementById('sort-select');
  const sortDirBtn = document.getElementById('sort-dir-btn');

  // Sorting state
  let currentTracks = [];
  let sortKey = 'default';
  let sortAscending = true;

  // Search types selection state
  let currentSearchType = 'track';
  const typePills = document.querySelectorAll('.type-pill');

  // Details sliding panel elements
  const detailsOverlay = document.getElementById('details-overlay');
  const closePanelBtn = document.getElementById('close-panel-btn');
  const panelScrollContent = document.getElementById('panel-content');
  const detailLatencyBadge = document.getElementById('detail-latency-badge');

  // Cache elements
  const clearCacheBtn = document.getElementById('clear-cache-btn');

  // Audio state
  let currentAudio = null;
  let currentPlayerBtn = null;
  let progressInterval = null;

  // --- SEARCH TYPE SELECTION & PILLS SETUP ---
  function setActiveType(type) {
    currentSearchType = type;
    typePills.forEach(pill => {
      if (pill.getAttribute('data-type') === type) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
    
    // Update sort options dynamically
    updateSortOptions(type);
    
    // Update input placeholder to match selected type
    if (type === 'track') {
      searchInput.placeholder = "Search for tracks...";
    } else if (type === 'album') {
      searchInput.placeholder = "Search for albums...";
    } else if (type === 'artist') {
      searchInput.placeholder = "Search for artists...";
    }
  }

  typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const type = pill.getAttribute('data-type');
      setActiveType(type);
      
      // Auto-trigger search if input is not empty
      if (searchInput.value.trim()) {
        performSearch();
      }
    });
  });

  function updateSortOptions(type) {
    // Clear existing options
    sortSelect.innerHTML = '';
    
    // Add default option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default';
    defaultOpt.textContent = 'Default (Deezer rank)';
    sortSelect.appendChild(defaultOpt);
    
    if (type === 'track') {
      const options = [
        { value: 'title', text: 'Title' },
        { value: 'artist', text: 'Artist' },
        { value: 'album', text: 'Album' },
        { value: 'duration', text: 'Duration' }
      ];
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.text;
        sortSelect.appendChild(o);
      });
    } else if (type === 'album') {
      const options = [
        { value: 'title', text: 'Title' },
        { value: 'artist', text: 'Artist' }
      ];
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.text;
        sortSelect.appendChild(o);
      });
    } else if (type === 'artist') {
      const options = [
        { value: 'name', text: 'Name' },
        { value: 'fans', text: 'Fans count' },
        { value: 'albums', text: 'Albums count' }
      ];
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.text;
        sortSelect.appendChild(o);
      });
    }
    
    // Reset sort key to default
    sortKey = 'default';
    sortSelect.value = 'default';
  }

  // --- VIEW SWITCHING ---
  navSearch.addEventListener('click', (e) => {
    e.preventDefault();
    navSearch.classList.add('active');
    navCache.classList.remove('active');
    searchView.classList.remove('hidden');
    cacheView.classList.add('hidden');
  });

  navCache.addEventListener('click', (e) => {
    e.preventDefault();
    navCache.classList.add('active');
    navSearch.classList.remove('active');
    cacheView.classList.remove('hidden');
    searchView.classList.add('hidden');
  });

  // --- QUICK TAGS SEARCH ---
  quickTags.forEach(tag => {
    tag.addEventListener('click', () => {
      searchInput.value = tag.textContent;
      performSearch();
    });
  });

  // --- SEARCH TRIGGERS ---
  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // --- SORT TRIGGERS ---
  sortSelect.addEventListener('change', (e) => {
    sortKey = e.target.value;
    sortAndDisplay();
  });

  sortDirBtn.addEventListener('click', () => {
    sortAscending = !sortAscending;
    const icon = sortDirBtn.querySelector('i');
    if (sortAscending) {
      icon.className = 'fa-solid fa-arrow-down-a-z';
    } else {
      icon.className = 'fa-solid fa-arrow-up-a-z';
    }
    sortAndDisplay();
  });

  // Close details overlay
  closePanelBtn.addEventListener('click', () => {
    stopPreview();
    detailsOverlay.classList.add('hidden');
  });

  // Close overlay on background click
  detailsOverlay.addEventListener('click', (e) => {
    if (e.target === detailsOverlay) {
      stopPreview();
      detailsOverlay.classList.add('hidden');
    }
  });

  // Clear Cache Action
  clearCacheBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to completely clear the hybrid caches?')) {
      try {
        clearCacheBtn.disabled = true;
        clearCacheBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clearing...';
        
        const response = await fetch('/api/cache/clear', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
          alert('Hybrid cache cleared successfully!');
        } else {
          alert('Failed to clear cache: ' + data.error);
        }
      } catch (err) {
        console.error(err);
        alert('Network error clearing cache.');
      } finally {
        clearCacheBtn.disabled = false;
        clearCacheBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Clear All Cached Data';
      }
    }
  });

  // --- PERFORM SEARCH ---
  async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // Adjust states
    welcomeState.classList.add('hidden');
    resultsGrid.classList.add('hidden');
    resultsControls.classList.add('hidden');
    loadingState.classList.remove('hidden');
    latencyBadge.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Latency: -- ms`;

    const startSearch = Date.now();
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${currentSearchType}`);
      const data = await response.json();
      
      const searchLatency = Date.now() - startSearch;
      latencyBadge.innerHTML = `<i class="fa-solid fa-gauge-high"></i> Latency: ${searchLatency} ms (${data.responseTimeMs} ms API)`;

      if (data.error) {
        resultsGrid.innerHTML = `<div class="welcome-card" style="grid-column: 1/-1;"><h2>Search Error</h2><p>${data.error}</p></div>`;
        resultsGrid.classList.remove('hidden');
        return;
      }

      let items = [];
      if (currentSearchType === 'track') {
        items = data.tracks || [];
      } else if (currentSearchType === 'album') {
        items = data.albums || [];
      } else if (currentSearchType === 'artist') {
        items = data.artists || [];
      }

      displayResults(items);
    } catch (err) {
      console.error(err);
      resultsGrid.innerHTML = `<div class="welcome-card" style="grid-column: 1/-1;"><h2>Search Failed</h2><p>Could not connect to server.</p></div>`;
      resultsGrid.classList.remove('hidden');
    } finally {
      loadingState.classList.add('hidden');
    }
  }

  // --- DISPLAY RESULTS ---
  function displayResults(items) {
    currentTracks = items;
    
    if (items.length === 0) {
      resultsGrid.innerHTML = `<div class="welcome-card" style="grid-column: 1/-1;"><h2>No results found</h2><p>Try searching for a different term.</p></div>`;
      resultsGrid.classList.remove('hidden');
      resultsControls.classList.add('hidden');
      return;
    }

    // Update result count text
    let typeName = currentSearchType;
    if (items.length > 1) {
      if (currentSearchType === 'track') typeName = 'tracks';
      else if (currentSearchType === 'album') typeName = 'albums';
      else if (currentSearchType === 'artist') typeName = 'artists';
    }
    resultsCount.textContent = `Found ${items.length} ${typeName}`;
    resultsControls.classList.remove('hidden');

    // Run sort & render
    sortAndDisplay();
  }

  // --- SORT AND DISPLAY ---
  function sortAndDisplay() {
    if (currentTracks.length === 0) return;

    let sorted = [...currentTracks];

    if (sortKey !== 'default') {
      sorted.sort((a, b) => {
        let valA = '';
        let valB = '';

        if (sortKey === 'title') {
          valA = a.title ? a.title.toLowerCase() : '';
          valB = b.title ? b.title.toLowerCase() : '';
        } else if (sortKey === 'name') {
          valA = a.name ? a.name.toLowerCase() : '';
          valB = b.name ? b.name.toLowerCase() : '';
        } else if (sortKey === 'artist') {
          valA = a.artist?.name ? a.artist.name.toLowerCase() : '';
          valB = b.artist?.name ? b.artist.name.toLowerCase() : '';
        } else if (sortKey === 'album') {
          valA = a.album?.title ? a.album.title.toLowerCase() : '';
          valB = b.album?.title ? b.album.title.toLowerCase() : '';
        } else if (sortKey === 'duration') {
          valA = a.duration || 0;
          valB = b.duration || 0;
        } else if (sortKey === 'fans') {
          valA = a.nb_fan || 0;
          valB = b.nb_fan || 0;
        } else if (sortKey === 'albums') {
          valA = a.nb_album || 0;
          valB = b.nb_album || 0;
        }

        if (valA < valB) return sortAscending ? -1 : 1;
        if (valA > valB) return sortAscending ? 1 : -1;
        return 0;
      });
    }

    renderTracksGrid(sorted);
  }

  // --- RENDER TRACKS GRID (Generic Results Renderer) ---
  function renderTracksGrid(items) {
    resultsGrid.innerHTML = '';
    
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      
      if (currentSearchType === 'track') {
        card.innerHTML = `
          <div class="card-img-container">
            <img class="card-img" src="${item.album.cover || 'https://via.placeholder.com/250'}" alt="${item.album.title}">
            <div class="play-hover-btn" title="View aggregated details">
              <i class="fa-solid fa-circle-info"></i>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title" title="${item.title}">${item.title}</h3>
            <p class="card-artist" title="${item.artist.name}">${item.artist.name}</p>
            <div class="card-footer">
              <span title="${item.album.title}"><i class="fa-solid fa-compact-disc"></i> ${item.album.title}</span>
              <span><i class="fa-solid fa-clock"></i> ${formatDuration(item.duration)}</span>
            </div>
          </div>
        `;
        card.addEventListener('click', () => {
          openTrackDetails(item.id);
        });
      } else if (currentSearchType === 'album') {
        card.innerHTML = `
          <div class="card-img-container">
            <img class="card-img" src="${item.cover || 'https://via.placeholder.com/250'}" alt="${item.title}">
            <div class="play-hover-btn" title="Search tracks in this album">
              <i class="fa-solid fa-magnifying-glass"></i>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title" title="${item.title}">${item.title}</h3>
            <p class="card-artist" title="${item.artist.name}">${item.artist.name}</p>
            <div class="card-footer" style="justify-content: flex-end;">
              <span style="font-size:0.75rem; color:var(--accent-color); font-weight:600;"><i class="fa-solid fa-music"></i> Click to view tracks</span>
            </div>
          </div>
        `;
        card.addEventListener('click', () => {
          searchInput.value = `album:"${item.title}" artist:"${item.artist.name}"`;
          setActiveType('track');
          performSearch();
        });
      } else if (currentSearchType === 'artist') {
        card.innerHTML = `
          <div class="card-img-container" style="display: flex; justify-content: center; align-items: center; padding: 1.5rem; background: rgba(255,255,255,0.01);">
            <img class="card-img" src="${item.picture || 'https://via.placeholder.com/250'}" alt="${item.name}" style="border-radius: 50%; aspect-ratio: 1; max-width: 80%; max-height: 80%; box-shadow: var(--shadow-premium);">
            <div class="play-hover-btn" title="Search tracks by this artist">
              <i class="fa-solid fa-magnifying-glass"></i>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title" style="text-align: center;" title="${item.name}">${item.name}</h3>
            <div class="card-footer" style="padding-top: 0.75rem; display: flex; justify-content: space-around;">
              <span><i class="fa-solid fa-record-vinyl"></i> ${item.nb_album || 0} Albums</span>
              <span><i class="fa-solid fa-users"></i> ${formatFansCount(item.nb_fan)} Fans</span>
            </div>
          </div>
        `;
        card.addEventListener('click', () => {
          searchInput.value = item.name;
          setActiveType('track');
          performSearch();
        });
      }

      resultsGrid.appendChild(card);
    });

    resultsGrid.classList.remove('hidden');
  }

  // --- OPEN DETAILED VIEW ---
  async function openTrackDetails(trackId) {
    detailsOverlay.classList.remove('hidden');
    panelScrollContent.innerHTML = `
      <div class="loading-container" style="height: 80%;">
        <div class="spinner"></div>
        <p>Aggregating MusicBrainz details, Wikipedia summaries, and scraping song lyrics...</p>
      </div>
    `;
    detailLatencyBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> Calculating latency...`;

    const startAgg = Date.now();
    try {
      const response = await fetch(`/api/details?trackId=${trackId}`);
      const data = await response.json();
      
      const aggLatency = Date.now() - startAgg;
      detailLatencyBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> Latency: ${aggLatency} ms (${data.responseTimeMs} ms API)`;

      if (data.error) {
        panelScrollContent.innerHTML = `
          <div class="welcome-card" style="max-width: 100%;">
            <h2>Failed to load details</h2>
            <p>${data.error}</p>
          </div>
        `;
        return;
      }

      renderDetailedContent(data.details);
    } catch (err) {
      console.error(err);
      panelScrollContent.innerHTML = `
        <div class="welcome-card" style="max-width: 100%;">
          <h2>Error fetching details</h2>
          <p>Could not connect to server.</p>
        </div>
      `;
    }
  }

  // --- RENDER DYNAMIC DETAIL PANEL ---
  function renderDetailedContent(details) {
    const mbBlock = details.musicbrainz;
    const wikiBlock = details.wikipedia;
    
    let genresHtml = '';
    if (mbBlock && mbBlock.genres && mbBlock.genres.length > 0) {
      genresHtml = mbBlock.genres.map(g => `<span class="quick-tag" style="cursor:default; margin-bottom:0.5rem;">${g}</span>`).join(' ');
    } else {
      genresHtml = '<span class="text-muted" style="font-size:0.9rem;">No tags available</span>';
    }

    panelScrollContent.innerHTML = `
      <!-- Hero / Top Section -->
      <div class="hero-block">
        <img class="details-art" src="${details.album.cover || 'https://via.placeholder.com/180'}" alt="${details.album.title}">
        <div class="hero-meta">
          <span class="hero-artist-name">${details.artist.name}</span>
          <h1>${details.title}</h1>
          <span class="hero-album-name">Album: ${details.album.title}</span>
        </div>
      </div>

      <!-- Playable Preview Audio Card -->
      ${details.previewUrl ? `
        <div class="audio-player-card">
          <button class="player-btn" id="play-btn">
            <i class="fa-solid fa-play"></i>
          </button>
          <div class="player-info">
            <span>Preview Audio</span>
            <div class="player-progress">
              <div class="player-progress-bar" id="progress-bar"></div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Performance & Reconciliation Stats -->
      <div class="metadata-grid">
        <div class="meta-item">
          <h4>Release Date</h4>
          <p>${details.releaseDate || 'Unknown'}</p>
        </div>
        <div class="meta-item">
          <h4>BPM / Energy Gain</h4>
          <p>${details.bpm ? details.bpm + ' BPM' : 'N/A'} / ${details.gain ? details.gain + ' dB' : 'N/A'}</p>
        </div>
        <div class="meta-item">
          <h4>MusicBrainz MBID</h4>
          <p style="font-size: 0.8rem; word-break: break-all; font-family: monospace;">${mbBlock ? mbBlock.mbid : 'No MBID resolved'}</p>
        </div>
        <div class="meta-item">
          <h4>Country of Release</h4>
          <p>${mbBlock && mbBlock.country ? mbBlock.country : 'Global'}</p>
        </div>
      </div>

      <!-- Genres Section -->
      <div class="info-section">
        <h3 class="section-title"><i class="fa-solid fa-tags"></i> MusicBrainz Genres</h3>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
          ${genresHtml}
        </div>
      </div>

      <!-- Wikipedia Summary Section -->
      ${wikiBlock ? `
        <div class="info-section">
          <h3 class="section-title"><i class="fa-brands fa-wikipedia-w"></i> Wikipedia Artist Spotlight</h3>
          <div class="wiki-content">
            ${wikiBlock.thumbnail ? `<img class="wiki-thumb" src="${wikiBlock.thumbnail}" alt="${wikiBlock.title}">` : ''}
            <div class="wiki-text">
              <p>${wikiBlock.extract}</p>
              <a href="${wikiBlock.link}" target="_blank" class="wiki-link">Read full Wikipedia article <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
            </div>
          </div>
        </div>
      ` : `
        <div class="info-section">
          <h3 class="section-title"><i class="fa-brands fa-wikipedia-w"></i> Wikipedia Artist Spotlight</h3>
          <p class="text-muted">No Wikipedia biography found for artist "${details.artist.name}".</p>
        </div>
      `}

      <!-- Resilient Lyrics Section -->
      <div class="info-section">
        <h3 class="section-title"><i class="fa-solid fa-music"></i> Song Lyrics</h3>
        <div class="lyrics-text">${details.lyrics || 'Lyrics not found.'}</div>
      </div>
    `;

    // Hook up Audio Player
    if (details.previewUrl) {
      const playBtn = document.getElementById('play-btn');
      const progressBar = document.getElementById('progress-bar');
      
      playBtn.addEventListener('click', () => {
        togglePreview(details.previewUrl, playBtn, progressBar);
      });
    }
  }

  // --- AUDIO PREVIEW MANAGEMENT ---
  function togglePreview(url, btn, progress) {
    if (currentAudio && currentAudio.src === url) {
      if (currentAudio.paused) {
        currentAudio.play();
        btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        startProgressBar(progress);
      } else {
        currentAudio.pause();
        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        clearInterval(progressInterval);
      }
    } else {
      stopPreview();
      
      currentAudio = new Audio(url);
      currentPlayerBtn = btn;
      
      currentAudio.play();
      btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      startProgressBar(progress);
      
      currentAudio.addEventListener('ended', () => {
        stopPreview();
      });
    }
  }

  function startProgressBar(progressBar) {
    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (currentAudio && !currentAudio.paused) {
        const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
        progressBar.style.width = `${pct}%`;
      }
    }, 100);
  }

  function stopPreview() {
    clearInterval(progressInterval);
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (currentPlayerBtn) {
      currentPlayerBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      currentPlayerBtn = null;
    }
  }

  // --- HELPER FUNCTIONS ---
  function formatDuration(sec) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatFansCount(num) {
    if (!num) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
  }
});
