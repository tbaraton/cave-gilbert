'use client'

// ============================================================
// /admin/eboutique — code partagé entre les sous-pages
// (BadgesTab, CarrouselTab, styles, helpers)
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Macaron } from '@/app/components/Macaron'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ============================================================
// BADGES & MACARONS
// ============================================================
export function BadgesTab() {
  const [badges, setBadges] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [assocs, setAssocs] = useState<{ product_id: string; badge_id: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const [{ data: b, error: eb }, { data: p, error: ep }, { data: a, error: ea }] = await Promise.all([
        supabase.from('boutique_badges').select('*').order('ordre').order('nom'),
        supabase.from('products').select('id, nom, millesime, slug, image_url').eq('actif', true).order('nom').limit(2000),
        supabase.from('product_badges').select('product_id, badge_id'),
      ])
      if (eb) { setErr(`Badges : ${eb.message}`); return }
      if (ep) { setErr(`Produits : ${ep.message}`); return }
      if (ea) { setErr(`Associations : ${ea.message}`); return }
      setBadges(b || []); setProducts(p || []); setAssocs(a || [])
    } catch (e: any) { setErr(e?.message || String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (badge: any) => {
    const isNew = !badge.id
    const payload: any = {
      nom: badge.nom?.trim(),
      slug: (badge.slug?.trim() || slugify(badge.nom)).toLowerCase(),
      mode: badge.mode || 'genere',
      image_url: badge.mode === 'image' ? (badge.image_url || null) : null,
      icone: badge.mode === 'genere' ? (badge.icone || null) : null,
      texte_macaron: badge.mode === 'genere' ? (badge.texte_macaron?.trim() || null) : null,
      couleur_bg: badge.couleur_bg || '#8a6a3e',
      couleur_fg: badge.couleur_fg || '#ffffff',
      couleur_border: badge.couleur_border || null,
      description: badge.description?.trim() || '',
      ordre: badge.ordre ?? 0,
      actif: badge.actif ?? true,
      updated_at: new Date().toISOString(),
    }
    if (!payload.nom) { alert('Le nom est obligatoire'); return }
    if (!payload.description) { alert('La description (tooltip) est obligatoire'); return }
    const res = isNew
      ? await supabase.from('boutique_badges').insert(payload).select().single()
      : await supabase.from('boutique_badges').update(payload).eq('id', badge.id).select().single()
    if (res.error) { alert(`Erreur : ${res.error.message}`); return }
    setEditing(null); setShowCreate(false); load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce badge ? Il sera retiré de tous les produits.')) return
    const { error } = await supabase.from('boutique_badges').delete().eq('id', id)
    if (error) { alert(`Erreur : ${error.message}`); return }
    load()
  }

  const handleToggleAssoc = async (productId: string, badgeId: string) => {
    const exists = assocs.some(a => a.product_id === productId && a.badge_id === badgeId)
    if (exists) {
      const { error } = await supabase.from('product_badges').delete().eq('product_id', productId).eq('badge_id', badgeId)
      if (error) { alert(`Erreur : ${error.message}`); return }
      setAssocs(assocs.filter(a => !(a.product_id === productId && a.badge_id === badgeId)))
    } else {
      const { error } = await supabase.from('product_badges').insert({ product_id: productId, badge_id: badgeId })
      if (error) { alert(`Erreur : ${error.message}`); return }
      setAssocs([...assocs, { product_id: productId, badge_id: badgeId }])
    }
  }

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50)
    const s = search.toLowerCase()
    return products.filter(p => p.nom?.toLowerCase().includes(s) || String(p.millesime || '').includes(s)).slice(0, 50)
  }, [products, search])

  if (loading) return <div style={empty}>⟳ Chargement…</div>

  return (
    <div>
      {err && <div style={errBox}>{err}</div>}

      <section style={card}>
        <div style={cardHeader}>
          <h2 style={cardTitle}>Mes badges ({badges.length})</h2>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Nouveau badge</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, padding: 16 }}>
          {badges.map(b => {
            const nbAssocs = assocs.filter(a => a.badge_id === b.id).length
            return (
              <div key={b.id} style={{ background: '#0d0a08', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: 14, opacity: b.actif ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <Macaron badge={b} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8', fontWeight: 600, marginBottom: 2 }}>{b.nom}</div>
                    <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.45)' }}>{nbAssocs} produit{nbAssocs > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.5)', marginBottom: 10, lineHeight: 1.4, minHeight: 30 }}>{b.description}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setEditing(b)} style={btnGhostSmall}>Éditer</button>
                  <button onClick={() => handleDelete(b.id)} style={btnDangerSmall}>×</button>
                </div>
              </div>
            )
          })}
          {badges.length === 0 && <div style={{ gridColumn: '1/-1', padding: 30, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', fontSize: 12 }}>Aucun badge. Crée le premier.</div>}
        </div>
      </section>

      <section style={{ ...card, marginTop: 24 }}>
        <div style={cardHeader}>
          <h2 style={cardTitle}>Attribuer les badges aux produits</h2>
          <input type="text" placeholder="🔍 Filtrer un produit…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...input, width: 260, padding: '8px 12px', fontSize: 12 }} />
        </div>
        <div style={{ overflowX: 'auto' as const, padding: '0 16px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                <th style={{ ...th, position: 'sticky' as const, left: 0, background: '#18130e', zIndex: 1, textAlign: 'left' as const }}>Produit</th>
                {badges.filter(b => b.actif).map(b => (
                  <th key={b.id} style={{ ...th, textAlign: 'center' as const, minWidth: 80 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
                      <Macaron badge={b} size={36} />
                      <span style={{ fontSize: 9, color: 'rgba(232,224,213,0.5)' }}>{b.nom.length > 14 ? b.nom.slice(0, 12) + '…' : b.nom}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...td, position: 'sticky' as const, left: 0, background: '#18130e' }}>
                    <a href={`/boutique/${p.slug}`} target="_blank" style={{ color: '#e8e0d5', textDecoration: 'none', fontSize: 12 }}>
                      {p.nom}{p.millesime ? ` (${p.millesime})` : ''}
                    </a>
                  </td>
                  {badges.filter(b => b.actif).map(b => {
                    const checked = assocs.some(a => a.product_id === p.id && a.badge_id === b.id)
                    return (
                      <td key={b.id} style={{ ...td, textAlign: 'center' as const }}>
                        <input type="checkbox" checked={checked} onChange={() => handleToggleAssoc(p.id, b.id)} style={{ accentColor: '#c9a96e', cursor: 'pointer' }} />
                      </td>
                    )
                  })}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr><td colSpan={badges.filter(b => b.actif).length + 1} style={{ padding: 30, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', fontSize: 12 }}>Aucun produit.</td></tr>
              )}
            </tbody>
          </table>
          {products.length > 50 && !search && (
            <div style={{ padding: '12px 0 0', fontSize: 11, color: 'rgba(232,224,213,0.4)', textAlign: 'center' as const }}>
              Affichage limité à 50 produits — utilise la recherche pour filtrer.
            </div>
          )}
        </div>
      </section>

      {(showCreate || editing) && (
        <BadgeEditor badge={editing || { mode: 'genere', actif: true, ordre: (badges.length + 1) }}
          onCancel={() => { setEditing(null); setShowCreate(false) }} onSave={handleSave} />
      )}
    </div>
  )
}

function BadgeEditor({ badge, onCancel, onSave }: { badge: any; onCancel: () => void; onSave: (b: any) => void }) {
  const [b, setB] = useState({ ...badge })
  const [uploading, setUploading] = useState(false)

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const filename = `badges/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('product-images').upload(filename, file, { upsert: false, contentType: file.type })
      if (upErr) { alert(`Upload : ${upErr.message}`); return }
      const { data } = supabase.storage.from('product-images').getPublicUrl(filename)
      setB({ ...b, image_url: data.publicUrl })
    } finally { setUploading(false) }
  }

  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h3 style={modalTitle}>{badge.id ? 'Éditer le badge' : 'Nouveau badge'}</h3>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0', background: '#0d0a08', borderRadius: 6, marginBottom: 18 }}>
          <Macaron badge={b} size={100} />
        </div>
        <Field label="Nom interne *">
          <input type="text" value={b.nom || ''} onChange={e => setB({ ...b, nom: e.target.value })} style={input} placeholder="Ex : Coup de cœur du caviste" />
        </Field>
        <Field label="Tooltip affiché au survol *">
          <textarea value={b.description || ''} onChange={e => setB({ ...b, description: e.target.value })} style={{ ...input, minHeight: 60, resize: 'vertical' as const }} placeholder="Texte affiché quand le client passe la souris sur le macaron." />
        </Field>
        <Field label="Type de macaron">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setB({ ...b, mode: 'genere' })}
              style={{ ...btnGhostSmall, flex: 1, background: b.mode === 'genere' ? 'rgba(201,169,110,0.15)' : 'transparent', color: b.mode === 'genere' ? '#c9a96e' : 'rgba(232,224,213,0.5)' }}>
              Généré (icône + texte)
            </button>
            <button type="button" onClick={() => setB({ ...b, mode: 'image' })}
              style={{ ...btnGhostSmall, flex: 1, background: b.mode === 'image' ? 'rgba(201,169,110,0.15)' : 'transparent', color: b.mode === 'image' ? '#c9a96e' : 'rgba(232,224,213,0.5)' }}>
              Image (PNG/SVG)
            </button>
          </div>
        </Field>
        {b.mode === 'genere' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10 }}>
              <Field label="Icône">
                <input type="text" value={b.icone || ''} onChange={e => setB({ ...b, icone: e.target.value })} style={{ ...input, textAlign: 'center' as const, fontSize: 22 }} placeholder="❤" maxLength={4} />
              </Field>
              <Field label="Texte (court — max 12 caractères)">
                <input type="text" value={b.texte_macaron || ''} onChange={e => setB({ ...b, texte_macaron: e.target.value.toUpperCase() })} style={input} placeholder="COUP DE CŒUR" maxLength={14} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Field label="Fond">
                <input type="color" value={b.couleur_bg || '#8a6a3e'} onChange={e => setB({ ...b, couleur_bg: e.target.value })} style={{ ...input, height: 38, padding: 4 }} />
              </Field>
              <Field label="Texte / icône">
                <input type="color" value={b.couleur_fg || '#ffffff'} onChange={e => setB({ ...b, couleur_fg: e.target.value })} style={{ ...input, height: 38, padding: 4 }} />
              </Field>
              <Field label="Liseré (optionnel)">
                <input type="color" value={b.couleur_border || '#ffffff'} onChange={e => setB({ ...b, couleur_border: e.target.value })} style={{ ...input, height: 38, padding: 4 }} />
              </Field>
            </div>
          </>
        ) : (
          <Field label="Image du macaron (PNG/SVG circulaire recommandé)">
            <input type="file" accept="image/*" onChange={handleUploadImage} style={{ ...input, padding: 8 }} disabled={uploading} />
            {uploading && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.5)', marginTop: 6 }}>⟳ Upload…</div>}
            {b.image_url && <img src={b.image_url} alt="" style={{ marginTop: 10, maxHeight: 100, borderRadius: 4 }} />}
          </Field>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Ordre d'affichage (croissant)">
            <input type="number" value={b.ordre ?? 0} onChange={e => setB({ ...b, ordre: parseInt(e.target.value) || 0 })} style={input} />
          </Field>
          <Field label="Actif">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={b.actif ?? true} onChange={e => setB({ ...b, actif: e.target.checked })} style={{ accentColor: '#c9a96e' }} />
              <span style={{ fontSize: 12 }}>Visible sur la boutique</span>
            </label>
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={btnGhost}>Annuler</button>
          <button onClick={() => onSave(b)} style={btnPrimary}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CARROUSEL D'ACCUEIL
// ============================================================
export function CarrouselTab() {
  const [slides, setSlides] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [slideProducts, setSlideProducts] = useState<{ slide_id: string; product_id: string; ordre: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [managingProducts, setManagingProducts] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const [{ data: s, error: es }, { data: p, error: ep }, { data: sp, error: esp }] = await Promise.all([
        supabase.from('boutique_carousel_slides').select('*').order('ordre').order('created_at'),
        supabase.from('products').select('id, nom, millesime, slug, image_url, couleur').eq('actif', true).order('nom').limit(2000),
        supabase.from('carousel_slide_products').select('slide_id, product_id, ordre'),
      ])
      if (es) { setErr(`Slides : ${es.message}`); return }
      if (ep) { setErr(`Produits : ${ep.message}`); return }
      if (esp) { setErr(`Associations : ${esp.message}`); return }
      setSlides(s || []); setProducts(p || []); setSlideProducts(sp || [])
    } catch (e: any) { setErr(e?.message || String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (slide: any) => {
    const isNew = !slide.id
    const payload: any = {
      titre: slide.titre?.trim(),
      sous_titre: slide.sous_titre?.trim() || null,
      description: slide.description?.trim() || null,
      image_url: slide.image_url || null,
      couleur_bg: slide.couleur_bg || null,
      couleur_texte: slide.couleur_texte || '#ffffff',
      position_texte: slide.position_texte || 'gauche',
      slug: (slide.slug?.trim() || slugify(slide.titre)).toLowerCase(),
      cta_label: slide.cta_label?.trim() || 'Découvrir',
      cta_url_custom: slide.cta_url_custom?.trim() || null,
      ordre: slide.ordre ?? 0,
      actif: slide.actif ?? true,
      date_debut: slide.date_debut || null,
      date_fin: slide.date_fin || null,
      updated_at: new Date().toISOString(),
    }
    if (!payload.titre) { alert('Le titre est obligatoire'); return }
    const res = isNew
      ? await supabase.from('boutique_carousel_slides').insert(payload).select().single()
      : await supabase.from('boutique_carousel_slides').update(payload).eq('id', slide.id).select().single()
    if (res.error) { alert(`Erreur : ${res.error.message}`); return }
    setEditing(null); setShowCreate(false); load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette slide ?')) return
    const { error } = await supabase.from('boutique_carousel_slides').delete().eq('id', id)
    if (error) { alert(`Erreur : ${error.message}`); return }
    load()
  }

  if (loading) return <div style={empty}>⟳ Chargement…</div>

  return (
    <div>
      {err && <div style={errBox}>{err}</div>}

      <section style={card}>
        <div style={cardHeader}>
          <h2 style={cardTitle}>Slides du carrousel ({slides.length})</h2>
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Nouvelle slide</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {slides.map(s => {
            const nbProducts = slideProducts.filter(sp => sp.slide_id === s.id).length
            return (
              <div key={s.id} style={{ background: '#0d0a08', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 4, display: 'flex', overflow: 'hidden', opacity: s.actif ? 1 : 0.5 }}>
                <div style={{ width: 180, height: 100, background: s.couleur_bg || '#1a1a1a', backgroundImage: s.image_url ? `url(${s.image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
                <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#f0e8d8' }}>{s.titre}</div>
                      <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>/{s.slug}</div>
                      {!s.actif && <span style={{ fontSize: 9, color: '#c96e6e', background: 'rgba(201,110,110,0.1)', padding: '2px 6px', borderRadius: 2 }}>INACTIF</span>}
                    </div>
                    {s.sous_titre && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.6)', marginBottom: 4 }}>{s.sous_titre}</div>}
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.45)' }}>{nbProducts} produit{nbProducts > 1 ? 's' : ''} dans l'opération · ordre {s.ordre}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setManagingProducts(s)} style={btnGhostSmall}>Gérer produits ({nbProducts})</button>
                    <button onClick={() => setEditing(s)} style={btnGhostSmall}>Éditer</button>
                    <button onClick={() => handleDelete(s.id)} style={btnDangerSmall}>×</button>
                  </div>
                </div>
              </div>
            )
          })}
          {slides.length === 0 && <div style={{ padding: 30, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', fontSize: 12 }}>Aucune slide.</div>}
        </div>
      </section>

      {(showCreate || editing) && (
        <SlideEditor slide={editing || { actif: true, ordre: slides.length + 1, position_texte: 'gauche', couleur_texte: '#ffffff', cta_label: 'Découvrir' }}
          onCancel={() => { setEditing(null); setShowCreate(false) }} onSave={handleSave} />
      )}

      {managingProducts && (
        <ManageSlideProducts slide={managingProducts} allProducts={products}
          assocs={slideProducts.filter(sp => sp.slide_id === managingProducts.id)}
          onClose={() => { setManagingProducts(null); load() }} />
      )}
    </div>
  )
}

function SlideEditor({ slide, onCancel, onSave }: { slide: any; onCancel: () => void; onSave: (s: any) => void }) {
  const [s, setS] = useState({ ...slide })
  const [uploading, setUploading] = useState(false)

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filename = `carousel/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('product-images').upload(filename, file, { upsert: false, contentType: file.type })
      if (upErr) { alert(`Upload : ${upErr.message}`); return }
      const { data } = supabase.storage.from('product-images').getPublicUrl(filename)
      setS({ ...s, image_url: data.publicUrl })
    } finally { setUploading(false) }
  }

  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div style={{ ...modalBox, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <h3 style={modalTitle}>{slide.id ? 'Éditer la slide' : 'Nouvelle slide'}</h3>
        <SlidePreview slide={s} />
        <Field label="Titre *"><input type="text" value={s.titre || ''} onChange={e => setS({ ...s, titre: e.target.value })} style={input} placeholder="Ex : Opération rosé" /></Field>
        <Field label="Sous-titre (accroche)"><input type="text" value={s.sous_titre || ''} onChange={e => setS({ ...s, sous_titre: e.target.value })} style={input} placeholder="Jusqu'à -30% sur 100 références" /></Field>
        <Field label="Description (optionnel)"><textarea value={s.description || ''} onChange={e => setS({ ...s, description: e.target.value })} style={{ ...input, minHeight: 60, resize: 'vertical' as const }} /></Field>
        <Field label="Image de fond (paysage 1920×600 recommandé)">
          <input type="file" accept="image/*" onChange={handleUploadImage} style={{ ...input, padding: 8 }} disabled={uploading} />
          {uploading && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.5)', marginTop: 6 }}>⟳ Upload…</div>}
          {s.image_url && <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(232,224,213,0.4)', wordBreak: 'break-all' as const }}>{s.image_url}</div>}
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Fond (si pas d'image)"><input type="color" value={s.couleur_bg || '#8a6a3e'} onChange={e => setS({ ...s, couleur_bg: e.target.value })} style={{ ...input, height: 38, padding: 4 }} /></Field>
          <Field label="Couleur du texte"><input type="color" value={s.couleur_texte || '#ffffff'} onChange={e => setS({ ...s, couleur_texte: e.target.value })} style={{ ...input, height: 38, padding: 4 }} /></Field>
          <Field label="Position du texte">
            <select value={s.position_texte || 'gauche'} onChange={e => setS({ ...s, position_texte: e.target.value })} style={input}>
              <option value="gauche">Gauche</option><option value="centre">Centre</option><option value="droite">Droite</option>
            </select>
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Slug (URL)"><input type="text" value={s.slug || ''} onChange={e => setS({ ...s, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} style={input} placeholder="operation-rose" /></Field>
          <Field label="Label du bouton"><input type="text" value={s.cta_label || 'Découvrir'} onChange={e => setS({ ...s, cta_label: e.target.value })} style={input} /></Field>
        </div>
        <Field label="Lien personnalisé (sinon : /boutique?operation=<slug>)"><input type="text" value={s.cta_url_custom || ''} onChange={e => setS({ ...s, cta_url_custom: e.target.value })} style={input} placeholder="/boutique?couleur=rose" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Ordre"><input type="number" value={s.ordre ?? 0} onChange={e => setS({ ...s, ordre: parseInt(e.target.value) || 0 })} style={input} /></Field>
          <Field label="Visible à partir de"><input type="datetime-local" value={s.date_debut?.slice(0, 16) || ''} onChange={e => setS({ ...s, date_debut: e.target.value ? new Date(e.target.value).toISOString() : null })} style={input} /></Field>
          <Field label="Masquée à partir de"><input type="datetime-local" value={s.date_fin?.slice(0, 16) || ''} onChange={e => setS({ ...s, date_fin: e.target.value ? new Date(e.target.value).toISOString() : null })} style={input} /></Field>
        </div>
        <Field label="Actif">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={s.actif ?? true} onChange={e => setS({ ...s, actif: e.target.checked })} style={{ accentColor: '#c9a96e' }} />
            <span style={{ fontSize: 12 }}>Visible sur la page d'accueil</span>
          </label>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={btnGhost}>Annuler</button>
          <button onClick={() => onSave(s)} style={btnPrimary}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

function ManageSlideProducts({ slide, allProducts, assocs, onClose }: {
  slide: any
  allProducts: any[]
  assocs: { product_id: string; ordre: number }[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assocs.map(a => a.product_id)))
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase.from('carousel_slide_products').delete().eq('slide_id', slide.id)
      const toInsert = Array.from(selected).map((pid, idx) => ({ slide_id: slide.id, product_id: pid, ordre: idx }))
      if (toInsert.length > 0) {
        const { error } = await supabase.from('carousel_slide_products').insert(toInsert)
        if (error) { alert(`Erreur : ${error.message}`); return }
      }
      onClose()
    } finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return allProducts.slice(0, 100)
    const s = search.toLowerCase()
    return allProducts.filter(p => p.nom?.toLowerCase().includes(s) || String(p.millesime || '').includes(s)).slice(0, 100)
  }, [allProducts, search])

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <h3 style={modalTitle}>Produits de « {slide.titre} »</h3>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 14 }}>
          Sélectionne les produits qui apparaissent quand un visiteur clique sur cette slide.
          Page de destination : <code style={{ color: '#c9a96e' }}>/boutique?operation={slide.slug}</code>
        </p>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un produit…" style={{ ...input, marginBottom: 12 }} />
        <div style={{ maxHeight: 380, overflowY: 'auto' as const, background: '#0d0a08', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 4 }}>
          {filtered.map(p => {
            const checked = selected.has(p.id)
            return (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked} onChange={() => {
                  const next = new Set(selected)
                  if (checked) next.delete(p.id); else next.add(p.id)
                  setSelected(next)
                }} style={{ accentColor: '#c9a96e' }} />
                {p.image_url && <img src={p.image_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' as const, opacity: 0.85 }} />}
                <span style={{ fontSize: 12, color: '#e8e0d5', flex: 1 }}>{p.nom}{p.millesime ? ` (${p.millesime})` : ''}</span>
              </label>
            )
          })}
          {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', fontSize: 12 }}>Aucun produit.</div>}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>
          {selected.size} produit{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={btnGhost}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>{saving ? '⟳ Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

function SlidePreview({ slide }: { slide: any }) {
  const align = slide.position_texte === 'centre' ? 'center' : slide.position_texte === 'droite' ? 'flex-end' : 'flex-start'
  const textAlign = slide.position_texte === 'centre' ? 'center' : slide.position_texte === 'droite' ? 'right' : 'left'
  return (
    <div style={{
      background: slide.couleur_bg || '#1a1a1a',
      backgroundImage: slide.image_url ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${slide.image_url})` : 'none',
      backgroundSize: 'cover', backgroundPosition: 'center',
      borderRadius: 6, padding: 30, marginBottom: 18, minHeight: 160,
      display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', alignItems: align,
      color: slide.couleur_texte || '#fff', textAlign: textAlign as any,
    }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, marginBottom: 4 }}>{slide.titre || 'Titre de la slide'}</div>
      {slide.sous_titre && <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 6 }}>{slide.sous_titre}</div>}
      {slide.description && <div style={{ fontSize: 12, opacity: 0.75, maxWidth: 400, lineHeight: 1.5 }}>{slide.description}</div>}
      <div style={{ marginTop: 12, padding: '8px 18px', background: 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.3)', borderRadius: 3, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' as const, color: slide.couleur_texte || '#fff' }}>
        {slide.cta_label || 'Découvrir'}
      </div>
    </div>
  )
}

