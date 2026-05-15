'use client'

import { useEffect } from 'react'

export default function TestPage() {
  useEffect(() => {
    // Charger Eruda (console mobile) pour voir les erreurs JS
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/eruda'
    script.onload = () => { (window as any).eruda.init() }
    document.head.appendChild(script)
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ color: '#c9a96e' }}>Diagnostic</h1>
      <p style={{ color: '#888', fontSize: 18, lineHeight: 1.6 }}>
        Un bouton rond devrait apparaître en bas à droite de l'écran.<br/>
        Appuie dessus → onglet "Console" → cherche les erreurs en rouge.
      </p>
      <p style={{ color: '#6ec96e', marginTop: 20, fontSize: 16 }}>
        Si tu ne vois aucun bouton rond, le JS React ne s'est pas chargé.
      </p>
    </div>
  )
}