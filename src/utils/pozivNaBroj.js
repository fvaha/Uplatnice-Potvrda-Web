// Mapiranje tipova poreza na šifre prihoda (Ek.konto)
export const TAX_REVENUE_CODES = {
  'iznos_poreza': '711111', // Porez na imovinu fizičkih lica
  'iznos_eko': '716111', // Naknada za zaštitu životne sredine
  'iznos_zemljiste': '711191', // Građevinsko zemljište (ili sličan interni kod LPA)
  'iznos_kom_takse': '714513', // Lokalna komunalna taksa za firmu/reklamu
  'iznos_samodoprinos': '711141', // Samodoprinos iz prihoda od poljoprivrede/imovine
  'iznos_sume': '742143', // Naknada za javne površine 742143843 (prvih 6 cifara)
  'iznos_unapredjenje_zivotne_sredine': '714565', // Naknada za javne površine 714565843 (prvih 6 cifara)
  'taksa_300': '842211', // Lokalne administrativne takse
  'taksa_400': '842211', // Lokalne administrativne takse
  'iznos_prihoda': '711111', // Prihod od uvećanja duga (isti kao porez)
  'iznos_koriscenja_prostora': '742143' // Naknada za korišćenje prostora
}

// Mapiranje tipova poreza na brojeve računa (Trezor)
export const TAX_ACCOUNT_NUMBERS = {
  'iznos_poreza': '840-711111843-05', // IZNOS POREZA (Imovina)
  'iznos_eko': '840-716111843-35', // IZNOS EKO (Zaštita sredine)
  'iznos_zemljiste': '840-711191843-61', // IZNOS G. ZEMLJIŠTA
  'iznos_kom_takse': '840-714513843-18', // IZNOS KOM. TAKSE
  'iznos_samodoprinos': '840-711141843-26', // IZNOS SAMODOPRINOS
  'iznos_sume': '840-742143843-62', // NAKNADA JAVNE POVRŠINE 742143843
  'iznos_unapredjenje_zivotne_sredine': '840-714565843-81', // NAKNADA JAVNE POVRŠINE 714565843
  'iznos_prihoda': '840-711111843-05', // UVEĆANJE CELOKUPNOG DUGA
  'taksa_300': '840-842211843-45', // ADMINISTRATIVNA TAKSA
  'taksa_400': '840-842211843-45', // ADMINISTRATIVNA TAKSA
  'iznos_koriscenja_prostora': '840-742143843-62' // NAKNADA ZA KORIŠĆENJE PROSTORA
}

// Šifra opštine Novi Pazar
const OPSTINA_CODE = '075'

// Model za poziv na broj
const MODEL = '97'

/**
 * Izračunava kontrolni broj koristeći MOD97 algoritam
 * @param {string} inputString - String za izračunavanje kontrolnog broja
 * @returns {string} - Dvocifreni kontrolni broj (00-96)
 */
function calculateControlNumber(inputString) {
  // Konvertuj string u cifre, gde se R tretira kao 27
  let digits = ''
  for (let i = 0; i < inputString.length; i++) {
    const char = inputString[i]
    if (char >= '0' && char <= '9') {
      digits += char
    } else if (char === 'R' || char === 'r') {
      // R se tretira kao 27 u MOD97 algoritmu
      digits += '27'
    }
  }
  
  if (!digits || digits.length === 0) {
    return '00'
  }

  // MOD97 algoritam
  let remainder = 0
  for (let i = 0; i < digits.length; i++) {
    remainder = (remainder * 10 + parseInt(digits[i])) % 97
  }

  // Kontrolni broj je 98 - remainder, ali ako je remainder 0, kontrolni broj je 97
  // Ako je remainder 1, kontrolni broj je 96, itd.
  const controlNumber = (98 - remainder) % 97
  
  // Formatiraj kao dvocifreni broj
  return String(controlNumber).padStart(2, '0')
}

/**
 * Generiše poziv na broj prema Modelu 97
 * Računa se samo na osnovu 075JMBG (ili 075JMBGR za reprogram)
 * @param {string} taxType - Tip poreza (ne koristi se, samo za kompatibilnost)
 * @param {string} jmbg - JMBG korisnika (13 cifara)
 * @param {boolean} reprogram - Da li je reprogram (dodaje se R na kraju)
 * @returns {string} - Formatiran poziv na broj: 97-XX-075-XXXXXXXXXXXXX[R]
 */
export function generatePozivNaBroj(taxType, jmbg, reprogram = false) {
  // Validacija JMBG
  const cleanJMBG = String(jmbg || '').replace(/\D/g, '')
  if (cleanJMBG.length !== 13) {
    console.warn(`Nevažeći JMBG: ${jmbg}`)
    return ''
  }

  // Formiraj string za izračunavanje: 075 + JMBG + 00 (ili 075 + JMBG + R + 00 za reprogram)
  let calculationString = `${OPSTINA_CODE}${cleanJMBG}00`
  if (reprogram) {
    // Za reprogram, R se dodaje pre 00
    calculationString = `${OPSTINA_CODE}${cleanJMBG}R00`
  }

  // Izračunaj kontrolni broj koristeći MOD97
  const controlNumber = calculateControlNumber(calculationString)

  // Formiraj finalni poziv na broj: [Kontrolni broj][075][JMBG][R] (bez crtica)
  let pozivNaBroj = `${controlNumber}${OPSTINA_CODE}${cleanJMBG}`

  // Ako je reprogram, dodaj R na kraju
  if (reprogram) {
    pozivNaBroj += 'R'
  }

  return pozivNaBroj
}

/**
 * Generiše poziv na broj za administrativne takse
 * @param {string} jmbg - JMBG korisnika
 * @param {boolean} reprogram - Da li je reprogram
 * @returns {string} - Formatiran poziv na broj: 97-XX-075-JMBG[R]
 */
export function generateAdminTaksaPozivNaBroj(jmbg = '', reprogram = false) {
  // Koristi isti format kao i ostali poreski oblici
  return generatePozivNaBroj('taksa_300', jmbg, reprogram)
}

/**
 * Vraća broj računa (Trezor) za određeni tip poreza
 * @param {string} taxType - Tip poreza
 * @returns {string} - Broj računa u formatu 840-XXXXXX-XX
 */
export function getAccountNumberForTax(taxType) {
  return TAX_ACCOUNT_NUMBERS[taxType] || '840-742251843-73' // Default račun ako nije pronađen
}

/**
 * Vraća label za tip poreza
 */
export function getTaxLabel(taxType) {
  const labels = {
    'iznos_poreza': 'POREZ',
    'iznos_eko': 'EKO TAKSA',
    'iznos_zemljiste': 'GRAĐEVINSKO ZEMLJIŠTE',
    'iznos_kom_takse': 'KOMUNALNA TAKSA',
    'iznos_samodoprinos': 'SAMODOPRINOS',
    'iznos_sume': 'NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 742143843',
    'iznos_unapredjenje_zivotne_sredine': 'NAKNADA ZA KORIŠĆENJE JAVNIH POVRŠINA 714565843',
    'taksa_300': 'ADMINISTRATIVNA TAKSA',
    'taksa_400': 'ADMINISTRATIVNA TAKSA',
    'iznos_prihoda': 'PRIHODA OD UVEĆANJA CELOKUPNOG PORESKOG DUGA',
    'iznos_koriscenja_prostora': 'NAKNADA ZA KORIŠĆENJE PROSTORA 742143843'
  }
  return labels[taxType] || taxType.toUpperCase()
}

