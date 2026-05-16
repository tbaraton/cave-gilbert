// Complète un produit existant avec l'IA Mistral : ne remplit que les champs
// vides/null, n'écrase pas les saisies manuelles.
//
// Body attendu : { product_id: string }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MISTRAL_MODEL = 'mistral-small-latest'

const isEmpty = (v: any) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

export async function POST(req: NextRequest) {
  try {
    const { product_id } = await req.json()
    if (!product_id) return NextResponse.json({ error: 'product_id manquant' }, { status: 400 })

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'MISTRAL_API_KEY manquante' }, { status: 500 })

    // 1) Récupérer le produit existant + son contexte (domaine, appellation, région)
    const { data: produit, error: errFetch } = await supabaseAdmin
      .from('products')
      .select('*, domaine:domaines(nom), appellation:appellations(nom), region:regions(nom)')
      .eq('id', product_id)
      .single()
    if (errFetch || !produit) return NextResponse.json({ error: `Produit introuvable : ${errFetch?.message}` }, { status: 404 })

    const domaine_nom = produit.domaine?.nom
    const appellation_nom = produit.appellation?.nom
    const region_nom = produit.region?.nom

    // 2) Construire le prompt
    const prompt = `Tu es un caviste-sommelier expert et rédacteur web SEO en français.

Génère une fiche produit COMPLÈTE et RICHE pour ce vin :
- Nom : ${produit.nom}
${domaine_nom ? `- Domaine : ${domaine_nom}` : ''}
${appellation_nom ? `- Appellation : ${appellation_nom}` : ''}
${region_nom ? `- Région : ${region_nom}` : ''}
${produit.millesime ? `- Millésime : ${produit.millesime}` : ''}
- Couleur : ${produit.couleur}
${produit.contenance ? `- Contenance : ${produit.contenance}` : ''}

Réponds UNIQUEMENT en JSON valide, en français impeccable et engageant :
{
  "description_courte": "1 phrase percutante de 15 mots max",
  "description_longue": "Paragraphe rédigé de 80 à 120 mots (terroir, style, histoire)",
  "notes_degustation": "Notes œil/nez/bouche en 60 à 100 mots",
  "accords_mets": "30-50 mots, 3-4 accords précis",
  "cepages": ["Cépage1", "Cépage2"],
  "alcool": 13.5,
  "garde_potentiel_annees": 8,
  "temperature_service_min": 14,
  "temperature_service_max": 17,
  "meta_title": "Balise SEO <title> 50-60 caractères (nom + appellation + millésime)",
  "meta_description": "Balise SEO <meta description> 140-160 caractères, accrocheuse",
  "bio": false,
  "vegan": false,
  "naturel": false,
  "biodynamique": false,
  "casher": false
}

Règles strictes : pas de \\n dans les chaînes, nombres en number, températures en °C.
Certifications : true UNIQUEMENT si le domaine est connu et reconnu pour cette
certification (Coulée de Serrant en biodynamie, Marcel Lapierre en naturel, etc.).
En cas de doute, mets false.`

    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    })
    if (!mistralRes.ok) {
      const errText = await mistralRes.text()
      return NextResponse.json({ error: `Mistral (${mistralRes.status}) : ${errText.slice(0, 200)}` }, { status: 502 })
    }
    const mistralData = await mistralRes.json()
    const content = mistralData.choices?.[0]?.message?.content
    if (!content) return NextResponse.json({ error: 'Réponse Mistral vide' }, { status: 502 })

    let aiData: any
    try { aiData = JSON.parse(content.replace(/```json|```/g, '').trim()) }
    catch (e: any) { return NextResponse.json({ error: `JSON invalide : ${e.message}` }, { status: 502 }) }

    // 3) Préparer le payload UPDATE : uniquement les champs actuellement vides
    const updates: any = {}
    const fields: Array<[string, any]> = [
      ['description_courte', aiData.description_courte],
      ['description_longue', aiData.description_longue],
      ['notes_degustation', aiData.notes_degustation],
      ['accords_mets', aiData.accords_mets],
      ['cepages', aiData.cepages],
      ['alcool', aiData.alcool],
      ['garde_potentiel_annees', aiData.garde_potentiel_annees],
      ['temperature_service_min', aiData.temperature_service_min],
      ['temperature_service_max', aiData.temperature_service_max],
      ['meta_title', aiData.meta_title],
      ['meta_description', aiData.meta_description],
    ]
    for (const [key, value] of fields) {
      if (isEmpty(produit[key]) && !isEmpty(value)) updates[key] = value
    }
    // Certifications : ne flip false → true que si l'IA est confiante.
    // Jamais l'inverse (on ne retire pas une certif manuelle).
    for (const cert of ['bio', 'vegan', 'naturel', 'biodynamique', 'casher']) {
      if (produit[cert] !== true && aiData[cert] === true) updates[cert] = true
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'Aucun champ vide à compléter' })
    }

    updates.ia_generated = true
    updates.ia_generated_at = new Date().toISOString()

    const { error: errUpd } = await supabaseAdmin.from('products').update(updates).eq('id', product_id)
    if (errUpd) return NextResponse.json({ error: `Update échec : ${errUpd.message}` }, { status: 500 })

    return NextResponse.json({ success: true, updated: Object.keys(updates).length - 2, fields: Object.keys(updates).filter(k => !['ia_generated', 'ia_generated_at'].includes(k)) })
  } catch (e: any) {
    console.error('[ai-complete-product]', e)
    return NextResponse.json({ error: e.message || 'Erreur interne' }, { status: 500 })
  }
}
