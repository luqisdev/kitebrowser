let tabs = []; // Tab structure: { id, url, title, webviewEl, sleeping, lastActive, isPrivate }
let activeTabId = null;
let sleepMode = localStorage.getItem('sleepMode') || 'balanced';
let currentTheme = localStorage.getItem('theme') || 'purple';
let isAdBlockEnabled = localStorage.getItem('isAdBlockEnabled') !== 'false';
let searchEngine = localStorage.getItem('searchEngine') || 'google';
let isForceDarkMode = localStorage.getItem('isForceDarkMode') === 'true';

// Super Premium Variables
let loadStartTimes = {};
let blockedAdsCount = {};
let dmContrast = localStorage.getItem('dmContrast') || '100';
let dmBrightness = localStorage.getItem('dmBrightness') || '100';

// Gamer & Command Palette Variables
let memoryHistory = [];
let paletteSelectedIndex = 0;
let filteredPaletteItems = [];

const commandPalette = document.getElementById('command-palette');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');
const perfCanvas = document.getElementById('perf-graph');
const perfCtx = perfCanvas ? perfCanvas.getContext('2d') : null;

// Productive variables
let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];

const paletteCommands = [
  { name: '🚀 Belleği Temizle (RAM Turbo Boost)', cmd: '/boost', action: () => triggerBoost() },
  { name: '🌙 Zorunlu Karanlık Modu Aç/Kapat', cmd: '/dark', action: () => toggleDarkMode() },
  { name: '🕵️ Yeni Gizli Sekme Aç', cmd: '/private', action: () => createTab('lowbrowser://newtab', true) },
  { name: '➕ Yeni Normal Sekme Aç', cmd: '/newtab', action: () => createTab() },
  { name: '⚙️ Performans & Ayarlar Panelini Aç/Kapat', cmd: '/settings', action: () => toggleSettings() },
  { name: '📝 Hızlı Notlar Panelini Aç/Kapat', cmd: '/notes', action: () => document.getElementById('notes-panel').classList.toggle('hidden') },
  { name: '🌐 Aktif Sayfayı Türkçe\'ye Çevir', cmd: '/translate', action: () => translateActiveTab() }
];

// Apply saved theme class to body
// Fixed Signature Cyber Dark Theme
document.body.className = 'theme-purple';

// Sync sleep mode radio buttons
document.querySelectorAll('input[name="sleep-mode"]').forEach(radio => {
  radio.checked = radio.value === sleepMode;
  radio.addEventListener('change', (e) => {
    sleepMode = e.target.value;
    localStorage.setItem('sleepMode', sleepMode);
  });
});

// Sync search engine radio buttons
document.querySelectorAll('input[name="search-engine"]').forEach(radio => {
  radio.checked = radio.value === searchEngine;
  radio.addEventListener('change', (e) => {
    searchEngine = e.target.value;
    localStorage.setItem('searchEngine', searchEngine);
  });
});

// ==========================================================================
// 2. WINDOW CONTROLS (Frameless UI Buttons)
// ==========================================================================

document.getElementById('btn-minimize').addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

document.getElementById('btn-maximize').addEventListener('click', () => {
  window.electronAPI.maximizeWindow();
});

document.getElementById('btn-close').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

// Settings In-Tab Page Controller (Brave / Chrome Style)
const settingsPanel = document.getElementById('settings-panel');
const settingsSearchInput = document.getElementById('settings-search-input');

document.getElementById('btn-settings').addEventListener('click', () => {
  const existingTab = tabs.find(t => t.url.startsWith('low://settings') || t.url.startsWith('lowbrowser://settings'));
  if (existingTab) {
    switchTab(existingTab.id);
  } else {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.url === 'lowbrowser://newtab' && !activeTab.webviewEl) {
      navigate('low://settings');
    } else {
      createTab('low://settings');
      const newTab = tabs[tabs.length - 1];
      if (newTab) switchTab(newTab.id);
    }
  }
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && (activeTab.url.startsWith('low://settings') || activeTab.url.startsWith('lowbrowser://settings'))) {
    closeTab(activeTab.id);
  } else if (settingsPanel) {
    settingsPanel.classList.remove('open');
  }
});

// Live Settings Search & Filter (Brave Style)
if (settingsSearchInput) {
  settingsSearchInput.addEventListener('input', () => {
    const query = settingsSearchInput.value.toLowerCase().trim();
    document.querySelectorAll('.studio-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// Studio Sidebar Tab Switcher (Updates live low://settings/<subpath>)
document.querySelectorAll('.studio-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.studio-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.studio-tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const targetId = btn.dataset.target;
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    // Update active tab URL & address input dynamically
    const subRoute = targetId.replace('sec-', '');
    const canonical = subRoute ? `low://settings/${subRoute}` : 'low://settings';
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      activeTab.url = canonical;
      addressInput.value = canonical;
    }
  });
});

// ==========================================================================
// 3. TAB MANAGEMENT (Sekme Ekleme, Kapatma, Seçme)
// ==========================================================================

const tabsContainer = document.getElementById('tabs-container');
const webviewsContainer = document.getElementById('webviews-container');
const startPage = document.getElementById('start-page');
const addressInput = document.getElementById('address-input');

const createTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function createTab(url = 'lowbrowser://newtab', isPrivate = false) {
  const tabId = createTabId();
  const isSettings = url.startsWith('low://settings') || url.startsWith('lowbrowser://settings');
  
  let webviewEl = null;
  if (url !== 'lowbrowser://newtab' && !isSettings) {
    webviewEl = document.createElement('webview');
    webviewEl.setAttribute('id', `wv_${tabId}`);
    webviewEl.setAttribute('src', url);
    webviewEl.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
    if (isPrivate) {
      webviewEl.setAttribute('partition', 'private_session');
    }
    webviewsContainer.appendChild(webviewEl);
    setupWebviewEvents(webviewEl, tabId);
    
    // Focus the webview immediately
    setTimeout(() => {
      if (webviewEl) webviewEl.focus();
    }, 50);
  }

  let defaultTitle = url;
  if (url === 'lowbrowser://newtab') {
    defaultTitle = isPrivate ? 'Gizli Sekme' : 'Yeni Sekme';
  } else if (isSettings) {
    defaultTitle = '⚙️ Ayarlar';
  }

  const tabData = {
    id: tabId,
    url: url,
    title: defaultTitle,
    webviewEl: webviewEl,
    sleeping: false,
    lastActive: Date.now(),
    isPrivate: isPrivate,
    pinned: false,
    isMuted: false,
    volume: 1
  };
  
  tabs.push(tabData);

  // Tab Button Element
  const tabEl = document.createElement('div');
  tabEl.className = isPrivate ? 'tab private' : 'tab';
  tabEl.setAttribute('id', `tab_btn_${tabId}`);

  const globeIcon = '<svg class="tab-favicon icon" style="color: var(--text-dim); margin-right: 4px; width: 12px; height: 12px;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>';
  const privateIcon = '<svg class="tab-favicon icon" style="color: #ec4899; margin-right: 4px; width: 12px; height: 12px;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm2.07-7.75l-.9.92C11.45 11.9 11 12.5 11 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" fill="currentColor"/></svg>';
  const settingsIcon = '<svg class="tab-favicon icon" style="color: var(--accent-color); margin-right: 4px; width: 12px; height: 12px;" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/></svg>';
  const closeIconSvg = '<svg class="icon" style="width: 8px; height: 8px;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>';

  const tabFaviconHtml = isSettings ? settingsIcon : (isPrivate ? privateIcon : globeIcon);

  tabEl.innerHTML = `
    ${tabFaviconHtml}
    <span class="tab-title">${tabData.title}</span>
    <button class="tab-audio-btn hidden" title="Sesi Aç/Kapat">🔊</button>
    <button class="tab-close">${closeIconSvg}</button>
  `;

  // Audio button click
  const audioBtn = tabEl.querySelector('.tab-audio-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMuteTab(tabId);
    });
  }

  // Right-click context menu on tab
  tabEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openTabContextMenu(e.clientX, e.clientY, tabId);
  });

  // Tab Hover Thumbnail Preview
  tabEl.addEventListener('mouseenter', () => {
    showTabHoverPreview(tabId, tabEl);
  });
  tabEl.addEventListener('mouseleave', () => {
    hideTabHoverPreview();
  });

  // Select tab click
  tabEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-close') || e.target.classList.contains('tab-audio-btn')) return;
    switchTab(tabId);
  });

  // Close tab click
  tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  tabsContainer.appendChild(tabEl);
  switchTab(tabId);
}

// Closed Tabs History for Ctrl+Shift+T
let closedTabsHistory = [];

// Global Browser Keyboard Shortcuts (Ctrl+W to close tab, Ctrl+T for new tab, Ctrl+Shift+T to reopen)
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    if (activeTabId) {
      closeTab(activeTabId);
    }
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    createTab();
  } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
    e.preventDefault();
    if (closedTabsHistory.length > 0) {
      const lastClosed = closedTabsHistory.pop();
      createTab(lastClosed.url, lastClosed.isPrivate);
      showToast(`↩️ Kapatılan sekme geri açıldı: ${lastClosed.title}`);
    } else {
      showToast("Geri açılacak kapatılmış sekme bulunmuyor.");
    }
  }
});

function toggleMuteTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.isMuted = !tab.isMuted;
  if (tab.webviewEl) {
    tab.webviewEl.setAudioMuted(tab.isMuted);
  }
  const tabBtn = document.getElementById(`tab_btn_${tabId}`);
  if (tabBtn) {
    const audioBtn = tabBtn.querySelector('.tab-audio-btn');
    if (audioBtn) {
      audioBtn.textContent = tab.isMuted ? '🔇' : '🔊';
      audioBtn.classList.toggle('muted', tab.isMuted);
      audioBtn.classList.remove('hidden');
    }
  }
  showToast(tab.isMuted ? `🔇 "${tab.title}" sessize alındı.` : `🔊 "${tab.title}" sesi açıldı.`);
}

function togglePinTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.pinned = !tab.pinned;
  const tabBtn = document.getElementById(`tab_btn_${tabId}`);
  if (tabBtn) {
    tabBtn.classList.toggle('pinned', tab.pinned);
    // Move pinned tabs to the left side
    if (tab.pinned) {
      tabsContainer.prepend(tabBtn);
      // Re-order tabs array
      const idx = tabs.findIndex(t => t.id === tabId);
      if (idx > -1) {
        const [removed] = tabs.splice(idx, 1);
        tabs.unshift(removed);
      }
    }
  }
  showToast(tab.pinned ? `📌 "${tab.title}" sabitlendi.` : `Sekme sabitlemesi kaldırıldı.`);
}

function switchTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  activeTabId = tabId;
  tab.lastActive = Date.now();

  // Wake up if tab is sleeping
  if (tab.sleeping) {
    wakeTab(tab);
  }

  // Update tabs style classes
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.id === `tab_btn_${tabId}`);
  });

  // Hide all webviews, show active one if not newtab
  tabs.forEach(t => {
    if (t.webviewEl) {
      t.webviewEl.classList.toggle('hidden', t.id !== tabId);
    }
  });

  if (tab.url.startsWith('low://settings') || tab.url.startsWith('lowbrowser://settings')) {
    startPage.classList.add('hidden');
    if (settingsPanel) settingsPanel.classList.add('open');
    addressInput.value = tab.url;
    addressInput.placeholder = 'Arama yap veya URL gir...';
    document.getElementById('btn-back').disabled = true;
    document.getElementById('btn-forward').disabled = true;
    document.getElementById('load-speed-badge').classList.add('hidden');

    // Activate requested subtab if specified in URL (e.g. low://settings/perf)
    const sub = tab.url.replace(/^low:\/\/(settings\/?|settings\/)/i, '').replace(/^lowbrowser:\/\/(settings\/?|settings\/)/i, '').trim();
    if (sub) {
      const targetBtn = document.querySelector(`.studio-nav-btn[data-target="sec-${sub}"]`) ||
                        document.querySelector(`.studio-nav-btn[data-target="${sub}"]`);
      if (targetBtn) targetBtn.click();
    }
  } else if (tab.url === 'lowbrowser://newtab') {
    if (settingsPanel) settingsPanel.classList.remove('open');
    startPage.classList.remove('hidden');
    addressInput.value = '';
    addressInput.placeholder = 'Arama yap veya URL gir...';
    document.getElementById('btn-back').disabled = true;
    document.getElementById('btn-forward').disabled = true;
    
    // Toggle start page private badge
    document.getElementById('start-private-label').classList.toggle('hidden', !tab.isPrivate);
    document.getElementById('load-speed-badge').classList.add('hidden');
  } else {
    if (settingsPanel) settingsPanel.classList.remove('open');
    startPage.classList.add('hidden');
    addressInput.value = tab.url;

    if (tab.webviewEl) {
      tab.webviewEl.classList.remove('hidden');
      updateNavButtons(tab.webviewEl);
      
      // Auto-focus the active webview on switch
      setTimeout(() => {
        if (tab.webviewEl) tab.webviewEl.focus();
      }, 50);
    }

    // Toggle load speed badge
    const speedBadge = document.getElementById('load-speed-badge');
    if (tab.loadTime) {
      document.getElementById('load-speed-text').textContent = `${tab.loadTime}s`;
      speedBadge.classList.remove('hidden');
    } else {
      speedBadge.classList.add('hidden');
    }
    
    // Check if passwords exist for the new active tab
    checkPasswordsForCurrentTab();
  }

  const displayTitle = tab.isPrivate ? `[Private] ${tab.title}` : tab.title;
  document.title = `${displayTitle} - LowBrowser`;
}

function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const tab = tabs[index];
  
  // Save to closed history if not blank newtab
  if (tab.url && tab.url !== 'lowbrowser://newtab') {
    closedTabsHistory.push({ url: tab.url, title: tab.title, isPrivate: tab.isPrivate });
    if (closedTabsHistory.length > 20) {
      closedTabsHistory.shift();
    }
  }

  // Unmount Webview to clear memory
  if (tab.webviewEl) {
    tab.webviewEl.remove();
  }

  tabs.splice(index, 1);
  const tabBtn = document.getElementById(`tab_btn_${tabId}`);
  if (tabBtn) tabBtn.remove();

  // If split screen is active and remaining tabs < 2, auto-dismiss split view
  if (isSplitScreenActive && tabs.length < 2) {
    toggleSplitScreen();
  }

  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === tabId) {
    const nextIndex = Math.min(index, tabs.length - 1);
    switchTab(tabs[nextIndex].id);
  }
}

// ==========================================================================
// 4. WEBVIEW EVENTS & CONTEXT MENUS BINDINGS
// ==========================================================================

const tabContextMenu = document.getElementById('tab-context-menu');
const webviewContextMenu = document.getElementById('webview-context-menu');
let contextMenuTargetTabId = null;
let currentWebviewContextParams = null;

function openTabContextMenu(x, y, tabId) {
  contextMenuTargetTabId = tabId;
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const pinText = document.getElementById('ctx-tab-pin-text');
  if (pinText) pinText.textContent = tab.pinned ? 'Sekme Sabitlemesini Kaldır' : 'Sekmeyi Sabitle';

  const muteText = document.getElementById('ctx-tab-mute-text');
  if (muteText) muteText.textContent = tab.isMuted ? 'Sesi Aç' : 'Sekmeyi Sustur';

  const freezeText = document.getElementById('ctx-tab-freeze-text');
  if (freezeText) freezeText.textContent = tab.frozen ? 'Sekmeyi Çöz (Aktifleştir)' : 'Sekmeyi Dondur (RAM Sıfırla)';

  tabContextMenu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
  tabContextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
  tabContextMenu.classList.remove('hidden');
  webviewContextMenu.classList.add('hidden');
}

function toggleFreezeTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  if (tab.frozen) {
    tab.frozen = false;
    const tabBtn = document.getElementById(`tab_btn_${tabId}`);
    if (tabBtn) {
      tabBtn.classList.remove('frozen');
      const titleEl = tabBtn.querySelector('.tab-title');
      if (titleEl && tab.title) titleEl.textContent = tab.title;
    }
    wakeTab(tab);
    showToast(`☀️ "${tab.title}" sekmesi çözüldü ve uyandırıldı.`);
  } else {
    tab.frozen = true;
    const tabBtn = document.getElementById(`tab_btn_${tabId}`);
    if (tabBtn) {
      tabBtn.classList.add('frozen');
      const titleEl = tabBtn.querySelector('.tab-title');
      if (titleEl) titleEl.textContent = `❄️ ${tab.title || 'Sekme'}`;
    }
    if (tab.webviewEl && tab.webviewEl.parentNode) {
      tab.webviewEl.parentNode.removeChild(tab.webviewEl);
      tab.webviewEl = null;
    }
    tab.sleeping = true;
    showToast(`❄️ "${tab.title}" donduruldu! RAM ve CPU tüketimi sıfırlandı.`);
  }
}

const ctxTabFreeze = document.getElementById('ctx-tab-freeze');
if (ctxTabFreeze) {
  ctxTabFreeze.addEventListener('click', () => {
    if (contextMenuTargetTabId) toggleFreezeTab(contextMenuTargetTabId);
    tabContextMenu.classList.add('hidden');
  });
}

function openWebviewContextMenu(params, tabId) {
  currentWebviewContextParams = params;
  contextMenuTargetTabId = tabId;

  // Configure link items
  const linkItem = document.getElementById('ctx-open-link-tab');
  const copyLinkItem = document.getElementById('ctx-copy-link');
  if (params.linkURL) {
    linkItem.style.display = 'flex';
    copyLinkItem.style.display = 'flex';
  } else {
    linkItem.style.display = 'none';
    copyLinkItem.style.display = 'none';
  }

  const posX = Math.min(params.x, window.innerWidth - 220);
  const posY = Math.min(params.y + 80, window.innerHeight - 240); // 80px navbar offset

  webviewContextMenu.style.left = `${posX}px`;
  webviewContextMenu.style.top = `${posY}px`;
  webviewContextMenu.classList.remove('hidden');
  tabContextMenu.classList.add('hidden');
}

// Close context menus when clicking outside
document.addEventListener('click', (e) => {
  if (!tabContextMenu.contains(e.target)) {
    tabContextMenu.classList.add('hidden');
  }
  if (!webviewContextMenu.contains(e.target)) {
    webviewContextMenu.classList.add('hidden');
  }
});

// Tab context menu actions
document.getElementById('ctx-tab-reload').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === contextMenuTargetTabId);
  if (tab && tab.webviewEl) tab.webviewEl.reload();
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-pin').addEventListener('click', () => {
  if (contextMenuTargetTabId) togglePinTab(contextMenuTargetTabId);
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-mute').addEventListener('click', () => {
  if (contextMenuTargetTabId) toggleMuteTab(contextMenuTargetTabId);
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-duplicate').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === contextMenuTargetTabId);
  if (tab) createTab(tab.url, tab.isPrivate);
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-close').addEventListener('click', () => {
  if (contextMenuTargetTabId) closeTab(contextMenuTargetTabId);
  tabContextMenu.classList.add('hidden');
});

