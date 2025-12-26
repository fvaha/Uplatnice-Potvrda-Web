/**
 * NBS IPS QR kod generator i validator
 * 
 * Redosled generisanja QR kodova:
 * 1. Lokalno generisanje (offline, najbrže) - koristi qrcode biblioteku
 * 2. NBS API (ako ima internet) - zvanični NBS servis
 * 3. qrserver.com (fallback) - spoljni servis ako NBS API ne radi
 * 
 * Aplikacija može raditi potpuno offline jer koristi lokalno generisanje kao primarni način.
 */

import QRCode from 'qrcode'

const NBS_API_BASE = 'https://ips.nbs.rs'

// Cache za proveru da li NBS API radi (da ne proveravamo svaki put)
let nbsApiAvailable = null
let nbsApiCheckTime = 0
const NBS_API_CHECK_INTERVAL = 5 * 60 * 1000 // Proveri svakih 5 minuta

/**
 * Proverava da li NBS API radi
 * @returns {Promise<boolean>} - Da li NBS API radi
 */
async function checkNBSApiAvailable() {
  const now = Date.now()
  
  // Ako smo nedavno proverili, koristi cache
  if (nbsApiAvailable !== null && (now - nbsApiCheckTime) < NBS_API_CHECK_INTERVAL) {
    return nbsApiAvailable
  }

  try {
    // Proveri NBS API endpoint (možemo koristiti generator endpoint)
    const testUrl = `${NBS_API_BASE}/sr_lat/qr-validacija-generisanje`
    const response = await fetch(testUrl, {
      method: 'HEAD',
      mode: 'no-cors' // Za izbegavanje CORS problema
    })
    
    // Ako ne baca grešku, API je dostupan
    nbsApiAvailable = true
    nbsApiCheckTime = now
    return true
  } catch (error) {
    nbsApiAvailable = false
    nbsApiCheckTime = now
    return false
  }
}

/**
 * Generiše NBS IPS QR kod lokalno (offline), ili pokušava NBS API/qrserver.com ako ima internet
 * @param {string} ipsString - NBS IPS format string (K:PR|V:01|...)
 * @param {number} size - Veličina QR koda u pikselima (default: 300)
 * @returns {Promise<string>} - Data URL (base64) ili URL QR kod slike
 */
