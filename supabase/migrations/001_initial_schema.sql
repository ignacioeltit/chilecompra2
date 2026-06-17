-- ============================================================
-- Chilecompra2 — Schema inicial
-- Ejecutar en Supabase SQL Editor o con supabase db push
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- full-text search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE estado_licitacion AS ENUM (
  'sin_definir',
  'pendiente_enviar',
  'revisar',
  'enviada',
  'no_participe',
  'cancelada',
  'revisado'
);

CREATE TYPE resultado_licitacion AS ENUM (
  'ganada',
  'perdida',
  'desierta',
  'cerrada_sin_adj'
);

CREATE TYPE estado_oc AS ENUM (
  'emitida',
  'aceptada',
  'facturada',
  'pagada'
);

CREATE TYPE rol_usuario AS ENUM (
  'admin',
  'editor',
  'lector'
);

CREATE TYPE categoria_alerta AS ENUM (
  'resultado_registrado',
  'revisar_resultado',
  'pendiente_revision',
  'pendiente_enviar',
  'cotizada',
  'cerrada_sin_cotizar',
  'urgente',
  'pronto',
  'sin_definir',
  'revisado',
  'ok'
);

-- ============================================================
-- TABLA: organizaciones (multi-tenant)
-- ============================================================

CREATE TABLE organizaciones (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      text NOT NULL,
  slug        text UNIQUE NOT NULL,
  creado_en   timestamptz DEFAULT now()
);

-- ============================================================
-- TABLA: usuarios (extiende auth.users)
-- ============================================================

CREATE TABLE usuarios (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  email       text NOT NULL,
  nombre      text,
  rol         rol_usuario NOT NULL DEFAULT 'editor',
  push_subscription jsonb,               -- Web Push endpoint+keys
  notif_urgente      boolean DEFAULT true,
  notif_pronto       boolean DEFAULT true,
  notif_resultado    boolean DEFAULT true,
  notif_email        boolean DEFAULT true,
  creado_en   timestamptz DEFAULT now(),
  UNIQUE(id, org_id)
);

-- ============================================================
-- TABLA: instituciones (maestro)
-- ============================================================

CREATE TABLE instituciones (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  region      text,
  rut         text,
  creado_en   timestamptz DEFAULT now(),
  UNIQUE(org_id, nombre)
);

-- ============================================================
-- TABLA: licitaciones
-- ============================================================

CREATE TABLE licitaciones (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id               uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  codigo_chilecompra   text NOT NULL,
  nombre               text NOT NULL,
  fecha_publicacion    timestamptz,
  fecha_cierre_1       timestamptz NOT NULL,
  fecha_cierre_2       timestamptz,
  estado               estado_licitacion NOT NULL DEFAULT 'sin_definir',
  resultado            resultado_licitacion,
  institucion_id       uuid REFERENCES instituciones(id) ON DELETE SET NULL,
  institucion          text NOT NULL,             -- desnormalizado para búsqueda rápida
  descripcion          text,
  contacto_nombre      text,
  contacto_telefono    text CHECK (
                         contacto_telefono IS NULL
                         OR contacto_telefono ~ '^\+569[0-9]{8}$'
                       ),
  orden_compra         text,
  estado_oc            estado_oc,
  monto_clp            numeric(15,2),
  numero_factura       text,
  fecha_emision_factura timestamptz,
  fecha_pago           timestamptz,
  asignado_a           uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  notas                text,
  creado_por           uuid NOT NULL REFERENCES usuarios(id),
  creado_en            timestamptz DEFAULT now(),
  actualizado_en       timestamptz DEFAULT now(),
  -- búsqueda full-text
  fts                  tsvector GENERATED ALWAYS AS (
                         to_tsvector('spanish', coalesce(nombre,'') || ' ' || coalesce(codigo_chilecompra,'') || ' ' || coalesce(institucion,'') || ' ' || coalesce(descripcion,''))
                       ) STORED,
  UNIQUE(org_id, codigo_chilecompra)
);

