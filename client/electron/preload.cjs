const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  checkForUpdates: (force) => ipcRenderer.invoke('check-for-updates', force),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  setDiscordActivity: (activity) => ipcRenderer.send('set-discord-activity', activity),
  onDeepLink: (callback) => ipcRenderer.on('deep-link', (event, url) => callback(url)),
  downloadCoreUpdate: () => ipcRenderer.invoke('download-core-update'),
  installCoreUpdate: () => ipcRenderer.send('install-core-update'),
  onCoreUpdateProgress: (callback) => {
    const handler = (event, percent) => callback(percent);
    ipcRenderer.on('core-update-progress', handler);
    return () => ipcRenderer.removeListener('core-update-progress', handler);
  }
});
