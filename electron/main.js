import { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, nativeTheme } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, copyFileSync, mkdirSync, statSync } from 'fs'
import { createRequire } from 'module'
import Database from './database/sqlite.js'
import { importExcelFile } from './utils/excelImporter.js'
import { migrateExcelToDb } from './utils/migrateToDb.js'

const require = createRequire(import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow
let db

function createWindow() {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged || !app.isPackaged
    let preloadPath
    if (isDev) {
      // Use absolute path to preload script in development
      const projectRoot = process.cwd()
      const absolutePreloadPath = join(projectRoot, 'out', 'preload', 'index.js')

      preloadPath = existsSync(absolutePreloadPath)
        ? absolutePreloadPath
        : join(__dirname, '../preload/index.js')
    } else {
      // In packaged app preload is at out/preload/index.js relative to out/main/
      const packagedPreload = join(__dirname, '../preload/index.js')
      preloadPath = packagedPreload
    }

    const iconPath = join(__dirname, '../resources/icon.png')

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      icon: iconPath,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        devTools: true // Enable DevTools (can be opened with F12)
      },
      frame: true,
      transparent: false,
      backgroundColor: '#ffffff',
      titleBarStyle: 'default',
      show: false, // Don't show until ready for faster perceived load
      autoHideMenuBar: false,
      center: true,
      focusable: true
    })

    if (isDev) {
      // DevTools disabled - remove this line to enable in development
      // mainWindow.webContents.openDevTools()

      // Use electron-vite renderer dev server on port 5173
      const viteUrl = 'http://localhost:5173'

      console.log('Connecting to electron-vite renderer dev server on port 5173...')

      const tryLoadVite = (attempt = 1) => {
        if (attempt > 10) {
          console.log('✗ Max attempts reached. Please run "pnpm dev" in a separate terminal and restart Electron.')
          // Show error in window
          mainWindow.webContents.executeJavaScript(`
            (function() {
              if (document.body) {
                document.body.innerHTML = '<div style="padding: 40px; font-family: Arial, sans-serif; background: #f0f0f0;"><h1 style="color: #d32f2f;">Error: Vite dev server not found</h1><p>Please run <code>pnpm dev</code> in a separate terminal and restart Electron.</p><p>This will start the Vite dev server on port 5175.</p></div>';
              }
            })();
          `).catch(() => { })
          return
        }

        console.log(`Attempt ${attempt}: Loading from ${viteUrl}...`)
        mainWindow.loadURL(viteUrl).then(() => {
          setTimeout(() => {
            const currentURL = mainWindow.webContents.getURL()
            console.log('Current URL after load:', currentURL)

            // Check if page has content
            mainWindow.webContents.executeJavaScript(`
              (function() {
                const bodyLength = document.body ? document.body.innerHTML.length : 0
                const hasRoot = !!document.getElementById('root')
                const title = document.title
                const scriptsCount = document.scripts ? document.scripts.length : 0
                return { bodyLength, hasRoot, title, scriptsCount }
              })()
            `).then((result) => {
              console.log('Page check result:', result)

              if (currentURL && currentURL.includes('localhost:5173') && result.bodyLength > 0 && result.hasRoot) {
                console.log('✓ Successfully loaded from Vite dev server with content!')
                // DevTools already opened above
              } else if (currentURL && currentURL.includes('localhost:5173') && result.bodyLength === 0) {
                console.log('⚠ Page loaded but body is empty. Make sure "pnpm dev" is running!')
                // Show loading message
                const attemptStr = String(attempt)
                mainWindow.webContents.executeJavaScript(`
                  (function() {
                    if (document.body) {
                      document.body.innerHTML = '<div style="padding: 40px; font-family: Arial, sans-serif; background: #fff3cd; border: 2px solid #ffc107;"><h1 style="color: #856404;">Waiting for Vite dev server...</h1><p>Make sure to run <code>pnpm dev</code> in a separate terminal.</p><p>Attempt: ' + '${attemptStr}' + '/10</p></div>';
                    }
                  })();
                `).catch(() => { })
                setTimeout(() => tryLoadVite(attempt + 1), 2000)
              } else {
                console.log('✗ Page loaded but URL mismatch or no content, retrying...')
                setTimeout(() => tryLoadVite(attempt + 1), 2000)
              }
            }).catch(err => {
              console.error('Failed to check page content:', err)
              setTimeout(() => tryLoadVite(attempt + 1), 2000)
            })
          }, 2000)
        }).catch((error) => {
          console.log(`✗ Failed to load from dev server: ${error.message}`)
          console.log('Make sure to run "pnpm dev" in a separate terminal!')
          // Show error in window
          const errorMessage = error.message.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/'/g, "\\'")
          mainWindow.webContents.executeJavaScript(`
            (function() {
              if (document.body) {
                document.body.innerHTML = '<div style="padding: 40px; font-family: Arial, sans-serif; background: #f8d7da; border: 2px solid #dc3545;"><h1 style="color: #721c24;">Connection Error</h1><p>Failed to connect to Vite dev server.</p><p>Please run <code>pnpm dev</code> in a separate terminal.</p><p>Error: ' + '${errorMessage}' + '</p></div>';
              }
            })();
          `).catch(() => { })
          setTimeout(() => tryLoadVite(attempt + 1), 2000)
        })
      }

      // Wait a bit for dev server to be ready
      setTimeout(() => tryLoadVite(), 2000)
    } else {
      // Load production build
      // In packaged app, __dirname is in app.asar/out/main/, so we need ../renderer/index.html
      // Try multiple possible paths for compatibility
      const possiblePaths = [
        join(__dirname, '../renderer/index.html'),
        join(__dirname, '../../renderer/index.html'),
        join(app.getAppPath(), 'out/renderer/index.html')
      ]

      let loaded = false
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          mainWindow.loadFile(path)
          loaded = true
          break
        }
      }

      if (!loaded) {
        // Fallback to first path
        mainWindow.loadFile(possiblePaths[0])
      }

      // Show window when ready for faster perceived load
      mainWindow.once('ready-to-show', () => {
        mainWindow.show()
      })
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.log('Failed to load:', errorCode, errorDescription, validatedURL)
    })

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Page loaded successfully:', mainWindow.webContents.getURL())
    })

    // Enable F12 shortcut for DevTools (works in both dev and production)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        event.preventDefault()
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools()
        }
      }
    })
    
    // Also register global shortcut for F12 (works in production too)
    try {
      const ret = globalShortcut.register('F12', () => {
        if (mainWindow && mainWindow.webContents) {
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools()
          } else {
            mainWindow.webContents.openDevTools()
          }
        }
      })
      if (ret) {
        console.log('F12 shortcut registered for DevTools')
      }
    } catch (error) {
      console.warn('Could not register F12 shortcut:', error.message)
    }
  } catch (error) {
    console.error('Error creating window:', error)
  }
}

