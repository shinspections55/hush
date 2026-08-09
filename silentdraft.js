// Apply light mode styling to all relevant elements
function applyLightModeStyles(theme) {
    if (theme === 'light') {
        const body = document.body;
        if (body) {
            body.style.setProperty('background-color', '#f4efe7', 'important');
            body.style.setProperty('color', '#15263b', 'important');
            body.style.setProperty('background-image', 'linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.72)), url("HUSHWHITE.png")', 'important');
        }

        // Header styles
        const headerBars = document.querySelectorAll('.header-bar');
        const headerBidCounters = document.querySelectorAll('.header-bid-counter');
        
        headerBars.forEach(el => {
            el.style.setProperty('background-color', '#f5f5f5', 'important');
            el.style.setProperty('color', '#000000', 'important');
            el.style.setProperty('border-bottom', '2px solid #ddd', 'important');
        });
        
        headerBidCounters.forEach(el => {
            el.style.setProperty('background-color', '#ffffff', 'important');
            el.style.setProperty('color', '#000000', 'important');
            el.style.setProperty('border-color', '#ddd', 'important');
        });
        
        // POS badge styles - apply immediately and with multiple attempts to catch new elements
        const rosterLabels = document.querySelectorAll('.roster-slot-label, .bench-pos-badge');
        rosterLabels.forEach(el => {
            el.style.setProperty('background-color', '#1d4f7a', 'important');
            el.style.setProperty('background', '#1d4f7a', 'important');
            el.style.setProperty('color', '#ffffff', 'important');
            el.style.setProperty('border-color', '#1d4f7a', 'important');
            el.style.setProperty('opacity', '1', 'important');
        });

        const rosterCards = document.querySelectorAll('#center-column #your-team .roster-slot-card');
        rosterCards.forEach(el => {
            el.style.setProperty('background-color', '#ffffff', 'important');
            el.style.setProperty('border-color', 'rgba(23, 50, 77, 0.34)', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('mix-blend-mode', 'normal', 'important');
            el.style.setProperty('z-index', '2', 'important');
            el.style.setProperty('position', 'relative', 'important');
        });

        const rosterValues = document.querySelectorAll('#center-column #your-team .roster-slot-value, #center-column #bench-players .bench-player-name, #center-column #bench-players .bench-player-bid');
        rosterValues.forEach(el => {
            el.style.setProperty('color', '#000000', 'important');
            el.style.setProperty('-webkit-text-fill-color', '#000000', 'important');
            el.style.setProperty('font-weight', '800', 'important');
            el.style.setProperty('text-shadow', 'none', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('filter', 'none', 'important');
        });
        
        // Username/Header text in My Roster area
        const rosterHeaders = document.querySelectorAll('h2, h3');
        rosterHeaders.forEach(el => {
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
            el.style.setProperty('background-color', '#f0f0f0', 'important');
            el.style.setProperty('color', '#000000', 'important');
            el.style.setProperty('border-color', '#1d4f7a', 'important');
            el.style.setProperty('border', '2px solid #1d4f7a', 'important');
        });
        
        const rightViewSection = document.querySelectorAll('.right-view-section');
        rightViewSection.forEach(el => {
            el.style.setProperty('background-color', '#ffffff', 'important');
        });
        
        console.log('[HUSH JS] Applied light mode styles:', {
            headerBars: headerBars.length,
            headerBidCounters: headerBidCounters.length,
            rosterLabels: rosterLabels.length,
            rosterHeaders: rosterHeaders.length,
            rightViewTabs: rightViewTabs.length,
            rightViewButtons: rightViewTab.length
        });
    } else {
        // Dark mode - remove all inline styles
        const body = document.body;
        if (body) {
            body.style.removeProperty('background-color');
            body.style.removeProperty('color');
            body.style.removeProperty('background-image');
        }

        const headerBars = document.querySelectorAll('.header-bar');
        const headerBidCounters = document.querySelectorAll('.header-bid-counter');
        const rosterLabels = document.querySelectorAll('.roster-slot-label, .bench-pos-badge');
        const rosterCards = document.querySelectorAll('#center-column #your-team .roster-slot-card');
        const rosterValues = document.querySelectorAll('#center-column #your-team .roster-slot-value');
        
        headerBars.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-bottom');
        });
        
        headerBidCounters.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
        });
        
        rosterLabels.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('background');
            el.style.removeProperty('color');
            el.style.removeProperty('border-color');
            el.style.removeProperty('opacity');
        });

        rosterCards.forEach(el => {
            el.style.removeProperty('background-color');
            el.style.removeProperty('border-color');
            el.style.removeProperty('opacity');
            el.style.removeProperty('mix-blend-mode');
            el.style.removeProperty('z-index');
            el.style.removeProperty('position');
        });

        rosterValues.forEach(el => {
            el.style.removeProperty('color');
            el.style.removeProperty('-webkit-text-fill-color');
            el.style.removeProperty('font-weight');
            el.style.removeProperty('text-shadow');
            el.style.removeProperty('opacity');
            el.style.removeProperty('filter');
        });

        // In dark mode, force My Roster center-column values back to light text.
        const darkRosterValues = document.querySelectorAll('#center-column #your-team .roster-slot-value, #center-column #bench-players .bench-player-name, #center-column #bench-players .bench-player-bid');
        darkRosterValues.forEach(el => {
            el.style.setProperty('color', '#d6e0eb', 'important');
            el.style.setProperty('-webkit-text-fill-color', '#d6e0eb', 'important');
        });
        
        // Reset header text color
        const rosterHeaders = document.querySelectorAll('h2, h3');
        rosterHeaders.forEach(el => {
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
            el.style.removeProperty('border');
        });
        
        const rightViewSection = document.querySelectorAll('.right-view-section');
        rightViewSection.forEach(el => {
            el.style.removeProperty('background-color');
        });
    }
}

// Watch for new POS badge elements and apply styling
function setupPOSBadgeObserver(theme) {
    const observer = new MutationObserver((mutations) => {
        let hasChanges = false;
        for (let mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.classList && (node.classList.contains('roster-slot-label') || node.classList.contains('bench-pos-badge') ||
                        node.classList.contains('right-view-tab') || node.classList.contains('right-view-section'))) {
                        hasChanges = true;
                        break;
                    }
                    // Check if it's an h2 or h3 header
                    if (node.nodeName === 'H2' || node.nodeName === 'H3') {
                        hasChanges = true;
                        break;
                    }
                    // Check children too
                    if (node.querySelectorAll && (node.querySelectorAll('.roster-slot-label, .bench-pos-badge').length > 0 || 
                        node.querySelectorAll('.right-view-tab').length > 0 ||
                        node.querySelectorAll('h2, h3').length > 0)) {
                        hasChanges = true;
                        break;
                    }
                }
            }
        }
        
        if (hasChanges && theme === 'light') {
            // Re-apply styles to catch new elements
            setTimeout(() => applyLightModeStyles(theme), 10);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    return observer;
}

let posObserver = null;

// Initialize theme based on shared dashboard/user preference
function initializeDraftTheme() {
    try {
        console.log('[HUSH JS] initializeDraftTheme() called');
        let theme = 'dark'; // Default

        if (typeof resolveSiteThemePreference === 'function') {
            theme = resolveSiteThemePreference() === 'light' ? 'light' : 'dark';
            console.log('[HUSH JS] ✓ Theme from resolveSiteThemePreference:', theme);
        } else {
        
        // Try to get username first
        const username = String(
            sessionStorage.getItem('username') ||
            localStorage.getItem('lastSignedInUsername') ||
            ''
        ).trim();
        console.log('[HUSH JS] Username:', username || '(no user)');
        
        // Check user preferences if logged in
        if (username) {
            try {
                const usersJson = localStorage.getItem('users');
                if (usersJson) {
                    const users = JSON.parse(usersJson);
                    const userTheme = users[username]?.preferences?.theme;
                    if (userTheme === 'light' || userTheme === 'dark') {
                        theme = userTheme;
                        console.log('[HUSH JS] ✓ Theme from user preferences:', theme);
                    }
                }
            } catch (e) {
                console.warn('[HUSH JS] Error reading user preferences:', e);
            }
        }
        
        // Fall back to localStorage dashboardTheme
        if (theme === 'dark') {
            const storedTheme = localStorage.getItem('dashboardTheme');
            console.log('[HUSH JS] localStorage dashboardTheme:', storedTheme);
            if (storedTheme === 'light') {
                theme = 'light';
                console.log('[HUSH JS] ✓ Theme from dashboardTheme:', theme);
            }
        }
        
        // No system fallback here; draft room should follow app preference only.
        }
        
        console.log('[HUSH JS] Final theme:', theme);
        
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
        console.log('[HUSH JS] ✓✓✓ APPLYING ALL LIGHT MODE STYLES ✓✓✓');
        applyLightModeStyles(theme);
        
        // Re-apply styles after delays to catch dynamically rendered elements
        setTimeout(() => applyLightModeStyles(theme), 100);
        setTimeout(() => applyLightModeStyles(theme), 300);
        setTimeout(() => applyLightModeStyles(theme), 500);
        
        // Setup observer for new POS badges
        if (theme === 'light') {
            if (posObserver) posObserver.disconnect();
            posObserver = setupPOSBadgeObserver(theme);
        } else {
            if (posObserver) {
                posObserver.disconnect();
                posObserver = null;
            }
        }
    } catch (e) {
        console.error('[HUSH JS] Error in initializeDraftTheme:', e);
        // Default to dark mode if any error
    }
}

function initSilentDraft() {

    function getCurrentDraftTheme() {
        if (typeof resolveSiteThemePreference === 'function') {
            return resolveSiteThemePreference() === 'light' ? 'light' : 'dark';
        }
        return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    function updateDraftThemeToggleButtonState() {
        const toggle = document.getElementById('themeToggleBtn');
        if (!toggle) return;
        const currentTheme = getCurrentDraftTheme();
        toggle.innerHTML = currentTheme === 'light' ? '&#9728;' : '&#127769;';
        toggle.setAttribute('aria-label', currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
        toggle.setAttribute('title', currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
        toggle.setAttribute('aria-pressed', currentTheme === 'light' ? 'true' : 'false');
    }

    function setupDraftThemeToggle() {
        const toggle = document.getElementById('themeToggleBtn');
        if (!toggle) return;

        if (toggle.dataset.bound !== '1') {
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', () => {
                const currentTheme = getCurrentDraftTheme();
                const nextTheme = currentTheme === 'light' ? 'dark' : 'light';

                if (typeof persistSiteThemePreference === 'function') {
                    persistSiteThemePreference(nextTheme);
                } else {
                    try {
                        localStorage.setItem('dashboardTheme', nextTheme);
                    } catch (e) {
                        // ignore
                    }
                }

                if (typeof applySiteThemePreference === 'function') {
                    applySiteThemePreference(nextTheme);
                }

                initializeDraftTheme();
                updateDraftThemeToggleButtonState();
            });
        }

        updateDraftThemeToggleButtonState();
    }

    // Listen for storage changes (from other tabs or dashboard theme toggle)
    window.addEventListener('storage', (event) => {
        // Listen for both dashboardTheme and users (where actual theme is stored)
        if (event.key === 'dashboardTheme' || event.key === 'users') {
            console.log('[HUSH JS] Storage event detected for', event.key, ':', event.newValue ? event.newValue.substring(0, 50) + '...' : '(cleared)');
            initializeDraftTheme();
            updateDraftThemeToggleButtonState();
        }
    });

    setupDraftThemeToggle();

    const DRAFTROOM_RANKINGS_MODE_KEY = 'draftroomRankingsMode';
    const DATABASE_RANKINGS_SET_KEY = 'databaseRankingsSet';
    const DRAFTROOM_RIGHT_VIEW_KEY = 'draftroomRightView';
    const DRAFT_APP_SECTION_VIEW_KEY = 'draftAppSectionView';
    const STARRED_PLAYERS_KEY = 'rankingsStarredPlayers';
    const DRAFT_TEMP_STARRED_KEY = 'rankingsDraftStarredPlayers';
    let currentRound = 1;
    let lastServerRoundStarted = 0;
    const totalRounds = 10;
    const DEFAULT_ROUND_TIMER_MINUTES = 3;
    let roundDuration = DEFAULT_ROUND_TIMER_MINUTES * 60;
    let timerInterval = null;
    let isDraftEnding = false;
    let processRoundRetryTimer = null;
    let roundResultsRecoveryTimer = null;
    let draftTabTitleTimer = null;
    let HUSH_NETWORK_PROFILE = 'high-latency';
    try {
        const storedProfile = String(localStorage.getItem('hushNetworkProfile') || '').trim().toLowerCase();
        if (storedProfile) HUSH_NETWORK_PROFILE = storedProfile;
    } catch (_error) {
        HUSH_NETWORK_PROFILE = 'high-latency';
    }
    const USE_HIGH_LATENCY_PROFILE = HUSH_NETWORK_PROFILE === 'high-latency' || HUSH_NETWORK_PROFILE === 'mobile';
    const DRAFT_HEARTBEAT_INTERVAL_MS = USE_HIGH_LATENCY_PROFILE ? 12000 : 10000;
    const DRAFT_HEARTBEAT_ACK_TIMEOUT_MS = USE_HIGH_LATENCY_PROFILE ? 6000 : 5000;
    const DRAFT_HEARTBEAT_MISS_THRESHOLD = USE_HIGH_LATENCY_PROFILE ? 4 : 3;
    const DRAFT_HEARTBEAT_HARD_RECOVER_THRESHOLD = USE_HIGH_LATENCY_PROFILE ? 7 : 6;
    const DEFAULT_ACK_TIMEOUT_MS = USE_HIGH_LATENCY_PROFILE ? 7500 : 7000;
    const DEFAULT_ACK_OVERALL_TIMEOUT_MS = USE_HIGH_LATENCY_PROFILE ? 20000 : 15000;
    const DEFAULT_ACK_MAX_RETRIES = USE_HIGH_LATENCY_PROFILE ? 2 : 1;
    const DRAFT_SOCKET_WATCHDOG_INTERVAL_MS = USE_HIGH_LATENCY_PROFILE ? 12000 : 10000;
    const DRAFT_TAB_TITLE_BASE = (String(document.title || 'Hush').trim() || 'Hush').replace(/\s*[\(\[\-\|].*$/, '').trim() || 'Hush';
    const DRAFT_TAB_CONNECTED_DOT = '🟢';
    const DRAFT_TAB_DISCONNECTED_DOT = '🔴';
    const submitRequestIdsByRound = new Map();
    const processRequestIdsByRound = new Map();
    let draftAudioContext = null;
    let draftAudioReady = false;
    let lastCountdownCueKey = '';
    let draftWakeLock = null;
    let draftAudioKeepAliveNode = null;
    let draftAudioKeepAliveGain = null;
    let keepDraftScreenAwake = true;
    let wakeLockHeartbeatTimer = null;
    let activeRoundResultsModalRound = null;
    let draftTabConnectionDot = DRAFT_TAB_DISCONNECTED_DOT;

    function formatRoundClock(totalSeconds) {
        const safeSeconds = Number.isFinite(Number(totalSeconds)) ? Math.max(0, Number(totalSeconds)) : 0;
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    function getDraftTabTitle() {
        if (isDraftEnding) {
            return DRAFT_TAB_TITLE_BASE;
        }
        const roundLabel = Number.isFinite(Number(currentRound)) ? `R${Number(currentRound)}` : 'R?';
        const clockLabel = formatRoundClock(timer);
        return `${DRAFT_TAB_TITLE_BASE} ${clockLabel} ${roundLabel} ${draftTabConnectionDot}`;
    }

    function updateDraftTabTitle(useBaseTitle = false) {
        document.title = useBaseTitle ? DRAFT_TAB_TITLE_BASE : getDraftTabTitle();
    }

    function startDraftTabTitleTicker() {
        if (draftTabTitleTimer) return;
        updateDraftTabTitle(false);
        draftTabTitleTimer = setInterval(() => {
            updateDraftTabTitle(false);
        }, 1000);
    }

    function stopDraftTabTitleTicker(resetToBase = true) {
        if (draftTabTitleTimer) {
            clearInterval(draftTabTitleTimer);
            draftTabTitleTimer = null;
        }
        if (resetToBase) {
            updateDraftTabTitle(true);
        }
    }

    function getDraftAudioContext() {
        try {
            if (!draftAudioContext) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return null;
                draftAudioContext = new Ctx();
            }
            return draftAudioContext;
        } catch (_error) {
            return null;
        }
    }

    function unlockDraftAudio() {
        const ctx = getDraftAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                draftAudioReady = true;
                startDraftAudioKeepAlive();
                requestDraftWakeLock();
            }).catch(() => {
                draftAudioReady = false;
            });
            return;
        }
        draftAudioReady = true;
        startDraftAudioKeepAlive();
        requestDraftWakeLock();
    }

    function startDraftAudioKeepAlive() {
        const ctx = getDraftAudioContext();
        if (!ctx || draftAudioKeepAliveNode) return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.frequency.value = 30;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.00001;
            oscillator.start();

            draftAudioKeepAliveNode = oscillator;
            draftAudioKeepAliveGain = gainNode;
        } catch (_error) {
            draftAudioKeepAliveNode = null;
            draftAudioKeepAliveGain = null;
        }
    }

    function stopDraftAudioKeepAlive() {
        try {
            if (draftAudioKeepAliveNode) {
                draftAudioKeepAliveNode.stop();
            }
        } catch (_error) {
            // ignore keep-alive stop errors
        } finally {
            draftAudioKeepAliveNode = null;
            draftAudioKeepAliveGain = null;
        }
    }

    async function requestDraftWakeLock() {
        try {
            if (!keepDraftScreenAwake) return;
            if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
            if (draftWakeLock) return;
            draftWakeLock = await navigator.wakeLock.request('screen');
            draftWakeLock.addEventListener('release', () => {
                draftWakeLock = null;
                // Some devices release wake lock on thermal/battery/power events.
                // Re-request while draft is active and page is foregrounded.
                if (keepDraftScreenAwake && document.visibilityState === 'visible') {
                    setTimeout(() => {
                        requestDraftWakeLock();
                    }, 150);
                }
            });
        } catch (_error) {
            draftWakeLock = null;
        }
    }

    async function releaseDraftWakeLock() {
        try {
            if (draftWakeLock) {
                await draftWakeLock.release();
            }
        } catch (_error) {
            // ignore wake lock release errors
        } finally {
            draftWakeLock = null;
        }
    }

    function startWakeLockHeartbeat() {
        if (wakeLockHeartbeatTimer) return;
        wakeLockHeartbeatTimer = setInterval(() => {
            if (!keepDraftScreenAwake) return;
            if (document.visibilityState !== 'visible') return;
            if (!navigator.onLine) return;
            if (!draftWakeLock) {
                requestDraftWakeLock();
            }
        }, 15000);
    }

    function stopWakeLockHeartbeat() {
        if (!wakeLockHeartbeatTimer) return;
        clearInterval(wakeLockHeartbeatTimer);
        wakeLockHeartbeatTimer = null;
    }

    function setDraftScreenAwakeEnabled(enabled) {
        keepDraftScreenAwake = !!enabled;
        if (keepDraftScreenAwake) {
            startWakeLockHeartbeat();
            requestDraftWakeLock();
            return;
        }
        stopWakeLockHeartbeat();
        releaseDraftWakeLock();
    }

    function setupDraftAudioUnlock() {
        const unlockOnce = () => {
            unlockDraftAudio();
            if (draftAudioReady) {
                document.removeEventListener('pointerdown', unlockOnce, true);
                document.removeEventListener('touchstart', unlockOnce, true);
                document.removeEventListener('keydown', unlockOnce, true);
            }
        };

        document.addEventListener('pointerdown', unlockOnce, true);
        document.addEventListener('touchstart', unlockOnce, true);
        document.addEventListener('keydown', unlockOnce, true);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                unlockDraftAudio();
                requestDraftWakeLock();
                startWakeLockHeartbeat();
            } else {
                stopDraftAudioKeepAlive();
                stopWakeLockHeartbeat();
                releaseDraftWakeLock();
            }
        });

        window.addEventListener('focus', () => {
            if (!keepDraftScreenAwake) return;
            requestDraftWakeLock();
        });

        window.addEventListener('pageshow', () => {
            if (!keepDraftScreenAwake) return;
            requestDraftWakeLock();
        });

        window.addEventListener('online', () => {
            if (!keepDraftScreenAwake) return;
            requestDraftWakeLock();
        });
    }

    function playDraftTone(frequency, durationSeconds, volume) {
        const ctx = getDraftAudioContext();
        if (!ctx) return;

        const scheduleTone = () => {
            try {
                if (ctx.state !== 'running') return;

                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'sine';
                oscillator.frequency.value = frequency;

                const now = ctx.currentTime;
                gainNode.gain.setValueAtTime(volume, now);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

                oscillator.start(now);
                oscillator.stop(now + durationSeconds);
            } catch (_error) {
                // ignore audio playback errors
            }
        };

        if (ctx.state === 'suspended') {
            ctx.resume().then(scheduleTone).catch(() => {});
            return;
        }

        scheduleTone();
    }

    function playCountdownCue(secondsRemaining) {
        const second = Number.parseInt(secondsRemaining, 10);
        if (!Number.isFinite(second)) return;
        if (second > 10 || second < 0) return;

        const cueKey = `${currentRound}-${second}`;
        if (cueKey === lastCountdownCueKey) return;
        lastCountdownCueKey = cueKey;

        // Countdown: short beeps for 10..1, distinct double-beep at 5, longer final tone at 0.
        if (second === 0) {
            playDraftTone(420, 0.35, 0.16);
        } else if (second === 5) {
            playDraftTone(960, 0.11, 0.18);
            setTimeout(() => playDraftTone(960, 0.11, 0.18), 130);
        } else if (second <= 3) {
            playDraftTone(1040, 0.12, 0.14);
        } else {
            playDraftTone(820, 0.09, 0.1);
        }
    }

    // Roster constraints are configurable from lobby settings.
    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 5 };
    const flexPositions = ['RB', 'WR', 'TE'];
    let rosterSettings = Object.assign({}, DEFAULT_ROSTER_SETTINGS);
    let rosterLimits = {
        QB: { min: 1, max: 14 },
        RB: { min: 2, max: 16 },
        WR: { min: 2, max: 16 },
        TE: { min: 1, max: 14 },
        K: { min: 1, max: 14 },
        DEF: { min: 1, max: 14 }
    };
    let rosterSize = 20;
    const DEFAULT_BENCH_CUT_TARGET = 5;
    const MAX_DRAFT_BENCH = 13;
    const STARTER_SLOT_COUNT = 9;
    let benchCutTarget = DEFAULT_BENCH_CUT_TARGET;
    let roundPositionMinimums = {
        QB: 2,
        RB: 3,
        WR: 3,
        TE: 2,
        K: 1,
        DEF: 1
    };
    const AJ_ROUND_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const AJ_REVERSED_START_POSITIONS = new Set(['WR', 'TE', 'K']);
    let ajDraftModeEnabled = false;
    let ajRoundOrder = AJ_ROUND_CODES.slice();
    const PAGE_SIZE = 12;
    const PAGE1_REQUIREMENTS = [
        { pos: 'QB', min: 2 },
        { pos: 'RB', min: 2 },
        { pos: 'WR', min: 2 },
        { pos: 'TE', min: 1 },
        { pos: 'K', min: 1 },
        { pos: 'DEF', min: 1 }
    ];
    const PAGE2_REQUIREMENTS = [
        { pos: 'QB', min: 1 },
        { pos: 'RB', min: 1 },
        { pos: 'WR', min: 1 },
        { pos: 'TE', min: 1 }
    ];

    function parseRosterNumber(value, fallback, min, max) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

    function normalizeRosterSettings(raw) {
        const merged = Object.assign({}, DEFAULT_ROSTER_SETTINGS, raw || {});
        const normalized = {
            QB: parseRosterNumber(merged.QB, DEFAULT_ROSTER_SETTINGS.QB, 0, 8),
            WR: parseRosterNumber(merged.WR, DEFAULT_ROSTER_SETTINGS.WR, 0, 10),
            RB: parseRosterNumber(merged.RB, DEFAULT_ROSTER_SETTINGS.RB, 0, 10),
            TE: parseRosterNumber(merged.TE, DEFAULT_ROSTER_SETTINGS.TE, 0, 8),
            FLEX: parseRosterNumber(merged.FLEX, DEFAULT_ROSTER_SETTINGS.FLEX, 0, 5),
            K: parseRosterNumber(merged.K, DEFAULT_ROSTER_SETTINGS.K, 0, 5),
            DEF: parseRosterNumber(merged.DEF, DEFAULT_ROSTER_SETTINGS.DEF, 0, 5),
            BN: parseRosterNumber(merged.BN, DEFAULT_ROSTER_SETTINGS.BN, 0, 20)
        };
        const total = normalized.QB + normalized.WR + normalized.RB + normalized.TE + normalized.FLEX + normalized.K + normalized.DEF + normalized.BN;
        if (total < 8) {
            normalized.BN += (8 - total);
        }
        return normalized;
    }

    function applyRosterSettings(raw) {
        rosterSettings = normalizeRosterSettings(raw);

        const flexAndBench = rosterSettings.FLEX + rosterSettings.BN;
        rosterSize = rosterSettings.QB + rosterSettings.WR + rosterSettings.RB + rosterSettings.TE + rosterSettings.FLEX + rosterSettings.K + rosterSettings.DEF + rosterSettings.BN;

        rosterLimits = {
            QB: { min: rosterSettings.QB, max: rosterSettings.QB + rosterSettings.BN },
            RB: { min: rosterSettings.RB, max: rosterSettings.RB + flexAndBench },
            WR: { min: rosterSettings.WR, max: rosterSettings.WR + flexAndBench },
            TE: { min: rosterSettings.TE, max: rosterSettings.TE + flexAndBench },
            K: { min: rosterSettings.K, max: rosterSettings.K + rosterSettings.BN },
            DEF: { min: rosterSettings.DEF, max: rosterSettings.DEF + rosterSettings.BN }
        };

        roundPositionMinimums = {
            QB: rosterSettings.QB > 0 ? Math.max(1, rosterSettings.QB) : 0,
            RB: rosterSettings.RB > 0 ? Math.max(1, rosterSettings.RB) : 0,
            WR: rosterSettings.WR > 0 ? Math.max(1, rosterSettings.WR) : 0,
            TE: rosterSettings.TE > 0 ? Math.max(1, rosterSettings.TE) : 0,
            K: rosterSettings.K > 0 ? Math.max(1, rosterSettings.K) : 0,
            DEF: rosterSettings.DEF > 0 ? Math.max(1, rosterSettings.DEF) : 0
        };
    }

    function normalizeBenchCutTarget(value) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return DEFAULT_BENCH_CUT_TARGET;
        return Math.max(0, Math.min(parsed, MAX_DRAFT_BENCH));
    }

    function normalizeRoundTimerMinutes(value) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return DEFAULT_ROUND_TIMER_MINUTES;
        return Math.max(3, Math.min(parsed, 10));
    }

    function applyRoundTimerMinutes(value) {
        const minutes = normalizeRoundTimerMinutes(value);
        console.log('[silentdraft] applyRoundTimerMinutes called with:', value, 'resolved minutes:', minutes, 'timerIntervalActive:', !!timerInterval);
        roundDuration = minutes * 60;

        const timerElement = document.getElementById('timer');
        if (timerElement && !timerInterval) {
            timerElement.textContent = `${minutes}:00`;
        }

        return minutes;
    }

    function getFlexRequirementCount() {
        return rosterSettings.FLEX || 0;
    }

    // Clean up old drafts from localStorage to prevent quota issues
    function cleanupOldDrafts(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        try {
            const draftsData = localStorage.getItem('drafts');
            if (!draftsData) return;
            
            const drafts = JSON.parse(draftsData);
            const now = Date.now();
            let cleaned = false;
            
            Object.keys(drafts).forEach(draftCode => {
                const draft = drafts[draftCode];
                if (draft.timestamp && (now - draft.timestamp) > maxAgeMs) {
                    delete drafts[draftCode];
                    cleaned = true;
                    console.log(`[silentdraft] Cleaned old draft: ${draftCode}`);
                }
            });
            
            if (cleaned) {
                localStorage.setItem('drafts', JSON.stringify(drafts));
            }
        } catch (e) {
            console.warn('[silentdraft] Failed to cleanup old drafts:', e);
        }
    }

    // Keep only the most recent N drafts
    function limitStoredDrafts(maxDrafts = 25) {
        try {
            const draftsData = localStorage.getItem('drafts');
            if (!draftsData) return;
            
            const drafts = JSON.parse(draftsData);
            const sorted = Object.entries(drafts)
                .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
                .slice(0, maxDrafts);
            
            if (sorted.length < Object.keys(drafts).length) {
                const limited = Object.fromEntries(sorted);
                localStorage.setItem('drafts', JSON.stringify(limited));
                console.log(`[silentdraft] Limited stored drafts to ${maxDrafts}`);
            }
        } catch (e) {
            console.warn('[silentdraft] Failed to limit drafts:', e);
        }
    }

    // Estimate localStorage usage percentage (0-100)
    function estimateStorageUsage() {
        try {
            let totalSize = 0;
            for (const key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }
            // Rough estimate: 5-10MB limit per domain, use 5MB as baseline
            const estimatedLimit = 5 * 1024 * 1024;
            const percentageUsed = Math.round((totalSize / estimatedLimit) * 100);
            console.log(`[silentdraft] Storage usage: ~${percentageUsed}% (${Math.round(totalSize / 1024)}KB)`);
            return percentageUsed;
        } catch (e) {
            console.warn('[silentdraft] Failed to estimate storage:', e);
            return 0;
        }
    }

    // Aggressively clear oldest drafts when storage is critically low
    function emergencyClearOldestDrafts(targetCount = 2) {
        try {
            const draftsData = localStorage.getItem('drafts');
            if (!draftsData) return;
            
            const drafts = JSON.parse(draftsData);
            const entries = Object.entries(drafts)
                .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0)); // Oldest first
            
            // Keep only targetCount most recent drafts
            const kept = entries.slice(-targetCount);
            const cleaned = Object.fromEntries(kept);
            const removed = entries.length - kept.length;
            
            if (removed > 0) {
                localStorage.setItem('drafts', JSON.stringify(cleaned));
                console.log(`[silentdraft] Emergency cleanup: removed ${removed} drafts to free space`);
            }
        } catch (e) {
            console.warn('[silentdraft] Emergency cleanup failed:', e);
        }
    }

    // Wrapper for localStorage.setItem with quota exceeded handling
    function safeSetLocalStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[silentdraft] Storage quota exceeded, triggering cleanup');
                // Clear oldest drafts to make room
                emergencyClearOldestDrafts(2);
                // Try again
                try {
                    localStorage.setItem(key, value);
                    console.log('[silentdraft] After cleanup, storage operation succeeded');
                } catch (retryError) {
                    console.error('[silentdraft] Storage still full after cleanup:', retryError);
                }
            } else {
                console.error('[silentdraft] Unexpected localStorage error:', e);
            }
        }
    }

    applyRosterSettings(DEFAULT_ROSTER_SETTINGS);
    setupDraftAudioUnlock();
    setDraftScreenAwakeEnabled(true);

    function validateRoster(team) {
        const positionCounts = team.roster.reduce((counts, p) => {
            counts[p.position] = (counts[p.position] || 0) + 1;
            return counts;
        }, {});
        const flexEligibleCount = (positionCounts.RB || 0) + (positionCounts.WR || 0) + (positionCounts.TE || 0);
        return (
            (positionCounts.QB || 0) >= rosterLimits.QB.min &&
            (positionCounts.RB || 0) >= rosterLimits.RB.min &&
            (positionCounts.WR || 0) >= rosterLimits.WR.min &&
            (positionCounts.TE || 0) >= rosterLimits.TE.min &&
            (positionCounts.K || 0) >= rosterLimits.K.min &&
            (positionCounts.DEF || 0) >= rosterLimits.DEF.min &&
            flexEligibleCount >= (rosterLimits.RB.min + rosterLimits.WR.min + rosterLimits.TE.min + getFlexRequirementCount()) &&
            team.roster.length === rosterSize
        );
    }

    function parseDraftCodeFromPathname() {
        const pathname = String((window.location && window.location.pathname) || '').trim();
        if (!pathname) return '';
        const match = pathname.match(/^\/(silentdraft(?:\.html)?|rounds3draft(?:\.html)?)\/([A-Za-z0-9_-]+)\/?$/i);
        if (!match) return '';
        const normalized = String(match[2] || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        return normalized || '';
    }

    // Get username and draft data from session
    const username = sessionStorage.getItem('username') || 'Your Team';
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const pathDraftCode = parseDraftCodeFromPathname();
    const sessionDraftCode = String(sessionStorage.getItem('currentDraft') || '').trim();
    const currentDraftCode = (pathDraftCode || sessionDraftCode || '').toUpperCase();

    if (currentDraftCode && currentDraftCode !== sessionDraftCode) {
        try {
            sessionStorage.setItem('currentDraft', currentDraftCode);
        } catch (_error) {
            // ignore session storage write errors
        }
    }

    function isCurrentUserTeamName(teamName) {
        return String(teamName || '').trim().toLowerCase() === normalizedUsername;
    }
    
    // Global teams array
    let teams = [];
    let autoDraftStatusByTeam = {};
    let teamProfiles = {}; // Store profile types for each team (CPU or user)
    
    // Get lobby members from server for synchronized state
    let lobbyMembers = [];
    let allDraftMembers = []; // Full member list to determine host
    let draftHostName = null;
    
    // Global players array loaded from JSON files
    let players = [];
    let draftRoomDefaultRankings = [];
    let draftRoomDefaultRankingsLastLoadedAt = 0;
    const DRAFTROOM_DEFAULT_RANKINGS_API_URL = '/api/public/rankings/default';
    const DRAFTROOM_POSITION_FILES = {
        QB: 'qb',
        RB: 'rb',
        WR: 'wr',
        TE: 'te',
        K: 'k',
        DEF: 'def'
    };
    const DRAFTROOM_POSITION_RANK_FIELDS = {
        QB: 'qbRank',
        RB: 'RBrank',
        WR: 'WRrank',
        TE: 'TErank',
        K: 'Krank',
        DEF: 'DEFrank'
    };
    let draftRoomDefaultPositionRankings = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
        K: [],
        DEF: []
    };
    let draftRoomDefaultPositionRankingsLastLoadedAt = {
        QB: 0,
        RB: 0,
        WR: 0,
        TE: 0,
        K: 0,
        DEF: 0
    };
    let draftRoomRankingsMode = 'default';
    let draftRoomRightViewMode = 'budgets';
    let draftAppSectionViewMode = 'players';
    let draftAppSectionNavEnabled = false;
    let draftRoomRankingsPosition = 'ALL';
    let draftRoomRankingsRefreshInFlight = null;
    let draftChatMessages = [];
    const DRAFT_CHAT_MAX_LENGTH = 600;
    const DRAFT_CHAT_MAX_MESSAGES = 200;
    let draftChatUnreadCount = 0;

    function mapDefaultRankingsToDraftPlayers(defaultRankings = []) {
        const perPositionRankCounter = {};
        const validPositions = new Set(Object.keys(DRAFTROOM_POSITION_FILES));

        const normalized = (Array.isArray(defaultRankings) ? defaultRankings : [])
            .map((player, index) => {
                const name = String(player && player.name || '').trim();
                const position = String(player && player.position || '').trim().toUpperCase();
                if (!name || !validPositions.has(position)) return null;

                perPositionRankCounter[position] = (perPositionRankCounter[position] || 0) + 1;
                const fallbackPositionRank = perPositionRankCounter[position];
                const prerank = Number.isFinite(player && player.prerank)
                    ? Number(player.prerank)
                    : (Number.parseInt(player && player.prerank, 10) || (index + 1));
                const team = String(player && player.team || '').trim().toUpperCase();

                return {
                    id: index + 1,
                    name,
                    position,
                    team,
                    prerank,
                    avgValue: Number(player && (player.avgValue || player.value) || 0),
                    draftChance: Number(player && (player.draftChance ?? player.draftPercent ?? player.draftedPercent ?? player.draftedPercentage) || 0),
                    owner: null,
                    shown: false,
                    byeWeek: extractPlayerByeWeek(player) ?? (BYE_WEEK_BY_TEAM[normalizeTeamAbbreviation(team)] || null),
                    positionRank: parseDraftRoomPositionRank(position, {
                        ...player,
                        rank: fallbackPositionRank,
                        positionRank: fallbackPositionRank
                    }, fallbackPositionRank)
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                const rankA = Number.isFinite(a && a.prerank) ? a.prerank : 9999;
                const rankB = Number.isFinite(b && b.prerank) ? b.prerank : 9999;
                if (rankA !== rankB) return rankA - rankB;
                return String(a && a.name || '').localeCompare(String(b && b.name || ''));
            });

        return normalized.map((player, idx) => ({ ...player, id: idx + 1, prerank: idx + 1 }));
    }
    
    // Load players from the same source used by Admin Default Rankings Manager.
    async function loadPlayers() {
        try {
            const defaults = await loadDraftRoomDefaultRankings(true);
            const fromDefaults = mapDefaultRankingsToDraftPlayers(defaults);
            if (fromDefaults.length > 0) {
                players = fromDefaults;
                console.log(`[silentdraft] Loaded ${players.length} players from Admin default rankings source`);
                return players;
            }
        } catch (error) {
            console.warn('[silentdraft] Failed to build players from Admin default rankings source:', error);
        }

        // Fallback to position files if API/default source is unavailable.
        const positions = ['qb', 'rb', 'wr', 'te', 'k', 'def'];
        const loadedPlayers = [];
        
        for (const pos of positions) {
            try {
                const response = await fetch(`/${pos}.json`, { cache: 'no-store' });
                if (response.ok) {
                    const positionPlayers = await response.json();
                    
                    // Add position and id to each player
                    positionPlayers.forEach((player, index) => {
                        player.position = player.position || pos.toUpperCase();
                        player.id = loadedPlayers.length + index + 1; // Unique ID
                        player.owner = null; // Initially no owner
                        player.team = String(player.team || '').trim().toUpperCase();
                        player.byeWeek = extractPlayerByeWeek(player) ?? (BYE_WEEK_BY_TEAM[normalizeTeamAbbreviation(player.team)] || null);
                        
                        // Set position-specific rank using the same field mapping as the draft room.
                        player.positionRank = parseDraftRoomPositionRank(player.position, player, 999);
                    });
                    loadedPlayers.push(...positionPlayers);
                } else {
                    console.warn(`Failed to load ${pos}.json: ${response.status}`);
                }
            } catch (error) {
                console.error(`Error loading ${pos}.json:`, error);
            }
        }
        
        players = loadedPlayers;
        console.log(`[silentdraft] Loaded ${players.length} players from position JSON fallback`);
        return players;
    }

    async function loadDraftRoomDefaultRankings(forceRefresh = false) {
        const applyDefaultRankingsPayload = (data) => {
            if (!Array.isArray(data)) return false;

            draftRoomDefaultRankings = data
                .map((player, index) => ({
                    name: String(player && player.name || '').trim(),
                    position: String(player && player.position || 'UNK').trim().toUpperCase(),
                    team: String(player && player.team || '—').trim().toUpperCase() || '—',
                    avgValue: Number(player && (player.avgValue || player.value) || 0),
                    prerank: Number.isFinite(player && player.prerank)
                        ? player.prerank
                        : (Number.parseInt(player && player.prerank, 10) || (index + 1))
                }))
                .filter((player) => player.name)
                .sort((a, b) => a.prerank - b.prerank);

            draftRoomDefaultRankingsLastLoadedAt = Date.now();
            return true;
        };

        try {
            const response = await fetch(DRAFTROOM_DEFAULT_RANKINGS_API_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const payload = await response.json();
            const data = Array.isArray(payload)
                ? payload
                : (Array.isArray(payload && payload.players) ? payload.players : []);

            if (applyDefaultRankingsPayload(data)) {
                console.log(`[silentdraft] Loaded ${draftRoomDefaultRankings.length} default rankings from API`);
                return draftRoomDefaultRankings;
            }
        } catch (error) {
            console.warn('[silentdraft] Failed to load default rankings from API:', error);
        }

        return draftRoomDefaultRankings;
    }

    function parseDraftRoomPositionRank(position, player, fallbackRank) {
        const rankField = DRAFTROOM_POSITION_RANK_FIELDS[position];
        const rawRank = rankField ? player && player[rankField] : undefined;
        const cleaned = String(rawRank || '').replace(/[^0-9.-]/g, '');
        const parsed = Number.parseInt(cleaned, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;

        const genericRank = Number.parseInt(String(player && player.rank || '').replace(/[^0-9.-]/g, ''), 10);
        if (Number.isFinite(genericRank) && genericRank > 0) return genericRank;

        return fallbackRank;
    }

    async function loadDraftRoomPositionRankings(position, forceRefresh = false) {
        const pos = String(position || '').trim().toUpperCase();
        if (!Object.prototype.hasOwnProperty.call(DRAFTROOM_POSITION_FILES, pos)) return [];

        const now = Date.now();
        const staleMs = 15000;
        const lastLoadedAt = Number(draftRoomDefaultPositionRankingsLastLoadedAt[pos] || 0);
        const current = Array.isArray(draftRoomDefaultPositionRankings[pos]) ? draftRoomDefaultPositionRankings[pos] : [];
        if (!forceRefresh && current.length > 0 && (now - lastLoadedAt) < staleMs) {
            return current;
        }

        const sourcePlayers = (Array.isArray(players) && players.length > 0)
            ? players
            : mapDefaultRankingsToDraftPlayers(await loadDraftRoomDefaultRankings(forceRefresh));
        const normalized = (Array.isArray(sourcePlayers) ? sourcePlayers : [])
            .filter(player => String(player && player.position || '').trim().toUpperCase() === pos)
            .map((player, index) => ({
                name: String(player && player.name || '').trim(),
                position: pos,
                team: String(player && player.team || '—').trim().toUpperCase() || '—',
                avgValue: Number(player && (player.avgValue || player.value) || 0),
                prerank: Number.isFinite(player && player.positionRank)
                    ? Number(player.positionRank)
                    : (Number.isFinite(player && player.prerank)
                        ? Number(player.prerank)
                        : (Number.parseInt(player && player.prerank, 10) || (index + 1)))
            }))
            .filter(player => player.name)
            .sort((a, b) => a.prerank - b.prerank);

        draftRoomDefaultPositionRankings[pos] = normalized;
        draftRoomDefaultPositionRankingsLastLoadedAt[pos] = Date.now();
        return normalized;
    }

    async function loadAllDraftRoomPositionRankings(forceRefresh = false) {
        const positions = Object.keys(DRAFTROOM_POSITION_FILES);
        await Promise.all(positions.map((pos) => loadDraftRoomPositionRankings(pos, forceRefresh)));
    }
    
    // Build a dedicated DATABASE rankings set without mutating Default rankings.
    // This set is only updated when there are enough completed drafts.
    function calculatePlayerAVsFromCompletedDrafts() {
        try {
            const completedDraftsRaw = localStorage.getItem('completedDrafts');
            if (!completedDraftsRaw) {
                console.log('[DATABASE] No completed drafts found yet');
                return null;
            }

            const completedDrafts = JSON.parse(completedDraftsRaw);
            if (!Array.isArray(completedDrafts) || completedDrafts.length === 0) {
                console.log('[DATABASE] No completed drafts available');
                return null;
            }

            const completedDraftCount = completedDrafts.length;
            const MIN_DRAFTS = 30;
            if (completedDraftCount < MIN_DRAFTS) {
                console.log(`[DATABASE] Not enough data yet: ${completedDraftCount}/${MIN_DRAFTS} drafts`);
                return null;
            }

            const playerStatsById = {};

            completedDrafts.forEach((draft) => {
                if (!draft || !Array.isArray(draft.teams)) return;

                const draftedInThisDraft = new Set();

                draft.teams.forEach((team) => {
                    if (!team || !Array.isArray(team.roster)) return;

                    team.roster.forEach((rosterPlayer) => {
                        const playerId = Number.parseInt(rosterPlayer && rosterPlayer.id, 10);
                        const bid = Number.parseInt(rosterPlayer && rosterPlayer.bid, 10);
                        if (!Number.isFinite(playerId) || playerId <= 0) return;
                        if (!Number.isFinite(bid) || bid <= 0) return;

                        if (!playerStatsById[playerId]) {
                            playerStatsById[playerId] = {
                                playerId,
                                name: rosterPlayer.name || '',
                                position: rosterPlayer.position || 'UNK',
                                totalValue: 0,
                                auctionCount: 0,
                                draftedCount: 0,
                                minBid: bid,
                                maxBid: bid
                            };
                        }

                        const stats = playerStatsById[playerId];
                        stats.totalValue += bid;
                        stats.auctionCount += 1;
                        stats.minBid = Math.min(stats.minBid, bid);
                        stats.maxBid = Math.max(stats.maxBid, bid);

                        if (!draftedInThisDraft.has(playerId)) {
                            stats.draftedCount += 1;
                            draftedInThisDraft.add(playerId);
                        }
                    });
                });
            });

            const rankingsSet = Object.values(playerStatsById).map((stats) => {
                const avgValue = stats.auctionCount > 0 ? Math.round(stats.totalValue / stats.auctionCount) : 0;
                const draftPct = completedDraftCount > 0
                    ? Number(((stats.draftedCount / completedDraftCount) * 100).toFixed(1))
                    : 0;

                return {
                    playerId: stats.playerId,
                    name: stats.name,
                    position: stats.position,
                    avgValue,
                    auctionCount: stats.auctionCount,
                    draftedCount: stats.draftedCount,
                    draftPct,
                    minBid: stats.minBid,
                    maxBid: stats.maxBid,
                    updatedBy: 'DATABASE',
                    updatedAt: Date.now()
                };
            }).sort((a, b) => {
                if (b.avgValue !== a.avgValue) return b.avgValue - a.avgValue;
                return String(a.name || '').localeCompare(String(b.name || ''));
            });

            return {
                minDraftsRequired: MIN_DRAFTS,
                completedDraftCount,
                generatedAt: Date.now(),
                rankings: rankingsSet
            };
        } catch (e) {
            console.error('[DATABASE] Failed to calculate DATABASE rankings set:', e);
            return null;
        }
    }

    function syncPlayerAVsWithRankings() {
        try {
            const rankingsPayload = calculatePlayerAVsFromCompletedDrafts();
            if (!rankingsPayload || !Array.isArray(rankingsPayload.rankings) || rankingsPayload.rankings.length === 0) {
                console.log('[DATABASE] No DATABASE rankings updates available yet');
                return 0;
            }

            localStorage.setItem(DATABASE_RANKINGS_SET_KEY, JSON.stringify(rankingsPayload));
            console.log(`[DATABASE] Updated rankings set with ${rankingsPayload.rankings.length} players from ${rankingsPayload.completedDraftCount} drafts`);
            return rankingsPayload.rankings.length;
        } catch (e) {
            console.error('[DATABASE] Failed to sync DATABASE rankings set:', e);
            return 0;
        }
    }
    
    // Connect to server to get authoritative draft state
    function initializeDraft() {
        startDraftTabTitleTicker();
        // Clean up old/excess drafts before accessing localStorage
        cleanupOldDrafts();
        limitStoredDrafts(25);
        
        // Check storage usage and aggressively clear if near capacity
        const usagePercent = estimateStorageUsage();
        if (usagePercent > 70) {
            console.log(`[silentdraft] Storage at ${usagePercent}% - triggering emergency cleanup`);
            emergencyClearOldestDrafts(2);
        }
        
        // Sync player AV values from completed drafts (DATABASE mode)
        // Requires at least 30 completed drafts to make updates
        syncPlayerAVsWithRankings();
        
        if (currentDraftCode && window.io) {
            const socket = io({ reconnection: false });
            socket.emit('getDraftState', currentDraftCode, (response) => {
                if (response && response.ok && response.draft && response.draft.members) {
                    draftHostName = response.draft.host || response.draft.members[0] || null;
                    console.log('[silentdraft] Loaded draft state from server:', response.draft.members);
                    console.log('[silentdraft] Resolved draft host:', draftHostName);
                    // Use server's member list as the source of truth
                    allDraftMembers = response.draft.members; // Keep full list for host check
                    lobbyMembers = response.draft.members.filter(member => member !== username);
                    // Resolve roster settings: prefer server value, fall back to localStorage
                    let resolvedRosterSettings = response.draft.rosterSettings;
                    let resolvedBenchCutTarget = response.draft.benchCutTarget;
                    let resolvedRoundTimerMinutes = response.draft.roundTimerMinutes;
                    let resolvedAjDraftMode = response.draft.ajDraftMode;
                    let resolvedAjRoundOrder = response.draft.ajRoundOrder;
                    try {
                        const localRaw = localStorage.getItem('drafts');
                        const localDrafts = localRaw ? JSON.parse(localRaw) : {};
                        const localDraft = localDrafts[currentDraftCode] || {};
                        if (!resolvedRosterSettings && localDraft.rosterSettings) {
                            resolvedRosterSettings = localDraft.rosterSettings;
                            console.log('[silentdraft] Using rosterSettings from localStorage (server had none)');
                        }
                        if (typeof resolvedBenchCutTarget === 'undefined' && typeof localDraft.benchCutTarget !== 'undefined') {
                            resolvedBenchCutTarget = localDraft.benchCutTarget;
                        }
                        if (typeof resolvedRoundTimerMinutes === 'undefined' && typeof localDraft.roundTimerMinutes !== 'undefined') {
                            resolvedRoundTimerMinutes = localDraft.roundTimerMinutes;
                        }
                        if (typeof resolvedAjDraftMode === 'undefined' && typeof localDraft.ajDraftMode !== 'undefined') {
                            resolvedAjDraftMode = localDraft.ajDraftMode;
                        }
                        if (typeof resolvedAjRoundOrder === 'undefined' && typeof localDraft.ajRoundOrder !== 'undefined') {
                            resolvedAjRoundOrder = localDraft.ajRoundOrder;
                        }
                    } catch (e) { /* ignore */ }

                    // Persist resolved values back to localStorage and update server if needed
                    try {
                        const draftsData = localStorage.getItem('drafts') || '{}';
                        const drafts = JSON.parse(draftsData);
                        if (!drafts[currentDraftCode]) drafts[currentDraftCode] = {};
                        if (response.draft.capacity) drafts[currentDraftCode].capacity = response.draft.capacity;
                        drafts[currentDraftCode].rosterSettings = normalizeRosterSettings(resolvedRosterSettings);
                        drafts[currentDraftCode].benchCutTarget = normalizeBenchCutTarget(resolvedBenchCutTarget);
                        drafts[currentDraftCode].roundTimerMinutes = normalizeRoundTimerMinutes(resolvedRoundTimerMinutes);
                        drafts[currentDraftCode].ajDraftMode = Boolean(resolvedAjDraftMode);
                        drafts[currentDraftCode].ajRoundOrder = normalizeAjRoundOrder(resolvedAjRoundOrder);
                        drafts[currentDraftCode].timestamp = Date.now(); // Add timestamp for cleanup tracking
                        safeSetLocalStorage('drafts', JSON.stringify(drafts));
                    } catch (e) { /* ignore */ }

                    benchCutTarget = normalizeBenchCutTarget(resolvedBenchCutTarget);
                    ajDraftModeEnabled = Boolean(resolvedAjDraftMode);
                    ajRoundOrder = normalizeAjRoundOrder(resolvedAjRoundOrder);
                    applyRoundTimerMinutes(resolvedRoundTimerMinutes);
                    applyRosterSettings(resolvedRosterSettings);
                    updatePauseButtonVisibility();
                    buildTeamsAndStartDraft();
                } else {
                    console.warn('[silentdraft] Failed to load from server, falling back to localStorage');
                    loadFromLocalStorage();
                    updatePauseButtonVisibility();
                    buildTeamsAndStartDraft();
                }

                try {
                    socket.disconnect();
                } catch (disconnectError) {
                    console.warn('[silentdraft] Failed to close initialization socket:', disconnectError);
                }
            });
        } else {
            console.warn('[silentdraft] No draft code or socket.io, using localStorage');
            loadFromLocalStorage();
            updatePauseButtonVisibility();
            buildTeamsAndStartDraft();
        }
    }
    
    function loadFromLocalStorage() {
        if (currentDraftCode) {
            const draftsData = localStorage.getItem('drafts');
            if (draftsData) {
                const drafts = JSON.parse(draftsData);
                const currentDraft = drafts[currentDraftCode];
                if (currentDraft && currentDraft.members) {
                    lobbyMembers = currentDraft.members.filter(member => member !== username);
                }
                if (currentDraft) {
                    benchCutTarget = normalizeBenchCutTarget(currentDraft.benchCutTarget);
                    ajDraftModeEnabled = Boolean(currentDraft.ajDraftMode);
                    ajRoundOrder = normalizeAjRoundOrder(currentDraft.ajRoundOrder);
                }
                applyRoundTimerMinutes(currentDraft && currentDraft.roundTimerMinutes);
                applyRoundTimerMinutes(currentDraft && currentDraft.roundTimerMinutes);
                applyRosterSettings(currentDraft && currentDraft.rosterSettings);
            }
        }
    }
    
    function buildTeamsAndStartDraft() {
        console.log('[silentdraft] Building teams with members:', lobbyMembers);

        // Get capacity from draft data
        let capacity = 10; // default
        let customBudgets = {};
        if (currentDraftCode) {
            const draftsData = localStorage.getItem('drafts');
            if (draftsData) {
                const drafts = JSON.parse(draftsData);
                const currentDraft = drafts[currentDraftCode];
                if (currentDraft && currentDraft.capacity) {
                    capacity = currentDraft.capacity;
                }
                if (currentDraft) {
                    benchCutTarget = normalizeBenchCutTarget(currentDraft.benchCutTarget);
                }
                if (currentDraft && currentDraft.customBudgets && typeof currentDraft.customBudgets === 'object') {
                    customBudgets = currentDraft.customBudgets;
                }
            }
        }

    const getStartingBudget = (teamName) => {
        const parsed = Number.parseInt(customBudgets[teamName], 10);
        if (Number.isNaN(parsed)) return 200;
        return Math.max(0, Math.min(parsed, 9999));
    };

    // Build teams array first - user's team plus lobby members, then fill with generic teams if needed
    teams = []; // Reset teams array
    teams.push({ name: username, budget: getStartingBudget(username), roster: [] });
    
    // Add lobby members
    lobbyMembers.forEach(member => {
        teams.push({ name: member, budget: getStartingBudget(member), roster: [] });
    });
    
    // Fill remaining slots with generic team names up to capacity total
    for (let i = teams.length + 1; i <= capacity; i++) {
        teams.push({ name: `Team ${i}`, budget: 200, roster: [] });
    }

    // Assign CPU profiles to teams now that they're created
    const profileNames = ['Balanced', 'Value Hunter', 'Sleeper Hunter', 'Stars & Scrubs', 'Conservative'];
    
    // Identify CPU teams (teams that aren't the current user or lobby members)
    const cpuTeamsList = teams.filter(team => 
        !team.name.toLowerCase().includes(username.toLowerCase()) && 
        !lobbyMembers.some(m => m.toLowerCase() === team.name.toLowerCase())
    );
    
    // Assign profiles to CPU teams
    if (cpuTeamsList.length > 0) {
        console.log('%c[SILENT DRAFT CPU TEAMS]', 'background: #9C27B0; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;', `CPU Teams in Draft:`);
        cpuTeamsList.forEach((team, index) => {
            const profileIndex = index % profileNames.length;
            const profile = profileNames[profileIndex];
            teamProfiles[team.name] = profile; // Store profile for draft summary
            console.log(`  • ${team.name}: ${profile} approach`);
        });
    }
    
    // Assign profiles to auto-draft teams (human players using auto-draft)
    const autoDraftTeamsList = [];
    Object.keys(autoDraftStatusByTeam).forEach(teamName => {
        if (autoDraftStatusByTeam[teamName]) {
            const teamSeed = String(teamName || '').split('').reduce((seed, char) => seed + char.charCodeAt(0), 0);
            const profileIndex = teamSeed % profileNames.length;
            const cpuProfile = profileNames[profileIndex];
            teamProfiles[teamName] = `Auto Draft (${cpuProfile})`;
            autoDraftTeamsList.push({ name: teamName, profile: cpuProfile });
        }
    });
    
    // Log auto-draft teams if any
    if (autoDraftTeamsList.length > 0) {
        console.log('%c[AUTO DRAFT TEAMS]', 'background: #FF6F00; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;', `Human Teams Using Auto Draft:`);
        autoDraftTeamsList.forEach(team => {
            console.log(`  • ${team.name}: ${team.profile} approach (automated)`);
        });
    }
    
    console.log('[DEBUG] teamProfiles after teams built:', teamProfiles);

    function normalizeParticipantName(value) {
        return String(value || '').trim().toLowerCase();
    }

    function sameParticipantName(a, b) {
        return normalizeParticipantName(a) !== '' && normalizeParticipantName(a) === normalizeParticipantName(b);
    }

    // Make draft socket global for bid synchronization
    window.draftSocket = null;
    window.syncedRoundPlayers = null; // Store synced players from server
    window.currentRoundPlayers = null; // Track current round players for pagination
    // Determine if current user is the host using the server-provided host when available.
    window.isHost = Boolean((draftHostName && sameParticipantName(draftHostName, username)) || (!draftHostName && allDraftMembers.length > 0 && sameParticipantName(allDraftMembers[0], username)));
    updatePauseButtonVisibility();
    const hasPersonalRankings = hasDraftRoomPersonalRankings();
    draftRoomRankingsMode = hasPersonalRankings ? 'personal' : 'default';
    draftRoomRightViewMode = 'budgets';

    try {
        const savedRankingsMode = localStorage.getItem(DRAFTROOM_RANKINGS_MODE_KEY);
        if (savedRankingsMode === 'default' || savedRankingsMode === 'personal' || savedRankingsMode === 'database') {
            draftRoomRankingsMode = savedRankingsMode;
        } else {
            localStorage.setItem(DRAFTROOM_RANKINGS_MODE_KEY, draftRoomRankingsMode);
        }
    } catch (e) {
        draftRoomRankingsMode = hasPersonalRankings ? 'personal' : 'default';
    }

    try {
        const savedRightView = localStorage.getItem(DRAFTROOM_RIGHT_VIEW_KEY);
        if (savedRightView === 'rankings' || savedRightView === 'budgets' || savedRightView === 'chat') {
            draftRoomRightViewMode = savedRightView;
        }
    } catch (e) {
        draftRoomRightViewMode = 'budgets';
    }

    try {
        const savedSection = localStorage.getItem(DRAFT_APP_SECTION_VIEW_KEY);
        if (savedSection === 'players' || savedSection === 'roster' || savedSection === 'budgets' || savedSection === 'rankings' || savedSection === 'chat') {
            draftAppSectionViewMode = savedSection;
        }
    } catch (e) {
        draftAppSectionViewMode = 'players';
    }
    
    console.log('[silentdraft] All draft members:', allDraftMembers);
    console.log('[silentdraft] Draft host name:', draftHostName);
    console.log('[silentdraft] Current user:', username);
    console.log('[silentdraft] Is host:', window.isHost);
    setupRightViewTabs();
    applyRightViewMode();
    setupDraftAppSectionNav();
    setupDraftRoomRankingsTabs();
    setupDraftRoomRankingsPositionTabs();
    renderDraftRoomRankings();
    setupDraftChat();
    renderDraftChatMessages();

    function updateSocketConnectionIndicator(isConnected, detailText, quality = 'good') {
        const indicatorId = 'socket-connection-indicator';
        let indicator = document.getElementById(indicatorId);
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = indicatorId;

            // Place indicator in header if available, fallback to body
            const header = document.querySelector('.header-bar');
            const targetContainer = header ? (header.querySelector('.draft-controls') || header) : document.body;

            indicator.style.display = 'inline-block';
            indicator.style.width = '10px';
            indicator.style.height = '10px';
            indicator.style.borderRadius = '999px';
            indicator.style.border = '1px solid rgba(255,255,255,0.45)';
            indicator.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.12)';
            indicator.style.marginLeft = '10px';
            indicator.style.cursor = 'default';
            indicator.style.flexShrink = '0';

            indicator.setAttribute('role', 'status');
            indicator.setAttribute('aria-live', 'polite');

            targetContainer.appendChild(indicator);
        }

        if (isConnected) {
            draftTabConnectionDot = DRAFT_TAB_CONNECTED_DOT;
            const qualityKey = String(quality || 'good').trim().toLowerCase();
            let fillColor = '#22c55e';
            let glowColor = 'rgba(34,197,94,0.55)';
            let qualityLabel = 'Good';

            if (qualityKey === 'excellent') {
                fillColor = '#16a34a';
                glowColor = 'rgba(22,163,74,0.62)';
                qualityLabel = 'Excellent';
            } else if (qualityKey === 'weak') {
                fillColor = '#f59e0b';
                glowColor = 'rgba(245,158,11,0.58)';
                qualityLabel = 'Weak';
            }

            indicator.textContent = '';
            indicator.style.background = fillColor;
            indicator.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.12), 0 0 8px ${glowColor}`;
            const statusText = detailText || `Socket connected (${qualityLabel})`;
            indicator.setAttribute('aria-label', statusText);
            indicator.title = statusText;
        } else {
            draftTabConnectionDot = DRAFT_TAB_DISCONNECTED_DOT;
            const statusText = detailText || 'Socket disconnected - reconnecting';
            indicator.textContent = '';
            const reconnecting = /reconnect/i.test(statusText);
            indicator.style.background = reconnecting ? '#f59e0b' : '#ef4444';
            indicator.style.boxShadow = reconnecting
                ? '0 0 0 1px rgba(0,0,0,0.12), 0 0 8px rgba(245,158,11,0.55)'
                : '0 0 0 1px rgba(0,0,0,0.12), 0 0 8px rgba(239,68,68,0.55)';
            indicator.setAttribute('aria-label', statusText);
            indicator.title = statusText;
        }

        updateDraftTabTitle(false);
    }
    
    if (window.io && currentDraftCode) {
        window.draftSocket = io({
            reconnection: true,
            reconnectionAttempts: Infinity,
            randomizationFactor: 0.5,
            reconnectionDelay: 500,
            reconnectionDelayMax: 8000,
            timeout: 30000,
            upgrade: true,
            rememberUpgrade: true,
            transports: ['websocket', 'polling']
        });

        const syncDraftSocketRooms = () => {
            try {
                // Lobby-level room used by draft metadata updates.
                window.draftSocket.emit('joinDraftRoom', currentDraftCode, username);
                // Active draft room used by bidding/round live events.
                window.draftSocket.emit('joinActiveDraft', currentDraftCode, username);
                console.log('[silentdraft] Joined draft socket rooms:', currentDraftCode, username);
            } catch (error) {
                console.warn('[silentdraft] Failed to sync draft socket rooms:', error);
            }
        };

        const requestFreshDraftState = () => {
            if (!(window.draftSocket && currentDraftCode)) return;
            window.draftSocket.emit('getDraftState', currentDraftCode, (response) => {
                if (response && response.ok && response.draft) {
                    const draft = response.draft;
                    draftHostName = draft.host || (Array.isArray(draft.members) ? draft.members[0] : draftHostName);
                    allDraftMembers = Array.isArray(draft.members) ? draft.members.slice() : allDraftMembers;
                    lobbyMembers = Array.isArray(allDraftMembers)
                        ? allDraftMembers.filter(member => !sameParticipantName(member, username))
                        : lobbyMembers;

                    const hostFromState = Boolean((draftHostName && sameParticipantName(draftHostName, username)) || (!draftHostName && allDraftMembers.length > 0 && sameParticipantName(allDraftMembers[0], username)));
                    if (window.isHost !== hostFromState) {
                        window.isHost = hostFromState;
                        updatePauseButtonVisibility();
                        console.log('[silentdraft] Host role updated from fresh state:', window.isHost);
                    }

                    const draftState = draft.draftState || {};
                    const currentPlayers = Array.isArray(draftState.currentPlayers)
                        ? draftState.currentPlayers
                        : (Array.isArray(draft.currentPlayers) ? draft.currentPlayers : []);

                    if (Number.isFinite(Number(draftState.currentRound)) && Number(draftState.currentRound) > 0) {
                        currentRound = Number(draftState.currentRound);
                    }

                    if (currentPlayers.length > 0) {
                        window.syncedRoundPlayers = currentPlayers;
                        if (!window.isHost) {
                            displayRoundPlayers(currentPlayers);
                        }
                        console.log('[silentdraft] Fresh state restored current round players:', currentPlayers.length);
                    } else {
                        console.log('[silentdraft] Fresh draft state requested after connect (no current players yet)');
                    }
                } else if (response) {
                    console.warn('[silentdraft] Fresh draft state request rejected:', response);
                }
            });
        };

        const resyncDraftConnection = () => {
            syncDraftSocketRooms();
            requestFreshDraftState();
        };

        let lastConnectionResyncAt = 0;
        let pendingConnectionResyncTimer = null;
        let connectionWatchdogTimer = null;
        let heartbeatTimer = null;
        let heartbeatInFlight = false;
        let missedHeartbeats = 0;
        let lastHeartbeatRttMs = null;

        const clearHeartbeatTimer = () => {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        };

        const getHeartbeatQuality = (rttMs) => {
            if (!Number.isFinite(rttMs)) return { key: 'good', label: 'Good' };
            if (rttMs <= 220) return { key: 'excellent', label: 'Excellent' };
            if (rttMs <= 700) return { key: 'good', label: 'Good' };
            return { key: 'weak', label: 'Weak' };
        };

        const sendHeartbeat = () => {
            if (!(window.draftSocket && window.draftSocket.connected)) return;
            if (heartbeatInFlight) return;

            heartbeatInFlight = true;
            const sentAt = Date.now();
            let settled = false;

            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                heartbeatInFlight = false;
                missedHeartbeats += 1;

                if (missedHeartbeats >= DRAFT_HEARTBEAT_MISS_THRESHOLD) {
                    updateSocketConnectionIndicator(false, 'Connection weak - reconnecting...');
                    scheduleConnectionResync('heartbeat-timeout', 0);
                }

                if (missedHeartbeats >= DRAFT_HEARTBEAT_HARD_RECOVER_THRESHOLD && window.draftSocket && !window.draftSocket.connected) {
                    scheduleConnectionResync('heartbeat-hard-recover', 0);
                }
            }, DRAFT_HEARTBEAT_ACK_TIMEOUT_MS);

            window.draftSocket.emit('hushHeartbeat', { clientTs: sentAt }, (response) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                heartbeatInFlight = false;

                if (!response || response.ok === false) {
                    missedHeartbeats += 1;
                    return;
                }

                missedHeartbeats = 0;
                lastHeartbeatRttMs = Math.max(0, Date.now() - sentAt);
                const quality = getHeartbeatQuality(lastHeartbeatRttMs);
                updateSocketConnectionIndicator(true, `Socket connected (${quality.label}, ${lastHeartbeatRttMs}ms)`, quality.key);
            });
        };

        const startHeartbeatMonitor = () => {
            clearHeartbeatTimer();
            sendHeartbeat();
            heartbeatTimer = setInterval(sendHeartbeat, DRAFT_HEARTBEAT_INTERVAL_MS);
        };

        const clearPendingConnectionResync = () => {
            if (pendingConnectionResyncTimer) {
                clearTimeout(pendingConnectionResyncTimer);
                pendingConnectionResyncTimer = null;
            }
        };

        const scheduleConnectionResync = (reason = 'unknown', delayMs = 0) => {
            clearPendingConnectionResync();

            pendingConnectionResyncTimer = setTimeout(() => {
                pendingConnectionResyncTimer = null;

                const now = Date.now();
                // Prevent reconnect storms when multiple foreground events fire together.
                if (now - lastConnectionResyncAt < 1200) {
                    return;
                }
                lastConnectionResyncAt = now;

                if (!(window.draftSocket && currentDraftCode)) {
                    return;
                }

                if (!window.draftSocket.connected) {
                    console.log('[silentdraft] Foreground recovery reconnect attempt:', reason);
                    try {
                        window.draftSocket.connect();
                    } catch (error) {
                        console.warn('[silentdraft] Socket connect() failed during recovery:', error);
                    }
                    return;
                }

                console.log('[silentdraft] Foreground recovery resync:', reason);
                resyncDraftConnection();

                // Best effort: push any local bid edits after returning to foreground.
                if (typeof syncCurrentRoundBidsToServer === 'function') {
                    syncCurrentRoundBidsToServer().catch(() => {});
                }
            }, Math.max(0, delayMs));
        };

        const onVisibilityChangeResync = () => {
            if (document.visibilityState === 'visible') {
                scheduleConnectionResync('visibility-visible', 120);
                updateDraftTabTitle(false);
                return;
            }

            // Keep transport warm while backgrounded so mobile and throttled tabs recover faster.
            if (window.draftSocket && !window.draftSocket.connected) {
                scheduleConnectionResync('visibility-hidden', 0);
            }
            updateDraftTabTitle(false);
        };

        const onPageshowResync = (event) => {
            // persisted=true indicates BFCache restore on iOS Safari; always resync.
            const fromCache = !!(event && event.persisted);
            scheduleConnectionResync(fromCache ? 'pageshow-bfcache' : 'pageshow', 80);
        };

        const onOnlineResync = () => {
            scheduleConnectionResync('network-online', 180);
        };

        const onFocusResync = () => {
            scheduleConnectionResync('window-focus', 80);
        };

        document.addEventListener('visibilitychange', onVisibilityChangeResync);
        window.addEventListener('pageshow', onPageshowResync);
        window.addEventListener('online', onOnlineResync);
        window.addEventListener('focus', onFocusResync);

        // Periodic guard while visible: if the socket dropped silently, reconnect.
        connectionWatchdogTimer = setInterval(() => {
            if (!(window.draftSocket && currentDraftCode)) return;
            if (!navigator.onLine) return;
            if (!window.draftSocket.connected) {
                const reason = document.visibilityState === 'visible'
                    ? 'watchdog-disconnected'
                    : 'watchdog-hidden-disconnected';
                scheduleConnectionResync(reason, 0);
            }
        }, DRAFT_SOCKET_WATCHDOG_INTERVAL_MS);

        console.log('[silentdraft] Connected to active draft room, isHost:', window.isHost);

        let reconnectNoticeShown = false;
        let liveAuctionRecoveryNeeded = false;
        updateSocketConnectionIndicator(true);

        window.draftSocket.on('connect', () => {
            resyncDraftConnection();
            missedHeartbeats = 0;
            updateSocketConnectionIndicator(true, 'Socket connected (Good)', 'good');
            startHeartbeatMonitor();
            if (reconnectNoticeShown) {
                showNotification('Connection restored. Draft is live again.');
                reconnectNoticeShown = false;
            }
            // Log CPU preset early on connect
            (async () => {
                try {
                    const response = await fetch('/api/public/cpu-logic-preset');
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.presetName) {
                            console.log('%c[SILENT DRAFT CPU LOGIC]', 'background: #2196F3; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;', `Using CPU tuning lab preset: "${data.presetName}"`);
                        }
                    }
                } catch (error) {
                    // Silently ignore if fetch fails
                }
            })();
        });

        window.draftSocket.on('disconnect', (reason) => {
            clearHeartbeatTimer();
            heartbeatInFlight = false;
            updateSocketConnectionIndicator(false, 'Socket disconnected - reconnecting');
            if (!reconnectNoticeShown) {
                showNotification('Connection lost. Attempting to reconnect...');
                reconnectNoticeShown = true;
            }
            liveAuctionRecoveryNeeded = true;
            console.warn('[silentdraft] Socket disconnected:', reason);

            if (navigator.onLine) {
                scheduleConnectionResync(`disconnect-${reason || 'unknown'}`, 600);
            }
        });

        window.draftSocket.io.on('reconnect_attempt', () => {
            updateSocketConnectionIndicator(false, 'Reconnecting...');
        });

        window.draftSocket.io.on('reconnect_error', () => {
            updateSocketConnectionIndicator(false, 'Reconnect failed - retrying...');
        });

        window.draftSocket.io.on('reconnect_failed', () => {
            updateSocketConnectionIndicator(false, 'Unable to reconnect. Refresh page.');
            showNotification('Unable to reconnect. Please refresh the page.');
        });
        
        // Listen for bid updates from other players
        window.draftSocket.on('bidUpdate', (data) => {
            console.log('[silentdraft] Bid update received:', data);
            // Silent auction - don't show bid details, only submission notification
        });
        
        // Listen for bid submissions (when someone clicks Submit Bids)
        window.draftSocket.on('bidsSubmitted', (data) => {
            console.log('[silentdraft] Player submitted bids:', data.username);
            if (data.username !== username) {
                showSubmissionNotification(data.username);
            }
        });
        
        // Listen for all bids submitted signal
        window.draftSocket.on('allBidsSubmitted', () => {
            if (isDraftEnding) {
                console.log('[silentdraft] Ignoring allBidsSubmitted while draft ending');
                return;
            }
            clearAutoDraftSoloGraceWindow();
            console.log('[silentdraft] All members have submitted - showing processing modal');
            showProcessingBidsModal();

            clearRoundResultsRecoveryTimer();
            roundResultsRecoveryTimer = setTimeout(() => {
                requestRoundResultsRecovery('allBidsSubmitted-timeout');
            }, 12000);

            // Any connected member can request processing; server enforces idempotency.
            processRoundOnServer();
        });

        window.draftSocket.on('roundDiagnostics', (payload) => {
            console.log('[silentdraft][server][roundDiagnostics]', payload);
        });

        window.draftSocket.on('roundProcessingError', (payload) => {
            const message = payload && payload.message ? payload.message : 'Round processing failed.';
            const detail = payload && payload.error ? ` (${payload.error})` : '';
            console.error('[silentdraft] roundProcessingError:', payload);
            hideProcessingBidsModal();
            clearRoundResultsRecoveryTimer();
            if (processRoundRetryTimer) {
                clearTimeout(processRoundRetryTimer);
                processRoundRetryTimer = null;
            }
            showNotification(`${message}${detail}`);
        });

        window.draftSocket.on('liveAuctionSync', (auctionState) => {
            if (!auctionState || !auctionState.auctionId || !auctionState.playerId) {
                return;
            }

            const hasAuctionUi = !!document.getElementById('live-auction-modal');
            const shouldRecover = liveAuctionRecoveryNeeded || !activeLiveAuctionUi || activeLiveAuctionUi.auctionId !== auctionState.auctionId || !hasAuctionUi;
            if (!shouldRecover) {
                return;
            }

            const tiedBids = [{
                playerId: auctionState.playerId,
                bidAmount: Number(auctionState.startBid || auctionState.currentBid || 0),
                tiedTeams: Array.isArray(auctionState.tiedTeams) ? auctionState.tiedTeams.slice() : []
            }];

            console.warn('[silentdraft] Recovering active live auction from sync payload:', auctionState.auctionId);
            try {
                liveAuctionRecoveryNeeded = false;
                handleLiveAuction(tiedBids, () => {});
            } catch (error) {
                console.error('[silentdraft] Failed to recover live auction UI from sync payload:', error);
            }
        });

        window.draftSocket.on('liveAuctionTransition', (payload) => {
            if (!payload) return;
            const message = String(payload.message || 'Preparing for next auction...');
            showAuctionTransitionPopup(message);
        });
        
        // Listen for round players set by host
        window.draftSocket.on('roundPlayersSet', (roundPlayers) => {
            console.log('[silentdraft] Round players received from host:', roundPlayers.length);
            window.syncedRoundPlayers = roundPlayers;
            
            // If not host, use these players for the round
            if (!window.isHost) {
                displayRoundPlayers(roundPlayers);
            }
        });
        
        const handleAuthoritativeRoundResults = (payload, sourceLabel = 'roundResults') => {
            if (isDraftEnding) {
                console.log(`[silentdraft] Ignoring ${sourceLabel} while draft ending`);
                return;
            }
            if (processRoundRetryTimer) {
                clearTimeout(processRoundRetryTimer);
                processRoundRetryTimer = null;
            }
            clearRoundResultsRecoveryTimer();
            clearAutoDraftSoloGraceWindow();

            const payloadResults = payload && Array.isArray(payload.results)
                ? payload.results
                : null;
            const payloadRound = Number(payload && payload.roundNumber);
            const resultsArray = Array.isArray(payload)
                ? payload
                : (payloadResults || []);

            if (Number.isFinite(payloadRound) && payloadRound > 0) {
                currentRound = payloadRound;
                if (payloadRound > lastServerRoundStarted) {
                    lastServerRoundStarted = payloadRound;
                }
            }

            console.log(`[silentdraft] ${sourceLabel} received from server:`, resultsArray.length, 'results', 'round=', Number.isFinite(payloadRound) ? payloadRound : currentRound);
            console.log(`[silentdraft] ${sourceLabel} full payload:`, JSON.stringify(payload, null, 2));
            hideProcessingBidsModal();
            let safeResults = resultsArray;
            const localRoundPlayers = window.currentRoundPlayers || window.syncedRoundPlayers || [];
            if (safeResults.length === 0 && Array.isArray(localRoundPlayers) && localRoundPlayers.length > 0) {
                console.warn(`[silentdraft] Server returned empty ${sourceLabel}; synthesizing undrafted fallback from local round players`, {
                    currentRound,
                    localRoundPlayers: localRoundPlayers.length
                });
                safeResults = localRoundPlayers.map((player) => ({
                    type: 'undrafted',
                    playerId: player && player.id,
                    playerName: String(player && player.name || `Player ${player && player.id ? player.id : '?'}`),
                    allBids: (teams || []).map((team) => ({
                        teamName: String(team && team.name || ''),
                        amount: 0
                    }))
                }));
            }

            const nextModalRound = Number.isFinite(payloadRound) && payloadRound > 0 ? payloadRound : currentRound;
            if (
                activeRoundResultsModalRound !== null
                && Number.isFinite(nextModalRound)
                && activeRoundResultsModalRound !== nextModalRound
            ) {
                const staleModal = document.getElementById('round-results-modal');
                if (staleModal && staleModal.parentNode) {
                    staleModal.parentNode.removeChild(staleModal);
                }
                activeRoundResultsModalRound = null;
                document.body.classList.remove('round-results-active');
            }

            const { tiedBids } = applyRoundResults(safeResults);
            showRoundResultsModal(safeResults, localRoundPlayers, () => {
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
                
                if (tiedBids.length === 0) {
                    advanceDraftAfterRound();
                }
            }, {
                roundNumber: nextModalRound,
                acceptedMembers: Array.isArray(payload && payload.acceptedMembers) ? payload.acceptedMembers : []
            });
        };

        // Listen for authoritative round results from server
        window.draftSocket.on('roundResults', (payload) => {
            handleAuthoritativeRoundResults(payload, 'roundResults');
        });

        // Reconnect/state replay path: server can resend active round results that still need acceptance.
        window.draftSocket.on('roundResultsSync', (payload) => {
            handleAuthoritativeRoundResults(payload, 'roundResultsSync');
        });
        
        // Listen for round changes
        window.draftSocket.on('roundStarted', (draftState) => {
            const nextRound = Number(draftState && draftState.currentRound);
            if (!Number.isFinite(nextRound) || nextRound <= 0) {
                console.warn('[silentdraft] Ignoring invalid roundStarted payload:', draftState);
                return;
            }

            if (lastServerRoundStarted === nextRound) {
                console.log('[silentdraft] Ignoring duplicate roundStarted for round', nextRound);
                return;
            }

            console.log('[silentdraft] New round started from server:', nextRound);
            clearRoundResultsRecoveryTimer();
            lastServerRoundStarted = nextRound;
            currentRound = nextRound;

            for (const roundKey of [...submitRequestIdsByRound.keys()]) {
                if (Number(roundKey) < nextRound - 1) {
                    submitRequestIdsByRound.delete(roundKey);
                }
            }
            for (const roundKey of [...processRequestIdsByRound.keys()]) {
                if (Number(roundKey) < nextRound - 1) {
                    processRequestIdsByRound.delete(roundKey);
                }
            }

            window.syncedRoundPlayers = null; // Clear for new round

            const existingResultsModal = document.getElementById('round-results-modal');
            if (existingResultsModal && existingResultsModal.parentNode) {
                existingResultsModal.parentNode.removeChild(existingResultsModal);
                document.body.classList.remove('round-results-active');
            }
            activeRoundResultsModalRound = null;

            startRound();
        });
        
        // Fetch and log active CPU tuning lab preset
        async function logActiveCpuLogicPreset() {
            try {
                const response = await fetch('/api/public/cpu-logic-preset');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.presetName) {
                        console.log('%c[SILENT DRAFT CPU LOGIC]', 'background: #2196F3; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;', `Using CPU tuning lab preset: "${data.presetName}"`);
                        if (data.sourceFile) {
                            console.log('%c[SILENT DRAFT CPU LOGIC]', 'background: #2196F3; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;', `Source file: ${data.sourceFile}`);
                        }
                    }
                }
            } catch (error) {
                // Silently ignore if fetch fails
            }
        }

        // Listen for initial state sync
        window.draftSocket.on('draftStateSync', (draftState) => {
            console.log('[silentdraft] Draft state synced:', draftState);
            logActiveCpuLogicPreset();
            const serverRound = Number(draftState && draftState.currentRound);
            if (Number.isFinite(serverRound) && serverRound > 0) {
                currentRound = serverRound;
                if (serverRound > lastServerRoundStarted) {
                    lastServerRoundStarted = serverRound;
                }
            }
            autoDraftStatusByTeam = draftState.autoDraftStatus || autoDraftStatusByTeam;
            draftChatMessages = Array.isArray(draftState.chatMessages) ? draftState.chatMessages.slice(-200) : draftChatMessages;
            renderDraftChatMessages();
            if (draftState && draftState.rosterSettings) {
                applyRosterSettings(draftState.rosterSettings);
            }
            if (draftState && typeof draftState.roundTimerMinutes !== 'undefined') {
                console.log('[silentdraft] draftStateSync applying roundTimerMinutes:', draftState.roundTimerMinutes);
                applyRoundTimerMinutes(draftState.roundTimerMinutes);
            }
            autoDraftEnabled = !!autoDraftStatusByTeam[username];
            updateAutoDraftToggleUI();
            // If there are current players already set, use them
            if (draftState.currentPlayers && draftState.currentPlayers.length > 0) {
                window.syncedRoundPlayers = draftState.currentPlayers;
                if (!window.isHost) {
                    displayRoundPlayers(draftState.currentPlayers);
                }
            }
        });

        window.draftSocket.on('autoDraftStatusSync', (statusMap) => {
            autoDraftStatusByTeam = statusMap || {};
            autoDraftEnabled = !!autoDraftStatusByTeam[username];
            updateAutoDraftToggleUI();
            updateUI(getRoundPlayers());
            if (autoDraftEnabled) {
                scheduleAutoDraftSoloGraceWindow();
            } else {
                clearAutoDraftSoloGraceWindow();
            }
        });

        window.draftSocket.on('autoDraftStatusChanged', (payload) => {
            autoDraftStatusByTeam = (payload && payload.statuses) ? payload.statuses : autoDraftStatusByTeam;
            autoDraftEnabled = !!autoDraftStatusByTeam[username];
            updateAutoDraftToggleUI();
            updateUI(getRoundPlayers());
            if (autoDraftEnabled) {
                scheduleAutoDraftSoloGraceWindow();
            } else {
                clearAutoDraftSoloGraceWindow();
            }
        });

        // Live roster settings update from lobby host
        window.draftSocket.on('rosterSettingsUpdated', (data) => {
            if (!data) return;
            let settingsChanged = false;
            if (data.rosterSettings) {
                applyRosterSettings(data.rosterSettings);
                settingsChanged = true;
                // Persist to localStorage so re-joins pick it up
                try {
                    const draftsRaw = localStorage.getItem('drafts');
                    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
                    if (drafts[currentDraftCode]) {
                        drafts[currentDraftCode].rosterSettings = data.rosterSettings;
                        if (typeof data.benchCutTarget !== 'undefined') {
                            drafts[currentDraftCode].benchCutTarget = data.benchCutTarget;
                        }
                        if (typeof data.ajDraftMode !== 'undefined') {
                            drafts[currentDraftCode].ajDraftMode = !!data.ajDraftMode;
                        }
                        if (typeof data.ajRoundOrder !== 'undefined') {
                            drafts[currentDraftCode].ajRoundOrder = normalizeAjRoundOrder(data.ajRoundOrder);
                        }
                        localStorage.setItem('drafts', JSON.stringify(drafts));
                    }
                } catch (e) { /* ignore */ }
            }
            if (typeof data.benchCutTarget !== 'undefined') {
                benchCutTarget = normalizeBenchCutTarget(data.benchCutTarget);
                settingsChanged = true;
            }
            if (typeof data.roundTimerMinutes !== 'undefined') {
                console.log('[silentdraft] rosterSettingsUpdated applying roundTimerMinutes:', data.roundTimerMinutes);
                applyRoundTimerMinutes(data.roundTimerMinutes);
                try {
                    const draftsRaw = localStorage.getItem('drafts');
                    const drafts = draftsRaw ? JSON.parse(draftsRaw) : {};
                    if (drafts[currentDraftCode]) {
                        drafts[currentDraftCode].roundTimerMinutes = normalizeRoundTimerMinutes(data.roundTimerMinutes);
                        localStorage.setItem('drafts', JSON.stringify(drafts));
                    }
                } catch (e) { /* ignore */ }
                settingsChanged = true;
            }
            if (settingsChanged) {
                renderRosterRequirementsSummary();
                updateUI(getRoundPlayers());
            }
        });

        window.draftSocket.on('draftChatMessage', (payload) => {
            if (!payload || typeof payload.text !== 'string') return;
            draftChatMessages.push(payload);
            if (draftChatMessages.length > DRAFT_CHAT_MAX_MESSAGES) {
                draftChatMessages = draftChatMessages.slice(-DRAFT_CHAT_MAX_MESSAGES);
            }
            if (draftRoomRightViewMode !== 'chat') {
                draftChatUnreadCount += 1;
                updateDraftChatUnreadBadge();
            }
            renderDraftChatMessages();
        });

        window.draftSocket.on('memberConnectionState', (payload) => {
            if (!payload || !payload.username) return;
            const state = String(payload.state || '').trim().toLowerCase();
            if (!state) return;

            if (state === 'reconnecting') {
                const graceSeconds = Math.max(0, Math.floor(Number(payload.graceMsRemaining || 0) / 1000));
                showNotification(`${payload.username} is reconnecting (${graceSeconds}s grace).`);
                return;
            }

            if (state === 'connected') {
                showNotification(`${payload.username} reconnected.`);
                return;
            }

            if (state === 'disconnected') {
                showNotification(`${payload.username} disconnected after reconnect timeout.`);
            }
        });

        window.draftSocket.on('hostConnectionState', (payload) => {
            if (!payload) return;
            const state = String(payload.state || '').trim().toLowerCase();
            if (state === 'reconnecting') {
                const graceSeconds = Math.max(0, Math.floor(Number(payload.graceMsRemaining || 0) / 1000));
                showNotification(`Host reconnecting (${graceSeconds}s grace). Holding critical actions.`);
                return;
            }

            if (state === 'connected') {
                showNotification('Host reconnected. Draft actions resumed.');
            }
        });
    }
    
    // Helper to show bid submission notifications (silent auction - no details)
    function showSubmissionNotification(teamName) {
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.background = '#4a5568';
        notification.style.color = 'white';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '8px';
        notification.style.zIndex = '9999';
        notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        notification.textContent = `${teamName} has submitted their bids`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transition = 'opacity 0.5s';
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 500);
        }, 3000);
    }

    function lockRoundBidsUI(labelText = 'Bids Submitted') {
        document.querySelectorAll('input[data-player-id]').forEach(input => {
            input.disabled = true;
        });

        const submitBtn = document.getElementById('submit-bids');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = labelText;
        }
    }

    function emitSocketAckWithRetry(eventName, args, options = {}) {
        const socket = window.draftSocket;
        const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : DEFAULT_ACK_TIMEOUT_MS;
        const overallTimeoutMs = Number.isFinite(Number(options.overallTimeoutMs)) ? Number(options.overallTimeoutMs) : DEFAULT_ACK_OVERALL_TIMEOUT_MS;
        const maxRetries = Number.isFinite(Number(options.maxRetries)) ? Number(options.maxRetries) : DEFAULT_ACK_MAX_RETRIES;
        const suppressRetryWarning = !!options.suppressRetryWarning;

        if (!(socket && currentDraftCode)) {
            return Promise.resolve({ ok: false, reason: 'socket_unavailable' });
        }

        return new Promise((resolve) => {
            let settled = false;
            let attempts = 0;
            let ackTimeoutId = null;
            let overallTimeoutId = null;
            let waitingForReconnect = !socket.connected;

            const cleanup = () => {
                if (ackTimeoutId) {
                    clearTimeout(ackTimeoutId);
                    ackTimeoutId = null;
                }
                if (overallTimeoutId) {
                    clearTimeout(overallTimeoutId);
                    overallTimeoutId = null;
                }
                socket.off('connect', handleConnect);
                socket.off('disconnect', handleDisconnect);
            };

            const finish = (response) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(response || { ok: false });
            };

            const send = () => {
                if (settled) return;
                if (!socket.connected) {
                    waitingForReconnect = true;
                    return;
                }

                waitingForReconnect = false;
                if (ackTimeoutId) {
                    clearTimeout(ackTimeoutId);
                    ackTimeoutId = null;
                }

                ackTimeoutId = setTimeout(() => {
                    if (settled) return;

                    if (!socket.connected) {
                        waitingForReconnect = true;
                        return;
                    }

                    if (attempts < maxRetries) {
                        attempts += 1;
                        if (!suppressRetryWarning) {
                            console.warn(`[silentdraft] ${eventName} ack timeout; retrying once.`);
                        }
                        send();
                        return;
                    }

                    finish({ ok: false, reason: 'timeout' });
                }, timeoutMs);

                socket.emit(eventName, ...args, (response) => {
                    finish(response || { ok: false });
                });
            };

            const handleConnect = () => {
                if (!settled && waitingForReconnect) {
                    send();
                }
            };

            const handleDisconnect = () => {
                waitingForReconnect = true;
                if (ackTimeoutId) {
                    clearTimeout(ackTimeoutId);
                    ackTimeoutId = null;
                }
            };

            socket.on('connect', handleConnect);
            socket.on('disconnect', handleDisconnect);

            overallTimeoutId = setTimeout(() => {
                if (settled) return;
                finish({ ok: false, reason: 'timeout' });
            }, overallTimeoutMs);

            send();
        });
    }

    function syncCurrentRoundBidsToServer() {
        if (!(window.draftSocket && currentDraftCode)) {
            console.warn('[silentdraft] syncCurrentRoundBidsToServer aborted: socket unavailable');
            return Promise.resolve(false);
        }

        const roundPlayers = getRoundPlayers();
        const bidSnapshot = roundPlayers.map(player => ({
            playerId: player.id,
            playerName: player.name,
            storedBid: storedBids[player.id] ? parseInt(storedBids[player.id], 10) || 0 : 0
        }));
        console.log('[silentdraft][debug] syncCurrentRoundBidsToServer snapshot:', bidSnapshot);

        const bidEntries = roundPlayers.map(player => {
            let bidAmount = storedBids[player.id] ? parseInt(storedBids[player.id], 10) : 0;
            if (Number.isNaN(bidAmount) || bidAmount < 0) bidAmount = 0;

            return {
                playerId: player.id,
                bidAmount
            };
        });

        return emitSocketAckWithRetry('syncRoundBids', [currentDraftCode, bidEntries], {
            timeoutMs: 2500,
            overallTimeoutMs: 4000,
            maxRetries: 0,
            suppressRetryWarning: true
        }).then((response) => {
            if (response && response.ok) {
                return true;
            }

            // Backward-compatible fallback for servers that do not yet support syncRoundBids.
            const bidPromises = roundPlayers.map(player => {
                let bidAmount = storedBids[player.id] ? parseInt(storedBids[player.id], 10) : 0;
                if (Number.isNaN(bidAmount) || bidAmount < 0) bidAmount = 0;

                return emitSocketAckWithRetry('placeBid', [currentDraftCode, player.id, bidAmount], { timeoutMs: 5000, overallTimeoutMs: 12000, maxRetries: 1 }).then((placeResponse) => {
                    if (placeResponse && placeResponse.ok) {
                        console.log(`[silentdraft] Bid sent: ${player.name} = $${bidAmount}`);
                    }
                    return placeResponse && placeResponse.ok;
                });
            });

            return Promise.all(bidPromises).then(() => true);
        });
    }

    function submitCurrentRoundBidsToServer(options = {}) {
        const lockUI = options.lockUI !== false;
        const lockLabel = options.lockLabel || 'Bids Submitted';
        const forceWhenRosterFull = !!options.forceWhenRosterFull;

        const yourTeam = teams.find(t => t.name === username);
        if (!yourTeam) {
            console.warn('[silentdraft] submitCurrentRoundBidsToServer aborted: user team not found');
            return Promise.resolve(false);
        }

        if (!(window.draftSocket && currentDraftCode)) {
            console.warn('[silentdraft] submitCurrentRoundBidsToServer aborted: socket unavailable');
            return Promise.resolve(false);
        }

        return syncCurrentRoundBidsToServer().then(() => (
            emitSocketAckWithRetry('submitBids', [currentDraftCode, username, autoDraftEnabled, { requestId: getSubmitRequestIdForRound(currentRound) }], { timeoutMs: 8000, overallTimeoutMs: 24000, maxRetries: 2 }).then((response) => {
                if (response && response.ok) {
                    console.log('[silentdraft] All bids submitted and recorded');
                    if (lockUI) {
                        lockRoundBidsUI(lockLabel);
                    }
                    return true;
                }

                const transientReject = response && (response.reason === 'draft_not_ready' || response.reason === 'not_found' || response.reason === 'draft_missing');
                if (transientReject) {
                    console.warn('[silentdraft] submitBids transiently rejected; retrying once after state sync:', response);
                    return new Promise((resolve) => {
                        window.setTimeout(() => {
                            emitSocketAckWithRetry('submitBids', [currentDraftCode, username, autoDraftEnabled, { requestId: getSubmitRequestIdForRound(currentRound) }], { timeoutMs: 8000, overallTimeoutMs: 20000, maxRetries: 1 }).then((retryResponse) => {
                                if (retryResponse && retryResponse.ok) {
                                    console.log('[silentdraft] Retry succeeded for bid submission');
                                    if (lockUI) {
                                        lockRoundBidsUI(lockLabel);
                                    }
                                    resolve(true);
                                    return;
                                }
                                console.warn('[silentdraft] submitBids rejected after retry:', retryResponse);
                                resolve(false);
                            });
                        }, 1000);
                    });
                }

                console.warn('[silentdraft] submitBids rejected:', response);
                return false;
            })
        ));
    }

    // Expose helper explicitly for nested UI callbacks that may execute
    // outside this function's lexical scope in some browser/runtime paths.
    window.submitCurrentRoundBidsToServer = submitCurrentRoundBidsToServer;

    function clearRoundResultsRecoveryTimer() {
        if (roundResultsRecoveryTimer) {
            clearTimeout(roundResultsRecoveryTimer);
            roundResultsRecoveryTimer = null;
        }
    }

    function requestRoundResultsRecovery(reason = 'manual') {
        if (!(window.draftSocket && currentDraftCode)) {
            return;
        }

        const targetRound = Number(currentRound || 1);
        console.warn('[silentdraft] Requesting round results recovery from server', { reason, targetRound });
        window.draftSocket.emit('recoverRoundResults', currentDraftCode, targetRound, (response) => {
            if (response && response.ok) {
                console.log('[silentdraft] round results recovery request accepted:', response.source || 'unknown');
                return;
            }

            console.warn('[silentdraft] round results recovery request not available:', response);
        });
    }

    function buildActionRequestId(action, roundNumber) {
        const safeAction = String(action || 'action').trim().toLowerCase();
        const safeRound = Number.isFinite(Number(roundNumber)) ? Number(roundNumber) : Number(currentRound || 1);
        const draftKey = String(currentDraftCode || 'draft').trim();
        return `${safeAction}:${draftKey}:${safeRound}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    }

    function getSubmitRequestIdForRound(roundNumber) {
        const key = Number.isFinite(Number(roundNumber)) ? Number(roundNumber) : Number(currentRound || 1);
        if (!submitRequestIdsByRound.has(key)) {
            submitRequestIdsByRound.set(key, buildActionRequestId('submitbids', key));
        }
        return submitRequestIdsByRound.get(key);
    }

    function getProcessRequestIdForRound(roundNumber) {
        const key = Number.isFinite(Number(roundNumber)) ? Number(roundNumber) : Number(currentRound || 1);
        if (!processRequestIdsByRound.has(key)) {
            processRequestIdsByRound.set(key, buildActionRequestId('processround', key));
        }
        return processRequestIdsByRound.get(key);
    }
    
    // Process round on server (called when all submitted or timer expires)
    function processRoundOnServer(attempt = 0) {
        console.log('[silentdraft] Processing round on server');
        
        // Stop the timer when processing begins
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            console.log('[silentdraft] Timer cleared for round processing');
        }
        
        let roundPlayers = getRoundPlayers();
        if (!Array.isArray(roundPlayers) || roundPlayers.length === 0) {
            const page1 = Array.isArray(window.page1Players) ? window.page1Players : [];
            const page2 = Array.isArray(window.page2Players) ? window.page2Players : [];
            const merged = [...page1, ...page2];
            const seen = new Set();
            roundPlayers = merged.filter((player) => {
                const pid = Number(player && player.id);
                if (!Number.isFinite(pid) || seen.has(pid)) return false;
                seen.add(pid);
                return true;
            });
            console.warn('[silentdraft] getRoundPlayers was empty; using page fallback for processRound payload', {
                page1: page1.length,
                page2: page2.length,
                merged: roundPlayers.length
            });
        }
        const roundData = {
            roundPlayers: roundPlayers,
            teams: teams,
            rosterSize: rosterSize,
            rosterLimits: rosterLimits,
            flexPositions: flexPositions,
            rosterSettings: rosterSettings,
            allPlayers: players,
            requestId: getProcessRequestIdForRound(currentRound)
        };
        console.log('[silentdraft][debug] processRound payload summary:', {
            attempt,
            roundPlayers: Array.isArray(roundData.roundPlayers) ? roundData.roundPlayers.length : 0,
            teams: Array.isArray(roundData.teams) ? roundData.teams.length : 0,
            allPlayers: Array.isArray(roundData.allPlayers) ? roundData.allPlayers.length : 0,
            currentRound
        });
        
        if (window.draftSocket && currentDraftCode) {
            window.draftSocket.emit('processRound', currentDraftCode, roundData, (response) => {
                if (response && response.ok) {
                    console.log('[silentdraft] Round processing complete');
                    return;
                }

                const reason = response && response.reason ? String(response.reason) : 'unknown';
                console.warn('[silentdraft] processRound rejected:', response);

                // Ignore this client when another member is already processing the same round.
                if (reason === 'already_processing') {
                    return;
                }

                // Race safety: host retries briefly when submit tracking arrives just after trigger.
                if (reason === 'not_all_submitted' && window.isHost && attempt < 2) {
                    if (processRoundRetryTimer) {
                        clearTimeout(processRoundRetryTimer);
                    }
                    processRoundRetryTimer = setTimeout(() => {
                        processRoundRetryTimer = null;
                        processRoundOnServer(attempt + 1);
                    }, 450);
                    return;
                }

                hideProcessingBidsModal();
                if (reason === 'not_all_submitted') {
                    showNotification('Round results blocked: waiting for all required members to submit bids.');
                } else if (reason === 'auction_in_progress') {
                    showNotification('Round results pending: a tie-break auction is still active.');
                } else if (reason === 'no_draft_state' || reason === 'draft_not_ready') {
                    showNotification('Draft state not ready yet. Please wait a moment and try again.');
                } else {
                    showNotification('Unable to process round results right now.');
                }
            });
        }
    }

    function handleRoundTimerExpired() {
        if (window.__silentDraftTimerExpiredHandled) {
            return;
        }
        window.__silentDraftTimerExpiredHandled = true;
        console.log('[silentdraft] Timer expired - forcing submission for members who have not submitted');
        console.log('[silentdraft][debug] timer expiry context:', {
            username,
            isHost: !!window.isHost,
            currentDraftCode,
            roundPlayers: getRoundPlayers().map(player => ({ id: player.id, name: player.name })),
            storedBids: Object.assign({}, storedBids)
        });
        lockRoundBidsUI('Time Up - Bids Locked');

        syncCurrentRoundBidsToServer().finally(() => {
            if (window.draftSocket && currentDraftCode) {
                setTimeout(() => {
                    console.log('[silentdraft][debug] emitting forceTimerRoundEnd');
                    window.draftSocket.emit('forceTimerRoundEnd', currentDraftCode, (response) => {
                        if (response && response.ok) {
                            console.log('[silentdraft] Timer forced round end:', response);
                        } else {
                            console.warn('[silentdraft] forceTimerRoundEnd rejected:', response);
                        }
                    });
                }, 400);
            }
        });
    }

    window.handleRoundTimerExpired = handleRoundTimerExpired;

  // Full player list (top 250 PPR players)


   


    // Check if adding a player is valid for a team's roster
    function isValidRosterAddition(team, player) {
        return true;
    }

    // Validate roster at draft end
    function validateRoster(team) {
        const positionCounts = team.roster.reduce((counts, p) => {
            counts[p.position] = (counts[p.position] || 0) + 1;
            return counts;
        }, {});
        const flexEligibleCount = (positionCounts.RB || 0) + (positionCounts.WR || 0) + (positionCounts.TE || 0);
        return (
            (positionCounts.QB || 0) >= rosterLimits.QB.min &&
            (positionCounts.RB || 0) >= rosterLimits.RB.min &&
            (positionCounts.WR || 0) >= rosterLimits.WR.min &&
            (positionCounts.TE || 0) >= rosterLimits.TE.min &&
            (positionCounts.K || 0) >= rosterLimits.K.min &&
            (positionCounts.DEF || 0) >= rosterLimits.DEF.min &&
            flexEligibleCount >= (rosterLimits.RB.min + rosterLimits.WR.min + rosterLimits.TE.min + getFlexRequirementCount()) &&
            team.roster.length >= rosterSize
        );
    }
    }

    function getRemainingUndraftedPlayers(excludePlayers = []) {
        return players.filter(player => !player.owner && !player.shown && !excludePlayers.includes(player));
    }

    function getMaxSelectionsForCurrentRound(position, excludePlayers = [], currentSelected = []) {
        const totalUndraftedAtPosition = players.filter(player => (
            !player.owner &&
            !player.shown &&
            player.position === position
        )).length;

        const roundsAfterCurrent = Math.max(0, totalRounds - currentRound);
        const futureReserve = roundsAfterCurrent * (roundPositionMinimums[position] || 0);
        const currentRoundMinimum = Math.min(roundPositionMinimums[position] || 0, totalUndraftedAtPosition);
        const maxCurrentRoundTotal = Math.max(currentRoundMinimum, totalUndraftedAtPosition - futureReserve);

        const alreadyCommitted = excludePlayers.filter(player => player.position === position).length +
            currentSelected.filter(player => player.position === position).length;

        return Math.max(0, maxCurrentRoundTotal - alreadyCommitted);
    }

    function canSelectPlayerForCurrentRound(player, excludePlayers = [], currentSelected = []) {
        return getMaxSelectionsForCurrentRound(player.position, excludePlayers, currentSelected) > 0;
    }

    function normalizeAjRoundOrder(raw) {
        if (!Array.isArray(raw)) return AJ_ROUND_CODES.slice();
        const normalized = raw
            .map(code => String(code || '').trim().toUpperCase())
            .filter(code => AJ_ROUND_CODES.includes(code));
        const deduped = [];
        normalized.forEach(code => {
            if (!deduped.includes(code)) deduped.push(code);
        });
        AJ_ROUND_CODES.forEach(code => {
            if (!deduped.includes(code)) deduped.push(code);
        });
        return deduped.slice(0, AJ_ROUND_CODES.length);
    }

    function getCurrentAjRoundCode() {
        return ajRoundOrder[Math.max(0, currentRound - 1)] || AJ_ROUND_CODES[Math.max(0, currentRound - 1)] || AJ_ROUND_CODES[0];
    }

    function getPlayerRankSortValue(player) {
        const positionRank = Number.parseInt(player && player.positionRank, 10);
        if (Number.isFinite(positionRank)) return positionRank;
        const prerank = Number.parseInt(player && player.prerank, 10);
        if (Number.isFinite(prerank)) return prerank;
        return 9999;
    }

    function comparePlayersForAjSlot(a, b) {
        const positionDelta = getPlayerRankSortValue(a) - getPlayerRankSortValue(b);
        if (positionDelta !== 0) return positionDelta;
        const overallDelta = (Number.parseInt(a && a.prerank, 10) || 9999) - (Number.parseInt(b && b.prerank, 10) || 9999);
        if (overallDelta !== 0) return overallDelta;
        return String(a && a.name || '').localeCompare(String(b && b.name || ''));
    }

    function getAjSlotAssignment(positionRank, position = '') {
        const normalizedRank = Math.max(1, Number.parseInt(positionRank, 10) || 1);
        const zeroBasedRank = normalizedRank - 1;
        const blockIndex = Math.floor(zeroBasedRank / 10);
        const offset = zeroBasedRank % 10;
        const normalizedPosition = String(position || '').toUpperCase();
        const startsReversed = AJ_REVERSED_START_POSITIONS.has(normalizedPosition);
        const isPageOneBlock = startsReversed ? (blockIndex % 2 === 1) : (blockIndex % 2 === 0);
        const roundIndex = isPageOneBlock ? offset : (AJ_ROUND_CODES.length - 1 - offset);
        const page = isPageOneBlock ? 1 : 2;
        return {
            round: roundIndex + 1,
            page,
            code: `${AJ_ROUND_CODES[roundIndex]}${page}`
        };
    }

    function annotateAjSlot(player) {
        if (!player) return player;
        const assignment = getAjSlotAssignment(player.positionRank, player.position);
        player.ajSlotCode = assignment.code;
        player.ajRoundNumber = assignment.round;
        player.ajPageNumber = assignment.page;
        return player;
    }

    function countPlayersByPosition(selectedPlayers, position) {
        return selectedPlayers.filter(player => player.position === position).length;
    }

    function getBestAvailablePlayers(excludePlayers = [], filterFn = null) {
        return getRemainingUndraftedPlayers(excludePlayers)
            .filter(player => canSelectPlayerForCurrentRound(player, excludePlayers, []))
            .filter(player => !filterFn || filterFn(player))
            .sort(comparePlayersForAjSlot);
    }

    function pickPlayersForMinimum(position, countNeeded, selectedPlayers, preferredPool, fallbackPool) {
        const picks = [];
        const tryPools = [preferredPool, fallbackPool];

        for (const pool of tryPools) {
            for (const player of pool) {
                if (picks.length >= countNeeded) break;
                if (player.position !== position) continue;
                if (selectedPlayers.includes(player) || picks.includes(player)) continue;
                if (!canSelectPlayerForCurrentRound(player, selectedPlayers.concat(picks), [])) continue;
                picks.push(player);
            }
            if (picks.length >= countNeeded) break;
        }

        return picks;
    }

    function buildAjPagePlayers(roundCode, pageNumber, pageSize, excludePlayers, requirements) {
        const availablePlayers = getRemainingUndraftedPlayers(excludePlayers)
            .filter(player => canSelectPlayerForCurrentRound(player, excludePlayers, []));
        const assignedPlayers = availablePlayers
            .filter(player => {
                const assignment = getAjSlotAssignment(player.positionRank, player.position);
                return assignment.code === `${roundCode}${pageNumber}`;
            })
            .sort(comparePlayersForAjSlot);

        let selectedPlayers = assignedPlayers.slice(0, pageSize);

        requirements.forEach(({ pos, min }) => {
            const currentCount = countPlayersByPosition(selectedPlayers, pos);
            const missing = Math.max(0, min - currentCount);
            if (missing === 0) return;

            const fallbackPool = availablePlayers
                .filter(player => !selectedPlayers.includes(player))
                .sort(comparePlayersForAjSlot);
            const additions = pickPlayersForMinimum(pos, missing, selectedPlayers, assignedPlayers, fallbackPool);

            additions.forEach(player => {
                if (selectedPlayers.length < pageSize) {
                    selectedPlayers.push(player);
                    return;
                }

                const replacement = selectedPlayers
                    .map((selectedPlayer, index) => ({ selectedPlayer, index }))
                    .filter(entry => countPlayersByPosition(selectedPlayers, entry.selectedPlayer.position) > ((requirements.find(req => req.pos === entry.selectedPlayer.position) || {}).min || 0))
                    .sort((a, b) => comparePlayersForAjSlot(b.selectedPlayer, a.selectedPlayer))[0];

                if (replacement) {
                    selectedPlayers[replacement.index] = player;
                }
            });

            selectedPlayers = selectedPlayers.sort(comparePlayersForAjSlot).slice(0, pageSize);
        });

        if (selectedPlayers.length < pageSize) {
            const fillers = getBestAvailablePlayers(excludePlayers.concat(selectedPlayers), player => !selectedPlayers.includes(player));
            for (const player of fillers) {
                if (selectedPlayers.length >= pageSize) break;
                selectedPlayers.push(player);
            }
        }

        return selectedPlayers
            .sort(comparePlayersForAjSlot)
            .slice(0, pageSize)
            .map(annotateAjSlot);
    }

    function getAjRoundPlayers() {
        const roundCode = getCurrentAjRoundCode();
        const page1Players = buildAjPagePlayers(roundCode, 1, PAGE_SIZE, [], PAGE1_REQUIREMENTS);
        const page2Players = buildAjPagePlayers(roundCode, 2, PAGE_SIZE, page1Players, PAGE2_REQUIREMENTS);
        return page1Players.concat(page2Players);
    }

    // Get random players for the round with balanced positions and mixed ranks
    function getRandomPlayers(count) {
        const availablePlayers = getRemainingUndraftedPlayers();

        // Sort available players by rank to create relative tiers
        const sortedPlayers = [...availablePlayers].sort((a, b) => a.prerank - b.prerank);
        const totalPlayers = sortedPlayers.length;
        const topTierCount = Math.floor(totalPlayers * 0.25);
        const middleTierCount = Math.floor(totalPlayers * 0.5); // Next 50%
        
        // Create tier arrays based on sorted order
        const topTier = sortedPlayers.slice(0, topTierCount);
        const middleTier = sortedPlayers.slice(topTierCount, topTierCount + middleTierCount);
        const bottomTier = sortedPlayers.slice(topTierCount + middleTierCount);

        console.log(`[getRandomPlayers] Available players: ${totalPlayers}, Top tier: ${topTier.length}, Middle: ${middleTier.length}, Bottom: ${bottomTier.length}`);

        // Prioritize positions to ensure minimums are met, but select randomly from different tiers
        const positionPriority = [
            { pos: 'QB', min: 2, max: 2 },  // Exactly 2 QBs on page 1
            { pos: 'RB', min: 2, max: 3 },
            { pos: 'WR', min: 2, max: 3 },
            { pos: 'TE', min: 1, max: 2 },
            { pos: 'K', min: 1, max: 1 },   // Exactly 1 kicker per page
            { pos: 'DEF', min: 1, max: 1 }  // Exactly 1 defender per page
        ];

        let selectedPlayers = [];

        for (const { pos, min, max } of positionPriority) {
            const posPlayers = availablePlayers.filter(p => p.position === pos);
            const roundAllowance = getMaxSelectionsForCurrentRound(pos, [], selectedPlayers);

            // Categorize position players by tier
            const posTopTier = posPlayers.filter(p => topTier.includes(p));
            const posMiddleTier = posPlayers.filter(p => middleTier.includes(p));
            const posBottomTier = posPlayers.filter(p => bottomTier.includes(p));

            // Select minimum players with tier distribution: ~40% top, ~40% middle, ~20% bottom
            let numToSelect = Math.min(min, posPlayers.length, count - selectedPlayers.length, roundAllowance);

            // Shuffle each tier
            const shuffledTop = [...posTopTier].sort(() => 0.5 - Math.random());
            const shuffledMiddle = [...posMiddleTier].sort(() => 0.5 - Math.random());
            const shuffledBottom = [...posBottomTier].sort(() => 0.5 - Math.random());

            // Distribute selections across tiers
            let selectedFromTop = 0;
            let selectedFromMiddle = 0;
            let selectedFromBottom = 0;

            for (let i = 0; i < numToSelect; i++) {
                // Prioritize tier distribution but fall back if tier is empty
                if (selectedFromTop < Math.ceil(numToSelect * 0.4) && shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                } else if (selectedFromMiddle < Math.ceil(numToSelect * 0.4) && shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledBottom.length > 0) {
                    selectedPlayers.push(shuffledBottom.pop());
                    selectedFromBottom++;
                } else if (shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                }
            }

            // If we have room and haven't reached max yet, randomly add more with tier mixing
            const remainingSlots = Math.min(
                max - numToSelect,
                posPlayers.length - numToSelect,
                count - selectedPlayers.length,
                Math.max(0, roundAllowance - numToSelect)
            );
            if (remainingSlots > 0) {
                // Re-categorize remaining players
                const remainingPosPlayers = posPlayers.filter(p => !selectedPlayers.includes(p));
                const remainingTop = remainingPosPlayers.filter(p => topTier.includes(p));
                const remainingMiddle = remainingPosPlayers.filter(p => middleTier.includes(p));
                const remainingBottom = remainingPosPlayers.filter(p => bottomTier.includes(p));

                const shuffledRemainingTop = [...remainingTop].sort(() => 0.5 - Math.random());
                const shuffledRemainingMiddle = [...remainingMiddle].sort(() => 0.5 - Math.random());
                const shuffledRemainingBottom = [...remainingBottom].sort(() => 0.5 - Math.random());

                // Randomly select additional players with tier preference
                for (let i = 0; i < remainingSlots; i++) {
                    const rand = Math.random();
                    if (rand < 0.4 && shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    } else if (rand < 0.8 && shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingBottom.length > 0) {
                        selectedPlayers.push(shuffledRemainingBottom.pop());
                    } else if (shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    }
                }
            }
        }

        // Fill remaining slots with random players from mixed tiers
        const remainingCount = count - selectedPlayers.length;
        if (remainingCount > 0) {
            const remainingPlayers = availablePlayers.filter(p =>
                !selectedPlayers.includes(p) &&
                p.position !== 'K' &&
                p.position !== 'DEF' &&
                canSelectPlayerForCurrentRound(p, [], selectedPlayers)
            );

            // Categorize remaining players by tier
            const remainingTop = remainingPlayers.filter(p => topTier.includes(p));
            const remainingMiddle = remainingPlayers.filter(p => middleTier.includes(p));
            const remainingBottom = remainingPlayers.filter(p => bottomTier.includes(p));

            // Shuffle each tier
            const shuffledRemainingTop = [...remainingTop].sort(() => 0.5 - Math.random());
            const shuffledRemainingMiddle = [...remainingMiddle].sort(() => 0.5 - Math.random());
            const shuffledRemainingBottom = [...remainingBottom].sort(() => 0.5 - Math.random());

            // Prioritize WR and RB, but mix ranks
            const wrRbPlayers = remainingPlayers.filter(p => (p.position === 'WR' || p.position === 'RB'));
            const wrRbTop = wrRbPlayers.filter(p => topTier.includes(p));
            const wrRbMiddle = wrRbPlayers.filter(p => middleTier.includes(p));
            const wrRbBottom = wrRbPlayers.filter(p => bottomTier.includes(p));

            const shuffledWrRbTop = [...wrRbTop].sort(() => 0.5 - Math.random());
            const shuffledWrRbMiddle = [...wrRbMiddle].sort(() => 0.5 - Math.random());
            const shuffledWrRbBottom = [...wrRbBottom].sort(() => 0.5 - Math.random());

            // First fill with WR/RB from mixed tiers
            let wrRbAdded = 0;
            for (let i = 0; i < Math.min(remainingCount, wrRbPlayers.length); i++) {
                const rand = Math.random();
                if (rand < 0.4 && shuffledWrRbTop.length > 0) {
                    selectedPlayers.push(shuffledWrRbTop.pop());
                    wrRbAdded++;
                } else if (rand < 0.7 && shuffledWrRbMiddle.length > 0) {
                    selectedPlayers.push(shuffledWrRbMiddle.pop());
                    wrRbAdded++;
                } else if (shuffledWrRbBottom.length > 0) {
                    selectedPlayers.push(shuffledWrRbBottom.pop());
                    wrRbAdded++;
                } else if (shuffledWrRbMiddle.length > 0) {
                    selectedPlayers.push(shuffledWrRbMiddle.pop());
                    wrRbAdded++;
                } else if (shuffledWrRbTop.length > 0) {
                    selectedPlayers.push(shuffledWrRbTop.pop());
                    wrRbAdded++;
                }
                if (wrRbAdded >= remainingCount) break;
            }

            // Then fill remaining with others from mixed tiers
            const stillNeeded = remainingCount - wrRbAdded;
            if (stillNeeded > 0) {
                for (let i = 0; i < stillNeeded; i++) {
                    const rand = Math.random();
                    if (rand < 0.3 && shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    } else if (rand < 0.7 && shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingBottom.length > 0) {
                        selectedPlayers.push(shuffledRemainingBottom.pop());
                    } else if (shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    }
                }
            }
        }

        console.log(`[getRandomPlayers] Selected ${selectedPlayers.length} players with rank distribution:`, {
            top: selectedPlayers.filter(p => topTier.includes(p)).length,
            middle: selectedPlayers.filter(p => middleTier.includes(p)).length,
            bottom: selectedPlayers.filter(p => bottomTier.includes(p)).length
        });

        return selectedPlayers.slice(0, count);
    }

    // Get balanced players for page 2 (ensuring minimums are met with mixed ranks)
    function getBalancedPagePlayers(count, excludePlayers = []) {
        const availablePlayers = getRemainingUndraftedPlayers(excludePlayers);

        // Sort available players by rank to create relative tiers
        const sortedPlayers = [...availablePlayers].sort((a, b) => a.prerank - b.prerank);
        const totalPlayers = sortedPlayers.length;
        const topTierCount = Math.floor(totalPlayers * 0.25);
        const middleTierCount = Math.floor(totalPlayers * 0.5); // Next 50%
        
        // Create tier arrays based on sorted order
        const topTier = sortedPlayers.slice(0, topTierCount);
        const middleTier = sortedPlayers.slice(topTierCount, topTierCount + middleTierCount);
        const bottomTier = sortedPlayers.slice(topTierCount + middleTierCount);

        // Prioritize positions to ensure minimums are met for page 2 with mixed ranks
        const positionPriority = [
            { pos: 'QB', min: 1, max: 1 },
            { pos: 'RB', min: 1, max: 2 },
            { pos: 'WR', min: 1, max: 2 },
            { pos: 'TE', min: 1, max: 2 },
            { pos: 'K', min: 0, max: 0 },
            { pos: 'DEF', min: 0, max: 0 }
        ];

        let selectedPlayers = [];
        for (const { pos, min, max } of positionPriority) {
            const posPlayers = availablePlayers.filter(p => p.position === pos && !selectedPlayers.includes(p));
            const roundAllowance = getMaxSelectionsForCurrentRound(pos, excludePlayers, selectedPlayers);

            // Categorize position players by tier
            const posTopTier = posPlayers.filter(p => topTier.includes(p));
            const posMiddleTier = posPlayers.filter(p => middleTier.includes(p));
            const posBottomTier = posPlayers.filter(p => bottomTier.includes(p));

            // Select minimum players with tier distribution: ~40% top, ~40% middle, ~20% bottom
            let numToSelect = Math.min(min, posPlayers.length, count - selectedPlayers.length, roundAllowance);

            // Shuffle each tier
            const shuffledTop = [...posTopTier].sort(() => 0.5 - Math.random());
            const shuffledMiddle = [...posMiddleTier].sort(() => 0.5 - Math.random());
            const shuffledBottom = [...posBottomTier].sort(() => 0.5 - Math.random());

            // Distribute selections across tiers
            let selectedFromTop = 0;
            let selectedFromMiddle = 0;
            let selectedFromBottom = 0;

            for (let i = 0; i < numToSelect; i++) {
                // Prioritize tier distribution but fall back if tier is empty
                if (selectedFromTop < Math.ceil(numToSelect * 0.4) && shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                } else if (selectedFromMiddle < Math.ceil(numToSelect * 0.4) && shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledBottom.length > 0) {
                    selectedPlayers.push(shuffledBottom.pop());
                    selectedFromBottom++;
                } else if (shuffledMiddle.length > 0) {
                    selectedPlayers.push(shuffledMiddle.pop());
                    selectedFromMiddle++;
                } else if (shuffledTop.length > 0) {
                    selectedPlayers.push(shuffledTop.pop());
                    selectedFromTop++;
                }
            }

            // If we have room and haven't reached max yet, randomly add more with tier mixing
            const remainingSlots = Math.min(
                max - numToSelect,
                posPlayers.length - numToSelect,
                count - selectedPlayers.length,
                Math.max(0, roundAllowance - numToSelect)
            );
            if (remainingSlots > 0) {
                // Re-categorize remaining players
                const remainingPosPlayers = posPlayers.filter(p => !selectedPlayers.includes(p));
                const remainingTop = remainingPosPlayers.filter(p => topTier.includes(p));
                const remainingMiddle = remainingPosPlayers.filter(p => middleTier.includes(p));
                const remainingBottom = remainingPosPlayers.filter(p => bottomTier.includes(p));

                const shuffledRemainingTop = [...remainingTop].sort(() => 0.5 - Math.random());
                const shuffledRemainingMiddle = [...remainingMiddle].sort(() => 0.5 - Math.random());
                const shuffledRemainingBottom = [...remainingBottom].sort(() => 0.5 - Math.random());

                // Randomly select additional players with tier preference
                for (let i = 0; i < remainingSlots; i++) {
                    const rand = Math.random();
                    if (rand < 0.4 && shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    } else if (rand < 0.8 && shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingBottom.length > 0) {
                        selectedPlayers.push(shuffledRemainingBottom.pop());
                    } else if (shuffledRemainingMiddle.length > 0) {
                        selectedPlayers.push(shuffledRemainingMiddle.pop());
                    } else if (shuffledRemainingTop.length > 0) {
                        selectedPlayers.push(shuffledRemainingTop.pop());
                    }
                }
            }
        }

        // Fill remaining slots with random players from mixed tiers
        const remainingCount = count - selectedPlayers.length;
        if (remainingCount > 0) {
            const remainingPlayers = availablePlayers.filter(p =>
                !selectedPlayers.includes(p) &&
                p.position !== 'K' &&
                p.position !== 'DEF' &&
                canSelectPlayerForCurrentRound(p, excludePlayers, selectedPlayers)
            );

            // Shuffle remaining players from all tiers
            const shuffledRemaining = [...remainingPlayers].sort(() => 0.5 - Math.random());
            selectedPlayers.push(...shuffledRemaining.slice(0, remainingCount));
        }

        return selectedPlayers.slice(0, count);
    }

    function getRoundExtras(requiredPositions, excludePlayers = []) {
        const selectedExtras = [];

        requiredPositions.forEach(position => {
            const availableForPosition = getRemainingUndraftedPlayers(excludePlayers.concat(selectedExtras))
                .filter(player => (
                    player.position === position &&
                    canSelectPlayerForCurrentRound(player, excludePlayers, selectedExtras)
                ));

            if (availableForPosition.length === 0) return;
            const chosen = availableForPosition[Math.floor(Math.random() * availableForPosition.length)];
            if (chosen) selectedExtras.push(chosen);
        });

        return selectedExtras;
    }

    function ensureRequiredPositionsInPool(pool, requiredPositions, excludePlayers = []) {
        const targetCount = pool.length;
        const adjustedPool = [...pool];
        const requiredSet = new Set(requiredPositions || []);

        (requiredPositions || []).forEach(position => {
            const hasPosition = adjustedPool.some(player => player.position === position);
            if (hasPosition) return;

            const replacementCandidates = getRemainingUndraftedPlayers(excludePlayers.concat(adjustedPool))
                .filter(player => (
                    player.position === position &&
                    canSelectPlayerForCurrentRound(player, excludePlayers, adjustedPool)
                ));

            if (replacementCandidates.length === 0) return;
            const replacement = replacementCandidates[Math.floor(Math.random() * replacementCandidates.length)];

            const replaceIndex = adjustedPool.findIndex(player => !requiredSet.has(player.position));
            if (replaceIndex >= 0) {
                adjustedPool[replaceIndex] = replacement;
            } else if (adjustedPool.length < targetCount) {
                adjustedPool.push(replacement);
            }
        });

        return adjustedPool.slice(0, targetCount);
    }

    // Update bid counter
    function fitHeaderBidCounterSingleLine() {
        const bidCounter = document.getElementById('bid-counter');
        if (!bidCounter) return;

        // Reset to max readable size, then shrink only as needed.
        let fontSize = 11;
        bidCounter.style.fontSize = `${fontSize}px`;
        bidCounter.style.letterSpacing = '0';

        while (fontSize > 8 && bidCounter.scrollWidth > bidCounter.clientWidth) {
            fontSize -= 0.5;
            bidCounter.style.fontSize = `${fontSize}px`;
        }

        if (bidCounter.scrollWidth > bidCounter.clientWidth) {
            bidCounter.style.letterSpacing = '-0.02em';
        }
    }

    function updateBidInputsOverbidStatus() {
        const yourTeam = teams.find(t => t.name === username);
        const budget = yourTeam ? yourTeam.budget : 200;
        
        let totalBids = 0;
        Object.values(storedBids).forEach(bid => {
            const amount = parseInt(bid) || 0;
            totalBids += amount;
        });
        
        const hasOverbid = totalBids > budget;
        
        // Apply or remove overbid class to all bid inputs
        document.querySelectorAll('input[data-player-id]').forEach(input => {
            if (hasOverbid) {
                input.classList.add('overbid');
            } else {
                input.classList.remove('overbid');
            }
        });
    }

    function updateBidCounter() {
        const bidCounter = document.getElementById('bid-counter');
        if (!bidCounter) return;
        
        const yourTeam = teams.find(t => t.name === username);
        const budget = yourTeam ? yourTeam.budget : 200;
        
        let totalBids = 0;
        Object.values(storedBids).forEach(bid => {
            const amount = parseInt(bid) || 0;
            totalBids += amount;
        });
        
        const remaining = Math.max(0, budget - totalBids);
        bidCounter.textContent = `Total Bids: $${totalBids} | Budget: $${budget} | Remaining: $${remaining}`;
        
        // Color code based on remaining
        if (remaining < 0) {
            bidCounter.style.color = '#dc3545'; // Red for over
        } else if (remaining < 20) {
            bidCounter.style.color = '#ffc107'; // Yellow for low
        } else {
            bidCounter.style.color = '#28a745'; // Green for good
        }

        // Update bid input overbid status
        updateBidInputsOverbidStatus();
        
        fitHeaderBidCounterSingleLine();
    }

    function getDraftRoomPlayerStatus(playerName) {
        const yourTeam = teams.find(t => t.name === username);
        const userRosterNames = yourTeam ? yourTeam.roster.map(p => p.name) : [];
        const currentRoundNames = (window.currentRoundPlayers || window.syncedRoundPlayers || []).map(p => p.name);
        const playerObj = players.find(p => p.name === playerName);

        if (userRosterNames.includes(playerName)) return 'user-roster';
        if (playerObj && playerObj.owner && !isCurrentUserTeamName(playerObj.owner)) return 'drafted';
        if (currentRoundNames.includes(playerName)) return 'current-round';
        if (playerObj && playerObj.shown && !playerObj.owner) return 'passed';
        return 'available';
    }

    function normalizeByeWeekValue(rawValue) {
        const numeric = Number.parseInt(rawValue, 10);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric;
        }
        return null;
    }

    const BYE_WEEK_BY_TEAM = Object.freeze({
        ATL: 5,
        ARI: 8,
        BAL: 7,
        BUF: 7,
        CAR: 5,
        CHI: 5,
        CIN: 6,
        CLE: 9,
        DAL: 10,
        DEN: 10,
        DET: 6,
        GB: 5,
        HOU: 6,
        IND: 11,
        JAC: 7,
        KC: 5,
        LAC: 7,
        LAR: 8,
        LV: 13,
        MIA: 6,
        MIN: 6,
        NE: 11,
        NO: 8,
        NYG: 8,
        NYJ: 9,
        PHI: 9,
        PIT: 5,
        SEA: 8,
        SF: 8,
        TB: 9,
        TEN: 9,
        WAS: 7
    });

    const TEAM_ABBREVIATION_ALIASES = Object.freeze({
        JAX: 'JAC',
        LA: 'LAR',
        OAK: 'LV',
        SD: 'LAC',
        STL: 'LAR',
        WSH: 'WAS'
    });

    function normalizeTeamAbbreviation(value) {
        const team = String(value || '').trim().toUpperCase();
        return TEAM_ABBREVIATION_ALIASES[team] || team;
    }

    function resolvePlayerTeamAbbreviation(player) {
        if (!player || typeof player !== 'object') return '';
        const rawTeam = player.team ?? player.playerTeam ?? player.teamAbbr ?? player.abbr ?? player.nflTeam;
        return normalizeTeamAbbreviation(rawTeam);
    }

    function normalizePlayerLookupKey(name) {
        return String(name || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function findDraftRoomMasterPlayer(player) {
        if (!player || typeof player !== 'object') return null;

        const playerId = Number.parseInt(player.id, 10);
        if (Number.isFinite(playerId) && playerId > 0) {
            const byId = players.find((entry) => Number.parseInt(entry && entry.id, 10) === playerId);
            if (byId) return byId;
        }

        const lookupKey = normalizePlayerLookupKey(player.name);
        if (!lookupKey) return null;
        return players.find((entry) => normalizePlayerLookupKey(entry && entry.name) === lookupKey) || null;
    }

    function hydrateRosterPlayerMetadata(player) {
        if (!player || typeof player !== 'object') return player;

        const master = findDraftRoomMasterPlayer(player);
        if (!player.team && master && master.team) {
            player.team = String(master.team).trim().toUpperCase();
        }

        const currentBye = extractPlayerByeWeek(player);
        if (currentBye !== null) {
            player.byeWeek = currentBye;
            return player;
        }

        const masterBye = extractPlayerByeWeek(master);
        if (masterBye !== null) {
            player.byeWeek = masterBye;
            return player;
        }

        const teamAbbr = resolvePlayerTeamAbbreviation(player) || resolvePlayerTeamAbbreviation(master);
        if (teamAbbr && BYE_WEEK_BY_TEAM[teamAbbr]) {
            player.byeWeek = BYE_WEEK_BY_TEAM[teamAbbr];
        }

        return player;
    }

    function extractPlayerByeWeek(player) {
        if (!player || typeof player !== 'object') return null;
        return normalizeByeWeekValue(
            player.byeWeek
            ?? player.bye
            ?? player.bye_week
            ?? player.BYE
            ?? player.BYEWEEK
            ?? player.byeweek
        );
    }

    function resolveDraftRoomByeWeek(player) {
        hydrateRosterPlayerMetadata(player);

        const directBye = extractPlayerByeWeek(player);
        if (directBye !== null) {
            return directBye;
        }

        const directTeam = resolvePlayerTeamAbbreviation(player);
        if (directTeam && BYE_WEEK_BY_TEAM[directTeam]) {
            return BYE_WEEK_BY_TEAM[directTeam];
        }

        const matched = findDraftRoomMasterPlayer(player);

        const matchedBye = extractPlayerByeWeek(matched);
        if (matchedBye !== null) {
            return matchedBye;
        }

        const matchedTeam = resolvePlayerTeamAbbreviation(matched);
        if (matchedTeam && BYE_WEEK_BY_TEAM[matchedTeam]) {
            return BYE_WEEK_BY_TEAM[matchedTeam];
        }

        return null;
    }

    function resolveDraftRoomFinalPrice(player) {
        const direct = formatFinalPrice(player);
        if (direct !== null) return direct;

        const playerId = Number.parseInt(player && player.id, 10);
        const matched = Number.isFinite(playerId)
            ? players.find(p => Number.parseInt(p && p.id, 10) === playerId)
            : players.find(p => p && p.name === player.name);
        return formatFinalPrice(matched);
    }

    function formatFinalPrice(player) {
        const raw = Number(player && (
            player.bid
            ?? player.bidAmount
            ?? player.pricePaid
            ?? player.finalBid
            ?? player.finalPrice
            ?? player.winningBid
            ?? player.cost
            ?? player.price
        ));
        if (!Number.isFinite(raw)) return null;
        return Math.max(0, Math.round(raw));
    }

    function buildRosterPlayerInline(player) {
        if (!player) return '';
        hydrateRosterPlayerMetadata(player);
        const byeWeek = resolveDraftRoomByeWeek(player);
        const byeBadge = `<span class="roster-player-bye">W${byeWeek !== null ? byeWeek : '-'}</span>`;
        const finalPrice = resolveDraftRoomFinalPrice(player);
        const finalPriceBadge = `<span class="roster-player-price">$${finalPrice !== null ? finalPrice : 0}</span>`;

        return `
            <span class="roster-player-name">${player.name}</span>
            ${byeBadge}
            ${finalPriceBadge}
        `;
    }

    function getDraftRoomDefaultRankings() {
        if (draftRoomRankingsPosition !== 'ALL') {
            const pos = String(draftRoomRankingsPosition || '').trim().toUpperCase();
            const fromDefaults = Array.isArray(draftRoomDefaultRankings) ? draftRoomDefaultRankings : [];
            const filteredDefaults = fromDefaults
                .filter((p) => String(p && p.position || '').trim().toUpperCase() === pos)
                .sort((a, b) => {
                    const rankA = Number.isFinite(a && a.prerank) ? a.prerank : 9999;
                    const rankB = Number.isFinite(b && b.prerank) ? b.prerank : 9999;
                    return rankA - rankB;
                });

            if (filteredDefaults.length > 0) {
                return filteredDefaults.map((p) => ({
                    name: p.name,
                    position: p.position || pos,
                    team: p.team || '—',
                    avgValue: p.avgValue || 0,
                    byeWeek: extractPlayerByeWeek(p),
                }));
            }

            if (Object.prototype.hasOwnProperty.call(draftRoomDefaultPositionRankings, pos)) {
                const posRankings = Array.isArray(draftRoomDefaultPositionRankings[pos]) ? draftRoomDefaultPositionRankings[pos] : [];
                if (posRankings.length > 0) {
                    return posRankings.map((p) => ({
                        name: p.name,
                        position: p.position || pos,
                        team: p.team || '—',
                        avgValue: p.avgValue || 0,
                        byeWeek: extractPlayerByeWeek(p),
                    }));
                }
            }
        }

        if (Array.isArray(draftRoomDefaultRankings) && draftRoomDefaultRankings.length > 0) {
            return [...draftRoomDefaultRankings]
                .sort((a, b) => {
                    const rankA = Number.isFinite(a.prerank) ? a.prerank : 9999;
                    const rankB = Number.isFinite(b.prerank) ? b.prerank : 9999;
                    return rankA - rankB;
                })
                .map((p) => ({
                    name: p.name,
                    position: p.position || 'UNK',
                    team: p.team || '—',
                    avgValue: p.avgValue || 0,
                    byeWeek: extractPlayerByeWeek(p),
                }));
        }

        return [...players]
            .filter(p => p && p.name)
            .sort((a, b) => {
                const rankA = Number.isFinite(a.prerank) ? a.prerank : (Number.isFinite(a.positionRank) ? a.positionRank : 9999);
                const rankB = Number.isFinite(b.prerank) ? b.prerank : (Number.isFinite(b.positionRank) ? b.positionRank : 9999);
                return rankA - rankB;
            })
            .map(p => ({
                name: p.name,
                position: p.position || 'UNK',
                team: p.team || '—',
                avgValue: p.avgValue || p.value || 0,
                byeWeek: extractPlayerByeWeek(p),
            }));
    }

    function getDraftRoomDatabaseRankings() {
        try {
            const raw = localStorage.getItem(DATABASE_RANKINGS_SET_KEY);
            if (!raw) return [];

            const parsed = JSON.parse(raw);
            const rankings = Array.isArray(parsed && parsed.rankings) ? parsed.rankings : [];
            const baseDraftCount = Number.parseInt(parsed && parsed.completedDraftCount, 10) || 0;

            const draftedNow = new Set();
            (Array.isArray(teams) ? teams : []).forEach(team => {
                if (!team || !Array.isArray(team.roster)) return;
                team.roster.forEach(player => {
                    const id = Number.parseInt(player && player.id, 10);
                    if (Number.isFinite(id) && id > 0) draftedNow.add(id);
                });
            });

            const includeLiveDraft = draftedNow.size > 0;
            const totalDraftSamples = baseDraftCount + (includeLiveDraft ? 1 : 0);

            return [...rankings]
                .map(entry => {
                    const draftedCountBase = Number.parseInt(entry.draftedCount, 10) || 0;
                    const draftedCountLive = draftedCountBase + (includeLiveDraft && draftedNow.has(entry.playerId) ? 1 : 0);
                    const liveDraftPct = totalDraftSamples > 0
                        ? Number(((draftedCountLive / totalDraftSamples) * 100).toFixed(1))
                        : Number(entry.draftPct || 0);

                    return {
                        name: entry.name,
                        position: entry.position || 'UNK',
                        team: 'DATABASE',
                        avgValue: Number(entry.avgValue || 0),
                        byeWeek: extractPlayerByeWeek(entry),
                        draftPct: liveDraftPct,
                        auctionCount: Number(entry.auctionCount || 0),
                        updatedBy: 'DATABASE'
                    };
                })
                .sort((a, b) => {
                    if (b.avgValue !== a.avgValue) return b.avgValue - a.avgValue;
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });
        } catch (e) {
            console.warn('[DATABASE] Failed to load DATABASE rankings set:', e);
            return [];
        }
    }

    function hasDraftRoomPersonalRankings() {
        try {
            const raw = localStorage.getItem('userRankings');
            if (!raw) return false;

            const parsed = JSON.parse(raw);
            const tiersHavePlayers = (tiers) => {
                return (Array.isArray(tiers) ? tiers : []).some((tier) => {
                    return Array.isArray(tier.players) && tier.players.some((player) => player && player.name);
                });
            };

            if (parsed && parsed.boardsByPos && typeof parsed.boardsByPos === 'object') {
                return Object.values(parsed.boardsByPos).some(tiersHavePlayers);
            }

            return tiersHavePlayers(parsed && parsed.tiers);
        } catch (e) {
            return false;
        }
    }

    function getDraftRoomPersonalRankings() {
        try {
            const raw = localStorage.getItem('userRankings');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            const flat = [];

            const appendTierPlayers = (tiers) => {
                (Array.isArray(tiers) ? tiers : []).forEach(tier => {
                    const tierPlayers = Array.isArray(tier.players) ? tier.players : [];
                    tierPlayers.forEach(player => {
                        flat.push({
                            name: player.name,
                            position: player.position || 'UNK',
                            team: player.team || '—',
                            avgValue: player.avgValue || 0,
                            byeWeek: extractPlayerByeWeek(player),
                        });
                    });
                });
            };

            if (parsed && parsed.boardsByPos && typeof parsed.boardsByPos === 'object') {
                const boardKey = draftRoomRankingsPosition === 'ALL' ? 'ALL' : draftRoomRankingsPosition;
                appendTierPlayers(parsed.boardsByPos[boardKey]);
                return flat;
            }

            appendTierPlayers(parsed && parsed.tiers);
            return flat;
        } catch (e) {
            return [];
        }
    }

    function buildRosterSlotRow(slotLabel, player) {
        const lightStyle = isDraftLightMode();
        const cardInlineStyle = lightStyle
            ? ' style="background:#ffffff !important;border-color:rgba(23,50,77,0.34) !important;opacity:1 !important;mix-blend-mode:normal !important;position:relative;z-index:2;"'
            : '';
        const valueInlineStyle = lightStyle
            ? ' style="color:#000000 !important;-webkit-text-fill-color:#000000 !important;font-weight:800 !important;text-shadow:none !important;opacity:1 !important;filter:none !important;"'
            : '';
        return `
            <div class="roster-slot-card"${cardInlineStyle}>
                <span class="roster-slot-label">${slotLabel}</span>
                <span class="roster-slot-value"${valueInlineStyle}>${buildRosterPlayerInline(player)}</span>
            </div>
        `;
    }

    function buildBenchPlayerRow(player, label = 'BN') {
        return `
            <div class="roster-slot-card">
                <span class="roster-slot-label">${label}</span>
                <span class="roster-slot-value">${buildRosterPlayerInline(player)}</span>
            </div>
        `;
    }

    function renderBenchSlots(container, benchPlayers) {
        if (!container) return;

        const safeBenchPlayers = Array.isArray(benchPlayers) ? benchPlayers : [];
        const maxBench = Number.parseInt(rosterSettings.BN, 10) || 0;
        
        // First maxBench players show as "BN"
        const benchSlots = [];
        for (let i = 0; i < maxBench; i++) {
            benchSlots.push(safeBenchPlayers[i] || null);
        }

        // Any bench players beyond the maxBench amount are labeled XBN (overage to be cut)
        const overflowPlayers = safeBenchPlayers.slice(maxBench);

        let benchHTML = benchSlots.map(player => buildBenchPlayerRow(player, 'BN')).join('');
        if (overflowPlayers.length > 0) {
            benchHTML += overflowPlayers.map(player => buildBenchPlayerRow(player, 'XBN')).join('');
        }

        container.innerHTML = benchHTML || '<p class="bench-empty-state">Your bench lineup will be displayed here.</p>';
    }

    function getConfiguredSlotBlueprint() {
        const slots = [];
        const addSlots = (label, count, eligiblePositions) => {
            for (let i = 1; i <= count; i++) {
                const slotLabel = count === 1 ? label : `${label}${i}`;
                slots.push({ label: slotLabel, eligible: eligiblePositions });
            }
        };

        addSlots('QB', rosterSettings.QB || 0, ['QB']);
        addSlots('WR', rosterSettings.WR || 0, ['WR']);
        addSlots('RB', rosterSettings.RB || 0, ['RB']);
        addSlots('TE', rosterSettings.TE || 0, ['TE']);
        addSlots('FLEX', rosterSettings.FLEX || 0, ['RB', 'WR', 'TE']);
        addSlots('K', rosterSettings.K || 0, ['K']);
        addSlots('DEF', rosterSettings.DEF || 0, ['DEF']);
        return slots;
    }

    function assignRosterToSlots(roster) {
        const used = [];
        const assignedSlots = getConfiguredSlotBlueprint().map(slot => {
            const player = (roster || [])
                .filter(p => slot.eligible.includes(p.position) && !used.includes(p))
                .sort((a, b) => a.prerank - b.prerank)[0] || null;
            if (player) used.push(player);
            return { label: slot.label, player };
        });
        const bench = (roster || []).filter(p => !used.includes(p)).sort((a, b) => a.prerank - b.prerank);
        return { assignedSlots, bench };
    }

    function renderRosterRequirementsSummary() {
        const summary = document.getElementById('roster-requirements');
        if (summary) {
            summary.remove();
        }

        const benchTitle = document.getElementById('bench-title');
        if (benchTitle) {
            // Keep the bench section but hide the heading label text.
            benchTitle.textContent = '';
            benchTitle.style.display = 'none';
        }
    }

    function loadSharedStarredNames() {
        try {
            const raw = localStorage.getItem(STARRED_PLAYERS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string' && name) : []);
        } catch (e) {
            return new Set();
        }
    }

    function saveSharedStarredNames(starredNames) {
        try {
            localStorage.setItem(STARRED_PLAYERS_KEY, JSON.stringify([...starredNames].sort()));
            localStorage.setItem('defaultRankingsStarred', JSON.stringify([...starredNames].sort()));
        } catch (e) {
            // ignore
        }
    }

    function loadDraftTempStarredNames() {
        try {
            const raw = localStorage.getItem(DRAFT_TEMP_STARRED_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string' && name) : []);
        } catch (e) {
            return new Set();
        }
    }

    function saveDraftTempStarredNames(starredNames) {
        try {
            localStorage.setItem(DRAFT_TEMP_STARRED_KEY, JSON.stringify([...starredNames].sort()));
        } catch (e) {
            // ignore
        }
    }

    function getEffectiveStarredNames() {
        const starred = loadSharedStarredNames();
        const draftStarred = loadDraftTempStarredNames();
        draftStarred.forEach(name => starred.add(name));
        return starred;
    }

    function toggleDraftStarredPlayer(playerName) {
        if (!playerName) return;

        const draftStarred = loadDraftTempStarredNames();
        const sharedStarred = loadSharedStarredNames();
        const currentlyStarred = draftStarred.has(playerName) || sharedStarred.has(playerName);

        if (currentlyStarred) {
            draftStarred.delete(playerName);
            sharedStarred.delete(playerName);
        } else {
            draftStarred.add(playerName);
            sharedStarred.add(playerName);
        }
        saveDraftTempStarredNames(draftStarred);
        saveSharedStarredNames(sharedStarred);

        renderDraftRoomRankings();
        if (window.currentRoundPlayers) {
            updateUI(window.currentRoundPlayers);
        }
    }

    function getStarredDraftTargets() {
        try {
            const starredNames = getEffectiveStarredNames();

            const raw = localStorage.getItem('userRankings');
            const parsed = raw ? JSON.parse(raw) : null;

            const collectFromTiers = (tiers) => {
                (Array.isArray(tiers) ? tiers : []).forEach(tier => {
                    const tierPlayers = Array.isArray(tier.players) ? tier.players : [];
                    tierPlayers.forEach(player => {
                        if (player && player.starred && player.name) {
                            starredNames.add(player.name);
                        }
                    });
                });
            };
            if (parsed && parsed.boardsByPos && typeof parsed.boardsByPos === 'object') {
                Object.values(parsed.boardsByPos).forEach(collectFromTiers);
                return starredNames;
            }

            collectFromTiers(parsed && parsed.tiers);
            return starredNames;
        } catch (e) {
            return new Set();
        }
    }

    function renderDraftRoomRankings() {
        const list = document.getElementById('draftroom-rankings-list');
        if (!list) return;
        const starredNames = getEffectiveStarredNames();

        if (draftRoomRankingsMode === 'database') {
            syncPlayerAVsWithRankings();
        }

        const sourcePlayers = draftRoomRankingsMode === 'default'
            ? getDraftRoomDefaultRankings()
            : (draftRoomRankingsMode === 'database' ? getDraftRoomDatabaseRankings() : getDraftRoomPersonalRankings());

        const filteredPlayers = draftRoomRankingsPosition === 'ALL'
            ? sourcePlayers
            : sourcePlayers.filter(p => p.position === draftRoomRankingsPosition);

        if (!sourcePlayers.length) {
            let emptyMessage = 'No personal rankings saved yet.';
            if (draftRoomRankingsMode === 'default') {
                emptyMessage = 'Default rankings unavailable.';
            } else if (draftRoomRankingsMode === 'database') {
                emptyMessage = 'DATABASE rankings unavailable. Requires at least 30 completed drafts.';
            }
            list.innerHTML = `<div style="font-size:12px;color:#6b7280;padding:6px;">${emptyMessage}</div>`;
            return;
        }

        if (!filteredPlayers.length) {
            if (draftRoomRankingsMode === 'personal') {
                list.innerHTML = `<div style="font-size:12px;color:#9aa0a6;padding:8px;">No personal rankings for ${draftRoomRankingsPosition}. Switch to Default rankings for this position.</div>`;
            } else if (draftRoomRankingsMode === 'database') {
                list.innerHTML = `<div style="font-size:12px;color:#9aa0a6;padding:8px;">No DATABASE rankings found for ${draftRoomRankingsPosition}. Keep drafting to build more market data.</div>`;
            } else {
                list.innerHTML = `<div style="font-size:12px;color:#9aa0a6;padding:8px;">No default rankings found for ${draftRoomRankingsPosition}.</div>`;
            }
            return;
        }

        const visible = filteredPlayers.slice(0, 120);
        list.innerHTML = visible.map((player, idx) => {
            const status = getDraftRoomPlayerStatus(player.name);
            const isStarred = starredNames.has(player.name);
            const byeWeek = resolveDraftRoomByeWeek(player);
            const byeBadge = byeWeek ? `<span class="bye-badge">BYE ${byeWeek}</span>` : '';
            const owner = (() => {
                const matched = players.find(p => p.name === player.name);
                return matched && matched.owner ? matched.owner : '';
            })();
            const databaseMeta = draftRoomRankingsMode === 'database'
                ? `<span class="r-owner">drafted ${player.draftPct || 0}%</span>`
                : '';

            return `
                <div class="draftroom-rankings-item status-${status}${isStarred ? ' starred' : ''}" data-player-name="${player.name}">
                    <button class="draft-star-btn${isStarred ? ' active' : ''}" type="button" aria-label="${isStarred ? 'Unstar' : 'Star'} ${player.name}" aria-pressed="${isStarred ? 'true' : 'false'}" title="${isStarred ? 'Starred player' : 'Mark as starred'}">
                        <svg class="draft-star-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                            <polygon points="50,4 61,36 96,40 70,62 78,96 50,78 22,96 30,62 4,40 39,36"></polygon>
                        </svg>
                    </button>
                    <span class="r-num">${idx + 1}</span>
                    <span class="pos-badge pos-${player.position}">${player.position}</span>
                    ${byeBadge}
                    <span class="r-name">${player.name}
                        ${owner ? ` <span class="r-owner">→ ${owner}</span>` : ''}
                        ${databaseMeta}
                    </span>
                    <span class="r-av">AV $${player.avgValue}</span>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.draft-star-btn').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const row = button.closest('.draftroom-rankings-item');
                const playerName = row ? row.dataset.playerName : '';
                toggleDraftStarredPlayer(playerName);
            });
        });
    }

    function setupDraftRoomRankingsTabs() {
        const tabs = document.querySelectorAll('.draftroom-rankings-tab');
        if (!tabs || tabs.length === 0) return;

        tabs.forEach(t => t.classList.toggle('active', t.dataset.rankingsMode === draftRoomRankingsMode));

        tabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                const requestedMode = tab.dataset.rankingsMode;
                if (requestedMode === 'default' || requestedMode === 'personal' || requestedMode === 'database') {
                    draftRoomRankingsMode = requestedMode;
                } else {
                    draftRoomRankingsMode = 'personal';
                }
                try {
                    localStorage.setItem(DRAFTROOM_RANKINGS_MODE_KEY, draftRoomRankingsMode);
                } catch (e) {
                    // ignore
                }
                tabs.forEach(t => t.classList.toggle('active', t === tab));

                if (draftRoomRankingsMode === 'default') {
                    await loadDraftRoomDefaultRankings(true);
                    await loadAllDraftRoomPositionRankings(true);
                }

                renderDraftRoomRankings();
            });
        });
    }

    function setupDraftRoomRankingsPositionTabs() {
        const tabs = document.querySelectorAll('.draftroom-rankings-pos-tab');
        if (!tabs || tabs.length === 0) return;

        tabs.forEach(t => t.classList.toggle('active', t.dataset.rankingsPos === draftRoomRankingsPosition));

        tabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                draftRoomRankingsPosition = tab.dataset.rankingsPos || 'ALL';
                tabs.forEach(t => t.classList.toggle('active', t === tab));
                if (draftRoomRankingsMode === 'default') {
                    await loadDraftRoomDefaultRankings(true);
                    if (draftRoomRankingsPosition !== 'ALL') {
                        await loadDraftRoomPositionRankings(draftRoomRankingsPosition, true);
                    }
                }
                renderDraftRoomRankings();
            });
        });
    }

    function refreshDraftRoomRankingsForVisiblePane(forceRefresh = false) {
        const shouldRefresh = draftRoomRightViewMode === 'rankings' && draftRoomRankingsMode === 'default';
        if (!shouldRefresh) return Promise.resolve();
        if (draftRoomRankingsRefreshInFlight) return draftRoomRankingsRefreshInFlight;

        draftRoomRankingsRefreshInFlight = (async () => {
            try {
                await loadDraftRoomDefaultRankings(forceRefresh);
                await loadAllDraftRoomPositionRankings(forceRefresh);
            } catch (error) {
                console.warn('[silentdraft] Rankings pane refresh failed:', error);
            } finally {
                draftRoomRankingsRefreshInFlight = null;
            }

            if (draftRoomRightViewMode === 'rankings') {
                renderDraftRoomRankings();
            }
        })();

        return draftRoomRankingsRefreshInFlight;
    }

    function setupRightViewTabs() {
        const tabs = document.querySelectorAll('.right-view-tab');
        if (!tabs || tabs.length === 0) return;

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const requested = tab.dataset.rightView;
                draftRoomRightViewMode = (requested === 'rankings' || requested === 'chat') ? requested : 'budgets';
                try {
                    localStorage.setItem(DRAFTROOM_RIGHT_VIEW_KEY, draftRoomRightViewMode);
                } catch (e) {
                    // ignore
                }
                applyRightViewMode();
            });
        });
    }

    function updateDraftChatUnreadBadge() {
        const badge = document.getElementById('chat-tab-badge');
        if (!badge) return;

        if (draftChatUnreadCount > 0) {
            badge.hidden = false;
            badge.textContent = draftChatUnreadCount > 99 ? '99+' : String(draftChatUnreadCount);
        } else {
            badge.hidden = true;
            badge.textContent = '0';
        }
        updateDraftAppChatBadge();
    }

    function updateDraftAppChatBadge() {
        const appBadge = document.getElementById('app-chat-badge');
        if (!appBadge) return;
        if (draftChatUnreadCount > 0) {
            appBadge.hidden = false;
            appBadge.textContent = draftChatUnreadCount > 99 ? '99+' : String(draftChatUnreadCount);
        } else {
            appBadge.hidden = true;
            appBadge.textContent = '0';
        }
    }

    function isDraftAppSectionNavSupported() {
        const isInstalled = document.body && document.body.classList.contains('pwa-installed');
        return Boolean(isInstalled);
    }

    function applyDraftAppSectionMode(section, options = {}) {
        const mode = (section === 'roster' || section === 'budgets' || section === 'rankings' || section === 'chat') ? section : 'players';
        draftAppSectionViewMode = mode;

        if (mode === 'budgets' || mode === 'rankings' || mode === 'chat') {
            draftRoomRightViewMode = mode;
            try {
                localStorage.setItem(DRAFTROOM_RIGHT_VIEW_KEY, draftRoomRightViewMode);
            } catch (e) {
                // ignore
            }
            applyRightViewMode();
        }

        if (document.body && draftAppSectionNavEnabled) {
            document.body.setAttribute('data-draft-app-section', draftAppSectionViewMode);
        }

        const navButtons = document.querySelectorAll('.silentdraft-app-nav-btn');
        navButtons.forEach((button) => {
            button.classList.toggle('is-active', button.dataset.sdSection === draftAppSectionViewMode);
        });

        if (mode === 'chat') {
            setTimeout(() => {
                const chatInput = document.getElementById('draft-chat-input');
                if (chatInput) chatInput.focus();
            }, 60);
        }

        if (options.persist !== false) {
            try {
                localStorage.setItem(DRAFT_APP_SECTION_VIEW_KEY, draftAppSectionViewMode);
            } catch (e) {
                // ignore
            }
        }
    }

    function refreshDraftAppSectionNavState() {
        const nav = document.getElementById('silentdraft-app-nav');
        if (!nav || !document.body) return;

        const enabled = isDraftAppSectionNavSupported();
        draftAppSectionNavEnabled = enabled;
        nav.hidden = !enabled;
        document.body.classList.toggle('silentdraft-app-nav-enabled', enabled);

        if (!enabled) {
            document.body.removeAttribute('data-draft-app-section');
            return;
        }

        applyDraftAppSectionMode(draftAppSectionViewMode, { persist: false });
        updateDraftAppChatBadge();
    }

    function setupDraftAppSectionNav() {
        const nav = document.getElementById('silentdraft-app-nav');
        if (!nav) return;

        nav.querySelectorAll('.silentdraft-app-nav-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const requested = button.dataset.sdSection;
                applyDraftAppSectionMode(requested, { persist: true });
            });
        });

        if (draftAppSectionViewMode === 'budgets' || draftAppSectionViewMode === 'rankings' || draftAppSectionViewMode === 'chat') {
            draftRoomRightViewMode = draftAppSectionViewMode;
        }

        refreshDraftAppSectionNavState();
        window.addEventListener('resize', refreshDraftAppSectionNavState);
    }

    function applyRightViewMode() {
        const budgetsView = document.getElementById('right-budgets-view');
        const rankingsView = document.getElementById('right-rankings-view');
        const chatView = document.getElementById('right-chat-view');
        const tabs = document.querySelectorAll('.right-view-tab');
        const showBudgets = draftRoomRightViewMode === 'budgets';
        const showRankings = draftRoomRightViewMode === 'rankings';
        const showChat = draftRoomRightViewMode === 'chat';

        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.rightView === draftRoomRightViewMode);
        });

        // Reapply active tab styling immediately in light mode
        const html = document.documentElement;
        if (html.getAttribute('data-theme') === 'light') {
            const allTabs = document.querySelectorAll('.right-view-tab');
            allTabs.forEach(el => {
                const isActive = el.classList.contains('active');
                if (isActive) {
                    el.style.setProperty('background-color', '#f0f0f0', 'important');
                    el.style.setProperty('color', '#000000', 'important');
                    el.style.setProperty('border-color', '#1d4f7a', 'important');
                    el.style.setProperty('border-width', '2px', 'important');
                } else {
                    el.style.setProperty('background-color', '#f0f0f0', 'important');
                    el.style.setProperty('color', '#000000', 'important');
                    el.style.setProperty('border-color', '#ccc', 'important');
                    el.style.setProperty('border-width', '1px', 'important');
                }
            });
        }

        if (budgetsView) {
            budgetsView.hidden = !showBudgets;
            budgetsView.classList.toggle('right-view-hidden', !showBudgets);
            budgetsView.style.display = showBudgets ? 'block' : 'none';
        }
        if (rankingsView) {
            rankingsView.hidden = !showRankings;
            rankingsView.classList.toggle('right-view-hidden', !showRankings);
            rankingsView.style.display = showRankings ? 'flex' : 'none';
        }
        if (chatView) {
            chatView.hidden = !showChat;
            chatView.classList.toggle('right-view-hidden', !showChat);
            chatView.style.display = showChat ? 'flex' : 'none';
        }

        if (showRankings) {
            renderDraftRoomRankings();
            void refreshDraftRoomRankingsForVisiblePane(true);
        }
        if (showChat) {
            draftChatUnreadCount = 0;
            updateDraftChatUnreadBadge();
            renderDraftChatMessages();
            const chatInput = document.getElementById('draft-chat-input');
            if (chatInput) chatInput.focus();
        }

        updateDraftAppChatBadge();
    }

    function formatDraftChatTime(timestamp) {
        const safe = Number.parseInt(timestamp, 10);
        const value = Number.isFinite(safe) ? safe : Date.now();
        const dt = new Date(value);
        const hours = String(dt.getHours()).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function extractFirstUrl(text) {
        const value = String(text || '');
        const match = value.match(/https?:\/\/[^\s]+/i);
        if (!match) return '';

        // Mobile keyboards sometimes include trailing punctuation around shared URLs.
        let cleaned = String(match[0] || '').trim();
        while (/[),.!?:;]$/.test(cleaned)) {
            cleaned = cleaned.slice(0, -1);
        }
        return cleaned;
    }

    function extractGiphyIdFromPath(pathname) {
        const value = String(pathname || '').trim();
        if (!value) return '';

        const mediaMatch = value.match(/^\/media\/([A-Za-z0-9]+)(?:\/|$)/i);
        if (mediaMatch && mediaMatch[1]) return mediaMatch[1];

        const slugMatch = value.match(/-([A-Za-z0-9]+)(?:\/|$)/);
        if (slugMatch && slugMatch[1]) return slugMatch[1];

        return '';
    }

    function resolveKnownGifUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) return '';

        try {
            const parsed = new URL(value);
            if (!/^https?:$/i.test(parsed.protocol)) return '';

            const host = String(parsed.hostname || '').toLowerCase().replace(/^www\./, '');
            const pathname = String(parsed.pathname || '');
            const pathnameLower = pathname.toLowerCase();
            const searchLower = String(parsed.search || '').toLowerCase();
            const hashLower = String(parsed.hash || '').toLowerCase();

            const looksAnimated = /\.(gif|webp)$/i.test(pathnameLower) ||
                pathnameLower.includes('/giphy.gif') ||
                pathnameLower.includes('/tenor.gif') ||
                searchLower.includes('format=gif') ||
                hashLower.includes('.gif');

            if (looksAnimated) {
                return parsed.toString();
            }

            if (host.endsWith('giphy.com')) {
                const giphyId = extractGiphyIdFromPath(pathname);
                if (giphyId) {
                    return `https://media.giphy.com/media/${giphyId}/giphy.gif`;
                }
            }
        } catch (_error) {
            return '';
        }

        return '';
    }

    function getDirectGifUrl(text) {
        const rawUrl = extractFirstUrl(text);
        if (!rawUrl) return '';
        return resolveKnownGifUrl(rawUrl);
    }

    function normalizeOutgoingDraftChatText(rawText) {
        const textValue = String(rawText || '').trim();
        if (!textValue) return '';

        const rawUrl = extractFirstUrl(textValue);
        if (!rawUrl) return textValue;

        const resolvedUrl = resolveKnownGifUrl(rawUrl);
        if (!resolvedUrl) return textValue;
        if (resolvedUrl === rawUrl) return textValue;

        return textValue.replace(rawUrl, resolvedUrl);
    }

    function renderDraftChatTextContent(container, rawText) {
        const textValue = String(rawText || '');
        const gifUrl = getDirectGifUrl(textValue);
        if (!gifUrl) {
            container.textContent = textValue;
            return;
        }

        const caption = textValue.replace(gifUrl, '').trim();
        if (caption) {
            const captionNode = document.createElement('div');
            captionNode.textContent = caption;
            container.appendChild(captionNode);
        }

        const preview = document.createElement('img');
        preview.className = 'draft-chat-gif-preview';
        preview.src = gifUrl;
        preview.alt = 'GIF preview';
        preview.loading = 'lazy';
        preview.decoding = 'async';
        preview.referrerPolicy = 'no-referrer';
        container.appendChild(preview);

        const link = document.createElement('a');
        link.className = 'draft-chat-gif-link';
        link.href = gifUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open GIF';
        container.appendChild(link);
    }

    function renderDraftChatMessages() {
        const list = document.getElementById('draft-chat-list');
        if (!list) return;

        list.innerHTML = '';

        if (!draftChatMessages || draftChatMessages.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'draft-chat-empty';
            empty.textContent = 'No chat messages yet. Start the conversation.';
            list.appendChild(empty);
            return;
        }

        draftChatMessages.slice(-DRAFT_CHAT_MAX_MESSAGES).forEach((message) => {
            const row = document.createElement('div');
            row.className = 'draft-chat-item';

            const meta = document.createElement('div');
            meta.className = 'draft-chat-meta';

            const author = document.createElement('span');
            author.className = 'draft-chat-author';
            author.textContent = String(message.username || 'Member');

            const time = document.createElement('span');
            time.className = 'draft-chat-time';
            time.textContent = formatDraftChatTime(message.timestamp);

            const text = document.createElement('div');
            text.className = 'draft-chat-text';
            renderDraftChatTextContent(text, String(message.text || ''));

            meta.appendChild(author);
            meta.appendChild(time);
            row.appendChild(meta);
            row.appendChild(text);
            list.appendChild(row);
        });

        list.scrollTop = list.scrollHeight;
    }

    function setupDraftChat() {
        const form = document.getElementById('draft-chat-form');
        const input = document.getElementById('draft-chat-input');
        const sendButton = document.getElementById('draft-chat-send');
        const gifAddButton = document.getElementById('draft-chat-gif-add');
        const emojiToggle = document.getElementById('draft-chat-emoji-toggle');
        const emojiPicker = document.getElementById('draft-chat-emoji-picker');
        const gifPicker = document.getElementById('draft-chat-gif-picker');
        if (!form || !input || !sendButton) return;
        const standaloneDisplay = Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        const iosStandalone = Boolean(window.navigator && window.navigator.standalone === true);
        const hasPwaClass = Boolean(document.body && document.body.classList.contains('pwa-installed'));
        const hasAppNavClass = Boolean(document.body && document.body.classList.contains('silentdraft-app-nav-enabled'));
        const isInstalledPwa = Boolean(standaloneDisplay || iosStandalone || hasPwaClass || hasAppNavClass);
        const emojiPickerEnabled = Boolean(!isInstalledPwa && emojiToggle && emojiPicker);
        const gifPickerEnabled = Boolean(isInstalledPwa && gifAddButton && gifPicker);
        if (gifAddButton) {
            gifAddButton.setAttribute('aria-label', 'Add GIF powered by GIPHY');
            gifAddButton.setAttribute('title', 'Add GIF powered by GIPHY');
            if (isInstalledPwa) {
                gifAddButton.hidden = false;
                gifAddButton.style.display = '';
                gifAddButton.removeAttribute('aria-hidden');
                gifAddButton.innerHTML = '<img class="gif-btn-logo" src="/Poweredby_100px-White_VertLogo.png" alt="Powered by GIPHY" loading="lazy" decoding="async">';
            } else {
                gifAddButton.hidden = true;
                gifAddButton.style.display = 'none';
                gifAddButton.setAttribute('aria-hidden', 'true');
            }
        }
        if (gifPicker && !isInstalledPwa) {
            gifPicker.hidden = true;
            gifPicker.classList.remove('is-open');
        }
        let emojiPickerExpanded = false;
        let gifCategoryFilter = '';
        let gifLoading = false;
        let gifHasMore = true;
        let gifOffset = 0;
        let gifCurrentQuery = '';
        let gifUsingFallback = false;
        let gifRequestVersion = 0;
        let gifSuppressToggleUntil = 0;
        let gifRateLimitedUntil = 0;
        let gifRateLimitedActive = false;
        let gifToggleReenableTimer = null;

        const GIF_SEARCH_API_URL = '/api/hush-gifs';
        const GIF_DEFAULT_CATEGORIES = ['football', 'funny', 'hype', 'victory', 'trashTalk'];
        let gifFilterCategories = [...GIF_DEFAULT_CATEGORIES];
        if (!gifFilterCategories.includes(gifCategoryFilter)) {
            gifCategoryFilter = gifFilterCategories[0] || 'football';
        }
        const GIF_PAGE_SIZE = 24;
        const GIF_FALLBACK_OPTIONS = [
            { label: 'Yes', category: 'football', tags: 'yes nod approve', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
            { label: 'Nope', category: 'trashTalk', tags: 'nope no', url: 'https://media.giphy.com/media/26hkhKd2Cp5WMWU1O/giphy.gif' },
            { label: 'Lets Go', category: 'hype', tags: 'lets go hype', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif' },
            { label: 'Mic Drop', category: 'hype', tags: 'mic drop', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
            { label: 'LOL', category: 'funny', tags: 'lol laugh funny', url: 'https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif' },
            { label: 'Facepalm', category: 'trashTalk', tags: 'facepalm wow', url: 'https://media.giphy.com/media/3og0INyCmHlNylks9O/giphy.gif' },
            { label: 'Clap', category: 'victory', tags: 'clap applause', url: 'https://media.giphy.com/media/5xaOcLGvzHxDKjufnLW/giphy.gif' },
            { label: 'Party', category: 'victory', tags: 'party celebrate', url: 'https://media.giphy.com/media/3KC2jD2QcBOSc/giphy.gif' },
            { label: 'Touchdown', category: 'football', tags: 'touchdown football', url: 'https://media.giphy.com/media/3o6MbeZeKPb2rxqNqg/giphy.gif' },
            { label: 'Fire', category: 'hype', tags: 'fire hot', url: 'https://media.giphy.com/media/3o72FfM5HJydzafgUE/giphy.gif' }
        ];
        let gifOptions = [];

        const emojiOptions = [
            '😀', '😁', '😂', '🤣', '😊', '😍', '😎', '🤝',
            '🔥', '💯', '🚀', '🎯', '🏆', '📈', '📉', '⚡',
            '👏', '🙌', '🤌', '👍', '👎', '🤷', '😅', '😬',
            '😤', '😴', '🤔', '🫡', '🥶', '🌶️', '🍀', '🧠',
            '🏈', '💪', '👀', '⌛', '✅', '❌', '🎉', '😈'
        ];

        function closeEmojiPicker() {
            if (!emojiPicker || !emojiToggle) return;
            emojiPicker.hidden = true;
            emojiToggle.setAttribute('aria-expanded', 'false');
        }

        function openEmojiPicker() {
            if (!emojiPicker || !emojiToggle) return;
            emojiPicker.hidden = false;
            emojiToggle.setAttribute('aria-expanded', 'true');
        }

        function applyEmojiPickerMode() {
            if (!emojiPicker) return;
            emojiPicker.classList.toggle('expanded', emojiPickerExpanded);
            emojiPicker.classList.toggle('compact', !emojiPickerExpanded);

            const modeButton = emojiPicker.querySelector('[data-emoji-action="toggle-mode"]');
            if (modeButton) {
                modeButton.textContent = emojiPickerExpanded ? 'Collapse' : 'Expand';
                modeButton.setAttribute('aria-label', emojiPickerExpanded ? 'Collapse emoji picker' : 'Expand emoji picker');
                modeButton.setAttribute('title', emojiPickerExpanded ? 'Collapse' : 'Expand');
            }
        }

        function insertTextIntoInput(snippet) {
            const currentText = String(input.value || '');
            const maxLen = Number(input.maxLength || DRAFT_CHAT_MAX_LENGTH);
            const selectionStart = Number.isFinite(input.selectionStart) ? input.selectionStart : currentText.length;
            const selectionEnd = Number.isFinite(input.selectionEnd) ? input.selectionEnd : currentText.length;
            const nextText = `${currentText.slice(0, selectionStart)}${snippet}${currentText.slice(selectionEnd)}`;
            input.value = nextText.slice(0, maxLen);

            const caret = Math.min(selectionStart + snippet.length, input.value.length);
            input.focus();
            if (typeof input.setSelectionRange === 'function') {
                input.setSelectionRange(caret, caret);
            }
        }

        function closeGifPicker() {
            if (!gifPicker || !gifAddButton) return;
            gifPicker.hidden = true;
            gifAddButton.setAttribute('aria-expanded', 'false');
        }

        function openGifPicker() {
            if (!gifPicker || !gifAddButton) return;
            gifPicker.hidden = false;
            gifAddButton.setAttribute('aria-expanded', 'true');
        }

        function suppressGifToggle(ms = 400) {
            const duration = Math.max(100, Number(ms) || 400);
            gifSuppressToggleUntil = Date.now() + duration;
            if (!gifAddButton) return;

            gifAddButton.disabled = true;
            if (gifToggleReenableTimer) {
                window.clearTimeout(gifToggleReenableTimer);
            }
            gifToggleReenableTimer = window.setTimeout(() => {
                gifAddButton.disabled = false;
                gifToggleReenableTimer = null;
            }, duration);
        }

        function normalizeGiphyResponse(items) {
            const list = Array.isArray(items) ? items : [];
            return list.map((entry) => {
                const images = entry && entry.images ? entry.images : {};
                const preferred = (images.fixed_width && images.fixed_width.url) ||
                    (images.downsized && images.downsized.url) ||
                    (images.original && images.original.url) || '';
                const preview = (images.fixed_width && images.fixed_width.url) ||
                    (images.downsized && images.downsized.url) ||
                    (images.preview_gif && images.preview_gif.url) ||
                    (images.fixed_width_still && images.fixed_width_still.url) ||
                    (images.downsized_still && images.downsized_still.url) ||
                    preferred ||
                    String(entry && entry.url || '').trim();
                const title = String(entry && entry.title || '').trim() || 'Giphy';
                const directUrl = String(entry && entry.url || '').trim();
                const url = String(preferred || directUrl || '').trim();
                return {
                    label: title,
                    category: String(entry && entry.category || gifCategoryFilter || 'football').trim() || 'football',
                    tags: String((entry && (entry.slug || entry.tags)) || ''),
                    previewUrl: String(preview || '').trim(),
                    url
                };
            }).filter((entry) => Boolean(entry.url));
        }

        function resolveGifSearchQuery() {
            return '';
        }

        async function loadGiphyGifs(queryText, _offset = 0, _limit = GIF_PAGE_SIZE) {
            const fallbackCategory = gifFilterCategories[0] || 'football';
            const category = gifFilterCategories.includes(gifCategoryFilter) ? gifCategoryFilter : fallbackCategory;
            const url = `${GIF_SEARCH_API_URL}?category=${encodeURIComponent(category)}`;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                const err = new Error('Hush GIF lookup failed');
                err.status = response.status;
                const retryAfterMs = Number(payload && payload.retryAfterMs || 0);
                if (response.status === 429 && retryAfterMs > 0) {
                    err.retryAfterMs = retryAfterMs;
                    gifRateLimitedUntil = Date.now() + retryAfterMs;
                }
                throw err;
            }
            const payload = await response.json().catch(() => null);
            if (payload && payload.rateLimited && Number(payload.retryAfterMs || 0) > 0) {
                gifRateLimitedUntil = Date.now() + Number(payload.retryAfterMs || 0);
                gifRateLimitedActive = true;
            }

            const responseCategories = Array.isArray(payload && payload.categories)
                ? payload.categories
                    .map((value) => String(value || '').trim())
                    .filter((value) => value && value.toLowerCase() !== 'favorites')
                : [];
            if (responseCategories.length) {
                gifFilterCategories = responseCategories;
                if (!gifFilterCategories.includes(gifCategoryFilter)) {
                    gifCategoryFilter = gifFilterCategories[0];
                }
            }

            const normalized = normalizeGiphyResponse(payload && payload.items);
            return {
                items: normalized,
                pagination: {
                    offset: 0,
                    count: normalized.length,
                    total_count: normalized.length
                }
            };
        }

        async function fetchGifPage({ reset = false, force = false } = {}) {
            if (gifLoading && !(reset && force)) return;
            if (!reset && (!gifHasMore || gifUsingFallback)) return;

            if (reset && force) {
                gifLoading = false;
                gifRequestVersion += 1;
            }

            let previousScrollTop = 0;
            let previousScrollHeight = 0;
            if (!reset && gifPicker) {
                const previousGrid = gifPicker.querySelector('.draft-chat-gif-grid');
                if (previousGrid) {
                    previousScrollTop = previousGrid.scrollTop;
                    previousScrollHeight = previousGrid.scrollHeight;
                }
            }

            const query = resolveGifSearchQuery();
            if (reset) {
                gifCurrentQuery = query;
                gifOffset = 0;
                gifHasMore = true;
                gifUsingFallback = false;
                gifOptions = [];
            }

            gifLoading = true;
            const requestVersion = ++gifRequestVersion;

            try {
                const result = await loadGiphyGifs(gifCurrentQuery, gifOffset, GIF_PAGE_SIZE);
                if (requestVersion !== gifRequestVersion) return;
                const pageItems = Array.isArray(result && result.items) ? result.items : [];

                gifOptions = reset ? pageItems : gifOptions.concat(pageItems);
                gifOffset += pageItems.length;

                const total = Number(result && result.pagination && result.pagination.total_count || 0) || 0;
                gifHasMore = total > 0 ? gifOffset < total : pageItems.length >= GIF_PAGE_SIZE;
                gifUsingFallback = false;
                gifRateLimitedActive = false;
            } catch (_error) {
                if (requestVersion !== gifRequestVersion) return;
                if (_error && Number(_error.retryAfterMs || 0) > 0) {
                    gifRateLimitedUntil = Date.now() + Number(_error.retryAfterMs || 0);
                    gifRateLimitedActive = true;
                }
                if (reset && (!Array.isArray(gifOptions) || gifOptions.length === 0)) {
                    gifUsingFallback = true;
                    gifHasMore = false;
                    gifOptions = [...GIF_FALLBACK_OPTIONS];
                } else if (reset) {
                    gifUsingFallback = false;
                    gifHasMore = false;
                }
            } finally {
                if (requestVersion !== gifRequestVersion) return;
                gifLoading = false;
                renderGifPicker();
                if (!reset && gifPicker) {
                    const nextGrid = gifPicker.querySelector('.draft-chat-gif-grid');
                    if (nextGrid && previousScrollHeight > 0) {
                        const growth = Math.max(0, nextGrid.scrollHeight - previousScrollHeight);
                        nextGrid.scrollTop = previousScrollTop + growth;
                    }
                }
            }
        }

        function filteredGifOptions() {
            if (!gifUsingFallback) {
                return Array.isArray(gifOptions) ? gifOptions : [];
            }

            const source = GIF_FALLBACK_OPTIONS;
            return source.filter((entry) => {
                const categoryMatch = gifCategoryFilter === 'all' || String(entry.category || '').toLowerCase() === gifCategoryFilter;
                return categoryMatch;
            });
        }

        function renderGifPicker() {
            if (!gifPicker) return;
            const available = filteredGifOptions();
            const loader = gifLoading ? '<div class="draft-chat-gif-status">Loading GIFs...</div>' : '';
            const moreHint = (!gifLoading && gifHasMore && !gifUsingFallback) ? '<div class="draft-chat-gif-status">Scroll for more</div>' : '';
            const fallbackHint = gifUsingFallback ? '<div class="draft-chat-gif-status">Showing fallback GIFs</div>' : '';
            const rateLimitHint = gifRateLimitedActive ? '<div class="draft-chat-gif-status">Giphy is rate limited right now. Retrying shortly.</div>' : '';

            gifPicker.innerHTML = `
                <div class="draft-chat-gif-toolbar">
                    <button type="button" class="draft-chat-gif-close" data-gif-action="close">Close</button>
                </div>
                <div class="draft-chat-gif-categories">
                    ${gifFilterCategories.map((category) => `<button type="button" class="draft-chat-gif-category ${gifCategoryFilter === category ? 'is-active' : ''}" data-gif-category="${category}">${category.toUpperCase()}</button>`).join('')}
                </div>
                <div class="draft-chat-gif-grid">
                    ${available.length ? available.map((entry, index) => {
                        const thumb = String(entry.previewUrl || entry.url || '').replace(/"/g, '&quot;');
                        const label = String(entry.label || 'GIF').replace(/"/g, '&quot;');
                        return `<button type="button" class="draft-chat-gif-option" data-gif-index="${index}" title="${label}" aria-label="Insert GIF: ${label}"><img class="draft-chat-gif-thumb" src="${thumb}" alt="${label}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="draft-chat-gif-title">${label}</span></button>`;
                    }).join('') : '<p class="draft-chat-gif-empty">No GIF matches your current filter.</p>'}
                </div>
                ${loader}
                ${moreHint}
                ${fallbackHint}
                ${rateLimitHint}
                <div class="draft-chat-gif-attribution" aria-label="Powered by GIPHY"><img class="draft-chat-gif-attribution-logo" src="/Poweredby_100px-White_VertLogo.png" alt="Powered by GIPHY" loading="lazy" decoding="async"></div>
            `;

            const grid = gifPicker.querySelector('.draft-chat-gif-grid');
            if (grid && !gifUsingFallback) {
                grid.addEventListener('scroll', () => {
                    if (gifLoading || !gifHasMore) return;
                    const remaining = grid.scrollHeight - grid.scrollTop - grid.clientHeight;
                    if (remaining < 160) {
                        fetchGifPage({ reset: false });
                    }
                });
            }
        }

        if (gifPicker) {
            gifPicker.addEventListener('pointerdown', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const actionButton = target.closest('[data-gif-action]');
                if (!(actionButton instanceof HTMLElement)) return;

                const action = String(actionButton.getAttribute('data-gif-action') || '');
                if (action === 'close') {
                    event.preventDefault();
                    event.stopPropagation();
                    suppressGifToggle(420);
                    closeGifPicker();
                    return;
                }
            });

            gifPicker.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;

                const actionButton = target.closest('[data-gif-action]');
                if (actionButton instanceof HTMLElement) {
                    const action = String(actionButton.getAttribute('data-gif-action') || '');
                    if (action === 'close') {
                        event.preventDefault();
                        return;
                    }
                }

                const categoryButton = target.closest('[data-gif-category]');
                if (categoryButton instanceof HTMLElement) {
                    gifCategoryFilter = String(categoryButton.getAttribute('data-gif-category') || gifFilterCategories[0] || 'football').trim();
                    fetchGifPage({ reset: true });
                    return;
                }

                const optionButton = target.closest('.draft-chat-gif-option');
                if (optionButton instanceof HTMLElement) {
                    const idx = Number.parseInt(String(optionButton.getAttribute('data-gif-index') || '-1'), 10);
                    const choices = filteredGifOptions();
                    const selected = Number.isFinite(idx) ? choices[idx] : null;
                    suppressGifToggle(420);
                    if (!selected || !selected.url) return;
                    const prefix = input.value && !/\s$/.test(input.value) ? ' ' : '';
                    insertTextIntoInput(`${prefix}${selected.url}`);
                    closeGifPicker();
                    input.focus();
                }
            });
        }

        if (emojiPickerEnabled) {
            emojiPicker.innerHTML = `
                <div class="draft-chat-emoji-toolbar">
                    <button type="button" class="draft-chat-emoji-action" data-emoji-action="toggle-mode" aria-label="Expand emoji picker" title="Expand">Expand</button>
                    <button type="button" class="draft-chat-emoji-action" data-emoji-action="close" aria-label="Minimize emoji picker" title="Minimize">Minimize</button>
                </div>
                <div class="draft-chat-emoji-scroll" role="listbox" aria-label="Emoji picker">
                    ${emojiOptions.map((emoji) => `<button type="button" class="draft-chat-emoji-item" data-emoji="${emoji}" aria-label="Insert ${emoji}">${emoji}</button>`).join('')}
                </div>
            `;
            applyEmojiPickerMode();

            emojiPicker.addEventListener('click', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;

                const action = String(target.dataset.emojiAction || '');
                if (action === 'toggle-mode') {
                    emojiPickerExpanded = !emojiPickerExpanded;
                    applyEmojiPickerMode();
                    return;
                }

                if (action === 'close') {
                    closeEmojiPicker();
                    return;
                }

                const emoji = String(target.dataset.emoji || '');
                if (!emoji) return;
                insertTextIntoInput(emoji);
            });
        } else {
            if (emojiToggle) {
                emojiToggle.hidden = true;
                emojiToggle.setAttribute('aria-hidden', 'true');
            }
            if (emojiPicker) {
                emojiPicker.hidden = true;
            }
        }

        if (emojiPickerEnabled) {
            emojiToggle.setAttribute('aria-expanded', 'false');
            emojiToggle.addEventListener('click', () => {
                if (!emojiPicker) return;
                if (emojiPicker.hidden) {
                    openEmojiPicker();
                    return;
                }
                closeEmojiPicker();
            });
        }

        if (emojiPickerEnabled) {
            document.addEventListener('click', (event) => {
            if (!emojiPicker || emojiPicker.hidden) return;
            const target = event.target;
            if (!(target instanceof Node)) return;
            const clickedInsidePicker = emojiPicker.contains(target);
            const clickedToggle = !!(emojiToggle && emojiToggle.contains(target));
            if (!clickedInsidePicker && !clickedToggle) {
                closeEmojiPicker();
            }
            });
        }

        if (gifPickerEnabled) {
            gifAddButton.setAttribute('aria-expanded', 'false');
            gifAddButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (Date.now() < gifSuppressToggleUntil) {
                    return;
                }

                if (gifPicker && gifPicker.hidden) {
                    if (!gifOptions.length) {
                        await fetchGifPage({ reset: true });
                    }
                    renderGifPicker();
                    openGifPicker();
                    return;
                }

                closeGifPicker();
            });
        }

        const dismissGifPickerIfOutside = (event) => {
            if (!gifPicker || gifPicker.hidden) return;
            const target = event.target;
            if (!(target instanceof Node)) return;
            const clickedInsidePicker = gifPicker.contains(target);
            const clickedGifButton = !!(gifAddButton && gifAddButton.contains(target));
            if (!clickedInsidePicker && !clickedGifButton) {
                closeGifPicker();
            }
        };

        document.addEventListener('pointerdown', dismissGifPickerIfOutside);
        document.addEventListener('click', dismissGifPickerIfOutside);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeGifPicker();
            }
        });

        updateDraftChatUnreadBadge();

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                form.requestSubmit();
            }

            if (event.key === 'Escape') {
                closeEmojiPicker();
                closeGifPicker();
            }
        });

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const raw = String(input.value || '').trim();
            if (!raw) return;
            const normalized = normalizeOutgoingDraftChatText(raw);
            const text = normalized.slice(0, DRAFT_CHAT_MAX_LENGTH);

            closeEmojiPicker();
            closeGifPicker();

            if (!(window.draftSocket && currentDraftCode)) {
                showNotification('Chat unavailable: not connected.');
                return;
            }

            sendButton.disabled = true;
            window.draftSocket.emit('sendDraftChatMessage', currentDraftCode, text, (response) => {
                sendButton.disabled = false;
                if (!response || !response.ok) {
                    showNotification('Unable to send chat message.');
                    return;
                }
                input.value = '';
                closeEmojiPicker();
                closeGifPicker();
                input.focus();
            });
        });
    }

    // Update UI
    function updateUI(roundPlayers) {
        (Array.isArray(teams) ? teams : []).forEach((team) => {
            if (!team || !Array.isArray(team.roster)) return;
            team.roster.forEach((player) => hydrateRosterPlayerMetadata(player));
        });

        // Only reset to page 1 when round players actually change (new round)
        const isNewRound = !window.currentRoundPlayers || 
                          !roundPlayers || 
                          roundPlayers.length === 0 || 
                          JSON.stringify(roundPlayers.map(p => p.id).sort()) !== JSON.stringify(window.currentRoundPlayers.map(p => p.id).sort());
        
        if (isNewRound) {
            currentPage = 1;
            window.currentRoundPlayers = roundPlayers ? [...roundPlayers] : null;
            // Store page groupings for results display
            window.page1Players = roundPlayers ? roundPlayers.slice(0, 12) : [];
            window.page2Players = roundPlayers ? roundPlayers.slice(12, 24) : [];
            // Clear stored bids for new round
            storedBids = {};
        }

        renderRosterRequirementsSummary();

        // Players list with pagination
        const playerList = document.getElementById('players-list');
        if (playerList) {
            // Add fade transition to player list
            playerList.style.transition = 'opacity 0.3s ease-in-out';
            playerList.style.opacity = '0';

            const yourTeam = teams.find(t => t.name === username);
            const playersPerPage = 12;
            let currentPlayers = [];

            if (currentPage === 1) {
                // Page 1: show first 12 round players
                currentPlayers = roundPlayers.slice(0, 12);
            } else {
                // Page 2: show the stored page 2 players (not newly generated ones)
                currentPlayers = window.page2Players || [];
            }

            playerList.innerHTML = '';

            let pageButton = document.getElementById('page-switch-btn');
            if (!pageButton) {
                pageButton = document.createElement('button');
                pageButton.id = 'page-switch-btn';
            }

            pageButton.textContent = `Page ${currentPage}/2 - Switch`;
            pageButton.style.cssText = 'padding:8px 12px;background:#3498db;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold;z-index:1000;position:relative;white-space:nowrap;';
            pageButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[silentdraft] Page switch button clicked, switching from page', currentPage);
                
                // Add fade out animation before switching
                playerList.style.opacity = '0';
                
                setTimeout(() => {
                    currentPage = currentPage === 1 ? 2 : 1;
                    updateUI(roundPlayers); // Re-render with new page
                }, 150);
            };

            const leftColumn = document.getElementById('left-column');
            const playersTitle = leftColumn ? leftColumn.querySelector('h2') : null;
            let playersHeaderRow = document.getElementById('draftable-players-header-row');

            if (leftColumn && playersTitle) {
                if (!playersHeaderRow) {
                    playersHeaderRow = document.createElement('div');
                    playersHeaderRow.id = 'draftable-players-header-row';
                    playersHeaderRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;';
                    leftColumn.insertBefore(playersHeaderRow, playersTitle);
                    playersHeaderRow.appendChild(playersTitle);
                }

                if (pageButton.parentElement !== playersHeaderRow) {
                    playersHeaderRow.appendChild(pageButton);
                }
            }

            currentPlayers.forEach((player, index) => {
                const card = document.createElement('div');
                card.classList.add('player-card');
                const livePlayerState = players.find(p => p.id === player.id) || player;
                const playerOwner = livePlayerState && livePlayerState.owner ? livePlayerState.owner : '';
                if (playerOwner) {
                    card.classList.add(isCurrentUserTeamName(playerOwner) ? 'user-owned-card' : 'drafted-card');
                }
                card.style.cssText = 'opacity: 0; transform: translateY(10px); transition: all 0.3s ease-out; transition-delay: ' + (index * 50) + 'ms;';

                const playerName = player.name || 'Unknown Player';
                const playerPosition = player.position || 'UNK';
                const playerTeam = player.team || 'UNK';
                const playerValue = player.value || 0;
                const ownershipBadge = playerOwner
                    ? `<div class="player-card-status ${isCurrentUserTeamName(playerOwner) ? 'player-card-status-user' : 'player-card-status-other'}">${isCurrentUserTeamName(playerOwner) ? 'Won by you' : `Won by ${playerOwner}`}</div>`
                    : '';

                card.innerHTML = `
                    <div>
                        <p><span style="font-weight: bold; font-size: 20px; background: #3498db; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 8px; display: inline-block;">${playerPosition}</span> <span style="font-size: 15px;">${playerName}</span> (<span style="font-weight: bold;">${playerTeam}</span>)</p>
                        ${ownershipBadge}
                    </div>
                    <input type="tel" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Bid" data-player-id="${player.id}" maxlength="3" size="3"
                           style="width:56px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:14px;text-align:center;" 
                           min="0" max="${yourTeam ? yourTeam.budget : 200}" 
                           value="${storedBids[player.id] || ''}">
                `;

                playerList.appendChild(card);
            });

            // Trigger fade-in animation after a short delay
            setTimeout(() => {
                playerList.style.opacity = '1';
                const cards = playerList.querySelectorAll('.player-card');
                cards.forEach(card => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                });
            }, 50);

            // Add typing sound effect and bid storage to all bid inputs
            const playTypingSound = () => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    // Quick, subtle click sound
                    oscillator.frequency.value = 1200 + Math.random() * 200; // Slight pitch variation
                    oscillator.type = 'sine';

                    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Very quiet
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.05);
                } catch (e) {
                    // Silently fail if audio not supported
                }
            };

            // Attach sound and bid storage to all bid inputs
            document.querySelectorAll('input[data-player-id]').forEach(input => {
                input.addEventListener('input', playTypingSound);
                input.addEventListener('input', (e) => {
                    const playerId = parseInt(e.target.dataset.playerId);
                    storedBids[playerId] = e.target.value;
                    const bidAmount = parseInt(e.target.value, 10) || 0;

                    if (window.draftSocket && currentDraftCode) {
                        window.draftSocket.emit('placeBid', currentDraftCode, playerId, bidAmount, (response) => {
                            if (response && response.ok) {
                                console.log(`[silentdraft] Live bid synced: player ${playerId} = $${bidAmount}`);
                            }
                        });
                    }
                    
                    // Update bid counter
                    updateBidCounter();
                    
                    // Check for overbid
                    const yourTeam = teams.find(t => t.name === username);
                    if (yourTeam && bidAmount > yourTeam.budget) {
                        e.target.classList.add('overbid');
                    } else {
                        e.target.classList.remove('overbid');
                    }
                });
            });

            // Initial update of bid counter
            updateBidCounter();

            // Keep the header totals on one line across tiny phone widths.
            window.addEventListener('resize', fitHeaderBidCounterSingleLine);
            window.addEventListener('orientationchange', fitHeaderBidCounterSingleLine);
        }

        // Submit Bids button
        const submitBidsButton = document.getElementById('submit-bids');
        if (submitBidsButton) {
            submitBidsButton.disabled = false;
            submitBidsButton.onclick = () => {
                const yourTeam = teams.find(t => t.name === username);
                if (!yourTeam) return;

                if (!(window.draftSocket && currentDraftCode)) {
                    showNotification('Not connected to draft server. Please wait for reconnect.');
                    return;
                }

                const isForceAutoSubmit = submitBidsButton.dataset.forceAutoSubmit === '1';
                if (autoDraftEnabled && !isForceAutoSubmit) {
                    // In app layout the auto-draft toggle may be hidden; allow manual submit tap.
                    showNotification('Auto Draft is ON. Submitting your bids now.');
                }

                const submitHelper = (typeof submitCurrentRoundBidsToServer === 'function')
                    ? submitCurrentRoundBidsToServer
                    : window.submitCurrentRoundBidsToServer;
                if (typeof submitHelper !== 'function') {
                    console.error('[silentdraft] submit helper unavailable');
                    showNotification('Submit helper unavailable. Please refresh.');
                    return;
                }

                submitHelper({
                    lockUI: true,
                    lockLabel: isForceAutoSubmit ? 'Auto Submitted' : 'Bids Submitted'
                }).then((submitted) => {
                    if (submitted) {
                        // Play success sound
                        try {
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            const oscillator1 = audioContext.createOscillator();
                            const oscillator2 = audioContext.createOscillator();
                            const gainNode = audioContext.createGain();

                            oscillator1.connect(gainNode);
                            oscillator2.connect(gainNode);
                            gainNode.connect(audioContext.destination);

                            oscillator1.frequency.value = 800;
                            oscillator2.frequency.value = 1000;
                            oscillator1.type = 'sine';
                            oscillator2.type = 'sine';

                            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

                            oscillator1.start(audioContext.currentTime);
                            oscillator2.start(audioContext.currentTime + 0.1);
                            oscillator1.stop(audioContext.currentTime + 0.3);
                            oscillator2.stop(audioContext.currentTime + 0.4);
                        } catch (e) {
                            console.log('[silentdraft] Audio not supported');
                        }

                        clearAutoDraftSoloGraceWindow();
                    }
                });
            };
        }

        // Budget
        const budgetElem = document.getElementById('your-budget');
        if (budgetElem) {
            const yourTeam = teams.find(t => t.name === username);
            budgetElem.textContent = yourTeam ? yourTeam.budget.toString() : '0';
        }

        // Teams list
        const teamsList = document.getElementById('teams-list');
        if (teamsList) {
            teamsList.innerHTML = '';
            const draftLightMode = isDraftLightMode();
            teams.forEach(team => {
                const teamItem = document.createElement('li');
                teamItem.style.cssText = draftLightMode
                    ? 'cursor:pointer;padding:8px 10px;margin:4px 0;background:var(--hush-navy);border:1px solid var(--hush-steel)33;border-radius:8px;transition:all 0.2s ease;font-size:13px;color:var(--hush-ice);'
                    : 'cursor:pointer;padding:8px 10px;margin:4px 0;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;transition:all 0.2s ease;font-size:13px;';
                teamItem.dataset.teamName = team.name;
                
                // Header with arrow
                const header = document.createElement('div');
                header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
                const autoBadgeStyle = draftLightMode
                    ? 'display:inline-block;margin-left:8px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;background:var(--hush-steel)22;border:1px solid var(--hush-steel)66;color:var(--hush-ice);'
                    : 'display:inline-block;margin-left:8px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.5);color:#93c5fd;';
                header.innerHTML = `
                    <span>${team.name}${team.name === username ? ' (You)' : ''} - $${team.budget} (${team.roster.length} players) ${autoDraftStatusByTeam[team.name] ? `<span style="${autoBadgeStyle}">AUTO</span>` : ''}</span>
                    <span class="dropdown-arrow" style="font-size:11px;transition:transform 0.2s;">▼</span>
                `;
                teamItem.appendChild(header);
                
                // Roster container (initially hidden)
                const rosterDiv = document.createElement('div');
                rosterDiv.className = 'team-roster';
                rosterDiv.style.cssText = draftLightMode
                    ? 'display:none;margin-top:6px;padding-top:6px;border-top:1px solid var(--hush-steel)33;'
                    : 'display:none;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);';
                
                const assigned = assignRosterToSlots(team.roster);
                const starterMarkup = assigned.assignedSlots
                    .map(slot => buildRosterSlotRow(String(slot.label || '').replace(/\d+$/, ''), slot.player))
                    .join('');
                const maxBench = Number.parseInt(rosterSettings.BN, 10) || 0;
                const benchSlots = [];
                for (let i = 0; i < maxBench; i++) {
                    benchSlots.push(assigned.bench[i] || null);
                }
                const overflowBench = assigned.bench.slice(maxBench);
                const benchMarkup = benchSlots.map(player => buildBenchPlayerRow(player, 'BN')).join('')
                    + overflowBench.map(player => buildBenchPlayerRow(player, 'XBN')).join('');
                rosterDiv.innerHTML = `${starterMarkup}${benchMarkup}`;
                
                teamItem.appendChild(rosterDiv);
                
                // Toggle on click
                header.addEventListener('click', () => {
                    const isOpen = rosterDiv.style.display === 'block';
                    const arrow = header.querySelector('.dropdown-arrow');
                    
                    // Close all other team rosters
                    document.querySelectorAll('.team-roster').forEach(r => r.style.display = 'none');
                    document.querySelectorAll('.dropdown-arrow').forEach(a => a.style.transform = 'rotate(0deg)');
                    
                    // Toggle this one
                    if (!isOpen) {
                        rosterDiv.style.display = 'block';
                        arrow.style.transform = 'rotate(180deg)';
                    }
                });
                
                teamsList.appendChild(teamItem);
            });
        }

        // Round info
        const currentRoundElem = document.getElementById('current-round');
        if (currentRoundElem) {
            currentRoundElem.textContent = `Round ${currentRound}/${totalRounds}`;
        }


        // Your team roster (starters: first 6 + 1 Flex)
        const yourTeamElem = document.getElementById('your-team');
        const team = teams.find(t => t.name === username);
        
        // Update team header with username
        const teamHeader = document.getElementById('team-header');
        if (teamHeader) teamHeader.textContent = username;
        let benchPlayersForDisplay = [];
        
        if (yourTeamElem && team) {
            const assigned = assignRosterToSlots(team.roster);
            benchPlayersForDisplay = assigned.bench;

            // Build HTML for each slot
            yourTeamElem.innerHTML = assigned.assignedSlots
                .map(slot => buildRosterSlotRow(slot.label, slot.player))
                .join('');

        } else if (yourTeamElem) {
            yourTeamElem.innerHTML = '<p class="bench-empty-state">Your team lineup will be displayed here.</p>';
        }

        // Bench players display (only if we have the element and team)
        const benchPlayers = document.getElementById('bench-players');
        if (benchPlayers && team) {
            renderBenchSlots(benchPlayers, benchPlayersForDisplay);
        } else if (benchPlayers) {
            benchPlayers.innerHTML = '<p class="bench-empty-state">Your bench lineup will be displayed here.</p>';
        }

        renderDraftRoomRankings();

        // Sync draft state to localStorage for My Rankings page
        saveDraftStateForRankings();
    }

    // Persist a snapshot of live draft state so the Rankings page can poll it
    function saveDraftStateForRankings() {
        try {
            const draftedPlayers = {};
            const passedPlayers  = [];
            players.forEach(p => {
                if (p.owner)      draftedPlayers[p.name] = p.owner;
                else if (p.shown) passedPlayers.push(p.name);
            });
            const userTeam   = teams.find(t => t.name === username);
            const userRoster = userTeam ? userTeam.roster.map(p => p.name) : [];
            const currentRoundNames = (window.currentRoundPlayers || window.syncedRoundPlayers || []).map(p => p.name);
            localStorage.setItem('rankingsDraftState', JSON.stringify({
                draftCode: currentDraftCode,
                currentRound,
                currentRoundPlayers: currentRoundNames,
                draftedPlayers,
                userRoster,
                passedPlayers
            }));
        } catch (e) { /* ignore */ }
    }

    // Process bids for a single player
    function placeBid(player, bidValue, team) {
        if (!bidValue || bidValue <= player.bid || bidValue > team.budget) {
            return false;
        }
        if (!isValidRosterAddition(team, player)) {
            return false;
        }
        player.bid = bidValue;
        team.budget -= bidValue;
        player.owner = team.name;
        team.roster.push(player);
        
        // Sort roster by position priority, then by prerank within position
        const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
        team.roster.sort((a, b) => {
            const posA = positionOrder[a.position] || 99;
            const posB = positionOrder[b.position] || 99;
            if (posA !== posB) {
                return posA - posB;
            }
            return a.positionRank - b.positionRank;
        });
        
        return true;
    }

    // Helper function to get bid range key
    function getRangeKey(avgValue) {
        if (avgValue <= 5) return '1-5';
        if (avgValue <= 10) return '5-10';
        if (avgValue <= 20) return '10-20';
        if (avgValue <= 30) return '20-30';
        if (avgValue <= 40) return '30-40';
        if (avgValue <= 50) return '40-50';
        if (avgValue <= 60) return '50-60';
        return '60+';
    }

    // Helper function to get bid range for a position and value
    function getBidRange(position, avgValue, useServerRanges = false) {
        const ranges = useServerRanges ? serverSilentAuctionBidRanges : silentAuctionBidRanges;
        const rangeKey = getRangeKey(avgValue);
        return ranges[position]?.[rangeKey] || { min: 0.5, max: 1.5 };
    }

    // Bid ranges for silent auctions (client-side)
    const silentAuctionBidRanges = {
        QB: {
            '1-5': { min: 0.4, max: 1.65 },
            '5-10': { min: 0.5, max: 1.45 },
            '10-20': { min: 0.55, max: 1.35 },
            '20-30': { min: 0.6, max: 1.30 },
            '30-40': { min: 0.85, max: 1.15 },
            '40-50': { min: 0.9, max: 1.1 },
            '50-60': { min: 0.95, max: 1.05 },
            '60+': { min: 0.98, max: 1.02 }
        },
        RB: {
            '1-5': { min: 0.5, max: 1.55 },
            '5-10': { min: 0.6, max: 1.45 },
            '10-20': { min: 0.6, max: 1.4 },
            '20-30': { min: 0.7, max: 1.35 },
            '30-40': { min: 0.8, max: 1.25 },
            '40-50': { min: 0.9, max: 1.15 },
            '50-60': { min: 0.92, max: 1.15 },
            '60+': { min: 0.95, max: 1.08 }
        },
        WR: {
            '1-5': { min: 0.5, max: 1.55 },
            '5-10': { min: 0.6, max: 1.45 },
            '10-20': { min: 0.6, max: 1.4 },
            '20-30': { min: 0.7, max: 1.35 },
            '30-40': { min: 0.8, max: 1.25 },
            '40-50': { min: 0.9, max: 1.15 },
            '50-60': { min: 0.92, max: 1.15 },
            '60+': { min: 0.95, max: 1.08 }
        },
        TE: {
            '1-5': { min: 0.5, max: 1.55 },
            '5-10': { min: 0.6, max: 1.45 },
            '10-20': { min: 0.6, max: 1.4 },
            '20-30': { min: 0.7, max: 1.35 },
            '30-40': { min: 0.8, max: 1.25 },
            '40-50': { min: 0.9, max: 1.15 },
            '50-60': { min: 0.92, max: 1.15 },
            '60+': { min: 0.95, max: 1.08 }
        },
        K: {
            '1-5': { min: 0.3, max: 1.8 },
            '5-10': { min: 0.4, max: 1.6 },
            '10-20': { min: 0.5, max: 1.4 },
            '20-30': { min: 0.6, max: 1.3 },
            '30-40': { min: 0.7, max: 1.2 },
            '40-50': { min: 0.8, max: 1.1 },
            '50-60': { min: 0.85, max: 1.05 },
            '60+': { min: 0.9, max: 1.0 }
        },
        DEF: {
            '1-5': { min: 0.3, max: 1.8 },
            '5-10': { min: 0.4, max: 1.6 },
            '10-20': { min: 0.5, max: 1.4 },
            '20-30': { min: 0.6, max: 1.3 },
            '30-40': { min: 0.7, max: 1.2 },
            '40-50': { min: 0.8, max: 1.1 },
            '50-60': { min: 0.85, max: 1.05 },
            '60+': { min: 0.9, max: 1.0 }
        }
    };

    // Build a live tier snapshot from remaining players (excluding drafted and passed players).
    // Current round players are still considered available in the snapshot.
    function buildCpuTierContext(roundPlayers = []) {
        const roundPlayerIds = new Set((roundPlayers || []).map(p => p.id));
        const remaining = players
            .filter(p => !p.owner && (!p.shown || roundPlayerIds.has(p.id)))
            .sort((a, b) => (a.prerank || 9999) - (b.prerank || 9999));

        const total = remaining.length;
        const q1 = Math.max(1, Math.floor(total * 0.25));
        const q2 = Math.max(q1 + 1, Math.floor(total * 0.5));
        const q3 = Math.max(q2 + 1, Math.floor(total * 0.75));

        const tierByPlayerId = new Map();
        const countsByPosTier = {
            QB:  [0, 0, 0, 0],
            RB:  [0, 0, 0, 0],
            WR:  [0, 0, 0, 0],
            TE:  [0, 0, 0, 0],
            K:   [0, 0, 0, 0],
            DEF: [0, 0, 0, 0]
        };

        remaining.forEach((p, index) => {
            let tier = 3;
            if (index < q1) tier = 0;
            else if (index < q2) tier = 1;
            else if (index < q3) tier = 2;
            tierByPlayerId.set(p.id, tier);

            if (countsByPosTier[p.position]) {
                countsByPosTier[p.position][tier] += 1;
            }
        });

        return { tierByPlayerId, countsByPosTier };
    }

    function getCpuTierScarcityBonus(player, tierContext) {
        if (!tierContext || !tierContext.countsByPosTier[player.position]) return 0;

        const tier = tierContext.tierByPlayerId.has(player.id)
            ? tierContext.tierByPlayerId.get(player.id)
            : 3;
        const counts = tierContext.countsByPosTier[player.position];
        const topTwoLeft = counts[0] + counts[1];
        const inTierLeft = counts[tier];

        let bonus = 0;
        if (tier <= 1 && topTwoLeft <= 3) bonus += 12;
        else if (tier <= 1 && topTwoLeft <= 6) bonus += 7;

        if (inTierLeft <= 2) bonus += 6;
        else if (inTierLeft <= 5) bonus += 3;

        return bonus;
    }

    // Client-side CPU bidding for silent auctions
    function generateClientCPUBids(teams, roundPlayers, username, rosterSize, currentRound, totalRounds) {
        // --- Enhanced Independent CPU Bidding ---
        // Each CPU team independently decides which players to bid on, based on roster needs
        let cpuTeams = teams.filter(t => t.name !== username);
        let cpuBids = {};
        const tierContext = buildCpuTierContext(roundPlayers);
        // Assign each CPU team a random 'aggressiveness' factor for this round (lowered)
        let cpuAggressiveness = {};
        cpuTeams.forEach((team, idx) => {
            // Aggressiveness: 0.7 to 1.05 (less aggressive overall)
            cpuAggressiveness[team.name] = 0.7 + Math.random() * 0.35;
        });

        // Calculate bestByPos for each team
        cpuTeams.forEach((team, idx) => {
            let bestByPos = {};
            for (let pos of ['QB','RB','WR','TE','K','DEF']) {
                let playersAtPos = team.roster.filter(p => p.position === pos);
                if (playersAtPos.length > 0) {
                    bestByPos[pos] = Math.max(...playersAtPos.map(p => p.avgValue));
                } else {
                    bestByPos[pos] = 0;
                }
            }
            team.bestByPos = bestByPos;
        });

        // For each player
        roundPlayers.forEach(player => {
            if (player.owner) return;
            // Define probability ranges based on avgValue
            const valueRanges = [
                { min: 1, max: 5, minProb: 0.05, maxProb: 0.25 },
                { min: 5, max: 10, minProb: 0.08, maxProb: 0.25 },
                { min: 10, max: 20, minProb: 0.1, maxProb: 0.45 },
                { min: 20, max: 30, minProb: 0.35, maxProb: 0.55 },
                { min: 30, max: 40, minProb: 0.35, maxProb: 0.65 },
                { min: 40, max: 50, minProb: 0.35, maxProb: 0.75 },
                { min: 50, max: 60, minProb: 0.45, maxProb: 0.85 },
                { min: 60, max: Infinity, minProb: 0.5, maxProb: 0.95 }
            ];
            const range = valueRanges.find(r => player.avgValue >= r.min && player.avgValue < r.max) || valueRanges[valueRanges.length - 1];
            const participationRate = range.minProb + Math.random() * (range.maxProb - range.minProb);
            let adjustedParticipationRate = participationRate;
            if (cpuTeams.length === 10 && currentRound % 2 === 1) {
              adjustedParticipationRate += Math.random() < 0.5 ? 0.05 : -0.05;
              adjustedParticipationRate = Math.max(0, Math.min(1, adjustedParticipationRate));
            }
            const numBidders = Math.round(adjustedParticipationRate * cpuTeams.length);
            const draftProgress = currentRound / totalRounds;
            // Collect potential bidders
            let potentialBidders = [];
            cpuTeams.forEach(team => {
                if (!isValidRosterAddition(team, player)) return;
                const bestByPos = team.bestByPos;
                let improve = player.avgValue - bestByPos[player.position];
                if (bestByPos[player.position] > 20 && player.avgValue < 20) improve -= 10;
                if (bestByPos[player.position] > 5 && player.avgValue < 3) improve -= 20;
                if (improve > 0) improve += 5;
                if (bestByPos[player.position] < 10) improve += 10;
                let avgOther = Object.keys(bestByPos).filter(pos => pos !== player.position).reduce((sum, pos) => sum + bestByPos[pos], 0) / 5;
                if (bestByPos[player.position] < avgOther - 10) improve += 5;
                if ((player.position === 'K' || player.position === 'DEF') && bestByPos[player.position] === 0) improve += 8;
                improve += getCpuTierScarcityBonus(player, tierContext);
                if (draftProgress < 0.55 ? bestByPos[player.position] === 0 : (improve > 0 || bestByPos[player.position] === 0)) {
                    potentialBidders.push({team, improve});
                }
            });
            // Sort by improve desc
            potentialBidders.sort((a, b) => b.improve - a.improve);
            // Select top numBidders
            const selected = potentialBidders.slice(0, numBidders);
            // For each selected, calculate bid
            selected.forEach(({team}) => {
                const bestByPos = team.bestByPos;
                let baseBid;
                if (player.position === 'K' || player.position === 'DEF') {
                    baseBid = player.avgValue * (0.75 + Math.random() * 0.4); // 75-115% for K/DEF
                } else {
                    const bidRange = getBidRange(player.position, player.avgValue);
                    baseBid = player.avgValue * (bidRange.min + Math.random() * (bidRange.max - bidRange.min));
                }
                // Special handling for very low value players
                if (player.avgValue <= 1) {
                    baseBid = Math.random() < 0.75 ? 1 : (1 + Math.floor(Math.random() * 4)); // 75% chance $1, 25% chance $1-4
                }
                if (bestByPos[player.position] === 0) baseBid *= 1.2;
                baseBid += getCpuTierScarcityBonus(player, tierContext);
                let numCompetitors = teams.filter(t => t.name !== team.name && t.budget > team.budget && t.roster.filter(p => p.position === player.position).length === 0).length;
                baseBid += numCompetitors * 5;
                const improve = potentialBidders.find(pb => pb.team === team).improve;
                if (improve > 20) baseBid += 10;
                else if (improve > 10) baseBid += 5;
                else if (improve > 0) baseBid += 2;
                if (Math.random() < 0.15) baseBid = Math.min(baseBid, Math.floor(Math.random() * 5) + 1);
                baseBid = Math.round(baseBid * cpuAggressiveness[team.name]);
                baseBid += Math.floor(Math.random() * 2);
                baseBid += Math.floor(Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
                baseBid = Math.min(baseBid, team.budget);
                if (baseBid > 0) {
                    if (!cpuBids[team.name]) cpuBids[team.name] = [];
                    cpuBids[team.name].push({ player, cpuBid: baseBid });
                }
            });
        });

        // Log all CPU bids for debugging
        console.log('=== CPU BIDS FOR THIS ROUND ===');
        Object.keys(cpuBids).forEach(cpuName => {
            if (cpuBids[cpuName].length > 0) {
                console.log(`${cpuName}:`);
                cpuBids[cpuName].forEach(bid => {
                    console.log(`  - ${bid.player.name} (${bid.player.position}): $${bid.cpuBid}`);
                });
            } else {
                console.log(`${cpuName}: No bids`);
            }
        });
        console.log('===============================');

        return cpuBids;
    }

    // Submit all bids for the round
    function submitBids(options = {}) {
        const forceAutoSubmit = !!(options && options.forceAutoSubmit);

        if (!autoDraftEnabled && !forceAutoSubmit) {
            const submitBtn = document.getElementById('submit-bids');
            if (submitBtn && typeof submitBtn.onclick === 'function') {
                submitBtn.onclick();
                return;
            }
        }

        const yourTeam = teams.find(t => t.name === username);
        if (!yourTeam) {
            console.warn('[silentdraft] submitBids aborted: user team not found');
            return;
        }
        const roundPlayers = getRoundPlayers();
        let results = [];
        let anyValidBid = false;
        /** @type {Array<{playerId:number, playerName:string, tiedTeams:string[], bidAmount:number}>} */
        const tiedBids = [];

        // --- Enhanced Independent CPU Bidding ---
        // Each CPU team independently decides which players to bid on, based on roster needs
        let cpuTeams = teams.filter(t => t.name !== username);
        let cpuBids = {};
        const tierContext = buildCpuTierContext(roundPlayers);
        // Assign each CPU team a random 'aggressiveness' factor for this round (lowered)
        let cpuAggressiveness = {};
        cpuTeams.forEach((team, idx) => {
            // Aggressiveness: 0.7 to 1.05 (less aggressive overall)
            cpuAggressiveness[team.name] = 0.7 + Math.random() * 0.35;
        });

        // Calculate bestByPos for each team
        cpuTeams.forEach((team, idx) => {
            let bestByPos = {};
            for (let pos of ['QB','RB','WR','TE','K','DEF']) {
                let playersAtPos = team.roster.filter(p => p.position === pos);
                if (playersAtPos.length > 0) {
                    bestByPos[pos] = Math.max(...playersAtPos.map(p => p.avgValue));
                } else {
                    bestByPos[pos] = 0;
                }
            }
            team.bestByPos = bestByPos;
        });

        // Define bid ranges by position and value
        const bidRanges = {
            QB: {
                '1-5': { min: 0.65, max: 1.65 },
                '5-10': { min: 0.7, max: 1.45 },
                '10-20': { min: 0.75, max: 1.45 },
                '20-30': { min: 0.8, max: 1.35 },
                '30-40': { min: 0.85, max: 1.25 },
                
            },
            RB: {
                '1-5': { min: 0.65, max: 1.65 },
                '5-10': { min: 0.70, max: 1.65 },
                '10-20': { min: 0.75, max: 1.55 },
                '20-30': { min: 0.75, max: 1.45},
                '30-40': { min: 0.75, max: 1.35 },
                '40-50': { min: 0.75, max: 1.25 },
                '50-60': { min: 0.75, max: 1.15 },
                '60+': { min: 0.75, max: 1.10 }
            },
            WR: {
                '1-5': { min: 0.65, max: 1.65 },
                '5-10': { min: 0.70, max: 1.65 },
                '10-20': { min: 0.75, max: 1.55 },
                '20-30': { min: 0.75, max: 1.45 },
                '30-40': { min: 0.75, max: 1.35 },
                '40-50': { min: 0.75, max: 1.25},
                '50-60': { min: 0.75, max: 1.15 },
                '60+': { min: 0.75, max: 1.10 }
            },
            TE: {
                '1-5': { min: 0.65, max: 1.4 },
                '5-10': { min: 0.65, max: 1.3 },
                '10-20': { min: 0.70, max: 1.2 },
                '20-30': { min: 0.70, max: 1.15 },
                '30-40': { min: 0.70, max: 1.1},
                
            }
        };

        function getRangeKey(avgValue) {
            if (avgValue <= 5) return '1-5';
            if (avgValue <= 10) return '5-10';
            if (avgValue <= 20) return '10-20';
            if (avgValue <= 30) return '20-30';
            if (avgValue <= 40) return '30-40';
            if (avgValue <= 50) return '40-50';
            if (avgValue <= 60) return '50-60';
            return '60+';
        }

        // For each player
        roundPlayers.forEach(player => {
            if (player.owner) return;
            // Define probability ranges based on avgValue
            const valueRanges = [
                { min: 1, max: 5, minProb: 0.05, maxProb: 0.25 },
                { min: 5, max: 10, minProb: 0.08, maxProb: 0.25 },
                { min: 10, max: 20, minProb: 0.1, maxProb: 0.45 },
                { min: 20, max: 30, minProb: 0.35, maxProb: 0.55 },
                { min: 30, max: 40, minProb: 0.35, maxProb: 0.65 },
                { min: 40, max: 50, minProb: 0.35, maxProb: 0.75 },
                { min: 50, max: 60, minProb: 0.45, maxProb: 0.85 },
                { min: 60, max: Infinity, minProb: 0.5, maxProb: 0.95 }
            ];
            const range = valueRanges.find(r => player.avgValue >= r.min && player.avgValue < r.max) || valueRanges[valueRanges.length - 1];
            const participationRate = range.minProb + Math.random() * (range.maxProb - range.minProb);
            let adjustedParticipationRate = participationRate;
            if (cpuTeams.length === 10 && currentRound % 2 === 1) {
              adjustedParticipationRate += Math.random() < 0.5 ? 0.05 : -0.05;
              adjustedParticipationRate = Math.max(0, Math.min(1, adjustedParticipationRate));
            }
            const numBidders = Math.round(adjustedParticipationRate * cpuTeams.length);
            const draftProgress = currentRound / totalRounds;
            // Collect potential bidders
            let potentialBidders = [];
            cpuTeams.forEach(team => {
                if (!isValidRosterAddition(team, player)) return;
                const bestByPos = team.bestByPos;
                let improve = player.avgValue - bestByPos[player.position];
                if (bestByPos[player.position] > 20 && player.avgValue < 20) improve -= 10;
                if (bestByPos[player.position] > 5 && player.avgValue < 3) improve -= 20;
                if (improve > 0) improve += 5;
                if (bestByPos[player.position] < 10) improve += 10;
                let avgOther = Object.keys(bestByPos).filter(pos => pos !== player.position).reduce((sum, pos) => sum + bestByPos[pos], 0) / 5;
                if (bestByPos[player.position] < avgOther - 10) improve += 5;
                if ((player.position === 'K' || player.position === 'DEF') && bestByPos[player.position] === 0) improve += 8;
                improve += getCpuTierScarcityBonus(player, tierContext);
                if (draftProgress < 0.55 ? bestByPos[player.position] === 0 : (improve > 0 || bestByPos[player.position] === 0)) {
                    potentialBidders.push({team, improve});
                }
            });
            // Sort by improve desc
            potentialBidders.sort((a, b) => b.improve - a.improve);
            // Select top numBidders
            const selected = potentialBidders.slice(0, numBidders);
            // For each selected, calculate bid
            selected.forEach(({team}) => {
                const bestByPos = team.bestByPos;
                let baseBid;
                if (player.position === 'K' || player.position === 'DEF') {
                    baseBid = player.avgValue * (0.75 + Math.random() * 0.4); // 75-115% for K/DEF
                } else {
                    const rangeKey = getRangeKey(player.avgValue);
                    const bidRange = bidRanges[player.position][rangeKey];
                    baseBid = player.avgValue * (bidRange.min + Math.random() * (bidRange.max - bidRange.min));
                }
                // Special handling for very low value players
                if (player.avgValue <= 1) {
                    baseBid = Math.random() < 0.75 ? 1 : (1 + Math.floor(Math.random() * 4)); // 75% chance $1, 25% chance $1-4
                }
                if (bestByPos[player.position] === 0) baseBid *= 1.2;
                baseBid += getCpuTierScarcityBonus(player, tierContext);
                let numCompetitors = teams.filter(t => t.name !== team.name && t.budget > team.budget && t.roster.filter(p => p.position === player.position).length === 0).length;
                baseBid += numCompetitors * 5;
                const improve = potentialBidders.find(pb => pb.team === team).improve;
                if (improve > 20) baseBid += 10;
                else if (improve > 10) baseBid += 5;
                else if (improve > 0) baseBid += 2;
                if (Math.random() < 0.15) baseBid = Math.min(baseBid, Math.floor(Math.random() * 5) + 1);
                baseBid = Math.round(baseBid * cpuAggressiveness[team.name]);
                baseBid += Math.floor(Math.random() * 2);
                baseBid += Math.floor(Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
                baseBid = Math.min(baseBid, team.budget);
                if (baseBid > 0) {
                    if (!cpuBids[team.name]) cpuBids[team.name] = [];
                    cpuBids[team.name].push({ player, cpuBid: baseBid });
                }
            });
        });

        // Log all CPU bids for debugging
        console.log('=== CPU BIDS FOR THIS ROUND ===');
        Object.keys(cpuBids).forEach(cpuName => {
            if (cpuBids[cpuName].length > 0) {
                console.log(`${cpuName}:`);
                cpuBids[cpuName].forEach(bid => {
                    console.log(`  - ${bid.player.name} (${bid.player.position}): $${bid.cpuBid}`);
                });
            } else {
                console.log(`${cpuName}: No bids`);
            }
        });
        console.log('===============================');

        // --- Gather all bids for each player (user + all CPU teams) ---
        roundPlayers.forEach(player => {
            if (player.owner) return; // Already assigned

            // Use stored bids instead of DOM queries since not all players may be visible
            let userBid = storedBids[player.id] ? parseInt(storedBids[player.id]) : 0;
            if (isNaN(userBid) || userBid < 0) userBid = 0;

            // Clear any existing error displays for this player if input is visible
            const bidInput = document.querySelector(`input[data-player-id="${player.id}"]`);
            const errorElem = bidInput ? bidInput.parentElement.querySelector('.bid-error') : null;
            if (errorElem) errorElem.style.display = 'none';

            // Validate user bid
            if (userBid > 0) {
                if (userBid <= player.bid) {
                    if (errorElem) {
                        errorElem.textContent = 'Bid must be higher than current.';
                        errorElem.style.display = 'inline';
                    }
                    results.push(`Invalid bid for ${player.name}: Bid must be higher than current ($${player.bid}).`);
                    return;
                }
                if (userBid > yourTeam.budget) {
                    if (errorElem) {
                        errorElem.textContent = 'Bid exceeds your budget.';
                        errorElem.style.display = 'inline';
                    }
                    results.push(`Invalid bid for ${player.name}: Bid exceeds your budget ($${yourTeam.budget}).`);
                    return;
                }
                if (!isValidRosterAddition(yourTeam, player)) {
                    if (errorElem) {
                        errorElem.textContent = 'Roster limit reached for this position.';
                        errorElem.style.display = 'inline';
                    }
                    results.push(`Invalid bid for ${player.name}: Roster limit reached for ${player.position}.`);
                    return;
                }
                
                // Emit bid to server for synchronization
                if (window.draftSocket && currentDraftCode) {
                    window.draftSocket.emit('placeBid', currentDraftCode, player.id, userBid, (response) => {
                        if (response && response.ok) {
                            console.log('[silentdraft] Bid synchronized:', player.name, userBid);
                        }
                    });
                }
            } else if (window.draftSocket && currentDraftCode) {
                window.draftSocket.emit('placeBid', currentDraftCode, player.id, 0, () => {});
            }
// Simulate CPU bidding
const otherTeams = teams.filter(t => t.name !== username && isValidRosterAddition(t, player));
            const prioritizedTeams = otherTeams.filter(t => {
                const counts = t.roster.reduce((c, p) => {
                    c[p.position] = (c[p.position] || 0) + 1;
                    return c;
                }, {});
                const flexEligibleCount = (counts.RB || 0) + (counts.WR || 0) + (counts.TE || 0);
                return (
                    (player.position === 'QB' && (counts.QB || 0) < rosterLimits.QB.min) ||
                    (player.position === 'RB' && (counts.RB || 0) < rosterLimits.RB.min) ||
                    (player.position === 'WR' && (counts.WR || 0) < rosterLimits.WR.min) ||
                    (player.position === 'TE' && (counts.TE || 0) < rosterLimits.TE.min) ||
                    (player.position === 'K' && (counts.K || 0) < rosterLimits.K.min) ||
                    (player.position === 'DEF' && (counts.DEF || 0) < rosterLimits.DEF.min) ||
                    (flexPositions.includes(player.position) && flexEligibleCount < (rosterLimits.RB.min + rosterLimits.WR.min + rosterLimits.TE.min + getFlexRequirementCount()))
                );
            });
            const biddingTeam = prioritizedTeams.length > 0
                ? prioritizedTeams[Math.floor(Math.random() * prioritizedTeams.length)]
                : otherTeams[Math.floor(Math.random() * otherTeams.length)];
            let cpuBid = 0;
            let cpuWantsToBid = true;

            // Top 5 QBs: $15-35
            // --- Position-based price curve for fallback CPU bidding ---
            const priceBands = {
                QB:   { top: 5,   min: 15, max: 35 },
                RB:   { top: 10,  min: 35, max: 65 },
                WR:   { top: 10,  min: 35, max: 65 },
                TE:   { top: 3,   min: 15, max: 30 },
                K:    { top: 5,   min: 1,  max: 5  },
                DEF:  { top: 5,   min: 1,  max: 5  }
            };
            let band = priceBands[player.position] || { top: 10, min: 2, max: 10 };
            let allAtPos = players.filter(p => p.position === player.position);
            let sortedAtPos = allAtPos.sort((a, b) => a.prerank - b.prerank);
            let posRank = sortedAtPos.findIndex(p => p.id === player.id) + 1;
            let relRank = Math.min(posRank, band.top);
            let baseBid = Math.round(band.max - ((band.max - band.min) * (relRank - 1) / (band.top - 1)));

            // Overall fallback: Top 50 overall: $10-25, 51-100: $4-10, 101-200: $2-6 (60%), 201+: $1-3 (20%)
            if (player.prerank <= 50) baseBid = Math.max(baseBid, Math.floor(Math.random() * 16) + 10);
            else if (player.prerank <= 100) baseBid = Math.max(baseBid, Math.floor(Math.random() * 7) + 4);
            else if (player.prerank <= 200) {
                cpuWantsToBid = Math.random() < 0.6;
                baseBid = Math.max(baseBid, Math.floor(Math.random() * 5) + 2);
            } else {
                cpuWantsToBid = Math.random() < 0.2;
                baseBid = Math.max(baseBid, Math.floor(Math.random() * 3) + 1);
            }

            // Budget management: scale bid if team is running low
            let picksLeft = Math.max(1, totalRounds - currentRound + 1);
            let budgetPerPick = biddingTeam.budget / Math.max(1, picksLeft);
            if (baseBid > budgetPerPick * 1.5) {
                baseBid = Math.max(Math.round(budgetPerPick * (1.1 + Math.random() * 0.2)), band.min);
            }

            // Calculate max willing to pay: $5-6 more than current tied price, adjusted for AV and roster needs
            let maxWillingToPay = player.bid + 5 + Math.floor(Math.random() * 2); // $5-6 over current bid
            if (player.avgValue > 15) maxWillingToPay += Math.floor(player.avgValue * 0.2); // Bonus for high AV players
            if (player.avgValue > 25) maxWillingToPay += Math.floor(player.avgValue * 0.1); // Extra for elite players
            
            // Adjust based on remaining roster spots
            if (picksLeft > 5) {
                maxWillingToPay = Math.min(maxWillingToPay, biddingTeam.budget * 0.6); // More conservative with many spots left
            } else if (picksLeft <= 2) {
                maxWillingToPay = Math.min(maxWillingToPay, biddingTeam.budget * 0.9); // More aggressive when nearly done
            }
            
            maxWillingToPay = Math.min(maxWillingToPay, biddingTeam.budget); // Cap at budget
            baseBid = Math.min(baseBid, maxWillingToPay); // Don't exceed max willing to pay

            // CPU may skip top player to save budget for balance
            if (posRank === 1 && Math.random() < 0.25) cpuWantsToBid = false;

            // Add small random noise
            baseBid += Math.floor(Math.random() * 2);
            baseBid += Math.floor(Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
            baseBid = Math.max(band.min, baseBid);
            baseBid = Math.min(baseBid, biddingTeam.budget);
            cpuBid = baseBid;

            // Only bid if CPU wants to bid and has enough budget and bid is higher than current
            if (!cpuWantsToBid || !biddingTeam || cpuBid <= player.bid || cpuBid > biddingTeam.budget) {
                cpuBid = 0;
            }

            // Gather all bids (user + CPU teams)
            let bids = [];
            if (userBid > 0) bids.push({ team: yourTeam, amount: userBid });
            Object.keys(cpuBids).forEach(cpuName => {
                let cpuTeam = teams.find(t => t.name === cpuName);
                let cpuBidObj = cpuBids[cpuName].find(b => b.player === player);
                if (cpuBidObj && cpuTeam && cpuBidObj.cpuBid <= cpuTeam.budget) {
                    bids.push({ team: cpuTeam, amount: cpuBidObj.cpuBid });
                }
            });

            // Find the highest bid(s)
            let maxBid = Math.max(...bids.map(b => b.amount), 0);
            let topBidders = bids.filter(b => b.amount === maxBid);

            if (topBidders.length === 1 && maxBid > 0) {
                // Single winner
                const winner = topBidders[0].team;
                // Find the second highest bid and team
                let secondHighestBid = 0;
                let secondHighestTeam = null;
                if (bids.length > 1) {
                    // Sort bids descending, skip the winner
                    const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
                    secondHighestBid = sortedBids[1].amount;
                    secondHighestTeam = sortedBids[1].team.name;
                }
                // Winner pays $1 over second highest, or their own bid if only bidder
                const finalPrice = secondHighestBid > 0 ? Math.min(winner.budget, secondHighestBid + 1) : 1;
                player.bid = finalPrice;
                player.owner = winner.name;
                winner.budget -= finalPrice;
                winner.roster.push(player);
                
                // Sort roster by position priority, then by prerank within position
                const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                winner.roster.sort((a, b) => {
                    const posA = positionOrder[a.position] || 99;
                    const posB = positionOrder[b.position] || 99;
                    if (posA !== posB) {
                        return posA - posB;
                    }
                    return a.positionRank - b.positionRank;
                });
                
                results.push(
                    `${winner === yourTeam ? 'You' : winner.name} won ${player.name} for $${finalPrice}!` +
                    (secondHighestBid > 0 ? ` (Second highest: $${secondHighestBid} by ${secondHighestTeam})` : '')
                );
                anyValidBid = true;
            } else if (topBidders.length > 1 && maxBid > 0) {
                // Check if all topBidders are CPUs (not user)
                const allCPUs = topBidders.every(b => b.team.name !== username);
                // Only allow CPU-CPU ties about 20% of the time
                if (!allCPUs || Math.random() < 0.2) {
                    tiedBids.push({
                        playerId: player.id,
                        playerName: player.name,
                        tiedTeams: topBidders.map(b => b.team.name),
                        bidAmount: maxBid
                    });
                    // Don't assign yet
                } else {
                    // If not allowing tie, pick a random CPU winner, but have them pay $1 over the second highest bid
                    const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
                    const winnerObj = topBidders[Math.floor(Math.random() * topBidders.length)];
                    const winner = winnerObj.team;
                    // Find the second highest bid (skip the winner)
                    let secondHighestBid = 0;
                    let secondHighestTeam = null;
                    if (sortedBids.length > 1) {
                        // Find the first bid that is not the winner
                        for (let i = 0; i < sortedBids.length; i++) {
                            if (sortedBids[i].team.name !== winner.name) {
                                secondHighestBid = sortedBids[i].amount;
                                secondHighestTeam = sortedBids[i].team.name;
                                break;
                            }
                        }
                    }
                    // Winner pays $1 over second highest, or their own bid if only bidder
                    const finalPrice = secondHighestBid > 0 ? Math.min(winner.budget, secondHighestBid + 1) : maxBid;
                    player.bid = finalPrice;
                    player.owner = winner.name;
                    winner.budget -= finalPrice;
                    winner.roster.push(player);
                    
                    // Sort roster by position priority, then by prerank within position
                    const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                    winner.roster.sort((a, b) => {
                        const posA = positionOrder[a.position] || 99;
                        const posB = positionOrder[b.position] || 99;
                        if (posA !== posB) {
                            return posA - posB;
                        }
                        return a.positionRank - b.positionRank;
                    });
                    
                    results.push(`${winner.name} won ${player.name} for $${finalPrice}! (Second highest: $${secondHighestBid}${secondHighestTeam ? ' by ' + secondHighestTeam : ''})`);
                    anyValidBid = true;
                }
            }
            // else: no valid bids, do nothing
        });

        // Reset bids for unassigned players
        roundPlayers.forEach(player => {
            if (!player.owner) player.bid = 0;
        });

        // Highlight tied players in UI
        if (tiedBids.length > 0) {
            tiedBids.forEach(tied => {
                const playerCard = document.querySelector(`input[data-player-id="${tied.playerId}"]`)?.parentElement;
                if (playerCard) {
                    playerCard.style.border = '2px solid red';
                    playerCard.style.background = '#ffeaea';
                    // Add or update tie message
                    let tieMsg = playerCard.querySelector('.tie-msg');
                    if (!tieMsg) {
                        tieMsg = document.createElement('div');
                        tieMsg.className = 'tie-msg';
                        tieMsg.style.color = 'red';
                        tieMsg.style.marginTop = '6px';
                        playerCard.appendChild(tieMsg);
                    }
                    tieMsg.textContent = `Tie: ${tied.tiedTeams.join(' & ')}`;
                }
            });
        }

        // Mark undrafted free agents

        roundPlayers.forEach(player => {
            if (!player.owner && player.bid === 0) {
                // Check if this player is in a tie
                const tie = tiedBids.find(t => t.playerId === player.id);
                if (tie) {
                    results.push(`${player.name} in a tie between: ${tie.tiedTeams.join(' & ')}`);
                } else {
                    results.push(`${player.name} was undrafted.`);
                }
            }
        });

        // Show round results in a modal and wait for all users to accept
        showRoundResultsModal(results, () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            window.__silentDraftTimerExpiredHandled = false;

            // Handle tied bids with a live auction or similar mechanism
            if (tiedBids.length > 0) {
                handleLiveAuction(tiedBids, (auctionResults) => {
                    // Add auction winners to the results modal before advancing
                    if (auctionResults && auctionResults.length > 0) {
                        const page1AuctionResults = [];
                        const page2AuctionResults = [];
                        
                        auctionResults.forEach(result => {
                            const player = (window.page1Players || []).find(p => p.id === result.playerId) ||
                                          (window.page2Players || []).find(p => p.id === result.playerId);
                            if (player) {
                                const isPage1Player = (window.page1Players || []).some(p => p.id === result.playerId);
                                if (isPage1Player) {
                                    page1AuctionResults.push(result);
                                } else {
                                    page2AuctionResults.push(result);
                                }
                            }
                        });
                        
                        // Update the modal with auction results
                        const page1List = document.querySelector('.round-results-column:nth-of-type(1) .round-results-list');
                        const page2List = document.querySelector('.round-results-column:nth-of-type(2) .round-results-list');
                        
                        if (page1List && page1AuctionResults.length > 0) {
                            const auctionResultsHTML = page1AuctionResults.map(result => 
                                `<div style="margin:4px 0;padding:6px 8px;background:rgba(46,204,113,0.1);border-radius:4px;font-size:13px;border-left:3px solid #2ecc71;">
                                    <span style="color:#2ecc71;font-weight:bold;">Auction Complete:</span> ${result.playerName} → ${result.winner} for $${result.finalBid}
                                </div>`
                            ).join('');
                            page1List.innerHTML += auctionResultsHTML;
                        }
                        
                        if (page2List && page2AuctionResults.length > 0) {
                            const auctionResultsHTML = page2AuctionResults.map(result => 
                                `<div style="margin:4px 0;padding:6px 8px;background:rgba(46,204,113,0.1);border-radius:4px;font-size:13px;border-left:3px solid #2ecc71;">
                                    <span style="color:#2ecc71;font-weight:bold;">Auction Complete:</span> ${result.playerName} → ${result.winner} for $${result.finalBid}
                                </div>`
                            ).join('');
                            page2List.innerHTML += auctionResultsHTML;
                        }
                    }
                    advanceDraftAfterRound();
                });
            } else {
                advanceDraftAfterRound();
            }
        });

        // Notify other users that this user has submitted their bids
        const submitHelper = (typeof submitCurrentRoundBidsToServer === 'function')
            ? submitCurrentRoundBidsToServer
            : window.submitCurrentRoundBidsToServer;
        if (typeof submitHelper !== 'function') {
            console.error('[silentdraft] submit helper unavailable during round submit broadcast');
            return;
        }

        submitHelper({ lockUI: true, lockLabel: 'Bids Submitted' }).then((submitted) => {
            if (submitted) {
                console.log('[silentdraft] Bid submission broadcasted');
            }
        });
    }

    // Get current round players
    function getRoundPlayers() {
        // Return all round players, not just the visible ones from DOM
        return window.currentRoundPlayers || window.syncedRoundPlayers || [];
    }
    function getYourTeam() {
        return teams.find(t => t.name === username) || null;
    }

    function advanceDraftAfterRound() {
        if (isDraftEnding) {
            console.log('[silentdraft] advanceDraftAfterRound ignored: draft is ending');
            return;
        }

        if (currentRound >= totalRounds) {
            endDraft();
            return;
        }

        // Keep round progression server-authoritative to avoid client desync.
        if (window.draftSocket && currentDraftCode) {
            window.draftSocket.emit('startNextRound', currentDraftCode, (response) => {
                if (response && response.ok) {
                    console.log('[silentdraft] Requested next round from server successfully');
                    return;
                }

                console.warn('[silentdraft] startNextRound rejected, requesting fresh draft state:', response);
                requestFreshDraftState();
            });
            return;
        }

        // Fallback for local/offline scenarios with no socket.
        currentRound++;
        startRound();
    }

    // Apply authoritative round results from server
    function applyRoundResults(results) {
        console.log('[silentdraft] Applying round results:', results);
        const tiedBids = [];
        const maxRosterSize = Math.max(1, Number(rosterSize || 0) + 3);
        
        results.forEach(result => {
            if (result.type === 'won') {
                // Find the player and team
                const player = players.find(p => p.id === result.playerId);
                const team = teams.find(t => t.name === result.winnerTeam);
                
                if (player && team) {
                    if ((team.roster || []).length >= maxRosterSize) {
                        return;
                    }
                    player.owner = team.name;
                    player.bid = result.pricePaid;
                    team.roster.push(player);
                    
                    // Sort roster by position priority, then by prerank within position
                    const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                    team.roster.sort((a, b) => {
                        const posA = positionOrder[a.position] || 99;
                        const posB = positionOrder[b.position] || 99;
                        if (posA !== posB) {
                            return posA - posB;
                        }
                        return a.positionRank - b.positionRank;
                    });
                    
                    team.budget = Math.max(0, Number(team.budget || 0) - Number(result.pricePaid || 0));
                }
            } else if (result.type === 'tied') {
                const player = players.find(p => p.id === result.playerId);
                if (player) {
                    tiedBids.push({
                        playerId: result.playerId,
                        playerName: result.playerName,
                        tiedTeams: result.tiedTeams,
                        bidAmount: result.bidAmount
                    });
                }
            }
            // Undrafted players don't need special handling
        });
        
        // Set up auction listeners IMMEDIATELY if there are ties
        // Server will automatically start auctions when all members accept
        if (tiedBids.length > 0) {
            console.log('[applyRoundResults] Tied bids detected, setting up auction listeners NOW');
            handleLiveAuction(tiedBids, () => {
                // After all auctions complete, advance to next round
                console.log('[applyRoundResults] All auctions complete');
                advanceDraftAfterRound();
            });
        }

        // Sync updated rosters to Rankings page
        saveDraftStateForRankings();

        return { tiedBids };
        
        // Update UI to show the new rosters
        updateUI([]);
        
        // Show results modal
        showRoundResultsModal(results, window.currentRoundPlayers || window.syncedRoundPlayers || [], () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            
            // If no ties, advance immediately when modal closes
            if (tiedBids.length === 0) {
                advanceDraftAfterRound();
            }
            // If there were ties, the auction completion handler above will advance
        });
    }


    // Show team players (now handled inline with dropdowns)
    function showTeamPlayers(teamName) {
        // This function is no longer needed as rosters are shown inline
        // Kept for backward compatibility
    }

    function showDraftSummary() {
        isDraftEnding = true;
        logDraftEndDebug('showDraftSummary:start', {
            currentDraftCode,
            teamCount: teams.length,
            username
        });

        try {
            localStorage.removeItem(DRAFT_TEMP_STARRED_KEY);
            localStorage.removeItem('rankingsDraftState');
        } catch (e) {
            // ignore
        }

        const draftResults = {
            draftCode: currentDraftCode,
            timestamp: new Date().toISOString(),
            completed: true,
            completionSource: 'draft-summary-page',
            host: draftHostName || (allDraftMembers.length > 0 ? allDraftMembers[0] : username),
            benchCutTarget: normalizeBenchCutTarget(benchCutTarget),
            rosterSettings: Object.assign({}, rosterSettings),
            teamProfiles: Object.assign({}, teamProfiles), // Include team profile types
            teams: teams.map(team => ({
                name: team.name,
                budgetRemaining: team.budget,
                profile: teamProfiles[team.name] || null, // Add profile to each team
                roster: team.roster.map(player => ({
                    id: player.id,
                    name: player.name,
                    position: player.position,
                    team: String(player && (player.team || player.playerTeam || '')).trim().toUpperCase(),
                    byeWeek: resolveDraftRoomByeWeek(player),
                    avgValue: Number(player && (player.avgValue || player.value) || 0),
                    bid: player.bid,
                    prerank: player.prerank
                }))
            }))
        };

        // DEBUG: Log team profiles at draftResults creation time
        console.log('[DEBUG] teamProfiles at draftResults creation:', teamProfiles);
        console.log('[DEBUG] draftResults.teamProfiles:', draftResults.teamProfiles);
        console.log('[DEBUG] draftResults.teams profiles:', draftResults.teams.map(t => ({ name: t.name, profile: t.profile })));

        const completedDraftsRaw = localStorage.getItem('completedDrafts');
        const completedDrafts = completedDraftsRaw ? JSON.parse(completedDraftsRaw) : [];

        const existingIndex = completedDrafts.findIndex(d => d.draftCode === currentDraftCode);
        if (existingIndex >= 0) {
            completedDrafts[existingIndex] = draftResults;
        } else {
            completedDrafts.push(draftResults);
        }

        localStorage.setItem('completedDrafts', JSON.stringify(completedDrafts));
        sessionStorage.setItem('latestDraftSummary', JSON.stringify(draftResults));
        logDraftEndDebug('showDraftSummary:redirect', {
            destination: 'draft-summary.html',
            completedDraftsCount: completedDrafts.length
        });
        window.location.href = 'draft-summary.html';
    }

    function showDraftFinalizingSplash() {
        const existing = document.getElementById('draft-finalizing-backdrop');
        if (existing) {
            return {
                remove: () => existing.remove()
            };
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'draft-finalizing-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.background = 'radial-gradient(circle at top, rgba(46, 204, 113, 0.24), rgba(15, 23, 42, 0.96) 58%)';
        backdrop.style.zIndex = '10001';
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';

        const card = document.createElement('div');
        card.style.width = '92%';
        card.style.maxWidth = '560px';
        card.style.borderRadius = '16px';
        card.style.border = '1px solid rgba(255,255,255,0.2)';
        card.style.background = 'linear-gradient(160deg, rgba(15,23,42,0.94), rgba(30,41,59,0.94))';
        card.style.boxShadow = '0 18px 48px rgba(0,0,0,0.45)';
        card.style.padding = '24px';
        card.style.textAlign = 'center';

        card.innerHTML = `
            <h3 style="margin:0 0 10px 0;color:#2ecc71;font-size:24px;letter-spacing:0.3px;">Finalizing Draft Results</h3>
            <p style="margin:0 0 16px 0;color:#d1d5db;line-height:1.5;">Applying Round 10 winners to team rosters and preparing your draft summary...</p>
            <div style="width:100%;height:10px;border-radius:999px;background:rgba(255,255,255,0.14);overflow:hidden;">
                <div id="draft-finalizing-progress" style="height:100%;width:0%;background:linear-gradient(90deg,#2ecc71,#34d399);transition:width 1.6s ease;"></div>
            </div>
        `;

        backdrop.appendChild(card);
        document.body.appendChild(backdrop);

        requestAnimationFrame(() => {
            const progress = document.getElementById('draft-finalizing-progress');
            if (progress) progress.style.width = '100%';
        });

        return {
            remove: () => {
                if (backdrop.parentNode) {
                    backdrop.remove();
                }
            }
        };
    }

    function showDraftEndPopup() {
        logDraftEndDebug('showDraftEndPopup');

        const existing = document.getElementById('draft-end-popup-backdrop');
        if (existing) return;

        let autoAdvanceTimerId = null;

        const backdrop = document.createElement('div');
        backdrop.id = 'draft-end-popup-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.background = 'rgba(0,0,0,0.7)';
        backdrop.style.zIndex = '10000';
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';

        const modal = document.createElement('div');
        modal.style.background = '#1e293b';
        modal.style.color = '#ffffff';
        modal.style.border = '1px solid rgba(255,255,255,0.2)';
        modal.style.borderRadius = '12px';
        modal.style.padding = '22px';
        modal.style.width = '92%';
        modal.style.maxWidth = '520px';
        modal.style.boxShadow = '0 14px 40px rgba(0,0,0,0.45)';
        modal.innerHTML = `
            <h3 style="margin:0 0 10px 0;color:#2ecc71;font-size:24px;">Draft Completed</h3>
            <p style="margin:0 0 0 0;line-height:1.5;opacity:0.95;">Advancing to the draft summary page...</p>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        autoAdvanceTimerId = setTimeout(() => {
            if (backdrop.parentNode) {
                backdrop.remove();
            }
            showDraftSummary();
        }, 2500);
    }

    function logDraftEndDebug(stage, details = {}) {
        const entry = {
            stage,
            timestamp: new Date().toISOString(),
            round: currentRound,
            username,
            details
        };
        if (!window.__draftEndDebugTrace) window.__draftEndDebugTrace = [];
        window.__draftEndDebugTrace.push(entry);
        console.log('[draft-end-debug]', entry);
        try {
            sessionStorage.setItem('draftEndDebugTrace', JSON.stringify(window.__draftEndDebugTrace));
        } catch (err) {
            console.warn('[draft-end-debug] Could not persist trace:', err);
        }
    }

    // End draft
    function endDraft() {
        if (isDraftEnding) return;
        isDraftEnding = true;
        setDraftScreenAwakeEnabled(false);
        stopDraftTabTitleTicker(true);

        logDraftEndDebug('endDraft:start', {
            totalRounds,
            teamRosters: teams.map(t => ({ name: t.name, rosterSize: t.roster.length, budget: t.budget }))
        });

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        let invalidTeams = [];
        teams.forEach(team => {
            if (!validateRoster(team)) {
                const positionCounts = team.roster.reduce((counts, p) => {
                    counts[p.position] = (counts[p.position] || 0) + 1;
                    return counts;
                }, {});
                invalidTeams.push(`${team.name}: ${JSON.stringify(positionCounts)}`);
            }
        });
        updateUI([]); // Lock/clear UI
        if (invalidTeams.length > 0) {
            console.warn('Invalid rosters:', invalidTeams);
            logDraftEndDebug('endDraft:invalidTeams', { invalidTeams });
        }

        logDraftEndDebug('endDraft:postAlert');

        const finalizingSplash = showDraftFinalizingSplash();
        setTimeout(() => {
            finalizingSplash.remove();

            const yourTeam = teams.find(t => t.name === username);
            if (!yourTeam) {
                console.error('[silentdraft] Could not find user team at draft end:', username);
                logDraftEndDebug('endDraft:missingUserTeam', { username });
                showDraftEndPopup();
                return;
            }

            const maxSummaryTotalPlayers = STARTER_SLOT_COUNT + normalizeBenchCutTarget(benchCutTarget);
            if (yourTeam.roster.length > maxSummaryTotalPlayers) {
                logDraftEndDebug('endDraft:cutBypassed', {
                    yourRosterSize: yourTeam.roster.length,
                    maxSummaryTotalPlayers,
                    reason: 'do_not_block_summary_on_incomplete_teams'
                });
            }

            // Give users a clear finalization step before summary appears.
            logDraftEndDebug('endDraft:advanceToSummary');
            showDraftEndPopup();
        }, 3000);
    }

    let isPaused = false;
    let pausedTimer = 0;
    let autoDraftEnabled = false;
    let autoDraftSoloGraceTimeoutId = null;
    let autoDraftSoloGraceIntervalId = null;

    // Attach event listeners to existing buttons in header
    const nextRoundButton = document.getElementById('next-round');
    const pauseButton = document.getElementById('pause-draft');
    const restartButton = document.getElementById('restart-draft');
    const autoDraftToggleButton = document.getElementById('auto-draft-toggle');

    function updatePauseButtonVisibility() {
        if (!pauseButton) return;
        if (window.isHost) {
            pauseButton.classList.remove('host-only-control');
            pauseButton.style.display = '';
            pauseButton.disabled = false;
            pauseButton.textContent = isPaused ? '▶ Resume Draft' : '⏸ Pause Draft';
            console.log('[silentdraft] Pause button shown for host');
        } else {
            pauseButton.classList.add('host-only-control');
            pauseButton.style.display = 'none';
            pauseButton.disabled = true;
            console.log('[silentdraft] Pause button hidden for non-host');
        }
    }

    updatePauseButtonVisibility();

    function updateAutoDraftToggleUI() {
        if (!autoDraftToggleButton) return;
        autoDraftToggleButton.setAttribute('aria-pressed', autoDraftEnabled ? 'true' : 'false');
        autoDraftToggleButton.textContent = autoDraftEnabled ? '🤖 Auto Draft: ON' : '🤖 Auto Draft: OFF';
    }

    if (autoDraftToggleButton) {
        updateAutoDraftToggleUI();
        autoDraftToggleButton.addEventListener('click', () => {
            autoDraftEnabled = !autoDraftEnabled;
            updateAutoDraftToggleUI();
            showNotification(`Auto Draft ${autoDraftEnabled ? 'enabled' : 'disabled'}`);

            if (autoDraftEnabled) {
                scheduleAutoDraftSoloGraceWindow();
            } else {
                clearAutoDraftSoloGraceWindow();
            }

            if (window.draftSocket && currentDraftCode) {
                window.draftSocket.emit('setAutoDraftStatus', currentDraftCode, username, autoDraftEnabled, () => {});
            }
        });
    }

    if (nextRoundButton) {
        nextRoundButton.addEventListener('click', () => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            const submitBtn = document.getElementById('submit-bids');
            const hasServerSubmitHandler = submitBtn && typeof submitBtn.onclick === 'function';

            if (autoDraftEnabled) {
                // Auto Draft still submits through the server path; the server CPU takes over this team.
                if (hasServerSubmitHandler) {
                    submitBtn.onclick();
                } else {
                    console.warn('[silentdraft] submit-bids handler not ready; cannot submit auto-draft round yet.');
                }
                return;
            }

            // Auto Draft is off: use normal/manual submit flow.
            if (hasServerSubmitHandler) {
                submitBtn.onclick();
            } else {
                console.warn('[silentdraft] submit-bids handler not ready; cannot submit round yet.');
            }
        });
    }

    function showNotification(message) {
        const notice = document.createElement('div');
        notice.style.position = 'fixed';
        notice.style.bottom = '24px';
        notice.style.right = '24px';
        notice.style.zIndex = '10001';
        notice.style.padding = '10px 14px';
        notice.style.borderRadius = '8px';
        notice.style.background = 'rgba(15, 23, 42, 0.92)';
        notice.style.border = '1px solid rgba(148, 163, 184, 0.35)';
        notice.style.color = '#f8fafc';
        notice.style.fontSize = '13px';
        notice.style.fontWeight = '600';
        notice.style.boxShadow = '0 10px 24px rgba(0, 0, 0, 0.35)';
        notice.style.opacity = '0';
        notice.style.transform = 'translateY(8px)';
        notice.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        notice.textContent = message;

        document.body.appendChild(notice);
        requestAnimationFrame(() => {
            notice.style.opacity = '1';
            notice.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            notice.style.opacity = '0';
            notice.style.transform = 'translateY(8px)';
            setTimeout(() => notice.remove(), 220);
        }, 2200);
    }

    function showAuctionTransitionPopup(message, attempt = 0) {
        const activeAuctionModal = document.getElementById('live-auction-modal');
        const countdownEl = (activeAuctionModal && activeAuctionModal.querySelector('#auction-countdown')) || document.getElementById('auction-countdown');
        if (countdownEl) {
            // Never replace the active bidding UI. Retry later and only render transition when bidding modal is no longer active.
            if (attempt < 120) {
                setTimeout(() => showAuctionTransitionPopup(message, attempt + 1), 100);
            }
            return;
        }

        const existingTransition = document.getElementById('auction-transition-popup');
        const content = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:220px;padding:8px 4px;box-sizing:border-box;">
                <div style="width:min(92%,420px);padding:18px 18px 16px 18px;border-radius:14px;border:1px solid rgba(173,220,246,0.28);background:linear-gradient(180deg, rgba(9,22,32,0.98) 0%, rgba(8,14,20,0.98) 100%);box-shadow:0 16px 42px rgba(0,0,0,0.38);text-align:center;color:#eef7ff;">
                    <div style="font-size:18px;font-weight:800;margin-bottom:8px;">Preparing for next auction...</div>
                    <div style="font-size:14px;line-height:1.45;color:#c8d9e6;">${message ? message : 'Loading the next tied player now.'}</div>
                    <div style="margin-top:14px;height:8px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;">
                        <div style="height:100%;width:100%;background:linear-gradient(90deg,#2ecc71,#3498db);animation:auctionTransitionBar 1.1s ease-in-out infinite alternate;"></div>
                    </div>
                </div>
            </div>
        `;

        if (existingTransition) {
            existingTransition.innerHTML = content;
            if (existingTransition.dataset.transitionTimeoutId) {
                clearTimeout(Number(existingTransition.dataset.transitionTimeoutId));
            }
            const dismissTimeoutId = setTimeout(() => {
                if (existingTransition && existingTransition.parentNode) {
                    existingTransition.parentNode.removeChild(existingTransition);
                }
            }, 1000);
            existingTransition.dataset.transitionTimeoutId = String(dismissTimeoutId);
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'auction-transition-popup';
        backdrop.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(3,8,12,0.24);backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px);padding:18px;box-sizing:border-box;';
        backdrop.innerHTML = content;
        document.body.appendChild(backdrop);

        const dismissTimeoutId = setTimeout(() => {
            if (backdrop && backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
        }, 1000);
        backdrop.dataset.transitionTimeoutId = String(dismissTimeoutId);
    }

    function clearAutoDraftSoloGraceWindow() {
        if (autoDraftSoloGraceTimeoutId) {
            clearTimeout(autoDraftSoloGraceTimeoutId);
            autoDraftSoloGraceTimeoutId = null;
        }
        if (autoDraftSoloGraceIntervalId) {
            clearInterval(autoDraftSoloGraceIntervalId);
            autoDraftSoloGraceIntervalId = null;
        }

        const submitBtn = document.getElementById('submit-bids');
        if (submitBtn && !submitBtn.disabled && String(submitBtn.textContent || '').startsWith('Auto submit in')) {
            submitBtn.textContent = 'Submit Bids';
        }
    }

    function scheduleAutoDraftSoloGraceWindow() {
        clearAutoDraftSoloGraceWindow();

        // Solo draft + auto draft ON: 10-second grace period to disable auto draft.
        if (!autoDraftEnabled || !Array.isArray(allDraftMembers) || allDraftMembers.length !== 1) {
            return;
        }

        const submitBtn = document.getElementById('submit-bids');
        if (!submitBtn || submitBtn.disabled || typeof submitBtn.onclick !== 'function') {
            return;
        }

        let remaining = 10;
        submitBtn.textContent = `Auto submit in ${remaining}s`;

        autoDraftSoloGraceIntervalId = setInterval(() => {
            if (!autoDraftEnabled || isDraftEnding) {
                return;
            }
            remaining -= 1;
            if (remaining > 0 && !submitBtn.disabled) {
                submitBtn.textContent = `Auto submit in ${remaining}s`;
            }
        }, 1000);

        autoDraftSoloGraceTimeoutId = setTimeout(() => {
            clearAutoDraftSoloGraceWindow();
            if (!autoDraftEnabled || isDraftEnding || isPaused) {
                return;
            }
            if (!submitBtn.disabled && typeof submitBtn.onclick === 'function') {
                console.log('[silentdraft] Solo auto draft grace ended - auto submitting bids');
                submitBtn.dataset.forceAutoSubmit = '1';
                try {
                    submitBtn.onclick();
                } finally {
                    delete submitBtn.dataset.forceAutoSubmit;
                }
            }
        }, 10000);
    }

    let pauseLockOverlay = null;
    let pauseControlSnapshot = null;
    let wasTimerRunningBeforePause = false;

    function getPauseLockTargets() {
        return Array.from(document.querySelectorAll('button, input, select, textarea')).filter(el => {
            if (!el || el.id === 'pause-draft') return false;
            if (el.closest('#draft-pause-overlay')) return false;
            return true;
        });
    }

    function applyDraftPauseLock(data) {
        wasTimerRunningBeforePause = !!timerInterval;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        if (!pauseControlSnapshot) {
            pauseControlSnapshot = new Map();
            getPauseLockTargets().forEach(el => {
                pauseControlSnapshot.set(el, !!el.disabled);
            });
        }

        getPauseLockTargets().forEach(el => {
            el.disabled = true;
        });

        if (!pauseLockOverlay) {
            pauseLockOverlay = document.createElement('div');
            pauseLockOverlay.id = 'draft-pause-overlay';
            pauseLockOverlay.style.position = 'fixed';
            pauseLockOverlay.style.inset = '0';
            pauseLockOverlay.style.zIndex = '10002';
            pauseLockOverlay.style.background = 'rgba(2, 6, 23, 0.75)';
            pauseLockOverlay.style.backdropFilter = 'blur(4px)';
            pauseLockOverlay.style.display = 'flex';
            pauseLockOverlay.style.alignItems = 'center';
            pauseLockOverlay.style.justifyContent = 'center';
            pauseLockOverlay.style.textAlign = 'center';
            pauseLockOverlay.style.padding = '24px';

            const card = document.createElement('div');
            card.style.maxWidth = '520px';
            card.style.width = '100%';
            card.style.background = 'rgba(15, 23, 42, 0.96)';
            card.style.border = '1px solid rgba(148, 163, 184, 0.35)';
            card.style.borderRadius = '14px';
            card.style.boxShadow = '0 20px 48px rgba(0,0,0,0.45)';
            card.style.padding = '22px 20px';
            card.style.color = '#f8fafc';
            card.innerHTML = '<h3 style="margin:0 0 10px 0;font-size:20px;">Draft Paused</h3><p id="draft-pause-overlay-msg" style="margin:0;font-size:14px;color:#cbd5e1;">Waiting for host to resume...</p>';
            pauseLockOverlay.appendChild(card);
            document.body.appendChild(pauseLockOverlay);
        }

        const msg = document.getElementById('draft-pause-overlay-msg');
        if (msg) {
            const pausedBy = data && data.pausedBy ? data.pausedBy : 'Host';
            msg.textContent = `${pausedBy} paused the draft. Waiting for resume...`;
        }

        if (pauseButton && window.isHost) {
            pauseButton.disabled = false;
            pauseButton.style.position = 'relative';
            pauseButton.style.zIndex = '10003';
        }
    }

    function clearDraftPauseLock() {
        if (pauseControlSnapshot) {
            pauseControlSnapshot.forEach((wasDisabled, el) => {
                if (el && el.isConnected) {
                    el.disabled = wasDisabled;
                }
            });
            pauseControlSnapshot = null;
        }

        if (pauseLockOverlay && pauseLockOverlay.parentNode) {
            pauseLockOverlay.parentNode.removeChild(pauseLockOverlay);
        }
        pauseLockOverlay = null;

        if (pauseButton) {
            pauseButton.style.zIndex = '';
            pauseButton.style.position = '';
        }
    }

    if (pauseButton) {
        pauseButton.addEventListener('click', () => {
            if (!window.isHost) {
                return;
            }
            if (!isPaused) {
                // Optimistically switch host control to Resume immediately for fast feedback.
                isPaused = true;
                updatePauseButtonVisibility();

                // Pause - emit to server to broadcast to all participants
                if (window.draftSocket) {
                    window.draftSocket.emit('pauseDraft', currentDraftCode, username, (response) => {
                        if (!response || !response.ok) {
                            // Roll back UI if server rejects pause.
                            isPaused = false;
                            updatePauseButtonVisibility();
                            showNotification('Unable to pause draft.');
                        }
                    });
                }
            } else {
                // Optimistically switch host control back to Pause immediately.
                isPaused = false;
                updatePauseButtonVisibility();

                // Resume - emit to server to broadcast to all participants
                if (window.draftSocket) {
                    window.draftSocket.emit('resumeDraft', currentDraftCode, username, (response) => {
                        if (!response || !response.ok) {
                            // Roll back UI if server rejects resume.
                            isPaused = true;
                            updatePauseButtonVisibility();
                            showNotification('Unable to resume draft.');
                        }
                    });
                }
            }
        });
    }

    // Socket event listeners - only set up if socket exists
    if (window.draftSocket) {
        // Listen for pause events from other participants
        window.draftSocket.on('draftPaused', (data) => {
            isPaused = true;
            if (pauseButton) {
                pauseButton.textContent = '▶ Resume Draft';
            }
            applyDraftPauseLock(data);
            
            // Show notification
            const pausedBy = data && data.pausedBy ? data.pausedBy : 'Host';
            showNotification(`${pausedBy} paused the draft.`);
        });

        // Listen for resume events from other participants
        window.draftSocket.on('draftResumed', (data) => {
            isPaused = false;
            if (pauseButton) {
                pauseButton.textContent = '⏸ Pause Draft';
            }
            clearDraftPauseLock();
            
            // Show notification
            const resumedBy = data && data.resumedBy ? data.resumedBy : 'Host';
            showNotification(`${resumedBy} resumed the draft.`);
            
            // Resume timer
            if (wasTimerRunningBeforePause) {
                resumeTimer();
            }
            wasTimerRunningBeforePause = false;
        });

        if (restartButton) {
            restartButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to restart the draft? All progress will be lost.')) {
                    // Emit restart to server to broadcast to all participants
                    window.draftSocket.emit('restartDraft', currentDraftCode, username);
                }
            });
        }

        // Listen for restart events from other participants
        window.draftSocket.on('draftRestarted', (data) => {
            // Reset teams
            teams.forEach(team => {
                team.budget = 200;
                team.roster = [];
            });
            // Reset players
            players.forEach(player => {
                player.bid = 0;
                delete player.owner;
            });
            // Reset round and timer
            currentRound = 1;
            timer = roundDuration;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            // Reset pause state
            isPaused = false;
            if (pauseButton) {
                pauseButton.textContent = '⏸ Pause Draft';
            }
            // Remove any cut UI
            let oldCutDiv = document.getElementById('cut-roster-div');
            if (oldCutDiv) oldCutDiv.remove();
            
            // Show notification
            showNotification(`Draft restarted by ${data.restartedBy}`);
            
            // Start draft again
            startRound();
        });
    }

    let timer = roundDuration; // Move timer to outer scope for pause/resume

    // Show round banner with sound effect
    function showRoundBanner(roundNumber) {
        // Remove existing banner if any
        const existingBanner = document.getElementById('roundBanner');
        if (existingBanner) {
            existingBanner.remove();
        }

        // Create banner
        const banner = document.createElement('div');
        banner.id = 'roundBanner';
        banner.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 60px;border-radius:16px;text-align:center;z-index:10000;box-shadow:0 10px 40px rgba(0,0,0,0.5);animation:slideIn 0.3s ease-out;';
        banner.innerHTML = `
            <h1 style="color:#fff;font-size:3em;margin:0;text-shadow:0 2px 10px rgba(0,0,0,0.3);">Round ${roundNumber}</h1>
        `;
        document.body.appendChild(banner);

        // Play round announcement sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Play a rising tone sequence
            const playTone = (frequency, startTime, duration) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.2, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                
                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            };
            
            // Three ascending tones
            playTone(600, audioContext.currentTime, 0.15);
            playTone(750, audioContext.currentTime + 0.15, 0.15);
            playTone(900, audioContext.currentTime + 0.3, 0.25);
        } catch (e) {
            console.log('[silentdraft] Audio not supported');
        }

        // Remove banner after 2 seconds
        setTimeout(() => {
            banner.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => banner.remove(), 300);
        }, 2000);
    }

    let roundPlayerWaitRecoveryTimer = null;
    let roundPlayerWaitAttempts = 0;

    function clearRoundPlayerWaitRecovery() {
        if (roundPlayerWaitRecoveryTimer) {
            clearInterval(roundPlayerWaitRecoveryTimer);
            roundPlayerWaitRecoveryTimer = null;
        }
    }

    function renderRoundPlayerWaitState(message) {
        const playerList = document.getElementById('players-list');
        if (!playerList) return;
        playerList.innerHTML = `<div style="text-align:center;padding:40px;color:#cbd5e0;line-height:1.5;">${message}</div>`;
    }

    function beginRoundPlayerWaitRecovery() {
        clearRoundPlayerWaitRecovery();
        roundPlayerWaitAttempts = 0;

        const runRecoveryTick = () => {
            if (window.isHost) {
                clearRoundPlayerWaitRecovery();
                return;
            }

            const syncedPlayers = Array.isArray(window.syncedRoundPlayers) ? window.syncedRoundPlayers : [];
            if (syncedPlayers.length > 0) {
                clearRoundPlayerWaitRecovery();
                updateUI(syncedPlayers);
                return;
            }

            roundPlayerWaitAttempts += 1;
            const socketDisconnected = !(window.draftSocket && window.draftSocket.connected);
            const waitLabel = socketDisconnected
                ? `Waiting for host to start the round... reconnecting (${roundPlayerWaitAttempts})`
                : `Waiting for host to start the round... syncing (${roundPlayerWaitAttempts})`;
            renderRoundPlayerWaitState(waitLabel);

            if (socketDisconnected && window.draftSocket) {
                try {
                    window.draftSocket.connect();
                } catch (error) {
                    console.warn('[silentdraft] Waiting recovery socket connect() failed:', error);
                }
            }

            if (window.draftSocket && window.draftSocket.connected && currentDraftCode) {
                try { window.draftSocket.emit('joinDraftRoom', currentDraftCode, username); } catch (_) {}
                try { window.draftSocket.emit('joinActiveDraft', currentDraftCode, username); } catch (_) {}
            }

            if (typeof requestFreshDraftState === 'function') {
                try {
                    requestFreshDraftState();
                } catch (error) {
                    console.warn('[silentdraft] Waiting recovery state refresh failed:', error);
                }
            }
        };

        runRecoveryTick();
        roundPlayerWaitRecoveryTimer = setInterval(runRecoveryTick, 2500);
    }

    function startRound() {
        setDraftScreenAwakeEnabled(true);
        updateDraftTabTitle(false);
        // Guard against duplicate round starts
        if (window.__roundStarting) {
            console.log('[silentdraft] startRound() called while already starting - ignoring duplicate');
            return;
        }
        window.__roundStarting = true;
        
        // Team profiles are now assigned in buildTeamsAndStartDraft() after teams are created
        
        lastCountdownCueKey = '';
        // Show round banner
        showRoundBanner(currentRound);
        
        // Wait for banner to display before starting round
        setTimeout(() => {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            if (currentRound > totalRounds) {
                endDraft();
                return;
            }
            timer = roundDuration;
            const timerElement = document.getElementById('timer');
            if (timerElement) {
                timerElement.textContent = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`;
            }
        
        // Host generates and broadcasts players, non-hosts wait for synced players
        if (window.isHost) {
            clearRoundPlayerWaitRecovery();
            let roundPlayers = [];
            if (ajDraftModeEnabled) {
                roundPlayers = getAjRoundPlayers();
            } else {
                // Host generates round players with 12 per page and 4 forced extra slots.
                const page1Core = ensureRequiredPositionsInPool(getRandomPlayers(10), ['K', 'DEF']);
                const page2Core = getBalancedPagePlayers(10, page1Core);
                const baseRoundPlayers = page1Core.concat(page2Core);
                const forcedExtras = getRoundExtras(['K', 'DEF', 'RB', 'WR'], baseRoundPlayers);

                const page1Players = [...page1Core];
                const page2Players = [...page2Core];

                const rbExtra = forcedExtras.find(player => player.position === 'RB');
                const wrExtra = forcedExtras.find(player => player.position === 'WR');
                const kExtra = forcedExtras.find(player => player.position === 'K');
                const defExtra = forcedExtras.find(player => player.position === 'DEF');

                if (rbExtra) page1Players.push(rbExtra);
                if (wrExtra) page1Players.push(wrExtra);
                if (kExtra) page2Players.push(kExtra);
                if (defExtra) page2Players.push(defExtra);

                const pickFallback = (exclude) => {
                    const pool = getRemainingUndraftedPlayers(exclude)
                        .filter(player => (
                            player.position !== 'K' &&
                            player.position !== 'DEF' &&
                            canSelectPlayerForCurrentRound(player, exclude, [])
                        ));
                    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
                };

                while (page1Players.length < 12) {
                    const fallback = pickFallback(page1Players.concat(page2Players));
                    if (!fallback) break;
                    page1Players.push(fallback);
                }

                while (page2Players.length < 12) {
                    const fallback = pickFallback(page1Players.concat(page2Players));
                    if (!fallback) break;
                    page2Players.push(fallback);
                }

                roundPlayers = page1Players.concat(page2Players);
            }
            
            // Mark all selected players as shown so they don't appear in future rounds
            roundPlayers.forEach(player => player.shown = true);
            
            console.log('[silentdraft] Host generated round players:', roundPlayers.map(p => p.name));
            updateUI(roundPlayers);
            
            // Broadcast to all members
            if (window.draftSocket && currentDraftCode) {
                window.draftSocket.emit('setRoundPlayers', currentDraftCode, roundPlayers, (response) => {
                    if (response && response.ok) {
                        console.log('[silentdraft] Round players broadcasted to all members');
                    }
                });
            }
        } else {
            // Non-host waits for synced players
            if (window.syncedRoundPlayers && window.syncedRoundPlayers.length > 0) {
                clearRoundPlayerWaitRecovery();
                console.log('[silentdraft] Using synced round players:', window.syncedRoundPlayers.map(p => p.name));
                updateUI(window.syncedRoundPlayers);
            } else {
                console.log('[silentdraft] Waiting for host to set round players...');
                beginRoundPlayerWaitRecovery();
            }
        }

        timerInterval = setInterval(() => {
            if (!isPaused) {
                let minutes = Math.floor(timer / 60);
                let seconds = timer % 60;
                if (timerElement) {
                    timerElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                }
                updateDraftTabTitle(false);
                playCountdownCue(timer);
                timer--;
                if (timer < 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    // Timer expired - trigger round processing on server
                    console.log('[silentdraft] Timer expired, processing round');
                    window.handleRoundTimerExpired();
                }
            }
        }, 1000);

        // In solo auto-draft mode, give a short window to disable auto before final auto-submit.
        scheduleAutoDraftSoloGraceWindow();
        
        // Clear the guard flag to allow next round to start
        window.__roundStarting = false;
        }, 2300); // Wait for banner to show (2s display + 300ms animation)
    }
    
    // Helper function to display round players (for non-hosts receiving synced players)
    function displayRoundPlayers(roundPlayers) {
        console.log('[silentdraft] Displaying synced round players');
        clearRoundPlayerWaitRecovery();
        updateUI(roundPlayers);
    }

    function resumeTimer() {
        if (isPaused || isDraftEnding || timerInterval || timer < 0) {
            return;
        }
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`;
        }
        updateDraftTabTitle(false);
        timerInterval = setInterval(() => {
            if (!isPaused) {
                let minutes = Math.floor(timer / 60);
                let seconds = timer % 60;
                if (timerElement) {
                    timerElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
                }
                updateDraftTabTitle(false);
                playCountdownCue(timer);
                timer--;
                if (timer < 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    // Timer expired - trigger round processing
                    window.handleRoundTimerExpired();
                }
            }
        }, 1000);
    }

    function isDraftLightMode() {
        return !!(document.body && (
            document.body.classList.contains('light-mode') ||
            document.body.classList.contains('dashboard-light-mode')
        ));
    }

    function getLiveAuctionTheme() {
        if (isDraftLightMode()) {
            return {
                overlay: 'rgba(25,52,86,0.28)',
                modalBackground: 'rgba(247,251,255,0.98)',
                text: '#17324d',
                muted: '#4f6279',
                cardBackground: 'rgba(80,145,215,0.12)',
                cardBorder: 'rgba(80,145,215,0.35)',
                separator: 'rgba(98,132,173,0.35)',
                shadow: '0 8px 32px rgba(24,56,91,0.18)',
                headerText: '#ffffff'
            };
        }

        return {
            overlay: 'rgba(0,0,0,0.62)',
            modalBackground: 'rgba(15,15,15,0.98)',
            text: '#f5f5f7',
            muted: '#95a5a6',
            cardBackground: 'rgba(52,152,219,0.1)',
            cardBorder: 'rgba(52,152,219,0.35)',
            separator: 'rgba(255,255,255,0.1)',
            shadow: '0 8px 32px rgba(0,0,0,0.8)',
            headerText: '#ffffff'
        };
    }

    let activeLiveAuctionUi = null;

    // Handle live auctions for tied bids
    function handleLiveAuction(tiedBids, onComplete) {
        console.log('[handleLiveAuction] Called with tiedBids:', tiedBids);
        if (typeof window.currentAuctionCleanup === 'function') {
            try {
                window.currentAuctionCleanup();
            } catch (cleanupError) {
                console.warn('[handleLiveAuction] Failed to clean previous auction listeners:', cleanupError);
            }
            window.currentAuctionCleanup = null;
        }

        if (activeLiveAuctionUi && typeof activeLiveAuctionUi.detach === 'function') {
            activeLiveAuctionUi.detach('new_auction_batch');
            activeLiveAuctionUi = null;
        }

        if (!tiedBids || tiedBids.length === 0) {
            console.log('[handleLiveAuction] No tied bids, completing');
            onComplete([]);
            return;
        }

        let hasSeenAuctionStart = false;
        let batchCompleted = false;
        const completedPlayerIds = new Set();
        const presentationCompletePlayerIds = new Set();
        const tiedPlayerIds = new Set(tiedBids.map(t => Number.parseInt(t.playerId, 10)));
        const auctionResults = []; // Collect auction results
        let allAuctionsCompleteListener = null;
        let winnerAnnouncementListener = null;

        const maybeFinishAuctionBatch = () => {
            if (batchCompleted) return;
            if (completedPlayerIds.size < tiedPlayerIds.size) return;
            if (presentationCompletePlayerIds.size < tiedPlayerIds.size) return;
            if (batchCompleted) return;
            batchCompleted = true;
            console.log('[handleLiveAuction] Finishing auction batch');
            window.currentAuctionCleanup();
            onComplete(auctionResults);
        };

        const markAuctionPresentationComplete = (playerId) => {
            const normalizedPlayerId = Number.parseInt(playerId, 10);
            if (!Number.isFinite(normalizedPlayerId) || !tiedPlayerIds.has(normalizedPlayerId)) {
                return;
            }
            presentationCompletePlayerIds.add(normalizedPlayerId);
            maybeFinishAuctionBatch();
        };

        const showFallbackWinnerAnnouncement = (payload) => {
            const theme = getLiveAuctionTheme();
            const winner = String((payload && payload.winner) || 'Unknown Team');
            const finalBid = Number((payload && payload.finalBid) || 0);
            const playerName = String((payload && payload.playerName) || 'Unknown Player');
            const playerPosition = String((payload && payload.playerPosition) || 'UNK');
            const playerId = Number.parseInt((payload && payload.playerId), 10);
            const winnerModalId = 'live-auction-winner-modal';

            // Track auction result
            auctionResults.push({
                playerId,
                playerName,
                winner,
                finalBid
            });

            const existingLiveModal = document.getElementById('live-auction-modal');
            const existingWinnerModal = document.getElementById(winnerModalId);
            if (existingLiveModal || existingWinnerModal) {
                return;
            }

            const existingBackdrop = document.getElementById('live-auction-backdrop');
            if (!existingBackdrop) {
                const backdrop = document.createElement('div');
                backdrop.id = 'live-auction-backdrop';
                backdrop.style.cssText = `position:fixed;inset:0;background:${theme.overlay};backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px);z-index:9999;touch-action:none;`;
                document.body.appendChild(backdrop);
            }

            const winnerModal = document.createElement('div');
            winnerModal.id = winnerModalId;
            winnerModal.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:${theme.modalBackground};border:2px solid #2ecc71;border-radius:12px;padding:18px;z-index:10000;color:${theme.text};box-shadow:${theme.shadow};width:min(92vw,560px);max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px);overflow-y:auto;overflow-x:hidden;box-sizing:border-box;touch-action:manipulation;-webkit-overflow-scrolling:touch;`;
            winnerModal.innerHTML = `
                <h3 style="color:#2ecc71;margin-top:0;text-align:center;">Auction Complete!</h3>
                <div style="background:${theme.cardBackground};border:1px solid ${theme.cardBorder};border-radius:8px;padding:12px;margin:12px 0;">
                    <p style="text-align:center;color:${theme.text};font-size:17px;margin:0 0 8px 0;"><strong>Player:</strong> ${playerName} (${playerPosition})</p>
                    <p style="text-align:center;color:#2ecc71;font-size:20px;font-weight:bold;margin:0 0 6px 0;">Winning Team: ${winner}</p>
                    <p style="text-align:center;color:#3498db;font-size:18px;margin:0;">Price: $${finalBid}</p>
                </div>
            `;
            document.body.appendChild(winnerModal);

            setTimeout(() => {
                const modal = document.getElementById(winnerModalId);
                if (modal && modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
                const backdrop = document.getElementById('live-auction-backdrop');
                if (backdrop && backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
                markAuctionPresentationComplete(playerId);
            }, 5000);
        };

        // Sort tied bids from highest to lowest
        tiedBids.sort((a, b) => b.bidAmount - a.bidAmount);
        console.log('[handleLiveAuction] Sorted tied bids:', tiedBids);

        // Set up a global listener for all auction starts
        const globalAuctionListener = (data) => {
            console.log('[globalAuctionListener] Received auction start:', data);
            // Check if this auction is one of our tied bids
            const matchingTie = tiedBids.find(t => t.playerId === data.playerId);
            if (matchingTie) {
                hasSeenAuctionStart = true;
                console.log('[globalAuctionListener] This is one of our tied bids, setting up UI');
                startLiveAuction(matchingTie, data.auctionId, () => {
                    markAuctionPresentationComplete(matchingTie.playerId);
                });
            }
        };

        const batchAuctionEndedListener = (data) => {
            const playerId = Number.parseInt(data && data.playerId, 10);
            if (!tiedPlayerIds.has(playerId)) return;

            completedPlayerIds.add(playerId);
            console.log('[handleLiveAuction] Batch ended count:', completedPlayerIds.size, '/', tiedPlayerIds.size);
            maybeFinishAuctionBatch();
        };
        
        // Store the listener and cleanup function
        window.currentAuctionCleanup = () => {
            console.log('[handleLiveAuction] Cleaning up global auction listener');
            window.draftSocket.off('liveAuctionStarted', globalAuctionListener);
            window.draftSocket.off('liveAuctionEnded', batchAuctionEndedListener);
            if (winnerAnnouncementListener) {
                window.draftSocket.off('liveAuctionWinnerAnnouncement', winnerAnnouncementListener);
            }
            if (allAuctionsCompleteListener) {
                window.draftSocket.off('allMembersAccepted', allAuctionsCompleteListener);
            }
        };
        
        window.draftSocket.on('liveAuctionStarted', globalAuctionListener);
        window.draftSocket.on('liveAuctionEnded', batchAuctionEndedListener);
        winnerAnnouncementListener = (data) => {
            const playerId = Number.parseInt(data && data.playerId, 10);
            if (!tiedPlayerIds.has(playerId)) return;
            showFallbackWinnerAnnouncement(data);
        };
        window.draftSocket.on('liveAuctionWinnerAnnouncement', winnerAnnouncementListener);
        
        // Wait for all auctions to complete (server will emit allMembersAccepted when done)
        allAuctionsCompleteListener = () => {
            if (batchCompleted) return;
            if (!hasSeenAuctionStart) {
                console.log('[handleLiveAuction] Ignoring pre-auction allMembersAccepted event');
                return;
            }
            console.log('[handleLiveAuction] All auctions complete, cleaning up');
            maybeFinishAuctionBatch();
        };
        window.draftSocket.on('allMembersAccepted', allAuctionsCompleteListener);
        
        console.log('[handleLiveAuction] Global listener set up, waiting for server to start auctions...');
    }

    // Start a single live auction for one tied player
    function startLiveAuction(tied, auctionId, onPresentationComplete) {
        const theme = getLiveAuctionTheme();
        console.log('[startLiveAuction] Starting auction for:', tied, 'with auctionId:', auctionId);

        if (activeLiveAuctionUi && typeof activeLiveAuctionUi.detach === 'function') {
            activeLiveAuctionUi.detach('superseded_auction');
            activeLiveAuctionUi = null;
        }

        const player = players.find(p => p.id === tied.playerId);
        if (!player) {
            console.log('[startLiveAuction] Player not found:', tied.playerId);
            return;
        }
        console.log('[startLiveAuction] Found player:', player);

        console.log('[startLiveAuction] Checking if user is in tie - username:', username, 'tiedTeams:', tied.tiedTeams);
        const currentUserTeam = teams.find((team) => isCurrentUserTeamName(team.name));
        const resolvedUsername = currentUserTeam?.name || username;
        const userInTie = tied.tiedTeams.some((teamName) => isCurrentUserTeamName(teamName));
        console.log('[startLiveAuction] userInTie:', userInTie);
        
        let currentBid = tied.bidAmount;
        let currentWinner = null;
        let backedOut = false;
        const backedOutTeams = [];
        let bidUpdateHandler = null;
        let timerUpdateHandler = null;
        let completeHandler = null;
        let backoutHandler = null;
        let listenersDetached = false;
        let countdownEl = null;
        let bidAmountEl = null;
        let missingCountdownLogCount = 0;
        let missingBidLogCount = 0;
        const suppressedUiState = {
            pwaSettingsWasOpen: false
        };

        const detachAuctionListeners = (reason) => {
            if (listenersDetached || !window.draftSocket) return;
            listenersDetached = true;

            if (typeof bidUpdateHandler === 'function') {
                window.draftSocket.off('liveAuctionBidPlaced', bidUpdateHandler);
            }
            if (typeof timerUpdateHandler === 'function') {
                window.draftSocket.off('liveAuctionTimerUpdate', timerUpdateHandler);
            }
            if (typeof completeHandler === 'function') {
                window.draftSocket.off('liveAuctionEnded', completeHandler);
            }
            if (typeof backoutHandler === 'function') {
                window.draftSocket.off('liveAuctionBackout', backoutHandler);
            }

            if (activeLiveAuctionUi && activeLiveAuctionUi.auctionId === auctionId) {
                activeLiveAuctionUi = null;
            }

            if (reason) {
                const expectedReasons = new Set([
                    'missing_live_auction_ui_on_bid_update',
                    'missing_live_auction_ui_on_timer_update',
                    'new_auction_batch',
                    'auction_completed'
                ]);
                const logFn = expectedReasons.has(reason) ? console.debug : console.warn;
                logFn('[startLiveAuction] Detached auction listeners:', reason, auctionId);
            }
        };

        const suppressConflictingOverlays = () => {
            const processingModal = document.getElementById('processing-bids-modal');
            if (processingModal && processingModal.parentNode) {
                processingModal.parentNode.removeChild(processingModal);
            }

            const pwaSheet = document.getElementById('pwaSettingsSheet');
            const pwaBackdrop = document.getElementById('pwaSettingsBackdrop');
            const settingsOpen = Boolean(
                (pwaSheet && pwaSheet.classList.contains('is-open')) ||
                (pwaBackdrop && pwaBackdrop.classList.contains('is-open'))
            );
            suppressedUiState.pwaSettingsWasOpen = settingsOpen;

            if (settingsOpen) {
                if (pwaSheet) pwaSheet.classList.remove('is-open');
                if (pwaBackdrop) pwaBackdrop.classList.remove('is-open');
            }
        };

        const restoreSuppressedOverlays = () => {
            if (!suppressedUiState.pwaSettingsWasOpen) {
                return;
            }
            const pwaSheet = document.getElementById('pwaSettingsSheet');
            const pwaBackdrop = document.getElementById('pwaSettingsBackdrop');
            if (pwaSheet) pwaSheet.classList.add('is-open');
            if (pwaBackdrop) pwaBackdrop.classList.add('is-open');
        };

        const removeAuctionUi = () => {
            const modal = document.getElementById('live-auction-modal');
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            const backdrop = document.getElementById('live-auction-backdrop');
            if (backdrop && backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
            restoreSuppressedOverlays();
        };

        // Prevent layered overlays from blocking live auction interactions on mobile.
        removeAuctionUi();
        suppressConflictingOverlays();

        const auctionBackdrop = document.createElement('div');
        auctionBackdrop.id = 'live-auction-backdrop';
        auctionBackdrop.style.cssText = `position:fixed;inset:0;background:${theme.overlay};backdrop-filter:blur(1px);-webkit-backdrop-filter:blur(1px);z-index:9999;touch-action:none;`;
        document.body.appendChild(auctionBackdrop);

        // Create auction UI
        let auctionDiv = document.createElement('div');
        auctionDiv.id = 'live-auction-modal';
        
        // Add pulsing animation if user is in the auction
        const pulseAnimation = userInTie ? `
            @keyframes auctionPulse {
                0%, 100% { transform: translate(-50%,-50%) scale(1); box-shadow: 0 8px 32px rgba(0,0,0,0.8); }
                50% { transform: translate(-50%,-50%) scale(1.02); box-shadow: 0 8px 48px rgba(52,152,219,0.6); }
            }
        ` : '';
        
        if (userInTie && pulseAnimation) {
            const styleTag = document.createElement('style');
            styleTag.textContent = pulseAnimation;
            document.head.appendChild(styleTag);
        }
        
        const animationStyle = userInTie ? 'animation: auctionPulse 1s ease-in-out 2;' : '';
        
        auctionDiv.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:${theme.modalBackground};border:2px solid ${userInTie ? '#2ecc71' : '#3498db'};border-radius:12px;padding:18px;z-index:10000;color:${theme.text};box-shadow:${theme.shadow};width:min(92vw,560px);max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px);overflow-y:auto;overflow-x:hidden;box-sizing:border-box;touch-action:manipulation;-webkit-overflow-scrolling:touch;${animationStyle}`;
        
        auctionDiv.innerHTML = `
            <div style="background:linear-gradient(135deg,${userInTie ? '#2ecc71,#27ae60' : '#3498db,#2980b9'});padding:16px;border-radius:8px;margin:-24px -24px 20px -24px;">
                <h3 style="color:${theme.headerText};margin:0;text-align:center;font-size:20px;text-transform:uppercase;letter-spacing:1px;">Live Auction${userInTie ? ' - YOU\'RE IN!' : ''}</h3>
            </div>
            <div style="background:${theme.cardBackground};border:2px solid #3498db;border-radius:8px;padding:16px;margin-bottom:20px;">
                <p style="text-align:center;color:#3498db;font-size:18px;font-weight:bold;margin:0 0 8px 0;">${player.playerName || player.name} (${player.position})</p>
                <p style="text-align:center;color:${theme.text};font-size:16px;margin:0 0 8px 0;">Tied at: <span style="color:#2ecc71;font-weight:bold;">$${tied.bidAmount}</span></p>
                <p style="text-align:center;color:${theme.muted};font-size:14px;margin:0;overflow-wrap:anywhere;word-break:break-word;">Competing Teams: <span style="color:${theme.text};font-weight:600;overflow-wrap:anywhere;word-break:break-word;">${tied.tiedTeams.join(', ')}</span></p>
            </div>
            <div style="margin:20px 0;text-align:center;">
                <p style="color:${theme.muted};font-size:14px;margin:0 0 8px 0;">Current Bid:</p>
                <div style="display:flex;align-items:center;justify-content:center;gap:20px;">
                    <p id="live-bid-amount" style="font-size:48px;font-weight:bold;margin:0;color:#3498db;">$${currentBid}</p>
                    ${userInTie ? `<button id="bid-up-btn" style="background:#3498db;color:#fff;border:none;border-radius:50%;width:64px;height:64px;font-size:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:bold;transition:all 0.2s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;">↑</button>` : ''}
                </div>
            </div>
            <p id="auction-countdown" style="text-align:center;color:#2ecc71;font-size:18px;font-weight:bold;margin:16px 0;">Time: 10s</p>
            <div id="auction-backout-log" style="margin:10px 0 0 0;padding:10px;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.22);border-radius:8px;font-size:13px;color:#f2b8b5;text-align:center;">
                <strong style="color:#e74c3c;">Backed Out:</strong> None yet
            </div>
            ${userInTie ? `
                <div id="backout-control-wrap" style="border-top:1px solid ${theme.separator};padding-top:16px;margin-top:16px;text-align:center;">
                    <label style="display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:12px;background:rgba(231,76,60,0.1);border-radius:8px;">
                        <input type="radio" id="backout-radio" name="backout" style="width:18px;height:18px;cursor:pointer;"/>
                        <span style="color:#e74c3c;font-weight:600;">Back Out of Auction</span>
                    </label>
                </div>
            ` : ''}
        `;
        document.body.appendChild(auctionDiv);

        const resolveAuctionModal = () => {
            if (auctionDiv && auctionDiv.isConnected) {
                return auctionDiv;
            }
            const fallbackModal = document.getElementById('live-auction-modal');
            if (fallbackModal) {
                auctionDiv = fallbackModal;
                return auctionDiv;
            }
            return null;
        };
        countdownEl = auctionDiv.querySelector('#auction-countdown');
        bidAmountEl = auctionDiv.querySelector('#live-bid-amount');

        // Play "ding ding ding" sound effect if user is in the tied auction
        if (userInTie) {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Create three quick "ding" sounds like a boxing match bell
                const playDing = (frequency, delay) => {
                    setTimeout(() => {
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        // Bell-like sound with harmonics
                        oscillator.frequency.value = frequency;
                        oscillator.type = 'sine';
                        
                        // Quick attack and decay for bell sound
                        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05); // Quick attack
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3); // Decay
                        
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.3);
                    }, delay);
                };
                
                // Play three dings with decreasing frequency (like a bell)
                playDing(800, 0);    // First ding
                playDing(700, 200);  // Second ding (slightly lower)
                playDing(600, 400);  // Third ding (even lower)
                
            } catch (e) {
                console.log('[startLiveAuction] Audio not supported for auction sound effect');
            }
        }

        // Socket listener for bid updates
        bidUpdateHandler = (data) => {
            console.log('[bidUpdateHandler] Received bid update:', data);
            if (data.auctionId !== auctionId) {
                console.log('[bidUpdateHandler] AuctionId mismatch, ignoring');
                return;
            }

            const activeModal = resolveAuctionModal();
            if (!activeModal) {
                // The UI can be temporarily replaced by transition/winner overlays.
                // Keep listeners attached so we can recover on the next render tick.
                return;
            }
            
            console.log('[bidUpdateHandler] Updating currentBid from', currentBid, 'to', data.amount);
            console.log('[bidUpdateHandler] New winner:', data.bidder);
            currentBid = data.amount;
            currentWinner = data.bidder;
            
            updateBidDisplay();
        };
        window.draftSocket.on('liveAuctionBidPlaced', bidUpdateHandler);

        // Timer update listener
        timerUpdateHandler = (data) => {
            console.debug('[timerUpdateHandler] Received timer update:', data);
            if (data.auctionId !== auctionId) return;
            
            if (!countdownEl || !countdownEl.isConnected) {
                const activeModal = resolveAuctionModal();
                countdownEl = (activeModal && activeModal.querySelector('#auction-countdown')) || document.getElementById('auction-countdown');
            }

            if (countdownEl) {
                countdownEl.textContent = `Time: ${data.timer}s`;
                console.debug('[timerUpdateHandler] Updated countdown display to:', data.timer);
            } else {
                missingCountdownLogCount += 1;
                if (missingCountdownLogCount === 1) {
                    console.debug('[timerUpdateHandler] Countdown element temporarily unavailable during UI transition');
                }
                // Do not detach listeners for transient UI swaps.
            }
        };
        window.draftSocket.on('liveAuctionTimerUpdate', timerUpdateHandler);

        // Auction complete listener
        completeHandler = (data) => {
            console.log('[completeHandler] Received liveAuctionEnded event:', data);
            console.log('[completeHandler] Checking auctionId:', data.auctionId, 'vs', auctionId);
            
            if (data.auctionId !== auctionId) {
                console.log('[completeHandler] AuctionId mismatch, ignoring');
                return;
            }
            
            console.log('[completeHandler] AuctionId matches, processing completion');
            detachAuctionListeners('auction_completed');
            
            // Update local state - award player to winner
            const winnerTeam = teams.find(t => t.name === data.winner);
            if (winnerTeam && player) {
                // Update player owner
                player.owner = data.winner;
                player.bid = data.finalBid;
                
                // Add to winner's roster
                winnerTeam.roster.push(player);
                
                // Sort roster by position priority, then by prerank within position
                const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
                winnerTeam.roster.sort((a, b) => {
                    const posA = positionOrder[a.position] || 99;
                    const posB = positionOrder[b.position] || 99;
                    if (posA !== posB) {
                        return posA - posB;
                    }
                    return a.positionRank - b.positionRank;
                });
                
                // Deduct from budget
                winnerTeam.budget -= data.finalBid;
                
                console.log('[completeHandler] Updated local state - awarded', player.name, 'to', data.winner, 'for $' + data.finalBid);
            }
            
            console.log('[completeHandler] Showing winner display for 5 seconds');
            console.log('[completeHandler] auctionDiv exists:', !!auctionDiv);

            const backedOutSummary = backedOutTeams.length
                ? backedOutTeams.join(', ')
                : '';
            const BACKOUT_SUMMARY_MS = 2000;
            const WINNER_DISPLAY_MS = 4000;

            const finishPresentation = () => {
                removeAuctionUi();
                if (typeof onPresentationComplete === 'function') {
                    onPresentationComplete();
                }
            };

            const showWinnerSummary = () => {
                auctionDiv.innerHTML = `
                    <h3 style="color:#2ecc71;margin-top:0;text-align:center;">Auction Complete!</h3>
                    <div style="background:${theme.cardBackground};border:1px solid ${theme.cardBorder};border-radius:8px;padding:12px;margin:12px 0;">
                        <p style="text-align:center;color:${theme.text};font-size:17px;margin:0 0 8px 0;"><strong>Player:</strong> ${player.playerName || player.name} (${player.position})</p>
                        <p style="text-align:center;color:#2ecc71;font-size:20px;font-weight:bold;margin:0 0 6px 0;">Winning Team: ${data.winner}</p>
                        <p style="text-align:center;color:#3498db;font-size:18px;margin:0;">Price: $${data.finalBid}</p>
                    </div>
                `;

                console.log('[completeHandler] Winner display HTML set, waiting 2 seconds before removing');
                setTimeout(() => {
                    console.log('[completeHandler] 2 seconds elapsed, removing winner display');
                    finishPresentation();
                    console.log('[completeHandler] Winner display removed');
                }, WINNER_DISPLAY_MS);
            };

            if (backedOutSummary) {
                auctionDiv.innerHTML = `
                    <h3 style="color:#e74c3c;margin-top:0;text-align:center;">Backouts Recorded</h3>
                    <div style="margin-top:10px;padding:12px;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:8px;">
                        <p style="text-align:center;color:#e6a7a2;font-size:15px;margin:0;"><strong style="color:#e74c3c;">Backed Out:</strong> ${backedOutSummary}</p>
                    </div>
                `;
                setTimeout(showWinnerSummary, BACKOUT_SUMMARY_MS);
            } else {
                showWinnerSummary();
            }
        };
        window.draftSocket.on('liveAuctionEnded', completeHandler);

        // Backout listener
        backoutHandler = (data) => {
            if (data.auctionId !== auctionId) return;

            const backoutTeam = String(data.teamName || data.username || 'A team').trim();
            if (backoutTeam && !backedOutTeams.includes(backoutTeam)) {
                backedOutTeams.push(backoutTeam);
            }

            const backoutLog = document.getElementById('auction-backout-log');
            if (backoutLog) {
                const list = backedOutTeams.length ? backedOutTeams.join(', ') : 'None yet';
                backoutLog.innerHTML = `<strong style="color:#e74c3c;">Backed Out:</strong> ${list}`;
            }
            
            // Show message that someone backed out
            const message = document.createElement('p');
            message.style.cssText = 'text-align:center;color:#e74c3c;font-size:14px;margin:8px 0;';
            message.textContent = `${backoutTeam} backed out`;
            auctionDiv.appendChild(message);
            
            setTimeout(() => {
                if (message && message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 3000);
        };
        window.draftSocket.on('liveAuctionBackout', backoutHandler);

        activeLiveAuctionUi = {
            auctionId,
            detach: detachAuctionListeners
        };

        // Update bid display color
        function updateBidDisplay() {
            console.log('[updateBidDisplay] Updating display - currentBid:', currentBid, 'currentWinner:', currentWinner, 'username:', username);
            if (!bidAmountEl || !bidAmountEl.isConnected) {
                const activeModal = resolveAuctionModal();
                bidAmountEl = (activeModal && activeModal.querySelector('#live-bid-amount')) || document.getElementById('live-bid-amount');
            }

            const bidAmount = bidAmountEl;
            const backoutWrap = document.getElementById('backout-control-wrap');
            const leading = currentWinner && isCurrentUserTeamName(currentWinner);

            if (backoutWrap) {
                backoutWrap.style.display = leading ? 'none' : '';
            }

            if (bidAmount) {
                bidAmount.textContent = `$${currentBid}`;
                console.log('[updateBidDisplay] Updated bid amount text to:', bidAmount.textContent);
                
                if (currentWinner === null) {
                    bidAmount.style.color = '#3498db'; // Blue - tied
                    console.log('[updateBidDisplay] Color: BLUE (tied)');
                } else if (isCurrentUserTeamName(currentWinner)) {
                    bidAmount.style.color = '#2ecc71'; // Green - winning
                    console.log('[updateBidDisplay] Color: GREEN (winning)');
                } else {
                    bidAmount.style.color = '#e74c3c'; // Red - losing
                    console.log('[updateBidDisplay] Color: RED (losing)');
                }
            } else {
                missingBidLogCount += 1;
                if (missingBidLogCount <= 2) {
                    console.warn('[updateBidDisplay] live-bid-amount element not found (auction UI likely replaced)');
                }
                // Keep listeners active; complete events should still land and clean up.
            }
        }

        // Up arrow button
        const upBtn = document.getElementById('bid-up-btn');
        if (upBtn && userInTie) {
            console.log('[upBtn] Up arrow button found and user is in tie');
            let lastBidAttemptAt = 0;
            const handleBidUp = () => {
                console.log('[upBtn] Up arrow clicked!');
                const now = Date.now();
                if (now - lastBidAttemptAt < 250) {
                    return;
                }
                lastBidAttemptAt = now;
                if (backedOut) {
                    console.log('[upBtn] User has backed out, ignoring click');
                    alert('You have backed out of this auction');
                    return;
                }
                
                const newBid = currentBid + 1;
                const yourTeam = currentUserTeam || teams.find((team) => String(team.name || '').trim() === String(resolvedUsername || '').trim());
                console.log('[upBtn] Current bid:', currentBid, '→ New bid:', newBid);
                console.log('[upBtn] User budget:', yourTeam ? yourTeam.budget : '(team not found)');

                if (!yourTeam) {
                    alert('Unable to resolve your team for this auction. Please refresh and rejoin the draft.');
                    return;
                }
                
                if (newBid > yourTeam.budget) {
                    console.log('[upBtn] Bid exceeds budget, rejecting');
                    alert(`Bid exceeds your budget of $${yourTeam.budget}`);
                    return;
                }
                
                if (newBid > 999) {
                    console.log('[upBtn] Bid exceeds max (999), rejecting');
                    alert('Maximum bid is $999');
                    return;
                }
                
                console.log('[upBtn] Sending bid to server via socket...');
                // Send to server - do NOT optimistically update, wait for server broadcast
                window.draftSocket.emit('placeLiveAuctionBid', currentDraftCode, auctionId, newBid, (response) => {
                    console.log('[upBtn] Server response:', response);
                    if (!response || !response.ok) {
                        console.error('[upBtn] Failed to place bid:', response?.reason);
                        alert('Failed to place bid: ' + (response?.reason || 'unknown error'));
                    } else {
                        console.log('[upBtn] Bid successfully placed!');
                    }
                });
                
                // Brief disable
                upBtn.disabled = true;
                upBtn.style.background = '#95a5a6';
                setTimeout(() => {
                    upBtn.disabled = false;
                    upBtn.style.background = '#3498db';
                }, 500);
            };
            upBtn.addEventListener('click', handleBidUp);
            upBtn.addEventListener('touchend', (event) => {
                event.preventDefault();
                handleBidUp();
            }, { passive: false });
        }

        // Setup backout radio
        const backoutRadio = document.getElementById('backout-radio');
        if (backoutRadio && userInTie) {
            const handleBackout = () => {
                if (backoutRadio.checked) {
                    window.draftSocket.emit('backoutLiveAuction', currentDraftCode, auctionId, (response) => {
                        if (response && response.ok) {
                            backedOut = true;
                            alert('You have backed out of this auction');
                            
                            // Disable bidding
                            const upBtn = document.getElementById('bid-up-btn');
                            if (upBtn) {
                                upBtn.disabled = true;
                                upBtn.style.background = '#95a5a6';
                            }
                        }
                    });
                }
            };
            backoutRadio.addEventListener('change', handleBackout);
            backoutRadio.addEventListener('click', handleBackout);
        }
    }

    // Show round results modal and wait for all users to accept
function showRoundResultsModal(serverResults, roundPlayers, onComplete, meta = {}) {
    const draftLightMode = isDraftLightMode();
    const modalBackground = draftLightMode ? 'rgba(247,251,255,0.98)' : 'rgba(15,15,15,0.98)';
    const modalText = draftLightMode ? '#17324d' : '#f5f5f7';
    const sectionBorder = draftLightMode ? 'rgba(98,132,173,0.28)' : 'rgba(255,255,255,0.1)';
    const itemBackground = draftLightMode ? 'rgba(80,145,215,0.10)' : 'rgba(255,255,255,0.05)';
    const detailsBackground = draftLightMode ? 'rgba(228,238,250,0.9)' : 'rgba(0,0,0,0.3)';
    const bidRowBorder = draftLightMode ? 'rgba(98,132,173,0.25)' : 'rgba(255,255,255,0.1)';
    const titleColor = '#2ecc71';
    const headingColor = '#3498db';

        const existingResultsModal = document.getElementById('round-results-modal');
        if (existingResultsModal && existingResultsModal.parentNode) {
            existingResultsModal.parentNode.removeChild(existingResultsModal);
        }

        const requestedRound = Number(meta && meta.roundNumber);
        const modalRoundNumber = Number.isFinite(requestedRound) && requestedRound > 0
            ? requestedRound
            : currentRound;
        activeRoundResultsModalRound = modalRoundNumber;

        let resultsDiv = document.createElement('div');
        resultsDiv.id = 'round-results-modal';
        resultsDiv.className = 'round-results-modal';
        const chromeElements = [
            document.querySelector('.header-bar'),
            document.querySelector('.silentdraft-app-nav')
        ].filter(Boolean);
        const setRoundResultsChromeVisible = (visible) => {
            document.body.classList.toggle('round-results-active', visible);

            chromeElements.forEach((el) => {
                if (visible) {
                    if (!Object.prototype.hasOwnProperty.call(el.dataset, 'roundResultsPrevDisplay')) {
                        el.dataset.roundResultsPrevDisplay = el.style.display || '';
                    }
                    el.style.display = 'none';
                    return;
                }

                if (Object.prototype.hasOwnProperty.call(el.dataset, 'roundResultsPrevDisplay')) {
                    el.style.display = el.dataset.roundResultsPrevDisplay;
                    delete el.dataset.roundResultsPrevDisplay;
                } else {
                    el.style.display = '';
                }
            });
        };
        setRoundResultsChromeVisible(true);
        resultsDiv.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;transform:none;background:${modalBackground};border:none;border-radius:0;padding:calc(14px + env(safe-area-inset-top)) 14px calc(14px + env(safe-area-inset-bottom)) 14px;z-index:10000;color:${modalText};box-shadow:none;width:100vw;height:100dvh;max-width:none;max-height:none;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;`;
        
        // Build displayResults and group by page
        const payloadResults = serverResults && Array.isArray(serverResults.results)
            ? serverResults.results
            : null;
        const resultsArray = Array.isArray(serverResults)
            ? serverResults
            : (payloadResults || []);
        const debugTypeCounts = { won: 0, tied: 0, undrafted: 0, other: 0 };
        const missingWinnerTeams = [];
        const displayResults = [];
        resultsArray.forEach(result => {
            const resultType = String(result && result.type || '').trim().toLowerCase();
            if (resultType === 'won') debugTypeCounts.won += 1;
            else if (resultType === 'tied') debugTypeCounts.tied += 1;
            else if (resultType === 'undrafted') debugTypeCounts.undrafted += 1;
            else debugTypeCounts.other += 1;

            if (resultType === 'won') {
                const team = teams.find(t => t.name === result.winnerTeam);
                const winnerTeamName = String((team && team.name) || result.winnerTeam || 'Unknown Team').trim();
                if (!team) {
                    missingWinnerTeams.push({ playerId: result.playerId, winnerTeam: result.winnerTeam });
                }
                const bidAmount = Number(result.bidAmount || 0);
                let resultText = `${result.playerName} → ${winnerTeamName} bid $${bidAmount} | final sale <span style="font-size:1.2em;font-weight:800;">$${result.pricePaid}</span>`;
                let isWinner = isCurrentUserTeamName(winnerTeamName);
                let isSecondPlace = isCurrentUserTeamName(result.secondHighestBidder);
                
                if (result.secondHighestBidder && result.secondHighestBid > 0) {
                    if (isSecondPlace) {
                        resultText += ` | <span style="color: #f39c12; font-weight: bold;">2nd: ${result.secondHighestBidder} ($${result.secondHighestBid})</span>`;
                    } else {
                        resultText += ` | 2nd: ${result.secondHighestBidder} ($${result.secondHighestBid})`;
                    }
                }
                
                if (isWinner) {
                    resultText = `<span style="color: #2ecc71; font-weight: bold;">${resultText}</span>`;
                }
                
                displayResults.push({ playerId: result.playerId, text: resultText, result: result });
            } else if (resultType === 'tied') {
                const tiedTeams = Array.isArray(result.tiedTeams) ? result.tiedTeams : [];
                let tieText = `${tiedTeams.join(' and ')} are tied at $${result.bidAmount} for ${result.playerName}`;
                // Highlight ties involving the user in blue
                if (tiedTeams.some(teamName => isCurrentUserTeamName(teamName))) {
                    tieText = `<span style="color: #3498db; font-weight: bold;">${tieText}</span>`;
                }
                displayResults.push({ playerId: result.playerId, text: tieText, result: result });
            } else if (resultType === 'undrafted') {
                displayResults.push({ playerId: result.playerId, text: `${result.playerName} was undrafted.`, result: result });
            } else {
                const fallbackName = String(result && result.playerName || `Player #${result && result.playerId ? result.playerId : '?'}`);
                const fallbackType = resultType || 'unknown';
                displayResults.push({
                    playerId: result && result.playerId,
                    text: `${fallbackName} (${fallbackType})`,
                    result: result
                });
            }
        });

        // Group by page using stored page groupings
        const page1Results = [];
        const page2Results = [];

        const unmatchedPlayerIds = [];
        displayResults.forEach(item => {
            const itemPlayerId = Number(item && item.playerId);
            const player = (window.page1Players || []).find(p => Number(p && p.id) === itemPlayerId) ||
                          (window.page2Players || []).find(p => Number(p && p.id) === itemPlayerId);
            if (player) {
                const isPage1Player = (window.page1Players || []).some(p => Number(p && p.id) === itemPlayerId);
                if (isPage1Player) {
                    page1Results.push(item);
                } else {
                    page2Results.push(item);
                }
            } else {
                unmatchedPlayerIds.push(item.playerId);
                // Fallback: if not found in stored pages, put in page 1
                page1Results.push(item);
            }
        });

        const roundResultsDebugSummary = {
            receivedResults: resultsArray.length,
            renderedResults: displayResults.length,
            page1Count: page1Results.length,
            page2Count: page2Results.length,
            typeCounts: debugTypeCounts,
            missingWinnerTeamCount: missingWinnerTeams.length,
            missingWinnerTeamSamples: missingWinnerTeams.slice(0, 5),
            unmatchedPlayerCount: unmatchedPlayerIds.length,
            unmatchedPlayerSamples: unmatchedPlayerIds.slice(0, 8),
            currentRound,
            modalRoundNumber,
            page1PoolSize: (window.page1Players || []).length,
            page2PoolSize: (window.page2Players || []).length
        };
        console.log('[silentdraft][roundResults][debug] render summary JSON:', JSON.stringify(roundResultsDebugSummary));
        console.log('[silentdraft][roundResults][debug] raw payload type:', {
            isArray: Array.isArray(serverResults),
            hasResultsArray: Boolean(payloadResults),
            rawType: Object.prototype.toString.call(serverResults)
        });
        if (displayResults.length === 0) {
            console.warn('[silentdraft][roundResults][debug] No displayable round results built from payload:', {
                summary: roundResultsDebugSummary,
                rawResultsSample: resultsArray.slice(0, 10),
                teamsSample: (teams || []).slice(0, 12).map(t => t && t.name)
            });
            console.warn('[silentdraft][roundResults][debug] No displayable round results JSON:', JSON.stringify({
                summary: roundResultsDebugSummary,
                rawResultsSample: resultsArray.slice(0, 10),
                teamsSample: (teams || []).slice(0, 12).map(t => t && t.name)
            }));
        }

        const page1List = page1Results.length > 0 ? page1Results.map(item => {
            const visibleBids = Array.isArray(item.result?.allBids)
                ? item.result.allBids.filter(bid => bid.amount > 0).sort((a, b) => b.amount - a.amount)
                : [];
            const bidDetails = visibleBids.length > 0
                ? visibleBids.map(bid => 
                `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid ${bidRowBorder};">
                    <span>${bid.teamName}:</span>
                    <span style="font-weight:bold;">$${bid.amount}</span>
                </div>`
            ).join('') : 'No bids received';
            
            return `<div class="round-results-item" style="margin:4px 0;padding:6px 8px;background:${itemBackground};border-radius:4px;font-size:13px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span>${item.text}</span>
                    <button class="bid-details-btn round-results-bid-btn" data-player-id="${item.playerId}" style="background:#3498db;color:#fff;border:none;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;">Bids ▼</button>
                </div>
                <div class="bid-details round-results-bid-details" style="display:none;margin-top:8px;padding:8px;background:${detailsBackground};border-radius:4px;max-height:150px;overflow-y:auto;">
                    ${bidDetails}
                </div>
            </div>`;
        }).join('') : '<p>No results for Page 1.</p>';
        const page2List = page2Results.length > 0 ? page2Results.map(item => {
            const visibleBids = Array.isArray(item.result?.allBids)
                ? item.result.allBids.filter(bid => bid.amount > 0).sort((a, b) => b.amount - a.amount)
                : [];
            const bidDetails = visibleBids.length > 0
                ? visibleBids.map(bid => 
                `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid ${bidRowBorder};">
                    <span>${bid.teamName}:</span>
                    <span style="font-weight:bold;">$${bid.amount}</span>
                </div>`
            ).join('') : 'No bids received';
            
            return `<div class="round-results-item" style="margin:4px 0;padding:6px 8px;background:${itemBackground};border-radius:4px;font-size:13px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span>${item.text}</span>
                    <button class="bid-details-btn round-results-bid-btn" data-player-id="${item.playerId}" style="background:#3498db;color:#fff;border:none;border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer;">Bids ▼</button>
                </div>
                <div class="bid-details round-results-bid-details" style="display:none;margin-top:8px;padding:8px;background:${detailsBackground};border-radius:4px;max-height:150px;overflow-y:auto;">
                    ${bidDetails}
                </div>
            </div>`;
        }).join('') : '<p>No results for Page 2.</p>';

        resultsDiv.innerHTML = `
            <h3 class="round-results-title" style="color:${titleColor};margin:0 0 12px 0;font-size:20px;">Round ${modalRoundNumber} Results</h3>
            <div class="round-results-columns" style="display:flex;gap:20px;flex:1;min-height:0;">
                <div class="round-results-column" style="flex:1;display:flex;flex-direction:column;min-height:0;">
                    <h4 class="round-results-section-title" style="color:${headingColor};margin:0 0 8px 0;font-size:16px;">Page 1 Results</h4>
                    <div class="round-results-list" style="flex:1;overflow-y:auto;margin:8px 0;padding-right:8px;border:1px solid ${sectionBorder};border-radius:6px;padding:8px;">${page1List}</div>
                </div>
                <div class="round-results-column" style="flex:1;display:flex;flex-direction:column;min-height:0;">
                    <h4 class="round-results-section-title" style="color:${headingColor};margin:0 0 8px 0;font-size:16px;">Page 2 Results</h4>
                    <div class="round-results-list" style="flex:1;overflow-y:auto;margin:8px 0;padding-right:8px;border:1px solid ${sectionBorder};border-radius:6px;padding:8px;">${page2List}</div>
                </div>
            </div>
            <div class="round-results-footer" style="margin-top:auto;display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
                <p id="waiting-status" class="round-results-status" style="color:${headingColor};text-align:center;margin:0;font-size:14px;">Waiting for all members to accept...</p>
                <button id="accept-results-btn" class="round-results-accept-btn" style="width:100%;padding:10px 20px;background:#2ecc71;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:15px;">Accept & Continue</button>
            </div>
        `;
        document.body.appendChild(resultsDiv);

        // Add event listeners for bid details dropdown buttons
        document.querySelectorAll('.bid-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const detailsDiv = btn.parentElement.nextElementSibling;
                const isVisible = detailsDiv.style.display !== 'none';
                
                // Hide all other bid details first
                document.querySelectorAll('.bid-details').forEach(div => {
                    div.style.display = 'none';
                });
                document.querySelectorAll('.bid-details-btn').forEach(b => {
                    b.textContent = 'Bids ▼';
                });
                
                // Toggle this one
                if (!isVisible) {
                    detailsDiv.style.display = 'block';
                    btn.textContent = 'Bids ▲';
                } else {
                    detailsDiv.style.display = 'none';
                    btn.textContent = 'Bids ▼';
                }
            });
        });

        // Handler for member acceptance updates
        const memberAcceptedHandler = (data) => {
            const eventRound = Number(data && data.roundNumber);
            if (Number.isFinite(eventRound) && eventRound > 0 && eventRound !== modalRoundNumber) {
                return;
            }

            const statusEl = document.getElementById('waiting-status');
            if (statusEl) {
                statusEl.textContent = data.message;
            }

            // Ensure this client always sees their accepted state, even if click/UI timing varies.
            if (data && data.username === username) {
                const acceptBtn = document.getElementById('accept-results-btn');
                if (acceptBtn) {
                    acceptBtn.disabled = true;
                    acceptBtn.style.background = '#95a5a6';
                    acceptBtn.textContent = 'Accepted ✓';
                }
                if (statusEl) {
                    statusEl.textContent = `You accepted. ${data.message}`;
                }
            }
        };

        let acceptAckTimeoutId = null;
        let acceptRequestInFlight = false;
        let acceptRequestAcked = false;
        let acceptRetryCount = 0;

        const clearAcceptAckTimeout = () => {
            if (acceptAckTimeoutId) {
                clearTimeout(acceptAckTimeoutId);
                acceptAckTimeoutId = null;
            }
        };

        const finishAcceptanceState = () => {
            acceptRequestInFlight = false;
            acceptRequestAcked = true;
            acceptRetryCount = 0;
            clearAcceptAckTimeout();
        };

        const sendAcceptRoundResults = (isRetry = false) => {
            if (!window.draftSocket || !currentDraftCode) return;

            acceptRequestInFlight = true;
            if (isRetry) {
                acceptRetryCount += 1;
            }

            console.log('[silentdraft] Emitting acceptRoundResults for:', username, isRetry ? '(retry)' : '');

            clearAcceptAckTimeout();
            acceptAckTimeoutId = setTimeout(() => {
                if (acceptRequestAcked) {
                    return;
                }

                if (window.draftSocket && window.draftSocket.connected) {
                    if (acceptRetryCount < 1) {
                        console.warn('[silentdraft] acceptRoundResults ack timeout; retrying once after a transport blip');
                        sendAcceptRoundResults(true);
                        return;
                    }

                    console.warn('[silentdraft] acceptRoundResults callback timeout after retry; assuming server state will reconcile on the next sync');
                    finishAcceptanceState();
                    return;
                }

                console.debug('[silentdraft] acceptRoundResults ack delayed while socket is disconnected; waiting for reconnect');
            }, 7000);

            window.draftSocket.emit('acceptRoundResults', currentDraftCode, username, modalRoundNumber, (response) => {
                if (acceptRequestAcked) return;
                clearAcceptAckTimeout();

                if (response && response.ok) {
                    console.log('[silentdraft] Acceptance recorded successfully');
                    if (response.allAccepted) {
                        // Fallback in case allMembersAccepted socket event is delayed/lost.
                        allAcceptedHandler();
                        return;
                    }
                    finishAcceptanceState();
                } else {
                    console.error('[silentdraft] Acceptance failed:', response);
                    acceptRequestInFlight = false;
                    acceptRequestAcked = false;
                    const acceptBtn = document.getElementById('accept-results-btn');
                    if (acceptBtn) {
                        acceptBtn.disabled = false;
                        acceptBtn.style.background = '#2ecc71';
                        acceptBtn.textContent = 'Accept & Continue';
                    }
                }
            });
        };
        
        // Handler for all members accepted
        const allAcceptedHandler = () => {
            if (isDraftEnding) {
                console.log('[silentdraft] Ignoring allMembersAccepted while draft ending');
                return;
            }
            console.log('[silentdraft] All members accepted results, advancing round');
            const statusEl = document.getElementById('waiting-status');
            if (statusEl) {
                statusEl.textContent = 'All members accepted!';
            }

            if (window.roundResultsTimeoutId) {
                clearTimeout(window.roundResultsTimeoutId);
                window.roundResultsTimeoutId = null;
            }

            activeRoundResultsModalRound = null;

            clearAcceptAckTimeout();
            acceptRequestInFlight = false;
            acceptRequestAcked = true;
            acceptRetryCount = 0;

            window.draftSocket.off('memberAcceptedResults', memberAcceptedHandler);
            window.draftSocket.off('connect', handleRoundResultsReconnect);
            window.draftSocket.off('disconnect', handleRoundResultsDisconnect);

            setTimeout(() => {
                if (resultsDiv && resultsDiv.parentNode) {
                    resultsDiv.parentNode.removeChild(resultsDiv);
                }
                setRoundResultsChromeVisible(false);
                onComplete();
            }, 1000);
        };

        const handleRoundResultsReconnect = () => {
            if (!resultsDiv || !resultsDiv.isConnected) return;
            console.log('[silentdraft] Reconnected while round-results modal is open; requesting round results replay.');
            if (window.draftSocket && currentDraftCode) {
                window.draftSocket.emit('recoverRoundResults', currentDraftCode, modalRoundNumber, (response) => {
                    if (!response || !response.ok) {
                        console.warn('[silentdraft] recoverRoundResults during modal reconnect failed:', response);
                    }
                });
            }
            if (!acceptRequestInFlight || acceptRequestAcked) return;
            console.log('[silentdraft] Reconnected while round-results acceptance is pending; resending once.');
            sendAcceptRoundResults(true);
        };

        const handleRoundResultsDisconnect = () => {
            clearAcceptAckTimeout();
        };

        // Attach listeners
        window.draftSocket.on('memberAcceptedResults', memberAcceptedHandler);
        window.draftSocket.once('allMembersAccepted', allAcceptedHandler);
        window.draftSocket.on('connect', handleRoundResultsReconnect);
        window.draftSocket.on('disconnect', handleRoundResultsDisconnect);

        window.roundResultsTimeoutId = setTimeout(() => {
            console.warn('[silentdraft] WARNING: Round results modal timeout - allMembersAccepted event not received within 2 minutes');
            window.draftSocket.off('memberAcceptedResults', memberAcceptedHandler);
            window.draftSocket.off('allMembersAccepted', allAcceptedHandler);
            window.draftSocket.off('connect', handleRoundResultsReconnect);
            window.draftSocket.off('disconnect', handleRoundResultsDisconnect);
            clearAcceptAckTimeout();

            if (resultsDiv && resultsDiv.parentNode) {
                resultsDiv.parentNode.removeChild(resultsDiv);
            }
            setRoundResultsChromeVisible(false);

            activeRoundResultsModalRound = null;

            onComplete();
        }, 120000);

        setTimeout(() => {
            const acceptBtn = document.getElementById('accept-results-btn');
            console.log('[silentdraft] Accept button found:', acceptBtn ? 'YES' : 'NO');

            const acceptedMembers = Array.isArray(meta && meta.acceptedMembers) ? meta.acceptedMembers : [];
            if (acceptBtn && acceptedMembers.includes(username)) {
                acceptBtn.disabled = true;
                acceptBtn.style.background = '#95a5a6';
                acceptBtn.textContent = 'Accepted ✓';
                const statusEl = document.getElementById('waiting-status');
                if (statusEl) {
                    statusEl.textContent = 'You already accepted this round. Waiting for other members...';
                }
                acceptRequestAcked = true;
                acceptRequestInFlight = false;
            }

            if (acceptBtn) {
                acceptBtn.addEventListener('click', function(e) {
                    console.log('[silentdraft] Accept button clicked!');
                    e.preventDefault();
                    e.stopPropagation();

                    try {
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const oscillator1 = audioContext.createOscillator();
                        const oscillator2 = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();

                        oscillator1.connect(gainNode);
                        oscillator2.connect(gainNode);
                        gainNode.connect(audioContext.destination);

                        oscillator1.frequency.value = 800;
                        oscillator2.frequency.value = 1000;
                        oscillator1.type = 'sine';
                        oscillator2.type = 'sine';

                        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

                        oscillator1.start(audioContext.currentTime);
                        oscillator2.start(audioContext.currentTime + 0.1);
                        oscillator1.stop(audioContext.currentTime + 0.3);
                        oscillator2.stop(audioContext.currentTime + 0.4);
                    } catch (error) {
                        console.log('[silentdraft] Audio not supported');
                    }

                    this.disabled = true;
                    this.style.background = '#95a5a6';
                    this.textContent = 'Accepted ✓';

                    const statusEl = document.getElementById('waiting-status');
                    if (statusEl) {
                        statusEl.textContent = 'You accepted. Waiting for other members...';
                    }

                    acceptRequestAcked = false;
                    sendAcceptRoundResults(false);

                    if (!window.draftSocket || !currentDraftCode) {
                        console.error('[silentdraft] Cannot emit - socket:', !!window.draftSocket, 'code:', currentDraftCode);
                        this.disabled = false;
                        this.style.background = '#2ecc71';
                        this.textContent = 'Accept & Continue';
                    }
                });
            } else {
                console.error('[silentdraft] Accept button not found in DOM!');
            }
        }, 100);
    }

    // Show processing bids modal
    function showProcessingBidsModal() {
        const draftLightMode = isDraftLightMode();
        const modalBackground = draftLightMode ? 'rgba(247,251,255,0.98)' : 'rgba(15, 15, 15, 0.98)';
        const modalText = draftLightMode ? '#17324d' : '#f5f5f7';
        const helperText = draftLightMode ? '#4f6279' : '#ccc';
        const shadow = draftLightMode ? '0 8px 32px rgba(24,56,91,0.18)' : '0 8px 32px rgba(0, 0, 0, 0.8)';

        // Remove any existing processing modal
        const existingModal = document.getElementById('processing-bids-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'processing-bids-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${modalBackground};
            border: 2px solid #3498db;
            border-radius: 12px;
            padding: 30px;
            z-index: 10001;
            color: ${modalText};
            box-shadow: ${shadow};
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #3498db;">
                Processing Bids...
            </div>
            <div style="font-size: 14px; color: ${helperText}; margin-bottom: 20px;">
                Calculating auction results and determining winners
            </div>
            <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid #3498db; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        console.log('[silentdraft] Processing bids modal shown');
    }
    
    // Hide processing bids modal
    function hideProcessingBidsModal() {
        const modal = document.getElementById('processing-bids-modal');
        if (modal) {
            modal.remove();
            console.log('[silentdraft] Processing bids modal hidden');
        }
    } // end buildTeamsAndStartDraft

    // Start the draft
    startRound();
    
    // Initialize by loading players first, then draft state
    loadPlayers().then(() => Promise.all([
        loadDraftRoomDefaultRankings(true),
        loadAllDraftRoomPositionRankings(true)
    ])).then(() => {
        initializeDraft();
    }).catch(error => {
        console.error('[silentdraft] Failed to load players:', error);
        // Still try to initialize even if players fail to load
        initializeDraft();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[HUSH JS] DOM Ready - applying theme immediately');
        initializeDraftTheme();
        initSilentDraft();
    });
} else {
    console.log('[HUSH JS] DOM Already loaded - applying theme immediately');
    initializeDraftTheme();
    initSilentDraft();
}