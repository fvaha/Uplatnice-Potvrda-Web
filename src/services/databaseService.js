import { uplatniceDB } from '../utils/uplatniceDB.js'
import { potvrdeDB } from '../utils/potvrdeDB.js'

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

export const databaseService = {
  async uplatnice(method, ...args) {
    try {
      if (isElectron()) {
        return await window.electronAPI.dbQuery({ table: 'uplatnice', method, args })
      } else {
        return await uplatniceDB[method](...args)
      }
    } catch (error) {
      console.error('Database error (uplatnice):', error)
      return []
    }
  },

  async potvrde(method, ...args) {
    try {
      if (isElectron()) {
        return await window.electronAPI.dbQuery({ table: 'potvrde', method, args })
      } else {
        return await potvrdeDB[method](...args)
      }
    } catch (error) {
      console.error('Database error (potvrde):', error)
      return []
    }
  },

  async getStats() {
    try {
      if (isElectron()) {
        return await window.electronAPI.getDbStats()
      } else {
        const [uplatnice, potvrde] = await Promise.all([
          uplatniceDB.count(),
          potvrdeDB.count()
        ])
        return { uplatnice, potvrde }
      }
    } catch (error) {
      console.error('Database stats error:', error)
      return { uplatnice: 0, potvrde: 0 }
    }
  }
}

