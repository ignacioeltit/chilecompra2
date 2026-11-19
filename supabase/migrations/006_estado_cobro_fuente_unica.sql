-- F2: Estado de pago con fuente única (tabla facturas)
-- Crea v_licitacion_cobranza con estado_cobro calculado.
-- Migra las facturas que solo existían en columnas de licitaciones.

-- ── Tipo para estado de cobro ──────────────────────────────────
DO $$ BEGIN
  CREATE TYPE estado_cobro AS ENUM (
    'sin_oc',
    'por_facturar',
    'facturada_parcial',
    'facturada',
    'pagada_parcial',
    'pagada',
    'sobrefacturada'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── Vista de cobranza por licitación ──────────────────────────
-- security_invoker=true: la vista hereda los permisos del llamador,
-- por lo que el RLS de licitaciones y facturas se aplica normalmente.
CREATE OR REPLACE VIEW v_licitacion_cobranza
  WITH (security_invoker = true) AS
SELECT
  l.id,
  l.org_id,
  l.codigo_chilecompra,
  l.nombre,
  l.institucion,
  l.orden_compra,
  l.estado_oc,
  l.monto_clp                                           AS monto_oc,
  COALESCE(f.total_facturado, 0)                        AS total_facturado,
  COALESCE(f.total_pagado, 0)                           AS total_pagado,
  COALESCE(l.monto_clp, 0) - COALESCE(f.total_facturado, 0) AS saldo_por_facturar,
  COALESCE(f.total_facturado, 0) - COALESCE(f.total_pagado, 0) AS saldo_por_cobrar,
  f.facturas_count,
  f.tiene_factura_impaga,
  CASE
    WHEN l.monto_clp IS NULL
    THEN 'sin_oc'::estado_cobro

    WHEN COALESCE(f.total_facturado, 0) = 0
    THEN 'por_facturar'::estado_cobro

    WHEN COALESCE(f.total_facturado, 0) > l.monto_clp
    THEN 'sobrefacturada'::estado_cobro

    -- pagada: total pagado >= monto OC y no hay facturas impagas vigentes
    WHEN COALESCE(f.total_pagado, 0) >= l.monto_clp
      AND NOT COALESCE(f.tiene_factura_impaga, true)
    THEN 'pagada'::estado_cobro

    -- facturado total >= OC pero algo impago
    WHEN COALESCE(f.total_facturado, 0) >= l.monto_clp
      AND COALESCE(f.total_pagado, 0) > 0
    THEN 'pagada_parcial'::estado_cobro

    WHEN COALESCE(f.total_facturado, 0) >= l.monto_clp
    THEN 'facturada'::estado_cobro

    WHEN COALESCE(f.total_facturado, 0) > 0
      AND COALESCE(f.total_pagado, 0) > 0
    THEN 'pagada_parcial'::estado_cobro

    WHEN COALESCE(f.total_facturado, 0) > 0
    THEN 'facturada_parcial'::estado_cobro

    ELSE 'por_facturar'::estado_cobro
  END AS estado_cobro

FROM licitaciones l
LEFT JOIN LATERAL (
  SELECT
    SUM(fa.monto)              AS total_facturado,
    SUM(CASE WHEN fa.fecha_pago IS NOT NULL THEN fa.monto ELSE 0 END) AS total_pagado,
    COUNT(*)                   AS facturas_count,
    bool_or(fa.fecha_pago IS NULL) AS tiene_factura_impaga
  FROM facturas fa
  WHERE fa.licitacion_id = l.id
) f ON true;

-- ── Migración: licitaciones con numero_factura sin fila en facturas ──
-- Crea las facturas faltantes a partir de los campos deprecados.
INSERT INTO facturas (org_id, licitacion_id, numero, monto, fecha_emision, fecha_pago, metodo_pago, notas)
SELECT
  l.org_id,
  l.id,
  l.numero_factura,
  l.monto_clp,
  COALESCE(l.fecha_emision_factura::date, l.creado_en::date),
  l.fecha_pago::date,
  NULL,
  'migrada desde licitaciones'
FROM licitaciones l
WHERE l.numero_factura IS NOT NULL
  AND l.monto_clp IS NOT NULL
  AND l.monto_clp > 0
  AND NOT EXISTS (
    SELECT 1 FROM facturas f
    WHERE f.licitacion_id = l.id
      AND f.numero = l.numero_factura
  );

-- Permisos: solo rol authenticated; anon no debe ver datos de cobranza
REVOKE ALL ON v_licitacion_cobranza FROM anon;
GRANT SELECT ON v_licitacion_cobranza TO authenticated;

-- Nota: numero_factura, fecha_emision_factura y fecha_pago de licitaciones
-- quedan DEPRECADOS (no se escriben ni leen desde la app). No se borran todavía.
COMMENT ON COLUMN licitaciones.numero_factura IS 'DEPRECADO — usar tabla facturas';
COMMENT ON COLUMN licitaciones.fecha_emision_factura IS 'DEPRECADO — usar tabla facturas';
COMMENT ON COLUMN licitaciones.fecha_pago IS 'DEPRECADO — usar tabla facturas';
