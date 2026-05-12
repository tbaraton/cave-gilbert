'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fmt = (n: number) => n.toFixed(2) + ' €'
const inp = { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e0d5', fontSize: 14, padding: '8px 12px', width: '100%', boxSizing: 'border-box' as const }

// ── Types ─────────────────────────────────────────────────────
interface LigneRetour {
  fut_catalogue_id: string
  fut: any
  quantite_reservee: number
  quantite_percutee: number
  quantite_non_percutee: number
  prix_unitaire: number
  remise_pct: number
}

interface RetourLocationProps {
  reservation: any
  onClose: () => void
  onDone: () => void
  modeCompact?: boolean // true = caisse mobile
}

// ── Modal Retour Location ─────────────────────────────────────
export function ModuleRetourLocation({ reservation: resa, onClose, onDone, modeCompact = false }: RetourLocationProps) {
  const [lignes, setLignes] = useState<LigneRetour[]>(() =>
    (resa.reservation_futs || []).map((rf: any) => ({
      fut_catalogue_id: rf.fut_catalogue_id,
      fut: rf.fut,
      quantite_reservee: rf.quantite,
      quantite_percutee: rf.quantite,
      quantite_non_percutee: 0,
      prix_unitaire: rf.prix_unitaire_ttc || rf.fut?.prix_vente_ttc || 0,
      remise_pct: resa.remise_pct || 0,
    }))
  )
  const [modePaiement, setModePaiement] = useState('cb')
  const [saving, setSaving] = useState(false)
  const [etape, setEtape] = useState<'retour' | 'paiement' | 'done'>('retour')
  const [notes, setNotes] = useState('')

  const clientNom = resa.customer
    ? resa.customer.est_societe ? resa.customer.raison_sociale : `${resa.customer.prenom} ${resa.customer.nom}`
    : 'Client anonyme'

  // Calculs — remise et acompte depuis la réservation
  const remisePct = Number(resa.remise_pct || 0)
  const acompte = Number(resa.acompte_ttc || 0)
  const totalPercute = lignes.reduce((acc, l) => {
    const prixApresRemise = l.prix_unitaire * (1 - remisePct / 100)
    return acc + prixApresRemise * l.quantite_percutee
  }, 0)
  const soldeClient = Math.max(0, totalPercute - acompte)
  const remboursement = acompte > totalPercute ? acompte - totalPercute : 0

  const setPercute = (idx: number, val: number) => {
    setLignes(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const percutee = Math.max(0, Math.min(val, l.quantite_reservee))
      return { ...l, quantite_percutee: percutee, quantite_non_percutee: l.quantite_reservee - percutee }
    }))
  }

  const handleValider = async () => {
    setSaving(true)
    try {
      // 1. Créer les retours_futs pour chaque ligne
      for (const l of lignes) {
        await supabase.from('retours_futs').insert({
          reservation_id: resa.id,
          fut_catalogue_id: l.fut_catalogue_id,
          quantite_percutee: l.quantite_percutee,
          quantite_non_percutee: l.quantite_non_percutee,
          date_retour: new Date().toISOString().split('T')[0],
          notes: notes || null,
        })

        // 2. Remettre en stock les fûts non percutés
        if (l.quantite_non_percutee > 0) {
          const { data: futData } = await supabase
            .from('futs_catalogue')
            .select('stock_actuel')
            .eq('id', l.fut_catalogue_id)
            .single()
          if (futData) {
            await supabase.from('futs_catalogue')
              .update({ stock_actuel: futData.stock_actuel + l.quantite_non_percutee })
              .eq('id', l.fut_catalogue_id)
          }
        }

        // 3. Ajouter les fûts percutés dans consignes_loupiote
        if (l.quantite_percutee > 0) {
          const montantConsigne = 30 * l.quantite_percutee
          await supabase.from('consignes_loupiote').insert({
            date_retour_futs: new Date().toISOString().split('T')[0],
            quantite_futs_rendus: l.quantite_percutee,
            montant_consigne_attendu: montantConsigne,
            montant_consigne_recu: 0,
            notes: `Retour location ${resa.numero} — ${l.fut?.nom_cuvee} ${l.fut?.contenance_litres}L`,
            statut: 'en_attente',
          })
        }
      }

      // 4. Passer la réservation en terminée + enregistrer solde
      await supabase.from('reservations_location').update({
        statut: 'terminée',
        solde_paye: soldeClient > 0 ? soldeClient : 0,
        solde_mode: soldeClient > 0 ? modePaiement : null,
        solde_paye_le: new Date().toISOString().split('T')[0],
      }).eq('id', resa.id)

      setEtape('done')
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  const MODES = [
    { id: 'cb', label: '💳 CB' },
    { id: 'especes', label: '💶 Espèces' },
    { id: 'cheque', label: '🏦 Chèque' },
    { id: 'virement', label: '📤 Virement' },
  ]

  const container: any = {
    position: 'fixed', inset: 0, background: '#0d0a08',
    zIndex: 800, display: 'flex', flexDirection: 'column',
    fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5',
  }

  // ── Écran succès ─────────────────────────────────────────────
  // ── Génération facture ───────────────────────────────────────
  const genererFacture = () => {
    const dateFacture = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    const datePrestation = `${new Date(resa.date_debut).toLocaleDateString('fr-FR')} au ${new Date(resa.date_fin).toLocaleDateString('fr-FR')}`
    const SITES: Record<string, string> = { cave_gilbert: 'Cave de Gilbert', petite_cave: 'La Petite Cave', entrepot: 'Entrepôt', livraison: 'Livraison' }
    const numeroFacture = `FAC-${resa.numero.replace('LOC-', '')}`

    const lignesFacturees = lignes.filter(l => l.quantite_percutee > 0)
    const lignesNonPercutees = lignes.filter(l => l.quantite_non_percutee > 0)

    const tvaRate = 0.20
    const lignesHtml = lignesFacturees.map(l => {
      const prixUnitTTC = l.prix_unitaire * (1 - remisePct / 100)
      const prixUnitHT = prixUnitTTC / (1 + tvaRate)
      const totalLigneHT = prixUnitHT * l.quantite_percutee
      const totalLigneTTC = prixUnitTTC * l.quantite_percutee
      return `<tr>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:13px;color:#e8e0d5">
          Location f\u00fbt ${l.fut?.nom_cuvee} ${l.fut?.contenance_litres}L
          ${remisePct > 0 ? `<div style="font-size:11px;color:rgba(201,169,110,0.6)">Prix catalogue : ${l.prix_unitaire.toFixed(2)} \u20ac — Remise ${remisePct}%</div>` : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:center;font-size:13px;color:#e8e0d5">${l.quantite_percutee}</td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:right;font-size:13px;color:rgba(232,224,213,0.7)">${prixUnitHT.toFixed(2)} \u20ac</td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:center;font-size:13px;color:rgba(232,224,213,0.5)">20%</td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:right;font-size:13px;color:#c9a96e;font-weight:600">${totalLigneTTC.toFixed(2)} \u20ac</td>
      </tr>`
    }).join('')

    const tireusesHtml = (resa.reservation_tireuses || []).map((rt: any) => `<tr>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:13px;color:#e8e0d5">Location tireuse ${rt.tireuse?.nom} — ${rt.tireuse?.modele || ''}</td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:center;font-size:13px;color:#e8e0d5">1</td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:right;font-size:13px;color:rgba(232,224,213,0.7)">0,00 \u20ac</td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:center;font-size:13px;color:rgba(232,224,213,0.5)">20%</td>
        <td style="padding:10px 12px;border-bottom:0.5px solid rgba(255,255,255,0.06);text-align:right;font-size:13px;color:#c9a96e">offerte</td>
      </tr>`).join('')

    const totalHT = lignesFacturees.reduce((acc, l) => {
      const prixUnitTTC = l.prix_unitaire * (1 - remisePct / 100)
      return acc + (prixUnitTTC / (1 + tvaRate)) * l.quantite_percutee
    }, 0)
    const totalTVA = totalHT * tvaRate
    const totalTTC = totalHT + totalTVA

    const nonPercutesHtml = lignesNonPercutees.length > 0 ? `
      <div style="background:rgba(110,201,110,0.06);border:0.5px solid rgba(110,201,110,0.2);border-radius:8px;padding:12px 16px;margin-bottom:20px">
        <div style="font-size:11px;letter-spacing:1.5px;color:#6ec96e;text-transform:uppercase;margin-bottom:8px">F\u00fbts non percuté(s) — remis en stock</div>
        ${lignesNonPercutees.map(l => `<div style="font-size:13px;color:rgba(232,224,213,0.6)">↩ ${l.quantite_non_percutee}× ${l.fut?.nom_cuvee} ${l.fut?.contenance_litres}L — non facturé(s)</div>`).join('')}
      </div>` : ''

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Facture ${numeroFacture}</title>
<style>
* { margin:0;padding:0;box-sizing:border-box }
body { font-family:Arial,sans-serif;background:#0d0a08;color:#e8e0d5;max-width:860px;margin:0 auto;padding:48px 40px;-webkit-print-color-adjust:exact;print-color-adjust:exact }
@media print { body { background:#0d0a08 !important;color:#e8e0d5 !important } * { -webkit-print-color-adjust:exact !important;print-color-adjust:exact !important } }
.watermark { position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:80px;color:rgba(255,255,255,0.03);font-family:Georgia,serif;letter-spacing:8px;pointer-events:none;white-space:nowrap }
</style></head><body>
<div class="watermark">CAVE DE GILBERT</div>

<!-- En-tête -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid rgba(201,169,110,0.3)">
  <div>
    <img src="https://cavedegilbert.vercel.app/logo.png" onerror="this.style.display=&quot;none&quot;" style="height:56px;object-fit:contain;display:block;margin-bottom:10px" />
    <div style="font-size:20px;color:#c9a96e;font-family:Georgia,serif;letter-spacing:2px">Cave de Gilbert</div>
    <div style="font-size:11px;color:rgba(232,224,213,0.4);line-height:2;margin-top:6px">
      SAS Cave de Gilbert<br>
      Avenue Jean Colomb — 69280 Marcy-l\u2019\u00c9toile<br>
      SIRET : 898 622 055 00017<br>
      TVA : FR79 898 622 055<br>
      contact@cavedegilbert.fr — 04 22 91 41 09
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(201,169,110,0.6);margin-bottom:6px">Facture</div>
    <div style="font-size:24px;color:#c9a96e;font-family:Georgia,serif">${numeroFacture}</div>
    <div style="font-size:12px;color:rgba(232,224,213,0.4);margin-top:6px">Date : ${dateFacture}</div>
    <div style="font-size:12px;color:rgba(232,224,213,0.4)">Prestation : ${datePrestation}</div>
    <div style="font-size:11px;color:#6ec96e;margin-top:6px">✓ Soldée le ${dateFacture}</div>
  </div>
</div>

<!-- Client -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
  <div style="background:#18130e;border-radius:8px;padding:16px 20px;border:0.5px solid rgba(255,255,255,0.07)">
    <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);margin-bottom:10px">Client</div>
    <div style="font-size:15px;color:#f0e8d8;font-family:Georgia,serif;margin-bottom:4px">${clientNom}</div>
    ${resa.customer?.adresse ? `<div style="font-size:12px;color:rgba(232,224,213,0.5)">${resa.customer.adresse}</div>` : ''}
    ${resa.customer?.code_postal || resa.customer?.ville ? `<div style="font-size:12px;color:rgba(232,224,213,0.5)">${[resa.customer?.code_postal, resa.customer?.ville].filter(Boolean).join(' ')}</div>` : ''}
    ${resa.customer?.email ? `<div style="font-size:12px;color:rgba(232,224,213,0.5);margin-top:4px">${resa.customer.email}</div>` : ''}
    ${resa.customer?.telephone ? `<div style="font-size:12px;color:rgba(232,224,213,0.5)">${resa.customer.telephone}</div>` : ''}
  </div>
  <div style="background:#18130e;border-radius:8px;padding:16px 20px;border:0.5px solid rgba(255,255,255,0.07)">
    <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);margin-bottom:10px">D\u00e9tail location</div>
    <div style="font-size:12px;color:rgba(232,224,213,0.5);line-height:2">
      Réservation : <span style="color:#c9a96e">${resa.numero}</span><br>
      ${resa.site_retrait ? `Retrait : ${SITES[resa.site_retrait] || resa.site_retrait}<br>` : ''}
      ${resa.site_retour ? `Retour : ${SITES[resa.site_retour] || resa.site_retour}<br>` : ''}
      ${(resa.reservation_tireuses || []).length > 0 ? `Tireuse : ${(resa.reservation_tireuses || []).map((rt: any) => rt.tireuse?.nom).join(', ')}<br>` : ''}
      ${resa.caution_tireuse_ttc > 0 ? `Caution : ${resa.caution_tireuse_ttc.toFixed(2)} \u20ac (ch\u00e8que — restitué)` : ''}
    </div>
  </div>
</div>

<!-- Lignes -->
${nonPercutesHtml}
<table style="width:100%;border-collapse:collapse;margin-bottom:0">
  <thead>
    <tr style="border-bottom:1px solid rgba(201,169,110,0.3)">
      <th style="padding:10px 12px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);font-weight:400">Désignation</th>
      <th style="padding:10px 12px;text-align:center;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);font-weight:400">Qté</th>
      <th style="padding:10px 12px;text-align:right;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);font-weight:400">P.U. HT</th>
      <th style="padding:10px 12px;text-align:center;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);font-weight:400">TVA</th>
      <th style="padding:10px 12px;text-align:right;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);font-weight:400">Total TTC</th>
    </tr>
  </thead>
  <tbody>${lignesHtml}${tireusesHtml}</tbody>
</table>

<!-- Totaux -->
<div style="display:flex;justify-content:flex-end;margin-top:0">
  <div style="width:320px">
    <div style="display:flex;justify-content:space-between;padding:8px 12px;font-size:13px;color:rgba(232,224,213,0.5)">
      <span>Total HT</span><span>${totalHT.toFixed(2)} \u20ac</span>
    </div>
    ${remisePct > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 12px;font-size:13px;color:#c9b06e">
      <span>Remise ${remisePct}%</span><span>\u2212 ${(lignesFacturees.reduce((a, l) => a + l.prix_unitaire / (1 + tvaRate) * l.quantite_percutee, 0) * remisePct / 100).toFixed(2)} \u20ac HT</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:8px 12px;font-size:13px;color:rgba(232,224,213,0.5)">
      <span>TVA 20%</span><span>${totalTVA.toFixed(2)} \u20ac</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:12px;font-size:20px;color:#c9a96e;font-family:Georgia,serif;font-weight:700;border-top:1px solid rgba(201,169,110,0.3);margin-top:4px">
      <span>Total TTC</span><span>${totalTTC.toFixed(2)} \u20ac</span>
    </div>
    ${acompte > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 12px;font-size:13px;color:#6ec96e">
      <span>\u2212 Acompte vers\u00e9 (${resa.acompte_mode || ''})</span><span>\u2212 ${acompte.toFixed(2)} \u20ac</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:12px;font-size:18px;color:#6ec96e;font-family:Georgia,serif;font-weight:700;background:rgba(110,201,110,0.06);border-radius:6px;margin-top:4px">
      <span>Solde r\u00e9gl\u00e9</span><span>${soldeClient.toFixed(2)} \u20ac</span>
    </div>` : ''}
  </div>
</div>

<!-- Règlement -->
<div style="margin-top:32px;padding:16px 20px;background:#18130e;border-radius:8px;border:0.5px solid rgba(255,255,255,0.07)">
  <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,110,0.5);margin-bottom:10px">R\u00e8glement</div>
  <div style="font-size:12px;color:rgba(232,224,213,0.5);line-height:2">
    Facture acquittée le ${dateFacture} — Mode : ${MODES.find(m => m.id === modePaiement)?.label || modePaiement}<br>
    En cas de virement : IBAN FR76 1027 8072 5500 0206 6880 148 — BIC CMCIFR2A
  </div>
</div>

<!-- Mentions légales -->
<div style="margin-top:24px;padding-top:16px;border-top:0.5px solid rgba(255,255,255,0.06);font-size:10px;color:rgba(232,224,213,0.25);line-height:2">
  SAS Cave de Gilbert — SIRET 898 622 055 00017 — TVA FR79 898 622 055<br>
  Avenue Jean Colomb, 69280 Marcy-l\u2019\u00c9toile — contact@cavedegilbert.fr<br>
  Tout litige relatif \u00e0 cette facture devra \u00eatre port\u00e9 devant le Tribunal de Commerce de Lyon.<br>
  Conform\u00e9ment \u00e0 la loi, tout retard de paiement entra\u00eenera des p\u00e9nalit\u00e9s de retard au taux l\u00e9gal en vigueur.
</div>
</body></html>`

    return html
  }

  const imprimerFacture = () => {
    const w = window.open('', '_blank')
    if (w) { w.document.write(genererFacture()); w.document.close(); setTimeout(() => w.print(), 500) }
  }

  const envoyerFactureEmail = async () => {
    if (!resa.customer?.email) return
    const html = genererFacture()
    const numeroFacture = `FAC-${resa.numero.replace('LOC-', '')}`
    try {
      await fetch('/api/envoyer-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: resa.customer.email,
          subject: `Facture ${numeroFacture} — Cave de Gilbert`,
          html,
        }),
      })
      alert(`Facture envoyée à ${resa.customer.email}`)
    } catch { alert('Erreur lors de l\'envoi') }
  }

  if (etape === 'done') return (
    <div style={container}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <div style={{ fontSize: 56 }}>✓</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#6ec96e' }}>Retour enregistré</div>
        <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.5)', textAlign: 'center' }}>
          Réservation {resa.numero} clôturée
        </div>
        {soldeClient > 0 && (
          <div style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, padding: '16px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>Solde encaissé</div>
            <div style={{ fontSize: 28, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(soldeClient)}</div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>{MODES.find(m => m.id === modePaiement)?.label}</div>
          </div>
        )}
        {remboursement > 0 && (
          <div style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 10, padding: '16px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>Remboursement client</div>
            <div style={{ fontSize: 28, color: '#6ec96e', fontFamily: 'Georgia, serif' }}>{fmt(remboursement)}</div>
          </div>
        )}
        {lignes.some(l => l.quantite_non_percutee > 0) && (
          <div style={{ fontSize: 12, color: '#6e9ec9', textAlign: 'center' }}>
            ↩ {lignes.reduce((a, l) => a + l.quantite_non_percutee, 0)} fût(s) non percuté(s) remis en stock
          </div>
        )}
        {lignes.some(l => l.quantite_percutee > 0) && (
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', textAlign: 'center' }}>
            🍺 {lignes.reduce((a, l) => a + l.quantite_percutee, 0)} fût(s) percuté(s) → consignes Loupiote
          </div>
        )}

        {/* Actions facture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, marginTop: 8 }}>
          <button onClick={imprimerFacture} style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 8, padding: '13px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            🖨 Imprimer la facture (A4)
          </button>
          {resa.customer?.email && (
            <button onClick={envoyerFactureEmail} style={{ background: '#18130e', border: '0.5px solid rgba(110,158,201,0.3)', color: '#6e9ec9', borderRadius: 8, padding: '13px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              📧 Envoyer par email à {resa.customer?.email}
            </button>
          )}
        </div>

        <button onClick={onDone} style={{ marginTop: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 8, padding: '11px 32px', fontSize: 13, cursor: 'pointer' }}>
          Retour à la caisse
        </button>
      </div>
    </div>
  )

  // ── Étape paiement ───────────────────────────────────────────
  if (etape === 'paiement') return (
    <div style={container}>
      <div style={{ padding: '16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setEtape('retour')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#f0e8d8' }}>Solde à encaisser</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {/* Récap facture */}
        <div style={{ background: '#18130e', borderRadius: 10, padding: '16px', marginBottom: 16, border: '0.5px solid rgba(201,169,110,0.2)' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(201,169,110,0.6)', textTransform: 'uppercase', marginBottom: 12 }}>Facture finale — {clientNom}</div>

          {lignes.map((l, i) => {
            const prixRemise = l.prix_unitaire * (1 - remisePct / 100)
            return (
              <div key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: '#f0e8d8', marginBottom: 4 }}>
                  {l.fut?.nom_cuvee} {l.fut?.contenance_litres}L
                </div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {l.quantite_percutee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>✓ {l.quantite_percutee} percuté{l.quantite_percutee > 1 ? 's' : ''} × {fmt(prixRemise)}{remisePct > 0 ? ` (−${remisePct}%)` : ''}</span>
                      <span style={{ color: '#c9a96e' }}>{fmt(prixRemise * l.quantite_percutee)}</span>
                    </div>
                  )}
                  {l.quantite_non_percutee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6ec96e' }}>
                      <span>↩ {l.quantite_non_percutee} non percuté{l.quantite_non_percutee > 1 ? 's' : ''} — remis en stock</span>
                      <span>0,00 €</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 6 }}>
            <span>Total fûts percutés</span><span>{fmt(totalPercute)}</span>
          </div>
          {acompte > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6ec96e', marginBottom: 6 }}>
              <span>− Acompte versé ({resa.acompte_mode})</span><span>− {fmt(acompte)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: soldeClient > 0 ? '#c9a96e' : '#6ec96e', fontFamily: 'Georgia, serif', fontWeight: 700, paddingTop: 10, borderTop: '0.5px solid rgba(201,169,110,0.2)', marginTop: 4 }}>
            <span>{soldeClient > 0 ? 'Solde à encaisser' : remboursement > 0 ? 'À rembourser' : 'Soldé'}</span>
            <span>{soldeClient > 0 ? fmt(soldeClient) : remboursement > 0 ? fmt(remboursement) : '0,00 €'}</span>
          </div>
        </div>

        {/* Mode paiement */}
        {soldeClient > 0 && (
          <div style={{ background: '#18130e', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(201,169,110,0.6)', textTransform: 'uppercase', marginBottom: 12 }}>Mode de paiement</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MODES.map(m => (
                <button key={m.id} onClick={() => setModePaiement(m.id)} style={{
                  background: modePaiement === m.id ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `0.5px solid ${modePaiement === m.id ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: modePaiement === m.id ? '#c9a96e' : 'rgba(232,224,213,0.5)',
                  borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer',
                }}>{m.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Notes (optionnel)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            style={{ ...inp, resize: 'none' }} placeholder="État du matériel, remarques..." />
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
        <button onClick={handleValider} disabled={saving} style={{
          width: '100%', background: saving ? 'rgba(201,169,110,0.4)' : '#c9a96e',
          color: '#0d0a08', border: 'none', borderRadius: 10, padding: '16px',
          fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer', letterSpacing: 1,
        }}>
          {saving ? '⟳ Enregistrement...' : soldeClient > 0 ? `✓ Encaisser ${fmt(soldeClient)}` : '✓ Clôturer sans solde'}
        </button>
      </div>
    </div>
  )

  // ── Étape retour ─────────────────────────────────────────────
  return (
    <div style={container}>
      <div style={{ padding: '16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#f0e8d8' }}>Retour de location</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{resa.numero} — {clientNom}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Info réservation */}
        <div style={{ background: '#18130e', borderRadius: 10, padding: '12px 16px', marginBottom: 16, border: '0.5px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>
          📅 {new Date(resa.date_debut).toLocaleDateString('fr-FR')} → {new Date(resa.date_fin).toLocaleDateString('fr-FR')}
          {remisePct > 0 && <span style={{ marginLeft: 12, color: '#c9b06e' }}>Remise −{remisePct}%</span>}
          {acompte > 0 && <span style={{ marginLeft: 12, color: '#6ec96e' }}>Acompte {fmt(acompte)}</span>}
        </div>

        {/* Fûts */}
        {lignes.map((l, i) => {
          const prixRemise = l.prix_unitaire * (1 - remisePct / 100)
          return (
            <div key={i} style={{ background: '#18130e', borderRadius: 10, padding: '16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, color: '#f0e8d8' }}>{l.fut?.nom_cuvee} {l.fut?.contenance_litres}L</div>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>
                    {fmt(l.prix_unitaire)}{remisePct > 0 ? ` → ${fmt(prixRemise)} (−${remisePct}%)` : ''} · {l.quantite_reservee} réservé{l.quantite_reservee > 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(prixRemise * l.quantite_percutee)}</div>
              </div>

              {/* Sélecteur percutés / non percutés */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: '#c96e6e', textTransform: 'uppercase', marginBottom: 6 }}>🍺 Percutés (vides)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 12px' }}>
                    <button onClick={() => setPercute(i, l.quantite_percutee - 1)}
                      style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>−</button>
                    <span style={{ flex: 1, textAlign: 'center', fontSize: 20, color: '#c96e6e', fontFamily: 'Georgia, serif' }}>{l.quantite_percutee}</span>
                    <button onClick={() => setPercute(i, l.quantite_percutee + 1)}
                      style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>+</button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: '#6ec96e', textTransform: 'uppercase', marginBottom: 6 }}>↩ Non percutés (pleins)</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(110,201,110,0.06)', borderRadius: 8, padding: '8px 12px', border: '0.5px solid rgba(110,201,110,0.2)' }}>
                    <span style={{ fontSize: 20, color: '#6ec96e', fontFamily: 'Georgia, serif' }}>{l.quantite_non_percutee}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', textAlign: 'center', marginTop: 4 }}>→ remis en stock</div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Récap solde */}
        <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 6 }}>
            <span>Total percutés</span><span>{fmt(totalPercute)}</span>
          </div>
          {acompte > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6ec96e', marginBottom: 6 }}>
              <span>− Acompte versé</span><span>− {fmt(acompte)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: soldeClient > 0 ? '#c9a96e' : '#6ec96e', fontFamily: 'Georgia, serif', fontWeight: 700, paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            <span>{soldeClient > 0 ? 'Solde dû' : remboursement > 0 ? 'À rembourser' : 'Soldé ✓'}</span>
            <span>{soldeClient > 0 ? fmt(soldeClient) : remboursement > 0 ? fmt(remboursement) : ''}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => setEtape('paiement')} style={{
          width: '100%', background: '#c9a96e', color: '#0d0a08',
          border: 'none', borderRadius: 10, padding: '16px',
          fontSize: 15, fontWeight: 600, cursor: 'pointer', letterSpacing: 1,
        }}>
          Suivant → Paiement
        </button>
      </div>
    </div>
  )
}