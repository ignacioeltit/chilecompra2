// ============================================================
// Tipos centrales — espejo del schema Supabase
// ============================================================

export type EstadoLicitacion =
  | 'sin_definir'
  | 'pendiente_enviar'
  | 'revisar'
  | 'enviada'
  | 'no_participe'
  | 'cancelada'
  | 'revisado'

export type ResultadoLicitacion =
  | 'ganada'
  | 'perdida'
  | 'desierta'
  | 'cerrada_sin_adj'

export type EstadoOC = 'emitida' | 'aceptada' | 'facturada' | 'pagada'

export type RolUsuario = 'admin' | 'editor' | 'lector'

export const ROLES_USUARIO: Record<RolUsuario, string> = {
  admin:  'Administrador',
  editor: 'Editor',
  lector: 'Lector',
}

export type CategoriaAlerta =
  | 'resultado_registrado'
  | 'revisar_resultado'
  | 'pendiente_revision'
  | 'pendiente_enviar'
  | 'cotizada'
  | 'cerrada_sin_cotizar'
  | 'urgente'
  | 'pronto'
  | 'sin_definir'
  | 'revisado'
  | 'ok'

// ============================================================

export interface Organizacion {
  id: string
  nombre: string
  slug: string
  creado_en: string
}

export interface Usuario {
  id: string
  org_id: string
  email: string
  nombre: string | null
  rol: RolUsuario
  push_subscription: PushSubscriptionJSON | null
  notif_urgente: boolean
  notif_pronto: boolean
  notif_resultado: boolean
  notif_email: boolean
  creado_en: string
}

export interface Institucion {
  id: string
  org_id: string
  nombre: string
  region: string | null
  rut: string | null
  creado_en: string
}

export interface Licitacion {
  id: string
  org_id: string
  codigo_chilecompra: string
  nombre: string
  fecha_publicacion: string | null
  fecha_cierre_1: string
  fecha_cierre_2: string | null
  estado: EstadoLicitacion
  resultado: ResultadoLicitacion | null
  institucion_id: string | null
  institucion: string
  descripcion: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  orden_compra: string | null
  estado_oc: EstadoOC | null
  monto_clp: number | null
  numero_factura: string | null
  fecha_emision_factura: string | null
  fecha_pago: string | null
  asignado_a: string | null
  notas: string | null
  creado_por: string
  creado_en: string
  actualizado_en: string
}

export interface LicitacionConAlerta extends Licitacion {
  horas_restantes: number
  categoria_alerta_calc: CategoriaAlerta
}

export interface Adjunto {
  id: string
  licitacion_id: string
  nombre_archivo: string
  url_storage: string
  mime_type: string | null
  tamano_bytes: number | null
  subido_por: string | null
  subido_en: string
}

export interface RegistroAuditoria {
  id: string
  licitacion_id: string
  usuario_id: string | null
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  timestamp: string
  usuario?: Pick<Usuario, 'nombre' | 'email'>
}

// ============================================================
// Helpers de UI
// ============================================================

export interface AlertaConfig {
  label: string
  color: string        // bg hex
  textColor: string
  borderColor: string
  prioridad: number
}

export const ALERTAS: Record<CategoriaAlerta, AlertaConfig> = {
  urgente:             { label: 'Urgente',            color: '#F4CCCC', textColor: '#7F1D1D', borderColor: '#F87171', prioridad: 0 },
  pronto:              { label: 'Pronto',             color: '#FFEB9C', textColor: '#713F12', borderColor: '#FBBF24', prioridad: 1 },
  revisar_resultado:   { label: 'Revisar resultado',  color: '#CFE2F3', textColor: '#1E3A5F', borderColor: '#60A5FA', prioridad: 2 },
  pendiente_enviar:    { label: 'Pendiente enviar',   color: '#FCE5CD', textColor: '#7C2D12', borderColor: '#FB923C', prioridad: 3 },
  pendiente_revision:  { label: 'Revisar',            color: '#E4B7E1', textColor: '#4A044E', borderColor: '#C084FC', prioridad: 4 },
  cotizada:            { label: 'Cotizada',           color: '#D9EAD3', textColor: '#14532D', borderColor: '#4ADE80', prioridad: 6 },
  cerrada_sin_cotizar: { label: 'Sin cotizar',         color: '#D9D9D9', textColor: '#374151', borderColor: '#9CA3AF', prioridad: 7 },
  sin_definir:         { label: 'Sin definir',        color: '#FFFFFF', textColor: '#6B7280', borderColor: '#D1D5DB', prioridad: 8 },
  revisado:            { label: 'Revisado',           color: '#CFFAFE', textColor: '#164E63', borderColor: '#67E8F9', prioridad: 9 },
  resultado_registrado:{ label: 'Finalizada',         color: '#F3F4F6', textColor: '#6B7280', borderColor: '#D1D5DB', prioridad: 10 },
  ok:                  { label: 'OK',                 color: '#F9FAFB', textColor: '#6B7280', borderColor: '#E5E7EB', prioridad: 11 },
}

export const ESTADOS_LICITACION: Record<EstadoLicitacion, string> = {
  sin_definir:      'Sin definir',
  pendiente_enviar: 'Pendiente enviar',
  revisar:          'Revisar',
  enviada:          'Enviada',
  no_participe:     'No participé',
  cancelada:        'Cancelada',
  revisado:         'Revisado',
}

export const RESULTADOS: Record<ResultadoLicitacion, string> = {
  ganada:          'Ganada',
  perdida:         'Perdida',
  desierta:        'Desierta',
  cerrada_sin_adj: 'Cerrada sin adj.',
}

export const ESTADOS_OC: Record<EstadoOC, string> = {
  emitida:   'Emitida',
  aceptada:  'Aceptada',
  facturada: 'Facturada',
  pagada:    'Pagada',
}

// ============================================================
// Formularios
// ============================================================

export interface LicitacionFormData {
  codigo_chilecompra: string
  nombre: string
  fecha_publicacion?: string
  fecha_cierre_1: string
  fecha_cierre_2?: string
  estado: EstadoLicitacion
  resultado?: ResultadoLicitacion
  institucion: string
  institucion_id?: string
  descripcion?: string
  contacto_nombre?: string
  contacto_telefono?: string
  orden_compra?: string
  estado_oc?: EstadoOC
  numero_factura?: string
  fecha_emision_factura?: string
  fecha_pago?: string
  monto_clp?: number
  asignado_a?: string
  notas?: string
}

// Tipo de licitación detectado del código
export type TipoLicitacion = 'COT' | 'LE' | 'LP' | 'desconocido'

export function detectarTipo(codigo: string): TipoLicitacion {
  if (/COT/i.test(codigo)) return 'COT'
  if (/\bLE\b/i.test(codigo)) return 'LE'
  if (/\bLP\b/i.test(codigo)) return 'LP'
  return 'desconocido'
}
