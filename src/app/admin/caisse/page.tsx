'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ─────────────────────────────────────────────────────
type User = { id: string; nom: string; prenom: string; email: string; pin: string; role: string }
type Session = { id: string; user_id: string; site_id: string; statut: string; especes_ouverture: number }
type Client = { id: string; prenom: string; nom: string; raison_sociale: string; est_societe: boolean; tarif_pro: boolean; remise_pct: number; email: string; telephone: string }
type Produit = { id: string; nom: string; millesime: number; couleur: string; prix_vente_ttc: number; prix_vente_pro: number; stock: number }
type Ligne = { id: string; product_id: string; nom: string; millesime: number; qte: number; prix_unit: number; remise_pct: number; total: number }
type Paiement = { mode: string; montant: number; label: string }

// ── Helpers ───────────────────────────────────────────────────
const COULEURS: Record<string, string> = { rouge: '#e07070', blanc: '#c9b06e', rosé: '#e8a0b0', champagne: '#d4c88a', effervescent: '#a0b0e0', autre: '#888' }
const fmt = (n: number) => n.toFixed(2) + '€'

// ── Écran Login ───────────────────────────────────────────────
function EcranLogin({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !pin) { setError('Email et PIN requis'); return }
    setLoading(true); setError('')
    const { data } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).eq('actif', true).single()
    if (!data) { setError('Utilisateur introuvable'); setLoading(false); return }
    if (data.pin !== pin) { setError('PIN incorrect'); setLoading(false); return }
    onLogin(data)
  }

  const handlePinKey = (k: string) => {
    if (k === '←') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 4) return
    const newPin = pin + k
    setPin(newPin)
    if (newPin.length === 4) setTimeout(() => handleLoginRef.current?.(), 100)
  }
  const handleLoginRef = useRef<(() => void) | null>(null)
  handleLoginRef.current = handleLogin

  useEffect(() => { if (pin.length === 4) handleLogin() }, [pin])

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 12, padding: '40px 48px', width: 380, textAlign: 'center' as const }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 6 }}>Cave de Gilbert</div>
        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginBottom: 32 }}>Caisse</div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 6, padding: '10px', marginBottom: 16, fontSize: 13, color: '#c96e6e' }}>{error}</div>}

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e0d5', fontSize: 14, padding: '12px', boxSizing: 'border-box' as const, marginBottom: 16 }} />

        {/* Affichage PIN */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: i < pin.length ? '#c9a96e' : 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(201,169,110,0.4)', transition: 'background 0.15s' }} />
          ))}
        </div>

        {/* Clavier PIN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {['1','2','3','4','5','6','7','8','9','←','0','✓'].map(k => (
            <button key={k} onClick={() => k === '✓' ? handleLogin() : handlePinKey(k)} style={{
              background: k === '✓' ? '#c9a96e' : 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              color: k === '✓' ? '#0d0a08' : '#e8e0d5',
              borderRadius: 8, padding: '16px', fontSize: 18, cursor: 'pointer', fontWeight: k === '✓' ? 700 : 400,
            }}>{k}</button>
          ))}
        </div>

        {loading && <div style={{ color: 'rgba(232,224,213,0.4)', fontSize: 12 }}>⟳ Connexion...</div>}
      </div>
    </div>
  )
}

// ── Écran Ouverture Caisse ────────────────────────────────────
function EcranOuverture({ user, onOuvrir }: { user: User; onOuvrir: (session: Session) => void }) {
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')
  const [especes, setEspeces] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('sites').select('*').eq('actif', true).order('nom').then(({ data }) => {
      setSites(data || [])
      if (data && data.length > 0) setSiteId(data[0].id)
    })
    // Vérifier si session ouverte
    supabase.from('caisse_sessions').select('*').eq('user_id', user.id).eq('statut', 'ouverte').single().then(({ data }) => {
      if (data) onOuvrir(data)
    })
  }, [])

  const handleOuvrir = async () => {
    if (!siteId) return
    setLoading(true)
    const { data } = await supabase.from('caisse_sessions').insert({
      user_id: user.id,
      site_id: siteId,
      especes_ouverture: parseFloat(especes) || 0,
      fond_caisse_ouverture: parseFloat(especes) || 0,
      statut: 'ouverte',
    }).select('*').single()
    if (data) onOuvrir(data)
    setLoading(false)
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e0d5', fontSize: 14, padding: '12px', boxSizing: 'border-box' as const }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 12, padding: '40px 48px', width: 440 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 4 }}>Ouverture de caisse</div>
        <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginBottom: 28 }}>Bonjour {user.prenom} {user.nom}</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1.5, display: 'block', marginBottom: 8 }}>SITE</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ ...inp, background: '#1a1408', cursor: 'pointer' }}>
            {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1.5, display: 'block', marginBottom: 8 }}>ESPÈCES EN CAISSE À L'OUVERTURE</label>
          <div style={{ position: 'relative' as const }}>
            <input type="number" step="0.01" placeholder="0.00" value={especes} onChange={e => setEspeces(e.target.value)} style={{ ...inp, paddingRight: 32 }} />
            <span style={{ position: 'absolute' as const, right: 12, top: '50%', transform: 'translateY(-50%)', color: '#c9a96e' }}>€</span>
          </div>
        </div>

        <button onClick={handleOuvrir} disabled={loading} style={{ width: '100%', background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 8, padding: '16px', fontSize: 14, letterSpacing: 2, cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase' as const }}>
          {loading ? '⟳ Ouverture...' : '✓ Ouvrir la caisse'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Sélection Client ────────────────────────────────────
function ModalClient({ onSelect, onClose }: { onSelect: (c: Client | null) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [alertes, setAlertes] = useState<{ bons: any[]; demandes: any[]; factures: any[] } | null>(null)
  const [selected, setSelected] = useState<Client | null>(null)
  const timerRef = useRef<any>(null)

  const searchClients = async (q: string) => {
    if (!q.trim()) { setClients([]); return }
    setLoading(true)
    const { data } = await supabase.from('customers')
      .select('id, prenom, nom, raison_sociale, est_societe, tarif_pro, remise_pct, email, telephone')
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,raison_sociale.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10)
    setClients(data || [])
    setLoading(false)
  }

  const handleSearchChange = (v: string) => {
    setSearch(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => searchClients(v), 300)
  }

  const checkAlertes = async (client: Client) => {
    setSelected(client)
    const [{ data: bons }, { data: demandes }, { data: factures }] = await Promise.all([
      supabase.from('loyalty_vouchers').select('*').eq('customer_id', client.id).eq('utilise', false),
      supabase.from('customer_requests').select('*').eq('customer_id', client.id).eq('statut', 'en_attente'),
      supabase.from('ventes').select('id, numero, total_ttc').eq('customer_id', client.id).eq('statut_paiement', 'non_regle').eq('statut', 'validee'),
    ])
    const a = { bons: bons || [], demandes: demandes || [], factures: factures || [] }
    const hasAlertes = a.bons.length > 0 || a.demandes.length > 0 || a.factures.length > 0
    if (hasAlertes) setAlertes(a)
    else onSelect(client)
  }

  if (alertes && selected) return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '32px', maxWidth: 500, width: '100%' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 20 }}>
          ⚠ Alertes — {selected.est_societe ? selected.raison_sociale : `${selected.prenom} ${selected.nom}`}
        </div>
        {alertes.bons.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#c9a96e', letterSpacing: 1, marginBottom: 8 }}>🎟 BONS D'ACHAT DISPONIBLES</div>
            {alertes.bons.map(b => <div key={b.id} style={{ background: 'rgba(201,169,110,0.1)', borderRadius: 4, padding: '8px 12px', marginBottom: 6, fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{b.montant}€ — {b.code}</div>)}
          </div>
        )}
        {alertes.demandes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#6e9ec9', letterSpacing: 1, marginBottom: 8 }}>📋 DEMANDES EN ATTENTE</div>
            {alertes.demandes.map(d => <div key={d.id} style={{ background: 'rgba(110,158,201,0.08)', borderRadius: 4, padding: '8px 12px', marginBottom: 6, fontSize: 13, color: '#e8e0d5' }}>{d.titre}{d.date_limite ? ` — limite: ${new Date(d.date_limite).toLocaleDateString('fr-FR')}` : ''}</div>)}
          </div>
        )}
        {alertes.factures.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#c96e6e', letterSpacing: 1, marginBottom: 8 }}>💳 FACTURES NON RÉGLÉES</div>
            {alertes.factures.map(f => <div key={f.id} style={{ background: 'rgba(201,110,110,0.08)', borderRadius: 4, padding: '8px 12px', marginBottom: 6, fontSize: 13, color: '#c96e6e' }}>{f.numero} — {parseFloat(f.total_ttc).toFixed(2)}€</div>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => setAlertes(null)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 6, padding: '12px', fontSize: 13, cursor: 'pointer' }}>← Retour</button>
          <button onClick={() => onSelect(selected)} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Continuer →</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '28px', width: '90%', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8' }}>Sélectionner un client</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <input autoFocus placeholder="Rechercher nom, prénom, email..." value={search} onChange={e => handleSearchChange(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, color: '#f0e8d8', fontSize: 15, padding: '14px', boxSizing: 'border-box' as const, marginBottom: 14 }} />
        {loading && <div style={{ textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)', padding: '16px' }}>⟳ Recherche...</div>}
        <div style={{ maxHeight: 320, overflowY: 'auto' as const }}>
          <button onClick={() => onSelect(null)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(232,224,213,0.5)', padding: '12px', fontSize: 13, cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const }}>
            👤 Client anonyme (sans fiche)
          </button>
          {clients.map(c => (
            <button key={c.id} onClick={() => checkAlertes(c)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#e8e0d5', padding: '14px', fontSize: 14, cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div>{c.est_societe ? c.raison_sociale : `${c.prenom} ${c.nom}`}</div>
                <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{c.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {c.tarif_pro && <span style={{ fontSize: 10, background: '#2a2a1e', color: '#c9b06e', padding: '2px 6px', borderRadius: 3 }}>PRO</span>}
                {c.remise_pct > 0 && <span style={{ fontSize: 10, background: '#2a1e2a', color: '#c96ec9', padding: '2px 6px', borderRadius: 3 }}>-{c.remise_pct}%</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Modal Paiement ────────────────────────────────────────────
function ModalPaiement({ total, client, onValider, onClose }: {
  total: number
  client: Client | null
  onValider: (paiements: Paiement[], typeDoc: string) => void
  onClose: () => void
}) {
  const [typeDoc, setTypeDoc] = useState('ticket')
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [modeCourant, setModeCourant] = useState('cb')
  const [montantSaisi, setMontantSaisi] = useState('')

  const totalPaye = paiements.reduce((acc, p) => acc + p.montant, 0)
  const resteAPayer = Math.max(0, total - totalPaye)
  const monnaie = totalPaye > total ? totalPaye - total : 0

  const MODES = [
    { id: 'cb', label: '💳 CB', color: '#6e9ec9' },
    { id: 'especes', label: '💶 Espèces', color: '#6ec96e' },
    { id: 'virement', label: '🏦 Virement', color: '#c9b06e' },
    { id: 'bon_achat', label: '🎟 Bon', color: '#c9a96e' },
    { id: 'non_regle', label: '📋 Non réglé', color: '#c96e6e' },
  ]

  const DOCS = [
    { id: 'ticket', label: 'Ticket' },
    { id: 'devis', label: 'Devis' },
    { id: 'commande', label: 'Commande' },
    { id: 'bl', label: 'BL' },
    { id: 'facture', label: 'Facture' },
  ]

  const addPaiement = () => {
    const montant = modeCourant === 'non_regle' ? resteAPayer : (parseFloat(montantSaisi) || resteAPayer)
    if (montant <= 0) return
    const labels: Record<string, string> = { cb: 'CB', especes: 'Espèces', virement: 'Virement', bon_achat: 'Bon d\'achat', non_regle: 'Non réglé' }
    setPaiements(prev => [...prev, { mode: modeCourant, montant, label: labels[modeCourant] }])
    setMontantSaisi('')
  }

  const canValider = totalPaye >= total || paiements.some(p => p.mode === 'non_regle')

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '28px 32px', width: '90%', maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8' }}>Paiement</div>
          <div style={{ fontSize: 28, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(total)}</div>
        </div>

        {/* Type de document */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1.5, marginBottom: 10 }}>TYPE DE DOCUMENT</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {DOCS.map(d => (
              <button key={d.id} onClick={() => setTypeDoc(d.id)} style={{
                flex: 1, background: typeDoc === d.id ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${typeDoc === d.id ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`,
                color: typeDoc === d.id ? '#c9a96e' : 'rgba(232,224,213,0.5)',
                borderRadius: 6, padding: '10px 6px', fontSize: 13, cursor: 'pointer',
              }}>{d.label}</button>
            ))}
          </div>
        </div>

        {/* Mode de paiement */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1.5, marginBottom: 10 }}>MODE DE PAIEMENT</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12 }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setModeCourant(m.id)} style={{
                flex: 1, background: modeCourant === m.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${modeCourant === m.id ? m.color : 'rgba(255,255,255,0.08)'}`,
                color: modeCourant === m.id ? m.color : 'rgba(232,224,213,0.5)',
                borderRadius: 6, padding: '10px 4px', fontSize: 12, cursor: 'pointer',
              }}>{m.label}</button>
            ))}
          </div>
          {modeCourant !== 'non_regle' && (
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="number" step="0.01" placeholder={`Montant (${fmt(resteAPayer)})`} value={montantSaisi}
                onChange={e => setMontantSaisi(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 16, padding: '12px', outline: 'none' }} />
              <button onClick={addPaiement} style={{ background: '#c9a96e', border: 'none', borderRadius: 6, color: '#0d0a08', padding: '12px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>+ Ajouter</button>
            </div>
          )}
          {modeCourant === 'non_regle' && (
            <button onClick={addPaiement} style={{ width: '100%', background: 'rgba(201,110,110,0.15)', border: '1px solid rgba(201,110,110,0.4)', borderRadius: 6, color: '#c96e6e', padding: '12px', fontSize: 14, cursor: 'pointer' }}>
              Passer en compte client (Non réglé)
            </button>
          )}
        </div>

        {/* Récap paiements */}
        {paiements.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '12px 16px', marginBottom: 16 }}>
            {paiements.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                <span style={{ color: 'rgba(232,224,213,0.7)' }}>{p.label}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(p.montant)}</span>
                  <button onClick={() => setPaiements(prev => prev.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600 }}>
              <span style={{ color: resteAPayer > 0 ? '#c96e6e' : '#6ec96e' }}>
                {resteAPayer > 0 ? `Reste: ${fmt(resteAPayer)}` : monnaie > 0 ? `Monnaie: ${fmt(monnaie)}` : '✓ Soldé'}
              </span>
              <span style={{ color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmt(totalPaye)}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '14px', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => canValider && onValider(paiements, typeDoc)} disabled={!canValider} style={{
            flex: 2, background: canValider ? '#c9a96e' : '#2a2a1e', color: canValider ? '#0d0a08' : '#555',
            border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, cursor: canValider ? 'pointer' : 'not-allowed', fontWeight: 600, letterSpacing: 1,
          }}>✓ Valider la vente</button>
        </div>
      </div>
    </div>
  )
}