function createMenu() {
  const isMac = process.platform === 'darwin'

  const template = [
    // { role: 'fileMenu' }
    {
      label: 'Aplikacija',
      submenu: [
        { role: 'quit', label: 'Izlaz' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Uređivanje',
      submenu: [
        { role: 'undo', label: 'Opozovi' },
        { role: 'redo', label: 'Ponovi' },
        { type: 'separator' },
        { role: 'cut', label: 'Iseci' },
        { role: 'copy', label: 'Kopiraj' },
        { role: 'paste', label: 'Nalepi' },
        { role: 'selectAll', label: 'Izaberi sve' }
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'Prikaz',
      submenu: [
        { role: 'reload', label: 'Osveži' },
        { role: 'forceReload', label: 'Prisilno osveži' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Resetuj uvećanje' },
        { role: 'zoomIn', label: 'Uvećaj' },
        { role: 'zoomOut', label: 'Umanji' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Ceo ekran' },
        { type: 'separator' },
        {
          label: 'Tema',
          submenu: [
            {
              label: 'Tamna Tema',
              click: () => mainWindow && mainWindow.webContents.send('set-theme', 'dark')
            },
            {
              label: 'Svetla Tema',
              click: () => mainWindow && mainWindow.webContents.send('set-theme', 'light')
            }
          ]
        }
      ]
    },
    { type: 'separator' },
    // Uplatnice Menu - Naglašeno
    {
      label: '▶ Uplatnice',
      click: () => mainWindow && mainWindow.webContents.send('navigate', 'uplatnice'),
      accelerator: 'CmdOrCtrl+U'
    },
    // Potvrde Menu - Naglašeno
    {
      label: '▶ Potvrde',
      click: () => mainWindow && mainWindow.webContents.send('navigate', 'potvrde'),
      accelerator: 'CmdOrCtrl+P'
    },
    { type: 'separator' },
    // Settings Menu (renamed from Alati)
    {
      label: 'Podešavanja',
      submenu: [
        {
          label: 'Podešavanja',
          click: () => mainWindow && mainWindow.webContents.send('navigate', 'settings')
        },
        { type: 'separator' },
        {
          label: 'Učitaj podatke',
          submenu: [
            {
              label: 'Učitaj Uplatnice',
              click: async () => {
                if (mainWindow) {
                  mainWindow.webContents.send('navigate', 'settings')
                  // Trigger import dialog for uplatnice
                  setTimeout(() => {
                    mainWindow.webContents.send('trigger-import', 'uplatnice')
                  }, 500)
                }
              }
            },
            {
              label: 'Učitaj Potvrde',
              click: async () => {
                if (mainWindow) {
                  mainWindow.webContents.send('navigate', 'settings')
                  setTimeout(() => {
                    mainWindow.webContents.send('trigger-import', 'potvrde')
                  }, 500)
                }
              }
            }
          ]
        },
        {
          label: 'Podesi štampače',
          submenu: [
            {
              label: 'Štampač za Uplatnice',
              click: async () => {
                if (mainWindow) {
                  const printers = await mainWindow.webContents.getPrintersAsync()
                  if (printers.length === 0) {
                    dialog.showMessageBox(mainWindow, {
                      type: 'info',
                      title: 'Štampači',
                      message: 'Nema dostupnih štampača'
                    })
                    return
                  }
                  const printerNames = printers.map(p => p.name)
                  const result = await dialog.showMessageBox(mainWindow, {
                    type: 'question',
                    title: 'Izbor štampača za Uplatnice',
                    message: 'Izaberite štampač:',
                    buttons: printerNames,
                    defaultId: 0
                  })
                  if (result.response !== undefined) {
                    mainWindow.webContents.send('set-printer', {
                      type: 'uplatnice',
                      name: printerNames[result.response]
                    })
                  }
                }
              }
            },
            {
              label: 'Štampač za Potvrde',
              click: async () => {
                if (mainWindow) {
                  const printers = await mainWindow.webContents.getPrintersAsync()
                  if (printers.length === 0) {
                    dialog.showMessageBox(mainWindow, {
                      type: 'info',
                      title: 'Štampači',
                      message: 'Nema dostupnih štampača'
                    })
                    return
                  }
                  const printerNames = printers.map(p => p.name)
                  const result = await dialog.showMessageBox(mainWindow, {
                    type: 'question',
                    title: 'Izbor štampača za Potvrde',
                    message: 'Izaberite štampač:',
                    buttons: printerNames,
                    defaultId: 0
                  })
                  if (result.response !== undefined) {
                    mainWindow.webContents.send('set-printer', {
                      type: 'potvrde',
                      name: printerNames[result.response]
                    })
                  }
                }
              }
            }
          ]
        }
      ]
    },
    // { role: 'helpMenu' }
    {
      label: 'Pomoć',
      submenu: [
        {
          label: 'O aplikaciji',
          click: () => {
            if (mainWindow) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'O aplikaciji',
                message: 'Uplatnice i Potvrde',
                detail: 'Aplikaciju kreirao Vahid E.\nWeb sajt: https://vaha.net\n\nVerzija: 1.0.0'
              })
            }
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createMenu()
  createWindow()
  
  // Initialize database asynchronously after window is created
  // Use setTimeout to ensure app.getPath is available
  setTimeout(() => {
    try {
      db = new Database()
      db.initialize()
      
      // Send database status to renderer
      const sendStatus = () => {
        if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
          if (db) {
            try {
              const uplatniceCount = db.uplatnice.count()
              const potvrdeCount = db.potvrde.count()
              mainWindow.webContents.send('database-status', {
                initialized: true,
                uplatnice: uplatniceCount,
                potvrde: potvrdeCount
              })
            } catch (error) {
              mainWindow.webContents.send('database-status', {
                initialized: false,
                error: error.message
              })
            }
          }
        }
      }
      
      // Try after window loads
      if (mainWindow && mainWindow.webContents) {
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', sendStatus)
        } else {
          sendStatus()
        }
      }
    } catch (error) {
      console.error('Database initialization error:', error.message)
      if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
        const sendError = () => {
          mainWindow.webContents.send('database-status', {
            initialized: false,
            error: error.message
          })
        }
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', sendError)
        } else {
          sendError()
        }
      }
    }
  }, 100)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}).catch((error) => {
  // Handle app initialization errors
})

app.on('window-all-closed', () => {
  if (process.env.platform !== 'darwin') {
    app.quit()
  }
})

// Theme sync
ipcMain.on('set-native-theme', (event, theme) => {
  nativeTheme.themeSource = theme
})

ipcMain.handle('get-printers', async () => {
  return mainWindow.webContents.getPrintersAsync()
})

ipcMain.handle('print-silent', async (event, options) => {
  const { html, printerName, silent = true } = options

  return new Promise((resolve, reject) => {
    // Create a hidden window for printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    printWindow.webContents.once('did-finish-load', () => {
      printWindow.webContents.print({
        silent,
        deviceName: printerName || undefined,
        printBackground: true
      }, (success, error) => {
        printWindow.close()
        if (success) {
          resolve({ success: true })
        } else {
          reject(new Error(error || 'Print failed'))
        }
      })
    })
  })
})

