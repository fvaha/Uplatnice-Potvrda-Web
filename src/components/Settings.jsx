import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Database, Upload, Trash2, Loader, CheckCircle, AlertCircle, Lock, User } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { importExcelFile } from '../utils/excelImporter'
import { databaseService } from '../services/databaseService'

const ADMIN_CREDENTIALS = {
  username: import.meta.env.VITE_ADMIN_USERNAME || '',
  password: import.meta.env.VITE_ADMIN_PASSWORD || ''
}

export default function Settings({ onNavigate }) {
  const { dbStats, printers, selectedPrinters, savePrinterSettings, refreshStats, loadPrinters, taxPrices, saveTaxPrices } = useApp()
  const [importType, setImportType] = useState('uplatnice')
  const [uplatniceMode, setUplatniceMode] = useState('update')
  const [potvrdeMode, setPotvrdeMode] = useState('update')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState(null)
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState(null)
  const [migrateError, setMigrateError] = useState(null)
  const fileInputRef = useRef(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const saved = localStorage.getItem('settings_authenticated')
    return saved === 'true'
  })
  const [loginError, setLoginError] = useState('')

  const isElectron = typeof window !== 'undefined' && window.electronAPI

  const handleLogin = (e) => {
    e.preventDefault()
    setLoginError('')
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      setIsAuthenticated(true)
      localStorage.setItem('settings_authenticated', 'true')
      setUsername('')
      setPassword('')
    } else {
      setLoginError('Pogrešno korisničko ime ili šifra')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('settings_authenticated')
  }

  const handleSelectFile = (type) => {
    setImportType(type)
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)
    setImportError(null)

    try {
      const mode = importType === 'uplatnice' ? uplatniceMode : potvrdeMode

      if (isElectron) {
        const result = await window.electronAPI.importExcel({
          filePath: file.path,
          type: importType,
          mode
        })
        if (result.success) {
          setImportResult(result)
          await refreshStats()
        } else {
          setImportError(result.error || 'Import failed')
        }
      } else {
        const result = await importExcelFile(file, importType, mode)
        setImportResult(result)
        await refreshStats()
      }
    } catch (error) {
      setImportError(error.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleDeleteAll = async (type) => {
    if (!confirm(`Da li ste sigurni da želite da obrišete sve ${type}?`)) return

    try {
      await databaseService[type]('deleteAll')
      await refreshStats()
      setImportResult({ inserted: 0, updated: 0, total: 0 })
    } catch (error) {
      setImportError(error.message)
    }
  }

  const handleMigrateToDb = async () => {
    if (!isElectron) return

    const result = await window.electronAPI.selectFile({
      title: 'Izaberi Excel fajl za migraciju',
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xlsm', 'xls'] }]
    })

    if (!result) return

    setMigrating(true)
    setMigrateResult(null)
    setMigrateError(null)

    try {
      const migrateResult = await window.electronAPI.migrateToDb(result)
      if (migrateResult.success) {
        setMigrateResult(migrateResult)
        await refreshStats()
      } else {
        setMigrateError(migrateResult.error || 'Migration failed')
      }
    } catch (error) {
      setMigrateError(error.message)
    } finally {
      setMigrating(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center mb-4">
              <Lock className="text-primary" size={32} />
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Korisničko ime</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                    placeholder="Unesite korisničko ime"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Lozinka</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              {loginError && (
                <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle size={16} />
                    <span>{loginError}</span>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full">Prijavi se</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-3">
      {/* Database Stats & Import */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg">
              <span className="text-muted-foreground text-sm">Uplatnice:</span>
              <span className="font-bold text-xl">{dbStats.uplatnice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg">
              <span className="text-muted-foreground text-sm">Potvrde:</span>
              <span className="font-bold text-xl">{dbStats.potvrde.toLocaleString()}</span>
            </div>
          </div>

          {/* Import */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Database size={16} />
                Uplatnice
              </div>
              <select
                value={uplatniceMode}
                onChange={(e) => setUplatniceMode(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="append">Dodaj samo nove</option>
                <option value="update">Update postojeće</option>
                <option value="replace">Zameni sve</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSelectFile('uplatnice')} disabled={importing} className="h-8">
                  {importing && importType === 'uplatnice' ? <Loader className="animate-spin" size={12} /> : <Upload size={12} />}
                  <span className="ml-1 text-xs">Import</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteAll('uplatnice')} disabled={importing} className="h-8">
                  <Trash2 size={12} />
                  <span className="ml-1 text-xs">Obriši</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Database size={16} />
                Potvrde
              </div>
              <select
                value={potvrdeMode}
                onChange={(e) => setPotvrdeMode(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="append">Dodaj samo nove</option>
                <option value="update">Update postojeće</option>
                <option value="replace">Zameni sve</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSelectFile('potvrde')} disabled={importing} className="h-8">
                  {importing && importType === 'potvrde' ? <Loader className="animate-spin" size={12} /> : <Upload size={12} />}
                  <span className="ml-1 text-xs">Import</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteAll('potvrde')} disabled={importing} className="h-8">
                  <Trash2 size={12} />
                  <span className="ml-1 text-xs">Obriši</span>
                </Button>
              </div>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept=".xlsm,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />

          {importResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle size={16} />
                <span>Import uspešan! Dodato: {importResult.inserted || 0}, Update: {importResult.updated || 0}</span>
              </div>
            </motion.div>
          )}

          {importError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle size={16} />
                <span>{importError}</span>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Migration (Electron only) */}
      {isElectron && (
        <Card>
          <CardContent className="pt-4">
            <Button onClick={handleMigrateToDb} disabled={migrating} variant="secondary" className="w-full">
              {migrating ? <Loader className="animate-spin mr-2" size={16} /> : <Upload className="mr-2" size={16} />}
              Migriraj u .db fajlove
            </Button>
            {migrateResult && (
              <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600">
                Migracija uspešna! Dodato: {migrateResult.inserted || 0}
              </div>
            )}
            {migrateError && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {migrateError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Taxes & Printers */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div>
              <Label className="text-xs">Taksa 1 (300)</Label>
              <Input type="number" value={taxPrices?.taksa_300 || ''} onChange={(e) => saveTaxPrices({ ...taxPrices, taksa_300: Number(e.target.value) })} className="h-8" />
            </div>
            <div>
              <Label className="text-xs">Taksa 2 (400)</Label>
              <Input type="number" value={taxPrices?.taksa_400 || ''} onChange={(e) => saveTaxPrices({ ...taxPrices, taksa_400: Number(e.target.value) })} className="h-8" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-2">
            {printers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema štampača</p>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Štampač za Potvrde</Label>
                  <select value={selectedPrinters.potvrde || ''} onChange={(e) => savePrinterSettings({ ...selectedPrinters, potvrde: e.target.value || null })} className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="">Default</option>
                    {printers.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Štampač za Uplatnice</Label>
                  <select value={selectedPrinters.uplatnice || ''} onChange={(e) => savePrinterSettings({ ...selectedPrinters, uplatnice: e.target.value || null })} className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="">Izaberi</option>
                    {printers.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={loadPrinters} className="w-full h-8 text-xs">Osveži štampače</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
