'use client'
import { useState } from 'react'

export default function TestPage() {
  const [count, setCount] = useState(0)
  const [msg, setMsg] = useState('')

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', background: '#111', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ color: '#c9a96e' }}>Test iPad</h1>

      <p style={{ marginBottom: 20, color: '#888' }}>Si tu vois ce texte, le HTML s'affiche. Teste les boutons :</p>

      {/* Test 1 : button simple */}
      <button
        onClick={() => setMsg('✅ onClick fonctionne !')}
        style={{ display: 'block', width: '100%', padding: 20, fontSize: 20, background: '#c9a96e', border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 16, color: '#000' }}
      >
        Test 1 — onClick
      </button>

      {/* Test 2 : lien */}
      <a
        href="#"
        onClick={e => { e.preventDefault(); setMsg('✅ onClick sur <a> fonctionne !') }}
        style={{ display: 'block', width: '100%', padding: 20, fontSize: 20, background: '#4a9e6e', borderRadius: 10, cursor: 'pointer', marginBottom: 16, color: '#fff', textAlign: 'center', textDecoration: 'none' }}
      >
        Test 2 — &lt;a href&gt;
      </a>

      {/* Test 3 : alert natif */}
      <button
        onClick={() => alert('alert() fonctionne !')}
        style={{ display: 'block', width: '100%', padding: 20, fontSize: 20, background: '#4a6e9e', border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 16, color: '#fff' }}
      >
        Test 3 — alert()
      </button>

      {/* Compteur */}
      <button
        onClick={() => setCount(c => c + 1)}
        style={{ display: 'block', width: '100%', padding: 20, fontSize: 20, background: '#6e4a9e', border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 24, color: '#fff' }}
      >
        Test 4 — Compteur : {count}
      </button>

      {msg && (
        <div style={{ padding: 20, background: '#1a3a1a', border: '2px solid #6ec96e', borderRadius: 10, fontSize: 20, color: '#6ec96e' }}>
          {msg}
        </div>
      )}

      {!msg && count === 0 && (
        <div style={{ padding: 20, background: '#3a1a1a', border: '2px solid #c96e6e', borderRadius: 10, fontSize: 16, color: '#c96e6e' }}>
          ❌ Aucun bouton n'a encore répondu
        </div>
      )}
    </div>
  )
}