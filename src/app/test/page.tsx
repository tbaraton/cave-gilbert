'use client'
import { useState } from 'react'

export default function TestPage() {
  const [count, setCount] = useState(0)
  const [msg, setMsg] = useState('')

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ color: '#c9a96e' }}>Test React iPad</h1>
      <p style={{ color: '#888', marginBottom: 20 }}>Tape sur chaque bouton :</p>

      <button onClick={() => setMsg('✅ React onClick fonctionne !')}
        style={{ display: 'block', width: '100%', padding: 24, fontSize: 22, background: '#c9a96e', border: 'none', borderRadius: 12, cursor: 'pointer', marginBottom: 16, color: '#000', fontWeight: 700 }}>
        Test 1 — onClick React
      </button>

      <button onClick={() => setCount(c => c + 1)}
        style={{ display: 'block', width: '100%', padding: 24, fontSize: 22, background: '#6e4a9e', border: 'none', borderRadius: 12, cursor: 'pointer', marginBottom: 24, color: '#fff', fontWeight: 700 }}>
        Compteur : {count}
      </button>

      {msg && (
        <div style={{ padding: 20, background: '#1a3a1a', border: '2px solid #6ec96e', borderRadius: 10, fontSize: 20, color: '#6ec96e', marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {count === 0 && !msg && (
        <div style={{ padding: 20, background: '#3a1a1a', border: '2px solid #c96e6e', borderRadius: 10, fontSize: 16, color: '#c96e6e' }}>
          ❌ Aucun bouton n'a répondu
        </div>
      )}

      <div style={{ marginTop: 32, padding: 16, background: '#1a1a1a', borderRadius: 8, fontSize: 13, color: '#666' }}>
        <div>Page rendue par le serveur ✓</div>
        <div>React hydraté côté client : {count > 0 || msg ? '✅ OUI' : '❓ à confirmer'}</div>
      </div>
    </div>
  )
}