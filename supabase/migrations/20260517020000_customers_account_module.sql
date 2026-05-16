-- Enrichissement de la table customers pour le module compte client boutique.
--
-- Ajoute :
--   - civilite : 'M', 'Mme', 'Autre' (libre)
--   - siret : numéro SIRET pour les clients pros (validation INSEE à venir)
--   - cgv_acceptee_le : timestamp d'acceptation des CGV
--   - majorite_certifiee_le : timestamp de la coche '18 ans ou plus'
--   - adresse_facturation_* : adresse de facturation distincte (livraison = champs existants)
--
-- Les champs prenom, nom, raison_sociale, est_societe, email, telephone, adresse,
-- code_postal, ville, pays, newsletter, tarif_pro, pro_pending existent déjà.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS civilite TEXT,
  ADD COLUMN IF NOT EXISTS siret TEXT,
  ADD COLUMN IF NOT EXISTS cgv_acceptee_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS majorite_certifiee_le TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adresse_facturation TEXT,
  ADD COLUMN IF NOT EXISTS code_postal_facturation TEXT,
  ADD COLUMN IF NOT EXISTS ville_facturation TEXT,
  ADD COLUMN IF NOT EXISTS pays_facturation TEXT;

COMMENT ON COLUMN customers.civilite IS 'M, Mme ou autre (texte libre).';
COMMENT ON COLUMN customers.siret IS 'Numéro SIRET 14 chiffres (clients pros uniquement).';
COMMENT ON COLUMN customers.cgv_acceptee_le IS 'Date d''acceptation des CGV à l''inscription.';
COMMENT ON COLUMN customers.majorite_certifiee_le IS 'Date où le client a coché "Je certifie avoir 18 ans ou plus".';
COMMENT ON COLUMN customers.adresse_facturation IS 'Adresse de facturation distincte (NULL = identique à la livraison).';