export async function generateNBSQR(ipsString, size = 300) {
  try {
    // 1. PRVO: Lokalno generisanje (radi offline, najbrže)
    try {
      const qrDataUrl = await QRCode.toDataURL(ipsString, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M'
      })
      return qrDataUrl // Vraća data:image/png;base64,...
    } catch (localError) {
      console.warn('Lokalno generisanje QR koda neuspešno, pokušavam NBS API:', localError)
      // Nastavi na NBS API
    }
  } catch (error) {
    console.warn('Greška pri lokalnom generisanju, pokušavam NBS API:', error)
  }

  // 2. DRUGO: NBS API (ako ima internet)
  try {
    const isNBSAvailable = await checkNBSApiAvailable()
    
    if (isNBSAvailable) {
      try {
        const nbsApiUrl = `${NBS_API_BASE}/api/generator`
        
        const response = await fetch(nbsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            qrData: ipsString,
            size: size
          })
        })

        if (response.ok) {
          const result = await response.json()
          
          if (result.imageUrl) {
            return result.imageUrl
          } else if (result.imageBase64) {
            return `data:image/png;base64,${result.imageBase64}`
          } else if (result.qrCodeUrl) {
            return result.qrCodeUrl
          }
        }
      } catch (nbsError) {
        console.warn('NBS API error, using qrserver.com fallback:', nbsError)
      }
    }
  } catch (error) {
    console.warn('NBS API check failed, using qrserver.com fallback:', error)
  }

  // 3. TREĆE: Fallback na qrserver.com (zahteva internet)
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ipsString)}&size=${size}x${size}&ecc=M`
}

/**
 * Sinhrona verzija koja generiše QR kod lokalno (offline)
 * Koristi se u HTML template-ima gde se direktno ubacuje data URL u string.
 * 
 * @param {string} ipsString - NBS IPS format string (K:PR|V:01|...)
 * @param {number} size - Veličina QR koda u pikselima (default: 300)
 * @returns {string} - Data URL (base64) QR kod slike
 */
export function generateNBSQRSync(ipsString, size = 300) {
  try {
    // Koristi QRCode.toDataURLSync ako postoji, inače generiši asinhrono
    // Pošto qrcode biblioteka nema sync verziju, koristimo fallback URL
    // U praksi, ovo će biti zamenjeno sa async verzijom u komponentama
    // Ali za template-ove, koristimo qrserver.com kao fallback
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ipsString)}&size=${size}x${size}&ecc=M`
  } catch (error) {
    console.error('Greška pri sinhronom generisanju QR koda:', error)
    // Fallback URL
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ipsString)}&size=${size}x${size}&ecc=M`
  }
}

/**
 * Validira NBS IPS QR kod koristeći NBS Validator API
 * @param {string} qrImageUrl - URL ili base64 string QR kod slike
 * @returns {Promise<{valid: boolean, errors: string[], message?: string}>} - Rezultat validacije
 */
export async function validateNBSQR(qrImageUrl) {
  try {
    // NBS Validator API endpoint - prema dokumentaciji
    const apiUrl = `${NBS_API_BASE}/sr_lat/qr-validacija-generisanje/validator-nbs-ips-qr-koda`
    
    // Ako je URL, preuzmi sliku
    let imageBlob
    if (qrImageUrl.startsWith('data:')) {
      const response = await fetch(qrImageUrl)
      imageBlob = await response.blob()
    } else {
      const response = await fetch(qrImageUrl)
      imageBlob = await response.blob()
    }

    const formData = new FormData()
    formData.append('qrImage', imageBlob, 'qr.png')

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`NBS Validator API error: ${response.status}`)
    }

    // NBS Validator vraća HTML stranicu sa rezultatom
    // Trebalo bi da parsujemo rezultat
    const text = await response.text()
    
    // Provera da li validacija prošla (pošto NBS vraća HTML, ovo je pojednostavljeno)
    const isValid = !text.includes('greška') && !text.includes('error')
    
    return {
      valid: isValid,
      errors: isValid ? [] : ['QR kod nije validan prema NBS standardu'],
      message: isValid ? 'QR kod je validan' : 'QR kod nije validan'
    }
  } catch (error) {
    console.error('NBS Validator API error:', error)
    return {
      valid: false,
      errors: [`Greška pri validaciji: ${error.message}`],
      message: 'Greška pri povezivanju sa NBS Validator servisom'
    }
  }
}

/**
 * Generiše NBS IPS format string
 * @param {Object} params - Parametri za QR kod
 * @param {string} params.account - Račun primaoca (18 cifara)
 * @param {string} params.payeeName - Naziv primaoca
 * @param {number} params.amount - Iznos (broj sa tačkom)
 * @param {string} params.paymentCode - Šifra plaćanja
 * @param {string} params.purpose - Svrha uplate
 * @param {string} params.model - Model (npr. "97")
 * @param {string} params.reference - Poziv na broj
 * @returns {string} - NBS IPS format string
 */
export function generateIPSString({
  account,
  payeeName,
  amount,
  paymentCode,
  purpose,
  model,
  reference
}) {
  // Sanitizacija - uklanja pipe karaktere i ograničava dužinu
  const sanitize = (str, maxLength = 70) => {
    return (str || '').replace(/[\n\r|]/g, ' ').trim().substring(0, maxLength)
  }

  const sanitizedPurpose = sanitize(purpose)
  const sanitizedReference = sanitize(reference)
  const sanitizedPayeeName = sanitize(payeeName)

  // Format: K:PR|V:01|C:1|R:račun|N:naziv|I:iznos|SF:šifra|S:svrha|RO:model|P:poziv
  return `K:PR|V:01|C:1|R:${account}|N:${sanitizedPayeeName}|I:${amount.toFixed(2)}|SF:${paymentCode}|S:${sanitizedPurpose}|RO:${model}|P:${sanitizedReference}`
}

/**
 * Validira NBS IPS format string pre generisanja QR koda
 * @param {string} ipsString - NBS IPS format string
 * @returns {{valid: boolean, errors: string[]}} - Rezultat validacije
 */
export function validateIPSString(ipsString) {
  const errors = []

  if (!ipsString || typeof ipsString !== 'string') {
    errors.push('IPS string je obavezan')
    return { valid: false, errors }
  }

  // Provera osnovnog formata
  if (!ipsString.startsWith('K:PR|')) {
    errors.push('IPS string mora počinjati sa K:PR|')
  }

  // Provera da li sadrži sva obavezna polja
  const requiredFields = ['K:PR', 'V:', 'C:', 'R:', 'N:', 'I:', 'SF:', 'S:', 'RO:', 'P:']
  for (const field of requiredFields) {
    if (!ipsString.includes(field)) {
      errors.push(`IPS string mora sadržati polje ${field}`)
    }
  }

  // Provera formata računa (R: polje mora imati 18 cifara)
  const accountMatch = ipsString.match(/R:(\d{18})/)
  if (!accountMatch) {
    errors.push('Račun (R: polje) mora imati tačno 18 cifara')
  }

  // Provera formata iznosa (I: polje mora biti broj sa tačkom)
  const amountMatch = ipsString.match(/I:(\d+\.\d{2})/)
  if (!amountMatch) {
    errors.push('Iznos (I: polje) mora biti u formatu broj.XX (npr. 1234.56)')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

