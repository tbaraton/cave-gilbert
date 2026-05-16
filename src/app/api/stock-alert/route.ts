// Inscription à une alerte de retour de stock pour un produit.
// POST body : { product_id, email }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { product_id, email } = await req.json()
    if (!product_id || !email) {
      return NextResponse.json({ error: 'product_id et email requis' }, { status: 400 })
    }
    const cleanEmail = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
    }

    // Upsert (on ignore le conflit grâce à la contrainte unique)
    const { error } = await supabaseAdmin
      .from('stock_alerts')
      .upsert({ product_id, email: cleanEmail }, { onConflict: 'product_id,email' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[stock-alert]', e)
    return NextResponse.json({ error: e.message || 'Erreur interne' }, { status: 500 })
  }
}
