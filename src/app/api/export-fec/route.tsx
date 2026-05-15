// src/app/api/export-fec/route.tsx
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JOURNAL_LABELS: Record<string, string> = {
  VE: 'Journal des ventes',
  AC: 'Journal des achats',
  BQ: 'Journal de banque',
  CA: 'Journal de caisse',
  OD: 'Opérations diverses',
  AN: 'À-nouveaux',
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return d.replace(/-/g, '')
}

function formatMontant(n: number | null): string {
  if (n === null || n === undefined) return '0.00'
  return Number(n).toFixed(2).replace(',', '.')
}

function sanitize(s: string | null): string {
  if (!s) return ''
  return s.replace(/\|/g, ' ').replace(/\n/g, ' ').trim()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entrepriseId = searchParams.get('entreprise_id')
  const annee = searchParams.get('annee')
  const mois = searchParams.get('mois') // optionnel — si absent = année entière

  if (!entrepriseId || !annee) {
    return NextResponse.json({ error: 'entreprise_id et annee requis' }, { status: 400 })
  }

  // Période
  let dateDebut: string
  let dateFin: string
  if (mois) {
    const m = parseInt(mois).toString().padStart(2, '0')
    const lastDay = new Date(parseInt(annee), parseInt(mois), 0).getDate()
    dateDebut = `${annee}-${m}-01`
    dateFin = `${annee}-${m}-${lastDay}`
  } else {
    dateDebut = `${annee}-01-01`
    dateFin = `${annee}-12-31`
  }

  // Récupérer entreprise
  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('code, raison_sociale, siret, siren')
    .eq('id', entrepriseId)
    .single()

  if (!entreprise) {
    return NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 })
  }

  // Récupérer écritures avec plan comptable
  const { data: ecritures, error } = await supabase
    .from('ecritures_comptables')
    .select('*, compte:plan_comptable(numero, libelle)')
    .eq('entreprise_id', entrepriseId)
    .gte('date_ecriture', dateDebut)
    .lte('date_ecriture', dateFin)
    .order('journal', { ascending: true })
    .order('date_ecriture', { ascending: true })
    .order('numero_piece', { ascending: true })
    .order('ordre', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // En-tête FEC
  const header = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib',
    'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate',
    'Montantdevise', 'Idevise',
  ].join('|')

  const lignes = (ecritures || []).map(e => {
    const journalCode = e.journal || ''
    const journalLib = JOURNAL_LABELS[journalCode] || journalCode
    const ecritureNum = sanitize(e.numero_piece)
    const ecritureDate = formatDate(e.date_ecriture)
    const compteNum = e.compte?.numero || ''
    const compteLib = sanitize(e.compte?.libelle || '')
    const libelle = sanitize(e.libelle)
    const debit = formatMontant(e.debit)
    const credit = formatMontant(e.credit)
    const validDate = e.validee ? formatDate(e.date_ecriture) : ''

    return [
      journalCode,
      journalLib,
      ecritureNum,
      ecritureDate,
      compteNum,
      compteLib,
      '', // CompAuxNum (compte auxiliaire — non utilisé ici)
      '', // CompAuxLib
      ecritureNum, // PieceRef = même que EcritureNum
      ecritureDate, // PieceDate
      libelle,
      debit,
      credit,
      e.lettrage || '', // EcritureLet
      '', // DateLet
      validDate,
      '', // Montantdevise
      '', // Idevise
    ].join('|')
  })

  const fecContent = [header, ...lignes].join('\r\n')

  // Nom du fichier selon norme DGFiP : SIREN + FEC + YYYYMMDD
  const siren = (entreprise.siren || entreprise.siret?.substring(0, 9) || '000000000').replace(/\s/g, '')
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const periodeSuffix = mois ? `${annee}${mois.padStart(2, '0')}` : annee
  const filename = `${siren}FEC${today}_${periodeSuffix}.txt`

  return new NextResponse(fecContent, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}