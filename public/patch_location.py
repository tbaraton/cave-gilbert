#!/usr/bin/env python3
"""
Patch pour src/app/admin/location/page.tsx
Applique la règle stricte de calcul des alertes stock fûts :
- Ne jamais compter sur un retour de fût non percuté
- Si stock dispo <= 0, la totalité de la quantité demandée est en rupture
"""

import re, sys, os

path = 'src/app/admin/location/page.tsx'
if not os.path.exists(path):
    print(f"❌ Fichier introuvable : {path}")
    print("   Lancez ce script depuis la racine de votre projet Next.js")
    sys.exit(1)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── CHANGEMENT 1 : Bloc de calcul des alertes dans load() ───────────────────

OLD_BLOCK = """    // Calcul des alertes : pour chaque réservation confirmée, vérifier que la somme
    // des fûts demandés sur la même période (chevauchement de dates) ne dépasse pas
    // le stock disponible. Les réservations 'en_cours' ont déjà décrémenté physiquement
    // stock_actuel, donc on les exclut du calcul.
    const resasActives = (resasData || []).filter((r: any) => !['annulée', 'terminée'].includes(r.statut))
    const resasConfirmees = resasActives.filter((r: any) => r.statut !== 'en_cours')
    const alertesParResa: Record<string, any> = {}

    for (const resa of resasConfirmees) {
      for (const monLigne of (resa.reservation_futs || [])) {
        const futId = monLigne.fut_catalogue_id
        const fut = (futsData || []).find((f: any) => f.id === futId)
        if (!fut) continue

        // Somme des quantités demandées sur le même fût par les résas confirmées
        // qui chevauchent la période de celle-ci (incluant elle-même)
        const totalSimultane = resasConfirmees.reduce((sum: number, other: any) => {
          const overlap = new Date(other.date_debut) <= new Date(resa.date_fin)
                       && new Date(other.date_fin)  >= new Date(resa.date_debut)
          if (!overlap) return sum
          const ligne = (other.reservation_futs || []).find((x: any) => x.fut_catalogue_id === futId)
          return sum + (ligne?.quantite || 0)
        }, 0)

        if (totalSimultane > fut.stock_actuel) {
          const manque = totalSimultane - fut.stock_actuel
          if (!alertesParResa[resa.id]) alertesParResa[resa.id] = { resa, manques: [] }
          alertesParResa[resa.id].manques.push({ fut, manque, quantite: monLigne.quantite })
        }
      }
    }
    setAlertes(Object.values(alertesParResa).sort((a: any, b: any) =>
      new Date(a.resa.date_debut).getTime() - new Date(b.resa.date_debut).getTime()
    ))"""

NEW_BLOCK = """    // ── ALERTES STOCK : règle stricte ──
    // Pour chaque réservation confirmée, on calcule le stock disponible
    // APRÈS déduction des autres résas qui chevauchent. Si le dispo est <= 0,
    // la totalité de la quantité demandée est en rupture (on ne compte jamais
    // sur un retour de fût non percuté pour couvrir une future réservation).
    const resasActives = (resasData || []).filter((r: any) => !['annulée', 'terminée'].includes(r.statut))
    const resasConfirmees = resasActives.filter((r: any) => r.statut !== 'en_cours')
    const alertesParResa: Record<string, any> = {}

    for (const resa of resasConfirmees) {
      for (const monLigne of (resa.reservation_futs || [])) {
        const futId = monLigne.fut_catalogue_id
        const fut = (futsData || []).find((f: any) => f.id === futId)
        if (!fut) continue

        // Quantités prises par les AUTRES résas confirmées qui chevauchent
        const qteAutresChevauchent = resasConfirmees.reduce((sum: number, other: any) => {
          if (other.id === resa.id) return sum
          const overlap = new Date(other.date_debut) <= new Date(resa.date_fin)
                       && new Date(other.date_fin)  >= new Date(resa.date_debut)
          if (!overlap) return sum
          const ligne = (other.reservation_futs || []).find((x: any) => x.fut_catalogue_id === futId)
          return sum + (ligne?.quantite || 0)
        }, 0)

        // Stock disponible pour cette résa (peut être négatif si sur-réservé)
        const dispoPourMoi = fut.stock_actuel - qteAutresChevauchent

        if (dispoPourMoi < monLigne.quantite) {
          // Si dispo <= 0 : toute la quantité demandée est en rupture
          // Si dispo > 0 mais insuffisant : seulement la différence
          const manque = dispoPourMoi <= 0 ? monLigne.quantite : (monLigne.quantite - dispoPourMoi)
          if (!alertesParResa[resa.id]) alertesParResa[resa.id] = { resa, manques: [] }
          alertesParResa[resa.id].manques.push({ fut, manque, quantite: monLigne.quantite })
        }
      }
    }
    setAlertes(Object.values(alertesParResa).sort((a: any, b: any) =>
      new Date(a.resa.date_debut).getTime() - new Date(b.resa.date_debut).getTime()
    ))"""

