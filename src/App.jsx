import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.jsx'
import UplatniceForm from './components/UplatniceForm.jsx'
import PotvrdeForm from './components/PotvrdeForm.jsx'
import Settings from './components/Settings.jsx'
import { AppProvider } from './context/AppContext.jsx'

function App() {
  const [currentPage, setCurrentPage] = useState('uplatnice')
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode')
      if (saved) return saved === 'true'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', darkMode.toString())

    // Sync native theme
    if (window.electronAPI?.setNativeTheme) {
      window.electronAPI.setNativeTheme(darkMode ? 'dark' : 'light')
    }
  }, [darkMode])

  // Listen for navigation and theme changes from Electron menu
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('Setting up navigation listeners...')

      // Navigation listener using onNavigate callback
      if (window.electronAPI.onNavigate) {
        console.log('Using onNavigate callback')
        window.electronAPI.onNavigate((page) => {
          console.log('Navigation event received via onNavigate:', page)
          setCurrentPage(page)
        })
      }

      // Also listen directly to IPC events as fallback
      if (window.electronAPI.on) {
        console.log('Setting up direct IPC listener for navigate')
        window.electronAPI.on('navigate', (page) => {
          console.log('Navigation event received via IPC on:', page)
          setCurrentPage(page)
        })
      }

      // Theme listener
      if (window.electronAPI.on) {
        window.electronAPI.on('set-theme', (theme) => {
          setDarkMode(theme === 'dark')
        })
      }

      return () => {
        if (window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('navigate')
          window.electronAPI.removeAllListeners('set-theme')
        }
      }
    } else {
      console.warn('window.electronAPI not available')
    }
  }, [])

  const pages = {
    dashboard: <Dashboard onNavigate={setCurrentPage} />,
    uplatnice: <UplatniceForm onNavigate={setCurrentPage} />,
    potvrde: <PotvrdeForm onNavigate={setCurrentPage} />,
    settings: <Settings
      onNavigate={setCurrentPage}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
    />
  }

  try {
    return (
      <AppProvider>
        <div className="h-screen w-screen overflow-hidden text-foreground bg-background">
          <Layout>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {pages[currentPage]}
              </motion.div>
            </AnimatePresence>
          </Layout>
        </div>
      </AppProvider>
    )
  } catch (error) {
    console.error('Error in App component:', error)
    return (
      <div className="p-5 bg-background text-foreground">
        <h1 className="text-destructive text-xl font-bold mb-2">Error in App component</h1>
        <p className="text-foreground mb-2">{error.message}</p>
        <pre className="text-muted-foreground text-xs overflow-auto">{error.stack}</pre>
      </div>
    )
  }
}

export default App

