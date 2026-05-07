'use client'

import { useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// CAVE DE GILBERT — Import Excel
// src/app/admin/import/page.tsx
// ============================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ImportRow = {
  nom: string
  domaine: string
  appellation: string
  millesime: string
  couleur: string
  cepages: string
  alcool: string
  prix_vente_ttc: string
  prix_achat_ht: string
  bio: string
  description_courte: string
  stock: string
  [key: string]: string
}

type ImportResult = {
  ligne: number
  nom: string
  statut: 'ok' | 'erreur' | 'ignoré'
  message: string
}

const COLONNES_REQUISES = ['nom', 'couleur', 'prix_vente_ttc']

const COULEURS_VALIDES = ['rouge', 'blanc', 'rosé', 'champagne', 'effervescent', 'spiritueux', 'autre']

// ── Télécharger le modèle Excel (CSV en fait, plus simple) ──

function downloadTemplate() {
  const headers = [
    'nom', 'domaine', 'appellation', 'millesime', 'couleur',
    'cepages', 'alcool', 'prix_vente_ttc', 'prix_achat_ht',
    'bio', 'description_courte', 'stock'
  ]
  const exemple = [
    'Morgon', 'Jean Foillard', 'Morgon', '2022', 'rouge',
    'Gamay', '13', '22', '12',
    'non', 'Un Morgon élégant aux tanins soyeux.', '6'
  ]
  const exemple2 = [
    'Puligny-Montrachet', 'Domaine Leflaive', 'Puligny-Montrachet 1er Cru', '2021', 'blanc',
    'Chardonnay', '13.5', '89', '55',
    'non', 'La quintessence du Chardonnay bourguignon.', '12'
  ]
  const exemple3 = [
    'Bollinger Special Cuvée', 'Bollinger', 'Champagne AOC', '', 'champagne',
    'Pinot Noir|Chardonnay|Pinot Meunier', '12', '65', '42',
    'non', 'Le champagne de référence, vineux et généreux.', '24'
  ]

  const csv = [
    headers.join(';'),
    exemple.join(';'),
    exemple2.join(';'),
    exemple3.join(';'),
  ].join('\n')

  // Ajouter BOM pour Excel (accents)
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modele_import_cave_gilbert.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Parser CSV ───────────────────────────────────────────────

function parseCSV(text: string): ImportRow[] {
  // Supprimer BOM si présent
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Détection séparateur (; ou ,)
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase())

  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: ImportRow = {} as ImportRow
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

// ── Validation d'une ligne ───────────────────────────────────

function validateRow(row: ImportRow, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!row.nom?.trim()) errors.push('Nom manquant')
  if (!row.couleur?.trim()) errors.push('Couleur manquante')
  if (!COULEURS_VALIDES.includes(row.couleur?.toLowerCase()?.trim())) {
    errors.push(`Couleur invalide "${row.couleur}" — valeurs acceptées : ${COULEURS_VALIDES.join(', ')}`)
  }
  if (!row.prix_vente_ttc?.trim() || isNaN(parseFloat(row.prix_vente_ttc))) {
    errors.push('Prix TTC manquant ou invalide')
  }
  if (row.millesime && (isNaN(parseInt(row.millesime)) || parseInt(row.millesime) < 1900 || parseInt(row.millesime) > 2030)) {
    errors.push(`Millésime invalide : ${row.millesime}`)
  }
  if (row.alcool && isNaN(parseFloat(row.alcool))) {
    errors.push(`Alcool invalide : ${row.alcool}`)
  }

  return { valid: errors.length === 0, errors }
}

// ── Import dans Supabase ─────────────────────────────────────

