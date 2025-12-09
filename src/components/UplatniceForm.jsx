import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Printer, FileText, X, History as HistoryIcon } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { databaseService } from '../services/databaseService.js'
import { generateUplatnicaHTML } from '../utils/printTemplates.js'
import { Button } from './ui/button.jsx'
import { Input } from './ui/input.jsx'
import { Label } from './ui/label.jsx'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx'
import PrintPreview from './PrintPreview.jsx'

// Predefinisane takse
const PREDEFINISANE_TAKSE = [
  { id: 'taksa_300_1', label: 'TAKSA 300 DIN', iznos: 300 },
  { id: 'taksa_300_2', label: 'TAKSA 300 DIN', iznos: 300 },
  { id: 'taksa_400', label: 'TAKSA 400 DIN', iznos: 400 },
  { id: 'prihoda', label: 'PRIHODA OD UVEĆANJA CELOKUPNOG PORESKOG DUGA', iznos: null }
]

// Stavke sa iznosom
const STAVKE_SA_IZNOSOM = [
  { id: 'porez', label: 'IZNOS POREZA' },
  { id: 'eko', label: 'IZNOS EKO' },
  { id: 'zemljiste', label: 'IZNOS G. ZEMLJIŠTA' },
  { id: 'kom_taksa', label: 'IZNOS KOM. TAKSE' },
  { id: 'samodoprinos', label: 'IZNOS SAMODOPRINOS' },
  { id: 'naknada_742143843', label: 'NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 742143843' },
  { id: 'naknada_714565843', label: 'NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 714565843' }
]