CREATE INDEX licitaciones_fts_idx   ON licitaciones USING GIN(fts);
CREATE INDEX licitaciones_org_idx   ON licitaciones(org_id);
CREATE INDEX licitaciones_estado_idx ON licitaciones(estado);
CREATE INDEX licitaciones_cierre_idx ON licitaciones(fecha_cierre_1);
CREATE INDEX licitaciones_asig_idx  ON licitaciones(asignado_a);

-- ============================================================
-- TABLA: adjuntos
-- ============================================================

CREATE TABLE adjuntos (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  licitacion_id    uuid NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  nombre_archivo   text NOT NULL,
  url_storage      text NOT NULL,
  mime_type        text,
  tamano_bytes     bigint,
  subido_por       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  subido_en        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLA: auditoria
-- ============================================================

CREATE TABLE auditoria (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  licitacion_id   uuid NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  usuario_id      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  campo           text NOT NULL,
  valor_anterior  text,
  valor_nuevo     text,
  timestamp       timestamptz DEFAULT now()
);

CREATE INDEX auditoria_lic_idx ON auditoria(licitacion_id, timestamp DESC);

-- ============================================================
-- TABLA: push_notificaciones (historial de envíos)
-- ============================================================

CREATE TABLE push_notificaciones (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  licitacion_id   uuid REFERENCES licitaciones(id) ON DELETE CASCADE,
  usuario_id      uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo            text NOT NULL,        -- 'urgente', 'pronto', etc.
  canal           text NOT NULL,        -- 'push', 'email'
  enviado_en      timestamptz DEFAULT now(),
  enviado_en_hour timestamptz
);

-- Trigger para mantener 'enviado_en_hour' (hora truncada) actualizado
CREATE OR REPLACE FUNCTION set_enviado_en_hour()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.enviado_en IS NULL THEN
    NEW.enviado_en := now();
  END IF;
  NEW.enviado_en_hour := date_trunc('hour', NEW.enviado_en);
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_notificaciones_set_hour
  BEFORE INSERT OR UPDATE ON push_notificaciones
  FOR EACH ROW EXECUTE FUNCTION set_enviado_en_hour();

-- ============================================================
-- FUNCIÓN: actualizar updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER licitaciones_updated
  BEFORE UPDATE ON licitaciones
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ============================================================
-- FUNCIÓN: trigger de auditoría
-- ============================================================

CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  col TEXT;
  old_val TEXT;
  new_val TEXT;
  uid uuid;
BEGIN
  -- Obtener usuario de la sesión
  uid := auth.uid();

  -- Comparar cada columna relevante
  FOREACH col IN ARRAY ARRAY[
    'estado','resultado','estado_oc','orden_compra',
    'monto_clp','numero_factura','fecha_emision_factura','fecha_pago',
    'asignado_a','fecha_cierre_1','fecha_cierre_2',
    'notas','contacto_nombre','contacto_telefono'
  ] LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col, col)
      INTO old_val, new_val USING OLD, NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO auditoria(licitacion_id, usuario_id, campo, valor_anterior, valor_nuevo)
      VALUES(NEW.id, uid, col, old_val, new_val);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER licitaciones_auditoria
  AFTER UPDATE ON licitaciones
  FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- ============================================================
-- VISTA: categoria_alerta (lógica de prioridad)
-- ============================================================

