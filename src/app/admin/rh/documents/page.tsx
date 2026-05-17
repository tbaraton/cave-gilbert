'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// Client sans gestion de session → pas de lock browser qui hangue
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
)

type User = { id: string; prenom: string; nom: string; role: string; pin: string }
type Document = {
  id: string; user_id: string; type: string; nom: string; periode: string
  fichier_base64: string; analyse_ia: any; analyse_statut: string
  uploaded_by: string; created_at: string
  user_prenom?: string; user_nom?: string
}

const TYPE_DOC = {
  fiche_paie:   { label: 'Fiche de paie',  color: '#c9a96e', icon: '💶' },
  contrat:      { label: 'Contrat',         color: '#6e9ec9', icon: '📄' },
  avenant:      { label: 'Avenant',         color: '#8ec98e', icon: '✏' },
  attestation:  { label: 'Attestation',     color: '#b06ec9', icon: '📋' },
  arret_maladie:{ label: 'Arrêt maladie',   color: '#c96e6e', icon: '🏥' },
  autre:        { label: 'Autre',           color: '#888',    icon: '📎' },
}

const STATUT_ANALYSE = {
  non_analyse: { label: 'Non analysé',   color: '#888',    bg: 'rgba(128,128,128,0.1)' },
  en_cours:    { label: 'Analyse...',     color: '#c9b06e', bg: 'rgba(201,176,110,0.1)' },
  ok:          { label: 'Conforme ✓',    color: '#6ec96e', bg: 'rgba(110,201,110,0.1)' },
  anomalies:   { label: 'Anomalies ⚠',  color: '#c96e6e', bg: 'rgba(201,110,110,0.1)' },
  erreur:      { label: 'Erreur',        color: '#c96e6e', bg: 'rgba(201,110,110,0.08)' },
}

function formatDate(iso: string) { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }

// ── Login ────────────────────────────────────────────────────
function EcranLogin({ onLogin }: { onLogin: (u: User) => void }) {
  const [prenom, setPrenom] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const doLogin = async (p = pin) => {
    const { data } = await supabase.from('users').select('*').ilike('prenom', prenom.trim()).eq('actif', true).maybeSingle()
    if (!data || data.pin !== p) { setError('Identifiants incorrects'); setPin(''); return }
    onLogin(data)
  }
  const handleKey = (k: string) => {
    if (k === '←') { setPin(p => p.slice(0,-1)); return }
    if (pin.length >= 4) return
    const np = pin + k; setPin(np)
    if (np.length === 4) setTimeout(() => doLogin(np), 50)
  }
  return (
    <div style={{ minHeight: '100dvh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 32 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e', letterSpacing: 3 }}>Documents RH</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginTop: 6 }}>Accès sécurisé</div>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.15)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#c96e6e', textAlign: 'center' as const }}>{error}</div>}
        <input type="text" placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} autoCapitalize="words" style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#f0e8d8', fontSize: 16, padding: '14px', width: '100%', boxSizing: 'border-box' as const, marginBottom: 20, textAlign: 'center' as const }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: i < pin.length ? '#c9a96e' : 'rgba(255,255,255,0.12)' }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {['1','2','3','4','5','6','7','8','9','←','0','✓'].map(k => (
            <button key={k} onClick={() => k === '✓' ? doLogin() : handleKey(k)} style={{ background: k === '✓' ? '#c9a96e' : 'rgba(255,255,255,0.07)', border: `1px solid ${k === '✓' ? '#c9a96e' : 'rgba(255,255,255,0.1)'}`, color: k === '✓' ? '#0d0a08' : '#e8e0d5', borderRadius: 10, padding: '17px 0', fontSize: 19, cursor: 'pointer', fontWeight: k === '✓' ? 700 : 400 }}>{k}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Vue Admin documents ───────────────────────────────────────
