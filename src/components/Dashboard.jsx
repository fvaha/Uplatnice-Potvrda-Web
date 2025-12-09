import { motion } from 'framer-motion'
import { FileText, Receipt, Database, Settings } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card.jsx'

export default function Dashboard({ onNavigate }) {
  const { dbStats } = useApp()

  const cards = [
    {
      id: 'uplatnice',
      title: 'Uplatnice',
      description: 'Štampanje uplatnica',
      icon: FileText,
      count: dbStats.uplatnice,
      onClick: () => onNavigate('uplatnice')
    },
    {
      id: 'potvrde',
      title: 'Potvrde',
      description: 'Štampanje potvrda',
      icon: Receipt,
      count: dbStats.potvrde,
      onClick: () => onNavigate('potvrde')
    },
    {
      id: 'settings',
      title: 'Podešavanja',
      description: 'Učitaj podatke i podesi štampače',
      icon: Settings,
      onClick: () => onNavigate('settings')
    }
  ]

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-left"
      >
        <h1 className="text-3xl font-bold tracking-tight">
          Dobrodošli
        </h1>
        <p className="text-muted-foreground">
          Izaberite opciju za štampanje ili upravljanje podacima
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={card.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors h-full">
                <CardHeader>
                  <Icon className="h-8 w-8 mb-2" />
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                {card.count !== undefined && (
                  <CardContent>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Database size={16} />
                      <span>{card.count.toLocaleString()} zapisa</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

