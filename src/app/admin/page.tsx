'use client'

import { useState } from 'react'

// ============================================================
// CAVE DE GILBERT — Interface Admin
// src/app/admin/page.tsx
// ============================================================

type Section = 'dashboard' | 'produits' | 'stock' | 'transferts' | 'locations' | 'biere'

// ── Données de démo (remplacées par Supabase en production) ──

const DEMO_PRODUITS = [
  { id: '1', nom: 'Puligny-Montrachet', domaine: 'Domaine Leflaive', millesime: 2019, couleur: 'blanc', prix: 89, stock: 8, actif: true, ia: true },
  { id: '2', nom: 'Château Margaux', domaine: 'Château Margaux', millesime: 2018, couleur: 'rouge', prix: 420, stock: 3, actif: true, ia: true },
  { id: '3', nom: 'Bollinger Spécial Cuvée', domaine: 'Bollinger', millesime: null, couleur: 'champagne', prix: 65, stock: 0, actif: true, ia: false },
  { id: '4', nom: 'Condrieu', domaine: 'E. Guigal', millesime: 2021, couleur: 'blanc', prix: 55, stock: 12, actif: true, ia: true },
  { id: '5', nom: 'Gevrey-Chambertin', domaine: 'Rossignol-Trapet', millesime: 2020, couleur: 'rouge', prix: 78, stock: 2, actif: false, ia: false },
]

const DEMO_STOCK = [
  { produit: 'Puligny-Montrachet 2019', lyon: 5, paris: 3, cave: 0 },
  { produit: 'Château Margaux 2018', lyon: 2, paris: 1, cave: 0 },
  { produit: 'Bollinger Spécial Cuvée', lyon: 0, paris: 0, cave: 0 },
  { produit: 'Condrieu 2021', lyon: 8, paris: 4, cave: 0 },
  { produit: 'Gevrey-Chambertin 2020', lyon: 1, paris: 1, cave: 0 },
]

const DEMO_LOCATIONS = [
  { id: '1', numero: 'LOC-2024-00012', client: 'Dupont Thomas', evenement: 'Mariage', depart: '2024-07-20', retour: '2024-07-22', tireuse: 'TIR-001', futs: 3, statut: 'confirmée', total: 245 },
  { id: '2', numero: 'LOC-2024-00013', client: 'Martin Sophie', evenement: 'Anniversaire', depart: '2024-07-27', retour: '2024-07-28', tireuse: 'TIR-002', futs: 2, statut: 'devis', total: 145 },
  { id: '3', numero: 'LOC-2024-00011', client: 'Bernard Luc', evenement: 'Fête entreprise', depart: '2024-07-14', retour: '2024-07-16', tireuse: 'TIR-001', futs: 5, statut: 'terminée', total: 390 },
]

const DEMO_TIREUSES = [
  { id: '1', numero: 'TIR-001', modele: 'Lindr AS-40', statut: 'disponible', site: 'Lyon' },
  { id: '2', numero: 'TIR-002', modele: 'Perlick 630SS', statut: 'disponible', site: 'Lyon' },
  { id: '3', numero: 'TIR-003', modele: 'Lindr AS-40', statut: 'maintenance', site: 'Paris' },
]

// ── Couleurs vin ─────────────────────────────────────────────

const COULEUR_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  rouge:      { bg: '#7b1e1e', color: '#f5d0d0', label: 'Rouge' },
  blanc:      { bg: '#b8a96a', color: '#1a1408', label: 'Blanc' },
  rosé:       { bg: '#c97b7b', color: '#1a0808', label: 'Rosé' },
  champagne:  { bg: '#c9b06e', color: '#1a0e00', label: 'Champagne' },
  spiritueux: { bg: '#6e8b6e', color: '#0a1a0a', label: 'Spiritueux' },
}

