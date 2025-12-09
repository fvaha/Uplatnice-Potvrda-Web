import { logoBase64 } from './logoData.js'

export function generateUplatnicaHTML(data) {
  // Determine items to list
  const items = data.items || [{ opis: data.stavka || 'UPLATA', iznos: data.iznos || 0 }]

  // Calculate total
  const total = items.reduce((sum, item) => sum + (parseFloat(item.iznos) || 0), 0)
  const totalFmt = total.toFixed(2).replace('.', ',')
  // Bottom slip amount logic
  // If explicitly requested to hide amount (multi-item mode), leave empty
  const iznosSlip = data.hideAmountOnSlip ? '' : `= ${totalFmt}`

  // QR Code Amount: ALWAYS use the total so the code is valid and useful
  const iznosQR = total.toFixed(2).replace('.', ',')

  const stavka = items.length === 1 ? items[0].opis : 'UPLATA PO ZADUŽENJU'
  const platioc = `${data.ime_i_prezime || ''}, ${data.adresa || ''}`.trim()
  const primalac = 'GRAD NOVI PAZAR\nGU ZA NAPLATU JAVNIH PRIHODA\n7. JULI BB, NOVI PAZAR'
  const racun = '840-742251843-73'
  const sifra = '153'
  const model = '97'
  const poziv = data.poziv_na_broj || ''
  const datum = new Date().toLocaleDateString('sr-RS')
  const rok = new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('sr-RS') // 15 days from now

  // IPS QR String
  // 1. Format Account: Must be 18 digits. 840-742251843-73 -> 840000074225184373
  const parts = racun.split('-')
  const bank = parts[0]
  const acc = parts[1].padStart(13, '0') // Pad middle part to 13 digits
  const check = parts[2]
  const ipsAccount = `${bank}${acc}${check}`

  // 2. Format Amount: RSD + comma decimal
  const ipsAmount = `RSD${iznosQR}`

  // 3. Sanitize inputs (remove |, newline)
  const sanitize = (str) => (str || '').replace(/[\n\r|]/g, ' ').trim().substring(0, 70) // Limit length generally

  const n_primalac = "GRAD NOVI PAZAR" // NBS: Name of payee
  const s_svrha = sanitize(stavka)
  const p_poziv = sanitize(poziv)

  const ipsString = `K:PR|V:01|C:1|R:${ipsAccount}|N:${n_primalac}|I:${ipsAmount}|SF:${sifra}|S:${s_svrha}|RO:${model}|P:${p_poziv}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ipsString)}&size=300x300&ecc=M`

  const logoUrl = logoBase64

  // Matrix (Epson PLQ-20) Mode
  if (data.matrix) {
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
    /* Hide QR code for matrix */
    .qr-code { display: none; }
    
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
    
    <div class="field racun-box data-text">${racun}</div>
    <div class="field model-box data-text">${model}</div>
    <div class="field poziv-box data-text">${poziv}</div>
  </div>
</body>
</html>
     `
  }

  // Generate table rows for A4
  const rows = items.map(item => `
    <tr>
      <td>
        <strong>${item.opis}</strong><br>
        <span style="font-size:9pt; color:#666;">Poziv na broj: ${poziv} | Model: ${model}</span>
      </td>
      <td class="amount">${parseFloat(item.iznos || 0).toFixed(2).replace('.', ',')}</td>
    </tr>
  `).join('')

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
      background: #fff;
    }
    .input-box.multiline {
      height: 45px;
      align-items: flex-start;
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
      bottom: 20px; /* Moved up to avoid overlap */
      right: 15px;
      width: 40mm;
      height: 40mm;
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
          <div class="input-box multiline">${stavka}</div>
          
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
          <div style="text-align: right; height: 25px;">
             <span class="header-title-nalog">NALOG ZA UPLATU</span>
          </div>
          
          <div class="flex-row">
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
              <div class="input-box" style="justify-content:flex-end;">${iznosSlip}</div>
            </div>
          </div>

          <div class="section-label">račun primaoca</div>
          <div class="input-box">${racun}</div>

          <div class="section-label">model i poziv na broj (odobrenje)</div>
          <div class="flex-row">
            <div class="input-box" style="width: 15%; justify-content:center;">${model}</div>
            <div class="input-box" style="flex: 1; margin-left:5px;">${poziv}</div>
          </div>
          
          <!-- QR CODE -->
          <img src="${qrUrl}" class="qr-code" alt="NBS IPS QR" />
          <div style="position:absolute; bottom:5px; right:42mm; font-size:6pt;">Obrazac br. 1</div>
          <div style="position:absolute; bottom:5px; right: 10px; font-size:6pt; text-align:center; width:40mm;">NBS IPS QR</div>

        </div>
      </div>
    </div>
    
  </div>
</body>
</html>
  `
}

export function generatePotvrdaHTML(data) {
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
        margin: 1cm;
      }
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      margin: 0;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .org-name {
      font-weight: bold;
      font-size: 12pt;
      text-align: center;
      margin: 5px 0;
    }
    .field {
      margin: 8px 0;
      display: flex;
    }
    .label {
      font-weight: bold;
      min-width: 150px;
    }
    .value {
      flex: 1;
    }
    .section {
      margin: 15px 0;
      border-top: 1px solid #000;
      padding-top: 10px;
    }
    .title {
      text-align: center;
      font-weight: bold;
      font-size: 14pt;
      margin: 20px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    table th, table td {
      border: 1px solid #000;
      padding: 5px;
      text-align: left;
    }
    table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="org-name">REPUBLIKA SRBIJA</div>
    <div class="org-name">GRAD NOVI PAZAR</div>
    <div class="org-name">GRADSKA UPRAVA ZA NAPLATU JAVNIH PRIHODA</div>
    <div style="margin-top: 10px;">
      <span>Broj: _____________</span>
      <span style="margin-left: 30px;">Datum: ${new Date().toLocaleDateString('sr-RS')}</span>
    </div>
  </div>
  
  <div style="margin: 20px 0;">
    <p>Na zahtev</p>
    <p>a na osnovu podataka kojim raspolaže GRADSKA UPRAVA ZA NAPLATU JAVNIH PRIHODA,</p>
    <p>izdaje se sledeća</p>
  </div>
  
  <div class="title">P O T V R D A</div>
  
  <div style="margin: 20px 0;">
    <p>Da je:</p>
    <div class="field">
      <span class="label">Ime i prezime:</span>
      <span class="value">${data.obveznik || data.ime_i_prezime || ''}</span>
    </div>
    <div class="field">
      <span class="label">JMBG:</span>
      <span class="value">${data.jmbg || ''}</span>
    </div>
    <div class="field">
      <span class="label">Adresa:</span>
      <span class="value">${data.adresa_obveznika || data.adresa || ''}</span>
    </div>
    <p>poreski obveznik poreza na imovinu.</p>
  </div>
  
  <div style="margin: 20px 0;">
    <p>Imenovani je prijavio sledeće nepokretnosti:</p>
    <table>
      <thead>
        <tr>
          <th>Red. br.</th>
          <th>Vrsta objekta</th>
          <th>Vrsta prava</th>
          <th>Ulica i broj</th>
          <th>Površina</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>${data.vrsta_nepokretnosti || ''}</td>
          <td>${data.vrsta_prava || ''}</td>
          <td>${data.adresa_objekta || ''}</td>
          <td>${data.oporeziva_povrsina || ''} m²</td>
        </tr>
      </tbody>
    </table>
  </div>
  
  <div style="margin-top: 30px;">
    <p>Potvrda se izdaje za potrebe ${data.svrha || 'DEČIJEG DODATKA'} i ${data.svrha2 || 'PREBIVALIŠTA'}.</p>
  </div>
  
  <div style="margin-top: 50px; text-align: right;">
    <p>R E F E R E N T</p>
  </div>
</body>
</html>
  `
}

