import Database from 'better-sqlite3'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, copyFileSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import UplatniceService from './uplatniceService.js'
import PotvrdeService from './potvrdeService.js'

class SQLiteDatabase {
  constructor() {
    // In packaged app use seeded DBs from resources, copied to userData (writable)
    // In development fallback to userData app.db
    let uplatniceDbPath
    let potvrdeDbPath
    let useSeeded = false
    const userDataPath = app.getPath('userData')
    const dbDir = join(userDataPath, 'database')
    try {
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true })
      }

      let sourceU = null
      let sourceP = null

      if (app.isPackaged) {
        // Try multiple paths for finding resources in packaged app
        const possiblePaths = []
        
        // Collect all possible base paths
        const basePaths = []
        
        // 1. process.resourcesPath (standard for most platforms)
        // This is the PRIMARY path - on Windows NSIS it points to C:\Program Files\AppName\resources
        // Bases are now directly in process.resourcesPath (not nested)
        if (process.resourcesPath) {
          basePaths.push(process.resourcesPath)
        }
        
        // 2. Directory next to exe (for portable apps) - HIGH PRIORITY for portable
        if (process.execPath) {
          const exeDir = dirname(process.execPath)
          basePaths.push(exeDir)
          // For portable, resources are in exeDir/resources/
          basePaths.push(join(exeDir, 'resources'))
        }
        
        // 3. Try to get exe directory using app.getPath (alternative method)
        try {
          const exePath = app.getPath('exe')
          if (exePath) {
            const exeDir = dirname(exePath)
            basePaths.push(exeDir)
            basePaths.push(join(exeDir, 'resources'))
          }
        } catch (e) {
          // Ignore
        }
        
        // 4. app.getAppPath() - usually points to app.asar or app directory
        try {
          basePaths.push(app.getAppPath())
        } catch (e) {
          // Ignore
        }
        
        // 5. __dirname relative (for asar unpacked)
        try {
          const mainDir = dirname(fileURLToPath(import.meta.url))
          // Go up from out/main to root, then to resources
          basePaths.push(join(mainDir, '../../resources'))
          basePaths.push(join(mainDir, '../../../resources'))
        } catch (e) {
          // Ignore
        }
        
        // 6. AppImage specific paths
        // In AppImage, process.resourcesPath points to AppImage mount point/resources
        // Also try APPDIR environment variable (AppImage standard)
        if (process.env.APPDIR) {
          basePaths.push(process.env.APPDIR)
          basePaths.push(join(process.env.APPDIR, 'resources'))
        }
        
        // 7. For AppImage, also check parent directory of execPath
        if (process.execPath && process.execPath.includes('.AppImage')) {
          const appImageDir = dirname(process.execPath)
          basePaths.push(appImageDir)
          basePaths.push(join(appImageDir, 'resources'))
        }
        
        // For each base path, try multiple sub-paths
        // IMPORTANT: Bases are now directly in process.resourcesPath (not nested)
        // So if process.resourcesPath = "C:\Program Files\App\resources"
        // Then bases are at: process.resourcesPath/uplatnice.db
        for (const basePath of basePaths) {
          if (!basePath) continue
          
          // Priority 1: Direct in base path (process.resourcesPath)
          possiblePaths.push(
            join(basePath, 'uplatnice.db'),
            join(basePath, 'potvrde.db')
          )
          
          // Priority 2: In resources subfolder (fallback for old builds and AppImage)
          possiblePaths.push(
            join(basePath, 'resources', 'uplatnice.db'),
            join(basePath, 'resources', 'potvrde.db')
          )
          
          // Priority 3: In resources/resources (fallback for very old nested structure)
          possiblePaths.push(
            join(basePath, 'resources', 'resources', 'uplatnice.db'),
            join(basePath, 'resources', 'resources', 'potvrde.db')
          )
        }
        
        // Find first valid path pair
        console.log(`Searching for databases in ${possiblePaths.length / 2} possible locations...`)
        for (let i = 0; i < possiblePaths.length; i += 2) {
          const testU = possiblePaths[i]
          const testP = possiblePaths[i + 1]
          if (testU && testP) {
            const existsU = existsSync(testU)
            const existsP = existsSync(testP)
            if (existsU && existsP) {
              sourceU = testU
              sourceP = testP
              const sizeU = statSync(testU).size
              const sizeP = statSync(testP).size
              console.log(`✓ Found databases at:`)
              console.log(`  uplatnice.db: ${testU} (${(sizeU / 1024 / 1024).toFixed(2)} MB)`)
              console.log(`  potvrde.db: ${testP} (${(sizeP / 1024 / 1024).toFixed(2)} MB)`)
              break
            }
          }
        }
        
        if (!sourceU || !sourceP) {
          console.error('✗ Databases not found in any of the checked paths!')
          console.error('Checked paths (first 10):')
          for (let i = 0; i < Math.min(20, possiblePaths.length); i += 2) {
            const testU = possiblePaths[i]
            const testP = possiblePaths[i + 1]
            if (testU && testP) {
              console.error(`  ${i / 2 + 1}. ${testU} (exists: ${existsSync(testU)})`)
              console.error(`     ${testP} (exists: ${existsSync(testP)})`)
            }
          }
          // Only log error if databases really not found (not just using existing)
          try {
            console.error('Database files not found in resources')
            if (process.resourcesPath) {
              console.error(`  process.resourcesPath: ${process.resourcesPath}`)
            }
          } catch (e) {
            // Ignore EPIPE errors when process is closing
          }
        }
      } else {
        // In development
        sourceU = join(process.cwd(), 'resources', 'uplatnice.db')
        sourceP = join(process.cwd(), 'resources', 'potvrde.db')
      }

      const targetU = join(dbDir, 'uplatnice.db')
      const targetP = join(dbDir, 'potvrde.db')

      // Helper to get file size
      const getFileSize = (path) => {
        try {
          return existsSync(path) ? statSync(path).size : 0
        } catch {
          return 0
        }
      }

      // Always copy from resources if:
      // 1. Targets don't exist, OR
      // 2. Source files are larger (newer data), OR
      // 3. Targets are too small (empty databases are usually < 100KB)
      if (sourceU && sourceP && existsSync(sourceU) && existsSync(sourceP)) {
        const sourceUSize = getFileSize(sourceU)
        const sourcePSize = getFileSize(sourceP)
        const targetUSize = getFileSize(targetU)
        const targetPSize = getFileSize(targetP)
        
        console.log('Database file sizes:')
        console.log(`  Source uplatnice.db: ${(sourceUSize / 1024 / 1024).toFixed(2)} MB at ${sourceU}`)
        console.log(`  Source potvrde.db: ${(sourcePSize / 1024 / 1024).toFixed(2)} MB at ${sourceP}`)
        console.log(`  Target uplatnice.db: ${(targetUSize / 1024 / 1024).toFixed(2)} MB at ${targetU}`)
        console.log(`  Target potvrde.db: ${(targetPSize / 1024 / 1024).toFixed(2)} MB at ${targetP}`)
        
        const shouldCopyU = !existsSync(targetU) || sourceUSize > targetUSize || targetUSize < 100 * 1024
        const shouldCopyP = !existsSync(targetP) || sourcePSize > targetPSize || targetPSize < 100 * 1024

        if (shouldCopyU) {
          copyFileSync(sourceU, targetU)
          console.log(`✓ Copied uplatnice.db from resources (${(sourceUSize / 1024 / 1024).toFixed(2)} MB) to userData`)
        } else {
          console.log(`- Skipped copying uplatnice.db (target exists and is valid)`)
        }
        if (shouldCopyP) {
          copyFileSync(sourceP, targetP)
          console.log(`✓ Copied potvrde.db from resources (${(sourcePSize / 1024 / 1024).toFixed(2)} MB) to userData`)
        } else {
          console.log(`- Skipped copying potvrde.db (target exists and is valid)`)
        }

        uplatniceDbPath = targetU
        potvrdeDbPath = targetP
        useSeeded = true
        console.log('✓ Using databases from userData (seeded from resources):', uplatniceDbPath, potvrdeDbPath)
      } else if (existsSync(targetU) && existsSync(targetP)) {
        // Fallback: use existing if resources not found
        uplatniceDbPath = targetU
        potvrdeDbPath = targetP
        useSeeded = true
        console.log('Using existing databases from userData:', uplatniceDbPath, potvrdeDbPath)
      } else {
        console.error('✗ Source database files not found!')
        console.error(`  sourceU exists: ${sourceU ? existsSync(sourceU) : 'null'}`)
        console.error(`  sourceP exists: ${sourceP ? existsSync(sourceP) : 'null'}`)
        if (sourceU) console.error(`  sourceU path: ${sourceU}`)
        if (sourceP) console.error(`  sourceP path: ${sourceP}`)
        // Log debug info if databases not found in packaged app
        if (app.isPackaged) {
          console.warn('Database files not found in resources. Tried paths:')
          if (process.resourcesPath) {
            console.warn('  - process.resourcesPath:', process.resourcesPath)
          }
          if (process.execPath) {
            console.warn('  - exe directory:', dirname(process.execPath))
          }
          try {
            console.warn('  - app.getAppPath():', app.getAppPath())
          } catch (e) {
            // Ignore
          }
        }
      }

      if (useSeeded) {
        this.uplatniceDb = new Database(uplatniceDbPath)
        this.uplatniceDb.pragma('journal_mode = WAL')
        this.registerNormalizeFunction(this.uplatniceDb)

        this.potvrdeDb = new Database(potvrdeDbPath)
        this.potvrdeDb.pragma('journal_mode = WAL')
        this.registerNormalizeFunction(this.potvrdeDb)

        this.uplatnice = new UplatniceService(this.uplatniceDb)
        this.potvrde = new PotvrdeService(this.potvrdeDb)
      } else {
        // Fallback single app.db in userData
        const dbPath = join(dbDir, 'app.db')
        this.db = new Database(dbPath)
        this.db.pragma('journal_mode = WAL')
        this.registerNormalizeFunction(this.db)
        this.uplatnice = new UplatniceService(this.db)
        this.potvrde = new PotvrdeService(this.db)
      }
    } catch (error) {
      console.error('Failed to create/open database:', error)
      console.error('User data path:', userDataPath)
      throw error
    }
  }

  registerNormalizeFunction(db) {
    // Register custom SQLite function for text normalization
    // This function normalizes Serbian/Croatian characters and converts to lowercase
    // č, ć → c; š → s; ž → z; đ → d
    db.function('NORMALIZE_TEXT', (text) => {
      if (!text || typeof text !== 'string') return ''
      
      return text
        .toLowerCase()
        .replace(/č/g, 'c')
        .replace(/ć/g, 'c')
        .replace(/š/g, 's')
        .replace(/ž/g, 'z')
        .replace(/đ/g, 'd')
        .replace(/Č/g, 'c')
        .replace(/Ć/g, 'c')
        .replace(/Š/g, 's')
        .replace(/Ž/g, 'z')
        .replace(/Đ/g, 'd')
    })
  }

  initialize() {
    // Only create tables if using user data directory (not exported databases)
    if (this.db) {
      this.uplatnice.createTable()
      this.potvrde.createTable()
    }
    // Exported databases already have tables, just verify they exist
  }

  close() {
    if (this.db) {
      this.db.close()
    }
    if (this.uplatniceDb) {
      this.uplatniceDb.close()
    }
    if (this.potvrdeDb) {
      this.potvrdeDb.close()
    }
  }
}

export default SQLiteDatabase