if OLD_BLOCK in content:
    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    print("✓ Changement 1 appliqué : nouveau calcul alertes stock")
else:
    print("⚠ Changement 1 : bloc non trouvé (peut-être déjà appliqué ?)")

# ─── CHANGEMENT 2 : Simplifier le check stockOk dans la carte réservation ────
# Le stockOk calculé en ligne n'est pas utilisé (le rendu dépend de alerteResa)
# On le supprime pour alléger le code

OLD_STOCK_CHECK = """                          {(() => {
                            // Calculer stock dispo pour chaque fût de cette réservation
                            const stockOk = (r.reservation_futs || []).every((rf: any) => {
                              const fut = futs.find((f: any) => f.id === rf.fut_catalogue_id)
                              if (!fut) return true
                              // Fûts déjà pris par d'autres réservations actives sur la même période
                              const dejaPris = reservations
                                .filter((other: any) => other.id !== r.id && !['annulée','terminée'].includes(other.statut))
                                .reduce((acc: number, other: any) => {
                                  const overlap = new Date(other.date_debut) <= new Date(r.date_fin) && new Date(other.date_fin) >= new Date(r.date_debut)
                                  if (!overlap) return acc
                                  const autreRf = (other.reservation_futs || []).find((x: any) => x.fut_catalogue_id === rf.fut_catalogue_id)
                                  return acc + (autreRf?.quantite || 0)
                                }, 0)
                              return fut.stock_actuel - dejaPris >= rf.quantite
                            })
                            const alerteResa = alertes.find((a: any) => a.resa?.id === r.id)
                            return !alerteResa
                              ? <span style={{ fontSize: 10, background: 'rgba(110,201,110,0.1)', color: '#6ec96e', padding: '2px 8px', borderRadius: 3 }}>✓ Stock OK</span>
                              : <span style={{ fontSize: 10, background: 'rgba(201,110,110,0.15)', color: '#c96e6e', padding: '2px 8px', borderRadius: 3 }}>⚠ {alerteResa.manques.reduce((s: number, m: any) => s + m.manque, 0)} fût(s) en rupture</span>
                          })()}"""

NEW_STOCK_CHECK = """                          {(() => {
                            const alerteResa = alertes.find((a: any) => a.resa?.id === r.id)
                            return !alerteResa
                              ? <span style={{ fontSize: 10, background: 'rgba(110,201,110,0.1)', color: '#6ec96e', padding: '2px 8px', borderRadius: 3 }}>✓ Stock OK</span>
                              : <span style={{ fontSize: 10, background: 'rgba(201,110,110,0.15)', color: '#c96e6e', padding: '2px 8px', borderRadius: 3 }}>⚠ {alerteResa.manques.reduce((s: number, m: any) => s + m.manque, 0)} fût(s) en rupture</span>
                          })()}"""

if OLD_STOCK_CHECK in content:
    content = content.replace(OLD_STOCK_CHECK, NEW_STOCK_CHECK, 1)
    print("✓ Changement 2 appliqué : simplification check stock inline")
else:
    print("⚠ Changement 2 : bloc non trouvé (peut-être déjà simplifié ?)")

# Écrire le fichier modifié
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n✅ Fichier mis à jour : {path}")
print("   → git add . && git commit -m 'Fix alertes stock futs - règle stricte' && git push")