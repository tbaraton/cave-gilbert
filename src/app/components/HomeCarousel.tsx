'use client'

import { useState, useEffect, useRef } from 'react'

interface Slide {
  id: string
  titre: string
  sous_titre?: string | null
  description?: string | null
  image_url?: string | null
  couleur_bg?: string | null
  couleur_texte?: string
  position_texte?: 'gauche' | 'centre' | 'droite'
  slug: string
  cta_label?: string
  cta_url_custom?: string | null
}

export function HomeCarousel({ slides, autoPlayMs = 6000 }: { slides: Slide[]; autoPlayMs?: number }) {
  const [idx, setIdx] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (slides.length <= 1 || paused) return
    timerRef.current = setTimeout(() => setIdx(i => (i + 1) % slides.length), autoPlayMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [idx, slides.length, autoPlayMs, paused])

  if (!slides || slides.length === 0) return null

  const goTo = (i: number) => setIdx(((i % slides.length) + slides.length) % slides.length)

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ position: 'relative', width: '100%', height: 260, overflow: 'hidden', background: '#0d0a08' }}
    >
      {/* Slides empilées : toute la slide est un lien cliquable vers /boutique?operation=<slug> */}
      {slides.map((s, i) => {
        const href = s.cta_url_custom || `/boutique?operation=${s.slug}`
        return (
          <a
            key={s.id}
            href={href}
            aria-label={s.titre}
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: s.couleur_bg || '#1a1a1a',
              backgroundImage: s.image_url ? `url(${s.image_url})` : 'none',
              // contain = image entière toujours visible (pas de crop). Du fond
              // coloré apparaît sur les côtés si le ratio ne correspond pas.
              backgroundSize: 'contain', backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: i === idx ? 1 : 0,
              transition: 'opacity 0.7s ease',
              pointerEvents: i === idx ? 'auto' : 'none',
              display: 'block',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          />
        )
      })}

      {/* Flèches navigation (au-dessus du lien, stopPropagation pour ne pas déclencher le clic slide) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(idx - 1) }}
            aria-label="Précédent" style={arrowStyle('left')}
          >‹</button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(idx + 1) }}
            aria-label="Suivant" style={arrowStyle('right')}
          >›</button>
        </>
      )}

      {/* Dots indicateurs */}
      {slides.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 14, left: 0, right: 0, zIndex: 3,
          display: 'flex', justifyContent: 'center', gap: 8,
        }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(i) }}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: i === idx ? 24 : 8, height: 8, borderRadius: 4,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 'none', padding: 0, cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%', transform: 'translateY(-50%)',
    [side]: 20,
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(0,0,0,0.35)', color: '#fff', border: '0.5px solid rgba(255,255,255,0.3)',
    fontSize: 26, lineHeight: 1, cursor: 'pointer', zIndex: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  } as React.CSSProperties
}
