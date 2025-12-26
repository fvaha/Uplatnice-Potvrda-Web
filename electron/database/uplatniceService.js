import { UPLATNICE_SCHEMA } from './migrations.js'

class UplatniceService {
  constructor(db) {
    this.db = db
  }

  createTable() {
    this.db.exec(UPLATNICE_SCHEMA)
  }

  getAll() {
    const stmt = this.db.prepare('SELECT * FROM uplatnice ORDER BY ime_i_prezime')
    return stmt.all()
  }

  getByJMBG(jmbg) {
    const stmt = this.db.prepare('SELECT * FROM uplatnice WHERE jmbg = ?')
    return stmt.get(jmbg)
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
    
    // Build name conditions - match full name OR all words individually using NORMALIZE_TEXT
    const nameConditions = words.length > 0
      ? `(NORMALIZE_TEXT(ime_i_prezime) LIKE ? OR ${words.map(() => 'NORMALIZE_TEXT(ime_i_prezime) LIKE ?').join(' OR ')})`
      : 'NORMALIZE_TEXT(ime_i_prezime) LIKE ?'
    
    // Build params array
    const nameParams = [searchTerm] // Full name match
    if (words.length > 0) {
      nameParams.push(...words.map(w => `%${w}%`)) // Individual word matches
    }
    
    const sqlParams = [
      ...nameParams, // Name conditions
      searchTerm, // JMBG
      searchTerm, // Adresa
      searchTerm, // Ordering - exact name match
      searchTerm, // Ordering - JMBG match
    ]
    
    const stmt = this.db.prepare(`
      SELECT * FROM uplatnice 
      WHERE ${nameConditions}
         OR NORMALIZE_TEXT(jmbg) LIKE ? 
         OR NORMALIZE_TEXT(adresa) LIKE ?
      ORDER BY 
        CASE 
          WHEN NORMALIZE_TEXT(ime_i_prezime) LIKE ? THEN 1
          WHEN NORMALIZE_TEXT(jmbg) LIKE ? THEN 2
          ELSE 3
        END,
        ime_i_prezime
      LIMIT 100
    `)
    
    return stmt.all(...sqlParams)
  }

  insert(data) {
    const stmt = this.db.prepare(`
      INSERT INTO uplatnice (jmbg, ime_i_prezime, adresa)
      VALUES (?, ?, ?)
    `)
    return stmt.run(data.jmbg, data.ime_i_prezime, data.adresa)
  }

  update(data) {
    const stmt = this.db.prepare(`
      UPDATE uplatnice 
      SET ime_i_prezime = ?, adresa = ?, updated_at = CURRENT_TIMESTAMP
      WHERE jmbg = ?
    `)
    return stmt.run(data.ime_i_prezime, data.adresa, data.jmbg)
  }

  upsert(data) {
    const existing = this.getByJMBG(data.jmbg)
    if (existing) {
      return this.update(data)
    } else {
      return this.insert(data)
    }
  }

  bulkUpsert(dataArray) {
    const insertStmt = this.db.prepare(`
      INSERT INTO uplatnice (jmbg, ime_i_prezime, adresa)
      VALUES (?, ?, ?)
    `)
    
    const updateStmt = this.db.prepare(`
      UPDATE uplatnice 
      SET ime_i_prezime = ?, adresa = ?, updated_at = CURRENT_TIMESTAMP
      WHERE jmbg = ?
    `)

    const transaction = this.db.transaction((items) => {
      let inserted = 0
      let updated = 0

      for (const item of items) {
        const existing = this.getByJMBG(item.jmbg)
        if (existing) {
          updateStmt.run(item.ime_i_prezime, item.adresa, item.jmbg)
          updated++
        } else {
          insertStmt.run(item.jmbg, item.ime_i_prezime, item.adresa)
          inserted++
        }
      }

      return { inserted, updated, total: items.length }
    })

    return transaction(dataArray)
  }

  count() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM uplatnice')
    return stmt.get().count
  }

  deleteAll() {
    const stmt = this.db.prepare('DELETE FROM uplatnice')
    return stmt.run()
  }
}

export default UplatniceService

