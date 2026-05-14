import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { fichierBase64, nom, periode } = await req.json()
    if (!fichierBase64) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: `Tu es un expert en droit du travail français et en gestion de la paie. 
Analyse la fiche de paie et réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) avec cette structure exacte :
{
  "statut": "ok" ou "anomalies",
  "resume": "Résumé en 1-2 phrases",
  "anomalies": [
    { "gravite": "critique"|"importante"|"mineure", "description": "Description", "reference_legale": "Référence si applicable" }
  ],
  "mentions_obligatoires": {
    "presentes": ["mention 1", "mention 2"],
    "manquantes": ["mention manquante 1"]
  },
  "elements_verifies": [
    { "element": "Nom élément", "valeur": "Valeur trouvée", "ok": true, "commentaire": "Commentaire" }
  ]
}`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fichierBase64 }
          } as any,
          {
            type: 'text',
            text: `Analyse cette fiche de paie "${nom || 'sans nom'}" (période: ${periode || 'non précisée'}).

Vérifie obligatoirement :
1. Mentions légales (Art. R.3243-1 Code du travail) : nom/adresse employeur, SIRET, code NAF, URSSAF, convention collective, nom/prénom salarié, qualification/classification, période de paie, heures travaillées, salaire brut, cotisations salariales détaillées, cotisations patronales, net avant IR, montant net social (obligatoire depuis 1er juil 2023), prélèvement à la source, net à payer, date de paiement, mention "à conserver sans limite de durée"
2. Cohérence calculs : salaire brut → net (taux global salarié ~22-25%, patronal ~42-45%)
3. SMIC 2024 respecté (1802.25€ brut mensuel pour 35h)
4. Montant net social présent (obligatoire depuis juillet 2023)

Sois précis et factuel. Si tu ne peux pas lire clairement un élément, indique-le dans le commentaire.`
          }
        ]
      }]
    })

    const text = message.content.map(c => c.type === 'text' ? c.text : '').join('')
    const analyse = JSON.parse(text.trim())
    return NextResponse.json(analyse)
  } catch (e: any) {
    console.error('Erreur analyse paie:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}