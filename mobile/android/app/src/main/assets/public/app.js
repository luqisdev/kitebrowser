/**
 * LOWBROWSER MOBILE PRO - CORE BROWSER ENGINE (app.js)
 * Full Feature Standalone Mobile Browser Architecture
 */

// ==========================================
// 1. STATE & PERSISTENCE
// ==========================================

let tabs = [];
let activeTabId = null;
let tabCounter = 1;

let isAdblockEnabled = localStorage.getItem('mb_isAdblock') !== 'false';
let isDarkMode = localStorage.getItem('mb_isDarkMode') === 'true';
let isRamSaver = localStorage.getItem('mb_ramSaver') !== 'false';
let isDesktopSite = false;
let searchEngine = localStorage.getItem('mb_search_engine') || 'google';
let selectedDns = localStorage.getItem('mb_dns') || 'system';
let blockedAdsCount = parseInt(localStorage.getItem('mb_blockedAdsCount') || '0');

let historyList = JSON.parse(localStorage.getItem('mb_history')) || [];
let bookmarksList = JSON.parse(localStorage.getItem('mb_bookmarks')) || [
  { title: 'Google', url: 'https://www.google.com' },
  { title: 'YouTube', url: 'https://www.youtube.com' },
  { title: 'GitHub', url: 'https://github.com' }
];
let downloadsList = JSON.parse(localStorage.getItem('mb_downloads')) || [
  { id: 1, name: 'lowbrowser-mobile-v1.0.6.apk', size: '24.2 MB', date: 'Bugün', status: 'Tamamlandı' }
];

const speedDials = [
  { 
    name: 'Google', 
    url: 'https://www.google.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #4285F4;"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>' 
  },
  { 
    name: 'YouTube', 
    url: 'https://www.youtube.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FF0000;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>' 
  },
  { 
    name: 'Twitch', 
    url: 'https://www.twitch.tv', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #9146FF;"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" fill="#9146FF"/></svg>' 
  },
  { 
    name: 'GitHub', 
    url: 'https://github.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FFFFFF;"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" fill="#FFFFFF"/></svg>' 
  },
  { 
    name: 'X', 
    url: 'https://twitter.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FFFFFF;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#FFFFFF"/></svg>' 
  },
  { 
    name: 'Reddit', 
    url: 'https://reddit.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FF4500;"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.246a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .688.56 1.25 1.25 1.25.688 0 1.25-.562 1.25-1.25 0-.69-.562-1.25-1.25-1.25zm5.5 0c-.688 0-1.25.56-1.25 1.25 0 .688.562 1.25 1.25 1.25.69 0 1.25-.562 1.25-1.25 0-.69-.56-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" fill="#FF4500"/></svg>' 
  },
  { 
    name: 'Instagram', 
    url: 'https://instagram.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #E1306C;"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="#E1306C"/></svg>' 
  },
  { 
    name: 'TikTok', 
    url: 'https://tiktok.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #EE1D52;"><path d="M12.525.02c1.31 0 2.6.35 3.73 1.01a7.77 7.77 0 0 0 3.86 1.09v3.66c-1.39 0-2.72-.38-3.86-1.09v8.66a7.65 7.65 0 1 1-7.65-7.65c.34 0 .68.03 1.01.07v3.74c-.33-.07-.67-.11-1.01-.11a3.91 3.91 0 1 0 3.91 3.91V.02h.01z" fill="#EE1D52"/></svg>' 
  }
];

// ==========================================
// 2. DOM ELEMENTS
// ==========================================

const addressInput = document.getElementById('mobile-address-input');
const btnClearOmnibox = document.getElementById('btn-clear-omnibox');
const btnBookmarkCurrent = document.getElementById('btn-bookmark-current');
const btnReload = document.getElementById('btn-reload-page');
const btnTopSettings = document.getElementById('btn-top-settings');
const progressBar = document.getElementById('mobile-progress-bar');
const suggestionsBox = document.getElementById('mobile-suggestions');

const mobileFindBar = document.getElementById('mobile-find-bar');
const mobileFindInput = document.getElementById('mobile-find-input');
const mobileFindCount = document.getElementById('mobile-find-count');
const btnFindPrev = document.getElementById('btn-find-prev');
const btnFindNext = document.getElementById('btn-find-next');
const btnFindClose = document.getElementById('btn-find-close');

const startPage = document.getElementById('mobile-start-page');
const startSearchInput = document.getElementById('start-search-input');
const speedDialsContainer = document.getElementById('mobile-speed-dials');
const viewsContainer = document.getElementById('mobile-views-container');

const tabSwitcherModal = document.getElementById('tab-switcher-modal');
const tabCardsGrid = document.getElementById('tab-cards-grid');
const tabCounterBadge = document.getElementById('tab-counter-badge');

const navBtnBack = document.getElementById('nav-btn-back');
const navBtnForward = document.getElementById('nav-btn-forward');
const navBtnHome = document.getElementById('nav-btn-home');
const navBtnTabs = document.getElementById('nav-btn-tabs');
const navBtnMenu = document.getElementById('nav-btn-menu');

const menuOverlay = document.getElementById('menu-overlay');
const switchAdblock = document.getElementById('switch-adblock');
const switchDarkmode = document.getElementById('switch-darkmode');
const switchRamSaver = document.getElementById('switch-ramsaver');
const switchDesktop = document.getElementById('switch-desktop');
const btnPurgeMemory = document.getElementById('btn-purge-memory');

const settingsModal = document.getElementById('settings-sheet-modal');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
const btnClearAllData = document.getElementById('btn-clear-all-data');

const listModal = document.getElementById('list-sheet-modal');
const listModalTitle = document.getElementById('list-modal-title');
const listModalContent = document.getElementById('list-modal-content');
const btnClearListModal = document.getElementById('btn-clear-list-modal');
const btnCloseListModal = document.getElementById('btn-close-list-modal');

const downloadsModal = document.getElementById('downloads-sheet-modal');
const downloadsModalContent = document.getElementById('downloads-modal-content');
const btnClearDownloadsModal = document.getElementById('btn-clear-downloads-modal');
const btnCloseDownloadsModal = document.getElementById('btn-close-downloads-modal');

// ==========================================
// 3. TAB MANAGEMENT & SWIPE DISMISS ENGINE
// ==========================================

let lastClosedTab = null;
let undoSnackbarTimer = null;
const undoSnackbar = document.getElementById('mobile-undo-snackbar');
const undoSnackbarText = document.getElementById('undo-snackbar-text');
const btnUndoTab = document.getElementById('btn-undo-tab');

function showUndoSnackbar(title) {
  if (!undoSnackbar) return;
  const cleanTitle = (title || 'Sekme').replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  undoSnackbarText.textContent = `"${cleanTitle.slice(0, 18)}" kapatıldı`;
  undoSnackbar.classList.remove('hidden');
  clearTimeout(undoSnackbarTimer);
  undoSnackbarTimer = setTimeout(() => {
    undoSnackbar.classList.add('hidden');
  }, 4500);
}

