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
    const searchTerm = `%${query}%`
    const stmt = this.db.prepare(`
      SELECT * FROM potvrde 
      WHERE jmbg LIKE ? OR obveznik LIKE ? OR adresa_objekta LIKE ? OR pib LIKE ?
      ORDER BY obveznik
      LIMIT 100
    `)
    return stmt.all(searchTerm, searchTerm, searchTerm, searchTerm)
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

