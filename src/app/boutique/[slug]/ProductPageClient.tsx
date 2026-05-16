'use client'

import { useState } from 'react'
import { useAuth } from '../AuthContext'

// ============================================================
// Fiche produit — Cave de Gilbert
// Mixte : belle ET technique
// ============================================================

const COULEUR_LABEL: Record<string, string> = {
  rouge: 'Vin Rouge', blanc: 'Vin Blanc', rosé: 'Vin Rosé',
  champagne: 'Champagne', effervescent: 'Effervescent',
  spiritueux: 'Spiritueux', autre: 'Autre',
}

const COULEUR_ACCENT: Record<string, string> = {
  rouge: '#8b2020', blanc: '#b8a96a', rosé: '#c97b7b',
  champagne: '#8a6a3e', effervescent: '#8a6a3e',
  spiritueux: '#6e8b6e', autre: '#888',
}

// Mapping mot-clé → emoji pour les accords mets-vins
const ACCORD_ICONS: Array<[RegExp, string]> = [
  [/foie gras/i, '🦆'],
  [/viande rouge|b[oœ]uf|agneau|gibier|magret|c[oô]te\s+de\s+b[oœ]uf|entrec[ôo]te|tournedos/i, '🥩'],
  [/volaille|poulet|canard|dinde|caille|pintade/i, '🍗'],
  [/poisson|saumon|thon|loup|bar\b|cabillaud|truite|maquereau/i, '🐟'],
  [/crustac|fruits?\s+de\s+mer|hu[iî]tre|crevet|langoust|homard|moule/i, '🦐'],
  [/sushi|maki|asiat|thai|wok/i, '🍣'],
  [/fromage|brie|camembert|comt[ée]|roquefort|ch[èe]vre|beaufort|munster|gruy[èe]re|parmesan/i, '🧀'],
  [/charcuterie|jambon|saucisson|terrine|p[âa]t[ée]|rillette/i, '🥓'],
  [/p[âa]tes|risotto|spaghetti|lasagne|gnocchi/i, '🍝'],
  [/pizza/i, '🍕'],
  [/burger|hamburger/i, '🍔'],
  [/l[ée]gume|salade|asperge|champignon|aubergine|courgette/i, '🥗'],
  [/curry|tajine|couscous|[ée]pic|relev/i, '🌶'],
  [/dessert|chocolat|tarte|g[âa]teau|cr[èe]me|panna\s+cotta|mousse/i, '🍰'],
  [/fruit|baie|p[êe]che|abricot|figue|fraise|framboise/i, '🍑'],
  [/ap[ée]ritif|tapas|toast|gougère|petit\s+four/i, '🍸'],
  [/oeuf|œuf|omelette/i, '🍳'],
  [/pain|baguette|sandwich/i, '🥖'],
  [/grill[ée]?|barbecue|bbq|brais[ée]/i, '🔥'],
  [/truffe/i, '🍄'],
]

function iconForAccord(text: string): string {
  for (const [pattern, icon] of ACCORD_ICONS) if (pattern.test(text)) return icon
  return '🍽'
}

// Extrait jusqu'à 5 accords courts depuis un texte rédigé (fallback si pas d'array)
function extractAccordChips(text: string): string[] {
  const found = new Set<string>()
  const PRIORITAIRES = [
    'Foie gras', 'Viande rouge', 'Volaille', 'Poisson', 'Crustacés', 'Fromage affiné',
    'Charcuterie', 'Pâtes', 'Risotto', 'Gibier', 'Agneau', 'Bœuf', 'Canard', 'Magret',
    'Saumon', 'Légumes grillés', 'Tajine', 'Curry', 'Dessert chocolaté', 'Fruits rouges',
    'Apéritif', 'Sushi', 'Fromage de chèvre',
  ]
  for (const label of PRIORITAIRES) {
    const stem = label.split(/\s+/)[0]
    if (new RegExp(stem, 'i').test(text)) found.add(label)
    if (found.size >= 5) break
  }
  return Array.from(found)
}

