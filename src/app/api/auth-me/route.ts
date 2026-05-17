// Endpoint server-side qui lit les cookies Supabase et renvoie l'utilisateur authentifié.
//
// Utilisé par le check d'auth côté admin pour contourner le bug du client Supabase JS
// (lock bloqué → getSession() hangue indéfiniment). Le serveur lit les cookies sans
// dépendre du JS Supabase côté navigateur.

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll() { /* read-only, on ne modifie pas les cookies ici */ },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      return NextResponse.json({ user: null, error: error.message }, { status: 200 })
    }
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 })
    }
    return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ user: null, error: e?.message || String(e) }, { status: 500 })
  }
}