CREATE OR REPLACE VIEW v_licitaciones_con_alerta AS
SELECT
  l.*,
  EXTRACT(EPOCH FROM (l.fecha_cierre_1 - now())) / 3600 AS horas_restantes,
  CASE
    -- 1. Revisado (solo seguimiento/intel, sin acción pendiente)
    WHEN l.estado = 'revisado'
    THEN 'revisado'::categoria_alerta

    -- 2. Resultado ya registrado o estado final
    WHEN l.resultado IS NOT NULL
      OR l.estado IN ('cancelada', 'no_participe')
    THEN 'resultado_registrado'::categoria_alerta

    -- 3. Enviada, ya cerró, sin resultado
    WHEN l.estado = 'enviada'
      AND l.fecha_cierre_1 < now()
      AND l.resultado IS NULL
    THEN 'revisar_resultado'::categoria_alerta

    -- 3. Enviar lunes
    --4. Revisión pendiente
    WHEN l.estado = 'revisar'
    THEN 'pendiente_revision'::categoria_alerta

    -- 5. Pendiente de envío
    WHEN l.estado = 'pendiente_enviar'
    THEN 'pendiente_enviar'::categoria_alerta

    -- 6. Enviada, aún no cierra
    WHEN l.estado = 'enviada'
      AND l.fecha_cierre_1 >= now()
    THEN 'cotizada'::categoria_alerta

    -- 7. Cerró sin que cotizáramos
    WHEN l.fecha_cierre_1 < now()
      AND l.estado NOT IN ('enviada', 'cancelada', 'no_participe', 'revisado')
    THEN 'cerrada_sin_cotizar'::categoria_alerta

    -- 8. Urgente (≤24h)
    WHEN EXTRACT(EPOCH FROM (l.fecha_cierre_1 - now())) / 3600 <= 24
    THEN 'urgente'::categoria_alerta

    -- 9. Pronto (≤72h)
    WHEN EXTRACT(EPOCH FROM (l.fecha_cierre_1 - now())) / 3600 <= 72
    THEN 'pronto'::categoria_alerta

    -- 10. Sin definir
    WHEN l.estado = 'sin_definir'
    THEN 'sin_definir'::categoria_alerta

    -- 11. Default
    ELSE 'ok'::categoria_alerta
  END AS categoria_alerta_calc

FROM licitaciones l;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE instituciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE licitaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjuntos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria         ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notificaciones ENABLE ROW LEVEL SECURITY;

-- Helper: obtener org_id del usuario autenticado
CREATE OR REPLACE FUNCTION mi_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM usuarios WHERE id = auth.uid();
$$;

-- Helper: obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION mi_rol()
RETURNS rol_usuario LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid();
$$;

-- ORGANIZACIONES: solo ver la propia
CREATE POLICY "ver_propia_org" ON organizaciones
  FOR SELECT USING (id = mi_org_id());

-- USUARIOS: ver miembros de la misma org
CREATE POLICY "ver_usuarios_org" ON usuarios
  FOR SELECT USING (org_id = mi_org_id());

CREATE POLICY "editar_perfil_propio" ON usuarios
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "admin_gestiona_usuarios" ON usuarios
  FOR ALL USING (mi_rol() = 'admin' AND org_id = mi_org_id());

-- INSTITUCIONES
CREATE POLICY "ver_instituciones" ON instituciones
  FOR SELECT USING (org_id = mi_org_id());

CREATE POLICY "editar_instituciones" ON instituciones
  FOR INSERT WITH CHECK (org_id = mi_org_id() AND mi_rol() IN ('admin','editor'));

CREATE POLICY "update_instituciones" ON instituciones
  FOR UPDATE USING (org_id = mi_org_id() AND mi_rol() IN ('admin','editor'));

-- LICITACIONES: SELECT para todos en la org
CREATE POLICY "ver_licitaciones" ON licitaciones
  FOR SELECT USING (org_id = mi_org_id());

-- INSERT: admin y editor
CREATE POLICY "crear_licitaciones" ON licitaciones
  FOR INSERT WITH CHECK (org_id = mi_org_id() AND mi_rol() IN ('admin','editor'));

-- UPDATE: admin y editor
CREATE POLICY "editar_licitaciones" ON licitaciones
  FOR UPDATE USING (org_id = mi_org_id() AND mi_rol() IN ('admin','editor'));

-- DELETE: solo admin
CREATE POLICY "eliminar_licitaciones" ON licitaciones
  FOR DELETE USING (org_id = mi_org_id() AND mi_rol() = 'admin');

-- ADJUNTOS
CREATE POLICY "ver_adjuntos" ON adjuntos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM licitaciones l WHERE l.id = licitacion_id AND l.org_id = mi_org_id())
  );