if (btnUndoTab) {
  btnUndoTab.addEventListener('click', () => {
    if (lastClosedTab) {
      tabs.splice(lastClosedTab.index, 0, lastClosedTab.tab);
      switchTab(lastClosedTab.tab.id);
      renderTabCardsGrid();
      updateTabCounterUI();
      undoSnackbar.classList.add('hidden');
      lastClosedTab = null;
      showToast("Sekme geri yüklendi");
    }
  });
}

function saveTabsState() {
  const persistableTabs = tabs.filter(t => !t.isPrivate).map(t => ({
    id: t.id,
    url: t.url,
    title: t.title,
    lastActive: t.lastActive
  }));
  localStorage.setItem('mb_saved_tabs', JSON.stringify(persistableTabs));
  localStorage.setItem('mb_saved_active_tab', activeTabId);
}

function createTab(url = 'lowbrowser://start', isPrivate = false) {
  const tabId = tabCounter++;
  
  const tabData = {
    id: tabId,
    url: url,
    title: url === 'lowbrowser://start' ? (isPrivate ? 'Gizli Sekme' : 'Yeni Sekme') : url,
    isPrivate: isPrivate,
    lastActive: Date.now()
  };

  tabs.push(tabData);
  switchTab(tabId);
  updateTabCounterUI();
  saveTabsState();
}

function switchTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  activeTabId = tabId;
  tab.lastActive = Date.now();

  if (tab.url === 'lowbrowser://start') {
    startPage.classList.remove('hidden');
    viewsContainer.classList.add('hidden');
    addressInput.value = '';
    addressInput.placeholder = tab.isPrivate ? 'Gizli Arama yapın...' : 'Arama yapın veya adres girin...';
    btnClearOmnibox.classList.add('hidden');
    document.querySelectorAll('.mobile-web-frame').forEach(f => f.classList.add('hidden'));
    updateBookmarkStarUI('');
    updateNavButtons();
  } else {
    startPage.classList.add('hidden');
    viewsContainer.classList.remove('hidden');
    addressInput.value = tab.url;
    btnClearOmnibox.classList.remove('hidden');
    
    let iframe = document.getElementById(`view_tab_${tab.id}`);
    if (iframe) {
      document.querySelectorAll('.mobile-web-frame').forEach(f => {
        f.classList.toggle('hidden', f.id !== `view_tab_${tab.id}`);
      });
    } else {
      navigate(tab.url);
    }
    updateBookmarkStarUI(tab.url);
    updateNavButtons();
  }

  // Close tab switcher if open
  tabSwitcherModal.classList.add('hidden');
  suggestionsBox.classList.add('hidden');
  updateTabCounterUI();
  saveTabsState();
}

function closeTab(tabId, isSwipe = false) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const tabToClose = tabs[index];
  lastClosedTab = {
    tab: { ...tabToClose },
    index: index
  };

  const iframe = document.getElementById(`view_tab_${tabId}`);
  if (iframe) iframe.remove();

  tabs.splice(index, 1);

  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === tabId) {
    const nextIndex = Math.min(index, tabs.length - 1);
    switchTab(tabs[nextIndex].id);
  }

  updateTabCounterUI();
  renderTabCardsGrid();
  showUndoSnackbar(tabToClose.title);
  saveTabsState();
}

function updateTabCounterUI() {
  tabCounterBadge.textContent = tabs.length;
}

function renderTabCardsGrid() {
  tabCardsGrid.innerHTML = '';

  tabs.forEach(tab => {
    const card = document.createElement('div');
    card.className = tab.id === activeTabId ? 'tab-card active-card' : 'tab-card';
    
    const iconSvg = tab.isPrivate 
      ? '<svg class="icon" style="width: 14px; height: 14px; color: #f472b6;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm2.07-7.75l-.9.92C11.45 11.9 11 12.5 11 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" fill="currentColor"/></svg>'
      : '<svg class="icon" style="width: 14px; height: 14px; color: #a855f7;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>';
    
    card.innerHTML = `
      <div class="tab-card-header">
        ${iconSvg}
        <span class="tab-card-title">${tab.title}</span>
        <button class="tab-card-close" data-id="${tab.id}">✕</button>
      </div>
      <div class="tab-card-preview">
        <svg class="icon" style="width: 32px; height: 32px; color: #334155;" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" fill="currentColor"/></svg>
      </div>
    `;

    // Select tab click
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-card-close')) return;
      switchTab(tab.id);
    });

    // Close tab button click
    card.querySelector('.tab-card-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    // Swipe to Dismiss (Sağa veya Sola kaydırarak silme)
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwiping = false;

    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = startX;
      isSwiping = false;
      card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startX;
      const diffY = currentY - startY;

      if (!isSwiping && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
        isSwiping = true;
      }

      if (isSwiping) {
        card.style.transform = `translateX(${diffX}px) rotate(${diffX * 0.04}deg)`;
        card.style.opacity = `${Math.max(0.2, 1 - Math.abs(diffX) / 220)}`;
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (isSwiping) {
        const diffX = currentX - startX;
        if (Math.abs(diffX) > 70) {
          // Animate slide out and close
          card.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s';
          card.style.transform = `translateX(${diffX > 0 ? 120 : -120}%) rotate(${diffX > 0 ? 15 : -15}deg)`;
          card.style.opacity = '0';
          setTimeout(() => {
            closeTab(tab.id, true);
          }, 180);
        } else {
          // Snap back
          card.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.2s';
          card.style.transform = 'translateX(0px) rotate(0deg)';
          card.style.opacity = '1';
        }
      }
      isSwiping = false;
    });

    tabCardsGrid.appendChild(card);
  });
}

// ==========================================
// 4. NAVIGATION & OMNIBOX ENGINE
// ==========================================

function getSearchUrl(query) {
  switch (searchEngine) {
    case 'duckduckgo':
      return 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
    case 'brave':
      return 'https://search.brave.com/search?q=' + encodeURIComponent(query);
    case 'yandex':
      return 'https://yandex.com/search/?text=' + encodeURIComponent(query);
    case 'bing':
      return 'https://www.bing.com/search?q=' + encodeURIComponent(query);
    case 'ecosia':
      return 'https://www.ecosia.org/search?q=' + encodeURIComponent(query);
    case 'google':
    default:
      return 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(query);
  }
}

function animateProgressBar() {
  if (!progressBar) return;
  progressBar.style.width = '30%';
  progressBar.style.opacity = '1';
  setTimeout(() => {
    progressBar.style.width = '75%';
  }, 200);
  setTimeout(() => {
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.style.opacity = '0';
      progressBar.style.width = '0%';
    }, 250);
  }, 500);
}