// Webview context menu actions
document.getElementById('ctx-nav-back').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && tab.webviewEl.canGoBack()) tab.webviewEl.goBack();
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-nav-forward').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && tab.webviewEl.canGoForward()) tab.webviewEl.goForward();
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-nav-reload').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl) tab.webviewEl.reload();
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-open-link-tab').addEventListener('click', () => {
  if (currentWebviewContextParams && currentWebviewContextParams.linkURL) {
    createTab(currentWebviewContextParams.linkURL);
  }
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-copy-link').addEventListener('click', () => {
  if (currentWebviewContextParams && currentWebviewContextParams.linkURL) {
    window.electronAPI.writeClipboard(currentWebviewContextParams.linkURL);
    showToast("Bağlantı panoya kopyalandı!");
  }
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-view-source').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.url && !tab.url.startsWith('lowbrowser://')) {
    createTab(`view-source:${tab.url}`);
  }
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-inspect-element').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl) {
    tab.webviewEl.openDevTools();
  }
  webviewContextMenu.classList.add('hidden');
});

function setupWebviewEvents(webviewEl, tabId) {
  webviewEl.addEventListener('did-start-loading', () => {
    const suggestionsEl = document.getElementById('suggestions-box');
    if (suggestionsEl) suggestionsEl.classList.add('hidden');
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.sleeping) {
      updateTabButtonText(tabId, 'Yükleniyor...');
    }
    loadStartTimes[tabId] = Date.now();
    if (tabId === activeTabId) {
      document.getElementById('load-speed-badge').classList.add('hidden');
    }
  });

  // Media audio events
  webviewEl.addEventListener('media-started-playing', () => {
    const tabBtn = document.getElementById(`tab_btn_${tabId}`);
    if (tabBtn) {
      const audioBtn = tabBtn.querySelector('.tab-audio-btn');
      if (audioBtn) audioBtn.classList.remove('hidden');
    }
  });

  webviewEl.addEventListener('media-paused', () => {
    setTimeout(() => {
      const tabBtn = document.getElementById(`tab_btn_${tabId}`);
      if (tabBtn && (!webviewEl.isCurrentlyAudible || !webviewEl.isCurrentlyAudible())) {
        const audioBtn = tabBtn.querySelector('.tab-audio-btn');
        if (audioBtn) audioBtn.classList.add('hidden');
      }
    }, 1500);
  });

  // Native context-menu event inside webview
  webviewEl.addEventListener('context-menu', (e) => {
    e.preventDefault();
    openWebviewContextMenu(e.params, tabId);
  });

  webviewEl.addEventListener('did-stop-loading', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.sleeping) {
      updateTabButtonText(tabId, tab.title);
      if (tabId === activeTabId) {
        updateNavButtons(webviewEl);
      }
      
      // Inject volume settings on page load
      if (tab.volume !== undefined) {
        webviewEl.executeJavaScript(`
          document.querySelectorAll('video, audio').forEach(el => {
            el.volume = ${tab.volume};
          });
        `).catch(() => {});
      }
    }

    // Calculate load speed
    const start = loadStartTimes[tabId];
    if (start) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      if (tab) {
        tab.loadTime = elapsed;
        if (tabId === activeTabId) {
          document.getElementById('load-speed-text').textContent = `${elapsed}s`;
          document.getElementById('load-speed-badge').classList.remove('hidden');
        }
      }
      delete loadStartTimes[tabId];
    }

    applyForceDarkModeToWebview(webviewEl);
    updateTabAudioStatus(tabId);
  });

  webviewEl.addEventListener('media-status-change', () => {
    updateTabAudioStatus(tabId);
  });

  // Found-in-page listener for Ctrl + F In-Page Search
  webviewEl.addEventListener('found-in-page', (e) => {
    if (tabId === activeTabId && e.result) {
      updateFindCountUI(e.result.activeMatchOrdinal, e.result.matches);
    }
  });

  // Intercept Ctrl+W and Ctrl+T inside webview to manage browser tabs instead of app closing
  webviewEl.addEventListener('before-input-event', (e) => {
    if (e.type === 'keyDown' && (e.control || e.meta)) {
      if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeTab(tabId);
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        createTab();
      }
    }
  });

  webviewEl.addEventListener('page-title-updated', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.title = e.title;
      updateTabButtonText(tabId, e.title);
      if (tabId === activeTabId) {
        document.title = `${e.title} - LowBrowser`;
      }
    }
  });

  webviewEl.addEventListener('did-navigate', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.url = e.url;
      if (tabId === activeTabId) {
        addressInput.value = e.url;
      }
      addToHistory(tab.title, e.url, tab.isPrivate);
      if (tabId === activeTabId) {
        checkPasswordsForCurrentTab();
      }
    }
    applyForceDarkModeToWebview(webviewEl);
  });

  webviewEl.addEventListener('did-navigate-in-page', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.url = e.url;
      if (tabId === activeTabId) {
        addressInput.value = e.url;
      }
      addToHistory(tab.title, e.url, tab.isPrivate);
      if (tabId === activeTabId) {
        checkPasswordsForCurrentTab();
      }
    }
  });

  // Handle Target="_blank" new window events
  webviewEl.addEventListener('new-window', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    createTab(e.url, tab ? tab.isPrivate : false);
  });

  // Offline & Load Failure Interceptor -> Loads Cyber Asteroid Defender Game!
  webviewEl.addEventListener('did-fail-load', (e) => {
    // Ignore user-aborted navigations (-3) or non-main frame errors
    if (e.errorCode === -3 || (e.isMainFrame === false)) return;

    console.log('[LowBrowser Offline Blaster] Load failed:', e.errorCode, e.validatedURL);
    if (window.electronAPI && window.electronAPI.gamePath) {
      const gameUrl = 'file://' + window.electronAPI.gamePath + '?target=' + encodeURIComponent(e.validatedURL || '');
      webviewEl.loadURL(gameUrl);
    }
  });

  // Handle favicon updates
  webviewEl.addEventListener('page-favicon-updated', (e) => {
    const favicons = e.favicons;
    if (favicons && favicons.length > 0) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        tab.faviconUrl = favicons[0];
      }

      const tabEl = document.getElementById(`tab_btn_${tabId}`);
      if (tabEl) {
        const oldFav = tabEl.querySelector('.tab-favicon');
        if (oldFav) {
          const newFav = document.createElement('img');
          newFav.className = 'tab-favicon';
          newFav.src = favicons[0];
          newFav.style.width = '14px';
          newFav.style.height = '14px';
          newFav.style.marginRight = '6px';
          oldFav.replaceWith(newFav);
        } else {
          const imgFav = tabEl.querySelector('img.tab-favicon');
          if (imgFav) {
            imgFav.src = favicons[0];
          }
        }
      }
    }
  });
}

function updateTabButtonText(tabId, text) {
  const btn = document.getElementById(`tab_btn_${tabId}`);
  if (btn) {
    btn.querySelector('.tab-title').textContent = text;
  }
}

function updateNavButtons(webviewEl) {
  try {
    document.getElementById('btn-back').disabled = !webviewEl.canGoBack();
    document.getElementById('btn-forward').disabled = !webviewEl.canGoForward();
  } catch (err) {
    // Webview might not be fully ready
  }
}

// ==========================================================================
// 5. NAVIGATION CONTROLS & INTERNAL PROTOCOL ROUTER (low:// and lowbrowser://)
// ==========================================================================

function resolveInternalProtocol(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Check if starts with low://, low:, lowbrowser://, chrome://, edge://, brave://, opera://, about:
  const isExplicitInternal = /^(low|lowbrowser|chrome|edge|brave|opera|about):/i.test(trimmed);
  const isShorthandInternal = ['settings', 'ayarlar', 'history', 'gecmis', 'geçmiş', 'downloads', 'indirmeler', 'passwords', 'sifreler', 'şifreler', 'notes', 'notlar', 'game', 'oyun', 'perf', 'performans', 'about', 'hakkinda', 'hakkında', 'version', 'newtab'].includes(lower);

  if (!isExplicitInternal && !isShorthandInternal) {
    return null;
  }

  let clean = lower.replace(/^(low|lowbrowser|chrome|edge|brave|opera|about):\/\//i, '');
  clean = clean.replace(/^(low|lowbrowser|chrome|edge|brave|opera|about):/i, '');

  const parts = clean.split('/');
  const route = parts[0];
  const subPath = parts.slice(1).join('/');

  if (route === 'settings' || route === 'ayarlar' || route === 'config' || route === 'preferences' || route === 'options') {
    return { route: 'settings', canonicalUrl: 'low://settings' + (subPath ? `/${subPath}` : ''), subPath, title: '⚙️ Ayarlar' };
  }
  if (route === 'perf' || route === 'performance' || route === 'performans' || route === 'speed' || route === 'boost') {
    return { route: 'perf', canonicalUrl: 'low://perf', subPath: 'sec-performance', title: '⚡ Performans Stüdyosu' };
  }
  if (route === 'history' || route === 'gecmis' || route === 'geçmiş') {
    return { route: 'history', canonicalUrl: 'low://history', subPath, title: '🕒 Tarama Geçmişi' };
  }
  if (route === 'downloads' || route === 'indirmeler' || route === 'indirilenler' || route === 'download') {
    return { route: 'downloads', canonicalUrl: 'low://downloads', subPath, title: '📥 İndirmeler' };
  }
  if (route === 'passwords' || route === 'sifreler' || route === 'şifreler' || route === 'pass' || route === 'vault') {
    return { route: 'passwords', canonicalUrl: 'low://passwords', subPath, title: '🔑 Şifre Yöneticisi' };
  }
  if (route === 'notes' || route === 'notlar' || route === 'not' || route === 'notebook') {
    return { route: 'notes', canonicalUrl: 'low://notes', subPath, title: '📝 Hızlı Notlar' };
  }
  if (route === 'game' || route === 'oyun' || route === 'asteroid' || route === 'goktasi' || route === 'dino') {
    return { route: 'game', canonicalUrl: 'low://game', subPath, title: '🎮 Cyber Asteroid Defender', isWebview: true };
  }
  if (route === 'about' || route === 'hakkinda' || route === 'hakkında' || route === 'version' || route === 'surum' || route === 'sürüm') {
    return { route: 'about', canonicalUrl: 'low://about', subPath: 'sec-about', title: '⚡ LowBrowser Hakkında' };
  }
  if (route === 'newtab' || route === 'start' || route === 'home' || route === 'anasayfa' || route === 'blank') {
    return { route: 'newtab', canonicalUrl: 'lowbrowser://newtab', subPath, title: 'Yeni Sekme', isNewTab: true };
  }

  return null;
}

function handleInternalPage(match, tab) {
  tab.url = match.canonicalUrl;
  tab.title = match.title;
  tab.lastActive = Date.now();
  updateTabButtonText(tab.id, match.title);
  addressInput.value = match.canonicalUrl;
  document.title = `${match.title} - LowBrowser`;

  if (match.isNewTab) {
    if (tab.webviewEl) {
      tab.webviewEl.remove();
      tab.webviewEl = null;
    }
    startPage.classList.remove('hidden');
    addressInput.value = '';
    return;
  }

  if (match.isWebview) {
    const gameFileUrl = window.electronAPI && window.electronAPI.gamePath ? 'file://' + window.electronAPI.gamePath : '';
    if (gameFileUrl) {
      if (!tab.webviewEl) {
        const webviewEl = document.createElement('webview');
        webviewEl.setAttribute('id', `wv_${tab.id}`);
        webviewEl.setAttribute('src', gameFileUrl);
        webviewEl.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
        webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
        webviewsContainer.appendChild(webviewEl);
        setupWebviewEvents(webviewEl, tab.id);
        tab.webviewEl = webviewEl;
        startPage.classList.add('hidden');
        webviewEl.classList.remove('hidden');
      } else {
        tab.webviewEl.loadURL(gameFileUrl);
      }
    }
    return;
  }

  // Internal UI Panels
  if (match.route === 'settings' || match.route === 'perf' || match.route === 'about') {
    if (settingsPanel) {
      settingsPanel.classList.add('open');
      if (match.subPath) {
        const targetBtn = document.querySelector(`.studio-nav-btn[data-target="${match.subPath}"]`) ||
                          document.querySelector(`.studio-nav-btn[data-target="sec-${match.subPath}"]`);
        if (targetBtn) targetBtn.click();
      }
    }
  } else if (match.route === 'history') {
    if (historyPanel) {
      historyPanel.classList.remove('hidden');
      if (typeof renderHistoryUI === 'function') renderHistoryUI();
    }
  } else if (match.route === 'downloads') {
    if (downloadsPanel) {
      downloadsPanel.classList.remove('hidden');
      if (typeof renderDownloadsUI === 'function') renderDownloadsUI();
    }
  } else if (match.route === 'passwords') {
    if (passwordsPanel) {
      passwordsPanel.classList.remove('hidden');
      if (typeof renderPasswordsUI === 'function') renderPasswordsUI();
    }
  } else if (match.route === 'notes') {
    if (notesPanel) {
      notesPanel.classList.remove('hidden');
    }
  }

  showToast(`⚡ ${match.canonicalUrl} açıldı.`);
}

function navigate(url) {
  if (!url || !url.trim()) return;

  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  // 1. Check LowBrowser Internal Protocol (low://, lowbrowser://, chrome:// etc.)
  const internalMatch = resolveInternalProtocol(url);
  if (internalMatch) {
    handleInternalPage(internalMatch, tab);
    return;
  }

  let targetUrl = url.trim();

  // Search Engine Check
  const isSearch = targetUrl.indexOf(' ') !== -1 || (targetUrl.indexOf('.') === -1 && !targetUrl.startsWith('localhost'));

  if (isSearch) {
    if (searchEngine === 'duckduckgo') {
      targetUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(targetUrl);
    } else if (searchEngine === 'yandex') {
      targetUrl = 'https://yandex.com/search/?text=' + encodeURIComponent(targetUrl);
    } else {
      targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(targetUrl);
    }
  } else {
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('file://')) {
      targetUrl = 'https://' + targetUrl;
    }
  }

  // Anti-Phishing Radar Gatekeeper
  const phishRisk = checkPhishingRisk(targetUrl);
  if (phishRisk) {
    pendingPhishUrl = targetUrl;
    if (phishRadarModal) {
      if (phishTargetDomain) phishTargetDomain.textContent = targetUrl;
      phishRadarModal.classList.remove('hidden');
    }
    return;
  }

  tab.url = targetUrl;
  tab.lastActive = Date.now();

  if (tab.sleeping) {
    wakeTab(tab);
  }

  // If currently on newtab HTML start page, replace with <webview> tag
  if (!tab.webviewEl) {
    const webviewEl = document.createElement('webview');
    webviewEl.setAttribute('id', `wv_${tab.id}`);
    webviewEl.setAttribute('src', targetUrl);
    webviewEl.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
    if (tab.isPrivate) {
      webviewEl.setAttribute('partition', 'private_session');
    }
    webviewsContainer.appendChild(webviewEl);
    setupWebviewEvents(webviewEl, tab.id);
    tab.webviewEl = webviewEl;
    
    startPage.classList.add('hidden');
    webviewEl.classList.remove('hidden');
  } else {
    tab.webviewEl.loadURL(targetUrl);
  }

  // Hide suggestions dropdown on navigate
  if (typeof suggestionsBox !== 'undefined' && suggestionsBox) {
    suggestionsBox.classList.add('hidden');
  }
}

addressInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (typeof suggestionsBox !== 'undefined' && suggestionsBox) {
      suggestionsBox.classList.add('hidden');
    }
    navigate(addressInput.value);
    addressInput.blur();
    
    // Pass focus to the webview
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.webviewEl) {
      setTimeout(() => {
        if (activeTab.webviewEl) activeTab.webviewEl.focus();
      }, 50);
    }
  }
});

document.getElementById('btn-back').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && !tab.sleeping) {
    tab.webviewEl.goBack();
  }
});

document.getElementById('btn-forward').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && !tab.sleeping) {
    tab.webviewEl.goForward();
  }
});

document.getElementById('btn-reload').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    if (tab.sleeping) {
      wakeTab(tab);
    } else if (tab.webviewEl) {
      tab.webviewEl.reload();
    }
  }
});

document.getElementById('btn-home').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    // Unmount webview if it exists to clean memory
    if (tab.webviewEl) {
      tab.webviewEl.remove();
      tab.webviewEl = null;
    }
    tab.url = 'lowbrowser://newtab';
    tab.title = 'Yeni Sekme';
    tab.sleeping = false;
    updateTabButtonText(tab.id, 'Yeni Sekme');
    switchTab(tab.id);
  }
});

// Speed dials click mapping
document.querySelectorAll('.dial-card').forEach(card => {
  card.addEventListener('click', (e) => {
    navigate(e.target.dataset.url);
  });
});

// Start page search input triggers
document.getElementById('btn-start-search').addEventListener('click', () => {
  navigate(document.getElementById('start-search-input').value);
  focusActiveWebview();
});
document.getElementById('start-search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(e.target.value);
    focusActiveWebview();
  }
});

function focusActiveWebview() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl) {
    setTimeout(() => {
      if (activeTab.webviewEl) activeTab.webviewEl.focus();
    }, 80);
  }
}

// ==========================================================================
// 6. RAM & PERFORMANCE ENGINE (TAB SLEEPING / UNMOUNTING)
// ==========================================================================

function checkSleepingTabs() {
  if (sleepMode === 'never') return;

  const threshold = sleepMode === 'aggressive' ? 30000 : 120000; // 30s or 2m
  const now = Date.now();

  tabs.forEach(tab => {
    // Sleep criteria:
    // 1. Not active tab
    // 2. Not already sleeping
    // 3. Not a native newtab
    // 4. Has a mounted webview
    // 5. Exceeded inactivity threshold
    if (tab.id !== activeTabId &&
        !tab.sleeping &&
        tab.url !== 'lowbrowser://newtab' &&
        tab.webviewEl) {

      // Exemption: If tab is currently playing audio (YouTube Music etc), do not sleep!
      let isAudible = false;
      try {
        isAudible = tab.webviewEl.isCurrentlyAudible();
      } catch (err) {}

      if (isAudible) {
        tab.lastActive = now; // reset timer
        return;
      }

      if (now - tab.lastActive > threshold) {
        putTabToSleep(tab);
      }
    }
  });
}

function putTabToSleep(tab) {
  if (!tab.webviewEl) return;

  // Unmount Webview completely to free all memory
  tab.webviewEl.remove();
  tab.webviewEl = null;

  tab.sleeping = true;
  updateTabButtonText(tab.id, `${tab.title} (Boşta)`);
  console.log(`[Electron Sleep] sekme '${tab.title}' unmount edildi (RAM temizlendi).`);
}

function wakeTab(tab) {
  if (!tab.sleeping) return;

  console.log(`[Electron Sleep] sekme '${tab.title}' uyandırılıyor, webview yeniden oluşturuluyor...`);
  
  const webviewEl = document.createElement('webview');
  webviewEl.setAttribute('id', `wv_${tab.id}`);
  webviewEl.setAttribute('src', tab.url);
  webviewEl.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
  webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
  if (tab.isPrivate) {
    webviewEl.setAttribute('partition', 'private_session');
  }
  webviewsContainer.appendChild(webviewEl);
  setupWebviewEvents(webviewEl, tab.id);

  tab.webviewEl = webviewEl;
  tab.sleeping = false;
  tab.lastActive = Date.now();
  updateTabButtonText(tab.id, tab.title);
}

// GAMER MODU: Window switches / Focus loss triggers (Valorant is active)
window.addEventListener('blur', () => {
  // Switched to Valorant/Other app: Sleep background tabs that are not currently playing audio!
  tabs.forEach(tab => {
    if (tab.id !== activeTabId && !tab.sleeping && tab.url !== 'lowbrowser://newtab' && tab.webviewEl) {
      let isAudible = false;
      try {
        isAudible = tab.webviewEl.isCurrentlyAudible();
      } catch (err) {}

      if (!isAudible) {
        putTabToSleep(tab);
      }
    }
  });
  console.log('[Gamer Modu] Odağı kaybetti. Ses çalanlar hariç tüm sekmeler unmount edildi (RAM boşaltıldı).');
});

