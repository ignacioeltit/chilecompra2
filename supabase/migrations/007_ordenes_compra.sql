-- F3: Tabla ordenes_compra + columnas de proveedor MP en organizaciones

-- ── Nuevas columnas en organizaciones ────────────────────────
ALTER TABLE organizaciones
  ADD COLUMN IF NOT EXISTS rut                  text,
  ADD COLUMN IF NOT EXISTS mp_codigo_proveedor  text;

-- ── Tabla ordenes_compra ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordenes_compra (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            uuid        NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  codigo            text        NOT NULL,
  estado_mp         text,
  fecha_envio       date,
  total             numeric(15,0),
  comprador_rut     text,
  comprador_nombre  text,
  nombre            text,
  cotizacion_codigo text,        -- código COT extraído del nombre de la OC
  licitacion_id     uuid         REFERENCES licitaciones(id),
  raw               jsonb,
  sincronizado_en   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ordenes_compra_org_codigo_uniq UNIQUE (org_id, codigo)
);

ALTER TABLE ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver_propias_oc" ON ordenes_compra
  FOR SELECT USING (org_id = mi_org_id());

-- admin y editor pueden insertar/actualizar/borrar
CREATE POLICY "admin_editor_oc" ON ordenes_compra
  FOR ALL USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));
