-- F4: Cartola Banco Estado + conciliación automática

-- ── cuentas_bancarias ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id  uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  banco   text NOT NULL,
  numero  text NOT NULL,
  alias   text,
  CONSTRAINT cuentas_bancarias_org_numero_uniq UNIQUE (org_id, numero)
);

ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver_propias_cuentas" ON cuentas_bancarias
  FOR SELECT USING (org_id = mi_org_id());
CREATE POLICY "admin_editor_cuentas" ON cuentas_bancarias
  FOR ALL USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));

-- ── importaciones ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS importaciones (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('cartola', 'rcv')),
  archivo_nombre  text NOT NULL,
  periodo_desde   date,
  periodo_hasta   date,
  filas           int,
  creado_por      uuid REFERENCES auth.users(id),
  creado_en       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE importaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver_propias_importaciones" ON importaciones
  FOR SELECT USING (org_id = mi_org_id());
CREATE POLICY "admin_editor_importaciones" ON importaciones
  FOR ALL USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));

-- ── movimientos_bancarios ────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_bancarios (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  cuenta_id       uuid NOT NULL REFERENCES cuentas_bancarias(id) ON DELETE CASCADE,
  importacion_id  uuid REFERENCES importaciones(id),
  fecha           date NOT NULL,
  n_operacion     text,
  descripcion     text,
  cargo           numeric(15,0),
  abono           numeric(15,0),
  saldo           numeric(15,0),
  n_cartola       int,
  CONSTRAINT movimientos_bancarios_uniq
    UNIQUE (cuenta_id, fecha, n_operacion, cargo, abono)
);

ALTER TABLE movimientos_bancarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver_propios_movimientos" ON movimientos_bancarios
  FOR SELECT USING (org_id = mi_org_id());
CREATE POLICY "admin_editor_movimientos" ON movimientos_bancarios
  FOR ALL USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));

-- ── conciliaciones ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conciliaciones (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  movimiento_id    uuid NOT NULL REFERENCES movimientos_bancarios(id) ON DELETE CASCADE,
  factura_id       uuid NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  monto_aplicado   numeric(15,0) NOT NULL,
  tipo             text NOT NULL CHECK (tipo IN ('directo', 'agrupado', 'factoring', 'manual')),
  confianza        text NOT NULL CHECK (confianza IN ('exacta', 'probable')),
  confirmado_por   uuid REFERENCES auth.users(id),
  confirmado_en    timestamptz,
  CONSTRAINT conciliaciones_mov_factura_uniq UNIQUE (movimiento_id, factura_id)
);

ALTER TABLE conciliaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver_propias_conciliaciones" ON conciliaciones
  FOR SELECT USING (org_id = mi_org_id());
CREATE POLICY "admin_editor_conciliaciones" ON conciliaciones
  FOR ALL USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));