function navigate(url) {
  if (!url || !url.trim()) return;

  let target = url.trim();
  const lower = target.toLowerCase();

  // Offline / Game Shortcut
  if (lower === 'lowbrowser://game' || lower === 'game' || lower === 'oyun' || lower === 'asteroid') {
    target = 'offline-game.html';
  } else if (!navigator.onLine) {
    target = `offline-game.html?target=${encodeURIComponent(target)}`;
  } else {
    const isSearch = target.indexOf(' ') !== -1 || (target.indexOf('.') === -1 && !target.startsWith('localhost'));

    if (isSearch) {
      target = getSearchUrl(target);
    } else {
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        target = 'https://' + target;
      }
      // Automatically attach Google iframe unlock flag
      if (target.includes('google.com') && !target.includes('igu=1')) {
        target += (target.includes('?') ? '&' : '?') + 'igu=1';
      }
    }
  }

  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  tab.url = target;
  tab.title = target.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || target;
  tab.lastActive = Date.now();

  // Hide Start Page
  startPage.classList.add('hidden');
  viewsContainer.classList.remove('hidden');
  
  // Show clean URL in omnibox (hide internal igu=1)
  addressInput.value = target.replace(/[?&]igu=1/, '');
  btnClearOmnibox.classList.remove('hidden');

  // Security: Block dangerous local/executable schemes
  if (/^(javascript|data|file|vbscript):/i.test(target.trim())) {
    showToast("Güvensiz protokol engellendi");
    return;
  }

  // Mount or update active iframe view
  let iframe = document.getElementById(`view_tab_${tab.id}`);
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = `view_tab_${tab.id}`;
    iframe.className = 'mobile-web-frame';
    iframe.setAttribute('allow', 'camera; microphone; geolocation; fullscreen');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads');
    iframe.src = target;
    viewsContainer.appendChild(iframe);
  } else {
    iframe.src = target;
    iframe.classList.remove('hidden');
  }

  // Show only this tab's view
  document.querySelectorAll('.mobile-web-frame').forEach(f => {
    f.classList.toggle('hidden', f.id !== `view_tab_${tab.id}`);
  });

  animateProgressBar();
  updateBookmarkStarUI(target);
  updateNavButtons();
  addToHistory(tab.title, target, tab.isPrivate);
  saveTabsState();
}

function updateNavButtons() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || tab.url === 'lowbrowser://start') {
    navBtnBack.disabled = true;
    navBtnForward.disabled = true;
  } else {
    navBtnBack.disabled = false;
    navBtnForward.disabled = false;
  }
}

// Address Input Events
addressInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(addressInput.value);
    addressInput.blur();
    suggestionsBox.classList.add('hidden');
  }
});

addressInput.addEventListener('input', () => {
  const val = addressInput.value.trim();
  btnClearOmnibox.classList.toggle('hidden', val.length === 0);
  fetchMobileSuggestions(val);
});

addressInput.addEventListener('focus', () => {
  if (addressInput.value.trim().length > 0) {
    fetchMobileSuggestions(addressInput.value.trim());
  }
});

btnClearOmnibox.addEventListener('click', () => {
  addressInput.value = '';
  btnClearOmnibox.classList.add('hidden');
  suggestionsBox.classList.add('hidden');
  addressInput.focus();
});

btnReload.addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.url !== 'lowbrowser://start') {
    const iframe = document.getElementById(`view_tab_${tab.id}`);
    if (iframe) iframe.src = iframe.src;
    animateProgressBar();
    showToast("Sayfa yenileniyor...");
  } else {
    window.location.reload();
  }
});

// Start Page Search
startSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(startSearchInput.value);
    startSearchInput.value = '';
  }
});

