import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Printer, Receipt, X, History as HistoryIcon, FileText } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { databaseService } from '../services/databaseService.js'
import { generatePotvrdaHTML } from '../utils/printTemplates.js'
import { Button } from './ui/button.jsx'
import { Input } from './ui/input.jsx'
import { Label } from './ui/label.jsx'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx'
import PrintPreview from './PrintPreview.jsx'

function formatPIB(pib) {
  if (!pib) return ''
  return pib.toString()
}

export default function PotvrdeForm({ onNavigate }) {
  const { selectedPrinters } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedPotvrda, setSelectedPotvrda] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    jmbg: '',
    pib: '',
    obveznik: '',
    adresa_obveznika: '',
    adresa_objekta: '',
    vrsta_nepokretnosti: '',
    vrsta_prava: '',
    oporeziva_povrsina: '',
    sifra_akta: '',
    broj_prijave: '',
    svrha: 'DEČIJEG DODATKA',
    svrha2: 'PREBIVALIŠTA',
    status_lica: ''
  })

  // Load history from local storage
  useEffect(() => {
    const history = localStorage.getItem('potvrde_search_history')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (e) {
        console.error('Failed to parse search history', e)
      }
    }
  }, [])

  // Update form data when selection changes
  useEffect(() => {
    if (selectedPotvrda) {
      setFormData({
        jmbg: selectedPotvrda.jmbg || '',
        pib: selectedPotvrda.pib || '',
        obveznik: selectedPotvrda.obveznik || '', // Changed from ime_prezime_naziv
        adresa_obveznika: selectedPotvrda.adresa_obveznika || '',
        adresa_objekta: selectedPotvrda.adresa_objekta || '', // Changed from ulica_i_broj
        vrsta_nepokretnosti: selectedPotvrda.vrsta_nepokretnosti || '',
        vrsta_prava: selectedPotvrda.vrsta_prava || '',
        oporeziva_povrsina: selectedPotvrda.oporeziva_povrsina || '',
        sifra_akta: selectedPotvrda.sifra_akta || '',
        broj_prijave: selectedPotvrda.broj_prijave || '',
        status_lica: selectedPotvrda.status_lica || '',
        svrha: 'DEČIJEG DODATKA',
        svrha2: 'PREBIVALIŠTA'
      })
    }
  }, [selectedPotvrda])

  const handleSearch = async (e, directTerm = null) => {
    e.preventDefault()
    const term = directTerm || searchQuery

    if (!term.trim()) {
      setResults([])
      return
    }

    // Add to history
    if (!searchHistory.includes(term.trim())) {
      const newHistory = [term.trim(), ...searchHistory].slice(0, 5)
      setSearchHistory(newHistory)
      localStorage.setItem('potvrde_search_history', JSON.stringify(newHistory))
    }

    try {
      const data = await databaseService.potvrde('search', term)
      setResults(data || [])
      setShowHistory(false)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    }
  }

  const handlePrint = async () => {
    if (!selectedPotvrda) {
      alert('Molimo izaberite potvrdu iz baze!')
      return
    }

    setPrinting(true)
    try {
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      const printerName = selectedPrinters.potvrde || 'default'

      const printData = {
        ...formData
      }

      const html = generatePotvrdaHTML(printData)

      if (isElectron && window.electronAPI) {
        await window.electronAPI.printSilent({
          html,
          printerName,
          silent: true
        })
      } else {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
        }, 250)
      }
    } catch (error) {
      console.error('Print failed:', error)
      alert('Greška pri štampanju: ' + error.message)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="h-full flex flex-col p-4 w-full">
      {/* Header removed as requested */}

      <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">
        {/* Leva kolona - Pretraga - FIXED WIDTH */}
        <div className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-4 overflow-hidden h-full">
          <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-muted/30 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Search size={18} className="text-muted-foreground" />
                <CardTitle className="text-base">Pretraga POTVRDA</CardTitle>
              </div>
            </CardHeader>
            <div className="p-4 pb-0 flex-shrink-0 relative z-20">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="JMBG, ime, adresa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowHistory(true)}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    className="pl-9"
                    autoComplete="off"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  {showHistory && searchHistory.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md py-1 max-h-[200px] overflow-y-auto z-50">
                      {searchHistory
                        .filter(term => term.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((term, index) => (
                          <div
                            key={index}
                            className="px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm flex items-center gap-2"
                            onClick={() => {
                              setSearchQuery(term)
                              handleSearch({ preventDefault: () => { } }, term)
                            }}
                          >
                            <HistoryIcon size={14} className="text-muted-foreground" />
                            <span>{term}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <Button type="submit">Pretraži</Button>
              </form>
            </div>

            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 pt-4 space-y-2">
              {results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nema rezultata
                </div>
              ) : (
                results.map((item) => (
                  <motion.div
                    key={item.id || `${item.jmbg}_${item.sifra_akta}_${item.broj_prijave}`}
                    onClick={() => setSelectedPotvrda(item)}
                    className={`p-3 rounded-md border cursor-pointer transition-all text-sm group ${selectedPotvrda?.id === item.id ||
                      (selectedPotvrda?.jmbg === item.jmbg &&
                        selectedPotvrda?.sifra_akta === item.sifra_akta &&
                        selectedPotvrda?.broj_prijave === item.broj_prijave)
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent hover:border-border hover:bg-muted/50'
                      }`}
                    whileHover={{ scale: 0.995 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="font-medium flex items-center justify-between mb-1">
                      <span className="truncate">{item.obveznik || 'N/A'}</span>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground gap-2 mb-1">
                      <Receipt size={12} />
                      <span>{item.jmbg}</span>
                      <span>•</span>
                      <span>PIB: {formatPIB(item.pib)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate opacity-70">
                      {item.adresa_objekta}
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>

            <div className="p-4 border-t bg-muted/30 flex-shrink-0 mt-auto">
              {selectedPotvrda ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Izabrano:</div>
                      <div className="font-semibold text-sm truncate max-w-[200px]">{formData.obveznik || selectedPotvrda.obveznik}</div> {/* Used formData.obveznik */}
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {formData.jmbg || selectedPotvrda.jmbg} • {formatPIB(formData.pib) || formatPIB(selectedPotvrda.pib)} {/* Used formData.jmbg and formData.pib */}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 -mr-2 -mt-1"
                      onClick={() => {
                        setSelectedPotvrda(null)
                        setFormData({ // Reset form data when selection is cleared
                          jmbg: '',
                          pib: '',
                          obveznik: '',
                          adresa_obveznika: '',
                          adresa_objekta: '',
                          vrsta_nepokretnosti: '',
                          vrsta_prava: '',
                          oporeziva_povrsina: '',
                          sifra_akta: '',
                          broj_prijave: '',
                          svrha: 'DEČIJEG DODATKA',
                          svrha2: 'PREBIVALIŠTA'
                        })
                      }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full" size="sm" onClick={() => setShowPreview(true)}>
                      <FileText size={16} className="mr-2" /> Pregled
                    </Button>
                    <Button variant="default" className="w-full" size="sm" onClick={handlePrint} disabled={printing}>
                      <Printer size={16} className="mr-2" /> Štampaj
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  Izaberite potvrdu za obradu
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Desna kolona - Forma - FLEX GROW */}
        <div className="flex-1 overflow-auto min-w-0 flex flex-col gap-3">
          {/* Podaci o obvezniku */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Podaci o obvezniku</CardTitle>
                {formData.status_lica && formData.status_lica.toUpperCase().includes('UMRL') && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
                    <span className="text-red-600 dark:text-red-400 text-sm font-semibold">⚠ UMRLA OSOBA</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="jmbg" className="text-xs">JMBG:</Label>
                  <Input
                    id="jmbg"
                    type="text"
                    value={formData.jmbg}
                    onChange={(e) => setFormData(prev => ({ ...prev, jmbg: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pib" className="text-xs">PIB:</Label>
                  <Input
                    id="pib"
                    type="text"
                    value={formData.pib}
                    onChange={(e) => setFormData(prev => ({ ...prev, pib: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="obveznik" className="text-xs">Ime i prezime / Naziv:</Label>
                  <Input
                    id="obveznik"
                    type="text"
                    value={formData.obveznik}
                    onChange={(e) => setFormData(prev => ({ ...prev, obveznik: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-4">
                  <Label htmlFor="adresa_obveznika" className="text-xs">Adresa obveznika:</Label>
                  <Input
                    id="adresa_obveznika"
                    type="text"
                    value={formData.adresa_obveznika}
                    onChange={(e) => setFormData(prev => ({ ...prev, adresa_obveznika: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Podaci o nepokretnosti */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Podaci o nepokretnosti</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-3">
                  <Label htmlFor="adresa_objekta" className="text-xs">Ulica i broj:</Label>
                  <Input
                    id="adresa_objekta"
                    type="text"
                    value={formData.adresa_objekta}
                    onChange={(e) => setFormData(prev => ({ ...prev, adresa_objekta: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vrsta_nepokretnosti" className="text-xs">Vrsta objekta:</Label>
                  <Input
                    id="vrsta_nepokretnosti"
                    type="text"
                    value={formData.vrsta_nepokretnosti}
                    onChange={(e) => setFormData(prev => ({ ...prev, vrsta_nepokretnosti: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vrsta_prava" className="text-xs">Vrsta prava:</Label>
                  <Input
                    id="vrsta_prava"
                    type="text"
                    value={formData.vrsta_prava}
                    onChange={(e) => setFormData(prev => ({ ...prev, vrsta_prava: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="oporeziva_povrsina" className="text-xs">Oporeziva površina (m²):</Label>
                  <Input
                    id="oporeziva_povrsina"
                    type="number"
                    step="0.01"
                    value={formData.oporeziva_povrsina}
                    onChange={(e) => setFormData(prev => ({ ...prev, oporeziva_povrsina: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sifra_akta" className="text-xs">Šifra akta:</Label>
                  <Input
                    id="sifra_akta"
                    type="text"
                    value={formData.sifra_akta}
                    onChange={(e) => setFormData(prev => ({ ...prev, sifra_akta: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="broj_prijave" className="text-xs">Broj prijave:</Label>
                  <Input
                    id="broj_prijave"
                    type="text"
                    value={formData.broj_prijave}
                    onChange={(e) => setFormData(prev => ({ ...prev, broj_prijave: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="svrha" className="text-xs">Svrha 1:</Label>
                  <Input
                    id="svrha"
                    type="text"
                    value={formData.svrha}
                    onChange={(e) => setFormData(prev => ({ ...prev, svrha: e.target.value }))}
                    placeholder="DEČIJEG DODATKA"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="svrha2" className="text-xs">Svrha 2:</Label>
                  <Input
                    id="svrha2"
                    type="text"
                    value={formData.svrha2}
                    onChange={(e) => setFormData(prev => ({ ...prev, svrha2: e.target.value }))}
                    placeholder="PREBIVALIŠTA"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showPreview && selectedPotvrda && (
        <PrintPreview
          data={{
            ...selectedPotvrda,
            ...formData,
            ime_i_prezime: formData.obveznik,
            adresa: formData.adresa_obveznika
          }}
          type="potvrde"
          onClose={() => setShowPreview(false)}
          onPrint={handlePrint}
        />
      )}
    </div>
  )
}
