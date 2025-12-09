export const UPLATNICE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS uplatnice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jmbg TEXT UNIQUE NOT NULL,
    ime_i_prezime TEXT NOT NULL,
    adresa TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_uplatnice_jmbg ON uplatnice(jmbg);
`

export const POTVRDE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS potvrde (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sifra_opstine INTEGER,
    sifra_akta TEXT,
    broj_prijave TEXT,
    jmbg TEXT NOT NULL,
    vlasnistvo_od INTEGER,
    vlasnistvo_do INTEGER,
    status_prijave TEXT,
    izvor_podataka TEXT,
    datum_prijave INTEGER,
    pib TEXT,
    obveznik TEXT,
    stanuje TEXT,
    adresa_obveznika TEXT,
    adresa_objekta TEXT,
    vrsta_prava TEXT,
    vrsta_nepokretnosti TEXT,
    zona TEXT,
    oporeziva_povrsina REAL,
    datum_izgradnje_rekonstrukcije INTEGER,
    osnovica_preth_god REAL,
    porez_preth_god REAL,
    status_lica TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(jmbg, sifra_akta, broj_prijave)
  );

  CREATE INDEX IF NOT EXISTS idx_potvrde_jmbg ON potvrde(jmbg);
  CREATE INDEX IF NOT EXISTS idx_potvrde_pib ON potvrde(pib);
`