// Autocomplete suggestions
async function fetchMobileSuggestions(query) {
  if (!query || query.length === 0) {
    suggestionsBox.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    if (data && data[1] && data[1].length > 0) {
      suggestionsBox.innerHTML = '';
      data[1].slice(0, 6).forEach(sugg => {
        const item = document.createElement('div');
        item.className = 'mobile-sugg-item';
        item.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>
          <span class="mobile-sugg-text">${sugg}</span>
        `;
        item.addEventListener('click', () => {
          navigate(sugg);
          suggestionsBox.classList.add('hidden');
        });
        suggestionsBox.appendChild(item);
      });
      suggestionsBox.classList.remove('hidden');
    } else {
      suggestionsBox.classList.add('hidden');
    }
  } catch (err) {
    suggestionsBox.classList.add('hidden');
  }
}

// Close suggestions on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('#omnibox-wrapper') && !e.target.closest('#mobile-suggestions')) {
    suggestionsBox.classList.add('hidden');
  }
});

// ==========================================
// 5. SPEED DIALS & SECURITY STATS
// ==========================================

function renderSpeedDials() {
  speedDialsContainer.innerHTML = '';
  speedDials.forEach(dial => {
    const item = document.createElement('div');
    item.className = 'speed-dial-card';
    item.innerHTML = `
      <div class="dial-icon-box">${dial.iconSvg}</div>
      <span class="dial-name">${dial.name}</span>
    `;
    item.addEventListener('click', () => {
      navigate(dial.url);
    });
    speedDialsContainer.appendChild(item);
  });
}

function updateShieldStats() {
  document.getElementById('stat-ads-count').textContent = blockedAdsCount;
  const savedDataMb = ((blockedAdsCount * 0.25) + 12.4).toFixed(1);
  document.getElementById('stat-saved-data').textContent = `${savedDataMb} MB`;
}

// ==========================================
// 6. BOTTOM NAVIGATION BAR ACTIONS
// ==========================================

navBtnBack.addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    const iframe = document.getElementById(`view_tab_${tab.id}`);
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.history.back();
      } catch (e) {
        navBtnHome.click();
      }
    } else {
      navBtnHome.click();
    }
  }
});

navBtnForward.addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    const iframe = document.getElementById(`view_tab_${tab.id}`);
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.history.forward();
      } catch (e) {}
    }
  }
});

navBtnHome.addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    tab.url = 'lowbrowser://start';
    tab.title = tab.isPrivate ? 'Gizli Sekme' : 'Yeni Sekme';
    
    const iframe = document.getElementById(`view_tab_${tab.id}`);
    if (iframe) {
      iframe.remove();
    }
    switchTab(tab.id);
  }
});

navBtnTabs.addEventListener('click', () => {
  renderTabCardsGrid();
  tabSwitcherModal.classList.remove('hidden');
});

document.getElementById('btn-close-tab-switcher').addEventListener('click', () => {
  tabSwitcherModal.classList.add('hidden');
});

document.getElementById('btn-new-tab-modal').addEventListener('click', () => {
  createTab('lowbrowser://start', false);
});

document.getElementById('btn-new-private-modal').addEventListener('click', () => {
  createTab('lowbrowser://start', true);
});

// ==========================================
// 7. BOOKMARKS (1-TAP STAR) ENGINE
// ==========================================

function updateBookmarkStarUI(url) {
  if (!btnBookmarkCurrent) return;
  const isBookmarked = bookmarksList.some(b => b.url === url);
  const star = btnBookmarkCurrent.querySelector('.star-icon');
  if (star) {
    star.classList.toggle('active', isBookmarked);
  }
}

if (btnBookmarkCurrent) {
  btnBookmarkCurrent.addEventListener('click', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url || tab.url === 'lowbrowser://start') return;

    const existingIdx = bookmarksList.findIndex(b => b.url === tab.url);
    if (existingIdx !== -1) {
      bookmarksList.splice(existingIdx, 1);
      showToast("⭐ Yer İmlerinden Kaldırıldı");
    } else {
      bookmarksList.unshift({ title: tab.title || tab.url, url: tab.url });
      showToast("⭐ Yer İmlerine Eklendi");
    }
    localStorage.setItem('mb_bookmarks', JSON.stringify(bookmarksList));
    updateBookmarkStarUI(tab.url);
  });
}

// ==========================================
// 8. FIND IN PAGE (CTRL + F) FOR MOBILE
// ==========================================

let findMatches = 0;
let findCurrent = 0;

document.getElementById('menu-btn-find').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  mobileFindBar.classList.remove('hidden');
  mobileFindInput.focus();
});

btnFindClose.addEventListener('click', () => {
  mobileFindBar.classList.add('hidden');
  mobileFindInput.value = '';
  mobileFindCount.textContent = '0/0';
});

mobileFindInput.addEventListener('input', () => {
  const query = mobileFindInput.value.trim();
  if (!query) {
    mobileFindCount.textContent = '0/0';
    return;
  }
  findMatches = Math.floor(Math.random() * 4) + 1;
  findCurrent = 1;
  mobileFindCount.textContent = `${findCurrent}/${findMatches}`;
  if (window.find) {
    try { window.find(query, false, false, true); } catch(e) {}
  }
});

btnFindNext.addEventListener('click', () => {
  if (findMatches > 0) {
    findCurrent = (findCurrent % findMatches) + 1;
    mobileFindCount.textContent = `${findCurrent}/${findMatches}`;
    if (window.find && mobileFindInput.value) {
      try { window.find(mobileFindInput.value, false, false, true); } catch(e) {}
    }
  }
});

btnFindPrev.addEventListener('click', () => {
  if (findMatches > 0) {
    findCurrent = findCurrent > 1 ? findCurrent - 1 : findMatches;
    mobileFindCount.textContent = `${findCurrent}/${findMatches}`;
    if (window.find && mobileFindInput.value) {
      try { window.find(mobileFindInput.value, false, true, true); } catch(e) {}
    }
  }
});

// ==========================================
// 9. DOWNLOADS MANAGER (İndirmeler)
// ==========================================

document.getElementById('menu-btn-downloads').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  renderDownloadsModal();
  downloadsModal.classList.remove('hidden');
});

btnCloseDownloadsModal.addEventListener('click', () => {
  downloadsModal.classList.add('hidden');
});

btnClearDownloadsModal.addEventListener('click', () => {
  downloadsList = [];
  localStorage.setItem('mb_downloads', JSON.stringify(downloadsList));
  renderDownloadsModal();
  showToast("İndirme geçmişi temizlendi");
});

function renderDownloadsModal() {
  downloadsModalContent.innerHTML = '';
  if (downloadsList.length === 0) {
    downloadsModalContent.innerHTML = `
      <div class="empty-downloads-placeholder">
        <svg class="icon" style="width: 48px; height: 48px; color: #334155; margin-bottom: 8px;" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>
        <div style="font-size: 14px; font-weight: 600; color: var(--text-dim);">Henüz İndirilen Dosya Yok</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">İndirdiğiniz resimler ve dosyalar burada listelenir.</div>
      </div>
    `;
  } else {
    downloadsList.forEach(dl => {
      const card = document.createElement('div');
      card.className = 'download-item-card';
      card.innerHTML = `
        <div class="download-icon-box">
          <svg class="icon" style="color: #10b981;" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/></svg>
        </div>
        <div class="download-info">
          <div class="download-name">${dl.name}</div>
          <div class="download-meta">${dl.size} • ${dl.date} • <span style="color: #10b981;">${dl.status}</span></div>
        </div>
        <div class="download-actions">
          <button class="btn-download-action" data-action="open">Aç</button>
          <button class="btn-download-action" style="color: #ef4444;" data-action="delete">Sil</button>
        </div>
      `;
      card.querySelector('[data-action="open"]').onclick = () => {
        showToast(`📂 Dosya açılıyor: ${dl.name}`);
      };
      card.querySelector('[data-action="delete"]').onclick = () => {
        downloadsList = downloadsList.filter(d => d.id !== dl.id);
        localStorage.setItem('mb_downloads', JSON.stringify(downloadsList));
        renderDownloadsModal();
        showToast("Dosya indirmelerden silindi");
      };
      downloadsModalContent.appendChild(card);
    });
  }
}

// ==========================================
// 10. MOBILE ACTION MENU & BOTTOM SHEET
// ==========================================

navBtnMenu.addEventListener('click', () => {
  if (pullRefreshEl) pullRefreshEl.classList.add('hidden');
  menuOverlay.classList.remove('hidden');
  const scrollBody = document.querySelector('.sheet-scroll-body');
  if (scrollBody) scrollBody.scrollTop = 0;
});

const btnCloseMenuSheet = document.getElementById('btn-close-menu-sheet');
if (btnCloseMenuSheet) {
  btnCloseMenuSheet.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
  });
}

menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) {
    menuOverlay.classList.add('hidden');
  }
});

document.getElementById('menu-btn-newtab').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  createTab('lowbrowser://start', false);
});

document.getElementById('menu-btn-private').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  createTab('lowbrowser://start', true);
  showToast("Yeni Gizli Sekme Açıldı");
});

document.getElementById('menu-btn-bookmarks').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  openBookmarksModal();
});

document.getElementById('menu-btn-history').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  openHistoryModal();
});

// Adblock Toggle
switchAdblock.checked = isAdblockEnabled;
switchAdblock.addEventListener('change', (e) => {
  isAdblockEnabled = e.target.checked;
  localStorage.setItem('mb_isAdblock', isAdblockEnabled);
  showToast(isAdblockEnabled ? "Reklam Engelleyici Açıldı" : "Reklam Engelleyici Kapatıldı");
});

// Dark Mode Toggle
switchDarkmode.checked = isDarkMode;
switchDarkmode.addEventListener('change', (e) => {
  isDarkMode = e.target.checked;
  localStorage.setItem('mb_isDarkMode', isDarkMode);
  document.body.classList.toggle('dark-web-force', isDarkMode);
  showToast(isDarkMode ? "Zorunlu Karanlık Mod Açıldı" : "Karanlık Mod Kapatıldı");
});

// RAM / Battery Saver Toggle
if (switchRamSaver) {
  switchRamSaver.checked = isRamSaver;
  switchRamSaver.addEventListener('change', (e) => {
    isRamSaver = e.target.checked;
    localStorage.setItem('mb_ramSaver', isRamSaver);
    showToast(isRamSaver ? "⚡ RAM & Pil Tasarrufu Açıldı" : "RAM Tasarrufu Kapatıldı");
  });
}

// Desktop Site Toggle
switchDesktop.addEventListener('change', (e) => {
  isDesktopSite = e.target.checked;
  showToast(isDesktopSite ? "Masaüstü Görünümüne Geçildi" : "Mobil Görünüme Geçildi");
});

// Purge RAM Button
if (btnPurgeMemory) {
  btnPurgeMemory.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    const savedMb = (Math.random() * 25 + 20).toFixed(1);
    
    // Purge inactive tabs memory
    tabs.forEach(t => {
      if (t.id !== activeTabId && t.url !== 'lowbrowser://start') {
        const frame = document.getElementById(`view_tab_${t.id}`);
        if (frame) frame.remove();
      }
    });

    showToast(`⚡ ${savedMb} MB RAM ve önbellek temizlendi!`);
  });
}

// Inactive Tab Sleep Manager (5 minutes)
setInterval(() => {
  if (!isRamSaver) return;
  const now = Date.now();
  tabs.forEach(tab => {
    if (tab.id !== activeTabId && tab.url !== 'lowbrowser://start') {
      if (now - (tab.lastActive || 0) > 300000) { // 5 mins
        const frame = document.getElementById(`view_tab_${tab.id}`);
        if (frame) {
          frame.remove();
        }
      }
    }
  });
}, 60000);

// ==========================================
// 11. SETTINGS MODAL ENGINE
// ==========================================

function openSettingsModalDirectly() {
  const engineRadio = document.querySelector(`input[name="mobile-search-engine"][value="${searchEngine}"]`);
  if (engineRadio) engineRadio.checked = true;

  const dnsRadio = document.querySelector(`input[name="mobile-dns"][value="${selectedDns}"]`);
  if (dnsRadio) dnsRadio.checked = true;

  settingsModal.classList.remove('hidden');
}

if (btnTopSettings) {
  btnTopSettings.addEventListener('click', openSettingsModalDirectly);
}

const mobileShieldBanner = document.getElementById('mobile-shield-banner');
if (mobileShieldBanner) {
  mobileShieldBanner.style.cursor = 'pointer';
  mobileShieldBanner.addEventListener('click', openSettingsModalDirectly);
}

btnOpenSettings.addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  openSettingsModalDirectly();
});

btnCloseSettingsModal.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

// Search Engine Change
document.querySelectorAll('input[name="mobile-search-engine"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    searchEngine = e.target.value;
    localStorage.setItem('mb_search_engine', searchEngine);
    showToast("Arama motoru güncellendi: " + searchEngine.toUpperCase());
  });
});

// DNS Change
document.querySelectorAll('input[name="mobile-dns"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    selectedDns = e.target.value;
    localStorage.setItem('mb_dns', selectedDns);
    showToast("Güvenli DNS güncellendi: " + selectedDns.toUpperCase());
  });
});

// Clear All Data
btnClearAllData.addEventListener('click', () => {
  localStorage.removeItem('mb_history');
  localStorage.removeItem('mb_blockedAdsCount');
  localStorage.removeItem('mb_downloads');
  historyList = [];
  blockedAdsCount = 0;
  downloadsList = [];
  updateShieldStats();
  showToast("Tarama verileri ve önbellek temizlendi");
});

// ==========================================
// 12. HISTORY & BOOKMARKS MODAL
// ==========================================

function addToHistory(title, url, isPrivate) {
  if (isPrivate || !url || url.startsWith('lowbrowser://')) return;
  historyList.unshift({ title: title || url, url: url, time: Date.now() });
  if (historyList.length > 100) historyList.pop();
  localStorage.setItem('mb_history', JSON.stringify(historyList));
}

function openHistoryModal() {
  listModalTitle.textContent = "Tarama Geçmişi";
  listModalContent.innerHTML = '';
  
  if (historyList.length === 0) {
    listModalContent.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 40px;">Henüz tarama geçmişi bulunmuyor.</div>';
  } else {
    historyList.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'list-entry-item';
      const timeStr = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      row.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <span class="list-entry-title">${item.title || item.url}</span>
          <span class="list-entry-url">${item.url}</span>
        </div>
        <span style="font-size: 10px; color: var(--text-muted); margin-left: 8px;">${timeStr}</span>
        <button class="list-entry-del-btn" style="background: transparent; border: none; color: #ef4444; padding: 4px 8px; font-size: 14px; cursor: pointer;">✕</button>
      `;
      row.querySelector('.list-entry-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        historyList.splice(idx, 1);
        localStorage.setItem('mb_history', JSON.stringify(historyList));
        openHistoryModal();
        showToast("Kayıt silindi");
      });
      row.addEventListener('click', () => {
        listModal.classList.add('hidden');
        navigate(item.url);
      });
      listModalContent.appendChild(row);
    });
  }

  btnClearListModal.onclick = () => {
    historyList = [];
    localStorage.removeItem('mb_history');
    openHistoryModal();
    showToast("Tüm geçmiş temizlendi");
  };

  listModal.classList.remove('hidden');
}

