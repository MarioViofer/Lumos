(function() {
    // --- 1. PREVENT DUPLICATES & CLEANUP ---
    if (window.hasZenViewRun) {
        // If the script is already there, just wake it up
        if (window.zenViewLoadSettings) window.zenViewLoadSettings();
        return;
    }
    window.hasZenViewRun = true;

    // Clean up any old listeners from previous reloads
    try {
        if (window.zenViewMsgListener && browser.runtime.onMessage.hasListener(window.zenViewMsgListener)) {
            browser.runtime.onMessage.removeListener(window.zenViewMsgListener);
        }
    } catch(e) {}

    // --- 2. SETUP ---
    const styleID = 'zenview-styles';
    const defaults = {
        darkMode: false, focusMode: false, dyslexicMode: false,
        brightness: 100, contrast: 100, sepia: 0, grayscale: 0, readability: 0
    };
    let state = { ...defaults };

    // Helper: Safely inject style tag even if <head> doesn't exist yet
    function getStyleEl() {
        let styleEl = document.getElementById(styleID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleID;
            // Inject into <html> if <head> is missing (run_at_start support)
            (document.head || document.documentElement).appendChild(styleEl);
        }
        return styleEl;
    }

    // --- 3. MAIN LOGIC ---
    window.zenViewLoadSettings = function() {
        if (!browser.runtime?.id) return; // Extension context invalid

        browser.storage.local.get(['extensionEnabled', 'settings_global', 'settings_sites'], (result) => {
            const isEnabled = result.extensionEnabled !== false;

            if (!isEnabled) {
                state = { ...defaults };
            } else {
                const globalSettings = result.settings_global || defaults;
                const siteSettings = result.settings_sites || {};
                const hostname = window.location.hostname;

                if (siteSettings[hostname]) {
                    state = { ...defaults, ...siteSettings[hostname] };
                } else {
                    state = { ...defaults, ...globalSettings };
                }
            }
            updateStyles();
        });
    };

    // --- 4. LISTENERS ---
    
    // Listen for Popup Messages
    window.zenViewMsgListener = (message) => {
        if (message.type === 'REFRESH_STATE' || message.type === 'RESET') {
            window.zenViewLoadSettings();
        }
    };
    browser.runtime.onMessage.addListener(window.zenViewMsgListener);

    // Listen for Storage Changes (Sync tabs)
    if (!window.zenViewStorageListener) {
        window.zenViewStorageListener = (changes, area) => {
            if (area === 'local') window.zenViewLoadSettings();
        };
        browser.storage.onChanged.addListener(window.zenViewStorageListener);
    }

    // --- 5. VISUAL LOGIC ---

    // Focus Mode Overlays
    let focusOverlays = { active: false };
    
    function updateFocusMask(rect) {
        if (!state.focusMode) return;
        
        let top = document.getElementById('zen-focus-top');
        if (!top) {
            // Create overlays if missing
            const color = 'rgba(0,0,0,0.85)';
            const css = `position:fixed; background:${color}; z-index:2147483647; pointer-events:none; transition:none;`;
            const mkDiv = (id) => { let d=document.createElement('div'); d.id=id; d.style.cssText=css; document.body.appendChild(d); return d; };
            top = mkDiv('zen-focus-top'); mkDiv('zen-focus-bottom'); mkDiv('zen-focus-left'); mkDiv('zen-focus-right');
        }
        
        const bottom = document.getElementById('zen-focus-bottom');
        const left = document.getElementById('zen-focus-left');
        const right = document.getElementById('zen-focus-right');

        if (!rect) {
            // Full Cover
            top.style.cssText += 'top:0; left:0; width:100%; height:100%;';
            bottom.style.height = left.style.width = right.style.width = '0';
        } else {
            // Spotlight Hole
            const common = 'position:fixed; background:rgba(0,0,0,0.85); z-index:2147483647; pointer-events:none;';
            top.style.cssText = `${common} top:0; left:0; width:100%; height:${Math.max(0, rect.top)}px;`;
            bottom.style.cssText = `${common} top:${rect.bottom}px; left:0; width:100%; height:${Math.max(0, window.innerHeight - rect.bottom)}px;`;
            left.style.cssText = `${common} top:${rect.top}px; left:0; width:${Math.max(0, rect.left)}px; height:${rect.height}px;`;
            right.style.cssText = `${common} top:${rect.top}px; left:${rect.right}px; width:${Math.max(0, window.innerWidth - rect.right)}px; height:${rect.height}px;`;
        }
    }

    document.addEventListener('mouseover', (e) => {
        if (!state.focusMode) return;
        const target = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th, pre');
        updateFocusMask(target ? target.getBoundingClientRect() : null);
    });

    // Apply CSS
    function updateStyles() {
        const styleEl = getStyleEl();
        let css = '';
        let filters = [];
        
        if (state.brightness !== 100) filters.push(`brightness(${state.brightness}%)`);
        if (state.contrast !== 100) filters.push(`contrast(${state.contrast}%)`);
        if (state.sepia > 0) filters.push(`sepia(${state.sepia}%)`);
        if (state.grayscale > 0) filters.push(`grayscale(${state.grayscale}%)`);

        if (state.darkMode) {
            css += `
                html { filter: invert(1) hue-rotate(180deg) ${filters.join(' ')} !important; min-height: 100vh; background: #111 !important; }
                img, video, iframe, canvas, svg { filter: invert(1) hue-rotate(180deg) !important; }
                body { background-color: #111 !important; color: #ddd !important; }
            `;
        } else if (filters.length > 0) {
            css += `html { filter: ${filters.join(' ')} !important; }`;
        } else {
            css += `html { filter: none !important; }`;
        }

        if (state.dyslexicMode) css += `* { font-family: 'Comic Sans MS', sans-serif !important; }`;
        
        if (state.readability > 0) {
            const s = state.readability;
            css += `p, li, h1, h2, h3 { line-height: ${1.4 + s*0.01} !important; letter-spacing: ${s*0.03}px !important; word-spacing: ${s*0.1}px !important; }`;
        }

        styleEl.textContent = css;

        // Cleanup Focus Mode if disabled
        if (!state.focusMode) {
            ['zen-focus-top','zen-focus-bottom','zen-focus-left','zen-focus-right'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.remove();
            });
        }
    }

    // Run Immediately
    window.zenViewLoadSettings();
})();