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
    const searchTerm = `%${query}%`
    const stmt = this.db.prepare(`
      SELECT * FROM uplatnice 
      WHERE jmbg LIKE ? OR ime_i_prezime LIKE ? OR adresa LIKE ?
      ORDER BY ime_i_prezime
      LIMIT 100
    `)
    return stmt.all(searchTerm, searchTerm, searchTerm)
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

