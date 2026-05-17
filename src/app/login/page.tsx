'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function LoginForm() {
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingSessionEmail, setExistingSessionEmail] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) setExistingSessionEmail(user.email)
      } catch {}
    })()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : authError.message)
      setLoading(false)
      return
    }
    window.location.href = nextUrl
  }

  return (
    <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 380 }}>
      <div style={{ textAlign: 'center' as const, marginBottom: 40 }}>
        <img src="/logo.png" alt="Cave de Gilbert" style={{ maxHeight: 64, maxWidth: '80%', objectFit: 'contain', marginBottom: 14 }} onError={e => (e.currentTarget.style.display = 'none')} />
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e', letterSpacing: 3, fontWeight: 300 }}>Cave de Gilbert</div>
        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', marginTop: 6, letterSpacing: 1 }}>Administration</div>
      </div>

      {existingSessionEmail && (
        <div style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12, color: 'rgba(232,224,213,0.75)', lineHeight: 1.5 }}>
          Session active : <strong style={{ color: '#c9a96e' }}>{existingSessionEmail}</strong>
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>
            Se reconnecter remplacera cette session (un seul compte connecté à la fois).
          </div>
          <button type="button" onClick={async () => { await supabase.auth.signOut(); setExistingSessionEmail(null) }}
            style={{ marginTop: 10, background: 'transparent', border: '0.5px solid rgba(232,224,213,0.2)', color: 'rgba(232,224,213,0.7)', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
            Se déconnecter d'abord
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#c96e6e', textAlign: 'center' as const }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Email</label>
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="exemple@cavedegilbert.fr" autoComplete="email"
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#f0e8d8', fontSize: 15, padding: '13px 16px', width: '100%', boxSizing: 'border-box' as const }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>Mot de passe</label>
        <input
          type="password" required value={password} onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#f0e8d8', fontSize: 15, padding: '13px 16px', width: '100%', boxSizing: 'border-box' as const }}
        />
      </div>

      <button type="submit" disabled={loading || !email || !password}
        style={{ width: '100%', background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, letterSpacing: 1, opacity: loading ? 0.7 : 1 }}>
        {loading ? '⟳ Connexion...' : 'Se connecter'}
      </button>

      <div style={{ textAlign: 'center' as const, marginTop: 28 }}>
        <a href="/" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none', letterSpacing: 1 }}>← Retour au site</a>
      </div>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#0d0a08',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif"
    }}>
      <Suspense fallback={<div style={{ color: 'rgba(232,224,213,0.4)' }}>⟳</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}