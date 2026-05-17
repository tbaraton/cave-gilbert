'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// Client sans gestion de session → pas de lock browser qui hangue
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
)

// ── Types ────────────────────────────────────────────────────
type User = { id: string; prenom: string; nom: string; role: string; pin: string }
type Profil = { user_id: string; horaire_matin_debut: string; horaire_matin_fin: string; horaire_aprem_debut: string; horaire_aprem_fin: string; jours_travail: number[]; samedi_offert_par_mois: number; site_id: string; horaires_speciaux?: Record<string, any> }
type Shift = { id?: string; user_id: string; date: string; type: string; matin_debut?: string; matin_fin?: string; aprem_debut?: string; aprem_fin?: string; note?: string }
type Demande = { user_id: string; date_debut: string; date_fin: string; statut: string; type: string }
type SamediOffert = { user_id: string; date_samedi: string; statut: string }

// ── Constantes ───────────────────────────────────────────────
const TYPES_SHIFT: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  travail:    { label: 'Travail',    color: '#6ec96e', bg: 'rgba(110,201,110,0.12)',  icon: '●' },
  repos:      { label: 'Repos',      color: '#888',     bg: 'rgba(128,128,128,0.08)', icon: '○' },
  ferie:      { label: 'Férié',      color: '#d4a574',  bg: 'rgba(212,165,116,0.14)', icon: '🇫🇷' },
  conge:      { label: 'Congé',      color: '#6e9ec9',  bg: 'rgba(110,158,201,0.12)', icon: '🏖' },
  maladie:    { label: 'Maladie',    color: '#c96e6e',  bg: 'rgba(201,110,110,0.12)', icon: '🏥' },
  evenement:  { label: 'Événement',  color: '#c9b06e',  bg: 'rgba(201,176,110,0.12)', icon: '⭐' },
  formation:  { label: 'Formation',  color: '#b06ec9',  bg: 'rgba(176,110,201,0.12)', icon: '📚' },
}
const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
const JOURS_LONG = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
const SITE_NOMS: Record<string, string> = {
  'ee3afa96-0c45-407f-87fc-e503fbada6c4': 'Cave de Gilbert — Marcy',
  'e12d7e47-23dc-4011-95fc-e9e975fc4307': 'Entrepôt',
  '3097e864-f452-4c2e-9af3-21e26f0330b7': 'La Petite Cave — L\'Arbresle',
}

// ── Jours fériés français ─────────────────────────────────────
function getJoursFeries(year: number): Map<string, string> {
  const map = new Map<string, string>()
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  map.set(`${year}-01-01`, "Jour de l'an")
  map.set(`${year}-05-01`, 'Fête du travail')
  map.set(`${year}-05-08`, 'Victoire 1945')
  map.set(`${year}-07-14`, 'Fête nationale')
  map.set(`${year}-08-15`, 'Assomption')
  map.set(`${year}-11-01`, 'Toussaint')
  map.set(`${year}-11-11`, 'Armistice')
  map.set(`${year}-12-25`, 'Noël')
  // Calcul de Pâques (algorithme de Meeus)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const mm = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * mm + 114) / 31)
  const day = ((h + l - 7 * mm + 114) % 31) + 1
  const paques = new Date(year, month - 1, day)
  const lundiPaques = new Date(paques); lundiPaques.setDate(paques.getDate() + 1)
  const ascension = new Date(paques); ascension.setDate(paques.getDate() + 39)
  const pentecote = new Date(paques); pentecote.setDate(paques.getDate() + 50)
  map.set(fmt(lundiPaques), 'Lundi de Pâques')
  map.set(fmt(ascension), 'Ascension')
  map.set(fmt(pentecote), 'Lundi de Pentecôte')
  return map
}
function getFerieLabel(date: string): string | null {
  const year = parseInt(date.slice(0, 4))
  return getJoursFeries(year).get(date) || null
}

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function getHorairesJour(profil: Profil, date: string) {
  const dow = new Date(date + 'T12:00:00').getDay()
  const sp = profil?.horaires_speciaux?.[String(dow)]
  return {
    matin_debut: sp?.matin_debut || profil?.horaire_matin_debut || '09:30',
    matin_fin:   sp?.matin_fin   || profil?.horaire_matin_fin   || '13:00',
    aprem_debut: sp?.aprem_debut || profil?.horaire_aprem_debut || '15:30',
    aprem_fin:   sp?.aprem_fin   || profil?.horaire_aprem_fin   || '19:00',
  }
}
function calcHeures(s: Shift, profil: Profil): number {
  if (s.type !== 'travail') return 0
  const h = getHorairesJour(profil, s.date)
  const mDeb = s.matin_debut || h.matin_debut
  const mFin = s.matin_fin   || h.matin_fin
  const aDeb = s.aprem_debut || h.aprem_debut
  const aFin = s.aprem_fin   || h.aprem_fin
  return (toMin(mFin) - toMin(mDeb) + toMin(aFin) - toMin(aDeb)) / 60
}
function fmtH(h: number) { return h > 0 ? `${Math.floor(h)}h${h % 1 ? '30' : ''}` : '—' }
function isoDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function getMonday(d: Date) { const dd = new Date(d); const dow = dd.getDay(); const diff = (dow === 0 ? -6 : 1 - dow); dd.setDate(dd.getDate() + diff); dd.setHours(0,0,0,0); return dd }

