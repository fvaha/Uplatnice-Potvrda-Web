import * as XLSX from 'xlsx'
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

/**
 * Migrira podatke iz Excel fajla u .db fajlove
 * Proverava da li ima novih podataka i dodaje samo nove
 */
export async function migrateExcelToDb(filePath, type, projectRoot) {
  try {
    const fileBuffer = readFileSync(filePath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true })

    let sheetName
    let dbPath
    if (type === 'uplatnice') {
      sheetName = 'BAZA'
      dbPath = join(projectRoot, 'uplatnice.db')
    } else if (type === 'potvrde') {
      sheetName = 'baza'
      dbPath = join(projectRoot, 'potvrde.db')
    } else {
      throw new Error('Invalid type. Must be "uplatnice" or "potvrde"')
    }

    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found in Excel file`)
    }

    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: true
    })

    if (jsonData.length < 2) {
      throw new Error('Excel file is empty or has no data rows')
    }

    const headers = jsonData[0].map(h => h ? String(h).trim() : null)
    const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== '')).map(row =>
      row.map(cell => {
        // Convert Excel dates to strings
        if (cell instanceof Date) {
          return cell.toISOString().split('T')[0]
        }
        // Convert booleans to strings
        if (typeof cell === 'boolean') {
          return cell ? 'DA' : 'NE'
        }
        return cell
      })
    )

    let dataArray
    if (type === 'uplatnice') {
      dataArray = parseUplatniceData(dataRows, headers)
    } else {
      dataArray = parsePotvrdeData(dataRows, headers)
    }

    // Open or create database
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')

    // Create table if it doesn't exist
    if (type === 'uplatnice') {
      db.exec(`
        CREATE TABLE IF NOT EXISTS uplatnice (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          jmbg TEXT UNIQUE NOT NULL,
          ime_i_prezime TEXT NOT NULL,
          adresa TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_uplatnice_jmbg ON uplatnice(jmbg);
      `)
    } else {
      db.exec(`
        CREATE TABLE IF NOT EXISTS potvrde (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sifra_opstine INTEGER,
          sifra_akta TEXT,
          broj_prijave TEXT,
          jmbg TEXT NOT NULL,
          vlasnistvo_od INTEGER,
          vlasnistvo_do INTEGER,
          status_prijave TEXT,
          izvor_podataka TEXT,
          datum_prijave INTEGER,
          pib TEXT,
          obveznik TEXT,
          stanuje TEXT,
          adresa_obveznika TEXT,
          adresa_objekta TEXT,
          vrsta_prava TEXT,
          vrsta_nepokretnosti TEXT,
          zona TEXT,
          oporeziva_povrsina REAL,
          datum_izgradnje_rekonstrukcije INTEGER,
          osnovica_preth_god REAL,
          porez_preth_god REAL,
          status_lica TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(jmbg, sifra_akta, broj_prijave)
        );
        CREATE INDEX IF NOT EXISTS idx_potvrde_jmbg ON potvrde(jmbg);
        CREATE INDEX IF NOT EXISTS idx_potvrde_pib ON potvrde(pib);
      `)
    }

    // Get existing records
    let existingKeys
    if (type === 'uplatnice') {
      const existing = db.prepare('SELECT jmbg FROM uplatnice').all()
      existingKeys = new Set(existing.map(r => r.jmbg))
    } else {
      const existing = db.prepare('SELECT jmbg, sifra_akta, broj_prijave FROM potvrde').all()
      existingKeys = new Set(
        existing.map(r => `${r.jmbg}_${r.sifra_akta}_${r.broj_prijave}`)
      )
    }

    // Filter only new records
    let newData
    if (type === 'uplatnice') {
      newData = dataArray.filter(item => !existingKeys.has(item.jmbg))
    } else {
      newData = dataArray.filter(item => {
        const key = `${item.jmbg}_${item.sifra_akta}_${item.broj_prijave}`
        return !existingKeys.has(key)
      })
    }

    let inserted = 0
    let skipped = dataArray.length - newData.length

    if (newData.length > 0) {
      // Insert new records
      if (type === 'uplatnice') {
        const insertStmt = db.prepare(`
          INSERT INTO uplatnice (jmbg, ime_i_prezime, adresa)
          VALUES (?, ?, ?)
        `)

        const insertMany = db.transaction((items) => {
          for (const item of items) {
            insertStmt.run(item.jmbg, item.ime_i_prezime, item.adresa)
            inserted++
          }
        })

        insertMany(newData)
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO potvrde (
            sifra_opstine, sifra_akta, broj_prijave, jmbg, vlasnistvo_od, vlasnistvo_do,
            status_prijave, izvor_podataka, datum_prijave, pib, obveznik, stanuje,
            adresa_obveznika, adresa_objekta, vrsta_prava, vrsta_nepokretnosti, zona,
            oporeziva_povrsina, datum_izgradnje_rekonstrukcije, osnovica_preth_god,
            porez_preth_god, status_lica
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        const insertMany = db.transaction((items) => {
          for (const item of items) {
            insertStmt.run(
              item.sifra_opstine, item.sifra_akta, item.broj_prijave, item.jmbg,
              item.vlasnistvo_od, item.vlasnistvo_do, item.status_prijave, item.izvor_podataka,
              item.datum_prijave, item.pib, item.obveznik, item.stanuje,
              item.adresa_obveznika, item.adresa_objekta, item.vrsta_prava, item.vrsta_nepokretnosti,
              item.zona, item.oporeziva_povrsina, item.datum_izgradnje_rekonstrukcije,
              item.osnovica_preth_god, item.porez_preth_god, item.status_lica
            )
            inserted++
          }
        })

        insertMany(newData)
      }
    }

    const totalCount = db.prepare(`SELECT COUNT(*) as count FROM ${type}`).get().count
    db.close()

    return {
      success: true,
      inserted,
      skipped,
      total: dataArray.length,
      totalInDb: totalCount,
      hasNewData: newData.length > 0
    }
  } catch (error) {
    throw new Error(error.message)
  }
}

// Helper function to format JMBG/PIB correctly
function formatJMBG(value) {
  if (!value) return ''
  let str = String(value).trim()
  str = str.replace(/\D/g, '')
  if (str.length > 0 && str.length < 13) {
    str = str.padStart(13, '0')
  }
  return str
}

function formatPIB(value) {
  if (!value) return ''
  let str = String(value).trim()
  str = str.replace(/\D/g, '')
  // PIB is 9 digits - do NOT pad
  return str
}


function parseUplatniceData(dataRows, headers) {
  const jmbgIndex = headers.findIndex(h => h && h.toUpperCase().includes('JMBG'))
  const imeIndex = headers.findIndex(h => h && (h.toUpperCase().includes('IME') || h.toUpperCase().includes('PREZIME')))
  const adresaIndex = headers.findIndex(h => h && h.toUpperCase().includes('ADRESA'))

  if (jmbgIndex === -1 || imeIndex === -1) {
    throw new Error('Required columns (JMBG, IME I PREZIME) not found')
  }

  return dataRows.map(row => ({
    jmbg: formatJMBG(row[jmbgIndex]),
    ime_i_prezime: String(row[imeIndex] || '').trim(),
    adresa: adresaIndex !== -1 ? String(row[adresaIndex] || '').trim() : null
  })).filter(item => item.jmbg && item.ime_i_prezime)
}

function parsePotvrdeData(dataRows, headers) {
  const headerMap = {}
  headers.forEach((h, i) => {
    if (h) {
      const key = h.toUpperCase().replace(/\s+/g, '_')
      headerMap[key] = i
    }
  })

  console.log('[MIGRATE] HeaderMap for POTVRDE:')
  console.log('JMBG:', headerMap['JMBG'])
  console.log('PIB:', headerMap['PIB'])
  console.log('OBVEZNIK:', headerMap['OBVEZNIK'])
  console.log('STANUJE:', headerMap['STANUJE'])

  return dataRows.map(row => {
    const getValue = (key) => {
      const index = headerMap[key]
      return index !== undefined ? (row[index] !== null && row[index] !== undefined ? String(row[index]).trim() : null) : null
    }

    return {
      sifra_opstine: getValue('SIFRA_OPSTINE') ? parseInt(getValue('SIFRA_OPSTINE')) : null,
      sifra_akta: getValue('SIFRA_AKTA'),
      broj_prijave: getValue('BROJ_PRIJAVE'),
      jmbg: formatJMBG(row[headerMap['JMBG']]),
      vlasnistvo_od: getValue('VLASNISTVO_OD') ? parseInt(getValue('VLASNISTVO_OD')) : null,
      vlasnistvo_do: getValue('VLASNISTVO_DO') ? parseInt(getValue('VLASNISTVO_DO')) : null,
      status_prijave: getValue('STATUS_PRIJAVE'),
      izvor_podataka: getValue('IZVOR_PODATAKA'),
      datum_prijave: getValue('DATUM_PRIJAVE') ? parseInt(getValue('DATUM_PRIJAVE')) : null,
      pib: formatPIB(row[headerMap['PIB']]),
      obveznik: getValue('OBVEZNIK'),
      stanuje: getValue('STANUJE'),
      adresa_obveznika: getValue('ADRESA_OBVEZNIKA'),
      adresa_objekta: getValue('ADRESA_OBJEKTA'),
      vrsta_prava: getValue('VRSTA_PRAVA'),
      vrsta_nepokretnosti: getValue('VRSTA_NEPOKRETNOSTI'),
      zona: getValue('ZONA'),
      oporeziva_povrsina: getValue('OPOREZIVA_POVRSINA') ? parseFloat(getValue('OPOREZIVA_POVRSINA')) : null,
      datum_izgradnje_rekonstrukcije: getValue('DATUM_IZGRADNJE_REKONSTRUKCIJE') ? parseInt(getValue('DATUM_IZGRADNJE_REKONSTRUKCIJE')) : null,
      osnovica_preth_god: getValue('OSNOVICA_PRETH_GOD') ? parseFloat(getValue('OSNOVICA_PRETH_GOD')) : null,
      porez_preth_god: getValue('POREZ_PRETH_GOD') ? parseFloat(getValue('POREZ_PRETH_GOD')) : null,
      status_lica: getValue('STATUS_LICA')
    }
  }).filter(item => item.jmbg && item.sifra_akta && item.broj_prijave)
}
