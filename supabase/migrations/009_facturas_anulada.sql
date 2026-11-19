-- F4 fix: columna anulada para notas de crédito
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS anulada boolean NOT NULL DEFAULT false;
