'use client'

// ============================================================
// Macaron — pastille visuelle affichée à gauche d'une fiche produit
// Utilisé par : boutique (ProductCard + ProductPageClient) et admin/eboutique
// ============================================================

export interface BadgeData {
  id?: string
  nom: string
  description?: string
  mode?: 'genere' | 'image' | null
  image_url?: string | null
  icone?: string | null
  texte_macaron?: string | null
  couleur_bg?: string | null
  couleur_fg?: string | null
  couleur_border?: string | null
}

export function Macaron({ badge, size = 60 }: { badge: BadgeData; size?: number }) {
  if (badge.mode === 'image' && badge.image_url) {
    return (
      <img
        src={badge.image_url}
        alt={badge.nom || ''}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))' }}
      />
    )
  }
  const iconSize = Math.round(size * 0.32)
  const textSize = Math.max(7, Math.round(size * 0.12))
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: badge.couleur_bg || '#8a6a3e',
      color: badge.couleur_fg || '#ffffff',
      border: badge.couleur_border ? `2px solid ${badge.couleur_border}` : 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)', flexShrink: 0,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      userSelect: 'none',
    }}>
      {badge.icone && <span style={{ fontSize: iconSize, lineHeight: 1 }}>{badge.icone}</span>}
      {badge.texte_macaron && (
        <span style={{
          fontSize: textSize, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.1,
          marginTop: badge.icone ? 2 : 0, textAlign: 'center', padding: '0 4px',
        }}>
          {badge.texte_macaron}
        </span>
      )}
    </div>
  )
}

// ── Stack de macarons avec tooltip au survol ────────────────
// À placer en absolute positioning au-dessus de la photo bouteille.
export function MacaronStack({ badges, size = 48, gap = 8 }: { badges: BadgeData[]; size?: number; gap?: number }) {
  if (!badges || badges.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, pointerEvents: 'none' }}>
      {badges.map((b, i) => (
        <div key={b.id || i} style={{ position: 'relative', pointerEvents: 'auto' }} className="macaron-wrap">
          <Macaron badge={b} size={size} />
          {b.description && (
            <div className="macaron-tooltip" style={{
              position: 'absolute', left: size + 10, top: '50%', transform: 'translateY(-50%)',
              background: '#1a1a1a', color: '#fff', padding: '8px 12px', borderRadius: 4,
              fontSize: 11, lineHeight: 1.4, whiteSpace: 'normal', width: 200,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)', opacity: 0, visibility: 'hidden',
              transition: 'opacity 0.15s, visibility 0.15s', pointerEvents: 'none', zIndex: 50,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 12 }}>{b.nom}</div>
              <div style={{ opacity: 0.85 }}>{b.description}</div>
              {/* Petite flèche pointant vers le macaron */}
              <div style={{
                position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%) rotate(45deg)',
                width: 10, height: 10, background: '#1a1a1a',
              }} />
            </div>
          )}
        </div>
      ))}
      <style>{`.macaron-wrap:hover .macaron-tooltip { opacity: 1; visibility: visible; }`}</style>
    </div>
  )
}