// ── Login PIN ────────────────────────────────────────────────
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
    if (k === '←') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 4) return
    const np = pin + k; setPin(np)
    if (np.length === 4) setTimeout(() => doLogin(np), 50)
  }
  return (
    <div style={{ minHeight: '100dvh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center' as const, marginBottom: 32 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#c9a96e', letterSpacing: 3 }}>Ressources Humaines</div>
          <div style={{ fontSize: 13, color: 'rgba(232,224,213,0.4)', marginTop: 6 }}>Planning</div>
        </div>
        {error && <div style={{ background: 'rgba(201,110,110,0.15)', border: '0.5px solid rgba(201,110,110,0.4)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#c96e6e', textAlign: 'center' as const }}>{error}</div>}
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

// ── Modal édition shift ───────────────────────────────────────
function ModalShift({ shift, profil, user, date, onSave, onClose }: {
  shift: Shift | null; profil: Profil; user: { id: string; prenom: string }; date: string
  onSave: (s: Shift) => void; onClose: () => void
}) {
  const [form, setForm] = useState<Shift>(shift || {
    user_id: user.id, date,
    type: 'travail',
    matin_debut: profil.horaire_matin_debut,
    matin_fin: profil.horaire_matin_fin,
    aprem_debut: profil.horaire_aprem_debut,
    aprem_fin: profil.horaire_aprem_fin,
    note: '',
  })
  const heures = calcHeures(form, profil)
  const inp = { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#e8e0d5', fontSize: 14, padding: '9px 12px', width: '100%', boxSizing: 'border-box' as const }
  const lbl = { fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.4)', display: 'block', marginBottom: 6 }
  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: '#18130e', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, width: '100%', maxWidth: 460, padding: '24px 28px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#c9a96e' }}>{user.prenom}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: '#f0e8d8' }}>
              {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {getFerieLabel(date) && (
              <div style={{ fontSize: 11, color: '#d4a574', marginTop: 4 }}>🇫🇷 {getFerieLabel(date)} — jour férié</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(232,224,213,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Type */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 18 }}>
          {Object.entries(TYPES_SHIFT).map(([key, { label, color, icon }]) => (
            <button key={key} onClick={() => setForm(f => ({ ...f, type: key }))} style={{ background: form.type === key ? `${color}22` : 'rgba(255,255,255,0.04)', border: `0.5px solid ${form.type === key ? color : 'rgba(255,255,255,0.1)'}`, color: form.type === key ? color : 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Horaires si travail */}
        {form.type === 'travail' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Matin début</label><input type="time" value={form.matin_debut || ''} onChange={e => setForm(f => ({ ...f, matin_debut: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Matin fin</label><input type="time" value={form.matin_fin || ''} onChange={e => setForm(f => ({ ...f, matin_fin: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Après-midi début</label><input type="time" value={form.aprem_debut || ''} onChange={e => setForm(f => ({ ...f, aprem_debut: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Après-midi fin</label><input type="time" value={form.aprem_fin || ''} onChange={e => setForm(f => ({ ...f, aprem_fin: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 6, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)' }}>Total journée</span>
              <span style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmtH(heures)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setForm(f => ({ ...f, matin_debut: profil.horaire_matin_debut, matin_fin: profil.horaire_matin_fin, aprem_debut: profil.horaire_aprem_debut, aprem_fin: profil.horaire_aprem_fin }))}
                style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '6px 12px', fontSize: 11, cursor: 'pointer' }}>↺ Horaires habituels</button>
            </div>
          </>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Note</label>
          <input value={form.note || ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Optionnel..." style={inp} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {shift && <button onClick={() => onSave({ ...form, type: 'repos' })} style={{ background: 'transparent', border: '0.5px solid rgba(201,110,110,0.3)', color: '#c96e6e', borderRadius: 6, padding: '10px 14px', fontSize: 12, cursor: 'pointer' }}>Marquer repos</button>}
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(232,224,213,0.4)', borderRadius: 6, padding: '10px', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => onSave(form)} style={{ flex: 2, background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>✓ Enregistrer</button>
        </div>
      </div>
    </div>
  )
}


// ── Carte employé éditable ────────────────────────────────────
function CarteEmploye({ emp, onSaved }: { emp: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    horaire_matin_debut:  emp.profil?.horaire_matin_debut  || '09:30',
    horaire_matin_fin:    emp.profil?.horaire_matin_fin    || '13:00',
    horaire_aprem_debut:  emp.profil?.horaire_aprem_debut  || '15:30',
    horaire_aprem_fin:    emp.profil?.horaire_aprem_fin    || '19:00',
    sam_matin_debut:  emp.profil?.horaires_speciaux?.['6']?.matin_debut  || '',
    sam_matin_fin:    emp.profil?.horaires_speciaux?.['6']?.matin_fin    || '',
    sam_aprem_debut:  emp.profil?.horaires_speciaux?.['6']?.aprem_debut  || '',
    sam_aprem_fin:    emp.profil?.horaires_speciaux?.['6']?.aprem_fin    || '',
    has_sam_special:  !!emp.profil?.horaires_speciaux?.['6'],
  })
  const inpS: any = { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#e8e0d5', fontSize: 12, padding: '6px 8px', width: '100%', boxSizing: 'border-box' }
  const lbl: any = { fontSize: 9, color: 'rgba(232,224,213,0.35)', display: 'block', marginBottom: 3 }

  const handleSave = async () => {
    setSaving(true)
    const hs: any = {}
    if (form.has_sam_special && form.sam_matin_debut) {
      hs['6'] = { matin_debut: form.sam_matin_debut, matin_fin: form.sam_matin_fin, aprem_debut: form.sam_aprem_debut, aprem_fin: form.sam_aprem_fin }
    }
    await supabase.from('employe_profils').update({
      horaire_matin_debut: form.horaire_matin_debut, horaire_matin_fin: form.horaire_matin_fin,
      horaire_aprem_debut: form.horaire_aprem_debut, horaire_aprem_fin: form.horaire_aprem_fin,
      horaires_speciaux: Object.keys(hs).length > 0 ? hs : {},
    }).eq('user_id', emp.id)
    setSaving(false); setEditing(false); onSaved()
  }

  return (
    <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: '#f0e8d8', fontWeight: 600 }}>{emp.prenom} {emp.nom}</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)', marginTop: 2 }}>{SITE_NOMS[emp.profil?.site_id] || ''}</div>
        </div>
        <button onClick={() => setEditing(e => !e)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(232,224,213,0.4)', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
          {editing ? '✕ Fermer' : '✏ Modifier'}
        </button>
      </div>
      {!editing ? (
        <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', lineHeight: 1.9 }}>
          <div>🌅 Mar–Ven : {emp.profil?.horaire_matin_debut}–{emp.profil?.horaire_matin_fin} / {emp.profil?.horaire_aprem_debut}–{emp.profil?.horaire_aprem_fin}</div>
          {emp.profil?.horaires_speciaux?.['6']
            ? <div>📅 Sam : {emp.profil.horaires_speciaux['6'].matin_debut}–{emp.profil.horaires_speciaux['6'].matin_fin} / {emp.profil.horaires_speciaux['6'].aprem_debut}–{emp.profil.horaires_speciaux['6'].aprem_fin}</div>
            : <div>📅 Sam : mêmes horaires</div>}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 10, color: '#c9a96e', marginBottom: 8, letterSpacing: 1 }}>MAR–VEN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><label style={lbl}>Matin début</label><input type="time" value={form.horaire_matin_debut} onChange={e => setForm(f=>({...f,horaire_matin_debut:e.target.value}))} style={inpS}/></div>
            <div><label style={lbl}>Matin fin</label><input type="time" value={form.horaire_matin_fin} onChange={e => setForm(f=>({...f,horaire_matin_fin:e.target.value}))} style={inpS}/></div>
            <div><label style={lbl}>A-midi début</label><input type="time" value={form.horaire_aprem_debut} onChange={e => setForm(f=>({...f,horaire_aprem_debut:e.target.value}))} style={inpS}/></div>
            <div><label style={lbl}>A-midi fin</label><input type="time" value={form.horaire_aprem_fin} onChange={e => setForm(f=>({...f,horaire_aprem_fin:e.target.value}))} style={inpS}/></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }} onClick={() => setForm(f=>({...f,has_sam_special:!f.has_sam_special}))}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${form.has_sam_special ? '#c9a96e' : 'rgba(255,255,255,0.2)'}`, background: form.has_sam_special ? '#c9a96e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {form.has_sam_special && <span style={{ fontSize: 9, color: '#0d0a08', fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>Horaires différents le samedi</span>
          </div>
          {form.has_sam_special && (
            <>
              <div style={{ fontSize: 10, color: '#c9a96e', marginBottom: 8, letterSpacing: 1 }}>SAMEDI</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div><label style={lbl}>Matin début</label><input type="time" value={form.sam_matin_debut} onChange={e => setForm(f=>({...f,sam_matin_debut:e.target.value}))} style={inpS}/></div>
                <div><label style={lbl}>Matin fin</label><input type="time" value={form.sam_matin_fin} onChange={e => setForm(f=>({...f,sam_matin_fin:e.target.value}))} style={inpS}/></div>
                <div><label style={lbl}>A-midi début</label><input type="time" value={form.sam_aprem_debut} onChange={e => setForm(f=>({...f,sam_aprem_debut:e.target.value}))} style={inpS}/></div>
                <div><label style={lbl}>A-midi fin</label><input type="time" value={form.sam_aprem_fin} onChange={e => setForm(f=>({...f,sam_aprem_fin:e.target.value}))} style={inpS}/></div>
              </div>
            </>
          )}
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', background: '#c9a96e', color: '#0d0a08', border: 'none', borderRadius: 6, padding: '10px', fontSize: 12, cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⟳' : '✓ Sauvegarder'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Planning principal ────────────────────────────────────────
function PlanningAdmin({ admin }: { admin: User }) {
  const [vue, setVue] = useState<'semaine' | 'mois'>('semaine')
  const [semaine, setSemaine] = useState(getMonday(new Date()))
  const [moisRef, setMoisRef] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() })
  const [employes, setEmployes] = useState<(User & { profil: Profil })[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [samedis, setSamedis] = useState<SamediOffert[]>([])
  const [editModal, setEditModal] = useState<{ user: any; profil: Profil; date: string; shift: Shift | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copyWeekMsg, setCopyWeekMsg] = useState('')

  const joursSemaine = Array.from({ length: 7 }, (_, i) => { const d = new Date(semaine); d.setDate(d.getDate() + i); return d })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: users }, { data: profils }, { data: dem }, { data: sam }] = await Promise.all([
      supabase.from('users').select('id, prenom, nom, role').eq('actif', true).in('role', ['responsable', 'vendeur', 'caviste']),
      supabase.from('employe_profils').select('*'),
      supabase.from('conges_demandes').select('*').eq('statut', 'approuve'),
      supabase.from('samedis_offerts').select('*').neq('statut', 'annule'),
    ])
    const profilMap = Object.fromEntries((profils || []).map(p => [p.user_id, p]))
    setEmployes((users || []).map(u => ({ ...u, profil: profilMap[u.id] || {} })))
    setDemandes(dem || [])
    setSamedis(sam || [])
    await loadShifts()
    setLoading(false)
  }, [])

  const loadShifts = async () => {
    const debut = isoDate(semaine)
    const fin = isoDate(joursSemaine[6])
    const { data } = await supabase.from('planning_shifts').select('*').gte('date', debut).lte('date', fin)
    setShifts(data || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadShifts() }, [semaine])

  const getShift = (userId: string, date: string) => shifts.find(s => s.user_id === userId && s.date === date)

  const isConge = (userId: string, date: string) => demandes.some(d => d.user_id === userId && date >= d.date_debut && date <= d.date_fin)
  const isSamediOffert = (userId: string, date: string) => samedis.some(s => s.user_id === userId && s.date_samedi === date)

  const getDefaultType = (userId: string, date: string, profil: Profil): string => {
    const dow = new Date(date + 'T12:00:00').getDay()
    if (dow === 0 || dow === 1) return 'repos' // Dimanche et Lundi toujours repos
    if (getFerieLabel(date)) return 'ferie' // Jour férié par défaut chômé
    if (isConge(userId, date)) return 'conge'
    const jours: number[] = Array.isArray(profil?.jours_travail) && profil.jours_travail.length > 0
      ? profil.jours_travail : [2,3,4,5,6]
    if (!jours.includes(dow)) return 'repos'
    if (dow === 6 && isSamediOffert(userId, date)) return 'repos'
    return 'travail'
  }

  const handleCellClick = (emp: any, date: string) => {
    const shift = getShift(emp.id, date)
    setEditModal({ user: emp, profil: emp.profil, date, shift: shift || null })
  }

  const handleSaveShift = async (form: Shift) => {
    if (editModal?.shift?.id) {
      await supabase.from('planning_shifts').update({ type: form.type, matin_debut: form.matin_debut, matin_fin: form.matin_fin, aprem_debut: form.aprem_debut, aprem_fin: form.aprem_fin, note: form.note }).eq('id', editModal.shift.id)
    } else {
      await supabase.from('planning_shifts').upsert({ user_id: form.user_id, date: form.date, type: form.type, matin_debut: form.matin_debut, matin_fin: form.matin_fin, aprem_debut: form.aprem_debut, aprem_fin: form.aprem_fin, note: form.note }, { onConflict: 'user_id,date' })
    }
    setEditModal(null); await loadShifts()
  }

  const copierSemainePrecedente = async () => {
    const prevMonday = new Date(semaine); prevMonday.setDate(prevMonday.getDate() - 7)
    const prevDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(prevMonday); d.setDate(d.getDate() + i); return isoDate(d) })
    const { data: prevShifts } = await supabase.from('planning_shifts').select('*').in('date', prevDays)
    if (!prevShifts?.length) { setCopyWeekMsg('Aucun planning la semaine précédente'); setTimeout(() => setCopyWeekMsg(''), 3000); return }
    const newShifts = prevShifts.map(s => {
      const d = new Date(s.date + 'T12:00:00'); d.setDate(d.getDate() + 7)
      return { user_id: s.user_id, date: isoDate(d), type: s.type, matin_debut: s.matin_debut, matin_fin: s.matin_fin, aprem_debut: s.aprem_debut, aprem_fin: s.aprem_fin, note: s.note }
    })
    for (const ns of newShifts) await supabase.from('planning_shifts').upsert(ns, { onConflict: 'user_id,date' })
    await loadShifts(); setCopyWeekMsg('Semaine copiée ✓'); setTimeout(() => setCopyWeekMsg(''), 3000)
  }

  const today = isoDate(new Date())

  // ── Calcul stats semaine par employé ──
  const statsEmp = employes.map(emp => {
    let totalH = 0
    joursSemaine.forEach(d => {
      const date = isoDate(d)
      const shift = getShift(emp.id, date)
      const type = shift?.type || getDefaultType(emp.id, date, emp.profil)
      if (type === 'travail') {
        const s: Shift = shift || { user_id: emp.id, date, type: 'travail', matin_debut: emp.profil?.horaire_matin_debut, matin_fin: emp.profil?.horaire_matin_fin, aprem_debut: emp.profil?.horaire_aprem_debut, aprem_fin: emp.profil?.horaire_aprem_fin }
        totalH += calcHeures(s, emp.profil)
      }
    })
    return { userId: emp.id, heures: totalH }
  })

  // ── Vue mois ──
  const moisJours = (() => {
    const first = new Date(moisRef.y, moisRef.m, 1)
    const last = new Date(moisRef.y, moisRef.m + 1, 0)
    const startDow = (first.getDay() + 6) % 7
    const days = Array.from({ length: last.getDate() }, (_, i) => i + 1)
    const pad = Array.from({ length: startDow })
    return { days, pad, first, last }
  })()

  const btnNav = { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#e8e0d5', borderRadius: 4, padding: '7px 14px', fontSize: 14, cursor: 'pointer' }

  if (loading) return <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.3)', fontFamily: 'DM Sans, system-ui' }}>⟳ Chargement...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 20, background: '#100d0a', flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>Planning</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{admin.prenom} · Administration</div>
        </div>

        {/* Toggle vue */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {[['semaine', 'Semaine'], ['mois', 'Mois']].map(([v, l]) => (
            <button key={v} onClick={() => setVue(v as any)} style={{ background: vue === v ? 'rgba(201,169,110,0.15)' : 'transparent', border: 'none', color: vue === v ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>

        {/* Navigation semaine */}
        {vue === 'semaine' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setSemaine(d => { const nd = new Date(d); nd.setDate(nd.getDate()-7); return nd })} style={btnNav}>‹</button>
            <button onClick={() => setSemaine(getMonday(new Date()))} style={{ ...btnNav, fontSize: 11, padding: '7px 12px', color: '#c9a96e', borderColor: 'rgba(201,169,110,0.3)' }}>Aujourd'hui</button>
            <span style={{ fontSize: 13, color: '#f0e8d8', minWidth: 200, textAlign: 'center' as const }}>
              {joursSemaine[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — {joursSemaine[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setSemaine(d => { const nd = new Date(d); nd.setDate(nd.getDate()+7); return nd })} style={btnNav}>›</button>
          </div>
        )}

        {/* Navigation mois */}
        {vue === 'mois' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setMoisRef(r => r.m === 0 ? { y: r.y-1, m: 11 } : { y: r.y, m: r.m-1 })} style={btnNav}>‹</button>
            <span style={{ fontSize: 13, color: '#f0e8d8', minWidth: 160, textAlign: 'center' as const, textTransform: 'capitalize' as const }}>
              {new Date(moisRef.y, moisRef.m).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setMoisRef(r => r.m === 11 ? { y: r.y+1, m: 0 } : { y: r.y, m: r.m+1 })} style={btnNav}>›</button>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {copyWeekMsg && <span style={{ fontSize: 12, color: '#6ec96e' }}>{copyWeekMsg}</span>}
          {vue === 'semaine' && <button onClick={copierSemainePrecedente} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(232,224,213,0.5)', borderRadius: 4, padding: '7px 14px', fontSize: 11, cursor: 'pointer' }}>↻ Copier sem. précédente</button>}
          <a href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(232,224,213,0.6)', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 14px' }}>← Retour admin</a>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* ── VUE SEMAINE ── */}
        {vue === 'semaine' && (
          <>
            {/* Légende types */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const }}>
              {Object.entries(TYPES_SHIFT).map(([key, { label, color, icon }]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(232,224,213,0.5)' }}>
                  <span style={{ color }}>{icon}</span> {label}
                </div>
              ))}
            </div>

            {/* Grille planning */}
            <div style={{ overflowX: 'auto' as const }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ width: 160, padding: '10px 14px', textAlign: 'left' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>EMPLOYÉ</th>
                    {joursSemaine.map((d, i) => {
                      const iso = isoDate(d)
                      const isToday = iso === today
                      const isWE = i === 0 || i === 6
                      return (
                        <th key={i} style={{ padding: '10px 6px', textAlign: 'center' as const, fontSize: 11, color: isToday ? '#c9a96e' : isWE ? 'rgba(232,224,213,0.2)' : 'rgba(232,224,213,0.4)', fontWeight: isToday ? 700 : 400, borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: isToday ? 'rgba(201,169,110,0.05)' : 'transparent', minWidth: 100 }}>
                          <div>{JOURS[d.getDay()]}</div>
                          <div style={{ fontSize: 15, fontFamily: 'Georgia, serif', color: isToday ? '#c9a96e' : isWE ? 'rgba(232,224,213,0.2)' : '#f0e8d8' }}>{d.getDate()}</div>
                        </th>
                      )
                    })}
                    <th style={{ width: 80, padding: '10px 8px', textAlign: 'center' as const, fontSize: 10, letterSpacing: 1.5, color: 'rgba(232,224,213,0.3)', fontWeight: 400, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {employes.map((emp, ei) => {
                    const stat = statsEmp.find(s => s.userId === emp.id)
                    return (
                      <tr key={emp.id} style={{ borderBottom: ei < employes.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 14, color: '#f0e8d8', fontWeight: 600 }}>{emp.prenom}</div>
                          <div style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', marginTop: 2 }}>{SITE_NOMS[emp.profil?.site_id] || ''}</div>
                        </td>
                        {joursSemaine.map((d, di) => {
                          const date = isoDate(d)
                          const shift = getShift(emp.id, date)
                          const defaultType = getDefaultType(emp.id, date, emp.profil)
                          const type = shift?.type || defaultType
                          const { color, bg, icon } = TYPES_SHIFT[type] || TYPES_SHIFT.repos
                          const isToday = date === today
                          const isWE = di === 0 || di === 6
                          const hJour = type === 'travail' ? calcHeures(shift || { user_id: emp.id, date, type: 'travail', matin_debut: emp.profil?.horaire_matin_debut, matin_fin: emp.profil?.horaire_matin_fin, aprem_debut: emp.profil?.horaire_aprem_debut, aprem_fin: emp.profil?.horaire_aprem_fin }, emp.profil) : 0
                          const isSamOff = isSamediOffert(emp.id, date)
                          return (
                            <td key={di} style={{ padding: 4, verticalAlign: 'top', background: isToday ? 'rgba(201,169,110,0.03)' : 'transparent' }}>
                              <div onClick={() => handleCellClick(emp, date)}
                                style={{ background: isWE && type === 'repos' ? 'rgba(255,255,255,0.02)' : bg, borderRadius: 6, padding: '8px 6px', cursor: 'pointer', minHeight: 72, border: `0.5px solid ${shift ? color + '40' : type === 'ferie' ? color + '40' : 'rgba(255,255,255,0.04)'}`, position: 'relative' as const, transition: 'opacity 0.15s' }}
                                title={getFerieLabel(date) || undefined}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, color }}>{icon}</span>
                                  <span style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: 0.5 }}>{type === 'travail' ? fmtH(hJour) : TYPES_SHIFT[type]?.label}</span>
                                </div>
                                {type === 'ferie' && getFerieLabel(date) && (
                                  <div style={{ fontSize: 9, color: '#d4a574', fontStyle: 'italic' as const, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{getFerieLabel(date)}</div>
                                )}
                                {type === 'travail' && (
                                  <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.4)', lineHeight: 1.6 }}>
                                    <div>{shift?.matin_debut || getHorairesJour(emp.profil, date).matin_debut}–{shift?.matin_fin || getHorairesJour(emp.profil, date).matin_fin}</div>
                                    <div>{shift?.aprem_debut || getHorairesJour(emp.profil, date).aprem_debut}–{shift?.aprem_fin || getHorairesJour(emp.profil, date).aprem_fin}</div>
                                  </div>
                                )}
                                {isSamOff && <div style={{ fontSize: 8, color: '#c9b06e', marginTop: 2 }}>☀ Sam. offert</div>}
                                {shift?.note && <div style={{ fontSize: 8, color: 'rgba(232,224,213,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{shift.note}</div>}
                                {!shift && type !== 'travail' && <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.2)', marginTop: 2 }}>par défaut</div>}
                              </div>
                            </td>
                          )
                        })}
                        <td style={{ padding: '12px 8px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmtH(stat?.heures || 0)}</div>
                          <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)' }}>semaine</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Ligne total par jour */}
                <tfoot>
                  <tr style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 10, color: 'rgba(232,224,213,0.3)', letterSpacing: 1 }}>TOTAL ÉQUIPE</td>
                    {joursSemaine.map((d, di) => {
                      const date = isoDate(d)
                      const totalJour = employes.reduce((acc, emp) => {
                        const shift = getShift(emp.id, date)
                        const type = shift?.type || getDefaultType(emp.id, date, emp.profil)
                        if (type !== 'travail') return acc
                        const s = shift || { user_id: emp.id, date, type: 'travail', matin_debut: emp.profil?.horaire_matin_debut, matin_fin: emp.profil?.horaire_matin_fin, aprem_debut: emp.profil?.horaire_aprem_debut, aprem_fin: emp.profil?.horaire_aprem_fin }
                        return acc + calcHeures(s as Shift, emp.profil)
                      }, 0)
                      return <td key={di} style={{ padding: '10px 6px', textAlign: 'center' as const, fontSize: 12, color: totalJour > 0 ? '#6ec96e' : 'rgba(232,224,213,0.2)', fontFamily: 'Georgia, serif' }}>{totalJour > 0 ? fmtH(totalJour) : '—'}</td>
                    })}
                    <td style={{ padding: '10px 8px', textAlign: 'center' as const, fontSize: 14, color: '#c9a96e', fontFamily: 'Georgia, serif', fontWeight: 600 }}>
                      {fmtH(statsEmp.reduce((a, s) => a + s.heures, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Infos employés */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 20 }}>
              {employes.map(emp => (
                <CarteEmploye key={emp.id} emp={emp} onSaved={load} />
              ))}
            </div>
          </>
        )}

        {/* ── VUE MOIS ── */}
        {vue === 'mois' && (
          <div>
            {employes.map(emp => (
              <div key={emp.id} style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, color: '#f0e8d8', fontWeight: 600 }}>{emp.prenom} {emp.nom}</div>
                    <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{SITE_NOMS[emp.profil?.site_id]}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                  {['L','M','M','J','V','S','D'].map((j,i) => <div key={i} style={{ fontSize: 9, color: 'rgba(232,224,213,0.3)', textAlign: 'center' as const, padding: '4px 0', letterSpacing: 1 }}>{j}</div>)}
                  {moisJours.pad.map((_,i) => <div key={`p${i}`} />)}
                  {moisJours.days.map(day => {
                    const date = `${moisRef.y}-${String(moisRef.m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                    const shift = getShift(emp.id, date)
                    const defaultType = getDefaultType(emp.id, date, emp.profil)
                    const type = shift?.type || defaultType
                    const { color, bg } = TYPES_SHIFT[type] || TYPES_SHIFT.repos
                    const isToday = date === today
                    const dow = new Date(date + 'T12:00:00').getDay()
                    const isWE = dow === 0 || dow === 1
                    return (
                      <div key={day} onClick={() => handleCellClick(emp, date)}
                        title={getFerieLabel(date) || undefined}
                        style={{ background: isToday ? 'rgba(201,169,110,0.15)' : type !== 'repos' ? bg : isWE ? 'transparent' : 'rgba(255,255,255,0.02)', border: `0.5px solid ${isToday ? '#c9a96e' : type !== 'repos' ? color + '30' : 'rgba(255,255,255,0.04)'}`, borderRadius: 4, padding: '5px 3px', cursor: 'pointer', minHeight: 44, textAlign: 'center' as const, opacity: isWE && type === 'repos' ? 0.3 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = isWE && type === 'repos' ? '0.3' : '1')}>
                        <div style={{ fontSize: 10, color: isToday ? '#c9a96e' : 'rgba(232,224,213,0.5)', marginBottom: 2 }}>{day}</div>
                        <div style={{ fontSize: 11, color }}>{TYPES_SHIFT[type]?.icon}</div>
                        {type === 'travail' && <div style={{ fontSize: 8, color: 'rgba(232,224,213,0.4)' }}>{fmtH(calcHeures(shift || { user_id: emp.id, date, type: 'travail', matin_debut: emp.profil?.horaire_matin_debut, matin_fin: emp.profil?.horaire_matin_fin, aprem_debut: emp.profil?.horaire_aprem_debut, aprem_fin: emp.profil?.horaire_aprem_fin }, emp.profil))}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editModal && (
        <ModalShift shift={editModal.shift} profil={editModal.profil} user={editModal.user} date={editModal.date} onSave={handleSaveShift} onClose={() => setEditModal(null)} />
      )}
    </div>
  )
}

// ── Vue employé planning ──────────────────────────────────────
function PlanningEmploye({ user }: { user: User }) {
  const [vue, setVue] = useState<'semaine' | 'mois'>('semaine')
  const [profil, setProfil] = useState<Profil | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [semaine, setSemaine] = useState(getMonday(new Date()))
  const [moisRef, setMoisRef] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() })
  const [loading, setLoading] = useState(true)
  const today = isoDate(new Date())

  const joursSemaine = Array.from({ length: 7 }, (_, i) => { const d = new Date(semaine); d.setDate(d.getDate() + i); return d })

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: dem }] = await Promise.all([
        supabase.from('employe_profils').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('conges_demandes').select('*').eq('user_id', user.id).eq('statut', 'approuve'),
      ])
      setProfil(p)
      setDemandes(dem || [])
      setLoading(false)
    })()
  }, [user.id])

  // Charger les shifts selon la vue
  useEffect(() => {
    (async () => {
      let debut: string, fin: string
      if (vue === 'semaine') {
        debut = isoDate(semaine); fin = isoDate(joursSemaine[6])
      } else {
        const first = new Date(moisRef.y, moisRef.m, 1)
        const last = new Date(moisRef.y, moisRef.m + 1, 0)
        debut = isoDate(first); fin = isoDate(last)
      }
      const { data: s } = await supabase.from('planning_shifts').select('*').eq('user_id', user.id).gte('date', debut).lte('date', fin)
      setShifts(s || [])
    })()
  }, [vue, semaine, moisRef.y, moisRef.m, user.id])

  const getShift = (date: string) => shifts.find(s => s.date === date)
  const isConge = (date: string) => demandes.some(d => date >= d.date_debut && date <= d.date_fin)
  const getDefaultType = (date: string): string => {
    const dow = new Date(date + 'T12:00:00').getDay()
    if (dow === 0 || dow === 1) return 'repos'
    if (isConge(date)) return 'conge'
    if (getFerieLabel(date)) return 'ferie'
    const jours: number[] = Array.isArray(profil?.jours_travail) && profil.jours_travail.length > 0
      ? profil.jours_travail : [2,3,4,5,6]
    if (!jours.includes(dow)) return 'repos'
    return 'travail'
  }

  const calcDayHeures = (date: string, shift?: Shift): number => {
    const type = shift?.type || getDefaultType(date)
    if (type !== 'travail') return 0
    const h = getHorairesJour(profil as Profil, date)
    const s = shift || { user_id: user.id, date, type: 'travail', matin_debut: h.matin_debut, matin_fin: h.matin_fin, aprem_debut: h.aprem_debut, aprem_fin: h.aprem_fin }
    return calcHeures(s as Shift, profil as Profil)
  }

  const totalSemaine = joursSemaine.reduce((acc, d) => acc + calcDayHeures(isoDate(d), getShift(isoDate(d))), 0)

  // Pour la vue mois
  const moisJours = (() => {
    const first = new Date(moisRef.y, moisRef.m, 1)
    const last = new Date(moisRef.y, moisRef.m + 1, 0)
    const startDow = (first.getDay() + 6) % 7 // lundi=0
    const days = Array.from({ length: last.getDate() }, (_, i) => i + 1)
    const pad = Array.from({ length: startDow })
    return { days, pad, first, last }
  })()
  const totalMois = (() => {
    let total = 0
    for (let day = 1; day <= moisJours.last.getDate(); day++) {
      const date = `${moisRef.y}-${String(moisRef.m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      total += calcDayHeures(date, getShift(date))
    }
    return total
  })()

  if (loading) return <div style={{ minHeight: '100vh', background: '#0d0a08', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,224,213,0.3)' }}>⟳ Chargement...</div>

  const btnNav = { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: '#e8e0d5', borderRadius: 4, padding: '7px 12px', fontSize: 13, cursor: 'pointer' }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a08', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#e8e0d5' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', background: '#100d0a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#c9a96e' }}>Mon planning — {user.prenom}</div>
          <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.35)' }}>{SITE_NOMS[profil?.site_id || '']}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/admin/conges" style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', textDecoration: 'none' }}>Mes congés →</a>
          <a href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(232,224,213,0.6)', textDecoration: 'none', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 14px' }}>← Retour</a>
        </div>
      </div>

      <div style={{ padding: '20px', maxWidth: 1000, margin: '0 auto' }}>
        {/* Toggle vue + Navigation */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap' as const }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            {[['semaine','Semaine'],['mois','Mois']].map(([v,l]) => (
              <button key={v} onClick={() => setVue(v as any)} style={{ background: vue === v ? 'rgba(201,169,110,0.15)' : 'transparent', border: 'none', color: vue === v ? '#c9a96e' : 'rgba(232,224,213,0.4)', padding: '7px 18px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{l}</button>
            ))}
          </div>

          {vue === 'semaine' ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setSemaine(d => { const nd = new Date(d); nd.setDate(nd.getDate()-7); return nd })} style={btnNav}>‹</button>
              <button onClick={() => setSemaine(getMonday(new Date()))} style={{ ...btnNav, fontSize: 11, color: '#c9a96e', borderColor: 'rgba(201,169,110,0.3)' }}>Aujourd'hui</button>
              <span style={{ fontSize: 13, color: '#f0e8d8', minWidth: 200, textAlign: 'center' as const }}>
                {joursSemaine[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {joursSemaine[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <button onClick={() => setSemaine(d => { const nd = new Date(d); nd.setDate(nd.getDate()+7); return nd })} style={btnNav}>›</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => setMoisRef(r => r.m === 0 ? { y: r.y-1, m: 11 } : { y: r.y, m: r.m-1 })} style={btnNav}>‹</button>
              <span style={{ fontSize: 13, color: '#f0e8d8', minWidth: 160, textAlign: 'center' as const, textTransform: 'capitalize' as const }}>
                {new Date(moisRef.y, moisRef.m).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setMoisRef(r => r.m === 11 ? { y: r.y+1, m: 0 } : { y: r.y, m: r.m+1 })} style={btnNav}>›</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.4)' }}>Total :</div>
            <div style={{ fontSize: 18, color: '#c9a96e', fontFamily: 'Georgia, serif' }}>{fmtH(vue === 'semaine' ? totalSemaine : totalMois)}</div>
          </div>
        </div>

        {/* ── VUE SEMAINE ── */}
        {vue === 'semaine' && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {joursSemaine.map((d, i) => {
              const date = isoDate(d); const shift = getShift(date)
              const type = shift?.type || getDefaultType(date)
              const { color, bg, icon, label } = TYPES_SHIFT[type] || TYPES_SHIFT.repos
              const isToday = date === today
              const dow = d.getDay(); const isWE = dow === 0 || dow === 1
              const h = calcDayHeures(date, shift)
              const horaires = getHorairesJour(profil as Profil, date)
              return (
                <div key={i} style={{ background: isWE && type === 'repos' ? 'rgba(255,255,255,0.01)' : bg, border: `0.5px solid ${isToday ? '#c9a96e' : type !== 'repos' ? color + '40' : 'rgba(255,255,255,0.05)'}`, borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: isWE ? 0.5 : 1 }}>
                  <div>
                    <div style={{ fontSize: 13, color: isToday ? '#c9a96e' : '#f0e8d8', fontWeight: isToday ? 700 : 400 }}>
                      {JOURS_LONG[d.getDay()]} {d.getDate()}
                      {isToday && <span style={{ fontSize: 10, background: 'rgba(201,169,110,0.2)', color: '#c9a96e', borderRadius: 3, padding: '2px 6px', marginLeft: 8 }}>Aujourd'hui</span>}
                      {type === 'ferie' && getFerieLabel(date) && <span style={{ fontSize: 10, background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderRadius: 3, padding: '2px 6px', marginLeft: 8 }}>🇫🇷 {getFerieLabel(date)}</span>}
                    </div>
                    {type === 'travail' && (
                      <div style={{ fontSize: 12, color: 'rgba(232,224,213,0.5)', marginTop: 4 }}>
                        {shift?.matin_debut || horaires.matin_debut} – {shift?.matin_fin || horaires.matin_fin} &nbsp;·&nbsp; {shift?.aprem_debut || horaires.aprem_debut} – {shift?.aprem_fin || horaires.aprem_fin}
                      </div>
                    )}
                    {shift?.note && <div style={{ fontSize: 11, color: 'rgba(232,224,213,0.4)', marginTop: 2 }}>{shift.note}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {type === 'travail' && <div style={{ fontSize: 18, color, fontFamily: 'Georgia, serif' }}>{fmtH(h)}</div>}
                    <div style={{ fontSize: 18, color }}>{icon}</div>
                    {type !== 'travail' && <div style={{ fontSize: 12, color }}>{label}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── VUE MOIS ── */}
        {vue === 'mois' && (
          <div style={{ background: '#18130e', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 12 }}>
              {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(j => <div key={j} style={{ fontSize: 10, color: 'rgba(232,224,213,0.35)', textAlign: 'center' as const, padding: '6px 0', letterSpacing: 1.5 }}>{j}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
              {moisJours.pad.map((_,i) => <div key={`p${i}`} />)}
              {moisJours.days.map(day => {
                const date = `${moisRef.y}-${String(moisRef.m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const shift = getShift(date)
                const type = shift?.type || getDefaultType(date)
                const { color, bg, icon } = TYPES_SHIFT[type] || TYPES_SHIFT.repos
                const isToday = date === today
                const dow = new Date(date + 'T12:00:00').getDay()
                const isWE = dow === 0 || dow === 1
                const h = calcDayHeures(date, shift)
                return (
                  <div key={day} title={getFerieLabel(date) || undefined} style={{
                    background: isToday ? 'rgba(201,169,110,0.15)' : type !== 'repos' ? bg : isWE ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
                    border: `0.5px solid ${isToday ? '#c9a96e' : type !== 'repos' ? color + '30' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: 6, padding: '8px 4px', minHeight: 64,
                    textAlign: 'center' as const,
                    opacity: isWE && type === 'repos' ? 0.35 : 1,
                  }}>
                    <div style={{ fontSize: 11, color: isToday ? '#c9a96e' : 'rgba(232,224,213,0.5)', marginBottom: 4, fontWeight: isToday ? 700 : 400 }}>{day}</div>
                    <div style={{ fontSize: 13, color }}>{icon}</div>
                    {type === 'travail' && <div style={{ fontSize: 9, color: 'rgba(232,224,213,0.5)', marginTop: 2 }}>{fmtH(h)}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Page principale ───────────────────────────────────────────
export default function PlanningPage() {
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

  if (user.role === 'admin') return <PlanningAdmin admin={user} />
  return <PlanningEmploye user={user} />
}