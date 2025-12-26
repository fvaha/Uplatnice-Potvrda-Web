import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Printer, Download } from 'lucide-react'
import { generateUplatnicaHTML, generatePotvrdaHTML } from '../utils/printTemplates.js'
import { printHTML, downloadHTMLAsPDF } from '../utils/printUtils.js'
import { Button } from './ui/button'

export default function PrintPreview({ data, type, onClose, onPrint }) {
  const [html, setHtml] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const loadHTML = async () => {
      const generatedHTML = type === 'uplatnice' 
        ? await generateUplatnicaHTML(data) 
        : generatePotvrdaHTML(data)
      setHtml(generatedHTML)
    }
    loadHTML()
  }, [data, type])

  const handleDownloadPDF = async () => {
    if (!html) return
    
    setDownloading(true)
    try {
      const filename = type === 'uplatnice' 
        ? `uplatnica_${data.jmbg || 'document'}.pdf`
        : `potvrda_${data.jmbg || 'document'}.pdf`
      
      await downloadHTMLAsPDF(html, filename)
    } catch (error) {
      console.error('PDF download failed:', error)
      alert('Greška pri preuzimanju PDF-a: ' + error.message)
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = async () => {
    if (onPrint) {
      onPrint()
    } else if (html) {
      try {
        await printHTML(html, { showPrintDialog: true })
      } catch (error) {
        console.error('Print failed:', error)
        alert('Greška pri štampanju: ' + error.message)
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-4 max-w-[95vw] w-full h-[95vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-2xl font-bold text-foreground">
            Print Preview - {type === 'uplatnice' ? 'Uplatnica' : 'Potvrda'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <X size={24} className="text-muted-foreground" />
          </button>
        </div>

        <div className="bg-card rounded-lg p-0 shadow-lg flex-1 overflow-hidden relative">
          {html ? (
            <iframe
              srcDoc={html}
              className="w-full h-full border-none"
              title="Print Preview"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-muted-foreground">Učitavanje...</div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Otkaži
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={!html || downloading}
            className="flex items-center space-x-2"
          >
            <Download size={18} />
            <span>{downloading ? 'Preuzimanje...' : 'Preuzmi PDF'}</span>
          </Button>
          <Button
            variant="default"
            onClick={handlePrint}
            disabled={!html}
            className="flex items-center space-x-2"
          >
            <Printer size={18} />
            <span>Štampaj</span>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

