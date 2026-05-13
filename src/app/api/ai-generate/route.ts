// src/app/api/ai-generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nom, domaine_nom, appellation_nom, millesime, couleur, prix_vente_ttc } = body

    if (!nom || !couleur || !prix_vente_ttc) {
      return NextResponse.json({ error: 'Champs requis : nom, couleur, prix_vente_ttc' }, { status: 400 })
    }

    const prompt = `Tu es un expert sommelier. Génère une fiche produit complète pour ce vin :
- Nom : ${nom}
${domaine_nom ? `- Domaine : ${domaine_nom}` : ''}
${appellation_nom ? `- Appellation : ${appellation_nom}` : ''}
${millesime ? `- Millésime : ${millesime}` : ''}
- Couleur : ${couleur}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, avec exactement cette structure :
{"description_courte":"1 phrase percutante de 15 mots max","description_longue":"Paragraphe de 80 mots","cepages":["Cépage1"],"alcool":13.5,"aromes":["Arôme1","Arôme2","Arôme3","Arôme4","Arôme5"],"accords":["Accord1","Accord2","Accord3"],"temp_service_min":14,"temp_service_max":17,"decantation_min":30,"type_verre":"Bordeaux","apogee_debut":2026,"apogee_fin":2035,"profil":{"acidite":65,"tanins":78,"corps":82,"mineralite":55,"sucrosite":15,"longueur":88,"complexite":85}}`

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Clé GEMINI_API_KEY manquante' }, { status: 500 })

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.json()
      return NextResponse.json({ error: `Erreur Gemini : ${err.error?.message ?? geminiRes.statusText}` }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return NextResponse.json({ error: 'Réponse Gemini vide' }, { status: 500 })

    const clean = text.replace(/```json|```/g, '').trim()
    const aiData = JSON.parse(clean)

    const { data: product, error: errProd } = await supabaseAdmin
      .from('products')
      .insert({
        nom,
        millesime: millesime ? parseInt(millesime) : null,
        couleur,
        categorie: ['rouge','blanc','rosé','champagne','effervescent'].includes(couleur) ? 'vin' : couleur === 'spiritueux' ? 'spiritueux' : 'vin',
        prix_vente_ttc: parseFloat(prix_vente_ttc),
        cepages: aiData.cepages || [],
        alcool: aiData.alcool || null,
        description_courte: aiData.description_courte,
        description_longue: aiData.description_longue,
        ia_generated: true,
        ia_generated_at: new Date().toISOString(),
        actif: false,
      })
      .select()
      .single()

    if (errProd) return NextResponse.json({ error: errProd.message }, { status: 500 })

    await supabaseAdmin.from('tasting_notes').insert({
      product_id: product.id,
      aromes: aiData.aromes || [],
      accords: aiData.accords || [],
      temp_service_min: aiData.temp_service_min,
      temp_service_max: aiData.temp_service_max,
      decantation_min: aiData.decantation_min,
      type_verre: aiData.type_verre,
      apogee_debut: aiData.apogee_debut,
      apogee_fin: aiData.apogee_fin,
      acidite: aiData.profil?.acidite,
      tanins: aiData.profil?.tanins,
      corps: aiData.profil?.corps,
      mineralite: aiData.profil?.mineralite,
      sucrosite: aiData.profil?.sucrosite,
      longueur: aiData.profil?.longueur,
      complexite: aiData.profil?.complexite,
    })

    return NextResponse.json({ success: true, product })
  } catch (err: any) {
    console.error('[ai-generate]', err)
    return NextResponse.json({ error: err.message ?? 'Erreur interne' }, { status: 500 })
  }
}