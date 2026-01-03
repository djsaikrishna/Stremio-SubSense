/**
 * SubSense Content Browser Logic
 */

let currentPage = 1;
const PAGE_SIZE = 20;

function refreshTruncatedCells(container = document) {
    const cells = container.querySelectorAll('.data-table td');
    cells.forEach(cell => {
        if (cell.querySelector('button, code')) return;
        
        cell.classList.remove('truncated', 'expanded');
        cell.removeAttribute('data-fulltext');
        
        if (cell.scrollWidth > cell.clientWidth) {
            const fullText = cell.textContent.trim();
            cell.classList.add('truncated');
            cell.setAttribute('data-fulltext', fullText);
            cell.setAttribute('title', fullText);
            
            if (!cell.hasAttribute('data-click-handler')) {
                cell.setAttribute('data-click-handler', 'true');
                cell.addEventListener('click', function(e) {
                    e.stopPropagation();
                    this.classList.toggle('expanded');
                });
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchVersion();
    loadRecentContent();
    setupSearchHandlers();
});

async function fetchVersion() {
    try {
        const response = await fetch('/api/version');
        const data = await response.json();
        const version = `v${data.version}`;
        
        const versionBadge = document.getElementById('versionBadge');
        const footerVersion = document.getElementById('footerVersion');
        
        if (versionBadge) versionBadge.textContent = version;
        if (footerVersion) footerVersion.textContent = version;
    } catch (error) {
        console.error('Failed to fetch version:', error);
    }
}

function setupSearchHandlers() {
    const searchInput = document.getElementById('imdbSearch');
    const searchBtn = document.getElementById('searchBtn');
    const hint = document.getElementById('searchHint');
    
    searchBtn.addEventListener('click', () => {
        performSearch(searchInput.value.trim());
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value.trim());
        }
    });
    
    searchInput.addEventListener('input', () => {
        const value = searchInput.value.trim().toLowerCase();
        const isValid = /^tt\d{7,8}$/.test(value);
        
        if (value.length === 0) {
            hint.textContent = "Enter a valid IMDB ID starting with 'tt' followed by 7-8 digits";
            hint.style.color = 'var(--color-text-muted)';
            searchBtn.disabled = false;
        } else if (isValid) {
            hint.textContent = '✓ Valid IMDB ID format';
            hint.style.color = '#2ecc71';
            searchBtn.disabled = false;
        } else if (value.startsWith('tt') && value.length < 9) {
            hint.textContent = `✓ Keep typing... (need ${9 - value.length} more digits)`;
            hint.style.color = 'var(--color-accent-blue)';
            searchBtn.disabled = true;
        } else {
            hint.textContent = '✗ Invalid format. Expected: tt followed by 7-8 digits';
            hint.style.color = '#e74c3c';
            searchBtn.disabled = true;
        }
    });
    
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadRecentContent();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        currentPage++;
        loadRecentContent();
    });
}

async function performSearch(imdbId) {
    const resultCard = document.getElementById('resultCard');
    const notFoundCard = document.getElementById('notFoundCard');
    
    resultCard.style.display = 'none';
    notFoundCard.style.display = 'none';
    
    if (!imdbId) {
        return;
    }
    
    imdbId = imdbId.toLowerCase();
    
    try {
        const response = await fetch(`/api/cache/search?imdb=${encodeURIComponent(imdbId)}`);
        
        if (response.status === 404) {
            showNotFound(imdbId);
            return;
        }
        
        if (!response.ok) {
            const error = await response.json();
            showNotFound(imdbId, error.error);
            return;
        }
        
        const data = await response.json();
        displaySearchResult(data);
        
    } catch (error) {
        console.error('Search error:', error);
        showNotFound(imdbId, 'Failed to search cache');
    }
}

