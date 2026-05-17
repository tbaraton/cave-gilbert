'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'

// ============================================================
// Cave de Gilbert — Boutique / Catalogue client
// src/app/boutique/page.tsx
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COULEURS = [
  { value: 'rouge',      label: 'Rouges',      color: '#8b2020' },
  { value: 'blanc',      label: 'Blancs',       color: '#b8a96a' },
  { value: 'rosé',       label: 'Rosés',        color: '#c97b7b' },
  { value: 'champagne',  label: 'Champagnes',   color: '#8a6a3e' },
  { value: 'spiritueux', label: 'Spiritueux',   color: '#6e8b6e' },
]

const COULEUR_ACCENT: Record<string, string> = {
  rouge: '#8b2020', blanc: '#b8a96a', rosé: '#c97b7b',
  champagne: '#8a6a3e', effervescent: '#8a6a3e',
  spiritueux: '#6e8b6e', autre: '#888',
}

export default function BoutiquePage() {
  const [produits, setProduits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [couleur, setCouleur] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('mis_en_avant')
  const [prixMax, setPrixMax] = useState<number | null>(null)
  const [stockOnly, setStockOnly] = useState(true)
  // Filtres avancés
  const [regionId, setRegionId] = useState<string>('')
  const [appellationId, setAppellationId] = useState<string>('')
  const [regions, setRegions] = useState<any[]>([])
  const [appellations, setAppellations] = useState<any[]>([])
  const [bioOnly, setBioOnly] = useState(false)
  const [veganOnly, setVeganOnly] = useState(false)
  const [naturelOnly, setNaturelOnly] = useState(false)
  const [biodynamiqueOnly, setBiodynamiqueOnly] = useState(false)
  const [casherOnly, setCasherOnly] = useState(false)

  // Chargement des régions + appellations une seule fois
  useEffect(() => {
    (async () => {
      const [{ data: regs }, { data: apps }] = await Promise.all([
        supabase.from('regions').select('id, nom').order('nom'),
        supabase.from('appellations').select('id, nom, region_id').order('nom'),
      ])
      setRegions(regs || [])
      setAppellations(apps || [])
    })()
  }, [])

  // Si on change la région, on reset l'appellation si elle n'appartient plus à la région
  useEffect(() => {
    if (!regionId || !appellationId) return
    const a = appellations.find((x: any) => x.id === appellationId)
    if (a && a.region_id !== regionId) setAppellationId('')
  }, [regionId, appellationId, appellations])

  const appellationsFiltrees = regionId
    ? appellations.filter((a: any) => a.region_id === regionId)
    : appellations

  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true); setLoadErr('')
      try {
      const ID_MARCY = 'ee3afa96-0c45-407f-87fc-e503fbada6c4'
      const ID_ENTREPOT = 'e12d7e47-23dc-4011-95fc-e9e975fc4307'
      const ID_ARBRESLE = '3097e864-f452-4c2e-9af3-21e26f0330b7'

      // 1) Catalogue direct sur products (sans passer par la vue qui filtre trop)
      let query = supabase
        .from('products')
        .select('id, nom, millesime, couleur, prix_vente_ttc, prix_vente_pro, image_url, slug, bio, ia_generated, description_courte, mis_en_avant, domaine:domaines(nom), appellation:appellations(nom), region:regions(nom), tasting_notes(aromes, accords)')
        .eq('actif', true)
        .eq('visible_boutique', true)
      if (couleur) query = query.eq('couleur', couleur)
      if (regionId) query = query.eq('region_id', regionId)
      if (appellationId) query = query.eq('appellation_id', appellationId)
      if (bioOnly) query = query.eq('bio', true)
      if (veganOnly) query = query.eq('vegan', true)
      if (naturelOnly) query = query.eq('naturel', true)
      if (biodynamiqueOnly) query = query.eq('biodynamique', true)
      if (casherOnly) query = query.eq('casher', true)
      if (prixMax) query = query.lte('prix_vente_ttc', prixMax)
      if (search) query = query.ilike('nom', `%${search}%`)
      switch (sortBy) {
        case 'prix_asc':       query = query.order('prix_vente_ttc', { ascending: true }); break
        case 'prix_desc':      query = query.order('prix_vente_ttc', { ascending: false }); break
        case 'millesime_desc': query = query.order('millesime', { ascending: false }); break
        case 'nom_asc':        query = query.order('nom', { ascending: true }); break
        default:               query = query.order('mis_en_avant', { ascending: false }).order('nom')
      }
      const { data: catalog, error: errCat } = await query.limit(500)
      if (errCat) { console.error('[boutique] catalog error', errCat); setLoadErr(`Catalog : ${errCat.message}`); setProduits([]); return }
      const ids = (catalog || []).map((p: any) => p.id)
      if (ids.length === 0) { setProduits([]); return }

      // 2) Fetch stock des 3 sites (entrepôt = livraison, Marcy/Arbresle = retrait 2h)
      const { data: allStock, error: errStock } = await supabase
        .from('stock')
        .select('product_id, site_id, quantite')
        .in('site_id', [ID_MARCY, ID_ENTREPOT, ID_ARBRESLE])
        .in('product_id', ids)
      if (errStock) console.warn('[boutique] stock error (continuing without stock)', errStock)
      const stockByProd = new Map<string, { entrepot: number; marcy: number; arbresle: number }>()
      for (const s of (allStock || [])) {
        const cur = stockByProd.get(s.product_id) || { entrepot: 0, marcy: 0, arbresle: 0 }
        if (s.site_id === ID_ENTREPOT) cur.entrepot = s.quantite
        else if (s.site_id === ID_MARCY) cur.marcy = s.quantite
        else if (s.site_id === ID_ARBRESLE) cur.arbresle = s.quantite
        stockByProd.set(s.product_id, cur)
      }

      // 3) Aplatir les joins et enrichir avec le stock
      let filtered = (catalog || []).map((p: any) => {
        const s = stockByProd.get(p.id) || { entrepot: 0, marcy: 0, arbresle: 0 }
        const total = s.entrepot + s.marcy + s.arbresle
        const tn = Array.isArray(p.tasting_notes) ? p.tasting_notes[0] : p.tasting_notes
        return {
          ...p,
          domaine: p.domaine?.nom || null,
          appellation: p.appellation?.nom || null,
          region: p.region?.nom || null,
          aromes: tn?.aromes || null,
          accords: tn?.accords || null,
          stock_total: total,
          stock_entrepot: s.entrepot,
          stock_retrait: s.marcy + s.arbresle,
          stock_statut: total === 0 ? 'rupture' : total < 5 ? 'limite' : 'ok',
        }
      })

      // Le filtre "en stock" cache uniquement les ruptures totales (aucun site)
      if (stockOnly) filtered = filtered.filter((p: any) => p.stock_total > 0)

      setProduits(filtered)
      } catch (e: any) {
        console.error('[boutique] load exception', e)
        setLoadErr(`Erreur réseau : ${e?.message || String(e)}`)
        setProduits([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [couleur, bioOnly, veganOnly, naturelOnly, biodynamiqueOnly, casherOnly, stockOnly, prixMax, search, sortBy, regionId, appellationId])

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1a1a1a' }}>

      {/* Nav principal géré par layout.tsx (sticky avec recherche typeahead) */}

      <div style={{ display: 'flex', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── SIDEBAR FILTRES ── */}
        <aside style={{ width: 220, padding: '32px 24px', borderRight: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0, position: 'sticky' as const, top: 64, alignSelf: 'start', height: 'calc(100vh - 64px)', overflowY: 'auto' as const }}>

          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' as const, marginBottom: 20 }}>Filtres</div>

          {/* Couleur */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Type</div>
            <button onClick={() => setCouleur(null)} style={{
              display: 'block', width: '100%', textAlign: 'left' as const, background: 'transparent',
              border: 'none', color: !couleur ? '#8a6a3e' : 'rgba(0,0,0,0.55)',
              fontSize: 12, padding: '6px 0', cursor: 'pointer', letterSpacing: 0.5,
            }}>Tous les vins</button>
            {COULEURS.map(c => (
              <button key={c.value} onClick={() => setCouleur(couleur === c.value ? null : c.value)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' as const,
                background: 'transparent', border: 'none',
                color: couleur === c.value ? c.color : 'rgba(0,0,0,0.55)',
                fontSize: 12, padding: '6px 0', cursor: 'pointer',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block', opacity: couleur === c.value ? 1 : 0.4 }} />
                {c.label}
              </button>
            ))}
          </div>

          {/* Prix */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 12 }}>
              Prix max {prixMax ? `— ${prixMax}€` : ''}
            </div>
            <input type="range" min={0} max={500} step={10} value={prixMax || 500}
              onChange={e => setPrixMax(parseInt(e.target.value) < 500 ? parseInt(e.target.value) : null)}
              style={{ width: '100%', accentColor: '#8a6a3e' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>
              <span>0€</span><span>500€+</span>
            </div>
          </div>

          {/* Région */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 10 }}>Région</div>
            <select value={regionId} onChange={e => setRegionId(e.target.value)} style={{
              width: '100%', background: 'rgba(0,0,0,0.04)', border: '0.5px solid rgba(0,0,0,0.12)',
              borderRadius: 3, color: '#1a1a1a', fontSize: 11, padding: '8px 10px',
            }}>
              <option value="">Toutes les régions</option>
              {regions.map((r: any) => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </div>

          {/* Appellation (cascade depuis région) */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 10 }}>
              Appellation {regionId && <span style={{ textTransform: 'none' as const, letterSpacing: 0, color: 'rgba(0,0,0,0.35)' }}>({appellationsFiltrees.length})</span>}
            </div>
            <select value={appellationId} onChange={e => setAppellationId(e.target.value)} style={{
              width: '100%', background: 'rgba(0,0,0,0.04)', border: '0.5px solid rgba(0,0,0,0.12)',
              borderRadius: 3, color: '#1a1a1a', fontSize: 11, padding: '8px 10px',
            }}>
              <option value="">Toutes les appellations</option>
              {appellationsFiltrees.map((a: any) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>

          {/* Options stock */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Disponibilité</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
              <div onClick={() => setStockOnly(v => !v)} style={{
                width: 14, height: 14, borderRadius: 2,
                border: `0.5px solid ${stockOnly ? '#8a6a3e' : 'rgba(0,0,0,0.2)'}`,
                background: stockOnly ? '#8a6a3e' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {stockOnly && <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)' }} onClick={() => setStockOnly(v => !v)}>En stock uniquement</span>
            </label>
          </div>

          {/* Certifications */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Certifications</div>
            {[
              { label: '🌿 Bio', state: bioOnly, toggle: () => setBioOnly(v => !v) },
              { label: '🌱 Vegan', state: veganOnly, toggle: () => setVeganOnly(v => !v) },
              { label: '🍃 Naturel', state: naturelOnly, toggle: () => setNaturelOnly(v => !v) },
              { label: '🌙 Biodynamique', state: biodynamiqueOnly, toggle: () => setBiodynamiqueOnly(v => !v) },
              { label: '✡ Casher', state: casherOnly, toggle: () => setCasherOnly(v => !v) },
            ].map(({ label, state, toggle }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
                <div onClick={toggle} style={{
                  width: 14, height: 14, borderRadius: 2,
                  border: `0.5px solid ${state ? '#8a6a3e' : 'rgba(0,0,0,0.2)'}`,
                  background: state ? '#8a6a3e' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {state && <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.6)' }} onClick={toggle}>{label}</span>
              </label>
            ))}
          </div>

          {/* Tri */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Trier par</div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
              width: '100%', background: 'rgba(0,0,0,0.05)', border: '0.5px solid rgba(0,0,0,0.12)',
              borderRadius: 3, color: '#1a1a1a', fontSize: 11, padding: '8px 10px',
            }}>
              <option value="mis_en_avant">Notre sélection</option>
              <option value="prix_asc">Prix croissant</option>
              <option value="prix_desc">Prix décroissant</option>
              <option value="millesime_desc">Millésime récent</option>
              <option value="nom_asc">Ordre alphabétique</option>
            </select>
          </div>
        </aside>

        {/* ── GRILLE PRODUITS ── */}
        <main style={{ flex: 1, padding: '32px 32px' }}>

          {/* En-tête résultats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#0a0a0a', marginBottom: 4 }}>
                {couleur ? COULEURS.find(c => c.value === couleur)?.label || 'Vins' : 'Notre cave'}
              </h1>
              <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                {loading ? '...' : `${produits.length} référence${produits.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Grille */}
          {loadErr && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, fontSize: 12, color: '#a04444' }}>
              {loadErr}
            </div>
          )}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: '#8a6a3e', fontSize: 24, animation: 'spin 1.5s linear infinite' }}>
              ⟳
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : produits.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '80px 0', color: 'rgba(0,0,0,0.4)' }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>Aucun vin ne correspond à vos critères</p>
              <button onClick={() => { setCouleur(null); setSearch(''); setPrixMax(null); setBioOnly(false); setVeganOnly(false); setNaturelOnly(false); setBiodynamiqueOnly(false); setCasherOnly(false); setRegionId(''); setAppellationId('') }} style={{ fontSize: 12, color: '#8a6a3e', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', padding: '8px 16px', borderRadius: 3, cursor: 'pointer' }}>
                Effacer les filtres
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {produits.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer style={{ padding: '32px 40px', borderTop: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#8a6a3e', letterSpacing: 3, textTransform: 'uppercase' as const }}>Cave de Gilbert</div>
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>La vente d'alcool aux mineurs est interdite</div>
      </footer>
    </div>
  )
}

// ============================================================
// ProductCard — carte avec quantité + ajout au panier directs
// ============================================================
function ProductCard({ product: p }: { product: any }) {
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { addItem, updateQuantite, items, openCart } = useCart()
  const { isPro } = useAuth()
  const accent = COULEUR_ACCENT[p.couleur] || '#8a6a3e'
  const disponible = p.stock_total > 0
  // Prix affiché : pro voit prix_vente_pro en HT, particulier voit prix_vente_ttc TTC
  const prixAffiche = isPro && p.prix_vente_pro != null ? p.prix_vente_pro : p.prix_vente_ttc
  const labelPrix = isPro ? 'HT' : 'TTC'

  const handleAdd = () => {
    if (!disponible) return
    // Ajout via cart context (1 par 1 puis ajustement) pour respecter la limite de stock
    const existing = items.find((i: any) => i.id === p.id)
    if (existing) {
      updateQuantite(p.id, Math.min(existing.quantite + qty, p.stock_total))
    } else {
      addItem({
        id: p.id, nom: p.nom, millesime: p.millesime, couleur: p.couleur,
        prix_unitaire_ttc: prixAffiche, stock_total: p.stock_total,
        image_url: p.image_url, slug: p.slug,
      })
      if (qty > 1) {
        // Ajuster à la quantité demandée
        setTimeout(() => updateQuantite(p.id, Math.min(qty, p.stock_total)), 50)
      }
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
    openCart()
  }

  return (
    <div style={{
      background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 6,
      overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, height: '100%',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Corps : bouteille à gauche + infos à droite */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, padding: '18px', flex: 1 }}>
        <a href={`/boutique/${p.slug}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p.image_url ? (
            <img src={p.image_url} alt={p.nom} style={{ maxHeight: 240, maxWidth: '100%', objectFit: 'contain' as const }} />
          ) : (
            <div style={{ fontSize: 64, opacity: 0.15, color: accent }}>🍷</div>
          )}
        </a>

        <div style={{ display: 'flex', flexDirection: 'column' as const, minWidth: 0 }}>
          <a href={`/boutique/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              fontSize: 9, letterSpacing: 2, color: accent, textTransform: 'uppercase' as const,
              marginBottom: 6, fontWeight: 600,
            }}>
              {p.appellation || p.region || COULEUR_LABEL_LONG[p.couleur] || p.couleur}
            </div>
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 16, color: '#0a0a0a', lineHeight: 1.3, marginBottom: 4,
              display: '-webkit-box' as const, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' as const,
            }}>
              {p.nom}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 8 }}>
              {p.domaine || ''}
              {p.millesime ? ` · ${p.millesime}` : ''}
              {p.alcool ? ` · ${p.alcool}% vol` : ''}
            </div>
            {p.description_courte && (
              <p style={{
                fontSize: 12, color: 'rgba(0,0,0,0.7)', lineHeight: 1.5, marginBottom: 10,
                display: '-webkit-box' as const, WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' as const,
              }}>
                {p.description_courte}
              </p>
            )}
          </a>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginTop: 'auto' as const }}>
            {p.bio && (
              <span style={{ fontSize: 9, color: '#2a8a2a', background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', padding: '3px 7px', borderRadius: 2, letterSpacing: 0.5, fontWeight: 600 }}>🌿 BIO</span>
            )}
            {p.stock_statut === 'limite' && (
              <span style={{ fontSize: 9, color: '#8a6a3e', background: 'rgba(201,176,110,0.1)', border: '0.5px solid rgba(201,176,110,0.3)', padding: '3px 7px', borderRadius: 2, letterSpacing: 0.5, fontWeight: 600 }}>⚡ DERNIÈRES BOUTEILLES</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer : prix + quantité + bouton ajouter */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderTop: '0.5px solid rgba(0,0,0,0.08)', background: '#fbfaf6',
        gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: accent, lineHeight: 1 }}>
            {prixAffiche?.toFixed(2)}€
            <span style={{ fontSize: 10, fontFamily: "'DM Sans', system-ui, sans-serif", color: 'rgba(0,0,0,0.4)', marginLeft: 4 }}>{labelPrix}</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>
            {isPro ? `Tarif pro · ${p.stock_total} dispo` : (p.stock_total === 0 ? 'Rupture' : p.stock_total < 5 ? 'Dernières bouteilles' : 'En stock')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {disponible && (
            <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 3, overflow: 'hidden' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.6)', width: 28, height: 36, cursor: 'pointer', fontSize: 16 }}>−</button>
              <span style={{ width: 24, textAlign: 'center' as const, fontSize: 13 }}>{qty}</span>
              <button onClick={() => setQty(q => Math.min(p.stock_total, q + 1))} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.6)', width: 28, height: 36, cursor: 'pointer', fontSize: 16 }}>+</button>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={!disponible}
            style={{
              background: !disponible ? '#ccc' : added ? '#2a8a2a' : accent,
              color: '#fff', border: 'none', padding: '9px 18px', fontSize: 12, letterSpacing: 1,
              textTransform: 'uppercase' as const, cursor: disponible ? 'pointer' : 'not-allowed',
              fontWeight: 600, borderRadius: 3, transition: 'background 0.2s', whiteSpace: 'nowrap' as const,
            }}>
            {!disponible ? 'Rupture' : added ? '✓ Ajouté' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

const COULEUR_LABEL_LONG: Record<string, string> = {
  rouge: 'Vin Rouge', blanc: 'Vin Blanc', rosé: 'Vin Rosé',
  champagne: 'Champagne', effervescent: 'Effervescent', spiritueux: 'Spiritueux', autre: 'Autre',
}
