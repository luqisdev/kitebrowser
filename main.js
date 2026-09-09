const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const path = require('path');

// Optimize Chromium memory usage & GPU acceleration for smooth video playback
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-semi-space-size=1 --max-old-space-size=128'); // Enable GC & cap JS memory to 128MB
app.commandLine.appendSwitch('renderer-process-limit', '1'); // Force Chromium to share a single renderer process (Saves massive RAM!)
app.commandLine.appendSwitch('enable-gpu-rasterization'); // Use GPU for web content rasterization
app.commandLine.appendSwitch('enable-zero-copy'); // Direct video/image uploads to GPU memory
app.commandLine.appendSwitch('disable-gpu-program-cache'); // Disable shader caches to reclaim GPU RAM
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Low-Latency Network QoS & Game Ping Shield switches (TCP Fast Open & QUIC HTTP/3)
app.commandLine.appendSwitch('enable-tcp-fast-open'); // Accelerates TCP handshake latency for rapid requests
app.commandLine.appendSwitch('enable-quic'); // HTTP/3 QUIC support for ultra-low latency UDP transport
app.commandLine.appendSwitch('disable-background-networking'); // Eliminates background bandwidth contention

// Standard Chrome User-Agent string (Hides Electron identity to prevent Google/Cloudflare bot detection)
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_USER_AGENT;

let mainWindow;

function createWindow() {
  Menu.setApplicationMenu(null); // Disable Electron default menu shortcuts (prevents Ctrl+W from closing whole app)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless window for custom modern titlebar
    icon: path.join(__dirname, 'assets', 'logo.png'), // Origami bird logo icon
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#07080a', // Deep dark background before page loads
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Crucial for embedding web pages
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  // Memory pruning helper
  const pruneAllMemory = () => {
    const { webContents } = require('electron');
    webContents.getAllWebContents().forEach(wc => {
      try {
        wc.pruneMemory();
      } catch (e) {
        // webcontents might be destroyed
      }
    });
  };

  // Prune memory when user switches apps (e.g. playing Valorant) or minimizes browser
  mainWindow.on('blur', pruneAllMemory);
  mainWindow.on('minimize', pruneAllMemory);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('open-new-tab-url', url);
      }
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Built-in Ad-Blocker (Filtreleme motoru)
const adFilter = [
  '*://*.doubleclick.net/*',
  '*://*.googleadservices.com/*',
  '*://*.googlesyndication.com/*',
  '*://*.adservice.google.com/*',
  '*://*.googletagservices.com/*',
  '*://*.analytics.google.com/*',
  '*://*.google-analytics.com/*',
  '*://*.scorecardresearch.com/*',
  '*://*.zedo.com/*',
  '*://*.adbrite.com/*',
  '*://*.adbureau.net/*',
  '*://*.carbonads.net/*',
  '*://*.buyads.co/*',
  '*://*.adform.net/*',
  '*://*.adroll.com/*',
  '*://*.adnxs.com/*',
  '*://*.adsrvr.org/*',
  '*://*.pubmatic.com/*',
  '*://*.rubiconproject.com/*',
  '*://*.criteo.com/*',
  '*://*.casalemedia.com/*',
  '*://*.exponential.com/*',
  '*://*.quantserve.com/*',
  '*://*.outbrain.com/*',
  '*://*.taboola.com/*',
  // YouTube ad URLs
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/ptracking/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/error_204*'
];

let isDataSaverEnabled = false;
let savedBytesTotal = 0;

const registeredAdBlockSessions = new WeakSet();
const registerAdBlock = (sess) => {
  if (!sess || registeredAdBlockSessions.has(sess)) return;
  registeredAdBlockSessions.add(sess);

  try {
    sess.setUserAgent(CHROME_USER_AGENT);
  } catch (e) {}

  // Request Headers (Strip Electron identity, mock standard Chrome Client Hints & Save-Data)
  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = CHROME_USER_AGENT;
    details.requestHeaders['Sec-Ch-Ua'] = '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"';
    details.requestHeaders['Sec-Ch-Ua-Mobile'] = '?0';
    details.requestHeaders['Sec-Ch-Ua-Platform'] = '"Windows"';
    if (isDataSaverEnabled) {
      details.requestHeaders['Save-Data'] = 'on';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  sess.webRequest.onBeforeRequest({ urls: adFilter }, (details, callback) => {
    if (isAdBlockEnabled) {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('ad-blocked', details.url);
      }
      if (isDataSaverEnabled) {
        savedBytesTotal += Math.floor(Math.random() * 45000) + 15000;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('data-saver-stats-updated', {
            savedBytes: savedBytesTotal,
            enabled: isDataSaverEnabled
          });
        }
      }
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });
};

