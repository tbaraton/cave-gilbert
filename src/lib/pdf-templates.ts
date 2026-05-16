// Génère le HTML A4 d'un document de vente (devis, facture, BL, commande, avoir, reçu)
// pour être converti en PDF côté serveur. Extrait de caisse/page.tsx pour pouvoir
// être appelé depuis n'importe quel composant.

export type SiteInfo = {
  nom: string
  adresse: string
  ville: string
  tel: string
  email: string
  siret: string
  tva: string
  logo: string
  tribunal: string
}

export type DocDetail = {
  numero: string
  type_doc: string
  created_at: string | Date
  total_ttc: string | number
  notes?: string
  customer?: {
    est_societe?: boolean
    raison_sociale?: string
    prenom?: string
    nom?: string
    email?: string
    telephone?: string
    adresse?: string
    code_postal?: string
    ville?: string
  } | null
  user?: { prenom?: string } | null
}

export type DocLigne = {
  quantite: number
  nom_produit: string
  millesime?: number | null
  prix_unitaire_ttc: string | number
  total_ttc: string | number
  remise_pct?: number
}

export type DocPaiement = { mode: string; montant: string | number }

export function genererFactureCaisseHtml(
  detail: DocDetail,
  lignesDetail: DocLigne[],
  paiementsDetail: DocPaiement[],
  siteInfo: SiteInfo,
  opts: { logoUrlBase?: string } = {},
) {
  const logoUrlBase = opts.logoUrlBase ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const logoUrl = logoUrlBase + siteInfo.logo
  const clientN = !detail.customer
    ? 'Client anonyme'
    : detail.customer.est_societe
      ? detail.customer.raison_sociale
      : `${detail.customer.prenom || ''} ${detail.customer.nom || ''}`.trim()
  const dateDoc = new Date(detail.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  const dateEcheance = (() => { const d = new Date(detail.created_at); d.setDate(d.getDate() + 14); return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) })()
  const typeLabel: Record<string, string> = { facture: 'FACTURE', devis: 'DEVIS', commande: 'BON DE COMMANDE', bl: 'BON DE LIVRAISON', avoir: 'AVOIR', ticket: 'REÇU' }
  const tvaRate = 0.20
  const totalTTC = typeof detail.total_ttc === 'number' ? detail.total_ttc : parseFloat(detail.total_ttc)
  const totalHT = totalTTC / (1 + tvaRate)
  const tva = totalTTC - totalHT

  const lignesHtml = detail.notes
    ? `<tr><td colspan="4">${detail.notes}</td><td class="price" style="text-align:right">${totalTTC.toFixed(2)} €</td></tr>`
    : lignesDetail.map((l) => {
        const punit = typeof l.prix_unitaire_ttc === 'number' ? l.prix_unitaire_ttc : parseFloat(l.prix_unitaire_ttc)
        const ltot = typeof l.total_ttc === 'number' ? l.total_ttc : parseFloat(l.total_ttc)
        const prixHT = punit / (1 + tvaRate)
        const remise = (l.remise_pct || 0) > 0 ? ` <span class="remise-mark">−${l.remise_pct}%</span>` : ''
        return `<tr>
          <td>${l.nom_produit}${l.millesime ? ` <span style="color:rgba(0,0,0,0.55);font-size:12px">${l.millesime}</span>` : ''}${remise}</td>
          <td class="num" style="text-align:center">${l.quantite}</td>
          <td class="num" style="text-align:right">${prixHT.toFixed(2)} €</td>
          <td class="num" style="text-align:right">${(punit * tvaRate).toFixed(2)} €</td>
          <td class="price" style="text-align:right">${ltot.toFixed(2)} €</td>
        </tr>`
      }).join('')

  const paiementsHtml = paiementsDetail.map((p) => {
    const m = typeof p.montant === 'number' ? p.montant : parseFloat(p.montant)
    const label = p.mode === 'cb' ? 'Carte bancaire' : p.mode === 'especes' ? 'Espèces' : p.mode === 'virement' ? 'Virement' : p.mode === 'cheque' ? 'Chèque' : p.mode
    return `<div class="reglement-line"><span>${label}</span><span style="font-variant-numeric:tabular-nums">${m.toFixed(2)} €</span></div>`
  }).join('')

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>${typeLabel[detail.type_doc] || 'DOCUMENT'} ${detail.numero}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: #ffffff;
    color: #1a1a1a;
    max-width: 920px;
    margin: 0 auto;
    padding: 56px 56px 56px 88px;
    position: relative;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: 14px;
    background: #1f3a5f;
  }
  body::after {
    content: '';
    position: fixed;
    top: 0; left: 14px;
    width: 3px; height: 96px;
    background: #b8924f;
  }
  @media print {
    body { background: #ffffff !important; }
    body::before { background: #1f3a5f !important; }
    body::after { background: #b8924f !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; }
  .brand-logo { max-height: 52px; max-width: 140px; object-fit: contain; display: block; margin-bottom: 14px; }
  .brand-name { font-family: Georgia, 'Times New Roman', serif; font-size: 28px; color: #1f3a5f; letter-spacing: 1px; line-height: 1; margin-bottom: 6px; }
  .brand-tagline { font-size: 9px; letter-spacing: 4px; text-transform: uppercase; color: #b8924f; margin-bottom: 16px; font-weight: 600; }
  .brand-info { font-size: 10px; color: rgba(0,0,0,0.55); line-height: 1.75; }

  .doc-block { text-align: right; min-width: 220px; }
  .doc-label { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: #b8924f; margin-bottom: 10px; font-weight: 600; }
  .doc-numero { font-family: Georgia, serif; font-size: 28px; color: #1f3a5f; letter-spacing: 0.5px; line-height: 1; margin-bottom: 12px; }
  .doc-meta { font-size: 11px; color: rgba(0,0,0,0.6); line-height: 1.7; }
  .doc-meta strong { color: rgba(0,0,0,0.85); font-weight: 500; }

  .client-block { margin-bottom: 44px; padding-bottom: 22px; border-bottom: 1px solid rgba(31,58,95,0.15); }
  .client-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8924f; margin-bottom: 10px; font-weight: 600; }
  .client-name { font-family: Georgia, serif; font-size: 20px; color: #1f3a5f; margin-bottom: 6px; }
  .client-info { font-size: 11px; color: rgba(0,0,0,0.6); line-height: 1.75; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead th { padding: 14px 10px; text-align: left; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #b8924f; font-weight: 600; border-bottom: 1.5px solid #1f3a5f; }
  tbody td { padding: 14px 10px; font-size: 13px; color: #1a1a1a; border-bottom: 1px solid rgba(0,0,0,0.06); vertical-align: top; }
  tbody td.num { color: rgba(0,0,0,0.7); font-variant-numeric: tabular-nums; }
  tbody td.price { font-family: Georgia, serif; color: #1f3a5f; font-weight: 600; font-variant-numeric: tabular-nums; }
  .remise-mark { display: inline-block; margin-left: 6px; font-size: 10px; color: #2a7a3a; font-weight: 600; }

  .totals { margin-top: 24px; display: flex; justify-content: flex-end; }
  .totals-inner { min-width: 320px; }
  .totals-line { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12px; color: rgba(0,0,0,0.6); }
  .totals-line span:last-child { font-variant-numeric: tabular-nums; color: rgba(0,0,0,0.85); }
  .total-grand { display: flex; justify-content: space-between; align-items: baseline; padding: 18px 18px; margin-top: 10px; background: rgba(31,58,95,0.05); border-left: 4px solid #b8924f; font-family: Georgia, serif; color: #1f3a5f; font-weight: 700; }
  .total-grand .label { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 600; color: rgba(31,58,95,0.7); }
  .total-grand .amount { font-size: 26px; font-variant-numeric: tabular-nums; }

  .reglement-box { margin-top: 36px; padding: 20px 24px; background: #fbfaf6; border-radius: 4px; border-left: 3px solid #b8924f; }
  .reglement-title { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8924f; margin-bottom: 12px; font-weight: 600; }
  .reglement-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: rgba(0,0,0,0.7); }

  .iban-box { margin-top: 24px; padding: 20px 24px; background: #fbfaf6; border-radius: 4px; border: 1px solid rgba(184,146,79,0.25); }
  .iban-title { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b8924f; margin-bottom: 12px; font-weight: 600; }
  .iban-line { font-size: 12px; color: rgba(0,0,0,0.7); line-height: 1.9; }
  .iban-val { color: #1f3a5f; font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; font-weight: 600; letter-spacing: 0.5px; }

  .devis-conditions { margin-top: 28px; padding: 20px 24px; background: rgba(31,58,95,0.04); border-left: 3px solid #1f3a5f; }
  .devis-title { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #1f3a5f; margin-bottom: 12px; font-weight: 600; }
  .devis-text { font-size: 12px; color: rgba(0,0,0,0.75); line-height: 1.9; }
  .devis-text strong { color: #1f3a5f; font-weight: 600; }
  .devis-text em { color: #b8924f; font-style: italic; font-weight: 500; }

  .sig-zone { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; }
  .sig-cell { padding-top: 56px; border-top: 1px solid rgba(0,0,0,0.3); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(0,0,0,0.55); text-align: center; font-weight: 600; }

  .footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid rgba(0,0,0,0.08); font-size: 9px; color: rgba(0,0,0,0.45); line-height: 1.85; text-align: center; }
  .footer-mark { display: block; font-family: Georgia, serif; font-size: 11px; color: #1f3a5f; letter-spacing: 2px; margin-bottom: 8px; text-transform: uppercase; }
</style></head><body>
<div class="header">
  <div>
    <img src="${logoUrl}" class="brand-logo" onerror="this.style.display='none'"/>
    <div class="brand-name">${siteInfo.nom}</div>
    <div class="brand-tagline">${siteInfo.ville.replace(/^\d{5}\s*/, '')}</div>
    <div class="brand-info">
      ${siteInfo.adresse} — ${siteInfo.ville}<br>
      ${siteInfo.tel} · ${siteInfo.email}<br>
      SIRET ${siteInfo.siret} · TVA ${siteInfo.tva}
    </div>
  </div>
  <div class="doc-block">
    <div class="doc-label">${typeLabel[detail.type_doc] || 'Document'}</div>
    <div class="doc-numero">${detail.numero}</div>
    <div class="doc-meta">
      <strong>${dateDoc}</strong><br>
      ${detail.user?.prenom ? `Vendeur : ${detail.user.prenom}` : ''}
    </div>
  </div>
</div>

<div class="client-block">
  <div class="client-label">${detail.customer?.est_societe ? 'Facturé à — Société' : 'Facturé à'}</div>
  <div class="client-name">${clientN}</div>
  ${detail.customer?.adresse || detail.customer?.email || detail.customer?.telephone ? `
  <div class="client-info">
    ${detail.customer?.adresse ? `${detail.customer.adresse}<br>${[detail.customer.code_postal, detail.customer.ville].filter(Boolean).join(' ')}<br>` : ''}
    ${detail.customer?.email ? `${detail.customer.email}` : ''}${detail.customer?.email && detail.customer?.telephone ? ' · ' : ''}${detail.customer?.telephone || ''}
  </div>` : ''}
</div>

<table>
  <thead>
    <tr>
      <th>Désignation</th>
      <th style="text-align:center;width:60px">Qté</th>
      <th style="text-align:right;width:90px">P.U. HT</th>
      <th style="text-align:right;width:80px">TVA</th>
      <th style="text-align:right;width:110px">Total TTC</th>
    </tr>
  </thead>
  <tbody>${lignesHtml}</tbody>
</table>

<div class="totals">
  <div class="totals-inner">
    <div class="totals-line"><span>Total HT</span><span>${totalHT.toFixed(2)} €</span></div>
    <div class="totals-line"><span>TVA 20 %</span><span>${tva.toFixed(2)} €</span></div>
    <div class="total-grand">
      <span class="label">Total TTC</span>
      <span class="amount">${totalTTC.toFixed(2)} €</span>
    </div>
  </div>
</div>

${paiementsDetail.length > 0 ? `
<div class="reglement-box">
  <div class="reglement-title">Règlement</div>
  ${paiementsHtml}
</div>` : ''}

${detail.type_doc === 'facture' ? `
<div class="iban-box">
  <div class="iban-title">Coordonnées bancaires</div>
  <div class="iban-line">
    Banque : <span class="iban-val">Crédit Mutuel</span><br>
    IBAN : <span class="iban-val">FR76 1027 8072 5500 0206 6880 148</span><br>
    BIC : <span class="iban-val">CMCIFR2A</span>
  </div>
</div>` : ''}

${detail.type_doc === 'devis' ? `
<div class="devis-conditions">
  <div class="devis-title">Conditions d'acceptation</div>
  <div class="devis-text">
    Ce devis est valable <strong>2 semaines</strong> à compter de la date d'émission, soit jusqu'au <strong>${dateEcheance}</strong>.<br>
    Pour accepter ce devis, retournez-le signé avec la mention <em>« Bon pour accord »</em>.<br>
    Les prix sont indiqués en TTC. TVA acquittée sur les débits. Paiement à la commande sauf accord préalable.
  </div>
</div>
<div class="sig-zone">
  <div class="sig-cell">Date d'acceptation</div>
  <div class="sig-cell">Bon pour accord</div>
  <div class="sig-cell">Signature / Cachet</div>
</div>` : ''}

<div class="footer">
  <span class="footer-mark">${siteInfo.nom}</span>
  ${siteInfo.adresse} · ${siteInfo.ville} · ${siteInfo.email}<br>
  SIRET ${siteInfo.siret} · TVA ${siteInfo.tva} · Tribunal de Commerce de ${siteInfo.tribunal}<br>
  ${detail.type_doc === 'facture' ? 'Tout retard de paiement entraînera des pénalités de retard au taux légal en vigueur (art. L.441-10 C. com.).' : ''}${detail.type_doc === 'devis' ? 'Devis valable 2 semaines. Prix indiqués en TTC, TVA acquittée sur les débits.' : ''}
</div>
</body></html>`
}
