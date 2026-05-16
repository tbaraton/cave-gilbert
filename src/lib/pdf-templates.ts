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
    ? `<tr><td colspan="4" style="padding:12px;color:#e8e0d5;font-size:13px">${detail.notes}</td><td style="padding:12px;text-align:right;color:#c9a96e;font-size:14px;font-weight:700">${totalTTC.toFixed(2)} €</td></tr>`
    : lignesDetail.map((l) => {
        const punit = typeof l.prix_unitaire_ttc === 'number' ? l.prix_unitaire_ttc : parseFloat(l.prix_unitaire_ttc)
        const ltot = typeof l.total_ttc === 'number' ? l.total_ttc : parseFloat(l.total_ttc)
        const prixHT = punit / (1 + tvaRate)
        const remise = (l.remise_pct || 0) > 0 ? ` <span style="font-size:10px;color:rgba(110,201,110,0.8)">(-${l.remise_pct}%)</span>` : ''
        return `<tr style="border-bottom:0.5px solid rgba(255,255,255,0.06)">
          <td style="padding:10px 12px;font-size:13px;color:#e8e0d5">${l.nom_produit}${l.millesime ? ` ${l.millesime}` : ''}${remise}</td>
          <td style="padding:10px 12px;text-align:center;font-size:13px;color:rgba(232,224,213,0.6)">${l.quantite}</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;color:rgba(232,224,213,0.6)">${prixHT.toFixed(2)} €</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;color:rgba(232,224,213,0.4)">${(punit * tvaRate).toFixed(2)} €</td>
          <td style="padding:10px 12px;text-align:right;font-size:14px;color:#c9a96e;font-weight:600">${ltot.toFixed(2)} €</td>
        </tr>`
      }).join('')

  const paiementsHtml = paiementsDetail.map((p) => {
    const m = typeof p.montant === 'number' ? p.montant : parseFloat(p.montant)
    const label = p.mode === 'cb' ? 'Carte bancaire' : p.mode === 'especes' ? 'Espèces' : p.mode === 'virement' ? 'Virement' : p.mode === 'cheque' ? 'Chèque' : p.mode
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:rgba(232,224,213,0.5)">
      <span>${label}</span>
      <span>${m.toFixed(2)} €</span>
    </div>`
  }).join('')

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>${typeLabel[detail.type_doc] || 'DOCUMENT'} ${detail.numero}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; background: #0d0a08; color: #e8e0d5; max-width: 860px; margin: 0 auto; padding: 48px 40px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print { body { background: #0d0a08 !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid rgba(201,169,110,0.3); }
.cave-name { font-size: 20px; color: #c9a96e; font-family: Georgia, serif; letter-spacing: 2px; margin-bottom: 6px; }
.cave-info { font-size: 11px; color: rgba(232,224,213,0.4); line-height: 2; }
.doc-title { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: rgba(201,169,110,0.6); margin-bottom: 6px; text-align: right; }
.doc-numero { font-size: 22px; color: #c9a96e; font-family: Georgia, serif; text-align: right; }
.doc-date { font-size: 12px; color: rgba(232,224,213,0.4); text-align: right; margin-top: 4px; }
.client-box { background: rgba(255,255,255,0.03); border-left: 3px solid rgba(201,169,110,0.4); padding: 12px 18px; margin-bottom: 32px; font-size: 13px; color: rgba(232,224,213,0.7); border-radius: 0 6px 6px 0; }
.client-box strong { color: #c9a96e; font-size: 15px; }
table { width: 100%; border-collapse: collapse; }
thead tr { border-bottom: 1px solid rgba(201,169,110,0.3); }
thead th { padding: 10px 12px; text-align: left; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,169,110,0.5); font-weight: 400; }
.totaux { border-top: 1px solid rgba(201,169,110,0.2); margin-top: 8px; }
.total-line { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 13px; color: rgba(232,224,213,0.5); }
.total-grand { display: flex; justify-content: space-between; padding: 14px; background: rgba(201,169,110,0.08); border: 0.5px solid rgba(201,169,110,0.2); border-radius: 6px; margin-top: 10px; font-size: 22px; font-weight: 700; color: #c9a96e; font-family: Georgia, serif; }
.rib-box { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 18px; margin-top: 24px; }
.rib-title { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,169,110,0.5); margin-bottom: 8px; }
.rib-line { font-size: 12px; color: rgba(232,224,213,0.5); line-height: 2; }
.rib-val { color: #f0e8d8; font-family: monospace; }
.footer { margin-top: 32px; padding-top: 14px; border-top: 0.5px solid rgba(255,255,255,0.06); font-size: 10px; color: rgba(232,224,213,0.25); line-height: 2; }
.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 80px; color: rgba(255,255,255,0.02); font-family: Georgia, serif; letter-spacing: 8px; pointer-events: none; white-space: nowrap; }
</style></head><body>
<div class="watermark">${siteInfo.nom.toUpperCase()}</div>
<div class="header">
  <div>
    <img src="${logoUrl}" style="max-height:44px;max-width:130px;object-fit:contain;display:block;margin-bottom:8px" onerror="this.style.display='none'"/>
    <div class="cave-name">${siteInfo.nom}</div>
    <div class="cave-info">
      ${siteInfo.adresse} — ${siteInfo.ville}<br>
      ${siteInfo.tel} · ${siteInfo.email}<br>
      SIRET : ${siteInfo.siret} — TVA : ${siteInfo.tva}
    </div>
  </div>
  <div>
    <div class="doc-title">${typeLabel[detail.type_doc] || 'Document'}</div>
    <div class="doc-numero">${detail.numero}</div>
    <div class="doc-date">${dateDoc}</div>
    <div class="doc-date" style="margin-top:2px;color:rgba(201,169,110,0.5)">Vendeur : ${detail.user?.prenom || ''}</div>
  </div>
</div>

<div class="client-box">
  <strong>${clientN}</strong>
  ${detail.customer?.email ? `<br>${detail.customer.email}` : ''}
  ${detail.customer?.telephone ? `<br>📞 ${detail.customer.telephone}` : ''}
  ${detail.customer?.adresse ? `<br>${detail.customer.adresse}, ${detail.customer.code_postal} ${detail.customer.ville}` : ''}
</div>

<table>
  <thead>
    <tr>
      <th>Désignation</th>
      <th style="text-align:center">Qté</th>
      <th style="text-align:right">P.U. HT</th>
      <th style="text-align:right">TVA 20%</th>
      <th style="text-align:right">Total TTC</th>
    </tr>
  </thead>
  <tbody>${lignesHtml}</tbody>
</table>

<div class="totaux">
  <div class="total-line"><span>Total HT</span><span>${totalHT.toFixed(2)} €</span></div>
  <div class="total-line"><span>TVA 20 %</span><span>${tva.toFixed(2)} €</span></div>
  <div class="total-grand"><span>TOTAL TTC</span><span>${totalTTC.toFixed(2)} €</span></div>
</div>

${paiementsDetail.length > 0 ? `
<div class="rib-box" style="margin-top:16px">
  <div class="rib-title">Règlement</div>
  ${paiementsHtml}
</div>` : ''}

${detail.type_doc === 'facture' ? `
<div class="rib-box">
  <div class="rib-title">Coordonnées bancaires</div>
  <div class="rib-line">
    Banque : <span class="rib-val">Crédit Mutuel</span><br>
    IBAN : <span class="rib-val">FR76 1027 8072 5500 0206 6880 148</span><br>
    BIC : <span class="rib-val">CMCIFR2A</span>
  </div>
</div>` : ''}

${detail.type_doc === 'devis' ? `
<div style="background:rgba(110,158,201,0.06);border:0.5px solid rgba(110,158,201,0.2);border-radius:8px;padding:16px 20px;margin-top:24px">
  <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(110,158,201,0.6);margin-bottom:8px">Conditions d'acceptation</div>
  <div style="font-size:12px;color:rgba(232,224,213,0.7);line-height:2">
    Ce devis est valable <strong style="color:#e8e0d5">2 semaines</strong> à compter de la date d'émission, soit jusqu'au <strong style="color:#e8e0d5">${dateEcheance}</strong>.<br>
    Pour accepter ce devis, retournez-le signé avec la mention <em style="color:#c9a96e">« Bon pour accord »</em>.<br>
    Les prix sont indiqués en TTC. TVA acquittée sur les débits. Paiement à la commande sauf accord préalable.
  </div>
</div>
<div style="margin-top:24px;border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;overflow:hidden">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr">
    <div style="padding:14px 16px;border-right:0.5px solid rgba(255,255,255,0.08)">
      <div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,224,213,0.3);margin-bottom:36px">Date d'acceptation</div>
      <div style="border-bottom:0.5px solid rgba(255,255,255,0.25)"></div>
    </div>
    <div style="padding:14px 16px;border-right:0.5px solid rgba(255,255,255,0.08)">
      <div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,224,213,0.3);margin-bottom:36px">Bon pour accord</div>
      <div style="border-bottom:0.5px solid rgba(255,255,255,0.25)"></div>
    </div>
    <div style="padding:14px 16px">
      <div style="font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,224,213,0.3);margin-bottom:36px">Signature / Cachet</div>
      <div style="border-bottom:0.5px solid rgba(255,255,255,0.25)"></div>
    </div>
  </div>
</div>` : ''}
<div class="footer">
  ${siteInfo.nom} — SIRET ${siteInfo.siret} — TVA ${siteInfo.tva}<br>
  ${siteInfo.adresse}, ${siteInfo.ville} — ${siteInfo.email}<br>
  Tout litige relatif à ce document devra être porté devant le Tribunal de Commerce de ${siteInfo.tribunal}.<br>
  ${detail.type_doc === 'facture' ? 'Tout retard de paiement entraînera des pénalités de retard au taux légal en vigueur (art. L.441-10 C. com.).' : ''}${detail.type_doc === 'devis' ? 'Devis valable 2 semaines. Les prix indiqués s\'entendent TTC, TVA acquittée sur les débits.' : ''}
</div>
</body></html>`
}
