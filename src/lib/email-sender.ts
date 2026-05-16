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

export async function envoyerDocument(params: {
  to: string
  subject: string
  html: string
  siteNom: string
  usage?: 'client' | 'commande' | 'comptable'
}) {
  const { from, replyTo } = getEmailSender(params.siteNom, params.usage || 'client')
  const res = await fetch('/api/envoyer-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html, replyTo }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Erreur envoi email')
  return data as { success: true; id: string }
}