async function importRow(row: ImportRow, siteId: string): Promise<{ product: any; error?: string }> {
  const cepages = row.cepages
    ? row.cepages.split('|').map(c => c.trim()).filter(Boolean)
    : []

  const { data: product, error } = await supabaseAdmin
    .from('products')
    .insert({
      nom: row.nom.trim(),
      millesime: row.millesime ? parseInt(row.millesime) : null,
      couleur: row.couleur.toLowerCase().trim(),
      prix_vente_ttc: parseFloat(row.prix_vente_ttc),
      prix_achat_ht: row.prix_achat_ht ? parseFloat(row.prix_achat_ht) : null,
      cepages,
      alcool: row.alcool ? parseFloat(row.alcool) : null,
      bio: row.bio?.toLowerCase() === 'oui',
      description_courte: row.description_courte?.trim() || null,
      actif: true, // Actif direct depuis Excel
    })
    .select()
    .single()

  if (error) return { product: null, error: error.message }

  // Stock initial
  if (row.stock && parseInt(row.stock) > 0 && siteId) {
    await supabaseAdmin.rpc('move_stock', {
      p_product_id: product.id,
      p_site_id: siteId,
      p_raison: 'achat',
      p_quantite: parseInt(row.stock),
      p_note: 'Import Excel',
      p_order_id: null,
      p_transfer_id: null,
    })
  }

  return { product }
}

