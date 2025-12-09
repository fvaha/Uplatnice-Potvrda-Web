# Uplatnice i Potvrde

Modern web i desktop aplikacija za štampanje uplatnica i potvrda. Aplikacija podržava rad sa SQLite bazom podataka, import Excel fajlova, i personalizaciju štampanja.

## Opis projekta

Aplikacija omogućava:
- Kreiranje i štampanje uplatnica
- Kreiranje i štampanje potvrda
- Import podataka iz Excel fajlova (.xlsm, .xlsx)
- Upravljanje bazom podataka (SQLite)
- Personalizaciju izgleda štampanja
- Rad u web browseru ili kao desktop aplikacija (Electron)

## Tehnologije

- **Frontend**: React 19, Vite
- **Desktop**: Electron
- **Baza podataka**: SQLite (better-sqlite3)
- **Styling**: Tailwind CSS
- **UI komponente**: Radix UI
- **Animacije**: Framer Motion
- **Excel import**: xlsx

## Preduslovi

- Node.js (v18 ili noviji)
- pnpm (package manager)

## Instalacija

1. Kloniraj repozitorijum:
```bash
git clone https://github.com/fvaha/Uplatnice-Potvrda-Web.git
cd Uplatnice-Potvrda-Web
```

2. Instaliraj zavisnosti:
```bash
pnpm install
```

## Pokretanje

### Web aplikacija (development)

Pokreni web aplikaciju u development modu:
```bash
pnpm dev
```

Aplikacija će biti dostupna na `http://localhost:5175`

### Electron desktop aplikacija (development)

Pokreni Electron aplikaciju u development modu:
```bash
pnpm electron:dev
```

Ili pokreni i web i Electron zajedno:
```bash
pnpm start
```

## Build

### Web build

Napravi production build web aplikacije:
```bash
pnpm build
```

### Electron build

Napravi Electron desktop aplikaciju:

**Windows (portable):**
```bash
pnpm dist:win:portable
```

**Linux (AppImage):**
```bash
pnpm dist:linux:appimage
```

**Linux (deb):**
```bash
pnpm dist:linux:deb
```

**Linux (pacman):**
```bash
pnpm dist:linux:pacman
```

Build fajlovi se nalaze u `release/` folderu.

## Konfiguracija

### Environment varijable

Kreiraj `.env` fajl u root direktorijumu projekta:

```env
VITE_ADMIN_USERNAME=your_username
VITE_ADMIN_PASSWORD=your_password
```

Ove credentials se koriste za pristup Settings stranici.

## Struktura projekta

```
├── electron/          # Electron main proces i preload skripte
│   ├── database/     # SQLite servisi i migracije
│   └── utils/        # Excel importer i migracije
├── src/              # React aplikacija
│   ├── components/   # React komponente
│   ├── context/      # React context (AppContext)
│   ├── services/     # Servisi za bazu podataka
│   ├── utils/        # Utility funkcije
│   └── styles/       # Globalni CSS stilovi
├── resources/        # Resursi (logo, ikone)
└── release/          # Build output (ignorisano u git)
```

## Funkcionalnosti

### Uplatnice
- Kreiranje novih uplatnica
- Štampanje uplatnica
- Import iz Excel fajlova
- Upravljanje bazom podataka

### Potvrde
- Kreiranje novih potvrda
- Štampanje potvrda
- Import iz Excel fajlova
- Upravljanje bazom podataka

### Settings
- Import/export podataka
- Upravljanje bazom podataka
- Podešavanje štampača
- Podešavanje taksi

## Baza podataka

Aplikacija koristi SQLite bazu podataka. Baze se kreiraju automatski pri prvom pokretanju:
- `uplatnice.db` - baza za uplatnice
- `potvrde.db` - baza za potvrde

## Development

### Rebuild native moduli

Ako imaš problema sa `better-sqlite3` modulom:
```bash
pnpm electron:rebuild
```

### Preview build

Pregledaj production build:
```bash
pnpm preview
```

## Licenca

Privatni projekat

## Autor

Vaha
