import Dexie from 'dexie'

class AppDatabase extends Dexie {
  uplatnice
  potvrde

  constructor() {
    super('UplatnicePotvrdeDB')
    
    this.version(1).stores({
      uplatnice: '++id, jmbg, ime_i_prezime, adresa, updated_at',
      potvrde: '++id, jmbg, sifra_akta, broj_prijave, pib, obveznik, [jmbg+sifra_akta+broj_prijave], updated_at'
    })
  }
}

export const db = new AppDatabase()

