import { LogOut, Moon, Sun, FileText, Receipt } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export default function Layout({ children, onLogout, darkMode, setDarkMode, currentPage, onNavigate }) {
  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  const isElectron = typeof window !== 'undefined' && window.electronAPI
  const showNavigation = !isElectron && onNavigate

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {(showNavigation || onLogout || setDarkMode) && (
        <div className="flex justify-between items-center gap-2 p-2 border-b bg-muted/30">
          {/* Navigation tabs - only for web version */}
          {showNavigation && (
            <div className="flex items-center gap-1">
              <Button
                variant={currentPage === 'uplatnice' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onNavigate('uplatnice')}
                className={cn(
                  "gap-2",
                  currentPage === 'uplatnice' && "bg-primary text-primary-foreground"
                )}
              >
                <FileText size={16} />
                UPLATNICE
              </Button>
              <Button
                variant={currentPage === 'potvrde' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onNavigate('potvrde')}
                className={cn(
                  "gap-2",
                  currentPage === 'potvrde' && "bg-primary text-primary-foreground"
                )}
              >
                <Receipt size={16} />
                POTVRDE
              </Button>
            </div>
          )}
          
          {/* Right side: Dark mode and Logout */}
          <div className="flex items-center gap-2 ml-auto">
            {setDarkMode && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleDarkMode}
                className="gap-2"
                title={darkMode ? 'Prebaci na svetli režim' : 'Prebaci na tamni režim'}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                {darkMode ? 'Svetli' : 'Tamni'}
              </Button>
            )}
            {onLogout && (
              <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
                <LogOut size={16} />
                Odjavi se
              </Button>
            )}
          </div>
        </div>
      )}
      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
