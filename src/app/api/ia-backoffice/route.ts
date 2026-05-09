import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { question, schema, history } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY!

    const DB_SCHEMA = `
Base de données Cave de Gilbert (Supabase/PostgreSQL) :
- products (id, nom, nom_cuvee, couleur, millesime, contenance, region_id, appellation_id, domaine_id, prix_achat_ht, prix_vente_ttc, prix_vente_pro, actif, bio, vegan, casher, naturel, biodynamique)
- customers (id, prenom, nom, email, telephone, ville, code_postal)
- domaines (id, nom, contact_nom, email, telephone, ville)
- supplier_orders (id, numero, domaine_id, statut, date_commande, created_at) — statuts: 'brouillon', 'envoyée', 'reçue', 'annulée'
- supplier_order_items (id, order_id, product_id, product_nom, quantite_commandee, quantite_recue, prix_achat_ht)
- stock (id, product_id, site_id, quantite)
- sites (id, nom, ville, code, type, actif)
- transfers (id, numero, site_source_id, site_destination_id, statut, demande_le, confirme_le, recu_le)
- transfer_items (id, transfer_id, product_id, quantite_demandee, quantite_expediee, quantite_recue)
- stock_movements (id, product_id, site_id, raison, quantite, stock_avant, stock_apres, note, created_at)
- regions (id, nom), appellations (id, nom, region_id)
- product_suppliers (id, product_id, domaine_id, prix_achat_ht, conditionnement, fournisseur_principal)
- v_stock_par_site (product_id, produit, millesime, site, site_id, quantite, stock_statut)
`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `Tu es l'assistant IA de Cave de Gilbert, une cave à vin. Tu as accès à la base de données via des requêtes SQL.

${DB_SCHEMA}

Ton rôle :
1. Comprendre la question en langage naturel
2. Générer une requête SQL SELECT si nécessaire
3. Répondre de façon concise et utile en français

Règles SQL :
- UNIQUEMENT des SELECT
- Accents dans les enum : 'envoyée', 'reçue', 'annulée'
- LIMIT 100 max
- Pour les dates récentes : created_at > NOW() - INTERVAL '1 month'

Réponds TOUJOURS en JSON valide :
{"answer": "ta réponse en français", "sql": "SELECT ... " }
ou si pas de SQL :
{"answer": "ta réponse", "sql": null}`,
        messages: [
          ...(history || []).slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
          { role: 'user', content: question }
        ],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ answer: `Erreur Anthropic: ${data.error?.message}`, sql: null })
    }

    const text = data.content?.[0]?.text || '{}'
    try {
      const match = text.match(/\{[\s\S]*\}/)
      const parsed = match ? JSON.parse(match[0]) : { answer: text, sql: null }
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ answer: text, sql: null })
    }
  } catch (e: any) {
    return NextResponse.json({ answer: `Erreur: ${e.message}`, sql: null }, { status: 500 })
  }
}