import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question, schema, history } = body

    console.log('IA request received:', question)
    console.log('API key present:', !!process.env.ANTHROPIC_API_KEY)
    console.log('API key starts with:', process.env.ANTHROPIC_API_KEY?.slice(0, 10))

    const systemPrompt = `Tu es l'assistant IA de Cave de Gilbert. Réponds TOUJOURS en JSON : {"answer": "réponse en français", "sql": null}`

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: systemPrompt,
        messages,
      }),
    })

    console.log('Anthropic status:', response.status)
    const data = await response.json()
    console.log('Anthropic data:', JSON.stringify(data).slice(0, 300))

    if (!response.ok) {
      return NextResponse.json({ answer: `Erreur API Anthropic: ${data.error?.message || response.status}`, sql: null })
    }

    const text = data.content?.[0]?.text || '{}'
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { answer: text, sql: null }
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ answer: text, sql: null })
    }
  } catch (e: any) {
    console.error('IA route error:', e.message)
    return NextResponse.json({ answer: `Erreur: ${e.message}`, sql: null }, { status: 500 })
  }
}