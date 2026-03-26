const CORS_PROXY = "https://corsproxy.io/?";
const API_BASE = "https://sub.wyzie.io";
const API_KEY = "wyzie-95c9dc37198439da966d15c41fb864c0";

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchWrapper = document.getElementById("searchWrapper");
const resultsContainer = document.getElementById("resultsContainer");
const resultsArea = document.getElementById("resultsArea");
const resultsCount = document.getElementById("resultsCount");
const detailsContainer = document.getElementById("detailsContainer");
const detailsArea = document.getElementById("detailsArea");
const backBtn = document.getElementById("backToResultsBtn");

let currentSearchResults = [];
let cache = new Map();

async function fetchJSON(url) {
    const cacheKey = url;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }
    
    const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
    const response = await fetch(proxiedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    cache.set(cacheKey, data);
    return data;
}

function showSearchView() {
    resultsContainer.style.display = "block";
    detailsContainer.style.display = "none";
    searchWrapper.classList.remove("hidden");
    detailsArea.innerHTML = "";
}

function showDetailsView() {
    resultsContainer.style.display = "none";
    detailsContainer.style.display = "block";
    searchWrapper.classList.add("hidden");
}

async function search(query) {
    if (!query.trim()) return;
    resultsArea.innerHTML = `<div class="loading">جاري البحث</div>`;
    try {
        const url = `${API_BASE}/api/tmdb/search?q=${encodeURIComponent(query)}&key=${API_KEY}`;
        const data = await fetchJSON(url);
        const results = data.results || [];
        currentSearchResults = results;
        displaySearchResults(results);
    } catch (err) {
        resultsArea.innerHTML = `<div class="error">فشل البحث: ${err.message}</div>`;
        resultsCount.textContent = '';
    }
}

function displaySearchResults(results) {
    if (!results.length) {
        resultsArea.innerHTML = `<div class="error">لا توجد نتائج مطابقة</div>`;
        resultsCount.textContent = '';
        return;
    }
    
    resultsCount.textContent = `${results.length} نتيجة`;
    
    resultsArea.innerHTML = results.map(item => `
        <div class="result-card" data-id="${item.id}" data-type="${item.mediaType}">
            ${item.poster ? `<img class="result-poster" src="${item.poster}" alt="${item.title}" loading="lazy">` : '<div class="result-poster" style="background: linear-gradient(135deg, #2a2a3a, #1a1a2a);"></div>'}
            <div class="result-info">
                <div class="result-title">${escapeHtml(item.title)}</div>
                <div class="result-type">${item.mediaType === 'tv' ? 'مسلسل' : 'فيلم'}</div>
                <div class="result-overview">${escapeHtml(item.overview ? item.overview.substring(0, 80) + (item.overview.length > 80 ? '...' : '') : 'لا يوجد ملخص')}</div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.result-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const type = card.dataset.type;
            loadDetails(id, type);
        });
    });
}

async function loadDetails(id, mediaType) {
    showDetailsView();
    detailsArea.innerHTML = `<div class="loading">جاري التحميل</div>`;
    try {
        if (mediaType === 'movie') {
            await showMovieSubtitles(id);
        } else if (mediaType === 'tv') {
            await showTvSeasons(id);
        }
    } catch (err) {
        detailsArea.innerHTML = `<div class="error">فشل التحميل: ${err.message}</div>`;
    }
}

async function showMovieSubtitles(id) {
    const url = `${API_BASE}/search?id=${id}&language=ar&key=${API_KEY}`;
    const subs = await fetchJSON(url);
    
    if (!subs.length) {
        detailsArea.innerHTML = `<div class="error">لا توجد ترجمات متاحة</div>`;
        return;
    }
    
    detailsArea.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #bb86fc; font-size: 1.1rem;">الترجمات المتاحة</h3>
        <div class="episode-list">
            ${subs.map(sub => `
                <div class="episode-item">
                    <strong>صيغة: ${sub.format || 'SRT'}</strong>
                    <div class="subtitle-item">
                        <span>${sub.format || 'subtitle'}</span>
                        <a class="download-link" href="${sub.url}" target="_blank" download>تحميل</a>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function showTvSeasons(id) {
    const url = `${API_BASE}/api/tmdb/tv/${id}?key=${API_KEY}`;
    const data = await fetchJSON(url);
    const seasons = data.seasons || [];
    
    if (!seasons.length) {
        detailsArea.innerHTML = `<div class="error">لا توجد مواسم متاحة</div>`;
        return;
    }
    
    detailsArea.innerHTML = `
        <h3 style="margin-bottom: 0.75rem; color: #bb86fc; font-size: 1.1rem;">اختر الموسم</h3>
        <div class="season-list">
            ${seasons.map(season => `
                <button class="season-btn" data-season="${season.season_number}">${escapeHtml(season.name) || `الموسم ${season.season_number}`}</button>
            `).join('')}
        </div>
        <div id="episodesContainer"></div>
    `;
    
    document.querySelectorAll('.season-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const seasonNum = btn.dataset.season;
            await showEpisodesForSeason(id, seasonNum);
        });
    });
}

async function showEpisodesForSeason(tvId, seasonNum) {
    const container = document.getElementById('episodesContainer');
    const cacheKey = `season_${tvId}_${seasonNum}`;
    
    if (cache.has(cacheKey)) {
        container.innerHTML = cache.get(cacheKey);
        return;
    }
    
    container.innerHTML = `<div class="loading">جاري تحميل الحلقات</div>`;
    
    try {
        const tvUrl = `${API_BASE}/api/tmdb/tv/${tvId}?key=${API_KEY}`;
        const tvData = await fetchJSON(tvUrl);
        const seasons = tvData.seasons || [];
        const seasonData = seasons.find(s => s.season_number == seasonNum);
        const episodeCount = seasonData ? seasonData.episode_count : 0;
        
        if (!episodeCount) {
            container.innerHTML = `<div class="error">لا توجد حلقات</div>`;
            return;
        }
        
        let episodesHtml = `<h4 style="margin: 1rem 0 0.75rem; color: #bb86fc; font-size: 0.95rem;">الموسم ${seasonNum}</h4><div class="episode-list">`;
        
        for (let ep = 1; ep <= episodeCount; ep++) {
            const subsUrl = `${API_BASE}/search?id=${tvId}&season=${seasonNum}&episode=${ep}&language=ar&key=${API_KEY}`;
            const subs = await fetchJSON(subsUrl);
            const subsHtml = subs.map(sub => `
                <div class="subtitle-item">
                    <span>صيغة: ${sub.format || 'SRT'}</span>
                    <a class="download-link" href="${sub.url}" target="_blank" download>تحميل</a>
                </div>
            `).join('');
            
            episodesHtml += `
                <div class="episode-item">
                    <strong>الحلقة ${ep}</strong>
                    ${subsHtml || '<span style="color:#8b8b9b; font-size:0.8rem;">لا توجد ترجمات</span>'}
                </div>
            `;
        }
        episodesHtml += `</div>`;
        
        container.innerHTML = episodesHtml;
        cache.set(cacheKey, episodesHtml);
        
    } catch (err) {
        container.innerHTML = `<div class="error">خطأ: ${err.message}</div>`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

searchBtn.addEventListener('click', () => search(searchInput.value));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') search(searchInput.value);
});

backBtn.addEventListener('click', () => {
    showSearchView();
    if (currentSearchResults.length) {
        displaySearchResults(currentSearchResults);
    } else {
        resultsArea.innerHTML = "";
        resultsCount.textContent = '';
    }
});

showSearchView();