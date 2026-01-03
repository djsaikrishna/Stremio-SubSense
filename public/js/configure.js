/**
 * SubSense Configuration Page Logic
 */

const MAX_LANGUAGES = 5;
const STORAGE_KEY = 'subsense_selected_languages';
const MAX_SUBTITLES_STORAGE_KEY = 'subsense_max_subtitles';
const DEFAULT_MAX_SUBTITLES = 10;

let LANGUAGES = [
    { code: 'eng', name: 'English' },
    { code: 'fre', name: 'French' },
    { code: 'spa', name: 'Spanish' },
    { code: 'ger', name: 'German' },
    { code: 'ita', name: 'Italian' }
];

let selectedLanguages = [];
let selectedMaxSubtitles = DEFAULT_MAX_SUBTITLES;
let highlightIndex = -1;

const container = document.getElementById('multiselectContainer');
const inputWrapper = document.getElementById('inputWrapper');
const input = document.getElementById('languageInput');
const dropdown = document.getElementById('dropdownList');
const optionsList = document.getElementById('optionsList');
const dropdownStatus = document.getElementById('dropdownStatus');

const installBtn = document.getElementById('installBtn');
const installDropdownToggle = document.getElementById('installDropdownToggle');
const installDropdownMenu = document.getElementById('installDropdownMenu');
const installDirectly = document.getElementById('installDirectly');
const copyUrlBtn = document.getElementById('copyUrl');
const versionBadge = document.getElementById('versionBadge');
const toast = document.getElementById('toast');

const maxSubtitlesWrapper = document.getElementById('maxSubtitlesWrapper');
const maxSubtitlesTrigger = document.getElementById('maxSubtitlesTrigger');
const maxSubtitlesOptions = document.getElementById('maxSubtitlesOptions');
const maxSubtitlesText = document.getElementById('maxSubtitlesText');
const maxSubtitlesSelect = document.getElementById('maxSubtitlesSelect');

async function fetchLanguages() {
    try {
        const response = await fetch('/api/languages');
        if (response.ok) {
            const languages = await response.json();
            if (Array.isArray(languages) && languages.length > 0) {
                LANGUAGES = languages;
                console.log(`Loaded ${languages.length} languages from API`);
            }
        }
    } catch (error) {
        console.warn('Failed to fetch languages from API, using defaults:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await fetchLanguages();
    fetchVersion();
    restoreSavedLanguages();
    restoreSavedMaxSubtitles();
    renderOptions();
    setupEventListeners();
    updateInstallButtonState();
});

function saveLanguagesToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedLanguages));
    } catch (error) {
        console.warn('Failed to save languages to localStorage:', error);
    }
}

function saveMaxSubtitlesToStorage() {
    try {
        localStorage.setItem(MAX_SUBTITLES_STORAGE_KEY, selectedMaxSubtitles.toString());
    } catch (error) {
        console.warn('Failed to save max subtitles to localStorage:', error);
    }
}

function restoreSavedMaxSubtitles() {
    try {
        const saved = localStorage.getItem(MAX_SUBTITLES_STORAGE_KEY);
        if (saved !== null) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                selectedMaxSubtitles = parsed;
                updateMaxSubtitlesUI(parsed);
            }
        }
    } catch (error) {
        console.warn('Failed to restore max subtitles from localStorage:', error);
    }
}

function updateMaxSubtitlesUI(value) {
    if (!maxSubtitlesText || !maxSubtitlesOptions || !maxSubtitlesSelect) return;
    
    maxSubtitlesText.textContent = value === 0 ? 'Unlimited' : value.toString();
    
    maxSubtitlesSelect.value = value.toString();
    
    const options = maxSubtitlesOptions.querySelectorAll('.custom-select-option');
    options.forEach(opt => {
        if (parseInt(opt.dataset.value, 10) === value) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

function restoreSavedLanguages() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
            const parsedLanguages = JSON.parse(saved);
            const validCodes = LANGUAGES.map(l => l.code);
            const validSaved = parsedLanguages
                .filter(code => validCodes.includes(code))
                .slice(0, MAX_LANGUAGES);
            
            validSaved.forEach(code => {
                selectedLanguages.push(code);
                addChip(code);
            });
        } else {
            selectLanguage('eng');
        }
    } catch (error) {
        console.warn('Failed to restore languages from localStorage:', error);
        localStorage.removeItem(STORAGE_KEY);
        selectLanguage('eng');
    }
}

