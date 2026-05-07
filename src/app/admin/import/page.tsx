'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// CAVE DE GILBERT — Import universel
// src/app/admin/import/page.tsx
// Produits · Clients · Fournisseurs
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ImportType = 'produits' | 'clients' | 'fournisseurs'
type Step = 'choose' | 'upload' | 'preview' | 'importing' | 'done'

type ImportResult = {
  nom: string
  statut: 'ok' | 'erreur' | 'ignoré'
  message: string
}

// ── Config par type d'import ─────────────────────────────────

const CONFIG: Record<ImportType, {
  label: string
  icon: string
  description: string
  colonnes: { col: string; desc: string; required?: boolean }[]
  exemple: string[][]
  apiRoute: string
  colRequired: string[]
}> = {
  produits: {
    label: 'Produits',
    icon: '⬥',
    description: 'Vins, spiritueux, bières',
    apiRoute: '/api/import/produits',
    colRequired: ['nom', 'prix_vente_ttc'],
    colonnes: [
      { col: 'nom', desc: 'Nom du vin', required: true },
      { col: 'couleur', desc: 'rouge / blanc / rosé / champagne / effervescent / spiritueux / autre', required: true },
      { col: 'prix_vente_ttc', desc: 'Prix en € TTC (ex: 22.50)', required: true },
      { col: 'domaine', desc: 'Nom du domaine / château' },
      { col: 'appellation', desc: 'Appellation AOC' },
      { col: 'millesime', desc: 'Année (ex: 2022)' },
      { col: 'cepages', desc: 'Séparés par | (ex: Gamay|Syrah)' },
      { col: 'alcool', desc: 'Taux en % (ex: 13.5)' },
      { col: 'prix_achat_ht', desc: 'Prix achat HT' },
      { col: 'bio', desc: 'oui ou non' },
      { col: 'description_courte', desc: 'Texte libre' },
      { col: 'stock', desc: 'Quantité initiale' },
    ],
    exemple: [
      ['Morgon', 'Jean Foillard', 'Morgon', '2022', 'rouge', 'Gamay', '13', '22', '12', 'non', '', '6'],
      ['Bollinger Special Cuvée', 'Bollinger', 'Champagne AOC', '', 'champagne', 'Pinot Noir|Chardonnay', '12', '65', '42', 'non', '', '24'],
    ],
  },
  clients: {
    label: 'Clients',
    icon: '◎',
    description: 'Base clients avec emails',
    apiRoute: '/api/import/clients',
    colRequired: [],
    colonnes: [
      { col: 'prenom', desc: 'Prénom' },
      { col: 'nom', desc: 'Nom de famille' },
      { col: 'email', desc: 'Adresse email (utilisée pour éviter les doublons)' },
      { col: 'telephone', desc: 'Numéro de téléphone' },
      { col: 'code_postal', desc: 'Code postal' },
      { col: 'ville', desc: 'Ville' },
      { col: 'newsletter', desc: 'oui ou non' },
    ],
    exemple: [
      ['Jean', 'Dupont', 'jean.dupont@email.com', '0612345678', '69001', 'Lyon', 'oui'],
      ['Marie', 'Martin', 'marie.martin@email.com', '', '75001', 'Paris', 'non'],
    ],
  },
  fournisseurs: {
    label: 'Fournisseurs',
    icon: '◈',
    description: 'Domaines et producteurs',
    apiRoute: '/api/import/fournisseurs',
    colRequired: ['nom'],
    colonnes: [
      { col: 'nom', desc: 'Raison sociale', required: true },
      { col: 'telephone', desc: 'Numéro de téléphone' },
      { col: 'code_postal', desc: 'Code postal' },
      { col: 'ville', desc: 'Ville' },
      { col: 'pays', desc: 'Pays (défaut: France)' },
      { col: 'email', desc: 'Email de contact' },
      { col: 'identifiant_origine', desc: 'ID dans votre ancien logiciel (référence)' },
    ],
    exemple: [
      ['Domaine Leflaive', '', '21190', 'Puligny-Montrachet', 'France', 'contact@leflaive.fr', ''],
      ['Bollinger', '', '51160', 'Aÿ', 'France', '', ''],
    ],
  },
}

// ── Parser CSV ───────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] || '' })
    return row
  })
  return { headers, rows }
}

// ── Télécharger modèle CSV ───────────────────────────────────

