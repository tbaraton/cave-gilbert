import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { question, schema, history } = await req.json()

  const systemPrompt = `Tu es l'assistant IA de Cave de Gilbert, une cave à vin. Tu as accès à la base de données via des requêtes SQL.

${schema}

Ton rôle :
1. Comprendre la question en langage naturel
2. Générer une requête SQL SELECT appropriée si nécessaire
3. Répondre de façon concise et utile en français

Règles SQL importantes :
- Utilise UNIQUEMENT des SELECT (pas d'INSERT, UPDATE, DELETE)
- Les accents dans les enum : 'envoyée', 'reçue', 'annulée'
- Pour les dates : NOW(), INTERVAL '1 month', etc.
- Joins : products p JOIN domaines d ON d.id = p.domaine_id
- Pour le stock : table stock (product_id, site_id, quantite) ou vue v_stock_par_site
- Limite toujours à 100 résultats max avec LIMIT

Réponds TOUJOURS en JSON avec ce format exact :
{
  "answer": "Ta réponse en français naturel, résumant ce que tu as trouvé",
  "sql": "SELECT ... (ou null si pas besoin de SQL)"
}

Si tu n'as pas besoin de SQL (question de conversation générale), mets sql à null.
Si tu génères du SQL, explique dans answer ce que tu as trouvé une fois les données récupérées.`

  const messages = [
    ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question }
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'

  try {
    // Extraire le JSON de la réponse
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { answer: text, sql: null }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ answer: text, sql: null })
  }
}