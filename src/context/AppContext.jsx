import { createContext, useContext, useState, useEffect } from 'react'
import { databaseService } from '../services/databaseService.js'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [dbStats, setDbStats] = useState({ uplatnice: 0, potvrde: 0 })
  const [printers, setPrinters] = useState([])
  const [selectedPrinters, setSelectedPrinters] = useState({
    potvrde: null,
    uplatnice: null
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load immediately - no delay for faster startup
    loadPrinterSettings()
    loadTaxPrices()
    // Load async data in background
    loadStats()
    loadPrinters()
  }, [])

  const [taxPrices, setTaxPrices] = useState({
    taksa_300: 300,
    taksa_400: 400
  })

  // ... (listeners) ...

  const loadTaxPrices = () => {
    const saved = localStorage.getItem('taxPrices')
    if (saved) {
      setTaxPrices(JSON.parse(saved))
    }
  }

  const saveTaxPrices = (prices) => {
    setTaxPrices(prices)
    localStorage.setItem('taxPrices', JSON.stringify(prices))
  }

  // Listen for printer selection from Electron menu
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.onSetPrinter) {
      window.electronAPI.onSetPrinter((data) => {
        const newSettings = {
          ...selectedPrinters,
          [data.type]: data.name
        }
        savePrinterSettings(newSettings)
      })
      return () => {
        if (window.electronAPI && window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('set-printer')
        }
      }
    }
  }, [selectedPrinters])

  const loadStats = async () => {
    try {
      const stats = await databaseService.getStats()
      if (stats) {
        setDbStats(stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
      // Set default stats on error
      setDbStats({ uplatnice: 0, potvrde: 0 })
    }
  }

  const loadPrinters = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const printerList = await window.electronAPI.getPrinters()
        setPrinters(printerList)
      } else {
        setPrinters([])
      }
    } catch (error) {
      console.error('Failed to load printers:', error)
    }
  }

  const loadPrinterSettings = () => {
    const saved = localStorage.getItem('printerSettings')
    if (saved) {
      setSelectedPrinters(JSON.parse(saved))
    }
  }

  const savePrinterSettings = (settings) => {
    setSelectedPrinters(settings)
    localStorage.setItem('printerSettings', JSON.stringify(settings))
  }

  const refreshStats = () => {
    loadStats()
  }

  return (
    <AppContext.Provider
      value={{
        dbStats,
        printers,
        selectedPrinters,
        loading,
        setLoading,
        refreshStats,
        savePrinterSettings,
        loadPrinters,
        taxPrices,
        saveTaxPrices
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

