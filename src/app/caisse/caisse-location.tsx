'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const fmt = (n: number) => n.toFixed(2) + '€'

const TYPE_LABELS: Record<string, string> = {
  blonde: '🍺 Blonde', blanche: '🌾 Blanche', ambree: '🍂 Ambrée',
  IPA: '🌿 IPA', triple: '⚡ Triple', neipa: '🌴 Neipa', blanche_framboise: '🍓 Blanche Framboise'
}

type Client = { id: string; prenom: string; nom: string; raison_sociale: string; est_societe: boolean; email: string; telephone: string }
type Session = { id: string; site_id: string }
type User = { id: string; prenom: string; nom: string }

export function ModuleLocation({ session, user, onClose }: { session: Session; user: User; onClose: () => void }) {
  const [etape, setEtape] = useState<'client' | 'futs' | 'tireuse' | 'recapitulatif'>('client')
  const [futs, setFuts] = useState<any[]>([])
  const [tireuses, setTireuses] = useState<any[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [searchClient, setSearchClient] = useState('')
  const [clientsFound, setClientsFound] = useState<Client[]>([])
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [lignesFuts, setLignesFuts] = useState<{ fut_id: string; quantite: number }[]>([])
  const [tireusesChoisies, setTireusesChoisies] = useState<string[]>([])
  const [cautionPayee, setCautionPayee] = useState(false)
  const [alertesStock, setAlertesStock] = useState<any[]>([])
  const [conflitsTireuses, setConflitsTireuses] = useState<Record<string, string>>({})
  const [remiseType, setRemiseType] = useState<'pct' | 'eur'>('pct')
  const [remiseVal, setRemiseVal] = useState('')
  const [prixCustom, setPrixCustom] = useState<Record<string, number>>({})
  const [siteRetrait, setSiteRetrait] = useState('')
  const [siteRetour, setSiteRetour] = useState('')
  const [saving, setSaving] = useState(false)
  const [resaCreee, setResaCreee] = useState<string | null>(null)
  const [resaId, setResaId] = useState<string | null>(null)
  const [showAcompte, setShowAcompte] = useState(false)
  const [acompteMode, setAcompteMode] = useState('cb')
  const [acompteMontant, setAcompteMontant] = useState('')

  useEffect(() => {
    const load = async () => {
      const [{ data: futsData, error: futsError }, { data: tireusesData }] = await Promise.all([
        supabase.from('futs_catalogue').select('*').order('type_biere').order('contenance_litres', { ascending: false }),
        supabase.from('tireuses').select('*').order('nom'),
      ])
      if (futsError) console.error('Futs error:', futsError)
      console.log('Futs loaded:', futsData?.length, futsData)
      setFuts(futsData || [])
      setTireuses(tireusesData || [])
    }
    load()
  }, [])

  const searchClients = async (q: string) => {
    if (!q.trim()) { setClientsFound([]); return }
    const { data } = await supabase.from('customers')
      .select('id, prenom, nom, raison_sociale, est_societe, email, telephone')
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,raison_sociale.ilike.%${q}%`)
      .limit(6)
    setClientsFound(data || [])
  }

  // Vérifier disponibilité tireuses sur la période
  const tireusesDisponibles = async () => {
    if (!dateDebut || !dateFin) return tireuses
    const { data } = await supabase.from('reservation_tireuses')
      .select('tireuse_id, reservation:reservations_location!inner(statut, date_debut, date_fin)')
      .filter('reservation.statut', 'not.in', '("annulée","terminée")')
      .filter('reservation.date_debut', 'lte', dateFin)
      .filter('reservation.date_fin', 'gte', dateDebut)
    const occupees = new Set((data || []).map((r: any) => r.tireuse_id))
    return tireuses.filter(t => !occupees.has(t.id))
  }

  // Vérifier stock fûts sur la période
  const verifierStock = async () => {
    const alertes: any[] = []
    for (const ligne of lignesFuts.filter(l => l.fut_id && l.quantite > 0)) {
      const fut = futs.find(f => f.id === ligne.fut_id)
      if (!fut) continue
      // Stock dispo = stock réel - fûts déjà réservés sur la période (confirmés ou en cours)
      const { data: resasConflict } = await supabase
        .from('reservation_futs')
        .select('quantite, reservation:reservations_location!inner(statut, date_debut, date_fin)')
        .eq('fut_catalogue_id', ligne.fut_id)
        .in('reservation.statut', ['confirmée', 'en_cours'])
      const qteDejaPrise = (resasConflict || []).reduce((acc: number, rf: any) => {
        const r = rf.reservation
        if (!r) return acc
        const overlap = new Date(r.date_debut) <= new Date(dateFin) && new Date(r.date_fin) >= new Date(dateDebut)
        return overlap ? acc + rf.quantite : acc
      }, 0)
      const dispo = fut.stock_actuel - qteDejaPrise
      if (dispo < ligne.quantite) {
        alertes.push({ fut, manque: ligne.quantite - dispo, demande: ligne.quantite, dispo })
      }
    }
    setAlertesStock(alertes)
    return alertes
  }

  const passerEtapeFuts = () => {
    if (!dateDebut || !dateFin) return
    if (lignesFuts.length === 0) setLignesFuts([{ fut_id: '', quantite: 1 }])
    setEtape('futs')
  }

  const passerEtapeTireuse = async () => {
    const alertes = await verifierStock()
    // Vérifier conflits tireuses
    if (dateDebut && dateFin) {
      const { data: resasConflict } = await supabase
        .from('reservation_tireuses')
        .select(`tireuse_id, reservation:reservations_location!inner(statut, date_debut, date_fin, customer:customers(prenom, nom, raison_sociale, est_societe))`)
        .neq('reservation.statut', 'annulée')
        .neq('reservation.statut', 'terminée')
      
      const conflits: Record<string, string> = {}
      for (const rt of (resasConflict || []) as any[]) {
        const r = rt.reservation
        if (!r) continue
        const debutResa = new Date(r.date_debut)
        const finResa = new Date(r.date_fin)
        const debutDemande = new Date(dateDebut)
        const finDemande = new Date(dateFin)
        if (debutResa <= finDemande && finResa >= debutDemande) {
          const clientNom = r.customer?.est_societe ? r.customer.raison_sociale : `${r.customer?.prenom || ''} ${r.customer?.nom || ''}`.trim()
          conflits[rt.tireuse_id] = `${clientNom} (${new Date(r.date_debut).toLocaleDateString('fr-FR')} → ${new Date(r.date_fin).toLocaleDateString('fr-FR')})`
        }
      }
      setConflitsTireuses(conflits)
    }
    setEtape('tireuse')
  }

  const passerRecapitulatif = () => setEtape('recapitulatif')

  const getPrixLigne = (fut_id: string) => {
    const fut = futs.find(f => f.id === fut_id)
    return prixCustom[fut_id] !== undefined ? prixCustom[fut_id] : (fut?.prix_vente_ttc || 0)
  }
  const totalFuts = lignesFuts.reduce((acc, l) => acc + getPrixLigne(l.fut_id) * l.quantite, 0)
  const remise = remiseVal ? parseFloat(remiseVal) : 0
  const totalApresRemise = remiseType === 'pct' ? totalFuts * (1 - remise / 100) : Math.max(0, totalFuts - remise)
  const totalConsignesFuts = lignesFuts.reduce((acc, l) => {
    const fut = futs.find(f => f.id === l.fut_id)
    return acc + (fut ? fut.montant_consigne * l.quantite : 0)
  }, 0)
  const cautionTireuse = tireusesChoisies.length * 900
  const totalTTC = totalApresRemise  // Caution et consignes gérées séparément

  const creerReservation = async () => {
    setSaving(true)
    const numero = `LOC-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`

    const { data: resa } = await supabase.from('reservations_location').insert({
      numero, customer_id: client?.id || null, site_id: session.site_id, user_id: user.id,
      date_debut: dateDebut, date_fin: dateFin, statut: 'confirmée',
      caution_tireuse_ttc: cautionTireuse, caution_payee: false,
      total_ttc: totalTTC,
      site_retrait: siteRetrait || null,
      site_retour: siteRetour || null,
    }).select('id').single()

    if (resa) {
      // Lignes fûts
      const lignesValides = lignesFuts.filter(l => l.fut_id && l.quantite > 0)
      if (lignesValides.length) {
        await supabase.from('reservation_futs').insert(
          lignesValides.map(l => {
            const fut = futs.find(f => f.id === l.fut_id)
            return { reservation_id: resa.id, fut_catalogue_id: l.fut_id, quantite: l.quantite, prix_unitaire_ttc: fut?.prix_vente_ttc || 0, montant_consigne: 0 }
          })
        )
        // Stock décrémenté uniquement au départ physique des fûts (statut en_cours) via le backoffice
      }
      // Tireuses
      if (tireusesChoisies.length) {
        await supabase.from('reservation_tireuses').insert(
          tireusesChoisies.map(tid => ({ reservation_id: resa.id, tireuse_id: tid }))
        )
      }
      setResaCreee(numero)
      if (resa) setResaId(resa.id)
    }
    setSaving(false)
  }

  const container = { height: '100dvh', maxHeight: '100dvh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }
  const header = { padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, background: '#0d0a08' }
  const btnPrimary = { background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, cursor: 'pointer', fontWeight: 700, width: '100%', touchAction: 'manipulation' as const }

  const MODES_PAIEMENT = [
    { id: 'cb', label: '💳 CB' },
    { id: 'especes', label: '💶 Espèces' },
    { id: 'cheque', label: '📝 Chèque' },
    { id: 'virement', label: '🏦 Virement' },
  ]

  const SITE_LABELS_LOC: Record<string, string> = {
    cave_gilbert: 'Cave de Gilbert', petite_cave: 'La Petite Cave',
    entrepot: 'Entrepôt', livraison: '🚚 À livrer',
  }

  const genererBonReservation = () => {
    const acompte30 = Math.round(totalTTC * 0.30 * 100) / 100
    const lignesFutsStr = lignesFuts.filter(l => l.fut_id && l.quantite > 0).map(l => {
      const fut = futs.find(f => f.id === l.fut_id)
      return `${l.quantite}× ${fut?.nom_cuvee || ''} ${fut?.contenance_litres}L — ${fmt(getPrixLigne(l.fut_id) * l.quantite)}`
    }).join('\n')
    const tireusesStr = tireusesChoisies.map(tid => {
      const t = tireuses.find(x => x.id === tid)
      return `${t?.nom} (${t?.modele})`
    }).join(', ')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Bon de réservation ${resaCreee}</title>
<style>
  body { font-family: 'Arial', sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1a1a1a; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #8b4513; padding-bottom: 20px; }
  .logo-area h1 { font-size: 24px; color: #5c2d0a; margin: 0 0 4px; font-family: Georgia, serif; }
  .logo-area p { margin: 2px 0; font-size: 12px; color: #666; }
  .doc-info { text-align: right; }
  .doc-info h2 { font-size: 20px; color: #5c2d0a; margin: 0 0 8px; }
  .doc-info p { margin: 2px 0; font-size: 13px; }
  .numero { font-size: 16px; font-weight: bold; color: #8b4513; }
  .section { margin-bottom: 24px; }
  .section h3 { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #8b4513; border-bottom: 0.5px solid #ddd; padding-bottom: 6px; margin-bottom: 12px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 1px; }
  .field span { font-size: 14px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f5f0eb; padding: 8px 12px; text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #666; }
  td { padding: 10px 12px; border-bottom: 0.5px solid #eee; }
  .total-row { background: #faf7f3; font-weight: bold; font-size: 16px; }
  .conditions { background: #faf7f3; border: 1px solid #e8ddd0; border-radius: 8px; padding: 16px; font-size: 12px; color: #555; line-height: 1.6; }
  .acompte-box { background: #f0f8f0; border: 1px solid #a8d5a8; border-radius: 8px; padding: 16px; margin-top: 16px; }
  .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }
  .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 11px; color: #888; min-height: 60px; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <div class="logo-area">
    <h1>🍷 Cave de Gilbert</h1>
    <p>Avenue Jean Colomb — 69280 Marcy l'Étoile</p>
    <p>📞 04 22 91 41 09 · ✉ contact@cavedegilbert.fr</p>
    <p>Mar-Sam : 9h30-13h / 15h30-19h</p>
  </div>
  <div class="doc-info">
    <h2>Bon de réservation</h2>
    <p class="numero">${resaCreee}</p>
    <p>Émis le ${new Date().toLocaleDateString('fr-FR')}</p>
  </div>
</div>

<div class="section">
  <h3>Client</h3>
  <div class="field">
    <label>Nom</label>
    <span>${client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : 'Client anonyme'}</span>
  </div>
  ${client?.telephone ? `<div class="field" style="margin-top:8px"><label>Téléphone</label><span>${client.telephone}</span></div>` : ''}
  ${client?.email ? `<div class="field" style="margin-top:8px"><label>Email</label><span>${client.email}</span></div>` : ''}
</div>

<div class="section">
  <h3>Période de location</h3>
  <div class="grid2">
    <div class="field"><label>Retrait</label><span>${new Date(dateDebut).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</span>${siteRetrait ? `<br><small style="color:#5c2d0a">📍 ${SITE_LABELS_LOC[siteRetrait] || siteRetrait}</small>` : ''}</div>
    <div class="field"><label>Retour</label><span>${new Date(dateFin).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</span>${siteRetour ? `<br><small style="color:#5c2d0a">📍 ${SITE_LABELS_LOC[siteRetour] || siteRetour}</small>` : ''}</div>
  </div>
</div>

<div class="section">
  <h3>Tireuse(s)</h3>
  <p style="font-size:14px">${tireusesStr || '—'}</p>
  <p style="font-size:12px;color:#888;margin-top:4px">Caution : <strong>${fmt(cautionTireuse)}</strong> par chèque (non encaissé — restitué au retour)</p>
</div>

<div class="section">
  <h3>Fûts commandés</h3>
  <table>
    <thead><tr><th>Désignation</th><th>Qté</th><th>Prix u. TTC</th><th>Total TTC</th></tr></thead>
    <tbody>
      ${lignesFuts.filter(l => l.fut_id && l.quantite > 0).map(l => {
        const fut = futs.find(f => f.id === l.fut_id)
        const prix = getPrixLigne(l.fut_id)
        return `<tr><td>${fut?.nom_cuvee || ''} ${fut?.contenance_litres}L</td><td>${l.quantite}</td><td>${fmt(prix)}</td><td>${fmt(prix * l.quantite)}</td></tr>`
      }).join('')}
      <tr class="total-row"><td colspan="3">Total TTC</td><td>${fmt(totalTTC)}</td></tr>
    </tbody>
  </table>
  <div class="acompte-box" style="margin-top:16px">
    <p style="margin:0 0 4px;font-size:13px"><strong>Acompte 30% à la commande :</strong> ${fmt(acompte30)}</p>
    <p style="margin:0;font-size:12px;color:#555">Solde de <strong>${fmt(totalTTC - acompte30)}</strong> à régler au retour de la tireuse</p>
  </div>
</div>

<div class="conditions">
  <strong>Conditions de location :</strong><br>
  • La caution de ${fmt(cautionTireuse)} par chèque est obligatoire et sera restituée intégralement au retour du matériel en bon état.<br>
  • Les fûts non percutés (non entamés) sont remboursés au prix de vente TTC.<br>
  • Le solde est exigible au retour de la tireuse et des fûts.<br>
  • La tireuse doit être rendue propre et en bon état de fonctionnement.<br>
  • Cave de Gilbert décline toute responsabilité en cas de mauvaise utilisation du matériel.
</div>

<div class="signature">
  <div class="sig-box">Signature client<br><em>(Bon pour accord)</em></div>
  <div class="sig-box">Cachet Cave de Gilbert</div>
</div>
</body></html>`
    return html
  }

  const imprimerBon = () => {
    const html = genererBonReservation()
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const envoyerEmail = async () => {
    if (!client?.email) { alert("Pas d'email pour ce client"); return }
    alert(`Email envoyé à ${client.email}\n(fonctionnalité email à connecter)`)
  }

  const enregistrerAcompte = async () => {
    if (!resaId || !acompteMontant) return
    const montant = parseFloat(acompteMontant)
    await supabase.from('reservations_location').update({
      acompte_ttc: montant,
      acompte_mode: acompteMode,
      acompte_paye_le: new Date().toISOString().split('T')[0],
    }).eq('id', resaId)
    setShowAcompte(false)
    alert(`Acompte de ${fmt(montant)} enregistré (${acompteMode})`)
  }

  // Succès
  if (resaCreee) return (
    <div style={{ ...container, overflowY: 'auto' as const }}>
      <div style={{ padding: '24px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🍺</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#6ec96e', marginBottom: 4 }}>Réservation confirmée</div>
          <div style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'monospace' }}>{resaCreee}</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginTop: 4 }}>
            {new Date(dateDebut).toLocaleDateString('fr-FR')} → {new Date(dateFin).toLocaleDateString('fr-FR')}
          </div>
        </div>

        {alertesStock.length > 0 && (
          <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ color: '#c96e6e', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>⚠ Stock insuffisant</div>
            {alertesStock.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: '#e8e0d5' }}>{a.fut?.nom_cuvee} {a.fut?.contenance_litres}L — manque {a.manque} fût(s)</div>
            ))}
          </div>
        )}

        {/* Acompte */}
        <div style={{ background: '#18130e', borderRadius: 12, padding: 16, marginBottom: 16, border: '0.5px solid rgba(201,169,110,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, color: '#f0e8d8' }}>Acompte 30%</div>
              <div style={{ fontSize: 20, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(Math.round(totalTTC * 0.30 * 100) / 100)}</div>
            </div>
            <button onClick={() => setShowAcompte(!showAcompte)}
              style={{ background: showAcompte ? 'rgba(201,110,110,0.1)' : 'rgba(201,169,110,0.15)', border: `0.5px solid ${showAcompte ? 'rgba(201,110,110,0.3)' : 'rgba(201,169,110,0.3)'}`, borderRadius: 8, color: showAcompte ? '#c96e6e' : '#c9a96e', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
              {showAcompte ? '✕ Annuler' : '💰 Encaisser acompte'}
            </button>
          </div>
          {showAcompte && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' as const }}>
                {MODES_PAIEMENT.map(m => (
                  <button key={m.id} onClick={() => setAcompteMode(m.id)}
                    style={{ flex: 1, background: acompteMode === m.id ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${acompteMode === m.id ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: acompteMode === m.id ? '#c9a96e' : 'rgba(232,224,213,0.5)', padding: '8px 4px', fontSize: 12, cursor: 'pointer' }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" value={acompteMontant} onChange={e => setAcompteMontant(e.target.value)}
                  placeholder={`${Math.round(totalTTC * 0.30 * 100) / 100}`}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, color: '#f0e8d8', fontSize: 16, padding: '10px' }} />
                <button onClick={enregistrerAcompte}
                  style={{ background: '#c9a96e', border: 'none', borderRadius: 8, color: '#0d0a08', padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>
                  ✓
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions document */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 16 }}>
          <button onClick={imprimerBon}
            style={{ ...btnPrimary, background: '#18130e', color: '#c9a96e', border: '0.5px solid rgba(201,169,110,0.3)' }}>
            🖨 Imprimer le bon de réservation
          </button>
          {client?.email && (
            <button onClick={envoyerEmail}
              style={{ ...btnPrimary, background: '#18130e', color: '#6e9ec9', border: '0.5px solid rgba(110,158,201,0.3)' }}>
              📧 Envoyer par email à {client.email}
            </button>
          )}
        </div>

        <button onClick={onClose} style={{ ...btnPrimary }}>✓ Retour à la caisse</button>
      </div>
    </div>
  )

  return (
    <div style={container}>
      {/* Header */}
      <div style={header}>
        <button onClick={etape === 'client' ? onClose : () => setEtape(etape === 'futs' ? 'client' : etape === 'tireuse' ? 'futs' : 'tireuse')}
          style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>🍺 Location tireuse & fûts</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>
            {etape === 'client' ? 'Étape 1/4 — Client & dates' : etape === 'futs' ? 'Étape 2/4 — Fûts' : etape === 'tireuse' ? 'Étape 3/4 — Tireuse' : 'Étape 4/4 — Récapitulatif'}
          </div>
        </div>
      </div>

      {/* ── ÉTAPE 1 : CLIENT & DATES ── */}
      {etape === 'client' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Client & dates</div>

          {/* Recherche client */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>CLIENT</div>
            {client ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, color: '#f0e8d8' }}>{client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`}</div>
                  {client.telephone && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{client.telephone}</div>}
                </div>
                <button onClick={() => setClient(null)} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' as const }}>
                <input type="text" placeholder="🔍 Nom, prénom, email..." value={searchClient}
                  onChange={e => { setSearchClient(e.target.value); searchClients(e.target.value) }}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 16, padding: '14px', boxSizing: 'border-box' as const }} />
                {clientsFound.length > 0 && (
                  <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, zIndex: 10, marginTop: 4 }}>
                    {clientsFound.map(c => (
                      <button key={c.id} onClick={() => { setClient(c); setClientsFound([]); setSearchClient('') }}
                        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', color: '#e8e0d5', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' as const }}>
                        <div style={{ fontSize: 15 }}>{c.est_societe ? c.raison_sociale : `${c.prenom} ${c.nom}`}</div>
                        {c.telephone && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{c.telephone}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>DATE DE DÉPART</div>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 15, padding: '14px', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>DATE DE RETOUR</div>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} min={dateDebut}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, color: '#f0e8d8', fontSize: 15, padding: '14px', boxSizing: 'border-box' as const }} />
            </div>
          </div>

          {dateDebut && dateFin && (
            <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: 'rgba(232,224,213,0.6)' }}>
              📅 {Math.ceil((new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / 86400000)} jour(s) de location
            </div>
          )}

        </div>
        <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(255,255,255,0.07)", background: "#0d0a08" }}>
          <button onClick={passerEtapeFuts} disabled={!dateDebut || !dateFin}
            style={{ ...btnPrimary, opacity: (!dateDebut || !dateFin) ? 0.4 : 1, cursor: (!dateDebut || !dateFin) ? 'not-allowed' : 'pointer' }}>
            Suivant → Choisir les fûts
          </button>
        </div>
        </div>
      )}

      {/* ── ÉTAPE 2 : FÛTS ── */}
      {etape === 'futs' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Sélection des fûts</div>

          {lignesFuts.map((l, i) => (
            <div key={i} style={{ background: '#18130e', borderRadius: 10, padding: '14px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>Fût {i + 1}</div>
                <button onClick={() => setLignesFuts(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <select value={l.fut_id} onChange={e => setLignesFuts(prev => prev.map((x, j) => j === i ? { ...x, fut_id: e.target.value } : x))}
                style={{ width: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#e8e0d5', fontSize: 14, padding: '12px', cursor: 'pointer', marginBottom: 10 }}>
                <option value="">— Choisir un fût —</option>
                {futs.map(f => (
                  <option key={f.id} value={f.id} disabled={f.stock_actuel <= 0}>
                    {TYPE_LABELS[f.type_biere]} "{f.nom_cuvee}" {f.contenance_litres}L — {fmt(f.prix_vente_ttc)} {f.stock_actuel <= 0 ? '(rupture)' : `(stock: ${f.stock_actuel})`}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>Quantité :</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 12px' }}>
                  <button onClick={() => setLignesFuts(prev => prev.map((x, j) => j === i ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))}
                    style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 22, cursor: 'pointer', width: 28 }}>−</button>
                  <span style={{ fontSize: 18, minWidth: 24, textAlign: 'center' as const }}>{l.quantite}</span>
                  <button onClick={() => setLignesFuts(prev => prev.map((x, j) => j === i ? { ...x, quantite: x.quantite + 1 } : x))}
                    style={{ background: 'transparent', border: 'none', color: '#e8e0d5', fontSize: 22, cursor: 'pointer', width: 28 }}>+</button>
                </div>
                {l.fut_id && (
                  <span style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif', marginLeft: 'auto' }}>
                    {fmt(getPrixLigne(l.fut_id) * l.quantite)}
                  </span>
                )}
              </div>
              {l.fut_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Prix u. TTC :</span>
                  <input type="number" step="0.01" value={getPrixLigne(l.fut_id)}
                    onChange={e => setPrixCustom(p => ({ ...p, [l.fut_id]: parseFloat(e.target.value) || 0 }))}
                    style={{ width: 85, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '5px 8px' }} />
                  <span style={{ fontSize: 11, color: '#c9a96e' }}>€</span>
                  {prixCustom[l.fut_id] !== undefined && (
                    <button onClick={() => setPrixCustom(p => { const n = { ...p }; delete n[l.fut_id]; return n })}
                      style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>reset</button>
                  )}
                </div>
              )}
            </div>
          ))}

          <button onClick={() => setLignesFuts(prev => [...prev, { fut_id: '', quantite: 1 }])}
            style={{ width: '100%', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, color: '#c9a96e', padding: '14px', fontSize: 14, cursor: 'pointer', marginBottom: 20 }}>
            + Ajouter un autre fût
          </button>

          {lignesFuts.some(l => l.fut_id) && (
            <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'rgba(232,224,213,0.5)', marginBottom: 8 }}>
                <span>Sous-total</span><span>{fmt(totalFuts)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: remiseVal ? 8 : 0 }}>
                <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Remise :</span>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                  {(['pct','eur'] as const).map(t => (
                    <button key={t} onClick={() => setRemiseType(t)} style={{ background: remiseType === t ? 'rgba(201,169,110,0.2)' : 'transparent', border: 'none', color: remiseType === t ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>{t === 'pct' ? '%' : '€'}</button>
                  ))}
                </div>
                <input type="number" step="0.01" value={remiseVal} onChange={e => setRemiseVal(e.target.value)} placeholder="0"
                  style={{ width: 70, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '4px 8px' }} />
              </div>
              {remiseVal && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif', paddingTop: 8, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span>Total après remise</span><span>{fmt(totalApresRemise)}</span>
                </div>
              )}
              {!remiseVal && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                  <span>Total</span><span>{fmt(totalFuts)}</span>
                </div>
              )}
            </div>
          )}

        </div>
        <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.07)', background: '#0d0a08' }}>
          <button onClick={passerEtapeTireuse} disabled={!lignesFuts.some(l => l.fut_id && l.quantite > 0)}
            style={{ ...btnPrimary, opacity: !lignesFuts.some(l => l.fut_id && l.quantite > 0) ? 0.4 : 1, cursor: !lignesFuts.some(l => l.fut_id && l.quantite > 0) ? 'not-allowed' : 'pointer' }}>
            Suivant → Choisir la tireuse
          </button>
        </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : TIREUSE ── */}
      {etape === 'tireuse' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 8 }}>Tireuse</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 20 }}>Caution : 900€ par tireuse</div>

          {alertesStock.length > 0 && (
            <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#c96e6e', fontWeight: 600, marginBottom: 6 }}>⚠ Stock insuffisant pour certains fûts</div>
              {alertesStock.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: '#e8e0d5' }}>
                  {a.fut?.nom_cuvee} {a.fut?.contenance_litres}L — demandé: {a.demande}, disponible: {a.dispo}
                </div>
              ))}
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 6 }}>Une commande La Loupiote sera nécessaire</div>
            </div>
          )}

          {tireuses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#c96e6e' }}>⚠ Aucune tireuse disponible</div>
          ) : tireuses.map(t => {
            const conflit = conflitsTireuses[t.id]
            const isSelected = tireusesChoisies.includes(t.id)
            return (
              <button key={t.id}
                onClick={() => { if (!conflit) setTireusesChoisies(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]) }}
                style={{ width: '100%', background: conflit ? 'rgba(201,110,110,0.05)' : isSelected ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${conflit ? 'rgba(201,110,110,0.3)' : isSelected ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '16px', cursor: conflit ? 'not-allowed' : 'pointer', textAlign: 'left' as const, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: conflit ? 0.7 : 1 }}>
                <div>
                  <div style={{ fontSize: 16, color: conflit ? '#c96e6e' : isSelected ? '#c9a96e' : '#e8e0d5', marginBottom: 4 }}>{t.nom}</div>
                  <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{t.modele} · {t.nb_tirages} tirage{t.nb_tirages > 1 ? 's' : ''}</div>
                  {conflit && <div style={{ fontSize: 12, color: '#c96e6e', marginTop: 6 }}>⚠ Déjà réservée — {conflit}</div>}
                </div>
                <div style={{ fontSize: 22 }}>{conflit ? '✕' : isSelected ? '✓' : '○'}</div>
              </button>
            )
          })}

          {tireusesChoisies.length > 0 && (
            <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>
                ℹ️ Caution tireuse : {fmt(cautionTireuse)} — chèque physique conservé, restitué au retour
              </div>
            </div>
          )}

        </div>
        <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(255,255,255,0.07)", background: "#0d0a08" }}>
          <button onClick={passerRecapitulatif} style={{ ...btnPrimary }}>Suivant → Récapitulatif</button>
        </div>
        </div>
      )}

      {/* ── ÉTAPE 4 : RÉCAPITULATIF ── */}
      {etape === 'recapitulatif' && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: '20px 16px 8px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Récapitulatif</div>

          {/* Client */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 6, letterSpacing: 1 }}>CLIENT</div>
            <div style={{ fontSize: 15, color: '#f0e8d8' }}>{client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : 'Client anonyme'}</div>
          </div>

          {/* Site retrait / retour */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 10, letterSpacing: 1 }}>RETRAIT & RETOUR</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>Retrait</div>
                <select value={siteRetrait} onChange={e => setSiteRetrait(e.target.value)}
                  style={{ width: '100%', background: '#1a1408', border: `0.5px solid ${siteRetrait ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, color: siteRetrait ? '#c9a96e' : 'rgba(232,224,213,0.4)', fontSize: 13, padding: '10px 8px' }}>
                  <option value="">— Choisir —</option>
                  <option value="cave_gilbert">Cave de Gilbert</option>
                  <option value="petite_cave">La Petite Cave</option>
                  <option value="entrepot">Entrepôt</option>
                  <option value="livraison">🚚 À livrer</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>Retour</div>
                <select value={siteRetour} onChange={e => setSiteRetour(e.target.value)}
                  style={{ width: '100%', background: '#1a1408', border: `0.5px solid ${siteRetour ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, color: siteRetour ? '#c9a96e' : 'rgba(232,224,213,0.4)', fontSize: 13, padding: '10px 8px' }}>
                  <option value="">— Choisir —</option>
                  <option value="cave_gilbert">Cave de Gilbert</option>
                  <option value="petite_cave">La Petite Cave</option>
                  <option value="entrepot">Entrepôt</option>
                  <option value="livraison">🚚 À livrer</option>
                </select>
              </div>
            </div>
            {(!siteRetrait || !siteRetour) && (
              <div style={{ fontSize: 11, color: '#c9b06e', marginTop: 8 }}>⚠ Veuillez indiquer le site de retrait et de retour</div>
            )}
          </div>

          {/* Dates */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>DÉPART</div><div style={{ fontSize: 14, color: '#f0e8d8' }}>{new Date(dateDebut).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div></div>
            <div><div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>RETOUR</div><div style={{ fontSize: 14, color: '#f0e8d8' }}>{new Date(dateFin).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div></div>
          </div>

          {/* Fûts */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 10, letterSpacing: 1 }}>FÛTS</div>
            {lignesFuts.filter(l => l.fut_id).map((l, i) => {
              const fut = futs.find(f => f.id === l.fut_id)
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e8e0d5', marginBottom: 6 }}>
                  <span>{l.quantite}× {fut?.nom_cuvee} {fut?.contenance_litres}L</span>
                  <span style={{ color: '#c9a96e' }}>{fmt((fut?.prix_vente_ttc || 0) * l.quantite)}</span>
                </div>
              )
            })}

          </div>

          {/* Tireuses */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', letterSpacing: 1 }}>TIREUSE(S)</div>
              <button onClick={() => setEtape('tireuse')} style={{ fontSize: 11, color: '#c9a96e', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>✎ Modifier</button>
            </div>
            {tireuses.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: tireusesChoisies.includes(t.id) ? '#f0e8d8' : 'rgba(232,224,213,0.25)' }}>
                  {t.nom} — {t.modele}
                </div>
                <button onClick={() => setTireusesChoisies(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                  style={{ fontSize: 12, background: tireusesChoisies.includes(t.id) ? 'rgba(201,110,110,0.1)' : 'rgba(110,201,110,0.1)', border: 'none', borderRadius: 4, color: tireusesChoisies.includes(t.id) ? '#c96e6e' : '#6ec96e', padding: '2px 8px', cursor: 'pointer' }}>
                  {tireusesChoisies.includes(t.id) ? '✕ Retirer' : '+ Ajouter'}
                </button>
              </div>
            ))}
            {tireusesChoisies.length === 0 && (
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)', fontStyle: 'italic' }}>Aucune tireuse sélectionnée</div>
            )}
            {tireusesChoisies.length > 0 && (
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginTop: 6, paddingTop: 6, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                Caution {fmt(cautionTireuse)} en chèque — non encaissée
              </div>
            )}
          </div>

          {/* Total */}
          <div style={{ background: 'rgba(201,169,110,0.08)', borderRadius: 10, padding: '16px', marginBottom: 24, border: '0.5px solid rgba(201,169,110,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: 8 }}><span>TOTAL TTC</span><span>{fmt(totalTTC)}</span></div>
            {tireusesChoisies.length > 0 && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>+ Caution {fmt(cautionTireuse)} en chèque (non encaissé)</div>}
          </div>

        </div>
        <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.07)', background: '#0d0a08' }}>
          <button onClick={creerReservation} disabled={saving || !siteRetrait || !siteRetour}
            style={{ ...btnPrimary, background: (saving || !siteRetrait || !siteRetour) ? '#2a2a1e' : '#c9a96e', color: (saving || !siteRetrait || !siteRetour) ? '#555' : '#0d0a08', opacity: (!siteRetrait || !siteRetour) ? 0.5 : 1 }}>
            {saving ? '⟳ Création...' : '✓ Confirmer la réservation'}
          </button>
        </div>
        </div>
      )}
    </div>
  )
}