import { motion } from 'framer-motion'
import { X, Printer } from 'lucide-react'
import { generateUplatnicaHTML, generatePotvrdaHTML } from '../utils/printTemplates.js'

export default function PrintPreview({ data, type, onClose, onPrint }) {
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Print Preview - {type === 'uplatnice' ? 'Uplatnica' : 'Potvrda'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={24} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-0 shadow-lg flex-1 overflow-hidden relative">
          <iframe
            srcDoc={type === 'uplatnice' ? generateUplatnicaHTML(data) : generatePotvrdaHTML(data)}
            className="w-full h-full border-none"
            title="Print Preview"
          />
        </div>

        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg glass border border-white/20 hover:bg-white/10 text-gray-900 dark:text-white"
          >
            Otkaži
          </button>
          <button
            onClick={onPrint}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium flex items-center space-x-2"
          >
            <Printer size={18} />
            <span>Štampaj</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

