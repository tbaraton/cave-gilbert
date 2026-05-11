'use client'

import { useState, useEffect, useCallback } from 'react'
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
const TYPE_COLORS: Record<string, string> = {
  blonde: '#f5c842', blanche: '#e8e0d5', ambree: '#c9783a',
  IPA: '#6ec96e', triple: '#c9a96e', neipa: '#f5a442', blanche_framboise: '#e87090'
}

export default function LocationPage() {
  const [onglet, setOnglet] = useState<'catalogue' | 'reservations' | 'calendrier' | 'loupiote' | 'consignes'>('reservations')
  const [futs, setFuts] = useState<any[]>([])
  const [tireuses, setTireuses] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [commandesLoupiote, setCommandesLoupiote] = useState<any[]>([])
  const [consignes, setConsignes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [alertes, setAlertes] = useState<any[]>([])

  // Modals
  const [showEditFut, setShowEditFut] = useState<any>(null)
  const [showDetailResa, setShowDetailResa] = useState<any>(null)
  const [showNouvelleCommande, setShowNouvelleCommande] = useState(false)
  const [showRetourFuts, setShowRetourFuts] = useState<any>(null)
  const [showNouvelleConsigne, setShowNouvelleConsigne] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: futsData },
      { data: tireusesData },
      { data: resasData },
      { data: commandesData },
      { data: consignesData },
    ] = await Promise.all([
      supabase.from('futs_catalogue').select('*').eq('actif', true).order('type_biere').order('contenance_litres', { ascending: false }),
      supabase.from('tireuses').select('*').order('nom'),
      supabase.from('reservations_location').select(`
        *, customer:customers(prenom, nom, raison_sociale, est_societe, email, telephone),
        reservation_futs(*, fut:futs_catalogue(*)),
        reservation_tireuses(*, tireuse:tireuses(*))
      `).order('date_debut', { ascending: false }).limit(100),
      supabase.from('commandes_loupiote').select(`*, lignes:commandes_loupiote_lignes(*, fut:futs_catalogue(*))`).order('created_at', { ascending: false }),
      supabase.from('consignes_loupiote').select('*').order('date_retour_futs', { ascending: false }),
    ])
    setFuts(futsData || [])
    setTireuses(tireusesData || [])
    console.log('Reservations loaded:', resasData?.length)
    resasData?.forEach((r: any) => console.log('Resa:', r.numero, 'statut:', JSON.stringify(r.statut), 'tireuses:', r.reservation_tireuses?.length))
    setReservations(resasData || [])
    setCommandesLoupiote(commandesData || [])
    setConsignes(consignesData || [])

    // Calculer alertes stock
    const alertesTemp: any[] = []
    const resasActives = (resasData || []).filter((r: any) => !['annulée', 'terminée'].includes(r.statut))
    for (const fut of (futsData || [])) {
      const resasParFut = resasActives.filter((r: any) =>
        r.reservation_futs?.some((rf: any) => rf.fut_catalogue_id === fut.id)
      ).sort((a: any, b: any) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime())

      let stockCumul = fut.stock_actuel
      for (const resa of resasParFut) {
        const ligne = resa.reservation_futs.find((rf: any) => rf.fut_catalogue_id === fut.id)
        stockCumul -= ligne?.quantite || 0
        if (stockCumul < 0) {
          alertesTemp.push({
            fut, resa,
            manque: Math.abs(stockCumul),
          })
        }
      }
    }
    setAlertes(alertesTemp)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const clientNom = (r: any) => {
    if (!r.customer) return 'Client anonyme'
    return r.customer.est_societe ? r.customer.raison_sociale : `${r.customer.prenom} ${r.customer.nom}`
  }

  const statutColor: Record<string, string> = {
    devis: '#6e9ec9', confirmée: '#c9a96e', en_cours: '#6ec96e', terminée: '#888', annulée: '#c96e6e'
  }

  const s = { background: '#0d0a08', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ background: '#100d0a', borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="/admin" style={{ color: 'rgba(232,224,213,0.4)', textDecoration: 'none', fontSize: 13 }}>← Admin</a>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e' }}>🍺 Location Tireuses & Fûts</div>
        {alertes.length > 0 && (
          <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#c96e6e' }}>
            ⚠ {alertes.length} alerte{alertes.length > 1 ? 's' : ''} stock
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a' }}>
        {[
          { id: 'reservations', label: '📋 Réservations' },
          { id: 'calendrier', label: '📅 Calendrier' },
          { id: 'catalogue', label: '🛢 Fûts & Stock' },
          { id: 'loupiote', label: '🏭 Commandes Loupiote' },
          { id: 'consignes', label: '💰 Consignes' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id as any)} style={{
            background: onglet === o.id ? 'rgba(201,169,110,0.1)' : 'transparent',
            border: 'none', borderBottom: `2px solid ${onglet === o.id ? '#c9a96e' : 'transparent'}`,
            color: onglet === o.id ? '#c9a96e' : 'rgba(232,224,213,0.4)',
            padding: '14px 20px', fontSize: 14, cursor: 'pointer',
          }}>{o.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
      ) : (
        <div style={{ padding: 24 }}>

          {/* Alertes stock */}
          {alertes.length > 0 && (
            <div style={{ background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: '#c96e6e', fontWeight: 600, marginBottom: 10 }}>⚠ Alertes stock insuffisant</div>
              {alertes.map((a, i) => (
                <div key={i} style={{ fontSize: 13, color: '#e8e0d5', marginBottom: 6, padding: '8px 12px', background: 'rgba(201,110,110,0.06)', borderRadius: 6 }}>
                  <span style={{ color: '#c96e6e', fontWeight: 600 }}>Manque {a.manque} fût(s)</span> — {a.fut.nom_cuvee} {a.fut.contenance_litres}L
                  {' '}pour réservation <span style={{ color: '#c9a96e' }}>{a.resa.numero}</span> ({clientNom(a.resa)}) le {new Date(a.resa.date_debut).toLocaleDateString('fr-FR')}
                </div>
              ))}
            </div>
          )}

          {/* ── RÉSERVATIONS ── */}
          {onglet === 'reservations' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>Réservations</div>
              </div>
              {reservations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,224,213,0.3)' }}>Aucune réservation</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {reservations.map(r => (
                    <button key={r.id} onClick={() => setShowDetailResa(r)} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', display: 'grid', gridTemplateColumns: '180px 1fr 200px 150px', gap: 16, alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.border = '0.5px solid rgba(201,169,110,0.2)')}
                      onMouseLeave={e => (e.currentTarget.style.border = '0.5px solid rgba(255,255,255,0.07)')}>
                      <div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>N° réservation</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#c9a96e' }}>{r.numero}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 4 }}>{clientNom(r)}</div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                          {r.reservation_futs?.reduce((a: number, l: any) => a + l.quantite, 0)} fût(s) ·
                          {' '}{r.reservation_tireuses?.length || 0} tireuse(s)
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>Période</div>
                        <div style={{ fontSize: 13, color: '#e8e0d5' }}>
                          {new Date(r.date_debut).toLocaleDateString('fr-FR')} → {new Date(r.date_fin).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, background: `${statutColor[r.statut]}22`, color: statutColor[r.statut], padding: '3px 10px', borderRadius: 4, textTransform: 'capitalize' }}>{r.statut}</span>
                        <span style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(r.total_ttc || 0)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CALENDRIER TIREUSES ── */}
          {onglet === 'calendrier' && (
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 20 }}>Disponibilité des tireuses</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {tireuses.map(t => {
                  const resasT = reservations.filter(r =>
                    !['annulée', 'annulee', 'terminée', 'terminee'].includes(r.statut) &&
                    r.reservation_tireuses?.some((rt: any) => rt.tireuse_id === t.id)
                  ).sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime())

                  return (
                    <div key={t.id} style={{ background: '#18130e', borderRadius: 12, padding: 20, border: `0.5px solid ${t.statut === 'disponible' ? 'rgba(110,201,110,0.2)' : 'rgba(201,110,110,0.2)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 15, color: '#f0e8d8', marginBottom: 2 }}>{t.nom}</div>
                          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{t.modele} · {t.nb_tirages} tirage{t.nb_tirages > 1 ? 's' : ''}</div>
                        </div>
                        <span style={{ fontSize: 11, background: resasT.length > 0 ? 'rgba(201,110,110,0.1)' : 'rgba(110,201,110,0.1)', color: resasT.length > 0 ? '#c96e6e' : '#6ec96e', padding: '3px 10px', borderRadius: 4 }}>
                          {resasT.length > 0 ? `⚠ ${resasT.length} réservation(s)` : '✓ Disponible'}
                        </span>
                      </div>
                      {resasT.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)', fontStyle: 'italic' }}>Aucune réservation à venir</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {resasT.map((r: any) => (
                            <div key={r.id} style={{ background: 'rgba(201,169,110,0.08)', borderRadius: 6, padding: '8px 12px', border: '0.5px solid rgba(201,169,110,0.15)' }}>
                              <div style={{ fontSize: 12, color: '#c9a96e' }}>{r.numero} — {clientNom(r)}</div>
                              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>
                                {new Date(r.date_debut).toLocaleDateString('fr-FR')} → {new Date(r.date_fin).toLocaleDateString('fr-FR')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
                        {['disponible', 'maintenance', 'hors_service'].map(s => (
                          <button key={s} onClick={async () => { await supabase.from('tireuses').update({ statut: s }).eq('id', t.id); load() }}
                            style={{ flex: 1, background: t.statut === s ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${t.statut === s ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`, color: t.statut === s ? '#c9a96e' : 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '6px 4px', fontSize: 10, cursor: 'pointer' }}>
                            {s === 'disponible' ? '✓' : s === 'maintenance' ? '🔧' : '✕'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── CATALOGUE FÛTS ── */}
          {onglet === 'catalogue' && (
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 20 }}>Catalogue fûts & stocks</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
                    {['Type', 'Cuvée', 'Contenance', 'Prix achat HT', 'Prix vente TTC', 'Consigne', 'Stock actuel', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'rgba(232,224,213,0.35)', letterSpacing: 1.5, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {futs.map(f => (
                    <tr key={f.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 13, color: TYPE_COLORS[f.type_biere] || '#888' }}>● {TYPE_LABELS[f.type_biere] || f.type_biere}</span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#f0e8d8' }}>{f.nom_cuvee}</td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#e8e0d5' }}>{f.contenance_litres}L</td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#e8e0d5' }}>{fmt(f.prix_achat_ht)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(f.prix_vente_ttc)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>{fmt(f.montant_consigne)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: f.stock_actuel <= 0 ? '#c96e6e' : f.stock_actuel <= 2 ? '#c9b06e' : '#6ec96e' }}>
                          {f.stock_actuel}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => setShowEditFut(f)} style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(232,224,213,0.5)', padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>✎ Modifier</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── COMMANDES LOUPIOTE ── */}
          {onglet === 'loupiote' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>Commandes La Loupiote</div>
                <button onClick={() => setShowNouvelleCommande(true)} style={{ background: '#c9a96e', border: 'none', borderRadius: 8, color: '#0d0a08', padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>+ Nouvelle commande</button>
              </div>
              {commandesLoupiote.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,224,213,0.3)' }}>Aucune commande</div>
              ) : commandesLoupiote.map(c => (
                <div key={c.id} style={{ background: '#18130e', borderRadius: 10, padding: '16px 20px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#c9a96e' }}>{c.numero}</div>
                      <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>Commandé le {new Date(c.date_commande).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <select value={c.statut} onChange={async e => { await supabase.from('commandes_loupiote').update({ statut: e.target.value }).eq('id', c.id); load() }}
                        style={{ background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#c9a96e', fontSize: 13, padding: '6px 10px', cursor: 'pointer' }}>
                        {['en_attente', 'commandée', 'livrée', 'annulée'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(c.montant_total_ht + c.montant_consignes)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {c.lignes?.map((l: any) => (
                      <span key={l.id} style={{ fontSize: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '4px 10px', color: 'rgba(232,224,213,0.6)' }}>
                        {l.quantite}× {l.fut?.nom_cuvee} {l.fut?.contenance_litres}L
                      </span>
                    ))}
                  </div>
                  {c.statut === 'livrée' && (
                    <div style={{ marginTop: 10 }}>
                      <button onClick={async () => {
                        for (const l of c.lignes || []) {
                          await supabase.from('futs_catalogue').update({ stock_actuel: supabase.rpc('increment', { x: l.quantite }) }).eq('id', l.fut_catalogue_id)
                        }
                        load()
                      }} style={{ fontSize: 12, background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.2)', borderRadius: 6, color: '#6ec96e', padding: '5px 12px', cursor: 'pointer' }}>
                        ✓ Confirmer entrée en stock
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── CONSIGNES ── */}
          {onglet === 'consignes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>Suivi consignes fûts — La Loupiote</div>
                <button onClick={() => setShowNouvelleConsigne(true)} style={{ background: '#c9a96e', border: 'none', borderRadius: 8, color: '#0d0a08', padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>+ Enregistrer retour</button>
              </div>

              {/* Résumé */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'En attente de remboursement', value: consignes.filter(c => c.statut === 'en_attente').reduce((a: number, c: any) => a + (c.montant_consigne_attendu - c.montant_consigne_recu), 0), color: '#c96e6e' },
                  { label: 'Partiellement reçu', value: consignes.filter(c => c.statut === 'partiel').reduce((a: number, c: any) => a + (c.montant_consigne_attendu - c.montant_consigne_recu), 0), color: '#c9b06e' },
                  { label: 'Total soldé', value: consignes.filter(c => c.statut === 'soldé').reduce((a: number, c: any) => a + c.montant_consigne_recu, 0), color: '#6ec96e' },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: '#18130e', borderRadius: 10, padding: '16px 20px', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>{kpi.label.toUpperCase()}</div>
                    <div style={{ fontSize: 24, fontFamily: 'Georgia, serif', color: kpi.color }}>{fmt(kpi.value)}</div>
                  </div>
                ))}
              </div>

              {consignes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(232,224,213,0.3)' }}>Aucun retour enregistré</div>
              ) : consignes.map(c => (
                <div key={c.id} style={{ background: '#18130e', borderRadius: 10, padding: '16px 20px', marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 4 }}>{c.quantite_futs_rendus} fût(s) rendu(s) le {new Date(c.date_retour_futs).toLocaleDateString('fr-FR')}</div>
                    <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Attendu : {fmt(c.montant_consigne_attendu)} · Reçu : {fmt(c.montant_consigne_recu)}</div>
                    {c.notes && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginTop: 4, fontStyle: 'italic' }}>{c.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, background: c.statut === 'soldé' ? 'rgba(110,201,110,0.1)' : c.statut === 'partiel' ? 'rgba(201,176,110,0.1)' : 'rgba(201,110,110,0.1)', color: c.statut === 'soldé' ? '#6ec96e' : c.statut === 'partiel' ? '#c9b06e' : '#c96e6e', padding: '3px 10px', borderRadius: 4 }}>{c.statut}</span>
                    <select value={c.statut} onChange={async e => { await supabase.from('consignes_loupiote').update({ statut: e.target.value }).eq('id', c.id); load() }}
                      style={{ background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, color: '#c9a96e', fontSize: 12, padding: '5px 8px', cursor: 'pointer' }}>
                      {['en_attente', 'partiel', 'soldé'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal détail réservation */}
      {showDetailResa && <ModalDetailResa resa={showDetailResa} onClose={() => { setShowDetailResa(null); load() }} futs={futs} tireuses={tireuses} />}

      {/* Modal modifier fût */}
      {showEditFut && <ModalEditFut fut={showEditFut} onClose={() => { setShowEditFut(null); load() }} />}

      {/* Modal nouvelle commande Loupiote */}
      {showNouvelleCommande && <ModalNouvelleCommande futs={futs} onClose={() => { setShowNouvelleCommande(false); load() }} />}

      {/* Modal nouvelle consigne */}
      {showNouvelleConsigne && <ModalNouvelleConsigne onClose={() => { setShowNouvelleConsigne(false); load() }} />}
    </div>
  )
}

// ── Modal Détail Réservation ──
function ModalDetailResa({ resa, onClose, futs, tireuses }: { resa: any; onClose: () => void; futs: any[]; tireuses: any[] }) {
  const [r, setR] = useState(resa)
  const [saving, setSaving] = useState(false)
  const [retours, setRetours] = useState<Record<string, number>>({})

  const clientNom = r.customer?.est_societe ? r.customer.raison_sociale : `${r.customer?.prenom || ''} ${r.customer?.nom || ''}`.trim()

  const updateStatut = async (statut: string) => {
    setSaving(true)
    const ancienStatut = r.statut

    // Décrémenter stock quand les fûts partent physiquement
    if (statut === 'en_cours' && ancienStatut !== 'en_cours') {
      for (const ligne of r.reservation_futs || []) {
        const { data: f } = await supabase.from('futs_catalogue').select('stock_actuel').eq('id', ligne.fut_catalogue_id).single()
        if (f) await supabase.from('futs_catalogue').update({ stock_actuel: Math.max(0, f.stock_actuel - ligne.quantite) }).eq('id', ligne.fut_catalogue_id)
      }
    }

    // Remettre en stock si annulation depuis en_cours
    if (statut === 'annulée' && ancienStatut === 'en_cours') {
      for (const ligne of r.reservation_futs || []) {
        const { data: f } = await supabase.from('futs_catalogue').select('stock_actuel').eq('id', ligne.fut_catalogue_id).single()
        if (f) await supabase.from('futs_catalogue').update({ stock_actuel: f.stock_actuel + ligne.quantite }).eq('id', ligne.fut_catalogue_id)
      }
    }

    await supabase.from('reservations_location').update({ statut }).eq('id', r.id)
    setR({ ...r, statut })
    setSaving(false)
    onClose()
  }

  const enregistrerRetour = async () => {
    const { data: retour } = await supabase.from('retours_futs').insert({ reservation_id: r.id, date_retour: new Date().toISOString().split('T')[0] }).select('id').single()
    if (!retour) return
    for (const [fut_id, qte] of Object.entries(retours)) {
      const ligne = r.reservation_futs.find((l: any) => l.fut_catalogue_id === fut_id)
      const qtePercutee = (ligne?.quantite || 0) - (qte as number)
      await supabase.from('retours_futs_lignes').insert({
        retour_id: retour.id, fut_catalogue_id: fut_id,
        quantite_retournee: qte as number, quantite_percutee: qtePercutee,
        montant_rembourse_ttc: 0  // Pas de remboursement consigne client
      })
      // Remettre en stock uniquement les fûts non percutés retournés
      if ((qte as number) > 0) {
        const { data: f } = await supabase.from('futs_catalogue').select('stock_actuel').eq('id', fut_id).single()
        if (f) await supabase.from('futs_catalogue').update({ stock_actuel: f.stock_actuel + (qte as number) }).eq('id', fut_id)
      }
    }
    // Statut → terminée (sans re-décrémenter le stock)
    await supabase.from('reservations_location').update({ statut: 'terminée' }).eq('id', r.id)
    setR({ ...r, statut: 'terminée' })
    onClose()
  }

  const statutColor: Record<string, string> = { devis: '#6e9ec9', confirmée: '#c9a96e', en_cours: '#6ec96e', terminée: '#888', annulée: '#c96e6e' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 640, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e', marginBottom: 4 }}>{r.numero}</div>
            <div style={{ fontSize: 15, color: '#f0e8d8' }}>{clientNom || 'Client anonyme'}</div>
            {r.customer?.telephone && <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>{r.customer.telephone}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Statut */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 8, letterSpacing: 1 }}>STATUT</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['devis', 'confirmée', 'en_cours', 'terminée', 'annulée'].map(s => (
              <button key={s} onClick={() => updateStatut(s)} disabled={saving}
                style={{ flex: 1, background: r.statut === s ? `${statutColor[s]}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${r.statut === s ? statutColor[s] : 'rgba(255,255,255,0.1)'}`, color: r.statut === s ? statutColor[s] : 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '8px 4px', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>DÉPART</div>
            <div style={{ fontSize: 16, color: '#f0e8d8' }}>{new Date(r.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 4 }}>RETOUR</div>
            <div style={{ fontSize: 16, color: '#f0e8d8' }}>{new Date(r.date_fin).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
          </div>
        </div>

        {/* Fûts */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 10, letterSpacing: 1 }}>FÛTS RÉSERVÉS</div>
          {r.reservation_futs?.map((l: any) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: 14, color: '#f0e8d8' }}>{l.fut?.nom_cuvee} {l.fut?.contenance_litres}L</div>
                <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{l.quantite} fût(s) × {fmt(l.prix_unitaire_ttc)} + {fmt(l.montant_consigne)} consigne</div>
              </div>
              <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(l.quantite * l.prix_unitaire_ttc)}</div>
            </div>
          ))}
        </div>

        {/* Tireuses */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 10, letterSpacing: 1 }}>TIREUSE(S)</div>
          {r.reservation_tireuses?.map((rt: any) => (
            <div key={rt.id} style={{ fontSize: 14, color: '#f0e8d8', padding: '6px 0' }}>
              {rt.tireuse?.nom} — {rt.tireuse?.modele}
            </div>
          ))}
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginTop: 6 }}>
            Caution : {fmt(r.caution_tireuse_ttc)} — {r.caution_payee ? '✓ Payée' : '⚠ Non payée'}
          </div>
        </div>

        {/* Total */}
        <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: '16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(232,224,213,0.6)' }}>Total TTC</span>
          <span style={{ fontSize: 22, fontFamily: 'Georgia, serif', color: '#c9a96e' }}>{fmt(r.total_ttc || 0)}</span>
        </div>

        {/* Retour fûts */}
        {['en_cours', 'confirmée'].includes(r.statut) && (
          <div>
            <div style={{ fontSize: 13, color: '#c9a96e', marginBottom: 12 }}>📦 Enregistrer le retour des fûts</div>
            {r.reservation_futs?.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 13, color: '#e8e0d5' }}>{l.fut?.nom_cuvee} {l.fut?.contenance_litres}L (x{l.quantite})</span>
                <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Non percutés :</span>
                <input type="number" min={0} max={l.quantite} value={retours[l.fut_catalogue_id] ?? 0}
                  onChange={e => setRetours(prev => ({ ...prev, [l.fut_catalogue_id]: parseInt(e.target.value) || 0 }))}
                  style={{ width: 60, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 14, padding: '6px 10px', textAlign: 'center' }} />
              </div>
            ))}
            <button onClick={enregistrerRetour} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700, marginTop: 10 }}>
              ✓ Valider le retour & clôturer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal Modifier Fût ──
function ModalEditFut({ fut, onClose }: { fut: any; onClose: () => void }) {
  const [form, setForm] = useState({ prix_achat_ht: fut.prix_achat_ht, prix_vente_ttc: fut.prix_vente_ttc, montant_consigne: fut.montant_consigne, stock_actuel: fut.stock_actuel, stock_minimum: fut.stock_minimum })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('futs_catalogue').update(form).eq('id', fut.id)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 440, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>{fut.nom_cuvee} {fut.contenance_litres}L</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {[
          { label: 'Prix achat HT (€)', key: 'prix_achat_ht' },
          { label: 'Prix vente TTC (€)', key: 'prix_vente_ttc' },
          { label: 'Consigne (€)', key: 'montant_consigne' },
          { label: 'Stock actuel', key: 'stock_actuel' },
          { label: 'Stock minimum alerte', key: 'stock_minimum' },
        ].map(({ label, key }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6, letterSpacing: 1 }}>{label.toUpperCase()}</div>
            <input type="number" step="0.01" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#f0e8d8', fontSize: 16, padding: '12px', boxSizing: 'border-box' }} />
          </div>
        ))}
        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700, marginTop: 8 }}>
          {saving ? '⟳' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Nouvelle Commande Loupiote ──
function ModalNouvelleCommande({ futs, onClose }: { futs: any[]; onClose: () => void }) {
  const [lignes, setLignes] = useState<{ fut_id: string; quantite: number }[]>([{ fut_id: '', quantite: 1 }])
  const [dateLivraison, setDateLivraison] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const total_ht = lignes.reduce((acc, l) => {
    const fut = futs.find(f => f.id === l.fut_id)
    return acc + (fut ? fut.prix_achat_ht * l.quantite : 0)
  }, 0)
  const total_consignes = lignes.reduce((acc, l) => {
    const fut = futs.find(f => f.id === l.fut_id)
    return acc + (fut ? fut.montant_consigne * l.quantite : 0)
  }, 0)

  const save = async () => {
    if (!lignes.some(l => l.fut_id)) return
    setSaving(true)
    const numero = `CMD-LPT-${Date.now()}`
    const { data: cmd } = await supabase.from('commandes_loupiote').insert({
      numero, statut: 'en_attente', date_commande: new Date().toISOString().split('T')[0],
      date_livraison_prevue: dateLivraison || null,
      montant_total_ht: total_ht, montant_consignes: total_consignes, notes: notes || null
    }).select('id').single()
    if (cmd) {
      await supabase.from('commandes_loupiote_lignes').insert(
        lignes.filter(l => l.fut_id).map(l => {
          const fut = futs.find(f => f.id === l.fut_id)
          return { commande_id: cmd.id, fut_catalogue_id: l.fut_id, quantite: l.quantite, prix_achat_ht: fut?.prix_achat_ht || 0, montant_consigne_unitaire: fut?.montant_consigne || 0 }
        })
      )
    }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e' }}>Commande La Loupiote</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {lignes.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            <select value={l.fut_id} onChange={e => setLignes(prev => prev.map((x, j) => j === i ? { ...x, fut_id: e.target.value } : x))}
              style={{ flex: 2, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#e8e0d5', fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
              <option value="">— Choisir un fût —</option>
              {futs.map(f => <option key={f.id} value={f.id}>{f.nom_cuvee} {f.contenance_litres}L — {f.prix_achat_ht}€ HT</option>)}
            </select>
            <input type="number" min={1} value={l.quantite} onChange={e => setLignes(prev => prev.map((x, j) => j === i ? { ...x, quantite: parseInt(e.target.value) || 1 } : x))}
              style={{ width: 70, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '10px', textAlign: 'center' }} />
            <button onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        ))}

        <button onClick={() => setLignes(prev => [...prev, { fut_id: '', quantite: 1 }])} style={{ fontSize: 13, color: '#c9a96e', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', marginBottom: 20 }}>
          + Ajouter un fût
        </button>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>DATE LIVRAISON PRÉVUE</div>
          <input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '10px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>NOTES</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 14, padding: '10px', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>

        <div style={{ background: 'rgba(201,169,110,0.06)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 4 }}><span>Total HT fûts</span><span>{total_ht.toFixed(2)}€</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 4 }}><span>Consignes</span><span>{total_consignes.toFixed(2)}€</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif', marginTop: 8 }}><span>Total à payer</span><span>{(total_ht + total_consignes).toFixed(2)}€</span></div>
        </div>

        <button onClick={save} disabled={saving || !lignes.some(l => l.fut_id)} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>
          {saving ? '⟳' : '✓ Enregistrer la commande'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Nouvelle Consigne ──
function ModalNouvelleConsigne({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ date_retour_futs: new Date().toISOString().split('T')[0], quantite_futs_rendus: 1, montant_consigne_attendu: 36, montant_consigne_recu: 0, notes: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const statut = form.montant_consigne_recu >= form.montant_consigne_attendu ? 'soldé' : form.montant_consigne_recu > 0 ? 'partiel' : 'en_attente'
    await supabase.from('consignes_loupiote').insert({ ...form, statut })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 16, padding: 32, maxWidth: 440, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e' }}>Retour fûts La Loupiote</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        {[
          { label: 'Date de retour des fûts', key: 'date_retour_futs', type: 'date' },
          { label: 'Nombre de fûts rendus', key: 'quantite_futs_rendus', type: 'number' },
          { label: 'Consigne attendue (€)', key: 'montant_consigne_attendu', type: 'number' },
          { label: 'Consigne reçue (€)', key: 'montant_consigne_recu', type: 'number' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6, letterSpacing: 1 }}>{label.toUpperCase()}</div>
            <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '12px', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 6 }}>NOTES</div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0e8d8', fontSize: 14, padding: '10px', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: form.montant_consigne_recu >= form.montant_consigne_attendu ? '#6ec96e' : '#c96e6e', marginBottom: 20 }}>
          <span>Écart</span>
          <span>{(form.montant_consigne_recu - form.montant_consigne_attendu).toFixed(2)}€</span>
        </div>
        <button onClick={save} disabled={saving} style={{ width: '100%', background: '#c9a96e', border: 'none', borderRadius: 10, color: '#0d0a08', padding: '14px', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>
          {saving ? '⟳' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  )
}