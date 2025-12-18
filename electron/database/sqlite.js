import Database from 'better-sqlite3'
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
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

      let sourceU, sourceP

      if (app.isPackaged) {
        // process.resourcesPath is the reliable path to the resources folder in production
        sourceU = join(process.resourcesPath, 'uplatnice.db')
        sourceP = join(process.resourcesPath, 'potvrde.db')

        // Fallback for some environments if they are inside a subfolder
        if (!existsSync(sourceU)) {
          sourceU = join(process.resourcesPath, 'resources', 'uplatnice.db')
          sourceP = join(process.resourcesPath, 'resources', 'potvrde.db')
        }
      } else {
        // In development
        sourceU = join(process.cwd(), 'resources', 'uplatnice.db')
        sourceP = join(process.cwd(), 'resources', 'potvrde.db')
      }

      const targetU = join(dbDir, 'uplatnice.db')
      const targetP = join(dbDir, 'potvrde.db')

      // 1. If targets exist in userData, use them (Persistent Data)
      if (existsSync(targetU) && existsSync(targetP)) {
        uplatniceDbPath = targetU
        potvrdeDbPath = targetP
        useSeeded = true
      }
      // 2. If targets incomplete, try to seed from resources
      else if (existsSync(sourceU) && existsSync(sourceP)) {
        if (!existsSync(targetU)) copyFileSync(sourceU, targetU)
        if (!existsSync(targetP)) copyFileSync(sourceP, targetP)

        uplatniceDbPath = targetU
        potvrdeDbPath = targetP
        useSeeded = true
      }

      if (useSeeded) {
        this.uplatniceDb = new Database(uplatniceDbPath)
        this.uplatniceDb.pragma('journal_mode = WAL')

        this.potvrdeDb = new Database(potvrdeDbPath)
        this.potvrdeDb.pragma('journal_mode = WAL')

        this.uplatnice = new UplatniceService(this.uplatniceDb)
        this.potvrde = new PotvrdeService(this.potvrdeDb)
        console.log('Using seeded databases from resources -> userData:', uplatniceDbPath, potvrdeDbPath)
      } else {
        // Fallback single app.db in userData
        const dbPath = join(dbDir, 'app.db')
        this.db = new Database(dbPath)
        this.db.pragma('journal_mode = WAL')
        this.uplatnice = new UplatniceService(this.db)
        this.potvrde = new PotvrdeService(this.db)
      }
    } catch (error) {
      console.error('Failed to create/open database:', error)
      console.error('User data path:', userDataPath)
      throw error
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

