import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { question, history } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY!

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `Tu es l'assistant IA de Cave de Gilbert, une cave à vin française.
Base de données disponible :
- products (nom, couleur, millesime, prix_achat_ht, prix_vente_ttc, actif boolean, bio boolean, vegan boolean, casher boolean, naturel boolean, biodynamique boolean, region_id uuid, appellation_id uuid, domaine_id uuid)
- customers (prenom, nom, email, telephone)
- domaines (nom) — fournisseurs
- supplier_orders (numero, statut, date_commande) — statuts: 'brouillon','envoyée','reçue','annulée'
- supplier_order_items (product_nom, quantite_commandee, prix_achat_ht)
- stock (product_id, site_id, quantite)
- sites (nom, code)
- stock_movements (raison, quantite, note, created_at)
- v_stock_par_site (produit, site, quantite, stock_statut)

Réponds en JSON valide UNIQUEMENT : {"answer":"réponse en français","sql":"SELECT ... LIMIT 50"}
Si pas de SQL nécessaire : {"answer":"réponse","sql":null}

Règles SQL critiques :
- actif est un boolean : WHERE actif = true (pas WHERE actif = 1)
- bio, vegan, casher, naturel, biodynamique sont des boolean
- prix_vente_ttc est numeric : WHERE prix_vente_ttc < 20
- Pour la couleur : WHERE couleur = 'rouge' (valeurs: rouge, blanc, rosé, champagne, effervescent, spiritueux, autre)
- JOIN regions r ON r.id = p.region_id
- LIMIT 50 toujours`,
        messages: [
          ...(history || []).slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
          { role: 'user', content: question }
        ],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ answer: `Erreur ${response.status}: ${data.error?.message}`, sql: null })
    }

    const text = data.content?.[0]?.text || '{}'
    try {
      const match = text.match(/\{[\s\S]*\}/)
      return NextResponse.json(match ? JSON.parse(match[0]) : { answer: text, sql: null })
    } catch {
      return NextResponse.json({ answer: text, sql: null })
    }
  } catch (e: any) {
    return NextResponse.json({ answer: `Erreur: ${e.message}`, sql: null }, { status: 500 })
  }
}