// Recherche une image de bouteille via Google Custom Search API (tier gratuit 100/jour).
//
// Prérequis env (à ajouter dans .env.local + Vercel) :
//   GOOGLE_CSE_API_KEY = clé API depuis console.cloud.google.com (activer Custom Search API)
//   GOOGLE_CSE_ID      = ID du Programmable Search Engine (cx) créé sur
//                        programmablesearchengine.google.com
//
// Setup résumé :
//   1. Google Cloud Console → créer un projet → activer 'Custom Search API'
//   2. Identifiants → créer une clé API → copier (GOOGLE_CSE_API_KEY)
//   3. programmablesearchengine.google.com → ajouter un moteur :
//        - Sites à rechercher : laisser vide pour rechercher tout le web
//        - Image search : activer
//      → copier l'ID du moteur (GOOGLE_CSE_ID)
//
// Si les clés ne sont pas configurées, retourne null sans erreur (graceful).

export type BottleImageQuery = {
  nom: string
  domaine?: string | null
  appellation?: string | null
  millesime?: string | number | null
}

export async function findBottleImage(q: BottleImageQuery): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_ID
  if (!apiKey || !cx) {
    console.warn('[find-bottle-image] GOOGLE_CSE_API_KEY ou GOOGLE_CSE_ID manquant — recherche ignorée.')
    return null
  }

  // Requête : on combine domaine + nom + millésime, et on ajoute "bouteille" pour biaiser
  // vers des photos produit plutôt que vignobles/cépages.
  const parts = [q.domaine, q.nom, q.millesime ? String(q.millesime) : null, 'bouteille']
    .filter(Boolean)
    .join(' ')
  const query = parts.trim()

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '5')
  url.searchParams.set('imgSize', 'large')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('fileType', 'jpg,png,webp')

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[find-bottle-image] Erreur API Google CSE (${res.status}) : ${errText.slice(0, 200)}`)
      return null
    }
    const data = await res.json()
    const items: any[] = data.items || []
    if (items.length === 0) {
      console.warn(`[find-bottle-image] Aucun résultat pour : ${query}`)
      return null
    }

    // Heuristique : on préfère les images au format portrait (typique pour les bouteilles),
    // dans une plage de tailles raisonnable, et on évite les domaines connus pour servir
    // des miniatures de mauvaise qualité.
    const blacklistedDomains = ['pinterest.', 'pinimg.', 'twimg.', 'tiktok.']
    const scored = items
      .filter((it: any) => {
        const link: string = it.link || ''
        return link.startsWith('http') && !blacklistedDomains.some(d => link.includes(d))
      })
      .map((it: any) => {
        const w = it.image?.width || 0
        const h = it.image?.height || 0
        const isPortrait = h > w
        const sizeOk = w >= 200 && w <= 3000 && h >= 300
        const score = (isPortrait ? 10 : 0) + (sizeOk ? 5 : 0) + (h > 600 ? 3 : 0)
        return { link: it.link as string, score }
      })
      .sort((a, b) => b.score - a.score)

    return scored[0]?.link || items[0].link || null
  } catch (e: any) {
    console.warn(`[find-bottle-image] Exception : ${e.message}`)
    return null
  }
}
