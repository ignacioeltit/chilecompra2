-- F1: Montos en pesos chilenos (enteros, sin decimales)
-- Verifica que no haya montos con decimales antes de alterar el tipo.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM facturas WHERE monto != trunc(monto)
  ) THEN
    RAISE EXCEPTION 'Hay filas en facturas con decimales en monto. Revisar y corregir antes de migrar.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM licitaciones WHERE monto_clp IS NOT NULL AND monto_clp != trunc(monto_clp)
  ) THEN
    RAISE EXCEPTION 'Hay filas en licitaciones con decimales en monto_clp. Revisar y corregir antes de migrar.';
  END IF;
END $$;

-- Cambiar tipo a numeric(15,0) con constraint de entero positivo
ALTER TABLE facturas
  ALTER COLUMN monto TYPE numeric(15,0) USING trunc(monto);

ALTER TABLE facturas
  ADD CONSTRAINT facturas_monto_entero_positivo
  CHECK (monto > 0 AND monto = trunc(monto));

ALTER TABLE licitaciones
  ALTER COLUMN monto_clp TYPE numeric(15,0) USING trunc(monto_clp);