// ── Caisse Principale ─────────────────────────────────────────
function CaissePrincipale({ user, session, onFermer }: { user: User; session: Session; onFermer: () => void }) {
  const [client, setClient] = useState<Client | null>(null)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [search, setSearch] = useState('')
  const [produits, setProduits] = useState<Produit[]>([])
  const [showClient, setShowClient] = useState(false)
  const [showPaiement, setShowPaiement] = useState(false)
  const [remiseGlobale, setRemiseGlobale] = useState('')
  const [remiseType, setRemiseType] = useState<'pct' | 'eur'>('pct')
  const [vendeur, setVendeur] = useState(user)
  const [vendeurs, setVendeurs] = useState<User[]>([])
  const [searchTimer, setSearchTimer] = useState<any>(null)
  const [showFermeture, setShowFermeture] = useState(false)
  const [espacesFermeture, setEspacesFermeture] = useState('')
  const [venteOk, setVenteOk] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('users').select('*').eq('actif', true).then(({ data }) => setVendeurs(data || []))
  }, [])

  const searchProduits = async (q: string) => {
    if (!q.trim()) { setProduits([]); return }
    const { data } = await supabase
      .from('products')
      .select('id, nom, millesime, couleur, prix_vente_ttc, prix_vente_pro')
      .or(`nom.ilike.%${q}%`)
      .eq('actif', true)
      .limit(12)

    // Load stock for session site
    if (data && data.length > 0) {
      const ids = data.map((p: any) => p.id)
      const { data: stockData } = await supabase.from('stock').select('product_id, quantite').eq('site_id', session.site_id).in('product_id', ids)
      const stockMap = Object.fromEntries((stockData || []).map((s: any) => [s.product_id, s.quantite || 0]))
      setProduits(data.map((p: any) => ({ ...p, stock: stockMap[p.id] || 0 })))
    } else {
      setProduits([])
    }
  }

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout(searchTimer)
    setSearchTimer(setTimeout(() => searchProduits(v), 250))
  }

  const addProduit = (p: Produit) => {
    const prix = (client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc
    const remisePct = client?.remise_pct || 0
    const prixFinal = prix * (1 - remisePct / 100)
    const existing = lignes.find(l => l.product_id === p.id)
    if (existing) {
      setLignes(prev => prev.map(l => l.product_id === p.id ? { ...l, qte: l.qte + 1, total: (l.qte + 1) * l.prix_unit * (1 - l.remise_pct / 100) } : l))
    } else {
      setLignes(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        product_id: p.id,
        nom: p.nom,
        millesime: p.millesime,
        qte: 1,
        prix_unit: prix,
        remise_pct: remisePct,
        total: prixFinal,
      }])
    }
    setSearch('')
    setProduits([])
    searchRef.current?.focus()
  }

  const updateLigne = (id: string, field: 'qte' | 'remise_pct', val: number) => {
    setLignes(prev => prev.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: val }
      updated.total = updated.qte * updated.prix_unit * (1 - updated.remise_pct / 100)
      return updated
    }))
  }

  const removeLigne = (id: string) => setLignes(prev => prev.filter(l => l.id !== id))

  const totalBrut = lignes.reduce((acc, l) => acc + l.total, 0)
  const remiseVal = remiseGlobale ? (remiseType === 'pct' ? totalBrut * parseFloat(remiseGlobale) / 100 : parseFloat(remiseGlobale)) : 0
  const totalNet = Math.max(0, totalBrut - remiseVal)

  const handleValiderVente = async (paiements: Paiement[], typeDoc: string) => {
    // Créer le numéro de vente
    const now = new Date()
    const numero = `VTE-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*10000)).padStart(4,'0')}`
    const statutPaiement = paiements.some(p => p.mode === 'non_regle') ? 'non_regle' : totalNet <= paiements.reduce((a,p) => a + p.montant, 0) ? 'regle' : 'partiel'

    const { data: vente } = await supabase.from('ventes').insert({
      numero,
      session_id: session.id,
      user_id: vendeur.id,
      customer_id: client?.id || null,
      site_id: session.site_id,
      type_doc: typeDoc,
      statut: 'validee',
      statut_paiement: statutPaiement,
      total_ht: totalNet / 1.20,
      total_ttc: totalNet,
      remise_globale_pct: remiseType === 'pct' ? parseFloat(remiseGlobale) || 0 : 0,
      remise_globale_eur: remiseType === 'eur' ? parseFloat(remiseGlobale) || 0 : 0,
    }).select('id').single()

    if (vente) {
      // Lignes
      await supabase.from('vente_lignes').insert(lignes.map(l => ({
        vente_id: vente.id,
        product_id: l.product_id,
        nom_produit: l.nom,
        millesime: l.millesime,
        quantite: l.qte,
        prix_unitaire_ttc: l.prix_unit,
        remise_pct: l.remise_pct,
        total_ttc: l.total,
      })))

      // Paiements
      await supabase.from('vente_paiements').insert(paiements.map(p => ({
        vente_id: vente.id,
        mode: p.mode,
        montant: p.montant,
      })))

      // Décrémenter stock
      for (const l of lignes) {
        await supabase.rpc('move_stock', {
          p_product_id: l.product_id,
          p_site_id: session.site_id,
          p_raison: 'vente',
          p_quantite: l.qte,
          p_note: `Vente ${numero}`,
          p_order_id: null,
          p_transfer_id: null,
        })
      }

      // Points fidélité
      if (client && !client.tarif_pro && statutPaiement === 'regle') {
        const points = Math.floor(totalNet)
        await supabase.from('loyalty_points').insert({ customer_id: client.id, points, raison: `Vente ${numero}` })
        // Vérifier si bon à générer
        const { data: existingPts } = await supabase.from('loyalty_points').select('points').eq('customer_id', client.id)
        const totalPts = (existingPts || []).reduce((a: number, p: any) => a + p.points, 0)
        const nbBons = Math.floor(totalPts / 500)
        const { data: existingBons } = await supabase.from('loyalty_vouchers').select('id').eq('customer_id', client.id)
        if (nbBons > (existingBons?.length || 0)) {
          const code = 'BON-' + Math.random().toString(36).toUpperCase().slice(2, 8)
          await supabase.from('loyalty_vouchers').insert({ customer_id: client.id, montant: 15, code, utilise: false })
        }
      }
    }

    setShowPaiement(false)
    setVenteOk(true)
    setTimeout(() => {
      setVenteOk(false)
      setLignes([])
      setClient(null)
      setRemiseGlobale('')
      searchRef.current?.focus()
    }, 2000)
  }

  const handleFermerCaisse = async () => {
    await supabase.from('caisse_sessions').update({
      statut: 'fermee',
      ferme_le: new Date().toISOString(),
      especes_fermeture: parseFloat(espacesFermeture) || 0,
    }).eq('id', session.id)
    onFermer()
  }

  const sideW = 340

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', overflow: 'hidden' }}>

      {/* Panneau gauche — produits */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, padding: '16px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#c9a96e' }}>Cave de Gilbert — Caisse</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Vendeur */}
            <select value={vendeur.id} onChange={e => {
              const v = vendeurs.find(u => u.id === e.target.value)
              if (v) setVendeur(v)
            }} style={{ background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 4, color: '#c9a96e', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}>
              {vendeurs.map(v => <option key={v.id} value={v.id}>{v.prenom} {v.nom}</option>)}
            </select>
            <button onClick={() => setShowFermeture(true)} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
              Fermer caisse
            </button>
          </div>
        </div>

        {/* Recherche produit */}
        <div style={{ position: 'relative' as const, marginBottom: 12 }}>
          <input ref={searchRef} placeholder="🔍 Rechercher un produit..." value={search} onChange={e => handleSearch(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.35)', borderRadius: 8, color: '#f0e8d8', fontSize: 16, padding: '14px 16px', boxSizing: 'border-box' as const, outline: 'none' }} />
          {produits.length > 0 && (
            <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1a1408', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, zIndex: 100, maxHeight: 360, overflowY: 'auto' as const, marginTop: 4 }}>
              {produits.map(p => (
                <button key={p.id} onClick={() => addProduit(p)} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '0.5px solid rgba(255,255,255,0.05)', color: '#e8e0d5', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div>
                    <span style={{ color: COULEURS[p.couleur] || '#888', marginRight: 8, fontSize: 12 }}>●</span>
                    <span style={{ fontSize: 14 }}>{p.nom}</span>
                    {p.millesime && <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginLeft: 8 }}>{p.millesime}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: p.stock <= 0 ? '#c96e6e' : 'rgba(232,224,213,0.4)' }}>stock: {p.stock}</span>
                    <span style={{ fontSize: 15, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                      {((client?.tarif_pro ? p.prix_vente_pro : p.prix_vente_ttc) || p.prix_vente_ttc).toFixed(2)}€
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lignes de vente */}
        <div style={{ flex: 1, overflowY: 'auto' as const }}>
          {lignes.length === 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '60px 20px', color: 'rgba(232,224,213,0.25)', fontSize: 14 }}>
              Recherchez des produits pour les ajouter
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {['Produit', 'Qté', 'Prix', 'Remise', 'Total', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontSize: 14 }}>{l.nom}</div>
                      {l.millesime && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{l.millesime}</div>}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateLigne(l.id, 'qte', Math.max(1, l.qte - 1))} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e8e0d5', width: 28, height: 28, borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>−</button>
                        <span style={{ width: 28, textAlign: 'center' as const, fontSize: 15 }}>{l.qte}</span>
                        <button onClick={() => updateLigne(l.id, 'qte', l.qte + 1)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e8e0d5', width: 28, height: 28, borderRadius: 4, cursor: 'pointer', fontSize: 16 }}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{l.prix_unit.toFixed(2)}€</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="number" min={0} max={100} value={l.remise_pct || ''} placeholder="0"
                          onChange={e => updateLigne(l.id, 'remise_pct', parseFloat(e.target.value) || 0)}
                          style={{ width: 48, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '4px 6px', textAlign: 'center' as const }} />
                        <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontSize: 15, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 500 }}>{l.total.toFixed(2)}€</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => removeLigne(l.id)} style={{ background: 'transparent', border: 'none', color: '#c96e6e', cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panneau droit — client + totaux */}
      <div style={{ width: sideW, background: '#100d0a', borderLeft: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' as const, padding: '16px' }}>

        {/* Client */}
        <button onClick={() => setShowClient(true)} style={{
          width: '100%', background: client ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${client ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8, padding: '14px', cursor: 'pointer', textAlign: 'left' as const, marginBottom: 16,
        }}>
          {client ? (
            <>
              <div style={{ fontSize: 13, color: '#c9a96e', marginBottom: 2 }}>👤 Client</div>
              <div style={{ fontSize: 15, color: '#f0e8d8' }}>{client.est_societe ? client.raison_sociale : `${client.prenom} ${client.nom}`}</div>
              {client.tarif_pro && <span style={{ fontSize: 10, background: '#2a2a1e', color: '#c9b06e', padding: '2px 6px', borderRadius: 3, marginTop: 4, display: 'inline-block' }}>TARIF PRO</span>}
              {client.remise_pct > 0 && <span style={{ fontSize: 10, background: '#2a1e2a', color: '#c96ec9', padding: '2px 6px', borderRadius: 3, marginLeft: 6, display: 'inline-block' }}>-{client.remise_pct}%</span>}
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'rgba(232,224,213,0.4)', textAlign: 'center' as const }}>👤 Sélectionner un client</div>
          )}
        </button>

        {/* Remise globale */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1.5, marginBottom: 8 }}>REMISE GLOBALE</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
              {[{ v: 'pct', l: '%' }, { v: 'eur', l: '€' }].map(({ v, l }) => (
                <button key={v} onClick={() => setRemiseType(v as any)} style={{ background: remiseType === v ? 'rgba(201,169,110,0.2)' : 'transparent', border: 'none', color: remiseType === v ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <input type="number" step="0.01" placeholder="0" value={remiseGlobale} onChange={e => setRemiseGlobale(e.target.value)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 15, padding: '8px 12px' }} />
          </div>
        </div>

        {/* Totaux */}
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 16, marginBottom: 16 }}>
          {remiseVal > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
                <span>Sous-total</span><span style={{ fontFamily: 'Georgia, serif' }}>{fmt(totalBrut)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#c96ec9' }}>
                <span>Remise</span><span style={{ fontFamily: 'Georgia, serif' }}>-{fmt(remiseVal)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 4 }}>
            <span>HT</span><span>{fmt(totalNet / 1.20)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 10 }}>
            <span>TVA 20%</span><span>{fmt(totalNet - totalNet / 1.20)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, fontFamily: 'Georgia, serif' }}>
            <span style={{ color: 'rgba(232,224,213,0.6)', fontSize: 14, alignSelf: 'flex-end', marginBottom: 4 }}>TOTAL TTC</span>
            <span style={{ color: '#c9a96e' }}>{fmt(totalNet)}</span>
          </div>
        </div>

        {/* Bouton paiement */}
        <button onClick={() => lignes.length > 0 && setShowPaiement(true)} style={{
          width: '100%', background: lignes.length > 0 ? '#c9a96e' : '#2a2a1e',
          color: lignes.length > 0 ? '#0d0a08' : '#555',
          border: 'none', borderRadius: 10, padding: '18px', fontSize: 16,
          cursor: lignes.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 700, letterSpacing: 1,
        }}>
          {lignes.length > 0 ? `💳 Encaisser ${fmt(totalNet)}` : 'Panier vide'}
        </button>
      </div>

      {/* Modals */}
      {showClient && <ModalClient onSelect={c => { setClient(c); setShowClient(false) }} onClose={() => setShowClient(false)} />}
      {showPaiement && <ModalPaiement total={totalNet} client={client} onValider={handleValiderVente} onClose={() => setShowPaiement(false)} />}

      {/* Succès vente */}
      {venteOk && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#1e2a1e', border: '2px solid #6ec96e', borderRadius: 16, padding: '48px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#6ec96e' }}>Vente enregistrée !</div>
          </div>
        </div>
      )}

      {/* Fermeture caisse */}
      {showFermeture && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 12, padding: '32px', maxWidth: 440, width: '100%' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: '#f0e8d8', marginBottom: 20 }}>Fermeture de caisse</div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', letterSpacing: 1.5, display: 'block', marginBottom: 8 }}>ESPÈCES EN CAISSE À LA FERMETURE</label>
              <input type="number" step="0.01" placeholder="0.00" value={espacesFermeture} onChange={e => setEspacesFermeture(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 6, color: '#f0e8d8', fontSize: 18, padding: '14px', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>
              Fond d'ouverture : {fmt(session.especes_ouverture || 0)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFermeture(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 8, padding: '14px', fontSize: 14, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleFermerCaisse} style={{ flex: 2, background: '#c96e6e', color: '#fff', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>Fermer la caisse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function CaissePage() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  if (!user) return <EcranLogin onLogin={setUser} />
  if (!session) return <EcranOuverture user={user} onOuvrir={setSession} />
  return <CaissePrincipale user={user} session={session} onFermer={() => { setSession(null); setUser(null) }} />
}