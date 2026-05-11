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
  const [saving, setSaving] = useState(false)
  const [resaCreee, setResaCreee] = useState<string | null>(null)

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
    }
    setSaving(false)
  }

  const container = { minHeight: '100dvh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex', flexDirection: 'column' as const }
  const header = { padding: '14px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, background: '#0d0a08' }
  const btnPrimary = { background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, cursor: 'pointer', fontWeight: 700, width: '100%', touchAction: 'manipulation' as const }

  // Succès
  if (resaCreee) return (
    <div style={{ ...container, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🍺</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#6ec96e', marginBottom: 8 }}>Réservation créée !</div>
        <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'monospace', marginBottom: 8 }}>{resaCreee}</div>
        <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.5)', marginBottom: 32 }}>
          {new Date(dateDebut).toLocaleDateString('fr-FR')} → {new Date(dateFin).toLocaleDateString('fr-FR')}
        </div>
        {alertesStock.length > 0 && (
          <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ color: '#c96e6e', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>⚠ Stock insuffisant</div>
            {alertesStock.map((a, i) => (
              <div key={i} style={{ fontSize: 13, color: '#e8e0d5' }}>
                {a.fut?.nom_cuvee} {a.fut?.contenance_litres}L — manque {a.manque} fût(s)
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 8 }}>Pensez à commander à La Loupiote</div>
          </div>
        )}
        <button onClick={onClose} style={{ ...btnPrimary, maxWidth: 300 }}>✓ Retour à la caisse</button>
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
        <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' as const }}>
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

          <button onClick={passerEtapeFuts} disabled={!dateDebut || !dateFin}
            style={{ ...btnPrimary, opacity: (!dateDebut || !dateFin) ? 0.4 : 1, cursor: (!dateDebut || !dateFin) ? 'not-allowed' : 'pointer' }}>
            Suivant → Choisir les fûts
          </button>
        </div>
      )}

      {/* ── ÉTAPE 2 : FÛTS ── */}
      {etape === 'futs' && (
        <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' as const }}>
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

          <button onClick={passerEtapeTireuse} disabled={!lignesFuts.some(l => l.fut_id && l.quantite > 0)}
            style={{ ...btnPrimary, opacity: !lignesFuts.some(l => l.fut_id && l.quantite > 0) ? 0.4 : 1, cursor: !lignesFuts.some(l => l.fut_id && l.quantite > 0) ? 'not-allowed' : 'pointer' }}>
            Suivant → Choisir la tireuse
          </button>
        </div>
      )}

      {/* ── ÉTAPE 3 : TIREUSE ── */}
      {etape === 'tireuse' && (
        <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' as const }}>
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

          <button onClick={passerRecapitulatif}
            style={{ ...btnPrimary }}>
            Suivant → Récapitulatif
          </button>
        </div>
      )}

      {/* ── ÉTAPE 4 : RÉCAPITULATIF ── */}
      {etape === 'recapitulatif' && (
        <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: '#f0e8d8', marginBottom: 20 }}>Récapitulatif</div>

          {/* Client */}
          <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 6, letterSpacing: 1 }}>CLIENT</div>
            <div style={{ fontSize: 15, color: '#f0e8d8' }}>{client ? (client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`) : 'Client anonyme'}</div>
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
          {tireusesChoisies.length > 0 && (
            <div style={{ background: '#18130e', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 10, letterSpacing: 1 }}>TIREUSE(S)</div>
              {tireusesChoisies.map(tid => {
                const t = tireuses.find(x => x.id === tid)
                return <div key={tid} style={{ fontSize: 13, color: '#e8e0d5', marginBottom: 4 }}>{t?.nom} — {t?.modele}</div>
              })}
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginTop: 6, paddingTop: 6, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                Caution {fmt(cautionTireuse)} en chèque — non encaissée
              </div>
            </div>
          )}

          {/* Total */}
          <div style={{ background: 'rgba(201,169,110,0.08)', borderRadius: 10, padding: '16px', marginBottom: 24, border: '0.5px solid rgba(201,169,110,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: 8 }}><span>TOTAL TTC</span><span>{fmt(totalTTC)}</span></div>
            {tireusesChoisies.length > 0 && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>+ Caution {fmt(cautionTireuse)} en chèque (non encaissé)</div>}
          </div>

          <button onClick={creerReservation} disabled={saving}
            style={{ ...btnPrimary, background: saving ? '#2a2a1e' : '#c9a96e', color: saving ? '#555' : '#0d0a08' }}>
            {saving ? '⟳ Création...' : '✓ Confirmer la réservation'}
          </button>
        </div>
      )}
    </div>
  )
}
