// src/app/api/import/produits/route.ts
// POST /api/import/produits
// Body: { rows: ProduitRow[], site_id: string }
// Importe les produits en batch avec gestion du stock initial

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ProduitRow = {
  nom?: string
  domaine?: string
  appellation?: string
  millesime?: string
  couleur?: string
  cepages?: string
  alcool?: string
  prix_vente_ttc?: string
  prix_achat_ht?: string
  bio?: string
  description_courte?: string
  stock?: string
  [key: string]: string | undefined
}

const COULEURS_VALIDES = ['rouge', 'blanc', 'rosé', 'champagne', 'effervescent', 'spiritueux', 'autre']

function parsePrix(val: string | undefined): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(',', '.'))
  return isNaN(n) || n <= 0 ? null : n
}

function parseMillesime(val: string | undefined): number | null {
  if (!val) return null
  const n = parseInt(val)
  return isNaN(n) || n < 1900 || n > 2030 ? null : n
}

function parseAlcool(val: string | undefined): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(',', '.'))
  return isNaN(n) ? null : n
}

function parseStock(val: string | undefined): number {
  if (!val) return 0
  const n = parseInt(val)
  return isNaN(n) || n < 0 ? 0 : n
}

function normalizeCouleur(val: string | undefined): string {
  if (!val) return 'autre'
  const c = val.trim().toLowerCase()
  return COULEURS_VALIDES.includes(c) ? c : 'autre'
}

export async function POST(req: NextRequest) {
  try {
    const { rows, site_id } = await req.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne fournie' }, { status: 400 })
    }

    const results = {
      importes: 0,
      ignores: 0,
      erreurs: 0,
      details: [] as { nom: string; statut: string; message: string }[]
    }

    const BATCH = 20 // Petit batch pour gérer le stock ligne par ligne

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)

      for (const row of batch) {
        const nom = row.nom?.trim()
        const prix = parsePrix(row.prix_vente_ttc)

        // Validation minimale
        if (!nom) {
          results.ignores++
          continue
        }
        if (!prix) {
          results.ignores++
          results.details.push({ nom: nom || '—', statut: 'ignoré', message: 'Prix manquant ou nul' })
          continue
        }

        const couleur = normalizeCouleur(row.couleur)
        const cepages = row.cepages
          ? row.cepages.split('|').map((c: string) => c.trim()).filter(Boolean)
          : []

        try {
          // Insérer le produit
          const { data: product, error: errProd } = await supabase
            .from('products')
            .insert({
              nom,
              millesime: parseMillesime(row.millesime),
              couleur,
              prix_vente_ttc: prix,
              prix_achat_ht: parsePrix(row.prix_achat_ht),
              cepages,
              alcool: parseAlcool(row.alcool),
              bio: row.bio?.toLowerCase() === 'oui',
              description_courte: row.description_courte?.trim() || null,
              actif: true,
            })
            .select('id')
            .single()

          if (errProd) {
            results.erreurs++
            results.details.push({ nom, statut: 'erreur', message: errProd.message })
            continue
          }

          // Stock initial si fourni et site_id disponible
          const stockQty = parseStock(row.stock)
          if (stockQty > 0 && site_id) {
            await supabase.rpc('move_stock', {
              p_product_id: product.id,
              p_site_id: site_id,
              p_raison: 'achat',
              p_quantite: stockQty,
              p_note: 'Import CSV',
              p_order_id: null,
              p_transfer_id: null,
            })
          }

          results.importes++
          results.details.push({ nom, statut: 'ok', message: `Importé (stock: ${stockQty})` })
        } catch (e: any) {
          results.erreurs++
          results.details.push({ nom, statut: 'erreur', message: e.message })
        }
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err: any) {
    console.error('[import/produits]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
