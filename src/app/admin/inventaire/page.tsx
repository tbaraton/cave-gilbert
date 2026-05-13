'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Styles ────────────────────────────────────────────────────
const inp = { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
const sel = { ...inp, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', cursor: 'pointer' }
const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }
const card = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px 24px' } as React.CSSProperties
const btnGold = { background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const } as React.CSSProperties
const btnGhost = { background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '10px 16px', fontSize: 11, cursor: 'pointer' } as React.CSSProperties

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

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <div style={{ fontSize: 24, color: '#c9a96e', animation: 'spin 1.5s linear infinite' }}>⟳</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar() {
  return (
    <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <a href="/admin" style={{ display: 'block', marginBottom: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="Cave de Gilbert" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', maxHeight: 52, objectFit: 'contain' }} />
        </a>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
        <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
      </div>
      <nav style={{ padding: '16px 0' }}>
        {[
          { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
          { label: 'Produits', href: '/admin', icon: '⬥' },
          { label: 'Clients', href: '/admin/clients', icon: '◎' },
          { label: 'Fournisseurs', href: '/admin/fournisseurs', icon: '◈' },
          { label: 'Commandes', href: '/admin/commandes', icon: '◻' },
          { label: 'Inventaire', href: '/admin/inventaire', icon: '◉' },
          { label: 'Location', href: '/admin/location', icon: '🍺' },
        ].map(item => (
          <a key={item.label} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: item.href === '/admin/inventaire' ? '#c9a96e' : 'rgba(232,224,213,0.45)', borderLeft: item.href === '/admin/inventaire' ? '2px solid #c9a96e' : '2px solid transparent', textDecoration: 'none', background: item.href === '/admin/inventaire' ? 'rgba(201,169,110,0.08)' : 'transparent' }}>
            <span>{item.icon}</span>{item.label}
          </a>
        ))}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', position: 'absolute' as const, bottom: 0, left: 0, right: 0 }}>
        <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none' }}>← Voir le site</a>
      </div>
    </aside>
  )
}

// ── Vue liste des comptages ───────────────────────────────────
function VueComptages({ onSelect, onNew, onCloturer }: {
  onSelect: (c: any) => void
  onNew: () => void
  onCloturer: () => void
}) {
  const [comptages, setComptages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('en_cours')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('comptages')
      .select('*, site:sites(id, nom)')
      .order('date_comptage', { ascending: false })
    setComptages(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = comptages.filter(c => filterStatut === 'tous' || c.statut === filterStatut)
  const enCours = comptages.filter(c => c.statut === 'en_cours').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Inventaire — Comptages</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{enCours} comptage{enCours > 1 ? 's' : ''} en cours</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCloturer} style={{ ...btnGhost, borderColor: 'rgba(201,169,110,0.3)', color: '#c9a96e' }}>
            📋 Clôture d'inventaire
          </button>
          <button onClick={onNew} style={btnGold}>+ Nouveau comptage</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['en_cours', 'En cours'], ['validé', 'Validés'], ['annulé', 'Annulés'], ['tous', 'Tous']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatut(val)} style={{
            background: filterStatut === val ? 'rgba(201,169,110,0.15)' : 'transparent',
            border: `0.5px solid ${filterStatut === val ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: filterStatut === val ? '#c9a96e' : 'rgba(232,224,213,0.4)',
            borderRadius: 4, padding: '7px 14px', fontSize: 11, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ ...card, textAlign: 'center' as const, padding: 48 }}>
          <p style={{ color: 'rgba(232,224,213,0.4)', marginBottom: 16 }}>Aucun comptage. Créez-en un pour commencer.</p>
          <button onClick={onNew} style={btnGold}>+ Nouveau comptage</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {filtered.map(c => {
            const statutColor = c.statut === 'en_cours' ? '#c9b06e' : c.statut === 'validé' ? '#6ec96e' : '#888'
            const statutBg = c.statut === 'en_cours' ? 'rgba(201,176,110,0.1)' : c.statut === 'validé' ? 'rgba(110,201,110,0.1)' : 'rgba(128,128,128,0.1)'
            return (
              <div key={c.id} onClick={() => c.statut === 'en_cours' ? onSelect(c) : null}
                style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: c.statut === 'en_cours' ? 'pointer' : 'default', opacity: c.statut === 'annulé' ? 0.5 : 1 }}
                onMouseEnter={e => { if (c.statut === 'en_cours') e.currentTarget.style.borderColor = 'rgba(201,169,110,0.25)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 300 }}>{c.nom}</span>
                    <span style={{ background: statutBg, color: statutColor, fontSize: 10, padding: '2px 8px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase' as const }}>{c.statut}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                    {new Date(c.date_comptage).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {c.site?.nom && ` · ${c.site.nom}`}
                    {c.notes && ` · ${c.notes}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {c.statut === 'en_cours' && (
                    <span style={{ fontSize: 12, color: '#c9a96e' }}>Reprendre →</span>
                  )}
                  {c.statut === 'validé' && c.validated_at && (
                    <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>Validé le {new Date(c.validated_at).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Modal duplication produit depuis comptage ─────────────────
function ModalDupliquerComptage({ produit, regions, appellations, domaines, onCreated, onClose }: {
  produit: any; regions: any[]; appellations: any[]; domaines: any[]
  onCreated: (p: any) => void; onClose: () => void
}) {
  const [millesime, setMillesime] = useState(produit.millesime ? String(produit.millesime + 1) : '')
  const [prixAchatHT, setPrixAchatHT] = useState(produit.prix_achat_ht ? String(produit.prix_achat_ht) : '')
  const [nomSurcharge, setNomSurcharge] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const arrondir50 = (n: number) => Math.ceil(n * 2) / 2
  const prixHT = parseFloat(prixAchatHT) || produit.prix_achat_ht || 0
  const prixTTC = prixHT > 0 ? arrondir50(prixHT * 2) : produit.prix_vente_ttc
  const prixPro = prixHT > 0 ? Math.round(prixHT * 1.70 * 100) / 100 : produit.prix_vente_pro

  const buildNom = () => {
    if (nomSurcharge.trim()) return nomSurcharge.trim()
    let nom = produit.nom || ''
    if (produit.millesime && millesime) nom = nom.replace(String(produit.millesime), millesime)
    return nom
  }

  const COULEURS_VIN = ['rouge', 'blanc', 'rosé', 'champagne', 'effervescent']

  const handleDupliquer = async (archiver = false) => {
    setSaving(true); setError('')
    const nomFinal = buildNom()
    const slug = nomFinal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 7)
    const categorie = COULEURS_VIN.includes(produit.couleur) ? 'vin' : produit.couleur === 'spiritueux' ? 'spiritueux' : 'vin'
    const { data: newProd, error: err } = await supabase.from('products').insert({
      nom: nomFinal, slug,
      nom_cuvee: produit.nom_cuvee || null, contenance: produit.contenance || '75cl',
      millesime: millesime && millesime.trim() !== '' ? parseInt(millesime) : (produit.millesime || null),
      couleur: produit.couleur, categorie,
      region_id: produit.region_id || null, appellation_id: produit.appellation_id || null,
      domaine_id: produit.domaine_id || null,
      prix_achat_ht: prixHT || null, prix_vente_ttc: prixTTC || null, prix_vente_pro: prixPro || null,
      image_url: produit.image_url || null,
      bio: produit.bio || false, vegan: produit.vegan || false, casher: produit.casher || false,
      naturel: produit.naturel || false, biodynamique: produit.biodynamique || false, actif: true,
    }).select('id, nom, millesime, couleur, domaine_id').single()
    if (err || !newProd) { setError(err?.message || 'Erreur création'); setSaving(false); return }
    if (produit.domaine_id && newProd.id) {
      await supabase.from('product_suppliers').upsert({
        product_id: newProd.id, domaine_id: produit.domaine_id,
        prix_achat_ht: prixHT || null, conditionnement: 6, fournisseur_principal: true,
      }, { onConflict: 'product_id,domaine_id' })
    }
    if (archiver) await supabase.from('products').update({ actif: false }).eq('id', produit.id)
    setSaving(false)
    onCreated(newProd)
  }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 8, width: 440, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>⧉ Dupliquer le produit</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginBottom: 4 }}>ORIGINAL</div>
          <div style={{ fontSize: 13, color: '#e8e0d5' }}>{produit.nom}</div>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#c96e6e' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Nouveau millésime</label>
            <input type="number" value={millesime} onChange={e => setMillesime(e.target.value)} placeholder="Ex: 2025" style={{ ...inp, width: '100%' }} autoFocus />
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.25)', marginTop: 4 }}>Vide = même millésime</div>
          </div>
          <div>
            <label style={lbl}>Prix achat HT (€)</label>
            <input type="number" step="0.01" value={prixAchatHT} onChange={e => setPrixAchatHT(e.target.value)} placeholder="0.00" style={{ ...inp, width: '100%' }} />
          </div>
        </div>
        <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.15)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5 }}>NOM DU DUPLICATA</div>
            {nomSurcharge && <button onClick={() => setNomSurcharge('')} style={{ background: 'transparent', border: 'none', color: 'rgba(201,169,110,0.5)', fontSize: 10, cursor: 'pointer', padding: 0 }}>↺ Auto</button>}
          </div>
          <input value={nomSurcharge || buildNom()} onChange={e => setNomSurcharge(e.target.value)} onFocus={() => { if (!nomSurcharge) setNomSurcharge(buildNom()) }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(201,169,110,0.2)', color: '#c9a96e', fontSize: 13, fontFamily: 'Georgia, serif', padding: '4px 0', outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>Annuler</button>
          <button onClick={() => handleDupliquer(false)} disabled={saving} style={{ ...btnGhost, borderColor: 'rgba(201,169,110,0.3)', color: '#c9a96e', opacity: saving ? 0.7 : 1 }}>Dupliquer</button>
          <button onClick={() => handleDupliquer(true)} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.7 : 1 }}>{saving ? '⟳ Création...' : 'Dupliquer & archiver original'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal nouveau produit depuis comptage ─────────────────────
function ModalNouveauProduitComptage({ regions, appellations, domaines, onCreated, onClose }: {
  regions: any[]; appellations: any[]; domaines: any[]
  onCreated: (p: any) => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    nomSurcharge: '', appellation_nom: '', appellation_id: '', region_id: '',
    nom_cuvee: '', domaine_id: '', contenance: '75cl', millesime: '',
    couleur: 'rouge', prix_achat_ht: '', coeff: '2', prix_vente_ttc: '',
    bio: false, vegan: false, casher: false, naturel: false, biodynamique: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const COULEURS_VIN = ['rouge', 'blanc', 'rosé', 'champagne', 'effervescent']
  const COULEURS = [...COULEURS_VIN, 'spiritueux', 'autre']
  const CERTIFS = [{ key: 'bio', label: '🌿 Bio' }, { key: 'vegan', label: '🌱 Vegan' }, { key: 'casher', label: '✡ Casher' }, { key: 'naturel', label: '🍃 Naturel' }, { key: 'biodynamique', label: '🌙 Biodynamique' }]

  const appsFiltrees = form.region_id ? appellations.filter(a => a.region_id === form.region_id) : appellations
  const arrondir50 = (n: number) => Math.ceil(n * 2) / 2

  const buildNom = () => {
    if (form.nomSurcharge.trim()) return form.nomSurcharge.trim()
    const parts = []
    if (form.appellation_nom) parts.push(form.appellation_nom)
    if (form.nom_cuvee) parts.push(form.nom_cuvee)
    if (form.couleur) parts.push(form.couleur.charAt(0).toUpperCase() + form.couleur.slice(1))
    if (form.millesime) parts.push(form.millesime)
    if (form.contenance) parts.push(form.contenance)
    let nom = parts.join(' ')
    const dom = domaines.find(d => d.id === form.domaine_id)
    if (dom) nom += ' — ' + dom.nom
    return nom
  }

  const handleSave = async () => {
    const nomFinal = buildNom()
    if (!nomFinal.trim()) { setError('Remplissez au moins un champ pour générer le nom'); return }
    if (!form.prix_vente_ttc) { setError('Le prix TTC est obligatoire'); return }
    setSaving(true); setError('')
    const slug = nomFinal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 7)
    const categorie = COULEURS_VIN.includes(form.couleur) ? 'vin' : form.couleur === 'spiritueux' ? 'spiritueux' : 'vin'
    const { data: newProd, error: err } = await supabase.from('products').insert({
      nom: nomFinal, slug, nom_cuvee: form.nom_cuvee || null, contenance: form.contenance || '75cl',
      millesime: form.millesime ? parseInt(form.millesime) : null, couleur: form.couleur, categorie,
      region_id: form.region_id || null, appellation_id: form.appellation_id || null,
      domaine_id: form.domaine_id || null,
      prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
      prix_vente_ttc: parseFloat(form.prix_vente_ttc),
      prix_vente_pro: form.prix_achat_ht ? Math.round(parseFloat(form.prix_achat_ht) * 1.70 * 100) / 100 : null,
      bio: form.bio, vegan: form.vegan, casher: form.casher, naturel: form.naturel,
      biodynamique: form.biodynamique, actif: true,
    }).select('id, nom, millesime, couleur, domaine_id').single()
    if (err || !newProd) { setError(err?.message || 'Erreur'); setSaving(false); return }
    if (form.domaine_id && newProd.id) {
      await supabase.from('product_suppliers').upsert({
        product_id: newProd.id, domaine_id: form.domaine_id,
        prix_achat_ht: form.prix_achat_ht ? parseFloat(form.prix_achat_ht) : null,
        conditionnement: 6, fournisseur_principal: true,
      }, { onConflict: 'product_id,domaine_id' })
    }
    setSaving(false)
    onCreated(newProd)
  }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' as const, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouveau produit</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#c96e6e' }}>{error}</div>}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(201,169,110,0.15)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>NOM DU PRODUIT</span>
            <button onClick={() => setForm(f => ({ ...f, nomSurcharge: buildNom() }))} style={{ background: 'transparent', border: 'none', color: 'rgba(201,169,110,0.5)', fontSize: 10, cursor: 'pointer', padding: 0 }}>↺ Regénérer</button>
          </div>
          <input value={form.nomSurcharge || buildNom()} onChange={e => setForm(f => ({ ...f, nomSurcharge: e.target.value }))} onFocus={() => { if (!form.nomSurcharge) setForm(f => ({ ...f, nomSurcharge: buildNom() })) }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(201,169,110,0.3)', color: '#f0e8d8', fontSize: 14, fontFamily: 'Georgia, serif', padding: '4px 0', outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Région</label>
            <select value={form.region_id} onChange={e => setForm(f => ({ ...f, region_id: e.target.value, appellation_id: '', appellation_nom: '' }))} style={{ ...sel, width: '100%' }}>
              <option value="">— Choisir —</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Appellation</label>
            <select value={form.appellation_id} onChange={e => { const a = appsFiltrees.find(x => x.id === e.target.value); setForm(f => ({ ...f, appellation_id: e.target.value, appellation_nom: a?.nom || '' })) }} style={{ ...sel, width: '100%' }}>
              <option value="">— Choisir —</option>
              {appsFiltrees.filter(a => !a.type || a.type === 'AOC').length > 0 && <optgroup label="── AOC / AOP ──">{appsFiltrees.filter(a => !a.type || a.type === 'AOC').map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>}
              {appsFiltrees.filter(a => a.type === 'IGP').length > 0 && <optgroup label="── IGP ──">{appsFiltrees.filter(a => a.type === 'IGP').map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>}
            </select>
          </div>
          <div>
            <label style={lbl}>Nom de cuvée</label>
            <input value={form.nom_cuvee} onChange={e => setForm(f => ({ ...f, nom_cuvee: e.target.value }))} placeholder="Laisser vide si aucune" style={{ ...inp, width: '100%', fontStyle: 'italic' }} />
          </div>
          <div>
            <label style={lbl}>Fournisseur</label>
            <select value={form.domaine_id} onChange={e => setForm(f => ({ ...f, domaine_id: e.target.value }))} style={{ ...sel, width: '100%' }}>
              <option value="">— Choisir —</option>
              {domaines.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Couleur *</label>
            <select value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))} style={{ ...sel, width: '100%' }}>
              {COULEURS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Millésime</label>
              <input type="number" value={form.millesime} onChange={e => setForm(f => ({ ...f, millesime: e.target.value }))} placeholder="2024" style={{ ...inp, width: '100%' }} />
            </div>
            <div>
              <label style={lbl}>Contenance</label>
              <input value={form.contenance} onChange={e => setForm(f => ({ ...f, contenance: e.target.value }))} placeholder="75cl" style={{ ...inp, width: '100%' }} />
            </div>
          </div>
          <div>
            <label style={lbl}>Prix achat HT (€)</label>
            <input type="number" step="0.01" value={form.prix_achat_ht} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, prix_achat_ht: v, prix_vente_ttc: v && parseFloat(v) > 0 ? String(arrondir50(parseFloat(v) * 2)) : f.prix_vente_ttc })) }} style={{ ...inp, width: '100%' }} />
          </div>
          <div>
            <label style={lbl}>Prix TTC particulier (€) *</label>
            <input type="number" step="0.50" value={form.prix_vente_ttc} onChange={e => setForm(f => ({ ...f, prix_vente_ttc: e.target.value }))} style={{ ...inp, width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
          {CERTIFS.map(({ key, label }) => {
            const active = (form as any)[key]
            return <button key={key} onClick={() => setForm(f => ({ ...f, [key]: !active }))} style={{ background: active ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${active ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`, color: active ? '#c9a96e' : 'rgba(232,224,213,0.4)', borderRadius: 20, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>{label}</button>
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={btnGhost}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnGold, flex: 1, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳ Création...' : '✓ Créer et ajouter au comptage'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal nouveau comptage ────────────────────────────────────
function ModalNouveauComptage({ onCreated, onClose }: { onCreated: (c: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ nom: '', date_comptage: new Date().toISOString().split('T')[0], site_id: '', notes: '' })
  const [produits, setProduits] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [domaines, setDomaines] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [appellations, setAppellations] = useState<any[]>([])
  const [filterDomaine, setFilterDomaine] = useState('')
  const [filterCouleur, setFilterCouleur] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'info' | 'produits'>('info')
  // Duplication
  const [showDupliquer, setShowDupliquer] = useState<any>(null)
  const [showNouveauProduit, setShowNouveauProduit] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id, nom, millesime, couleur, domaine_id, region_id, actif').eq('actif', true).order('nom').limit(5000),
      supabase.from('sites').select('id, nom').eq('actif', true).order('nom'),
      supabase.from('domaines').select('id, nom').order('nom'),
      supabase.from('regions').select('id, nom').order('nom'),
      supabase.from('appellations').select('id, nom, region_id, type').order('nom'),
    ]).then(([{ data: p }, { data: s }, { data: d }, { data: r }, { data: a }]) => {
      setProduits(p || [])
      setSites(s || [])
      setDomaines(d || [])
      setRegions(r || [])
      setAppellations(a || [])
      setSelected(new Set((p || []).map((x: any) => x.id)))
    })
  }, [])

  const reloadProduits = async () => {
    const { data } = await supabase.from('products').select('id, nom, millesime, couleur, domaine_id, region_id, actif').eq('actif', true).order('nom').limit(5000)
    setProduits(data || [])
    return data || []
  }

  const produitsFiltres = produits.filter(p =>
    (filterDomaine === '' || p.domaine_id === filterDomaine) &&
    (filterCouleur === '' || p.couleur === filterCouleur) &&
    (filterRegion === '' || p.region_id === filterRegion) &&
    (search === '' || p.nom.toLowerCase().includes(search.toLowerCase()))
  )

  const handleCreate = async () => {
    if (!form.nom.trim()) { setError('Le nom est obligatoire'); return }
    if (selected.size === 0) { setError('Sélectionnez au moins un produit'); return }
    setSaving(true); setError('')
    const productIds = [...selected]
    const { data: stockData } = await supabase.from('v_stock_agrege').select('product_id, stock_total').in('product_id', productIds)
    const stockMap = Object.fromEntries((stockData || []).map((s: any) => [s.product_id, s.stock_total || 0]))
    const { data: comptage, error: err } = await supabase.from('comptages').insert({
      nom: form.nom.trim(), date_comptage: form.date_comptage,
      site_id: form.site_id || null, notes: form.notes || null, statut: 'en_cours',
    }).select('*, site:sites(id, nom)').single()
    if (err || !comptage) { setError(err?.message || 'Erreur création'); setSaving(false); return }
    const lignes = productIds.map(pid => ({ comptage_id: comptage.id, product_id: pid, stock_theorique: stockMap[pid] || 0, stock_compte: null }))
    for (let i = 0; i < lignes.length; i += 500) {
      await supabase.from('comptage_lignes').insert(lignes.slice(i, i + 500))
    }
    setSaving(false)
    onCreated(comptage)
  }

  const toggleAll = (select: boolean) => setSelected(select ? new Set(produitsFiltres.map(p => p.id)) : new Set())

  const COULEURS = ['rouge', 'blanc', 'rosé', 'champagne', 'effervescent', 'spiritueux', 'autre']

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 820, maxHeight: '92vh', overflowY: 'auto' as const, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>Nouveau comptage</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {([['info', '1. Informations'], ['produits', '2. Produits à compter']] as [string, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setStep(id as any)} style={{ background: 'transparent', border: 'none', borderBottom: step === id ? '2px solid #c9a96e' : '2px solid transparent', color: step === id ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '8px 20px', fontSize: 12, cursor: 'pointer', marginBottom: -1 }}>{label}</button>
          ))}
        </div>

        {step === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Nom du comptage *</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Vins rouges cave — Mai 2026" style={{ ...inp, width: '100%' }} autoFocus />
            </div>
            <div>
              <label style={lbl}>Date du comptage</label>
              <input type="date" value={form.date_comptage} onChange={e => setForm(f => ({ ...f, date_comptage: e.target.value }))} style={{ ...inp, width: '100%' }} />
            </div>
            <div>
              <label style={lbl}>Site (optionnel)</label>
              <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} style={{ ...sel, width: '100%' }}>
                <option value="">— Tous les sites —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Notes (optionnel)</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex: Zone rouge — rayon 1 à 4" style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button onClick={onClose} style={btnGhost}>Annuler</button>
              <button onClick={() => { if (!form.nom.trim()) { setError('Le nom est obligatoire'); return }; setError(''); setStep('produits') }} style={btnGold}>Suivant →</button>
            </div>
          </div>
        )}

        {step === 'produits' && (
          <>
            {/* Barre de filtres */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' as const }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un produit..." style={{ ...inp, flex: '1 1 200px', fontSize: 12, padding: '7px 10px' }} />
              <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ ...sel, fontSize: 12, padding: '7px 10px' }}>
                <option value="">Toutes les régions</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
              <select value={filterDomaine} onChange={e => setFilterDomaine(e.target.value)} style={{ ...sel, fontSize: 12, padding: '7px 10px' }}>
                <option value="">Tous les fournisseurs</option>
                {domaines.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
              <select value={filterCouleur} onChange={e => setFilterCouleur(e.target.value)} style={{ ...sel, fontSize: 12, padding: '7px 10px' }}>
                <option value="">Toutes les couleurs</option>
                {COULEURS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <button onClick={() => toggleAll(true)} style={{ ...btnGhost, fontSize: 10, padding: '5px 10px' }}>✓ Tout sélectionner</button>
              <button onClick={() => toggleAll(false)} style={{ ...btnGhost, fontSize: 10, padding: '5px 10px' }}>Tout décocher</button>
              <span style={{ fontSize: 12, color: '#c9a96e', marginLeft: 'auto' }}>{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
              <button onClick={() => setShowNouveauProduit(true)} style={{ ...btnGhost, fontSize: 10, padding: '5px 12px', borderColor: 'rgba(201,169,110,0.3)', color: '#c9a96e' }}>+ Nouveau produit</button>
            </div>

            <div style={{ border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', maxHeight: 360, overflowY: 'auto' as const, marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead style={{ position: 'sticky' as const, top: 0, background: '#14100c', zIndex: 1 }}>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <th style={{ width: 36, padding: '8px 12px' }}></th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>PRODUIT</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>COULEUR</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>MILLÉSIME</th>
                    <th style={{ width: 40, padding: '8px 12px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {produitsFiltres.map((p, i) => {
                    const checked = selected.has(p.id)
                    return (
                      <tr key={p.id}
                        style={{ borderBottom: i < produitsFiltres.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', background: checked ? 'rgba(201,169,110,0.05)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px' }} onClick={() => setSelected(prev => { const n = new Set(prev); checked ? n.delete(p.id) : n.add(p.id); return n })}>
                          <div style={{ width: 15, height: 15, borderRadius: 3, border: `1.5px solid ${checked ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: checked ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            {checked && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => setSelected(prev => { const n = new Set(prev); checked ? n.delete(p.id) : n.add(p.id); return n })}>
                          <div style={{ fontSize: 13, color: '#f0e8d8' }}>{p.nom}</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(232,224,213,0.5)', cursor: 'pointer' }} onClick={() => setSelected(prev => { const n = new Set(prev); checked ? n.delete(p.id) : n.add(p.id); return n })}>{p.couleur}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(232,224,213,0.4)', cursor: 'pointer' }} onClick={() => setSelected(prev => { const n = new Set(prev); checked ? n.delete(p.id) : n.add(p.id); return n })}>{p.millesime || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <button onClick={e => { e.stopPropagation(); setShowDupliquer(p) }} title="Dupliquer" style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.2)', color: 'rgba(201,169,110,0.5)', borderRadius: 3, padding: '3px 7px', fontSize: 11, cursor: 'pointer' }}>⧉</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('info')} style={btnGhost}>← Retour</button>
              <button onClick={handleCreate} disabled={saving || selected.size === 0} style={{ ...btnGold, opacity: saving || selected.size === 0 ? 0.6 : 1 }}>
                {saving ? '⟳ Création...' : `✓ Créer le comptage (${selected.size} produits)`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal duplication */}
      {showDupliquer && (
        <ModalDupliquerComptage
          produit={showDupliquer}
          regions={regions}
          appellations={appellations}
          domaines={domaines}
          onCreated={async (newProd) => {
            const fresh = await reloadProduits()
            setSelected(prev => { const n = new Set(prev); n.add(newProd.id); return n })
            setShowDupliquer(null)
          }}
          onClose={() => setShowDupliquer(null)}
        />
      )}

      {/* Modal nouveau produit */}
      {showNouveauProduit && (
        <ModalNouveauProduitComptage
          regions={regions}
          appellations={appellations}
          domaines={domaines}
          onCreated={async (newProd) => {
            await reloadProduits()
            setSelected(prev => { const n = new Set(prev); n.add(newProd.id); return n })
            setShowNouveauProduit(false)
          }}
          onClose={() => setShowNouveauProduit(false)}
        />
      )}
    </div>
  )
}


// ── Vue saisie d'un comptage ──────────────────────────────────
function VueSaisie({ comptage, onBack }: { comptage: any; onBack: () => void }) {
  const [lignes, setLignes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCouleur, setFilterCouleur] = useState('')
  const [filterNonCompte, setFilterNonCompte] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [showValider, setShowValider] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('comptage_lignes')
      .select('*, product:products(id, nom, millesime, couleur, domaine_id)')
      .eq('comptage_id', comptage.id)
      .order('product(nom)')
    setLignes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [comptage.id])

  const handleCount = async (ligneId: string, value: string) => {
    const num = value === '' ? null : parseInt(value)
    setLignes(prev => prev.map(l => l.id === ligneId ? { ...l, stock_compte: num, counted_at: new Date().toISOString() } : l))
    setSaving(ligneId)
    await supabase.from('comptage_lignes').update({
      stock_compte: num,
      counted_at: num !== null ? new Date().toISOString() : null,
    }).eq('id', ligneId)
    setSaving(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent, ligneId: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const idx = lignesFiltrees.findIndex(l => l.id === ligneId)
      const next = lignesFiltrees[idx + 1]
      if (next) inputRefs.current[next.id]?.focus()
    }
  }

  const lignesFiltrees = lignes.filter(l =>
    (!search || l.product?.nom?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterCouleur || l.product?.couleur === filterCouleur) &&
    (!filterNonCompte || l.stock_compte === null)
  )

  const nbComptes = lignes.filter(l => l.stock_compte !== null).length
  const progression = lignes.length > 0 ? Math.round((nbComptes / lignes.length) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 8 }}>← Retour aux comptages</button>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>{comptage.nom}</h1>
          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
            {new Date(comptage.date_comptage).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {comptage.site?.nom && ` · ${comptage.site.nom}`}
          </div>
        </div>
        <button onClick={() => setShowValider(true)} style={{ ...btnGold, background: progression === 100 ? '#6ec96e' : '#c9a96e', color: '#0d0a08' }}>
          {progression === 100 ? '✓ Valider le comptage' : `Valider (${nbComptes}/${lignes.length})`}
        </button>
      </div>

      {/* Barre de progression */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{nbComptes} compté{nbComptes > 1 ? 's' : ''} sur {lignes.length}</span>
          <span style={{ fontSize: 12, color: progression === 100 ? '#6ec96e' : '#c9a96e', fontWeight: 500 }}>{progression}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progression}%`, background: progression === 100 ? '#6ec96e' : '#c9a96e', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{ ...inp, flex: '1 1 200px' }} />
        <select value={filterCouleur} onChange={e => setFilterCouleur(e.target.value)} style={{ ...sel, fontSize: 12 }}>
          <option value="">Toutes les couleurs</option>
          {['rouge', 'blanc', 'rosé', 'champagne', 'effervescent', 'spiritueux', 'autre'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => setFilterNonCompte(v => !v)} style={{ ...btnGhost, borderColor: filterNonCompte ? 'rgba(201,110,110,0.4)' : 'rgba(255,255,255,0.1)', color: filterNonCompte ? '#c96e6e' : 'rgba(232,224,213,0.4)', fontSize: 11 }}>
          {filterNonCompte ? '⚠ Non comptés seulement' : 'Tous'}
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                {['Produit', 'Couleur', 'Stock théorique', 'Quantité comptée', 'Écart', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesFiltrees.map((ligne, i) => {
                const compté = ligne.stock_compte !== null
                const ecart = compté ? ligne.stock_compte - ligne.stock_theorique : null
                const ecartColor = ecart === null ? 'transparent' : ecart === 0 ? '#6ec96e' : ecart > 0 ? '#c9b06e' : '#c96e6e'
                return (
                  <tr key={ligne.id} style={{
                    borderBottom: i < lignesFiltrees.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                    background: compté ? 'rgba(110,201,110,0.03)' : 'transparent',
                  }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, color: compté ? '#f0e8d8' : 'rgba(232,224,213,0.5)' }}>{ligne.product?.nom}</div>
                      {ligne.product?.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{ligne.product.millesime}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{ligne.product?.couleur}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'rgba(232,224,213,0.5)', fontFamily: 'Georgia, serif' }}>{ligne.stock_theorique}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        ref={el => { inputRefs.current[ligne.id] = el }}
                        type="number" min={0}
                        value={ligne.stock_compte ?? ''}
                        onChange={e => handleCount(ligne.id, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, ligne.id)}
                        placeholder="—"
                        style={{ width: 80, background: compté ? 'rgba(110,201,110,0.08)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${compté ? 'rgba(110,201,110,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 3, color: compté ? '#6ec96e' : '#e8e0d5', fontSize: 14, padding: '5px 8px', textAlign: 'center' as const, fontWeight: compté ? 600 : 400 }}
                      />
                      {saving === ligne.id && <span style={{ fontSize: 10, color: '#c9a96e', marginLeft: 6 }}>↺</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {ecart !== null && (
                        <span style={{ fontSize: 13, color: ecartColor, fontWeight: 500 }}>
                          {ecart === 0 ? '✓' : ecart > 0 ? `+${ecart}` : ecart}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {compté ? (
                        <span style={{ fontSize: 10, color: '#6ec96e', letterSpacing: 1 }}>COMPTÉ</span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.25)', letterSpacing: 1 }}>EN ATTENTE</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal validation */}
      {showValider && (
        <ModalValiderComptage
          comptage={comptage}
          lignes={lignes}
          nbComptes={nbComptes}
          onClose={() => setShowValider(false)}
          onValidated={onBack}
        />
      )}
    </div>
  )
}

// ── Modal validation comptage ─────────────────────────────────
function ModalValiderComptage({ comptage, lignes, nbComptes, onClose, onValidated }: {
  comptage: any; lignes: any[]; nbComptes: number; onClose: () => void; onValidated: () => void
}) {
  const [validating, setValidating] = useState(false)
  const nbNonComptes = lignes.length - nbComptes
  const ecarts = lignes.filter(l => l.stock_compte !== null && l.stock_compte !== l.stock_theorique)

  const handleValider = async () => {
    setValidating(true)
    // Mettre à jour le stock pour chaque ligne comptée
    for (const ligne of lignes.filter(l => l.stock_compte !== null)) {
      await supabase.from('stock').upsert({
        product_id: ligne.product_id,
        site_id: comptage.site_id || null,
        quantite: ligne.stock_compte,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id,site_id' })
    }
    // Marquer le comptage comme validé
    await supabase.from('comptages').update({ statut: 'validé', validated_at: new Date().toISOString() }).eq('id', comptage.id)
    setValidating(false)
    onValidated()
  }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: 480, padding: '28px 32px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', marginBottom: 20 }}>Valider le comptage</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Produits comptés', value: nbComptes, color: '#6ec96e' },
            { label: 'Non comptés', value: nbNonComptes, color: nbNonComptes > 0 ? '#c9b06e' : 'rgba(232,224,213,0.4)' },
            { label: 'Écarts détectés', value: ecarts.length, color: ecarts.length > 0 ? '#c96e6e' : '#6ec96e' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '12px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginBottom: 8 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 24, color, fontFamily: 'Georgia, serif' }}>{value}</div>
            </div>
          ))}
        </div>
        {nbNonComptes > 0 && (
          <div style={{ background: 'rgba(201,176,110,0.08)', border: '0.5px solid rgba(201,176,110,0.2)', borderRadius: 4, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#c9b06e' }}>
            ⚠ {nbNonComptes} produit{nbNonComptes > 1 ? 's' : ''} non compté{nbNonComptes > 1 ? 's' : ''} — leur stock ne sera pas modifié par ce comptage.
          </div>
        )}
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 20 }}>
          Seules les lignes comptées seront mises à jour en stock. Les lignes non comptées restent inchangées.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={btnGhost}>Annuler</button>
          <button onClick={handleValider} disabled={validating} style={{ ...btnGold, flex: 1, opacity: validating ? 0.7 : 1 }}>
            {validating ? '⟳ Validation...' : '✓ Valider et mettre à jour le stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Vue clôture d'inventaire ──────────────────────────────────
function VueCloturer({ onBack }: { onBack: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [dateDebut, setDateDebut] = useState(firstOfMonth)
  const [dateFin, setDateFin] = useState(today)
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')
  const [comptages, setComptages] = useState<any[]>([])
  const [rapport, setRapport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [done, setDone] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    supabase.from('sites').select('id, nom').eq('actif', true).order('nom').then(({ data }) => setSites(data || []))
  }, [])

  const loadRapport = async () => {
    setLoading(true); setRapport(null)
    // Charger les comptages validés dans la période
    const { data: cmpts } = await supabase
      .from('comptages')
      .select('id, nom, date_comptage, site_id')
      .eq('statut', 'validé')
      .gte('date_comptage', dateDebut)
      .lte('date_comptage', dateFin)
      .match(siteId ? { site_id: siteId } : {})

    if (!cmpts || cmpts.length === 0) { setComptages([]); setRapport({ aucunComptage: true }); setLoading(false); return }
    setComptages(cmpts)

    // Charger toutes les lignes comptées
    const comptageIds = cmpts.map(c => c.id)
    const { data: lignes } = await supabase
      .from('comptage_lignes')
      .select('product_id, stock_compte, stock_theorique')
      .in('comptage_id', comptageIds)
      .not('stock_compte', 'is', null)

    // Produits comptés (union de tous les comptages)
    const produitsComptes = new Set((lignes || []).map(l => l.product_id))

    // Charger tous les produits actifs
    const { data: tousLesProduits } = await supabase
      .from('products')
      .select('id, nom, millesime')
      .eq('actif', true)
      .limit(5000)

    const nonComptes = (tousLesProduits || []).filter(p => !produitsComptes.has(p.id))

    // Calculer les écarts
    const lignesAvecEcart = (lignes || []).filter(l => l.stock_compte !== l.stock_theorique)

    setRapport({
      nbComptages: cmpts.length,
      nbProduitsComptes: produitsComptes.size,
      nbNonComptes: nonComptes.length,
      nbEcarts: lignesAvecEcart.length,
      nonComptes: nonComptes.slice(0, 20), // preview
      produitsComptes,
      lignes,
    })
    setLoading(false)
  }

  const handleCloturer = async () => {
    if (confirmText !== 'CLÔTURER') return
    setClosing(true)

    // Remettre à 0 tous les produits non comptés
    const { rapport: r } = { rapport }
    if (!rapport) return

    // Charger les produits non comptés complets
    const { data: tousLesProduits } = await supabase.from('products').select('id').eq('actif', true).limit(5000)
    const nonComptesIds = (tousLesProduits || []).filter(p => !rapport.produitsComptes.has(p.id)).map((p: any) => p.id)

    // Récupérer tous les sites concernés
    const { data: stockLines } = await supabase.from('stock').select('id, product_id, site_id').in('product_id', nonComptesIds)

    // Remettre à 0 par batch
    const idsToZero = (stockLines || []).map((s: any) => s.id)
    for (let i = 0; i < idsToZero.length; i += 500) {
      const batch = idsToZero.slice(i, i + 500)
      await supabase.from('stock').update({ quantite: 0, updated_at: new Date().toISOString() }).in('id', batch)
    }

    // Mettre à jour le stock pour les produits comptés
    for (const ligne of rapport.lignes || []) {
      if (ligne.stock_compte !== null) {
        await supabase.from('stock').upsert({
          product_id: ligne.product_id,
          site_id: siteId || null,
          quantite: ligne.stock_compte,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,site_id' })
      }
    }

    setClosing(false)
    setDone(true)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← Retour</button>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', marginBottom: 8 }}>Clôture d'inventaire</h1>
      <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 28 }}>
        Agrège tous les comptages validés sur une période. Les produits non comptés seront remis à zéro.
      </p>

      {done ? (
        <div style={{ ...card, textAlign: 'center' as const, padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#6ec96e', marginBottom: 8 }}>Inventaire clôturé</h2>
          <p style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 24 }}>Le stock a été mis à jour. Les produits non comptés ont été remis à zéro.</p>
          <button onClick={onBack} style={btnGold}>← Retour aux comptages</button>
        </div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Date de début</label>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
              <div>
                <label style={lbl}>Date de fin</label>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
              <div>
                <label style={lbl}>Site (optionnel)</label>
                <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ ...sel, width: '100%' }}>
                  <option value="">Tous les sites</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={loadRapport} disabled={loading} style={{ ...btnGold, opacity: loading ? 0.7 : 1 }}>
                {loading ? '⟳ Chargement...' : '📋 Générer le rapport'}
              </button>
            </div>
          </div>

          {rapport && (
            <div>
              {rapport.aucunComptage ? (
                <div style={{ ...card, textAlign: 'center' as const, padding: 32 }}>
                  <p style={{ color: 'rgba(232,224,213,0.4)' }}>Aucun comptage validé sur cette période.</p>
                </div>
              ) : (
                <>
                  {/* Rapport */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'Comptages', value: rapport.nbComptages, color: '#c9a96e' },
                      { label: 'Produits comptés', value: rapport.nbProduitsComptes, color: '#6ec96e' },
                      { label: 'Non comptés → 0', value: rapport.nbNonComptes, color: rapport.nbNonComptes > 0 ? '#c96e6e' : 'rgba(232,224,213,0.4)' },
                      { label: 'Écarts détectés', value: rapport.nbEcarts, color: rapport.nbEcarts > 0 ? '#c9b06e' : '#6ec96e' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '16px', textAlign: 'center' as const }}>
                        <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginBottom: 8 }}>{label.toUpperCase()}</div>
                        <div style={{ fontSize: 28, color, fontFamily: 'Georgia, serif' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Comptages inclus */}
                  <div style={{ ...card, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c9a96e', marginBottom: 12 }}>COMPTAGES INCLUS</div>
                    {comptages.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                        <span style={{ color: '#e8e0d5' }}>{c.nom}</span>
                        <span style={{ color: 'rgba(232,224,213,0.4)' }}>{new Date(c.date_comptage).toLocaleDateString('fr-FR')}</span>
                      </div>
                    ))}
                  </div>

                  {rapport.nbNonComptes > 0 && (
                    <div style={{ ...card, marginBottom: 16, border: '0.5px solid rgba(201,110,110,0.2)' }}>
                      <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c96e6e', marginBottom: 12 }}>PRODUITS QUI SERONT REMIS À ZÉRO ({rapport.nbNonComptes})</div>
                      {rapport.nonComptes.map((p: any) => (
                        <div key={p.id} style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', padding: '3px 0' }}>
                          {p.nom}{p.millesime ? ` ${p.millesime}` : ''}
                        </div>
                      ))}
                      {rapport.nbNonComptes > 20 && (
                        <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 8 }}>...et {rapport.nbNonComptes - 20} autres</div>
                      )}
                    </div>
                  )}

                  {/* Confirmation */}
                  <div style={{ ...card, border: '0.5px solid rgba(201,110,110,0.3)' }}>
                    <div style={{ fontSize: 13, color: '#f0e8d8', marginBottom: 8 }}>Confirmation de clôture</div>
                    <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 16 }}>
                      Cette action est irréversible. {rapport.nbProduitsComptes} produits seront mis à jour, {rapport.nbNonComptes} seront remis à zéro.
                    </p>
                    <label style={{ ...lbl, marginBottom: 8 }}>Tapez <strong style={{ color: '#c96e6e' }}>CLÔTURER</strong> pour confirmer</label>
                    <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CLÔTURER" style={{ ...inp, width: '100%', letterSpacing: 2, textAlign: 'center' as const, marginBottom: 14, color: confirmText === 'CLÔTURER' ? '#c96e6e' : '#e8e0d5' }} />
                    <button onClick={handleCloturer} disabled={confirmText !== 'CLÔTURER' || closing} style={{ ...btnGold, width: '100%', background: confirmText === 'CLÔTURER' ? '#c96e6e' : '#333', color: confirmText === 'CLÔTURER' ? '#fff' : '#666', opacity: closing ? 0.7 : 1 }}>
                      {closing ? '⟳ Clôture en cours...' : '⚠ Clôturer l\'inventaire'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
type Vue = 'liste' | 'saisie' | 'cloturer'

export default function InventairePage() {
  const [vue, setVue] = useState<Vue>('liste')
  const [comptageActif, setComptageActif] = useState<any>(null)
  const [showNouveauComptage, setShowNouveauComptage] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>
        {vue === 'liste' && (
          <VueComptages
            onSelect={c => { setComptageActif(c); setVue('saisie') }}
            onNew={() => setShowNouveauComptage(true)}
            onCloturer={() => setVue('cloturer')}
          />
        )}
        {vue === 'saisie' && comptageActif && (
          <VueSaisie
            comptage={comptageActif}
            onBack={() => { setComptageActif(null); setVue('liste') }}
          />
        )}
        {vue === 'cloturer' && (
          <VueCloturer onBack={() => setVue('liste')} />
        )}
      </main>

      {showNouveauComptage && (
        <ModalNouveauComptage
          onCreated={c => { setShowNouveauComptage(false); setComptageActif(c); setVue('saisie') }}
          onClose={() => setShowNouveauComptage(false)}
        />
      )}
    </div>
  )
}