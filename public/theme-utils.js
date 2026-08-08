// Shared theme utilities for PWA pages
// This file handles light/dark mode detection and application across all pages

function isRankingsPage() {
    try {
        const currentPage = String(window.location.pathname.split('/').pop() || '').toLowerCase();
        return currentPage === 'rankings.html';
    } catch (_error) {
        return false;
    }
}

const HUSH_CRITICAL_BACKUP_KEY = 'hushCriticalBackupV1';
const HUSH_CRITICAL_KEYS = Object.freeze([
    'firebaseLocalProfiles',
    'lastSignedInUsername',
    'lastSignedInEmail',
    'rememberedEmail',
    'users',
    'wallet',
    'userRankings',
    'rankingsDraftState',
    'rankingsStarredPlayers',
    'defaultRankingsStarred',
    'completedDrafts'
]);

function readCriticalBackupStore() {
    try {
        const raw = localStorage.getItem(HUSH_CRITICAL_BACKUP_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function writeCriticalBackupStore(store) {
    try {
        localStorage.setItem(HUSH_CRITICAL_BACKUP_KEY, JSON.stringify(store));
    } catch (_error) {
        // Ignore quota/private-mode failures; this is a best-effort safety net.
    }
}

function snapshotCriticalLocalData() {
    const store = readCriticalBackupStore();
    let changed = false;

    HUSH_CRITICAL_KEYS.forEach((key) => {
        const value = localStorage.getItem(key);
        if (typeof value === 'string') {
            if (store[key] !== value) {
                store[key] = value;
                changed = true;
            }
        } else if (Object.prototype.hasOwnProperty.call(store, key)) {
            delete store[key];
            changed = true;
        }
    });

    if (changed) {
        writeCriticalBackupStore(store);
    }
}

function restoreCriticalLocalDataIfMissing() {
    const store = readCriticalBackupStore();
    let restored = false;

    HUSH_CRITICAL_KEYS.forEach((key) => {
        const liveValue = localStorage.getItem(key);
        const backupValue = store[key];
        if (liveValue === null && typeof backupValue === 'string') {
            try {
                localStorage.setItem(key, backupValue);
                restored = true;
            } catch (_error) {
                // Ignore storage write failures.
            }
        }
    });

    return restored;
}

function protectCriticalLocalData() {
    restoreCriticalLocalDataIfMissing();
    snapshotCriticalLocalData();

    window.addEventListener('storage', (event) => {
        if (!event || !event.key) return;
        if (!HUSH_CRITICAL_KEYS.includes(event.key)) return;
        snapshotCriticalLocalData();
    });

    window.addEventListener('beforeunload', snapshotCriticalLocalData);
}

// Apply light mode styling to all relevant elements
function applyLightModeStyles(theme) {
    if (isRankingsPage()) {
        // Rankings page has its own theme system and should not receive shared
        // global inline theme styles.
        return;
    }

    if (theme === 'light') {
        const body = document.body;
        if (body) {
            body.style.setProperty('background-color', '#f4efe7', 'important');
            body.style.setProperty('color', '#15263b', 'important');
            body.style.setProperty('background-image', 'linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.72)), url("HUSHWHITE.png")', 'important');
        }

        // Header styles
        const headerBars = document.querySelectorAll('.header-bar, .site-header');
        headerBars.forEach(el => {
            el.style.setProperty('background-color', '#f5f5f5', 'important');
            el.style.setProperty('color', '#000000', 'important');
            el.style.setProperty('border-bottom', '2px solid #ddd', 'important');
        });
        
        // POS badge styles
        const rosterLabels = document.querySelectorAll('.roster-slot-label, .bench-pos-badge');
        rosterLabels.forEach(el => {
            el.style.setProperty('background-color', '#1d4f7a', 'important');
            el.style.setProperty('background', '#1d4f7a', 'important');
            el.style.setProperty('color', '#ffffff', 'important');
            el.style.setProperty('border-color', '#1d4f7a', 'important');
            el.style.setProperty('opacity', '1', 'important');
        });
        
        // Headers (h2, h3, h1)
        const headers = document.querySelectorAll('h1, h2, h3');
        headers.forEach(el => {
            el.style.setProperty('color', '#000000', 'important');
        });
        
        // Main content boxes/sections
        const boxes = document.querySelectorAll('.box, .panel');
        boxes.forEach(el => {
            el.style.setProperty('background-color', '#ffffff', 'important');
            el.style.setProperty('color', '#000000', 'important');
        });
        
        // Right column styling (Budget, Rankings, Chat)
        const rightViewTabs = document.querySelectorAll('.right-view-tabs');
        rightViewTabs.forEach(el => {
            el.style.setProperty('background-color', '#ffffff', 'important');
            el.style.setProperty('background', '#ffffff', 'important');
        });
        
        const rightViewTab = document.querySelectorAll('.right-view-tab');
        rightViewTab.forEach(el => {
            el.style.setProperty('background-color', '#f0f0f0', 'important');
            el.style.setProperty('color', '#000000', 'important');
            el.style.setProperty('border-color', '#ccc', 'important');
            el.style.setProperty('border', '1px solid #ccc', 'important');
            el.style.setProperty('cursor', 'pointer', 'important');
        });
        
        const rightViewTabActive = document.querySelectorAll('.right-view-tab.active');
        rightViewTabActive.forEach(el => {
            el.style.setProperty('background-color', '#1d4f7a', 'important');
            el.style.setProperty('color', '#ffffff', 'important');
            el.style.setProperty('border-color', '#1d4f7a', 'important');
        });
        
        const rightViewSection = document.querySelectorAll('.right-view-section');
        rightViewSection.forEach(el => {
            el.style.setProperty('background-color', '#ffffff', 'important');
        });
        
        console.log('[HUSH JS] Applied light mode styles');
    } else {
        // Dark mode - remove all inline styles
        const body = document.body;
        if (body) {
            body.style.removeProperty('background-color');
            body.style.removeProperty('color');
            body.style.removeProperty('background-image');
        }

        const headerBars = document.querySelectorAll('.header-bar, .site-header');
        headerBars.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-bottom');
        });
        
        const rosterLabels = document.querySelectorAll('.roster-slot-label, .bench-pos-badge');
        rosterLabels.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
            el.style.removeProperty('opacity');
        });
        
        // Reset headers
        const headers = document.querySelectorAll('h1, h2, h3');
        headers.forEach(el => {
            el.style.removeProperty('color');
        });
        
        // Reset boxes/panels
        const boxes = document.querySelectorAll('.box, .panel');
        boxes.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
        });
        
        // Reset right column styling
        const rightViewTabs = document.querySelectorAll('.right-view-tabs');
        rightViewTabs.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background');
        });
        
        const rightViewTab = document.querySelectorAll('.right-view-tab');
        rightViewTab.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
            el.style.removeProperty('border');
            el.style.removeProperty('cursor');
        });
        
        const rightViewTabActive = document.querySelectorAll('.right-view-tab.active');
        rightViewTabActive.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
        });
        
        const rightViewSection = document.querySelectorAll('.right-view-section');
        rightViewSection.forEach(el => {
            el.style.removeProperty('background-color');
        });
    }
}

