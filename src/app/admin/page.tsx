'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ============================================================
// CAVE DE GILBERT — Interface Admin connectée à Supabase
// src/app/admin/page.tsx
// ============================================================

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Section = 'dashboard' | 'produits' | 'stock' | 'transferts' | 'vins' | 'bieres' | 'spiritueux' | 'epicerie' | 'sans_alcool'

// ── Styles constants ─────────────────────────────────────────

const COULEUR_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  rouge:       { bg: '#7b1e1e', color: '#f5d0d0', label: 'Rouge' },
  blanc:       { bg: '#b8a96a', color: '#1a1408', label: 'Blanc' },
  rosé:        { bg: '#c97b7b', color: '#1a0808', label: 'Rosé' },
  champagne:   { bg: '#c9b06e', color: '#1a0e00', label: 'Champagne' },
  effervescent:{ bg: '#c9b06e', color: '#1a0e00', label: 'Effervescent' },
  spiritueux:  { bg: '#6e8b6e', color: '#0a1a0a', label: 'Spiritueux' },
  autre:       { bg: '#555', color: '#ddd', label: 'Autre' },
}

const STATUT_LOCATION: Record<string, { bg: string; color: string }> = {
  devis:      { bg: '#2a2a1e', color: '#c9b06e' },
  confirmée:  { bg: '#1e2a1e', color: '#6ec96e' },
  en_cours:   { bg: '#1e1e2a', color: '#6e9ec9' },
  terminée:   { bg: '#222',    color: '#888' },
  annulée:    { bg: '#2a1e1e', color: '#c96e6e' },
  litige:     { bg: '#2a1e1e', color: '#c96e6e' },
}

// ── Composants de base ───────────────────────────────────────

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      background: bg, color, fontSize: 10, fontWeight: 500,
      padding: '2px 8px', borderRadius: 3, letterSpacing: 1,
      textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
    }}>{label}</span>
  )
}

function StockDot({ qty, seuil = 3 }: { qty: number; seuil?: number }) {
  const color = qty === 0 ? '#c96e6e' : qty <= seuil ? '#c9b06e' : '#6ec96e'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ color: '#e8e0d5', fontSize: 13 }}>{qty}</span>
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 24, color: '#c9a96e', animation: 'spin 1.5s linear infinite' }}>⟳</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center' as const, padding: '48px 0', color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>
      {message}
    </div>
  )
}

// ── Modal Ajout Produit avec IA ──────────────────────────────

