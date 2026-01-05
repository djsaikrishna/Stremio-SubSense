/**
 * SubSense Content Browser Logic
 */

let currentPage = 1;
const PAGE_SIZE = 20;

const MAX_TEST_LANGUAGES = 5;
let testSelectedLanguages = [];
let testLanguages = [];
let testLanguageLookup = {};
let testHighlightIndex = -1;

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

document.addEventListener('DOMContentLoaded', async () => {
    await loadLanguageLookup();
    
    fetchVersion();
    loadRecentContent();
    setupSearchHandlers();
    await initTestSearch();
});

async function loadLanguageLookup() {
    try {
        const response = await fetch('/api/languages?format=lookup');
        if (response.ok) {
            testLanguageLookup = await response.json();
            console.log(`[Content] Loaded ${Object.keys(testLanguageLookup).length} language lookup entries`);
        }
    } catch (error) {
        console.warn('Failed to load language lookup:', error);
    }
}

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
        const langName = getLanguageDisplayName(lang);
        return `
            <tr>
                <td><span class="language-tag">${langName}</span></td>
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

async function initTestSearch() {
    try {
        const response = await fetch('/api/languages?format=full');
        if (response.ok) {
            const languages = await response.json();
            testLanguages = languages.map(lang => ({
                code: lang.alpha2,
                name: lang.name
            }));
            console.log(`[TestSearch] Loaded ${testLanguages.length} languages for selector`);
        }
    } catch (error) {
        console.warn('Failed to fetch languages:', error);
        testLanguages = [
            { code: 'eng', name: 'English' },
            { code: 'fre', name: 'French' },
            { code: 'spa', name: 'Spanish' }
        ];
    }
    
    setupTestSearchHandlers();
    renderTestOptions();
}

function setupTestSearchHandlers() {
    const container = document.getElementById('testMultiselectContainer');
    const input = document.getElementById('testLanguageInput');
    const imdbInput = document.getElementById('testImdbInput');
    const seasonInput = document.getElementById('testSeasonInput');
    const episodeInput = document.getElementById('testEpisodeInput');
    const searchBtn = document.getElementById('testSearchBtn');
    const hint = document.getElementById('testSearchHint');
    
    input.addEventListener('focus', () => {
        container.classList.add('active');
        renderTestOptions(input.value);
    });
    
    input.addEventListener('input', () => {
        renderTestOptions(input.value);
    });
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value === '' && testSelectedLanguages.length > 0) {
            removeTestLanguage(testSelectedLanguages[testSelectedLanguages.length - 1]);
        }
        if (e.key === 'Escape') {
            container.classList.remove('active');
            input.blur();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            container.classList.remove('active');
        }
    });
    
    imdbInput.addEventListener('input', () => {
        validateTestForm();
    });
    
    seasonInput.addEventListener('input', validateTestForm);
    episodeInput.addEventListener('input', validateTestForm);
    
    [seasonInput, episodeInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
        
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            const numericOnly = text.replace(/[^0-9]/g, '');
            input.value = numericOnly.slice(0, 5);
            validateTestForm();
        });
        
        input.addEventListener('blur', () => {
            const val = parseInt(input.value, 10);
            const min = parseInt(input.min, 10) || 1;
            const max = parseInt(input.max, 10) || 99;
            if (!isNaN(val)) {
                if (val < min) input.value = min;
                if (val > max) input.value = max;
            }
        });
    });
    
    searchBtn.addEventListener('click', performTestSearch);
    
    imdbInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !searchBtn.disabled) {
            performTestSearch();
        }
    });
    
    document.querySelectorAll('.number-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            const currentVal = parseInt(input.value, 10) || 0;
            const min = parseInt(input.min, 10) || 1;
            const max = parseInt(input.max, 10) || 999;
            
            if (btn.classList.contains('number-up')) {
                input.value = Math.min(currentVal + 1, max);
            } else {
                input.value = Math.max(currentVal - 1, min);
                if (currentVal <= min) input.value = '';
            }
            
            validateTestForm();
        });
    });
}

function validateTestForm() {
    const imdbInput = document.getElementById('testImdbInput');
    const searchBtn = document.getElementById('testSearchBtn');
    const hint = document.getElementById('testSearchHint');
    
    const imdbValue = imdbInput.value.trim().toLowerCase();
    const isValidImdb = /^tt\d{7,8}$/.test(imdbValue);
    const hasLanguages = testSelectedLanguages.length > 0;
    
    if (imdbValue.length === 0) {
        hint.textContent = 'Enter a valid IMDB ID and select at least one language';
        hint.style.color = 'var(--color-text-muted)';
    } else if (!isValidImdb && imdbValue.startsWith('tt') && imdbValue.length < 9) {
        hint.textContent = `Keep typing... (need ${9 - imdbValue.length} more digits)`;
        hint.style.color = 'var(--color-accent-blue)';
    } else if (!isValidImdb) {
        hint.textContent = '✗ Invalid IMDB format. Expected: tt followed by 7-8 digits';
        hint.style.color = '#e74c3c';
    } else if (!hasLanguages) {
        hint.textContent = '✓ Valid IMDB ID. Now select at least one language.';
        hint.style.color = 'var(--color-warning)';
    } else {
        hint.textContent = '✓ Ready to search!';
        hint.style.color = '#2ecc71';
    }
    
    searchBtn.disabled = !(isValidImdb && hasLanguages);
}

function renderTestOptions(filterText = '') {
    const optionsList = document.getElementById('testOptionsList');
    const lowerFilter = (filterText || '').toLowerCase();
    
    const filtered = testLanguages.filter(lang => 
        lang.name.toLowerCase().includes(lowerFilter) ||
        lang.code.toLowerCase().includes(lowerFilter)
    );
    
    if (filtered.length === 0) {
        optionsList.innerHTML = '<div class="option-item disabled" style="cursor: default; color: var(--color-text-secondary);">No languages found</div>';
        return;
    }
    
    optionsList.innerHTML = filtered.map(lang => {
        const isSelected = testSelectedLanguages.includes(lang.code);
        return `
            <div class="option-item ${isSelected ? 'selected' : ''}" data-code="${lang.code}">
                <span>${lang.name}</span>
                <span class="check-mark">✓</span>
            </div>
        `;
    }).join('');
    
    optionsList.querySelectorAll('.option-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = item.dataset.code;
            if (testSelectedLanguages.includes(code)) {
                removeTestLanguage(code);
            } else if (testSelectedLanguages.length < MAX_TEST_LANGUAGES) {
                selectTestLanguage(code);
            }
        });
    });
}

function selectTestLanguage(code) {
    if (testSelectedLanguages.includes(code) || testSelectedLanguages.length >= MAX_TEST_LANGUAGES) {
        return;
    }
    
    testSelectedLanguages.push(code);
    addTestChip(code);
    renderTestOptions(document.getElementById('testLanguageInput').value);
    validateTestForm();
    
    document.getElementById('testLanguageInput').value = '';
}

function removeTestLanguage(code) {
    const index = testSelectedLanguages.indexOf(code);
    if (index > -1) {
        testSelectedLanguages.splice(index, 1);
        removeTestChip(code);
        renderTestOptions(document.getElementById('testLanguageInput').value);
        validateTestForm();
    }
}

function addTestChip(code) {
    const wrapper = document.getElementById('testInputWrapper');
    const input = document.getElementById('testLanguageInput');
    const lang = testLanguages.find(l => l.code === code);
    
    const chip = document.createElement('div');
    chip.className = 'multi-select-chip';
    chip.dataset.code = code;
    chip.innerHTML = `
        <span>${lang ? lang.name : code.toUpperCase()}</span>
        <button type="button" class="remove-chip" aria-label="Remove">×</button>
    `;
    
    chip.querySelector('.remove-chip').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTestLanguage(code);
    });
    
    wrapper.insertBefore(chip, input);
}

function removeTestChip(code) {
    const chip = document.querySelector(`#testInputWrapper .multi-select-chip[data-code="${code}"]`);
    if (chip) {
        chip.classList.add('flash-remove');
        setTimeout(() => chip.remove(), 300);
    }
}