async function fetchVersion() {
    try {
        const response = await fetch('/api/version');
        const data = await response.json();
        versionBadge.textContent = `v${data.version}`;
    } catch (error) {
        console.error('Failed to fetch version:', error);
        versionBadge.textContent = 'v?.?.?';
    }
}

function renderOptions(filterText = '') {
    optionsList.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();
    
    const filtered = LANGUAGES.filter(lang => 
        lang.name.toLowerCase().includes(lowerFilter)
    );
    
    if (filtered.length === 0) {
        const noRes = document.createElement('div');
        noRes.className = 'option-item disabled';
        noRes.textContent = 'No languages found';
        noRes.style.cursor = 'default';
        noRes.style.color = 'var(--color-text-secondary)';
        optionsList.appendChild(noRes);
        return;
    }

    filtered.forEach(lang => {
        const isSelected = selectedLanguages.includes(lang.code);
        const item = document.createElement('div');
        item.className = `option-item ${isSelected ? 'selected' : ''}`;
        item.innerHTML = `
            <span>${lang.name}</span>
            <span class="check-mark">✓</span>
        `;
        
        if (isSelected) {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                removeLanguageWithFlash(lang.code);
            });
            item.addEventListener('mouseenter', () => {
                document.querySelectorAll('.option-item').forEach(el => el.classList.remove('highlighted'));
                item.classList.add('highlighted');
            });
        } else {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectLanguage(lang.code);
            });
            item.addEventListener('mouseenter', () => {
                document.querySelectorAll('.option-item').forEach(el => el.classList.remove('highlighted'));
                item.classList.add('highlighted');
            });
        }
        
        optionsList.appendChild(item);
    });

    highlightIndex = -1;
    
    if (selectedLanguages.length >= MAX_LANGUAGES) {
        dropdownStatus.style.display = 'block';
        dropdownStatus.textContent = `Maximum limit reached (${MAX_LANGUAGES})`;
        dropdownStatus.style.color = 'var(--color-text-secondary)';
    } else {
        dropdownStatus.style.display = 'none';
    }
}

function selectLanguage(code) {
    if (selectedLanguages.length >= MAX_LANGUAGES) {
        showToast(`Maximum ${MAX_LANGUAGES} languages allowed`, 'error');
        return;
    }
    
    if (!selectedLanguages.includes(code)) {
        selectedLanguages.push(code);
        addChip(code);
        saveLanguagesToStorage();
        updateInstallButtonState();
        input.value = '';
        input.focus();
        renderOptions();
        
        if (selectedLanguages.length >= MAX_LANGUAGES) {
            closeDropdown();
        }
    }
}

function addChip(code) {
    const lang = LANGUAGES.find(l => l.code === code);
    if (!lang) return;

    const chip = document.createElement('div');
    chip.className = 'multi-select-chip';
    chip.dataset.code = code;
    chip.innerHTML = `
        ${lang.name}
        <button class="remove-chip" onclick="removeLanguage('${code}')">×</button>
    `;
    
    inputWrapper.insertBefore(chip, input);
}

function removeLanguage(code) {
    const index = selectedLanguages.indexOf(code);
    if (index > -1) {
        selectedLanguages.splice(index, 1);
        
        const chip = inputWrapper.querySelector(`.multi-select-chip[data-code="${code}"]`);
        if (chip) chip.remove();
        
        saveLanguagesToStorage();
        updateInstallButtonState();
        renderOptions(input.value);
    }
}

function removeLanguageWithFlash(code) {
    const chip = inputWrapper.querySelector(`.multi-select-chip[data-code="${code}"]`);
    if (chip) {
        chip.classList.add('flash-remove');
        
        setTimeout(() => {
            removeLanguage(code);
        }, 300);
    } else {
        removeLanguage(code);
    }
}

function handleInputKeydown(e) {
    const items = optionsList.querySelectorAll('.option-item:not(.selected):not(.disabled)');
    
    if (e.key === 'Backspace' && input.value === '') {
        if (selectedLanguages.length > 0) {
            removeLanguage(selectedLanguages[selectedLanguages.length - 1]);
        }
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
        if (highlightIndex < items.length - 1) {
            highlightIndex++;
            updateHighlight(items);
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (highlightIndex > 0) {
            highlightIndex--;
            updateHighlight(items);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIndex >= 0 && items[highlightIndex]) {
            items[highlightIndex].click();
        } else if (items.length > 0 && input.value !== '') {
            items[0].click();
        }
    } else if (e.key === 'Escape') {
        closeDropdown();
    }
}

function updateHighlight(items) {
    items.forEach((item, index) => {
        if (index === highlightIndex) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('highlighted');
        }
    });
}