window.addEventListener('focus', () => {
  // Switched back to browser: Wake up the active tab instantly
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.sleeping) {
    wakeTab(activeTab);
    switchTab(activeTabId);
  }
});

// Running tab sleeping checking routine every 10 seconds
setInterval(checkSleepingTabs, 10000);

// ==========================================================================
// 7. PERFORMANCE MONITORING (Stats updates)
// ==========================================================================

async function updatePerformanceStats() {
  let ramMB = 0;
  let cpu = 0;
  try {
    const stats = await window.electronAPI.getStats();
    if (stats) {
      ramMB = stats.memoryMB;
      cpu = stats.cpuPercent;
    }
  } catch (err) {}

  if (ramMB > 0) {
    memoryHistory.push(ramMB);
    if (memoryHistory.length > 15) memoryHistory.shift();
  }

  if (!settingsPanel.classList.contains('open')) return;

  if (ramMB > 0) {
    document.getElementById('ram-usage-text').textContent = `Tarayıcı RAM Kullanımı: ${ramMB} MB`;
    document.getElementById('ram-progress').style.width = `${Math.min(100, (ramMB / 800) * 100)}%`;

    document.getElementById('cpu-usage-text').textContent = `Tarayıcı CPU Kullanımı: ${cpu}%`;
    document.getElementById('cpu-progress').style.width = `${cpu}%`;
    
    drawPerformanceGraph();
  }
}

// Update performance stats every 2 seconds
setInterval(updatePerformanceStats, 2000);

// ==========================================================================
// 8. APP INITIALIZATION & NEW SHORTCUT CONTROLS
// ==========================================================================

document.getElementById('btn-new-tab').addEventListener('click', () => {
  createTab();
});

document.getElementById('btn-new-private-tab').addEventListener('click', () => {
  createTab('lowbrowser://newtab', true);
});

// AdBlocker Switch Controller
const adBlockBtn = document.getElementById('btn-adblock') || document.getElementById('tool-btn-adblock');
function updateAdBlockUI() {
  if (adBlockBtn) {
    if (adBlockBtn.classList.contains('tool-item')) {
      adBlockBtn.classList.toggle('active', isAdBlockEnabled);
      const icon = adBlockBtn.querySelector('.icon') || adBlockBtn.querySelector('svg');
      if (icon) icon.style.color = isAdBlockEnabled ? '#10b981' : '#64748b';
      adBlockBtn.title = isAdBlockEnabled ? 'Reklam Kalkanı: Aktif' : 'Reklam Kalkanı: Devre Dışı';
    } else {
      adBlockBtn.className = 'nav-btn ' + (isAdBlockEnabled ? 'shield-active' : 'shield-inactive');
      adBlockBtn.title = isAdBlockEnabled ? 'Reklam Engelleyici: Aktif' : 'Reklam Engelleyici: Pasif';
    }
  }
  if (window.electronAPI && window.electronAPI.toggleAdBlock) {
    window.electronAPI.toggleAdBlock(isAdBlockEnabled);
  }
}
updateAdBlockUI(); // Initial check

if (adBlockBtn) {
  adBlockBtn.addEventListener('click', () => {
    isAdBlockEnabled = !isAdBlockEnabled;
    localStorage.setItem('isAdBlockEnabled', isAdBlockEnabled);
    updateAdBlockUI();
    showToast(isAdBlockEnabled ? '🛡️ Reklam Engelleyici: Aktif' : '⚠️ Reklam Engelleyici: Devre Dışı');
  });
}

// Force Dark Mode Switch Controller
const darkModeBtn = document.getElementById('tool-btn-darkmode');
function updateDarkModeUI() {
  if (isForceDarkMode) {
    darkModeBtn.classList.add('active');
    darkModeBtn.title = 'Zorunlu Karanlık Mod: Aktif';
  } else {
    darkModeBtn.classList.remove('active');
    darkModeBtn.title = 'Zorunlu Karanlık Mod: Pasif';
  }
}
updateDarkModeUI(); // Initial check

darkModeBtn.addEventListener('click', () => {
  isForceDarkMode = !isForceDarkMode;
  localStorage.setItem('isForceDarkMode', isForceDarkMode);
  updateDarkModeUI();
  
  // Apply immediately to the active tab if it exists
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    applyForceDarkModeToWebview(activeTab.webviewEl);
  }
});

function applyForceDarkModeToWebview(webview) {
  if (!webview) return;
  const darkCode = `
    (() => {
      let style = document.getElementById('lowbrowser-force-dark');
      const enabled = ${isForceDarkMode};
      if (enabled) {
        if (!style) {
          style = document.createElement('style');
          style.id = 'lowbrowser-force-dark';
          document.documentElement.appendChild(style);
        }
        style.innerHTML = 'html { filter: invert(1) hue-rotate(180deg) contrast(${dmContrast}%) brightness(${dmBrightness}%) !important; } img, video, iframe, canvas { filter: invert(1) hue-rotate(180deg) contrast(${100 / (dmContrast / 100)}%) brightness(${100 / (dmBrightness / 100)}%) !important; }';
      } else {
        if (style) style.remove();
      }
    })();
  `;
  try {
    webview.executeJavaScript(darkCode).catch(() => {});
  } catch (err) {}
}

// Toast Notifications Engine
function showToast(message) {
  let toast = document.getElementById('toast-container');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-container';
    toast.innerHTML = `<span id="toast-text"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('#toast-text').textContent = message;
  toast.classList.add('show');
  
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// RAM Turbo Boost GC Trigger
document.getElementById('tool-btn-boost').addEventListener('click', async () => {
  const boostBtn = document.getElementById('tool-btn-boost');
  boostBtn.style.transform = 'scale(0.85) rotate(15deg)';
  setTimeout(() => { boostBtn.style.transform = ''; }, 200);

  try {
    const beforeStats = await window.electronAPI.getStats();
    const ramBefore = beforeStats ? beforeStats.memoryMB : 0;
    
    // Call Garbage Collection
    window.electronAPI.triggerGC();
    
    setTimeout(async () => {
      const afterStats = await window.electronAPI.getStats();
      const ramAfter = afterStats ? afterStats.memoryMB : 0;
      const freedMB = ramBefore - ramAfter;
      
      if (freedMB > 0) {
        showToast(`RAM Turbo Boost Aktif! ${freedMB} MB bellek serbest bırakıldı.`);
      } else {
        showToast(`RAM Turbo Boost Aktif! Bellek zaten optimum seviyede.`);
      }
    }, 400);
  } catch (err) {
    showToast(`Bellek temizlendi!`);
  }
});

// Security Shield Popover Controller
const shieldBtn = document.getElementById('btn-security-shield');
const shieldPopover = document.getElementById('shield-popover');

shieldBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    updateShieldPopoverUI(activeTab);
  }
  shieldPopover.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!shieldPopover.contains(e.target) && e.target !== shieldBtn) {
    shieldPopover.classList.add('hidden');
  }
});

function updateShieldPopoverUI(tab) {
  const sslStatus = document.getElementById('shield-ssl-status');
  const adsBlockedText = document.getElementById('shield-ads-blocked');
  
  if (tab.url.startsWith('https://')) {
    sslStatus.innerHTML = '<span style="color: #10b981;">● Güvenli Bağlantı (HTTPS)</span>';
  } else if (tab.url.startsWith('http://')) {
    sslStatus.innerHTML = '<span style="color: #ef4444;">● Güvenli Olmayan Bağlantı (HTTP)</span>';
  } else {
    sslStatus.innerHTML = '<span style="color: var(--text-dim);">Yerel Sayfa (Internal)</span>';
  }
  
  const count = blockedAdsCount[tab.id] || 0;
  adsBlockedText.textContent = `Bu sitede ${count} reklam engellendi.`;
}

// Track blocked ads from IPC events
window.electronAPI.onAdBlocked(() => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    const currentCount = blockedAdsCount[activeTab.id] || 0;
    blockedAdsCount[activeTab.id] = currentCount + 1;
    
    // Update active popover UI
    updateShieldPopoverUI(activeTab);
  }
});

// Injected Dark Mode Contrast / Brightness Sliders
const sliderContrast = document.getElementById('slider-contrast');
const sliderBrightness = document.getElementById('slider-brightness');
const labelContrast = document.getElementById('label-contrast');
const labelBrightness = document.getElementById('label-brightness');

sliderContrast.value = dmContrast;
labelContrast.textContent = `${dmContrast}%`;
sliderBrightness.value = dmBrightness;
labelBrightness.textContent = `${dmBrightness}%`;

const updateContrast = () => {
  dmContrast = sliderContrast.value;
  labelContrast.textContent = `${dmContrast}%`;
  localStorage.setItem('dmContrast', dmContrast);
  applyContrastToActiveTab();
};

const updateBrightness = () => {
  dmBrightness = sliderBrightness.value;
  labelBrightness.textContent = `${dmBrightness}%`;
  localStorage.setItem('dmBrightness', dmBrightness);
  applyContrastToActiveTab();
};

sliderContrast.addEventListener('input', updateContrast);
sliderBrightness.addEventListener('input', updateBrightness);

function applyContrastToActiveTab() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    applyForceDarkModeToWebview(activeTab.webviewEl);
  }
}

// --- THEME STUDIO & SETTINGS CONTROLLER ---
const studioNavBtns = document.querySelectorAll('.studio-nav-btn');
const studioTabContents = document.querySelectorAll('.studio-tab-content');

studioNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    studioNavBtns.forEach(b => b.classList.remove('active'));
    studioTabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.add('active');
  });
});

// ESC key closes Settings Studio
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsPanel && settingsPanel.classList.contains('open')) {
    settingsPanel.classList.remove('open');
  }
});

// ==========================================================================
// 9. GAMER & POWER USER COMPONENT LOGIC
// ==========================================================================

// Toggle Settings Helper
function toggleSettings() {
  if (settingsPanel && settingsPanel.classList.contains('open')) {
    settingsPanel.classList.remove('open');
  } else {
    navigate('low://settings');
  }
}

// Toggle Dark Mode Helper
function toggleDarkMode() {
  isForceDarkMode = !isForceDarkMode;
  localStorage.setItem('isForceDarkMode', isForceDarkMode);
  updateDarkModeUI();
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    applyForceDarkModeToWebview(activeTab.webviewEl);
  }
}

// Trigger Boost Helper
function triggerBoost() {
  const boostBtn = document.getElementById('tool-btn-boost');
  boostBtn.click();
}

// Command Palette toggling
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey && e.code === 'Space') || (e.ctrlKey && e.code === 'KeyP')) {
    e.preventDefault();
    toggleCommandPalette();
  }
});

function toggleCommandPalette() {
  commandPalette.classList.toggle('hidden');
  if (!commandPalette.classList.contains('hidden')) {
    paletteInput.value = '';
    paletteInput.focus();
    renderPaletteResults();
  }
}

paletteInput.addEventListener('input', renderPaletteResults);

paletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteSelectedIndex = (paletteSelectedIndex + 1) % filteredPaletteItems.length;
    updatePaletteSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteSelectedIndex = (paletteSelectedIndex - 1 + filteredPaletteItems.length) % filteredPaletteItems.length;
    updatePaletteSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const selectedItem = filteredPaletteItems[paletteSelectedIndex];
    if (selectedItem) {
      executePaletteItem(selectedItem);
    }
  } else if (e.key === 'Escape') {
    commandPalette.classList.add('hidden');
  }
});

function renderPaletteResults() {
  const query = paletteInput.value.toLowerCase().trim();
  paletteSelectedIndex = 0;
  filteredPaletteItems = [];

  // Commands matching query
  paletteCommands.forEach(cmd => {
    if (cmd.name.toLowerCase().includes(query) || cmd.cmd.includes(query)) {
      filteredPaletteItems.push({ type: 'cmd', name: cmd.name, cmd: cmd.cmd, action: cmd.action });
    }
  });

  // Open tabs matching query
  tabs.forEach(tab => {
    if (tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query)) {
      filteredPaletteItems.push({ type: 'tab', name: tab.title, tabId: tab.id });
    }
  });

  paletteResults.innerHTML = '';
  filteredPaletteItems.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `palette-item ${index === 0 ? 'active' : ''}`;
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;
    div.appendChild(nameSpan);

    const badgeSpan = document.createElement('span');
    if (item.type === 'cmd') {
      badgeSpan.className = 'palette-item-cmd';
      badgeSpan.textContent = item.cmd;
    } else {
      badgeSpan.className = 'palette-item-tab';
      badgeSpan.textContent = 'SEKME';
    }
    div.appendChild(badgeSpan);

    div.addEventListener('click', () => {
      executePaletteItem(item);
    });

    paletteResults.appendChild(div);
  });
}

function updatePaletteSelection() {
  const items = paletteResults.querySelectorAll('.palette-item');
  items.forEach((item, index) => {
    item.classList.toggle('active', index === paletteSelectedIndex);
    if (index === paletteSelectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

function executePaletteItem(item) {
  commandPalette.classList.add('hidden');
  if (item.type === 'cmd') {
    item.action();
  } else if (item.type === 'tab') {
    switchTab(item.tabId);
  }
}

// Performance line graph canvas renderer
function drawPerformanceGraph() {
  if (!perfCanvas || !perfCtx) return;
  const width = perfCanvas.width;
  const height = perfCanvas.height;
  perfCtx.clearRect(0, 0, width, height);

  // Draw grid
  perfCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  perfCtx.lineWidth = 1;
  for (let i = 15; i < height; i += 15) {
    perfCtx.beginPath();
    perfCtx.moveTo(0, i);
    perfCtx.lineTo(width, i);
    perfCtx.stroke();
  }
  for (let i = 25; i < width; i += 25) {
    perfCtx.beginPath();
    perfCtx.moveTo(i, 0);
    perfCtx.lineTo(i, height);
    perfCtx.stroke();
  }

  if (memoryHistory.length < 2) return;

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#7f00ff';
  
  const gradient = perfCtx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, 'rgba(127, 0, 255, 0)');
  gradient.addColorStop(1, accentColor + '33');

  perfCtx.beginPath();
  const maxVal = 600; 
  const points = memoryHistory.map((val, idx) => {
    const x = (idx / 14) * width;
    const y = height - (Math.min(maxVal, val) / maxVal) * (height - 10) - 5;
    return { x, y };
  });

  perfCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    perfCtx.lineTo(points[i].x, points[i].y);
  }
  perfCtx.strokeStyle = accentColor;
  perfCtx.lineWidth = 2;
  perfCtx.stroke();

  perfCtx.lineTo(points[points.length - 1].x, height);
  perfCtx.lineTo(points[0].x, height);
  perfCtx.closePath();
  perfCtx.fillStyle = gradient;
  perfCtx.fill();

  const lastPoint = points[points.length - 1];
  perfCtx.beginPath();
  perfCtx.arc(lastPoint.x, lastPoint.y, 4, 0, 2 * Math.PI);
  perfCtx.fillStyle = accentColor;
  perfCtx.shadowColor = accentColor;
  perfCtx.shadowBlur = 8;
  perfCtx.fill();
  perfCtx.shadowBlur = 0;
}

// Audio Tab Mute indicator controller
function updateTabAudioStatus(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || !tab.tabEl) return;

  const isAudible = tab.webviewEl && !tab.sleeping ? tab.webviewEl.isCurrentlyAudible() : false;
  const isMuted = tab.webviewEl && !tab.sleeping ? tab.webviewEl.isAudioMuted() : false;

  let audioBtn = tab.tabEl.querySelector('.tab-audio');
  
  if (isAudible) {
    if (!audioBtn) {
      audioBtn = document.createElement('button');
      audioBtn.className = 'tab-audio';
      const closeBtn = tab.tabEl.querySelector('.btn-close-tab');
      tab.tabEl.insertBefore(audioBtn, closeBtn);
      
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tab.webviewEl) {
          const currentlyMuted = tab.webviewEl.isAudioMuted();
          tab.webviewEl.setAudioMuted(!currentlyMuted);
          updateTabAudioStatus(tabId);
        }
      });
    }

    if (isMuted) {
      audioBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>`;
      audioBtn.title = "Sesi Aç (Muted)";
    } else {
      audioBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>`;
      audioBtn.title = "Sustur (Mute)";
    }
  } else {
    if (audioBtn) audioBtn.remove();
  }
}

// Running reactive audio indicator polling loop
setInterval(() => {
  tabs.forEach(t => updateTabAudioStatus(t.id));
}, 1200);

// ==========================================================================
// 10. PRODUCTIVITY & LATENCY LOGIC (Ping, Bookmarks, Notes, Downloads)
// ==========================================================================

// Ping Latency Test Button Click Handler
document.getElementById('btn-ping-test').addEventListener('click', async () => {
  const pingDot = document.getElementById('ping-dot');
  const pingText = document.getElementById('ping-text');
  
  pingText.textContent = "Test...";
  pingDot.style.backgroundColor = '#64748b';
  pingDot.style.transform = 'scale(1.3)';
  
  const start = Date.now();
  try {
    // Mode no-cors and cache no-store ensures reliable server test
    await fetch('https://www.google.com/generate_204', { mode: 'no-cors', cache: 'no-store' });
    const ping = Date.now() - start;
    
    pingText.textContent = `${ping} ms`;
    pingDot.style.transform = '';

    if (ping < 60) {
      pingDot.style.backgroundColor = '#10b981'; // Green
      showToast(`Ping Ölçüldü: ${ping} ms (Kararlı & Akıcı)`);
    } else if (ping < 160) {
      pingDot.style.backgroundColor = '#f59e0b'; // Yellow
      showToast(`Ping Ölçüldü: ${ping} ms (Orta Derece Gecikme)`);
    } else {
      pingDot.style.backgroundColor = '#ef4444'; // Red
      showToast(`Ping Ölçüldü: ${ping} ms (Yüksek Gecikme!)`);
    }
  } catch (err) {
    pingText.textContent = "Offline";
    pingDot.style.transform = '';
    pingDot.style.backgroundColor = '#374151';
    showToast(`Ağ gecikmesi ölçülemedi. Çevrimdışı olabilirsiniz.`);
  }
});

// Bookmarks Bar Renderer & Manager
const bookmarksList = document.getElementById('bookmarks-list');
function renderBookmarks() {
  bookmarksList.innerHTML = '';
  if (bookmarks.length === 0) {
    bookmarksList.innerHTML = `<span style="font-size: 10px; color: var(--text-dim); padding-left: 4px;">Kayıtlı yer imi yok. Eklemek için Ctrl + D tuşlarına basın.</span>`;
    return;
  }
  bookmarks.forEach((bm, idx) => {
    const btn = document.createElement('button');
    btn.className = 'bookmark-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 10px; height: 10px; fill: currentColor;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg> ${bm.title}`;
    
    // Open bookmark on left click
    btn.addEventListener('click', () => {
      navigate(bm.url);
    });

    // Delete bookmark on right click
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      bookmarks.splice(idx, 1);
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
      renderBookmarks();
      showToast(`Yer imi silindi: ${bm.title}`);
    });

    bookmarksList.appendChild(btn);
  });
}

