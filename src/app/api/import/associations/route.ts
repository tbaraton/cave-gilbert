// src/app/api/import/associations/route.ts
// POST /api/import/associations
// Associe les produits à leurs fournisseurs via le mapping CSV

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\u201c|\u201d|\u201e|\u201f/g, '"')
    .replace(/\u2018|\u2019|\u201a|\u201b/g, "'")
    .replace(/""/g, '"')
    .trim()
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne' }, { status: 400 })
    }

    let importes = 0, ignores = 0, erreurs = 0

    const { data: products } = await supabase
      .from('products')
      .select('id, nom, prix_achat_ht')
      .eq('actif', true)

    const { data: domaines } = await supabase
      .from('domaines')
      .select('id, nom')

    if (!products || !domaines) {
      return NextResponse.json({ error: 'Impossible de charger products/domaines' }, { status: 500 })
    }

    const productMap = new Map<string, { id: string; prix_achat_ht: number | null }>()
    for (const p of products) {
      productMap.set(normalizeStr(p.nom), { id: p.id, prix_achat_ht: p.prix_achat_ht })
    }

    const domaineMap = new Map<string, string>()
    for (const d of domaines) {
      domaineMap.set(d.nom.toUpperCase().trim(), d.id)
    }

    const { data: existing } = await supabase
      .from('product_suppliers')
      .select('product_id')
      .eq('fournisseur_principal', true)
    const existingSet = new Set((existing || []).map((e: any) => e.product_id))

    const toInsert: any[] = []

    for (const row of rows) {
      const nomProduit = row.nom_produit || ''
      const nomFournisseur = row.nom_fournisseur || ''
      if (!nomProduit || !nomFournisseur) { ignores++; continue }

      const product = productMap.get(normalizeStr(nomProduit))
      if (!product) { ignores++; continue }
      if (existingSet.has(product.id)) { ignores++; continue }

      const domaineId = domaineMap.get(nomFournisseur.toUpperCase().trim())
      if (!domaineId) { ignores++; continue }

      toInsert.push({
        product_id: product.id,
        domaine_id: domaineId,
        prix_achat_ht: product.prix_achat_ht,
        conditionnement: 6,
        fournisseur_principal: true,
      })
      existingSet.add(product.id)
    }

    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100)
      const { error } = await supabase
        .from('product_suppliers')
        .upsert(batch, { onConflict: 'product_id,domaine_id', ignoreDuplicates: true })
      if (error) { erreurs += batch.length }
      else { importes += batch.length }
    }

    return NextResponse.json({ success: true, importes, ignores, erreurs })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}