const STATUT_LOCATION: Record<string, { bg: string; color: string }> = {
  devis:      { bg: '#2a2a1e', color: '#c9b06e' },
  confirmée:  { bg: '#1e2a1e', color: '#6ec96e' },
  en_cours:   { bg: '#1e1e2a', color: '#6e9ec9' },
  terminée:   { bg: '#222', color: '#888' },
  annulée:    { bg: '#2a1e1e', color: '#c96e6e' },
}

// ── Composant Badge ──────────────────────────────────────────

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      background: bg, color, fontSize: 10, fontWeight: 500,
      padding: '2px 8px', borderRadius: 3, letterSpacing: 1,
      textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
    }}>{label}</span>
  )
}

// ── Composant Stock dot ──────────────────────────────────────

function StockDot({ qty, seuil = 3 }: { qty: number; seuil?: number }) {
  const color = qty === 0 ? '#c96e6e' : qty <= seuil ? '#c9b06e' : '#6ec96e'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ color: '#e8e0d5', fontSize: 13 }}>{qty}</span>
    </span>
  )
}

// ── Composant Modal Ajout Produit ────────────────────────────

function ModalAjoutProduit({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'generating' | 'preview'>('form')
  const [form, setForm] = useState({
    nom: '', domaine: '', appellation: '', millesime: '',
    couleur: 'rouge', prix: '', stock: '',
  })
  const [preview, setPreview] = useState<any>(null)

  const handleGenerate = async () => {
    setStep('generating')
    // Simulation — en production, appelle /api/ai-generate
    setTimeout(() => {
      setPreview({
        description_courte: 'Un rouge d\'exception aux tanins soyeux et à la finale persistante.',
        description_longue: 'Issu d\'un terroir argilo-calcaire exceptionnel, ce vin dévoile une robe grenat profonde aux reflets pourpres. Le nez complexe révèle des arômes de fruits noirs mûrs, d\'épices douces et de sous-bois. La bouche est ample, structurée par des tanins fins et soyeux, avec une belle fraîcheur en finale.',
        aromes: ['Cassis', 'Mûre', 'Poivre noir', 'Cèdre', 'Tabac'],
        accords: ['Viandes rouges', 'Gibier', 'Fromages affinés'],
        temp_service: '16–18°C',
        garde: '2028–2038',
        profil: { acidite: 62, tanins: 78, corps: 85, longueur: 88 },
      })
      setStep('preview')
    }, 2200)
  }

  return (
    <div style={{
      position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)',
        borderRadius: 8, width: 580, maxHeight: '85vh', overflowY: 'auto' as const,
        padding: '28px 32px',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#c9a96e', textTransform: 'uppercase' as const, marginBottom: 4 }}>
              Nouveau produit
            </div>
            <h2 style={{ fontSize: 20, color: '#f0e8d8', margin: 0, fontFamily: 'Georgia, serif', fontWeight: 300 }}>
              Ajouter un vin
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)',
            fontSize: 20, cursor: 'pointer', padding: 4,
          }}>✕</button>
        </div>

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
                  <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>
                    {label}
                  </label>
                  <input
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4,
                      color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const,
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>
                Couleur *
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(COULEUR_STYLE).map(([key, { label, bg, color }]) => (
                  <button key={key} onClick={() => setForm(f => ({ ...f, couleur: key }))} style={{
                    background: form.couleur === key ? bg : 'rgba(255,255,255,0.04)',
                    color: form.couleur === key ? color : 'rgba(232,224,213,0.5)',
                    border: form.couleur === key ? `1px solid ${bg}` : '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: 4, padding: '7px 12px', fontSize: 11, cursor: 'pointer',
                    letterSpacing: 0.5,
                  }}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Prix TTC (€) *', key: 'prix', placeholder: '0.00' },
                { label: 'Stock initial', key: 'stock', placeholder: '0' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>
                    {label}
                  </label>
                  <input
                    type="number" placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4,
                      color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const,
                    }}
                  />
                </div>
              ))}
            </div>

            <button onClick={handleGenerate} disabled={!form.nom} style={{
              width: '100%', background: '#c9a96e', color: '#0d0a08',
              border: 'none', borderRadius: 4, padding: '13px 20px',
              fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const,
              cursor: form.nom ? 'pointer' : 'not-allowed',
              opacity: form.nom ? 1 : 0.5, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              ✦ Générer la fiche par IA (Gemini)
            </button>
            <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, marginTop: 10 }}>
              Gratuit · Description, arômes, accords et profil générés automatiquement
            </p>
          </>
        )}

        {step === 'generating' && (
          <div style={{ textAlign: 'center' as const, padding: '40px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 16, animation: 'spin 2s linear infinite' }}>⟳</div>
            <p style={{ color: '#c9a96e', letterSpacing: 1 }}>Gemini analyse le vin...</p>
            <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 12, marginTop: 8 }}>
              Description · Arômes · Accords · Profil gustatif
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === 'preview' && preview && (
          <>
            <div style={{ background: 'rgba(83,74,183,0.1)', border: '0.5px solid rgba(83,74,183,0.25)', borderRadius: 4, padding: '8px 12px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'rgba(175,169,236,0.8)', letterSpacing: 1.5, textTransform: 'uppercase' as const }}>✦ Fiche générée par Gemini — vérifiez avant de publier</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Description courte</label>
              <p style={{ color: '#e8e0d5', fontSize: 13, margin: 0, fontStyle: 'italic' }}>{preview.description_courte}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Description longue</label>
              <p style={{ color: 'rgba(232,224,213,0.6)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>{preview.description_longue}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Arômes</label>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {preview.aromes.map((a: string) => (
                    <span key={a} style={{ border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 2, padding: '3px 8px', fontSize: 11, color: 'rgba(201,169,110,0.7)' }}>{a}</span>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Accords</label>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {preview.accords.map((a: string) => (
                    <span key={a} style={{ border: '0.5px solid rgba(110,201,110,0.25)', borderRadius: 2, padding: '3px 8px', fontSize: 11, color: 'rgba(110,201,110,0.7)' }}>{a}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Profil gustatif</label>
              {Object.entries(preview.profil).map(([key, val]: [string, any]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ width: 70, fontSize: 10, color: 'rgba(232,224,213,0.35)', textTransform: 'capitalize' as const }}>{key}</span>
                  <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }}>
                    <div style={{ width: `${val}%`, height: '100%', background: 'linear-gradient(90deg, #c9a96e, #e8c98a)', borderRadius: 1 }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', width: 25 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('form')} style={{
                flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)',
                color: 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '12px',
                fontSize: 11, letterSpacing: 1.5, cursor: 'pointer', textTransform: 'uppercase' as const,
              }}>Modifier</button>
              <button onClick={onClose} style={{
                flex: 2, background: '#c9a96e', color: '#0d0a08',
                border: 'none', borderRadius: 4, padding: '12px',
                fontSize: 11, letterSpacing: 2, cursor: 'pointer',
                fontWeight: 500, textTransform: 'uppercase' as const,
              }}>✓ Enregistrer (inactif)</button>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, marginTop: 8 }}>
              Le produit sera enregistré inactif — activez-le après vérification
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

export default function AdminPage() {
  const [section, setSection] = useState<Section>('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [mouvement, setMouvement] = useState<{ produit: string; qty: string; raison: string; note: string } | null>(null)

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '⬡' },
    { id: 'produits', label: 'Produits', icon: '⬥' },
    { id: 'stock', label: 'Stock multi-sites', icon: '◈' },
    { id: 'transferts', label: 'Transferts', icon: '⇄' },
    { id: 'locations', label: 'Locations tireuse', icon: '⟁' },
    { id: 'biere', label: 'Stock fûts', icon: '◉' },
  ]

  const produitsFiltres = DEMO_PRODUITS.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.domaine.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>

      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column' as const, padding: '24px 0', position: 'fixed' as const,
        top: 0, left: 0, bottom: 0, zIndex: 100,
      }}>
        <div style={{ padding: '0 20px 28px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>
            Cave de Gilbert
          </div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </div>

        <nav style={{ flex: 1, padding: '16px 0' }}>
          {navItems.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setSection(id)} style={{
              width: '100%', textAlign: 'left' as const, background: section === id ? 'rgba(201,169,110,0.08)' : 'transparent',
              borderLeft: section === id ? '2px solid #c9a96e' : '2px solid transparent',
              border: 'none', borderLeftStyle: 'solid' as const,
              color: section === id ? '#c9a96e' : 'rgba(232,224,213,0.45)',
              padding: '10px 20px', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, letterSpacing: 0.5,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none', letterSpacing: 1 }}>
            ← Voir le site
          </a>
        </div>
      </aside>

      {/* Contenu principal */}
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', maxWidth: 'calc(100vw - 220px)' }}>

        {/* ── DASHBOARD ── */}
        {section === 'dashboard' && (
          <>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 6 }}>
              Tableau de bord
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 32, letterSpacing: 0.5 }}>
              Mercredi 7 mai 2025
            </p>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Références actives', value: '47', sub: '+3 ce mois', color: '#c9a96e' },
                { label: 'Stock total', value: '342', sub: 'toutes caves', color: '#6ec9a0' },
                { label: 'En rupture', value: '3', sub: 'références', color: '#c96e6e' },
                { label: 'Locations actives', value: '2', sub: 'tireuses dehors', color: '#6e9ec9' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{
                  background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)',
                  borderRadius: 6, padding: '20px 22px',
                }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 10 }}>{label}</div>
                  <div style={{ fontSize: 32, color, fontFamily: 'Georgia, serif', fontWeight: 300, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Alertes */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 12, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 14 }}>
                Alertes stock
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {[
                  { produit: 'Bollinger Spécial Cuvée', site: 'Lyon', qty: 0, type: 'rupture' },
                  { produit: 'Château Margaux 2018', site: 'Paris', qty: 1, type: 'alerte' },
                  { produit: 'Gevrey-Chambertin 2020', site: 'Lyon', qty: 2, type: 'alerte' },
                ].map(({ produit, site, qty, type }) => (
                  <div key={produit + site} style={{
                    background: type === 'rupture' ? 'rgba(201,110,110,0.08)' : 'rgba(201,176,110,0.08)',
                    border: `0.5px solid ${type === 'rupture' ? 'rgba(201,110,110,0.2)' : 'rgba(201,176,110,0.2)'}`,
                    borderRadius: 5, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: type === 'rupture' ? '#c96e6e' : '#c9b06e', display: 'inline-block' }} />
                      <span style={{ fontSize: 13 }}>{produit}</span>
                      <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{site}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: type === 'rupture' ? '#c96e6e' : '#c9b06e' }}>
                        {qty === 0 ? 'Rupture' : `${qty} bouteille${qty > 1 ? 's' : ''}`}
                      </span>
                      <button onClick={() => setSection('stock')} style={{
                        background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)',
                        color: 'rgba(232,224,213,0.5)', borderRadius: 3, padding: '4px 10px',
                        fontSize: 10, cursor: 'pointer', letterSpacing: 1,
                      }}>Gérer →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Locations du jour */}
            <div>
              <h2 style={{ fontSize: 12, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, marginBottom: 14 }}>
                Prochaines locations
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {DEMO_LOCATIONS.filter(l => l.statut !== 'terminée').map(loc => (
                  <div key={loc.id} style={{
                    background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)',
                    borderRadius: 5, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, marginBottom: 3 }}>{loc.client} — <span style={{ color: 'rgba(232,224,213,0.5)' }}>{loc.evenement}</span></div>
                      <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{loc.depart} → {loc.retour} · {loc.tireuse} · {loc.futs} fût{loc.futs > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Badge label={loc.statut} bg={STATUT_LOCATION[loc.statut]?.bg || '#222'} color={STATUT_LOCATION[loc.statut]?.color || '#888'} />
                      <span style={{ fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{loc.total}€</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── PRODUITS ── */}
        {section === 'produits' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Catalogue</h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{DEMO_PRODUITS.length} références</p>
              </div>
              <button onClick={() => setShowModal(true)} style={{
                background: '#c9a96e', color: '#0d0a08', border: 'none',
                borderRadius: 4, padding: '11px 20px', fontSize: 11,
                letterSpacing: 2, cursor: 'pointer', fontWeight: 500,
                textTransform: 'uppercase' as const,
              }}>✦ Ajouter par IA</button>
            </div>

            {/* Recherche */}
            <input
              placeholder="Rechercher un vin ou un domaine..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4,
                color: '#e8e0d5', fontSize: 13, padding: '11px 16px',
                boxSizing: 'border-box' as const, marginBottom: 20,
              }}
            />

            {/* Tableau */}
            <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {['Produit', 'Couleur', 'Millésime', 'Prix', 'Stock', 'Statut', ''].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left' as const,
                        fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)',
                        textTransform: 'uppercase' as const, fontWeight: 400,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produitsFiltres.map((p, i) => (
                    <tr key={p.id} style={{
                      borderBottom: i < produitsFiltres.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                      opacity: p.actif ? 1 : 0.5,
                    }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 13, color: '#f0e8d8', marginBottom: 2 }}>{p.nom}</div>
                        <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{p.domaine}</div>
                        {p.ia && <span style={{ fontSize: 9, color: 'rgba(175,169,236,0.6)', letterSpacing: 1 }}>✦ IA</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <Badge label={COULEUR_STYLE[p.couleur]?.label || p.couleur} bg={COULEUR_STYLE[p.couleur]?.bg || '#333'} color={COULEUR_STYLE[p.couleur]?.color || '#fff'} />
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: 'rgba(232,224,213,0.6)' }}>{p.millesime || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{p.prix}€</td>
                      <td style={{ padding: '14px 16px' }}><StockDot qty={p.stock} /></td>
                      <td style={{ padding: '14px 16px' }}>
                        <Badge label={p.actif ? 'Actif' : 'Inactif'} bg={p.actif ? '#1e2a1e' : '#2a2a2a'} color={p.actif ? '#6ec96e' : '#888'} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <button style={{
                          background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)',
                          color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '5px 10px',
                          fontSize: 10, cursor: 'pointer',
                        }}>Éditer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── STOCK ── */}
        {section === 'stock' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Stock multi-sites</h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Lyon · Paris · Cave centrale</p>
              </div>
              <button onClick={() => setMouvement({ produit: '', qty: '', raison: 'achat', note: '' })} style={{
                background: 'transparent', border: '0.5px solid rgba(201,169,110,0.4)',
                color: '#c9a96e', borderRadius: 4, padding: '10px 18px',
                fontSize: 11, letterSpacing: 1.5, cursor: 'pointer', textTransform: 'uppercase' as const,
              }}>+ Mouvement de stock</button>
            </div>

            {mouvement && (
              <div style={{
                background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)',
                borderRadius: 6, padding: '20px 24px', marginBottom: 24,
              }}>
                <h3 style={{ fontSize: 13, color: '#c9a96e', marginBottom: 16, letterSpacing: 1 }}>Nouveau mouvement</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <select value={mouvement.produit} onChange={e => setMouvement(m => m && ({ ...m, produit: e.target.value }))} style={{
                    background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px',
                  }}>
                    <option value="">Choisir un produit...</option>
                    {DEMO_PRODUITS.map(p => <option key={p.id} value={p.id}>{p.nom} {p.millesime}</option>)}
                  </select>
                  <select value={mouvement.raison} onChange={e => setMouvement(m => m && ({ ...m, raison: e.target.value }))} style={{
                    background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px',
                  }}>
                    <option value="achat">Achat fournisseur</option>
                    <option value="ajustement">Ajustement</option>
                    <option value="casse">Casse</option>
                    <option value="dégustation">Dégustation</option>
                    <option value="retour">Retour client</option>
                  </select>
                  <input type="number" placeholder="Quantité" value={mouvement.qty} onChange={e => setMouvement(m => m && ({ ...m, qty: e.target.value }))} style={{
                    background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input placeholder="Note (optionnel)" value={mouvement.note} onChange={e => setMouvement(m => m && ({ ...m, note: e.target.value }))} style={{
                    flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px',
                  }} />
                  <button onClick={() => setMouvement(null)} style={{
                    background: '#c9a96e', color: '#0d0a08', border: 'none',
                    borderRadius: 4, padding: '9px 20px', fontSize: 11, cursor: 'pointer', fontWeight: 500,
                  }}>Enregistrer</button>
                  <button onClick={() => setMouvement(null)} style={{
                    background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)',
                    color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '9px 14px', fontSize: 11, cursor: 'pointer',
                  }}>Annuler</button>
                </div>
              </div>
            )}

            <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {['Produit', 'Lyon', 'Paris', 'Cave centrale', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_STOCK.map((row, i) => {
                    const total = row.lyon + row.paris + row.cave
                    return (
                      <tr key={row.produit} style={{ borderBottom: i < DEMO_STOCK.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td style={{ padding: '13px 16px', fontSize: 13 }}>{row.produit}</td>
                        <td style={{ padding: '13px 16px' }}><StockDot qty={row.lyon} /></td>
                        <td style={{ padding: '13px 16px' }}><StockDot qty={row.paris} /></td>
                        <td style={{ padding: '13px 16px' }}><StockDot qty={row.cave} /></td>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{ fontSize: 14, color: total === 0 ? '#c96e6e' : '#e8e0d5', fontFamily: 'Georgia, serif' }}>{total}</span>
                        </td>
                        <td style={{ padding: '13px 16px' }}>
                          <button onClick={() => setSection('transferts')} style={{
                            background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)',
                            color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '5px 10px',
                            fontSize: 10, cursor: 'pointer',
                          }}>Transférer →</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── TRANSFERTS ── */}
        {section === 'transferts' && (
          <>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 28 }}>Transferts inter-sites</h1>
            <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '24px', marginBottom: 20 }}>
              <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 13, marginBottom: 16 }}>Créer un nouveau transfert</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <select style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px' }}>
                  <option>Site source : Lyon</option>
                  <option>Site source : Paris</option>
                  <option>Site source : Cave centrale</option>
                </select>
                <select style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px' }}>
                  <option>Destination : Paris</option>
                  <option>Destination : Lyon</option>
                  <option>Destination : Cave centrale</option>
                </select>
              </div>
              <button style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>
                Créer le transfert
              </button>
            </div>
            <p style={{ color: 'rgba(232,224,213,0.35)', fontSize: 13 }}>Aucun transfert en cours.</p>
          </>
        )}

        {/* ── LOCATIONS ── */}
        {section === 'locations' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Locations tireuse</h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>2 tireuses disponibles · 0 en cours</p>
              </div>
              <button style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px 20px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
                + Nouvelle location
              </button>
            </div>

            {/* Tireuses */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 11, letterSpacing: 2, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 12 }}>État des tireuses</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                {DEMO_TIREUSES.map(t => (
                  <div key={t.id} style={{
                    background: '#18130e', border: `0.5px solid ${t.statut === 'disponible' ? 'rgba(110,201,110,0.2)' : t.statut === 'maintenance' ? 'rgba(201,176,110,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 6, padding: '16px 20px', minWidth: 160,
                  }}>
                    <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 4 }}>{t.numero}</div>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 12 }}>{t.modele}</div>
                    <Badge
                      label={t.statut === 'disponible' ? 'Disponible' : t.statut === 'maintenance' ? 'Maintenance' : 'Louée'}
                      bg={t.statut === 'disponible' ? '#1e2a1e' : t.statut === 'maintenance' ? '#2a2510' : '#1e202a'}
                      color={t.statut === 'disponible' ? '#6ec96e' : t.statut === 'maintenance' ? '#c9b06e' : '#6e9ec9'}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Liste locations */}
            <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {['Numéro', 'Client', 'Événement', 'Dates', 'Tireuse / Fûts', 'Total', 'Statut', ''].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO_LOCATIONS.map((loc, i) => (
                    <tr key={loc.id} style={{ borderBottom: i < DEMO_LOCATIONS.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '13px 14px', fontSize: 11, color: 'rgba(232,224,213,0.4)', fontFamily: 'monospace' }}>{loc.numero}</td>
                      <td style={{ padding: '13px 14px', fontSize: 13 }}>{loc.client}</td>
                      <td style={{ padding: '13px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{loc.evenement}</td>
                      <td style={{ padding: '13px 14px', fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{loc.depart}<br />{loc.retour}</td>
                      <td style={{ padding: '13px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{loc.tireuse} · {loc.futs} fût{loc.futs > 1 ? 's' : ''}</td>
                      <td style={{ padding: '13px 14px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{loc.total}€</td>
                      <td style={{ padding: '13px 14px' }}>
                        <Badge label={loc.statut} bg={STATUT_LOCATION[loc.statut]?.bg || '#222'} color={STATUT_LOCATION[loc.statut]?.color || '#888'} />
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        <button style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '5px 10px', fontSize: 10, cursor: 'pointer' }}>
                          {loc.statut === 'devis' ? 'Confirmer' : loc.statut === 'confirmée' ? 'Départ →' : loc.statut === 'en_cours' ? 'Retour ←' : 'Voir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── STOCK FÛTS ── */}
        {section === 'biere' && (
          <>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 28 }}>Stock fûts</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { biere: 'Leffe Blonde', style: 'Blonde abbaye', contenance: '30L', plein: 4, vide: 2, consigne: 1, prix: 85, caution: 25 },
                { biere: 'Kronenbourg 1664', style: 'Lager', contenance: '50L', plein: 6, vide: 0, consigne: 0, prix: 110, caution: 30 },
                { biere: 'Heineken', style: 'Lager', contenance: '20L', plein: 2, vide: 1, consigne: 2, prix: 65, caution: 20 },
                { biere: 'Grimbergen Blonde', style: 'Blonde abbaye', contenance: '30L', plein: 0, vide: 3, consigne: 1, prix: 90, caution: 25 },
                { biere: 'Paulaner Weizen', style: 'Blanche', contenance: '20L', plein: 3, vide: 0, consigne: 0, prix: 70, caution: 20 },
              ].map(f => (
                <div key={f.biere + f.contenance} style={{
                  background: '#18130e', border: `0.5px solid ${f.plein === 0 ? 'rgba(201,110,110,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 6, padding: '20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 2 }}>{f.biere}</div>
                      <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{f.style} · {f.contenance}</div>
                    </div>
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{f.prix}€</div>
                      <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>consigne {f.caution}€</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Pleins', value: f.plein, color: f.plein === 0 ? '#c96e6e' : '#6ec96e' },
                      { label: 'Vides', value: f.vide, color: '#c9b06e' },
                      { label: 'Consigne', value: f.consigne, color: '#6e9ec9' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '10px 8px', textAlign: 'center' as const }}>
                        <div style={{ fontSize: 20, color, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{value}</div>
                        <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', letterSpacing: 1, textTransform: 'uppercase' as const, marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </main>

      {showModal && <ModalAjoutProduit onClose={() => setShowModal(false)} />}
    </div>
  )
}
