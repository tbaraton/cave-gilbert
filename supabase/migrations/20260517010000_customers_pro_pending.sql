-- Ajoute un flag pro_pending sur customers pour gérer les demandes de
-- validation 'compte pro' depuis la boutique.
--
-- Workflow :
--   1. Un visiteur s'inscrit sur la boutique → customers.pro_pending = TRUE, tarif_pro = FALSE
--   2. L'admin valide depuis /admin/validations-pro → tarif_pro = TRUE, pro_pending = FALSE
--   3. L'admin refuse → pro_pending = FALSE (tarif_pro reste FALSE)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS pro_pending BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_customers_pro_pending
  ON customers (pro_pending)
  WHERE pro_pending = TRUE;

COMMENT ON COLUMN customers.pro_pending IS 'Demande d''accès pro en attente de validation par l''admin. TRUE après inscription via la boutique, FALSE après validation/refus.';