async function performTestSearch() {
    const imdbInput = document.getElementById('testImdbInput');
    const seasonInput = document.getElementById('testSeasonInput');
    const episodeInput = document.getElementById('testEpisodeInput');
    const searchBtn = document.getElementById('testSearchBtn');
    const resultsContainer = document.getElementById('testResultsContainer');
    
    const imdbId = imdbInput.value.trim().toLowerCase();
    const season = seasonInput.value ? parseInt(seasonInput.value, 10) : null;
    const episode = episodeInput.value ? parseInt(episodeInput.value, 10) : null;
    
    if (testSelectedLanguages.length === 0 || !/^tt\d{7,8}$/.test(imdbId)) {
        return;
    }
    
    searchBtn.classList.add('loading');
    searchBtn.querySelector('.btn-text').style.display = 'none';
    searchBtn.querySelector('.btn-spinner').style.display = 'inline-flex';
    searchBtn.disabled = true;
    resultsContainer.style.display = 'none';
    
    try {
        const config = {
            languages: testSelectedLanguages,
            maxSubtitles: 0
        };
        const encodedConfig = encodeURIComponent(JSON.stringify(config));
        
        let contentId = imdbId;
        let contentType = 'movie';
        if (season !== null && episode !== null) {
            contentId = `${imdbId}:${season}:${episode}`;
            contentType = 'series';
        }
        
        const addonUrl = `/${encodedConfig}/subtitles/${contentType}/${contentId}.json`;
        console.log('[TestSearch] Fetching:', addonUrl);
        
        const fetchResponse = await fetch(addonUrl);
        const fetchData = await fetchResponse.json();
        console.log('[TestSearch] Got', fetchData.subtitles?.length || 0, 'subtitles');
        
        displayTestResultsFromFetch(fetchData, testSelectedLanguages);
        
    } catch (error) {
        console.error('[TestSearch] Error:', error);
        displayTestError('Failed to fetch subtitles. Please try again.');
    } finally {
        searchBtn.classList.remove('loading');
        searchBtn.querySelector('.btn-text').style.display = 'inline';
        searchBtn.querySelector('.btn-spinner').style.display = 'none';
        searchBtn.disabled = false;
        validateTestForm();
    }
}

