// Coordonnées légales et logo par entité juridique (Cave de Gilbert ou La Petite Cave).
// Match par nom ou label court (CDG / LPC).

import type { SiteInfo } from './pdf-templates'

export function getSiteInfo(siteNomOrLabel: string): SiteInfo {
  const n = (siteNomOrLabel || '').toLowerCase()
  if (n.includes('petite cave') || n === 'lpc') {
    return {
      nom: 'La Petite Cave',
      adresse: '3 Rue Peillon',
      ville: "69210 L'Arbresle",
      tel: '09 60 50 15 72',
      email: 'contact@petitecave.net',
      siret: '452 841 562 00039',
      tva: 'FR25 452 841 562',
      logo: '/logo-petite-cave.png',
      tribunal: 'Lyon',
    }
  }
  return {
    nom: 'Cave de Gilbert',
    adresse: 'Avenue Jean Colomb',
    ville: "69280 Marcy l'Étoile",
    tel: '04 22 91 41 09',
    email: 'contact@cavedegilbert.fr',
    siret: '898 622 055 00017',
    tva: 'FR79 898 622 055',
    logo: '/logo.png',
    tribunal: 'Lyon',
  }
}