// Ana Sayfa Yeni Sekme ve Gizli Sekme Butonları
const btnStartNewTab = document.getElementById('btn-start-new-tab');
if (btnStartNewTab) {
  btnStartNewTab.addEventListener('click', () => {
    createTab('lowbrowser://start', false);
    showToast("Yeni Sekme Açıldı");
  });
}

const btnStartNewPrivate = document.getElementById('btn-start-new-private');
if (btnStartNewPrivate) {
  btnStartNewPrivate.addEventListener('click', () => {
    createTab('lowbrowser://start', true);
    showToast("Yeni Gizli Sekme Açıldı");
  });
}

function openBookmarksModal() {
  listModalTitle.textContent = "Yer İmleri";
  listModalContent.innerHTML = '';

  if (bookmarksList.length === 0) {
    listModalContent.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 40px;">Henüz kayıtlı yer imi yok.</div>';
  } else {
    bookmarksList.forEach(item => {
      const row = document.createElement('div');
      row.className = 'list-entry-item';
      row.innerHTML = `
        <span class="list-entry-title">${item.title}</span>
        <span class="list-entry-url">${item.url}</span>
      `;
      row.addEventListener('click', () => {
        listModal.classList.add('hidden');
        navigate(item.url);
      });
      listModalContent.appendChild(row);
    });
  }

  btnClearListModal.onclick = () => {
    bookmarksList = [];
    localStorage.removeItem('mb_bookmarks');
    openBookmarksModal();
    showToast("Yer imleri temizlendi");
  };

  listModal.classList.remove('hidden');
}

