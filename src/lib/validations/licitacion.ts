import { z } from 'zod'

const ESTADOS = ['sin_definir','pendiente_enviar','revisar','enviada','no_participe','cancelada','revisado'] as const
const RESULTADOS = ['ganada','perdida','desierta','cerrada_sin_adj'] as const
const ESTADOS_OC = ['emitida','aceptada','facturada','pagada'] as const

// Regex código Chilecompra — primer segmento hasta 8 dígitos (ej: 1375761), segundo hasta 5
const CODIGO_REGEX = /^\d{1,8}-\d{1,5}-(COT|LE|LP|LR|LC)\d{0,4}$/i

export const licitacionSchema = z.object({
  codigo_chilecompra: z
    .string()
    .min(1, 'Código requerido')
    .regex(CODIGO_REGEX, 'Formato: 1375761-130-COT26, 3449-26-COT26, etc.'),

  nombre: z.string().min(3, 'Nombre muy corto').max(500),

  fecha_publicacion: z.string().optional().nullable(),

  fecha_cierre_1: z.string().min(1, 'Fecha de cierre requerida'),

  fecha_cierre_2: z.string().optional().nullable(),

  estado: z.enum(ESTADOS),

  resultado: z.enum(RESULTADOS).optional().nullable(),

  institucion: z.string().min(1, 'Institución requerida'),

  institucion_id: z.string().uuid().optional().nullable(),

  contacto_nombre: z.string().max(200).optional().nullable(),

  contacto_telefono: z
    .string()
    .regex(/^\+569[0-9]{8}$/, 'Formato: +569XXXXXXXX')
    .optional()
    .nullable()
    .or(z.literal('')),

  orden_compra: z.string().max(100).optional().nullable(),

  estado_oc: z.enum(ESTADOS_OC).optional().nullable(),

  monto_clp: z
    .number({ invalid_type_error: 'Debe ser número' })
    .positive('Debe ser positivo')
    .optional()
    .nullable(),

  asignado_a: z.string().uuid().optional().nullable(),

  notas: z.string().max(10000).optional().nullable(),
})

export type LicitacionSchema = z.infer<typeof licitacionSchema>
