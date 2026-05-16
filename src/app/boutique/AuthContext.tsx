'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface BoutiqueUser {
  id: string
  email: string
  prenom?: string
  nom?: string
  raison_sociale?: string
  est_societe?: boolean
}

export interface SignUpData {
  email: string
  password: string
  civilite: string
  prenom: string
  nom: string
  telephone?: string
  type_compte: 'particulier' | 'pro'
  raison_sociale?: string
  siret?: string
  newsletter: boolean
}

interface AuthContextType {
  user: BoutiqueUser | null
  isPro: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (data: SignUpData) => Promise<{ error?: string; needsValidation?: boolean }>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BoutiqueUser | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async (email: string | null | undefined) => {
    if (!email) { setUser(null); setIsPro(false); return }
    const { data: cust } = await supabase
      .from('customers')
      .select('id, prenom, nom, raison_sociale, est_societe, email, tarif_pro')
      .eq('email', email)
      .maybeSingle()
    if (cust) {
      setUser({ id: cust.id, email: cust.email, prenom: cust.prenom, nom: cust.nom, raison_sociale: cust.raison_sociale, est_societe: cust.est_societe })
      setIsPro(cust.tarif_pro === true)
    } else {
      setUser({ id: '', email })
      setIsPro(false)
    }
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      await refreshProfile(authUser?.email)
      setLoading(false)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await refreshProfile(session?.user?.email)
    })
    return () => sub.subscription.unsubscribe()
  }, [refreshProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) return { error: error.message }
    return {}
  }

  const signUp = async (d: SignUpData) => {
    const cleanEmail = d.email.trim().toLowerCase()
    const isPro = d.type_compte === 'pro'
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail, password: d.password,
      options: { data: { prenom: d.prenom, nom: d.nom } },
    })
    if (error) return { error: error.message }
    // Upsert customer avec tous les champs enrichis
    if (data.user) {
      const now = new Date().toISOString()
      await supabase.from('customers').upsert({
        civilite: d.civilite || null,
        prenom: d.prenom,
        nom: d.nom,
        email: cleanEmail,
        telephone: d.telephone?.trim() || null,
        raison_sociale: isPro ? (d.raison_sociale?.trim() || null) : null,
        siret: isPro ? (d.siret?.trim() || null) : null,
        est_societe: isPro,
        newsletter: d.newsletter,
        tarif_pro: false,
        pro_pending: isPro, // seuls les pros ont une demande à valider
        cgv_acceptee_le: now,
        majorite_certifiee_le: now,
      }, { onConflict: 'email' })
    }
    return { needsValidation: isPro }
  }

  const refresh = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    await refreshProfile(authUser?.email)
  }, [refreshProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsPro(false)
  }

  return (
    <AuthContext.Provider value={{ user, isPro, loading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
