-- Recrea la vista para incluir columnas agregadas después de su creación inicial
-- (numero_factura, fecha_emision_factura, fecha_pago, descripcion, etc.)
CREATE OR REPLACE VIEW v_licitaciones_con_alerta AS
SELECT
  l.*,
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
  END AS categoria_alerta_calc

FROM licitaciones l;