export default function UplatniceForm({ onNavigate }) {
  const { selectedPrinters, taxPrices } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [searchHistory, setSearchHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    jmbg: '',
    ime_i_prezime: '',
    adresa: '',
    poziv_na_broj: '79075',
    reprogram: false,
    stavke: {},
    stampaStavka: null
  })

  const [checkedItems, setCheckedItems] = useState({})

  const toggleCheck = (id) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Load history from local storage
  useEffect(() => {
    const history = localStorage.getItem('uplatnice_search_history')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (e) {
        console.error('Failed to parse search history', e)
      }
    }
  }, [])

  // Učitaj podatke iz baze kada se selektuje osoba
  useEffect(() => {
    if (selectedPerson) {
      setFormData(prev => ({
        ...prev,
        jmbg: selectedPerson.jmbg || '',
        ime_i_prezime: selectedPerson.ime_i_prezime || '',
        adresa: selectedPerson.adresa || '',
        poziv_na_broj: '79075',
        reprogram: false,
        stavke: {}
      }))
    }
  }, [selectedPerson])

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
      localStorage.setItem('uplatnice_search_history', JSON.stringify(newHistory))
    }

    try {
      const data = await databaseService.uplatnice('search', term)
      setResults(data || [])
      setShowHistory(false)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    }
  }

  const handleAmountChange = (stavkaId, value) => {
    setFormData(prev => ({
      ...prev,
      stavke: {
        ...prev.stavke,
        [stavkaId]: value
      }
    }))
  }

  const ITEMS_MAP = {
    'iznos_poreza': 'POREZ',
    'iznos_eko': 'EKO TAKSA',
    'iznos_zemljiste': 'GRAĐEVINSKO ZEMLJIŠTE',
    'iznos_kom_takse': 'KOMUNALNA TAKSA',
    'iznos_koriscenja_prostora': 'NAKNADA ZA KORIŠĆENJE PROSTORA 742143843',
    'iznos_unapredjenje_zivotne_sredine': 'NAKNADA ZA KORIŠĆENJE PROSTORA 714565843',
    'iznos_samodoprinos': 'SAMODOPRINOS',
    'iznos_sume': 'NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA',
    'taksa_300': 'ADMINISTRATIVNA TAKSA',
    'taksa_400': 'ADMINISTRATIVNA TAKSA',
    'iznos_prihoda': 'PRIHODA OD UVEĆANJA CELOKUPNOG PORESKOG DUGA'
  }

  const handlePrintChecked = async () => {
    if (!selectedPerson) {
      alert('Molimo izaberite osobu iz baze!')
      return
    }

    const itemsToPrint = Object.keys(checkedItems)
      .filter(key => checkedItems[key])
      .map(key => {
        let amount = formData.stavke[key]
        // Handle fixed taxes
        if (key === 'taksa_300') amount = taxPrices?.taksa_300 || 300
        if (key === 'taksa_400') amount = taxPrices?.taksa_400 || 400

        return {
          opis: ITEMS_MAP[key] || key.toUpperCase(),
          iznos: amount
        }
      })
      .filter(item => item.iznos)

    if (itemsToPrint.length === 0) {
      alert('Niste izabrali nijednu stavku za štampu ili izabrane stavke nemaju unet iznos.')
      return
    }

    setPrinting(true)
    try {
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      // A4 Printer (same as Potvrde)
      const printerName = selectedPrinters.potvrde || 'default'

      const printData = {
        ...selectedPerson,
        poziv_na_broj: formData.poziv_na_broj,
        reprogram: formData.reprogram ? 'DA' : 'NE',
        items: itemsToPrint,
        hideAmountOnSlip: false // User wants checked total on standard A4 print? Actually previous logic was hideAmountOnSlip: true.
        // User said: "a stavke koje cekiram da uneses u ovaj deo jednu po jednu i napravi posle ukupno od svih stavki koje sam cekirao"
        // And regarding A4 print preview: "nema placeholder 0.00" -> handled by my generic empty logic?
        // Let's keep existing logic but update printer name.
      }

      // Update: If printing collective A4, we usually want the total amount on the slip too unless User specifically asked for blank.
      // In previous step I set hideAmountOnSlip: true.
      // But matrix print must have amount.
      // A4 print: "napravi posle ukupno od svih stavki". This implies the slip SHOULD have the total.
      // So I will remove hideAmountOnSlip: true, or set it to false.
      // Let's set it to false, so the slip shows the Grand Total.
      printData.hideAmountOnSlip = false

      const html = generateUplatnicaHTML(printData)

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

  const handlePrintSingleItem = async (field, label) => {
    if (!selectedPerson) {
      alert('Molimo izaberite osobu iz baze!')
      return
    }

    let iznos = ''
    if (field === 'taksa_300') {
      iznos = taxPrices?.taksa_300 || '300'
    } else if (field === 'taksa_400') {
      iznos = taxPrices?.taksa_400 || '400'
    } else if (field) {
      iznos = formData.stavke[field] || ''
      if (!iznos) {
        alert('Molimo unesite iznos!')
        return
      }
    } else {
      // Fallback for any legacy calls with null field
      if (label.includes('300')) iznos = taxPrices?.taksa_300 || '300'
      if (label.includes('400')) iznos = taxPrices?.taksa_400 || '400'
    }

    setPrinting(true)
    try {
      const isElectron = typeof window !== 'undefined' && window.electronAPI
      // Matrix Printer (Epson PLQ-20)
      const printerName = selectedPrinters.uplatnice || 'default'

      const printData = {
        ...selectedPerson,
        poziv_na_broj: formData.poziv_na_broj,
        reprogram: formData.reprogram ? 'DA' : 'NE',
        stavka: label,
        iznos: iznos,
        matrix: true // Force matrix template (Slip Only, No QR, Fixed Size)
      }

      const html = generateUplatnicaHTML(printData)

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
                <CardTitle className="text-base">Pretraga UPLATNICA</CardTitle>
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
                    key={item.id || item.jmbg}
                    onClick={() => setSelectedPerson(item)}
                    className={`p-3 rounded-md border cursor-pointer transition-all text-sm group ${selectedPerson?.jmbg === item.jmbg
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent hover:border-border hover:bg-muted/50'
                      }`}
                    whileHover={{ scale: 0.995 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="font-medium flex items-center justify-between mb-1">
                      <span className="truncate">{item.ime_i_prezime || 'N/A'}</span>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground gap-2 mb-1">
                      <FileText size={12} />
                      <span>{item.jmbg}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate opacity-70">
                      {item.adresa}
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>

            <div className="p-4 border-t bg-muted/30 flex-shrink-0 mt-auto">
              {selectedPerson ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Izabrano:</div>
                      <div className="font-semibold text-sm truncate max-w-[200px]">{formData.ime_i_prezime}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {formData.jmbg}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 -mr-2 -mt-1"
                      onClick={() => {
                        setSelectedPerson(null)
                        setFormData({
                          jmbg: '',
                          ime_i_prezime: '',
                          adresa: '',
                          poziv_na_broj: '79075',
                          reprogram: false,
                          stavke: {},
                          stampaStavka: null
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
                    <Button variant="default" className="w-full" size="sm" onClick={() => { /* handlePrint logic */ }} disabled={printing}>
                      <Printer size={16} className="mr-2" /> Štampaj
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  Izaberite osobu za obradu
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Desna kolona - Forma - FLEX GROW */}
        <div className="flex-1 overflow-auto min-w-0 flex flex-col gap-3">
          {/* Podaci o platiocu */}
          <Card className="flex-shrink-0">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <CardTitle className="text-base">Podaci o platiocu</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-12 gap-3">
                {/* Prvi red: JMBG (3), Ime (6), Reprogram (3) */}
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label htmlFor="jmbg" className="text-xs">JMBG:</Label>
                  <Input
                    id="jmbg"
                    type="text"
                    value={formData.jmbg}
                    onChange={(e) => setFormData(prev => ({ ...prev, jmbg: e.target.value }))}
                    className="h-8"
                  />
                </div>

                <div className="col-span-12 md:col-span-5 space-y-1">
                  <Label htmlFor="ime" className="text-xs">Ime i Prezime:</Label>
                  <Input
                    id="ime"
                    type="text"
                    value={formData.ime_i_prezime}
                    onChange={(e) => setFormData(prev => ({ ...prev, ime_i_prezime: e.target.value }))}
                    className="h-8"
                  />
                </div>

                <div className="col-span-12 md:col-span-4 space-y-1 flex flex-col justify-end">
                  <div className="flex items-center h-8 space-x-2 bg-muted/30 px-2 rounded border">
                    <Label className="text-xs font-semibold mr-2">REPROGRAM:</Label>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <input
                          type="radio"
                          id="reprogram-da"
                          checked={formData.reprogram === true}
                          onChange={() => setFormData(prev => ({ ...prev, reprogram: true }))}
                          className="text-primary focus:ring-primary h-3 w-3"
                        />
                        <Label htmlFor="reprogram-da" className="cursor-pointer text-xs">DA</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <input
                          type="radio"
                          id="reprogram-ne"
                          checked={formData.reprogram === false}
                          onChange={() => setFormData(prev => ({ ...prev, reprogram: false }))}
                          className="text-primary focus:ring-primary h-3 w-3"
                        />
                        <Label htmlFor="reprogram-ne" className="cursor-pointer text-xs">NE</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drugi red: Adresa (8), Poziv (4) */}
                <div className="col-span-12 md:col-span-8 space-y-1">
                  <Label htmlFor="adresa" className="text-xs">Adresa:</Label>
                  <Input
                    id="adresa"
                    type="text"
                    value={formData.adresa}
                    onChange={(e) => setFormData(prev => ({ ...prev, adresa: e.target.value }))}
                    className="h-8"
                  />
                </div>

                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label htmlFor="poziv" className="text-xs">Poziv na broj:</Label>
                  <Input
                    id="poziv"
                    type="text"
                    value={formData.poziv_na_broj}
                    onChange={(e) => setFormData(prev => ({ ...prev, poziv_na_broj: e.target.value }))}
                    className="h-8 font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stavke sa iznosom */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Stavke sa iznosom</CardTitle>
                <Button size="sm" onClick={handlePrintChecked} disabled={Object.values(checkedItems).filter(Boolean).length === 0}>
                  <Printer className="mr-2 h-4 w-4" /> Štampaj zbirno
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_porez"
                      checked={!!checkedItems['iznos_poreza']}
                      onChange={() => toggleCheck('iznos_poreza')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="porez" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_poreza')}>IZNOS POREZA:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="porez"
                      type="number"
                      value={formData.stavke.iznos_poreza || ''}
                      onChange={(e) => handleAmountChange('iznos_poreza', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_poreza', 'POREZ')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_eko"
                      checked={!!checkedItems['iznos_eko']}
                      onChange={() => toggleCheck('iznos_eko')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="eko" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_eko')}>IZNOS EKO:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="eko"
                      type="number"
                      value={formData.stavke.iznos_eko || ''}
                      onChange={(e) => handleAmountChange('iznos_eko', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_eko', 'EKO TAKSA')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_zemljiste"
                      checked={!!checkedItems['iznos_zemljiste']}
                      onChange={() => toggleCheck('iznos_zemljiste')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="zemljiste" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_zemljiste')}>IZNOS G. ZEMLJIŠTA:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="zemljiste"
                      type="number"
                      value={formData.stavke.iznos_zemljiste || ''}
                      onChange={(e) => handleAmountChange('iznos_zemljiste', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_zemljiste', 'GRAĐEVINSKO ZEMLJIŠTE')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_kom_takse"
                      checked={!!checkedItems['iznos_kom_takse']}
                      onChange={() => toggleCheck('iznos_kom_takse')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="kom_takse" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_kom_takse')}>IZNOS KOM. TAKSE:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="kom_takse"
                      type="number"
                      value={formData.stavke.iznos_kom_takse || ''}
                      onChange={(e) => handleAmountChange('iznos_kom_takse', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_kom_takse', 'KOMUNALNA TAKSA')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_samodoprinos"
                      checked={!!checkedItems['iznos_samodoprinos']}
                      onChange={() => toggleCheck('iznos_samodoprinos')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="samodoprinos" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_samodoprinos')}>IZNOS SAMODOPRINOS:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="samodoprinos"
                      type="number"
                      value={formData.stavke.iznos_samodoprinos || ''}
                      onChange={(e) => handleAmountChange('iznos_samodoprinos', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_samodoprinos', 'SAMODOPRINOS')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_sume"
                      checked={!!checkedItems['iznos_sume']}
                      onChange={() => toggleCheck('iznos_sume')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="sume" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_sume')}>NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 742143843:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="sume"
                      type="number"
                      value={formData.stavke.iznos_sume || ''}
                      onChange={(e) => handleAmountChange('iznos_sume', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_sume', 'NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 742143843')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_unapredjenje"
                      checked={!!checkedItems['iznos_unapredjenje_zivotne_sredine']}
                      onChange={() => toggleCheck('iznos_unapredjenje_zivotne_sredine')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="unapredjenje" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_unapredjenje_zivotne_sredine')}>NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 714565843:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="unapredjenje"
                      type="number"
                      value={formData.stavke.iznos_unapredjenje_zivotne_sredine || ''}
                      onChange={(e) => handleAmountChange('iznos_unapredjenje_zivotne_sredine', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_unapredjenje_zivotne_sredine', 'NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 714565843')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="cb_prihoda"
                      checked={!!checkedItems['iznos_prihoda']}
                      onChange={() => toggleCheck('iznos_prihoda')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="prihoda" className="text-xs uppercase cursor-pointer" onClick={() => toggleCheck('iznos_prihoda')}>PRIHODA OD UVEĆANJA CELOKUPNOG PORESKOG DUGA:</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="prihoda"
                      type="number"
                      value={formData.stavke.iznos_prihoda || ''}
                      onChange={(e) => handleAmountChange('iznos_prihoda', e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 flex-shrink-0"
                      onClick={() => handlePrintSingleItem('iznos_prihoda', 'PRIHODA OD UVEĆANJA CELOKUPNOG PORESKOG DUGA')}
                      title="Štampaj samo ovu stavku"
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Predefinisane takse */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Predefinisane takse</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg border border-transparent hover:border-gray-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="cb_taksa300"
                      checked={!!checkedItems['taksa_300']}
                      onChange={() => toggleCheck('taksa_300')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex flex-col">
                      <Label htmlFor="cb_taksa300" className="cursor-pointer font-medium">ADMINISTRATIVNA TAKSA</Label>
                      <span className="text-xs text-muted-foreground">Cena: {taxPrices?.taksa_300 || 300} DIN</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={() => handlePrintSingleItem('taksa_300', 'ADMINISTRATIVNA TAKSA')}
                  >
                    <Printer size={14} />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg border border-transparent hover:border-gray-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="cb_taksa400"
                      checked={!!checkedItems['taksa_400']}
                      onChange={() => toggleCheck('taksa_400')}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="flex flex-col">
                      <Label htmlFor="cb_taksa400" className="cursor-pointer font-medium">ADMINISTRATIVNA TAKSA (DRUGA)</Label>
                      <span className="text-xs text-muted-foreground">Cena: {taxPrices?.taksa_400 || 400} DIN</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={() => handlePrintSingleItem('taksa_400', 'ADMINISTRATIVNA TAKSA')}
                  >
                    <Printer size={14} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showPreview && selectedPerson && (
        <PrintPreview
          data={{
            ...selectedPerson,
            poziv_na_broj: formData.poziv_na_broj,
            items: Object.keys(checkedItems).filter(k => checkedItems[k]).length > 0
              ? Object.keys(checkedItems)
                .filter(k => checkedItems[k])
                .map(key => {
                  let amount = formData.stavke[key]
                  if (key === 'taksa_300') amount = taxPrices?.taksa_300 || 300
                  if (key === 'taksa_400') amount = taxPrices?.taksa_400 || 400
                  return { opis: ITEMS_MAP[key] || key.toUpperCase(), iznos: amount }
                })
                .filter(i => i.iznos)
              : undefined,
            hideAmountOnSlip: true
          }}
          type="uplatnice"
          onClose={() => setShowPreview(false)}
          onPrint={handlePrintChecked}
        />
      )}
    </div>
  )
}
