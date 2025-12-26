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
    if (!query || !query.trim()) {
      return []
    }

    // Normalize text function - converts to lowercase and normalizes Serbian characters
    const normalizeText = (text) => {
      if (!text) return ''
      return text
        .toString()
        .toLowerCase()
        .replace(/č/g, 'c')
        .replace(/ć/g, 'c')
        .replace(/š/g, 's')
        .replace(/ž/g, 'z')
        .replace(/đ/g, 'd')
    }

    const normalizedQuery = normalizeText(query.trim())
    const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
    
    return await db.potvrde
      .filter(item => {
        const jmbg = normalizeText(item.jmbg)
        const obveznik = normalizeText(item.obveznik)
        const adresaObjekta = normalizeText(item.adresa_objekta)
        const adresaObveznika = normalizeText(item.adresa_obveznika)
        const pib = normalizeText(item.pib)
        
        // Check full match first
        if (jmbg.includes(normalizedQuery) || 
            obveznik.includes(normalizedQuery) || 
            adresaObjekta.includes(normalizedQuery) ||
            adresaObveznika.includes(normalizedQuery) ||
            pib.includes(normalizedQuery)) {
          return true
        }
        
        // Check individual words for flexible name matching
        if (words.length > 0) {
          const nameWords = obveznik.split(/\s+/)
          const allWordsMatch = words.every(word => 
            nameWords.some(nameWord => nameWord.includes(word))
          )
          if (allWordsMatch) {
            return true
          }
          
          // Also check address words
          const addressWords = (adresaObjekta + ' ' + adresaObveznika).split(/\s+/)
          const addressMatch = words.some(word =>
            addressWords.some(addrWord => addrWord.includes(word))
          )
          if (addressMatch) {
            return true
          }
        }
        
        return false
      })
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

