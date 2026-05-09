import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  // Debug temporaire - affiche si la clé est présente
  if (!apiKey) {
    return NextResponse.json({ 
      answer: 'DEBUG: ANTHROPIC_API_KEY est vide ou manquante dans Vercel', 
      sql: null 
    })
  }

  if (!apiKey.startsWith('sk-ant-')) {
    return NextResponse.json({ 
      answer: `DEBUG: La clé ne commence pas par sk-ant- (commence par: ${apiKey.slice(0, 15)}...)`, 
      sql: null 
    })
  }

  try {
    const { question, schema, history } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: `Tu es l'assistant Cave de Gilbert. Réponds TOUJOURS en JSON : {"answer": "réponse", "sql": null}`,
        messages: [
          ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
          { role: 'user', content: question }
        ],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ answer: `Erreur Anthropic ${response.status}: ${data.error?.message}`, sql: null })
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