function injectAdminPortalLink() {
    const currentPage = String(window.location.pathname.split('/').pop() || '').toLowerCase();
    if (currentPage === 'admin-portal.html' || currentPage === 'rankings.html') return;

    const headers = document.querySelectorAll('.site-header');
    headers.forEach((header) => {
        if (!header || header.querySelector('.site-header-admin-link')) return;
        const link = document.createElement('a');
        link.className = 'btn btn-login site-header-admin-link';
        link.href = 'admin-portal.html';
        link.textContent = 'Admin Portal';
        link.setAttribute('aria-label', 'Open Admin Portal');
        header.appendChild(link);
    });
}

// Watch for new elements and apply styling
let globalThemeObserver = null;

function setupThemeObserver(theme) {
    if (isRankingsPage()) {
        return null;
    }

    if (globalThemeObserver) {
        globalThemeObserver.disconnect();
    }
    
    const observer = new MutationObserver((mutations) => {
        let hasChanges = false;
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.classList && (node.classList.contains('roster-slot-label') || node.classList.contains('bench-pos-badge') ||
                        node.classList.contains('right-view-tab') || node.classList.contains('right-view-section') ||
                        node.classList.contains('box') || node.classList.contains('panel'))) {
                        hasChanges = true;
                        break;
                    }
                    if (node.nodeName === 'H1' || node.nodeName === 'H2' || node.nodeName === 'H3') {
                        hasChanges = true;
                        break;
                    }
                    if (node.querySelectorAll) {
                        if (node.querySelectorAll('.roster-slot-label, .bench-pos-badge, .box, .panel').length > 0 || 
                            node.querySelectorAll('.right-view-tab, h1, h2, h3').length > 0) {
                            hasChanges = true;
                            break;
                        }
                    }
                }
            }
        }
        
        if (hasChanges && theme === 'light') {
            setTimeout(() => applyLightModeStyles(theme), 10);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    return observer;
}