CREATE POLICY "subir_adjuntos" ON adjuntos
  FOR INSERT WITH CHECK (
    mi_rol() IN ('admin','editor')
    AND EXISTS (SELECT 1 FROM licitaciones l WHERE l.id = licitacion_id AND l.org_id = mi_org_id())
  );

-- AUDITORIA: solo lectura para todos
CREATE POLICY "ver_auditoria" ON auditoria
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM licitaciones l WHERE l.id = licitacion_id AND l.org_id = mi_org_id())
  );

-- ============================================================
-- FUNCIÓN: buscar licitaciones (full-text + filtros)
-- ============================================================

CREATE OR REPLACE FUNCTION buscar_licitaciones(
  p_org_id       uuid,
  p_query        text DEFAULT NULL,
  p_estado       estado_licitacion[] DEFAULT NULL,
  p_resultado    resultado_licitacion[] DEFAULT NULL,
  p_asignado_a   uuid DEFAULT NULL,
  p_fecha_desde  timestamptz DEFAULT NULL,
  p_fecha_hasta  timestamptz DEFAULT NULL,
  p_limit        int DEFAULT 50,
  p_offset       int DEFAULT 0
)
RETURNS TABLE (
  id uuid, org_id uuid, codigo_chilecompra text, nombre text,
  fecha_publicacion timestamptz, fecha_cierre_1 timestamptz, fecha_cierre_2 timestamptz,
  estado estado_licitacion, resultado resultado_licitacion,
  institucion text, descripcion text, orden_compra text, estado_oc estado_oc, monto_clp numeric,
  numero_factura text, fecha_emision_factura timestamptz, fecha_pago timestamptz,
  asignado_a uuid, notas text, creado_por uuid, creado_en timestamptz, actualizado_en timestamptz,
  horas_restantes float, categoria_alerta_calc categoria_alerta
)
LANGUAGE sql STABLE AS $$
  SELECT
    v.id, v.org_id, v.codigo_chilecompra, v.nombre,
    v.fecha_publicacion, v.fecha_cierre_1, v.fecha_cierre_2,
    v.estado, v.resultado,
    v.institucion, v.descripcion, v.orden_compra, v.estado_oc, v.monto_clp,
    v.numero_factura, v.fecha_emision_factura, v.fecha_pago,
    v.asignado_a, v.notas, v.creado_por, v.creado_en, v.actualizado_en,
    v.horas_restantes, v.categoria_alerta_calc
  FROM v_licitaciones_con_alerta v
  WHERE v.org_id = p_org_id
    AND (p_query IS NULL OR v.fts @@ websearch_to_tsquery('spanish', p_query))
    AND (p_estado IS NULL OR v.estado = ANY(p_estado))
    AND (p_resultado IS NULL OR v.resultado = ANY(p_resultado))
    AND (p_asignado_a IS NULL OR v.asignado_a = p_asignado_a)
    AND (p_fecha_desde IS NULL OR v.fecha_cierre_1 >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR v.fecha_cierre_1 <= p_fecha_hasta)
  ORDER BY
    CASE WHEN v.categoria_alerta_calc = 'urgente' THEN 0
         WHEN v.categoria_alerta_calc = 'pronto' THEN 1
         WHEN v.categoria_alerta_calc = 'revisar_resultado' THEN 2
         WHEN v.categoria_alerta_calc = 'pendiente_enviar' THEN 3
         WHEN v.categoria_alerta_calc = 'pendiente_revision' THEN 5
         WHEN v.categoria_alerta_calc = 'cotizada' THEN 6
         WHEN v.categoria_alerta_calc = 'sin_definir' THEN 7
         ELSE 8
    END,
    v.fecha_cierre_1 ASC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================================
-- STORAGE: bucket para adjuntos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('adjuntos', 'adjuntos', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "adjuntos_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'adjuntos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "adjuntos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'adjuntos'
    AND auth.role() = 'authenticated'
  );

CREATE UNIQUE INDEX IF NOT EXISTS unique_notificacion_por_hora
ON push_notificaciones (
  licitacion_id,
  usuario_id,
  tipo,
  canal,
  enviado_en_hour
);
