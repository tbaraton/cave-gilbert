'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// CAVE DE GILBERT — Admin Clients + Fidélité
// src/app/admin/clients/page.tsx
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type View = 'liste' | 'fiche' | 'bons'

// ── Composants UI ─────────────────────────────────────────────

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      background: bg, color, fontSize: 10, fontWeight: 500,
      padding: '2px 8px', borderRadius: 3, letterSpacing: 1,
      textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
    }}>{label}</span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 24, color: '#c9a96e', animation: 'spin 1.5s linear infinite' }}>⟳</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Modal édition client ─────────────────────────────────────

function ModalEditClient({ client, onClose, onSaved }: {
  client: any
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    prenom: client.prenom || '',
    nom: client.nom || '',
    email: client.email || '',
    telephone: client.telephone || '',
    adresse_ligne1: client.adresse_ligne1 || '',
    adresse_ligne2: client.adresse_ligne2 || '',
    code_postal: client.code_postal || '',
    ville: client.ville || '',
    pays: client.pays || 'France',
    newsletter: client.newsletter || false,
    notes_admin: client.notes_admin || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await supabase
      .from('customers')
      .update(form)
      .eq('id', client.id)
    if (err) { setError(err.message); setLoading(false); return }
    onSaved()
    onClose()
  }

  const input = (label: string, key: string, type = 'text') => (
    <div key={key}>
      <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }}
      />
    </div>
  )

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: 560, maxHeight: '88vh', overflowY: 'auto' as const, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>
            Modifier le client
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {input('Prénom', 'prenom')}
          {input('Nom', 'nom')}
          {input('Email', 'email', 'email')}
          {input('Téléphone', 'telephone')}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Adresse</label>
          <input value={form.adresse_ligne1} onChange={e => setForm(f => ({ ...f, adresse_ligne1: e.target.value }))} placeholder="Ligne 1" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const, marginBottom: 8 }} />
          <input value={form.adresse_ligne2} onChange={e => setForm(f => ({ ...f, adresse_ligne2: e.target.value }))} placeholder="Ligne 2 (optionnel)" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 14, marginBottom: 14 }}>
          {input('Code postal', 'code_postal')}
          {input('Ville', 'ville')}
          {input('Pays', 'pays')}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Notes admin (non visibles du client)</label>
          <textarea value={form.notes_admin} onChange={e => setForm(f => ({ ...f, notes_admin: e.target.value }))} rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />
        </div>

        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => setForm(f => ({ ...f, newsletter: !f.newsletter }))} style={{ width: 14, height: 14, borderRadius: 2, border: `0.5px solid ${form.newsletter ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: form.newsletter ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            {form.newsletter && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, newsletter: !f.newsletter }))}>Abonné à la newsletter</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>
            {loading ? 'Enregistrement...' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal ajout points manuels ───────────────────────────────

function ModalAjoutPoints({ client, onClose, onSaved }: {
  client: any, onClose: () => void, onSaved: () => void
}) {
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!points || parseInt(points) === 0) return
    setLoading(true)
    await supabase.from('loyalty_points').insert({
      customer_id: client.id,
      points: parseInt(points),
      motif: 'ajustement_admin',
      note: note || 'Ajustement manuel',
    })
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: 400, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 300, color: '#f0e8d8', marginBottom: 20 }}>
          Ajuster les points — {client.prenom} {client.nom}
        </h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>
            Points (positif = ajout, négatif = retrait)
          </label>
          <input type="number" value={points} onChange={e => setPoints(e.target.value)} placeholder="ex: 50 ou -50"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>Note</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="ex: Correction suite erreur"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,232,0.4)', borderRadius: 4, padding: '10px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, textTransform: 'uppercase' as const }}>Valider</button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

export default function AdminClientsPage() {
  const [view, setView] = useState<View>('liste')
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [clientHistory, setClientHistory] = useState<any[]>([])
  const [clientPoints, setClientPoints] = useState<any[]>([])
  const [clientVouchers, setClientVouchers] = useState<any[]>([])
  const [bonsEnAttente, setBonsEnAttente] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPointsModal, setShowPointsModal] = useState(false)

  const loadClients = useCallback(async () => {
    setLoading(true)
    // Utiliser v_customer_loyalty si elle existe, sinon customers directement
    const { data, error } = await supabase
      .from('v_customer_loyalty')
      .select('*')
      .order('total_achats_ttc', { ascending: false })
      .limit(500)

    if (error) {
      // Fallback sur customers si la vue n'existe pas encore
      const { data: fallback } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      setClients(fallback || [])
    } else {
      setClients(data || [])
    }
    setLoading(false)
  }, [])

  const loadBonsEnAttente = useCallback(async () => {
    const { data } = await supabase
      .from('v_vouchers_en_attente')
      .select('*')
    setBonsEnAttente(data || [])
  }, [])

  useEffect(() => {
    loadClients()
    loadBonsEnAttente()
  }, [loadClients, loadBonsEnAttente])

  const loadClientDetail = async (client: any) => {
    setSelectedClient(client)
    setView('fiche')

    // Historique commandes
    const { data: history } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_id', client.id || client.customer_id)
      .order('created_at', { ascending: false })
      .limit(20)
    setClientHistory(history || [])

    // Historique points
    const { data: points } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('customer_id', client.id || client.customer_id)
      .order('created_at', { ascending: false })
      .limit(50)
    setClientPoints(points || [])

    // Bons d'achat
    const { data: vouchers } = await supabase
      .from('loyalty_vouchers')
      .select('*')
      .eq('customer_id', client.id || client.customer_id)
      .order('created_at', { ascending: false })
    setClientVouchers(vouchers || [])
  }

  const validateVoucher = async (voucherId: string) => {
    await supabase.rpc('validate_voucher', { p_voucher_id: voucherId })
    loadBonsEnAttente()
    if (selectedClient) loadClientDetail(selectedClient)
  }

  const cancelVoucher = async (voucherId: string) => {
    await supabase.rpc('cancel_voucher', { p_voucher_id: voucherId })
    loadBonsEnAttente()
    if (selectedClient) loadClientDetail(selectedClient)
  }

  const clientsFiltres = clients.filter(c => {
    const q = search.toLowerCase()
    const nom = `${c.prenom || ''} ${c.nom || ''} ${c.email || ''}`.toLowerCase()
    return nom.includes(q)
  })

  const s = {
    card: { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px' } as React.CSSProperties,
    label: { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 },
    val: { fontSize: 14, color: '#e8e0d5' },
  }

  const STATUT_VOUCHER: Record<string, { bg: string; color: string }> = {
    en_attente: { bg: '#2a2a1e', color: '#c9b06e' },
    validé:     { bg: '#1e2a1e', color: '#6ec96e' },
    utilisé:    { bg: '#222',    color: '#888' },
    annulé:     { bg: '#2a1e1e', color: '#c96e6e' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', display: 'flex' }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          {[
            { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
            { label: 'Produits', href: '/admin', icon: '⬥' },
            { label: 'Stock', href: '/admin', icon: '◈' },
            { label: 'Clients', href: '/admin/clients', icon: '◎', active: true },
            { label: 'Commandes', href: '/admin', icon: '◻' },
            { label: 'Locations', href: '/admin', icon: '⟁' },
          ].map(item => (
            <a key={item.label} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px', fontSize: 12, cursor: 'pointer', letterSpacing: 0.5,
              color: item.active ? '#c9a96e' : 'rgba(232,224,213,0.45)',
              borderLeft: `2px solid ${item.active ? '#c9a96e' : 'transparent'}`,
              textDecoration: 'none', background: item.active ? 'rgba(201,169,110,0.08)' : 'transparent',
            }}>
              <span>{item.icon}</span>{item.label}
            </a>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', position: 'absolute' as const, bottom: 0, left: 0, right: 0 }}>
          <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none' }}>← Voir le site</a>
        </div>
      </aside>

      {/* Contenu */}
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>

        {/* ── ONGLETS ── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'liste', label: 'Clients' },
            { id: 'bons', label: `Bons à valider${bonsEnAttente.length > 0 ? ` (${bonsEnAttente.length})` : ''}` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as View)} style={{
              background: 'transparent', border: 'none',
              borderBottom: `1.5px solid ${view === tab.id ? '#c9a96e' : 'transparent'}`,
              color: view === tab.id ? '#c9a96e' : 'rgba(232,224,213,0.4)',
              padding: '10px 20px', fontSize: 12, cursor: 'pointer', letterSpacing: 1, marginBottom: -1,
            }}>{tab.label}</button>
          ))}
          {selectedClient && (
            <button onClick={() => setView('fiche')} style={{
              background: 'transparent', border: 'none',
              borderBottom: `1.5px solid ${view === 'fiche' ? '#c9a96e' : 'transparent'}`,
              color: view === 'fiche' ? '#c9a96e' : 'rgba(232,224,213,0.4)',
              padding: '10px 20px', fontSize: 12, cursor: 'pointer', letterSpacing: 1, marginBottom: -1,
            }}>
              {selectedClient.prenom} {selectedClient.nom}
            </button>
          )}
        </div>

        {/* ── LISTE CLIENTS ── */}
        {view === 'liste' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Clients</h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{clients.length} clients</p>
              </div>
              <input
                placeholder="Rechercher un client..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 16px', width: 260 }}
              />
            </div>

            {loading ? <Spinner /> : (
              <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                      {['Client', 'Email', 'Ville', 'Commandes', 'Total achats', 'Points', 'Bons', ''].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientsFiltres.slice(0, 100).map((c, i) => (
                      <tr key={c.id || c.customer_id} style={{ borderBottom: i < clientsFiltres.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, color: '#f0e8d8' }}>{c.prenom} {c.nom}</div>
                          {c.newsletter && <div style={{ fontSize: 10, color: '#6e9ec9' }}>Newsletter</div>}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{c.email}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{c.ville || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#e8e0d5' }}>{c.nb_commandes || 0}</td>
                        <td style={{ padding: '12px 14px', fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>
                          {c.total_achats_ttc ? `${parseFloat(c.total_achats_ttc).toFixed(0)}€` : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 13, color: (c.points_total || 0) >= 500 ? '#6ec96e' : '#e8e0d5' }}>
                            {c.points_total || 0} pts
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {(c.bons_en_attente || 0) > 0 && (
                            <Badge label={`${c.bons_en_attente} à valider`} bg="#2a2a1e" color="#c9b06e" />
                          )}
                          {(c.bons_valides || 0) > 0 && (
                            <Badge label={`${c.bons_valides} actif${c.bons_valides > 1 ? 's' : ''}`} bg="#1e2a1e" color="#6ec96e" />
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <button onClick={() => loadClientDetail(c)} style={{
                            background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)',
                            color: 'rgba(232,224,213,0.4)', borderRadius: 3, padding: '5px 10px',
                            fontSize: 10, cursor: 'pointer',
                          }}>Voir →</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── BONS EN ATTENTE ── */}
        {view === 'bons' && (
          <>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 24 }}>
              Bons d'achat à valider
            </h1>

            {bonsEnAttente.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center' as const, padding: '48px' }}>
                <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 14 }}>Aucun bon en attente de validation.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                {bonsEnAttente.map(bon => (
                  <div key={bon.id} style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, color: '#f0e8d8', marginBottom: 4 }}>
                        {bon.prenom} {bon.nom}
                        <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginLeft: 12 }}>{bon.email}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>
                        Bon <span style={{ fontFamily: 'monospace', color: '#c9a96e' }}>{bon.code}</span>
                        {' · '}Solde actuel : <strong style={{ color: '#6ec96e' }}>{bon.points_actuels} pts</strong>
                        {' · '}Généré le {new Date(bon.genere_le).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e' }}>{bon.montant_ttc}€</span>
                      <button onClick={() => validateVoucher(bon.id)} style={{
                        background: '#1e2a1e', border: '0.5px solid rgba(110,201,110,0.3)',
                        color: '#6ec96e', borderRadius: 4, padding: '8px 16px',
                        fontSize: 11, cursor: 'pointer', letterSpacing: 1,
                      }}>✓ Valider</button>
                      <button onClick={() => cancelVoucher(bon.id)} style={{
                        background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)',
                        color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '8px 12px',
                        fontSize: 11, cursor: 'pointer',
                      }}>Annuler</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── FICHE CLIENT ── */}
        {view === 'fiche' && selectedClient && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <button onClick={() => setView('liste')} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 11, cursor: 'pointer', letterSpacing: 1, marginBottom: 8, padding: 0 }}>← Retour</button>
                <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>
                  {selectedClient.prenom} {selectedClient.nom}
                </h1>
                <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{selectedClient.email}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPointsModal(true)} style={{
                  background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)',
                  color: '#c9a96e', borderRadius: 4, padding: '9px 16px',
                  fontSize: 11, cursor: 'pointer', letterSpacing: 1,
                }}>+ Ajuster points</button>
                <button onClick={() => setShowEditModal(true)} style={{
                  background: '#c9a96e', color: '#0d0a08', border: 'none',
                  borderRadius: 4, padding: '9px 16px', fontSize: 11,
                  cursor: 'pointer', fontWeight: 500, letterSpacing: 1,
                }}>Modifier</button>
              </div>
            </div>

            {/* KPIs fidélité */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Points fidélité', value: `${selectedClient.points_total || 0} pts`, color: (selectedClient.points_total || 0) >= 500 ? '#6ec96e' : '#c9a96e', sub: `${Math.floor((selectedClient.points_total || 0) / 500) * 500} / 500 pour prochain bon` },
                { label: 'Total achats', value: `${parseFloat(selectedClient.total_achats_ttc || 0).toFixed(2)}€`, color: '#c9a96e', sub: `${selectedClient.nb_commandes || 0} commande${(selectedClient.nb_commandes || 0) > 1 ? 's' : ''}` },
                { label: 'Bons actifs', value: selectedClient.bons_valides || 0, color: '#6ec96e', sub: `${selectedClient.bons_utilises || 0} utilisé${(selectedClient.bons_utilises || 0) > 1 ? 's' : ''}` },
                { label: 'Bons à valider', value: selectedClient.bons_en_attente || 0, color: '#c9b06e', sub: 'En attente admin' },
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={s.card}>
                  <div style={s.label}>{label}</div>
                  <div style={{ fontSize: 24, color, fontFamily: 'Georgia, serif', fontWeight: 300, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Barre progression fidélité */}
            <div style={{ ...s.card, marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={s.label}>Progression vers le prochain bon (500 pts)</span>
                <span style={{ fontSize: 12, color: '#c9a96e' }}>{(selectedClient.points_total || 0) % 500} / 500 pts</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                <div style={{ width: `${Math.min(((selectedClient.points_total || 0) % 500) / 500 * 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #c9a96e, #e8c98a)', borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* Coordonnées */}
              <div style={s.card}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 16 }}>Coordonnées</div>
                {[
                  { label: 'Email', val: selectedClient.email },
                  { label: 'Téléphone', val: selectedClient.telephone },
                  { label: 'Adresse', val: [selectedClient.adresse_ligne1, selectedClient.adresse_ligne2, `${selectedClient.code_postal || ''} ${selectedClient.ville || ''}`.trim(), selectedClient.pays].filter(Boolean).join(', ') },
                  { label: 'Newsletter', val: selectedClient.newsletter ? 'Abonné' : 'Non abonné' },
                  { label: 'Client depuis', val: selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString('fr-FR') : '—' },
                ].map(({ label, val }) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={s.label}>{label}</div>
                    <div style={{ ...s.val, fontSize: 13 }}>{val || '—'}</div>
                  </div>
                ))}
                {selectedClient.notes_admin && (
                  <div style={{ marginTop: 12, padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                    <div style={s.label}>Notes admin</div>
                    <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', fontStyle: 'italic' }}>{selectedClient.notes_admin}</div>
                  </div>
                )}
              </div>

              {/* Bons d'achat */}
              <div style={s.card}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 16 }}>Bons d'achat</div>
                {clientVouchers.length === 0 ? (
                  <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucun bon généré.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {clientVouchers.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                        <div>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{v.code}</div>
                          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>
                            {new Date(v.genere_le).toLocaleDateString('fr-FR')} · {v.points_utilises} pts
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#c9a96e' }}>{v.montant_ttc}€</span>
                          <Badge label={v.statut} bg={STATUT_VOUCHER[v.statut]?.bg || '#222'} color={STATUT_VOUCHER[v.statut]?.color || '#888'} />
                          {v.statut === 'en_attente' && (
                            <button onClick={() => validateVoucher(v.id)} style={{ background: '#1e2a1e', border: '0.5px solid rgba(110,201,110,0.3)', color: '#6ec96e', borderRadius: 3, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>Valider</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historique points */}
              <div style={s.card}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 16 }}>Historique points</div>
                {clientPoints.length === 0 ? (
                  <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucun mouvement de points.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, maxHeight: 250, overflowY: 'auto' as const }}>
                    {clientPoints.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.6)' }}>{p.note || p.motif}</div>
                          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)' }}>{new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
                        </div>
                        <span style={{ fontSize: 14, color: p.points > 0 ? '#6ec96e' : '#c96e6e', fontFamily: 'Georgia, serif' }}>
                          {p.points > 0 ? '+' : ''}{p.points} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historique commandes */}
              <div style={s.card}>
                <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 16 }}>Dernières commandes</div>
                {clientHistory.length === 0 ? (
                  <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 13 }}>Aucune commande.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, maxHeight: 250, overflowY: 'auto' as const }}>
                    {clientHistory.map(o => (
                      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                        <div>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c9a96e' }}>{o.numero}</div>
                          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>
                            {new Date(o.created_at).toLocaleDateString('fr-FR')} · {o.order_items?.length || 0} article{(o.order_items?.length || 0) > 1 ? 's' : ''}
                          </div>
                        </div>
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#c9a96e' }}>{o.total_ttc}€</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {showEditModal && selectedClient && (
        <ModalEditClient client={selectedClient} onClose={() => setShowEditModal(false)} onSaved={() => { loadClients(); loadClientDetail(selectedClient) }} />
      )}
      {showPointsModal && selectedClient && (
        <ModalAjoutPoints client={selectedClient} onClose={() => setShowPointsModal(false)} onSaved={() => { loadClients(); loadClientDetail(selectedClient) }} />
      )}
    </div>
  )
}