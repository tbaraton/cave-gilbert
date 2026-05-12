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

  // Calculs
  const totalReserve = lignes.reduce((acc, l) => acc + l.prix_unitaire * l.quantite_reservee, 0)
  const remisePct = lignes[0]?.remise_pct || 0
  const totalPercute = lignes.reduce((acc, l) => {
    const prixApresRemise = l.prix_unitaire * (1 - remisePct / 100)
    return acc + prixApresRemise * l.quantite_percutee
  }, 0)
  const acompte = resa.acompte_ttc || 0
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
  if (etape === 'done') return (
    <div style={container}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <div style={{ fontSize: 56 }}>✓</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#6ec96e' }}>Retour enregistré</div>
        <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.5)', textAlign: 'center' }}>
          Réservation {resa.numero} clôturée
        </div>
        {soldeClient > 0 && (
          <div style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 10, padding: '16px 24px', textAlign: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>Solde encaissé</div>
            <div style={{ fontSize: 28, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(soldeClient)}</div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>{MODES.find(m => m.id === modePaiement)?.label}</div>
          </div>
        )}
        {remboursement > 0 && (
          <div style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 10, padding: '16px 24px', textAlign: 'center', marginTop: 8 }}>
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
        <button onClick={onDone} style={{ marginTop: 16, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 8, padding: '14px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: 1 }}>
          Retour
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