// src/app/api/analyser-facture/route.tsx
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { fichierBase64, nom } = await req.json()
    if (!fichierBase64) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      system: `Tu es un expert-comptable français spécialisé dans l'extraction de données de factures fournisseurs.
Tu réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks, pas de texte avant ou après) avec cette structure exacte :
{
  "statut": "ok" | "partiel" | "erreur",
  "resume": "1-2 phrases décrivant la facture (fournisseur, nature de l'achat, montant)",
  "fournisseur": {
    "nom": "Raison sociale exacte" | null,
    "siret": "14 chiffres sans espaces" | null,
    "tva_intracom": "FRXXNNNNNNNNN" | null,
    "adresse_ligne1": "..." | null,
    "code_postal": "..." | null,
    "ville": "..." | null
  },
  "facture": {
    "numero": "Numéro tel qu'il apparaît sur la facture" | null,
    "date_facture": "YYYY-MM-DD" | null,
    "date_echeance": "YYYY-MM-DD" | null
  },
  "lignes": [
    {
      "libelle": "Description de la ligne",
      "quantite": number,
      "prix_unitaire_ht": number | null,
      "montant_ht": number,
      "tva_taux": 20 | 10 | 5.5 | 2.1 | 0,
      "montant_tva": number,
      "montant_ttc": number
    }
  ],
  "totaux": {
    "total_ht": number,
    "total_tva": number,
    "total_ttc": number,
    "ventilation_tva": [
      { "taux": 20, "base_ht": number, "montant_tva": number }
    ]
  },
  "mode_paiement_suggere": "virement" | "cb" | "cheque" | "prelevement" | "especes" | null,
  "categorie_suggeree": "vin" | "biere" | "spiritueux" | "accessoires" | "energie" | "telecom" | "internet" | "loyer" | "assurance" | "expert_comptable" | "banque" | "transport" | "fournitures" | "maintenance" | "marketing" | "restauration" | "formation" | "impots" | "urssaf" | "autre",
  "anomalies": [
    { "gravite": "mineure" | "importante" | "critique", "description": "..." }
  ]
}

Règles strictes :
- Cohérence arithmétique : total_ht + total_tva ≈ total_ttc (tolérance 0,02€)
- Si une donnée est absente ou illisible, retourner null (ne JAMAIS inventer)
- Les dates DOIVENT être au format ISO YYYY-MM-DD
- Les montants sont des numbers (pas de strings, pas de symbole €, séparateur décimal = point)
- statut="ok" si tout est cohérent, "partiel" si données incomplètes, "erreur" si illisible
- Si la cohérence arithmétique échoue, ajouter une anomalie "critique"
- Si la TVA intracommunautaire est présente mais le SIRET absent (ou inverse), anomalie "importante"
- Si la date d'échéance est absente, anomalie "mineure"
- Sois exhaustif sur les lignes : reprends chaque ligne de la facture, ne synthétise pas`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: fichierBase64 }
          } as any,
          {
            type: 'text',
            text: `Extrais TOUTES les informations de cette facture fournisseur "${nom || 'sans nom'}" au format JSON spécifié dans le system prompt. Sois précis sur les montants et les dates.`
          }
        ]
      }]
    })

    const text = message.content.map(c => c.type === 'text' ? c.text : '').join('').trim()
    
    // Nettoyer d'éventuels backticks malgré le system prompt
    const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()
    
    let analyse: any
    try {
      analyse = JSON.parse(clean)
    } catch (parseErr) {
      console.error('Parse IA failed, raw text:', clean.slice(0, 500))
      return NextResponse.json({ 
        error: 'Réponse IA non parsable', 
        raw: clean.slice(0, 500) 
      }, { status: 500 })
    }
    
    return NextResponse.json(analyse)
  } catch (e: any) {
    console.error('Erreur analyse facture:', e)
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}