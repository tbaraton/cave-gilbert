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
  const slide = slides[idx]
  const href = slide.cta_url_custom || `/boutique?operation=${slide.slug}`
  const align = slide.position_texte === 'centre' ? 'center' : slide.position_texte === 'droite' ? 'flex-end' : 'flex-start'
  const textAlign = slide.position_texte === 'centre' ? 'center' : slide.position_texte === 'droite' ? 'right' : 'left'

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ position: 'relative', width: '100%', minHeight: 480, overflow: 'hidden', background: '#0d0a08' }}
    >
      {/* Slides empilées en absolute pour transition douce */}
      {slides.map((s, i) => (
        <div key={s.id} style={{
          position: 'absolute', inset: 0,
          backgroundColor: s.couleur_bg || '#1a1a1a',
          backgroundImage: s.image_url ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.45)), url(${s.image_url})` : 'none',
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: i === idx ? 1 : 0,
          transition: 'opacity 0.7s ease',
          pointerEvents: i === idx ? 'auto' : 'none',
        }} />
      ))}

      {/* Contenu de la slide active */}
      <div style={{
        position: 'relative', zIndex: 2, minHeight: 480,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align,
        padding: '60px 80px', maxWidth: 1400, margin: '0 auto',
        color: slide.couleur_texte || '#fff', textAlign: textAlign as any,
      }}>
        <div style={{ maxWidth: 520 }}>
          {slide.sous_titre && (
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.85, marginBottom: 14, fontWeight: 500 }}>
              {slide.sous_titre}
            </div>
          )}
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 48, fontWeight: 300, lineHeight: 1.1, marginBottom: 18, margin: 0 }}>
            {slide.titre}
          </h1>
          {slide.description && (
            <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.9, marginTop: 18, marginBottom: 26 }}>
              {slide.description}
            </p>
          )}
          <a href={href} style={{
            display: 'inline-block', padding: '14px 32px', background: '#c9a96e', color: '#0d0a08',
            textDecoration: 'none', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
            fontWeight: 700, borderRadius: 3, marginTop: slide.description ? 0 : 24,
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#d8b87d'}
            onMouseLeave={e => e.currentTarget.style.background = '#c9a96e'}
          >
            {slide.cta_label || 'Découvrir'} →
          </a>
        </div>
      </div>

      {/* Flèches navigation */}
      {slides.length > 1 && (
        <>
          <button onClick={() => goTo(idx - 1)} aria-label="Précédent" style={arrowStyle('left')}>‹</button>
          <button onClick={() => goTo(idx + 1)} aria-label="Suivant" style={arrowStyle('right')}>›</button>
        </>
      )}

      {/* Dots indicateurs */}
      {slides.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0, zIndex: 3,
          display: 'flex', justifyContent: 'center', gap: 8,
        }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} style={{
              width: i === idx ? 24 : 8, height: 8, borderRadius: 4,
              background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none', padding: 0, cursor: 'pointer',
              transition: 'all 0.3s ease',
            }} />
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
