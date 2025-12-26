import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Printer, Receipt, X, History as HistoryIcon, FileText, Save, PlusCircle } from 'lucide-react'
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
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle', 'success', 'error'

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
    svrha_izbor: 'DEČIJEG DODATKA', // Izbor iz padajućeg menija
    svrha_custom: '', // Custom unos ako je izabrano 'CUSTOM'
    zahteva_ime_prezime: '', // Ime i prezime osobe koja traži potvrdu
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
        svrha_izbor: selectedPotvrda.svrha_izbor || 'DEČIJEG DODATKA',
        svrha_custom: selectedPotvrda.svrha_custom || '',
        zahteva_ime_prezime: selectedPotvrda.zahteva_ime_prezime || ''
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

  const handleSave = async () => {
    if (!formData.jmbg || !formData.sifra_akta || !formData.broj_prijave) {
      alert('JMBG, Šifra akta i Broj prijave su obavezni za identifikaciju!')
      return
    }

    try {
      await databaseService.potvrde('upsert', formData)
      console.log('Podaci uspešno sačuvani!')
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)

      // Refresh search if applicable
      if (searchQuery) {
        handleSearch({ preventDefault: () => { } })
      }
    } catch (error) {
      console.error('Save failed:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleNewUser = () => {
    setSelectedPotvrda(null)
    setSaveStatus('idle')
    setFormData({
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
      svrha_izbor: 'DEČIJEG DODATKA',
      svrha_custom: '',
      zahteva_ime_prezime: '',
      status_lica: ''
    })
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
                        .filter(term => {
                          const normalizeText = (text) => {
                            if (!text) return ''
                            return text
                              .toLowerCase()
                              .replace(/č/g, 'c')
                              .replace(/ć/g, 'c')
                              .replace(/š/g, 's')
                              .replace(/ž/g, 'z')
                              .replace(/đ/g, 'd')
                          }
                          return normalizeText(term).includes(normalizeText(searchQuery))
                        })
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
                          svrha_izbor: 'DEČIJEG DODATKA',
                          svrha_custom: '',
                          zahteva_ime_prezime: ''
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
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Podaci o obvezniku</CardTitle>
                  <div className="flex gap-1 ml-4">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleNewUser}>
                      <PlusCircle size={12} className="mr-1" /> Novi
                    </Button>
                    <div className="flex items-center gap-2">
                      {saveStatus === 'success' && <span className="text-foreground text-xs font-semibold animate-in fade-in zoom-in">Sačuvano!</span>}
                      {saveStatus === 'error' && <span className="text-destructive text-xs font-semibold animate-in fade-in zoom-in">Greška!</span>}
                      <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleSave}>
                        <Save size={12} className="mr-1" /> Sačuvaj
                      </Button>
                    </div>
                  </div>
                </div>
                {formData.status_lica && formData.status_lica.toUpperCase().includes('UMRL') && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-destructive/10 border border-destructive/20 rounded-md">
                    <span className="text-destructive text-sm font-semibold">⚠ UMRLA OSOBA</span>
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
                  <Label htmlFor="svrha_izbor" className="text-xs">Svrha:</Label>
                  <select
                    id="svrha_izbor"
                    value={formData.svrha_izbor}
                    onChange={(e) => setFormData(prev => ({ ...prev, svrha_izbor: e.target.value, svrha_custom: e.target.value === 'CUSTOM' ? prev.svrha_custom : '' }))}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="DEČIJEG DODATKA">Decijeg dodatka</option>
                    <option value="PREBIVALIŠTA">Prebivalista</option>
                    <option value="CUSTOM">Ukucaj svrhu</option>
                  </select>
                </div>
                {formData.svrha_izbor === 'CUSTOM' && (
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="svrha_custom" className="text-xs">Unesi novu svrhu:</Label>
                    <Input
                      id="svrha_custom"
                      type="text"
                      value={formData.svrha_custom}
                      onChange={(e) => setFormData(prev => ({ ...prev, svrha_custom: e.target.value }))}
                      placeholder="Unesi novu svrhu potvrde"
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="zahteva_ime_prezime" className="text-xs">Ime i prezime osobe koja traži potvrdu:</Label>
                  <Input
                    id="zahteva_ime_prezime"
                    type="text"
                    value={formData.zahteva_ime_prezime}
                    onChange={(e) => setFormData(prev => ({ ...prev, zahteva_ime_prezime: e.target.value }))}
                    placeholder="Ime i prezime"
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