ipcMain.handle('select-excel-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsm', 'xlsx', 'xls'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('import-excel', async (event, { filePath, type, mode }) => {
  try {
    console.log('Import Excel:', filePath, type, mode)
    if (!db) return { success: false, error: '' }
    const result = await importExcelFile(filePath, type, mode, db)
    console.log('Import result:', result)
    return { success: true, ...result }
  } catch (error) {
    console.error('Import error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('db-query', async (event, { table, method, args }) => {
  try {
    // If database is not initialized, try to initialize it
    if (!db) {
      console.warn('[IPC] Database not initialized, attempting to initialize...')
      try {
        db = new Database()
        db.initialize()
        console.log('[IPC] Database initialized successfully')
      } catch (initError) {
        console.error('[IPC] Failed to initialize database:', initError.message)
        return []
      }
    }

    if (!db) {
      console.warn('[IPC] Database still not initialized after retry')
      return []
    }

    let result
    if (table === 'uplatnice') {
      if (!db.uplatnice || !db.uplatnice[method]) {
        throw new Error(`Method ${method} not found on uplatnice service`)
      }
      if (args && Array.isArray(args) && args.length > 0) {
        result = db.uplatnice[method](...args)
      } else {
        result = db.uplatnice[method]()
      }
    } else if (table === 'potvrde') {
      if (!db.potvrde || !db.potvrde[method]) {
        throw new Error(`Method ${method} not found on potvrde service`)
      }
      if (args && Array.isArray(args) && args.length > 0) {
        result = db.potvrde[method](...args)
      } else {
        result = db.potvrde[method]()
      }
    } else {
      throw new Error(`Unknown table: ${table}`)
    }

    return result
  } catch (error) {
    console.error('[IPC] db-query error:', error)
    return []
  }
})

ipcMain.handle('select-database-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Database Files', extensions: ['db'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('load-database-file', async (event, { filePath, type }) => {
  try {
    if (!filePath || !type) {
      return { success: false, error: 'Missing filePath or type' }
    }

    if (!existsSync(filePath)) {
      return { success: false, error: 'Database file not found' }
    }

    if (type !== 'uplatnice' && type !== 'potvrde') {
      return { success: false, error: 'Invalid type. Must be "uplatnice" or "potvrde"' }
    }

    const userDataPath = app.getPath('userData')
    const dbDir = join(userDataPath, 'database')
    
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    const targetPath = join(dbDir, `${type}.db`)
    
    // Close existing database connections before copying
    try {
      if (db) {
        console.log('Closing existing database connections...')
        db.close()
        db = null // Clear reference
      }
    } catch (closeError) {
      console.warn('Error closing database (may already be closed):', closeError.message)
    }
    
    // Copy file
    copyFileSync(filePath, targetPath)
    console.log(`Copied ${type}.db to ${targetPath}`)

    // Reinitialize database - create new instance
    // Note: Native modules (better-sqlite3) can't be reloaded in same process
    // So we'll just copy the file and ask user to restart
    try {
      console.log('Initializing new database instance...')
      db = new Database()
      db.initialize()
      console.log('Database reinitialized successfully')
      
      // Notify renderer to refresh stats
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('database-reloaded')
      }
      
      return { success: true, message: `Database ${type} loaded successfully` }
    } catch (error) {
      console.error('Error reinitializing database:', error)
      // File is copied successfully, but can't reload native module
      // User needs to restart app
      return { 
        success: true, 
        message: `Database ${type} kopiran uspešno. Molimo restartujte aplikaciju (zatvorite i ponovo otvorite) da se promene primene.`,
        needsRestart: true
      }
    }
  } catch (error) {
    console.error('Load database file error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-db-stats', async () => {
  try {
    // If database is not initialized, try to initialize it
    if (!db) {
      console.warn('Database not initialized, attempting to initialize...')
      try {
        db = new Database()
        db.initialize()
        console.log('Database initialized successfully in get-db-stats')
      } catch (initError) {
        console.error('Failed to initialize database:', initError.message)
        return { uplatnice: 0, potvrde: 0 }
      }
    }

    if (!db) {
      return { uplatnice: 0, potvrde: 0 }
    }

    const uplatniceCount = db.uplatnice.count()
    const potvrdeCount = db.potvrde.count()
    return { uplatnice: uplatniceCount, potvrde: potvrdeCount }
  } catch (error) {
    console.error('get-db-stats error:', error)
    return { uplatnice: 0, potvrde: 0 }
  }
})

ipcMain.handle('get-db-debug-info', async () => {
  try {
    // If database is not initialized, try to initialize it
    if (!db) {
      try {
        db = new Database()
        db.initialize()
        console.log('Database initialized successfully in get-db-debug-info')
      } catch (initError) {
        console.error('Failed to initialize database:', initError.message)
      }
    }

    const userDataPath = app.getPath('userData')
    const dbDir = join(userDataPath, 'database')
    const targetU = join(dbDir, 'uplatnice.db')
    const targetP = join(dbDir, 'potvrde.db')
    
    const info = {
      userDataPath,
      dbDir,
      uplatniceDb: {
        path: targetU,
        exists: existsSync(targetU),
        size: existsSync(targetU) ? statSync(targetU).size : 0,
        count: 0
      },
      potvrdeDb: {
        path: targetP,
        exists: existsSync(targetP),
        size: existsSync(targetP) ? statSync(targetP).size : 0,
        count: 0
      },
      dbInitialized: !!db
    }
    
    if (db) {
      try {
        info.uplatniceDb.count = db.uplatnice.count()
        info.potvrdeDb.count = db.potvrde.count()
      } catch (error) {
        console.error('Error getting counts:', error)
      }
    }
    
    // Check for source databases in resources
    if (app.isPackaged) {
      const basePaths = []
      if (process.resourcesPath) basePaths.push(process.resourcesPath)
      if (process.execPath) {
        basePaths.push(dirname(process.execPath))
        basePaths.push(join(dirname(process.execPath), 'resources'))
      }
      if (process.env.APPDIR) {
        basePaths.push(process.env.APPDIR)
        basePaths.push(join(process.env.APPDIR, 'resources'))
      }
      
      info.sourceDatabases = []
      for (const basePath of basePaths) {
        const testU = join(basePath, 'uplatnice.db')
        const testP = join(basePath, 'potvrde.db')
        if (existsSync(testU) && existsSync(testP)) {
          info.sourceDatabases.push({
            basePath,
            uplatnice: {
              path: testU,
              size: statSync(testU).size
            },
            potvrde: {
              path: testP,
              size: statSync(testP).size
            }
          })
          break // Found first valid source
        }
      }
    }
    
    return info
  } catch (error) {
    console.error('get-db-debug-info error:', error)
    return { error: error.message }
  }
})

ipcMain.handle('migrate-excel-to-db', async (event, { filePath, type }) => {
  try {
    const userDataPath = app.getPath('userData')
    const dbDir = join(userDataPath, 'database')

    // Ensure dbDir exists
    if (!existsSync(dbDir)) {
      // mkdirSync(dbDir, { recursive: true }) // Not needed here as migrateToDb handles file creation, but usually good practice. 
      // Actually migrateExcelToDb takes projectRoot and joins 'uplatnice.db'. 
      // We want it to be inside 'database' folder in userData.
    }

    // We pass dbDir as projectRoot so it creates/updates db files inside userData/database
    const result = await migrateExcelToDb(filePath, type, dbDir)
    return { success: true, ...result }
  } catch (error) {
    console.error('migrate-excel-to-db error:', error)
    return { success: false, error: error.message }
  }
})

// F12 shortcut is now handled in createWindow() via before-input-event

// Shortcuts are registered in createWindow() now

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

