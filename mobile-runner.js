const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mobileWindow;

function createMobileWindow() {
  Menu.setApplicationMenu(null);

  mobileWindow = new BrowserWindow({
    width: 412,
    height: 892,
    title: 'Kite Mobile Simulator',
    icon: path.join(__dirname, 'assets', 'logo.png'),
    resizable: true,
    backgroundColor: '#07080a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  });

  mobileWindow.loadFile('index.html');

  mobileWindow.on('closed', () => {
    mobileWindow = null;
  });
}

app.whenReady().then(createMobileWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
