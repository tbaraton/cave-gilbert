import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_FROM = [
  'info@cavedegilbert.fr',
  'commande@cavedegilbert.fr',
  'comptabilite@cavedegilbert.fr',
  'contact@cavedegilbert.fr',
  'contact@petitecave.net',
]

function extractAddress(from: string) {
  const m = from.match(/<([^>]+)>/)
  return (m ? m[1] : from).trim().toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const { from, to, subject, html, replyTo } = await req.json()
    if (!from || !to || !subject || !html) {
      return NextResponse.json({ error: 'Paramètres manquants (from, to, subject, html requis)' }, { status: 400 })
    }

    const addr = extractAddress(from)
    if (!ALLOWED_FROM.includes(addr)) {
      return NextResponse.json({ error: `Adresse expéditeur non autorisée : ${addr}` }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY non configurée' }, { status: 500 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('Resend error:', data)
      return NextResponse.json({ error: data?.message || 'Erreur envoi' }, { status: 500 })
    }
    return NextResponse.json({ success: true, id: data.id })
  } catch (e: any) {
    console.error('API envoyer-document error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
