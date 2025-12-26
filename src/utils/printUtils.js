/**
 * Print utility functions for web and Electron
 */

/**
 * Check if Web Print API is available
 */
export function isWebPrintAPIAvailable() {
  return typeof navigator !== 'undefined' && 'print' in navigator && 'printer' in navigator
}

/**
 * Check if running in Electron
 */
export function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI
}

/**
 * Print HTML content using browser print dialog
 * @param {string} html - HTML content to print
 * @param {Object} options - Print options
 * @returns {Promise<void>}
 */
export async function printHTML(html, options = {}) {
  const { 
    silent = false, 
    printerName = null,
    showPrintDialog = true,
    downloadPDF = false 
  } = options

  // Electron path
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.printSilent({
      html,
      printerName: printerName || 'default',
      silent
    })
  }

  // Web Print API (experimental, Chrome/Edge only)
  if (isWebPrintAPIAvailable() && printerName && !showPrintDialog) {
    try {
      // Note: Web Print API is still experimental
      // This is a placeholder for future implementation
      console.log('Web Print API not fully implemented yet')
    } catch (error) {
      console.warn('Web Print API failed, falling back to browser print:', error)
    }
  }

  // Browser print dialog (default for web)
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        reject(new Error('Pop-up blocker prevented print window'))
        return
      }

      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()

      // Wait for content to load
      printWindow.onload = () => {
        setTimeout(() => {
          if (downloadPDF) {
            // Trigger print dialog which allows saving as PDF
            printWindow.print()
            // Don't close immediately if downloading PDF
            setTimeout(() => {
              printWindow.close()
              resolve()
            }, 1000)
          } else {
            // Regular print
            printWindow.print()
            // Close after print dialog is shown
            setTimeout(() => {
              printWindow.close()
              resolve()
            }, 500)
          }
        }, 250)
      }

      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.print()
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close()
            }
            resolve()
          }, 500)
        }
      }, 1000)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Download HTML as PDF (using browser print to PDF)
 * @param {string} html - HTML content
 * @param {string} filename - PDF filename
 * @returns {Promise<void>}
 */
export async function downloadHTMLAsPDF(html, filename = 'document.pdf') {
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        reject(new Error('Pop-up blocker prevented PDF download'))
        return
      }

      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()

      printWindow.onload = () => {
        setTimeout(() => {
          // Trigger print dialog - user can choose "Save as PDF"
          printWindow.print()
          // Keep window open longer for PDF save
          setTimeout(() => {
            printWindow.close()
            resolve()
          }, 2000)
        }, 250)
      }

      // Fallback
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.print()
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close()
            }
            resolve()
          }, 2000)
        }
      }, 1000)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Get available printers (web browsers don't expose this easily)
 * @returns {Promise<Array>}
 */
export async function getAvailablePrinters() {
  if (isElectron() && window.electronAPI?.getPrinters) {
    return await window.electronAPI.getPrinters()
  }

  // Web browsers don't expose printer list for security reasons
  // Return empty array or default printer info
  return []
}