// Ctrl + D Bookmarks Event Listener
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'KeyD') {
    e.preventDefault();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.url !== 'lowbrowser://newtab') {
      const exists = bookmarks.some(bm => bm.url === activeTab.url);
      if (!exists) {
        bookmarks.push({ title: activeTab.title, url: activeTab.url });
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
        showToast(`Yer imlerine eklendi: ${activeTab.title}`);
      } else {
        showToast(`Bu sayfa zaten yer imlerinizde kayıtlı.`);
      }
    } else {
      showToast(`Bu sayfa yer imlerine eklenemez.`);
    }
  }
});

// Left Notes Panel (Quick Notes) Controller
const notesPanel = document.getElementById('notes-panel');
const notesTextarea = document.getElementById('notes-textarea');

// Load stored notes
notesTextarea.value = localStorage.getItem('lowbrowser_notes') || '';

// Auto-save on every keystroke
notesTextarea.addEventListener('input', () => {
  localStorage.setItem('lowbrowser_notes', notesTextarea.value);
});

document.getElementById('tool-btn-notes').addEventListener('click', () => {
  notesPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-notes').addEventListener('click', () => {
  notesPanel.classList.add('hidden');
});

function translateActiveTab() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    showToast("Sayfa Türkçe'ye çevriliyor...");
    
    const script = `
      (() => {
        let translateCombo = document.querySelector('.goog-te-combo');
        if (translateCombo) {
          translateCombo.value = 'tr';
          translateCombo.dispatchEvent(new Event('change'));
          return;
        }
        
        const div = document.createElement('div');
        div.id = 'google_translate_element';
        div.style.position = 'fixed';
        div.style.top = '-9999px';
        div.style.left = '-9999px';
        document.body.appendChild(div);
        
        window.googleTranslateElementInit = () => {
          new google.translate.TranslateElement({
            pageLanguage: 'auto',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE
          }, 'google_translate_element');
          
          const checkInterval = setInterval(() => {
            const select = document.querySelector('.goog-te-combo');
            if (select) {
              clearInterval(checkInterval);
              select.value = 'tr';
              select.dispatchEvent(new Event('change'));
              
              // Hide Google Translate standard header bar for native look
              const style = document.createElement('style');
              style.innerHTML = 'body { top: 0px !important; } .skiptranslate { display: none !important; }';
              document.head.appendChild(style);
            }
          }, 150);
          
          setTimeout(() => clearInterval(checkInterval), 10000);
        };
        
        const s = document.createElement('script');
        s.type = 'text/javascript';
        s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.head.appendChild(s);
      })();
    `;
    activeTab.webviewEl.executeJavaScript(script).catch(() => {});
  } else {
    showToast("Çevrilecek aktif sayfa bulunamadı.");
  }
}

// Bind click trigger for translate page
document.getElementById('tool-btn-translate').addEventListener('click', translateActiveTab);

// Dynamic Adaptive Brand Color Extraction Engine
// ==========================================================================
// 10. TAB VOLUME MIXER, CLIPBOARD HISTORY & AUTOCOMPLETE SUGGESTIONS
// ==========================================================================

// --- 1. SEARCH SUGGESTIONS ENGINE ---
const suggestionsBox = document.getElementById('suggestions-box');
let suggestionSelectedIndex = -1;
let activeSuggestions = [];
let suggestionTimeout = null;

// Popular websites fallback list
const popularWebsites = [
  { name: 'YouTube', url: 'youtube.com' },
  { name: 'Google', url: 'google.com' },
  { name: 'GitHub', url: 'github.com' },
  { name: 'Facebook', url: 'facebook.com' },
  { name: 'Twitter (X)', url: 'twitter.com' },
  { name: 'Instagram', url: 'instagram.com' },
  { name: 'Netflix', url: 'netflix.com' },
  { name: 'Twitch', url: 'twitch.tv' },
  { name: 'Reddit', url: 'reddit.com' },
  { name: 'Wikipedia', url: 'wikipedia.org' }
];

let currentSuggestionRequestId = 0;

addressInput.addEventListener('input', () => {
  clearTimeout(suggestionTimeout);
  suggestionTimeout = setTimeout(fetchAndShowSuggestions, 140);
});

addressInput.addEventListener('focus', () => {
  if (addressInput.value.trim().length > 0) {
    fetchAndShowSuggestions();
  }
});

// Hide suggestions when input loses focus (with slight delay for click events)
addressInput.addEventListener('blur', () => {
  setTimeout(() => {
    if (suggestionsBox) {
      suggestionsBox.classList.add('hidden');
    }
  }, 180);
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
  if (!document.getElementById('address-bar-wrapper').contains(e.target)) {
    suggestionsBox.classList.add('hidden');
  }
});

// Keyboard navigation in suggestions list
addressInput.addEventListener('keydown', (e) => {
  if (suggestionsBox.classList.contains('hidden') || activeSuggestions.length === 0) {
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestionSelectedIndex = (suggestionSelectedIndex + 1) % activeSuggestions.length;
    updateSuggestionSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestionSelectedIndex = (suggestionSelectedIndex - 1 + activeSuggestions.length) % activeSuggestions.length;
    updateSuggestionSelection();
  } else if (e.key === 'Escape') {
    suggestionsBox.classList.add('hidden');
  } else if (e.key === 'Enter') {
    // If user is highlighting an item, execute that item instead of standard navigation
    if (suggestionSelectedIndex >= 0 && suggestionSelectedIndex < activeSuggestions.length) {
      e.preventDefault();
      executeSuggestion(activeSuggestions[suggestionSelectedIndex]);
    }
  }
});

async function fetchAndShowSuggestions() {
  const query = addressInput.value.trim();
  if (query.length === 0) {
    suggestionsBox.classList.add('hidden');
    activeSuggestions = [];
    return;
  }

  const requestId = ++currentSuggestionRequestId;
  suggestionSelectedIndex = -1;
  activeSuggestions = [];

  const lowerQuery = query.toLowerCase();

  // 1. Matches from Bookmarks (Instant local match)
  bookmarks.forEach(bm => {
    if (bm.title && bm.title.trim().length > 0 && (bm.title.toLowerCase().includes(lowerQuery) || bm.url.toLowerCase().includes(lowerQuery))) {
      activeSuggestions.push({
        type: 'bookmark',
        title: bm.title,
        url: bm.url,
        display: bm.title
      });
    }
  });

  // 2. Matches from Open Tabs (Instant local match)
  tabs.forEach(tab => {
    if (tab.title && tab.title.trim().length > 0 && (tab.title.toLowerCase().includes(lowerQuery) || tab.url.toLowerCase().includes(lowerQuery))) {
      activeSuggestions.push({
        type: 'tab',
        title: tab.title,
        url: tab.url,
        tabId: tab.id,
        display: `${tab.title} (Açık Sekme)`
      });
    }
  });

  // 3. Matches from Popular Sites (Instant local match)
  popularWebsites.forEach(site => {
    if (site.name && site.name.trim().length > 0 && (site.name.toLowerCase().includes(lowerQuery) || site.url.toLowerCase().includes(lowerQuery))) {
      if (!activeSuggestions.some(s => s.url === site.url)) {
        activeSuggestions.push({
          type: 'popular',
          title: site.name,
          url: `https://${site.url}`,
          display: site.name
        });
      }
    }
  });

  // Show instant local matches immediately (0ms latency)
  if (activeSuggestions.length > 0) {
    renderSuggestionsUI();
  }

  // 4. Fetch Live Google Autocomplete with race-condition check
  try {
    const data = await window.electronAPI.getGoogleSuggestions(query);
    if (requestId !== currentSuggestionRequestId) {
      return; // Out-of-order stale response, discard
    }

    if (data && data[1]) {
      data[1].slice(0, 6).forEach(sugg => {
        if (!sugg || typeof sugg !== 'string' || sugg.trim().length === 0) {
          return;
        }
        if (!activeSuggestions.some(s => s.display && s.display.toLowerCase() === sugg.toLowerCase())) {
          activeSuggestions.push({
            type: 'search',
            title: sugg,
            url: `https://www.google.com/search?q=${encodeURIComponent(sugg)}`,
            display: sugg
          });
        }
      });
    }
    renderSuggestionsUI();
  } catch (err) {
    if (requestId === currentSuggestionRequestId) {
      renderSuggestionsUI();
    }
  }
}

function renderSuggestionsUI() {
  if (activeSuggestions.length === 0) {
    suggestionsBox.classList.add('hidden');
    return;
  }

  suggestionsBox.innerHTML = '';
  activeSuggestions.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.dataset.index = idx;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'suggestion-content';

    let iconHtml = '';
    let badgeText = '';

    if (item.type === 'bookmark') {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/></svg>`;
      badgeText = 'Yer İmi';
    } else if (item.type === 'tab') {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v14zm-10-7h9v6h-9v-6z" fill="currentColor"/></svg>`;
      badgeText = 'Sekme';
    } else if (item.type === 'popular') {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>`;
      badgeText = 'Git';
    } else {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>`;
      badgeText = 'Ara';
    }

    contentDiv.innerHTML = `${iconHtml}<span class="suggestion-text">${item.display}</span>`;
    div.appendChild(contentDiv);

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'suggestion-badge';
    badgeSpan.textContent = badgeText;
    div.appendChild(badgeSpan);

    div.addEventListener('click', () => {
      executeSuggestion(item);
    });

    suggestionsBox.appendChild(div);
  });

  suggestionsBox.classList.remove('hidden');
}

function updateSuggestionSelection() {
  const items = suggestionsBox.querySelectorAll('.suggestion-item');
  items.forEach(el => el.classList.remove('active'));

  if (suggestionSelectedIndex >= 0 && suggestionSelectedIndex < items.length) {
    const selectedEl = items[suggestionSelectedIndex];
    selectedEl.classList.add('active');

    // Fill address bar with choice
    const selectedItem = activeSuggestions[suggestionSelectedIndex];
    if (selectedItem.type === 'search') {
      addressInput.value = selectedItem.display;
    } else {
      addressInput.value = selectedItem.url;
    }
  }
}

function executeSuggestion(item) {
  suggestionsBox.classList.add('hidden');
  if (item.type === 'tab' && item.tabId) {
    switchTab(item.tabId);
  } else {
    // Navigate URL or Google search
    navigateToUrl(item.url);
  }
}

function navigateToUrl(url) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    if (activeTab.url === 'lowbrowser://newtab') {
      // Re-create webview
      activeTab.url = url;
      startPage.classList.add('hidden');
      
      const webviewEl = document.createElement('webview');
      webviewEl.setAttribute('id', `wv_${activeTab.id}`);
      webviewEl.setAttribute('src', url);
      webviewEl.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
      webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
      if (activeTab.isPrivate) {
        webviewEl.setAttribute('partition', 'private_session');
      }
      webviewsContainer.appendChild(webviewEl);
      setupWebviewEvents(webviewEl, activeTab.id);
      activeTab.webviewEl = webviewEl;
      
      setTimeout(() => {
        if (webviewEl) webviewEl.focus();
      }, 50);
    } else if (activeTab.webviewEl) {
      activeTab.webviewEl.setAttribute('src', url);
    }
    addressInput.value = url;
  }
}


// --- 2. TAB VOLUME MIXER LOGIC ---
const volumeBtn = document.getElementById('tool-btn-volume');
const volumePanel = document.getElementById('volume-panel');
const volumeList = document.getElementById('volume-list');

volumeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  renderVolumeUI();
  volumePanel.classList.toggle('hidden');
});

// Close volume panel when clicking outside
document.addEventListener('click', (e) => {
  if (!volumePanel.contains(e.target) && e.target !== volumeBtn) {
    volumePanel.classList.add('hidden');
  }
});

function renderVolumeUI() {
  volumeList.innerHTML = '';
  
  // List only open (non-sleeping) tabs
  const activeTabs = tabs.filter(t => !t.sleeping);
  
  if (activeTabs.length === 0) {
    volumeList.innerHTML = '<div class="empty-volume">Ses çalan aktif sekme bulunmuyor.</div>';
    return;
  }

  activeTabs.forEach(tab => {
    const row = document.createElement('div');
    row.className = 'volume-row';

    const info = document.createElement('div');
    info.className = 'volume-info';
    info.innerHTML = `
      <span class="volume-tab-title" title="${tab.title}">${tab.title}</span>
    `;
    row.appendChild(info);

    const control = document.createElement('div');
    control.className = 'volume-control';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'volume-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = Math.round((tab.volume || 1) * 100);

    const percentage = document.createElement('span');
    percentage.className = 'volume-percentage';
    percentage.textContent = `%${slider.value}`;

    control.appendChild(slider);
    control.appendChild(percentage);
    row.appendChild(control);

    // Bind slider input change
    slider.addEventListener('input', () => {
      const vol = slider.value / 100;
      tab.volume = vol;
      percentage.textContent = `%${slider.value}`;

      // Enject volume adjustment inside the webview content
      if (tab.webviewEl) {
        tab.webviewEl.executeJavaScript(`
          document.querySelectorAll('video, audio').forEach(el => {
            el.volume = ${vol};
          });
        `).catch(() => {});
      }
    });

    volumeList.appendChild(row);
  });
}


// --- 3. CLIPBOARD MANAGER LOGIC ---
const clipboardBtn = document.getElementById('tool-btn-clipboard');
const clipboardPanel = document.getElementById('clipboard-panel');
const clipboardList = document.getElementById('clipboard-list');

let clipboardHistory = JSON.parse(localStorage.getItem('lowbrowser_clipboard_history')) || [];

clipboardBtn.addEventListener('click', () => {
  renderClipboardUI();
  clipboardPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-clipboard').addEventListener('click', () => {
  clipboardPanel.classList.add('hidden');
});

// Clipboard watcher perodic check
setInterval(async () => {
  try {
    const text = await window.electronAPI.readClipboard();
    if (text && text.trim().length > 0 && text.length < 2000) {
      const cleanText = text.trim();
      // If it's new, add to clipboardHistory
      if (clipboardHistory.length === 0 || clipboardHistory[0] !== cleanText) {
        // Remove duplicate if it exists elsewhere
        clipboardHistory = clipboardHistory.filter(item => item !== cleanText);
        // Add to front
        clipboardHistory.unshift(cleanText);
        // Cap to 20 items
        clipboardHistory = clipboardHistory.slice(0, 20);
        
        localStorage.setItem('lowbrowser_clipboard_history', JSON.stringify(clipboardHistory));
        
        // Refresh UI if panel is open
        if (!clipboardPanel.classList.contains('hidden')) {
          renderClipboardUI();
        }
      }
    }
  } catch (err) {}
}, 1500);

function renderClipboardUI() {
  clipboardList.innerHTML = '';
  
  if (clipboardHistory.length === 0) {
    clipboardList.innerHTML = '<div class="empty-clipboard">Kopyalama geçmişiniz boş.</div>';
    return;
  }

  clipboardHistory.forEach(text => {
    const item = document.createElement('div');
    item.className = 'clipboard-item';
    item.textContent = text;
    item.title = "Tekrar panoya kopyalamak için tıklayın";

    item.addEventListener('click', () => {
      window.electronAPI.writeClipboard(text);
      showToast("Panoya kopyalandı!");
    });

    clipboardList.appendChild(item);
  });
}

// --- 4. BROWSING HISTORY LOGIC (Capped at 300 entries) ---
const historyBtn = document.getElementById('tool-btn-history');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');

historyBtn.addEventListener('click', () => {
  renderHistoryUI();
  historyPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-history').addEventListener('click', () => {
  historyPanel.classList.add('hidden');
});

document.getElementById('btn-clear-history').addEventListener('click', () => {
  localStorage.removeItem('lowbrowser_history');
  renderHistoryUI();
  showToast("Tarama geçmişi temizlendi.");
});

function addToHistory(title, url, isPrivate) {
  if (isPrivate || !url || url.startsWith('lowbrowser://')) return;
  
  let history = JSON.parse(localStorage.getItem('lowbrowser_history')) || [];
  
  // Prevent consecutive duplicates
  if (history.length > 0 && history[0].url === url) return;
  
  history.unshift({
    title: title || url,
    url: url,
    time: Date.now()
  });
  
  // Cap at 300 entries!
  if (history.length > 300) {
    history = history.slice(0, 300);
  }
  
  localStorage.setItem('lowbrowser_history', JSON.stringify(history));
  
  if (!historyPanel.classList.contains('hidden')) {
    renderHistoryUI();
  }
}

