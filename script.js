/**
 * QuickHub - Premium Shortcut Manager
 * Core Logic & State Management
 */

const DEFAULT_CATEGORIES = ['All', 'Social', 'Productivity', 'Dev', 'Media'];
const DEFAULT_SHORTCUTS = [
    { id: 1, name: 'Google', url: 'https://google.com', category: 'Productivity' },
    { id: 2, name: 'YouTube', url: 'https://youtube.com', category: 'Media' },
    { id: 3, name: 'GitHub', url: 'https://github.com', category: 'Dev' },
    { id: 4, name: 'ChatGPT', url: 'https://chat.openai.com', category: 'Productivity' },
    { id: 5, name: 'LinkedIn', url: 'https://linkedin.com', category: 'Social' }
];

let state = {
    shortcuts: [],
    categories: [],
    settings: {
        primaryColor: '#2563eb',
        gridSize: '110',
        bgImage: null
    },
    activeCategory: 'All',
    searchQuery: ''
};

// DOM Elements
const grid = document.getElementById('shortcuts-grid');
const catList = document.getElementById('categories-list');
const searchInput = document.getElementById('global-search');
const shortcutModal = document.getElementById('shortcut-modal');
const settingsDrawer = document.getElementById('settings-drawer');
const shortcutForm = document.getElementById('shortcut-form');
const themeToggle = document.getElementById('toggle-theme');

/**
 * Initialize App
 */
async function init() {
    await loadState();
    setupEventListeners();
    setupSortable();
    render();
    checkOnboarding();
}

/**
 * Load State from Chrome Storage
 */
async function loadState() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['quickHubState'], (result) => {
            if (result.quickHubState) {
                state = { ...state, ...result.quickHubState };
            } else {
                state.shortcuts = [...DEFAULT_SHORTCUTS];
                state.categories = [...DEFAULT_CATEGORIES];
                saveState();
            }
            applySettings();
            resolve();
        });
    });
}

function saveState() {
    chrome.storage.local.set({ quickHubState: state });
}

/**
 * Render Components
 */
function render() {
    renderCategories();
    renderShortcuts();
}

function renderCategories() {
    catList.innerHTML = '';
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-pill ${state.activeCategory === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.addEventListener('click', () => {
            state.activeCategory = cat;
            render();
        });
        catList.appendChild(btn);
    });
}