// ── Page principale ──────────────────────────────────────────

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')
  const [results, setResults] = useState<ImportResult[]>([])
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [errors, setErrors] = useState<string[]>([])

  // Charger les sites au montage
  useState(() => {
    supabaseAdmin.from('sites').select('*').eq('actif', true).order('nom').then(({ data }) => {
      setSites(data || [])
      if (data && data.length > 0) setSiteId(data[0].id)
    })
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setErrors(['Fichier vide ou format non reconnu'])
        return
      }

      // Vérifier colonnes requises
      const firstRow = parsed[0]
      const missing = COLONNES_REQUISES.filter(c => !(c in firstRow))
      if (missing.length > 0) {
        setErrors([`Colonnes manquantes : ${missing.join(', ')}. Utilisez le modèle fourni.`])
        return
      }

      setRows(parsed)
      setErrors([])
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  const validations = rows.map((row, i) => validateRow(row, i))
  const rowsValides = rows.filter((_, i) => validations[i].valid).length
  const rowsInvalides = rows.length - rowsValides

  const handleImport = async () => {
    setImporting(true)
    const res: ImportResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const { valid, errors: rowErrors } = validations[i]

      if (!valid) {
        res.push({ ligne: i + 2, nom: row.nom || '—', statut: 'ignoré', message: rowErrors.join(', ') })
        continue
      }

      try {
        const { product, error } = await importRow(row, siteId)
        if (error) {
          res.push({ ligne: i + 2, nom: row.nom, statut: 'erreur', message: error })
        } else {
          res.push({ ligne: i + 2, nom: row.nom, statut: 'ok', message: 'Importé avec succès' })
        }
      } catch (e: any) {
        res.push({ ligne: i + 2, nom: row.nom, statut: 'erreur', message: e.message })
      }

      // Petite pause pour ne pas surcharger Supabase
      await new Promise(r => setTimeout(r, 100))
    }

    setResults(res)
    setStep('done')
    setImporting(false)
  }

  const s = {
    card: { background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '24px' } as React.CSSProperties,
    label: { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 },
    btn: (variant: 'primary' | 'secondary') => ({
      background: variant === 'primary' ? '#c9a96e' : 'transparent',
      color: variant === 'primary' ? '#0d0a08' : 'rgba(232,224,213,0.5)',
      border: variant === 'primary' ? 'none' : '0.5px solid rgba(255,255,255,0.15)',
      borderRadius: 4, padding: '11px 22px', fontSize: 11, letterSpacing: 1.5,
      cursor: 'pointer', fontWeight: variant === 'primary' ? 500 : 400,
      textTransform: 'uppercase' as const,
    }),
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5', padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <a href="/admin" style={{ fontSize: 11, color: 'rgba(232,224,213,0.3)', textDecoration: 'none', letterSpacing: 1, display: 'block', marginBottom: 12 }}>← Retour à l'admin</a>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 300, color: '#f0e8d8', marginBottom: 4 }}>Import catalogue</h1>
          <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Importez vos vins depuis un fichier CSV ou Excel</p>
        </div>
        <button onClick={downloadTemplate} style={s.btn('secondary')}>
          ↓ Télécharger le modèle CSV
        </button>
      </div>

      {/* Étape 1 — Upload */}
      {step === 'upload' && (
        <div style={{ maxWidth: 600 }}>
          {errors.length > 0 && (
            <div style={{ background: 'rgba(201,110,110,0.1)', border: '0.5px solid rgba(201,110,110,0.3)', borderRadius: 5, padding: '14px 18px', marginBottom: 20 }}>
              {errors.map((e, i) => <p key={i} style={{ fontSize: 13, color: '#c96e6e', margin: 0 }}>{e}</p>)}
            </div>
          )}

          {/* Zone de drop */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              ...s.card,
              border: '1px dashed rgba(201,169,110,0.3)',
              textAlign: 'center' as const, cursor: 'pointer', padding: '48px 32px', marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 16 }}>📂</div>
            <p style={{ fontSize: 14, color: '#c9a96e', marginBottom: 8 }}>Cliquez pour sélectionner votre fichier</p>
            <p style={{ fontSize: 12, color: 'rgba(232,224,213,0.35)' }}>Format accepté : CSV (séparateur ; ou ,)</p>
            <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.25)', marginTop: 8 }}>Exportez votre Excel en CSV depuis Fichier → Enregistrer sous → CSV UTF-8</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {/* Instructions */}
          <div style={s.card}>
            <h2 style={{ fontSize: 13, color: '#c9a96e', marginBottom: 16, letterSpacing: 1 }}>Comment préparer votre fichier</h2>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {[
                { num: '1', text: 'Téléchargez le modèle CSV ci-dessus' },
                { num: '2', text: 'Ouvrez-le dans Excel et remplissez vos produits' },
                { num: '3', text: 'Enregistrez en "CSV UTF-8 (délimité par des points-virgules)"' },
                { num: '4', text: 'Importez le fichier ici' },
              ].map(({ num, text }) => (
                <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(201,169,110,0.15)', color: '#c9a96e', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</span>
                  <span style={{ fontSize: 13, color: 'rgba(232,224,213,0.6)' }}>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
              <p style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginBottom: 8 }}>Colonnes disponibles :</p>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {[
                  { col: 'nom *', desc: 'Nom du vin' },
                  { col: 'couleur *', desc: 'rouge / blanc / rosé / champagne / effervescent / spiritueux' },
                  { col: 'prix_vente_ttc *', desc: 'Prix en euros (ex: 22.50)' },
                  { col: 'domaine', desc: 'Nom du domaine' },
                  { col: 'appellation', desc: 'Appellation AOC' },
                  { col: 'millesime', desc: 'Année (ex: 2022)' },
                  { col: 'cepages', desc: 'Séparés par | (ex: Gamay|Syrah)' },
                  { col: 'alcool', desc: 'Taux en % (ex: 13.5)' },
                  { col: 'prix_achat_ht', desc: 'Prix achat HT' },
                  { col: 'bio', desc: 'oui ou non' },
                  { col: 'description_courte', desc: 'Texte libre' },
                  { col: 'stock', desc: 'Quantité initiale' },
                ].map(({ col, desc }) => (
                  <div key={col} style={{ fontSize: 11 }}>
                    <span style={{ color: col.includes('*') ? '#c9a96e' : 'rgba(232,224,213,0.6)', fontFamily: 'monospace' }}>{col}</span>
                    <span style={{ color: 'rgba(232,224,213,0.25)', marginLeft: 4 }}>— {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Étape 2 — Prévisualisation */}
      {step === 'preview' && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ ...s.card, flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, color: '#6ec96e', fontFamily: 'Georgia, serif' }}>{rowsValides}</div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>Prêts à importer</div>
            </div>
            <div style={{ ...s.card, flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, color: rowsInvalides > 0 ? '#c96e6e' : '#888', fontFamily: 'Georgia, serif' }}>{rowsInvalides}</div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>Avec erreurs</div>
            </div>
            <div style={{ ...s.card, flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{rows.length}</div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>Total lignes</div>
            </div>
          </div>

          {/* Sélection du site */}
          <div style={{ ...s.card, marginBottom: 20 }}>
            <label style={s.label}>Site de destination pour le stock initial</label>
            <select value={siteId} onChange={e => setSiteId(e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 13, padding: '9px 12px', minWidth: 250 }}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>

          {/* Tableau de prévisualisation */}
          <div style={{ ...s.card, marginBottom: 24, overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {['#', 'Nom', 'Domaine', 'Millésime', 'Couleur', 'Prix', 'Stock', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const { valid, errors: rowErrors } = validations[i]
                  return (
                    <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)', opacity: valid ? 1 : 0.6 }}>
                      <td style={{ padding: '8px 12px', color: 'rgba(232,224,213,0.35)' }}>{i + 2}</td>
                      <td style={{ padding: '8px 12px', color: '#f0e8d8' }}>{row.nom || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(232,224,213,0.5)' }}>{row.domaine || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(232,224,213,0.5)' }}>{row.millesime || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(232,224,213,0.5)' }}>{row.couleur || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#c9a96e' }}>{row.prix_vente_ttc ? `${row.prix_vente_ttc}€` : '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(232,224,213,0.5)' }}>{row.stock || '0'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {valid ? (
                          <span style={{ fontSize: 10, color: '#6ec96e', letterSpacing: 1 }}>✓ OK</span>
                        ) : (
                          <span style={{ fontSize: 10, color: '#c96e6e' }} title={rowErrors.join(', ')}>✗ {rowErrors[0]}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => { setStep('upload'); setRows([]); setFileName('') }} style={s.btn('secondary')}>
              ← Changer de fichier
            </button>
            <button onClick={handleImport} disabled={importing || rowsValides === 0} style={{ ...s.btn('primary'), opacity: (importing || rowsValides === 0) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {importing ? '⟳ Import en cours...' : `✓ Importer ${rowsValides} produit${rowsValides > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}

      {/* Étape 3 — Résultats */}
      {step === 'done' && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ ...s.card, flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, color: '#6ec96e', fontFamily: 'Georgia, serif' }}>{results.filter(r => r.statut === 'ok').length}</div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>Importés</div>
            </div>
            <div style={{ ...s.card, flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, color: '#c96e6e', fontFamily: 'Georgia, serif' }}>{results.filter(r => r.statut === 'erreur').length}</div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>Erreurs</div>
            </div>
            <div style={{ ...s.card, flex: 1, textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, color: '#888', fontFamily: 'Georgia, serif' }}>{results.filter(r => r.statut === 'ignoré').length}</div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.35)', textTransform: 'uppercase' as const, marginTop: 4 }}>Ignorés</div>
            </div>
          </div>

          <div style={{ ...s.card, marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {['Ligne', 'Produit', 'Résultat', 'Message'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', textTransform: 'uppercase' as const, fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px 14px', color: 'rgba(232,224,213,0.35)' }}>{r.ligne}</td>
                    <td style={{ padding: '8px 14px', color: '#f0e8d8' }}>{r.nom}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{
                        fontSize: 10, letterSpacing: 1, padding: '2px 8px', borderRadius: 3,
                        background: r.statut === 'ok' ? '#1e2a1e' : r.statut === 'erreur' ? '#2a1e1e' : '#222',
                        color: r.statut === 'ok' ? '#6ec96e' : r.statut === 'erreur' ? '#c96e6e' : '#888',
                      }}>{r.statut.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '8px 14px', fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => { setStep('upload'); setRows([]); setResults([]); setFileName('') }} style={s.btn('secondary')}>
              Importer un autre fichier
            </button>
            <a href="/admin" style={{ ...s.btn('primary'), textDecoration: 'none', display: 'inline-block' }}>
              ← Retour au catalogue
            </a>
          </div>
        </>
      )}
    </div>
  )
}