function ModalAjoutProduit({ sites, onClose, onSaved }: {
  sites: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<'form' | 'generating' | 'preview'>('form')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nom: '', domaine: '', appellation: '', millesime: '',
    couleur: 'rouge', prix: '', stock: '', site_id: sites[0]?.id || '',
  })
  const [preview, setPreview] = useState<any>(null)

  const handleGenerate = async () => {
    if (!form.nom || !form.prix) { setError('Le nom et le prix sont obligatoires'); return }
    setError('')
    setStep('generating')
    try {
      const res = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom, domaine_nom: form.domaine || undefined,
          appellation_nom: form.appellation || undefined,
          millesime: form.millesime ? parseInt(form.millesime) : undefined,
          couleur: form.couleur, prix_vente_ttc: parseFloat(form.prix),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur API')
      setPreview(data)
      setStep('preview')
    } catch (e: any) {
      setError(e.message)
      setStep('form')
    }
  }

  const handleSave = async () => {
    if (!preview) return
    try {
      // Activer le produit et l'enregistrer
      const { error } = await supabase
        .from('products')
        .update({ actif: true })
        .eq('id', preview.product?.id)
      if (error) throw error

      // Si stock initial saisi, faire un mouvement d'achat
      if (form.stock && parseInt(form.stock) > 0 && form.site_id && preview.product?.id) {
        await fetch('/api/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: preview.product.id,
            site_id: form.site_id,
            raison: 'achat',
            quantite: parseInt(form.stock),
            note: 'Stock initial',
          }),
        })
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div style={{
      position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)',
        borderRadius: 8, width: 580, maxHeight: '88vh', overflowY: 'auto' as const,
        padding: '28px 32px',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 4 }}>Nouveau produit</div>
            <h2 style={{ fontSize: 20, color: '#f0e8d8', margin: 0, fontFamily: 'Georgia, serif', fontWeight: 300 }}>Ajouter un vin</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>
            {error}
          </div>
        )}

        {step === 'form' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[
                { label: 'Nom du vin *', key: 'nom', placeholder: 'Ex: Puligny-Montrachet' },
                { label: 'Domaine / Château', key: 'domaine', placeholder: 'Ex: Domaine Leflaive' },
                { label: 'Appellation', key: 'appellation', placeholder: 'Ex: Bourgogne AOC' },
                { label: 'Millésime', key: 'millesime', placeholder: 'Ex: 2019' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>{label}</label>
                  <input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Couleur *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                {Object.entries(COULEUR_STYLE).map(([key, { label, bg, color }]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, couleur: key }))} style={{
                    background: form.couleur === key ? bg : 'rgba(255,255,255,0.04)',
                    color: form.couleur === key ? color : 'rgba(232,224,213,0.5)',
                    border: form.couleur === key ? `1px solid ${bg}` : '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: 4, padding: '7px 12px', fontSize: 11, cursor: 'pointer',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Prix TTC (€) *', key: 'prix', placeholder: '0.00', type: 'number' },
                { label: 'Stock initial', key: 'stock', placeholder: '0', type: 'number' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>{label}</label>
                  <input type={type} placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Site</label>
                <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }}>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
            </div>

            <button onClick={handleGenerate} disabled={!form.nom || !form.prix} style={{
              width: '100%', background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
              padding: '13px 20px', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const,
              cursor: (form.nom && form.prix) ? 'pointer' : 'not-allowed',
              opacity: (form.nom && form.prix) ? 1 : 0.5, fontWeight: 500,
            }}>✦ Générer la fiche par IA (Claude)</button>
            <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, marginTop: 10 }}>Gratuit · Description, arômes, accords et profil générés automatiquement</p>
          </>
        )}

        {step === 'generating' && (
          <div style={{ textAlign: 'center' as const, padding: '48px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 16, animation: 'spin 2s linear infinite' }}>⟳</div>
            <p style={{ color: '#c9a96e', letterSpacing: 1 }}>Claude analyse le vin...</p>
            <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 12, marginTop: 8 }}>Description · Arômes · Accords · Profil gustatif</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === 'preview' && preview && (
          <>
            <div style={{ background: 'rgba(83,74,183,0.1)', border: '0.5px solid rgba(83,74,183,0.25)', borderRadius: 4, padding: '8px 14px', marginBottom: 20 }}>
              <span style={{ fontSize: 10, color: 'rgba(175,169,236,0.8)', letterSpacing: 1.5, textTransform: 'uppercase' as const }}>✦ Fiche générée — vérifiez avant de publier</span>
            </div>

            {preview.product && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Description courte</label>
                  <p style={{ color: '#e8e0d5', fontSize: 13, margin: 0, fontStyle: 'italic' }}>{preview.product.description_courte}</p>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Description longue</label>
                  <p style={{ color: 'rgba(232,224,213,0.6)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>{preview.product.description_longue}</p>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep('form')} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '12px', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer', textTransform: 'uppercase' as const }}>Modifier</button>
              <button onClick={handleSave} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '12px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>✓ Publier le produit</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Modal Mouvement de stock ─────────────────────────────────

function ModalMouvement({ produits, sites, onClose, onSaved }: {
  produits: any[], sites: any[], onClose: () => void, onSaved: () => void
}) {
  const [form, setForm] = useState({ product_id: '', site_id: sites[0]?.id || '', raison: 'achat', quantite: '', note: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.product_id || !form.quantite) { setError('Produit et quantité obligatoires'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantite: parseInt(form.quantite) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: 480, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, color: '#f0e8d8', margin: 0, fontFamily: 'Georgia, serif', fontWeight: 300 }}>Mouvement de stock</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Produit *', el: (
              <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px' }}>
                <option value="">Choisir...</option>
                {produits.map(p => <option key={p.id} value={p.id}>{p.nom}{p.millesime ? ` ${p.millesime}` : ''}</option>)}
              </select>
            )},
            { label: 'Site *', el: (
              <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px' }}>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            )},
            { label: 'Raison *', el: (
              <select value={form.raison} onChange={e => setForm(f => ({ ...f, raison: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px' }}>
                <option value="achat">Achat fournisseur (+)</option>
                <option value="retour">Retour client (+)</option>
                <option value="ajustement">Ajustement inventaire (+/-)</option>
                <option value="casse">Casse (-)</option>
                <option value="dégustation">Dégustation (-)</option>
              </select>
            )},
            { label: 'Quantité *', el: (
              <input type="number" min="1" placeholder="Ex: 6" value={form.quantite}
                onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }} />
            )},
            { label: 'Note', el: (
              <input placeholder="Optionnel — ex: Livraison fournisseur Martin" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }} />
            )},
          ].map(({ label, el }) => (
            <div key={label}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>{label}</label>
              {el}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Enregistrement...' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Helpers couleur ──────────────────────────────────────────

const COULEUR_COLOR: Record<string, string> = {
  rouge: '#e07070',
  blanc: '#c9b06e',
  rosé: '#e8a0b0',
  champagne: '#c0c0d8',
  effervescent: '#c0c0d8',
  spiritueux: '#8ec98e',
  autre: '#888888',
}

function arrondir50(prix: number): number {
  return Math.ceil(prix * 2) / 2
}

// ── Select appellations groupé AOC / IGP ─────────────────────
function AppellationSelect({ value, onChange, appellations, style, defaultLabel = '— Choisir —' }: {
  value: string
  onChange: (id: string, nom: string) => void
  appellations: any[]
  style?: React.CSSProperties
  defaultLabel?: string
}) {
  const aoc = appellations.filter(a => !a.type || a.type === 'AOC')
  const igp = appellations.filter(a => a.type === 'IGP')
  return (
    <select value={value} onChange={e => {
      const app = appellations.find(a => a.id === e.target.value)
      onChange(e.target.value, app?.nom || '')
    }} style={style}>
      <option value="">{defaultLabel}</option>
      {aoc.length > 0 && (
        <optgroup label="── AOC / AOP ──">
          {aoc.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </optgroup>
      )}
      {igp.length > 0 && (
        <optgroup label="── IGP ──">
          {igp.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </optgroup>
      )}
    </select>
  )
}

// Prévisualisation du nom du vin
function NomVinPreview({ appellation, cuvee, couleur, millesime, contenance, domaine }: {
  appellation: string, cuvee: string, couleur: string,
  millesime: string, contenance: string, domaine: string
}) {
  if (!appellation && !domaine) return null
  const couleurColor = COULEUR_COLOR[couleur] || '#888'
  const couleurLabel = couleur.charAt(0).toUpperCase() + couleur.slice(1)
  
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Aperçu du nom</div>
      <div style={{ fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif' }}>
        {appellation}
        {cuvee && <span style={{ fontStyle: 'italic', color: 'rgba(232,224,213,0.7)' }}> {cuvee}</span>}
        {couleur && <span style={{ color: couleurColor, fontWeight: 500 }}> {couleurLabel}</span>}
        {millesime && <span style={{ color: 'rgba(232,224,213,0.6)' }}> {millesime}</span>}
        {contenance && <span style={{ color: 'rgba(232,224,213,0.4)', fontSize: 12 }}> {contenance}</span>}
        {domaine && <span style={{ color: 'rgba(232,224,213,0.5)', fontSize: 13 }}> — {domaine}</span>}
      </div>
    </div>
  )
}

// ── Modal Édition Produit ────────────────────────────────────

function ModalEditProduit({ produit, regions: regionsProp, appellations: appellationsProp, onClose, onSaved }: {
  produit: any
  regions: any[]
  appellations: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const [regions, setRegions] = useState<any[]>(regionsProp || [])
  const [appellations, setAppellations] = useState<any[]>(appellationsProp || [])
  const [domaines, setDomaines] = useState<any[]>([])

  useEffect(() => {
    const loadAll = async () => {
      let regs = regionsProp || []
      let apps = appellationsProp || []
      if (regs.length === 0) {
        const { data } = await supabase.from('regions').select('id, nom').order('nom')
        regs = data || []; setRegions(regs)
      }
      if (apps.length === 0) {
        const { data } = await supabase.from('appellations').select('id, nom, region_id, type').order('nom')
        apps = data || []; setAppellations(apps)
      }
      const { data: doms } = await supabase.from('domaines').select('id, nom').order('nom')
      setDomaines(doms || [])
      const appNom = apps.find((a: any) => a.id === produit.appellation_id)?.nom || ''
      setForm(f => ({ ...f, appellation_nom: appNom }))
    }
    loadAll()
  }, [])

  const [form, setForm] = useState({
    nomSurcharge: produit.nom || '',
    appellation_nom: '',
    nom_cuvee: produit.nom_cuvee || '',
    domaine_id: produit.domaine_id || '',
    contenance: produit.contenance || '75cl',
    millesime: produit.millesime?.toString() || '',
    couleur: produit.couleur || 'rouge',
    region_id: produit.region_id || '',
    appellation_id: produit.appellation_id || '',
    prix_achat_ht: produit.prix_achat_ht?.toString() || '',
    coeff_particulier: '2',
    prix_vente_ttc: produit.prix_vente_ttc?.toString() || '',
    coeff_pro: '1.70',
    prix_vente_pro: produit.prix_vente_pro?.toString() || '',
    description_courte: produit.description_courte || '',
    image_url: produit.image_url || '',
    bio: produit.bio || false,
    vegan: produit.vegan || false,
    casher: produit.casher || false,
    naturel: produit.naturel || false,
    biodynamique: produit.biodynamique || false,
    actif: produit.actif !== false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const appsFiltrees = form.region_id
    ? appellations.filter((a: any) => a.region_id === form.region_id)
    : appellations

  // Calcul du nom automatique
  const buildNom = () => {
    const parts = []
    if (form.appellation_nom) parts.push(form.appellation_nom)
    if (form.nom_cuvee) parts.push(form.nom_cuvee)
    if (form.couleur) parts.push(form.couleur.charAt(0).toUpperCase() + form.couleur.slice(1))
    if (form.millesime) parts.push(form.millesime)
    if (form.contenance) parts.push(form.contenance)
    let nom = parts.join(' ')
    const domaineNom = domaines.find(d => d.id === form.domaine_id)?.nom || ''
    if (domaineNom) nom += ' - ' + domaineNom
    return nom
  }

  const handleHTChange = (ht: string) => {
    const htNum = parseFloat(ht)
    setForm(f => ({
      ...f,
      prix_achat_ht: ht,
      prix_vente_ttc: !isNaN(htNum) && htNum > 0 ? arrondir50(htNum * parseFloat(f.coeff_particulier)).toFixed(2) : f.prix_vente_ttc,
      prix_vente_pro: !isNaN(htNum) && htNum > 0 ? (htNum * parseFloat(f.coeff_pro)).toFixed(2) : f.prix_vente_pro,
    }))
  }

  const handleSave = async () => {
    const nomFinal = form.nomSurcharge.trim() || buildNom()
    if (!nomFinal.trim()) { setError("Remplissez au moins l'appellation"); return }
    if (!form.prix_vente_ttc) { setError('Le prix TTC est obligatoire'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('products').update({
      nom: nomFinal,
      nom_cuvee: form.nom_cuvee || null,
      contenance: form.contenance || '75cl',
      millesime: form.millesime ? parseInt(form.millesime) : null,
      couleur: form.couleur,
      region_id: form.region_id || null,
      appellation_id: form.appellation_id || null,
      domaine_id: form.domaine_id || null,
      prix_vente_ttc: parseFloat(form.prix_vente_ttc),
      prix_vente_pro: form.prix_vente_pro ? parseFloat(form.prix_vente_pro) : null,
      prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
      description_courte: form.description_courte || null,
      image_url: form.image_url || null,
      bio: form.bio,
      vegan: form.vegan,
      casher: form.casher,
      naturel: form.naturel,
      biodynamique: form.biodynamique,
      actif: form.actif,
    }).eq('id', produit.id)
    if (err) { setError(err.message); setSaving(false); return }
    // Mettre à jour product_suppliers si domaine sélectionné
    if (form.domaine_id) {
      await supabase.from('product_suppliers').upsert({
        product_id: produit.id,
        domaine_id: form.domaine_id,
        prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
        conditionnement: 6,
        fournisseur_principal: true,
      }, { onConflict: 'product_id,domaine_id' })
    }
    onSaved()
    onClose()
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }
  const sel = { ...inp, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', cursor: 'pointer' }
  const CERTIFS = [
    { key: 'bio', label: '🌿 Bio' }, { key: 'vegan', label: '🌱 Vegan' },
    { key: 'casher', label: '✡ Casher' }, { key: 'naturel', label: '🍃 Naturel' },
    { key: 'biodynamique', label: '🌙 Biodynamique' },
  ]

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 700, padding: '28px 32px', maxHeight: '92vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Modifier le produit</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const }}>Nom du produit</div>
            <button onClick={() => setForm(f => ({ ...f, nomSurcharge: buildNom() }))} style={{ background: 'transparent', border: 'none', color: 'rgba(201,169,110,0.5)', fontSize: 10, cursor: 'pointer', padding: 0 }}>↺ Regénérer</button>
          </div>
          <input
            value={form.nomSurcharge}
            onChange={e => setForm(f => ({ ...f, nomSurcharge: e.target.value }))}
            placeholder="Nom du produit..."
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(201,169,110,0.4)', color: '#f0e8d8', fontSize: 15, fontFamily: 'Georgia, serif', padding: '4px 0', outline: 'none', boxSizing: 'border-box' as const }}
          />
        </div>

        {/* Identité */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Identité</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Région viticole</label>
            <select value={form.region_id} onChange={e => setForm(f => ({ ...f, region_id: e.target.value, appellation_id: '', appellation_nom: '' }))} style={sel}>
              <option value="" style={{ background: '#1a1408', color: '#888' }}>— Choisir —</option>
              {regions.map(r => <option key={r.id} value={r.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{r.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Appellation *</label>
            <select value={form.appellation_id} onChange={e => {
              const app = appsFiltrees.find(a => a.id === e.target.value)
              setForm(f => ({ ...f, appellation_id: e.target.value, appellation_nom: app?.nom || '' }))
            }} style={sel}>
              <option value="" style={{ background: '#1a1408', color: '#888' }}>— Choisir —</option>
              {appsFiltrees.filter(a => !a.type || a.type === 'AOC').length > 0 && <optgroup label="── AOC / AOP ──">{appsFiltrees.filter(a => !a.type || a.type === 'AOC').map(a => <option key={a.id} value={a.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{a.nom}</option>)}</optgroup>}
              {appsFiltrees.filter(a => a.type === 'IGP').length > 0 && <optgroup label="── IGP ──">{appsFiltrees.filter(a => a.type === 'IGP').map(a => <option key={a.id} value={a.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{a.nom}</option>)}</optgroup>}
            </select>
          </div>
          <div>
            <label style={lbl}>Nom de la cuvée</label>
            <input value={form.nom_cuvee} onChange={e => setForm(f => ({ ...f, nom_cuvee: e.target.value }))} placeholder="Laisser vide si pas de cuvée" style={{ ...inp, fontStyle: 'italic' }} />
          </div>
          <div>
            <label style={lbl}>Domaine / Fournisseur</label>
            <select value={form.domaine_id} onChange={e => setForm(f => ({ ...f, domaine_id: e.target.value }))} style={sel}>
              <option value="">— Choisir un domaine —</option>
              {domaines.map(d => <option key={d.id} value={d.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{d.nom}</option>)}
            </select>
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', marginTop: 4 }}>
              Domaine introuvable ? <a href="/admin/fournisseurs" target="_blank" style={{ color: '#c9a96e', textDecoration: 'none' }}>Créer dans Fournisseurs →</a>
            </div>
          </div>
          <div>
            <label style={lbl}>Couleur *</label>
            <select value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))} style={{ ...sel, color: COULEUR_COLOR[form.couleur] || '#e8e0d5', fontWeight: 600 }}>
              {Object.entries(COULEUR_STYLE).map(([k, v]) => (
                <option key={k} value={k} style={{ background: '#1a1408', color: COULEUR_COLOR[k] || '#f0e8d8', fontWeight: 600 }}>{v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Millésime</label>
              <input type="number" value={form.millesime} onChange={e => setForm(f => ({ ...f, millesime: e.target.value }))} placeholder="2022" style={inp} />
            </div>
            <div>
              <label style={lbl}>Contenance</label>
              <input value={form.contenance} onChange={e => setForm(f => ({ ...f, contenance: e.target.value }))} placeholder="75cl" style={inp} />
            </div>
          </div>
        </div>

        {/* Prix */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Prix</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 6 }}>
          <div>
            <label style={lbl}>Prix achat HT (€)</label>
            <input type="number" step="0.01" value={form.prix_achat_ht} onChange={e => handleHTChange(e.target.value)} placeholder="0.00" style={inp} />
          </div>
          <div>
            <label style={lbl}>Coeff. part.</label>
            <input type="number" step="0.01" value={form.coeff_particulier} onChange={e => setForm(f => ({ ...f, coeff_particulier: e.target.value }))} style={{ ...inp, color: '#c9b06e' }} />
          </div>
          <div>
            <label style={lbl}>Prix TTC part. (€) *</label>
            <input type="number" step="0.50" value={form.prix_vente_ttc} onChange={e => setForm(f => ({ ...f, prix_vente_ttc: e.target.value }))} placeholder="0.00" style={inp} />
          </div>
          <div>
            <label style={lbl}>Coeff. pro</label>
            <input type="number" step="0.01" value={form.coeff_pro} onChange={e => setForm(f => ({ ...f, coeff_pro: e.target.value }))} style={{ ...inp, color: '#c9b06e' }} />
          </div>
          <div>
            <label style={lbl}>Prix TTC pro (€)</label>
            <input type="number" step="0.01" value={form.prix_vente_pro} onChange={e => setForm(f => ({ ...f, prix_vente_pro: e.target.value }))} placeholder="0.00" style={inp} />
          </div>
        </div>
        {form.prix_achat_ht && (
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 14 }}>
            {form.prix_achat_ht}€ HT × {form.coeff_particulier} = <strong style={{ color: '#c9a96e' }}>{arrondir50(parseFloat(form.prix_achat_ht) * parseFloat(form.coeff_particulier)).toFixed(2)}€</strong> part.
            {' · '}× {form.coeff_pro} = <strong style={{ color: '#c9a96e' }}>{(parseFloat(form.prix_achat_ht) * parseFloat(form.coeff_pro)).toFixed(2)}€</strong> pro
          </div>
        )}

        {/* Description & Photo */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Description & Photo</div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Description courte</label>
          <textarea value={form.description_courte} onChange={e => setForm(f => ({ ...f, description_courte: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' as const }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>URL photo</label>
          <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." style={inp} />
          {form.image_url && (
            <img src={form.image_url} alt="" style={{ height: 60, marginTop: 8, borderRadius: 4, objectFit: 'contain' as const, background: '#100d0a', padding: 4 }} onError={e => (e.currentTarget.style.display = 'none')} />
          )}
        </div>

        {/* Certifications */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Certifications</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 16 }}>
          {CERTIFS.map(({ key, label }) => {
            const active = (form as any)[key]
            return (
              <button key={key} onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))} style={{
                background: active ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${active ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>{label}</button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div onClick={() => setForm(f => ({ ...f, actif: !f.actif }))} style={{ width: 14, height: 14, borderRadius: 2, border: `0.5px solid ${form.actif ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: form.actif ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {form.actif && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}>Produit actif (visible en boutique)</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳ Enregistrement...' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Modal Nouveau Produit (admin catalogue) ──────────────────

function ModalNouveauProduitAdmin({ regions: regionsProp, appellations: appellationsProp, onClose, onSaved }: {
  regions: any[]
  appellations: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const [regions, setRegions] = useState<any[]>(regionsProp || [])
  const [appellations, setAppellations] = useState<any[]>(appellationsProp || [])
  const [domaines, setDomaines] = useState<any[]>([])

  useEffect(() => {
    if (!regionsProp || regionsProp.length === 0) {
      supabase.from('regions').select('id, nom').order('nom').then(({ data }) => setRegions(data || []))
    }
    if (!appellationsProp || appellationsProp.length === 0) {
      supabase.from('appellations').select('id, nom, region_id, type').order('nom').then(({ data }) => setAppellations(data || []))
    }
    supabase.from('domaines').select('id, nom').order('nom').then(({ data }) => setDomaines(data || []))
  }, [])

  const [form, setForm] = useState({
    appellation_nom: '',
    nom_cuvee: '',
    nomSurcharge: '',
    domaine_id: '',
    contenance: '75cl',
    millesime: '',
    couleur: 'rouge',
    region_id: '',
    appellation_id: '',
    prix_achat_ht: '',
    coeff_particulier: '2',
    prix_vente_ttc: '',
    coeff_pro: '1.70',
    prix_vente_pro: '',
    description_courte: '',
    image_url: '',
    bio: false, vegan: false, casher: false, naturel: false, biodynamique: false,
    actif: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const appsFiltrees = form.region_id
    ? appellations.filter((a: any) => a.region_id === form.region_id)
    : appellations

  const buildNom = () => {
    if (form.nomSurcharge.trim()) return form.nomSurcharge.trim()
    const parts = []
    if (form.appellation_nom) parts.push(form.appellation_nom)
    if (form.nom_cuvee) parts.push(form.nom_cuvee)
    if (form.couleur) parts.push(form.couleur.charAt(0).toUpperCase() + form.couleur.slice(1))
    if (form.millesime) parts.push(form.millesime)
    if (form.contenance) parts.push(form.contenance)
    let nom = parts.join(' ')
    const domaineNom = domaines.find(d => d.id === form.domaine_id)?.nom || ''
    if (domaineNom) nom += ' - ' + domaineNom
    return nom
  }

  const handleHTChange = (ht: string) => {
    const htNum = parseFloat(ht)
    setForm(f => ({
      ...f,
      prix_achat_ht: ht,
      prix_vente_ttc: !isNaN(htNum) && htNum > 0 ? arrondir50(htNum * parseFloat(f.coeff_particulier)).toFixed(2) : f.prix_vente_ttc,
      prix_vente_pro: !isNaN(htNum) && htNum > 0 ? (htNum * parseFloat(f.coeff_pro)).toFixed(2) : f.prix_vente_pro,
    }))
  }

  const handleSave = async () => {
    const nomFinal = buildNom()
    if (!nomFinal.trim()) { setError("Remplissez au moins l'appellation"); return }
    if (!form.prix_vente_ttc) { setError('Le prix TTC est obligatoire'); return }
    setSaving(true)
    setError('')
    const slug = nomFinal.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 7)
    const { data: newProduct, error: err } = await supabase.from('products').insert({
      nom: nomFinal,
      slug,
      nom_cuvee: form.nom_cuvee || null,
      contenance: form.contenance || '75cl',
      millesime: form.millesime ? parseInt(form.millesime) : null,
      couleur: form.couleur,
      region_id: form.region_id || null,
      appellation_id: form.appellation_id || null,
      domaine_id: form.domaine_id || null,
      prix_vente_ttc: parseFloat(form.prix_vente_ttc),
      prix_vente_pro: form.prix_vente_pro ? parseFloat(form.prix_vente_pro) : null,
      prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
      description_courte: form.description_courte || null,
      image_url: form.image_url || null,
      bio: form.bio, vegan: form.vegan, casher: form.casher,
      naturel: form.naturel, biodynamique: form.biodynamique,
      actif: form.actif,
    }).select('id').single()
    if (err) { setError(err.message); setSaving(false); return }
    // Associer au fournisseur dans product_suppliers
    if (form.domaine_id && newProduct?.id) {
      await supabase.from('product_suppliers').upsert({
        product_id: newProduct.id,
        domaine_id: form.domaine_id,
        prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
        conditionnement: 6,
        fournisseur_principal: true,
      }, { onConflict: 'product_id,domaine_id' })
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }
  const sel = { ...inp, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', cursor: 'pointer' }
  const CERTIFS = [
    { key: 'bio', label: '🌿 Bio' }, { key: 'vegan', label: '🌱 Vegan' },
    { key: 'casher', label: '✡ Casher' }, { key: 'naturel', label: '🍃 Naturel' },
    { key: 'biodynamique', label: '🌙 Biodynamique' },
  ]

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 700, padding: '28px 32px', maxHeight: '92vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouveau produit</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Nom du produit</div>
          <input
            value={form.nomSurcharge || buildNom()}
            onChange={e => setForm(f => ({ ...f, nomSurcharge: e.target.value }))}
            onFocus={e => { if (!form.nomSurcharge) setForm(f => ({ ...f, nomSurcharge: buildNom() })) }}
            placeholder="Nom généré automatiquement..."
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: form.nomSurcharge ? '0.5px solid rgba(201,169,110,0.4)' : '0.5px solid transparent', color: '#f0e8d8', fontSize: 15, fontFamily: 'Georgia, serif', padding: '4px 0', outline: 'none', boxSizing: 'border-box' as const }}
          />
          {form.nomSurcharge && (
            <button onClick={() => setForm(f => ({ ...f, nomSurcharge: '' }))} style={{ background: 'transparent', border: 'none', color: 'rgba(201,169,110,0.5)', fontSize: 10, cursor: 'pointer', padding: 0, marginTop: 4 }}>
              ↺ Réinitialiser automatique
            </button>
          )}
        </div>

        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Identité</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Région viticole</label>
            <select value={form.region_id} onChange={e => setForm(f => ({ ...f, region_id: e.target.value, appellation_id: '', appellation_nom: '' }))} style={sel}>
              <option value="">— Choisir —</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Appellation *</label>
            <select value={form.appellation_id} onChange={e => {
              const app = appsFiltrees.find((a: any) => a.id === e.target.value)
              setForm(f => ({ ...f, appellation_id: e.target.value, appellation_nom: app?.nom || '' }))
            }} style={sel}>
              <option value="">— Choisir —</option>
              {appsFiltrees.filter((a: any) => !a.type || a.type === 'AOC').length > 0 && <optgroup label="── AOC / AOP ──">{appsFiltrees.filter((a: any) => !a.type || a.type === 'AOC').map((a: any) => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>}
              {appsFiltrees.filter((a: any) => a.type === 'IGP').length > 0 && <optgroup label="── IGP ──">{appsFiltrees.filter((a: any) => a.type === 'IGP').map((a: any) => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>}
            </select>
          </div>
          <div>
            <label style={lbl}>Nom de la cuvée</label>
            <input value={form.nom_cuvee} onChange={e => setForm(f => ({ ...f, nom_cuvee: e.target.value }))} placeholder="Laisser vide si pas de cuvée" style={{ ...inp, fontStyle: 'italic' }} />
          </div>
          <div>
            <label style={lbl}>Domaine / Fournisseur</label>
            <select value={form.domaine_id} onChange={e => setForm(f => ({ ...f, domaine_id: e.target.value }))} style={sel}>
              <option value="">— Choisir un domaine —</option>
              {domaines.map(d => <option key={d.id} value={d.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{d.nom}</option>)}
            </select>
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', marginTop: 4 }}>
              Domaine introuvable ? <a href="/admin/fournisseurs" target="_blank" style={{ color: '#c9a96e', textDecoration: 'none' }}>Créer dans Fournisseurs →</a>
            </div>
          </div>
          <div>
            <label style={lbl}>Couleur *</label>
            <select value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))} style={{ ...sel, color: COULEUR_COLOR[form.couleur] || '#e8e0d5', fontWeight: 600 }}>
              {Object.entries(COULEUR_STYLE).map(([k, v]) => (
                <option key={k} value={k} style={{ background: '#1a1408', color: COULEUR_COLOR[k] || '#f0e8d8', fontWeight: 600 }}>{v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Millésime</label>
              <input type="number" value={form.millesime} onChange={e => setForm(f => ({ ...f, millesime: e.target.value }))} placeholder="2022" style={inp} />
            </div>
            <div>
              <label style={lbl}>Contenance</label>
              <input value={form.contenance} onChange={e => setForm(f => ({ ...f, contenance: e.target.value }))} placeholder="75cl" style={inp} />
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Prix</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 6 }}>
          <div>
            <label style={lbl}>Prix achat HT (€)</label>
            <input type="number" step="0.01" value={form.prix_achat_ht} onChange={e => handleHTChange(e.target.value)} placeholder="0.00" style={inp} />
          </div>
          <div>
            <label style={lbl}>Coeff. part.</label>
            <input type="number" step="0.01" value={form.coeff_particulier} onChange={e => setForm(f => ({ ...f, coeff_particulier: e.target.value }))} style={{ ...inp, color: '#c9b06e' }} />
          </div>
          <div>
            <label style={lbl}>Prix TTC part. (€) *</label>
            <input type="number" step="0.50" value={form.prix_vente_ttc} onChange={e => setForm(f => ({ ...f, prix_vente_ttc: e.target.value }))} placeholder="0.00" style={inp} />
          </div>
          <div>
            <label style={lbl}>Coeff. pro</label>
            <input type="number" step="0.01" value={form.coeff_pro} onChange={e => setForm(f => ({ ...f, coeff_pro: e.target.value }))} style={{ ...inp, color: '#c9b06e' }} />
          </div>
          <div>
            <label style={lbl}>Prix TTC pro (€)</label>
            <input type="number" step="0.01" value={form.prix_vente_pro} onChange={e => setForm(f => ({ ...f, prix_vente_pro: e.target.value }))} placeholder="0.00" style={inp} />
          </div>
        </div>
        {form.prix_achat_ht && parseFloat(form.prix_achat_ht) > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 14 }}>
            {form.prix_achat_ht}€ HT × {form.coeff_particulier} = <strong style={{ color: '#c9a96e' }}>{arrondir50(parseFloat(form.prix_achat_ht) * parseFloat(form.coeff_particulier)).toFixed(2)}€</strong> part.
            {' · '}× {form.coeff_pro} = <strong style={{ color: '#c9a96e' }}>{(parseFloat(form.prix_achat_ht) * parseFloat(form.coeff_pro)).toFixed(2)}€</strong> pro
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>URL photo</label>
          <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." style={inp} />
        </div>

        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Certifications</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 16 }}>
          {CERTIFS.map(({ key, label }) => {
            const active = (form as any)[key]
            return (
              <button key={key} onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))} style={{
                background: active ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${active ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>{label}</button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div onClick={() => setForm(f => ({ ...f, actif: !f.actif }))} style={{ width: 14, height: 14, borderRadius: 2, border: `0.5px solid ${form.actif ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: form.actif ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {form.actif && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}>Produit actif (visible en boutique)</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳ Création...' : '✓ Créer le produit'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Modal Dupliquer Produit ──────────────────────────────────

function ModalDupliquer({ produit, onClose, onSaved }: {
  produit: any
  onClose: () => void
  onSaved: () => void
}) {
  const [millesime, setMillesime] = useState(produit.millesime ? String(produit.millesime + 1) : '')
  const [prixAchatHT, setPrixAchatHT] = useState(produit.prix_achat_ht ? String(produit.prix_achat_ht) : '')
  const [nomSurcharge, setNomSurcharge] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const arrondir50 = (n: number) => Math.ceil(n * 2) / 2

  const prixTTC = prixAchatHT && parseFloat(prixAchatHT) > 0
    ? arrondir50(parseFloat(prixAchatHT) * 2)
    : produit.prix_vente_ttc
  const prixPro = prixAchatHT && parseFloat(prixAchatHT) > 0
    ? Math.round(parseFloat(prixAchatHT) * 1.70 * 100) / 100
    : produit.prix_vente_pro

  const handleDupliquer = async () => {
    setSaving(true)
    setError('')

    let newNom = nomSurcharge.trim() || produit.nom
    if (!nomSurcharge.trim() && produit.millesime && millesime) {
      newNom = produit.nom.replace(String(produit.millesime), millesime)
    }

    const slug = newNom.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 7)

    const { data: newProd, error: err } = await supabase.from('products').insert({
      nom: newNom,
      slug,
      nom_cuvee: produit.nom_cuvee || null,
      contenance: produit.contenance || '75cl',
      millesime: millesime ? parseInt(millesime) : null,
      couleur: produit.couleur,
      region_id: produit.region_id || null,
      appellation_id: produit.appellation_id || null,
      domaine_id: produit.domaine_id || null,
      prix_achat_ht: prixAchatHT ? parseFloat(prixAchatHT) : (produit.prix_achat_ht || null),
      prix_vente_ttc: prixTTC || null,
      prix_vente_pro: prixPro || null,
      description_courte: produit.description_courte || null,
      image_url: produit.image_url || null,
      bio: produit.bio || false,
      vegan: produit.vegan || false,
      casher: produit.casher || false,
      naturel: produit.naturel || false,
      biodynamique: produit.biodynamique || false,
      actif: true,
    }).select('id').single()

    if (err) { setError(err.message); setSaving(false); return }

    // Dupliquer aussi l'association fournisseur
    if (produit.domaine_id && newProd?.id) {
      const { data: ps } = await supabase.from('product_suppliers')
        .select('*').eq('product_id', produit.id).eq('fournisseur_principal', true).maybeSingle()
      if (ps) {
        await supabase.from('product_suppliers').insert({
          product_id: newProd.id,
          domaine_id: ps.domaine_id,
          prix_achat_ht: ps.prix_achat_ht,
          conditionnement: ps.conditionnement,
          fournisseur_principal: true,
        })
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  const handleDupliquerEtArchiver = async () => {
    setSaving(true)
    setError('')
    let newNom = produit.nom
    if (produit.millesime && millesime) {
      newNom = produit.nom.replace(String(produit.millesime), millesime)
    }
    const slug = newNom.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 7)
    const { data: newProd, error: err } = await supabase.from('products').insert({
      nom: newNom, slug,
      nom_cuvee: produit.nom_cuvee || null,
      contenance: produit.contenance || '75cl',
      millesime: millesime ? parseInt(millesime) : null,
      couleur: produit.couleur,
      region_id: produit.region_id || null,
      appellation_id: produit.appellation_id || null,
      domaine_id: produit.domaine_id || null,
      prix_achat_ht: prixAchatHT ? parseFloat(prixAchatHT) : (produit.prix_achat_ht || null),
      prix_vente_ttc: prixTTC || null,
      prix_vente_pro: prixPro || null,
      description_courte: produit.description_courte || null,
      image_url: produit.image_url || null,
      bio: produit.bio || false, vegan: produit.vegan || false,
      casher: produit.casher || false, naturel: produit.naturel || false,
      biodynamique: produit.biodynamique || false, actif: true,
    }).select('id').single()
    if (err) { setError(err.message); setSaving(false); return }
    if (produit.domaine_id && newProd?.id) {
      const { data: ps } = await supabase.from('product_suppliers')
        .select('*').eq('product_id', produit.id).eq('fournisseur_principal', true).maybeSingle()
      if (ps) {
        await supabase.from('product_suppliers').insert({
          product_id: newProd.id, domaine_id: ps.domaine_id,
          prix_achat_ht: ps.prix_achat_ht, conditionnement: ps.conditionnement,
          fournisseur_principal: true,
        })
      }
    }
    // Archiver original - jamais supprime, historique conserve
    await supabase.from('products').update({ actif: false }).eq('id', produit.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 14, padding: '10px 12px', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 8, width: 420, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>⧉ Dupliquer le produit</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Aperçu produit original */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '10px 14px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 4 }}>Produit original</div>
          <div style={{ fontSize: 13, color: '#e8e0d5' }}>{produit.nom}</div>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>
              Nouveau millésime
            </label>
            <input
              type="number"
              value={millesime}
              onChange={e => setMillesime(e.target.value)}
              placeholder="Ex: 2024"
              style={inp}
              autoFocus
            />
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.25)', marginTop: 4 }}>Vide = même millésime</div>
          </div>
          <div>
            <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>
              Prix achat HT (€)
            </label>
            <input
              type="number" step="0.01"
              value={prixAchatHT}
              onChange={e => setPrixAchatHT(e.target.value)}
              placeholder={produit.prix_achat_ht ? String(produit.prix_achat_ht) : '0.00'}
              style={inp}
            />
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.25)', marginTop: 4 }}>Vide = même prix</div>
          </div>
        </div>
        {prixAchatHT && parseFloat(prixAchatHT) > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '8px 12px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1, marginBottom: 4 }}>TTC PARTICULIER</div>
              <div style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{prixTTC?.toFixed(2)}€</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '8px 12px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1, marginBottom: 4 }}>TTC PRO</div>
              <div style={{ fontSize: 15, color: '#6e9ec9', fontFamily: 'Georgia, serif' }}>{prixPro?.toFixed(2)}€</div>
            </div>
          </div>
        )}

        {/* Aperçu du nouveau nom */}
        {millesime && produit.millesime && (
          <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const }}>Nouveau produit
              {nomSurcharge && <button onClick={() => setNomSurcharge('')} style={{ background: 'transparent', border: 'none', color: 'rgba(201,169,110,0.5)', fontSize: 10, cursor: 'pointer', padding: '0 0 0 8px' }}>↺ Auto</button>}
            </div>
            <input
              value={nomSurcharge || buildNomDuplique()}
              onChange={e => setNomSurcharge(e.target.value)}
              onFocus={() => { if (!nomSurcharge) setNomSurcharge(buildNomDuplique()) }}
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `0.5px solid ${nomSurcharge ? 'rgba(201,169,110,0.5)' : 'rgba(201,169,110,0.2)'}`, color: '#c9a96e', fontSize: 14, fontFamily: 'Georgia, serif', padding: '4px 0', outline: 'none', boxSizing: 'border-box' as const }}
            />
            <div style={{ fontSize: 10, color: '#6ec96e', marginTop: 4 }}>✓ Sera créé actif</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={handleDupliquer} disabled={saving} style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 1, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Chargement...' : 'Dupliquer'}
          </button>
          <button onClick={handleDupliquerEtArchiver} disabled={saving} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 1, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Chargement...' : 'Dupliquer & archiver original'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

const CATEGORIES = [
  { id: 'vins',        label: 'Vins',               icon: '🍷', cat: 'vin' },
  { id: 'bieres',      label: 'Bières',             icon: '🍺', cat: 'biere' },
  { id: 'spiritueux',  label: 'Spiritueux',         icon: '🥃', cat: 'spiritueux' },
  { id: 'sans_alcool', label: 'Boissons s/alcool',  icon: '🧃', cat: 'sans_alcool' },
  { id: 'epicerie',    label: 'Épicerie',            icon: '🧀', cat: 'epicerie' },
]

// ── ID des sites (constantes métier) ─────────────────────────
const SITE_ARBRESLE_ID = '3097e864-f452-4c2e-9af3-21e26f0330b7'
const MARGE_INTERSOCIETE = 1.05

function impliqueLaPetiteCave(a: string, b: string) {
  return a === SITE_ARBRESLE_ID || b === SITE_ARBRESLE_ID
}

function genNumero(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`
}

// ── Modal Nouveau Transfert (Étape 1 — Demande) ───────────────
function ModalNouveauTransfert({ sites, onCreated, onClose, transfertExistant = null }: {
  sites: any[]; onCreated: () => void; onClose: () => void; transfertExistant?: any
}) {
  const inp = { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }
  const sel = { ...inp, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', cursor: 'pointer' }

  // Mode ajout à un transfert existant
  const modeAjout = !!transfertExistant

  // Étapes : 'config' | 'selection' | 'quantites'
  const [step, setStep] = useState<'config' | 'selection' | 'quantites'>(modeAjout ? 'selection' : 'config')
  const [siteSourceId, setSiteSourceId] = useState(transfertExistant?.site_source_id || sites[0]?.id || '')
  const [siteDestId, setSiteDestId] = useState(transfertExistant?.site_destination_id || sites[1]?.id || '')
  const [notes, setNotes] = useState(transfertExistant?.notes || '')

  // Catalogue
  const [produits, setProduits] = useState<any[]>([])
  const [stockAgrege, setStockAgrege] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [domaines, setDomaines] = useState<any[]>([])
  const [loadingProduits, setLoadingProduits] = useState(false)

  // Filtres + tri
  const [search, setSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterDomaine, setFilterDomaine] = useState('')
  const [filterCouleur, setFilterCouleur] = useState('')
  const [sortCol, setSortCol] = useState('nom')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [pageProduits, setPageProduits] = useState(0)
  const PAGE_SIZE_T = 50

  // Sélection : Set de product_id cochés
  const [coches, setCoches] = useState<Set<string>>(new Set())
  // Quantités : product_id → quantité
  const [quantites, setQuantites] = useState<Record<string, number>>({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const isInterSociete = impliqueLaPetiteCave(siteSourceId, siteDestId)
  const sitesDestDispos = sites.filter(s => s.id !== siteSourceId)

  useEffect(() => {
    if (sitesDestDispos.length > 0 && !sitesDestDispos.find(s => s.id === siteDestId))
      setSiteDestId(sitesDestDispos[0].id)
  }, [siteSourceId])

  useEffect(() => {
    if (step === 'selection' || step === 'quantites') loadCatalogue()
  }, [step])

  useEffect(() => { setPageProduits(0) }, [search, filterRegion, filterDomaine, filterCouleur, sortCol, sortDir])

  const loadCatalogue = async () => {
    setLoadingProduits(true)
    const [{ data: prods }, { data: stock }, { data: regs }, { data: doms }] = await Promise.all([
      supabase.from('products').select('id, nom, millesime, couleur, prix_achat_ht, prix_vente_ttc, domaine_id, region_id').eq('actif', true).order('nom').limit(5000),
      supabase.from('v_stock_agrege').select('product_id, stock_marcy, stock_entrepot, stock_arbresle, stock_total').range(0, 9999),
      supabase.from('regions').select('id, nom').order('nom'),
      supabase.from('domaines').select('id, nom').order('nom'),
    ])
    setProduits(prods || [])
    setStockAgrege(stock || [])
    setRegions(regs || [])
    setDomaines(doms || [])
    setLoadingProduits(false)
  }

  const siteCol = (id: string): string => {
    if (id === 'ee3afa96-0c45-407f-87fc-e503fbada6c4') return 'stock_marcy'
    if (id === 'e12d7e47-23dc-4011-95fc-e9e975fc4307') return 'stock_entrepot'
    return 'stock_arbresle'
  }
  const getStock = (pid: string, col: string) => (stockAgrege.find(x => x.product_id === pid)?.[col] || 0)

  const CLABEL: Record<string, string> = { rouge: 'Rouge', blanc: 'Blanc', rosé: 'Rosé', champagne: 'Champagne', effervescent: 'Effervescent', spiritueux: 'Spiritueux', autre: 'Autre' }
  const CDOT: Record<string, string> = { rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0', champagne: '#d4c88a', effervescent: '#a0b0e0', spiritueux: '#8ec98e', autre: '#888' }

  const produitsFiltres = produits
    .filter(p =>
      (!search || p.nom.toLowerCase().includes(search.toLowerCase())) &&
      (!filterRegion || p.region_id === filterRegion) &&
      (!filterDomaine || p.domaine_id === filterDomaine) &&
      (!filterCouleur || p.couleur === filterCouleur)
    )
    .sort((a, b) => {
      let va: any, vb: any
      if (sortCol === 'stock_source') { va = getStock(a.id, siteCol(siteSourceId)); vb = getStock(b.id, siteCol(siteSourceId)) }
      else if (sortCol === 'stock_total') { va = getStock(a.id, 'stock_total'); vb = getStock(b.id, 'stock_total') }
      else if (sortCol === 'prix_achat_ht' || sortCol === 'prix_vente_ttc') { va = parseFloat(a[sortCol] || 0); vb = parseFloat(b[sortCol] || 0) }
      else { va = (a[sortCol] || '').toString().toLowerCase(); vb = (b[sortCol] || '').toString().toLowerCase() }
      return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0)
    })

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const si = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const toggleCoche = (pid: string) => {
    setCoches(prev => {
      const n = new Set(prev)
      if (n.has(pid)) { n.delete(pid); const q = { ...quantites }; delete q[pid]; setQuantites(q) }
      else { n.add(pid); setQuantites(q => ({ ...q, [pid]: 1 })) }
      return n
    })
  }

  const toggleAll = () => {
    const page = produitsFiltres.slice(pageProduits * PAGE_SIZE_T, (pageProduits + 1) * PAGE_SIZE_T)
    const allChecked = page.every(p => coches.has(p.id))
    setCoches(prev => {
      const n = new Set(prev)
      if (allChecked) { page.forEach(p => { n.delete(p.id); }) }
      else { page.forEach(p => { n.add(p.id); if (!quantites[p.id]) setQuantites(q => ({ ...q, [p.id]: 1 })) }) }
      return n
    })
  }

  const produitsCochesData = produits.filter(p => coches.has(p.id))

  const handleConfirmerSelection = () => {
    if (coches.size === 0) { setError('Sélectionnez au moins un produit'); return }
    setError('')
    setStep('quantites')
  }

  const handleCreate = async () => {
    if (coches.size === 0) { setError('Aucun produit sélectionné'); return }
    setSaving(true); setError('')

    let transferId = transfertExistant?.id

    if (!modeAjout) {
      const { data: transfer, error: errT } = await supabase.from('stock_transfers').insert({
        numero: genNumero('TRF'), site_source_id: siteSourceId, site_destination_id: siteDestId,
        statut: 'demande', notes: notes || null,
      }).select('id').single()
      if (errT || !transfer) { setError(errT?.message || 'Erreur création'); setSaving(false); return }
      transferId = transfer.id
    }

    const lignes = produitsCochesData.map(p => {
      const prixAchat = p.prix_achat_ht ? parseFloat(p.prix_achat_ht) : null
      const prixTransfert = isInterSociete && prixAchat ? Math.round(prixAchat * MARGE_INTERSOCIETE * 10000) / 10000 : null
      const qte = quantites[p.id] || 1
      return { transfer_id: transferId, product_id: p.id, quantite: qte, quantite_demandee: qte, prix_achat_ht: prixAchat, prix_transfert_ht: prixTransfert }
    })

    for (let i = 0; i < lignes.length; i += 200)
      await supabase.from('stock_transfer_lignes').insert(lignes.slice(i, i + 200))

    setSaving(false); onCreated()
  }

  const thS = { padding: '9px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400, cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const }
  const srcCol = siteCol(siteSourceId)
  const pageData = produitsFiltres.slice(pageProduits * PAGE_SIZE_T, (pageProduits + 1) * PAGE_SIZE_T)
  const nbPages = Math.ceil(produitsFiltres.length / PAGE_SIZE_T)
  const allPageChecked = pageData.length > 0 && pageData.every(p => coches.has(p.id))

  // ── ÉTAPE 1 : Config ─────────────────────────────────────────
  if (step === 'config') return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 520, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c9a96e', marginBottom: 4 }}>ÉTAPE 1 / 3</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouveau transfert</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end', marginBottom: 20 }}>
          <div>
            <label style={lbl}>Site source</label>
            <select value={siteSourceId} onChange={e => setSiteSourceId(e.target.value)} style={{ ...sel, width: '100%' }}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 22, color: '#c9a96e', paddingBottom: 8, textAlign: 'center' as const }}>→</div>
          <div>
            <label style={lbl}>Site destination</label>
            <select value={siteDestId} onChange={e => setSiteDestId(e.target.value)} style={{ ...sel, width: '100%' }}>
              {sitesDestDispos.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
        </div>
        {isInterSociete && (
          <div style={{ background: 'rgba(201,110,110,0.08)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 10 }}>
            <span>⚠</span>
            <div>
              <div style={{ fontSize: 12, color: '#c96e6e', fontWeight: 600 }}>Transfert inter-société</div>
              <div style={{ fontSize: 11, color: 'rgba(201,110,110,0.7)', marginTop: 2 }}>Facture générée à l'expédition — prix achat HT × 1,05</div>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Notes (optionnel)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Raison du transfert..." style={{ ...inp, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => { if (siteSourceId === siteDestId) { setError('Source et destination identiques'); return } setError(''); setStep('selection') }}
            style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Sélectionner les produits →
          </button>
        </div>
      </div>
    </div>
  )

  // ── ÉTAPE 2 : Sélection (plein écran, coches uniquement) ─────
  if (step === 'selection') return (
    <div style={{ position: 'fixed' as const, inset: 0, background: '#0d0a08', zIndex: 1000, display: 'flex', flexDirection: 'column' as const }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 16, background: '#100d0a' }}>
        {!modeAjout && <button onClick={() => setStep('config')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 18, cursor: 'pointer' }}>←</button>}
        {modeAjout && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 18, cursor: 'pointer' }}>←</button>}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: '#f0e8d8' }}>
            {modeAjout ? `Ajouter des produits — ${transfertExistant?.numero}` : `${sites.find(s => s.id === siteSourceId)?.nom} → ${sites.find(s => s.id === siteDestId)?.nom}`}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>
            {modeAjout ? 'Étape 2 — Cochez les produits à ajouter' : 'Étape 2 — Cochez les produits à transférer'}
            {coches.size > 0 && <span style={{ color: '#c9a96e', marginLeft: 8 }}>{coches.size} produit{coches.size > 1 ? 's' : ''} coché{coches.size > 1 ? 's' : ''}</span>}
          </div>
        </div>
        {error && <div style={{ fontSize: 12, color: '#c96e6e' }}>{error}</div>}
        <button onClick={handleConfirmerSelection} disabled={coches.size === 0}
          style={{ background: coches.size > 0 ? '#c9a96e' : 'transparent', color: coches.size > 0 ? '#0d0a08' : 'rgba(232,224,213,0.3)', border: `0.5px solid ${coches.size > 0 ? '#c9a96e' : 'rgba(255,255,255,0.15)'}`, borderRadius: 4, padding: '10px 20px', fontSize: 13, cursor: coches.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
          {coches.size > 0 ? `Ajuster les quantités (${coches.size}) →` : 'Cochez des produits'}
        </button>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Filtres */}
      <div style={{ padding: '10px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center', background: '#100d0a' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ ...inp, flex: '1 1 160px', fontSize: 12, padding: '7px 10px' }} />
        <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ ...sel, fontSize: 12, padding: '7px 10px' }}>
          <option value="">Toutes les régions</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
        </select>
        <select value={filterDomaine} onChange={e => setFilterDomaine(e.target.value)} style={{ ...sel, fontSize: 12, padding: '7px 10px' }}>
          <option value="">Tous les domaines</option>
          {domaines.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        {['', 'rouge', 'blanc', 'rosé', 'champagne', 'effervescent', 'spiritueux'].map(c => (
          <button key={c} onClick={() => setFilterCouleur(c)} style={{ background: filterCouleur === c ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${filterCouleur === c ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`, color: filterCouleur === c ? '#c9a96e' : 'rgba(232,224,213,0.4)', borderRadius: 20, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
            {c ? (CLABEL[c] || c) : 'Toutes'}
          </button>
        ))}
        <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginLeft: 'auto' }}>{produitsFiltres.length} produits</span>
      </div>

      {/* Tableau */}
      <div style={{ flex: 1, overflowY: 'auto' as const }}>
        {loadingProduits ? (
          <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead style={{ position: 'sticky' as const, top: 0, background: '#100d0a', zIndex: 1 }}>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                <th style={{ ...thS, width: 40 }}>
                  <div onClick={toggleAll} style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${allPageChecked ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: allPageChecked ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    {allPageChecked && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
                  </div>
                </th>
                <th style={thS} onClick={() => toggleSort('nom')}>Produit{si('nom')}</th>
                <th style={thS} onClick={() => toggleSort('couleur')}>Couleur{si('couleur')}</th>
                <th style={thS} onClick={() => toggleSort('millesime')}>Mill.{si('millesime')}</th>
                <th style={thS} onClick={() => toggleSort('prix_achat_ht')}>PA HT{si('prix_achat_ht')}</th>
                <th style={thS} onClick={() => toggleSort('prix_vente_ttc')}>PV TTC{si('prix_vente_ttc')}</th>
                <th style={{ ...thS, color: '#6e9ec9' }} onClick={() => toggleSort('stock_source')}>Stk {sites.find(s => s.id === siteSourceId)?.nom?.split(' ')[0]}{si('stock_source')}</th>
                <th style={thS} onClick={() => toggleSort('stock_total')}>Total{si('stock_total')}</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((p, i) => {
                const isC = coches.has(p.id)
                const stockSrc = getStock(p.id, srcCol)
                const stockTotal = getStock(p.id, 'stock_total')
                return (
                  <tr key={p.id} onClick={() => toggleCoche(p.id)}
                    style={{ borderBottom: i < pageData.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', background: isC ? 'rgba(201,169,110,0.06)' : 'transparent', cursor: 'pointer' }}
                    onMouseEnter={e => { if (!isC) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isC) e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${isC ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: isC ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isC && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 13, color: '#f0e8d8' }}>{p.nom}{p.millesime ? ` ${p.millesime}` : ''}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ color: CDOT[p.couleur] || '#888', fontSize: 11 }}>● {CLABEL[p.couleur] || p.couleur}</span></td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{p.millesime || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{p.prix_achat_ht ? `${parseFloat(p.prix_achat_ht).toFixed(2)} €` : '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#c9a96e' }}>{p.prix_vente_ttc ? `${parseFloat(p.prix_vente_ttc).toFixed(2)} €` : '—'}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 13, color: stockSrc === 0 ? '#c96e6e' : stockSrc <= 3 ? '#c9b06e' : '#6ec96e', fontFamily: 'Georgia, serif' }}>{stockSrc}</span></td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{stockTotal}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {nbPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', background: '#0d0a08' }}>
            <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{pageProduits * PAGE_SIZE_T + 1}–{Math.min((pageProduits + 1) * PAGE_SIZE_T, produitsFiltres.length)} sur {produitsFiltres.length}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['«', 0], ['‹', pageProduits - 1]].map(([label, target]) => (
                <button key={label} onClick={() => setPageProduits(Number(target))} disabled={pageProduits === 0}
                  style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: pageProduits === 0 ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '5px 10px', fontSize: 12, cursor: pageProduits === 0 ? 'default' : 'pointer' }}>{label}</button>
              ))}
              {Array.from({ length: nbPages }, (_, i) => i).map(i => (
                <button key={i} onClick={() => setPageProduits(i)} style={{ background: pageProduits === i ? '#c9a96e' : 'transparent', color: pageProduits === i ? '#0d0a08' : 'rgba(232,224,213,0.4)', border: `0.5px solid ${pageProduits === i ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, borderRadius: 4, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: pageProduits === i ? 600 : 400 }}>{i + 1}</button>
              ))}
              {[['›', pageProduits + 1], ['»', nbPages - 1]].map(([label, target]) => (
                <button key={label} onClick={() => setPageProduits(Number(target))} disabled={pageProduits >= nbPages - 1}
                  style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: pageProduits >= nbPages - 1 ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '5px 10px', fontSize: 12, cursor: pageProduits >= nbPages - 1 ? 'default' : 'pointer' }}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── ÉTAPE 3 : Ajustement des quantités ───────────────────────
  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setStep('selection')} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 18, cursor: 'pointer' }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c9a96e', marginBottom: 3 }}>ÉTAPE 3 / 3 — QUANTITÉS</div>
            <div style={{ fontSize: 14, color: '#f0e8d8' }}>{coches.size} produit{coches.size > 1 ? 's' : ''} sélectionné{coches.size > 1 ? 's' : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ margin: '12px 24px 0', background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        {/* Liste des produits avec quantités */}
        <div style={{ flex: 1, overflowY: 'auto' as const, padding: '16px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Stk source', isInterSociete ? 'Prix transf. HT' : 'PA HT', 'Quantité demandée', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {produitsCochesData.map((p, i) => {
                const stockSrc = getStock(p.id, srcCol)
                const prixAchat = p.prix_achat_ht ? parseFloat(p.prix_achat_ht) : null
                const prixTransfert = isInterSociete && prixAchat ? Math.round(prixAchat * MARGE_INTERSOCIETE * 10000) / 10000 : null
                const qte = quantites[p.id] || 1
                const depasse = qte > stockSrc && stockSrc > 0
                return (
                  <tr key={p.id} style={{ borderBottom: i < produitsCochesData.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ fontSize: 13, color: '#f0e8d8' }}>{p.nom}{p.millesime ? ` ${p.millesime}` : ''}</div>
                      <div style={{ fontSize: 11, color: CDOT[p.couleur] || '#888', marginTop: 2 }}>● {CLABEL[p.couleur] || p.couleur}</div>
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: stockSrc === 0 ? '#c96e6e' : stockSrc <= 3 ? '#c9b06e' : '#6ec96e', fontFamily: 'Georgia, serif' }}>{stockSrc}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: isInterSociete ? '#c96e6e' : 'rgba(232,224,213,0.5)' }}>
                      {isInterSociete ? (prixTransfert ? `${prixTransfert.toFixed(4)} €` : '—') : (prixAchat ? `${prixAchat.toFixed(2)} €` : '—')}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => setQuantites(q => ({ ...q, [p.id]: Math.max(1, (q[p.id] || 1) - 1) }))} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e8e0d5', width: 28, height: 28, borderRadius: 3, cursor: 'pointer', fontSize: 16 }}>−</button>
                        <input
                          ref={el => { inputRefs.current[p.id] = el }}
                          type="number" min={1} value={qte}
                          onChange={e => setQuantites(q => ({ ...q, [p.id]: parseInt(e.target.value) || 1 }))}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => {
                            if (e.key === 'Tab') {
                              e.preventDefault()
                              const idx = produitsCochesData.findIndex(x => x.id === p.id)
                              const next = produitsCochesData[idx + 1]
                              if (next) {
                                setQuantites(q => ({ ...q, [next.id]: 0 }))
                                setTimeout(() => { inputRefs.current[next.id]?.focus(); inputRefs.current[next.id]?.select() }, 30)
                              }
                            }
                          }}
                          style={{ width: 60, background: depasse ? 'rgba(201,176,110,0.08)' : 'rgba(255,255,255,0.06)', border: `0.5px solid ${depasse ? 'rgba(201,176,110,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 3, color: depasse ? '#c9b06e' : '#e8e0d5', fontSize: 15, padding: '4px 6px', textAlign: 'center' as const }} />
                        <button onClick={() => setQuantites(q => ({ ...q, [p.id]: (q[p.id] || 1) + 1 }))} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e8e0d5', width: 28, height: 28, borderRadius: 3, cursor: 'pointer', fontSize: 16 }}>+</button>
                      </div>
                      {depasse && <div style={{ fontSize: 10, color: '#c9b06e', marginTop: 3 }}>⚠ Dépasse le stock affiché</div>}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <button onClick={() => { setCoches(prev => { const n = new Set(prev); n.delete(p.id); return n }); setQuantites(q => { const n = { ...q }; delete n[p.id]; return n }) }}
                        style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10 }}>
          <button onClick={() => setStep('selection')} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 12, cursor: 'pointer' }}>← Modifier la sélection</button>
          <button onClick={handleCreate} disabled={saving || coches.size === 0}
            style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳ Création...' : modeAjout ? `✓ Ajouter ${coches.size} produit${coches.size > 1 ? 's' : ''} au transfert` : `✓ Créer la demande (${coches.size} produit${coches.size > 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}



// ── Vue détail transfert (3 étapes) ──────────────────────────
function VueDetailTransfert({ transfert, sites, onBack, onRefresh }: {
  transfert: any; sites: any[]; onBack: () => void; onRefresh: () => void
}) {
  const [lignes, setLignes] = useState<any[]>([])
  const [facture, setFacture] = useState<any>(null)
  const [avoir, setAvoir] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [showAjoutProduits, setShowAjoutProduits] = useState(false)
  const [qteExpediees, setQteExpediees] = useState<Record<string, number>>({})
  const [qteRecues, setQteRecues] = useState<Record<string, number>>({})

  const isInterSociete = impliqueLaPetiteCave(transfert.site_source_id, transfert.site_destination_id)
  const siteSrc = sites.find(s => s.id === transfert.site_source_id)
  const siteDest = sites.find(s => s.id === transfert.site_destination_id)

  const load = async () => {
    setLoading(true)
    const { data: lig } = await supabase.from('stock_transfer_lignes')
      .select('*, product:products(id, nom, millesime, couleur)')
      .eq('transfer_id', transfert.id)
    setLignes(lig || [])
    const initExp: Record<string, number> = {}
    const initRec: Record<string, number> = {}
    ;(lig || []).forEach((l: any) => {
      initExp[l.id] = l.quantite_expediee ?? l.quantite_demandee ?? l.quantite
      initRec[l.id] = l.quantite_recue ?? l.quantite_expediee ?? l.quantite
    })
    setQteExpediees(initExp)
    setQteRecues(initRec)
    if (transfert.facture_intersociete_id) {
      const { data: f } = await supabase.from('factures_intersocietes').select('*').eq('id', transfert.facture_intersociete_id).single()
      setFacture(f)
    }
    if (transfert.avoir_id) {
      const { data: a } = await supabase.from('factures_intersocietes').select('*').eq('id', transfert.avoir_id).single()
      setAvoir(a)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [transfert.id])

  // ── Étape 2 : Expédition ──
  const handleExpedier = async () => {
    setProcessing(true); setError('')
    try {
      // Mettre à jour les quantités expédiées
      for (const l of lignes) {
        const qte = qteExpediees[l.id] ?? l.quantite_demandee
        await supabase.from('stock_transfer_lignes').update({
          quantite_expediee: qte,
          prix_transfert_ht: isInterSociete ? l.prix_transfert_ht : null,
        }).eq('id', l.id)
      }

      // Décrémenter le stock source
      for (const l of lignes) {
        const qte = qteExpediees[l.id] ?? l.quantite_demandee
        if (qte > 0) {
          const { error: errMove } = await supabase.rpc('move_stock', {
            p_product_id: l.product_id, p_site_id: transfert.site_source_id,
            p_raison: 'transfert_out', p_quantite: qte,
            p_note: `Transfert ${transfert.numero} — expédition`, p_order_id: null, p_transfer_id: transfert.id,
          })
          if (errMove) throw new Error(`Stock source : ${errMove.message}`)
        }
      }

      // Générer la facture inter-société si applicable
      let factureId = null
      if (isInterSociete) {
        const totalHT = lignes.reduce((acc, l) => {
          const qte = qteExpediees[l.id] ?? l.quantite_demandee
          return acc + (parseFloat(l.prix_transfert_ht || 0)) * qte
        }, 0)
        const { data: fac, error: errF } = await supabase.from('factures_intersocietes').insert({
          numero: genNumero('FIC'), transfer_id: transfert.id,
          site_emetteur_id: transfert.site_source_id,
          site_destinataire_id: transfert.site_destination_id,
          total_ht: Math.round(totalHT * 100) / 100,
          tva_pct: 20, total_ttc: Math.round(totalHT * 1.20 * 100) / 100,
          statut: 'emise', type: 'facture',
          date_emission: new Date().toISOString().split('T')[0],
        }).select('id').single()
        if (errF) throw new Error(`Facture : ${errF.message}`)
        factureId = fac?.id
      }

      await supabase.from('stock_transfers').update({
        statut: 'expedie',
        expedie_at: new Date().toISOString(),
        facture_intersociete_id: factureId,
      }).eq('id', transfert.id)

      onRefresh()
    } catch (e: any) {
      setError(e.message)
    }
    setProcessing(false)
  }

  // ── Étape 3 : Réception ──
  const handleReceptionner = async () => {
    setProcessing(true); setError('')
    try {
      // Mettre à jour les quantités reçues
      for (const l of lignes) {
        const qte = qteRecues[l.id] ?? l.quantite_expediee
        await supabase.from('stock_transfer_lignes').update({ quantite_recue: qte }).eq('id', l.id)
      }

      // Incrémenter le stock destination avec les quantités réellement reçues
      for (const l of lignes) {
        const qte = qteRecues[l.id] ?? l.quantite_expediee
        if (qte > 0) {
          const { data: stockDest } = await supabase.from('stock').select('quantite')
            .eq('product_id', l.product_id).eq('site_id', transfert.site_destination_id).maybeSingle()
          await supabase.from('stock').upsert({
            product_id: l.product_id, site_id: transfert.site_destination_id,
            quantite: (stockDest?.quantite || 0) + qte,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'product_id,site_id' })
        }
      }

      // Vérifier les écarts si inter-société
      let avoirId = null
      if (isInterSociete) {
        let ecartHT = 0
        for (const l of lignes) {
          const qteExp = l.quantite_expediee ?? l.quantite_demandee
          const qteRec = qteRecues[l.id] ?? qteExp
          const ecart = qteRec - qteExp // positif = reçu plus, négatif = reçu moins
          if (ecart !== 0) {
            ecartHT += parseFloat(l.prix_transfert_ht || 0) * Math.abs(ecart) * (ecart < 0 ? -1 : 1)
          }
        }

        if (Math.abs(ecartHT) > 0.001) {
          const isAvoir = ecartHT < 0 // Reçu moins → avoir
          const montantHT = Math.abs(ecartHT)
          const { data: doc, error: errA } = await supabase.from('factures_intersocietes').insert({
            numero: genNumero(isAvoir ? 'AV' : 'FIC'),
            transfer_id: transfert.id,
            site_emetteur_id: isAvoir ? transfert.site_destination_id : transfert.site_source_id,
            site_destinataire_id: isAvoir ? transfert.site_source_id : transfert.site_destination_id,
            total_ht: Math.round(montantHT * 100) / 100,
            tva_pct: 20, total_ttc: Math.round(montantHT * 1.20 * 100) / 100,
            statut: 'emise', type: isAvoir ? 'avoir' : 'facture',
            date_emission: new Date().toISOString().split('T')[0],
          }).select('id').single()
          if (errA) throw new Error(`Document écart : ${errA.message}`)
          avoirId = doc?.id
        }
      }

      await supabase.from('stock_transfers').update({
        statut: 'recu',
        recu_at: new Date().toISOString(),
        avoir_id: avoirId,
      }).eq('id', transfert.id)

      onRefresh()
    } catch (e: any) {
      setError(e.message)
    }
    setProcessing(false)
  }

  const imprimerDoc = (doc: any, type: 'facture' | 'avoir') => {
    const srcId = doc.site_emetteur_id
    const destId = doc.site_destinataire_id
    const srcNom = sites.find(s => s.id === srcId)?.nom || ''
    const destNom = sites.find(s => s.id === destId)?.nom || ''
    const title = type === 'avoir' ? `AVOIR N° ${doc.numero}` : `FACTURE INTER-SOCIÉTÉ N° ${doc.numero}`
    const html = `<html><head><style>
      body{font-family:Arial,sans-serif;font-size:12px;max-width:210mm;margin:0 auto;padding:20mm}
      .header{display:flex;justify-content:space-between;margin-bottom:30px}
      .title{font-size:20px;font-weight:bold;color:${type === 'avoir' ? '#6B4C4C' : '#8B6914'};margin-bottom:16px}
      .total{text-align:right;margin-top:16px}
      .footer{margin-top:40px;font-size:10px;color:#666;border-top:1px solid #eee;padding-top:10px}
    </style></head><body>
      <div class="header">
        <div><b>${srcNom}</b><br/>Cave de Gilbert SAS<br/>SIRET 898 622 055 00017</div>
        <div style="text-align:right"><b>${destNom}</b><br/>Date : ${doc.date_emission}</div>
      </div>
      <div class="title">${title}</div>
      <div style="margin-bottom:8px;color:#666;font-size:11px">Référence transfert : ${transfert.numero}</div>
      <div class="total">
        <div>Total HT : <b>${parseFloat(doc.total_ht).toFixed(2)} €</b></div>
        <div>TVA 20% : ${(parseFloat(doc.total_ht) * 0.20).toFixed(2)} €</div>
        <div style="font-size:18px;color:${type === 'avoir' ? '#6B4C4C' : '#8B6914'};font-weight:bold;margin-top:8px">Total TTC : ${parseFloat(doc.total_ttc).toFixed(2)} €</div>
      </div>
      <div class="footer">Cave de Gilbert SAS — SIRET 898 622 055 00017 — TVA FR79 898 622 055</div>
    </body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); win.print() }
  }

  const statutColor: Record<string, string> = { demande: '#c9b06e', expedie: '#6e9ec9', recu: '#6ec96e', annule: '#888' }
  const statutLabel: Record<string, string> = { demande: 'Demande', expedie: 'Expédié', recu: 'Réceptionné', annule: 'Annulé' }

  if (loading) return (
    <div>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 16 }}>← Retour</button>
      <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
    </div>
  )

  return (
    <div>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 16 }}>← Retour aux transferts</button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e', marginBottom: 4 }}>{transfert.numero}</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
            {siteSrc?.nom} <span style={{ color: '#c9a96e' }}>→</span> {siteDest?.nom}
          </h1>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>
            {new Date(transfert.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {transfert.notes && ` · ${transfert.notes}`}
          </div>
        </div>
        <span style={{ background: `${statutColor[transfert.statut]}22`, color: statutColor[transfert.statut], fontSize: 11, padding: '4px 12px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase' as const }}>
          {statutLabel[transfert.statut]}
        </span>
        {transfert.statut === 'demande' && (
          <button onClick={() => setShowAjoutProduits(true)}
            style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 4, padding: '8px 14px', fontSize: 11, cursor: 'pointer' }}>
            + Ajouter des produits
          </button>
        )}
      </div>

      {showAjoutProduits && (
        <ModalNouveauTransfert
          sites={sites}
          transfertExistant={transfert}
          onCreated={() => { setShowAjoutProduits(false); load() }}
          onClose={() => setShowAjoutProduits(false)}
        />
      )}

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {[
          { label: '1. Demande', statuts: ['demande', 'expedie', 'recu'] },
          { label: '2. Expédition', statuts: ['expedie', 'recu'] },
          { label: '3. Réception', statuts: ['recu'] },
        ].map((step, i) => {
          const done = step.statuts.includes(transfert.statut)
          const current = (i === 0 && transfert.statut === 'demande') || (i === 1 && transfert.statut === 'expedie') || (i === 2 && transfert.statut === 'recu')
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#6ec96e' : current ? '#c9a96e' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: done ? '#0d0a08' : current ? '#0d0a08' : 'rgba(232,224,213,0.3)', fontWeight: 600, flexShrink: 0 }}>
                  {done && !current ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, color: done ? '#6ec96e' : current ? '#c9a96e' : 'rgba(232,224,213,0.3)', whiteSpace: 'nowrap' as const }}>{step.label}</span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: done && !current ? '#6ec96e' : 'rgba(255,255,255,0.08)', margin: '0 12px' }} />}
            </div>
          )
        })}
      </div>

      {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

      {/* Documents inter-société */}
      {(facture || avoir) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
          {facture && (
            <div style={{ flex: 1, background: 'rgba(201,110,110,0.06)', border: '0.5px solid rgba(201,110,110,0.2)', borderRadius: 6, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c96e6e', marginBottom: 8 }}>FACTURE INTER-SOCIÉTÉ</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#f0e8d8' }}>{facture.numero}</div>
                  <div style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif', marginTop: 4 }}>{parseFloat(facture.total_ttc).toFixed(2)} € TTC</div>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{parseFloat(facture.total_ht).toFixed(2)} € HT + TVA 20%</div>
                </div>
                <button onClick={() => imprimerDoc(facture, 'facture')} style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 4, padding: '8px 14px', fontSize: 11, cursor: 'pointer' }}>🖨 Imprimer</button>
              </div>
            </div>
          )}
          {avoir && (
            <div style={{ flex: 1, background: avoir.type === 'avoir' ? 'rgba(110,158,201,0.06)' : 'rgba(201,110,110,0.06)', border: `0.5px solid ${avoir.type === 'avoir' ? 'rgba(110,158,201,0.2)' : 'rgba(201,110,110,0.2)'}`, borderRadius: 6, padding: '14px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: avoir.type === 'avoir' ? '#6e9ec9' : '#c96e6e', marginBottom: 8 }}>{avoir.type === 'avoir' ? 'AVOIR — ÉCART RÉCEPTION' : 'FACTURE COMPLÉMENTAIRE'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#f0e8d8' }}>{avoir.numero}</div>
                  <div style={{ fontSize: 18, color: avoir.type === 'avoir' ? '#6e9ec9' : '#c9a96e', fontFamily: 'Georgia, serif', marginTop: 4 }}>{parseFloat(avoir.total_ttc).toFixed(2)} € TTC</div>
                </div>
                <button onClick={() => imprimerDoc(avoir, avoir.type)} style={{ background: 'rgba(110,158,201,0.1)', border: '0.5px solid rgba(110,158,201,0.3)', color: '#6e9ec9', borderRadius: 4, padding: '8px 14px', fontSize: 11, cursor: 'pointer' }}>🖨 Imprimer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tableau des lignes */}
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              {['Produit', 'Demandé', transfert.statut !== 'demande' ? 'Expédié' : '', transfert.statut === 'recu' ? 'Reçu' : '', isInterSociete ? 'Prix transfert HT' : ''].filter(Boolean).map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const qteExp = l.quantite_expediee ?? l.quantite_demandee
              const qteRec = l.quantite_recue ?? qteExp
              const ecart = transfert.statut === 'recu' ? qteRec - qteExp : null
              return (
                <tr key={l.id} style={{ borderBottom: i < lignes.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8' }}>{l.product?.nom}{l.product?.millesime ? ` ${l.product.millesime}` : ''}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'rgba(232,224,213,0.6)', fontFamily: 'Georgia, serif' }}>{l.quantite_demandee ?? l.quantite}</td>
                  {transfert.statut !== 'demande' && (
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{l.quantite_expediee ?? '—'}</td>
                  )}
                  {transfert.statut === 'recu' && (
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 13, color: ecart === 0 ? '#6ec96e' : '#c96e6e', fontFamily: 'Georgia, serif' }}>{l.quantite_recue ?? '—'}</span>
                      {ecart !== null && ecart !== 0 && <span style={{ fontSize: 10, color: '#c96e6e', marginLeft: 6 }}>({ecart > 0 ? '+' : ''}{ecart})</span>}
                    </td>
                  )}
                  {isInterSociete && <td style={{ padding: '10px 14px', fontSize: 12, color: '#c96e6e' }}>{l.prix_transfert_ht ? `${parseFloat(l.prix_transfert_ht).toFixed(4)} €` : '—'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action de l'étape courante */}
      {transfert.statut === 'demande' && (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(110,158,201,0.2)', borderRadius: 6, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: '#6e9ec9', marginBottom: 12 }}>ÉTAPE 2 — EXPÉDITION</div>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 16 }}>Ajustez les quantités expédiées si nécessaire, puis confirmez l'expédition. Le stock source sera décrémenté.{isInterSociete && ' La facture inter-société sera générée.'}</p>
          <div style={{ background: '#14100c', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>Produit</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>Demandé</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: '#6e9ec9', fontWeight: 400 }}>Qté à expédier</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: i < lignes.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: '#f0e8d8' }}>{l.product?.nom}{l.product?.millesime ? ` ${l.product.millesime}` : ''}</td>
                    <td style={{ padding: '8px 14px', fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>{l.quantite_demandee ?? l.quantite}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <input type="number" min={0} value={qteExpediees[l.id] ?? l.quantite_demandee ?? l.quantite}
                        onChange={e => setQteExpediees(prev => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                        style={{ width: 70, background: 'rgba(110,158,201,0.08)', border: '0.5px solid rgba(110,158,201,0.3)', borderRadius: 4, color: '#6e9ec9', fontSize: 14, padding: '5px 8px', textAlign: 'center' as const }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleExpedier} disabled={processing} style={{ background: '#6e9ec9', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '12px 24px', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: processing ? 0.7 : 1 }}>
            {processing ? '⟳ Traitement...' : '📦 Confirmer l\'expédition' + (isInterSociete ? ' + générer facture' : '')}
          </button>
        </div>
      )}

      {transfert.statut === 'expedie' && (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(110,201,110,0.2)', borderRadius: 6, padding: '20px 24px' }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: '#6ec96e', marginBottom: 12 }}>ÉTAPE 3 — RÉCEPTION</div>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 16 }}>Saisissez les quantités réellement reçues. Le stock destination sera incrémenté.{isInterSociete && ' Si écart : avoir ou facture complémentaire généré automatiquement.'}</p>
          <div style={{ background: '#14100c', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>Produit</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>Expédié</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: '#6ec96e', fontWeight: 400 }}>Qté reçue</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => {
                  const qteExp = l.quantite_expediee ?? l.quantite_demandee ?? l.quantite
                  const qteRec = qteRecues[l.id] ?? qteExp
                  const ecart = qteRec - qteExp
                  return (
                    <tr key={l.id} style={{ borderBottom: i < lignes.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '8px 14px', fontSize: 13, color: '#f0e8d8' }}>{l.product?.nom}{l.product?.millesime ? ` ${l.product.millesime}` : ''}</td>
                      <td style={{ padding: '8px 14px', fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>{qteExp}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <input type="number" min={0} value={qteRecues[l.id] ?? qteExp}
                          onChange={e => setQteRecues(prev => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                          style={{ width: 70, background: ecart < 0 ? 'rgba(201,110,110,0.08)' : ecart > 0 ? 'rgba(110,201,110,0.08)' : 'rgba(110,201,110,0.08)', border: `0.5px solid ${ecart !== 0 ? '#c96e6e' : 'rgba(110,201,110,0.3)'}`, borderRadius: 4, color: ecart < 0 ? '#c96e6e' : '#6ec96e', fontSize: 14, padding: '5px 8px', textAlign: 'center' as const }} />
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 13, color: ecart === 0 ? '#6ec96e' : '#c96e6e', fontFamily: 'Georgia, serif' }}>
                        {ecart === 0 ? '✓' : `${ecart > 0 ? '+' : ''}${ecart}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button onClick={handleReceptionner} disabled={processing} style={{ background: '#6ec96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '12px 24px', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: processing ? 0.7 : 1 }}>
            {processing ? '⟳ Traitement...' : '✓ Confirmer la réception'}
          </button>
        </div>
      )}

      {transfert.statut === 'recu' && (
        <div style={{ background: 'rgba(110,201,110,0.06)', border: '0.5px solid rgba(110,201,110,0.2)', borderRadius: 6, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>✓</span>
          <div>
            <div style={{ fontSize: 14, color: '#6ec96e', fontWeight: 600 }}>Transfert complété</div>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>
              Réceptionné le {transfert.recu_at ? new Date(transfert.recu_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vue liste des transferts ──────────────────────────────────
function VueTransferts({ sites, onNew, refreshKey }: { sites: any[]; onNew: () => void; refreshKey?: number }) {
  const [transferts, setTransferts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [detail, setDetail] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, source:sites!site_source_id(id, nom), dest:sites!site_destination_id(id, nom)')
      .order('created_at', { ascending: false })
      .limit(100)
    setTransferts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey])

  const filtered = transferts.filter(t => filterStatut === 'tous' || t.statut === filterStatut)

  const statutColor: Record<string, string> = { demande: '#c9b06e', expedie: '#6e9ec9', recu: '#6ec96e', annule: '#888' }
  const statutLabel: Record<string, string> = { demande: 'Demande', expedie: 'Expédié', recu: 'Réceptionné', annule: 'Annulé' }

  if (detail) return (
    <VueDetailTransfert
      transfert={detail}
      sites={sites}
      onBack={() => { setDetail(null); load() }}
      onRefresh={async () => {
        const { data } = await supabase.from('stock_transfers').select('*, source:sites!site_source_id(id, nom), dest:sites!site_destination_id(id, nom)').eq('id', detail.id).single()
        setDetail(data)
        load()
      }}
    />
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Transferts de stock</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>
            {transferts.filter(t => t.statut === 'demande').length} en attente · {transferts.filter(t => t.statut === 'expedie').length} en transit · {transferts.filter(t => t.statut === 'recu').length} complétés
          </p>
        </div>
        <button onClick={onNew} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>+ Nouveau transfert</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['tous', 'Tous'], ['demande', 'Demandes'], ['expedie', 'En transit'], ['recu', 'Complétés'], ['annule', 'Annulés']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatut(val)} style={{
            background: filterStatut === val ? 'rgba(201,169,110,0.15)' : 'transparent',
            border: `0.5px solid ${filterStatut === val ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: filterStatut === val ? '#c9a96e' : 'rgba(232,224,213,0.4)',
            borderRadius: 4, padding: '7px 14px', fontSize: 11, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: 48, textAlign: 'center' as const }}>
          <p style={{ color: 'rgba(232,224,213,0.4)', marginBottom: 16 }}>Aucun transfert.</p>
          <button onClick={onNew} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 12, cursor: 'pointer' }}>+ Nouveau transfert</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {filtered.map(t => (
            <div key={t.id} onClick={() => setDetail(t)}
              style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c9a96e' }}>{t.numero}</span>
                  <span style={{ background: `${statutColor[t.statut] || '#888'}22`, color: statutColor[t.statut] || '#888', fontSize: 10, padding: '2px 8px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase' as const }}>{statutLabel[t.statut] || t.statut}</span>
                  {t.facture_intersociete_id && <span style={{ background: 'rgba(201,110,110,0.1)', color: '#c96e6e', fontSize: 10, padding: '2px 8px', borderRadius: 3 }}>INTER-SOCIÉTÉ</span>}
                </div>
                <div style={{ fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 300 }}>
                  {t.source?.nom} <span style={{ color: '#c9a96e' }}>→</span> {t.dest?.nom}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginTop: 3 }}>
                  {new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {t.notes && ` · ${t.notes}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {t.statut === 'demande' && <span style={{ fontSize: 11, color: '#c9b06e' }}>À expédier →</span>}
                {t.statut === 'expedie' && <span style={{ fontSize: 11, color: '#6e9ec9' }}>À réceptionner →</span>}
                {t.statut === 'recu' && <span style={{ fontSize: 11, color: '#6ec96e' }}>Voir →</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}





// ── Groupe de navigation déroulant ────────────────────────────
function NavGroup({ title, items }: { title: string; items: { href: string; label: string; icon: string }[] }) {
  // État persistant : on mémorise si le menu est ouvert dans localStorage
  const storageKey = `nav-open-${title}`
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(storageKey)
      if (saved !== null) setOpen(saved === '1')
    }
  }, [])
  const toggle = () => {
    setOpen(prev => {
      const v = !prev
      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, v ? '1' : '0')
      return v
    })
  }
  if (items.length === 0) return null
  return (
    <>
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
      <button onClick={toggle} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: 'transparent', border: 'none',
        padding: '4px 20px 8px', fontSize: 9, letterSpacing: 2,
        color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const,
        cursor: 'pointer', textAlign: 'left' as const,
      }}>
        <span>{title}</span>
        <span style={{ fontSize: 11, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
      </button>
      {open && items.map(({ href, label, icon }) => (
        <a key={href} href={href} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 20px', fontSize: 12, letterSpacing: 0.5,
          color: 'rgba(232,224,213,0.45)',
          borderLeft: '2px solid transparent',
          textDecoration: 'none',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#c9a96e'; e.currentTarget.style.background = 'rgba(201,169,110,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,224,213,0.45)'; e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: 14 }}>{icon}</span>{label}
        </a>
      ))}
    </>
  )
}

// ── Modal Changer mot de passe ────────────────────────────────
function ModalChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next1, setNext1] = useState('')
  const [next2, setNext2] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{type: 'err' | 'ok', text: string} | null>(null)

  const inp = { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#f0e8d8', fontSize: 14, padding: '11px 14px', width: '100%', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

  const handleSubmit = async () => {
    setMsg(null)
    if (next1.length < 8) { setMsg({type:'err', text:'Minimum 8 caractères'}); return }
    if (next1 !== next2) { setMsg({type:'err', text:'Les mots de passe ne correspondent pas'}); return }
    setLoading(true)
    // Vérifier mot de passe actuel
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
      if (signErr) { setMsg({type:'err', text:'Mot de passe actuel incorrect'}); setLoading(false); return }
    }
    const { error } = await supabase.auth.updateUser({ password: next1 })
    setLoading(false)
    if (error) { setMsg({type:'err', text: error.message}); return }
    setMsg({type:'ok', text:'Mot de passe mis à jour ✓'})
    setTimeout(onClose, 1500)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, width: '100%', maxWidth: 420, padding: '28px 32px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e', marginBottom: 24 }}>Changer mon mot de passe</div>
        {msg && (
          <div style={{ background: msg.type === 'err' ? 'rgba(201,110,110,0.12)' : 'rgba(110,201,110,0.12)', border: `0.5px solid ${msg.type === 'err' ? 'rgba(201,110,110,0.35)' : 'rgba(110,201,110,0.35)'}`, color: msg.type === 'err' ? '#c96e6e' : '#6ec96e', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{msg.text}</div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Mot de passe actuel</label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} style={inp} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Nouveau mot de passe</label>
          <input type="password" value={next1} onChange={e => setNext1(e.target.value)} style={inp} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={lbl}>Confirmer nouveau mot de passe</label>
          <input type="password" value={next2} onChange={e => setNext2(e.target.value)} style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 8, padding: '11px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
            {loading ? '⟳' : '✓ Mettre à jour'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminPage() {
  const [section, setSection] = useState<Section>('dashboard')

  // IDs des sites (constantes — évite les ambiguïtés)
  const ID_MARCY    = 'ee3afa96-0c45-407f-87fc-e503fbada6c4'
  const ID_ENTREPOT = 'e12d7e47-23dc-4011-95fc-e9e975fc4307'
  const ID_ARBRESLE = '3097e864-f452-4c2e-9af3-21e26f0330b7'

  // Utilisateur connecté + permissions + site
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [permissions, setPermissions] = useState<any>(null)
  const [siteActifId, setSiteActifId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  // Charger l'utilisateur connecté
  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setAuthReady(true); return }

        // 1) Charger le profil utilisateur
        const { data: profile } = await supabase
          .from('users').select('*').eq('auth_user_id', authUser.id).maybeSingle()
        if (!profile) { setAuthReady(true); return }
        setCurrentUser(profile)

        // 2) Charger les permissions (requête séparée plus fiable)
        const { data: perms } = await supabase
          .from('user_permissions').select('*').eq('user_id', profile.id).maybeSingle()
        setPermissions(perms || null)

        // 3) Déterminer le site actif (restriction explicite OU profil employé)
        let siteId: string | null = perms?.site_restreint_id || null
        if (!siteId) {
          const { data: empProfil } = await supabase
            .from('employe_profils').select('site_id').eq('user_id', profile.id).maybeSingle()
          siteId = empProfil?.site_id || null
        }
        setSiteActifId(siteId)
      } finally {
        setAuthReady(true)
      }
    })()
  }, [])

  const isAdmin = currentUser?.role === 'admin'

  // Filtrage du menu — strict une fois la session chargée
  const can = (key: string): boolean => {
    if (!authReady) return false           // tant que pas chargé : on cache tout
    if (isAdmin) return true                // admin : tout autorisé
    if (!currentUser) return false          // pas connu : on cache
    return permissions?.[key] === true
  }

  // Branding dynamique — basé sur l'ID du site (pas un code)
  const isLaPetiteCave = siteActifId === ID_ARBRESLE
  const brandLogo = isLaPetiteCave ? '/logo-petite-cave.png' : '/logo.png'
  const brandName = isLaPetiteCave ? 'La Petite Cave' : 'Cave de Gilbert'


  // Données réelles depuis Supabase
  const [produits, setProduits] = useState<any[]>([])
  const [stockParSite, setStockParSite] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [dashKpis, setDashKpis] = useState<{
    valeurStock: number
    caParSite: Record<string, number>
    caTotal: number
    nbVentesParSite: Record<string, number>
  }>({ valeurStock: 0, caParSite: {}, caTotal: 0, nbVentesParSite: {} })

  const [alertes, setAlertes] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [appellations, setAppellations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showModalProduit, setShowModalProduit] = useState(false)
  const [showNouveauProduit, setShowNouveauProduit] = useState(false)
  const [dupliquerProduit, setDupliquerProduit] = useState<any>(null)
  const [showModalMouvement, setShowModalMouvement] = useState(false)
  const [showModalTransfert, setShowModalTransfert] = useState(false)
  const [transfertRefresh, setTransfertRefresh] = useState(0)
  const [selectedProduit, setSelectedProduit] = useState<any>(null)
  const [activeCategorie, setActiveCategorie] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterAppellation, setFilterAppellation] = useState('')
  const [filterCouleur, setFilterCouleur] = useState('')
  const [filterPrixMax, setFilterPrixMax] = useState<number>(500)
  const [filterPrixMin, setFilterPrixMin] = useState<number>(0)
  const [prixMaxCatalogue, setPrixMaxCatalogue] = useState<number>(500)
  const [filterMillesime, setFilterMillesime] = useState('')
  const [filterCertif, setFilterCertif] = useState('')
  const [filterActif, setFilterActif] = useState<'tous' | 'actif' | 'inactif'>('actif')
  const [filterDomaine, setFilterDomaine] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [sortCol, setSortCol] = useState<string>('nom')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sortIcon = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ·'

  // ── Chargement des données ───────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: prods },
        { data: stock },
        { data: sitesData },
      ] = await Promise.all([
        supabase.from('products').select('id, nom, nom_cuvee, contenance, millesime, couleur, categorie, prix_vente_ttc, prix_vente_pro, prix_achat_ht, actif, visible_boutique, bio, vegan, casher, naturel, biodynamique, ia_generated, domaine_id, slug, region_id, appellation_id, description_courte, image_url').order('nom').limit(5000),
        supabase.from('v_stock_agrege').select('*').range(0, 9999),
        supabase.from('sites').select('*').eq('actif', true).order('nom'),
      ])

      // Charger domaines pour affichage
      const { data: domainesData } = await supabase.from('domaines').select('id, nom')
      const domaineMap = Object.fromEntries((domainesData || []).map((d: any) => [d.id, d.nom]))
      const prodsWithDomaine = (prods || []).map((p: any) => ({ ...p, domaine_nom: domaineMap[p.domaine_id] || '' }))
      setProduits(prodsWithDomaine)
      if (prods && prods.length > 0) {
        const maxP = Math.ceil(Math.max(...prods.map((p: any) => parseFloat(p.prix_vente_ttc || 0))))
        setPrixMaxCatalogue(maxP)
        setFilterPrixMax(maxP)
      }
      setStockParSite(stock || [])
      setSites(sitesData || [])

      // ── KPIs dashboard ─────────────────────────────────────
      const now = new Date()
      const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const { data: ventesData } = await supabase
        .from('ventes')
        .select('total_ttc, site_id')
        .eq('statut', 'validee')
        .neq('statut_paiement', 'non_regle')
        .gte('created_at', debutMois)
        .lte('created_at', finMois)

      const caParSite: Record<string, number> = {}
      const nbVentesParSite: Record<string, number> = {}
      ;(ventesData || []).forEach((v: any) => {
        caParSite[v.site_id] = (caParSite[v.site_id] || 0) + parseFloat(v.total_ttc || 0)
        nbVentesParSite[v.site_id] = (nbVentesParSite[v.site_id] || 0) + 1
      })
      const caTotal = Object.values(caParSite).reduce((a, b) => a + b, 0)

      // Valeur stock = stock_total × prix_achat_ht par produit
      const { data: stockValeur } = await supabase
        .from('v_stock_agrege')
        .select('product_id, stock_total')
        .range(0, 9999)
      const prixMap = Object.fromEntries((prods || []).map((p: any) => [p.id, parseFloat(p.prix_achat_ht || 0)]))
      const valeurStock = (stockValeur || []).reduce((acc: number, s: any) => {
        return acc + (s.stock_total || 0) * (prixMap[s.product_id] || 0)
      }, 0)

      setDashKpis({ valeurStock, caParSite, caTotal, nbVentesParSite })

      // Alertes : grouper par produit et sommer tous les sites (vins uniquement)
      const couleursVin = new Set(['rouge', 'blanc', 'rosé', 'champagne', 'effervescent'])
      const produitsVin = new Set((prods || []).filter((p: any) => couleursVin.has(p.couleur)).map((p: any) => p.id))
      
      const stockParProduit: Record<string, any> = {}
      ;(stock || []).forEach((s: any) => {
        if (!produitsVin.has(s.product_id)) return
        const produit = (prods || []).find((p: any) => p.id === s.product_id)
        stockParProduit[s.product_id] = {
          product_id: s.product_id,
          produit: produit?.nom || s.product_id,
          millesime: produit?.millesime || null,
          quantite: s.stock_total || 0,
        }
      })
      // Seuil d'alerte : total < 6 bouteilles = alerte, total = 0 = rupture
      const alertesData = Object.values(stockParProduit)
        .filter((p: any) => p.quantite <= 6)
        .map((p: any) => ({
          ...p,
          site: 'Tous sites',
          stock_statut: p.quantite === 0 ? 'rupture' : 'alerte',
        }))
        .sort((a: any, b: any) => a.quantite - b.quantite)
      setAlertes(alertesData)

    } catch (e) {
      console.error('Erreur chargement données:', e)
    } finally {
      setLoading(false)
    }

    // Charger régions et appellations séparément (ne bloque pas le reste)
    try {
      const [{ data: regs }, { data: apps }] = await Promise.all([
        supabase.from('regions').select('id, nom').order('nom'),
        supabase.from('appellations').select('id, nom, region_id, type').order('nom'),
      ])
      setRegions(regs || [])
      setAppellations(apps || [])
    } catch (e) {
      console.error('Erreur chargement régions:', e)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Stats dashboard ──────────────────────────────────────

  const stats = {
    references: produits.filter(p => p.actif).length,
    stockTotal: stockParSite.reduce((acc: number, s: any) => acc + (s.stock_total || 0), 0),
    ruptures: stockParSite.filter((s: any) => s.stock_total === 0).length,
  }

  // ── Regroupement stock par produit et site ───────────────

  const sitesUniques = ['Cave de Gilbert', 'Entrepôt', 'La Petite Cave']

  const stockGroupé = produits.map(p => {
    const agrege = stockParSite.find((s: any) => s.product_id === p.id)
    return {
      ...p,
      parSite: {
        'Cave de Gilbert': agrege?.stock_marcy || 0,
        'Entrepôt': agrege?.stock_entrepot || 0,
        'La Petite Cave': agrege?.stock_arbresle || 0,
      }
    }
  })

  const appellationsFiltered = filterRegion
    ? appellations.filter(a => a.region_id === filterRegion)
    : appellations

  const categorieActive = CATEGORIES.find(c => c.id === section)?.cat || null

  const produitsFiltres = produits
    .filter(p =>
      p.nom?.toLowerCase().includes(search.toLowerCase()) &&
      (categorieActive ? p.categorie === categorieActive : !CATEGORIES.map(c => c.cat).includes(p.categorie)) &&
      (filterRegion === '' || p.region_id === filterRegion) &&
      (filterAppellation === '' || p.appellation_id === filterAppellation) &&
      (filterCouleur === '' || p.couleur === filterCouleur) &&
      (filterDomaine === '' || p.domaine_id === filterDomaine) &&
      (parseFloat(p.prix_vente_ttc || 0) >= filterPrixMin) &&
      (parseFloat(p.prix_vente_ttc || 0) <= filterPrixMax) &&
      (filterMillesime === '' || String(p.millesime || '') === filterMillesime) &&
      (filterCertif === '' || p[filterCertif] === true) &&
      (filterActif === 'tous' || (filterActif === 'actif' ? p.actif : !p.actif))
    )
    .sort((a, b) => {
      // Tri sur stock d'un site spécifique
      if (sortCol.startsWith('stock_')) {
        const colMap: Record<string, string> = {
          'stock_Cave de Gilbert': 'stock_marcy',
          'stock_Entrepôt': 'stock_entrepot',
          'stock_La Petite Cave': 'stock_arbresle',
          'stock_total': 'stock_total',
        }
        const col = colMap[sortCol] || 'stock_total'
        const qa = stockParSite.find((s: any) => s.product_id === a.id)?.[col] || 0
        const qb = stockParSite.find((s: any) => s.product_id === b.id)?.[col] || 0
        return sortDir === 'asc' ? qa - qb : qb - qa
      }
      if (sortCol === 'stock_total') {
        const qa = stockParSite.find((s: any) => s.product_id === a.id)?.stock_total || 0
        const qb = stockParSite.find((s: any) => s.product_id === b.id)?.stock_total || 0
        return sortDir === 'asc' ? qa - qb : qb - qa
      }
      let va = (a as any)[sortCol] ?? ''
      let vb = (b as any)[sortCol] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  // ── Navigation ───────────────────────────────────────────

  const navItemsAll: { id: Section; label: string; icon: string; perm: string }[] = [
    { id: 'dashboard',  label: 'Tableau de bord',  icon: '⬡', perm: 'acces_dashboard' },
    { id: 'produits',   label: 'Produits',          icon: '⬥', perm: 'acces_produits' },
    { id: 'transferts', label: 'Transferts',        icon: '⇄', perm: 'acces_transferts' },
  ]
  const navItems = navItemsAll.filter(n => can(n.perm))

  const [produitsOpen, setProduitsOpen] = useState(false)

  const navLinksAll = [
    { label: 'Clients',       href: '/admin/clients',       icon: '◎',  groupe: 'gestion', perm: 'acces_clients' },
    { label: 'Fournisseurs',  href: '/admin/fournisseurs',  icon: '◈',  groupe: 'gestion', perm: 'acces_fournisseurs' },
    { label: 'Commandes',     href: '/admin/commandes',     icon: '◻',  groupe: 'gestion', perm: 'acces_commandes' },
    { label: 'Inventaire',    href: '/admin/inventaire',    icon: '◉',  groupe: 'gestion', perm: 'acces_inventaire' },
    { label: 'Assistant IA',  href: '/admin/ia',            icon: '✦',  groupe: 'gestion', perm: 'acces_assistant_ia' },
    { label: 'Location',      href: '/admin/location',      icon: '🍺', groupe: 'gestion', perm: 'acces_location' },
    { label: 'Import',        href: '/admin/import',        icon: '↑',  groupe: 'gestion', perm: 'acces_import' },
    { label: 'Comptabilité',  href: '/admin/comptabilite',  icon: '€',  groupe: 'outils',  perm: 'acces_comptabilite' },
    { label: 'Suivi paiements', href: '/admin/paiements',   icon: '💳', groupe: 'outils',  perm: 'acces_comptabilite' },
    { label: 'Statistiques',  href: '/admin/statistiques',  icon: '📊', groupe: 'outils',  perm: 'acces_statistiques' },
    { label: 'Congés',        href: '/admin/conges',        icon: '🏖', groupe: 'rh',      perm: 'acces_conges' },
    { label: 'Planning',      href: '/admin/rh/planning',   icon: '📅', groupe: 'rh',      perm: 'acces_planning' },
    { label: 'Documents',     href: '/admin/rh/documents',  icon: '📂', groupe: 'rh',      perm: 'acces_documents' },
    { label: 'Utilisateurs',  href: '/admin/rh/utilisateurs', icon: '👤', groupe: 'rh',    perm: 'acces_utilisateurs' },
  ]
  const navLinks = navLinksAll.filter(n => can(n.perm))

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px',
  } as const

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' as const, padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 100 }}>
        <div style={{ padding: '0 20px 28px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          {/* Logo — remplacez /logo.png par votre fichier dans le dossier public/ */}
          <a href="/" style={{ display: 'block', marginBottom: 10 }}>
            <img
              src={brandLogo}
              alt={brandName}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              style={{ width: '100%', maxHeight: 60, objectFit: 'contain', cursor: 'pointer' }}
            />
          </a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>{brandName}</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </div>
        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' as const }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(232,224,213,0.25)', padding: '4px 20px 8px', textTransform: 'uppercase' as const }}>Catalogue & Stock</div>
          {navItems.map(({ id, label, icon }) => (
            <div key={id}>
              <button onClick={() => {
                if (id === 'produits') { setProduitsOpen(o => !o) }
                else { setSection(id) }
              }} style={{
                width: '100%', textAlign: 'left' as const,
                background: (section === id || (id === 'produits' && CATEGORIES.some(c => c.id === section))) ? 'rgba(201,169,110,0.08)' : 'transparent',
                borderLeft: '2px solid transparent',
                border: 'none', borderLeftStyle: 'solid' as const,
                color: (section === id || (id === 'produits' && CATEGORIES.some(c => c.id === section))) ? '#c9a96e' : 'rgba(232,224,213,0.45)',
                padding: '10px 20px', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, letterSpacing: 0.5,
              }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {id === 'produits' && <span style={{ fontSize: 10, opacity: 0.5 }}>{produitsOpen ? '▾' : '▸'}</span>}
              </button>
              {id === 'produits' && produitsOpen && (
                <div style={{ background: 'rgba(0,0,0,0.2)' }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => { setSection(cat.id as Section); setActiveCategorie(cat.cat) }}
                      style={{
                        width: '100%', textAlign: 'left' as const,
                        background: section === cat.id ? 'rgba(201,169,110,0.1)' : 'transparent',
                        borderLeft: `2px solid ${section === cat.id ? '#c9a96e' : 'transparent'}`,
                        border: 'none', borderLeftStyle: 'solid' as const,
                        color: section === cat.id ? '#c9a96e' : 'rgba(232,224,213,0.35)',
                        padding: '8px 20px 8px 36px', fontSize: 11, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                      <span>{cat.icon}</span>{cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <NavGroup title="Gestion" items={navLinks.filter(l => l.groupe === 'gestion')} />
          <NavGroup title="Outils" items={navLinks.filter(l => l.groupe === 'outils')} />
          <NavGroup title="Ressources Humaines" items={navLinks.filter(l => l.groupe === 'rh')} />
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none', letterSpacing: 1 }}>← Voir le site</a>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
            {currentUser && (
              <>
                <div style={{ fontSize: 12, color: '#e8e0d5', fontWeight: 600 }}>{currentUser.prenom}</div>
                <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', textTransform: 'capitalize' as const, marginBottom: 8 }}>{currentUser.role}</div>
                <button onClick={() => setShowPasswordModal(true)} style={{
                  display: 'block', width: '100%', marginBottom: 6,
                  background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)',
                  color: 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '6px 10px',
                  fontSize: 10, cursor: 'pointer', letterSpacing: 1, textAlign: 'left' as const,
                }}>🔑 Changer mot de passe</button>
              </>
            )}
            <button onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }} style={{
              display: 'block', width: '100%',
              background: 'transparent', border: '0.5px solid rgba(201,110,110,0.25)',
              color: 'rgba(201,110,110,0.7)', borderRadius: 4, padding: '6px 10px',
              fontSize: 10, cursor: 'pointer', letterSpacing: 1, textAlign: 'left' as const,
            }}>⎋ Déconnexion</button>
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', maxWidth: 'calc(100vw - 220px)' }}>

        {/* Bouton retour pour les sous-sections */}
        {section !== 'dashboard' && (
          <button onClick={() => setSection('dashboard')} style={{
            background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
            color: 'rgba(232,224,213,0.6)', fontSize: 12, cursor: 'pointer',
            padding: '7px 14px', marginBottom: 24, borderRadius: 4,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            ← Tableau de bord
          </button>
        )}

        {/* ── DASHBOARD ── */}
        {section === 'dashboard' && (
          <>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 6 }}>Tableau de bord</h1>
            <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 32 }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            {loading ? <Spinner /> : (
              <>
                {/* KPIs ligne 1 — stock */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                  {([
                    { label: 'Références actives', value: stats.references.toLocaleString('fr-FR'), color: '#c9a96e' },
                    { label: 'Stock total (btl)', value: stats.stockTotal.toLocaleString('fr-FR'), color: '#6ec9a0' },
                    { label: 'Valeur stock HT', value: dashKpis.valeurStock.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €', color: '#6e9ec9' },
                  ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
                    <div key={label} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px 22px' }}>
                      <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 10 }}>{label}</div>
                      <div style={{ fontSize: 32, color, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* KPIs ligne 2 — CA mois en cours */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 12 }}>
                    CA {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sites.length + 1, 4)}, 1fr)`, gap: 12 }}>
                    {([
                      { label: 'Total', siteId: null as string | null, color: '#c9a96e' },
                      ...sites.map((s: any) => ({ label: s.nom, siteId: s.id as string | null, color: '#6ec9a0' })),
                    ]).map(({ label, siteId, color }) => {
                      const ca = siteId ? (dashKpis.caParSite[siteId] || 0) : dashKpis.caTotal
                      const nb = siteId ? (dashKpis.nbVentesParSite[siteId] || 0) : Object.values(dashKpis.nbVentesParSite).reduce((a: number, b: number) => a + b, 0)
                      return (
                        <div key={label} style={{ background: '#18130e', border: `0.5px solid ${!siteId ? 'rgba(201,169,110,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 6, padding: '16px 20px' }}>
                          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 8 }}>{label}</div>
                          <div style={{ fontSize: 26, color, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{ca.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</div>
                          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 4 }}>{nb} vente{nb > 1 ? 's' : ''}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Alertes */}
                {alertes.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 14 }}>Alertes stock</h2>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                      {alertes.slice(0, 10).map((a: any) => (
                        <div key={a.product_id + a.site_id} style={{
                          background: a.stock_statut === 'rupture' ? 'rgba(201,110,110,0.08)' : 'rgba(201,176,110,0.08)',
                          border: `0.5px solid ${a.stock_statut === 'rupture' ? 'rgba(201,110,110,0.2)' : 'rgba(201,176,110,0.2)'}`,
                          borderRadius: 5, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.stock_statut === 'rupture' ? '#c96e6e' : '#c9b06e', display: 'inline-block' }} />
                            <span style={{ fontSize: 13 }}>{a.produit}{a.millesime ? ` ${a.millesime}` : ''}</span>
                            <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{a.site}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 12, color: a.stock_statut === 'rupture' ? '#c96e6e' : '#c9b06e' }}>
                              {a.quantite === 0 ? 'Rupture' : `${a.quantite} bouteille${a.quantite > 1 ? 's' : ''}`}
                            </span>
                            <button onClick={async (e) => {
                              e.stopPropagation()
                              const btn = e.currentTarget
                              btn.disabled = true
                              btn.textContent = '⟳'
                              const { data: existing } = await supabase.from('order_needs').select('id').eq('product_id', a.product_id).eq('statut', 'en_attente').maybeSingle()
                              if (existing) { btn.textContent = '✓ Déjà ajouté'; btn.style.color = '#6ec96e'; return }
                              const { data: ps } = await supabase.from('product_suppliers').select('domaine_id, prix_achat_ht, conditionnement').eq('product_id', a.product_id).eq('fournisseur_principal', true).maybeSingle()
                              await supabase.from('order_needs').insert({ product_id: a.product_id, domaine_id: ps?.domaine_id || null, quantite: ps?.conditionnement || 6, prix_achat_ht: ps?.prix_achat_ht || 0, statut: 'en_attente' })
                              btn.textContent = '✓ Ajouté'
                              btn.style.color = '#6ec96e'
                              btn.style.borderColor = 'rgba(110,201,110,0.3)'
                            }} style={{
                              background: 'transparent',
                              border: `0.5px solid ${a.stock_statut === 'rupture' ? 'rgba(201,110,110,0.3)' : 'rgba(201,176,110,0.3)'}`,
                              color: a.stock_statut === 'rupture' ? '#c96e6e' : '#c9b06e',
                              borderRadius: 4, padding: '4px 10px', fontSize: 10,
                              cursor: 'pointer', whiteSpace: 'nowrap' as const,
                            }}>+ Besoins</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raccourci Location */}
                <div style={{ marginBottom: 24 }}>
                  <a href="/admin/location" style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#18130e', border: '0.5px solid rgba(201,169,110,0.15)', borderRadius: 6, padding: '16px 20px', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.15)')}>
                    <span style={{ fontSize: 24 }}>🍺</span>
                    <div>
                      <div style={{ fontSize: 14, color: '#c9a96e', marginBottom: 2 }}>Location tireuses & fûts</div>
                      <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Réservations, stock fûts, commandes La Loupiote, consignes</div>
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'rgba(232,224,213,0.3)', fontSize: 18 }}>→</span>
                  </a>
                </div>

                {alertes.length === 0 && produits.length === 0 && (
                  <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.15)', borderRadius: 6, padding: '32px', textAlign: 'center' as const }}>
                    <p style={{ color: '#c9a96e', fontSize: 16, fontFamily: 'Georgia, serif', marginBottom: 8 }}>Base de données connectée ✓</p>
                    <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 13, marginBottom: 20 }}>Votre catalogue est vide. Ajoutez votre premier vin pour commencer.</p>
                    <button onClick={() => { setSection('produits'); setShowModalProduit(true) }} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
                      ✦ Ajouter mon premier vin
                    </button>
                  </div>
                )}


              </>
            )}
          </>
        )}

        {/* ── PRODUITS ── */}
        {(section === 'produits' || CATEGORIES.some(c => c.id === section)) && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>
                  {categorieActive ? CATEGORIES.find(c => c.cat === categorieActive)?.icon + ' ' + CATEGORIES.find(c => c.cat === categorieActive)?.label : 'Catalogue'}
                </h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{produitsFiltres.length} référence{produitsFiltres.length > 1 ? 's' : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* Toggle actif/inactif */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 4, border: '0.5px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  {([['actif', 'Actifs'], ['inactif', 'Inactifs'], ['tous', 'Tous']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setFilterActif(val)} style={{
                      background: filterActif === val ? 'rgba(201,169,110,0.15)' : 'transparent',
                      color: filterActif === val ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                      border: 'none', borderRight: val !== 'tous' ? '0.5px solid rgba(255,255,255,0.08)' : 'none',
                      padding: '8px 14px', fontSize: 11, cursor: 'pointer',
                    }}>{label}</button>
                  ))}
                </div>
                <button onClick={() => setShowNouveauProduit(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.4)', color: '#c9a96e', borderRadius: 4, padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
                  + Nouveau produit
                </button>
                <button onClick={() => setShowModalProduit(true)} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
                  ✦ Ajouter par IA
                </button>
              </div>
            </div>

            {/* Barre de recherche */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' as const }}>
              <input placeholder="🔍 Rechercher un vin..." value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} style={{ flex: '2 1 200px', ...inputStyle, boxSizing: 'border-box' as const }} />
              <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setFilterAppellation(''); setPage(0) }} style={{ flex: '1 1 150px', ...inputStyle, background: '#1a1408', cursor: 'pointer' }}>
                <option value="">Toutes les régions</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
              <select value={filterAppellation} onChange={e => setFilterAppellation(e.target.value)} style={{ flex: '1 1 180px', ...inputStyle, background: '#1a1408', cursor: 'pointer' }}>
                <option value="">Toutes les appellations</option>
                {(() => { const apps = filterRegion ? appellations.filter(a => a.region_id === filterRegion) : appellations; return (<>{apps.filter(a => !a.type || a.type === 'AOC').length > 0 && <optgroup label="── AOC / AOP ──">{apps.filter(a => !a.type || a.type === 'AOC').map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>}{apps.filter(a => a.type === 'IGP').length > 0 && <optgroup label="── IGP ──">{apps.filter(a => a.type === 'IGP').map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>}</>)})()}
              </select>
              <select value={filterDomaine} onChange={e => { setFilterDomaine(e.target.value); setPage(0) }}
                style={{ background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 4, color: filterDomaine ? '#c9a96e' : '#f0e8d8', fontSize: 12, padding: '8px 10px', cursor: 'pointer' }}>
                <option value="">Tous les fournisseurs</option>
                {[...new Map(produits.filter((p: any) => p.domaine_id && p.domaine_nom).map((p: any) => [p.domaine_id, p.domaine_nom])).entries()].sort((a: any, b: any) => a[1].localeCompare(b[1])).map(([id, nom]: any) => (
                  <option key={id} value={id}>{nom}</option>
                ))}
              </select>
            </div>

            {/* Filtres couleur + prix */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
              {/* Filtre couleur */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {[
                  { key: '', label: 'Toutes', bg: 'rgba(255,255,255,0.06)', color: '#e8e0d5' },
                  { key: 'rouge', label: 'Rouge', bg: '#7b1e1e', color: '#f5d0d0' },
                  { key: 'blanc', label: 'Blanc', bg: '#b8a96a', color: '#1a1408' },
                  { key: 'rosé', label: 'Rosé', bg: '#c97b7b', color: '#1a0808' },
                  { key: 'champagne', label: 'Champagne', bg: '#c9b06e', color: '#1a0e00' },
                  { key: 'effervescent', label: 'Effervescent', bg: '#8888aa', color: '#f0f0ff' },
                  { key: 'spiritueux', label: 'Spiritueux', bg: '#6e8b6e', color: '#0a1a0a' },
                ].map(({ key, label, bg, color }) => (
                  <button key={key} onClick={() => setFilterCouleur(key)} style={{
                    background: filterCouleur === key ? bg : 'rgba(255,255,255,0.04)',
                    color: filterCouleur === key ? color : 'rgba(232,224,213,0.45)',
                    border: `0.5px solid ${filterCouleur === key ? bg : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 20, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
                    fontWeight: filterCouleur === key ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>{label}</button>
                ))}
              </div>

              {/* Filtre prix */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', whiteSpace: 'nowrap' as const }}>Prix TTC :</span>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, minWidth: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{filterPrixMin}€</span>
                    <span style={{ fontSize: 11, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{filterPrixMax}€</span>
                  </div>
                  <div style={{ position: 'relative' as const, height: 20, display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute' as const, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }} />
                    <div style={{
                      position: 'absolute' as const,
                      left: `${(filterPrixMin / prixMaxCatalogue) * 100}%`,
                      right: `${100 - (filterPrixMax / prixMaxCatalogue) * 100}%`,
                      height: 3, background: '#c9a96e', borderRadius: 2,
                    }} />
                    <input type="range" min={0} max={prixMaxCatalogue} value={filterPrixMin}
                      onChange={e => setFilterPrixMin(Math.min(parseInt(e.target.value), filterPrixMax - 1))}
                      style={{ position: 'absolute' as const, width: '100%', opacity: 0, cursor: 'pointer', zIndex: 2, height: 20 }}
                    />
                    <input type="range" min={0} max={prixMaxCatalogue} value={filterPrixMax}
                      onChange={e => setFilterPrixMax(Math.max(parseInt(e.target.value), filterPrixMin + 1))}
                      style={{ position: 'absolute' as const, width: '100%', opacity: 0, cursor: 'pointer', zIndex: 3, height: 20 }}
                    />
                  </div>
                  <style>{`input[type=range]::-webkit-slider-thumb { width: 14px; height: 14px; border-radius: 50%; background: #c9a96e; cursor: pointer; -webkit-appearance: none; }`}</style>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', whiteSpace: 'nowrap' as const }}>max {prixMaxCatalogue}€</span>
              </div>
            </div>

            {/* Filtres millésime + certifications */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
              {/* Filtre millésime */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', whiteSpace: 'nowrap' as const }}>Millésime :</span>
                <select value={filterMillesime} onChange={e => setFilterMillesime(e.target.value)} style={{ background: '#1a1408', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}>
                  <option value="">Tous</option>
                  {[...new Set(produits.map(p => p.millesime).filter(Boolean))].sort((a, b) => b - a).map(m => (
                    <option key={m} value={String(m)}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Filtre certifications */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', whiteSpace: 'nowrap' as const }}>Certification :</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: '', label: 'Toutes' },
                    { key: 'bio', label: '🌿 Bio' },
                    { key: 'vegan', label: '🌱 Vegan' },
                    { key: 'casher', label: '✡ Casher' },
                    { key: 'naturel', label: '🍃 Naturel' },
                    { key: 'biodynamique', label: '🌙 Biodynamique' },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setFilterCertif(key)} style={{
                      background: filterCertif === key ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `0.5px solid ${filterCertif === key ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: filterCertif === key ? '#c9a96e' : 'rgba(232,224,213,0.4)',
                      borderRadius: 20, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Résumé filtres actifs + bouton effacer */}
            {(filterRegion || filterAppellation || filterCouleur || filterPrixMin > 0 || filterPrixMax < prixMaxCatalogue || filterMillesime || filterCertif) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>
                  {produitsFiltres.length} résultat{produitsFiltres.length > 1 ? 's' : ''}
                  {filterCouleur && ` · ${filterCouleur}`}
                  {filterMillesime && ` · ${filterMillesime}`}
                  {filterCertif && ` · ${filterCertif}`}
                  {filterPrixMin > 0 || filterPrixMax < prixMaxCatalogue ? ` · ${filterPrixMin}€ – ${filterPrixMax}€` : ''}
                </span>
                <button onClick={() => {
                  setFilterRegion(''); setFilterAppellation(''); setFilterCouleur('')
                  setFilterPrixMin(0); setFilterPrixMax(prixMaxCatalogue)
                  setFilterMillesime(''); setFilterCertif('')
                }} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                  ✕ Effacer les filtres
                </button>
              </div>
            )}

            {loading ? <Spinner /> : produits.length === 0 ? (
              <Empty message="Aucun produit dans la base. Cliquez sur « Ajouter par IA » pour commencer." />
            ) : (
              <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                      {[
                        { label: 'Produit', col: 'nom' },
                        { label: 'Couleur', col: 'couleur' },
                        { label: 'Millésime', col: 'millesime' },
                        { label: 'Prix', col: 'prix_vente_ttc' },
                        ...sitesUniques.map(s => ({ label: s, col: `stock_${s}` })),
                        { label: 'Total', col: 'stock_total' },
                        { label: 'En ligne', col: 'visible_boutique' },
                        { label: 'Statut', col: 'actif' },
                        { label: '', col: null },
                      ].map(({ label, col }) => (
                        <th key={label} onClick={col ? () => handleSort(col) : undefined} style={{
                          padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5,
                          color: col && sortCol === col ? '#c9a96e' : 'rgba(232,224,213,0.3)',
                          textTransform: 'uppercase' as const, fontWeight: 400,
                          cursor: col ? 'pointer' : 'default',
                          userSelect: 'none' as const,
                        }}>
                          {label}{col ? sortIcon(col) : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {produitsFiltres.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((p, i) => (
                      <tr key={p.id} onClick={() => setSelectedProduit(p)} style={{ borderBottom: i < produitsFiltres.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', opacity: p.actif ? 1 : 0.5, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 13, color: '#f0e8d8', marginBottom: 2 }}>
                            {p.nom}
                            {p.bio && <span title="Bio" style={{ marginLeft: 6, fontSize: 12 }}>🌿</span>}
                          </div>
                          {p.domaine_nom && <div style={{ fontSize: 11, color: 'rgba(201,169,110,0.5)', marginBottom: 1 }}>{p.domaine_nom}</div>}
                          {p.ia_generated && <span style={{ fontSize: 9, color: 'rgba(175,169,236,0.6)', letterSpacing: 1 }}>✦ IA</span>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <Badge label={COULEUR_STYLE[p.couleur]?.label || p.couleur} bg={COULEUR_STYLE[p.couleur]?.bg || '#333'} color={COULEUR_STYLE[p.couleur]?.color || '#fff'} />
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: 13, color: 'rgba(232,224,213,0.6)' }}>{p.millesime || '—'}</td>
                        <td style={{ padding: '14px 16px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{p.prix_vente_ttc}€</td>
                        {sitesUniques.map(site => {
                          const agrege = stockParSite.find((s: any) => s.product_id === p.id)
                          const qty = site === 'Cave de Gilbert' ? (agrege?.stock_marcy || 0)
                            : site === 'Entrepôt' ? (agrege?.stock_entrepot || 0)
                            : (agrege?.stock_arbresle || 0)
                          return (
                            <td key={site} style={{ padding: '14px 16px' }}>
                              <StockDot qty={qty} />
                            </td>
                          )
                        })}
                        <td style={{ padding: '14px 16px' }}>
                          <StockDot qty={stockParSite.find((s: any) => s.product_id === p.id)?.stock_total || 0} />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              await supabase.from('products').update({ visible_boutique: !p.visible_boutique }).eq('id', p.id)
                              loadData()
                            }}
                            title={p.visible_boutique ? 'Retirer de la boutique en ligne' : 'Publier sur la boutique en ligne'}
                            style={{
                              background: p.visible_boutique ? 'rgba(110,201,176,0.15)' : 'transparent',
                              border: `0.5px solid ${p.visible_boutique ? 'rgba(110,201,176,0.4)' : 'rgba(255,255,255,0.12)'}`,
                              color: p.visible_boutique ? '#6ec9b0' : 'rgba(232,224,213,0.4)',
                              borderRadius: 4, padding: '5px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const,
                            }}
                          >
                            {p.visible_boutique ? '🌐 En ligne' : '○ Hors ligne'}
                          </button>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <Badge label={p.actif ? 'Actif' : 'Inactif'} bg={p.actif ? '#1e2a1e' : '#2a2a2a'} color={p.actif ? '#6ec96e' : '#888'} />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={async (e) => {
                              e.stopPropagation()
                              await supabase.from('products').update({ actif: !p.actif }).eq('id', p.id)
                              loadData()
                            }} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '5px 10px', fontSize: 10, cursor: 'pointer' }}>
                              {p.actif ? 'Désactiver' : 'Activer'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDupliquerProduit(p) }} title="Dupliquer ce produit" style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.2)', color: 'rgba(201,169,110,0.5)', borderRadius: 3, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>⧉</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {produitsFiltres.length > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 16px', background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, produitsFiltres.length)} sur {produitsFiltres.length} produits
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => setPage(0)} disabled={page === 0} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: page === 0 ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '6px 10px', fontSize: 11, cursor: page === 0 ? 'default' : 'pointer' }}>«</button>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: page === 0 ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: page === 0 ? 'default' : 'pointer' }}>‹ Précédent</button>
                  {Array.from({ length: Math.ceil(produitsFiltres.length / PAGE_SIZE) }, (_, i) => i).map(i => (
                    <button key={i} onClick={() => setPage(i)} style={{ background: page === i ? '#c9a96e' : 'transparent', color: page === i ? '#0d0a08' : 'rgba(232,224,213,0.4)', border: `0.5px solid ${page === i ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, borderRadius: 4, padding: '6px 11px', fontSize: 11, cursor: 'pointer', fontWeight: page === i ? 600 : 400 }}>{i + 1}</button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1, p + 1))} disabled={page >= Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: page >= Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1 ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: page >= Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1 ? 'default' : 'pointer' }}>Suivant ›</button>
                  <button onClick={() => setPage(Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1)} disabled={page >= Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: page >= Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1 ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '6px 10px', fontSize: 11, cursor: page >= Math.ceil(produitsFiltres.length / PAGE_SIZE) - 1 ? 'default' : 'pointer' }}>»</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STOCK ── */}
        {section === 'stock' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Stock multi-sites</h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{sites.map(s => s.nom).join(' · ')}</p>
              </div>
              <button onClick={() => setShowModalMouvement(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.4)', color: '#c9a96e', borderRadius: 4, padding: '10px 18px', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer', textTransform: 'uppercase' as const }}>
                + Mouvement de stock
              </button>
            </div>

            {loading ? <Spinner /> : produits.length === 0 ? (
              <Empty message="Aucun produit. Ajoutez d'abord des vins dans la section Catalogue." />
            ) : (
              <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>Produit</th>
                      {sitesUniques.map(s => (
                        <th key={s} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{s}</th>
                      ))}
                      <th style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockGroupé.map((row, i) => {
                      const total = Object.values(row.parSite).reduce((a: any, b: any) => a + b, 0)
                      return (
                        <tr key={row.id} style={{ borderBottom: i < stockGroupé.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ fontSize: 13 }}>{row.nom}</div>
                            {row.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{row.millesime}</div>}
                          </td>
                          {sitesUniques.map(s => (
                            <td key={s} style={{ padding: '13px 16px' }}><StockDot qty={row.parSite[s] || 0} /></td>
                          ))}
                          <td style={{ padding: '13px 16px' }}>
                            <span style={{ fontSize: 14, color: total === 0 ? '#c96e6e' : '#e8e0d5', fontFamily: 'Georgia, serif' }}>{total}</span>
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

        {/* ── TRANSFERTS ── */}
        {section === 'transferts' && (
          <VueTransferts sites={sites} onNew={() => setShowModalTransfert(true)} refreshKey={transfertRefresh} />
        )}

      </main>

      {/* Modal Changer mot de passe */}
      {showPasswordModal && <ModalChangePassword onClose={() => setShowPasswordModal(false)} />}

      {/* Modals */}
      {showModalProduit && sites.length > 0 && (
        <ModalAjoutProduit sites={sites} onClose={() => setShowModalProduit(false)} onSaved={loadData} />
      )}
      {showModalTransfert && (
        <ModalNouveauTransfert
          sites={sites}
          onCreated={() => { setShowModalTransfert(false); setTransfertRefresh(r => r + 1) }}
          onClose={() => setShowModalTransfert(false)}
        />
      )}
      {showModalMouvement && (
        <ModalMouvement produits={produits} sites={sites} onClose={() => setShowModalMouvement(false)} onSaved={loadData} />
      )}
      {selectedProduit && (
        <ModalEditProduit
          produit={selectedProduit}
          regions={regions}
          appellations={appellations}
          onClose={() => setSelectedProduit(null)}
          onSaved={() => { loadData(); setSelectedProduit(null) }}
        />
      )}
      {showNouveauProduit && (
        <ModalNouveauProduitAdmin
          regions={regions}
          appellations={appellations}
          onClose={() => setShowNouveauProduit(false)}
          onSaved={() => { loadData(); setShowNouveauProduit(false) }}
        />
      )}
      {dupliquerProduit && (
        <ModalDupliquer
          produit={dupliquerProduit}
          onClose={() => setDupliquerProduit(null)}
          onSaved={() => { loadData(); setDupliquerProduit(null) }}
        />
      )}
    </div>
  )
}


export default AdminPage