function VueDocumentsAdmin({ admin }: { admin: User }) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [employes, setEmployes] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analysing, setAnalysing] = useState<string | null>(null)
  const [filterEmploye, setFilterEmploye] = useState('')
  const [filterType, setFilterType] = useState('')
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [form, setForm] = useState({ user_id: '', type: 'fiche_paie', nom: '', periode: '' })
  const [showUpload, setShowUpload] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const inp = { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e0d5', fontSize: 13, padding: '10px 12px', width: '100%', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: users }, { data: docs }] = await Promise.all([
      supabase.from('users').select('id, prenom, nom, role').eq('actif', true).in('role', ['responsable', 'vendeur', 'caviste']),
      supabase.from('rh_documents').select('*').order('created_at', { ascending: false }),
    ])
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]))
    setEmployes(users || [])
    setDocuments((docs || []).map(d => ({ ...d, user_prenom: userMap[d.user_id]?.prenom, user_nom: userMap[d.user_id]?.nom })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleFileUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !form.user_id || !form.nom) return
    setUploading(true)
    const base64 = await new Promise<string>(res => {
      const reader = new FileReader()
      reader.onload = () => res((reader.result as string).split(',')[1])
      reader.readAsDataURL(file)
    })
    await supabase.from('rh_documents').insert({
      user_id: form.user_id, type: form.type, nom: form.nom,
      periode: form.periode || null, fichier_base64: base64,
      analyse_statut: 'non_analyse', uploaded_by: admin.id,
    })
    setForm({ user_id: '', type: 'fiche_paie', nom: '', periode: '' })
    if (fileRef.current) fileRef.current.value = ''
    setShowUpload(false); setUploading(false); load()
  }

  const handleAnalyse = async (doc: Document) => {
    if (!doc.fichier_base64) return
    setAnalysing(doc.id)
    await supabase.from('rh_documents').update({ analyse_statut: 'en_cours' }).eq('id', doc.id)
    try {
      const response = await fetch('/api/analyser-paie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichierBase64: doc.fichier_base64, nom: doc.nom, periode: doc.periode }),
      })
      if (!response.ok) throw new Error(`Erreur serveur ${response.status}`)
      const analyse = await response.json()
      if (analyse.error) throw new Error(analyse.error)
      await supabase.from('rh_documents').update({
        analyse_ia: analyse,
        analyse_statut: analyse.statut === 'ok' ? 'ok' : 'anomalies'
      }).eq('id', doc.id)
    } catch (e: any) {
      await supabase.from('rh_documents').update({
        analyse_statut: 'erreur',
        analyse_ia: { erreur: String(e?.message || e) }
      }).eq('id', doc.id)
    }
    setAnalysing(null)
    load()
    if (detailDoc?.id === doc.id) {
      const { data: updated } = await supabase.from('rh_documents').select('*').eq('id', doc.id).single()
      if (updated) setDetailDoc({ ...updated, user_prenom: doc.user_prenom, user_nom: doc.user_nom })
    }
  }

  const filtered = documents.filter(d => (!filterEmploye || d.user_id === filterEmploye) && (!filterType || d.type === filterType))
  const anomaliesCount = documents.filter(d => d.analyse_statut === 'anomalies').length

  if (detailDoc) return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <div style={{ padding: '14px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => setDetailDoc(null)} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ fontSize: 13, color: '#f0e8d8', fontWeight: 600 }}>{detailDoc.nom}</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{detailDoc.user_prenom} {detailDoc.user_nom} · {detailDoc.periode}</div>
        </div>
      </div>
      <div style={{ padding: '24px 32px', maxWidth: 860, margin: '0 auto' }}>
        {/* Statut */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div style={{ background: STATUT_ANALYSE[detailDoc.analyse_statut as keyof typeof STATUT_ANALYSE]?.bg, border: `0.5px solid ${STATUT_ANALYSE[detailDoc.analyse_statut as keyof typeof STATUT_ANALYSE]?.color}40`, borderRadius: 6, padding: '10px 18px', fontSize: 14, color: STATUT_ANALYSE[detailDoc.analyse_statut as keyof typeof STATUT_ANALYSE]?.color, fontWeight: 600 }}>
            {STATUT_ANALYSE[detailDoc.analyse_statut as keyof typeof STATUT_ANALYSE]?.label}
          </div>
          {detailDoc.analyse_statut === 'non_analyse' && (
            <button onClick={() => handleAnalyse(detailDoc)} disabled={!!analysing} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              ✦ Analyser avec Claude IA
            </button>
          )}
          {detailDoc.analyse_statut !== 'non_analyse' && (
            <button onClick={() => handleAnalyse(detailDoc)} disabled={!!analysing} style={{ background: 'transparent', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 6, padding: '10px 16px', fontSize: 12, cursor: 'pointer' }}>
              ↻ Relancer l'analyse
            </button>
          )}
          {detailDoc.fichier_base64 && (
            <button onClick={() => { const a = document.createElement('a'); a.href = `data:application/pdf;base64,${detailDoc.fichier_base64}`; a.download = detailDoc.nom + '.pdf'; a.click() }}
              style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 6, padding: '10px 16px', fontSize: 12, cursor: 'pointer' }}>
              ↓ Télécharger PDF
            </button>
          )}
        </div>

        {/* Résultats analyse */}
        {detailDoc.analyse_ia && (
          <>
            {detailDoc.analyse_ia.resume && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '16px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>RÉSUMÉ IA</div>
                <div style={{ fontSize: 14, color: '#f0e8d8', lineHeight: 1.7 }}>{detailDoc.analyse_ia.resume}</div>
              </div>
            )}

            {/* Anomalies */}
            {detailDoc.analyse_ia.anomalies?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c96e6e', marginBottom: 10 }}>ANOMALIES DÉTECTÉES ({detailDoc.analyse_ia.anomalies.length})</div>
                {detailDoc.analyse_ia.anomalies.map((a: any, i: number) => (
                  <div key={i} style={{ background: a.gravite === 'critique' ? 'rgba(201,110,110,0.08)' : a.gravite === 'importante' ? 'rgba(201,176,110,0.06)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${a.gravite === 'critique' ? 'rgba(201,110,110,0.3)' : a.gravite === 'importante' ? 'rgba(201,176,110,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, padding: '14px 18px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ background: a.gravite === 'critique' ? 'rgba(201,110,110,0.2)' : a.gravite === 'importante' ? 'rgba(201,176,110,0.2)' : 'rgba(255,255,255,0.06)', color: a.gravite === 'critique' ? '#c96e6e' : a.gravite === 'importante' ? '#c9b06e' : '#888', fontSize: 10, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{a.gravite}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#f0e8d8', marginBottom: 4 }}>{a.description}</div>
                    {a.reference_legale && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', fontStyle: 'italic' }}>Réf : {a.reference_legale}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Mentions obligatoires */}
            {detailDoc.analyse_ia.mentions_obligatoires && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'rgba(110,201,110,0.05)', border: '0.5px solid rgba(110,201,110,0.15)', borderRadius: 6, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#6ec96e', marginBottom: 10 }}>PRÉSENTES ✓</div>
                  {(detailDoc.analyse_ia.mentions_obligatoires.presentes || []).map((m: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'rgba(232,224,213,0.6)', marginBottom: 4 }}>✓ {m}</div>
                  ))}
                </div>
                <div style={{ background: 'rgba(201,110,110,0.05)', border: '0.5px solid rgba(201,110,110,0.15)', borderRadius: 6, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c96e6e', marginBottom: 10 }}>MANQUANTES ✗</div>
                  {(detailDoc.analyse_ia.mentions_obligatoires.manquantes || []).length === 0
                    ? <div style={{ fontSize: 12, color: '#6ec96e' }}>Aucune mention manquante</div>
                    : (detailDoc.analyse_ia.mentions_obligatoires.manquantes || []).map((m: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: '#c96e6e', marginBottom: 4 }}>✗ {m}</div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Éléments vérifiés */}
            {detailDoc.analyse_ia.elements_verifies?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', marginBottom: 10 }}>ÉLÉMENTS VÉRIFIÉS</div>
                <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                    <tbody>
                      {detailDoc.analyse_ia.elements_verifies.map((e: any, i: number) => (
                        <tr key={i} style={{ borderBottom: i < detailDoc.analyse_ia.elements_verifies.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <td style={{ padding: '10px 14px', width: 20 }}><span style={{ color: e.ok ? '#6ec96e' : '#c96e6e' }}>{e.ok ? '✓' : '✗'}</span></td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: '#f0e8d8' }}>{e.element}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{e.valeur}</td>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: 'rgba(232,224,213,0.4)' }}>{e.commentaire}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>Documents RH</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{documents.length} document{documents.length > 1 ? 's' : ''} · {anomaliesCount > 0 ? `${anomaliesCount} anomalie${anomaliesCount > 1 ? 's' : ''} détectée${anomaliesCount > 1 ? 's' : ''}` : 'aucune anomalie'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {anomaliesCount > 0 && <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#c96e6e' }}>⚠ {anomaliesCount} anomalie{anomaliesCount > 1 ? 's' : ''}</div>}
          <button onClick={() => setShowUpload(v => !v)} style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4, padding: '9px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Déposer un document</button>
          <a href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(232,224,213,0.6)', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 14px' }}>← Retour admin</a>
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
        {/* Upload */}
        {showUpload && (
          <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, padding: '22px 26px', marginBottom: 24 }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#f0e8d8', marginBottom: 18 }}>Déposer un document</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Salarié</label>
                <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} style={{ ...inp, background: '#1a1408' }}>
                  <option value="">Choisir...</option>
                  {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Type de document</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={{ ...inp, background: '#1a1408' }}>
                  {Object.entries(TYPE_DOC).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Nom du document</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Fiche de paie Mars 2025" style={inp} />
              </div>
              <div>
                <label style={lbl}>Période (optionnel)</label>
                <input type="month" value={form.periode} onChange={e => setForm(f => ({ ...f, periode: e.target.value }))} style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Fichier PDF</label>
              <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ ...inp, padding: '8px', cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowUpload(false)} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '10px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleFileUpload} disabled={uploading || !form.user_id || !form.nom} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '10px', fontSize: 13, cursor: 'pointer', fontWeight: 600, opacity: uploading ? 0.7 : 1 }}>
                {uploading ? '⟳ Envoi...' : '✓ Déposer'}
              </button>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <select value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 12, padding: '8px 12px', cursor: 'pointer' }}>
            <option value="">Tous les salariés</option>
            {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e8e0d5', fontSize: 12, padding: '8px 12px', cursor: 'pointer' }}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_DOC).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginLeft: 'auto' }}>{filtered.length} document{filtered.length > 1 ? 's' : ''}</span>
        </div>

        {/* Liste */}
        {loading ? <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
          : filtered.length === 0 ? <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: 48, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)' }}>Aucun document déposé.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {filtered.map(doc => {
                const typeInfo = TYPE_DOC[doc.type as keyof typeof TYPE_DOC] || TYPE_DOC.autre
                const statutInfo = STATUT_ANALYSE[doc.analyse_statut as keyof typeof STATUT_ANALYSE] || STATUT_ANALYSE.non_analyse
                const isAnalysing = analysing === doc.id
                return (
                  <div key={doc.id} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                    onClick={() => setDetailDoc(doc)}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.25)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}>
                    <div style={{ fontSize: 24, flexShrink: 0 }}>{typeInfo.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, color: '#f0e8d8', fontWeight: 600 }}>{doc.nom}</span>
                        <span style={{ background: `${typeInfo.color}22`, color: typeInfo.color, fontSize: 10, padding: '2px 8px', borderRadius: 3 }}>{typeInfo.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.45)' }}>
                        {doc.user_prenom} {doc.user_nom}
                        {doc.periode && ` · ${doc.periode}`}
                        {` · Déposé le ${formatDate(doc.created_at)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ background: statutInfo.bg, color: statutInfo.color, fontSize: 11, padding: '4px 10px', borderRadius: 4 }}>
                        {isAnalysing ? '⟳ Analyse...' : statutInfo.label}
                      </div>
                      {doc.type === 'fiche_paie' && doc.analyse_statut === 'non_analyse' && !isAnalysing && (
                        <button onClick={e => { e.stopPropagation(); handleAnalyse(doc) }}
                          style={{ background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>
                          ✦ Analyser
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}

// ── Vue Employé documents ─────────────────────────────────────
function VueDocumentsEmploye({ user }: { user: User }) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('rh_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setDocuments(data || []); setLoading(false)
    })()
  }, [])

  if (detailDoc) return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={() => setDetailDoc(null)} style={{ background: 'transparent', border: 'none', color: '#c9a96e', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 14, color: '#f0e8d8' }}>{detailDoc.nom}</div>
      </div>
      <div style={{ padding: '24px 20px' }}>
        <button onClick={() => { const a = document.createElement('a'); a.href = `data:application/pdf;base64,${detailDoc.fichier_base64}`; a.download = detailDoc.nom + '.pdf'; a.click() }}
          style={{ background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, cursor: 'pointer', fontWeight: 700, marginBottom: 20, display: 'block', width: '100%', textAlign: 'center' as const }}>
          ↓ Télécharger le PDF
        </button>
        <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)', textAlign: 'center' as const }}>Conservez vos bulletins de paie sans limite de durée</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>Mes documents</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginTop: 2 }}>{user.prenom} · {documents.length} document{documents.length > 1 ? 's' : ''}</div>
        </div>
        <a href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(232,224,213,0.6)', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 14px' }}>← Retour</a>
      </div>
      <div style={{ padding: '20px' }}>
        {loading ? <div style={{ textAlign: 'center' as const, padding: 48, color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>
          : documents.length === 0 ? <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 40, textAlign: 'center' as const, color: 'rgba(232,224,213,0.4)' }}>Aucun document déposé pour le moment.</div>
          : documents.map(doc => {
            const typeInfo = TYPE_DOC[doc.type as keyof typeof TYPE_DOC] || TYPE_DOC.autre
            return (
              <div key={doc.id} onClick={() => setDetailDoc(doc)} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '16px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                <div style={{ fontSize: 22 }}>{typeInfo.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#f0e8d8', fontWeight: 600 }}>{doc.nom}</div>
                  <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>{typeInfo.label}{doc.periode ? ` · ${doc.periode}` : ''}</div>
                </div>
                <div style={{ fontSize: 18, color: 'rgba(232,224,213,0.3)' }}>›</div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────
export default function DocumentsRHPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { setLoading(false); return }
      const { data: profile } = await supabase
        .from('users').select('*').eq('auth_user_id', authUser.id).maybeSingle()
      if (profile) setUser(profile)
      setLoading(false)
    })()
  }, [])

  if (loading) return <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.3)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>⟳ Chargement...</div>
  if (!user) return <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.4)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>Profil introuvable. <a href="/login" style={{ color: '#c9a96e', marginLeft: 10 }}>Se reconnecter</a></div>

  if (user.role === 'admin') return <VueDocumentsAdmin admin={user} />
  return <VueDocumentsEmploye user={user} />
}