function downloadTemplate(type: ImportType) {
  const config = CONFIG[type]
  const headers = config.colonnes.map(c => c.col)
  const lines = [headers.join(';'), ...config.exemple.map(r => r.join(';'))]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `modele_import_${type}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Composants UI ────────────────────────────────────────────

function Btn({ children, onClick, variant = 'primary', disabled = false }: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
}) {
  const styles = {
    primary:   { background: '#c9a96e', color: '#0d0a08', border: 'none' },
    secondary: { background: 'transparent', color: 'rgba(232,224,213,0.5)', border: '0.5px solid rgba(255,255,255,0.15)' },
    ghost:     { background: 'transparent', color: '#c9a96e', border: '0.5px solid rgba(201,169,110,0.3)' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      borderRadius: 4, padding: '10px 20px', fontSize: 11, letterSpacing: 1.5,
      cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: variant === 'primary' ? 500 : 400,
      textTransform: 'uppercase' as const, opacity: disabled ? 0.5 : 1,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>{children}</button>
  )
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '20px', textAlign: 'center' as const, flex: 1 }}>
      <div style={{ fontSize: 32, color, fontFamily: 'Georgia, serif', fontWeight: 300 }}>{value}</div>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────

export default function ImportPage() {
  const [importType, setImportType] = useState<ImportType | null>(null)
  const [step, setStep] = useState<Step>('choose')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [results, setResults] = useState<{ importes: number; ignores: number; erreurs: number; details: ImportResult[] } | null>(null)
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('sites').select('*').eq('actif', true).order('nom').then(({ data }) => {
      setSites(data || [])
      if (data && data.length > 0) setSiteId(data[0].id)
    })
  }, [])

  const config = importType ? CONFIG[importType] : null

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      if (r.length === 0) { setError('Fichier vide ou format non reconnu'); return }

      // Vérifier colonnes requises
      const missing = (config?.colRequired || []).filter(c => !h.includes(c))
      if (missing.length > 0) {
        setError(`Colonnes manquantes : ${missing.join(', ')}. Utilisez le modèle fourni.`)
        return
      }
      setHeaders(h)
      setRows(r)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = async () => {
    if (!importType || !config) return
    setStep('importing')
    setProgress(0)

    try {
      // Envoyer en batches de 200 lignes max par appel API
      const CHUNK = 200
      let totalImportes = 0, totalIgnores = 0, totalErreurs = 0
      const allDetails: ImportResult[] = []

      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const body: any = { rows: chunk }
        if (importType === 'produits') body.site_id = siteId

        const res = await fetch(config.apiRoute, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erreur serveur')

        totalImportes += data.importes || 0
        totalIgnores += data.ignores || 0
        totalErreurs += data.erreurs || 0
        if (data.details) allDetails.push(...data.details)
        setProgress(Math.round(((i + CHUNK) / rows.length) * 100))
      }

      setResults({
        importes: totalImportes,
        ignores: totalIgnores,
        erreurs: totalErreurs,
        details: allDetails,
      })
      setStep('done')
    } catch (e: any) {
      setError(e.message)
      setStep('preview')
    }
  }

  const reset = () => {
    setStep('choose')
    setImportType(null)
    setRows([])
    setHeaders([])
    setResults(null)
    setError('')
    setProgress(0)
  }

  const card = { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '24px' } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <a href="/admin" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none', letterSpacing: 1, display: 'block', marginBottom: 12 }}>← Retour à l'admin</a>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Import de données</h1>
        <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Importez vos produits, clients et fournisseurs depuis un fichier CSV</p>
      </div>

      {/* Erreur globale */}
      {error && (
        <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 5, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#c96e6e' }}>
          {error}
        </div>
      )}

      {/* ── ÉTAPE 1 : Choisir le type ── */}
      {step === 'choose' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 800 }}>
          {(Object.entries(CONFIG) as [ImportType, typeof CONFIG[ImportType]][]).map(([type, cfg]) => (
            <button key={type} onClick={() => { setImportType(type); setStep('upload') }} style={{
              background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)',
              borderRadius: 8, padding: '28px 24px', cursor: 'pointer', textAlign: 'left' as const,
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.2)')}
            >
              <div style={{ fontSize: 24, color: '#c9a96e', marginBottom: 12 }}>{cfg.icon}</div>
              <div style={{ fontSize: 16, color: '#f0e8d8', fontFamily: 'Georgia, serif', fontWeight: 300, marginBottom: 4 }}>{cfg.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{cfg.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── ÉTAPE 2 : Upload ── */}
      {step === 'upload' && config && (
        <div style={{ maxWidth: 680 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 300, color: '#f0e8d8' }}>
              Import {config.label}
            </h2>
            <Btn variant="ghost" onClick={() => { if (importType) downloadTemplate(importType) }}>
              ↓ Télécharger le modèle
            </Btn>
          </div>

          {/* Zone drop */}
          <div onClick={() => fileRef.current?.click()} style={{
            ...card, border: '1px dashed rgba(201,169,110,0.3)',
            textAlign: 'center' as const, cursor: 'pointer', padding: '48px 32px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, color: '#c9a96e' }}>↑</div>
            <p style={{ fontSize: 14, color: '#c9a96e', marginBottom: 6 }}>Cliquez pour sélectionner votre fichier CSV</p>
            <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.3)' }}>
              Séparateur ; ou , · Encodage UTF-8
            </p>
            <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.2)', marginTop: 8 }}>
              Dans Excel : Fichier → Enregistrer sous → CSV UTF-8 (délimité par des points-virgules)
            </p>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {/* Description colonnes */}
          <div style={card}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 14 }}>Colonnes attendues</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 7 }}>
              {config.colonnes.map(({ col, desc, required }) => (
                <div key={col} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <code style={{ fontSize: 12, color: required ? '#c9a96e' : 'rgba(232,224,213,0.6)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' as const }}>
                    {col}{required ? ' *' : ''}
                  </code>
                  <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Btn variant="secondary" onClick={reset}>← Retour</Btn>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : Prévisualisation ── */}
      {step === 'preview' && config && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <StatCard value={rows.length} label="Lignes à importer" color="#c9a96e" />
            <StatCard value={rows.filter(r => (config.colRequired || []).every(c => r[c]?.trim())).length} label="Valides" color="#6ec96e" />
            <StatCard value={rows.filter(r => !(config.colRequired || []).every(c => r[c]?.trim())).length} label="Avec avertissement" color="#c9b06e" />
          </div>

          {/* Site pour les produits */}
          {importType === 'produits' && sites.length > 0 && (
            <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>Site de destination pour le stock initial :</div>
              <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '8px 12px' }}>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
          )}

          {/* Aperçu tableau */}
          <div style={{ ...card, marginBottom: 24, overflowX: 'auto' as const }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 14 }}>
              Aperçu — {Math.min(rows.length, 10)} premières lignes sur {rows.length}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {headers.slice(0, 7).map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                  ))}
                  {headers.length > 7 && <th style={{ padding: '8px 10px', color: 'rgba(232,224,213,0.2)', fontSize: 10 }}>+{headers.length - 7}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                    {headers.slice(0, 7).map(h => (
                      <td key={h} style={{ padding: '7px 10px', color: '#e8e0d5', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {row[h] || <span style={{ color: 'rgba(232,224,213,0.2)' }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', marginTop: 10, textAlign: 'center' as const }}>
                … et {rows.length - 10} lignes supplémentaires
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Btn variant="secondary" onClick={() => setStep('upload')}>← Changer de fichier</Btn>
            <Btn onClick={handleImport} disabled={rows.length === 0}>
              ✓ Importer {rows.length} {config.label.toLowerCase()}
            </Btn>
          </div>
        </>
      )}

      {/* ── ÉTAPE 4 : Import en cours ── */}
      {step === 'importing' && (
        <div style={{ ...card, maxWidth: 500, textAlign: 'center' as const, padding: '48px 32px' }}>
          <div style={{ fontSize: 32, color: '#c9a96e', marginBottom: 16, animation: 'spin 1.5s linear infinite' }}>⟳</div>
          <p style={{ color: '#c9a96e', fontSize: 16, fontFamily: 'Georgia, serif', fontWeight: 300, marginBottom: 8 }}>
            Import en cours...
          </p>
          <p style={{ color: 'rgba(232,224,213,0.4)', fontSize: 13, marginBottom: 20 }}>
            {rows.length} lignes à traiter
          </p>
          {/* Barre de progression */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#c9a96e', width: `${progress}%`, transition: 'width 0.3s ease', borderRadius: 1 }} />
          </div>
          <p style={{ color: 'rgba(232,224,213,0.3)', fontSize: 11, marginTop: 8 }}>{progress}%</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── ÉTAPE 5 : Résultats ── */}
      {step === 'done' && results && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <StatCard value={results.importes} label="Importés" color="#6ec96e" />
            <StatCard value={results.ignores} label="Ignorés" color="#888" />
            <StatCard value={results.erreurs} label="Erreurs" color="#c96e6e" />
          </div>

          {/* Résumé */}
          {results.importes > 0 && (
            <div style={{ background: 'rgba(110,201,110,0.08)', border: '0.5px solid rgba(110,201,110,0.2)', borderRadius: 5, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#6ec96e' }}>
              ✓ {results.importes} {config?.label.toLowerCase()} importés avec succès
            </div>
          )}

          {/* Détails erreurs seulement */}
          {(results.details.filter(d => d.statut !== 'ok').length > 0) && (
            <div style={{ ...card, marginBottom: 24, maxHeight: 400, overflowY: 'auto' as const }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginBottom: 14 }}>
                Lignes avec problèmes ({results.details.filter(d => d.statut !== 'ok').length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                    {['Nom', 'Statut', 'Message'].map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1, color: 'rgba(232,224,213,0.3)', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.details.filter(d => d.statut !== 'ok').map((r, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '6px 12px', color: '#e8e0d5' }}>{r.nom}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: r.statut === 'erreur' ? '#2a1e1e' : '#222', color: r.statut === 'erreur' ? '#c96e6e' : '#888', letterSpacing: 1 }}>
                          {r.statut.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', color: 'rgba(232,224,213,0.5)', fontSize: 11 }}>{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <Btn variant="secondary" onClick={reset}>Nouvel import</Btn>
            <a href="/admin" style={{
              background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 4,
              padding: '10px 20px', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer',
              fontWeight: 500, textTransform: 'uppercase' as const, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}>← Retour au catalogue</a>
          </div>
        </>
      )}
    </div>
  )
}
