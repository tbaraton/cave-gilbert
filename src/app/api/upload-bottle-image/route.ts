// Upload + détourage + cadrage uniforme d'une photo de bouteille.
//
// Pipeline :
//   1. Reçoit l'image originale (multipart/form-data, champ "file")
//   2. Envoie à PhotoRoom API → image PNG transparente (bouteille isolée)
//   3. Sharp : place sur canvas blanc 800×800 carré avec padding uniforme
//   4. Upload sur Supabase Storage (bucket "product-images")
//   5. Renvoie l'URL publique
//
// Prérequis env (.env.local + Vercel) :
//   PHOTOROOM_API_KEY = clé API PhotoRoom (50 req/mois gratuit sur app.photoroom.com)
//   SUPABASE_SERVICE_ROLE_KEY (déjà présent)
//
// Prérequis Supabase :
//   - Bucket "product-images" créé en public
//   - (Storage → New bucket → name=product-images, public=ON)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 30

const SIZE = 800
const PADDING_PCT = 0.08 // 8% de padding autour de la bouteille
const BUCKET = 'product-images'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const photoroomKey = process.env.PHOTOROOM_API_KEY
    if (!photoroomKey) {
      return NextResponse.json({ error: 'PHOTOROOM_API_KEY manquante. Crée une clé gratuite sur app.photoroom.com → API.' }, { status: 500 })
    }

    // Deux modes d'entrée :
    //  - multipart/form-data avec champ "file" (upload classique)
    //  - JSON { image_url, product_id } (récupère l'image depuis une URL)
    const contentType = req.headers.get('content-type') || ''
    let imageBlob: Blob
    let productId: string | null = null

    if (contentType.includes('application/json')) {
      const body = await req.json()
      productId = body.product_id || null
      const url = body.image_url
      if (!url) return NextResponse.json({ error: 'image_url manquant dans le body JSON' }, { status: 400 })
      // Fetch l'image depuis l'URL (avec un User-Agent pour passer les CDN type Cloudflare)
      let imgRes: Response
      try {
        imgRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CaveGilbertBot/1.0)' } })
      } catch (e: any) {
        return NextResponse.json({ error: `Impossible de télécharger l'image : ${e.message}` }, { status: 400 })
      }
      if (!imgRes.ok) {
        return NextResponse.json({ error: `URL inaccessible (HTTP ${imgRes.status}). Vérifie le lien.` }, { status: 400 })
      }
      const imgContentType = imgRes.headers.get('content-type') || 'image/jpeg'
      if (!imgContentType.startsWith('image/')) {
        return NextResponse.json({ error: `L'URL ne pointe pas vers une image (type : ${imgContentType})` }, { status: 400 })
      }
      const imgBuffer = await imgRes.arrayBuffer()
      imageBlob = new Blob([imgBuffer], { type: imgContentType })
    } else {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      productId = formData.get('product_id') as string | null
      if (!file) return NextResponse.json({ error: 'Fichier manquant (champ "file" attendu)' }, { status: 400 })
      imageBlob = file
    }

    // 1. Détourage via PhotoRoom — endpoint v1/segment, renvoie PNG transparent
    const prFormData = new FormData()
    prFormData.append('image_file', imageBlob, 'bottle.jpg')
    const prRes = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: { 'x-api-key': photoroomKey },
      body: prFormData,
    })
    if (!prRes.ok) {
      const errText = await prRes.text()
      return NextResponse.json({ error: `Erreur PhotoRoom (${prRes.status}) : ${errText.slice(0, 200)}` }, { status: 502 })
    }
    const cutoutBuffer = Buffer.from(await prRes.arrayBuffer())

    // 2. Sharp : place sur canvas blanc 800×800 avec padding uniforme
    const cutoutMeta = await sharp(cutoutBuffer).metadata()
    const cw = cutoutMeta.width || SIZE
    const ch = cutoutMeta.height || SIZE
    // Trim les pixels transparents en bordure pour avoir le vrai bounding box de la bouteille
    const trimmed = await sharp(cutoutBuffer).trim({ threshold: 0 }).toBuffer()
    const trimMeta = await sharp(trimmed).metadata()
    const tw = trimMeta.width || cw
    const th = trimMeta.height || ch

    // Cible : taille interne après padding
    const innerSize = Math.round(SIZE * (1 - 2 * PADDING_PCT))
    // Ratio de redimensionnement pour que la dimension la plus grande tienne dans innerSize
    const ratio = Math.min(innerSize / tw, innerSize / th)
    const resizedW = Math.round(tw * ratio)
    const resizedH = Math.round(th * ratio)

    const resizedBottle = await sharp(trimmed)
      .resize(resizedW, resizedH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer()

    // 3. Composite sur canvas blanc 800x800 centré
    const left = Math.round((SIZE - resizedW) / 2)
    const top = Math.round((SIZE - resizedH) / 2)
    const final = await sharp({
      create: {
        width: SIZE,
        height: SIZE,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([{ input: resizedBottle, top, left }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer()

    // 4. Upload sur Supabase Storage
    const filename = `${productId || 'produit'}-${Date.now()}.jpg`
    const { error: errUp } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, final, { contentType: 'image/jpeg', upsert: false })
    if (errUp) {
      return NextResponse.json({ error: `Upload Supabase échec : ${errUp.message}. Vérifie que le bucket "${BUCKET}" existe et est public.` }, { status: 500 })
    }
    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filename)
    const publicUrl = pub.publicUrl

    // 5. Si product_id fourni, met à jour le produit
    if (productId) {
      await supabaseAdmin.from('products').update({ image_url: publicUrl }).eq('id', productId)
    }

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (e: any) {
    console.error('[upload-bottle-image]', e)
    return NextResponse.json({ error: e.message || 'Erreur interne' }, { status: 500 })
  }
}
