import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'

// Optimized initialization - no console logs in production
function initApp() {
  const rootElement = document.getElementById('root')

  if (!rootElement) {
    document.body.innerHTML = '<div style="padding: 20px; color: red; background: white;">Root element not found!</div>'
    return
  }

  try {
    // Clear the root element before rendering React
    rootElement.innerHTML = ''
    
    const root = createRoot(rootElement)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  } catch (error) {
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 20px; color: red; font-family: Arial, sans-serif; background: white;">
          <h1>Error loading application</h1>
          <p>${error.message}</p>
          <pre>${error.stack}</pre>
        </div>
      `
    }
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  // DOM is already ready - initialize immediately
  initApp()
}

