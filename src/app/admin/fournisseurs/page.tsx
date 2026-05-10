'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// CAVE DE GILBERT — Gestion Fournisseurs
// src/app/admin/fournisseurs/page.tsx
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type View = 'liste' | 'fiche' | 'nouveau'

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <div style={{ fontSize: 24, color: '#c9a96e', animation: 'spin 1.5s linear infinite' }}>⟳</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }
const card = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px' } as React.CSSProperties
const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

// ── Formulaire fournisseur ────────────────────────────────────

function FormFournisseur({ fournisseur, onSaved, onCancel }: {
  fournisseur?: any
  onSaved: (data: any) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    nom: fournisseur?.nom || '',
    contact_nom: fournisseur?.contact_nom || '',
    email: fournisseur?.email || '',
    telephone: fournisseur?.telephone || '',
    adresse_ligne1: fournisseur?.adresse_ligne1 || '',
    code_postal: fournisseur?.code_postal || '',
    ville: fournisseur?.ville || '',
    pays: fournisseur?.pays || 'France',
    site_web: fournisseur?.site_web || '',
    notes: fournisseur?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.nom.trim()) { setError('Le nom est obligatoire'); return }
    setSaving(true)
    setError('')

    const payload = {
      nom: form.nom.trim(),
      description: [
        form.contact_nom ? `Contact: ${form.contact_nom}` : null,
        form.adresse_ligne1 || null,
        form.code_postal && form.ville ? `${form.code_postal} ${form.ville}` : null,
        form.pays !== 'France' ? form.pays : null,
        form.email ? `Email: ${form.email}` : null,
        form.telephone ? `Tél: ${form.telephone}` : null,
        form.notes || null,
      ].filter(Boolean).join(' | ') || null,
      site_web: form.site_web || null,
      // Stocker les champs structurés dans description car domaines n'a pas ces colonnes
      // On va ajouter ces colonnes via SQL
      contact_nom: form.contact_nom || null,
      email: form.email || null,
      telephone: form.telephone || null,
      adresse_ligne1: form.adresse_ligne1 || null,
      code_postal: form.code_postal || null,
      ville: form.ville || null,
      pays: form.pays || 'France',
      notes: form.notes || null,
    }

    let result
    if (fournisseur?.id) {
      const { data, error: err } = await supabase.from('domaines').update(payload).eq('id', fournisseur.id).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      result = data
    } else {
      const { data, error: err } = await supabase.from('domaines').insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      result = data
    }

    onSaved(result)
  }

  const field = (label: string, key: string, opts?: { type?: string; placeholder?: string; half?: boolean }) => (
    <div key={key} style={opts?.half ? {} : {}}>
      <label style={lbl}>{label}</label>
      <input
        type={opts?.type || 'text'}
        value={(form as any)[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={opts?.placeholder}
        style={inp}
      />
    </div>
  )

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 8 }}>← Retour</button>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
            {fournisseur ? `Modifier ${fournisseur.nom}` : 'Nouveau fournisseur'}
          </h1>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 14 }}>Identité</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>{field('Nom du domaine / fournisseur *', 'nom', { placeholder: 'Ex: Domaine Jean Foillard' })}</div>
          {field('Nom du contact', 'contact_nom', { placeholder: 'Ex: Jean Foillard' })}
          {field('Site web', 'site_web', { placeholder: 'https://...' })}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 14 }}>Coordonnées</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Email', 'email', { type: 'email', placeholder: 'contact@domaine.fr' })}
          {field('Téléphone', 'telephone', { placeholder: '04 74 ...' })}
          <div style={{ gridColumn: '1 / -1' }}>{field('Adresse', 'adresse_ligne1', { placeholder: '12 rue des vignes' })}</div>
          {field('Code postal', 'code_postal', { placeholder: '69000' })}
          {field('Ville', 'ville', { placeholder: 'Lyon' })}
          {field('Pays', 'pays', { placeholder: 'France' })}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 14 }}>Notes internes</div>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Conditions particulières, délais habituels, notes..."
          style={{ ...inp, resize: 'vertical' as const }} />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '12px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
        <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '12px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
          {saving ? '⟳ Enregistrement...' : '✓ Enregistrer'}
        </button>
      </div>
    </div>
  )
}

