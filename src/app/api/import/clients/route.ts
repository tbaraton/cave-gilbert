// src/app/api/import/clients/route.ts
// POST /api/import/clients
// Body: { rows: ClientRow[] }
// Importe les clients en batch avec upsert sur l'email

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ClientRow = {
  prenom?: string
  nom?: string
  email?: string
  telephone?: string
  code_postal?: string
  ville?: string
  newsletter?: string
  [key: string]: string | undefined
}

function normalizeEmail(email: string): string {
  return email?.trim().toLowerCase() || ''
}

function normalizeTel(tel: string): string {
  if (!tel) return ''
  return tel.replace(/[\s.\-]/g, '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne fournie' }, { status: 400 })
    }

    const results = { importes: 0, ignores: 0, erreurs: 0, details: [] as any[] }

    // Traitement par batch de 50 pour ne pas surcharger Supabase
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)

      const toInsert = batch
        .filter((r: ClientRow) => {
          // Un client doit avoir au moins un nom ou un email
          const hasNom = (r.nom || r.prenom || '').trim().length > 0
          const hasEmail = normalizeEmail(r.email || '').length > 0
          return hasNom || hasEmail
        })
        .map((r: ClientRow) => ({
          prenom: r.prenom?.trim() || null,
          nom: r.nom?.trim() || null,
          email: normalizeEmail(r.email || '') || null,
          telephone: normalizeTel(r.telephone || '') || null,
          newsletter: r.newsletter?.toLowerCase() === 'oui',
        }))

      if (toInsert.length === 0) continue

      // Upsert sur l'email (ignore si email déjà existant)
      // Pour les clients sans email, insert simple
      const avecEmail = toInsert.filter(c => c.email)
      const sansEmail = toInsert.filter(c => !c.email)

      if (avecEmail.length > 0) {
        const { data, error } = await supabase
          .from('customers')
          .upsert(avecEmail, {
            onConflict: 'email',
            ignoreDuplicates: false, // Met à jour si email existe déjà
          })
          .select()

        if (error) {
          results.erreurs += avecEmail.length
          results.details.push({ batch: i, error: error.message })
        } else {
          results.importes += avecEmail.length
        }
      }

      if (sansEmail.length > 0) {
        const { error } = await supabase
          .from('customers')
          .insert(sansEmail)

        if (error) {
          results.erreurs += sansEmail.length
        } else {
          results.importes += sansEmail.length
        }
      }

      results.ignores += batch.length - toInsert.length
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err: any) {
    console.error('[import/clients]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
