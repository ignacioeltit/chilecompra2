-- ============================================================
-- Seed: datos de ejemplo
-- Ejecutar DESPUÉS del schema y de crear al menos 1 usuario
-- Ajusta los UUIDs según tu Supabase
-- ============================================================

-- 1. Organización demo
INSERT INTO organizaciones (id, nombre, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Empresa SpA', 'demo')
ON CONFLICT DO NOTHING;

-- 2. Instituciones de ejemplo
INSERT INTO instituciones (id, org_id, nombre, region, rut) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Hospital San Borja Arriarán', 'Metropolitana', '61.602.367-0'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Municipalidad de Providencia', 'Metropolitana', '69.070.800-0'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'SERCOTEC Región del Maule', 'Maule', '71.218.700-0'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Ministerio de Educación', 'Metropolitana', '60.910.000-1'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'CONAF Los Ríos', 'Los Ríos', '61.313.000-4')
ON CONFLICT DO NOTHING;

-- 3. Licitaciones de ejemplo (reemplaza creado_por con un uuid real de auth.users)
-- Nota: usa NOW() + intervalos para que las alertas sean representativas al correr el seed

INSERT INTO licitaciones (
  id, org_id, codigo_chilecompra, nombre,
  fecha_publicacion, fecha_cierre_1, fecha_cierre_2,
  estado, resultado, institucion_id, institucion,
  orden_compra, estado_oc, monto_clp,
  notas, creado_por
)
SELECT
  id, '00000000-0000-0000-0000-000000000001'::uuid, codigo_chilecompra, nombre,
  fecha_publicacion, fecha_cierre_1, fecha_cierre_2,
  estado::estado_licitacion, resultado::resultado_licitacion,
  inst_id, institucion,
  orden_compra, estado_oc::estado_oc, monto_clp,
  notas, (SELECT id FROM auth.users LIMIT 1)
FROM (VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '3245-117-COT24', 'Suministro de insumos médicos desechables',
    NOW() - interval '5 days', NOW() + interval '18 hours', NULL,
    'pendiente_enviar', NULL,
    '10000000-0000-0000-0000-000000000001'::uuid, 'Hospital San Borja Arriarán',
    NULL, NULL, 1850000,
    'Revisar catálogo actualizado antes de cotizar. Prioridad alta.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '1987-34-LE24', 'Servicio de mantención de áreas verdes comunales',
    NOW() - interval '10 days', NOW() + interval '2 days', NULL,
    'enviada', NULL,
    '10000000-0000-0000-0000-000000000002'::uuid, 'Municipalidad de Providencia',
    NULL, NULL, 4200000,
    'Cotización enviada el ' || to_char(NOW() - interval '3 days', 'DD/MM/YYYY') || '. Esperando resultado.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '5621-88-COT24', 'Adquisición de equipos computacionales',
    NOW() - interval '20 days', NOW() - interval '3 days', NULL,
    'enviada', NULL,
    '10000000-0000-0000-0000-000000000003'::uuid, 'SERCOTEC Región del Maule',
    NULL, NULL, 3100000,
    'Ya cerró. Falta registrar si ganamos o no.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '7834-201-LP24', 'Licitación pública de servicios de seguridad',
    NOW() - interval '30 days', NOW() - interval '10 days', NULL,
    'enviada', 'ganada',
    '10000000-0000-0000-0000-000000000004'::uuid, 'Ministerio de Educación',
    'OC-2024-78341', 'aceptada', 8750000,
    '¡Ganamos! Orden de compra aceptada. Coordinar inicio de servicio para el próximo mes.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '2211-55-COT24', 'Compra de materiales forestales para reforestación',
    NOW() - interval '7 days', NOW() + interval '50 hours', NULL,
    'revisar', NULL,
    '10000000-0000-0000-0000-000000000005'::uuid, 'CONAF Los Ríos',
    NULL, NULL, 620000,
    'Revisar especificaciones técnicas con el equipo antes de decidir.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    '9901-12-COT24', 'Servicio de impresión y fotocopiado',
    NOW() - interval '3 days', NOW() + interval '6 days', NULL,
    'sin_definir', NULL,
    '10000000-0000-0000-0000-000000000002'::uuid, 'Municipalidad de Providencia',
    NULL, NULL, 890000,
    NULL,
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    '4456-77-LE24', 'Adquisición de mobiliario para oficinas',
    NOW() - interval '45 days', NOW() - interval '20 days', NULL,
    'enviada', 'perdida',
    '10000000-0000-0000-0000-000000000001'::uuid, 'Hospital San Borja Arriarán',
    NULL, NULL, 2300000,
    'Ganó proveedor con menor precio. Analizar costos para próxima oportunidad.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000008',
    '3312-44-COT24', 'Suministro de productos de limpieza industrial',
    NOW() - interval '2 days', NOW() + interval '30 minutes', NULL,
    'pendiente_enviar', NULL,
    '10000000-0000-0000-0000-000000000003'::uuid, 'SERCOTEC Región del Maule',
    NULL, NULL, 145000,
    '¡URGENTE! Cotización debe enviarse antes del cierre.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000009',
    '8877-99-LP24', 'Servicio de capacitación en seguridad laboral',
    NOW() - interval '15 days', NOW() + interval '10 days', NOW() + interval '25 days',
    'enviar_lunes', NULL,
    '10000000-0000-0000-0000-000000000004'::uuid, 'Ministerio de Educación',
    NULL, NULL, 5600000,
    'Hay segundo llamado. Enviar cotización el próximo lunes sin falta.',
    NULL, NULL
  ),
  (
    '20000000-0000-0000-0000-000000000010',
    '1123-66-COT24', 'Adquisición de vehículos livianos para fiscalización',
    NOW() - interval '60 days', NOW() - interval '30 days', NULL,
    'no_participe', NULL,
    '10000000-0000-0000-0000-000000000005'::uuid, 'CONAF Los Ríos',
    NULL, NULL, NULL,
    'Decidimos no participar — requisitos de experiencia previa que no cumplíamos.',
    NULL, NULL
  )
) AS t(id, codigo_chilecompra, nombre, fecha_publicacion, fecha_cierre_1, fecha_cierre_2,
       estado, resultado, inst_id, institucion, orden_compra, estado_oc, monto_clp, notas, extra1, extra2)
ON CONFLICT DO NOTHING;
