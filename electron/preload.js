import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  importExcel: (options) => ipcRenderer.invoke('import-excel', options),
  migrateExcelToDb: (options) => ipcRenderer.invoke('migrate-excel-to-db', options),
  dbQuery: (options) => ipcRenderer.invoke('db-query', options),
  getDbStats: () => ipcRenderer.invoke('get-db-stats'),
  platform: process.platform,
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),
  onSetPrinter: (callback) => ipcRenderer.on('set-printer', (event, data) => callback(data)),
  on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})

