// Mapping site → adresses d'envoi clients / commande / comptable.
// Cave de Gilbert + Entrepôt = même entité juridique, mêmes adresses.
// La Petite Cave = entité distincte, une seule adresse pour tout.

type DocType = 'ticket' | 'devis' | 'commande' | 'bl' | 'facture' | 'avoir' | 'bon_cadeau'

const PETITE_CAVE = {
  fromName: 'La Petite Cave',
  client: 'contact@petitecave.net',
  commande: 'contact@petitecave.net',
  comptable: 'contact@petitecave.net',
}

const CAVE_GILBERT = {
  fromName: 'Cave de Gilbert',
  client: 'info@cavedegilbert.fr',
  commande: 'commande@cavedegilbert.fr',
  comptable: 'comptabilite@cavedegilbert.fr',
}

function pickEntity(siteNom: string) {
  const n = (siteNom || '').toLowerCase()
  if (n.includes('petite cave') || n === 'lpc') return PETITE_CAVE
  return CAVE_GILBERT
}

export function getEmailSender(siteNom: string, usage: 'client' | 'commande' | 'comptable' = 'client') {
  const e = pickEntity(siteNom)
  const addr = e[usage]
  return { from: `${e.fromName} <${addr}>`, replyTo: addr, fromName: e.fromName }
}

const LIBELLES: Record<DocType, string> = {
  ticket: 'Ticket de caisse',
  devis: 'Devis',
  commande: 'Commande',
  bl: 'Bon de livraison',
  facture: 'Facture',
  avoir: 'Avoir',
  bon_cadeau: 'Bon cadeau',
}

export function buildSubject(typeDoc: string, numero: string, siteNom: string) {
  const lib = LIBELLES[(typeDoc as DocType)] || 'Document'
  const entite = pickEntity(siteNom).fromName
  return `${lib} ${numero} — ${entite}`
}

export function buildEmailBody(opts: { typeDoc: string; numero: string; clientNom?: string; siteNom: string }) {
  const e = pickEntity(opts.siteNom)
  const lib = (LIBELLES[(opts.typeDoc as DocType)] || 'document').toLowerCase()
  const hello = opts.clientNom ? `Bonjour ${opts.clientNom},` : 'Bonjour,'
  return `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#222;line-height:1.6;padding:20px">
<p>${hello}</p>
<p>Veuillez trouver ci-joint votre ${lib} ${opts.numero}.</p>
<p style="color:#666;font-size:13px;margin-top:24px">Cordialement,<br>${e.fromName}</p>
</div>`
}

export function buildPdfFilename(typeDoc: string, numero: string) {
  const lib = LIBELLES[(typeDoc as DocType)] || 'Document'
  return `${lib.replace(/\s+/g, '-')}-${numero}.pdf`
}

export async function envoyerDocument(params: {
  to: string
  subject: string
  pdfHtml: string
  pdfFilename?: string
  emailBody?: string
  siteNom: string
  usage?: 'client' | 'commande' | 'comptable'
}) {
  const { from, replyTo } = getEmailSender(params.siteNom, params.usage || 'client')
  const res = await fetch('/api/envoyer-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.emailBody,
      pdfHtml: params.pdfHtml,
      pdfFilename: params.pdfFilename,
      replyTo,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Erreur envoi email')
  return data as { success: true; id: string }
}