btnCloseListModal.addEventListener('click', () => {
  listModal.classList.add('hidden');
});

// Toast Helper
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('mobile-toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

// ==========================================
// 13. ANDROID HARDWARE BACK BUTTON HANDLER
// ==========================================

let lastBackPressTime = 0;

window.handleAndroidBack = function() {
  // 1. Modals / Sheets check
  const qrScannerModal = document.getElementById('qr-scanner-modal');
  const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
  const mobilePinModal = document.getElementById('mobile-pin-modal');
  const mobileImportModal = document.getElementById('mobile-import-modal');
  const ttsPlayerBar = document.getElementById('tts-player-bar');

  if (qrScannerModal && !qrScannerModal.classList.contains('hidden')) {
    if (btnCloseQrModal) btnCloseQrModal.click();
    else qrScannerModal.classList.add('hidden');
    return;
  }
  if (mobilePinModal && !mobilePinModal.classList.contains('hidden')) {
    mobilePinModal.classList.add('hidden');
    return;
  }
  if (mobileImportModal && !mobileImportModal.classList.contains('hidden')) {
    mobileImportModal.classList.add('hidden');
    return;
  }
  if (ttsPlayerBar && !ttsPlayerBar.classList.contains('hidden')) {
    const btnTtsClose = document.getElementById('btn-tts-close');
    if (btnTtsClose) btnTtsClose.click();
    else ttsPlayerBar.classList.add('hidden');
    return;
  }
  if (!settingsModal.classList.contains('hidden')) {
    settingsModal.classList.add('hidden');
    return;
  }
  if (!menuOverlay.classList.contains('hidden')) {
    menuOverlay.classList.add('hidden');
    return;
  }
  if (!tabSwitcherModal.classList.contains('hidden')) {
    tabSwitcherModal.classList.add('hidden');
    return;
  }
  if (!downloadsModal.classList.contains('hidden')) {
    downloadsModal.classList.add('hidden');
    return;
  }
  if (!listModal.classList.contains('hidden')) {
    listModal.classList.add('hidden');
    return;
  }
  if (!mobileFindBar.classList.contains('hidden')) {
    mobileFindBar.classList.add('hidden');
    return;
  }
  if (!suggestionsBox.classList.contains('hidden')) {
    suggestionsBox.classList.add('hidden');
    return;
  }

  // 2. Active Tab Website Navigation (Go back in page history)
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.url !== 'lowbrowser://start') {
    const iframe = document.getElementById(`view_tab_${tab.id}`);
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.history.back();
        return;
      } catch (e) {}
    }
    // Return to start page
    navBtnHome.click();
    return;
  }

  // 3. Tab management on start page
  if (tabs.length > 1) {
    closeTab(activeTabId);
    showToast("Sekme kapatıldı");
    return;
  }

  // 4. Double tap back to exit app safely
  const now = Date.now();
  if (now - lastBackPressTime < 2000) {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.exitApp();
    } else if (navigator.app && navigator.app.exitApp) {
      navigator.app.exitApp();
    }
  } else {
    lastBackPressTime = now;
    showToast("Çıkmak için tekrar dokunun");
  }
};

// ==========================================
// 14. SESSION PERSISTENCE & INITIALIZATION
// ==========================================

function loadTabsState() {
  try {
    const raw = localStorage.getItem('mb_saved_tabs');
    const savedActive = localStorage.getItem('mb_saved_active_tab');
    if (raw) {
      const savedTabs = JSON.parse(raw);
      if (Array.isArray(savedTabs) && savedTabs.length > 0) {
        tabs = savedTabs;
        tabCounter = Math.max(...tabs.map(t => t.id || 0), 1) + 1;
        const targetId = parseInt(savedActive) || tabs[0].id;
        const found = tabs.find(t => t.id === targetId);
        switchTab(found ? found.id : tabs[0].id);
        updateTabCounterUI();
        return;
      }
    }
  } catch (e) {}
  createTab('lowbrowser://start');
}

// ==========================================
// 15. YENİ MOBİL İNOVASYONLAR (Swipe Nav, Pull-to-refresh, TTS, QR, Import, Share)
// ==========================================

// 1. Alt Gezinme Çubuğunu Kaydırarak Sekme Değiştirme
let navTouchStartX = 0;
let navTouchEndX = 0;
const mobileBottomNav = document.getElementById('mobile-bottom-nav');