function displaySearchResult(data) {
    const resultCard = document.getElementById('resultCard');
    const notFoundCard = document.getElementById('notFoundCard');
    
    notFoundCard.style.display = 'none';
    resultCard.style.display = 'block';
    
    document.getElementById('resultTitle').innerHTML = `
        <svg class="section-icon" viewBox="0 0 24 24">
            <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
        </svg>
        ${data.imdbId.toUpperCase()}
    `;
    
    document.getElementById('resultTotalSubs').textContent = data.totalSubtitles.toLocaleString();
    document.getElementById('resultLanguages').textContent = data.uniqueLanguages;
    document.getElementById('resultSources').textContent = data.sources.length;
    document.getElementById('resultAge').textContent = formatAge(data.lastUpdated);
    
    const sourcesList = document.getElementById('sourcesList');
    sourcesList.innerHTML = data.sources.map(source => 
        `<span class="language-tag">${source}</span>`
    ).join('');
    
    const breakdownBody = document.getElementById('breakdownTableBody');
    
    const langGroups = {};
    data.breakdown.forEach(item => {
        const lang = item.language;
        if (!langGroups[lang]) {
            langGroups[lang] = {
                count: 0,
                sources: new Set(),
                lastUpdated: 0
            };
        }
        langGroups[lang].count += item.subtitle_count;
        if (item.sources) {
            item.sources.split(',').forEach(s => langGroups[lang].sources.add(s));
        }
        langGroups[lang].lastUpdated = Math.max(langGroups[lang].lastUpdated, item.last_updated);
    });
    
    const sortedLangs = Object.entries(langGroups)
        .sort((a, b) => b[1].count - a[1].count);
    
    breakdownBody.innerHTML = sortedLangs.map(([lang, info]) => {
        const sources = [...info.sources].join(', ');
        return `
            <tr>
                <td><span class="language-tag">${lang.toUpperCase()}</span></td>
                <td>${info.count}</td>
                <td>${sources}</td>
                <td>${formatAge(info.lastUpdated)}</td>
            </tr>
        `;
    }).join('');
    
    const hasEpisodes = data.breakdown.some(item => item.season !== null || item.episode !== null);
    const seriesBreakdown = document.getElementById('seriesBreakdown');
    
    if (hasEpisodes) {
        seriesBreakdown.style.display = 'block';
        
        const episodeGroups = {};
        data.breakdown.forEach(item => {
            const key = `S${item.season || 0}E${item.episode || 0}`;
            if (!episodeGroups[key]) {
                episodeGroups[key] = {
                    season: item.season,
                    episode: item.episode,
                    languages: new Set(),
                    count: 0
                };
            }
            episodeGroups[key].languages.add(item.language);
            episodeGroups[key].count += item.subtitle_count;
        });
        
        const sortedEpisodes = Object.values(episodeGroups)
            .sort((a, b) => {
                if (a.season !== b.season) return (a.season || 0) - (b.season || 0);
                return (a.episode || 0) - (b.episode || 0);
            });
        
        const episodeBody = document.getElementById('episodeTableBody');
        episodeBody.innerHTML = sortedEpisodes.map(ep => `
            <tr>
                <td>${ep.season !== null ? ep.season : '-'}</td>
                <td>${ep.episode !== null ? ep.episode : '-'}</td>
                <td>${ep.languages.size} (${[...ep.languages].join(', ')})</td>
                <td>${ep.count}</td>
            </tr>
        `).join('');
    } else {
        seriesBreakdown.style.display = 'none';
    }
    
    setTimeout(() => refreshTruncatedCells(resultCard), 100);
    
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showNotFound(imdbId, message = null) {
    const resultCard = document.getElementById('resultCard');
    const notFoundCard = document.getElementById('notFoundCard');
    
    resultCard.style.display = 'none';
    notFoundCard.style.display = 'block';
    
    document.getElementById('notFoundMessage').textContent = 
        message || `No cached subtitles found for ${imdbId.toUpperCase()}`;
}

async function loadRecentContent() {
    const tbody = document.getElementById('recentTableBody');
    const pagination = document.getElementById('pagination');
    
    try {
        const response = await fetch(`/api/cache/list?page=${currentPage}&limit=${PAGE_SIZE}`);
        
        if (!response.ok) {
            throw new Error('Failed to load cache list');
        }
        
        const data = await response.json();
        
        if (data.items.length === 0 && currentPage === 1) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--color-text-secondary);">No cached content yet</td></tr>';
            pagination.style.display = 'none';
            return;
        }
        
        tbody.innerHTML = data.items.map(item => {
            const isSeries = item.season !== null;
            const typeBadge = isSeries 
                ? '<span class="badge badge-series">Series</span>' 
                : '<span class="badge badge-info">Movie</span>';
            
            let episodeCell = '';
            if (isSeries) {
                const season = String(item.season).padStart(2, '0');
                const episode = String(item.episode).padStart(2, '0');
                episodeCell = `<span class="episode-badge">S${season}E${episode}</span>`;
            }
            
            const sources = item.sources || '-';
            
            return `
                <tr>
                    <td><code>${item.imdb_id.toUpperCase()}</code></td>
                    <td>${episodeCell}</td>
                    <td>${typeBadge}</td>
                    <td>${item.languages_cached}</td>
                    <td>${item.total_subtitles}</td>
                    <td>${sources}</td>
                    <td>${formatAge(item.last_updated)}</td>
                    <td>
                        <button class="view-btn" onclick="performSearch('${item.imdb_id}')">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        setTimeout(() => refreshTruncatedCells(), 100);
        
        const totalPages = Math.ceil(data.total / PAGE_SIZE);
        
        if (totalPages > 1) {
            pagination.style.display = 'flex';
            document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
            document.getElementById('prevPage').disabled = currentPage <= 1;
            document.getElementById('nextPage').disabled = currentPage >= totalPages;
        } else {
            pagination.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Failed to load recent content:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #e74c3c;">Failed to load content</td></tr>';
    }
}

function formatAge(timestamp) {
    if (!timestamp) return '-';
    
    const now = Math.floor(Date.now() / 1000);
    const age = now - timestamp;
    
    if (age < 60) return 'Just now';
    if (age < 3600) return `${Math.floor(age / 60)}m ago`;
    if (age < 86400) return `${Math.floor(age / 3600)}h ago`;
    if (age < 604800) return `${Math.floor(age / 86400)}d ago`;
    
    return new Date(timestamp * 1000).toLocaleDateString();
}