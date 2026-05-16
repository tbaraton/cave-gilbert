-- Table des alertes "prévenez-moi quand ce produit revient en stock".
-- Inscription cliente via la fiche produit en rupture, traitement manuel
-- ou via cron qui détecte un retour de stock et envoie un email.

CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ NULL,
  CONSTRAINT stock_alerts_email_lower_unique UNIQUE (product_id, email)
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_pending
  ON stock_alerts (product_id)
  WHERE notified_at IS NULL;

COMMENT ON TABLE stock_alerts IS 'Inscriptions clients pour être alertés du retour en stock d''un produit.';
COMMENT ON COLUMN stock_alerts.notified_at IS 'Date à laquelle le client a été notifié. NULL = en attente.';