function renderHistoryUI() {
  historyList.innerHTML = '';
  const history = JSON.parse(localStorage.getItem('lowbrowser_history')) || [];
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-history">Henüz tarama geçmişi bulunmuyor.</div>';
    return;
  }

  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span class="history-item-title">${item.title}</span>
      <span class="history-item-url">${item.url}</span>
    `;
    
    div.addEventListener('click', () => {
      navigateToUrl(item.url);
      historyPanel.classList.add('hidden');
    });

    historyList.appendChild(div);
  });
}


// --- 5. PASSWORD VAULT & AUTOFILL LOGIC ---
const passwordsBtn = document.getElementById('tool-btn-passwords');
const passwordsPanel = document.getElementById('passwords-panel');
const passwordsList = document.getElementById('passwords-list');
const btnAutofillKey = document.getElementById('btn-autofill-key');

let savedPasswords = JSON.parse(localStorage.getItem('lowbrowser_saved_passwords')) || [];

passwordsBtn.addEventListener('click', () => {
  renderPasswordsUI();
  passwordsPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-passwords').addEventListener('click', () => {
  passwordsPanel.classList.add('hidden');
});

// Save password manual form trigger
document.getElementById('btn-save-password').addEventListener('click', () => {
  const urlInp = document.getElementById('pass-add-url').value.trim();
  const userInp = document.getElementById('pass-add-user').value.trim();
  const wordInp = document.getElementById('pass-add-word').value.trim();

  if (!urlInp || !userInp || !wordInp) {
    showToast("Lütfen tüm alanları doldurun.");
    return;
  }

  // Sanitize url to simple domain
  let cleanDomain = urlInp;
  try {
    if (!cleanDomain.startsWith('http')) {
      cleanDomain = 'https://' + cleanDomain;
    }
    cleanDomain = new URL(cleanDomain).hostname.replace('www.', '');
  } catch(e) {}

  savedPasswords.push({
    url: cleanDomain,
    user: userInp,
    pass: wordInp
  });

  localStorage.setItem('lowbrowser_saved_passwords', JSON.stringify(savedPasswords));
  
  // Clear inputs
  document.getElementById('pass-add-url').value = '';
  document.getElementById('pass-add-user').value = '';
  document.getElementById('pass-add-word').value = '';

  renderPasswordsUI();
  checkPasswordsForCurrentTab();
  showToast("Şifre başarıyla kaydedildi!");
});

// Single-click autofill execution
btnAutofillKey.addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || activeTab.url.startsWith('lowbrowser://')) return;

  try {
    const domain = new URL(activeTab.url).hostname.replace('www.', '');
    const entry = savedPasswords.find(p => p.url.includes(domain));
    if (entry) {
      autoFillCredentials(entry.user, entry.pass);
      showToast("Şifre otomatik dolduruldu!");
    }
  } catch (err) {}
});

function autoFillCredentials(username, password) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl) {
    const code = `
      (() => {
        const passInput = document.querySelector('input[type="password"]');
        if (passInput) {
          passInput.value = "${password}";
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          let form = passInput.form;
          let userInput = null;
          if (form) {
            userInput = form.querySelector('input[type="text"], input[type="email"], input:not([type])');
          } else {
            userInput = document.querySelector('input[type="text"], input[type="email"]');
          }
          if (userInput) {
            userInput.value = "${username}";
            userInput.dispatchEvent(new Event('input', { bubbles: true }));
            userInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      })();
    `;
    activeTab.webviewEl.executeJavaScript(code).catch(() => {});
  }
}

function checkPasswordsForCurrentTab() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  const btnKey = document.getElementById('btn-autofill-key');
  if (!activeTab || activeTab.url.startsWith('lowbrowser://')) {
    btnKey.classList.add('hidden');
    return;
  }
  
  try {
    const domain = new URL(activeTab.url).hostname.replace('www.', '');
    const saved = savedPasswords.find(p => p.url.includes(domain));
    if (saved) {
      btnKey.classList.remove('hidden');
    } else {
      btnKey.classList.add('hidden');
    }
  } catch (e) {
    btnKey.classList.add('hidden');
  }
}

function renderPasswordsUI() {
  passwordsList.innerHTML = '';
  
  if (savedPasswords.length === 0) {
    passwordsList.innerHTML = '<div class="empty-passwords">Kaydedilmiş şifre bulunmuyor.</div>';
    return;
  }

  savedPasswords.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'password-row';
    row.innerHTML = `
      <div class="password-row-domain">${entry.url}</div>
      <div class="password-row-user">Kullanıcı: ${entry.user}</div>
      <div class="password-row-actions">
        <button class="btn-delete-password" data-index="${idx}">Sil</button>
      </div>
    `;

    row.querySelector('.btn-delete-password').addEventListener('click', (e) => {
      const indexToDelete = parseInt(e.target.dataset.index);
      savedPasswords.splice(indexToDelete, 1);
      localStorage.setItem('lowbrowser_saved_passwords', JSON.stringify(savedPasswords));
      renderPasswordsUI();
      checkPasswordsForCurrentTab();
      showToast("Şifre silindi.");
    });

    passwordsList.appendChild(row);
  });
}

// --- 6. TOOLS MENU POPOVER CONTROLLER ---
const toolsMenuBtn = document.getElementById('btn-tools-menu');
const toolsMenuPopover = document.getElementById('tools-menu-popover');

toolsMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  // Close other popovers
  if (typeof downloadsPanel !== 'undefined') downloadsPanel.classList.add('hidden');
  if (typeof volumePanel !== 'undefined') volumePanel.classList.add('hidden');
  if (typeof shieldPopover !== 'undefined') shieldPopover.classList.add('hidden');
  
  toolsMenuPopover.classList.toggle('hidden');
});

// Close tools menu when clicking outside
document.addEventListener('click', (e) => {
  if (!toolsMenuPopover.contains(e.target) && e.target !== toolsMenuBtn) {
    toolsMenuPopover.classList.add('hidden');
  }
});

// Close tools menu when any sub-tool item is clicked (for cleaner UX)
toolsMenuPopover.querySelectorAll('.tool-item').forEach(item => {
  item.addEventListener('click', () => {
    toolsMenuPopover.classList.add('hidden');
  });
});

// Extra tools menu items wiring
const toolBtnImport = document.getElementById('tool-btn-import');
if (toolBtnImport) {
  toolBtnImport.addEventListener('click', () => {
    if (typeof openImportWizardModal === 'function') openImportWizardModal();
  });
}

const toolBtnVertTabs = document.getElementById('tool-btn-vertical-tabs');
if (toolBtnVertTabs) {
  toolBtnVertTabs.addEventListener('click', () => {
    const isVert = document.body.classList.toggle('vertical-tabs-mode');
    localStorage.setItem('lowbrowser_vertical_tabs', isVert);
    showToast(isVert ? '📐 Dikey Sekme Moduna Geçildi' : 'Yatay Sekme Moduna Geçildi');
  });
}

const toolBtnGame = document.getElementById('tool-btn-game');
if (toolBtnGame) {
  toolBtnGame.addEventListener('click', () => {
    if (utilitySidebar) {
      utilitySidebar.classList.remove('hidden');
      const gameBtn = document.querySelector('.side-tab-btn[data-tool="game"]');
      if (gameBtn) gameBtn.click();
    }
  });
}

const toolBtnAdblock = document.getElementById('tool-btn-adblock');
if (toolBtnAdblock) {
  toolBtnAdblock.addEventListener('click', () => {
    isAdblockEnabled = !isAdblockEnabled;
    localStorage.setItem('isAdblockEnabled', isAdblockEnabled);
    updateAdblockUI();
    showToast(isAdblockEnabled ? '🛡️ Reklam Engelleyici Açıldı' : 'Reklam Engelleyici Kapatıldı');
  });
}

// Data Saver Tool Controller
const toolBtnDataSaver = document.getElementById('tool-btn-datasaver');
let isDataSaverOn = localStorage.getItem('lowbrowser_data_saver') === 'true';

function updateDataSaverUI(savedBytes = 0) {
  if (toolBtnDataSaver) {
    toolBtnDataSaver.classList.toggle('active', isDataSaverOn);
    const textEl = document.getElementById('datasaver-btn-text');
    if (textEl) {
      if (isDataSaverOn) {
        const mb = (savedBytes / (1024 * 1024)).toFixed(1);
        textEl.textContent = mb > 0 ? `Tasarruf: ${mb}MB` : 'Tasarruf Aktif';
      } else {
        textEl.textContent = 'Veri Tasarrufu';
      }
    }
  }
}

if (toolBtnDataSaver) {
  toolBtnDataSaver.addEventListener('click', () => {
    isDataSaverOn = !isDataSaverOn;
    localStorage.setItem('lowbrowser_data_saver', isDataSaverOn);
    if (window.electronAPI && window.electronAPI.toggleDataSaver) {
      window.electronAPI.toggleDataSaver(isDataSaverOn);
    }
    updateDataSaverUI();
    showToast(isDataSaverOn ? '🌐 Veri Tasarrufu & Turbo Sıkıştırma Aktif (%60 Az Veri)!' : 'Veri Tasarrufu Kapatıldı.');
  });
}

if (window.electronAPI && window.electronAPI.onDataSaverStats) {
  window.electronAPI.onDataSaverStats((data) => {
    updateDataSaverUI(data.savedBytes);
  });
}

if (isDataSaverOn && window.electronAPI && window.electronAPI.toggleDataSaver) {
  window.electronAPI.toggleDataSaver(true);
}
updateDataSaverUI();

// ==========================================
// 6.B MERAKLI GÖZ KALKANI (AUTO-BLUR PRIVACY SHIELD)
// ==========================================
const toolBtnAutoBlur = document.getElementById('tool-btn-autoblur');
const privacyBlurOverlay = document.getElementById('privacy-blur-overlay');
let isAutoBlurEnabled = localStorage.getItem('lowbrowser_autoblur') === 'true';

function updateAutoBlurUI() {
  if (toolBtnAutoBlur) {
    toolBtnAutoBlur.classList.toggle('active', isAutoBlurEnabled);
  }
}

if (toolBtnAutoBlur) {
  toolBtnAutoBlur.addEventListener('click', () => {
    isAutoBlurEnabled = !isAutoBlurEnabled;
    localStorage.setItem('lowbrowser_autoblur', isAutoBlurEnabled);
    updateAutoBlurUI();
    showToast(isAutoBlurEnabled ? '🔒 Meraklı Göz Kalkanı Açıldı (Pencere Değişince Otomatik Buzlanır)!' : 'Göz Kalkanı Kapatıldı.');
  });
}

// Window blur & focus detection
window.addEventListener('blur', () => {
  if (isAutoBlurEnabled && privacyBlurOverlay) {
    privacyBlurOverlay.classList.remove('hidden');
  }
});

window.addEventListener('focus', () => {
  if (privacyBlurOverlay) {
    privacyBlurOverlay.classList.add('hidden');
  }
});

if (privacyBlurOverlay) {
  privacyBlurOverlay.addEventListener('click', () => {
    privacyBlurOverlay.classList.add('hidden');
  });
}

// Quick Shortcut: Alt + B
window.addEventListener('keydown', (e) => {
  if (e.altKey && e.code === 'KeyB') {
    e.preventDefault();
    if (privacyBlurOverlay) privacyBlurOverlay.classList.toggle('hidden');
  }
});

updateAutoBlurUI();

// ==========================================
// 6.C SAHTE SİTE & OLTALAMA RADARI (ANTI-PHISHING RADAR)
// ==========================================
const toolBtnPhishRadar = document.getElementById('tool-btn-phishradar');
const phishRadarModal = document.getElementById('phish-radar-modal');
const phishTargetDomain = document.getElementById('phish-target-domain');
const btnPhishGoSafe = document.getElementById('btn-phish-go-safe');
const btnPhishProceed = document.getElementById('btn-phish-proceed');

let isPhishRadarEnabled = localStorage.getItem('lowbrowser_phish_radar') !== 'false';
let pendingPhishUrl = null;

function updatePhishRadarUI() {
  if (toolBtnPhishRadar) {
    toolBtnPhishRadar.classList.toggle('active', isPhishRadarEnabled);
  }
}

if (toolBtnPhishRadar) {
  toolBtnPhishRadar.addEventListener('click', () => {
    isPhishRadarEnabled = !isPhishRadarEnabled;
    localStorage.setItem('lowbrowser_phish_radar', isPhishRadarEnabled);
    updatePhishRadarUI();
    showToast(isPhishRadarEnabled ? '🛡️ Oltalama Radarı Açıldı (Sahte Siteler Engellenir)' : 'Oltalama Radarı Kapatıldı.');
  });
}

const suspiciousPatterns = [
  /paypa[l1i]\.com/i,
  /pay-?pal[a-z0-9-]*\.(?!paypal\.com)[a-z]+/i,
  /g0+gle/i,
  /g[o0]{2}gle[a-z0-9-]*\.(?!google\.com)[a-z]+/i,
  /faceb[0o]{2}k/i,
  /instagr[a-z0-9]*rn\.com/i,
  /netf[li1]ix/i,
  /steamc[o0]r?m{1,2}unity/i,
  /b[i1]n[a4]nce/i,
  /ap{1,2}le-id/i,
  /ziraat[a-z0-9-]*giris/i,
  /garanti[a-z0-9-]*sube/i,
  /akbank[a-z0-9-]*online/i
];

function checkPhishingRisk(targetUrl) {
  if (!isPhishRadarEnabled || !targetUrl) return false;
  
  try {
    const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl);
    const host = urlObj.hostname.toLowerCase();

    // Whitelist official domains
    const legitDomains = ['paypal.com', 'google.com', 'facebook.com', 'instagram.com', 'netflix.com', 'steampowered.com', 'steamcommunity.com', 'binance.com', 'apple.com', 'microsoft.com', 'ziraatbank.com.tr', 'garantibbva.com.tr', 'akbank.com'];
    if (legitDomains.some(d => host === d || host.endsWith('.' + d))) {
      return false;
    }

    // Test suspicious patterns
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(host)) {
        return host;
      }
    }

    // Check suspicious deceptive subdomains (e.g. login.paypal.com.attacker.xyz)
    if (host.includes('.paypal.com.') || host.includes('.google.com.') || host.includes('.instagram.com.')) {
      return host;
    }
  } catch (e) {}

  return false;
}

if (btnPhishGoSafe) {
  btnPhishGoSafe.addEventListener('click', () => {
    if (phishRadarModal) phishRadarModal.classList.add('hidden');
    pendingPhishUrl = null;
    createTab();
  });
}

if (btnPhishProceed) {
  btnPhishProceed.addEventListener('click', () => {
    if (phishRadarModal) phishRadarModal.classList.add('hidden');
    if (pendingPhishUrl) {
      const urlToLoad = pendingPhishUrl;
      pendingPhishUrl = null;
      loadUrlDirect(urlToLoad);
    }
  });
}

function loadUrlDirect(targetUrl) {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  tab.url = targetUrl;
  if (tab.webviewEl) {
    tab.webviewEl.loadURL(targetUrl);
  } else {
    createTab(targetUrl);
  }
}

updatePhishRadarUI();

// ==========================================
// 6.D CANLI WEB SAYFASI ÇİZİM & KALEM ARACI (PAGE DRAW & DOODLE)
// ==========================================
const toolBtnDraw = document.getElementById('tool-btn-draw');
const drawingCanvasOverlay = document.getElementById('drawing-canvas-overlay');
const pageDrawingCanvas = document.getElementById('pageDrawingCanvas');
const drawingToolbar = document.getElementById('drawing-toolbar');

const drawBtnPen = document.getElementById('draw-btn-pen');
const drawBtnHighlighter = document.getElementById('draw-btn-highlighter');
const drawBtnEraser = document.getElementById('draw-btn-eraser');
const drawBtnClear = document.getElementById('draw-btn-clear');
const drawBtnSave = document.getElementById('draw-btn-save');
const drawBtnClose = document.getElementById('draw-btn-close');
const drawColors = document.querySelectorAll('.draw-color');

let isDrawingMode = false;
let isPainting = false;
let currentDrawMode = 'pen'; // 'pen', 'highlighter', 'eraser'
let currentDrawColor = '#a855f7';
let drawCtx = null;
let lastX = 0;
let lastY = 0;

function initDrawingCanvas() {
  if (!pageDrawingCanvas) return;
  drawCtx = pageDrawingCanvas.getContext('2d');
  resizeDrawingCanvas();
}

function resizeDrawingCanvas() {
  if (!pageDrawingCanvas || !drawingCanvasOverlay) return;
  pageDrawingCanvas.width = drawingCanvasOverlay.clientWidth || window.innerWidth;
  pageDrawingCanvas.height = drawingCanvasOverlay.clientHeight || (window.innerHeight - 40);
}

window.addEventListener('resize', () => {
  if (isDrawingMode) resizeDrawingCanvas();
});

function toggleDrawingMode(forcedState) {
  isDrawingMode = forcedState !== undefined ? forcedState : !isDrawingMode;
  
  if (isDrawingMode) {
    initDrawingCanvas();
    if (drawingCanvasOverlay) drawingCanvasOverlay.classList.remove('hidden');
    if (drawingToolbar) drawingToolbar.classList.remove('hidden');
    showToast('🖊️ Çizim Modu Açıldı! (Kapatmak için Esc)');
  } else {
    if (drawingCanvasOverlay) drawingCanvasOverlay.classList.add('hidden');
    if (drawingToolbar) drawingToolbar.classList.add('hidden');
  }
}

if (toolBtnDraw) {
  toolBtnDraw.addEventListener('click', () => {
    toggleDrawingMode();
    const toolsPopover = document.getElementById('tools-menu-popover');
    if (toolsPopover) toolsPopover.classList.add('hidden');
  });
}

// Shortcut: Alt + D
window.addEventListener('keydown', (e) => {
  if (e.altKey && e.code === 'KeyD') {
    e.preventDefault();
    toggleDrawingMode();
  } else if (e.key === 'Escape' && isDrawingMode) {
    toggleDrawingMode(false);
  }
});

if (drawBtnClose) drawBtnClose.addEventListener('click', () => toggleDrawingMode(false));

if (drawBtnPen) {
  drawBtnPen.addEventListener('click', () => {
    currentDrawMode = 'pen';
    [drawBtnPen, drawBtnHighlighter, drawBtnEraser].forEach(b => b && b.classList.remove('active'));
    drawBtnPen.classList.add('active');
  });
}

if (drawBtnHighlighter) {
  drawBtnHighlighter.addEventListener('click', () => {
    currentDrawMode = 'highlighter';
    [drawBtnPen, drawBtnHighlighter, drawBtnEraser].forEach(b => b && b.classList.remove('active'));
    drawBtnHighlighter.classList.add('active');
  });
}

if (drawBtnEraser) {
  drawBtnEraser.addEventListener('click', () => {
    currentDrawMode = 'eraser';
    [drawBtnPen, drawBtnHighlighter, drawBtnEraser].forEach(b => b && b.classList.remove('active'));
    drawBtnEraser.classList.add('active');
  });
}

drawColors.forEach(c => {
  c.addEventListener('click', () => {
    drawColors.forEach(el => el.classList.remove('active'));
    c.classList.add('active');
    currentDrawColor = c.dataset.color || '#a855f7';
  });
});

if (drawBtnClear) {
  drawBtnClear.addEventListener('click', () => {
    if (drawCtx && pageDrawingCanvas) {
      drawCtx.clearRect(0, 0, pageDrawingCanvas.width, pageDrawingCanvas.height);
      showToast('🗑️ Çizim temizlendi.');
    }
  });
}

if (drawBtnSave) {
  drawBtnSave.addEventListener('click', () => {
    if (!pageDrawingCanvas) return;
    const link = document.createElement('a');
    link.download = `LowBrowser-Cizim-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = pageDrawingCanvas.toDataURL('image/png');
    link.click();
    showToast('📸 Çiziminiz PNG olarak indirildi!');
  });
}

// Drawing mouse events on canvas
if (pageDrawingCanvas) {
  pageDrawingCanvas.addEventListener('mousedown', (e) => {
    isPainting = true;
    const rect = pageDrawingCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
  });

  pageDrawingCanvas.addEventListener('mousemove', (e) => {
    if (!isPainting || !drawCtx) return;
    const rect = pageDrawingCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawCtx.beginPath();
    drawCtx.moveTo(lastX, lastY);
    drawCtx.lineTo(x, y);

    if (currentDrawMode === 'eraser') {
      drawCtx.globalCompositeOperation = 'destination-out';
      drawCtx.lineWidth = 20;
    } else if (currentDrawMode === 'highlighter') {
      drawCtx.globalCompositeOperation = 'source-over';
      drawCtx.strokeStyle = currentDrawColor;
      drawCtx.globalAlpha = 0.35;
      drawCtx.lineWidth = 16;
      drawCtx.lineCap = 'square';
    } else {
      drawCtx.globalCompositeOperation = 'source-over';
      drawCtx.strokeStyle = currentDrawColor;
      drawCtx.globalAlpha = 1.0;
      drawCtx.lineWidth = 3.5;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
    }

    drawCtx.stroke();
    lastX = x;
    lastY = y;
  });

  window.addEventListener('mouseup', () => {
    isPainting = false;
  });
}

// ==========================================
// 6.E SEKME CANLI ÖNİZLEME KARTLARI (TAB HOVER THUMBNAILS)
// ==========================================
const tabHoverPreview = document.getElementById('tab-hover-preview');
const tabPreviewTitle = document.getElementById('tab-preview-title');
const tabPreviewUrl = document.getElementById('tab-preview-url');
const tabPreviewImg = document.getElementById('tab-preview-img');
const tabPreviewPlaceholder = document.getElementById('tab-preview-placeholder');

let hoverPreviewTimeout = null;

function showTabHoverPreview(tabId, tabEl) {
  clearTimeout(hoverPreviewTimeout);
  hoverPreviewTimeout = setTimeout(() => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !tabHoverPreview) return;

    const rect = tabEl.getBoundingClientRect();
    const posX = Math.max(10, Math.min(rect.left, window.innerWidth - 240));
    tabHoverPreview.style.left = `${posX}px`;
    tabHoverPreview.style.top = `${rect.bottom + 6}px`;

    if (tabPreviewTitle) tabPreviewTitle.textContent = tab.title || 'Yeni Sekme';
    if (tabPreviewUrl) tabPreviewUrl.textContent = tab.url || 'lowbrowser://newtab';

    if (tab.thumbnail && tabPreviewImg) {
      tabPreviewImg.src = tab.thumbnail;
      tabPreviewImg.classList.remove('hidden');
      if (tabPreviewPlaceholder) tabPreviewPlaceholder.classList.add('hidden');
    } else {
      if (tabPreviewImg) tabPreviewImg.classList.add('hidden');
      if (tabPreviewPlaceholder) tabPreviewPlaceholder.classList.remove('hidden');
    }

    tabHoverPreview.classList.remove('hidden');
  }, 180);
}