// Initialize theme based on shared dashboard/user preference
function initializePageTheme() {
    try {
        if (isRankingsPage()) {
            injectAdminPortalLink();
            return;
        }

        let theme = 'dark'; // Default

        if (typeof resolveSiteThemePreference === 'function') {
            theme = resolveSiteThemePreference() === 'light' ? 'light' : 'dark';
        } else {
            // Try to get username first
            const username = String(
                sessionStorage.getItem('username') ||
                localStorage.getItem('lastSignedInUsername') ||
                ''
            ).trim();

            // Check user preferences if logged in
            if (username) {
                try {
                    const usersJson = localStorage.getItem('users');
                    if (usersJson) {
                        const users = JSON.parse(usersJson);
                        const userTheme = users[username]?.preferences?.theme;
                        if (userTheme === 'light' || userTheme === 'dark') {
                            theme = userTheme;
                        }
                    }
                } catch (e) {
                    console.warn('[HUSH JS] Error reading user preferences:', e);
                }
            }

            // Fall back to localStorage dashboardTheme.
            if (theme === 'dark') {
                const storedTheme = localStorage.getItem('dashboardTheme');
                if (storedTheme === 'light') {
                    theme = 'light';
                }
            }

            // No system fallback here; pages should follow app preference only.
        }
        
        // Add classes
        const html = document.documentElement;
        if (theme === 'light') {
            html.setAttribute('data-theme', 'light');
            html.classList.add('light-mode');
            if (document.body) {
                document.body.classList.add('light-mode');
                document.body.classList.add('dashboard-light-mode');
            }
        } else {
            html.setAttribute('data-theme', 'dark');
            html.classList.remove('light-mode');
            if (document.body) {
                document.body.classList.remove('light-mode');
                document.body.classList.remove('dashboard-light-mode');
            }
        }
        
        // Apply all styling at once
        applyLightModeStyles(theme);
        injectAdminPortalLink();
        
        // Re-apply styles after delays to catch dynamically rendered elements
        setTimeout(() => applyLightModeStyles(theme), 100);
        setTimeout(() => applyLightModeStyles(theme), 300);
        setTimeout(() => applyLightModeStyles(theme), 500);
        
        // Setup observer for new elements
        if (theme === 'light') {
            globalThemeObserver = setupThemeObserver(theme);
        } else {
            if (globalThemeObserver) {
                globalThemeObserver.disconnect();
                globalThemeObserver = null;
            }
        }
    } catch (e) {
        console.error('[HUSH JS] Error in initializePageTheme:', e);
    }
}

// Setup listeners for theme changes (from other tabs or storage)
function setupThemeListeners() {
    window.addEventListener('storage', (event) => {
        if (event.key === 'dashboardTheme' || event.key === 'users') {
            console.log('[HUSH JS] Theme storage changed, re-initializing...');
            initializePageTheme();
        }
    });

}

// Call this when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        protectCriticalLocalData();
        initializePageTheme();
        setupThemeListeners();
    });
} else {
    protectCriticalLocalData();
    initializePageTheme();
    setupThemeListeners();
}