// ── Fiche fournisseur ─────────────────────────────────────────

function FicheFournisseur({ fournisseur, onEdit, onBack, onCommande }: {
  fournisseur: any
  onEdit: () => void
  onBack: () => void
  onCommande: () => void
}) {
  const [commandes, setCommandes] = useState<any[]>([])
  const [produits, setProduits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: cmds }, { data: prods }] = await Promise.all([
        supabase.from('supplier_orders')
          .select('*, items:supplier_order_items(id, quantite_commandee, quantite_recue, prix_achat_ht)')
          .eq('domaine_id', fournisseur.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('product_suppliers')
          .select('*, product:products(id, nom, millesime, couleur, prix_achat_ht, actif)')
          .eq('domaine_id', fournisseur.id)
          .eq('fournisseur_principal', true)
          .limit(50),
      ])
      setCommandes(cmds || [])
      setProduits(prods || [])
      setLoading(false)
    }
    load()
  }, [fournisseur.id])

  const STATUT_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    brouillon:  { bg: '#222',    color: '#888',    label: 'Brouillon' },
    envoyée:    { bg: '#2a2a1e', color: '#c9b06e', label: 'Envoyée' },
    confirmée:  { bg: '#1e1e2a', color: '#6e9ec9', label: 'Confirmée' },
    en_transit: { bg: '#1e1e2a', color: '#6e9ec9', label: 'En transit' },
    reçue:      { bg: '#1e2a1e', color: '#6ec96e', label: 'Reçue ✓' },
    annulée:    { bg: '#2a1e1e', color: '#c96e6e', label: 'Annulée' },
  }

  const totalAchats = commandes
    .filter(c => c.statut === 'reçue')
    .reduce((acc, c) => acc + parseFloat(c.total_ht || 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 8 }}>← Retour</button>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>{fournisseur.nom}</h1>
          {fournisseur.ville && <p style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)' }}>{fournisseur.ville}{fournisseur.pays !== 'France' ? ` · ${fournisseur.pays}` : ''}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onEdit} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '9px 16px', fontSize: 11, cursor: 'pointer' }}>
            Modifier
          </button>
          <button onClick={onCommande} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '9px 20px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
            📧 Passer une commande
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Commandes passées', value: commandes.length, color: '#c9a96e' },
          { label: 'Total achats HT', value: `${totalAchats.toFixed(0)}€`, color: '#c9a96e' },
          { label: 'Références', value: produits.length, color: '#6ec96e' },
        ].map(({ label, value, color }) => (
          <div key={label} style={card}>
            <div style={lbl}>{label}</div>
            <div style={{ fontSize: 28, color, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, gridTemplateRows: 'auto' }}>

        {/* Coordonnées */}
        <div style={card}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 16 }}>Coordonnées</div>
          {[
            { label: 'Contact', val: fournisseur.contact_nom },
            { label: 'Email', val: fournisseur.email, link: fournisseur.email ? `mailto:${fournisseur.email}` : null },
            { label: 'Téléphone', val: fournisseur.telephone },
            { label: 'Adresse', val: [fournisseur.adresse_ligne1, fournisseur.code_postal && fournisseur.ville ? `${fournisseur.code_postal} ${fournisseur.ville}` : null].filter(Boolean).join(', ') },
            { label: 'Site web', val: fournisseur.site_web, link: fournisseur.site_web },
          ].map(({ label, val, link }) => val ? (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={lbl}>{label}</div>
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#c9a96e', textDecoration: 'none' }}>{val}</a>
              ) : (
                <div style={{ fontSize: 13, color: '#e8e0d5' }}>{val}</div>
              )}
            </div>
          ) : null)}
          {fournisseur.notes && (
            <div style={{ marginTop: 12, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
              <div style={lbl}>Notes</div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', fontStyle: 'italic' }}>{fournisseur.notes}</div>
            </div>
          )}
        </div>

        {/* Commandes récentes */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const }}>Historique commandes</div>
            <button onClick={onCommande} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '7px 16px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1 }}>
              + Nouvelle commande
            </button>
          </div>
          {loading ? <Spinner /> : commandes.length === 0 ? (
            <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucune commande pour ce fournisseur.</p>
          ) : (
            <div style={{ overflowX: 'auto' as const }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {['N° commande', 'Date', 'Références', 'Bouteilles', 'Montant HT', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commandes.map((cmd, i) => {
                    const s = STATUT_COLORS[cmd.statut] || { bg: '#222', color: '#888', label: cmd.statut }
                    const nbBouteilles = (cmd.items || []).reduce((acc: number, item: any) => acc + (item.quantite_commandee || 0), 0)
                    const montantHT = (cmd.items || []).reduce((acc: number, item: any) => acc + ((parseFloat(item.prix_achat_ht || 0)) * (item.quantite_commandee || 0)), 0)
                    const montantTTC = montantHT * 1.20
                    return (
                      <tr key={cmd.id} style={{ borderBottom: i < commandes.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{cmd.numero}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>
                          {cmd.date_commande ? new Date(cmd.date_commande).toLocaleDateString('fr-FR') : new Date(cmd.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: '#e8e0d5' }}>
                          {cmd.items?.length || 0} réf.
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: '#e8e0d5' }}>
                          {nbBouteilles > 0 ? `${nbBouteilles} btl` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'Georgia, serif', fontSize: 14, color: '#c9a96e' }}>
                          {montantHT > 0 ? (
                            <div>
                              <div>{montantHT.toFixed(2)}€ HT</div>
                              <div style={{ fontSize: 11, color: 'rgba(201,169,110,0.5)' }}>{montantTTC.toFixed(2)}€ TTC</div>
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: s.bg, color: s.color, fontSize: 9, padding: '3px 8px', borderRadius: 3, letterSpacing: 1 }}>{s.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Produits référencés */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 16 }}>
            Produits référencés ({produits.length})
          </div>
          {loading ? <Spinner /> : produits.length === 0 ? (
            <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucun produit associé à ce fournisseur.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {produits.map(ps => (
                <div key={ps.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 4, opacity: ps.product?.actif ? 1 : 0.5 }}>
                  <div style={{ fontSize: 13, color: '#f0e8d8', marginBottom: 4 }}>
                    {ps.product?.nom}
                    {ps.product?.millesime && <span style={{ color: 'rgba(232,224,213,0.4)', marginLeft: 6, fontSize: 11 }}>{ps.product.millesime}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>{ps.product?.couleur}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ps.prix_achat_ht && <span style={{ fontSize: 11, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{parseFloat(ps.prix_achat_ht).toFixed(2)}€</span>}
                      <button onClick={async () => {
                        const newActif = !ps.product?.actif
                        await supabase.from('products').update({ actif: newActif }).eq('id', ps.product_id)
                        setProduits(prev => prev.map(p => p.id === ps.id ? { ...p, product: { ...p.product, actif: newActif } } : p))
                      }} style={{
                        background: ps.product?.actif ? 'rgba(201,110,110,0.1)' : 'rgba(110,201,110,0.1)',
                        border: `0.5px solid ${ps.product?.actif ? 'rgba(201,110,110,0.3)' : 'rgba(110,201,110,0.3)'}`,
                        color: ps.product?.actif ? '#c96e6e' : '#6ec96e',
                        borderRadius: 3, padding: '2px 8px', fontSize: 9,
                        cursor: 'pointer', whiteSpace: 'nowrap' as const,
                      }}>
                        {ps.product?.actif ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

export default function AdminFournisseursPage() {
  const [view, setView] = useState<View>('liste')
  const [fournisseurs, setFournisseurs] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)

  const loadFournisseurs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('domaines')
      .select('*, nb_produits:product_suppliers(count)')
      .order('nom')
    setFournisseurs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadFournisseurs() }, [loadFournisseurs])

  const handleSaved = (data: any) => {
    loadFournisseurs()
    if (view === 'nouveau') {
      setSelected(data)
      setView('fiche')
    } else {
      setEditing(false)
      // Refresh selected
      setSelected(data)
    }
  }

  const handleCommande = () => {
    // Rediriger vers commandes avec le fournisseur pré-sélectionné
    window.location.href = `/admin/commandes?domaine=${selected?.id}`
  }

  const filtres = fournisseurs.filter(f =>
    `${f.nom} ${f.ville || ''} ${f.email || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex' }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <a href="/admin" style={{ display: 'block', marginBottom: 10, textDecoration: 'none' }}>
            <img
              src="/logo.png"
              alt="Cave de Gilbert"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              style={{ width: '100%', maxHeight: 52, objectFit: 'contain', cursor: 'pointer' }}
            />
          </a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          {[
            { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
            { label: 'Produits', href: '/admin', icon: '⬥' },
            { label: 'Fournisseurs', href: '/admin/fournisseurs', icon: '◈', active: true },
            { label: 'Commandes', href: '/admin/commandes', icon: '◻' },
            { label: 'Transferts', href: '/admin/transferts', icon: '⇄' },
            { label: 'Clients', href: '/admin/clients', icon: '◎' },
          ].map(item => (
            <a key={item.label} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12,
              color: item.active ? '#c9a96e' : 'rgba(232,224,213,0.45)',
              borderLeft: `2px solid ${item.active ? '#c9a96e' : 'transparent'}`,
              textDecoration: 'none', background: item.active ? 'rgba(201,169,110,0.08)' : 'transparent',
            }}><span>{item.icon}</span>{item.label}</a>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', position: 'absolute' as const, bottom: 0, left: 0, right: 0 }}>
          <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none' }}>← Voir le site</a>
        </div>
      </aside>

      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>

        {/* ── NOUVEAU ── */}
        {view === 'nouveau' && (
          <FormFournisseur onSaved={handleSaved} onCancel={() => setView('liste')} />
        )}

        {/* ── FICHE ── */}
        {view === 'fiche' && selected && !editing && (
          <FicheFournisseur
            fournisseur={selected}
            onEdit={() => setEditing(true)}
            onBack={() => setView('liste')}
            onCommande={handleCommande}
          />
        )}

        {/* ── ÉDITION ── */}
        {view === 'fiche' && selected && editing && (
          <FormFournisseur
            fournisseur={selected}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
        )}

        {/* ── LISTE ── */}
        {view === 'liste' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Fournisseurs</h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{fournisseurs.length} fournisseurs</p>
              </div>
              <button onClick={() => setView('nouveau')} style={{
                background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
                padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const,
              }}>+ Nouveau fournisseur</button>
            </div>

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un fournisseur..."
              style={{ ...inp, marginBottom: 20, maxWidth: 400 }}
            />

            {loading ? <Spinner /> : (
              <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                      {['Fournisseur', 'Contact', 'Email', 'Ville', 'Références', ''].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.map((f, i) => (
                      <tr key={f.id}
                        style={{ borderBottom: i < filtres.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { setSelected(f); setView('fiche'); setEditing(false) }}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, color: '#f0e8d8', fontWeight: 500 }}>{f.nom}</div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{f.contact_nom || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{f.email || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{f.ville || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: (f.nb_produits?.[0]?.count || 0) > 0 ? '#6ec96e' : 'rgba(232,224,213,0.3)' }}>
                          {f.nb_produits?.[0]?.count || 0} réf.
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>Voir →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}