function renderShortcuts() {
    // Keep the "Add" button
    const addBtn = document.getElementById('initial-add-btn');
    grid.innerHTML = '';
    grid.appendChild(addBtn);

    const filtered = state.shortcuts.filter(s => {
        const matchesCat = state.activeCategory === 'All' || s.category === state.activeCategory;
        const matchesSearch = s.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                            s.url.toLowerCase().includes(state.searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });

    filtered.forEach(s => {
        const card = document.createElement('div');
        card.className = 'shortcut-card glass';
        card.dataset.id = s.id;
        
        const favicon = s.icon || `https://www.google.com/s2/favicons?domain=${s.url}&sz=128`;
        
        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn edit-btn">✎</button>
                <button class="action-btn delete-btn">×</button>
            </div>
            <div class="shortcut-link" style="cursor:pointer; width:100%; display:flex; flex-direction:column; align-items:center;">
                <div class="icon-container">
                    <img src="${favicon}" alt="${s.name}" onerror="this.src='https://ui-avatars.com/api/?name=${s.name}&background=random'">
                </div>
                <div class="site-title">${s.name}</div>
            </div>
        `;

        // Handle the main click to open in new tab
        card.querySelector('.shortcut-link').addEventListener('click', () => {
            chrome.tabs.create({ url: s.url });
        });

        // Add event listeners to the buttons inside the card
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(s.id);
        });

        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteShortcut(s.id);
        });
        
        grid.insertBefore(card, addBtn);
    });
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderShortcuts();
    });

    // Modal toggles
    document.getElementById('initial-add-btn').addEventListener('click', () => openAddModal());
    document.getElementById('cancel-shortcut').addEventListener('click', () => shortcutModal.style.display = 'none');
    document.getElementById('open-settings').addEventListener('click', () => settingsDrawer.style.display = 'flex');
    document.getElementById('close-settings').addEventListener('click', () => settingsDrawer.style.display = 'none');

    // Form submission
    shortcutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleShortcutSubmit();
    });

    // Settings changes
    document.getElementById('theme-color-picker').addEventListener('change', (e) => {
        state.settings.primaryColor = e.target.value;
        applySettings();
        saveState();
    });

    document.getElementById('grid-size-slider').addEventListener('input', (e) => {
        state.settings.gridSize = e.target.value;
        applySettings();
        saveState();
    });

    // Background upload
    document.getElementById('bg-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                state.settings.bgImage = ev.target.result;
                applySettings();
                saveState();
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('reset-bg').addEventListener('click', () => {
        state.settings.bgImage = null;
        applySettings();
        saveState();
    });

    // Data Actions
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    
    // Onboarding
    document.getElementById('finish-onboarding').addEventListener('click', () => {
        chrome.storage.local.set({ hasOnboarded: true });
        document.getElementById('onboarding').style.display = 'none';
    });

    // Next slide onboarding
    document.querySelectorAll('.next-slide').forEach(btn => {
        btn.addEventListener('click', () => {
            const slides = document.querySelectorAll('.slide');
            slides[0].classList.remove('active');
            slides[1].classList.add('active');
        });
    });

    // Keyboard shortcut (/)
    window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

/**
 * Logic Functions
 */
function openAddModal() {
    document.getElementById('modal-title').textContent = 'Add Shortcut';
    document.getElementById('edit-id').value = '';
    shortcutForm.reset();
    populateCategorySelect();
    shortcutModal.style.display = 'flex';
}

function openEditModal(id) {
    const s = state.shortcuts.find(x => x.id === id);
    if (!s) return;
    
    document.getElementById('modal-title').textContent = 'Edit Shortcut';
    document.getElementById('edit-id').value = s.id;
    document.getElementById('site-name').value = s.name;
    document.getElementById('site-url').value = s.url;
    document.getElementById('site-icon').value = s.icon || '';
    
    populateCategorySelect(s.category);
    shortcutModal.style.display = 'flex';
}

function populateCategorySelect(selected = 'All') {
    const select = document.getElementById('site-category');
    select.innerHTML = '';
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === selected) opt.selected = true;
        select.appendChild(opt);
    });
}

function handleShortcutSubmit() {
    const id = document.getElementById('edit-id').value;
    const data = {
        name: document.getElementById('site-name').value,
        url: document.getElementById('site-url').value,
        icon: document.getElementById('site-icon').value,
        category: document.getElementById('site-category').value
    };

    if (id) {
        const idx = state.shortcuts.findIndex(s => s.id == id);
        state.shortcuts[idx] = { ...state.shortcuts[idx], ...data };
    } else {
        state.shortcuts.push({ id: Date.now(), ...data });
    }

    saveState();
    render();
    shortcutModal.style.display = 'none';
}

function deleteShortcut(id) {
    if (confirm('Delete this shortcut?')) {
        state.shortcuts = state.shortcuts.filter(s => s.id !== id);
        saveState();
        render();
    }
}

function applySettings() {
    // Force CSS variables for Blue/Black/White theme
    document.documentElement.style.setProperty('--primary-blue', state.settings.primaryColor);
}

/**
 * Drag & Drop
 */
function setupSortable() {
    new Sortable(grid, {
        animation: 150,
        filter: '.add-card',
        onEnd: (evt) => {
            const cards = Array.from(grid.querySelectorAll('.shortcut-card:not(.add-card)'));
            const newOrder = cards.map(c => parseInt(c.dataset.id));
            
            // Reorder state.shortcuts based on this (limited to active filtered set if needed, but here we just reorder global list)
            const reordered = [];
            newOrder.forEach(id => {
                reordered.push(state.shortcuts.find(s => s.id === id));
            });
            
            // Add back ones that might have been filtered out
            state.shortcuts.forEach(s => {
                if (!newOrder.includes(s.id)) reordered.push(s);
            });
            
            state.shortcuts = reordered;
            saveState();
        }
    });
}

/**
 * Onboarding
 */
function checkOnboarding() {
    chrome.storage.local.get(['hasOnboarded'], (result) => {
        if (!result.hasOnboarded) {
            document.getElementById('onboarding').style.display = 'flex';
        }
    });
}

document.getElementById('finish-onboarding').onclick = () => {
    chrome.storage.local.set({ hasOnboarded: true });
    document.getElementById('onboarding').style.display = 'none';
};

/**
 * Import/Export
 */
function exportData() {
    const dataStr = JSON.stringify(state);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'quickhub-backup.json');
    linkElement.click();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const imported = JSON.parse(ev.target.result);
            state = imported;
            saveState();
            location.reload();
        } catch (err) {
            alert('Invalid backup file');
        }
    };
    reader.readAsText(file);
}

// Start
init();
