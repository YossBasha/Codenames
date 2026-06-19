const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  
  onUpdaterAvailable: (callback) => ipcRenderer.on('updater:available', (_event, version) => callback(version)),
  onUpdaterNotAvailable: (callback) => ipcRenderer.on('updater:not-available', () => callback()),
  onUpdaterProgress: (callback) => ipcRenderer.on('updater:progress', (_event, progress) => callback(progress)),
  onUpdaterDownloaded: (callback) => ipcRenderer.on('updater:downloaded', () => callback()),
  onUpdaterError: (callback) => ipcRenderer.on('updater:error', (_event, error) => callback(error)),
  
  removeAllUpdaterListeners: () => {
    ipcRenderer.removeAllListeners('updater:available');
    ipcRenderer.removeAllListeners('updater:not-available');
    ipcRenderer.removeAllListeners('updater:progress');
    ipcRenderer.removeAllListeners('updater:downloaded');
    ipcRenderer.removeAllListeners('updater:error');
  }
});
