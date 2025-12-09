import { db } from './database.js'

export const potvrdeDB = {
  async getAll() {
    return await db.potvrde.orderBy('obveznik').toArray()
  },

  async getByJMBG(jmbg) {
    return await db.potvrde.where('jmbg').equals(jmbg).toArray()
  },

  async getByPIB(pib) {
    return await db.potvrde.where('pib').equals(pib).toArray()
  },

  async getByUnique(jmbg, sifra_akta, broj_prijave) {
    return await db.potvrde
      .where('[jmbg+sifra_akta+broj_prijave]')
      .equals([jmbg, sifra_akta, broj_prijave])
      .first()
  },

  async search(query) {
    const searchTerm = query.toLowerCase()
    return await db.potvrde
      .filter(item => 
        item.jmbg?.toString().toLowerCase().includes(searchTerm) ||
        item.obveznik?.toLowerCase().includes(searchTerm) ||
        item.adresa_objekta?.toLowerCase().includes(searchTerm) ||
        item.pib?.toString().toLowerCase().includes(searchTerm)
      )
      .limit(100)
      .toArray()
  },

  async insert(data) {
    return await db.potvrde.add({
      ...data,
      updated_at: new Date()
    })
  },

  async update(id, data) {
    return await db.potvrde.update(id, {
      ...data,
      updated_at: new Date()
    })
  },

  async upsert(data) {
    const existing = await this.getByUnique(data.jmbg, data.sifra_akta, data.broj_prijave)
    if (existing) {
      return await this.update(existing.id, data)
    } else {
      return await this.insert(data)
    }
  },

  async bulkUpsert(dataArray, mode = 'update') {
    if (mode === 'replace') {
      await db.potvrde.clear()
    }

    let inserted = 0
    let updated = 0
    let skipped = 0

    if (mode === 'append') {
      const allExisting = await db.potvrde.toArray()
      const existingSet = new Set(
        allExisting.map(p => `${p.jmbg}_${p.sifra_akta}_${p.broj_prijave}`)
      )
      
      for (const item of dataArray) {
        const key = `${item.jmbg}_${item.sifra_akta}_${item.broj_prijave}`
        if (!existingSet.has(key)) {
          await this.insert(item)
          inserted++
        } else {
          skipped++
        }
      }
    } else {
      for (const item of dataArray) {
        const existing = await this.getByUnique(item.jmbg, item.sifra_akta, item.broj_prijave)
        if (existing) {
          await this.update(existing.id, item)
          updated++
        } else {
          await this.insert(item)
          inserted++
        }
      }
    }

    return { inserted, updated, skipped, total: dataArray.length }
  },

  async count() {
    return await db.potvrde.count()
  },

  async deleteAll() {
    return await db.potvrde.clear()
  }
}