function ProfilBar({ label, value }: { label: string; value: number | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <span style={{ width: 80, fontSize: 11, color: 'rgba(0,0,0,0.5)', textAlign: 'right' as const }}>{label}</span>
      <div style={{ flex: 1, height: 2, background: 'rgba(0,0,0,0.08)', borderRadius: 1 }}>
        <div style={{ width: `${value}%`, height: '100%', background: 'linear-gradient(90deg, #8a6a3e, #a8854a)', borderRadius: 1, transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', width: 24 }}>{value}</span>
    </div>
  )
}

export default function ProductPageClient({ product, similaires }: { product: any; similaires: any[] }) {
  const [qty, setQty] = useState(1)
  const [activeTab, setActiveTab] = useState<'description' | 'degustation' | 'service'>('degustation')
  const [addedToCart, setAddedToCart] = useState(false)

  const accent = COULEUR_ACCENT[product.couleur] || '#8a6a3e'
  // Stock affiché = stock entrepôt (le stock expédiable depuis l'entrepôt vers le client)
  const { isPro } = useAuth()
  const stockEntrepot = product._stockByEntity?.entrepot ?? product.stock_total ?? 0
  const stockCaveGilbert = product._stockByEntity?.cave_gilbert ?? 0
  const stockPetiteCave = product._stockByEntity?.petite_cave ?? 0
  const disponible = stockEntrepot > 0
  const stockStatut = stockEntrepot === 0 ? 'rupture' : stockEntrepot < 5 ? 'alerte' : 'ok'

  const handleAddToCart = () => {
    // Ici : intégration panier (localStorage ou API)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2500)
  }

  // Alerte retour de stock
  const [showStockAlert, setShowStockAlert] = useState(false)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertSent, setAlertSent] = useState(false)
  const [alertError, setAlertError] = useState('')
  const [alertSending, setAlertSending] = useState(false)

  const handleStockAlert = async () => {
    if (!alertEmail.trim()) { setAlertError('Renseigne ton email'); return }
    setAlertSending(true); setAlertError('')
    try {
      const res = await fetch('/api/stock-alert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, email: alertEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setAlertError(data.error || 'Erreur'); return }
      setAlertSent(true)
    } catch (e: any) {
      setAlertError(`Erreur : ${e.message}`)
    } finally {
      setAlertSending(false)
    }
  }

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1a1a1a' }}>

      {/* Breadcrumb (le nav principal est dans layout.tsx, sticky) */}
      <div style={{ padding: '12px 40px', fontSize: 11, color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5 }}>
        <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Accueil</a>
        <span style={{ margin: '0 8px' }}>·</span>
        <a href="/boutique" style={{ color: 'inherit', textDecoration: 'none' }}>Boutique</a>
        <span style={{ margin: '0 8px' }}>·</span>
        <span style={{ color: '#8a6a3e' }}>{product.nom}</span>
      </div>

      {/* Corps principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', maxWidth: 1200, margin: '0 auto', padding: '40px 40px 80px' }}>

        {/* ── COLONNE GAUCHE : Visuel ── */}
        <div style={{ position: 'sticky' as const, top: 32, alignSelf: 'start' }}>

          {/* Étiquette couleur */}
          <div style={{ display: 'inline-block', fontSize: 10, letterSpacing: 2.5, color: accent, textTransform: 'uppercase' as const, border: `0.5px solid ${accent}40`, padding: '4px 12px', borderRadius: 2, marginBottom: 24 }}>
            {COULEUR_LABEL[product.couleur] || product.couleur}
            {product.region && ` · ${product.region}`}
          </div>

          {/* Image / Bouteille placeholder */}
          <div style={{ background: '#fbfaf6', borderRadius: 8, padding: '60px 40px', textAlign: 'center' as const, marginBottom: 24, border: '0.5px solid rgba(0,0,0,0.06)', minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {product.image_url ? (
              <img src={product.image_url} alt={product.nom} style={{ maxHeight: 380, maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <svg width="140" height="360" viewBox="0 0 140 360" fill="none">
                {/* Capsule */}
                <rect x="52" y="12" width="36" height="24" rx="4" fill={accent} opacity="0.7" />
                {/* Col */}
                <path d="M52 34 L52 90 Q52 105 44 115 L38 128 L102 128 L96 115 Q88 105 88 90 L88 34 Z" fill="#f5f0e6" />
                {/* Corps */}
                <rect x="28" y="128" width="84" height="200" rx="5" fill="#f5f0e6" />
                {/* Étiquette */}
                <rect x="32" y="148" width="76" height="158" rx="3" fill="#1a1a1a" />
                <rect x="36" y="152" width="68" height="150" rx="2" fill="#1a1a1a" />
                <rect x="40" y="158" width="60" height="0.5" fill={accent} />
                <text x="70" y="174" textAnchor="middle" fontFamily="Georgia, serif" fontSize="7" fill="#f5f0e6" letterSpacing="1">{product.domaine || 'Domaine'}</text>
                <text x="70" y="195" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8.5" fill="#f5f0e6" fontWeight="bold">{(product.nom || '').slice(0, 18)}</text>
                {product.millesime && (
                  <>
                    <rect x="52" y="205" width="36" height="14" rx="1" fill="#f5f0e6" />
                    <text x="70" y="216" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fill={accent} letterSpacing="2">{product.millesime}</text>
                  </>
                )}
                <text x="70" y="280" textAnchor="middle" fontSize="6" fill="#8a7355">75 cl</text>
                <rect x="40" y="288" width="60" height="0.5" fill={accent} />
                {/* Base */}
                <path d="M28 328 Q28 340 38 344 L102 344 Q112 340 112 328 L112 324 L28 324 Z" fill="#f8f4ed" />
                {/* Reflet */}
                <path d="M32 140 L32 320" stroke="rgba(0,0,0,0.04)" strokeWidth="3" />
              </svg>
            )}
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {product.bio && (
              <span style={{ fontSize: 10, letterSpacing: 1, color: '#2a8a2a', border: '0.5px solid rgba(110,201,110,0.3)', padding: '4px 10px', borderRadius: 2 }}>
                🌿 Agriculture biologique
              </span>
            )}
            {product.ia_generated && (
              <span style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(175,169,236,0.7)', border: '0.5px solid rgba(175,169,236,0.2)', padding: '4px 10px', borderRadius: 2 }}>
                ✦ Fiche IA
              </span>
            )}
            {product.stock_statut === 'alerte' && (
              <span style={{ fontSize: 10, letterSpacing: 1, color: '#8a6a3e', border: '0.5px solid rgba(201,176,110,0.3)', padding: '4px 10px', borderRadius: 2 }}>
                ⚠ Dernières bouteilles
              </span>
            )}
          </div>
        </div>

        {/* ── COLONNE DROITE : Infos ── */}
        <div style={{ paddingLeft: 60 }}>

          {/* Titre */}
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>
            {product.appellation || product.region || ''}
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 300, color: '#0a0a0a', lineHeight: 1.1, marginBottom: 6 }}>
            {product.nom}
          </h1>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontStyle: 'italic', color: 'rgba(0,0,0,0.5)', marginBottom: 28 }}>
            {product.domaine}{product.millesime ? `, ${product.millesime}` : ''}
          </div>

          {/* Onglets */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(0,0,0,0.1)', marginBottom: 28 }}>
            {(['description', 'degustation', 'service'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: 'transparent', border: 'none', borderBottom: `1.5px solid ${activeTab === tab ? accent : 'transparent'}`,
                color: activeTab === tab ? accent : 'rgba(0,0,0,0.45)',
                padding: '10px 16px', fontSize: 10, letterSpacing: 2, cursor: 'pointer',
                textTransform: 'uppercase' as const, marginBottom: -1,
              }}>
                {tab === 'description' ? 'Description' : tab === 'degustation' ? 'Dégustation' : 'Service'}
              </button>
            ))}
          </div>

          {/* Tab : Description */}
          {activeTab === 'description' && (
            <div>
              {product.description_courte && (
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontStyle: 'italic', color: '#1a1a1a', lineHeight: 1.6, marginBottom: 16 }}>
                  « {product.description_courte} »
                </p>
              )}
              {product.description_longue && (
                <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)', lineHeight: 1.8, marginBottom: 24, fontWeight: 300 }}>
                  {product.description_longue}
                </p>
              )}

              {/* Caractéristiques techniques */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Appellation', value: product.appellation },
                  { label: 'Région', value: product.region },
                  { label: 'Domaine', value: product.domaine },
                  { label: 'Millésime', value: product.millesime },
                  { label: 'Cépage(s)', value: product.cepages?.join(', ') },
                  { label: 'Alcool', value: product.alcool ? `${product.alcool}% vol.` : null },
                ].filter(i => i.value).map(({ label, value }) => (
                  <div key={label} style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 12 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' as const, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#1a1a1a' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab : Dégustation */}
          {activeTab === 'degustation' && (
            <div>
              {/* Notes de dégustation rédigées — section principale */}
              {product.notes_degustation && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: accent, textTransform: 'uppercase' as const, marginBottom: 12, fontWeight: 600 }}>Notes de dégustation</div>
                  <p style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.8, fontWeight: 300 }}>
                    {product.notes_degustation}
                  </p>
                </div>
              )}

              {product.aromes?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Arômes & saveurs</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                    {product.aromes.map((a: string) => (
                      <span key={a} style={{ border: `0.5px solid ${accent}40`, borderRadius: 2, padding: '4px 10px', fontSize: 11, color: `${accent}cc`, letterSpacing: 0.5 }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Profil gustatif — réduit, sur 2 colonnes, dans un encart discret */}
              {(product.acidite || product.corps || product.tanins) && (
                <details style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(0,0,0,0.02)', border: '0.5px solid rgba(0,0,0,0.06)', borderRadius: 4 }}>
                  <summary style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Profil gustatif détaillé</span>
                    <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.3)' }}>+</span>
                  </summary>
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                    <ProfilBar label="Acidité" value={product.acidite} />
                    <ProfilBar label="Tanins" value={product.tanins} />
                    <ProfilBar label="Corps" value={product.corps} />
                    <ProfilBar label="Minéralité" value={product.mineralite} />
                    <ProfilBar label="Sucrosité" value={product.sucrosite} />
                    <ProfilBar label="Longueur" value={product.longueur} />
                    <ProfilBar label="Complexité" value={product.complexite} />
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Tab : Service & accords mets */}
          {activeTab === 'service' && (
            <div>
              {/* Accords mets-vins en premier (texte rédigé + chips visuelles) */}
              {(product.accords_mets || product.accords?.length > 0) && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: accent, textTransform: 'uppercase' as const, marginBottom: 12, fontWeight: 600 }}>🍽 Accords mets & vins</div>
                  {product.accords_mets && (
                    <p style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.8, fontWeight: 300, marginBottom: 16 }}>
                      {product.accords_mets}
                    </p>
                  )}
                  {(() => {
                    const sources: string[] = product.accords?.length > 0
                      ? product.accords
                      : extractAccordChips(product.accords_mets || '')
                    if (sources.length === 0) return null
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                        {sources.map((label: string) => (
                          <span key={label} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: `${accent}10`, border: `0.5px solid ${accent}30`,
                            borderRadius: 999, padding: '6px 12px 6px 10px',
                            fontSize: 12, color: '#1a1a1a',
                          }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>{iconForAccord(label)}</span>
                            {label}
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Service : grand encart température + garde au centre */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {(product.temperature_service_min || product.temp_service_min) && (
                  <div style={{ background: `${accent}0e`, border: `0.5px solid ${accent}30`, borderRadius: 5, padding: '20px 22px' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>🌡</div>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Température de service</div>
                    <div style={{ fontSize: 22, color: accent, fontFamily: 'Georgia, serif' }}>
                      {(product.temperature_service_min ?? product.temp_service_min)} – {(product.temperature_service_max ?? product.temp_service_max)} °C
                    </div>
                  </div>
                )}
                {product.garde_potentiel_annees && (
                  <div style={{ background: `${accent}0e`, border: `0.5px solid ${accent}30`, borderRadius: 5, padding: '20px 22px' }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Potentiel de garde</div>
                    <div style={{ fontSize: 22, color: accent, fontFamily: 'Georgia, serif' }}>
                      {product.garde_potentiel_annees} an{product.garde_potentiel_annees > 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>

              {/* Service : infos complémentaires plus petites */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { icon: '⏱', label: 'Décantation', value: product.decantation_min ? `${product.decantation_min} min` : 'Non nécessaire' },
                  { icon: '🍷', label: 'Type de verre', value: product.type_verre },
                  { icon: '📅', label: 'Apogée', value: product.apogee_debut && product.apogee_fin ? `${product.apogee_debut} – ${product.apogee_fin}` : null },
                ].filter(i => i.value).map(({ icon, label, value }) => (
                  <div key={label} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 4, padding: '12px 14px' }}>
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase' as const, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#1a1a1a' }}>{value}</div>
                  </div>
                ))}
              </div>

              {product.apogee_debut && (
                <div style={{ padding: '14px 16px', background: `${accent}10`, border: `0.5px solid ${accent}30`, borderRadius: 4 }}>
                  <div style={{ fontSize: 11, color: accent }}>
                    {new Date().getFullYear() < product.apogee_debut
                      ? `Ce vin sera à son apogée dans ${product.apogee_debut - new Date().getFullYear()} ans. Il peut se garder encore.`
                      : new Date().getFullYear() > product.apogee_fin
                      ? `Ce vin a dépassé son apogée. Consommez rapidement.`
                      : `Ce vin est actuellement à son apogée. C'est le moment idéal pour le déguster.`
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Séparateur */}
          <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.09)', margin: '32px 0' }} />

          {/* Prix + Panier */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <div>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 44, fontWeight: 300, color: '#0a0a0a' }}>
                {product.prix_vente_ttc?.toFixed(2)}
              </span>
              <span style={{ fontSize: 16, color: 'rgba(0,0,0,0.5)', marginLeft: 4 }}>€</span>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>
                Prix TTC · 75 cl
                {stockEntrepot > 0 && (
                  <span style={{ marginLeft: 12, color: stockStatut === 'alerte' ? '#8a6a3e' : '#2a8a2a' }}>
                    ● {stockStatut === 'alerte' ? (isPro ? `Plus que ${stockEntrepot} en stock` : 'Dernières bouteilles') : 'En stock'}
                  </span>
                )}
              </div>
            </div>

            {/* Sélecteur quantité */}
            <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 3 }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.6)', width: 36, height: 44, cursor: 'pointer', fontSize: 18 }}>−</button>
              <span style={{ width: 32, textAlign: 'center' as const, fontSize: 14 }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.6)', width: 36, height: 44, cursor: 'pointer', fontSize: 18 }}>+</button>
            </div>
          </div>

          {/* Boutons action */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleAddToCart}
              disabled={!disponible}
              style={{
                flex: 1, padding: '14px 20px',
                background: addedToCart ? '#d4e9d4' : disponible ? accent : '#333',
                color: addedToCart ? '#2a8a2a' : disponible ? '#ffffff' : '#888',
                border: 'none', borderRadius: 3, fontSize: 11, letterSpacing: 2,
                textTransform: 'uppercase' as const, cursor: disponible ? 'pointer' : 'not-allowed',
                fontWeight: 500, transition: 'all 0.2s',
              }}
            >
              {addedToCart ? '✓ Ajouté au panier' : !disponible ? 'Rupture de stock' : 'Ajouter au panier'}
            </button>
            <button style={{
              background: 'transparent', border: '0.5px solid rgba(0,0,0,0.2)',
              color: 'rgba(0,0,0,0.6)', borderRadius: 3, padding: '14px 16px', cursor: 'pointer', fontSize: 16,
            }}>♡</button>
          </div>

          {/* Alerte retour de stock (seulement si rupture totale boutique + retrait) */}
          {!disponible && stockCaveGilbert === 0 && stockPetiteCave === 0 && (
            <div style={{ marginTop: 12 }}>
              {!showStockAlert && !alertSent && (
                <button onClick={() => setShowStockAlert(true)} style={{
                  width: '100%', padding: '12px 16px',
                  background: 'rgba(138,106,62,0.06)', border: '0.5px solid rgba(138,106,62,0.3)',
                  color: '#8a6a3e', borderRadius: 3, fontSize: 12, letterSpacing: 1,
                  cursor: 'pointer', fontWeight: 500,
                }}>
                  ✉ Me prévenir quand ce vin revient en stock
                </button>
              )}
              {showStockAlert && !alertSent && (
                <div style={{ padding: '14px', background: 'rgba(138,106,62,0.06)', border: '0.5px solid rgba(138,106,62,0.3)', borderRadius: 3 }}>
                  <div style={{ fontSize: 11, color: '#8a6a3e', marginBottom: 8, letterSpacing: 0.5 }}>Laisse ton email, on te prévient dès qu'il revient.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)}
                      placeholder="ton@email.fr"
                      style={{ flex: 1, background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 3, padding: '10px 12px', fontSize: 13, color: '#1a1a1a' }}
                    />
                    <button onClick={handleStockAlert} disabled={alertSending} style={{
                      background: alertSending ? '#ccc' : '#8a6a3e', color: '#fff', border: 'none',
                      padding: '10px 18px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' as const,
                      cursor: alertSending ? 'wait' : 'pointer', borderRadius: 3, fontWeight: 600, whiteSpace: 'nowrap' as const,
                    }}>
                      {alertSending ? '⟳' : 'M\'inscrire'}
                    </button>
                  </div>
                  {alertError && <div style={{ fontSize: 11, color: '#a04444', marginTop: 8 }}>{alertError}</div>}
                </div>
              )}
              {alertSent && (
                <div style={{ padding: '14px', background: '#d4e9d4', border: '0.5px solid rgba(42,138,42,0.3)', borderRadius: 3, fontSize: 12, color: '#2a8a2a', textAlign: 'center' as const }}>
                  ✓ Parfait, on t'écrira à <strong>{alertEmail}</strong> dès le retour en stock.
                </div>
              )}
            </div>
          )}

          {/* Retrait en cave */}
          {(stockCaveGilbert > 0 || stockPetiteCave > 0) && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(110,201,176,0.05)', border: '0.5px solid rgba(110,201,176,0.2)', borderRadius: 3 }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(110,201,176,0.7)', textTransform: 'uppercase' as const, marginBottom: 6 }}>⚡ Retrait sous 2 h disponible</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                {stockCaveGilbert > 0 && (
                  <div style={{ fontSize: 12, color: '#1a1a1a' }}>
                    <span style={{ color: '#2a8a73' }}>●</span> Cave de Gilbert · Marcy-l'Étoile{isPro && <span style={{ color: 'rgba(0,0,0,0.5)', marginLeft: 6 }}>{stockCaveGilbert} bouteille{stockCaveGilbert > 1 ? 's' : ''}</span>}
                  </div>
                )}
                {stockPetiteCave > 0 && (
                  <div style={{ fontSize: 12, color: '#1a1a1a' }}>
                    <span style={{ color: '#2a8a73' }}>●</span> La Petite Cave · L'Arbresle{isPro && <span style={{ color: 'rgba(0,0,0,0.5)', marginLeft: 6 }}>{stockPetiteCave} bouteille{stockPetiteCave > 1 ? 's' : ''}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Livraison */}
          <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(0,0,0,0.4)', display: 'flex', gap: 20 }}>
            <span>🚚 Livraison gratuite dès 150€</span>
            <span>📦 Expédition sous 24h</span>
          </div>
        </div>
      </div>

      {/* ── PRODUITS SIMILAIRES ── */}
      {similaires.length > 0 && (
        <div style={{ padding: '48px 40px', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 300, color: '#0a0a0a', marginBottom: 32, textAlign: 'center' as const }}>
            Dans le même esprit
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
            {similaires.map(p => (
              <a key={p.id} href={`/boutique/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#f5f1ea', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden', textAlign: 'center' as const, transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column' as const, height: '100%' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)')}
                >
                  <div style={{ height: 200, background: '#fbfaf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.nom} style={{ maxHeight: 180, maxWidth: '80%', objectFit: 'contain' as const }} />
                    ) : (
                      <div style={{ fontSize: 48, opacity: 0.15, color: COULEUR_ACCENT[p.couleur] || '#8a6a3e' }}>🍷</div>
                    )}
                  </div>
                  <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column' as const, flex: 1 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: COULEUR_ACCENT[p.couleur] || '#8a6a3e', textTransform: 'uppercase' as const, marginBottom: 8 }}>
                      {COULEUR_LABEL[p.couleur] || p.couleur}
                    </div>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#0a0a0a', marginBottom: 4, lineHeight: 1.3, display: '-webkit-box' as const, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' as const }}>{p.nom}</div>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 12 }}>{p.domaine}{p.millesime ? ` · ${p.millesime}` : ''}</div>
                    <div style={{ fontSize: 18, color: '#8a6a3e', fontFamily: 'Georgia, serif', marginTop: 'auto' as const }}>{p.prix_vente_ttc?.toFixed(2)}€</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ padding: '32px 40px', borderTop: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#8a6a3e', letterSpacing: 3, textTransform: 'uppercase' as const }}>Cave de Gilbert</div>
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>La vente d'alcool aux mineurs est interdite</div>
      </footer>
    </div>
  )
}
