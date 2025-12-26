import { POTVRDE_SCHEMA } from './migrations.js'

class PotvrdeService {
  constructor(db) {
    this.db = db
  }

  createTable() {
    this.db.exec(POTVRDE_SCHEMA)
  }

  getAll() {
    const stmt = this.db.prepare('SELECT * FROM potvrde ORDER BY obveznik')
    return stmt.all()
  }

  getByJMBG(jmbg) {
    const stmt = this.db.prepare('SELECT * FROM potvrde WHERE jmbg = ?')
    return stmt.all(jmbg)
  }

  getByPIB(pib) {
    const stmt = this.db.prepare('SELECT * FROM potvrde WHERE pib = ?')
    return stmt.all(pib)
  }

  getByUnique(jmbg, sifra_akta, broj_prijave) {
    const stmt = this.db.prepare(`
      SELECT * FROM potvrde 
      WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?
    `)
    return stmt.get(jmbg, sifra_akta, broj_prijave)
  }

  search(query) {
    if (!query || !query.trim()) {
      return []
    }

    // Normalize query - remove extra spaces and normalize Serbian characters
    const normalizedQuery = query.trim()
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
    
    const normalizedSearchTerm = normalizeText(normalizedQuery)
    const searchTerm = `%${normalizedSearchTerm}%`
    
    // Split query into words for flexible name matching
    const words = normalizedSearchTerm.split(/\s+/).filter(w => w.length > 0)
    
    // Build flexible search conditions for obveznik (name) using NORMALIZE_TEXT
    const nameConditions = words.length > 0
      ? `(NORMALIZE_TEXT(obveznik) LIKE ? OR ${words.map(() => 'NORMALIZE_TEXT(obveznik) LIKE ?').join(' OR ')})`
      : 'NORMALIZE_TEXT(obveznik) LIKE ?'
    
    // Build name params
    const nameParams = [searchTerm] // Full name match
    if (words.length > 0) {
      nameParams.push(...words.map(w => `%${w}%`)) // Individual word matches
    }
    
    // Build address conditions (both adresa_obveznika and adresa_objekta) using NORMALIZE_TEXT
    const addressConditions = words.length > 0
      ? `((NORMALIZE_TEXT(adresa_objekta) LIKE ? OR NORMALIZE_TEXT(adresa_obveznika) LIKE ?) OR ${words.map(() => '(NORMALIZE_TEXT(adresa_objekta) LIKE ? OR NORMALIZE_TEXT(adresa_obveznika) LIKE ?)').join(' OR ')})`
      : '(NORMALIZE_TEXT(adresa_objekta) LIKE ? OR NORMALIZE_TEXT(adresa_obveznika) LIKE ?)'
    
    // Build address params
    const addressParams = [searchTerm, searchTerm] // Full address match
    if (words.length > 0) {
      addressParams.push(...words.flatMap(w => [`%${w}%`, `%${w}%`])) // Individual word matches for both addresses
    }
    
    // Combine all params
    const sqlParams = [
      ...nameParams, // Name conditions
      searchTerm, // JMBG
      ...addressParams, // Address conditions
      searchTerm, // PIB
      searchTerm, // Ordering - exact name match
      searchTerm, // Ordering - JMBG match
      searchTerm, // Ordering - PIB match
    ]
    
    const stmt = this.db.prepare(`
      SELECT * FROM potvrde 
      WHERE ${nameConditions}
         OR NORMALIZE_TEXT(jmbg) LIKE ?
         OR ${addressConditions}
         OR NORMALIZE_TEXT(pib) LIKE ?
      ORDER BY 
        CASE 
          WHEN NORMALIZE_TEXT(obveznik) LIKE ? THEN 1
          WHEN NORMALIZE_TEXT(jmbg) LIKE ? THEN 2
          WHEN NORMALIZE_TEXT(pib) LIKE ? THEN 3
          ELSE 4
        END,
        obveznik
      LIMIT 100
    `)
    
    return stmt.all(...sqlParams)
  }

