// Upload simple d'un fichier (badge, image de carrousel, etc.) sur Supabase Storage.
// Pas de traitement d'image (pas de PhotoRoom, pas de Sharp) — juste un upload brut.
// Utilise la clé service-role pour bypass RLS sur le bucket.
//
// Usage : POST multipart/form-data avec :
//   - file: le fichier image
//   - folder: 'badges' | 'carousel' (sous-dossier dans le bucket product-images)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

const BUCKET = 'product-images'
const ALLOWED_FOLDERS = ['badges', 'carousel']

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const folder = String(formData.get('folder') || '')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Fichier manquant (champ "file" attendu)' }, { status: 400 })
    }
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: `Dossier "${folder}" non autorisé. Attendu : ${ALLOWED_FOLDERS.join(', ')}` }, { status: 400 })
    }

    // Récupère l'extension depuis le nom (fallback : type MIME ou .png)
    const filename = (file as any).name || ''
    const ext = filename.split('.').pop()?.toLowerCase() || (file.type.split('/')[1] || 'png')
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    })
    if (upErr) {
      return NextResponse.json({ error: `Upload Supabase : ${upErr.message}` }, { status: 500 })
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
