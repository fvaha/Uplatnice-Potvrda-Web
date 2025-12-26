import { logoBase64 } from './logoData.js'
import { getAccountNumberForTax } from './pozivNaBroj.js'
import { generateNBSQR } from './nbsQRGenerator.js'

export async function generateUplatnicaHTML(data) {
  // Determine items to list
  const items = data.items || (data.stavka && data.iznos ? [{ opis: data.stavka, iznos: data.iznos }] : [])

  // Filter out items with zero or invalid amounts
  const validItems = items.filter(item => parseFloat(item.iznos) > 0)
  
  // Calculate total from valid items only
  const total = validItems.reduce((sum, item) => sum + (parseFloat(item.iznos) || 0), 0)
  const totalFmt = total.toFixed(2).replace('.', ',')
  
  // Za zbirnu uplatnicu (više stavki), polja u nalogu za uplatu treba da budu prazna
  // Ako nema validnih stavki, tretiraj kao zbirnu uplatnicu bez selektovanih stavki
  const isZbirnaUplatnica = validItems.length > 1 || validItems.length === 0
  
  // Bottom slip amount logic
  // If explicitly requested to hide amount (multi-item mode), leave empty
  // Za zbirnu uplatnicu, iznos u nalogu za uplatu treba da bude prazan
  const iznosSlip = (data.hideAmountOnSlip || isZbirnaUplatnica) ? '' : `= ${totalFmt}`

  // QR Code Amount: ALWAYS use the total so the code is valid and useful
  const iznosQR = total.toFixed(2).replace('.', ',')

  // Za zbirnu uplatnicu, svrha uplate u nalogu za uplatu treba da bude prazna
  const stavka = validItems.length === 1 ? validItems[0].opis : 'UPLATA PO ZADUŽENJU'
  const stavkaNalog = isZbirnaUplatnica ? '' : stavka
  
  const platioc = `${data.ime_i_prezime || ''}, ${data.adresa || ''}`.trim()
  const primalac = 'GRAD NOVI PAZAR\nGU ZA NAPLATU JAVNIH PRIHODA\n7. JULI BB, NOVI PAZAR'
  
  // Za pojedinačnu stavku, koristi račun za tu stavku, inače default
  // Ako ima samo jedna stavka, koristi račun iz te stavke ako postoji taxType
  const racun = validItems.length === 1 && validItems[0].taxType 
    ? getAccountNumberForTax(validItems[0].taxType) 
    : (data.taxType ? getAccountNumberForTax(data.taxType) : '840-742251843-73')
  // Za zbirnu uplatnicu, račun primaoca treba da bude prazan (korisnik može da unese bilo koji)
  const racunNalog = isZbirnaUplatnica ? '' : racun
  
  const sifra = '153'
  const model = '97'
  // Ako ima samo jedna stavka, koristi poziv na broj iz te stavke ako postoji
  const poziv = validItems.length === 1 && validItems[0].poziv_na_broj 
    ? validItems[0].poziv_na_broj 
    : (data.poziv_na_broj || '')
  // Za zbirnu uplatnicu, poziv na broj u nalogu za uplatu treba da bude prazan
  const pozivNalog = isZbirnaUplatnica ? '' : poziv
  const datum = new Date().toLocaleDateString('sr-RS')
  const rok = new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('sr-RS') // 15 days from now

  // IPS QR String
  // Za zbirnu uplatnicu, QR kod u "NALOG ZA UPLATU" sekciji ne treba da se prikazuje
  // (korisnik može da unese bilo koji račun, pa se ne može generisati validan QR kod)
  let qrUrl = ''
  // Helper za sanitizaciju (koristi se i u drugim delovima)
  const sanitize = (str) => (str || '').replace(/[\n\r|]/g, ' ').trim().substring(0, 70)
  
  // NBS: Name of payee - definisan na nivou funkcije da bude dostupan svuda
  const n_primalac = "GRAD NOVI PAZAR"
  
  if (!isZbirnaUplatnica && total > 0) {
    // 1. Format Account: Must be 18 digits. 840-742251843-73 -> 840000074225184373
    const parts = racun.split('-')
    const bank = parts[0]
    const acc = parts[1].padStart(13, '0') // Pad middle part to 13 digits
    const check = parts[2]
    const ipsAccount = `${bank}${acc}${check}`

    // 2. Format Amount: Prema NBS IPS standardu, iznos treba da bude samo broj sa tačkom kao decimalnim separatorom
    // total.toFixed(2) već vraća format sa tačkom (npr. "1234.56")
    const ipsAmount = total.toFixed(2)

    const s_svrha = sanitize(stavka)
    const p_poziv = sanitize(poziv)

    // NBS IPS format: K:PR|V:01|C:1|R:račun|N:naziv|I:iznos|SF:šifra|S:svrha|RO:model|P:poziv
    const ipsString = `K:PR|V:01|C:1|R:${ipsAccount}|N:${n_primalac}|I:${ipsAmount}|SF:${sifra}|S:${s_svrha}|RO:${model}|P:${p_poziv}`
    // Generiši QR kod lokalno (offline) ili preko NBS API/qrserver.com
    qrUrl = await generateNBSQR(ipsString, 300)
  }

  const logoUrl = logoBase64

  // Matrix (Epson PLQ-20) Mode
  if (data.matrix) {
    // Za matricni štampač, koristi poziv na broj iz data objekta (već generisan za tu stavku)
    const matrixPoziv = data.poziv_na_broj || poziv
    
    // Koristi račun za ovu stavku
    const matrixRacun = data.taxType ? getAccountNumberForTax(data.taxType) : racun
    const matrixParts = matrixRacun.split('-')
    const matrixBank = matrixParts[0]
    const matrixAcc = matrixParts[1].padStart(13, '0')
    const matrixCheck = matrixParts[2]
    const matrixIpsAccount = `${matrixBank}${matrixAcc}${matrixCheck}`
    
    // Format Amount: Prema NBS IPS standardu, iznos treba da bude samo broj sa tačkom kao decimalnim separatorom
    const matrixIpsAmount = total.toFixed(2)
    
    // Generiši mali QR kod za matricni štampač samo ako je iznos > 0
    let matrixQRUrl = ''
    if (total > 0) {
      // NBS IPS format: K:PR|V:01|C:1|R:račun|N:naziv|I:iznos|SF:šifra|S:svrha|RO:model|P:poziv
      const matrixQRString = `K:PR|V:01|C:1|R:${matrixIpsAccount}|N:${n_primalac}|I:${matrixIpsAmount}|SF:${sifra}|S:${sanitize(stavka)}|RO:${model}|P:${sanitize(matrixPoziv)}`
      matrixQRUrl = await generateNBSQR(matrixQRString, 120)
    }
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Uplatnica Matrix</title>
  <style>
    @page {
      size: 210mm 99mm; /* Standard slip size */
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Courier New', Courier, monospace; /* Matrix printer font friendly */
      font-size: 12px;
      width: 210mm;
      height: 99mm;
    }
    .slip-container {
      position: relative;
      width: 210mm;
      height: 99mm;
      /* background-image: url('placeholder-background.png'); optional if printing ON FORM */
    }
    .field {
      position: absolute;
    }
    
    /* QR kod za matricni štampač - mali da ne troši mnogo tonera */
    .qr-code-matrix {
      position: absolute;
      bottom: 10mm;
      right: 10mm;
      width: 25mm;
      height: 25mm;
    }
    
    /* Info sekcija uz središnju liniju - ista pozicija kao u glavnom template-u */
    .info-section-matrix {
      position: absolute;
      bottom: 10mm;
      left: 0;
      margin-left: 5mm;
      width: 60mm;
      font-size: 7pt;
      line-height: 1.2;
      color: #333;
      font-family: 'Courier New', Courier, monospace;
    }
    .info-section-matrix div {
      margin-bottom: 0.5px;
    }
    .info-section-matrix strong {
      font-size: 9pt;
      font-weight: bold;
    }
    
    /* Absolute Positioning for Matrix - adjust based on real form measure */
    .platioc-box { top: 12mm; left: 10mm; width: 80mm; height: 30mm; }
    .svrha-box { top: 46mm; left: 10mm; width: 80mm; height: 18mm; }
    .primalac-box { top: 68mm; left: 10mm; width: 80mm; height: 25mm; }
    
    .sifra-box { top: 14mm; left: 116mm; width: 12mm; text-align: center; }
    .valuta-box { top: 14mm; left: 130mm; width: 12mm; text-align: center; }
    .iznos-box { top: 14mm; left: 145mm; width: 35mm; text-align: right; font-weight: bold; font-size: 14px; }
    
    .racun-box { top: 24mm; left: 116mm; width: 80mm; }
    .model-box { top: 34mm; left: 116mm; width: 10mm; text-align: center; }
    .poziv-box { top: 34mm; left: 128mm; width: 68mm; }
    
    /* Text styling */
    .data-text {
      text-transform: uppercase;
      line-height: 1.2;
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <div class="field platioc-box data-text">${platioc.replace(/\n/g, '<br>')}</div>
    <div class="field svrha-box data-text">${stavka}</div>
    <div class="field primalac-box data-text">${primalac.replace(/\n/g, '<br>')}</div>
    
    <div class="field sifra-box data-text">${sifra}</div>
    <div class="field valuta-box data-text">RSD</div>
    <div class="field iznos-box data-text">= ${totalFmt}</div>
    
    <div class="field racun-box data-text">${matrixRacun}</div>
    <div class="field model-box data-text">${model}</div>
    <div class="field poziv-box data-text">${matrixPoziv}</div>
    
    <!-- Info sekcija uz srednju liniju - levo od QR koda -->
    <div class="info-section-matrix">
      <div>Grad Novi Pazar</div>
      <div>Uprava za naplatu javnih prihoda</div>
      <div>7. Juli bb, 36300 Novi Pazar</div>
      <div>Radno vreme: 07:30 - 15:00</div>
      <div>www.nplpa.rs</div>
      <div>info@nplpa.rs</div>
    </div>
    
    <!-- NBS QR kod za matricni štampač - mali (samo ako postoji) -->
    ${matrixQRUrl ? `<img src="${matrixQRUrl}" class="qr-code-matrix" alt="NBS IPS QR" />` : ''}
    ${matrixQRUrl ? `<div style="position:absolute; bottom:5mm; right:35mm; font-size:5pt;">Obrazac br. 1</div>` : ''}
    ${matrixQRUrl ? `<div style="position:absolute; bottom:5mm; right: 10mm; font-size:5pt; text-align:center; width:25mm;">NBS IPS QR</div>` : ''}
  </div>
</body>
</html>
     `
  }

  // Helper funkcija za generisanje QR koda za stavku
  const generateQRForItem = async (item) => {
    const itemPoziv = item.poziv_na_broj || poziv
    // Format iznosa: samo broj sa tačkom (toFixed već vraća sa tačkom)
    const itemAmount = parseFloat(item.iznos || 0).toFixed(2)
    const itemSvrha = sanitize(item.opis || stavka)
    const itemPozivSanitized = sanitize(itemPoziv)
    
    // Koristi račun za ovu stavku ako postoji
    const itemRacun = item.taxType ? getAccountNumberForTax(item.taxType) : racun
    const itemParts = itemRacun.split('-')
    const itemBank = itemParts[0]
    const itemAcc = itemParts[1].padStart(13, '0')
    const itemCheck = itemParts[2]
    const itemIpsAccount = `${itemBank}${itemAcc}${itemCheck}`
    
    // NBS IPS format: K:PR|V:01|C:1|R:račun|N:naziv|I:iznos|SF:šifra|S:svrha|RO:model|P:poziv
    const itemIpsString = `K:PR|V:01|C:1|R:${itemIpsAccount}|N:${n_primalac}|I:${itemAmount}|SF:${sifra}|S:${itemSvrha}|RO:${model}|P:${itemPozivSanitized}`
    return await generateNBSQR(itemIpsString, 150)
  }

  // Generate table rows for A4 - sada async
  let rows = ''
  if (validItems.length === 0) {
    // Ako nema validnih stavki, prikaži poruku u tabeli
    rows = `
    <tr>
      <td colspan="2" style="text-align: center; padding: 40px; color: #666; font-style: italic;">
        Nema selektovanih poreskih oblika za prikaz.
      </td>
    </tr>
    `
  } else {
    const rowsPromises = validItems.map(async item => {
      const itemPoziv = item.poziv_na_broj || poziv
      const itemQR = await generateQRForItem(item)
      // Koristi račun za ovu stavku
      const itemRacun = item.taxType ? getAccountNumberForTax(item.taxType) : racun
      return `
      <tr>
        <td>
          <div style="display: flex; align-items: flex-start; gap: 10px;">
            <img src="${itemQR}" alt="QR" style="width: 20mm; height: 20mm; flex-shrink: 0;" />
            <div style="flex: 1;">
              <strong>${item.opis}</strong><br>
              <span style="font-size:9pt; color:#666;">Račun: ${itemRacun} | Poziv na broj: ${itemPoziv} | Model: ${model}</span>
            </div>
          </div>
        </td>
        <td class="amount">${parseFloat(item.iznos || 0).toFixed(2).replace('.', ',')}</td>
      </tr>
      `
    })
    
    rows = (await Promise.all(rowsPromises)).join('')
  }

  return `
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <title>Nalog za uplatu</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 0;
      background: white;
      color: #333;
    }
    .page-container {
      width: 210mm;
      min-height: 297mm;
      position: relative;
      background: white;
      overflow: hidden;
    }
    
    /* UPPER PART - BILL STYLE */
    .bill-header {
      padding: 40px 50px 20px 50px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e0e0e0;
    }
    .org-info img {
      height: 60px;
      margin-bottom: 10px;
    }
    .org-details {
      font-size: 9pt;
      color: #666;
      line-height: 1.4;
    }
    .org-title {
      font-size: 14pt;
      font-weight: bold;
      color: #000;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .bill-meta {
      text-align: right;
      font-size: 10pt;
    }
    .meta-row {
      margin-bottom: 5px;
    }
    .meta-label {
      color: #666;
      margin-right: 10px;
    }
    .meta-value {
      font-weight: bold;
    }
    
    .client-section {
      padding: 30px 50px;
      background: #f9f9f9;
      display: flex;
      justify-content: space-between;
    }
    .client-box {
      width: 45%;
    }
    .box-title {
      font-size: 8pt;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 10px;
      font-weight: bold;
    }
    .client-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .client-details {
      font-size: 10pt;
      color: #444;
      line-height: 1.5;
    }

    .bill-table {
      width: calc(100% - 100px);
      margin: 20px 50px;
      border-collapse: collapse;
    }
    .bill-table th {
      text-align: left;
      padding: 12px 15px;
      background: #000;
      color: white;
      font-size: 9pt;
      text-transform: uppercase;
    }
    .bill-table td {
      padding: 15px;
      border-bottom: 1px solid #eee;
      font-size: 10pt;
    }
    .bill-table td.amount {
      text-align: right;
      font-weight: bold;
    }
    
    .total-section {
      margin: 0 50px;
      background: #f0f0f0;
      padding: 20px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      border-left: 5px solid #000; /* Branding accent */
    }
    .total-label {
      font-size: 11pt;
      margin-right: 20px;
      text-transform: uppercase;
    }
    .total-amount {
      font-size: 18pt;
      font-weight: bold;
    }

    .info-footer {
      margin: 40px 50px;
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }

    /* CUT LINE */
    .cut-line {
      margin: 0 20px;
      border-top: 2px dashed #ccc;
      position: relative;
      height: 20px;
    }
    .cut-icon {
      position: absolute;
      top: -10px;
      left: 20px;
      background: white;
      padding: 0 5px;
      font-size: 12px;
      color: #999;
    }

    /* BOTTOM PART - NALOG - SCALED TO FIT AT BOTTOM */
    .nalog-wrapper {
      padding: 20px 40px; 
      /* We use the layout from previous step but wrapped */
    }
    .nalog-container {
      width: 100%; 
      height: 99mm;
      border: 1px solid #ccc;
      display: flex;
      position: relative;
    }
    .left-part {
      width: 50%;
      padding-right: 5mm;
      border-right: 1px solid #ccc; /* Solid line for nalog */
      padding: 10px;
      box-sizing: border-box;
    }
    .right-part {
      width: 50%;
      padding-left: 5mm;
      position: relative;
      padding: 10px;
      box-sizing: border-box;
    }
    .section-label {
      font-size: 7pt;
      margin-bottom: 2px;
      margin-top: 5px;
      color: #555;
    }
    .input-box {
      border: 1px solid #333;
      padding: 5px;
      font-size: 10pt;
      font-weight: bold;
      min-height: 22px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      text-align: left;
      background: #fff;
    }
    .input-box.multiline {
      height: 45px;
      align-items: flex-start;
      justify-content: flex-start;
      text-align: left;
      font-size: 10pt;
    }
    .header-title-nalog {
      text-align: right;
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 5px;
      border-bottom: 2px solid #000;
      display: inline-block;
      float: right;
      padding-bottom: 2px;
    }
    .flex-row {
      display: flex;
      gap: 5px;
    }
    .col {
      display: flex;
      flex-direction: column;
    }
    .qr-code {
      position: absolute;
      bottom: 30px;
      right: 15px;
      width: 32mm;
      height: 32mm;
      z-index: 1;
    }
    .info-section-zbirno {
      position: absolute;
      bottom: 30px;
      left: 0;
      margin-left: 5mm;
      width: 60mm;
      font-size: 7pt;
      line-height: 1.2;
      color: #333;
      font-family: 'Courier New', Courier, monospace;
    }
    .info-section-single {
      position: absolute;
      bottom: 30px;
      left: 0;
      margin-left: 5mm;
      width: 60mm;
      font-size: 7pt;
      line-height: 1.2;
      color: #333;
      font-family: 'Courier New', Courier, monospace;
    }
    .info-section-zbirno div {
      margin-bottom: 1px;
    }
    .info-section-zbirno strong {
      font-size: 10pt;
      font-weight: bold;
    }
    .signature-line {
      margin-top: 25px;
      border-bottom: 1px solid #000;
      width: 80%;
    }
  </style>
</head>
<body>
  <div class="page-container">
    
    <!-- BILL HEADER -->
    <div class="bill-header">
      <div class="org-info">
        <div style="display:flex; align-items:center; gap:15px;">
           <img src="${logoUrl}" alt="Grb">
           <div>
             <div class="org-title">GRAD NOVI PAZAR</div>
             <div class="org-details">
               Gradska uprava za naplatu javnih prihoda<br>
               7. Juli bb, 36300 Novi Pazar<br>
               PIB: 104318304 | Matični broj: 07204990<br>
               Radno vreme: 07:30 - 15:30 | www.nplpa.rs
             </div>
           </div>
        </div>
      </div>
      <div class="bill-meta">
        <div class="meta-row">
          <span class="meta-label">DATUM IZDAVANJA:</span>
          <span class="meta-value">${datum}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">ROK ZA PLAĆANJE:</span>
          <span class="meta-value" style="color:#d32f2f;">${rok}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">MESTO IZDAVANJA:</span>
          <span class="meta-value">Novi Pazar</span>
        </div>
      </div>
    </div>

    <!-- CLIENT INFO -->
    <div class="client-section">
      <div class="client-box">
        <div class="box-title">PODACI O OBVEZNIKU</div>
        <div class="client-name">${data.ime_i_prezime || 'N/A'}</div>
        <div class="client-details">
          ${data.adresa || ''}<br>
          JMBG/PIB: ${data.jmbg || ''}
        </div>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table class="bill-table">
      <thead>
        <tr>
          <th style="width: 70%">Opis zaduzenja / Svrha uplate</th>
          <th style="width: 30%; text-align: right;">Iznos (RSD)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- TOTAL -->
    <div class="total-section">
      <span class="total-label">UKUPNO ZA UPLATU:</span>
      <span class="total-amount">${totalFmt} RSD</span>
    </div>

    <!-- INFO TEXT -->
    <div class="info-footer">
      Molimo Vas da uplatu izvršite u roku dospelosti kako bi izbegli obračun zatezne kamate.<br>
      Za sve informacije možete se obratiti Gradskoj upravi za naplatu javnih prihoda.<br>
      <strong>Hvala Vam što izmirujete svoje obaveze na vreme.</strong>
    </div>

    <!-- CUT LINE -->
    <div style="height: 50px;"></div>
    <div class="cut-line">
      <span class="cut-icon">✂ Nalog za uplatu</span>
    </div>
    
    <!-- BOTTOM NALOG -->
    <div class="nalog-wrapper">
      <div class="nalog-container">
        <!-- LEFT SIDE -->
        <div class="left-part">
          <div class="section-label">platilac</div>
          <div class="input-box multiline">${platioc}</div>
          
          <div class="section-label">svrha uplate</div>
          <div class="input-box multiline">${stavkaNalog}</div>
          
          <div class="section-label">primalac</div>
          <div class="input-box multiline">${primalac}</div>
          
          <div style="margin-top: 15px;">
            <div class="section-label">pečat i potpis platioca</div>
            <div class="signature-line"></div>
          </div>
          
           <div style="margin-top: 10px; display:flex; justify-content:space-between">
            <div style="width:40%">
                 <div class="section-label" style="text-align:right">mesto i datum prijema</div>
                 <div style="border-bottom:1px solid #000; height:15px; margin-top:10px"></div>
            </div>
            <div style="width:40%">
                 <div class="section-label" style="text-align:left">datum izvršenja</div>
                 <div style="border-bottom:1px solid #000; height:15px; margin-top:10px"></div>
            </div>
          </div>
        </div>

        <!-- RIGHT SIDE -->
        <div class="right-part">
          <div style="text-align: right; height: 28px; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 4px; position: relative; z-index: 2;">
             <span class="header-title-nalog">NALOG ZA UPLATU</span>
          </div>
          
          <div class="flex-row" style="margin-top: 10px;">
            <div class="col" style="width: 20%">
              <div class="section-label">šifra plaćanja</div>
              <div class="input-box" style="text-align:center; justify-content:center;">${sifra}</div>
            </div>
            <div class="col" style="width: 15%">
              <div class="section-label">valuta</div>
              <div class="input-box" style="text-align:center; justify-content:center;">RSD</div>
            </div>
            <div class="col" style="flex: 1">
              <div class="section-label">iznos</div>
              <div class="input-box" style="justify-content:flex-start;">${iznosSlip}</div>
            </div>
          </div>

          <div class="section-label" style="margin-top: 8px;">račun primaoca</div>
          <div class="input-box">${racunNalog}</div>

          <div class="section-label" style="margin-top: 8px;">model i poziv na broj (odobrenje)</div>
          <div class="flex-row">
            <div class="input-box" style="width: 15%; justify-content:center;">${model}</div>
            <div class="input-box" style="flex: 1; margin-left:5px;">${pozivNalog}</div>
          </div>
          
          <!-- INFO SEKCIJA - prikazuje se uvek (i sa QR kodom i bez) -->
          ${!isZbirnaUplatnica ? `
          <div class="info-section-single">
            <div>Grad Novi Pazar</div>
            <div>Uprava za naplatu javnih prihoda</div>
            <div>7. Juli bb, 36300 Novi Pazar</div>
            <div>Radno vreme: 07:30 - 15:00</div>
            <div>www.nplpa.rs</div>
            <div>info@nplpa.rs</div>
          </div>
          ` : ''}
          
          <!-- QR CODE - prikazuje se samo za pojedinačne uplatnice (jedna stavka) -->
          ${qrUrl ? `<img src="${qrUrl}" class="qr-code" alt="NBS IPS QR" />` : ''}
          ${qrUrl ? `<div style="position:absolute; bottom:10px; right:34mm; font-size:6pt;">Obrazac br. 1</div>` : ''}
          ${qrUrl ? `<div style="position:absolute; bottom:10px; right: 10px; font-size:6pt; text-align:center; width:32mm;">NBS IPS QR</div>` : ''}
          
          <!-- INFO SEKCIJA - prikazuje se za zbirne uplatnice (više stavki, nema QR koda) -->
          ${isZbirnaUplatnica ? `
          <div class="info-section-zbirno">
            <div>Grad Novi Pazar</div>
            <div>Uprava za naplatu javnih prihoda</div>
            <div>7. Juli bb, 36300 Novi Pazar</div>
            <div>Radno vreme: 07:30 - 15:00</div>
            <div>www.nplpa.rs</div>
            <div>info@nplpa.rs</div>
          </div>
          ` : ''}

        </div>
      </div>
    </div>
    
  </div>
</body>
</html>
  `
}

export function generatePotvrdaHTML(data) {
  const datum = new Date().toLocaleDateString('sr-RS')
  const logoUrl = logoBase64
  
  return `
<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <title>Potvrda</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 0;
      background: white;
      color: #333;
    }
    .page-container {
      width: 210mm;
      min-height: 297mm;
      position: relative;
      background: white;
      overflow: hidden;
    }
    
    /* UPPER PART - BILL STYLE */
    .bill-header {
      padding: 40px 50px 20px 50px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e0e0e0;
    }
    .org-info img {
      height: 60px;
      margin-bottom: 10px;
    }
    .org-details {
      font-size: 9pt;
      color: #666;
      line-height: 1.4;
    }
    .org-title {
      font-size: 14pt;
      font-weight: bold;
      color: #000;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .bill-meta {
      text-align: right;
      font-size: 10pt;
    }
    .meta-row {
      margin-bottom: 5px;
    }
    .meta-label {
      color: #666;
      margin-right: 10px;
    }
    .meta-value {
      font-weight: bold;
    }
    
    .client-section {
      padding: 30px 50px;
      background: #f9f9f9;
      display: flex;
      justify-content: space-between;
    }
    .client-box {
      width: 45%;
    }
    .box-title {
      font-size: 8pt;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 10px;
      font-weight: bold;
    }
    .client-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .client-details {
      font-size: 10pt;
      color: #444;
      line-height: 1.5;
    }

    .bill-table {
      width: calc(100% - 100px);
      margin: 20px 50px;
      border-collapse: collapse;
    }
    .bill-table th {
      text-align: left;
      padding: 12px 15px;
      background: #000;
      color: white;
      font-size: 9pt;
      text-transform: uppercase;
    }
    .bill-table td {
      padding: 15px;
      border-bottom: 1px solid #eee;
      font-size: 10pt;
    }

    .info-footer {
      margin: 40px 50px;
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #eee;
      padding-top: 20px;
      line-height: 1.6;
    }

    /* CUT LINE */
    .cut-line {
      margin: 0 20px;
      border-top: 2px dashed #ccc;
      position: relative;
      height: 20px;
    }
    .cut-icon {
      position: absolute;
      top: -10px;
      left: 20px;
      background: white;
      padding: 0 5px;
      font-size: 12px;
      color: #999;
    }

    /* BOTTOM PART - POTPIS */
    .signature-wrapper {
      padding: 30px 50px;
      margin-top: 30px;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 60px;
    }
    .signature-box {
      width: 45%;
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      width: 100%;
      height: 40px;
      margin-bottom: 5px;
    }
    .signature-label {
      font-size: 9pt;
      color: #666;
      text-transform: uppercase;
    }
    
    .title-section {
      text-align: center;
      margin: 30px 0;
      padding: 20px 0;
    }
    .title-main {
      font-size: 18pt;
      font-weight: bold;
      letter-spacing: 3px;
      margin-bottom: 10px;
    }
    .intro-text {
      margin: 20px 50px;
      font-size: 10pt;
      line-height: 1.6;
      color: #444;
    }
    .request-text {
      margin: 0 50px 25px 50px;
      padding: 15px 0;
      font-size: 9pt;
      line-height: 1.5;
      color: #666;
      font-style: italic;
      text-align: justify;
      border-top: 1px solid #e0e0e0;
      border-bottom: 1px solid #e0e0e0;
    }
    .request-text strong {
      font-style: normal;
      color: #333;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="page-container">
    
    <!-- BILL HEADER -->
    <div class="bill-header">
      <div class="org-info">
        <div style="display:flex; align-items:center; gap:15px;">
           <img src="${logoUrl}" alt="Grb">
           <div>
             <div class="org-title">GRAD NOVI PAZAR</div>
             <div class="org-details">
               Gradska uprava za naplatu javnih prihoda<br>
               7. Juli bb, 36300 Novi Pazar<br>
               PIB: 104318304 | Matični broj: 07204990<br>
               Radno vreme: 07:30 - 15:30 | www.nplpa.rs
             </div>
           </div>
        </div>
      </div>
      <div class="bill-meta">
        <div class="meta-row">
          <span class="meta-label">BROJ:</span>
          <span class="meta-value">_____________</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">DATUM IZDAVANJA:</span>
          <span class="meta-value">${datum}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">MESTO IZDAVANJA:</span>
          <span class="meta-value">Novi Pazar</span>
        </div>
      </div>
    </div>

    <!-- REQUEST TEXT - Moderno stilizovan - IZNAD NASLOVA -->
    ${data.zahteva_ime_prezime ? `
    <div class="request-text">
      Na zahtev <strong>${data.zahteva_ime_prezime}</strong>, a na osnovu podataka kojim raspolaže GRADSKA UPRAVA ZA NAPLATU JAVNIH PRIHODA, izdaje se sledeća potvrda.
    </div>
    ` : `
    <div class="request-text">
      Na zahtev, a na osnovu podataka kojim raspolaže GRADSKA UPRAVA ZA NAPLATU JAVNIH PRIHODA, izdaje se sledeća potvrda.
    </div>
    `}

    <!-- TITLE -->
    <div class="title-section">
      <div class="title-main">P O T V R D A</div>
    </div>

    <!-- CLIENT INFO -->
    <div class="client-section">
      <div class="client-box">
        <div class="box-title">PODACI O OBVEZNIKU</div>
        <div class="client-name">${data.obveznik || data.ime_i_prezime || ''}</div>
        <div class="client-details">
          ${data.adresa_obveznika || data.adresa || ''}<br>
          JMBG: ${data.jmbg || ''}
        </div>
        <div style="margin-top: 15px; font-size: 10pt; color: #444;">
          poreski obveznik poreza na imovinu.
        </div>
      </div>
    </div>

    <!-- NEPOKRETNOSTI TABLE -->
    <div style="margin: 20px 0;">
      <div style="margin: 0 50px 15px 50px; font-size: 10pt; color: #444;">
        Imenovani je prijavio sledeće nepokretnosti:
      </div>
      <table class="bill-table">
        <thead>
          <tr>
            <th style="width: 8%;">Red. br.</th>
            <th style="width: 25%;">Vrsta objekta</th>
            <th style="width: 20%;">Vrsta prava</th>
            <th style="width: 32%;">Ulica i broj</th>
            <th style="width: 15%; text-align: right;">Površina</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>${data.vrsta_nepokretnosti || ''}</td>
            <td>${data.vrsta_prava || ''}</td>
            <td>${data.adresa_objekta || ''}</td>
            <td style="text-align: right;">${data.oporeziva_povrsina || ''} m²</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- INFO FOOTER -->
    <div class="info-footer">
      Potvrda se izdaje za potrebe <strong>${data.svrha_izbor === 'CUSTOM' ? (data.svrha_custom || '') : (data.svrha_izbor || 'DEČIJEG DODATKA')}</strong>.
    </div>

    <!-- BOTTOM SIGNATURE SECTION -->
    <div class="signature-wrapper">
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">R E F E R E N T</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">POTPIS I PEČAT</div>
        </div>
      </div>
    </div>
    
  </div>
</body>
</html>
  `
}