  insert(data) {
    // Debug first insert
    if (!this._firstInsertLogged) {
      console.log('[POTVRDE SERVICE] First insert data:')
      console.log('obveznik:', data.obveznik)
      console.log('stanuje:', data.stanuje)
      console.log('pib:', data.pib)
      console.log('jmbg:', data.jmbg)
      this._firstInsertLogged = true
    }

    const stmt = this.db.prepare(`
      INSERT INTO potvrde (
        sifra_opstine, sifra_akta, broj_prijave, jmbg, vlasnistvo_od, vlasnistvo_do,
        status_prijave, izvor_podataka, datum_prijave, pib, obveznik, stanuje,
        adresa_obveznika, adresa_objekta, vrsta_prava, vrsta_nepokretnosti, zona,
        oporeziva_povrsina, datum_izgradnje_rekonstrukcije, osnovica_preth_god,
        porez_preth_god, status_lica
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    return stmt.run(
      data.sifra_opstine, data.sifra_akta, data.broj_prijave, data.jmbg,
      data.vlasnistvo_od, data.vlasnistvo_do, data.status_prijave, data.izvor_podataka,
      data.datum_prijave, data.pib, data.obveznik, data.stanuje,
      data.adresa_obveznika, data.adresa_objekta, data.vrsta_prava, data.vrsta_nepokretnosti,
      data.zona, data.oporeziva_povrsina, data.datum_izgradnje_rekonstrukcije,
      data.osnovica_preth_god, data.porez_preth_god, data.status_lica
    )
  }

  update(data) {
    const stmt = this.db.prepare(`
      UPDATE potvrde SET
        sifra_opstine = ?, vlasnistvo_od = ?, vlasnistvo_do = ?,
        status_prijave = ?, izvor_podataka = ?, datum_prijave = ?, pib = ?,
        obveznik = ?, stanuje = ?, adresa_obveznika = ?, adresa_objekta = ?,
        vrsta_prava = ?, vrsta_nepokretnosti = ?, zona = ?,
        oporeziva_povrsina = ?, datum_izgradnje_rekonstrukcije = ?,
        osnovica_preth_god = ?, porez_preth_god = ?, status_lica = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?
    `)
    return stmt.run(
      data.sifra_opstine, data.vlasnistvo_od, data.vlasnistvo_do,
      data.status_prijave, data.izvor_podataka, data.datum_prijave, data.pib,
      data.obveznik, data.stanuje, data.adresa_obveznika, data.adresa_objekta,
      data.vrsta_prava, data.vrsta_nepokretnosti, data.zona,
      data.oporeziva_povrsina, data.datum_izgradnje_rekonstrukcije,
      data.osnovica_preth_god, data.porez_preth_god, data.status_lica,
      data.jmbg, data.sifra_akta, data.broj_prijave
    )
  }

  upsert(data) {
    const existing = this.getByUnique(data.jmbg, data.sifra_akta, data.broj_prijave)
    if (existing) {
      return this.update(data)
    } else {
      return this.insert(data)
    }
  }

  bulkUpsert(dataArray) {
    const insertStmt = this.db.prepare(`
      INSERT INTO potvrde (
        sifra_opstine, sifra_akta, broj_prijave, jmbg, vlasnistvo_od, vlasnistvo_do,
        status_prijave, izvor_podataka, datum_prijave, pib, obveznik, stanuje,
        adresa_obveznika, adresa_objekta, vrsta_prava, vrsta_nepokretnosti, zona,
        oporeziva_povrsina, datum_izgradnje_rekonstrukcije, osnovica_preth_god,
        porez_preth_god, status_lica
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const updateStmt = this.db.prepare(`
      UPDATE potvrde SET
        sifra_opstine = ?, vlasnistvo_od = ?, vlasnistvo_do = ?,
        status_prijave = ?, izvor_podataka = ?, datum_prijave = ?, pib = ?,
        obveznik = ?, stanuje = ?, adresa_obveznika = ?, adresa_objekta = ?,
        vrsta_prava = ?, vrsta_nepokretnosti = ?, zona = ?,
        oporeziva_povrsina = ?, datum_izgradnje_rekonstrukcije = ?,
        osnovica_preth_god = ?, porez_preth_god = ?, status_lica = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE jmbg = ? AND sifra_akta = ? AND broj_prijave = ?
    `)

    const transaction = this.db.transaction((items) => {
      let inserted = 0
      let updated = 0

      for (const item of items) {
        const existing = this.getByUnique(item.jmbg, item.sifra_akta, item.broj_prijave)
        if (existing) {
          updateStmt.run(
            item.sifra_opstine, item.vlasnistvo_od, item.vlasnistvo_do,
            item.status_prijave, item.izvor_podataka, item.datum_prijave, item.pib,
            item.obveznik, item.stanuje, item.adresa_obveznika, item.adresa_objekta,
            item.vrsta_prava, item.vrsta_nepokretnosti, item.zona,
            item.oporeziva_povrsina, item.datum_izgradnje_rekonstrukcije,
            item.osnovica_preth_god, item.porez_preth_god, item.status_lica,
            item.jmbg, item.sifra_akta, item.broj_prijave
          )
          updated++
        } else {
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
      }

      return { inserted, updated, total: items.length }
    })

    return transaction(dataArray)
  }

  count() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM potvrde')
    return stmt.get().count
  }

  deleteAll() {
    const stmt = this.db.prepare('DELETE FROM potvrde')
    return stmt.run()
  }
}

export default PotvrdeService

