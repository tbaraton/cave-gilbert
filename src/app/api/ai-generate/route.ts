// src/app/api/ai-generate/route.ts
//
// Génère une fiche produit complète via Mistral La Plateforme (tier gratuit).
// Insère le produit dans `products` + ses notes dans `tasting_notes` + remplit
// les nouvelles colonnes SEO/dégustation ajoutées par la migration.
//
// Prérequis env : MISTRAL_API_KEY (clé créée sur console.mistral.ai)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MISTRAL_MODEL = 'mistral-small-latest'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nom, domaine_nom, appellation_nom, region_nom, millesime, couleur, prix_vente_ttc, contenance } = body

    if (!nom || !couleur || !prix_vente_ttc) {
      return NextResponse.json({ error: 'Champs requis : nom, couleur, prix_vente_ttc' }, { status: 400 })
    }

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'MISTRAL_API_KEY manquante. Crée une clé gratuite sur https://console.mistral.ai puis ajoute la dans .env.local' }, { status: 500 })
    }

    const prompt = `Tu es un caviste-sommelier expert et également rédacteur web SEO en français.

Génère une fiche produit COMPLÈTE et RICHE pour ce vin destiné à être publié sur le site d'une cave.

Données du vin :
- Nom : ${nom}
${domaine_nom ? `- Domaine : ${domaine_nom}` : ''}
${appellation_nom ? `- Appellation : ${appellation_nom}` : ''}
${region_nom ? `- Région : ${region_nom}` : ''}
${millesime ? `- Millésime : ${millesime}` : ''}
- Couleur : ${couleur}
${contenance ? `- Contenance : ${contenance}` : ''}

Ta réponse doit être UNIQUEMENT du JSON valide, sans markdown, sans backticks, sans texte autour.
Tous les champs textuels doivent être en français impeccable, naturel et engageant pour un amateur de vin.

Structure attendue :
{
  "description_courte": "1 phrase percutante de 15 mots max, accroche commerciale",
  "description_longue": "Paragraphe rédigé de 80 à 120 mots décrivant l'histoire du vin, son terroir, son style",
  "notes_degustation": "Notes de dégustation rédigées (œil, nez, bouche) en 60 à 100 mots",
  "accords_mets": "Texte de 30 à 50 mots suggérant 3-4 accords mets précis (plats, fromages, charcuteries...)",
  "cepages": ["Cépage1", "Cépage2"],
  "alcool": 13.5,
  "garde_potentiel_annees": 8,
  "temperature_service_min": 14,
  "temperature_service_max": 17,
  "aromes": ["Arôme1", "Arôme2", "Arôme3", "Arôme4", "Arôme5"],
  "accords_courts": ["Plat1", "Plat2", "Plat3"],
  "decantation_min": 30,
  "type_verre": "Bordeaux",
  "apogee_debut": 2026,
  "apogee_fin": 2035,
  "profil": {
    "acidite": 65,
    "tanins": 78,
    "corps": 82,
    "mineralite": 55,
    "sucrosite": 15,
    "longueur": 88,
    "complexite": 85
  },
  "meta_title": "Balise SEO <title> 50-60 caractères, inclure nom + appellation + millésime si pertinent",
  "meta_description": "Balise SEO <meta description> 140-160 caractères, accrocheuse, inclure 2-3 mots-clés vin/appellation/cépage et inciter au clic"
}

Règles strictes :
- Pas de \\n dans les chaînes JSON.
- Tous les nombres sont des numbers (pas de chaînes).
- Profil : valeurs 0-100 (intensité perçue).
- Garde : nombre d'années à compter du millésime.
- Températures en °C.`

    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
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
      return NextResponse.json({ error: `Erreur Mistral (${mistralRes.status}) : ${errText}` }, { status: 500 })
    }

    const mistralData = await mistralRes.json()
    const content = mistralData.choices?.[0]?.message?.content
    if (!content) return NextResponse.json({ error: 'Réponse Mistral vide' }, { status: 500 })

    let aiData: any
    try {
      aiData = JSON.parse(content.replace(/```json|```/g, '').trim())
    } catch (e: any) {
      return NextResponse.json({ error: `JSON Mistral invalide : ${e.message}`, raw: content }, { status: 500 })
    }

    const { data: product, error: errProd } = await supabaseAdmin
      .from('products')
      .insert({
        nom,
        millesime: millesime ? parseInt(millesime) : null,
        couleur,
        categorie: ['rouge', 'blanc', 'rosé', 'champagne', 'effervescent'].includes(couleur) ? 'vin' : couleur === 'spiritueux' ? 'spiritueux' : 'vin',
        prix_vente_ttc: parseFloat(prix_vente_ttc),
        contenance: contenance || null,
        cepages: aiData.cepages || [],
        alcool: aiData.alcool || null,
        description_courte: aiData.description_courte,
        description_longue: aiData.description_longue,
        notes_degustation: aiData.notes_degustation || null,
        accords_mets: aiData.accords_mets || null,
        temperature_service_min: aiData.temperature_service_min || null,
        temperature_service_max: aiData.temperature_service_max || null,
        garde_potentiel_annees: aiData.garde_potentiel_annees || null,
        meta_title: aiData.meta_title || null,
        meta_description: aiData.meta_description || null,
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
      accords: aiData.accords_courts || aiData.accords || [],
      temp_service_min: aiData.temperature_service_min,
      temp_service_max: aiData.temperature_service_max,
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

    return NextResponse.json({ success: true, product, aiData })
  } catch (err: any) {
    console.error('[ai-generate]', err)
    return NextResponse.json({ error: err.message ?? 'Erreur interne' }, { status: 500 })
  }
}