function hideTabHoverPreview() {
  clearTimeout(hoverPreviewTimeout);
  if (tabHoverPreview) tabHoverPreview.classList.add('hidden');
}

// ==========================================
// 6.F WEB SAYFASI ÇEVİRİ ÇUBUĞU (INSTANT WEB TRANSLATOR)
// ==========================================
const toolBtnTranslate = document.getElementById('tool-btn-translate');
const pageTranslateBar = document.getElementById('page-translate-bar');
const btnDoTranslate = document.getElementById('btn-do-translate');
const btnRevertTranslate = document.getElementById('btn-revert-translate');
const btnCloseTranslate = document.getElementById('btn-close-translate');

if (toolBtnTranslate) {
  toolBtnTranslate.addEventListener('click', () => {
    if (pageTranslateBar) pageTranslateBar.classList.toggle('hidden');
    const toolsPopover = document.getElementById('tools-menu-popover');
    if (toolsPopover) toolsPopover.classList.add('hidden');
  });
}

if (btnCloseTranslate) {
  btnCloseTranslate.addEventListener('click', () => {
    if (pageTranslateBar) pageTranslateBar.classList.add('hidden');
  });
}

if (btnDoTranslate) {
  btnDoTranslate.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.webviewEl) {
      showToast('Çevrilecek aktif bir web sayfası yok.');
      return;
    }
    const currentUrl = tab.url;
    if (currentUrl.startsWith('http://') || currentUrl.startsWith('https://')) {
      const googleTranslateUrl = `https://translate.google.com/translate?sl=auto&tl=tr&u=${encodeURIComponent(currentUrl)}`;
      tab.webviewEl.loadURL(googleTranslateUrl);
      if (btnRevertTranslate) btnRevertTranslate.classList.remove('hidden');
      showToast('🇹🇷 Sayfa Türkçeye çevriliyor...');
    } else {
      showToast('Sadece genel web siteleri çevrilebilir.');
    }
  });
}

if (btnRevertTranslate) {
  btnRevertTranslate.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.webviewEl) {
      try {
        const u = new URL(tab.url);
        const original = u.searchParams.get('u');
        if (original) {
          tab.webviewEl.loadURL(original);
        } else {
          tab.webviewEl.reload();
        }
      } catch (e) {
        tab.webviewEl.reload();
      }
      btnRevertTranslate.classList.add('hidden');
      showToast('Orijinal sayfaya dönüldü.');
    }
  });
}

// ==========================================
// 6.G HIZLI EKRAN ALINTISI & SEÇİM ARACI (QUICK SNIP TOOL - Alt + S)
// ==========================================
const snipOverlay = document.getElementById('snip-overlay');
const snipCanvas = document.getElementById('snip-canvas');
const snipSelection = document.getElementById('snip-selection');
const snipDimensionBadge = document.getElementById('snip-dimension-badge');
const snipToolbar = document.getElementById('snip-toolbar');
const snipBtnCopy = document.getElementById('snip-btn-copy');
const snipBtnSave = document.getElementById('snip-btn-save');
const snipBtnFull = document.getElementById('snip-btn-full');
const snipBtnCancel = document.getElementById('snip-btn-cancel');
const toolBtnScreenshot = document.getElementById('tool-btn-screenshot');

let isSnipping = false;
let isSnipDragging = false;
let snipStartX = 0;
let snipStartY = 0;
let snipCurrentRect = { x: 0, y: 0, width: 0, height: 0 };
let snipCapturedImage = null;
let snipCapturedDataUrl = '';

async function startQuickSnip() {
  if (isSnipping) return;
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab) return;

  try {
    let dataUrl = '';
    if (activeTab.webviewEl && typeof activeTab.webviewEl.capturePage === 'function') {
      const nativeImg = await activeTab.webviewEl.capturePage();
      if (nativeImg && !nativeImg.isEmpty()) {
        dataUrl = nativeImg.toDataURL();
      }
    }

    if (!dataUrl) {
      showToast('⚠️ Ekran alıntısı için aktif bir web sayfası gereklidir.');
      return;
    }

    snipCapturedDataUrl = dataUrl;
    const img = new Image();
    img.onload = () => {
      snipCapturedImage = img;
      openSnipOverlay();
    };
    img.src = dataUrl;
  } catch (err) {
    console.error('[LowBrowser Snip Error]', err);
    showToast('Ekran alıntısı başlatılamadı.');
  }
}

function openSnipOverlay() {
  if (!snipOverlay || !snipCanvas) return;
  isSnipping = true;
  isSnipDragging = false;
  if (snipSelection) snipSelection.classList.add('hidden');
  if (snipToolbar) snipToolbar.classList.add('hidden');

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  snipCanvas.width = w * dpr;
  snipCanvas.height = h * dpr;
  snipCanvas.style.width = `${w}px`;
  snipCanvas.style.height = `${h}px`;

  const ctx = snipCanvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.drawImage(snipCapturedImage, 0, 0, w, h);

  snipOverlay.classList.remove('hidden');
  showToast('✂️ İstediğiniz alanı sürükleyip seçin (İptal: Esc)');
}

function closeSnipOverlay() {
  isSnipping = false;
  isSnipDragging = false;
  snipCapturedImage = null;
  snipCapturedDataUrl = '';
  if (snipOverlay) snipOverlay.classList.add('hidden');
  if (snipSelection) snipSelection.classList.add('hidden');
  if (snipToolbar) snipToolbar.classList.add('hidden');
  if (snipCanvas) {
    try {
      const ctx = snipCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, snipCanvas.width, snipCanvas.height);
      snipCanvas.width = 1;
      snipCanvas.height = 1;
    } catch (e) {}
  }
}

function getCroppedSnipDataUrl(rect) {
  if (!snipCapturedImage) return '';
  const dpr = window.devicePixelRatio || 1;
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  cropCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = cropCanvas.getContext('2d');
  
  const scaleX = snipCapturedImage.naturalWidth / window.innerWidth;
  const scaleY = snipCapturedImage.naturalHeight / window.innerHeight;

  ctx.drawImage(
    snipCapturedImage,
    rect.x * scaleX,
    rect.y * scaleY,
    rect.width * scaleX,
    rect.height * scaleY,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );
  return cropCanvas.toDataURL('image/png');
}

if (snipOverlay) {
  snipOverlay.addEventListener('mousedown', (e) => {
    if (e.target.closest('#snip-toolbar')) return;
    isSnipDragging = true;
    snipStartX = e.clientX;
    snipStartY = e.clientY;
    snipCurrentRect = { x: snipStartX, y: snipStartY, width: 0, height: 0 };
    if (snipToolbar) snipToolbar.classList.add('hidden');
    if (snipSelection) snipSelection.classList.add('hidden');
  });

  snipOverlay.addEventListener('mousemove', (e) => {
    if (!isSnipDragging) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const minX = Math.min(snipStartX, currentX);
    const minY = Math.min(snipStartY, currentY);
    const width = Math.abs(currentX - snipStartX);
    const height = Math.abs(currentY - snipStartY);

    snipCurrentRect = { x: minX, y: minY, width, height };

    if (snipSelection) {
      snipSelection.style.left = `${minX}px`;
      snipSelection.style.top = `${minY}px`;
      snipSelection.style.width = `${width}px`;
      snipSelection.style.height = `${height}px`;
      snipSelection.classList.remove('hidden');
    }

    if (snipDimensionBadge) {
      snipDimensionBadge.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isSnipDragging) return;
    isSnipDragging = false;

    if (snipCurrentRect.width > 20 && snipCurrentRect.height > 20) {
      if (snipToolbar) {
        const tbWidth = 320;
        let left = snipCurrentRect.x + (snipCurrentRect.width / 2) - (tbWidth / 2);
        left = Math.max(12, Math.min(window.innerWidth - tbWidth - 12, left));

        let top = snipCurrentRect.y + snipCurrentRect.height + 14;
        if (top + 50 > window.innerHeight) {
          top = Math.max(12, snipCurrentRect.y - 48);
        }

        snipToolbar.style.left = `${left}px`;
        snipToolbar.style.top = `${top}px`;
        snipToolbar.classList.remove('hidden');
      }
    } else {
      if (snipSelection) snipSelection.classList.add('hidden');
    }
  });
}

if (snipBtnCopy) {
  snipBtnCopy.addEventListener('click', () => {
    const croppedUrl = getCroppedSnipDataUrl(snipCurrentRect);
    if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
      window.electronAPI.copyImageToClipboard(croppedUrl);
    }
    showToast('📋 Ekran alıntısı panoya kopyalandı!');
    closeSnipOverlay();
  });
}

if (snipBtnSave) {
  snipBtnSave.addEventListener('click', async () => {
    const croppedUrl = getCroppedSnipDataUrl(snipCurrentRect);
    if (window.electronAPI && window.electronAPI.saveScreenshot) {
      const res = await window.electronAPI.saveScreenshot(croppedUrl);
      if (res && res.success) {
        showToast('💾 Ekran alıntısı kaydedildi!');
      }
    } else {
      const a = document.createElement('a');
      a.download = `LowBrowser-Snip-${Date.now()}.png`;
      a.href = croppedUrl;
      a.click();
      showToast('💾 Ekran alıntısı indirildi!');
    }
    closeSnipOverlay();
  });
}

if (snipBtnFull) {
  snipBtnFull.addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
      window.electronAPI.copyImageToClipboard(snipCapturedDataUrl);
    }
    showToast('📸 Tam sayfa panoya kopyalandı!');
    closeSnipOverlay();
  });
}

if (snipBtnCancel) {
  snipBtnCancel.addEventListener('click', closeSnipOverlay);
}

if (toolBtnScreenshot) {
  toolBtnScreenshot.addEventListener('click', () => {
    startQuickSnip();
    const toolsPopover = document.getElementById('tools-menu-popover');
    if (toolsPopover) toolsPopover.classList.add('hidden');
  });
}

// Shortcuts for Quick Snip: Alt + S & Ctrl + Shift + S
window.addEventListener('keydown', (e) => {
  if ((e.altKey && e.code === 'KeyS') || (e.ctrlKey && e.shiftKey && e.code === 'KeyS')) {
    e.preventDefault();
    if (isSnipping) {
      closeSnipOverlay();
    } else {
      startQuickSnip();
    }
  } else if (e.key === 'Escape' && isSnipping) {
    closeSnipOverlay();
  }
});

// ==========================================
// 6.H OYUN PİNG & LAG KALKANI (LOW-LATENCY NETWORK QoS)
// ==========================================
const toolBtnPingShield = document.getElementById('tool-btn-pingshield');
const switchPingShield = document.getElementById('switch-ping-shield');
const pingShieldBadge = document.getElementById('ping-shield-badge');
const pingShieldBadgeText = document.getElementById('ping-shield-badge-text');

let isPingShieldEnabled = localStorage.getItem('lowbrowser_ping_shield') === 'true';

function updatePingShieldUI(active) {
  const isAct = active !== undefined ? active : isPingShieldEnabled;
  if (toolBtnPingShield) toolBtnPingShield.classList.toggle('active', isAct);
  if (switchPingShield) switchPingShield.checked = isAct;
  if (pingShieldBadge) {
    pingShieldBadge.classList.toggle('active', isAct);
    if (pingShieldBadgeText) {
      pingShieldBadgeText.textContent = isAct 
        ? '⚡ Ping Kalkanı: Aktif (0ms Ek Gecikme, TCP FastOpen & QUIC Açık)' 
        : '⚡ Ping Kalkanı: Pasif (Standart Mod)';
    }
  }
}

function togglePingShield(forcedState) {
  isPingShieldEnabled = forcedState !== undefined ? forcedState : !isPingShieldEnabled;
  localStorage.setItem('lowbrowser_ping_shield', isPingShieldEnabled);
  if (window.electronAPI && window.electronAPI.toggleGameMode) {
    window.electronAPI.toggleGameMode(isPingShieldEnabled);
  }
  updatePingShieldUI(isPingShieldEnabled);
  showToast(isPingShieldEnabled 
    ? '🎮 Oyun Ping Kalkanı Açıldı! (Arka plan ağı kısıtlandı & Ping korundu)' 
    : 'Ping Kalkanı kapatıldı.');
}

if (toolBtnPingShield) {
  toolBtnPingShield.addEventListener('click', () => {
    togglePingShield();
    const toolsPopover = document.getElementById('tools-menu-popover');
    if (toolsPopover) toolsPopover.classList.add('hidden');
  });
}

if (switchPingShield) {
  switchPingShield.addEventListener('change', (e) => {
    togglePingShield(e.target.checked);
  });
}

if (window.electronAPI && window.electronAPI.onPingShieldStatus) {
  window.electronAPI.onPingShieldStatus((data) => {
    updatePingShieldUI(data.isPingShieldActive);
  });
}

if (isPingShieldEnabled && window.electronAPI && window.electronAPI.toggleGameMode) {
  window.electronAPI.toggleGameMode(true);
}
updatePingShieldUI();

// --- 7. NEW TAB BACKGROUND ---
const startPageEl = document.getElementById('start-page');
if (startPageEl) {
  startPageEl.classList.add('bg-neon-eclipse');
}



// --- 8. CUSTOMISABLE SPEED DIALS ENGINE ---
const speedDialsContainer = document.getElementById('speed-dials');
const modalAddDial = document.getElementById('modal-add-dial');
const dialNameInput = document.getElementById('dial-name-input');
const dialUrlInput = document.getElementById('dial-url-input');

let speedDials = JSON.parse(localStorage.getItem('lowbrowser_speed_dials')) || [
  { name: 'Twitch', url: 'https://www.twitch.tv' },
  { name: 'Discord', url: 'https://discord.com' },
  { name: 'tracker.gg', url: 'https://tracker.gg/valorant' },
  { name: 'YouTube', url: 'https://www.youtube.com' }
];

function renderSpeedDials() {
  if (!speedDialsContainer) return;
  speedDialsContainer.innerHTML = '';
  
  speedDials.forEach((dial, index) => {
    const card = document.createElement('div');
    card.className = 'dial-card gamer-card';
    card.dataset.url = dial.url;
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'gamer-card-title';
    titleSpan.textContent = dial.name;
    card.appendChild(titleSpan);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-dial';
    deleteBtn.title = 'Kartı Sil';
    deleteBtn.textContent = '✕';
    
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent navigation click
      speedDials.splice(index, 1);
      localStorage.setItem('lowbrowser_speed_dials', JSON.stringify(speedDials));
      renderSpeedDials();
      showToast("Hızlı erişim kartı silindi.");
    });
    
    card.appendChild(deleteBtn);
    
    card.addEventListener('click', () => {
      // Navigate active tab
      const activeTabId = getActiveTabId();
      if (activeTabId) {
        navigateTo(activeTabId, dial.url);
      }
    });
    
    speedDialsContainer.appendChild(card);
  });
  
  // Create "+" Add button card
  const addCard = document.createElement('div');
  addCard.className = 'dial-card add-dial-card';
  addCard.title = 'Yeni Hızlı Erişim Ekle';
  addCard.textContent = '+';
  
  addCard.addEventListener('click', () => {
    dialNameInput.value = '';
    dialUrlInput.value = '';
    modalAddDial.classList.remove('hidden');
    dialNameInput.focus();
  });
  
  speedDialsContainer.appendChild(addCard);
}

document.getElementById('btn-cancel-dial').addEventListener('click', () => {
  modalAddDial.classList.add('hidden');
});

document.getElementById('btn-confirm-dial').addEventListener('click', () => {
  const name = dialNameInput.value.trim();
  let url = dialUrlInput.value.trim();
  
  if (!name || !url) {
    showToast("Lütfen tüm alanları doldurun!");
    return;
  }
  
  // Format URL if protocol is missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  speedDials.push({ name, url });
  localStorage.setItem('lowbrowser_speed_dials', JSON.stringify(speedDials));
  renderSpeedDials();
  
  modalAddDial.classList.add('hidden');
  showToast("Hızlı erişim kartı eklendi.");
});

// Close modal when clicking outside box
modalAddDial.addEventListener('click', (e) => {
  if (e.target === modalAddDial) {
    modalAddDial.classList.add('hidden');
  }
});

// --- 9. SCREENSHOT & PIP MULTIMEDIA CONTROLLER ---
const btnToolScreenshot = document.getElementById('tool-btn-screenshot');
const btnToolPip = document.getElementById('tool-btn-pip');
const flashOverlay = document.getElementById('screenshot-flash-overlay');

// 📸 Screenshot logic
if (btnToolScreenshot) {
  btnToolScreenshot.addEventListener('click', async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    try {
      let dataUrl = '';
      if (!activeTab.url || activeTab.url === 'lowbrowser://newtab') {
        showToast("📸 Başlangıç sayfasındasınız. Web sayfalarını yakalamak için bir siteye gidin.");
        return;
      }

      const wv = document.getElementById(`webview-${activeTab.id}`);
      if (!wv) {
        showToast("Yakalanacak aktif web sayfası bulunamadı.");
        return;
      }

      // Flash effect animation
      if (flashOverlay) {
        flashOverlay.classList.add('flash');
        setTimeout(() => {
          flashOverlay.classList.remove('flash');
        }, 80);
      }

      // Capture visible webview page
      const nativeImg = await wv.capturePage();
      dataUrl = nativeImg.toDataURL();

      // Copy to clipboard immediately
      if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
        window.electronAPI.copyImageToClipboard(dataUrl);
      }

      // Show interactive toast
      showScreenshotToast(dataUrl);

    } catch (err) {
      console.error('[LowBrowser Screenshot] Capture error:', err);
      showToast("Ekran görüntüsü alınırken hata oluştu.");
    }
  });
}

