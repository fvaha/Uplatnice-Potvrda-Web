import { uplatniceDB } from '../utils/uplatniceDB.js'
import { potvrdeDB } from '../utils/potvrdeDB.js'

const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

const API_BASE = '/uplatnice/api/api.php'

async function callApi(table, action, params = []) {
  try {
    // Get auth token
    const token = localStorage.getItem('auth_token')
    
    const headers = {
      'Content-Type': 'application/json',
    }
    
    // Add token to request if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(`${API_BASE}/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        action, 
        params,
        token // Also send token in body for compatibility
      })
    })

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `API error: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
          if (errorData.message) {
            errorMessage += ' - ' + errorData.message
          }
        }
      } catch (e) {
        // Couldn't parse error response
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`API error (${table}/${action}):`, error)
    throw error
  }
}

export const databaseService = {
  async uplatnice(method, ...args) {
    try {
      if (isElectron()) {
        return await window.electronAPI.dbQuery({ table: 'uplatnice', method, args })
      } else {
        // Use PHP API for web
        return await callApi('uplatnice', method, args)
      }
    } catch (error) {
      console.error('Database error (uplatnice):', error)
      // Fallback to IndexedDB if API fails
      try {
        return await uplatniceDB[method](...args)
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError)
        return []
      }
    }
  },

  async potvrde(method, ...args) {
    try {
      if (isElectron()) {
        return await window.electronAPI.dbQuery({ table: 'potvrde', method, args })
      } else {
        // Use PHP API for web
        return await callApi('potvrde', method, args)
      }
    } catch (error) {
      console.error('Database error (potvrde):', error)
      // Fallback to IndexedDB if API fails
      try {
        return await potvrdeDB[method](...args)
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError)
        return []
      }
    }
  },

  async getStats() {
    try {
      if (isElectron()) {
        return await window.electronAPI.getDbStats()
      } else {
        // Use PHP API for web
        return await callApi('uplatnice', 'getStats', [])
      }
    } catch (error) {
      console.error('Database stats error:', error)
      // Fallback to IndexedDB if API fails
      try {
        const [uplatnice, potvrde] = await Promise.all([
          uplatniceDB.count(),
          potvrdeDB.count()
        ])
        return { uplatnice, potvrde }
      } catch (fallbackError) {
        return { uplatnice: 0, potvrde: 0 }
      }
    }
  }
}