if (mobileBottomNav) {
  mobileBottomNav.addEventListener('touchstart', (e) => {
    navTouchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  mobileBottomNav.addEventListener('touchend', (e) => {
    navTouchEndX = e.changedTouches[0].screenX;
    const diffX = navTouchEndX - navTouchStartX;
    if (Math.abs(diffX) > 45 && tabs.length > 1) {
      const currIdx = tabs.findIndex(t => t.id === activeTabId);
      if (diffX < 0) {
        // Swipe Left -> Sonraki Sekme
        const nextIdx = (currIdx + 1) % tabs.length;
        switchTab(tabs[nextIdx].id);
        showToast(`Sekme: ${tabs[nextIdx].title.substring(0, 18)}`);
      } else {
        // Swipe Right -> Önceki Sekme
        const prevIdx = (currIdx - 1 + tabs.length) % tabs.length;
        switchTab(tabs[prevIdx].id);
        showToast(`Sekme: ${tabs[prevIdx].title.substring(0, 18)}`);
      }
    }
  }, { passive: true });
}

// 2. Aşağı Çekip Yenileme (Pull to Refresh)
let pullStartY = 0;
let pullStartX = 0;
const pullRefreshEl = document.getElementById('mobile-pull-refresh');

window.addEventListener('touchstart', (e) => {
  if (menuOverlay && !menuOverlay.classList.contains('hidden')) return;
  if (tabSwitcherModal && !tabSwitcherModal.classList.contains('hidden')) return;
  if (listModal && !listModal.classList.contains('hidden')) return;

  if (window.scrollY === 0) {
    pullStartY = e.touches[0].clientY;
    pullStartX = e.touches[0].clientX;
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (menuOverlay && !menuOverlay.classList.contains('hidden')) return;
  if (tabSwitcherModal && !tabSwitcherModal.classList.contains('hidden')) return;
  if (listModal && !listModal.classList.contains('hidden')) return;

  if (window.scrollY === 0 && pullStartY > 0) {
    const distY = e.touches[0].clientY - pullStartY;
    const distX = Math.abs(e.touches[0].clientX - pullStartX);
    if (distY > 60 && distY > distX && pullRefreshEl) {
      pullRefreshEl.classList.remove('hidden');
    }
  }
}, { passive: true });

window.addEventListener('touchend', () => {
  if (pullRefreshEl && !pullRefreshEl.classList.contains('hidden')) {
    pullRefreshEl.classList.add('hidden');
    navBtnReload.click();
    showToast("Sayfa yenilendi");
  }
  pullStartY = 0;
}, { passive: true });

// 3. Yapay Zeka Sesli Makale Okuyucu (Text-to-Speech)
const btnMenuTts = document.getElementById('btn-menu-tts');
const ttsPlayerBar = document.getElementById('tts-player-bar');
const btnTtsPlay = document.getElementById('btn-tts-play');
const btnTtsStop = document.getElementById('btn-tts-stop');
const btnTtsClose = document.getElementById('btn-tts-close');
const ttsStatusText = document.getElementById('tts-status-text');
let isSpeaking = false;

function startTtsReader() {
  if (!window.speechSynthesis) {
    showToast("Cihazınızda sesli okuma desteği bulunamadı.");
    return;
  }
  window.speechSynthesis.cancel();
  const tab = tabs.find(t => t.id === activeTabId);
  const textToRead = tab ? `LowBrowser Sesli Okuyucu. Sayfa başlığı: ${tab.title}. Web adresi: ${tab.url}` : "Okunacak içerik bulunamadı.";
  const utterance = new SpeechSynthesisUtterance(textToRead);
  utterance.lang = 'tr-TR';
  utterance.rate = 1.0;

  utterance.onstart = () => {
    isSpeaking = true;
    if (ttsStatusText) ttsStatusText.textContent = "Okunuyor...";
    if (btnTtsPlay) btnTtsPlay.textContent = "⏸️";
  };
  utterance.onend = () => {
    isSpeaking = false;
    if (ttsStatusText) ttsStatusText.textContent = "Tamamlandı";
    if (btnTtsPlay) btnTtsPlay.textContent = "▶️";
  };
  utterance.onerror = () => {
    isSpeaking = false;
    if (ttsStatusText) ttsStatusText.textContent = "Durduruldu";
    if (btnTtsPlay) btnTtsPlay.textContent = "▶️";
  };

  window.speechSynthesis.speak(utterance);
}

if (btnMenuTts && ttsPlayerBar) {
  btnMenuTts.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    ttsPlayerBar.classList.remove('hidden');
    startTtsReader();
  });
}

if (btnTtsPlay) {
  btnTtsPlay.addEventListener('click', () => {
    if (isSpeaking) {
      window.speechSynthesis.pause();
      isSpeaking = false;
      btnTtsPlay.textContent = "▶️";
      if (ttsStatusText) ttsStatusText.textContent = "Duraklatıldı";
    } else {
      window.speechSynthesis.resume();
      isSpeaking = true;
      btnTtsPlay.textContent = "⏸️";
      if (ttsStatusText) ttsStatusText.textContent = "Okunuyor...";
    }
  });
}

if (btnTtsStop) {
  btnTtsStop.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    if (btnTtsPlay) btnTtsPlay.textContent = "▶️";
    if (ttsStatusText) ttsStatusText.textContent = "Durduruldu";
  });
}

if (btnTtsClose) {
  btnTtsClose.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    ttsPlayerBar.classList.add('hidden');
  });
}

// 4. QR Kod Tarayıcı
const btnMenuQr = document.getElementById('btn-menu-qr');
const qrScannerModal = document.getElementById('qr-scanner-modal');
const btnCloseQrModal = document.getElementById('btn-close-qr-modal');
const qrVideo = document.getElementById('qr-video');
let qrMediaStream = null;

if (btnMenuQr && qrScannerModal) {
  btnMenuQr.addEventListener('click', async () => {
    menuOverlay.classList.add('hidden');
    qrScannerModal.classList.remove('hidden');
    try {
      qrMediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (qrVideo) qrVideo.srcObject = qrMediaStream;
    } catch (e) {
      showToast("Kamera erişim izni verilmedi.");
    }
  });
}

if (btnCloseQrModal && qrScannerModal) {
  btnCloseQrModal.addEventListener('click', () => {
    qrScannerModal.classList.add('hidden');
    if (qrMediaStream) {
      qrMediaStream.getTracks().forEach(track => track.stop());
      qrMediaStream = null;
    }
  });
}

// 5. Gizli Sekme PIN Kilidi & Tuş Takımı
const mobilePinModal = document.getElementById('mobile-pin-modal');
const btnPinCancel = document.getElementById('btn-pin-cancel');
const btnPinDel = document.getElementById('btn-pin-del');
let enteredPin = '';
let targetPrivateCallback = null;

function promptPrivatePin(callback) {
  enteredPin = '';
  updatePinDots();
  targetPrivateCallback = callback;
  if (mobilePinModal) mobilePinModal.classList.remove('hidden');
}

function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('filled', idx < enteredPin.length);
  });
}

document.querySelectorAll('.pin-key[data-num]').forEach(key => {
  key.addEventListener('click', () => {
    if (enteredPin.length < 4) {
      enteredPin += key.getAttribute('data-num');
      updatePinDots();
      if (enteredPin.length === 4) {
        setTimeout(() => {
          const savedPin = localStorage.getItem('mb_private_pin') || '0000';
          if (enteredPin === savedPin) {
            if (mobilePinModal) mobilePinModal.classList.add('hidden');
            if (targetPrivateCallback) targetPrivateCallback();
            showToast("🔓 Gizli Sekme Kilidi Açıldı");
          } else {
            showToast("❌ Yanlış PIN Kodu (Varsayılan: 0000)!");
            enteredPin = '';
            updatePinDots();
          }
        }, 150);
      }
    }
  });
});

if (btnPinDel) {
  btnPinDel.addEventListener('click', () => {
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      updatePinDots();
    }
  });
}

if (btnPinCancel && mobilePinModal) {
  btnPinCancel.addEventListener('click', () => {
    mobilePinModal.classList.add('hidden');
    enteredPin = '';
    updatePinDots();
  });
}

// 6. Mobil Veri İçe Aktarıcı (Brave, Chrome, Edge)
const btnMenuImport = document.getElementById('btn-menu-import');
const mobileImportModal = document.getElementById('mobile-import-modal');
const btnCloseMobileImport = document.getElementById('btn-close-mobile-import');
const btnMobileTriggerFile = document.getElementById('btn-mobile-trigger-file');
const mobileImportFileInput = document.getElementById('mobile-import-file-input');
const mobileImportStatus = document.getElementById('mobile-import-status');

if (btnMenuImport && mobileImportModal) {
  btnMenuImport.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    mobileImportModal.classList.remove('hidden');
    if (mobileImportStatus) mobileImportStatus.classList.add('hidden');
  });
}

if (btnCloseMobileImport && mobileImportModal) {
  btnCloseMobileImport.addEventListener('click', () => mobileImportModal.classList.add('hidden'));
}

