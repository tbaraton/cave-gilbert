import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return new NextResponse('Paramètre id manquant', { status: 400 })

  // Charger la vente
  const { data: vente, error } = await supabase
    .from('ventes')
    .select('*, customer:customers(*), user:users(prenom, nom)')
    .eq('id', id)
    .single()

  if (error || !vente) return new NextResponse('Vente introuvable', { status: 404 })

  // Charger les lignes et paiements
  const [{ data: lignes }, { data: paiements }] = await Promise.all([
    supabase.from('vente_lignes').select('*').eq('vente_id', id),
    supabase.from('vente_paiements').select('*').eq('vente_id', id),
  ])

  const tvaRate = 0.20
  const totalTTC = parseFloat(vente.total_ttc)
  const totalHT = totalTTC / (1 + tvaRate)
  const tva = totalTTC - totalHT

  const typeLabel: Record<string, string> = {
    facture: 'FACTURE', devis: 'DEVIS',
    commande: 'BON DE COMMANDE', bl: 'BON DE LIVRAISON',
    avoir: 'AVOIR', ticket: 'REÇU',
  }

  const clientN = !vente.customer
    ? 'Client anonyme'
    : vente.customer.est_societe
      ? vente.customer.raison_sociale
      : `${vente.customer.prenom || ''} ${vente.customer.nom || ''}`.trim()

  const dateDoc = new Date(vente.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const lignesHtml = vente.notes
    ? `<tr>
        <td colspan="4" style="padding:12px;color:#1a1a1a;font-size:13px">${vente.notes}</td>
        <td style="padding:12px;text-align:right;color:#8a6a3e;font-size:14px;font-weight:700">${totalTTC.toFixed(2)} &euro;</td>
       </tr>`
    : (lignes || []).map(l => {
        const prixHT = parseFloat(l.prix_unitaire_ttc) / (1 + tvaRate)
        const tvLigne = parseFloat(l.prix_unitaire_ttc) * tvaRate
        const remise = l.remise_pct > 0
          ? ` <span style="font-size:10px;color:rgba(110,201,110,0.8)">(-${l.remise_pct}%)</span>`
          : ''
        return `<tr style="border-bottom:0.5px solid rgba(0,0,0,0.08)">
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a">${l.nom_produit}${l.millesime ? ` ${l.millesime}` : ''}${remise}</td>
          <td style="padding:10px 12px;text-align:center;font-size:13px;color:rgba(0,0,0,0.7)">${l.quantite}</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;color:rgba(0,0,0,0.7)">${prixHT.toFixed(2)} &euro;</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;color:rgba(0,0,0,0.5)">${tvLigne.toFixed(2)} &euro;</td>
          <td style="padding:10px 12px;text-align:right;font-size:14px;color:#8a6a3e;font-weight:600">${parseFloat(l.total_ttc).toFixed(2)} &euro;</td>
        </tr>`
      }).join('')

  const modeLabel: Record<string, string> = {
    cb: 'Carte bancaire', especes: 'Esp&egrave;ces',
    virement: 'Virement', cheque: 'Ch&egrave;que',
    bon_achat: "Bon d'achat", non_regle: 'Non r&eacute;gl&eacute;',
  }

  const paiementsHtml = (paiements || []).map(p =>
    `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:rgba(0,0,0,0.6)">
      <span>${modeLabel[p.mode] || p.mode}</span>
      <span>${parseFloat(p.montant).toFixed(2)} &euro;</span>
    </div>`
  ).join('')

  const ribHtml = vente.type_doc === 'facture' ? `
    <div style="background:rgba(0,0,0,0.04);border:0.5px solid rgba(0,0,0,0.1);border-radius:8px;padding:14px 18px;margin-top:20px">
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(138,106,62,0.85);margin-bottom:8px">Coordonn&eacute;es bancaires</div>
      <div style="font-size:12px;color:rgba(0,0,0,0.6);line-height:2">
        Banque&nbsp;: <span style="color:#0a0a0a;font-family:monospace">Cr&eacute;dit Mutuel</span><br>
        IBAN&nbsp;: <span style="color:#0a0a0a;font-family:monospace">FR76 1027 8072 5500 0206 6880 148</span><br>
        BIC&nbsp;: <span style="color:#0a0a0a;font-family:monospace">CMCIFR2A</span>
      </div>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${typeLabel[vente.type_doc] || 'Document'} ${vente.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #ffffff;
      color: #1a1a1a;
      max-width: 860px;
      margin: 0 auto;
      padding: 48px 40px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { background: #ffffff !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 40px; padding-bottom: 24px;
      border-bottom: 1px solid rgba(201,169,110,0.3);
    }
    .cave-name { font-size: 20px; color: #8a6a3e; font-family: Georgia, serif; letter-spacing: 2px; margin-bottom: 6px; }
    .cave-info { font-size: 11px; color: rgba(0,0,0,0.5); line-height: 2; }
    .doc-title { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: rgba(138,106,62,0.85); margin-bottom: 6px; text-align: right; }
    .doc-numero { font-size: 22px; color: #8a6a3e; font-family: Georgia, serif; text-align: right; }
    .doc-date { font-size: 12px; color: rgba(0,0,0,0.5); text-align: right; margin-top: 4px; }
    .client-box {
      background: rgba(0,0,0,0.04);
      border-left: 3px solid rgba(201,169,110,0.4);
      padding: 12px 18px; margin-bottom: 32px;
      font-size: 13px; color: rgba(0,0,0,0.75);
      border-radius: 0 6px 6px 0;
    }
    .client-box strong { color: #8a6a3e; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { border-bottom: 1px solid rgba(201,169,110,0.3); }
    thead th {
      padding: 10px 12px; text-align: left;
      font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
      color: rgba(138,106,62,0.85); font-weight: 400;
    }
    .totaux { border-top: 1px solid rgba(201,169,110,0.2); margin-top: 8px; }
    .total-line { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 13px; color: rgba(0,0,0,0.6); }
    .total-grand {
      display: flex; justify-content: space-between; padding: 14px;
      background: rgba(201,169,110,0.08); border: 0.5px solid rgba(201,169,110,0.2);
      border-radius: 6px; margin-top: 10px;
      font-size: 22px; font-weight: 700; color: #8a6a3e; font-family: Georgia, serif;
    }
    .footer {
      margin-top: 32px; padding-top: 14px;
      border-top: 0.5px solid rgba(0,0,0,0.08);
      font-size: 10px; color: rgba(0,0,0,0.4); line-height: 2;
    }
    .watermark {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%,-50%) rotate(-35deg);
      font-size: 80px; color: rgba(0,0,0,0.04);
      font-family: Georgia, serif; letter-spacing: 8px;
      pointer-events: none; white-space: nowrap;
    }
  </style>
</head>
<body>

<div class="watermark">CAVE DE GILBERT</div>

<div class="header">
  <div>
    <div class="cave-name">Cave de Gilbert</div>
    <div class="cave-info">
      Avenue Jean Colomb &mdash; 69280 Marcy l&rsquo;&Eacute;toile<br>
      04 22 91 41 09 &middot; contact@cavedegilbert.fr<br>
      Mar&ndash;Sam&nbsp;: 9h30&ndash;13h / 15h30&ndash;19h
    </div>
  </div>
  <div>
    <div class="doc-title">${typeLabel[vente.type_doc] || 'Document'}</div>
    <div class="doc-numero">${vente.numero}</div>
    <div class="doc-date">${dateDoc}</div>
    ${vente.user?.prenom ? `<div class="doc-date" style="color:rgba(138,106,62,0.85);margin-top:2px">Vendeur&nbsp;: ${vente.user.prenom}</div>` : ''}
  </div>
</div>

<div class="client-box">
  <strong>${clientN}</strong>
  ${vente.customer?.email ? `<br>${vente.customer.email}` : ''}
  ${vente.customer?.telephone ? `<br>&#128222; ${vente.customer.telephone}` : ''}
  ${vente.customer?.adresse ? `<br>${vente.customer.adresse}, ${vente.customer.code_postal} ${vente.customer.ville}` : ''}
</div>

<table>
  <thead>
    <tr>
      <th>D&eacute;signation</th>
      <th style="text-align:center">Qt&eacute;</th>
      <th style="text-align:right">P.U. HT</th>
      <th style="text-align:right">TVA 20%</th>
      <th style="text-align:right">Total TTC</th>
    </tr>
  </thead>
  <tbody>${lignesHtml}</tbody>
</table>

<div class="totaux">
  <div class="total-line"><span>Total HT</span><span>${totalHT.toFixed(2)} &euro;</span></div>
  <div class="total-line"><span>TVA 20&nbsp;%</span><span>${tva.toFixed(2)} &euro;</span></div>
  <div class="total-grand"><span>TOTAL TTC</span><span>${totalTTC.toFixed(2)} &euro;</span></div>
</div>

${paiements && paiements.length > 0 ? `
<div style="background:rgba(0,0,0,0.04);border:0.5px solid rgba(0,0,0,0.1);border-radius:8px;padding:14px 18px;margin-top:20px">
  <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(138,106,62,0.85);margin-bottom:8px">R&egrave;glement</div>
  ${paiementsHtml}
</div>` : ''}

${ribHtml}

<div class="footer">
  SAS Cave de Gilbert &mdash; SIRET 898&nbsp;622&nbsp;055&nbsp;00017 &mdash; TVA FR79&nbsp;898&nbsp;622&nbsp;055<br>
  Avenue Jean Colomb, 69280 Marcy-l&rsquo;&Eacute;toile &mdash; contact@cavedegilbert.fr<br>
  Tout litige relatif &agrave; cette facture devra &ecirc;tre port&eacute; devant le Tribunal de Commerce de Lyon.<br>
  ${vente.type_doc === 'facture' ? 'Tout retard de paiement entra&icirc;nera des p&eacute;nalit&eacute;s de retard au taux l&eacute;gal en vigueur.' : ''}
</div>

</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  })
}