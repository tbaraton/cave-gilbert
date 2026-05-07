'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// CAVE DE GILBERT — Gestion des transferts inter-sites
// src/app/admin/transferts/page.tsx
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type View = 'liste' | 'nouveau' | 'detail' | 'stock'

const STATUT_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  brouillon:  { bg: '#222',    color: '#888',    label: 'Brouillon' },
  demandé:    { bg: '#2a2a1e', color: '#c9b06e', label: 'Demandé' },
  confirmé:   { bg: '#1e1e2a', color: '#6e9ec9', label: 'Expédié' },
  en_transit: { bg: '#1e1e2a', color: '#6e9ec9', label: 'En transit' },
  reçu:       { bg: '#1e2a1e', color: '#6ec96e', label: 'Reçu ✓' },
  annulé:     { bg: '#2a1e1e', color: '#c96e6e', label: 'Annulé' },
}

function Badge({ statut }: { statut: string }) {
  const s = STATUT_COLORS[statut] || { bg: '#222', color: '#888', label: statut }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase' as const }}>
      {s.label}
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 24, color: '#c9a96e', animation: 'spin 1.5s linear infinite' }}>⟳</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Création d'un transfert ──────────────────────────────────

function NouveauTransfert({ sites, onCreated, onCancel }: {
  sites: any[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [sourceId, setSourceId] = useState(sites[0]?.id || '')
  const [destId, setDestId] = useState(sites[1]?.id || '')
  const [search, setSearch] = useState('')
  const [produits, setProduits] = useState<any[]>([])
  const [lignes, setLignes] = useState<{ product_id: string; nom: string; millesime: number | null; stock_source: number; quantite: number }[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const searchProduits = useCallback(async () => {
    if (!sourceId || search.length < 2) { setProduits([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('stock')
      .select('quantite, product:products(id, nom, millesime, couleur)')
      .eq('site_id', sourceId)
      .gt('quantite', 0)
      .ilike('products.nom', `%${search}%`)
      .limit(20)
    setProduits((data || []).filter(d => d.product))
    setLoading(false)
  }, [sourceId, search])

  useEffect(() => { searchProduits() }, [searchProduits])

  const addLigne = (p: any) => {
    if (lignes.find(l => l.product_id === p.product.id)) return
    setLignes(l => [...l, {
      product_id: p.product.id,
      nom: p.product.nom,
      millesime: p.product.millesime,
      stock_source: p.quantite,
      quantite: 1,
    }])
  }

  const updateQty = (id: string, qty: number) => {
    setLignes(l => l.map(item => item.product_id === id ? { ...item, quantite: Math.max(1, Math.min(qty, item.stock_source)) } : item))
  }

  const removeLigne = (id: string) => setLignes(l => l.filter(item => item.product_id !== id))

  const handleCreate = async () => {
    if (sourceId === destId) { setError('Source et destination doivent être différentes'); return }
    if (lignes.length === 0) { setError('Ajoutez au moins un produit'); return }
    setSaving(true)
    setError('')

    // Créer le transfert
    const { data: transfer, error: errT } = await supabase
      .from('transfers')
      .insert({
        site_source_id: sourceId,
        site_destination_id: destId,
        statut: 'demandé',
        demande_le: new Date().toISOString(),
        notes,
      })
      .select()
      .single()

    if (errT) { setError(errT.message); setSaving(false); return }

    // Ajouter les lignes
    const items = lignes.map(l => ({
      transfer_id: transfer.id,
      product_id: l.product_id,
      quantite_demandee: l.quantite,
    }))

    const { error: errI } = await supabase.from('transfer_items').insert(items)
    if (errI) { setError(errI.message); setSaving(false); return }

    onCreated()
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 8 }}>← Retour</button>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouveau transfert</h1>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

      {/* Sites */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Site source (expéditeur)</label>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)} style={{ width: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, color: '#f0e8d8', fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
              {sites.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{s.nom} — {s.ville}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 24, color: '#c9a96e', textAlign: 'center' as const }}>→</div>
          <div>
            <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Site destination (récepteur)</label>
            <select value={destId} onChange={e => setDestId(e.target.value)} style={{ width: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, color: '#f0e8d8', fontSize: 14, padding: '10px 12px', cursor: 'pointer' }}>
              {sites.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{s.nom} — {s.ville}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Recherche produits */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px', marginBottom: 20 }}>
        <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 10 }}>
          Ajouter des produits (stock disponible sur le site source)
        </label>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tapez le nom d'un vin..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const, marginBottom: 10 }}
        />
        {loading && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Recherche...</div>}
        {produits.length > 0 && (
          <div style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            {produits.map(p => (
              <div key={p.product.id} onClick={() => addLigne(p)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                background: lignes.find(l => l.product_id === p.product.id) ? 'rgba(201,169,110,0.08)' : 'transparent',
              }}
                onMouseEnter={e => { if (!lignes.find(l => l.product_id === p.product.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!lignes.find(l => l.product_id === p.product.id)) e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <span style={{ fontSize: 13, color: '#f0e8d8' }}>{p.product.nom}</span>
                  {p.product.millesime && <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginLeft: 8 }}>{p.product.millesime}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#6ec96e' }}>{p.quantite} en stock</span>
                  {lignes.find(l => l.product_id === p.product.id)
                    ? <span style={{ fontSize: 10, color: '#c9a96e' }}>✓ Ajouté</span>
                    : <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>+ Ajouter</span>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lignes du transfert */}
      {lignes.length > 0 && (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.15)', borderRadius: 6, padding: '20px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 14 }}>
            Produits à transférer ({lignes.length} référence{lignes.length > 1 ? 's' : ''})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Stock source', 'Quantité à transférer', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l.product_id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8' }}>{l.nom}</div>
                    {l.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{l.millesime}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#6ec96e' }}>{l.stock_source} btl</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 3, width: 'fit-content' }}>
                      <button onClick={() => updateQty(l.product_id, l.quantite - 1)} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', width: 30, height: 34, cursor: 'pointer', fontSize: 16 }}>−</button>
                      <span style={{ width: 36, textAlign: 'center' as const, fontSize: 14, color: '#e8e0d5' }}>{l.quantite}</span>
                      <button onClick={() => updateQty(l.product_id, l.quantite + 1)} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', width: 30, height: 34, cursor: 'pointer', fontSize: 16 }}>+</button>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => removeLigne(l.product_id)} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px', marginBottom: 24 }}>
        <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Notes (optionnel)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex: Transfert pour réassort fête de fin d'année"
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '12px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
        <button onClick={handleCreate} disabled={saving || lignes.length === 0} style={{
          flex: 3, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
          padding: '12px', fontSize: 11, letterSpacing: 2, cursor: lignes.length === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 500, textTransform: 'uppercase' as const, opacity: lignes.length === 0 ? 0.5 : 1,
        }}>
          {saving ? 'Création...' : `✓ Créer le transfert (${lignes.length} produit${lignes.length > 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}

// ── Détail d'un transfert ────────────────────────────────────

function DetailTransfert({ transfer, onBack, onRefresh }: {
  transfer: any
  onBack: () => void
  onRefresh: () => void
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('transfer_items')
        .select('*, product:products(id, nom, millesime, couleur)')
        .eq('transfer_id', transfer.id)
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [transfer.id])

  const handleDispatch = async () => {
    setProcessing(true)
    const { error } = await supabase.rpc('confirm_transfer_dispatch', {
      p_transfer_id: transfer.id,
      p_confirmed_by: null,
    })
    if (error) { alert(error.message); setProcessing(false); return }
    onRefresh()
  }

  const handleReceive = async () => {
    setProcessing(true)
    const adj = Object.entries(adjustments)
      .filter(([, qty]) => qty > 0)
      .map(([product_id, quantite_recue]) => ({ product_id, quantite_recue }))

    const { error } = await supabase.rpc('confirm_transfer_receipt', {
      p_transfer_id: transfer.id,
      p_received_by: null,
      p_adjustments: adj.length > 0 ? JSON.stringify(adj) : null,
    })
    if (error) { alert(error.message); setProcessing(false); return }
    onRefresh()
  }

  const handleCancel = async () => {
    if (!confirm('Annuler ce transfert ?')) return
    await supabase.from('transfers').update({ statut: 'annulé' }).eq('id', transfer.id)
    onRefresh()
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Retour</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e', marginBottom: 4 }}>{transfer.numero}</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
            {transfer.site_source?.nom} → {transfer.site_destination?.nom}
          </h1>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>
            {transfer.site_source?.ville} → {transfer.site_destination?.ville}
          </div>
        </div>
        <Badge statut={transfer.statut} />
      </div>

      {/* Timeline */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {[
            { label: 'Demandé', date: transfer.demande_le, done: !!transfer.demande_le },
            { label: 'Expédié', date: transfer.confirme_le, done: !!transfer.confirme_le },
            { label: 'Reçu', date: transfer.recu_le, done: !!transfer.recu_le },
          ].map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ textAlign: 'center' as const, flex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: step.done ? '#c9a96e' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${step.done ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 12, color: step.done ? '#0d0a08' : 'rgba(232,224,213,0.3)' }}>
                  {step.done ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 11, color: step.done ? '#c9a96e' : 'rgba(232,224,213,0.3)' }}>{step.label}</div>
                {step.date && <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', marginTop: 2 }}>{new Date(step.date).toLocaleDateString('fr-FR')}</div>}
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: step.done ? '#c9a96e' : 'rgba(255,255,255,0.06)' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {transfer.notes && (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Notes</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.6)' }}>{transfer.notes}</div>
        </div>
      )}

      {/* Produits */}
      {loading ? <Spinner /> : (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Demandé', 'Expédié', 'Reçu'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8' }}>{item.product?.nom}</div>
                    {item.product?.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{item.product.millesime}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#e8e0d5' }}>{item.quantite_demandee} btl</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: item.quantite_envoyee ? '#6ec96e' : 'rgba(232,224,213,0.3)' }}>
                    {item.quantite_envoyee ?? '—'}{item.quantite_envoyee ? ' btl' : ''}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {transfer.statut === 'confirmé' || transfer.statut === 'en_transit' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" min={0} max={item.quantite_envoyee || item.quantite_demandee}
                          defaultValue={item.quantite_envoyee || item.quantite_demandee}
                          onChange={e => setAdjustments(a => ({ ...a, [item.product_id]: parseInt(e.target.value) }))}
                          style={{ width: 60, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 3, color: '#e8e0d5', fontSize: 12, padding: '4px 8px' }}
                        />
                        <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>btl reçues</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: item.quantite_recue != null ? '#6ec96e' : 'rgba(232,224,213,0.3)' }}>
                        {item.quantite_recue != null ? `${item.quantite_recue} btl` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        {transfer.statut === 'demandé' && (
          <button onClick={handleDispatch} disabled={processing} style={{
            flex: 1, background: '#1e1e2a', border: '0.5px solid rgba(110,158,201,0.4)',
            color: '#6e9ec9', borderRadius: 4, padding: '12px', fontSize: 11,
            cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase' as const,
          }}>
            {processing ? '...' : '📦 Confirmer l\'expédition'}
          </button>
        )}
        {(transfer.statut === 'confirmé' || transfer.statut === 'en_transit') && (
          <button onClick={handleReceive} disabled={processing} style={{
            flex: 1, background: '#1e2a1e', border: '0.5px solid rgba(110,201,110,0.4)',
            color: '#6ec96e', borderRadius: 4, padding: '12px', fontSize: 11,
            cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase' as const,
          }}>
            {processing ? '...' : '✓ Confirmer la réception'}
          </button>
        )}
        {['demandé', 'brouillon'].includes(transfer.statut) && (
          <button onClick={handleCancel} style={{
            background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)',
            color: '#c96e6e', borderRadius: 4, padding: '12px 20px', fontSize: 11,
            cursor: 'pointer',
          }}>Annuler</button>
        )}
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

export default function AdminTransfertsPage() {
  const [view, setView] = useState<View>('liste')
  const [sites, setSites] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null)
  const [stockData, setStockData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchStock, setSearchStock] = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: sitesData }, { data: transfersData }] = await Promise.all([
      supabase.from('sites').select('*').eq('actif', true).order('type'),
      supabase.from('transfers').select(`
        *,
        site_source:sites!site_source_id(id, nom, ville, code),
        site_destination:sites!site_destination_id(id, nom, ville, code)
      `).order('created_at', { ascending: false }).limit(100),
    ])
    setSites(sitesData || [])
    setTransfers(transfersData || [])
    setLoading(false)
  }, [])

  const loadStock = useCallback(async () => {
    const { data } = await supabase
      .from('v_stock_par_site')
      .select('*')
      .ilike('produit', searchStock.length >= 2 ? `%${searchStock}%` : '%')
      .gt('quantite', 0)
      .limit(200)
    setStockData(data || [])
  }, [searchStock])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (view === 'stock') loadStock() }, [view, loadStock, searchStock])

  const transfersFiltres = transfers.filter(t =>
    filterStatut === 'tous' || t.statut === filterStatut
  )

  const handleTransferCreated = () => {
    loadData()
    setView('liste')
  }

  const handleRefresh = () => {
    loadData()
    setView('liste')
    setSelectedTransfer(null)
  }

  // Stock groupé par produit puis par site
  const sitesNames = [...new Set(stockData.map(s => s.site))]
  const produits = [...new Set(stockData.map(s => s.produit))]
  const stockMap: Record<string, Record<string, number>> = {}
  stockData.forEach(s => {
    if (!stockMap[s.produit]) stockMap[s.produit] = {}
    stockMap[s.produit][s.site] = s.quantite
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex' }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          {[
            { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
            { label: 'Produits', href: '/admin', icon: '⬥' },
            { label: 'Stock', href: '/admin', icon: '◈' },
            { label: 'Transferts', href: '/admin/transferts', icon: '⇄', active: true },
            { label: 'Clients', href: '/admin/clients', icon: '◎' },
            { label: 'Locations', href: '/admin', icon: '⟁' },
          ].map(item => (
            <a key={item.label} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12,
              color: item.active ? '#c9a96e' : 'rgba(232,224,213,0.45)',
              borderLeft: `2px solid ${item.active ? '#c9a96e' : 'transparent'}`,
              textDecoration: 'none', background: item.active ? 'rgba(201,169,110,0.08)' : 'transparent',
            }}><span>{item.icon}</span>{item.label}</a>
          ))}
        </nav>

        {/* Sites */}
        <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(232,224,213,0.25)', textTransform: 'uppercase' as const, marginBottom: 10 }}>Sites actifs</div>
          {sites.map(s => (
            <div key={s.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.6)' }}>{s.nom}</div>
              <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.25)' }}>{s.ville}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', position: 'absolute' as const, bottom: 0, left: 0, right: 0 }}>
          <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none' }}>← Voir le site</a>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>

        {view === 'nouveau' && (
          <NouveauTransfert sites={sites} onCreated={handleTransferCreated} onCancel={() => setView('liste')} />
        )}

        {view === 'detail' && selectedTransfer && (
          <DetailTransfert transfer={selectedTransfer} onBack={() => setView('liste')} onRefresh={handleRefresh} />
        )}

        {(view === 'liste' || view === 'stock') && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>
                  Transferts inter-sites
                </h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>
                  Entrepôt Saint-Consorce · Cave de Gilbert Marcy · La Petite Cave L'Arbresle
                </p>
              </div>
              <button onClick={() => setView('nouveau')} style={{
                background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
                padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const,
              }}>+ Nouveau transfert</button>
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
              {[
                { id: 'liste', label: 'Transferts' },
                { id: 'stock', label: 'Stock par site' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setView(tab.id as View)} style={{
                  background: 'transparent', border: 'none',
                  borderBottom: `1.5px solid ${view === tab.id ? '#c9a96e' : 'transparent'}`,
                  color: view === tab.id ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                  padding: '10px 20px', fontSize: 12, cursor: 'pointer', letterSpacing: 1, marginBottom: -1,
                }}>{tab.label}</button>
              ))}
            </div>

            {/* ── LISTE TRANSFERTS ── */}
            {view === 'liste' && (
              <>
                {/* Filtres statut */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {['tous', 'demandé', 'confirmé', 'en_transit', 'reçu', 'annulé'].map(s => (
                    <button key={s} onClick={() => setFilterStatut(s)} style={{
                      background: filterStatut === s ? 'rgba(201,169,110,0.15)' : 'transparent',
                      border: `0.5px solid ${filterStatut === s ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      color: filterStatut === s ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                      borderRadius: 4, padding: '6px 14px', fontSize: 11, cursor: 'pointer', letterSpacing: 0.5,
                      textTransform: 'capitalize' as const,
                    }}>{s === 'tous' ? 'Tous' : STATUT_COLORS[s]?.label || s}</button>
                  ))}
                </div>

                {loading ? <Spinner /> : transfersFiltres.length === 0 ? (
                  <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '48px', textAlign: 'center' as const }}>
                    <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 14, marginBottom: 16 }}>Aucun transfert pour l'instant.</p>
                    <button onClick={() => setView('nouveau')} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1.5 }}>
                      Créer le premier transfert
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                    {transfersFiltres.map(t => (
                      <div key={t.id} onClick={() => { setSelectedTransfer(t); setView('detail') }} style={{
                        background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)',
                        borderRadius: 6, padding: '16px 20px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'border-color 0.15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.25)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{t.numero}</span>
                            <Badge statut={t.statut} />
                          </div>
                          <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 3 }}>
                            <strong>{t.site_source?.nom}</strong>
                            <span style={{ color: '#c9a96e', margin: '0 10px' }}>→</span>
                            <strong>{t.site_destination?.nom}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>
                            {t.site_source?.ville} → {t.site_destination?.ville}
                            {' · '}Créé le {new Date(t.created_at).toLocaleDateString('fr-FR')}
                            {t.notes && ` · ${t.notes}`}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          Voir le détail →
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── STOCK PAR SITE ── */}
            {view === 'stock' && (
              <>
                <input
                  value={searchStock}
                  onChange={e => setSearchStock(e.target.value)}
                  placeholder="Rechercher un vin (min. 2 caractères)..."
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '10px 16px', boxSizing: 'border-box' as const, marginBottom: 20 }}
                />

                {stockData.length === 0 ? (
                  <div style={{ textAlign: 'center' as const, padding: '48px', color: 'rgba(232,224,213,0.3)' }}>
                    {searchStock.length < 2 ? 'Tapez au moins 2 caractères pour rechercher' : 'Aucun produit en stock pour cette recherche'}
                  </div>
                ) : (
                  <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                      <thead>
                        <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>Produit</th>
                          {sitesNames.map(s => (
                            <th key={s} style={{ padding: '10px 14px', textAlign: 'center' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{s}</th>
                          ))}
                          <th style={{ padding: '10px 14px', textAlign: 'center' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>Total</th>
                          <th style={{ padding: '10px 14px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {produits.map((produit, i) => {
                          const total = sitesNames.reduce((acc, s) => acc + (stockMap[produit]?.[s] || 0), 0)
                          return (
                            <tr key={produit} style={{ borderBottom: i < produits.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                              <td style={{ padding: '10px 14px', fontSize: 13, color: '#f0e8d8' }}>{produit}</td>
                              {sitesNames.map(s => {
                                const qty = stockMap[produit]?.[s] || 0
                                return (
                                  <td key={s} style={{ padding: '10px 14px', textAlign: 'center' as const }}>
                                    <span style={{ fontSize: 14, color: qty === 0 ? 'rgba(232,224,213,0.2)' : qty <= 3 ? '#c9b06e' : '#6ec96e', fontFamily: 'Georgia, serif' }}>
                                      {qty}
                                    </span>
                                  </td>
                                )
                              })}
                              <td style={{ padding: '10px 14px', textAlign: 'center' as const, fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{total}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <button onClick={() => setView('nouveau')} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                                  Transférer
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}