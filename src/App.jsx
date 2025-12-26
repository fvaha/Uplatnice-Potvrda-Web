import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Layout from './components/Layout.jsx'
import Dashboard from './components/Dashboard.jsx'
import UplatniceForm from './components/UplatniceForm.jsx'
import PotvrdeForm from './components/PotvrdeForm.jsx'
import Settings from './components/Settings.jsx'
import Login from './components/Login.jsx'
import { AppProvider } from './context/AppContext.jsx'

const API_BASE = '/uplatnice/api'

function App() {
  const [currentPage, setCurrentPage] = useState('uplatnice')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
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

    // Sync native theme (only in Electron)
    if (typeof window !== 'undefined' && window.electronAPI?.setNativeTheme) {
      window.electronAPI.setNativeTheme(darkMode ? 'dark' : 'light')
    }
  }, [darkMode])

  // Check authentication on mount (ONLY for web version, Electron skips this)
  useEffect(() => {
    const isElectron = typeof window !== 'undefined' && window.electronAPI
    
    // Electron version: Skip authentication completely, always authenticated
    if (isElectron) {
      setIsAuthenticated(true)
      setCheckingAuth(false)
      return
    }
    
    // Web version: Check authentication

    // Check if user is authenticated
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token')
      const authTime = localStorage.getItem('auth_time')
      
      // Check if token exists and is not expired (24 hours)
      if (token && authTime) {
        const timeDiff = Date.now() - parseInt(authTime)
        if (timeDiff < 86400000) { // 24 hours
          // Verify token with server
          try {
            const response = await fetch(`${API_BASE}/auth.php`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'verify',
                token
              })
            })
            
            const data = await response.json()
            if (data.success && data.authenticated) {
              setIsAuthenticated(true)
            } else {
              localStorage.removeItem('auth_token')
              localStorage.removeItem('auth_time')
              setIsAuthenticated(false)
            }
          } catch (error) {
            console.error('Auth verification error:', error)
            setIsAuthenticated(false)
          }
        } else {
          // Token expired
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_time')
          setIsAuthenticated(false)
        }
      } else {
        setIsAuthenticated(false)
      }
      
      setCheckingAuth(false)
    }

    checkAuth()
  }, [])

  // Listen for navigation and theme changes from Electron menu (only in Electron)
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
    }
  }, [])

  const handleLogin = (token) => {
    setIsAuthenticated(true)
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'logout' })
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
    
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_time')
    setIsAuthenticated(false)
  }

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

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Učitavanje...</div>
      </div>
    )
  }

  // Show login screen ONLY for web version if not authenticated
  // Electron version never shows login (always authenticated)
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  if (!isElectron && !isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  try {
    return (
      <AppProvider>
        <div className="h-screen w-screen overflow-hidden text-foreground bg-background">
          <Layout 
            onLogout={!isElectron ? handleLogout : undefined}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            currentPage={currentPage}
            onNavigate={!isElectron ? setCurrentPage : undefined}
          >
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

