// src/app/api/ai-generate/route.ts
// Route API Next.js — Génération de fiche produit par IA
// Appel : POST /api/ai-generate
// Body  : { nom, domaine?, appellation?, millesime?, couleur, prix_vente_ttc }

import { NextRequest, NextResponse } from 'next/server'
import { createProductWithAI } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validation minimale
    if (!body.nom || !body.couleur || !body.prix_vente_ttc) {
      return NextResponse.json(
        { error: 'Champs requis manquants : nom, couleur, prix_vente_ttc' },
        { status: 400 }
      )
    }

    const product = await createProductWithAI({
      nom: body.nom,
      domaine_id: body.domaine_id,
      domaine_nom: body.domaine_nom,
      appellation_id: body.appellation_id,
      appellation_nom: body.appellation_nom,
      millesime: body.millesime ? parseInt(body.millesime) : undefined,
      couleur: body.couleur,
      prix_vente_ttc: parseFloat(body.prix_vente_ttc),
      prix_achat_ht: body.prix_achat_ht ? parseFloat(body.prix_achat_ht) : undefined,
    })

    return NextResponse.json({ success: true, product })
  } catch (err: any) {
    console.error('[ai-generate]', err)
    return NextResponse.json(
      { error: err.message ?? 'Erreur interne' },
      { status: 500 }
    )
  }
}
