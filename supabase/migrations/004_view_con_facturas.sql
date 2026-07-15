-- Recrea v_licitaciones_con_alerta agregando los datos de la tabla `facturas`
-- (facturación parcial, migración 003). Antes la vista no los incluía, por lo que
-- el dashboard mostraba el campo antiguo licitaciones.numero_factura (vacío).
--
-- IMPORTANTE (drift de producción):
--   * La función buscar_licitaciones() depende de esta vista → no se puede DROP.
--   * La tabla licitaciones ganó columnas después de crear la vista (ej.
--     metodo_pago), así que `l.*` reordena las columnas y CREATE OR REPLACE con
--     `l.*` falla (42P16).
-- Por eso se listan EXPLÍCITAMENTE las 26 columnas que la vista ya expone (en su
-- orden actual) + horas_restantes + categoria_alerta_calc, y se AGREGAN al final
-- las 5 columnas de facturas. Al ser append-only, CREATE OR REPLACE funciona y la
-- función dependiente sigue válida.

CREATE OR REPLACE VIEW v_licitaciones_con_alerta AS
SELECT
  l.id,
  l.org_id,
  l.codigo_chilecompra,
  l.nombre,
  l.fecha_publicacion,
  l.fecha_cierre_1,
  l.fecha_cierre_2,
  l.estado,
  l.resultado,
  l.institucion_id,
  l.institucion,
  l.contacto_nombre,
  l.contacto_telefono,
  l.orden_compra,
  l.estado_oc,
  l.monto_clp,
  l.asignado_a,
  l.notas,
  l.creado_por,
  l.creado_en,
  l.actualizado_en,
  l.fts,
  l.numero_factura,
  l.fecha_emision_factura,
  l.fecha_pago,
  l.descripcion,
  EXTRACT(EPOCH FROM (l.fecha_cierre_1 - now())) / 3600 AS horas_restantes,
  CASE
    WHEN l.estado = 'revisado'
    THEN 'revisado'::categoria_alerta

    WHEN l.resultado IS NOT NULL
      OR l.estado IN ('cancelada', 'no_participe')
    THEN 'resultado_registrado'::categoria_alerta

    WHEN l.estado = 'enviada'
      AND l.fecha_cierre_1 < now()
      AND l.resultado IS NULL
    THEN 'revisar_resultado'::categoria_alerta

    WHEN l.estado = 'revisar'
    THEN 'pendiente_revision'::categoria_alerta

    WHEN l.estado = 'pendiente_enviar'
    THEN 'pendiente_enviar'::categoria_alerta

    WHEN l.estado = 'enviada'
      AND l.fecha_cierre_1 >= now()
    THEN 'cotizada'::categoria_alerta

    WHEN l.fecha_cierre_1 < now()
      AND l.estado NOT IN ('enviada', 'cancelada', 'no_participe', 'revisado')
    THEN 'cerrada_sin_cotizar'::categoria_alerta

    WHEN EXTRACT(EPOCH FROM (l.fecha_cierre_1 - now())) / 3600 <= 24
    THEN 'urgente'::categoria_alerta

    WHEN EXTRACT(EPOCH FROM (l.fecha_cierre_1 - now())) / 3600 <= 72
    THEN 'pronto'::categoria_alerta

    WHEN l.estado = 'sin_definir'
    THEN 'sin_definir'::categoria_alerta

    ELSE 'ok'::categoria_alerta
  END AS categoria_alerta_calc,

  -- Columnas NUEVAS (agregadas al final): datos de las facturas parciales
  f.facturas_numeros,
  f.monto_facturado,
  f.facturas_count,
  f.ultima_emision_factura,
  f.tiene_factura_impaga

FROM licitaciones l
LEFT JOIN LATERAL (
  SELECT
    string_agg(fa.numero, ', ' ORDER BY fa.fecha_emision, fa.creado_en) AS facturas_numeros,
    SUM(fa.monto)                                                       AS monto_facturado,
    COUNT(*)                                                            AS facturas_count,
    MAX(fa.fecha_emision)                                               AS ultima_emision_factura,
    bool_or(fa.fecha_pago IS NULL)                                      AS tiene_factura_impaga
  FROM facturas fa
  WHERE fa.licitacion_id = l.id
) f ON true;
