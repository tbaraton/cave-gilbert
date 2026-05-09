'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type View = 'besoins' | 'commandes' | 'reception' | 'detail' | 'associer'

const STATUT_CMD: Record<string, { bg: string; color: string; label: string }> = {
  brouillon:  { bg: '#222',    color: '#888',    label: 'Brouillon' },
  'envoyée':   { bg: '#2a2a1e', color: '#c9b06e', label: 'Envoyée' },
  'reçue':    { bg: '#1e2a1e', color: '#6ec96e', label: 'Reçue ✓' },
  'annulée':   { bg: '#2a1e1e', color: '#c96e6e', label: 'Annulée' },
}

const COULEURS = ['rouge','blanc','rosé','champagne','effervescent','spiritueux','autre']

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

// ── Modal création complète de produit ───────────────────────

const CERTIFICATIONS = ['bio', 'vegan', 'casher', 'naturel', 'biodynamique']
const CERT_LABELS: Record<string, string> = {
  bio: '🌿 Biologique', vegan: '🌱 Vegan', casher: '✡ Casher',
  naturel: '🍃 Naturel', biodynamique: '🌙 Biodynamique',
}

function arrondir50(prix: number): number {
  // Arrondir au 0.50€ supérieur
  return Math.ceil(prix * 2) / 2
}

