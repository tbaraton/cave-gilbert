// src/app/api/stock/route.ts
// POST /api/stock — Mouvement de stock (avec site_id)

import { NextRequest, NextResponse } from 'next/server'
import { moveStock } from '@/lib/supabase'
import type { StockMovementReason } from '@/types'

const SORTIES: StockMovementReason[] = ['vente', 'casse', 'dégustation', 'transfert_out']
const ENTREES: StockMovementReason[] = ['achat', 'retour', 'transfert_in', 'ajustement']
const RAISONS = [...SORTIES, ...ENTREES]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { product_id, site_id, raison, quantite, note } = body

    if (!product_id || !site_id || !raison || quantite === undefined) {
      return NextResponse.json(
        { error: 'Champs requis : product_id, site_id, raison, quantite' },
        { status: 400 }
      )
    }

    if (!RAISONS.includes(raison)) {
      return NextResponse.json(
        { error: `Raison invalide. Valeurs acceptées : ${RAISONS.join(', ')}` },
        { status: 400 }
      )
    }

    const qty = Math.abs(parseInt(quantite))
    if (isNaN(qty) || qty === 0) {
      return NextResponse.json(
        { error: 'La quantité doit être un entier positif non nul' },
        { status: 400 }
      )
    }

    await moveStock(product_id, site_id, raison, qty, note)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[stock]', err)
    return NextResponse.json({ error: err.message ?? 'Erreur interne' }, { status: 500 })
  }
}
