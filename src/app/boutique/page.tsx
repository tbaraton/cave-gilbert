'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

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
  { value: 'champagne',  label: 'Champagnes',   color: '#c9b06e' },
  { value: 'spiritueux', label: 'Spiritueux',   color: '#6e8b6e' },
]

const COULEUR_ACCENT: Record<string, string> = {
  rouge: '#8b2020', blanc: '#b8a96a', rosé: '#c97b7b',
  champagne: '#c9b06e', effervescent: '#c9b06e',
  spiritueux: '#6e8b6e', autre: '#888',
}

export default function BoutiquePage() {
  const [produits, setProduits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [couleur, setCouleur] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('mis_en_avant')
  const [prixMax, setPrixMax] = useState<number | null>(null)
  const [bioOnly, setBioOnly] = useState(false)
  const [stockOnly, setStockOnly] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ID_MARCY = 'ee3afa96-0c45-407f-87fc-e503fbada6c4'
      const ID_ENTREPOT = 'e12d7e47-23dc-4011-95fc-e9e975fc4307'
      const ID_ARBRESLE = '3097e864-f452-4c2e-9af3-21e26f0330b7'

      // 1) Catalogue direct sur products (sans passer par la vue qui filtre trop)
      let query = supabase
        .from('products')
        .select('id, nom, millesime, couleur, prix_vente_ttc, image_url, slug, bio, ia_generated, description_courte, mis_en_avant, domaine:domaines(nom), appellation:appellations(nom), region:regions(nom), tasting_notes(aromes, accords)')
        .eq('actif', true)
        .eq('visible_boutique', true)
      if (couleur) query = query.eq('couleur', couleur)
      if (bioOnly) query = query.eq('bio', true)
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
      if (errCat) { console.error('[boutique] catalog error', errCat); setProduits([]); setLoading(false); return }
      const ids = (catalog || []).map((p: any) => p.id)
      if (ids.length === 0) { setProduits([]); setLoading(false); return }

      // 2) Fetch stock des 3 sites (entrepôt = livraison, Marcy/Arbresle = retrait 2h)
      const { data: allStock } = await supabase
        .from('stock')
        .select('product_id, site_id, quantite')
        .in('site_id', [ID_MARCY, ID_ENTREPOT, ID_ARBRESLE])
        .in('product_id', ids)
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
      setLoading(false)
    }
    load()
  }, [couleur, bioOnly, stockOnly, prixMax, search, sortBy])

  return (
    <div style={{ background: '#0d0a08', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>

      {/* Nav */}
      <nav style={{ padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(255,255,255,0.06)', position: 'sticky' as const, top: 0, background: '#0d0a08', zIndex: 50 }}>
        <a href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#c9a96e', letterSpacing: 4, textTransform: 'uppercase' as const, textDecoration: 'none', fontWeight: 300 }}>Cave de Gilbert</a>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Rechercher un vin..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#e8e0d5', fontSize: 12, padding: '8px 14px', width: 220 }}
          />
        </div>
        <a href="/panier" style={{ fontSize: 11, color: '#c9a96e', textDecoration: 'none', letterSpacing: 1.5, border: '0.5px solid rgba(201,169,110,0.4)', padding: '8px 16px', borderRadius: 2 }}>Panier</a>
      </nav>

      <div style={{ display: 'flex', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── SIDEBAR FILTRES ── */}
        <aside style={{ width: 220, padding: '32px 24px', borderRight: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'sticky' as const, top: 53, alignSelf: 'start', height: 'calc(100vh - 53px)', overflowY: 'auto' as const }}>

          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 20 }}>Filtres</div>

          {/* Couleur */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Type</div>
            <button onClick={() => setCouleur(null)} style={{
              display: 'block', width: '100%', textAlign: 'left' as const, background: 'transparent',
              border: 'none', color: !couleur ? '#c9a96e' : 'rgba(232,224,213,0.45)',
              fontSize: 12, padding: '6px 0', cursor: 'pointer', letterSpacing: 0.5,
            }}>Tous les vins</button>
            {COULEURS.map(c => (
              <button key={c.value} onClick={() => setCouleur(couleur === c.value ? null : c.value)} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' as const,
                background: 'transparent', border: 'none',
                color: couleur === c.value ? c.color : 'rgba(232,224,213,0.45)',
                fontSize: 12, padding: '6px 0', cursor: 'pointer',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, display: 'inline-block', opacity: couleur === c.value ? 1 : 0.4 }} />
                {c.label}
              </button>
            ))}
          </div>

          {/* Prix */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 12 }}>
              Prix max {prixMax ? `— ${prixMax}€` : ''}
            </div>
            <input type="range" min={0} max={500} step={10} value={prixMax || 500}
              onChange={e => setPrixMax(parseInt(e.target.value) < 500 ? parseInt(e.target.value) : null)}
              style={{ width: '100%', accentColor: '#c9a96e' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(232,224,213,0.25)', marginTop: 4 }}>
              <span>0€</span><span>500€+</span>
            </div>
          </div>

          {/* Options */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Options</div>
            {[
              { label: 'En stock uniquement', state: stockOnly, toggle: () => setStockOnly(v => !v) },
              { label: 'Agriculture biologique', state: bioOnly, toggle: () => setBioOnly(v => !v) },
            ].map(({ label, state, toggle }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                <div onClick={toggle} style={{
                  width: 14, height: 14, borderRadius: 2,
                  border: `0.5px solid ${state ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`,
                  background: state ? '#c9a96e' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}>
                  {state && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.5)', cursor: 'pointer' }} onClick={toggle}>{label}</span>
              </label>
            ))}
          </div>

          {/* Tri */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Trier par</div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 3, color: '#e8e0d5', fontSize: 11, padding: '8px 10px',
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
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>
                {couleur ? COULEURS.find(c => c.value === couleur)?.label || 'Vins' : 'Notre cave'}
              </h1>
              <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>
                {loading ? '...' : `${produits.length} référence${produits.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Grille */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: '#c9a96e', fontSize: 24, animation: 'spin 1.5s linear infinite' }}>
              ⟳
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : produits.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '80px 0', color: 'rgba(232,224,213,0.3)' }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>Aucun vin ne correspond à vos critères</p>
              <button onClick={() => { setCouleur(null); setSearch(''); setPrixMax(null); setBioOnly(false) }} style={{ fontSize: 12, color: '#c9a96e', background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', padding: '8px 16px', borderRadius: 3, cursor: 'pointer' }}>
                Effacer les filtres
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {produits.map(p => (
                <a key={p.id} href={`/boutique/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    background: '#18130e', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 6,
                    overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {/* Image / Placeholder */}
                    <div style={{ height: 200, background: '#100d0a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.nom} style={{ maxHeight: 180, maxWidth: '80%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ fontSize: 48, opacity: 0.15, color: COULEUR_ACCENT[p.couleur] || '#c9a96e' }}>🍷</div>
                      )}
                      {/* Badge stock */}
                      {p.stock_statut === 'alerte' && (
                        <div style={{ position: 'absolute' as const, top: 10, right: 10, fontSize: 9, color: '#c9b06e', background: 'rgba(201,176,110,0.1)', border: '0.5px solid rgba(201,176,110,0.3)', padding: '3px 7px', borderRadius: 2, letterSpacing: 1 }}>
                          DERNIÈRES BOUTEILLES
                        </div>
                      )}
                      {p.bio && (
                        <div style={{ position: 'absolute' as const, top: 10, left: 10, fontSize: 9, color: '#6ec96e', background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', padding: '3px 7px', borderRadius: 2 }}>
                          BIO
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: 9, letterSpacing: 2, color: COULEUR_ACCENT[p.couleur] || '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 6 }}>
                        {p.appellation || p.region || ''}
                      </div>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#f0e8d8', lineHeight: 1.3, marginBottom: 4 }}>
                        {p.nom}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 12 }}>
                        {p.domaine}{p.millesime ? ` · ${p.millesime}` : ''}
                      </div>

                      {/* Arômes (2 max) */}
                      {p.aromes?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' as const }}>
                          {p.aromes.slice(0, 2).map((a: string) => (
                            <span key={a} style={{ fontSize: 9, color: 'rgba(232,224,213,0.35)', border: '0.5px solid rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 2 }}>{a}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#c9a96e' }}>
                          {p.prix_vente_ttc?.toFixed(2)}€
                        </span>
                        <span style={{ fontSize: 10, color: '#c9a96e', background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.2)', padding: '5px 10px', borderRadius: 2, letterSpacing: 1 }}>
                          Voir →
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer style={{ padding: '32px 40px', borderTop: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const }}>Cave de Gilbert</div>
        <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.25)' }}>La vente d'alcool aux mineurs est interdite</div>
      </footer>
    </div>
  )
}
