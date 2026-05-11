import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { to, numero, clientNom, html } = await req.json()

    if (!to || !html) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const { data, error } = await resend.emails.send({
      from: 'Cave de Gilbert <contact@cavedegilbert.fr>',
      to: [to],
      subject: `Bon de réservation ${numero} — Cave de Gilbert`,
      html: html,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (e: any) {
    console.error('API error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}