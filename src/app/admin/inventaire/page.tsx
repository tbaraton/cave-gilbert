'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ────────────────────────────────────────────────────
type Inventaire = {
  id: string
  site_id: string
  statut: 'en_cours' | 'validé'
  cree_le: string
  valide_le?: string
  notes?: string
  site?: { nom: string }
}

type Ligne = {
  id: string
  product_id: string
  stock_theorique: number
  stock_compte: number | null
  ecart: number | null
  product?: { nom: string; millesime?: number; couleur: string; nom_cuvee?: string }
}

// ── Helpers ──────────────────────────────────────────────────
const COULEUR_COLOR: Record<string, string> = {
  rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0',
  champagne: '#c0c0d8', effervescent: '#c0c0d8', spiritueux: '#8ec98e', autre: '#888',
}

function Sidebar({ view, setView }: { view: string; setView: (v: string) => void }) {
  return (
    <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
        <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>INVENTAIRE</div>
      </div>
      <nav style={{ padding: '16px 0' }}>
        {[
          { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
          { label: 'Produits', href: '/admin', icon: '⬥' },
          { label: 'Commandes', href: '/admin/commandes', icon: '◻' },
          { label: 'Fournisseurs', href: '/admin/fournisseurs', icon: '◈' },
          { label: 'Transferts', href: '/admin/transferts', icon: '⇄' },
        ].map(({ label, href, icon }) => (
          <a key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.45)', borderLeft: '2px solid transparent', textDecoration: 'none' }}>
            <span>{icon}</span>{label}
          </a>
        ))}
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
        {[
          { id: 'accueil', label: 'Inventaires', icon: '◈' },
          { id: 'historique', label: 'Historique', icon: '◉' },
        ].map(({ id, label, icon }) => (
          <button key={id} onClick={() => setView(id)} style={{
            width: '100%', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 20px', fontSize: 12, cursor: 'pointer',
            background: view === id ? 'rgba(201,169,110,0.08)' : 'transparent',
            color: view === id ? '#c9a96e' : 'rgba(232,224,213,0.45)',
            border: 'none', borderLeft: `2px solid ${view === id ? '#c9a96e' : 'transparent'}`,
          }}>
            <span>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

// ── Modal Nouveau Inventaire ─────────────────────────────────
function ModalNouvelInventaire({ sites, onCreated, onClose }: {
  sites: any[]
  onCreated: (inv: Inventaire) => void
  onClose: () => void
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id || '')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!siteId) { setError('Choisissez un site'); return }
    setCreating(true)

    // Créer l'inventaire
    const { data: inv, error: invErr } = await supabase
      .from('inventaires')
      .insert({ site_id: siteId, statut: 'en_cours', notes })
      .select('*, site:sites(nom)')
      .single()

    if (invErr) { setError(invErr.message); setCreating(false); return }

    // Charger tous les produits actifs avec leur stock sur ce site
    const { data: stockData } = await supabase
      .from('stock')
      .select('product_id, quantite')
      .eq('site_id', siteId)

    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('actif', true)

    const stockMap = Object.fromEntries((stockData || []).map((s: any) => [s.product_id, s.quantite || 0]))

    // Créer une ligne par produit actif
    const lignes = (products || []).map((p: any) => ({
      inventaire_id: inv.id,
      product_id: p.id,
      stock_theorique: stockMap[p.id] || 0,
      stock_compte: null, // pas encore compté
    }))

    // Insérer par batch de 500
    for (let i = 0; i < lignes.length; i += 500) {
      await supabase.from('inventaire_lignes').insert(lignes.slice(i, i + 500))
    }

    setCreating(false)
    onCreated(inv)
    onClose()
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block' as const, marginBottom: 8 }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: 440, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouvel inventaire</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Site à inventorier *</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ ...inp, background: '#1a1408', cursor: 'pointer' }}>
            {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={lbl}>Notes (optionnel)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex: Inventaire mensuel, comptage après livraison..." style={{ ...inp, resize: 'vertical' as const }} />
        </div>

        <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, padding: '12px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.6)', lineHeight: 1.6 }}>
            ⚠️ <strong style={{ color: '#c9a96e' }}>Règle importante :</strong> tout produit non compté à la validation sera considéré comme ayant un stock de <strong style={{ color: '#c96e6e' }}>0</strong>.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleCreate} disabled={creating} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: creating ? 0.7 : 1 }}>
            {creating ? '⟳ Création...' : '✓ Démarrer l\'inventaire'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vue Saisie Inventaire ────────────────────────────────────
function VueSaisie({ inventaire, onBack }: { inventaire: Inventaire; onBack: () => void }) {
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCouleur, setFilterCouleur] = useState('')
  const [filterDomaine, setFilterDomaine] = useState('')
  const [sortBy, setSortBy] = useState<'nom' | 'domaine'>('nom')
  const [domaines, setDomaines] = useState<any[]>([])
  const [showValider, setShowValider] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [validating, setValidating] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const loadLignes = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: domsData }] = await Promise.all([
      supabase
        .from('inventaire_lignes')
        .select('*, product:products(nom, millesime, couleur, nom_cuvee, domaine_id)')
        .eq('inventaire_id', inventaire.id)
        .order('product(nom)'),
      supabase.from('domaines').select('id, nom').order('nom'),
    ])
    setLignes(data || [])
    setDomaines(domsData || [])
    setLoading(false)
  }, [inventaire.id])

  useEffect(() => { loadLignes() }, [loadLignes])

  const updateCompte = async (ligneId: string, val: number | null) => {
    // Mise à jour locale immédiate
    setLignes(prev => prev.map(l => l.id === ligneId ? { ...l, stock_compte: val, ecart: val !== null ? val - l.stock_theorique : null } : l))
    // Sauvegarde en base
    await supabase.from('inventaire_lignes').update({ stock_compte: val }).eq('id', ligneId)
  }

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const nextIdx = idx + 1
      const nextLigne = lignesFiltrees[nextIdx]
      if (nextLigne) {
        inputRefs.current[nextLigne.id]?.focus()
        inputRefs.current[nextLigne.id]?.select()
      }
    }
  }

  const handleValider = async () => {
    if (confirmText !== 'VALIDER') return
    setValidating(true)

    // Pour chaque ligne : mettre stock_compte = 0 si null, puis ajuster le stock
    for (const ligne of lignes) {
      const compteFinale = ligne.stock_compte ?? 0
      const ecart = compteFinale - ligne.stock_theorique

      // Mettre à jour la ligne
      await supabase.from('inventaire_lignes').update({ stock_compte: compteFinale }).eq('id', ligne.id)

      if (ecart !== 0) {
        // Créer un mouvement d'ajustement
        await supabase.rpc('move_stock', {
          p_product_id: ligne.product_id,
          p_site_id: inventaire.site_id,
          p_raison: 'ajustement',
          p_quantite: ecart,
          p_note: `Inventaire du ${new Date(inventaire.cree_le).toLocaleDateString('fr-FR')}`,
          p_order_id: null,
          p_transfer_id: null,
        })
      }
    }

    // Valider l'inventaire
    await supabase.from('inventaires').update({
      statut: 'validé',
      valide_le: new Date().toISOString(),
    }).eq('id', inventaire.id)

    setValidating(false)
    onBack()
  }

  const lignesFiltrees = lignes
    .filter(l =>
      (!search || l.product?.nom?.toLowerCase().includes(search.toLowerCase())) &&
      (!filterCouleur || l.product?.couleur === filterCouleur) &&
      (!filterDomaine || (l.product as any)?.domaine_id === filterDomaine)
    )
    .sort((a, b) => {
      if (sortBy === 'domaine') {
        const da = domaines.find(d => d.id === (a.product as any)?.domaine_id)?.nom || 'zzz'
        const db = domaines.find(d => d.id === (b.product as any)?.domaine_id)?.nom || 'zzz'
        if (da !== db) return da.localeCompare(db)
      }
      return (a.product?.nom || '').localeCompare(b.product?.nom || '')
    })

  const nbComptees = lignes.filter(l => l.stock_compte !== null).length
  const nbEcarts = lignes.filter(l => l.ecart !== null && l.ecart !== 0).length
  const progress = lignes.length > 0 ? Math.round((nbComptees / lignes.length) * 100) : 0

  const inp = { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px' } as const

  return (
    <div>
      {/* Header sticky */}
      <div style={{ position: 'sticky' as const, top: 0, background: '#0d0a08', zIndex: 10, paddingBottom: 16, borderBottom: '0.5px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 12, cursor: 'pointer', marginBottom: 8, padding: 0 }}>← Retour</button>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
              Inventaire — {inventaire.site?.nom}
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginTop: 4 }}>
              {new Date(inventaire.cree_le).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => setShowValider(true)} disabled={inventaire.statut === 'validé'} style={{
            background: inventaire.statut === 'validé' ? '#1e2a1e' : '#c9a96e',
            color: inventaire.statut === 'validé' ? '#6ec96e' : '#0d0a08',
            border: 'none', borderRadius: 4, padding: '12px 24px', fontSize: 11,
            letterSpacing: 2, cursor: inventaire.statut === 'validé' ? 'default' : 'pointer',
            fontWeight: 500, textTransform: 'uppercase' as const,
          }}>
            {inventaire.statut === 'validé' ? '✓ Validé' : 'Valider l\'inventaire'}
          </button>
        </div>

        {/* Barre de progression */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{nbComptees} / {lignes.length} produits comptés</span>
            <span style={{ fontSize: 12, color: nbEcarts > 0 ? '#c9b06e' : '#6ec96e' }}>
              {nbEcarts > 0 ? `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''}` : nbComptees > 0 ? '✓ Aucun écart' : ''}
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#6ec96e' : '#c9a96e', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          <input placeholder="🔍 Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 200px', ...inp, boxSizing: 'border-box' as const }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: '', label: 'Tous' },
              { key: 'rouge', label: '🔴 Rouge' },
              { key: 'blanc', label: '🟡 Blanc' },
              { key: 'rosé', label: '🌸 Rosé' },
              { key: 'champagne', label: '✨ Champ.' },
              { key: 'autre', label: 'Autre' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilterCouleur(key)} style={{
                background: filterCouleur === key ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${filterCouleur === key ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: filterCouleur === key ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                borderRadius: 20, padding: '6px 12px', fontSize: 11, cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>
          {/* Filtres rapides */}
          <button onClick={() => {
            setSearch('')
            setFilterCouleur('')
          }} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.3)', borderRadius: 4, padding: '6px 12px', fontSize: 10, cursor: 'pointer' }}>
            À compter ({lignes.filter(l => l.stock_compte === null).length})
          </button>
        </div>
      </div>

      {/* Tableau de saisie */}
      {loading ? (
        <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>Chargement...</div>
      ) : (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead style={{ position: 'sticky' as const, top: 0, background: '#14100c', zIndex: 5 }}>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                {['Produit', 'Domaine', 'Couleur', 'Millésime', 'Stock théorique', 'Stock compté', 'Écart'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesFiltrees.map((ligne, idx) => {
                const compte = ligne.stock_compte
                const compteNull = compte === null
                const ecart = ligne.ecart
                return (
                  <tr key={ligne.id} style={{
                    borderBottom: idx < lignesFiltrees.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                    background: compteNull ? 'transparent' : ecart !== 0 ? 'rgba(201,176,110,0.04)' : 'rgba(110,201,110,0.03)',
                  }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, color: compteNull ? 'rgba(232,224,213,0.5)' : '#f0e8d8' }}>
                        {ligne.product?.nom}
                      </div>
                      {ligne.product?.nom_cuvee && (
                        <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', fontStyle: 'italic' }}>{ligne.product.nom_cuvee}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(232,224,213,0.45)' }}>
                      {domaines.find(d => d.id === (ligne.product as any)?.domaine_id)?.nom || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, color: COULEUR_COLOR[ligne.product?.couleur || ''] || '#888' }}>
                        {ligne.product?.couleur || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
                      {ligne.product?.millesime || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{ligne.stock_theorique}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        ref={el => { inputRefs.current[ligne.id] = el }}
                        type="number" min={0}
                        value={compte !== null ? compte : ''}
                        placeholder={compteNull ? '—' : '0'}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        onChange={e => {
                          const val = e.target.value === '' ? null : parseInt(e.target.value) || 0
                          updateCompte(ligne.id, val)
                        }}
                        style={{
                          width: 90, background: compteNull ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                          border: `0.5px solid ${compteNull ? 'rgba(255,255,255,0.1)' : ecart !== 0 ? 'rgba(201,176,110,0.5)' : 'rgba(110,201,110,0.4)'}`,
                          borderRadius: 4, color: '#e8e0d5', fontSize: 14, padding: '6px 10px',
                          textAlign: 'center' as const, outline: 'none',
                        }}
                        readOnly={inventaire.statut === 'validé'}
                      />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {ecart !== null ? (
                        <span style={{
                          fontSize: 13, fontWeight: 500, fontFamily: 'Georgia, serif',
                          color: ecart === 0 ? '#6ec96e' : ecart > 0 ? '#6e9ec9' : '#c96e6e',
                        }}>
                          {ecart > 0 ? '+' : ''}{ecart}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.2)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Popup validation */}
      {showValider && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, padding: '32px', maxWidth: 500, width: '100%' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8', marginBottom: 8 }}>Validation finale</h2>
            <p style={{ fontSize: 13, color: 'rgba(232,224,213,0.6)', marginBottom: 20 }}>
              Inventaire {inventaire.site?.nom} — {new Date(inventaire.cree_le).toLocaleDateString('fr-FR')}
            </p>

            {/* Résumé */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Produits comptés', val: nbComptees, color: '#6ec96e' },
                { label: 'Non comptés → 0', val: lignes.length - nbComptees, color: '#c96e6e' },
                { label: 'Écarts détectés', val: nbEcarts, color: '#c9b06e' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '12px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 24, color, fontFamily: 'Georgia, serif', marginBottom: 4 }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', letterSpacing: 1 }}>{label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.2)', borderRadius: 4, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#c96e6e', marginBottom: 4, fontWeight: 500 }}>⚠️ Action irréversible</div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', lineHeight: 1.6 }}>
                Le stock de tous les produits non comptés ({lignes.length - nbComptees}) sera mis à <strong style={{ color: '#c96e6e' }}>0</strong>.
                Les écarts seront enregistrés comme mouvements d'ajustement.
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.5)', display: 'block', marginBottom: 8 }}>
                Tapez <strong style={{ color: '#c9a96e' }}>VALIDER</strong> pour confirmer :
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="VALIDER"
                autoFocus
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: `0.5px solid ${confirmText === 'VALIDER' ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 4, color: '#f0e8d8', fontSize: 16, padding: '12px',
                  boxSizing: 'border-box' as const, textAlign: 'center' as const, letterSpacing: 3,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowValider(false); setConfirmText('') }}
                style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '12px', fontSize: 11, cursor: 'pointer' }}>
                Annuler
              </button>
              <button
                disabled={confirmText !== 'VALIDER' || validating}
                onClick={handleValider}
                style={{
                  flex: 2, background: confirmText === 'VALIDER' ? '#c9a96e' : '#2a2a1e',
                  color: confirmText === 'VALIDER' ? '#0d0a08' : '#555',
                  border: 'none', borderRadius: 4, padding: '12px', fontSize: 11,
                  cursor: confirmText === 'VALIDER' ? 'pointer' : 'not-allowed',
                  fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' as const,
                }}>
                {validating ? '⟳ Validation en cours...' : '✓ Valider l\'inventaire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────
export default function InventairePage() {
  const [view, setView] = useState('accueil')
  const [sites, setSites] = useState<any[]>([])
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [selectedInventaire, setSelectedInventaire] = useState<Inventaire | null>(null)
  const [showNouveau, setShowNouveau] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: sitesData }, { data: invsData }] = await Promise.all([
      supabase.from('sites').select('*').eq('actif', true).order('nom'),
      supabase.from('inventaires').select('*, site:sites(nom)').order('cree_le', { ascending: false }),
    ])
    setSites(sitesData || [])
    setInventaires(invsData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const inCours = inventaires.filter(i => i.statut === 'en_cours')
  const valides = inventaires.filter(i => i.statut === 'validé')

  const STATUT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    en_cours: { bg: '#1e2a1e', color: '#c9b06e', label: 'En cours' },
    validé:   { bg: '#1e2a1e', color: '#6ec96e', label: 'Validé ✓' },
  }

  // Si un inventaire est sélectionné → vue saisie
  if (selectedInventaire) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
        <Sidebar view={view} setView={setView} />
        <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>
          <VueSaisie
            inventaire={selectedInventaire}
            onBack={() => { setSelectedInventaire(null); loadData() }}
          />
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <Sidebar view={view} setView={setView} />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Inventaires</h1>
            <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Gestion et suivi du stock physique</p>
          </div>
          <button onClick={() => setShowNouveau(true)} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '12px 24px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
            + Nouvel inventaire
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>Chargement...</div>
        ) : (
          <>
            {/* Inventaires en cours */}
            {inCours.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 11, letterSpacing: 2, color: '#c9b06e', textTransform: 'uppercase' as const, marginBottom: 14 }}>En cours</h2>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {inCours.map(inv => (
                    <div key={inv.id} onClick={() => setSelectedInventaire(inv)} style={{
                      background: '#18130e', border: '0.5px solid rgba(201,176,110,0.2)', borderRadius: 6,
                      padding: '18px 22px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e180e')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#18130e')}>
                      <div>
                        <div style={{ fontSize: 15, color: '#f0e8d8', marginBottom: 4 }}>{inv.site?.nom}</div>
                        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                          Démarré le {new Date(inv.cree_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        {inv.notes && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 2, fontStyle: 'italic' }}>{inv.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ background: '#2a2510', color: '#c9b06e', fontSize: 10, padding: '3px 10px', borderRadius: 3, letterSpacing: 1 }}>EN COURS</span>
                        <span style={{ fontSize: 12, color: '#c9a96e' }}>Continuer →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventaires validés */}
            {view === 'historique' || valides.length > 0 ? (
              <div>
                <h2 style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 14 }}>Historique</h2>
                {valides.length === 0 ? (
                  <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '32px', textAlign: 'center' as const }}>
                    <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucun inventaire validé pour le moment.</p>
                  </div>
                ) : (
                  <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                      <thead>
                        <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                          {['Site', 'Date', 'Validé le', 'Notes', ''].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {valides.map((inv, i) => (
                          <tr key={inv.id} style={{ borderBottom: i < valides.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <td style={{ padding: '12px 14px', fontSize: 13, color: '#f0e8d8' }}>{inv.site?.nom}</td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>
                              {new Date(inv.cree_le).toLocaleDateString('fr-FR')}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: '#6ec96e' }}>
                              {inv.valide_le ? new Date(inv.valide_le).toLocaleDateString('fr-FR') : '—'}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.4)', fontStyle: 'italic' }}>
                              {inv.notes || '—'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <button onClick={() => setSelectedInventaire(inv)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                                Voir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              inCours.length === 0 && (
                <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '48px', textAlign: 'center' as const }}>
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e', marginBottom: 8 }}>Aucun inventaire</p>
                  <p style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 24 }}>Lancez votre premier inventaire pour commencer le comptage physique.</p>
                  <button onClick={() => setShowNouveau(true)} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '12px 28px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
                    + Nouvel inventaire
                  </button>
                </div>
              )
            )}
          </>
        )}
      </main>

      {showNouveau && (
        <ModalNouvelInventaire
          sites={sites}
          onCreated={(inv) => { setInventaires(prev => [inv, ...prev]); setSelectedInventaire(inv) }}
          onClose={() => setShowNouveau(false)}
        />
      )}
    </div>
  )
}