═══════════════════════════════════════════════════════════════
FIX COMPTABILITÉ STOCK FÛTS — VERSION 2
═══════════════════════════════════════════════════════════════

Logique métier : ne JAMAIS compter sur un retour de fût non percuté.
Si stock disponible (après les autres résas) < quantité demandée,
alors la TOTALITÉ de la quantité demandée est en rupture.

───────────────────────────────────────────────────────────────
EMPLACEMENT 1 : dans src/app/admin/location/page.tsx
fonction load() — bloc de calcul des alertes
───────────────────────────────────────────────────────────────

REMPLACER tout le bloc actuel par celui-ci :

    // ── ALERTES STOCK : règle stricte ──
    // Pour chaque réservation confirmée, calculer le stock disponible
    // après déduction des autres résas chevauchantes. Si insuffisant,
    // la quantité ENTIÈRE demandée est marquée en rupture (jamais de
    // compensation par retours de fûts non percutés).
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

        // Stock disponible pour cette résa
        const dispoPourMoi = fut.stock_actuel - qteAutresChevauchent

        if (dispoPourMoi < monLigne.quantite) {
          // Manque = TOUT ce qui est demandé si dispo <= 0
          // Manque = différence si dispo > 0 mais insuffisant
          const manque = dispoPourMoi <= 0 ? monLigne.quantite : (monLigne.quantite - dispoPourMoi)
          if (!alertesParResa[resa.id]) alertesParResa[resa.id] = { resa, manques: [] }
          alertesParResa[resa.id].manques.push({ fut, manque, quantite: monLigne.quantite })
        }
      }
    }
    setAlertes(Object.values(alertesParResa).sort((a: any, b: any) =>
      new Date(a.resa.date_debut).getTime() - new Date(b.resa.date_debut).getTime()
    ))

───────────────────────────────────────────────────────────────
EMPLACEMENT 2 : icône "X fût(s) en rupture" (déjà OK avec reduce)
───────────────────────────────────────────────────────────────

Si pas encore appliqué, remplacer :
  {alerteResa.manques.length} fût(s) en rupture
Par :
  {alerteResa.manques.reduce((s: number, m: any) => s + m.manque, 0)} fût(s) en rupture

───────────────────────────────────────────────────────────────
EMPLACEMENT 3 : encart Stock insuffisant (déjà OK avec "Manque X")
───────────────────────────────────────────────────────────────

Si pas encore appliqué, remplacer :
  -{m.manque} {m.fut.nom_cuvee} {m.fut.contenance_litres}L
Par :
  Manque {m.manque} × {m.fut.nom_cuvee} {m.fut.contenance_litres}L

═══════════════════════════════════════════════════════════════