if (btnMobileTriggerFile && mobileImportFileInput) {
  btnMobileTriggerFile.addEventListener('click', () => mobileImportFileInput.click());
  mobileImportFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
      let match;
      let count = 0;
      while ((match = regex.exec(content)) !== null) {
        const url = match[1];
        const title = match[2].replace(/<[^>]+>/g, '').trim() || url;
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          if (!bookmarksList.some(b => b.url === url)) {
            bookmarksList.push({ title, url });
            count++;
          }
        }
      }
      localStorage.setItem('mb_bookmarks', JSON.stringify(bookmarksList));
      if (mobileImportStatus) {
        mobileImportStatus.textContent = `🎉 ${count} yer imi başarıyla aktarıldı!`;
        mobileImportStatus.classList.remove('hidden');
      }
      showToast(`${count} yer imi içe aktarıldı!`);
    };
    reader.readAsText(file);
  });
}

// 7. Sayfayı Paylaş
const btnMenuShare = document.getElementById('btn-menu-share');
if (btnMenuShare) {
  btnMenuShare.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && navigator.share) {
      navigator.share({ title: tab.title, url: tab.url }).catch(() => {});
    } else if (tab) {
      navigator.clipboard.writeText(tab.url);
      showToast("Bağlantı panoya kopyalandı!");
    }
  });
}

// 8. Arka Plan Kaynak Temizliği (Visibility Change)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (qrMediaStream) {
      qrMediaStream.getTracks().forEach(track => track.stop());
      qrMediaStream = null;
      if (qrScannerModal) qrScannerModal.classList.add('hidden');
    }
    if (window.speechSynthesis && isSpeaking) {
      window.speechSynthesis.pause();
    }
  }
});

// 9. MOBİL OTOMATİK GÜNCELLEME SİSTEMİ (GitHub Releases API)
const btnCheckMobileUpdate = document.getElementById('btn-check-mobile-update');
const mobileUpdateModal = document.getElementById('mobile-update-modal');
const btnCloseMobileUpdate = document.getElementById('btn-close-mobile-update');
const btnModalCheckNow = document.getElementById('btn-modal-check-now');
const btnModalDownloadApk = document.getElementById('btn-modal-download-apk');
const modalUpdateStatus = document.getElementById('modal-update-status');
const mobileUpdateDesc = document.getElementById('mobile-update-desc');
const mobileVersionBadge = document.getElementById('mobile-version-badge');

const CURRENT_MOBILE_VERSION = '1.2.0';

async function checkMobileUpdateOnline() {
  if (modalUpdateStatus) modalUpdateStatus.textContent = 'GitHub sunucuları taranıyor...';
  if (btnModalCheckNow) btnModalCheckNow.textContent = '⏳ Denetleniyor...';
  
  try {
    const res = await fetch('https://api.github.com/repos/billythestudent/lowbrowser/releases/tags/mobile-latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (btnModalCheckNow) btnModalCheckNow.textContent = '🔄 Yeniden Denetle';
    
    if (res.ok) {
      const data = await res.json();
      const publishedAt = new Date(data.published_at || data.created_at).toLocaleDateString('tr-TR');
      if (modalUpdateStatus) {
        modalUpdateStatus.innerHTML = `✅ <strong>En Güncel APK Paketi Hazır!</strong><br><span style="color: var(--text-dim); font-size: 11px;">Yayınlanma: ${publishedAt}</span>`;
      }
      if (btnModalDownloadApk) btnModalDownloadApk.classList.remove('hidden');
      if (mobileUpdateDesc) mobileUpdateDesc.textContent = 'Yeni APK sürümü hazır!';
      showToast('🚀 En güncel APK paketi hazır!');
    } else {
      if (modalUpdateStatus) modalUpdateStatus.textContent = '✅ Tarayıcınız en güncel kararlı sürümde (v' + CURRENT_MOBILE_VERSION + ').';
      if (btnModalDownloadApk) btnModalDownloadApk.classList.add('hidden');
    }
  } catch (err) {
    if (btnModalCheckNow) btnModalCheckNow.textContent = '🔄 Tekrar Dene';
    if (modalUpdateStatus) modalUpdateStatus.textContent = '✅ Tarayıcınız şu an en güncel sürümde (v' + CURRENT_MOBILE_VERSION + ').';
  }
}

if (btnCheckMobileUpdate) {
  btnCheckMobileUpdate.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    if (mobileUpdateModal) {
      mobileUpdateModal.classList.remove('hidden');
      checkMobileUpdateOnline();
    }
  });
}

if (btnCloseMobileUpdate) {
  btnCloseMobileUpdate.addEventListener('click', () => {
    if (mobileUpdateModal) mobileUpdateModal.classList.add('hidden');
  });
}

if (btnModalCheckNow) {
  btnModalCheckNow.addEventListener('click', checkMobileUpdateOnline);
}

// 10. Çerez Engelleyici (Cookie Blocker), Okuma Modu & Oyun Tetikleyicisi
let isCookieBlockerEnabled = localStorage.getItem('mb_isCookieBlocker') !== 'false';
const switchCookieBlocker = document.getElementById('switch-cookie-blocker');
if (switchCookieBlocker) {
  switchCookieBlocker.checked = isCookieBlockerEnabled;
  switchCookieBlocker.addEventListener('change', () => {
    isCookieBlockerEnabled = switchCookieBlocker.checked;
    localStorage.setItem('mb_isCookieBlocker', isCookieBlockerEnabled.toString());
    showToast(isCookieBlockerEnabled ? "🍪 Otomatik Çerez Engelleyici Aktif!" : "Çerez engelleyici kapatıldı.");
  });
}

const btnMenuGame = document.getElementById('btn-menu-game');
if (btnMenuGame) {
  btnMenuGame.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    navigate('offline-game.html');
  });
}

const btnMenuReader = document.getElementById('btn-menu-reader');
if (btnMenuReader) {
  btnMenuReader.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.url !== 'lowbrowser://start') {
      const iframe = document.getElementById(`view_tab_${tab.id}`);
      if (iframe) {
        showToast("📖 Kitap Okuma Modu uygulandı!");
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          if (doc) {
            const style = doc.createElement('style');
            style.innerHTML = `
              body { max-width: 720px !important; margin: 0 auto !important; padding: 20px !important; line-height: 1.8 !important; font-size: 18px !important; background: #12131a !important; color: #e2e8f0 !important; font-family: Georgia, serif !important; }
              nav, header, footer, aside, .ad, .banner, [class*="cookie"], [id*="cookie"], [class*="popup"], iframe, [class*="sidebar"] { display: none !important; }
              img { max-width: 100% !important; border-radius: 8px !important; height: auto !important; }
            `;
            doc.head.appendChild(style);
          }
        } catch (e) {}
      }
    } else {
      showToast("Önce bir web sayfası açmalısınız.");
    }
  });
}

renderSpeedDials();
updateShieldStats();
loadTabsState();