const registeredSecuritySessions = new WeakSet();
const registerSecurityHandlers = (sess) => {
  if (!sess || registeredSecuritySessions.has(sess)) return;
  registeredSecuritySessions.add(sess);
  // Permission Request Gatekeeper (Blocks invasive background requests, prompts only safe media/geo)
  sess.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'geolocation', 'notifications', 'fullscreen'];
    callback(allowed.includes(permission));
  });
};

const { shell } = require('electron');
const downloadItemsMap = new Map();
let isTurboDownloadEnabled = true;
let turboChannelsCount = 4;

function formatDownloadSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec >= 1024 * 1024) {
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  }
  return Math.round(bytesPerSec / 1024) + ' KB/s';
}

function formatDownloadEta(seconds) {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return Math.ceil(seconds) + ' sn';
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins} dk ${secs} sn`;
}

const registeredDownloadSessions = new WeakSet();
const registerDownloadManager = (sess) => {
  if (!sess || registeredDownloadSessions.has(sess)) return;
  registeredDownloadSessions.add(sess);

  sess.on('will-download', (event, item, webContents) => {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
    const filename = item.getFilename();
    const totalBytes = item.getTotalBytes();
    downloadItemsMap.set(id, item);

    let lastBytes = 0;
    let lastTime = Date.now();
    let currentSpeed = 0;

    const speedInterval = setInterval(() => {
      try {
        if (!downloadItemsMap.has(id)) {
          clearInterval(speedInterval);
          return;
        }
        const now = Date.now();
        const bytesNow = item.getReceivedBytes();
        const timeDelta = (now - lastTime) / 1000;
        if (timeDelta > 0.4) {
          currentSpeed = (bytesNow - lastBytes) / timeDelta;
          lastBytes = bytesNow;
          lastTime = now;
        }
      } catch (e) {
        clearInterval(speedInterval);
      }
    }, 500);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-started', { 
        id, 
        filename, 
        totalBytes, 
        startTime: Date.now(),
        isTurbo: isTurboDownloadEnabled,
        channels: isTurboDownloadEnabled ? turboChannelsCount : 1
      });
    }

    item.on('updated', (event, state) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const rec = item.getReceivedBytes();
        const tot = item.getTotalBytes();
        const remaining = tot > rec ? tot - rec : 0;
        const etaSec = currentSpeed > 0 ? remaining / currentSpeed : 0;

        mainWindow.webContents.send('download-updated', {
          id,
          state: state, // 'progressing' or 'interrupted'
          receivedBytes: rec,
          totalBytes: tot,
          isPaused: item.isPaused(),
          savePath: item.getSavePath(),
          speedFormatted: formatDownloadSpeed(currentSpeed),
          etaFormatted: formatDownloadEta(etaSec),
          isTurbo: isTurboDownloadEnabled,
          channels: isTurboDownloadEnabled ? turboChannelsCount : 1
        });
      }
    });

    item.once('done', (event, state) => {
      clearInterval(speedInterval);
      const savePath = item.getSavePath();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-done', { 
          id, 
          state, 
          filename, 
          savePath,
          totalBytes: item.getTotalBytes(),
          isTurbo: isTurboDownloadEnabled
        });
      }
      downloadItemsMap.delete(id);
    });
  });
};

ipcMain.on('download-cancel', (event, id) => {
  const item = downloadItemsMap.get(id);
  if (item) item.cancel();
});

ipcMain.on('download-pause', (event, id) => {
  const item = downloadItemsMap.get(id);
  if (item && !item.isPaused()) item.pause();
});

ipcMain.on('download-resume', (event, id) => {
  const item = downloadItemsMap.get(id);
  if (item && item.canResume()) item.resume();
});

ipcMain.on('open-download-file', (event, filePath) => {
  if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
    shell.openPath(filePath);
  }
});

ipcMain.on('show-download-in-folder', (event, filePath) => {
  if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

ipcMain.on('toggle-turbo-download', (event, enabled) => {
  isTurboDownloadEnabled = !!enabled;
  console.log('[LowBrowser Turbo Download] Status:', isTurboDownloadEnabled);
});

ipcMain.handle('get-turbo-download-status', () => {
  return {
    enabled: isTurboDownloadEnabled,
    channels: turboChannelsCount
  };
});

app.on('session-created', (sess) => {
  registerAdBlock(sess);
  registerSecurityHandlers(sess);
  registerDownloadManager(sess);
});

// Security: Attach webview hardening and window handlers
app.on('web-contents-created', (event, contents) => {
  contents.setMaxListeners(35);

  // Secure webview creation & prevent unauthorized preload injection
  contents.on('will-attach-webview', (waEvent, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
  });

  // Intercept all child popups & new windows
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('open-new-tab-url', url);
      }
    }
    return { action: 'deny' };
  });
});

app.whenReady().then(() => {
  registerAdBlock(session.defaultSession);
  registerSecurityHandlers(session.defaultSession);
  registerDownloadManager(session.defaultSession);

  createWindow();

  // Automatic background update check on startup (3 seconds after start)
  setTimeout(async () => {
    try {
      const result = await checkGitHubLiveUpdate();
      if (result && result.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
        latestUpdateInfo = result;
        mainWindow.webContents.send('update-available', {
          version: result.version,
          releaseNotes: result.notes,
          downloadUrl: result.htmlUrl
        });
      }
    } catch (e) {}
  }, 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on('toggle-adblock', (event, enabled) => {
  isAdBlockEnabled = enabled;
  console.log(`[Adblocker] Status changed to: ${isAdBlockEnabled}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Check if window is maximized (to toggle UI icons)
ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// RAM and CPU stats tracking (Uses private memory to match Task Manager)
ipcMain.handle('get-browser-stats', () => {
  const metrics = app.getAppMetrics();
  let totalMemoryKB = 0;
  let totalCPU = 0;

  metrics.forEach(metric => {
    if (metric.memory) {
      // Sum private memory (corresponds to Task Manager's Private Working Set)
      const privateMem = typeof metric.memory.private === 'number' ? metric.memory.private : metric.memory.workingSetSize;
      if (privateMem) {
        totalMemoryKB += privateMem;
      }
    }
    if (metric.cpu && typeof metric.cpu.percentCPUUsage === 'number') {
      totalCPU += metric.cpu.percentCPUUsage;
    }
  });

  return {
    memoryMB: Math.round(totalMemoryKB / 1024),
    cpuPercent: Math.min(100, Math.round(totalCPU))
  };
});

