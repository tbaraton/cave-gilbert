'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type User = { id: string; nom: string; prenom: string; email: string; pin: string; role: string; actif: boolean; created_at: string }

const ROLES = [
  { id: 'admin', label: 'Admin', desc: 'Accès complet — toutes les fonctions', color: '#c9a96e' },
  { id: 'caviste', label: 'Caviste', desc: 'Accès caisse + backoffice — remise max 20%, pas de suppression', color: '#6e9ec9' },
]

function ModalUser({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const isNew = !user?.id
  const [form, setForm] = useState({
    prenom: user?.prenom || '',
    nom: user?.nom || '',
    email: user?.email || '',
    pin: user?.pin || '',
    role: user?.role || 'caviste',
    actif: user?.actif ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPin, setShowPin] = useState(false)

  const handleSave = async () => {
    if (!form.prenom.trim()) { setError('Le prénom est obligatoire'); return }
    if (!form.nom.trim()) { setError('Le nom est obligatoire'); return }
    if (!form.email.trim()) { setError("L'email est obligatoire"); return }
    if (form.pin.length !== 4 || !/^\d{4}$/.test(form.pin)) { setError('Le PIN doit être 4 chiffres'); return }
    setSaving(true); setError('')
    const { error: err } = isNew
      ? await supabase.from('users').insert(form)
      : await supabase.from('users').update(form).eq('id', user!.id)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(); onClose()
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e8e0d5', fontSize: 14, padding: '12px', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 10, width: '100%', maxWidth: 520, padding: '28px 32px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8', margin: 0 }}>{isNew ? 'Nouvel utilisateur' : 'Modifier l\'utilisateur'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {error && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#c96e6e' }}>{error}</div>}

        {/* Rôle */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Rôle</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => setForm(f => ({ ...f, role: r.id }))} style={{
                flex: 1, background: form.role === r.id ? 'rgba(201,169,110,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${form.role === r.id ? r.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, padding: '12px', cursor: 'pointer', textAlign: 'left' as const,
              }}>
                <div style={{ fontSize: 14, color: form.role === r.id ? r.color : '#e8e0d5', marginBottom: 4, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', lineHeight: 1.4 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Identité */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Prénom *</label>
            <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>Nom *</label>
            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inp} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Email *</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>PIN (4 chiffres) *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type={showPin ? 'text' : 'password'} value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))} maxLength={4} placeholder="••••" style={{ ...inp, flex: 1, letterSpacing: showPin ? 'normal' : 8, fontSize: 18 }} />
            <button onClick={() => setShowPin(!showPin)} style={{ background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(232,224,213,0.5)', padding: '0 14px', fontSize: 13, cursor: 'pointer' }}>
              {showPin ? 'Cacher' : 'Voir'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 6 }}>Utilisé pour se connecter à la caisse</div>
        </div>

        {/* Actif */}
        <div onClick={() => setForm(f => ({ ...f, actif: !f.actif }))} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
          <div style={{ width: 16, height: 16, borderRadius: 3, border: `0.5px solid ${form.actif ? '#6ec96e' : 'rgba(255,255,255,0.2)'}`, background: form.actif ? '#6ec96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {form.actif && <span style={{ fontSize: 10, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: 13, color: form.actif ? '#6ec96e' : 'rgba(232,224,213,0.4)' }}>Compte actif</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '11px', fontSize: 11, cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '11px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase' as const, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳ Enregistrement...' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUtilisateursPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined)
  const [showNew, setShowNew] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('nom')
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggleActif = async (u: User) => {
    await supabase.from('users').update({ actif: !u.actif }).eq('id', u.id)
    load()
  }

  const handleDelete = async (u: User) => {
    await supabase.from('users').delete().eq('id', u.id)
    setConfirmDelete(null)
    load()
  }

  const card = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6 }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <a href="/admin" style={{ display: 'block', marginBottom: 10, textDecoration: 'none' }}>
            <img src="/logo.png" alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} style={{ width: '100%', maxHeight: 52, objectFit: 'contain' }} />
          </a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>UTILISATEURS</div>
        </div>
        <nav style={{ padding: '16px 0' }}>
          {[
            { label: 'Tableau de bord', href: '/admin', icon: '⬡' },
            { label: 'Clients', href: '/admin/clients', icon: '◎' },
            { label: 'Commandes', href: '/admin/commandes', icon: '◻' },
            { label: 'Fournisseurs', href: '/admin/fournisseurs', icon: '◈' },
            { label: 'Transferts', href: '/admin/transferts', icon: '⇄' },
            { label: 'Inventaire', href: '/admin/inventaire', icon: '◉' },
            { label: 'Assistant IA', href: '/admin/ia', icon: '✦' },
          ].map(({ label, href, icon }) => (
            <a key={label} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.45)', borderLeft: '2px solid transparent', textDecoration: 'none' }}>
              <span>{icon}</span>{label}
            </a>
          ))}
          <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />
          <a href="/admin/utilisateurs" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: '#c9a96e', borderLeft: '2px solid #c9a96e', textDecoration: 'none', background: 'rgba(201,169,110,0.08)' }}>
            <span>👤</span>Utilisateurs
          </a>
        </nav>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Utilisateurs</h1>
            <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>{users.length} utilisateur{users.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowNew(true)} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '11px 22px', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase' as const }}>
            + Nouvel utilisateur
          </button>
        </div>

        {/* Info droits */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          {ROLES.map(r => (
            <div key={r.id} style={{ ...card, padding: '16px 20px', borderLeft: `3px solid ${r.color}` }}>
              <div style={{ fontSize: 14, color: r.color, fontWeight: 500, marginBottom: 8 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', lineHeight: 1.6 }}>
                {r.id === 'admin' ? (
                  <>✓ Accès complet à tout le backoffice<br />✓ Gestion des utilisateurs<br />✓ Suppression fournisseurs/produits<br />✓ Remises illimitées en caisse</>
                ) : (
                  <>✓ Caisse + backoffice complet<br />✓ Modification clients et fournisseurs<br />✗ Suppression fournisseurs<br />✗ Remise max 20% (pas de cumul ligne + globale)</>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Liste utilisateurs */}
        {loading ? (
          <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
        ) : (
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {['Utilisateur', 'Email', 'Rôle', 'PIN', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const role = ROLES.find(r => r.id === u.role)
                  return (
                    <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none', opacity: u.actif ? 1 : 0.5 }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 14, color: '#f0e8d8' }}>{u.prenom} {u.nom}</div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: 'rgba(232,224,213,0.5)' }}>{u.email}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, background: `${role?.color}20`, color: role?.color, padding: '3px 10px', borderRadius: 4, fontWeight: 500 }}>
                          {role?.label || u.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 16, color: 'rgba(232,224,213,0.3)', letterSpacing: 4 }}>••••</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, background: u.actif ? '#1e2a1e' : '#2a1e1e', color: u.actif ? '#6ec96e' : '#c96e6e', padding: '3px 10px', borderRadius: 4 }}>
                          {u.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditingUser(u)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
                            Modifier
                          </button>
                          <button onClick={() => handleToggleActif(u)} style={{ background: 'transparent', border: `0.5px solid ${u.actif ? 'rgba(201,110,110,0.3)' : 'rgba(110,201,110,0.3)'}`, color: u.actif ? '#c96e6e' : '#6ec96e', borderRadius: 4, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>
                            {u.actif ? 'Désactiver' : 'Activer'}
                          </button>
                          <button onClick={() => setConfirmDelete(u)} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.2)', color: 'rgba(201,110,110,0.5)', borderRadius: 4, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center' as const, color: 'rgba(232,224,213,0.3)' }}>Aucun utilisateur</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modals */}
      {showNew && <ModalUser onClose={() => setShowNew(false)} onSaved={load} />}
      {editingUser && <ModalUser user={editingUser} onClose={() => setEditingUser(undefined)} onSaved={load} />}

      {confirmDelete && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#18130e', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 10, padding: '28px 32px', maxWidth: 400, width: '100%' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#f0e8d8', marginBottom: 12 }}>Supprimer l'utilisateur ?</h3>
            <p style={{ fontSize: 13, color: 'rgba(232,224,213,0.5)', marginBottom: 20 }}>
              Voulez-vous supprimer <strong style={{ color: '#f0e8d8' }}>{confirmDelete.prenom} {confirmDelete.nom}</strong> ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '11px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, background: '#c96e6e', color: '#fff', border: 'none', borderRadius: 6, padding: '11px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}