function ModalNouveauProduit({ domaines, regions, appellations, onCreated, onClose }: {
  domaines: any[]
  regions: any[]
  appellations: any[]
  onCreated: (product: any, domaineId: string, prixHT: string, conditionnement: string) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    appellation_nom: '',
    nom_cuvee: '',
    domaine_nom: '',
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
    conditionnement: '6',
    image_url: '',
    bio: false, vegan: false, casher: false, naturel: false, biodynamique: false,
    actif: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showNouveauFournisseur, setShowNouveauFournisseur] = useState(false)
  const [nouveauFournisseur, setNouveauFournisseur] = useState('')
  const [creatingFournisseur, setCreatingFournisseur] = useState(false)

  const appsFiltrees = form.region_id
    ? appellations.filter(a => a.region_id === form.region_id)
    : appellations

  const buildNom = () => {
    const parts = []
    if (form.appellation_nom) parts.push(form.appellation_nom)
    if (form.nom_cuvee) parts.push(form.nom_cuvee)
    if (form.couleur) parts.push(form.couleur.charAt(0).toUpperCase() + form.couleur.slice(1))
    if (form.millesime) parts.push(form.millesime)
    if (form.contenance) parts.push(form.contenance)
    let nom = parts.join(' ')
    if (form.domaine_nom) nom += ' - ' + form.domaine_nom
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

  const createFournisseur = async () => {
    if (!nouveauFournisseur.trim()) return
    setCreatingFournisseur(true)
    const { data } = await supabase.from('domaines').insert({ nom: nouveauFournisseur.trim() }).select().single()
    if (data) {
      domaines.push(data)
      setForm(f => ({ ...f, domaine_id: data.id, domaine_nom: data.nom }))
      setShowNouveauFournisseur(false)
      setNouveauFournisseur('')
    }
    setCreatingFournisseur(false)
  }

  const handleSave = async () => {
    const nomFinal = buildNom()
    const prixNum = parseFloat(form.prix_vente_ttc)
    if (!nomFinal.trim()) { setError("Remplissez au moins l'appellation"); return }
    if (!form.prix_vente_ttc || isNaN(prixNum) || prixNum <= 0) { setError('Le prix TTC est obligatoire (ex: 15.50)'); return }
    setSaving(true)
    setError('')

    const slug = nomFinal.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 7)

    const { data: product, error: err } = await supabase.from('products').insert({
      nom: nomFinal,
      slug,
      nom_cuvee: form.nom_cuvee || null,
      contenance: form.contenance || '75cl',
      millesime: form.millesime ? parseInt(form.millesime) : null,
      couleur: form.couleur,
      region_id: form.region_id || null,
      appellation_id: form.appellation_id || null,
      domaine_id: form.domaine_id || null,
      prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
      prix_vente_ttc: prixNum,
      prix_vente_pro: form.prix_vente_pro ? parseFloat(form.prix_vente_pro) : null,
      image_url: form.image_url || null,
      bio: form.bio, vegan: form.vegan, casher: form.casher,
      naturel: form.naturel, biodynamique: form.biodynamique,
      actif: form.actif,
    }).select('id, nom, millesime, couleur, prix_achat_ht, prix_vente_ttc, actif').single()

    if (err) { setError(`Erreur: ${err.message}`); setSaving(false); return }
    if (!product) { setError('Produit non créé'); setSaving(false); return }

    if (form.domaine_id) {
      await supabase.from('product_suppliers').upsert({
        product_id: product.id, domaine_id: form.domaine_id,
        prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
        conditionnement: parseInt(form.conditionnement) || 6,
        fournisseur_principal: true,
      }, { onConflict: 'product_id,domaine_id' })
    }

    setSaving(false)
    onCreated(product, form.domaine_id, form.prix_achat_ht, form.conditionnement)
    onClose()
  }

  const CERTIFS = [
    { key: 'bio', label: '🌿 Bio' }, { key: 'vegan', label: '🌱 Vegan' },
    { key: 'casher', label: '✡ Casher' }, { key: 'naturel', label: '🍃 Naturel' },
    { key: 'biodynamique', label: '🌙 Biodynamique' },
  ]
  const COULEUR_COLOR: Record<string, string> = {
    rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0',
    champagne: '#c0c0d8', effervescent: '#c0c0d8', spiritueux: '#8ec98e', autre: '#888888',
  }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 700, padding: '28px 32px', maxHeight: '90vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouveau produit</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        {/* Aperçu nom */}
        {(form.appellation_nom || form.domaine_nom) && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Aperçu du nom</div>
            <div style={{ fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif' }}>
              {form.appellation_nom}
              {form.nom_cuvee && <span style={{ fontStyle: 'italic', color: 'rgba(232,224,213,0.7)' }}> {form.nom_cuvee}</span>}
              {form.couleur && <span style={{ color: COULEUR_COLOR[form.couleur] || '#e8e0d5', fontWeight: 500 }}> {form.couleur.charAt(0).toUpperCase() + form.couleur.slice(1)}</span>}
              {form.millesime && <span style={{ color: 'rgba(232,224,213,0.6)' }}> {form.millesime}</span>}
              {form.contenance && <span style={{ color: 'rgba(232,224,213,0.4)', fontSize: 12 }}> {form.contenance}</span>}
              {form.domaine_nom && <span style={{ color: 'rgba(232,224,213,0.5)', fontSize: 13 }}> — {form.domaine_nom}</span>}
            </div>
          </div>
        )}

        {/* Identité */}
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Identité du vin</div>
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
              const app = appsFiltrees.find(a => a.id === e.target.value)
              setForm(f => ({ ...f, appellation_id: e.target.value, appellation_nom: app?.nom || '' }))
            }} style={sel}>
              <option value="">— Choisir —</option>
              {appsFiltrees.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Nom de la cuvée</label>
            <input value={form.nom_cuvee} onChange={e => setForm(f => ({ ...f, nom_cuvee: e.target.value }))} placeholder="Laisser vide si pas de cuvée" style={{ ...inp, fontStyle: 'italic' }} />
          </div>
          <div>
            <label style={lbl}>Couleur *</label>
            <select value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))} style={{ ...sel, color: COULEUR_COLOR[form.couleur] || '#e8e0d5', fontWeight: 600 }}>
              {COULEURS.map(c => <option key={c} value={c} style={{ background: '#1a1408', color: COULEUR_COLOR[c] || '#f0e8d8', fontWeight: 600 }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
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
          <div>
            <label style={lbl}>Conditionnement (btl)</label>
            <input type="number" value={form.conditionnement} onChange={e => setForm(f => ({ ...f, conditionnement: e.target.value }))} placeholder="6" style={inp} />
          </div>
        </div>

        {/* Fournisseur */}
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '8px 0 14px' }} />
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 10 }}>Fournisseur</div>
        {!showNouveauFournisseur ? (
          <div style={{ marginBottom: 8 }}>
            <label style={lbl}>Domaine / Fournisseur</label>
            <select value={form.domaine_id} onChange={e => {
              const d = domaines.find(d => d.id === e.target.value)
              setForm(f => ({ ...f, domaine_id: e.target.value, domaine_nom: d?.nom || '' }))
            }} style={sel}>
              <option value="">— Choisir un fournisseur —</option>
              {domaines.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={nouveauFournisseur} onChange={e => setNouveauFournisseur(e.target.value)} placeholder="Nom du nouveau fournisseur" style={{ ...inp, flex: 1 }} />
            <button onClick={createFournisseur} disabled={creatingFournisseur} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
              {creatingFournisseur ? '...' : 'Créer'}
            </button>
            <button onClick={() => setShowNouveauFournisseur(false)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '9px 12px', fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        <button onClick={() => setShowNouveauFournisseur(v => !v)} style={{ background: 'transparent', border: 'none', color: 'rgba(201,169,110,0.6)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 14 }}>
          {showNouveauFournisseur ? '← Choisir existant' : '+ Créer un nouveau fournisseur'}
        </button>

        {/* Prix */}
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '4px 0 14px' }} />
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
            <label style={lbl}>Prix TTC part. *</label>
            <input type="number" step="0.50" value={form.prix_vente_ttc} onChange={e => setForm(f => ({ ...f, prix_vente_ttc: e.target.value }))} placeholder="0.00" style={inp} />
          </div>
          <div>
            <label style={lbl}>Coeff. pro</label>
            <input type="number" step="0.01" value={form.coeff_pro} onChange={e => setForm(f => ({ ...f, coeff_pro: e.target.value }))} style={{ ...inp, color: '#c9b06e' }} />
          </div>
          <div>
            <label style={lbl}>Prix TTC pro</label>
            <input type="number" step="0.01" value={form.prix_vente_pro} onChange={e => setForm(f => ({ ...f, prix_vente_pro: e.target.value }))} placeholder="0.00" style={inp} />
          </div>
        </div>
        {form.prix_achat_ht && parseFloat(form.prix_achat_ht) > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 14 }}>
            {form.prix_achat_ht}€ × {form.coeff_particulier} = <strong style={{ color: '#c9a96e' }}>{arrondir50(parseFloat(form.prix_achat_ht) * parseFloat(form.coeff_particulier)).toFixed(2)}€</strong> part.
            {' · '}× {form.coeff_pro} = <strong style={{ color: '#c9a96e' }}>{(parseFloat(form.prix_achat_ht) * parseFloat(form.coeff_pro)).toFixed(2)}€</strong> pro
          </div>
        )}

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>URL photo</label>
          <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." style={inp} />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div onClick={() => setForm(f => ({ ...f, actif: !f.actif }))} style={{ width: 14, height: 14, borderRadius: 2, border: `0.5px solid ${form.actif ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: form.actif ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {form.actif && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}>Produit actif (visible en boutique)</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '12px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '12px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳ Création...' : '✓ Créer et ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────

function Sidebar({ view, setView, counts }: { view: View; setView: (v: View) => void; counts: Record<string, number> }) {
  const items = [
    { id: 'besoins',   label: 'Besoins',    icon: '◻', count: counts.besoins },
    { id: 'commandes', label: 'Commandes',  icon: '◈', count: counts.commandes },
    { id: 'reception', label: 'Réception',  icon: '📦', count: counts.reception },
    { id: 'associer',  label: 'Assoc. fournisseurs', icon: '⬥' },
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
          { label: 'Clients', href: '/admin/clients', icon: '◎' },
          { label: 'Fournisseurs', href: '/admin/fournisseurs', icon: '◈' },
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
            padding: '10px 20px', fontSize: 12, cursor: 'pointer',
            background: view === item.id ? 'rgba(201,169,110,0.08)' : 'transparent',
            color: view === item.id ? '#c9a96e' : 'rgba(232,224,213,0.45)',
            borderLeft: `2px solid ${view === item.id ? '#c9a96e' : 'transparent'}`,
            border: 'none', borderLeftStyle: 'solid' as const,
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
  const [domaines, setDomaines] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [appellations, setAppellations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchRes, setSearchRes] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showNouveauProduit, setShowNouveauProduit] = useState(false)

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

  useEffect(() => {
    loadBesoins()
    supabase.from('domaines').select('id, nom').order('nom').then(({ data }) => setDomaines(data || []))
    supabase.from('regions').select('id, nom').order('nom').then(({ data }) => setRegions(data || []))
    supabase.from('appellations').select('id, nom, region_id').order('nom').then(({ data }) => setAppellations(data || []))
  }, [])

  const searchProducts = async (q: string) => {
    setSearch(q)
    if (q.length < 2) { setSearchRes([]); return }
    const { data } = await supabase.from('products').select('id, nom, millesime, couleur, prix_achat_ht').ilike('nom', `%${q}%`).eq('actif', true).limit(15)
    setSearchRes(data || [])
  }

  const addBesoin = async (product: any) => {
    if (besoins.find(b => b.product_id === product.id)) return
    const { data: ps } = await supabase.from('product_suppliers').select('domaine_id, prix_achat_ht, conditionnement').eq('product_id', product.id).eq('fournisseur_principal', true).single()
    await supabase.from('order_needs').insert({
      product_id: product.id, domaine_id: ps?.domaine_id || null,
      quantite: ps?.conditionnement || 6, prix_achat_ht: ps?.prix_achat_ht || product.prix_achat_ht || 0, statut: 'en_attente',
    })
    setSearch(''); setSearchRes([]); loadBesoins()
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
    setGenerating(true); setError(''); setSuccess('')
    const parFournisseur: Record<string, any[]> = {}
    const sansFournisseur: any[] = []
    for (const b of besoins) {
      if (!b.domaine_id) { sansFournisseur.push(b); continue }
      if (!parFournisseur[b.domaine_id]) parFournisseur[b.domaine_id] = []
      parFournisseur[b.domaine_id].push(b)
    }
    let nbCommandes = 0
    for (const [domaineId, items] of Object.entries(parFournisseur)) {
      const { data: cmd } = await supabase.from('supplier_orders').insert({ domaine_id: domaineId, statut: 'brouillon', date_commande: new Date().toISOString().split('T')[0] }).select().single()
      if (!cmd) continue
      await supabase.from('supplier_order_items').insert(items.map(b => ({ order_id: cmd.id, product_id: b.product_id, product_nom: b.product?.nom || '', product_millesime: b.product?.millesime || null, quantite_commandee: b.quantite, prix_achat_ht: b.prix_achat_ht || 0 })))
      await supabase.from('order_needs').update({ statut: 'commandé', supplier_order_id: cmd.id }).in('id', items.map(b => b.id))
      nbCommandes++
    }
    setGenerating(false)
    if (nbCommandes > 0) { setSuccess(`${nbCommandes} commande${nbCommandes > 1 ? 's' : ''} générée${nbCommandes > 1 ? 's' : ''} !`); loadBesoins(); onRefresh() }
    if (sansFournisseur.length > 0) setError(`${sansFournisseur.length} produit(s) sans fournisseur — non commandé(s)`)
  }

  const besoinsAvecFournisseur = besoins.filter(b => b.domaine_id)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Besoins</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{besoins.length} produit{besoins.length > 1 ? 's' : ''} en attente</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowNouveauProduit(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.4)', color: '#c9a96e', borderRadius: 4, padding: '10px 18px', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer' }}>
            + Nouveau produit
          </button>
          <button onClick={generateCommandes} disabled={generating || besoinsAvecFournisseur.length === 0} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: besoinsAvecFournisseur.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 500, textTransform: 'uppercase' as const, opacity: besoinsAvecFournisseur.length === 0 ? 0.5 : 1 }}>
            {generating ? '⟳ Génération...' : `✓ Passer les commandes (${besoinsAvecFournisseur.length})`}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 4, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#6ec96e' }}>{success}</div>}

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={lbl}>Ajouter un produit existant aux besoins</div>
        <input value={search} onChange={e => searchProducts(e.target.value)} placeholder="Tapez le nom d'un vin..." style={inp} />
        {searchRes.length > 0 && (
          <div style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
            {searchRes.map(p => (
              <div key={p.id} onClick={() => addBesoin(p)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.04)', background: besoins.find(b => b.product_id === p.id) ? 'rgba(201,169,110,0.08)' : '#18130e' }}
                onMouseEnter={e => { if (!besoins.find(b => b.product_id === p.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!besoins.find(b => b.product_id === p.id)) e.currentTarget.style.background = '#18130e' }}
              >
                <span style={{ fontSize: 13, color: '#f0e8d8' }}>{p.nom}{p.millesime ? ` ${p.millesime}` : ''}</span>
                {besoins.find(b => b.product_id === p.id) ? <span style={{ fontSize: 10, color: '#c9a96e' }}>✓ Déjà dans les besoins</span> : <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.4)' }}>+ Ajouter</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>Chargement...</div> : besoins.length === 0 ? (
        <div style={{ ...card, textAlign: 'center' as const, padding: '48px' }}>
          <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 14 }}>Aucun besoin en attente.</p>
        </div>
      ) : (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Fournisseur', 'Prix HT', 'Quantité', ''].map(h => (
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
                    <input type="number" min={1} defaultValue={b.quantite}
                      onBlur={e => updateQty(b.id, parseInt(e.target.value) || 1)}
                      onKeyDown={e => { if (e.key === 'Enter') updateQty(b.id, parseInt((e.target as HTMLInputElement).value) || 1) }}
                      style={{ width: 70, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#e8e0d5', fontSize: 13, padding: '4px 8px', textAlign: 'center' as const }}
                    />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => removeBesoin(b.id)} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNouveauProduit && (
        <ModalNouveauProduit
          domaines={domaines}
          regions={regions}
          appellations={appellations}
          onCreated={async (product) => {
            if (product) await addBesoin(product)
            setShowNouveauProduit(false)
          }}
          onClose={() => setShowNouveauProduit(false)}
        />
      )}
    </div>
  )
}


// ── Modal nouvelle commande directe ──────────────────────────

function ModalNouvelleCommande({ domaines, preselectedDomaineId, onCreated, onClose }: {
  domaines: any[]
  preselectedDomaineId?: string
  onCreated: (cmd: any) => void
  onClose: () => void
}) {
  const [domaineId, setDomaineId] = useState(preselectedDomaineId || '')
  const [produitsDomaine, setProduitsDomaine] = useState<any[]>([])
  const [loadingProduits, setLoadingProduits] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, number>>({}) // product_id -> quantite
  const [notes, setNotes] = useState('')

  // Charger les produits automatiquement si fournisseur pré-sélectionné
  useEffect(() => {
    if (preselectedDomaineId) {
      loadProduitsDomaine(preselectedDomaineId)
    }
  }, [preselectedDomaineId])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadProduitsDomaine = async (id: string) => {
    if (!id) { setProduitsDomaine([]); return }
    setLoadingProduits(true)
    const { data: ps } = await supabase
      .from('product_suppliers')
      .select('product_id, prix_achat_ht, conditionnement')
      .eq('domaine_id', id)
      .eq('fournisseur_principal', true)
    if (!ps || ps.length === 0) { setProduitsDomaine([]); setLoadingProduits(false); return }
    const ids = ps.map(p => p.product_id)
    const { data: prods } = await supabase
      .from('products')
      .select('id, nom, millesime, couleur, prix_achat_ht')
      .in('id', ids)
      .eq('actif', true)
      .order('nom')
    // Merge prix from product_suppliers
    const psMap = Object.fromEntries(ps.map(p => [p.product_id, p]))
    setProduitsDomaine((prods || []).map(p => ({
      ...p,
      prix_achat_ht: psMap[p.id]?.prix_achat_ht || p.prix_achat_ht || 0,
      conditionnement: psMap[p.id]?.conditionnement || 6,
    })))
    setLoadingProduits(false)
  }

  const toggleProduit = (produit: any) => {
    setSelected(prev => {
      if (prev[produit.id] !== undefined) {
        const next = { ...prev }
        delete next[produit.id]
        return next
      }
      return { ...prev, [produit.id]: produit.conditionnement || 6 }
    })
  }

  const handleCreate = async () => {
    if (!domaineId) { setError('Choisissez un fournisseur'); return }
    const lignes = Object.entries(selected)
    if (lignes.length === 0) { setError('Cochez au moins un produit'); return }
    setSaving(true)
    const { data: cmd } = await supabase.from('supplier_orders').insert({
      domaine_id: domaineId,
      statut: 'brouillon',
      date_commande: new Date().toISOString().split('T')[0],
      notes,
    }).select().single()
    if (!cmd) { setError('Erreur création commande'); setSaving(false); return }
    const prodMap = Object.fromEntries(produitsDomaine.map(p => [p.id, p]))
    await supabase.from('supplier_order_items').insert(
      lignes.map(([pid, qty]) => ({
        order_id: cmd.id,
        product_id: pid,
        product_nom: prodMap[pid]?.nom || '',
        product_millesime: prodMap[pid]?.millesime || null,
        quantite_commandee: qty,
        prix_achat_ht: prodMap[pid]?.prix_achat_ht || 0,
      }))
    )
    onCreated(cmd)
  }

  const filtres = produitsDomaine.filter(p =>
    !search || p.nom.toLowerCase().includes(search.toLowerCase())
  )
  const nbSelectionnes = Object.keys(selected).length
  const totalHT = Object.entries(selected).reduce((acc, [pid, qty]) => {
    const p = produitsDomaine.find(x => x.id === pid)
    return acc + (parseFloat(p?.prix_achat_ht || 0) * qty)
  }, 0)

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 780, padding: '28px 32px', maxHeight: '90vh', overflowY: 'auto' as const }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouvelle commande</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        {/* Fournisseur */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Fournisseur *</label>
          <select value={domaineId} onChange={e => {
            setDomaineId(e.target.value)
            setSelected({})
            setSearch('')
            loadProduitsDomaine(e.target.value)
          }} style={sel}>
            <option value="" style={{ background: '#1a1408', color: '#888' }}>— Choisir un fournisseur —</option>
            {domaines.map(d => <option key={d.id} value={d.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{d.nom}</option>)}
          </select>
        </div>

        {/* Liste produits avec cases à cocher */}
        {domaineId && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={lbl}>
                Produits référencés
                {produitsDomaine.length > 0 && <span style={{ color: 'rgba(232,224,213,0.3)', marginLeft: 8 }}>({produitsDomaine.length} références)</span>}
              </label>
              {nbSelectionnes > 0 && (
                <span style={{ fontSize: 11, color: '#c9a96e' }}>{nbSelectionnes} sélectionné{nbSelectionnes > 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Recherche dans la liste */}
            {produitsDomaine.length > 10 && (
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filtrer les produits..." style={{ ...inp, marginBottom: 8 }} />
            )}

            {loadingProduits ? (
              <div style={{ textAlign: 'center' as const, padding: 24, color: 'rgba(232,224,213,0.4)', fontSize: 13 }}>Chargement des produits...</div>
            ) : produitsDomaine.length === 0 ? (
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 4, fontSize: 12, color: 'rgba(232,224,213,0.4)', textAlign: 'center' as const }}>
                Aucun produit associé à ce fournisseur.<br />
                <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>Associez des produits via Besoins → Assoc. fournisseurs</span>
              </div>
            ) : (
              <>
                {/* Boutons tout cocher / décocher */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setSelected(Object.fromEntries(filtres.map(p => [p.id, p.conditionnement || 6])))}
                    style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 3, padding: '4px 10px', fontSize: 10, cursor: 'pointer', letterSpacing: 1 }}>
                    ✓ Tout sélectionner
                  </button>
                  <button onClick={() => setSelected({})}
                    style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                    Tout décocher
                  </button>
                </div>

                <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', maxHeight: 340, overflowY: 'auto' as const }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <thead style={{ position: 'sticky' as const, top: 0, background: '#14100c', zIndex: 1 }}>
                      <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                        <th style={{ width: 36, padding: '8px 12px' }}></th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>PRODUIT</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>PRIX HT</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>QTÉ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtres.map((p, i) => {
                        const checked = selected[p.id] !== undefined
                        return (
                          <tr key={p.id}
                            onClick={() => toggleProduit(p)}
                            style={{
                              borderBottom: i < filtres.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                              background: checked ? 'rgba(201,169,110,0.06)' : 'transparent',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                            onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                          >
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: 3,
                                border: `1.5px solid ${checked ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`,
                                background: checked ? '#c9a96e' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {checked && <span style={{ fontSize: 10, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 13, color: '#f0e8d8' }}>{p.nom}</div>
                              {p.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{p.millesime}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                              {parseFloat(p.prix_achat_ht || 0).toFixed(2)}€
                            </td>
                            <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                              {checked ? (
                                <input
                                  type="number" min={1}
                                  value={selected[p.id]}
                                  onChange={e => setSelected(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 1 }))}
                                  style={{ width: 65, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 3, color: '#e8e0d5', fontSize: 13, padding: '4px 8px', textAlign: 'center' as const }}
                                />
                              ) : (
                                <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.25)' }}>{p.conditionnement || 6} btl</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Total et notes */}
        {nbSelectionnes > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginBottom: 14, padding: '10px 14px', background: 'rgba(201,169,110,0.06)', borderRadius: 4 }}>
            <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{nbSelectionnes} référence{nbSelectionnes > 1 ? 's' : ''} — Total estimé :</span>
            <span style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{totalHT.toFixed(2)}€ HT</span>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Notes (optionnel)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Ex: Commande passée par téléphone le..." style={{ ...inp, resize: 'vertical' as const }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleCreate} disabled={saving || nbSelectionnes === 0 || !domaineId} style={{
            flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
            padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500,
            textTransform: 'uppercase' as const, opacity: (nbSelectionnes === 0 || !domaineId) ? 0.5 : 1,
          }}>
            {saving ? '⟳ Création...' : `✓ Créer la commande (${nbSelectionnes} produit${nbSelectionnes > 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vue Commandes ─────────────────────────────────────────────

function VueCommandes({ onSelectDetail, preselectedDomaineId, onClearPreselect }: {
  onSelectDetail: (cmd: any) => void
  preselectedDomaineId?: string | null
  onClearPreselect?: () => void
}) {
  const [commandes, setCommandes] = useState<any[]>([])
  const [domaines, setDomaines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [showNouvelleCommande, setShowNouvelleCommande] = useState(false)

  const loadCommandes = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('supplier_orders')
      .select('*, fournisseur:domaines(id, nom), items:supplier_order_items(id)')
      .order('created_at', { ascending: false })
    setCommandes(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadCommandes()
    supabase.from('domaines').select('id, nom').order('nom').then(({ data }) => setDomaines(data || []))
  }, [])

  // Ouvrir le modal si un fournisseur est pré-sélectionné (venant de fournisseurs)
  useEffect(() => {
    if (preselectedDomaineId && domaines.length > 0) {
      setShowNouvelleCommande(true)
      if (onClearPreselect) onClearPreselect()
    }
  }, [preselectedDomaineId, domaines])

  const filtered = commandes.filter(c => filterStatut === 'tous' || c.statut === filterStatut)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Commandes fournisseurs</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{commandes.length} commande{commandes.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNouvelleCommande(true)} style={{
          background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
          padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const,
        }}>+ Nouvelle commande</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const }}>
        {['tous', 'brouillon', 'envoyée', 'annulée'].map(s => (
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
          <button onClick={() => setShowNouvelleCommande(true)} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1.5, marginTop: 12 }}>
            + Créer la première commande
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {filtered.map(cmd => (
            <div key={cmd.id} onClick={() => onSelectDetail(cmd)} style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{cmd.numero}</span>
                  <Badge statut={cmd.statut} />
                </div>
                <div style={{ fontSize: 15, color: '#f0e8d8', marginBottom: 3, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{cmd.fournisseur?.nom || '—'}</div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>
                  {cmd.items?.length || 0} référence{(cmd.items?.length || 0) > 1 ? 's' : ''}
                  {cmd.date_commande && ` · ${new Date(cmd.date_commande).toLocaleDateString('fr-FR')}`}
                  {cmd.total_ht && ` · ${parseFloat(cmd.total_ht).toFixed(2)}€ HT`}
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Voir →</span>
            </div>
          ))}
        </div>
      )}

      {showNouvelleCommande && (
        <ModalNouvelleCommande
          domaines={domaines}
          preselectedDomaineId={preselectedDomaineId || undefined}
          onCreated={(cmd) => { loadCommandes(); setShowNouvelleCommande(false); onSelectDetail(cmd) }}
          onClose={() => setShowNouvelleCommande(false)}
        />
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
  const [prixRecus, setPrixRecus] = useState<Record<string, number>>({})
  const [popupPrix, setPopupPrix] = useState<{ item: any; newPrix: number } | null>(null)
  const [showReception, setShowReception] = useState(false)
  const [statutLocal, setStatutLocal] = useState(commande.statut)

  useEffect(() => {
    const load = async () => {
      const [{ data: itemsData }, { data: sitesData }] = await Promise.all([
        supabase.from('supplier_order_items').select('*, product:products(id, nom, millesime)').eq('order_id', commande.id),
        supabase.from('sites').select('*').eq('actif', true).order('type'),
      ])
      setItems(itemsData || [])
      setSites(sitesData || [])
      const entrepot = sitesData?.find(s => s.type === 'entrepot')
      setSiteReception(entrepot?.id || sitesData?.[0]?.id || '')
      const init: Record<string, number> = {}
      itemsData?.forEach(item => { init[item.id] = item.quantite_commandee })
      setQtesRecues(init)
      setLoading(false)
    }
    load()
  }, [commande.id])

  const handleSendEmail = async () => {
    const body = items.map(i => `- ${i.product_nom}${i.product_millesime ? ` ${i.product_millesime}` : ''} : ${i.quantite_commandee} btl @ ${parseFloat(i.prix_achat_ht || 0).toFixed(2)}€ HT`).join('\n')
    const totalHT = items.reduce((acc, i) => acc + (parseFloat(i.prix_achat_ht || 0) * i.quantite_commandee), 0)
    const subject = `Commande ${commande.numero} — Cave de Gilbert`
    const mailBody = `Bonjour,\n\nVeuillez trouver notre commande ${commande.numero} :\n\n${body}\n\nTotal HT : ${totalHT.toFixed(2)}€\n\nCordialement,\nLa Cave de Gilbert`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`)
    await supabase.from('supplier_orders').update({ statut: 'envoyée' }).eq('id', commande.id)
    onRefresh()
    onBack()
  }

  const handleReception = async () => {
    setProcessing(true)
    let stockErreur = false
    for (const item of items) {
      const qty = qtesRecues[item.id] ?? item.quantite_commandee
      if (qty <= 0) continue
      await supabase.from('supplier_order_items').update({ quantite_recue: qty }).eq('id', item.id)
      if (siteReception) {
        const { error } = await supabase.rpc('move_stock', {
          p_product_id: item.product_id, p_site_id: siteReception,
          p_raison: 'achat', p_quantite: qty,
          p_note: `Réception ${commande.numero}`,
          p_order_id: null, p_transfer_id: null,
        })
        if (error) stockErreur = true
      }
    }
    await supabase.from('supplier_orders').update({
      statut: 'reçue',
      date_livraison_effective: new Date().toISOString().split('T')[0]
    }).eq('id', commande.id)
    setProcessing(false)
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
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>{commande.fournisseur?.nom || '—'}</h1>
          {commande.date_commande && <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 4 }}>Commandé le {new Date(commande.date_commande).toLocaleDateString('fr-FR')}</div>}
        </div>
        <Badge statut={statutLocal} />
      </div>

      {!showReception && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const }}>
          {['brouillon', 'envoyée', 'envoyée'].includes(statutLocal) && (
            <button onClick={handleSendEmail} style={{ background: '#1e1e2a', border: '0.5px solid rgba(110,158,201,0.4)', color: '#6e9ec9', borderRadius: 4, padding: '10px 18px', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
              📧 Envoyer par email
            </button>
          )}
          {statutLocal === 'brouillon' && (
            <button onClick={async () => {
              const { error } = await supabase.from('supplier_orders').update({ statut: 'envoyée' }).eq('id', commande.id)
              if (!error) {
                onRefresh()
                onBack()
              }
            }} style={{ background: '#1e2a1e', border: '0.5px solid rgba(110,201,110,0.3)', color: '#6ec96e', borderRadius: 4, padding: '10px 18px', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
              ✓ Valider (téléphone / visuel)
            </button>
          )}
          {['envoyée', 'envoyée', 'envoyée'].includes(statutLocal) && (
            <button onClick={() => setShowReception(true)} style={{ background: '#1e2a1e', border: '0.5px solid rgba(110,201,110,0.4)', color: '#6ec96e', borderRadius: 4, padding: '10px 18px', fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
              📦 Réceptionner
            </button>
          )}
          {statutLocal === 'brouillon' && (
            <button onClick={async () => { await supabase.from('supplier_orders').update({ statut: 'annulée' }).eq('id', commande.id); onRefresh(); onBack() }} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 4, padding: '10px 14px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          )}
        </div>
      )}

      {showReception && (
        <div style={{ ...card, marginBottom: 20, border: '0.5px solid rgba(110,201,110,0.2)' }}>
          <div style={{ fontSize: 13, color: '#6ec96e', marginBottom: 14 }}>📦 Réception — saisir les quantités reçues</div>
          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Site de réception</div>
            <select value={siteReception} onChange={e => setSiteReception(e.target.value)} style={{ ...sel, width: 300 }}>
              {sites.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{s.nom} — {s.ville}</option>)}
            </select>
          </div>
          {/* Popup modification prix */}
          {popupPrix && (
            <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
              <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, padding: '24px 28px', maxWidth: 380, width: '100%' }}>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 300, color: '#f0e8d8', marginBottom: 16 }}>Mise à jour des prix</h3>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 16 }}>{popupPrix.item.product_nom}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Prix achat HT', val: `${popupPrix.newPrix.toFixed(2)}€`, color: '#e8e0d5' },
                    { label: 'Prix TTC part. (×2 arr.)', val: `${(Math.ceil(popupPrix.newPrix * 2 * 2) / 2).toFixed(2)}€`, color: '#c9a96e' },
                    { label: 'Prix TTC pro (×1.70)', val: `${(Math.round(popupPrix.newPrix * 1.70 * 100) / 100).toFixed(2)}€`, color: '#6e9ec9' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '10px', textAlign: 'center' as const }}>
                      <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 16, color, fontFamily: 'Georgia, serif' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 16 }}>
                  Ces prix seront mis à jour sur la fiche produit lors de la validation de la réception.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => {
                    setPrixRecus(p => ({ ...p, [popupPrix.item.id]: parseFloat(popupPrix.item.prix_achat_ht || 0) }))
                    setPopupPrix(null)
                  }} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '9px', fontSize: 11, cursor: 'pointer' }}>
                    Annuler
                  </button>
                  <button onClick={() => setPopupPrix(null)} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '9px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                    ✓ Confirmer le nouveau prix
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 130px 90px', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              {['Produit', 'Commandé', 'Prix achat HT', 'Reçu'].map(h => (
                <div key={h} style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const }}>{h}</div>
              ))}
            </div>
            {items.map(item => {
              const currentPrix = prixRecus[item.id] ?? parseFloat(item.prix_achat_ht || 0)
              const originalPrix = parseFloat(item.prix_achat_ht || 0)
              const prixChanged = Math.abs(currentPrix - originalPrix) > 0.001
              return (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 130px 90px', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#e8e0d5' }}>{item.product_nom}</div>
                    {item.product_millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{item.product_millesime}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{item.quantite_commandee} btl</div>
                  <div style={{ position: 'relative' as const }}>
                    <input
                      type="number" step="0.01"
                      value={currentPrix}
                      onChange={e => {
                        const newVal = parseFloat(e.target.value) || 0
                        setPrixRecus(p => ({ ...p, [item.id]: newVal }))
                        if (Math.abs(newVal - originalPrix) > 0.001) {
                          setPopupPrix({ item, newPrix: newVal })
                        }
                      }}
                      style={{ width: '100%', background: prixChanged ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${prixChanged ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 3, color: prixChanged ? '#c9a96e' : '#e8e0d5', fontSize: 13, padding: '4px 8px', textAlign: 'center' as const }}
                    />
                    {prixChanged && <div style={{ fontSize: 9, color: '#c9a96e', textAlign: 'center' as const, marginTop: 2 }}>Modifié ✓</div>}
                  </div>
                  <input
                    type="number" min={0}
                    defaultValue={qtesRecues[item.id] ?? item.quantite_commandee}
                    onChange={e => setQtesRecues(q => ({ ...q, [item.id]: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#e8e0d5', fontSize: 13, padding: '4px 8px', textAlign: 'center' as const }}
                  />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowReception(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '10px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
            <button onClick={handleReception} disabled={processing} style={{ flex: 2, background: '#6ec96e', color: '#0a1a0a', border: 'none', borderRadius: 4, padding: '10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
              {processing ? '⟳ En cours...' : '✓ Valider la réception'}
            </button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Qté', 'Prix HT', 'Total HT', 'Reçu'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8' }}>{item.product_nom}</div>
                    {item.product_millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{item.product_millesime}</div>}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13 }}>{item.quantite_commandee}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{parseFloat(item.prix_achat_ht || 0).toFixed(2)}€</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontFamily: 'Georgia, serif' }}>{(parseFloat(item.prix_achat_ht || 0) * item.quantite_commandee).toFixed(2)}€</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: item.quantite_recue != null ? '#6ec96e' : 'rgba(232,224,213,0.3)' }}>
                    {item.quantite_recue != null ? `${item.quantite_recue} ✓` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
                <td colSpan={3} style={{ padding: '12px 14px', textAlign: 'right' as const, fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1 }}>TOTAL HT</td>
                <td style={{ padding: '12px 14px', fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{totalHT.toFixed(2)}€</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Associer fournisseurs ─────────────────────────────────────

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
    const { data } = await supabase.from('products').select('id, nom, millesime, couleur, prix_achat_ht').ilike('nom', `%${q}%`).eq('actif', true).limit(20)
    const ids = (data || []).map(p => p.id)
    const { data: suppliers } = await supabase.from('product_suppliers').select('product_id, domaine_id, prix_achat_ht, conditionnement').in('product_id', ids).eq('fournisseur_principal', true)
    const suppMap = Object.fromEntries((suppliers || []).map(s => [s.product_id, s]))
    setProduits((data || []).map(p => ({ ...p, supplier: suppMap[p.id] || null })))
    setLoading(false)
  }

  const saveFournisseur = async (productId: string, domaineId: string, prixHT: string, conditionnement: string) => {
    setSaving(productId)
    await supabase.from('product_suppliers').upsert({
      product_id: productId, domaine_id: domaineId,
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
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Associez un fournisseur principal à chaque vin</p>
      </div>
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={lbl}>Rechercher un produit</div>
        <input value={search} onChange={e => searchProduits(e.target.value)} placeholder="Tapez le nom d'un vin (min. 2 caractères)..." style={inp} />
      </div>
      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {produits.map(p => <AssocierRow key={p.id} produit={p} domaines={domaines} saving={saving} success={success} onSave={saveFournisseur} />)}
        </div>
      )}
    </div>
  )
}

function AssocierRow({ produit, domaines, saving, success, onSave }: {
  produit: any, domaines: any[], saving: string | null, success: string | null,
  onSave: (productId: string, domaineId: string, prixHT: string, conditionnement: string) => void
}) {
  const [domaineId, setDomaineId] = useState(produit.supplier?.domaine_id || '')
  const [prixHT, setPrixHT] = useState(produit.supplier?.prix_achat_ht?.toString() || produit.prix_achat_ht?.toString() || '')
  const [conditionnement, setConditionnement] = useState(produit.supplier?.conditionnement?.toString() || '6')
  const isSaved = success === produit.id

  return (
    <div style={{ ...card, display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
      <div>
        <div style={{ fontSize: 13, color: '#f0e8d8' }}>{produit.nom}</div>
        {produit.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{produit.millesime}</div>}
        {produit.supplier && <div style={{ fontSize: 10, color: '#6ec96e', marginTop: 2 }}>✓ Déjà associé</div>}
      </div>
      <select value={domaineId} onChange={e => setDomaineId(e.target.value)} style={sel}>
        <option value="" style={{ background: '#1a1408', color: '#888' }}>— Choisir —</option>
        {domaines.map(d => <option key={d.id} value={d.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{d.nom}</option>)}
      </select>
      <div>
        <div style={lbl}>Prix HT €</div>
        <input type="number" value={prixHT} onChange={e => setPrixHT(e.target.value)} placeholder="0.00" style={inp} />
      </div>
      <div>
        <div style={lbl}>Cdt.</div>
        <input type="number" value={conditionnement} onChange={e => setConditionnement(e.target.value)} placeholder="6" style={inp} />
      </div>
      <button onClick={() => onSave(produit.id, domaineId, prixHT, conditionnement)} disabled={!domaineId || saving === produit.id} style={{
        background: isSaved ? '#1e2a1e' : '#c9a96e', color: isSaved ? '#6ec96e' : '#0d0a08',
        border: 'none', borderRadius: 4, padding: '9px 16px', fontSize: 11,
        cursor: !domaineId ? 'not-allowed' : 'pointer', fontWeight: 500,
        whiteSpace: 'nowrap' as const, opacity: !domaineId ? 0.5 : 1,
      }}>
        {saving === produit.id ? '...' : isSaved ? '✓ Sauvé' : 'Enregistrer'}
      </button>
    </div>
  )
}


// ── Vue Réception ─────────────────────────────────────────────

function VueReception({ onRefresh }: { onRefresh: () => void }) {
  const [commandesEnvoyees, setCommandesEnvoyees] = useState<any[]>([])
  const [selectedCmd, setSelectedCmd] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [siteReception, setSiteReception] = useState('')
  const [qtesRecues, setQtesRecues] = useState<Record<string, number>>({})
  const [prixRecus, setPrixRecus] = useState<Record<string, number>>({})
  const [popupPrix, setPopupPrix] = useState<{ item: any; newPrix: number; ttcPart: number; ttcPro: number } | null>(null)
  const [prixVenteRecus, setPrixVenteRecus] = useState<Record<string, { ttcPart: number; ttcPro: number }>>({})
  const [searchProd, setSearchProd] = useState('')
  const [searchProdRes, setSearchProdRes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showNouveauProduit, setShowNouveauProduit] = useState(false)
  const [domaines, setDomaines] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [appellations, setAppellations] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: cmds }, { data: sitesData }, { data: domainesData }, { data: regionsData }, { data: appellationsData }] = await Promise.all([
        supabase.from('supplier_orders')
          .select('*, fournisseur:domaines(id, nom), items:supplier_order_items(id)')
          .eq('statut', 'envoyée')
          .order('created_at', { ascending: false }),
        supabase.from('sites').select('*').eq('actif', true).order('type'),
        supabase.from('domaines').select('id, nom').order('nom'),
        supabase.from('regions').select('id, nom').order('nom'),
        supabase.from('appellations').select('id, nom, region_id').order('nom'),
      ])
      setCommandesEnvoyees(cmds || [])
      setSites(sitesData || [])
      setDomaines(domainesData || [])
      setRegions(regionsData || [])
      setAppellations(appellationsData || [])
      const entrepot = sitesData?.find((s: any) => s.type === 'entrepot')
      setSiteReception(entrepot?.id || sitesData?.[0]?.id || '')
      setLoading(false)
    }
    load()
  }, [])

  const selectCommande = async (cmd: any) => {
    setSelectedCmd(cmd)
    setError('')
    setSuccess('')
    const { data } = await supabase
      .from('supplier_order_items')
      .select('*, product:products(id, nom, millesime, couleur)')
      .eq('order_id', cmd.id)
    const itemsData = data || []
    setItems(itemsData)
    const initQty: Record<string, number> = {}
    const initPrix: Record<string, number> = {}
    itemsData.forEach((item: any) => {
      initQty[item.id] = item.quantite_commandee
      initPrix[item.id] = parseFloat(item.prix_achat_ht || 0)
    })
    setQtesRecues(initQty)
    setPrixRecus(initPrix)
    setShowForm(true)
  }

  const searchProducts = async (q: string) => {
    setSearchProd(q)
    if (q.length < 2) { setSearchProdRes([]); return }
    const { data } = await supabase.from('products').select('id, nom, millesime, prix_achat_ht').ilike('nom', `%${q}%`).eq('actif', true).limit(10)
    setSearchProdRes(data || [])
  }

  const addProduitSupplementaire = async (prod: any) => {
    if (!selectedCmd) return
    // Ajouter une ligne à la commande
    const { data: newItem } = await supabase.from('supplier_order_items').insert({
      order_id: selectedCmd.id,
      product_id: prod.id,
      product_nom: prod.nom,
      product_millesime: prod.millesime,
      quantite_commandee: 1,
      prix_achat_ht: prod.prix_achat_ht || 0,
    }).select().single()
    if (newItem) {
      setItems(prev => [...prev, { ...newItem, product: prod }])
      setQtesRecues(prev => ({ ...prev, [newItem.id]: 1 }))
      setPrixRecus(prev => ({ ...prev, [newItem.id]: parseFloat(prod.prix_achat_ht || 0) }))
    }
    setSearchProd('')
    setSearchProdRes([])
  }

  const handleReception = async () => {
    if (!selectedCmd) return
    setProcessing(true)
    setError('')
    let hasError = false

    for (const item of items) {
      const qty = qtesRecues[item.id] ?? 0
      const newPrix = prixRecus[item.id] ?? parseFloat(item.prix_achat_ht || 0)
      const oldPrix = parseFloat(item.prix_achat_ht || 0)
      await supabase.from('supplier_order_items').update({ quantite_recue: qty, prix_achat_ht: newPrix }).eq('id', item.id)
      // Si prix changé → mettre à jour la fiche produit
      if (Math.abs(newPrix - oldPrix) > 0.001 && item.product_id) {
        const confirmed = prixVenteRecus[item.id]
        const newTTC = confirmed ? confirmed.ttcPart : Math.ceil(newPrix * 2 * 2) / 2
        const newPro = confirmed ? confirmed.ttcPro : Math.round(newPrix * 1.70 * 100) / 100
        await supabase.from('products').update({ prix_achat_ht: newPrix, prix_vente_ttc: newTTC, prix_vente_pro: newPro }).eq('id', item.product_id)
        await supabase.from('product_suppliers').update({ prix_achat_ht: newPrix }).eq('product_id', item.product_id).eq('fournisseur_principal', true)
      }
      if (qty > 0 && siteReception) {
        const { error: stockErr } = await supabase.rpc('move_stock', {
          p_product_id: item.product_id,
          p_site_id: siteReception,
          p_raison: 'achat',
          p_quantite: qty,
          p_note: `Réception ${selectedCmd.numero}`,
          p_order_id: null,
          p_transfer_id: null,
        })
        if (stockErr) { console.error(stockErr); hasError = true }
      }
    }

    await supabase.from('supplier_orders').update({
      statut: 'reçue',
      date_livraison_effective: new Date().toISOString().split('T')[0],
    }).eq('id', selectedCmd.id)

    setProcessing(false)
    if (hasError) {
      setError('Réception enregistrée mais certains stocks n\'ont pas pu être mis à jour.')
    } else {
      setSuccess(`Réception de ${selectedCmd.numero} validée ! Stock mis à jour sur ${sites.find(s => s.id === siteReception)?.nom || 'le site choisi'}.`)
    }
    setShowForm(false)
    setSelectedCmd(null)
    setCommandesEnvoyees(prev => prev.filter(c => c.id !== selectedCmd.id))
    onRefresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Réception</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{commandesEnvoyees.length} commande{commandesEnvoyees.length > 1 ? 's' : ''} en attente de réception</p>
        </div>
        {!showForm && commandesEnvoyees.length > 0 && (
          <button onClick={() => setShowForm(true)} style={{
            background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
            padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const,
          }}>📦 Créer une réception</button>
        )}
      </div>

      {success && (
        <div style={{ background: 'rgba(110,201,110,0.1)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 4, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#6ec96e' }}>
          ✓ {success}
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#c96e6e' }}>
          ⚠ {error}
        </div>
      )}

      {loading ? <Spinner /> : commandesEnvoyees.length === 0 && !showForm ? (
        <div style={{ ...card, textAlign: 'center' as const, padding: '48px' }}>
          <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 14 }}>Aucune commande en attente de réception.</p>
          <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 12, marginTop: 8 }}>Les commandes envoyées apparaîtront ici.</p>
        </div>
      ) : !showForm ? (
        // Liste des commandes envoyées
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {commandesEnvoyees.map(cmd => (
            <div key={cmd.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{cmd.numero}</span>
                  <Badge statut={cmd.statut} />
                </div>
                <div style={{ fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 300, marginBottom: 3 }}>{cmd.fournisseur?.nom}</div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>
                  {cmd.items?.length || 0} référence{(cmd.items?.length || 0) > 1 ? 's' : ''}
                  {cmd.date_commande && ` · Commandée le ${new Date(cmd.date_commande).toLocaleDateString('fr-FR')}`}
                </div>
              </div>
              <button onClick={() => selectCommande(cmd)} style={{
                background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
                padding: '9px 18px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1,
              }}>Réceptionner →</button>
            </div>
          ))}
        </div>
      ) : (
        // Formulaire de réception
        <div>
          {/* Choix commande */}
          {!selectedCmd ? (
            <div style={card}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 14 }}>Choisir la commande à réceptionner</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {commandesEnvoyees.map(cmd => (
                  <div key={cmd.id} onClick={() => selectCommande(cmd)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 4,
                    cursor: 'pointer', border: '0.5px solid rgba(255,255,255,0.06)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                  >
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{cmd.numero}</div>
                      <div style={{ fontSize: 14, color: '#f0e8d8' }}>{cmd.fournisseur?.nom}</div>
                      <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{cmd.items?.length || 0} réf.</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Sélectionner →</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowForm(false)} style={{ marginTop: 16, background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0 }}>← Annuler</button>
            </div>
          ) : (
            // Formulaire de saisie des quantités
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e', marginBottom: 4 }}>{selectedCmd.numero}</div>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>{selectedCmd.fournisseur?.nom}</h2>
                </div>
                <button onClick={() => { setSelectedCmd(null); setShowForm(true) }} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer' }}>← Changer de commande</button>
              </div>

              {/* Site de réception */}
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={lbl}>Site de réception (où entrer le stock)</div>
                <select value={siteReception} onChange={e => setSiteReception(e.target.value)} style={{ ...sel, maxWidth: 350 }}>
                  {sites.map(s => <option key={s.id} value={s.id} style={{ background: '#1a1408', color: '#f0e8d8' }}>{s.nom} — {s.ville}</option>)}
                </select>
              </div>

              {/* Produits */}
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 14 }}>
                  Quantités reçues — saisissez les quantités exactes
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                      {['Produit', 'Commandé', 'Prix achat HT', 'Reçu', 'Différence'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Popup prix */}
                    {popupPrix && (
                      <tr>
                        <td colSpan={5} style={{ padding: 0 }}>
                          <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                            <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, padding: '24px 28px', maxWidth: 440, width: '100%' }}>
                              <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Mise à jour des prix</h3>
                              <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginBottom: 16 }}>{popupPrix.item.product_nom}</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
                                <div>
                                  <div style={{ fontSize: 9, letterSpacing: 1, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Prix achat HT</div>
                                  <div style={{ fontSize: 15, color: '#e8e0d5', fontFamily: 'Georgia, serif', padding: '6px 0' }}>{popupPrix.newPrix.toFixed(2)}€</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 9, letterSpacing: 1, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Prix TTC particulier</div>
                                  <input
                                    type="number" step="0.50"
                                    value={popupPrix.ttcPart}
                                    onChange={e => setPopupPrix(p => p ? { ...p, ttcPart: parseFloat(e.target.value) || 0 } : p)}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.4)', borderRadius: 3, color: '#c9a96e', fontSize: 14, padding: '6px 8px', textAlign: 'center' as const, fontFamily: 'Georgia, serif' }}
                                  />
                                  <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.25)', textAlign: 'center' as const, marginTop: 3 }}>Modifiable</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 9, letterSpacing: 1, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Prix TTC pro</div>
                                  <input
                                    type="number" step="0.01"
                                    value={popupPrix.ttcPro}
                                    onChange={e => setPopupPrix(p => p ? { ...p, ttcPro: parseFloat(e.target.value) || 0 } : p)}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(110,158,201,0.4)', borderRadius: 3, color: '#6e9ec9', fontSize: 14, padding: '6px 8px', textAlign: 'center' as const, fontFamily: 'Georgia, serif' }}
                                  />
                                  <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.25)', textAlign: 'center' as const, marginTop: 3 }}>Modifiable</div>
                                </div>
                              </div>
                              <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginBottom: 16 }}>
                                Les prix seront mis à jour sur la fiche produit à la validation de la réception.
                              </p>
                              <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => {
                                  setPrixRecus(p => ({ ...p, [popupPrix.item.id]: parseFloat(popupPrix.item.prix_achat_ht || 0) }))
                                  setPopupPrix(null)
                                }} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '9px', fontSize: 11, cursor: 'pointer' }}>
                                  Annuler
                                </button>
                                <button onClick={() => {
                                  setPrixVenteRecus(p => ({ ...p, [popupPrix.item.id]: { ttcPart: popupPrix.ttcPart, ttcPro: popupPrix.ttcPro } }))
                                  setPopupPrix(null)
                                }} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '9px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                                  ✓ Confirmer
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {items.map((item, i) => {
                      const recu = qtesRecues[item.id] ?? item.quantite_commandee
                      const diff = recu - item.quantite_commandee
                      const currentPrix = prixRecus[item.id] ?? parseFloat(item.prix_achat_ht || 0)
                      const originalPrix = parseFloat(item.prix_achat_ht || 0)
                      const prixChanged = Math.abs(currentPrix - originalPrix) > 0.001
                      return (
                        <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontSize: 13, color: '#f0e8d8' }}>{item.product_nom}</div>
                            {item.product_millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{item.product_millesime}</div>}
                            {item.quantite_commandee === 0 && <div style={{ fontSize: 10, color: '#c9b06e' }}>Ajouté à la réception</div>}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
                            {item.quantite_commandee > 0 ? `${item.quantite_commandee} btl` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="number" step="0.01"
                              value={currentPrix}
              onChange={e => {
                                const newVal = parseFloat(e.target.value) || 0
                                setPrixRecus(p => ({ ...p, [item.id]: newVal }))
                              }}
                              onBlur={e => {
                                const newVal = parseFloat(e.target.value) || 0
                                if (Math.abs(newVal - originalPrix) > 0.001) {
                                  setPopupPrix({
                                    item,
                                    newPrix: newVal,
                                    ttcPart: Math.ceil(newVal * 2 * 2) / 2,
                                    ttcPro: Math.round(newVal * 1.70 * 100) / 100,
                                  })
                                }
                              }}
                              style={{ width: 90, background: prixChanged ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${prixChanged ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 3, color: prixChanged ? '#c9a96e' : '#e8e0d5', fontSize: 13, padding: '5px 8px', textAlign: 'center' as const }}
                            />
                            {prixChanged && <div style={{ fontSize: 9, color: '#c9a96e', textAlign: 'center' as const, marginTop: 2 }}>Modifié ✓</div>}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="number" min={0}
                              value={recu}
                              onChange={e => setQtesRecues(q => ({ ...q, [item.id]: parseInt(e.target.value) || 0 }))}
                              style={{ width: 80, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 3, color: '#e8e0d5', fontSize: 13, padding: '5px 8px', textAlign: 'center' as const }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: diff === 0 ? '#6ec96e' : diff > 0 ? '#c9b06e' : '#c96e6e', fontWeight: 500 }}>
                            {item.quantite_commandee > 0 ? (diff === 0 ? '✓ Complet' : diff > 0 ? `+${diff}` : `${diff}`) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Ajouter produit supplémentaire */}
                <div style={{ marginTop: 16, borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Produit non prévu dans la commande :</div>
                    <button onClick={() => setShowNouveauProduit(true)} style={{
                      background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)',
                      color: '#c9a96e', borderRadius: 4, padding: '6px 12px', fontSize: 11,
                      cursor: 'pointer', letterSpacing: 0.5,
                    }}>+ Créer un nouveau produit</button>
                  </div>
                  <input
                    value={searchProd}
                    onChange={e => searchProducts(e.target.value)}
                    placeholder="Rechercher un produit existant..."
                    style={{ ...inp, maxWidth: 420 }}
                  />
                  {searchProdRes.length > 0 && (
                    <div style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 4, maxWidth: 420 }}>
                      {searchProdRes.map(p => (
                        <div key={p.id} onClick={() => addProduitSupplementaire(p)} style={{
                          display: 'flex', justifyContent: 'space-between', padding: '9px 14px',
                          cursor: 'pointer', background: '#18130e', borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#18130e')}
                        >
                          <span style={{ fontSize: 13, color: '#f0e8d8' }}>{p.nom}{p.millesime ? ` ${p.millesime}` : ''}</span>
                          <span style={{ fontSize: 10, color: '#c9a96e' }}>+ Ajouter</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setSelectedCmd(null); }} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '12px', fontSize: 11, cursor: 'pointer' }}>
                  ← Retour
                </button>
                <button onClick={handleReception} disabled={processing} style={{
                  flex: 3, background: '#6ec96e', color: '#0a1a0a', border: 'none', borderRadius: 4,
                  padding: '12px', fontSize: 11, cursor: 'pointer', fontWeight: 500,
                  letterSpacing: 1.5, textTransform: 'uppercase' as const,
                  opacity: processing ? 0.7 : 1,
                }}>
                  {processing ? '⟳ Validation en cours...' : '✓ Valider la réception et mettre le stock à jour'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    {showNouveauProduit && selectedCmd && (
      <ModalNouveauProduit
        domaines={domaines}
        regions={regions}
        appellations={appellations}
        onCreated={async (product: any, _domaineId: string, _prixHT: string, _conditionnement: string) => {
          if (!product || !product.id) { console.error('Product null or missing id'); return }
          const cmdId = selectedCmd?.id
          if (!cmdId) { console.error('selectedCmd null'); return }
          const { data: newItem, error: insertErr } = await supabase.from('supplier_order_items').insert({
            order_id: cmdId,
            product_id: product.id,
            product_nom: product.nom || '',
            product_millesime: product.millesime || null,
            quantite_commandee: 1,
            prix_achat_ht: product.prix_achat_ht || 0,
          }).select().single()
          if (insertErr) { console.error('Insert error:', insertErr.message, insertErr.code); }
          if (newItem) {
            setItems((prev: any[]) => [...prev, { ...newItem, product }])
            setQtesRecues((prev: Record<string, number>) => ({ ...prev, [newItem.id]: 1 }))
          }
          setShowNouveauProduit(false)
        }}
        onClose={() => setShowNouveauProduit(false)}
      />
    )}

    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

export default function AdminCommandesPage() {
  const [view, setView] = useState<View>('commandes')
  const [selectedCommande, setSelectedCommande] = useState<any>(null)
  const [counts, setCounts] = useState({ besoins: 0, commandes: 0, reception: 0 })
  const [refreshKey, setRefreshKey] = useState(0)
  const [preselectedDomaineId, setPreselectedDomaineId] = useState<string | null>(null)

  const loadCounts = useCallback(async () => {
    const [{ count: cB }, { count: cC }, { count: cR }] = await Promise.all([
      supabase.from('order_needs').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
      supabase.from('supplier_orders').select('*', { count: 'exact', head: true }).in('statut', ['brouillon']),
      supabase.from('supplier_orders').select('*', { count: 'exact', head: true }).eq('statut', 'envoyée'),
    ])
    setCounts({ besoins: cB || 0, commandes: cC || 0, reception: cR || 0 })
  }, [])

  useEffect(() => { loadCounts() }, [loadCounts])

  useEffect(() => {
    // Lire le paramètre domaine depuis l'URL (venant de la fiche fournisseur)
    const params = new URLSearchParams(window.location.search)
    const domaineId = params.get('domaine')
    if (domaineId) {
      setPreselectedDomaineId(domaineId)
      setView('commandes')
    }
  }, [])

  const handleRefresh = useCallback(() => {
    loadCounts()
    setRefreshKey(k => k + 1)
  }, [loadCounts])

  const handleSelectDetail = async (cmd: any) => {
    const { data } = await supabase.from('supplier_orders').select('*, fournisseur:domaines(id, nom)').eq('id', cmd.id).single()
    setSelectedCommande(data || cmd)
    setView('detail')
  }

  const goToCommandes = () => {
    setView('commandes')
    setSelectedCommande(null)
    handleRefresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex' }}>
      <Sidebar view={view} setView={v => { setView(v); setSelectedCommande(null); handleRefresh() }} counts={counts} />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>
        {view === 'besoins' && <VueBesoins onRefresh={handleRefresh} />}
        {view === 'commandes' && <VueCommandes key={refreshKey} onSelectDetail={handleSelectDetail} preselectedDomaineId={preselectedDomaineId} onClearPreselect={() => setPreselectedDomaineId(null)} />}
        {view === 'reception' && <VueReception key={refreshKey} onRefresh={handleRefresh} />}
        {view === 'detail' && selectedCommande && (
          <DetailCommande
            commande={selectedCommande}
            onBack={goToCommandes}
            onRefresh={handleRefresh}
          />
        )}
        {view === 'associer' && <VueAssocierFournisseurs />}
      </main>
    </div>
  )
}