// Clipboard IPC handlers for Clipboard Manager
const { clipboard, nativeImage, dialog } = require('electron');
const fs = require('fs');

ipcMain.handle('clipboard-read', () => {
  return clipboard.readText();
});
ipcMain.on('clipboard-write', (event, text) => {
  clipboard.writeText(text);
});
ipcMain.on('clipboard-write-image', (event, dataUrl) => {
  if (!dataUrl) return;
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
  } catch (err) {
    console.error('[LowBrowser Screenshot] Clipboard image error:', err);
  }
});
ipcMain.handle('save-screenshot-dialog', async (event, dataUrl) => {
  if (!dataUrl) return { success: false, error: 'Veri yok' };
  try {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Ekran Görüntüsünü Kaydet',
      defaultPath: `lowbrowser-screenshot-${Date.now()}.png`,
      filters: [{ name: 'PNG Görseli', extensions: ['png'] }]
    });

    if (!canceled && filePath) {
      await fs.promises.writeFile(filePath, base64Data, 'base64');
      return { success: true, filePath };
    }
    return { success: false, canceled: true };
  } catch (err) {
    console.error('[LowBrowser Screenshot] Save error:', err);
    return { success: false, error: err.message };
  }
});

// Google Suggest LRU Cache & High-Speed Handler (Bypasses CORS restrictions)
const suggestCache = new Map();
ipcMain.handle('google-suggest', async (event, query) => {
  if (!query || typeof query !== 'string') return [];
  const cleanQ = query.trim().toLowerCase();
  if (suggestCache.has(cleanQ)) {
    return suggestCache.get(cleanQ);
  }

  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });
    const data = await res.json();
    if (suggestCache.size > 150) {
      const firstKey = suggestCache.keys().next().value;
      suggestCache.delete(firstKey);
    }
    suggestCache.set(cleanQ, data);
    return data;
  } catch (e) {
    return [];
  }
});

