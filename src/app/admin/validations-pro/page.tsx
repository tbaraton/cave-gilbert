'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export default function ValidationsProPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setAuthReady(true); return }
        const { data: profile } = await supabase.from('users').select('*').eq('auth_user_id', authUser.id).maybeSingle()
        if (!profile) { setAuthReady(true); return }
        setCurrentUser(profile)
        if (profile.role === 'admin') { setHasAccess(true); setAuthReady(true); return }
        const { data: perms } = await supabase.from('user_permissions').select('acces_clients').eq('user_id', profile.id).maybeSingle()
        setHasAccess(perms?.acces_clients === true)
      } finally {
        setAuthReady(true)
      }
    })()
  }, [])

  const [loadErr, setLoadErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setLoadErr('')
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, prenom, nom, raison_sociale, est_societe, email, telephone, adresse, code_postal, ville, notes, created_at, tarif_pro, pro_pending')
        .eq('pro_pending', true)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) { setLoadErr(`Erreur Supabase : ${error.message}`); setPending([]); return }
      setPending(data || [])
    } catch (e: any) {
      setLoadErr(`Erreur réseau : ${e?.message || String(e)}`)
      setPending([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAccess) load() }, [hasAccess, load])

  const handleValider = async (c: any) => {
    if (!confirm(`Valider ${c.prenom} ${c.nom} (${c.email}) comme client pro ?`)) return
    setActionMsg('')
    const { error } = await supabase.from('customers').update({ tarif_pro: true, pro_pending: false }).eq('id', c.id)
    if (error) { setActionMsg(`Erreur : ${error.message}`); return }
    setActionMsg(`✓ ${c.email} validé comme pro`)
    load()
  }

  const handleRefuser = async (c: any) => {
    if (!confirm(`Refuser la demande pro de ${c.email} ? Le compte restera en particulier.`)) return
    setActionMsg('')
    const { error } = await supabase.from('customers').update({ pro_pending: false }).eq('id', c.id)
    if (error) { setActionMsg(`Erreur : ${error.message}`); return }
    setActionMsg(`✓ Demande de ${c.email} refusée`)
    load()
  }

  if (!authReady) return <div style={loadingScreen}>⟳ Chargement…</div>
  if (!currentUser) return <div style={loadingScreen}>Non connecté — <a href="/login" style={{ color: '#c9a96e', marginLeft: 8 }}>Se connecter</a></div>
  if (!hasAccess) return <div style={loadingScreen}>Accès refusé — permission Clients requise<br/><a href="/admin" style={{ color: '#c9a96e', marginTop: 16 }}>← Retour</a></div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', maxWidth: 'calc(100vw - 220px)' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Validations pro</h1>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 24 }}>
          Demandes d'accès au tarif pro depuis la boutique
        </p>

        {actionMsg && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(110,201,110,0.08)', border: '0.5px solid rgba(110,201,110,0.3)', borderRadius: 4, fontSize: 12, color: '#6ec96e' }}>{actionMsg}</div>}

        {loadErr && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 4, fontSize: 12, color: '#c96e6e' }}>{loadErr}</div>}

        {loading ? (
          <div style={empty}>⟳ Chargement…</div>
        ) : pending.length === 0 ? (
          <div style={empty}>Aucune demande en attente 🎉</div>
        ) : (
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {['Inscrit le', 'Identité', 'Email', 'Téléphone', 'Adresse', 'Actions'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < pending.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ ...td, color: 'rgba(232,224,213,0.55)' }}>{fmtDate(c.created_at)}</td>
                    <td style={td}>
                      <div>{c.est_societe ? c.raison_sociale : `${c.prenom || ''} ${c.nom || ''}`.trim() || '—'}</div>
                      {c.est_societe && (c.prenom || c.nom) && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.45)' }}>{c.prenom} {c.nom}</div>}
                    </td>
                    <td style={{ ...td, color: 'rgba(232,224,213,0.7)' }}>{c.email}</td>
                    <td style={{ ...td, color: 'rgba(232,224,213,0.6)' }}>{c.telephone || '—'}</td>
                    <td style={{ ...td, color: 'rgba(232,224,213,0.55)', fontSize: 11 }}>
                      {c.adresse ? (<>
                        {c.adresse}<br/>{[c.code_postal, c.ville].filter(Boolean).join(' ')}
                      </>) : '—'}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleValider(c)} style={btnValid}>✓ Valider</button>
                        <button onClick={() => handleRefuser(c)} style={btnRefuse}>✕ Refuser</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function Sidebar() {
  return (
    <aside style={{ width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' as const, padding: '24px 0', position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 100 }}>
      <div style={{ padding: '0 20px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <a href="/admin" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>Cave de Gilbert</div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </a>
      </div>
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' as const }}>
        <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.5)', textDecoration: 'none', borderLeft: '2px solid transparent' }}>
          <span>←</span>Retour au backoffice
        </a>
        <div style={{ height: 12 }} />
        <a href="/admin/clients" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.5)', textDecoration: 'none', borderLeft: '2px solid transparent' }}>
          <span>◎</span>Clients
        </a>
        <a href="/admin/validations-pro" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: '#c9a96e', textDecoration: 'none', borderLeft: '2px solid #c9a96e', background: 'rgba(201,169,110,0.08)' }}>
          <span>🔑</span>Validations pro
        </a>
      </nav>
    </aside>
  )
}

const loadingScreen: any = { minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.6)', flexDirection: 'column', gap: 12 }
const card: any = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }
const empty: any = { padding: 60, textAlign: 'center', color: 'rgba(232,224,213,0.4)', fontSize: 13, background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6 }
const th: any = { padding: '10px 12px', textAlign: 'left', fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400, textTransform: 'uppercase' }
const td: any = { padding: '12px', fontSize: 12, color: '#e8e0d5', verticalAlign: 'top' }
const btnValid: any = { background: 'rgba(110,201,110,0.15)', border: '0.5px solid rgba(110,201,110,0.4)', color: '#6ec96e', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }
const btnRefuse: any = { background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }
