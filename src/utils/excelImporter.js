import * as XLSX from 'xlsx'
import { uplatniceDB } from './uplatniceDB.js'
import { potvrdeDB } from './potvrdeDB.js'

export async function importExcelFile(file, type, mode) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })

        let sheetName
        if (type === 'uplatnice') {
          sheetName = 'BAZA'
        } else if (type === 'potvrde') {
          sheetName = 'baza'
        } else {
          reject(new Error('Invalid type. Must be "uplatnice" or "potvrde"'))
          return
        }

        if (!workbook.SheetNames.includes(sheetName)) {
          reject(new Error(`Sheet "${sheetName}" not found in Excel file`))
          return
        }

        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: true
        })

        if (jsonData.length < 2) {
          reject(new Error('Excel file is empty or has no data rows'))
          return
        }

        const headers = jsonData[0].map(h => h ? String(h).trim() : null)
        const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== '')).map(row =>
          row.map(cell => {
            // Handle null/undefined
            if (cell === null || cell === undefined) return ''

            // Convert Excel dates to strings
            if (cell instanceof Date) {
              return cell.toISOString().split('T')[0]
            }

            // Convert booleans to strings
            if (typeof cell === 'boolean') {
              return cell ? 'DA' : 'NE'
            }

            // Convert numbers to strings (preserve as-is for JMBG/PIB)
            if (typeof cell === 'number') {
              return String(cell)
            }

            // Already a string
            return String(cell)
          })
        )
        let result
        if (type === 'uplatnice') {
          result = await importUplatnice(dataRows, headers, mode)
        } else {
          result = await importPotvrde(dataRows, headers, mode)
        }

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

// Helper function to format JMBG/PIB correctly
function formatJMBG(value) {
  if (!value) return ''
  // Convert to string and remove any whitespace
  let str = String(value).trim()
  // Remove any non-digit characters
  str = str.replace(/\D/g, '')
  // Pad with leading zeros if needed (JMBG is 13 digits)
  if (str.length > 0 && str.length < 13) {
    str = str.padStart(13, '0')
  }
  return str
}

function formatPIB(value) {
  if (!value) return ''
  let str = String(value).trim()
  // Remove any non-digit characters
  str = str.replace(/\D/g, '')
  // PIB is 9 digits - do NOT pad, just return as-is
  return str
}

async function importUplatnice(dataRows, headers, mode) {
  const jmbgIndex = headers.findIndex(h => h && h.toUpperCase().includes('JMBG'))
  const imeIndex = headers.findIndex(h => h && (h.toUpperCase().includes('IME') || h.toUpperCase().includes('PREZIME')))
  const adresaIndex = headers.findIndex(h => h && h.toUpperCase().includes('ADRESA'))

  if (jmbgIndex === -1 || imeIndex === -1) {
    throw new Error('Required columns (JMBG, IME I PREZIME) not found')
  }

  const dataArray = dataRows.map(row => ({
    jmbg: formatJMBG(row[jmbgIndex]),
    ime_i_prezime: String(row[imeIndex] || '').trim(),
    adresa: adresaIndex !== -1 ? String(row[adresaIndex] || '').trim() : null
  })).filter(item => item.jmbg && item.ime_i_prezime)

  return await uplatniceDB.bulkUpsert(dataArray, mode)
}

async function importPotvrde(dataRows, headers, mode) {
  const headerMap = {}
  headers.forEach((h, i) => {
    if (h) {
      const key = h.toUpperCase().replace(/\s+/g, '_')
      headerMap[key] = i
    }
  })

  console.log('HeaderMap for POTVRDE:')
  console.log('JMBG:', headerMap['JMBG'])
  console.log('PIB:', headerMap['PIB'])
  console.log('OBVEZNIK:', headerMap['OBVEZNIK'])
  console.log('STANUJE:', headerMap['STANUJE'])

  const dataArray = dataRows.map((row, idx) => {
    const getValue = (key) => {
      const index = headerMap[key]
      return index !== undefined ? (row[index] !== null && row[index] !== undefined ? String(row[index]).trim() : null) : null
    }

    // Debug first row
    if (idx === 0) {
      console.log('First row debug:')
      console.log('JMBG index:', headerMap['JMBG'], 'value:', row[headerMap['JMBG']])
      console.log('PIB index:', headerMap['PIB'], 'value:', row[headerMap['PIB']])
      console.log('OBVEZNIK index:', headerMap['OBVEZNIK'], 'value:', row[headerMap['OBVEZNIK']])
      console.log('STANUJE index:', headerMap['STANUJE'], 'value:', row[headerMap['STANUJE']])
      console.log('Full row:', row)
    }

    const item = {
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

    // Debug first item being created
    if (idx === 0) {
      console.log('First item to be saved:')
      console.log('obveznik:', item.obveznik)
      console.log('stanuje:', item.stanuje)
      console.log('Full item:', item)
    }

    return item
  }).filter(item => item.jmbg && item.sifra_akta && item.broj_prijave)

  return await potvrdeDB.bulkUpsert(dataArray, mode)
}