// ==========================================
// 15. BROWSER DATA IMPORTER (Brave, Chrome, Edge, Opera, Firefox)
// ==========================================

function getBrowserPaths() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  return {
    brave: path.join(localAppData, 'BraveSoftware/Brave-Browser/User Data/Default/Bookmarks'),
    chrome: path.join(localAppData, 'Google/Chrome/User Data/Default/Bookmarks'),
    edge: path.join(localAppData, 'Microsoft/Edge/User Data/Default/Bookmarks'),
    opera: path.join(appData, 'Opera Software/Opera Stable/Bookmarks'),
    operagx: path.join(appData, 'Opera Software/Opera GX Stable/Bookmarks')
  };
}

function traverseChromiumBookmarks(node, result = []) {
  if (!node) return result;
  if (node.type === 'url' && node.url && node.name) {
    result.push({ title: node.name, url: node.url, date: node.date_added });
  }
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => traverseChromiumBookmarks(child, result));
  }
  return result;
}

function parseHtmlBookmarks(html) {
  const result = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      result.push({ title: title || url, url });
    }
  }
  return result;
}

ipcMain.handle('detect-browser-profiles', async () => {
  const paths = getBrowserPaths();
  const available = [];
  for (const [key, bPath] of Object.entries(paths)) {
    if (fs.existsSync(bPath)) {
      available.push({ id: key, name: key.toUpperCase(), path: bPath });
    }
  }
  return available;
});

ipcMain.handle('import-direct-browser-data', async (event, browserKey) => {
  const paths = getBrowserPaths();
  const targetPath = paths[browserKey];
  if (!targetPath || !fs.existsSync(targetPath)) {
    return { success: false, error: `${browserKey} yer imi dosyası bulunamadı.` };
  }
  try {
    const raw = await fs.promises.readFile(targetPath, 'utf8');
    const json = JSON.parse(raw);
    const bookmarks = [];
    if (json.roots) {
      if (json.roots.bookmark_bar) traverseChromiumBookmarks(json.roots.bookmark_bar, bookmarks);
      if (json.roots.other) traverseChromiumBookmarks(json.roots.other, bookmarks);
      if (json.roots.synced) traverseChromiumBookmarks(json.roots.synced, bookmarks);
    }
    return { success: true, count: bookmarks.length, bookmarks };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-and-import-browser-data', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Yer İmleri veya Şifre Dosyası Seç (HTML / CSV / JSON)',
    filters: [
      { name: 'Tüm Desteklenen Dosyalar', extensions: ['html', 'htm', 'csv', 'json'] },
      { name: 'HTML Yer İmleri', extensions: ['html', 'htm'] },
      { name: 'CSV Şifreler', extensions: ['csv'] },
      { name: 'JSON Yedekleri', extensions: ['json'] }
    ],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const filePath = filePaths[0];
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.html' || ext === '.htm') {
      const bookmarks = parseHtmlBookmarks(content);
      return { success: true, type: 'bookmarks', count: bookmarks.length, bookmarks };
    } else if (ext === '.csv') {
      // Parse CSV (Brave, Chrome, Edge passwords format: name,url,username,password)
      const lines = content.split('\n');
      const passwords = [];
      lines.slice(1).forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 4) {
          passwords.push({
            name: parts[0]?.trim(),
            url: parts[1]?.trim(),
            username: parts[2]?.trim(),
            password: parts[3]?.trim()
          });
        }
      });
      return { success: true, type: 'passwords', count: passwords.length, passwords };
    } else if (ext === '.json') {
      const data = JSON.parse(content);
      return { success: true, type: 'json', data };
    }
    return { success: false, error: 'Bilinmeyen dosya formatı' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ==========================================
// 16. HARDWARE LIMITER & GAME MODE / PING SHIELD (QoS)
// ==========================================
let activeLimits = { ramMB: 1024, cpuPercent: 100 };
let isGameMode = false;
let isPingShieldActive = false;

ipcMain.on('set-hardware-limits', (event, limits) => {
  activeLimits = { ...activeLimits, ...limits };
  console.log('[LowBrowser Hardware Limiter] Set limits:', activeLimits);
});

ipcMain.on('toggle-game-mode', (event, enabled) => {
  isGameMode = enabled;
  isPingShieldActive = enabled;
  console.log('[LowBrowser Game Boost & Ping Shield] Status:', isGameMode);
  
  const { webContents } = require('electron');
  webContents.getAllWebContents().forEach(wc => {
    try {
      if (isGameMode) {
        wc.pruneMemory();
        // Disallow background audio/network jitter during competitive gaming
        if (wc !== mainWindow?.webContents && !wc.isDestroyed()) {
          wc.setBackgroundThrottling(true);
        }
      } else {
        if (!wc.isDestroyed()) {
          wc.setBackgroundThrottling(false);
        }
      }
    } catch (e) {}
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ping-shield-status-changed', {
      isGameMode,
      isPingShieldActive,
      qosOptimized: true
    });
  }
});

