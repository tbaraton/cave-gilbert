// src/app/api/import/fournisseurs/route.ts
// POST /api/import/fournisseurs
// Body: { rows: FournisseurRow[] }
// Importe les fournisseurs dans la table domaines

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type FournisseurRow = {
  nom?: string
  telephone?: string
  code_postal?: string
  ville?: string
  pays?: string
  email?: string
  identifiant_origine?: string
  [key: string]: string | undefined
}

// Table dédiée aux fournisseurs — on va la créer si elle n'existe pas
// Sinon on les stocke dans la table domaines avec un flag fournisseur
// Pour l'instant on crée une table simple via SQL dans Supabase

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne fournie' }, { status: 400 })
    }

    const results = { importes: 0, ignores: 0, erreurs: 0, details: [] as any[] }
    const BATCH = 50

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)

      const toInsert = batch
        .filter((r: FournisseurRow) => r.nom?.trim())
        .map((r: FournisseurRow) => ({
          nom: r.nom!.trim(),
          description: [
            r.ville ? `${r.code_postal || ''} ${r.ville}`.trim() : null,
            r.pays && r.pays !== 'France' ? r.pays : null,
            r.email ? `Email: ${r.email}` : null,
            r.telephone ? `Tél: ${r.telephone}` : null,
          ].filter(Boolean).join(' — ') || null,
          site_web: r.email ? null : null, // Email stocké dans description
        }))

      if (toInsert.length === 0) {
        results.ignores += batch.length
        continue
      }

      // Upsert dans domaines (upsert sur le nom)
      const { data, error } = await supabase
        .from('domaines')
        .upsert(toInsert, {
          onConflict: 'nom',
          ignoreDuplicates: true, // Ne pas écraser si déjà existant
        })
        .select()

      if (error) {
        // Si la contrainte unique n'existe pas, faire un insert simple
        const { error: err2 } = await supabase
          .from('domaines')
          .insert(toInsert)

        if (err2) {
          results.erreurs += toInsert.length
          results.details.push({ batch: i, error: err2.message })
        } else {
          results.importes += toInsert.length
        }
      } else {
        results.importes += toInsert.length
      }

      results.ignores += batch.length - toInsert.length
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err: any) {
    console.error('[import/fournisseurs]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
