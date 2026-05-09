import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { question, history } = await req.json()
    
    // Lire la clé de plusieurs façons
    const key1 = process.env.ANTHROPIC_API_KEY
    const key2 = process.env['ANTHROPIC_API_KEY']
    
    const apiKey = (key1 || key2 || '').trim()
    
    if (!apiKey) {
      return NextResponse.json({ answer: 'Clé manquante', sql: null })
    }

    const body = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: question }],
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }),
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    if (!response.ok) {
      return NextResponse.json({ 
        answer: `Status ${response.status}: ${JSON.stringify(data.error)}`, 
        sql: null 
      })
    }

    return NextResponse.json({ 
      answer: data.content?.[0]?.text || 'OK', 
      sql: null 
    })
  } catch (e: any) {
    return NextResponse.json({ answer: `Exception: ${e.message}`, sql: null })
  }
}