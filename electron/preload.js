const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  printWindow: () => ipcRenderer.invoke('tayyab:print'),
  saveBackupToDisk: (defaultFilename, base64Data) =>
    ipcRenderer.invoke('tayyab:save-backup', { defaultFilename, base64Data }),
  pickBackupFile: () => ipcRenderer.invoke('tayyab:pick-backup'),
  getDesktopInfo: () => ipcRenderer.invoke('tayyab:info'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
});
