// Palmi — настольное приложение (Electron). Открывает index.html и разрешает доступ к камере.
const { app, BrowserWindow, session, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 960,
    minHeight: 560,
    backgroundColor: '#0F1F33',
    title: 'Palmi',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  // Разрешаем только камеру (media); микрофон, геолокация и прочее — запрещены
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const videoOnly = permission === 'media' && (!details.mediaTypes || details.mediaTypes.every((t) => t === 'video'));
    callback(videoOnly);
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission) => permission === 'media');
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
