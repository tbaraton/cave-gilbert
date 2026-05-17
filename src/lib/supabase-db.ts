// Client Supabase pour les queries DB côté browser, partagé entre toutes les pages
// admin pour éviter le warning "Multiple GoTrueClient instances".
//
// Configuration : ZÉRO gestion de session côté JS (autoRefreshToken/persistSession off)
// + lock passthrough qui désactive complètement navigator.locks (qui peut hanger
// indéfiniment sur certains contextes browser, bloquant TOUTES les queries).
//
// L'authentification passe par /api/auth-me côté serveur, indépendamment de ce client.

import { createClient } from '@supabase/supabase-js'

// Lock passthrough : exécute immédiatement la fn sans acquérir aucun verrou
const noLock = async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

export const supabaseDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      lock: noLock,
    },
  }
)
