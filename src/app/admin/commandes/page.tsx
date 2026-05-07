'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// CAVE DE GILBERT — Module Commandes Fournisseurs
// src/app/admin/commandes/page.tsx
// Besoins → Commandes par fournisseur → Réception stock
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type View = 'besoins' | 'commandes' | 'detail' | 'reception' | 'associer'

const STATUT_CMD: Record<string, { bg: string; color: string; label: string }> = {
  brouillon:  { bg: '#222',    color: '#888',    label: 'Brouillon' },
  envoyée:    { bg: '#2a2a1e', color: '#c9b06e', label: 'Envoyée' },
  confirmée:  { bg: '#1e1e2a', color: '#6e9ec9', label: 'Confirmée' },
  en_transit: { bg: '#1e1e2a', color: '#6e9ec9', label: 'En transit' },
  reçue:      { bg: '#1e2a1e', color: '#6ec96e', label: 'Reçue ✓' },
  annulée:    { bg: '#2a1e1e', color: '#c96e6e', label: 'Annulée' },
}

function Badge({ statut }: { statut: string }) {
  const s = STATUT_CMD[statut] || { bg: '#222', color: '#888', label: statut }
  return <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase' as const }}>{s.label}</span>
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 24, color: '#c9a96e', animation: 'spin 1.5s linear infinite' }}>⟳</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const sel = { width: '100%', background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, color: '#f0e8d8', fontSize: 13, padding: '9px 12px', cursor: 'pointer', boxSizing: 'border-box' as const }
const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
const card = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px' } as React.CSSProperties
const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

// ── Sidebar ──────────────────────────────────────────────────

