import { NextRequest, NextResponse } from 'next/server'
import { htmlToPdf } from '@/lib/html-to-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

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

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

export async function POST(req: NextRequest) {
  try {
    const { from, to, subject, html, pdfHtml, pdfFilename, replyTo } = await req.json()
    if (!from || !to || !subject || (!html && !pdfHtml)) {
      return NextResponse.json({ error: 'Paramètres manquants (from, to, subject, html ou pdfHtml requis)' }, { status: 400 })
    }

    const addr = extractAddress(from)
    if (!ALLOWED_FROM.includes(addr)) {
      return NextResponse.json({ error: `Adresse expéditeur non autorisée : ${addr}` }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY non configurée' }, { status: 500 })
    }

    let attachments: { filename: string; content: string }[] | undefined
    if (pdfHtml) {
      const pdfBuffer = await htmlToPdf(pdfHtml)
      const filename = safeFilename(pdfFilename || `${subject}.pdf`)
      attachments = [{ filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`, content: pdfBuffer.toString('base64') }]
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || '<p>Voir le document en pièce jointe.</p>',
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments ? { attachments } : {}),
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
