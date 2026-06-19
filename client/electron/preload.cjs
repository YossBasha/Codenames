const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  checkForUpdates: (force) => ipcRenderer.invoke('check-for-updates', force),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app')
});
