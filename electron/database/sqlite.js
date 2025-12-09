import Database from 'better-sqlite3'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import UplatniceService from './uplatniceService.js'
import PotvrdeService from './potvrdeService.js'

class SQLiteDatabase {
  constructor() {
    // Try to use exported databases from project root first
    // In development: use process.cwd()
    // In production: use app.getAppPath() or resources path
    // Always use process.cwd() to find exported databases in project root
    const projectRoot = process.cwd()
    const uplatniceDbPath = join(projectRoot, 'uplatnice.db')
    const potvrdeDbPath = join(projectRoot, 'potvrde.db')
    
    // Check if exported databases exist
    let useExported = existsSync(uplatniceDbPath) && existsSync(potvrdeDbPath)
    
    if (useExported) {
      try {
        // Use exported databases
        this.uplatniceDb = new Database(uplatniceDbPath)
        this.uplatniceDb.pragma('journal_mode = WAL')
        
        this.potvrdeDb = new Database(potvrdeDbPath)
        this.potvrdeDb.pragma('journal_mode = WAL')
        
        this.uplatnice = new UplatniceService(this.uplatniceDb)
        this.potvrde = new PotvrdeService(this.potvrdeDb)
        console.log('Using exported databases:', uplatniceDbPath, potvrdeDbPath)
      } catch (error) {
        console.error('Error opening exported databases:', error.message)
        // Fall through to user data directory
        useExported = false
      }
    }
    
    if (!useExported) {
      // Fallback to user data directory
      const userDataPath = app.getPath('userData')
      const dbDir = join(userDataPath, 'database')
      
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true })
      }
      
      const dbPath = join(dbDir, 'app.db')
      this.db = new Database(dbPath)
      this.db.pragma('journal_mode = WAL')
      
      this.uplatnice = new UplatniceService(this.db)
      this.potvrde = new PotvrdeService(this.db)
    }
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

