-- Tabla de facturas parciales por licitación ganada
CREATE TABLE facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizaciones(id),
  licitacion_id uuid NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  numero text NOT NULL,
  monto numeric NOT NULL,
  fecha_emision date NOT NULL,
  fecha_pago date,
  metodo_pago text,
  notas text,
  creado_en timestamptz DEFAULT now()
);

ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facturas_select" ON facturas
  FOR SELECT USING (org_id = mi_org_id());

CREATE POLICY "facturas_insert" ON facturas
  FOR INSERT WITH CHECK (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));

CREATE POLICY "facturas_update" ON facturas
  FOR UPDATE USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));

CREATE POLICY "facturas_delete" ON facturas
  FOR DELETE USING (org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor'));
