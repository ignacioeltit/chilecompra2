# CLAUDE.md — Chilecompra2

Contexto del proyecto para Claude. Leer antes de cada sesión.

## Stack

- **Framework**: Next.js 14 App Router (ahora en 16.x pero con App Router)
- **DB / Auth / Realtime**: Supabase (PostgreSQL + RLS + Realtime channels)
- **Deploy**: Vercel (serverless)
- **Estilos**: Tailwind CSS + Radix UI + CVA
- **Forms**: React Hook Form + Zod
- **Estado global**: Zustand + hooks propios
- **Email**: Resend
- **Push notifications**: web-push

## Estructura del proyecto

```
src/
  app/
    (app)/              # Rutas protegidas (requieren sesión)
      dashboard/        # Vista principal de licitaciones
      licitaciones/[id]/ # Detalle de licitación
      calendario/
      reportes/
    (auth)/             # Login / registro
    actions/            # Server Actions de Next.js (LEER REGLAS ABAJO)
      licitaciones.ts
      instituciones.ts
      usuarios.ts
    api/
      sync/route.ts     # Endpoint de sincronización con Mercado Público
      import/           # Importación de licitaciones
      licitaciones/
      notifications/
  components/
    dashboard/          # UrgenteBanner, tablas, filtros
    licitaciones/       # Formularios, campos inline
    ui/                 # Componentes base (shadcn-style)
    layout/
  hooks/
    useRealtimeLicitaciones.ts  # Hook central — lee licitaciones con realtime
    useSyncLicitaciones.ts      # Dispara sync con Mercado Público
    useCategoriaAlerta.ts
    useSupabase.ts
  lib/
    supabase/
      client.ts         # createBrowserClient — usar en componentes cliente
      server.ts         # createServerClient — usar SOLO en server components/route handlers
      middleware.ts
supabase/
  migrations/           # Schema completo en 001_initial_schema.sql
```

## Reglas críticas

### ❌ NO usar Server Actions para mutaciones de licitaciones

Los Server Actions (`src/app/actions/licitaciones.ts`) fallan silenciosamente en Vercel serverless porque el contexto de cookies no se transmite correctamente. Las actualizaciones nunca llegan a la DB sin error visible.

**En su lugar**, usar siempre el cliente browser directamente en componentes cliente:

```typescript
// CORRECTO — desde un componente cliente
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { error } = await supabase
  .from('licitaciones')
  .update({ estado: 'no_participe' })
  .eq('id', id)
```

La única Server Action que funciona correctamente es `actualizarInstitucionLicitacion` (que se mantiene porque usa lógica especial).

### ❌ NO usar upsert en el endpoint de sync

`/api/sync/route.ts` usa **insert primero, luego update de solo metadatos** si ya existe (`error.code === '23505'`). Nunca usar `upsert` porque sobrescribe `estado` y `resultado` que el usuario ya definió.

```typescript
// Patrón correcto en sync:
const { error: insertError } = await supabase.from('licitaciones').insert({
  ...metadatos,
  estado: 'sin_definir',  // solo para nuevas
})
if (insertError?.code === '23505') {
  // Ya existe → actualizar solo metadatos, NUNCA estado/resultado
  await supabase.from('licitaciones').update(metadatos).eq(...)
}
```

### Cache de Next.js y refresh del dashboard

El router cache de Next.js (TTL 30s) impide que `router.refresh()` desde la página de detalle actualice el dashboard. Se usan tres mecanismos en `useRealtimeLicitaciones.ts`:

1. **`pageshow`** — recarga cuando se navega hacia atrás (bfcache / router cache)
2. **`storage` event** — la página de detalle escribe `localStorage.setItem('dashboard_stale', '1')` al guardar; el dashboard lo detecta y recarga
3. **Supabase Realtime channel** — escucha cambios en `licitaciones` filtrado por `org_id`

### Clientes Supabase — cuándo usar cuál

| Contexto | Cliente | Archivo |
|---|---|---|
| Componente React (cliente) | `createBrowserClient` | `@/lib/supabase/client` |
| Route Handler / Middleware | `createServerClient` | `@/lib/supabase/server` |
| Server Component | `createServerClient` | `@/lib/supabase/server` |

**Nunca** importar `client.ts` desde un Server Component ni viceversa.

## Base de datos — conceptos clave

### Tabla `licitaciones`

Campos importantes:
- `estado`: `'sin_definir' | 'en_proceso' | 'enviada' | 'no_participe' | 'cancelada'`
- `resultado`: `'ganada' | 'perdida' | 'desierta' | null`
- `org_id`: FK a organización del usuario
- `codigo_chilecompra`: código único de Mercado Público (unique constraint con `org_id`)
- `categoria_alerta_calc`: calculado por vista `v_licitaciones_con_alerta`

### Vista `v_licitaciones_con_alerta`

Calcula `categoria_alerta_calc` y `horas_restantes`. Licitaciones con `estado = 'no_participe'` o `'cancelada'` mapean a `categoria_alerta_calc = 'resultado_registrado'`.

### RLS Policies

- `editar_licitaciones`: `org_id = mi_org_id() AND mi_rol() IN ('admin', 'editor')`
- `mi_org_id()` y `mi_rol()`: funciones SECURITY DEFINER que buscan en tabla `usuarios`
- El usuario actual tiene `rol: admin`

### UrgenteBanner — filtros

```typescript
const ESTADOS_EXCLUIDOS = ['no_participe', 'cancelada', 'revisado']
const CATEGORIAS_EXCLUIDAS = ['resultado_registrado', 'revisado', 'ok', 'cerrada_sin_cotizar']
// Solo muestra licitaciones con horas_restantes > 0 && <= 48
```

## Convenciones de código

- **TypeScript** estricto — siempre tipar estados y props
- Estado de dropdown multi-instancia: usar `string | null` (nunca `boolean`) para poder identificar qué instancia está abierta
- Inline edits muestran spinner con `const [guardando, setGuardando] = useState<string | null>(null)`
- Después de guardar: llamar `cargar()` para refrescar local, luego `router.refresh()`, luego `localStorage.setItem('dashboard_stale', '1')`

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build
npm run build

# Ver logs de Vercel
vercel logs --follow

# Aplicar migraciones Supabase
supabase db push
```

## Variables de entorno necesarias

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # Solo en server/API routes
MERCADO_PUBLICO_API_KEY     # Para sync con Mercado Público
RESEND_API_KEY
```

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Bugs/errores → invoke /investigate
- QA/verificar comportamiento en el sitio → invoke /qa o /qa-only
- Revisar diff o código → invoke /review
- Deploy/PR → invoke /ship
- Guardar contexto → invoke /context-save