function Sidebar({ view, setView, counts }: { view: View; setView: (v: View) => void; counts: Record<string, number> }) {
  const items = [
    { id: 'besoins',   label: 'Besoins',   icon: '◻', count: counts.besoins },
    { id: 'commandes', label: 'Commandes', icon: '◈', count: counts.commandes },
    { id: 'associer',  label: 'Fournisseurs produits', icon: '⬥' },
  ]
  return (
    <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
        <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
      </div>
      <nav style={{ padding: '16px 0' }}>
        {[
          { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
          { label: 'Produits', href: '/admin', icon: '⬥' },
          { label: 'Transferts', href: '/admin/transferts', icon: '⇄' },
          { label: 'Clients', href: '/admin/clients', icon: '◎' },
        ].map(item => (
          <a key={item.label} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.45)', borderLeft: '2px solid transparent', textDecoration: 'none' }}>
            <span>{item.icon}</span>{item.label}
          </a>
        ))}
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
        <div style={{ padding: '8px 20px', fontSize: 9, letterSpacing: 2, color: 'rgba(232,224,213,0.25)', textTransform: 'uppercase' as const }}>Commandes</div>
        {items.map(item => (
          <button key={item.id} onClick={() => setView(item.id as View)} style={{
            width: '100%', textAlign: 'left' as const, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 20px', fontSize: 12, cursor: 'pointer', background: view === item.id ? 'rgba(201,169,110,0.08)' : 'transparent',
            color: view === item.id ? '#c9a96e' : 'rgba(232,224,213,0.45)',
            borderLeft: `2px solid ${view === item.id ? '#c9a96e' : 'transparent'}`, border: 'none', borderLeftStyle: 'solid' as const,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{item.icon}</span>{item.label}
            </div>
            {item.count !== undefined && item.count > 0 && (
              <span style={{ background: '#c9a96e', color: '#0d0a08', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{item.count}</span>
            )}
          </button>
        ))}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', position: 'absolute' as const, bottom: 0, left: 0, right: 0 }}>
        <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none' }}>← Voir le site</a>
      </div>
    </aside>
  )
}

// ── Vue Besoins ───────────────────────────────────────────────

function VueBesoins({ onRefresh }: { onRefresh: () => void }) {
  const [besoins, setBesoins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchRes, setSearchRes] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadBesoins = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('order_needs')
      .select('*, product:products(id, nom, millesime, couleur), fournisseur:domaines(id, nom)')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
    setBesoins(data || [])
    setLoading(false)
  }

  useEffect(() => { loadBesoins() }, [])

  const searchProducts = async (q: string) => {
    setSearch(q)
    if (q.length < 2) { setSearchRes([]); return }
    const { data } = await supabase
      .from('products')
      .select('id, nom, millesime, couleur, prix_achat_ht')
      .ilike('nom', `%${q}%`)
      .eq('actif', true)
      .limit(15)
    setSearchRes(data || [])
  }

  const addBesoin = async (product: any) => {
    // Vérifier si déjà dans les besoins
    if (besoins.find(b => b.product_id === product.id)) return

    // Chercher le fournisseur associé
    const { data: ps } = await supabase
      .from('product_suppliers')
      .select('domaine_id, prix_achat_ht, conditionnement')
      .eq('product_id', product.id)
      .eq('fournisseur_principal', true)
      .single()

    await supabase.from('order_needs').insert({
      product_id: product.id,
      domaine_id: ps?.domaine_id || null,
      quantite: ps?.conditionnement || 6,
      prix_achat_ht: ps?.prix_achat_ht || product.prix_achat_ht || 0,
      statut: 'en_attente',
    })
    setSearch('')
    setSearchRes([])
    loadBesoins()
  }

  const updateQty = async (id: string, qty: number) => {
    await supabase.from('order_needs').update({ quantite: Math.max(1, qty) }).eq('id', id)
    loadBesoins()
  }

  const removeBesoin = async (id: string) => {
    await supabase.from('order_needs').delete().eq('id', id)
    loadBesoins()
  }

  const generateCommandes = async () => {
    setGenerating(true)
    setError('')
    setSuccess('')

    // Regrouper par fournisseur
    const parFournisseur: Record<string, any[]> = {}
    const sansFournisseur: any[] = []

    for (const b of besoins) {
      if (!b.domaine_id) { sansFournisseur.push(b); continue }
      if (!parFournisseur[b.domaine_id]) parFournisseur[b.domaine_id] = []
      parFournisseur[b.domaine_id].push(b)
    }

    // Créer une commande par fournisseur
    let nbCommandes = 0
    for (const [domaineId, items] of Object.entries(parFournisseur)) {
      // Créer la commande
      const { data: cmd } = await supabase
        .from('supplier_orders')
        .insert({
          domaine_id: domaineId,
          statut: 'brouillon',
          date_commande: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (!cmd) continue

      // Ajouter les lignes
      await supabase.from('supplier_order_items').insert(
        items.map(b => ({
          order_id: cmd.id,
          product_id: b.product_id,
          product_nom: b.product?.nom || '',
          product_millesime: b.product?.millesime || null,
          quantite_commandee: b.quantite,
          prix_achat_ht: b.prix_achat_ht || 0,
        }))
      )

      // Marquer les besoins comme commandés
      await supabase.from('order_needs')
        .update({ statut: 'commandé', supplier_order_id: cmd.id })
        .in('id', items.map(b => b.id))

      nbCommandes++
    }

    setGenerating(false)
    if (nbCommandes > 0) {
      setSuccess(`${nbCommandes} commande${nbCommandes > 1 ? 's' : ''} générée${nbCommandes > 1 ? 's' : ''} avec succès !`)
      loadBesoins()
      onRefresh()
    }
    if (sansFournisseur.length > 0) {
      setError(`${sansFournisseur.length} produit(s) sans fournisseur associé — non commandé(s)`)
    }
  }

  const besoinsAvecFournisseur = besoins.filter(b => b.domaine_id)
  const besoinsSansFournisseur = besoins.filter(b => !b.domaine_id)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Besoins</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{besoins.length} produit{besoins.length > 1 ? 's' : ''} en attente de commande</p>
        </div>
        <button onClick={generateCommandes} disabled={generating || besoinsAvecFournisseur.length === 0} style={{
          background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
          padding: '11px 24px', fontSize: 11, letterSpacing: 2, cursor: besoinsAvecFournisseur.length === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 500, textTransform: 'uppercase' as const, opacity: besoinsAvecFournisseur.length === 0 ? 0.5 : 1,
        }}>
          {generating ? '⟳ Génération...' : `✓ Passer les commandes (${besoinsAvecFournisseur.length})`}
        </button>
      </div>

      {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 4, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#6ec96e' }}>{success}</div>}

      {/* Ajouter un produit */}
      <div style={{ ...card, marginBottom: 20, position: 'relative' as const }}>
        <div style={lbl}>Ajouter un produit aux besoins</div>
        <input value={search} onChange={e => searchProducts(e.target.value)} placeholder="Tapez le nom d'un vin..."
          style={{ ...inp, marginBottom: searchRes.length > 0 ? 0 : undefined }} />
        {searchRes.length > 0 && (
          <div style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
            {searchRes.map(p => (
              <div key={p.id} onClick={() => addBesoin(p)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                background: besoins.find(b => b.product_id === p.id) ? 'rgba(201,169,110,0.08)' : '#18130e',
              }}
                onMouseEnter={e => { if (!besoins.find(b => b.product_id === p.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!besoins.find(b => b.product_id === p.id)) e.currentTarget.style.background = '#18130e' }}
              >
                <div>
                  <span style={{ fontSize: 13, color: '#f0e8d8' }}>{p.nom}</span>
                  {p.millesime && <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginLeft: 8 }}>{p.millesime}</span>}
                </div>
                {besoins.find(b => b.product_id === p.id)
                  ? <span style={{ fontSize: 10, color: '#c9a96e' }}>✓ Déjà dans les besoins</span>
                  : <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>+ Ajouter</span>
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerte sans fournisseur */}
      {besoinsSansFournisseur.length > 0 && (
        <div style={{ background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.2)', borderRadius: 5, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>
          ⚠ {besoinsSansFournisseur.length} produit(s) sans fournisseur associé — ils ne seront pas commandés. Associez-leur un fournisseur dans l'onglet "Fournisseurs produits".
        </div>
      )}

      {/* Liste des besoins */}
      {loading ? <Spinner /> : besoins.length === 0 ? (
        <div style={{ ...card, textAlign: 'center' as const, padding: '48px' }}>
          <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 14 }}>Aucun besoin en attente.</p>
          <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 12, marginTop: 8 }}>Ajoutez des produits ci-dessus ou ils apparaîtront automatiquement en cas de rupture.</p>
        </div>
      ) : (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Fournisseur', 'Prix achat HT', 'Quantité', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {besoins.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: i < besoins.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8' }}>{b.product?.nom}</div>
                    {b.product?.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{b.product.millesime}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: b.fournisseur ? '#e8e0d5' : '#c96e6e' }}>
                    {b.fournisseur?.nom || <span style={{ fontSize: 11 }}>⚠ Non associé</span>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                    {b.prix_achat_ht ? `${parseFloat(b.prix_achat_ht).toFixed(2)}€` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 3, width: 'fit-content' }}>
                      <button onClick={() => updateQty(b.id, b.quantite - 1)} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', width: 28, height: 30, cursor: 'pointer', fontSize: 14 }}>−</button>
                      <span style={{ width: 32, textAlign: 'center' as const, fontSize: 13, color: '#e8e0d5' }}>{b.quantite}</span>
                      <button onClick={() => updateQty(b.id, b.quantite + 1)} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', width: 28, height: 30, cursor: 'pointer', fontSize: 14 }}>+</button>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => removeBesoin(b.id)} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {besoins.length > 0 && (
            <div style={{ padding: '12px 14px', borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Total estimé :</span>
              <span style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                {besoins.reduce((acc, b) => acc + (parseFloat(b.prix_achat_ht || 0) * b.quantite), 0).toFixed(2)}€ HT
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Vue Commandes ─────────────────────────────────────────────

function VueCommandes({ onSelectDetail }: { onSelectDetail: (cmd: any) => void }) {
  const [commandes, setCommandes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('tous')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('supplier_orders')
        .select('*, fournisseur:domaines(id, nom, description), items:supplier_order_items(id)')
        .order('created_at', { ascending: false })
      setCommandes(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = commandes.filter(c => filterStatut === 'tous' || c.statut === filterStatut)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Commandes fournisseurs</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{commandes.length} commande{commandes.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['tous', 'brouillon', 'envoyée', 'confirmée', 'en_transit', 'reçue', 'annulée'].map(s => (
          <button key={s} onClick={() => setFilterStatut(s)} style={{
            background: filterStatut === s ? 'rgba(201,169,110,0.15)' : 'transparent',
            border: `0.5px solid ${filterStatut === s ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: filterStatut === s ? '#c9a96e' : 'rgba(232,224,213,0.4)',
            borderRadius: 4, padding: '6px 14px', fontSize: 11, cursor: 'pointer',
          }}>{s === 'tous' ? 'Toutes' : STATUT_CMD[s]?.label || s}</button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center' as const, padding: '48px' }}>
          <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 14 }}>Aucune commande.</p>
          <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 12, marginTop: 8 }}>Ajoutez des besoins et cliquez "Passer les commandes".</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {filtered.map(cmd => (
            <div key={cmd.id} onClick={() => onSelectDetail(cmd)} style={{
              ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{cmd.numero}</span>
                  <Badge statut={cmd.statut} />
                </div>
                <div style={{ fontSize: 15, color: '#f0e8d8', marginBottom: 3, fontFamily: 'Georgia, serif', fontWeight: 300 }}>
                  {cmd.fournisseur?.nom || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>
                  {cmd.items?.length || 0} référence{(cmd.items?.length || 0) > 1 ? 's' : ''}
                  {cmd.date_commande && ` · ${new Date(cmd.date_commande).toLocaleDateString('fr-FR')}`}
                  {cmd.total_ttc && ` · ${parseFloat(cmd.total_ttc).toFixed(2)}€ TTC`}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Voir →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Détail commande ───────────────────────────────────────────

function DetailCommande({ commande, onBack, onRefresh }: { commande: any; onBack: () => void; onRefresh: () => void }) {
  const [items, setItems] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [siteReception, setSiteReception] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [qtesRecues, setQtesRecues] = useState<Record<string, number>>({})
  const [showReception, setShowReception] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: itemsData }, { data: sitesData }] = await Promise.all([
        supabase.from('supplier_order_items').select('*, product:products(id, nom, millesime)').eq('order_id', commande.id),
        supabase.from('sites').select('*').eq('actif', true).order('type'),
      ])
      setItems(itemsData || [])
      setSites(sitesData || [])
      // Par défaut : l'entrepôt
      const entrepot = sitesData?.find(s => s.type === 'entrepot')
      setSiteReception(entrepot?.id || sitesData?.[0]?.id || '')
      // Init quantités reçues = commandées
      const init: Record<string, number> = {}
      itemsData?.forEach(item => { init[item.id] = item.quantite_commandee })
      setQtesRecues(init)
      setLoading(false)
    }
    load()
  }, [commande.id])

  const handleSendEmail = () => {
    const body = items.map(i => `- ${i.product_nom}${i.product_millesime ? ` ${i.product_millesime}` : ''} : ${i.quantite_commandee} btl @ ${parseFloat(i.prix_achat_ht).toFixed(2)}€ HT`).join('\n')
    const subject = `Commande ${commande.numero} — Cave de Gilbert`
    const mailBody = `Bonjour,\n\nVeuillez trouver ci-dessous notre commande ${commande.numero} :\n\n${body}\n\nTotal HT estimé : ${parseFloat(commande.total_ht || 0).toFixed(2)}€\n\nCordialement,\nLa Cave de Gilbert`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`)

    // Marquer comme envoyée
    supabase.from('supplier_orders').update({ statut: 'envoyée' }).eq('id', commande.id).then(() => onRefresh())
  }

  const handleReception = async () => {
    setProcessing(true)
    for (const item of items) {
      const qty = qtesRecues[item.id] || 0
      if (qty <= 0) continue

      // Mettre à jour la ligne
      await supabase.from('supplier_order_items').update({ quantite_recue: qty }).eq('id', item.id)

      // Entrer en stock
      if (siteReception) {
        await supabase.rpc('move_stock', {
          p_product_id: item.product_id,
          p_site_id: siteReception,
          p_raison: 'achat',
          p_quantite: qty,
          p_note: `Réception commande ${commande.numero}`,
          p_order_id: null,
          p_transfer_id: null,
        })
      }
    }

    // Marquer la commande comme reçue
    await supabase.from('supplier_orders').update({
      statut: 'reçue',
      date_livraison_effective: new Date().toISOString().split('T')[0],
    }).eq('id', commande.id)

    setProcessing(false)
    setShowReception(false)
    onRefresh()
    onBack()
  }

  const totalHT = items.reduce((acc, i) => acc + (parseFloat(i.prix_achat_ht || 0) * i.quantite_commandee), 0)

  return (
    <div style={{ maxWidth: 800 }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Retour</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e', marginBottom: 4 }}>{commande.numero}</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
            {commande.fournisseur?.nom || '—'}
          </h1>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>
            {commande.date_commande && `Commandé le ${new Date(commande.date_commande).toLocaleDateString('fr-FR')}`}
          </div>
        </div>
        <Badge statut={commande.statut} />
      </div>

      {/* Actions */}
      {!showReception && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {['brouillon', 'envoyée', 'confirmée'].includes(commande.statut) && (
            <button onClick={handleSendEmail} style={{
              background: '#1e1e2a', border: '0.5px solid rgba(110,158,201,0.4)', color: '#6e9ec9',
              borderRadius: 4, padding: '10px 18px', fontSize: 11, cursor: 'pointer', letterSpacing: 1,
            }}>📧 Envoyer par email</button>
          )}
          {['envoyée', 'confirmée', 'en_transit'].includes(commande.statut) && (
            <button onClick={() => setShowReception(true)} style={{
              background: '#1e2a1e', border: '0.5px solid rgba(110,201,110,0.4)', color: '#6ec96e',
              borderRadius: 4, padding: '10px 18px', fontSize: 11, cursor: 'pointer', letterSpacing: 1,
            }}>📦 Réceptionner la commande</button>
          )}
          {commande.statut === 'brouillon' && (
            <button onClick={() => supabase.from('supplier_orders').update({ statut: 'annulée' }).eq('id', commande.id).then(onRefresh)} style={{
              background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e',
              borderRadius: 4, padding: '10px 14px', fontSize: 11, cursor: 'pointer',
            }}>Annuler</button>
          )}
        </div>
      )}

      {/* Réception */}
      {showReception && (
        <div style={{ ...card, marginBottom: 20, border: '0.5px solid rgba(110,201,110,0.2)' }}>
          <div style={{ fontSize: 13, color: '#6ec96e', marginBottom: 16 }}>📦 Réception de la commande</div>
          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Site de réception (où entrer le stock)</div>
            <select value={siteReception} onChange={e => setSiteReception(e.target.value)} style={{ ...sel, width: 300 }}>
              {sites.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{s.nom} — {s.ville}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Quantités réellement reçues</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#e8e0d5' }}>{item.product_nom}{item.product_millesime ? ` ${item.product_millesime}` : ''}</span>
                  <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Commandé : {item.quantite_commandee}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 3 }}>
                    <button onClick={() => setQtesRecues(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] || 0) - 1) }))} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', width: 28, height: 30, cursor: 'pointer', fontSize: 14 }}>−</button>
                    <span style={{ width: 36, textAlign: 'center' as const, fontSize: 13, color: '#e8e0d5' }}>{qtesRecues[item.id] ?? item.quantite_commandee}</span>
                    <button onClick={() => setQtesRecues(q => ({ ...q, [item.id]: (q[item.id] ?? item.quantite_commandee) + 1 }))} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.5)', width: 28, height: 30, cursor: 'pointer', fontSize: 14 }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowReception(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '10px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
            <button onClick={handleReception} disabled={processing} style={{ flex: 2, background: '#6ec96e', color: '#0a1a0a', border: 'none', borderRadius: 4, padding: '10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
              {processing ? '⟳ En cours...' : '✓ Valider la réception'}
            </button>
          </div>
        </div>
      )}

      {/* Produits */}
      {loading ? <Spinner /> : (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Quantité', 'Prix HT unitaire', 'Total HT', 'Reçu'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8' }}>{item.product_nom}</div>
                    {item.product_millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{item.product_millesime}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>{item.quantite_commandee} btl</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{parseFloat(item.prix_achat_ht || 0).toFixed(2)}€</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'Georgia, serif' }}>{(parseFloat(item.prix_achat_ht || 0) * item.quantite_commandee).toFixed(2)}€</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: item.quantite_recue != null ? '#6ec96e' : 'rgba(232,224,213,0.3)' }}>
                    {item.quantite_recue != null ? `${item.quantite_recue} btl ✓` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
                <td colSpan={3} style={{ padding: '12px 14px', textAlign: 'right' as const, fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1 }}>TOTAL HT</td>
                <td style={{ padding: '12px 14px', fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 300 }}>{totalHT.toFixed(2)}€</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Associer fournisseurs aux produits ───────────────────────

function VueAssocierFournisseurs() {
  const [search, setSearch] = useState('')
  const [produits, setProduits] = useState<any[]>([])
  const [domaines, setDomaines] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('domaines').select('id, nom').order('nom').then(({ data }) => setDomaines(data || []))
  }, [])

  const searchProduits = async (q: string) => {
    setSearch(q)
    if (q.length < 2) { setProduits([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id, nom, millesime, couleur, domaine_id, domaine:domaines!domaine_id(nom)')
      .ilike('nom', `%${q}%`)
      .eq('actif', true)
      .limit(20)

    // Pour chaque produit, charger le fournisseur associé
    const ids = (data || []).map(p => p.id)
    const { data: suppliers } = await supabase
      .from('product_suppliers')
      .select('product_id, domaine_id, prix_achat_ht, conditionnement, fournisseur:domaines(nom)')
      .in('product_id', ids)
      .eq('fournisseur_principal', true)

    const suppMap = Object.fromEntries((suppliers || []).map(s => [s.product_id, s]))

    setProduits((data || []).map(p => ({ ...p, supplier: suppMap[p.id] || null })))
    setLoading(false)
  }

  const saveFournisseur = async (productId: string, domaineId: string, prixHT: string, conditionnement: string) => {
    setSaving(productId)
    // Upsert dans product_suppliers
    await supabase.from('product_suppliers').upsert({
      product_id: productId,
      domaine_id: domaineId,
      prix_achat_ht: prixHT ? parseFloat(prixHT) : null,
      conditionnement: conditionnement ? parseInt(conditionnement) : 6,
      fournisseur_principal: true,
    }, { onConflict: 'product_id,domaine_id' })

    setSuccess(productId)
    setTimeout(() => setSuccess(null), 2000)
    setSaving(null)
    searchProduits(search)
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Fournisseurs par produit</h1>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Associez un fournisseur principal à chaque vin pour la génération des commandes</p>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={lbl}>Rechercher un produit</div>
        <input value={search} onChange={e => searchProduits(e.target.value)} placeholder="Tapez le nom d'un vin..."
          style={inp} />
      </div>

      {loading ? <Spinner /> : produits.length === 0 && search.length >= 2 ? (
        <div style={{ textAlign: 'center' as const, padding: '32px', color: 'rgba(232,224,213,0.3)' }}>Aucun produit trouvé</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {produits.map(p => (
            <AssocierRow key={p.id} produit={p} domaines={domaines} saving={saving} success={success} onSave={saveFournisseur} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssocierRow({ produit, domaines, saving, success, onSave }: {
  produit: any, domaines: any[], saving: string | null, success: string | null,
  onSave: (productId: string, domaineId: string, prixHT: string, conditionnement: string) => void
}) {
  const [domaineId, setDomaineId] = useState(produit.supplier?.domaine_id || produit.domaine_id || '')
  const [prixHT, setPrixHT] = useState(produit.supplier?.prix_achat_ht?.toString() || '')
  const [conditionnement, setConditionnement] = useState(produit.supplier?.conditionnement?.toString() || '6')

  return (
    <div style={{ ...card, display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 12, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 13, color: '#f0e8d8' }}>{produit.nom}</div>
        {produit.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{produit.millesime}</div>}
      </div>
      <select value={domaineId} onChange={e => setDomaineId(e.target.value)} style={sel}>
        <option value="" style={{ background: '#1a1408', color: '#888' }}>— Choisir un fournisseur —</option>
        {domaines.map(d => <option key={d.id} value={d.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{d.nom}</option>)}
      </select>
      <div>
        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 4 }}>Prix HT</div>
        <input type="number" value={prixHT} onChange={e => setPrixHT(e.target.value)} placeholder="0.00"
          style={{ ...inp, width: '100%' }} />
      </div>
      <div>
        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 4 }}>Cdt.</div>
        <input type="number" value={conditionnement} onChange={e => setConditionnement(e.target.value)} placeholder="6"
          style={{ ...inp, width: '100%' }} />
      </div>
      <button onClick={() => onSave(produit.id, domaineId, prixHT, conditionnement)} disabled={!domaineId || saving === produit.id} style={{
        background: success === produit.id ? '#1e2a1e' : '#c9a96e',
        color: success === produit.id ? '#6ec96e' : '#0d0a08',
        border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 11,
        cursor: !domaineId ? 'not-allowed' : 'pointer', fontWeight: 500, whiteSpace: 'nowrap' as const,
        opacity: !domaineId ? 0.5 : 1,
      }}>
        {saving === produit.id ? '...' : success === produit.id ? '✓ Sauvé' : 'Sauvegarder'}
      </button>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

export default function AdminCommandesPage() {
  const [view, setView] = useState<View>('besoins')
  const [selectedCommande, setSelectedCommande] = useState<any>(null)
  const [counts, setCounts] = useState({ besoins: 0, commandes: 0 })

  const loadCounts = useCallback(async () => {
    const [{ count: cBesoins }, { count: cCommandes }] = await Promise.all([
      supabase.from('order_needs').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
      supabase.from('supplier_orders').select('*', { count: 'exact', head: true }).in('statut', ['brouillon', 'envoyée', 'confirmée', 'en_transit']),
    ])
    setCounts({ besoins: cBesoins || 0, commandes: cCommandes || 0 })
  }, [])

  useEffect(() => { loadCounts() }, [loadCounts])

  const handleSelectDetail = (cmd: any) => {
    // Enrichir avec le fournisseur
    supabase.from('supplier_orders').select('*, fournisseur:domaines(id, nom)').eq('id', cmd.id).single().then(({ data }) => {
      setSelectedCommande(data || cmd)
      setView('detail')
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex' }}>
      <Sidebar view={view} setView={v => { setView(v); setSelectedCommande(null) }} counts={counts} />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>
        {view === 'besoins' && <VueBesoins onRefresh={loadCounts} />}
        {view === 'commandes' && <VueCommandes onSelectDetail={handleSelectDetail} />}
        {view === 'detail' && selectedCommande && (
          <DetailCommande commande={selectedCommande} onBack={() => setView('commandes')} onRefresh={loadCounts} />
        )}
        {view === 'associer' && <VueAssocierFournisseurs />}
      </main>
    </div>
  )
}