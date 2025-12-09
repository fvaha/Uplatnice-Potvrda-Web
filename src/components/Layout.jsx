import { motion } from 'framer-motion'
import { Home, FileText, Receipt, Settings, Moon, Sun } from 'lucide-react'
import { Button } from './ui/button.jsx'
import { cn } from '../lib/utils.js'

export default function Layout({ children }) {
  return (
    <div className="h-full flex flex-col bg-background">
      <main className="flex-1 overflow-hidden p-0">
        {children}
      </main>
    </div>
  )
}

