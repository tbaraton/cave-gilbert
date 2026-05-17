'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase, fullPage } from './_shared'

// ============================================================
// Layout partagé /admin/eboutique : auth + sidebar avec sous-items
// ============================================================

const SUBNAV: { href: string; label: string; icon: string }[] = [
  { href: '/admin/eboutique/badges',   label: 'Badges & macarons', icon: '🏷️' },
  { href: '/admin/eboutique/carrousel', label: 'Carrousel d\'accueil', icon: '🎞️' },
]

export default function EboutiqueLayout({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    const safety = setTimeout(() => setAuthReady(true), 5000)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const authUser = session?.user
        if (!authUser) return
        const { data: profile } = await supabase
          .from('users').select('*').eq('auth_user_id', authUser.id).maybeSingle()
        if (!profile) return
        setCurrentUser(profile)
        if (profile.role === 'admin') { setHasAccess(true); return }
        const { data: perms } = await supabase
          .from('user_permissions').select('acces_produits').eq('user_id', profile.id).maybeSingle()
        setHasAccess(perms?.acces_produits === true)
      } finally {
        clearTimeout(safety)
        setAuthReady(true)
      }
    })()
    return () => clearTimeout(safety)
  }, [])

  if (!authReady) return <div style={fullPage}>⟳ Chargement…</div>
  if (!currentUser) return (
    <div style={fullPage}>
      Non connecté — <a href="/login" style={{ color: '#c9a96e', marginLeft: 8 }}>Se connecter</a>
    </div>
  )
  if (!hasAccess) return (
    <div style={fullPage}>
      Accès refusé — permission Produits requise
      <a href="/admin" style={{ color: '#c9a96e', marginTop: 16 }}>← Retour au backoffice</a>
    </div>
  )

  const activeSub = SUBNAV.find(s => pathname?.startsWith(s.href))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <Sidebar pathname={pathname || ''} />
      <main style={{ marginLeft: 220, flex: 1, padding: '32px 36px', maxWidth: 'calc(100vw - 220px)' }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>E-boutique</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>
          {activeSub?.label || 'E-boutique'}
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)', marginBottom: 24 }}>
          {pathname?.endsWith('/badges') ? 'Macarons visuels affichés sur les fiches produits de la boutique.' :
           pathname?.endsWith('/carrousel') ? 'Slides du carrousel hero de la page d\'accueil.' :
           'Macarons et carrousel d\'accueil.'}
        </p>
        {children}
      </main>
    </div>
  )
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside style={{
      width: 220, background: '#100d0a', borderRight: '0.5px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column' as const, padding: '24px 0',
      position: 'fixed' as const, top: 0, left: 0, bottom: 0, zIndex: 100,
    }}>
      <div style={{ padding: '0 20px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <a href="/admin" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#c9a96e', letterSpacing: 3, textTransform: 'uppercase' as const, fontWeight: 300 }}>
            Cave de Gilbert
          </div>
          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1.5, marginTop: 3 }}>ADMINISTRATION</div>
        </a>
      </div>
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' as const }}>
        <a href="/admin" style={navLink}><span>←</span>Retour au backoffice</a>

        <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(232,224,213,0.25)', padding: '20px 20px 8px', textTransform: 'uppercase' as const }}>
          E-boutique
        </div>

        {SUBNAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <a key={item.href} href={item.href} style={{
              ...navLink,
              color: active ? '#c9a96e' : 'rgba(232,224,213,0.5)',
              borderLeft: `2px solid ${active ? '#c9a96e' : 'transparent'}`,
              background: active ? 'rgba(201,169,110,0.08)' : 'transparent',
            }}>
              <span>{item.icon}</span>{item.label}
            </a>
          )
        })}
      </nav>
    </aside>
  )
}

const navLink: any = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 12, color: 'rgba(232,224,213,0.5)', textDecoration: 'none', borderLeft: '2px solid transparent' }