function setupEventListeners() {
    inputWrapper.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-chip')) {
            input.focus();
            openDropdown();
        }
    });

    input.addEventListener('focus', openDropdown);
    input.addEventListener('input', (e) => {
        openDropdown();
        renderOptions(e.target.value);
    });
    input.addEventListener('keydown', handleInputKeydown);

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            closeDropdown();
        }
        
        if (!installDropdownToggle.contains(e.target) && !installDropdownMenu.contains(e.target)) {
            closeInstallDropdown();
        }
    });

    installDropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        installDropdownMenu.classList.toggle('show');
        installDropdownToggle.classList.toggle('active');
    });

    if (maxSubtitlesTrigger && maxSubtitlesOptions) {
        maxSubtitlesTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            maxSubtitlesWrapper.classList.toggle('active');
            maxSubtitlesTrigger.classList.toggle('active');
            maxSubtitlesOptions.classList.toggle('show');
        });
        
        const options = maxSubtitlesOptions.querySelectorAll('.custom-select-option');
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = parseInt(opt.dataset.value, 10);
                selectedMaxSubtitles = value;
                updateMaxSubtitlesUI(value);
                saveMaxSubtitlesToStorage();
                
                maxSubtitlesWrapper.classList.remove('active');
                maxSubtitlesTrigger.classList.remove('active');
                maxSubtitlesOptions.classList.remove('show');
            });
        });
        
        document.addEventListener('click', (e) => {
            if (!maxSubtitlesWrapper.contains(e.target)) {
                maxSubtitlesWrapper.classList.remove('active');
                maxSubtitlesTrigger.classList.remove('active');
                maxSubtitlesOptions.classList.remove('show');
            }
        });
    }

    installBtn.addEventListener('click', installAddon);
    installDirectly.addEventListener('click', installAddon);
    copyUrlBtn.addEventListener('click', copyManifestUrl);
}

function openDropdown() {
    container.classList.add('active');
}

function closeDropdown() {
    container.classList.remove('active');
    highlightIndex = -1;
}

function closeInstallDropdown() {
    installDropdownMenu.classList.remove('show');
    installDropdownToggle.classList.remove('active');
}

function updateInstallButtonState() {
    const isEnabled = selectedLanguages.length > 0;
    installBtn.disabled = !isEnabled;
    installDropdownToggle.disabled = !isEnabled;
}

function generateUserId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let userId = '';
    for (let i = 0; i < 8; i++) {
        userId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return userId;
}

function getManifestUrl() {
    const config = {
        languages: selectedLanguages
    };
    
    if (selectedMaxSubtitles > 0) {
        config.maxSubtitles = selectedMaxSubtitles;
    }
    
    const userId = generateUserId();
    const configString = encodeURIComponent(JSON.stringify(config));
    const host = window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    
    return `${protocol}://${host}/${userId}-${configString}/manifest.json`;
}

function getStremioUrl() {
    const config = {
        languages: selectedLanguages
    };
    
    if (selectedMaxSubtitles > 0) {
        config.maxSubtitles = selectedMaxSubtitles;
    }
    
    const userId = generateUserId();
    const configString = encodeURIComponent(JSON.stringify(config));
    const host = window.location.host;
    
    return `stremio://${host}/${userId}-${configString}/manifest.json`;
}

function installAddon() {
    if (selectedLanguages.length === 0) {
        showToast('Please select at least one language', 'error');
        return;
    }
    
    const originalContent = installBtn.innerHTML;
    installBtn.disabled = true;
    installBtn.innerHTML = `
        <span class="spinner"></span>
        Opening Stremio...
    `;
    installBtn.classList.add('success');
    
    installDropdownToggle.disabled = true;
    
    setTimeout(() => {
        window.location.href = getStremioUrl();
        
        setTimeout(() => {
            installBtn.innerHTML = originalContent;
            installBtn.disabled = false;
            installBtn.classList.remove('success');
            installDropdownToggle.disabled = false;
        }, 3000);
    }, 800);
}

async function copyManifestUrl() {
    if (selectedLanguages.length === 0) {
        showToast('Please select at least one language', 'error');
        return;
    }
    
    const url = getManifestUrl();
    
    try {
        await navigator.clipboard.writeText(url);
        showToast('URL copied to clipboard!');
    } catch (error) {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('URL copied to clipboard!');
    }
    
    closeInstallDropdown();
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.style.background = type === 'error' ? 'var(--color-error)' : 'var(--color-success)';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

window.removeLanguage = removeLanguage;