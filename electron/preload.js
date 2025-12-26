import { contextBridge, ipcRenderer } from 'electron'

console.log('Preload script loaded')

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  selectFile: () => ipcRenderer.invoke('select-excel-file'),
  importExcel: (options) => ipcRenderer.invoke('import-excel', options),
  migrateExcelToDb: (options) => ipcRenderer.invoke('migrate-excel-to-db', options),
  migrateToDb: (options) => ipcRenderer.invoke('migrate-excel-to-db', options),
  dbQuery: (options) => ipcRenderer.invoke('db-query', options),
  getDbStats: () => ipcRenderer.invoke('get-db-stats'),
  getDbDebugInfo: () => ipcRenderer.invoke('get-db-debug-info'),
  loadDatabaseFile: (options) => ipcRenderer.invoke('load-database-file', options),
  selectDatabaseFile: () => ipcRenderer.invoke('select-database-file'),
  setNativeTheme: (theme) => ipcRenderer.send('set-native-theme', theme),
  platform: process.platform,
  onNavigate: (callback) => {
    console.log('onNavigate callback registered')
    ipcRenderer.on('navigate', (event, page) => {
      console.log('Preload: navigate event received:', page)
      callback(page)
    })
  },
  onSetPrinter: (callback) => ipcRenderer.on('set-printer', (event, data) => callback(data)),
  on: (channel, callback) => {
    console.log(`Preload: registering listener for channel: ${channel}`)
    ipcRenderer.on(channel, (event, ...args) => {
      console.log(`Preload: event received on channel ${channel}:`, args)
      callback(...args)
    })
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})

console.log('electronAPI exposed to window')