function displayTestResultsFromFetch(data, selectedLangs) {
    const container = document.getElementById('testResultsContainer');
    const content = document.getElementById('testResultsContent');
    const totalBadge = document.getElementById('testResultsTotal');
    const title = document.getElementById('testResultsTitle');
    
    const subtitles = data.subtitles || [];
    
    const langGroups = {};
    subtitles.forEach(sub => {
        const lang = sub.lang || 'unknown';
        if (!langGroups[lang]) {
            langGroups[lang] = {
                count: 0,
                sources: {}
            };
        }
        langGroups[lang].count++;
        
        const source = sub.source || 'unknown';
        if (!langGroups[lang].sources[source]) {
            langGroups[lang].sources[source] = 0;
        }
        langGroups[lang].sources[source]++;
    });
    
    const total = subtitles.length;
    totalBadge.textContent = `${total} subtitle${total !== 1 ? 's' : ''}`;
    title.textContent = `Results - ${total} subtitles found`;
    
    if (total === 0) {
        content.innerHTML = `
            <div class="test-no-results">
                <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <p>No subtitles found for the selected languages.</p>
            </div>
        `;
    } else {
        const langHtml = Object.entries(langGroups)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([lang, info]) => {
                const langName = getLanguageDisplayName(lang);
                const sourcesHtml = Object.entries(info.sources)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => `
                        <div class="test-source-item">
                            <span class="test-source-name">${source}</span>
                            <span class="test-source-count">${count}</span>
                        </div>
                    `).join('');
                
                return `
                    <div class="test-lang-accordion">
                        <div class="test-lang-header" onclick="this.parentElement.classList.toggle('expanded')">
                            <div class="test-lang-header-left">
                                <svg class="test-lang-chevron" viewBox="0 0 24 24">
                                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                                </svg>
                                <span class="test-lang-name">${langName}</span>
                            </div>
                            <span class="test-lang-count">${info.count}</span>
                        </div>
                        <div class="test-lang-sources">
                            ${sourcesHtml}
                        </div>
                    </div>
                `;
            }).join('');
        
        content.innerHTML = langHtml;
    }
    
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function displayTestError(message) {
    const container = document.getElementById('testResultsContainer');
    const content = document.getElementById('testResultsContent');
    const totalBadge = document.getElementById('testResultsTotal');
    const title = document.getElementById('testResultsTitle');
    
    title.textContent = 'Error';
    totalBadge.textContent = 'Failed';
    totalBadge.style.background = 'var(--color-error-bg)';
    totalBadge.style.color = '#EF5350';
    
    content.innerHTML = `
        <div class="test-no-results">
            <svg viewBox="0 0 24 24" style="fill: #EF5350;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <p style="color: #EF5350;">${message}</p>
        </div>
    `;
    
    container.style.display = 'block';
    
    setTimeout(() => {
        totalBadge.style.background = '';
        totalBadge.style.color = '';
    }, 5000);
}

function getLanguageDisplayName(langCode) {
    if (!langCode) return langCode;
    const lowerCode = langCode.toLowerCase();
    return testLanguageLookup[lowerCode] || langCode.toUpperCase();
}