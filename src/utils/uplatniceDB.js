import { db } from './database.js'

export const uplatniceDB = {
  async getAll() {
    return await db.uplatnice.orderBy('ime_i_prezime').toArray()
  },

  async getByJMBG(jmbg) {
    return await db.uplatnice.where('jmbg').equals(jmbg).first()
  },

  async search(query) {
    if (!query || !query.trim()) {
      return []
    }

    // Normalize text function - converts to lowercase and normalizes Serbian characters
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

    const normalizedQuery = normalizeText(query.trim())
    const words = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
    
    return await db.uplatnice
      .filter(item => {
        const jmbg = normalizeText(item.jmbg)
        const imePrezime = normalizeText(item.ime_i_prezime)
        const adresa = normalizeText(item.adresa)
        
        // Check full match first
        if (jmbg.includes(normalizedQuery) || 
            imePrezime.includes(normalizedQuery) || 
            adresa.includes(normalizedQuery)) {
          return true
        }
        
        // Check individual words for flexible name matching
        if (words.length > 0) {
          const nameWords = imePrezime.split(/\s+/)
          const allWordsMatch = words.every(word => 
            nameWords.some(nameWord => nameWord.includes(word))
          )
          if (allWordsMatch) {
            return true
          }
        }
        
        return false
      })
      .limit(100)
      .toArray()
  },

  async insert(data) {
    return await db.uplatnice.add({
      ...data,
      updated_at: new Date()
    })
  },

  async update(id, data) {
    return await db.uplatnice.update(id, {
      ...data,
      updated_at: new Date()
    })
  },

  async upsert(data) {
    const existing = await this.getByJMBG(data.jmbg)
    if (existing) {
      return await this.update(existing.id, data)
    } else {
      return await this.insert(data)
    }
  },

  async bulkUpsert(dataArray, mode = 'update') {
    if (mode === 'replace') {
      await db.uplatnice.clear()
    }

    let inserted = 0
    let updated = 0
    let skipped = 0

    if (mode === 'append') {
      const existingJMBGs = new Set(
        (await db.uplatnice.toCollection().keys()).map(k => 
          db.uplatnice.get(k).then(u => u?.jmbg)
        )
      )
      const resolvedJMBGs = await Promise.all(Array.from(existingJMBGs))
      const existingSet = new Set(resolvedJMBGs.filter(Boolean))
      
      for (const item of dataArray) {
        if (!existingSet.has(item.jmbg)) {
          await this.insert(item)
          inserted++
        } else {
          skipped++
        }
      }
    } else {
      for (const item of dataArray) {
        const existing = await this.getByJMBG(item.jmbg)
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
    return await db.uplatnice.count()
  },

  async deleteAll() {
    return await db.uplatnice.clear()
  }
}