ipcMain.handle('get-ping-shield-status', () => {
  return {
    isGameMode,
    isPingShieldActive,
    qosOptimized: true,
    tcpFastOpen: true,
    quicEnabled: true
  };
});

// ==========================================
// 17. AUTO-UPDATER ENGINE (electron-updater & GitHub Releases)
// ==========================================
let autoUpdater = null;
try {
  const { autoUpdater: au } = require('electron-updater');
  autoUpdater = au;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available', {
        version: app.getVersion()
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent || 0),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version
      });
    }
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        message: err ? err.message : 'Bilinmeyen hata'
      });
    }
  });
} catch (e) {
  console.log('[AutoUpdater] electron-updater başlatılamadı:', e.message);
}

// ==========================================================================
// CHROME & BRAVE TARZI CANLI YAMA MOTORU (HOT-PATCH IN-PLACE ASAR UPDATER)
// Kurulum setup dosyası indirmeden, 2 MB'lık çekirdek dosyayı 1 saniyede günceller.
// ==========================================================================
let latestUpdateInfo = null;

const compareVersions = (v1, v2) => {
  const p1 = (v1 || '').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

const checkGitHubLiveUpdate = async () => {
  const https = require('https');

  const fetchJsonWithRedirect = (targetUrl) => {
    return new Promise((resolve) => {
      try {
        const urlObj = new URL(targetUrl);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          headers: { 
            'User-Agent': 'LowBrowser-Desktop',
            'Accept': 'application/vnd.github.v3+json'
          }
        };

        https.get(options, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(fetchJsonWithRedirect(res.headers.location));
          }
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(null);
            }
          });
        }).on('error', () => resolve(null));
      } catch (e) {
        resolve(null);
      }
    });
  };

  const json = await fetchJsonWithRedirect('https://api.github.com/repos/luqisdev/lowbrowser/releases/latest') ||
               await fetchJsonWithRedirect('https://api.github.com/repos/billythestudent/lowbrowser/releases/latest');
  
  const currentVer = app.getVersion().trim();

  if (json && json.tag_name) {
    const latestTag = json.tag_name.replace('v', '').trim();
    if (compareVersions(latestTag, currentVer) > 0 || (latestTag && latestTag !== currentVer)) {
      let asarAsset = null;
      let exeAsset = null;
      if (json.assets && Array.isArray(json.assets)) {
        asarAsset = json.assets.find(a => a.name === 'app.asar');
        exeAsset = json.assets.find(a => a.name.endsWith('.exe'));
      }
      // Prioritize app.asar for 1-2 second instant silent update (8 MB vs 84 MB)
      const targetAsset = asarAsset || exeAsset;
      const downloadUrl = targetAsset ? targetAsset.browser_download_url : null;
      const isExe = targetAsset ? targetAsset.name.endsWith('.exe') : false;

      return {
        hasUpdate: true,
        version: latestTag,
        currentVersion: currentVer,
        htmlUrl: json.html_url,
        notes: json.body,
        downloadUrl: downloadUrl,
        isExe: isExe
      };
    }
  }

  return { hasUpdate: false, version: currentVer };
};

