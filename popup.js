document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const els = {
        btnPower: document.getElementById('btnPower'), // New
        btnDark: document.getElementById('btnDark'),
        btnFocus: document.getElementById('btnFocus'),
        btnDyslexia: document.getElementById('btnDyslexia'),
        
        rangeBrightness: document.getElementById('rangeBrightness'),
        rangeContrast: document.getElementById('rangeContrast'),
        rangeSepia: document.getElementById('rangeSepia'),
        rangeGray: document.getElementById('rangeGray'),
        rangeReadability: document.getElementById('rangeReadability'),
        
        valBrightness: document.getElementById('valBrightness'),
        valContrast: document.getElementById('valContrast'),
        valSepia: document.getElementById('valSepia'),
        valGray: document.getElementById('valGray'),
        valReadability: document.getElementById('valReadability'),

        btnReset: document.getElementById('btnReset'),
        btnToggleSite: document.getElementById('btnToggleSite'),
        currentDomain: document.getElementById('currentDomain'),
        modeIndicator: document.getElementById('modeIndicator')
    };

    const defaults = {
        darkMode: false, focusMode: false, dyslexicMode: false,
        brightness: 100, contrast: 100, sepia: 0, grayscale: 0, readability: 0
    };

    let globalConfig = { ...defaults };
    let siteConfigs = {};
    let extensionEnabled = true; // New state
    let currentHostname = '';
    let editMode = 'global'; 

    // 1. Get current tab domain
    browser.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if(tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                currentHostname = url.hostname;
                els.currentDomain.textContent = currentHostname;
                loadData();
            } catch(e) { 
                els.currentDomain.textContent = "System Page";
                loadData();
            }
        } else {
            loadData();
        }
    });

    // 2. Load Data
    function loadData() {
        browser.storage.local.get(['extensionEnabled', 'settings_global', 'settings_sites'], (result) => {
            // Load enabled state (default to true if undefined)
            extensionEnabled = result.extensionEnabled !== false;
            
            globalConfig = result.settings_global || { ...defaults };
            siteConfigs = result.settings_sites || {};

            if (siteConfigs[currentHostname]) {
                editMode = 'site';
            } else {
                editMode = 'global';
            }
            updateUIState();
        });
    }

    // 3. Update UI
    function updateUIState() {
        // Handle Global Power State
        if (!extensionEnabled) {
            els.btnPower.classList.add('off');
            document.body.classList.add('is-disabled');
            els.modeIndicator.textContent = "Extension Disabled";
            els.modeIndicator.style.color = "#ef4444";
        } else {
            els.btnPower.classList.remove('off');
            document.body.classList.remove('is-disabled');
            
            // Standard UI updates
            let activeConfig;
            if (editMode === 'site') {
                activeConfig = siteConfigs[currentHostname] || { ...defaults };
                els.btnToggleSite.textContent = "Switch to Global Defaults";
                els.btnToggleSite.style.borderColor = "#0ea5e9";
                els.modeIndicator.textContent = "Editing: " + currentHostname;
                els.modeIndicator.style.color = "#0ea5e9";
            } else {
                activeConfig = globalConfig;
                els.btnToggleSite.textContent = "Customize for this Site";
                els.btnToggleSite.style.borderColor = "rgba(255,255,255,0.1)";
                els.modeIndicator.textContent = "Editing: Global Defaults";
                els.modeIndicator.style.color = "#9ca3af";
            }

            // Apply to UI
            els.btnDark.classList.toggle('active', activeConfig.darkMode);
            els.btnFocus.classList.toggle('active', activeConfig.focusMode);
            els.btnDyslexia.classList.toggle('active', activeConfig.dyslexicMode);

            els.rangeBrightness.value = activeConfig.brightness;
            els.valBrightness.textContent = activeConfig.brightness;

            els.rangeContrast.value = activeConfig.contrast;
            els.valContrast.textContent = activeConfig.contrast;

            els.rangeSepia.value = activeConfig.sepia;
            els.valSepia.textContent = activeConfig.sepia;

            els.rangeGray.value = activeConfig.grayscale;
            els.valGray.textContent = activeConfig.grayscale;

            els.rangeReadability.value = activeConfig.readability;
            els.valReadability.textContent = activeConfig.readability > 0 ? activeConfig.readability + '%' : 'Off';
        }
    }

    // 4. Power Button Handler
    els.btnPower.addEventListener('click', () => {
        extensionEnabled = !extensionEnabled;
        browser.storage.local.set({ extensionEnabled: extensionEnabled });
        updateUIState();
        sendMessageToTabs({ type: 'REFRESH_STATE' });
    });

    // 5. Save Logic
    function saveSetting(key, value) {
        if (!extensionEnabled) return; // Prevent edits when disabled

        if (editMode === 'site') {
            if (!siteConfigs[currentHostname]) {
                siteConfigs[currentHostname] = { ...defaults }; 
            }
            siteConfigs[currentHostname][key] = value;
            browser.storage.local.set({ settings_sites: siteConfigs });
        } else {
            globalConfig[key] = value;
            browser.storage.local.set({ settings_global: globalConfig });
        }
        
        updateUIState();
        sendMessageToTabs({ type: 'REFRESH_STATE' });
    }

    // 6. Input Handlers
    function handleInput(key, element, isToggle = false) {
        const eventType = isToggle ? 'click' : 'input';
        element.addEventListener(eventType, () => {
            if (!extensionEnabled) return; 

            let val;
            let currentConfig = editMode === 'site' ? (siteConfigs[currentHostname] || globalConfig) : globalConfig;

            if(isToggle) {
                val = !currentConfig[key];
            } else {
                val = parseInt(element.value);
            }
            saveSetting(key, val);
        });
    }

    handleInput('darkMode', els.btnDark, true);
    handleInput('focusMode', els.btnFocus, true);
    handleInput('dyslexicMode', els.btnDyslexia, true);
    handleInput('brightness', els.rangeBrightness);
    handleInput('contrast', els.rangeContrast);
    handleInput('sepia', els.rangeSepia);
    handleInput('grayscale', els.rangeGray);
    handleInput('readability', els.rangeReadability);

    // 7. Mode Switching
    els.btnToggleSite.addEventListener('click', () => {
        if (!extensionEnabled) return;

        if (editMode === 'global') {
            editMode = 'site';
            if (!siteConfigs[currentHostname]) {
                siteConfigs[currentHostname] = { ...globalConfig };
                browser.storage.local.set({ settings_sites: siteConfigs });
            }
        } else {
            if(confirm("Remove custom settings for this site and return to Global defaults?")) {
                delete siteConfigs[currentHostname];
                browser.storage.local.set({ settings_sites: siteConfigs });
                editMode = 'global';
            }
        }
        updateUIState();
        sendMessageToTabs({ type: 'REFRESH_STATE' });
    });

    // 8. Reset
    els.btnReset.addEventListener('click', () => {
        if (!extensionEnabled) return;

        if (editMode === 'site') {
            siteConfigs[currentHostname] = { ...defaults };
            browser.storage.local.set({ settings_sites: siteConfigs });
        } else {
            globalConfig = { ...defaults };
            browser.storage.local.set({ settings_global: globalConfig });
        }
        updateUIState();
        sendMessageToTabs({ type: 'REFRESH_STATE' });
    });

    function sendMessageToTabs(message) {
        browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                browser.tabs.sendMessage(tabs[0].id, message).catch(() => {
                    // Fallback injection if needed
                });
            }
        });
    }
});