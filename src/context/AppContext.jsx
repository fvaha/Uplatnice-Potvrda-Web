import { createContext, useContext, useState, useEffect } from 'react'
import { databaseService } from '../services/databaseService.js'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [dbStats, setDbStats] = useState({ uplatnice: 0, potvrde: 0 })
  const [printers, setPrinters] = useState([])
  const [printersLoading, setPrintersLoading] = useState(false)
  const [selectedPrinters, setSelectedPrinters] = useState({
    potvrde: null,
    uplatnice: null
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPrinterSettings()
    loadTaxPrices()
    loadStats()
    loadPrinters()
  }, [])

  const [taxPrices, setTaxPrices] = useState({
    taksa_300: 300,
    taksa_400: 400
  })

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
      setDbStats({ uplatnice: 0, potvrde: 0 })
    }
  }

  const loadPrinters = async () => {
    try {
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      if (!isElectron) {
        setPrinters([])
        return
      }

      setPrintersLoading(true)
      const printerList = await window.electronAPI.getPrinters()
      setPrinters(Array.isArray(printerList) ? printerList : [])
    } catch (error) {
      console.error('Failed to load printers:', error)
      setPrinters([])
    } finally {
      setPrintersLoading(false)
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
        printersLoading,
        selectedPrinters,
        loading,
        setLoading,
        refreshStats,
        savePrinterSettings,
        loadPrinters,
        taxPrices,
        saveTaxPrices,
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