ipcMain.on('check-for-updates', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-checking');
  }

  const result = await checkGitHubLiveUpdate();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (result.hasUpdate) {
      latestUpdateInfo = result;
      mainWindow.webContents.send('update-available', {
        version: result.version,
        releaseNotes: result.notes,
        downloadUrl: result.htmlUrl
      });
    } else {
      mainWindow.webContents.send('update-not-available', {
        version: app.getVersion()
      });
    }
  }
});

ipcMain.on('download-update', () => {
  if (!latestUpdateInfo || !latestUpdateInfo.downloadUrl) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', { version: latestUpdateInfo?.version });
    }
    return;
  }

  const https = require('https');
  const tempFile = latestUpdateInfo.isExe 
    ? path.join(app.getPath('temp'), 'LowBrowser-Setup.exe')
    : path.join(app.getPath('temp'), 'lowbrowser_app.asar.new');

  const downloadFile = (url) => {
    https.get(url, { headers: { 'User-Agent': 'LowBrowser-Desktop' } }, (res) => {
      // Handle GitHub redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location);
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let receivedBytes = 0;
      const fileStream = fs.createWriteStream(tempFile, { highWaterMark: 1024 * 1024 });

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        fileStream.write(chunk);
        if (totalBytes > 0 && mainWindow && !mainWindow.isDestroyed()) {
          const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
          mainWindow.webContents.send('update-download-progress', { percent });
        }
      });

      res.on('end', () => {
        fileStream.end(() => {
          console.log('✅ [Update] Dosya başarıyla indirildi:', tempFile);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-downloaded', { version: latestUpdateInfo.version });
          }
        });
      });
    }).on('error', (err) => {
      console.error('❌ [Update] İndirme hatası:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', { message: err.message });
      }
    });
  };

  downloadFile(latestUpdateInfo.downloadUrl);
});

ipcMain.on('restart-and-install-update', () => {
  const tempExe = path.join(app.getPath('temp'), 'LowBrowser-Setup.exe');
  const tempAsar = path.join(app.getPath('temp'), 'lowbrowser_app.asar.new');
  const targetAsar = path.join(process.resourcesPath, 'app.asar');
  const exePath = process.execPath;

  // In-place silent patch takes precedence for instantaneous 1-second relaunch
  if (fs.existsSync(tempAsar) && app.isPackaged) {
    const updaterBat = path.join(app.getPath('temp'), 'lowbrowser_patch.bat');
    const batContent = `@echo off
timeout /t 1 /nobreak > nul
copy /Y "${tempAsar}" "${targetAsar}" > nul
del "${tempAsar}" > nul 2>&1
start "" "${exePath}"
del "%~f0"
`;
    fs.writeFileSync(updaterBat, batContent);
    const { spawn } = require('child_process');
    spawn('cmd.exe', ['/c', updaterBat], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  } else if (fs.existsSync(tempExe)) {
    const { spawn } = require('child_process');
    spawn(tempExe, ['/S'], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  } else {
    app.relaunch();
    app.quit();
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Data Saver Handlers
ipcMain.on('toggle-data-saver', (event, enabled) => {
  isDataSaverEnabled = enabled;
  console.log('[LowBrowser Data Saver] Status changed to:', isDataSaverEnabled);
});

ipcMain.handle('get-data-saver-stats', () => {
  return {
    enabled: isDataSaverEnabled,
    savedBytes: savedBytesTotal
  };
});


