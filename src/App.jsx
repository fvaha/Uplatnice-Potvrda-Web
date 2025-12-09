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
  }, [darkMode])

  // Listen for navigation and theme changes from Electron menu
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Navigation listener
      if (window.electronAPI.onNavigate) {
        window.electronAPI.onNavigate((page) => {
          setCurrentPage(page)
        })
      }

      // Theme listener
      window.electronAPI.on('set-theme', (theme) => {
        setDarkMode(theme === 'dark')
      })

      return () => {
        if (window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('navigate')
          window.electronAPI.removeAllListeners('set-theme')
        }
      }
    }
  }, [])

  const pages = {
    dashboard: <Dashboard onNavigate={setCurrentPage} />,
    uplatnice: <UplatniceForm onNavigate={setCurrentPage} />,
    potvrde: <PotvrdeForm onNavigate={setCurrentPage} />,
    settings: <Settings onNavigate={setCurrentPage} />
  }

  try {
    return (
      <AppProvider>
        <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
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
      <div style={{ padding: '20px', color: 'red', backgroundColor: 'white' }}>
        <h1>Error in App component</h1>
        <p>{error.message}</p>
        <pre>{error.stack}</pre>
      </div>
    )
  }
}

export default App