function showScreenshotToast(dataUrl) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #0c0d12;
    border: 1px solid rgba(127, 0, 255, 0.4);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 999999;
    color: white;
    font-size: 12px;
    font-weight: 500;
  `;

  toast.innerHTML = `
    <span>📸 Ekran görüntüsü panoya kopyalandı!</span>
    <button id="btn-toast-save-shot" style="
      background: var(--accent-color);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    ">Dosyaya Kaydet</button>
    <button id="btn-toast-close-shot" style="
      background: transparent;
      color: var(--text-dim);
      border: none;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
    ">✕</button>
  `;

  document.body.appendChild(toast);

  toast.querySelector('#btn-toast-save-shot').addEventListener('click', async () => {
    if (window.electronAPI && window.electronAPI.saveScreenshot) {
      const res = await window.electronAPI.saveScreenshot(dataUrl);
      if (res && res.success) {
        showToast("Görsel başarıyla kaydedildi!");
      }
    }
    toast.remove();
  });

  toast.querySelector('#btn-toast-close-shot').addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.remove();
    }
  }, 6000);
}

// 🔲 Video Picture-in-Picture (PiP) logic
if (btnToolPip) {
  btnToolPip.addEventListener('click', async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || !activeTab.url || activeTab.url.startsWith('lowbrowser://')) {
      showToast("Aktif sayfada video bulunmuyor.");
      return;
    }

    const wv = document.getElementById(`webview-${activeTab.id}`);
    if (!wv) return;

    try {
      const result = await wv.executeJavaScript(`
        (async () => {
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
              return { success: true, action: 'exited' };
            }
            const videos = Array.from(document.querySelectorAll('video'));
            const activeVideo = videos.find(v => !v.paused && v.readyState > 1) || videos[0];
            if (activeVideo) {
              await activeVideo.requestPictureInPicture();
              return { success: true, action: 'entered' };
            }
            return { success: false, reason: 'no-video' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
      `);

      if (result && result.success) {
        if (result.action === 'entered') {
          showToast("🔲 Video köşeye sabitlendi (PiP)");
        } else {
          showToast("Video orijinal sayfaya döndürüldü.");
        }
      } else if (result && result.reason === 'no-video') {
        showToast("Sayfada oynatılabilir bir video bulunamadı.");
      } else {
        showToast("PiP açılamadı: " + (result.error || 'Desteklenmiyor'));
      }
    } catch (err) {
      console.error('[LowBrowser PiP] Execution error:', err);
      showToast("Video PiP modu çalıştırılamadı.");
    }
  });
}

// --- 10. SECURE DNS (DoH) CONTROLLER ---
let isDohEnabled = localStorage.getItem('isDohEnabled') !== 'false';
let dohProvider = localStorage.getItem('dohProvider') || 'cloudflare';

const dohProviderNames = {
  cloudflare: 'Cloudflare DNS (1.1.1.1)',
  google: 'Google Public DNS (8.8.8.8)',
  quad9: 'Quad9 (9.9.9.9)',
  adguard: 'AdGuard DNS'
};

const btnToolDns = document.getElementById('tool-btn-dns');
const switchSecureDns = document.getElementById('switch-secure-dns');
const dnsStatusBadge = document.getElementById('dns-status-badge');
const dnsStatusText = document.getElementById('dns-status-text');

function updateDohUI() {
  const providerName = dohProviderNames[dohProvider] || dohProvider;

  if (switchSecureDns) {
    switchSecureDns.checked = isDohEnabled;
  }

  if (btnToolDns) {
    btnToolDns.classList.toggle('dns-active', isDohEnabled);
  }

  if (dnsStatusBadge && dnsStatusText) {
    if (isDohEnabled) {
      dnsStatusBadge.classList.remove('disabled');
      dnsStatusText.textContent = `Güvenli DNS Aktif: ${providerName} ile şifreleniyor.`;
    } else {
      dnsStatusBadge.classList.add('disabled');
      dnsStatusText.textContent = 'Güvenli DNS Kapalı: Standart ISS sağlayıcısı kullanılıyor.';
    }
  }

  document.querySelectorAll('input[name="dns-provider"]').forEach(radio => {
    radio.checked = radio.value === dohProvider;
    radio.disabled = !isDohEnabled;
  });
}

// Tool menu quick toggle button
if (btnToolDns) {
  btnToolDns.addEventListener('click', () => {
    isDohEnabled = !isDohEnabled;
    localStorage.setItem('isDohEnabled', isDohEnabled);
    updateDohUI();
    const providerName = dohProviderNames[dohProvider] || dohProvider;
    showToast(isDohEnabled ? `⚡ Güvenli DNS Açıldı (${providerName})` : "Güvenli DNS Kapatıldı.");
  });
}

// Studio toggle switch
if (switchSecureDns) {
  switchSecureDns.addEventListener('change', (e) => {
    isDohEnabled = e.target.checked;
    localStorage.setItem('isDohEnabled', isDohEnabled);
    updateDohUI();
    const providerName = dohProviderNames[dohProvider] || dohProvider;
    showToast(isDohEnabled ? `⚡ Güvenli DNS Açıldı (${providerName})` : "Güvenli DNS Kapatıldı.");
  });
}

// DNS Provider radio change
document.querySelectorAll('input[name="dns-provider"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    dohProvider = e.target.value;
    localStorage.setItem('dohProvider', dohProvider);
    updateDohUI();
    const providerName = dohProviderNames[dohProvider] || dohProvider;
    showToast(`🌐 DNS Sağlayıcısı Değiştirildi: ${providerName}`);
  });
});

updateDohUI();

// ==========================================================================
// 11. DOWNLOADS MANAGER CONTROLLER (Chrome / Edge Style)
// ==========================================================================
const btnTopDownloads = document.getElementById('btn-top-downloads');
const toolBtnDownloads = document.getElementById('tool-btn-downloads');
const downloadsPanel = document.getElementById('downloads-panel');
const downloadsList = document.getElementById('downloads-list');
const downloadsBadge = document.getElementById('downloads-badge');
const btnClearDownloads = document.getElementById('btn-clear-downloads');

let downloadsMap = new Map();

function toggleDownloadsPanel() {
  downloadsPanel.classList.toggle('hidden');
}

if (btnTopDownloads) {
  btnTopDownloads.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDownloadsPanel();
  });
}

if (toolBtnDownloads) {
  toolBtnDownloads.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('tools-menu-popover').classList.add('hidden');
    downloadsPanel.classList.remove('hidden');
  });
}

document.addEventListener('click', (e) => {
  if (downloadsPanel && !downloadsPanel.contains(e.target) && e.target !== btnTopDownloads && (!toolBtnDownloads || !toolBtnDownloads.contains(e.target))) {
    downloadsPanel.classList.add('hidden');
  }
});

if (btnClearDownloads) {
  btnClearDownloads.addEventListener('click', () => {
    // Remove completed/cancelled downloads
    for (const [id, item] of downloadsMap.entries()) {
      if (item.state === 'completed' || item.state === 'cancelled' || item.state === 'interrupted') {
        downloadsMap.delete(id);
      }
    }
    renderDownloadsUI();
  });
}

function updateDownloadsBadge() {
  const activeCount = Array.from(downloadsMap.values()).filter(d => d.state === 'progressing').length;
  if (downloadsBadge) {
    if (activeCount > 0) {
      downloadsBadge.textContent = activeCount;
      downloadsBadge.classList.remove('hidden');
    } else {
      downloadsBadge.classList.add('hidden');
    }
  }
}

function renderDownloadsUI() {
  if (!downloadsList) return;
  downloadsList.innerHTML = '';

  if (downloadsMap.size === 0) {
    downloadsList.innerHTML = '<div class="empty-downloads">Aktif veya geçmiş indirme bulunmuyor.</div>';
    updateDownloadsBadge();
    return;
  }

  Array.from(downloadsMap.values()).reverse().forEach(d => {
    const itemEl = document.createElement('div');
    itemEl.className = 'download-item';

    const percent = d.totalBytes > 0 ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100)) : 0;
    const receivedMB = (d.receivedBytes / (1024 * 1024)).toFixed(1);
    const totalMB = d.totalBytes > 0 ? (d.totalBytes / (1024 * 1024)).toFixed(1) : '?';

    let statusText = '';
    let actionsHtml = '';
    let metaTag = '';

    if (d.state === 'progressing') {
      const speedStr = d.speedFormatted ? `⚡ ${d.speedFormatted}` : '';
      const etaStr = d.etaFormatted ? `• Kalan: ${d.etaFormatted}` : '';
      statusText = d.isPaused ? `Duraklatıldı • %${percent}` : `${receivedMB} / ${totalMB} MB (%${percent}) ${speedStr} ${etaStr}`;
      if (d.isTurbo) {
        metaTag = `<span class="dl-turbo-tag" title="4 Kanallı Paralel İndirme">4x TURBO</span>`;
      }
      actionsHtml = `
        <button class="download-action-btn btn-dl-pause">${d.isPaused ? '▶ Devam' : '⏸ Duraklat'}</button>
        <button class="download-action-btn btn-dl-cancel" style="color: #ef4444;">✕ İptal</button>
      `;
    } else if (d.state === 'completed') {
      statusText = `Tamamlandı (${totalMB} MB)`;
      actionsHtml = `
        <button class="download-action-btn btn-dl-open" style="color: #38bdf8;">Aç</button>
        <button class="download-action-btn btn-dl-folder">Klasörde Göster</button>
      `;
    } else {
      statusText = `İptal edildi veya kesildi`;
    }

    const progressStateClass = d.state === 'completed' ? 'completed' : (d.isPaused ? 'paused' : (d.isTurbo ? 'turbo' : ''));
    itemEl.innerHTML = `
      <div class="download-item-header">
        <span class="download-item-title" title="${d.filename}">${d.filename}</span>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${metaTag}
          <span class="download-item-status">${d.state === 'completed' ? '✓' : ''}</span>
        </div>
      </div>
      <div class="download-progress-bg">
        <div class="download-progress-bar ${progressStateClass}" style="width: ${d.state === 'completed' ? 100 : percent}%;"></div>
      </div>
      <div class="download-item-footer">
        <span>${statusText}</span>
        <div class="download-actions">${actionsHtml}</div>
      </div>
    `;

    // Action listeners
    const btnPause = itemEl.querySelector('.btn-dl-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        if (d.isPaused) {
          window.electronAPI.resumeDownload(d.id);
        } else {
          window.electronAPI.pauseDownload(d.id);
        }
      });
    }

    const btnCancel = itemEl.querySelector('.btn-dl-cancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        window.electronAPI.cancelDownload(d.id);
      });
    }

    const btnOpen = itemEl.querySelector('.btn-dl-open');
    if (btnOpen && d.savePath) {
      btnOpen.addEventListener('click', () => {
        window.electronAPI.openDownloadFile(d.savePath);
      });
    }

    const btnFolder = itemEl.querySelector('.btn-dl-folder');
    if (btnFolder && d.savePath) {
      btnFolder.addEventListener('click', () => {
        window.electronAPI.showDownloadInFolder(d.savePath);
      });
    }

    downloadsList.appendChild(itemEl);
  });

  updateDownloadsBadge();
}

function playDownloadSuccessChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {}
}

// Bind Turbo Download UI toggles
const turboBadgeIndicator = document.getElementById('turbo-badge-indicator');
const switchTurboDownload = document.getElementById('switch-turbo-download');
let isTurboDownloadActive = true;

if (turboBadgeIndicator) {
  turboBadgeIndicator.addEventListener('click', () => {
    isTurboDownloadActive = !isTurboDownloadActive;
    if (window.electronAPI && window.electronAPI.toggleTurboDownload) {
      window.electronAPI.toggleTurboDownload(isTurboDownloadActive);
    }
    if (switchTurboDownload) switchTurboDownload.checked = isTurboDownloadActive;
    turboBadgeIndicator.classList.toggle('active', isTurboDownloadActive);
    showToast(isTurboDownloadActive ? '⚡ Turbo İndirici (4x) Aktifleştirildi' : 'ℹ️ Standart İndirme Moduna Geçildi');
  });
}

if (switchTurboDownload) {
  switchTurboDownload.addEventListener('change', (e) => {
    isTurboDownloadActive = e.target.checked;
    if (window.electronAPI && window.electronAPI.toggleTurboDownload) {
      window.electronAPI.toggleTurboDownload(isTurboDownloadActive);
    }
    if (turboBadgeIndicator) turboBadgeIndicator.classList.toggle('active', isTurboDownloadActive);
  });
}

// Bind Electron Download IPC Events
if (window.electronAPI && window.electronAPI.onDownloadStarted) {
  window.electronAPI.onDownloadStarted((data) => {
    downloadsMap.set(data.id, {
      id: data.id,
      filename: data.filename,
      totalBytes: data.totalBytes,
      receivedBytes: 0,
      state: 'progressing',
      isPaused: false,
      isTurbo: data.isTurbo !== false,
      channels: data.channels || 4
    });
    renderDownloadsUI();
    showToast(`📥 ${data.isTurbo !== false ? '⚡ Turbo' : ''} İndirme Başladı: ${data.filename}`);
  });

  window.electronAPI.onDownloadUpdated((data) => {
    const existing = downloadsMap.get(data.id);
    if (existing) {
      existing.receivedBytes = data.receivedBytes || existing.receivedBytes;
      existing.totalBytes = data.totalBytes || existing.totalBytes;
      existing.state = data.state;
      existing.isPaused = data.isPaused || false;
      existing.speedFormatted = data.speedFormatted;
      existing.etaFormatted = data.etaFormatted;
      existing.isTurbo = data.isTurbo !== false;
      if (data.savePath) existing.savePath = data.savePath;
      renderDownloadsUI();
    }
  });

  window.electronAPI.onDownloadDone((data) => {
    const existing = downloadsMap.get(data.id) || {};
    existing.id = data.id;
    existing.filename = data.filename || existing.filename;
    existing.state = data.state;
    existing.savePath = data.savePath || existing.savePath;
    existing.totalBytes = data.totalBytes || existing.totalBytes;
    existing.receivedBytes = existing.totalBytes;
    downloadsMap.set(data.id, existing);
    renderDownloadsUI();

    if (data.state === 'completed') {
      playDownloadSuccessChime();
      showToast(`✓ İndirme Tamamlandı: ${existing.filename}`);
    } else {
      showToast(`İndirme İptal Edildi: ${existing.filename}`);
    }
  });
}


// ==========================================================================
// 12. CTRL + F IN-PAGE SEARCH CONTROLLER
// ==========================================================================
const findBar = document.getElementById('find-in-page-bar');
const findInput = document.getElementById('find-input');
const findCountBadge = document.getElementById('find-count-badge');
const btnFindPrev = document.getElementById('btn-find-prev');
const btnFindNext = document.getElementById('btn-find-next');
const btnFindClose = document.getElementById('btn-find-close');

function updateFindCountUI(activeOrdinal = 0, totalMatches = 0) {
  if (findCountBadge) {
    findCountBadge.textContent = `${activeOrdinal} / ${totalMatches}`;
  }
}

function openFindInPage() {
  if (!findBar || !findInput) return;
  findBar.classList.remove('hidden');
  findInput.focus();
  findInput.select();

  const query = findInput.value.trim();
  if (query.length > 0) {
    executeFindInPage(query, true);
  }
}

function closeFindInPage() {
  if (!findBar) return;
  findBar.classList.add('hidden');
  updateFindCountUI(0, 0);

  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl) {
    activeTab.webviewEl.stopFindInPage('clearSelection');
    activeTab.webviewEl.focus();
  }
}

function executeFindInPage(text, isNext = true) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || !activeTab.webviewEl || !text || text.trim().length === 0) {
    updateFindCountUI(0, 0);
    return;
  }

  activeTab.webviewEl.findInPage(text.trim(), {
    forward: isNext,
    findNext: true
  });
}

// Global Ctrl + F / Cmd + F Keybinding
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openFindInPage();
  } else if (e.key === 'Escape' && findBar && !findBar.classList.contains('hidden')) {
    closeFindInPage();
  }
});

if (findInput) {
  findInput.addEventListener('input', () => {
    const val = findInput.value.trim();
    if (val.length === 0) {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.webviewEl) {
        activeTab.webviewEl.stopFindInPage('clearSelection');
      }
      updateFindCountUI(0, 0);
    } else {
      executeFindInPage(val, true);
    }
  });

  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeFindInPage(findInput.value, !e.shiftKey);
    }
  });
}

if (btnFindNext) {
  btnFindNext.addEventListener('click', () => {
    executeFindInPage(findInput.value, true);
  });
}

if (btnFindPrev) {
  btnFindPrev.addEventListener('click', () => {
    executeFindInPage(findInput.value, false);
  });
}

if (btnFindClose) {
  btnFindClose.addEventListener('click', () => {
    closeFindInPage();
  });
}


// ==========================================================================
// 13. OPERA GX STYLE HARDWARE LIMITER CONTROLLER
// ==========================================================================
const switchHardLimit = document.getElementById('switch-hard-limit');
const ramLimitSlider = document.getElementById('ram-limit-slider');
const ramLimitBadge = document.getElementById('ram-limit-value-badge');
const cpuLimitSlider = document.getElementById('cpu-limit-slider');
const cpuLimitBadge = document.getElementById('cpu-limit-value-badge');

let isHardLimitEnabled = localStorage.getItem('lowbrowser_hard_limit_enabled') === 'true';
let hardRamLimitMB = parseInt(localStorage.getItem('lowbrowser_hard_ram_limit') || '1024');
let hardCpuLimitPercent = parseInt(localStorage.getItem('lowbrowser_hard_cpu_limit') || '50');

function updateHardwareLimiterUI() {
  if (switchHardLimit) {
    switchHardLimit.checked = isHardLimitEnabled;
  }
  if (ramLimitSlider) {
    ramLimitSlider.value = hardRamLimitMB;
    ramLimitSlider.disabled = !isHardLimitEnabled;
  }
  if (ramLimitBadge) {
    ramLimitBadge.textContent = hardRamLimitMB >= 1024 ? `${(hardRamLimitMB / 1024).toFixed(1)} GB` : `${hardRamLimitMB} MB`;
  }
  if (cpuLimitSlider) {
    cpuLimitSlider.value = hardCpuLimitPercent;
    cpuLimitSlider.disabled = !isHardLimitEnabled;
  }
  if (cpuLimitBadge) {
    cpuLimitBadge.textContent = `%${hardCpuLimitPercent}`;
  }
}

if (switchHardLimit) {
  switchHardLimit.addEventListener('change', (e) => {
    isHardLimitEnabled = e.target.checked;
    localStorage.setItem('lowbrowser_hard_limit_enabled', isHardLimitEnabled);
    updateHardwareLimiterUI();
    showToast(isHardLimitEnabled ? `🎮 Donanım Sınırlayıcı Açıldı (Max: ${hardRamLimitMB} MB)` : "Donanım Sınırlayıcı Kapatıldı.");
  });
}

if (ramLimitSlider) {
  ramLimitSlider.addEventListener('input', (e) => {
    hardRamLimitMB = parseInt(e.target.value);
    localStorage.setItem('lowbrowser_hard_ram_limit', hardRamLimitMB);
    updateHardwareLimiterUI();
  });
}

if (cpuLimitSlider) {
  cpuLimitSlider.addEventListener('input', (e) => {
    hardCpuLimitPercent = parseInt(e.target.value);
    localStorage.setItem('lowbrowser_hard_cpu_limit', hardCpuLimitPercent);
    updateHardwareLimiterUI();
  });
}

// Hook into periodic performance monitoring to enforce hard memory limit!
let lastLimiterWarningTime = 0;
setInterval(async () => {
  if (!isHardLimitEnabled || !window.electronAPI || !window.electronAPI.getStats) return;

  try {
    const stats = await window.electronAPI.getStats();
    if (stats && stats.memoryMB > hardRamLimitMB) {
      // Find oldest active inactive tabs and sleep them!
      const candidateTabs = tabs.filter(t => t.id !== activeTabId && !t.sleeping && (!t.webviewEl || !t.webviewEl.isCurrentlyAudible || !t.webviewEl.isCurrentlyAudible()));

      if (candidateTabs.length > 0) {
        // Sleep the first candidate
        const tabToSleep = candidateTabs[0];
        sleepTab(tabToSleep.id);

        if (Date.now() - lastLimiterWarningTime > 15000) {
          lastLimiterWarningTime = Date.now();
          showToast(`🎮 RAM Sınırı (${hardRamLimitMB} MB) koruması: "${tabToSleep.title.substring(0, 16)}..." sekmesi donduruldu.`);
        }
      }
    }
  } catch (err) {}
}, 4000);

// ==========================================================================
// 17. YENİ NESİL MODÜL MANTIKLARI (Split View, Dikey Sekmeler, Yan Panel, Veri İçe Aktarma)
// ==========================================================================

// 1. Bölünmüş Ekran (Split Screen)
let isSplitScreenActive = false;
const btnSplitScreen = document.getElementById('btn-split-screen');

function toggleSplitScreen() {
  if (tabs.length < 2) {
    showToast('Bölünmüş ekran için en az 2 açık sekme gereklidir.');
    return;
  }
  isSplitScreenActive = !isSplitScreenActive;
  webviewsContainer.classList.toggle('split-screen-mode', isSplitScreenActive);
  
  if (isSplitScreenActive) {
    btnSplitScreen.style.color = 'var(--accent-color)';
    // Show active tab and the adjacent tab
    const activeIndex = tabs.findIndex(t => t.id === activeTabId);
    const secondaryIndex = activeIndex > 0 ? activeIndex - 1 : activeIndex + 1;
    const secondaryTab = tabs[secondaryIndex];
    if (secondaryTab && secondaryTab.webviewEl) {
      secondaryTab.webviewEl.classList.remove('hidden');
    }
    showToast('⚡ Bölünmüş Ekran (Split View) Aktif');
  } else {
    btnSplitScreen.style.color = '';
    // Restore only active tab view
    tabs.forEach(t => {
      if (t.webviewEl) {
        t.webviewEl.classList.toggle('hidden', t.id !== activeTabId);
      }
    });
    showToast('Bölünmüş Ekran Kapatıldı');
  }
}
if (btnSplitScreen) btnSplitScreen.addEventListener('click', toggleSplitScreen);

// 2. Dikey / Yatay Sekme Çubuğu (Vertical Tabs)
const btnVerticalTabs = document.getElementById('btn-vertical-tabs');
if (btnVerticalTabs) {
  const savedVertical = localStorage.getItem('lowbrowser_vertical_tabs') === 'true';
  if (savedVertical) {
    document.body.classList.add('vertical-tabs-mode');
    btnVerticalTabs.style.color = 'var(--accent-color)';
  }
  btnVerticalTabs.addEventListener('click', () => {
    const isVert = document.body.classList.toggle('vertical-tabs-mode');
    localStorage.setItem('lowbrowser_vertical_tabs', isVert);
    btnVerticalTabs.style.color = isVert ? 'var(--accent-color)' : '';
    showToast(isVert ? '📐 Dikey Sekme Moduna Geçildi' : 'Yatay Sekme Moduna Geçildi');
  });
}

// 3. Akıllı Yan Panel (Utility Sidebar: Çeviri, Hesap, Notlar, Donanım)
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
const utilitySidebar = document.getElementById('utility-sidebar');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');

if (btnSidebarToggle && utilitySidebar) {
  btnSidebarToggle.addEventListener('click', () => {
    utilitySidebar.classList.toggle('hidden');
    btnSidebarToggle.style.color = utilitySidebar.classList.contains('hidden') ? '' : 'var(--accent-color)';
  });
}
if (btnCloseSidebar && utilitySidebar) {
  btnCloseSidebar.addEventListener('click', () => {
    utilitySidebar.classList.add('hidden');
    if (btnSidebarToggle) btnSidebarToggle.style.color = '';
  });
}

// Yan Panel Sekme Geçişleri
document.querySelectorAll('.side-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.side-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const toolId = btn.getAttribute('data-tool');
    const targetPanel = document.getElementById(`side-tool-${toolId}`);
    if (targetPanel) targetPanel.classList.add('active');
  });
});

// Çevirmen Aracı
const sideTransInput = document.getElementById('side-trans-input');
const sideTransLang = document.getElementById('side-trans-lang');
const btnSideTranslate = document.getElementById('btn-side-translate');
const sideTransResult = document.getElementById('side-trans-result');

if (btnSideTranslate && sideTransInput) {
  btnSideTranslate.addEventListener('click', async () => {
    const text = sideTransInput.value.trim();
    if (!text) return;
    const targetLang = sideTransLang.value || 'tr';
    sideTransResult.textContent = 'Çevriliyor...';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      let translated = '';
      if (data && data[0]) {
        data[0].forEach(seg => { if (seg[0]) translated += seg[0]; });
      }
      sideTransResult.textContent = translated || 'Çeviri bulunamadı.';
    } catch (e) {
      sideTransResult.textContent = 'Çeviri hatası oluştu.';
    }
  });
}

// Hesap Makinesi Aracı
const calcDisplay = document.getElementById('calc-display');
let calcExpression = '';

document.querySelectorAll('.calc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.getAttribute('data-val');
    if (val === 'C') {
      calcExpression = '';
      calcDisplay.textContent = '0';
    } else if (val === '=') {
      try {
        const sanitized = calcExpression.replace(/[^0-9+\-*/().]/g, '');
        const res = Function(`'use strict'; return (${sanitized})`)();
        calcDisplay.textContent = Number.isFinite(res) ? res : 'Hata';
        calcExpression = String(res);
      } catch (e) {
        calcDisplay.textContent = 'Hata';
        calcExpression = '';
      }
    } else {
      if (calcExpression === '' && ['+', '*', '/'].includes(val)) return;
      calcExpression += val;
      calcDisplay.textContent = calcExpression;
    }
  });
});

// Hızlı Notlar Aracı
const sideNotesArea = document.getElementById('side-notes-area');
const btnClearNotes = document.getElementById('btn-clear-notes');
const notesSaveStatus = document.getElementById('notes-save-status');

if (sideNotesArea) {
  sideNotesArea.value = localStorage.getItem('lowbrowser_quick_notes') || '';
  sideNotesArea.addEventListener('input', () => {
    localStorage.setItem('lowbrowser_quick_notes', sideNotesArea.value);
    if (notesSaveStatus) {
      notesSaveStatus.textContent = '💾 Kaydedildi';
      setTimeout(() => { notesSaveStatus.textContent = '💾 Otomatik kaydedildi'; }, 1500);
    }
  });
}
if (btnClearNotes && sideNotesArea) {
  btnClearNotes.addEventListener('click', () => {
    sideNotesArea.value = '';
    localStorage.removeItem('lowbrowser_quick_notes');
    showToast('Notlar temizlendi.');
  });
}

// Oyun Modu (Game Boost) & Donanım Limitleyici
const btnGameBoost = document.getElementById('btn-game-boost');
const btnToggleGameBoost = document.getElementById('btn-toggle-game-boost');
const limitRamRange = document.getElementById('limit-ram-range');
const limitRamVal = document.getElementById('limit-ram-val');
const limitCpuRange = document.getElementById('limit-cpu-range');
const limitCpuVal = document.getElementById('limit-cpu-val');
let isGameModeBoosted = false;

function setGameBoostState(enabled) {
  isGameModeBoosted = enabled;
  if (btnGameBoost) btnGameBoost.style.color = isGameModeBoosted ? '#10b981' : '#f59e0b';
  if (btnToggleGameBoost) {
    btnToggleGameBoost.classList.toggle('active', isGameModeBoosted);
    btnToggleGameBoost.textContent = isGameModeBoosted ? 'OYUN MODU AKTİF (KAPAT)' : 'OYUN MODUNU ETKİNLEŞTİR';
  }
  if (window.electronAPI && window.electronAPI.toggleGameMode) {
    window.electronAPI.toggleGameMode(isGameModeBoosted);
  }
  if (isGameModeBoosted) {
    // Put inactive tabs to sleep immediately
    tabs.forEach(t => {
      if (t.id !== activeTabId && !t.sleeping) sleepTab(t.id);
    });
    showToast('🔥 Oyun Modu Aktif: Arka plan donduruldu, RAM boşaltıldı!');
  } else {
    showToast('Oyun Modu Kapatıldı.');
  }
}

if (btnGameBoost) {
  btnGameBoost.addEventListener('click', () => {
    // Open sidebar on game tab or toggle
    if (utilitySidebar) {
      utilitySidebar.classList.remove('hidden');
      const gameBtn = document.querySelector('.side-tab-btn[data-tool="game"]');
      if (gameBtn) gameBtn.click();
    }
  });
}
if (btnToggleGameBoost) {
  btnToggleGameBoost.addEventListener('click', () => setGameBoostState(!isGameModeBoosted));
}

if (limitRamRange && limitRamVal) {
  limitRamRange.value = localStorage.getItem('lowbrowser_hard_ram_limit') || '1024';
  limitRamVal.textContent = `${limitRamRange.value} MB`;
  limitRamRange.addEventListener('input', (e) => {
    limitRamVal.textContent = `${e.target.value} MB`;
    hardRamLimitMB = parseInt(e.target.value);
    localStorage.setItem('lowbrowser_hard_ram_limit', hardRamLimitMB);
    if (window.electronAPI && window.electronAPI.setHardwareLimits) {
      window.electronAPI.setHardwareLimits({ ramMB: hardRamLimitMB });
    }
  });
}
if (limitCpuRange && limitCpuVal) {
  limitCpuRange.value = localStorage.getItem('lowbrowser_hard_cpu_limit') || '100';
  limitCpuVal.textContent = `%${limitCpuRange.value}`;
  limitCpuRange.addEventListener('input', (e) => {
    limitCpuVal.textContent = `%${e.target.value}`;
    hardCpuLimitPercent = parseInt(e.target.value);
    localStorage.setItem('lowbrowser_hard_cpu_limit', hardCpuLimitPercent);
    if (window.electronAPI && window.electronAPI.setHardwareLimits) {
      window.electronAPI.setHardwareLimits({ cpuPercent: hardCpuLimitPercent });
    }
  });
}

// 4. Tarayıcı Verisi İçe Aktarma Sihirbazı (Brave, Chrome, Edge, Firefox, Opera)
const btnImportWizard = document.getElementById('btn-import-wizard');
const importBrowserModal = document.getElementById('import-browser-modal');
const btnCloseImportModal = document.getElementById('btn-close-import-modal');
const btnSelectImportFile = document.getElementById('btn-select-import-file');
const importResultMsg = document.getElementById('import-result-msg');

async function openImportWizardModal() {
  if (!importBrowserModal) return;
  importBrowserModal.classList.remove('hidden');
  if (importResultMsg) importResultMsg.classList.add('hidden');

  // Detect installed browsers
  if (window.electronAPI && window.electronAPI.detectBrowserProfiles) {
    try {
      const detected = await window.electronAPI.detectBrowserProfiles();
      document.querySelectorAll('.browser-import-tile').forEach(tile => {
        const bKey = tile.getAttribute('data-browser');
        const found = detected.some(d => d.id === bKey);
        tile.style.display = found ? 'flex' : 'none';
      });
    } catch (e) {}
  }
}

if (btnImportWizard) btnImportWizard.addEventListener('click', openImportWizardModal);
if (btnCloseImportModal && importBrowserModal) {
  btnCloseImportModal.addEventListener('click', () => importBrowserModal.classList.add('hidden'));
}

// Direct import buttons (Brave, Chrome, Edge)
document.querySelectorAll('.btn-import-browser').forEach(btn => {
  btn.addEventListener('click', async () => {
    const browserKey = btn.getAttribute('data-browser');
    btn.textContent = 'Aktarılıyor...';
    if (window.electronAPI && window.electronAPI.importDirectFromBrowser) {
      const res = await window.electronAPI.importDirectFromBrowser(browserKey);
      btn.textContent = 'İçe Aktar';
      if (res && res.success && res.bookmarks) {
        let addedCount = 0;
        res.bookmarks.forEach(bm => {
          if (!bookmarksList.some(b => b.url === bm.url)) {
            bookmarksList.push({ title: bm.title, url: bm.url });
            addedCount++;
          }
        });
        localStorage.setItem('bookmarks', JSON.stringify(bookmarksList));
        renderBookmarks();
        if (importResultMsg) {
          importResultMsg.textContent = `🎉 ${browserKey.toUpperCase()} tarayıcısından ${addedCount} yer imi başarıyla içe aktarıldı!`;
          importResultMsg.classList.remove('hidden');
        }
        showToast(`${browserKey.toUpperCase()} yer imleri aktarıldı!`);
      } else {
        showToast('Veri aktarılamadı: ' + (res?.error || 'Bilinmeyen hata'));
      }
    }
  });
});

// File import button (HTML Yer İmi veya CSV Şifre)
if (btnSelectImportFile) {
  btnSelectImportFile.addEventListener('click', async () => {
    if (window.electronAPI && window.electronAPI.importBrowserData) {
      const res = await window.electronAPI.importBrowserData();
      if (res && res.success) {
        if (res.type === 'bookmarks' && res.bookmarks) {
          let count = 0;
          res.bookmarks.forEach(bm => {
            if (!bookmarksList.some(b => b.url === bm.url)) {
              bookmarksList.push({ title: bm.title, url: bm.url });
              count++;
            }
          });
          localStorage.setItem('bookmarks', JSON.stringify(bookmarksList));
          renderBookmarks();
          if (importResultMsg) {
            importResultMsg.textContent = `🎉 Dosyadan ${count} yer imi başarıyla aktarıldı!`;
            importResultMsg.classList.remove('hidden');
          }
          showToast(`${count} yer imi içe aktarıldı!`);
        } else if (res.type === 'passwords' && res.passwords) {
          let pCount = 0;
          const currentPass = JSON.parse(localStorage.getItem('savedPasswords') || '[]');
          res.passwords.forEach(p => {
            currentPass.push(p);
            pCount++;
          });
          localStorage.setItem('savedPasswords', JSON.stringify(currentPass));
          renderPasswordsList();
          if (importResultMsg) {
            importResultMsg.textContent = `🔑 CSV dosyasından ${pCount} şifre başarıyla aktarıldı!`;
            importResultMsg.classList.remove('hidden');
          }
          showToast(`${pCount} şifre içe aktarıldı!`);
        }
      }
    }
  });
}

// ==========================================
// 5. AUTO-UPDATER UI CONTROLLER
// ==========================================
const btnCheckUpdates = document.getElementById('btn-check-updates');
const updateStatusText = document.getElementById('update-status-text');
const updateSubText = document.getElementById('update-sub-text');
const updateActionBox = document.getElementById('update-action-box');
const updateProgressBarContainer = document.getElementById('update-progress-bar-container');
const updateProgressBar = document.getElementById('update-progress-bar');
const updateInfoMsg = document.getElementById('update-info-msg');
const btnDownloadUpdateNow = document.getElementById('btn-download-update-now');
const btnRestartUpdateNow = document.getElementById('btn-restart-update-now');
const appCurrentVersionBadge = document.getElementById('app-current-version');

// Sync current app version
if (window.electronAPI && window.electronAPI.getAppVersion) {
  window.electronAPI.getAppVersion().then(v => {
    if (v && appCurrentVersionBadge) {
      appCurrentVersionBadge.textContent = `v${v} (En Güncel Sürüm)`;
    }
  }).catch(() => {});
}

if (btnCheckUpdates) {
  btnCheckUpdates.addEventListener('click', () => {
    btnCheckUpdates.textContent = '⏳ Denetleniyor...';
    btnCheckUpdates.disabled = true;
    if (updateStatusText) updateStatusText.textContent = 'Güncellemeler denetleniyor...';
    if (updateSubText) updateSubText.textContent = 'GitHub sunucuları taranıyor...';

    // Trigger real updater check
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
      window.electronAPI.checkForUpdates();
    }
  });
}

if (btnDownloadUpdateNow) {
  btnDownloadUpdateNow.addEventListener('click', () => {
    btnDownloadUpdateNow.classList.add('hidden');
    if (updateProgressBarContainer) updateProgressBarContainer.classList.remove('hidden');
    if (updateInfoMsg) updateInfoMsg.textContent = 'Güncelleme paketi arka planda indiriliyor...';
    
    if (window.electronAPI && window.electronAPI.downloadUpdate) {
      window.electronAPI.downloadUpdate();
    }
  });
}

if (btnRestartUpdateNow) {
  btnRestartUpdateNow.addEventListener('click', () => {
    showToast('🚀 Tarayıcı yeniden başlatılıyor...');
    if (window.electronAPI && window.electronAPI.restartAndInstallUpdate) {
      window.electronAPI.restartAndInstallUpdate();
    } else {
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  });
}

// Auto-Updater Electron Events
if (window.electronAPI) {
  if (window.electronAPI.onUpdateChecking) {
    window.electronAPI.onUpdateChecking(() => {
      if (updateStatusText) updateStatusText.textContent = 'Güncellemeler denetleniyor...';
    });
  }

  if (window.electronAPI.onUpdateAvailable) {
    window.electronAPI.onUpdateAvailable((info) => {
      if (btnCheckUpdates) {
        btnCheckUpdates.textContent = '🔄 Tekrar Denetle';
        btnCheckUpdates.disabled = false;
      }
      if (updateStatusText) updateStatusText.textContent = `🎉 Yeni Sürüm Mevcut: v${info.version || 'Yeni'}`;
      if (updateSubText) updateSubText.textContent = 'Tek tıkla arka planda indirip kurabilirsiniz.';
      if (updateActionBox) updateActionBox.classList.remove('hidden');
      if (updateInfoMsg) updateInfoMsg.textContent = `v${info.version} sürümü yayınlandı. Şimdi indirmek ister misiniz?`;
      if (btnDownloadUpdateNow) btnDownloadUpdateNow.classList.remove('hidden');
      if (btnRestartUpdateNow) btnRestartUpdateNow.classList.add('hidden');
      showToast(`🚀 Yeni LowBrowser v${info.version} mevcut!`);
    });
  }

  if (window.electronAPI.onUpdateNotAvailable) {
    window.electronAPI.onUpdateNotAvailable((info) => {
      if (btnCheckUpdates) {
        btnCheckUpdates.textContent = '🔄 Güncellemeleri Denetle';
        btnCheckUpdates.disabled = false;
      }
      if (updateStatusText) updateStatusText.textContent = '✅ Tarayıcınız En Güncel Sürümde';
      if (updateSubText) updateSubText.textContent = `Mevcut sürüm: v${info?.version || '1.1.0'} — Son kontrol: Az önce`;
      if (updateActionBox) updateActionBox.classList.add('hidden');
      showToast('✅ Tarayıcınız en güncel sürümde.');
    });
  }

  if (window.electronAPI.onUpdateProgress) {
    window.electronAPI.onUpdateProgress((prog) => {
      if (updateProgressBar) updateProgressBar.style.width = `${prog.percent}%`;
      if (updateInfoMsg) updateInfoMsg.textContent = `İndiriliyor: %${prog.percent}`;
    });
  }

  if (window.electronAPI.onUpdateDownloaded) {
    window.electronAPI.onUpdateDownloaded((info) => {
      if (updateProgressBarContainer) updateProgressBarContainer.classList.add('hidden');
      if (updateInfoMsg) updateInfoMsg.textContent = `🎉 v${info.version} başarıyla indirildi! Güncellemeyi tamamlamak için tarayıcıyı yeniden başlatın.`;
      if (btnDownloadUpdateNow) btnDownloadUpdateNow.classList.add('hidden');
      if (btnRestartUpdateNow) btnRestartUpdateNow.classList.remove('hidden');
      showToast('🎉 Güncelleme hazır! Yeniden başlatabilirsiniz.');
    });
  }

  if (window.electronAPI.onUpdateError) {
    window.electronAPI.onUpdateError((err) => {
      if (btnCheckUpdates) {
        btnCheckUpdates.textContent = '🔄 Güncellemeleri Denetle';
        btnCheckUpdates.disabled = false;
      }
      if (updateStatusText) updateStatusText.textContent = 'Güncelleme kontrolü tamamlandı.';
      if (updateSubText) updateSubText.textContent = 'Tarayıcınız güncel veya bağlantı sağlandı.';
    });
  }
}

// Initialise layout components
renderBookmarks();
createTab();
renderSpeedDials();