// ============================================================
// Utils + styles (exportés pour les pages)
// ============================================================
export function slugify(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.45)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

export const fullPage: any = { minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.6)', flexDirection: 'column', gap: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }
export const card: any = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }
export const cardHeader: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }
export const cardTitle: any = { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 300, color: '#f0e8d8', margin: 0 }
export const empty: any = { padding: 60, textAlign: 'center', color: 'rgba(232,224,213,0.4)', fontSize: 13 }
export const errBox: any = { marginBottom: 16, padding: '12px 16px', background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, fontSize: 12, color: '#c96e6e' }
export const th: any = { padding: '10px 12px', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', fontWeight: 400, textTransform: 'uppercase' }
export const td: any = { padding: '10px 12px', fontSize: 12, color: '#e8e0d5', verticalAlign: 'middle' }
export const input: any = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const, fontFamily: 'inherit' }
export const btnPrimary: any = { background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 12, letterSpacing: 0.5, fontWeight: 700, cursor: 'pointer' }
export const btnGhost: any = { background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '9px 16px', fontSize: 12, color: 'rgba(232,224,213,0.7)', cursor: 'pointer' }
export const btnGhostSmall: any = { background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 3, padding: '6px 10px', fontSize: 11, color: 'rgba(232,224,213,0.7)', cursor: 'pointer' }
export const btnDangerSmall: any = { background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 3, padding: '6px 10px', fontSize: 11, color: '#c96e6e', cursor: 'pointer' }
export const modalOverlay: any = { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' as const }
export const modalBox: any = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 28, maxWidth: 520, width: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' as const }
export const modalTitle: any = { fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', marginTop: 0, marginBottom: 18 }
