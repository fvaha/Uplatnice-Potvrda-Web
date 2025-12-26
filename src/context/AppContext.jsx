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
    
    // Listen for database status from main process
    if (typeof window !== 'undefined' && window.electronAPI?.on) {
      window.electronAPI.on('database-status', (status) => {
        console.log('📡 Database status from main process:', status)
        if (status.initialized) {
          console.log(`✓ Database initialized: ${status.uplatnice} uplatnice, ${status.potvrde} potvrde`)
          if (status.warning) {
            console.warn('⚠', status.warning)
          }
          // Refresh stats
          loadStats()
        } else {
          console.error('❌ Database initialization failed:', status.error)
        }
      })
    }
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
        console.log('📊 Database stats loaded:', stats)
        setDbStats(stats)
        
        // Auto-check database debug info if stats are zero
        if ((stats.uplatnice === 0 && stats.potvrde === 0) && typeof window !== 'undefined' && window.electronAPI?.getDbDebugInfo) {
          console.warn('⚠ Both databases show 0 records - checking debug info...')
          try {
            const debugInfo = await window.electronAPI.getDbDebugInfo()
            console.log('🔍 Database Debug Info (full):', JSON.stringify(debugInfo, null, 2))
            
            const tableData = {
              'Uplatnice DB': {
                'Path': debugInfo.uplatniceDb?.path || 'N/A',
                'Exists': debugInfo.uplatniceDb?.exists ? '✓' : '✗',
                'Size (MB)': debugInfo.uplatniceDb?.size ? (debugInfo.uplatniceDb.size / 1024 / 1024).toFixed(2) : '0',
                'Records': debugInfo.uplatniceDb?.count || 0
              },
              'Potvrde DB': {
                'Path': debugInfo.potvrdeDb?.path || 'N/A',
                'Exists': debugInfo.potvrdeDb?.exists ? '✓' : '✗',
                'Size (MB)': debugInfo.potvrdeDb?.size ? (debugInfo.potvrdeDb.size / 1024 / 1024).toFixed(2) : '0',
                'Records': debugInfo.potvrdeDb?.count || 0
              },
              'DB Initialized': debugInfo.dbInitialized ? '✓' : '✗'
            }
            console.table(tableData)
            
            // Detailed logging
            console.log('📋 Detailed Info:')
            console.log(`  Uplatnice DB exists: ${debugInfo.uplatniceDb?.exists}`)
            console.log(`  Uplatnice DB size: ${debugInfo.uplatniceDb?.size ? (debugInfo.uplatniceDb.size / 1024 / 1024).toFixed(2) + ' MB' : '0 MB'}`)
            console.log(`  Uplatnice DB records: ${debugInfo.uplatniceDb?.count || 0}`)
            console.log(`  Potvrde DB exists: ${debugInfo.potvrdeDb?.exists}`)
            console.log(`  Potvrde DB size: ${debugInfo.potvrdeDb?.size ? (debugInfo.potvrdeDb.size / 1024 / 1024).toFixed(2) + ' MB' : '0 MB'}`)
            console.log(`  Potvrde DB records: ${debugInfo.potvrdeDb?.count || 0}`)
            console.log(`  DB Initialized: ${debugInfo.dbInitialized}`)
            
            if (debugInfo.sourceDatabases && debugInfo.sourceDatabases.length > 0) {
              console.log('📦 Source databases found:')
              debugInfo.sourceDatabases.forEach((src, idx) => {
                console.log(`  ${idx + 1}. Base: ${src.basePath}`)
                console.log(`     Uplatnice: ${src.uplatnice.path} (${(src.uplatnice.size / 1024 / 1024).toFixed(2)} MB)`)
                console.log(`     Potvrde: ${src.potvrde.path} (${(src.potvrde.size / 1024 / 1024).toFixed(2)} MB)`)
              })
              
              // Check if target databases are smaller than source (not copied properly)
              if (debugInfo.uplatniceDb?.exists && debugInfo.sourceDatabases[0]) {
                const sourceU = debugInfo.sourceDatabases[0].uplatnice.size
                const targetU = debugInfo.uplatniceDb.size
                if (targetU < sourceU * 0.9) { // Allow 10% difference
                  console.error('❌ Uplatnice DB is smaller than source! May not have been copied correctly.')
                  console.error(`   Source: ${(sourceU / 1024 / 1024).toFixed(2)} MB, Target: ${(targetU / 1024 / 1024).toFixed(2)} MB`)
                } else {
                  console.log(`✓ Uplatnice DB size matches source (${(targetU / 1024 / 1024).toFixed(2)} MB)`)
                }
              }
              if (debugInfo.potvrdeDb?.exists && debugInfo.sourceDatabases[0]) {
                const sourceP = debugInfo.sourceDatabases[0].potvrde.size
                const targetP = debugInfo.potvrdeDb.size
                if (targetP < sourceP * 0.9) { // Allow 10% difference
                  console.error('❌ Potvrde DB is smaller than source! May not have been copied correctly.')
                  console.error(`   Source: ${(sourceP / 1024 / 1024).toFixed(2)} MB, Target: ${(targetP / 1024 / 1024).toFixed(2)} MB`)
                } else {
                  console.log(`✓ Potvrde DB size matches source (${(targetP / 1024 / 1024).toFixed(2)} MB)`)
                }
              }
            } else {
              console.error('❌ No source databases found in resources!')
              console.error('   This means databases were not included in the AppImage build.')
            }
          } catch (debugError) {
            console.error('❌ Error getting debug info:', debugError)
          }
        }
      } else {
        console.warn('⚠ No database stats returned')
        setDbStats({ uplatnice: 0, potvrde: 0 })
      }
    } catch (error) {
      console.error('❌ Failed to load stats:', error)
      setDbStats({ uplatnice: 0, potvrde: 0 })
    }
  }

  // Expose debug function to window for DevTools
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getDbDebugInfo) {
      window.checkDb = async () => {
        try {
          const info = await window.electronAPI.getDbDebugInfo()
          console.log('🔍 Database Debug Info:', info)
          console.table({
            'Uplatnice DB': {
              'Path': info.uplatniceDb?.path || 'N/A',
              'Exists': info.uplatniceDb?.exists ? '✓' : '✗',
              'Size (MB)': info.uplatniceDb?.size ? (info.uplatniceDb.size / 1024 / 1024).toFixed(2) : '0',
              'Records': info.uplatniceDb?.count || 0
            },
            'Potvrde DB': {
              'Path': info.potvrdeDb?.path || 'N/A',
              'Exists': info.potvrdeDb?.exists ? '✓' : '✗',
              'Size (MB)': info.potvrdeDb?.size ? (info.potvrdeDb.size / 1024 / 1024).toFixed(2) : '0',
              'Records': info.potvrdeDb?.count || 0
            },
            'DB Initialized': info.dbInitialized ? '✓' : '✗'
          })
          if (info.sourceDatabases && info.sourceDatabases.length > 0) {
            console.log('📦 Source databases found:', info.sourceDatabases)
          } else {
            console.warn('⚠ No source databases found in resources')
          }
          return info
        } catch (error) {
          console.error('❌ Error getting debug info:', error)
          return null
        }
      }
      console.log('💡 Tip: Run window.checkDb() in console to see database debug info')
    }
  }, [])

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
