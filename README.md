# Chilecompra2 — Gestión de Licitaciones

Plataforma web para hacer seguimiento del ciclo completo de licitaciones en Mercado Público (Chilecompra): desde detectar la oportunidad hasta registrar adjudicación y orden de compra.

**Stack:** Next.js 14 + TypeScript + Tailwind CSS + Supabase + Vercel

---

## Estado actual del proyecto (junio 2026)

El sistema está operativo y en uso activo. Las funcionalidades principales están completas:

- **Importación de Excel funcionando** — `POST /api/import` y `DELETE /api/import/delete`. Soporta múltiples formatos de fecha (incluyendo `dd-mm-yyyy a las hh:mm:ss`, `dd/mm/yyyy hh:mm a.m./p.m.` y objetos Date de Excel), mapeo fuzzy de estados y resultados, creación automática de instituciones nuevas, y logging detallado en `logs/import-<timestamp>.log`.
- **Dashboard con métricas** — Cards resumen, tabla de licitaciones prioritarias, gráfico mensual, top instituciones (Recharts).
- **Listado de licitaciones** — Filtros por estado y categoría de alerta, búsqueda full-text, paginación (50 por página), selección múltiple para eliminar, exportación a Excel.
- **Detalle de licitación** — Vista con tabs, edición inline.
- **Calendario** — Vista mensual de cierres.
- **Reportes** — Gráficos y métricas históricas.
- **Notificaciones push** — Web Push con VAPID, Service Worker integrado.
- **Multi-tenant con RLS** — Cada organización solo ve sus datos, políticas en Postgres.
- **Sistema de alertas** — Categorías `urgente`, `pronto`, `normal`, `sin_fecha` calculadas desde lógica pura en `categoria-alerta.ts` (14 tests unitarios).

### Issue conocido

El import muestra `inst_search_error` en algunas filas cuando hay múltiples registros de institución con nombre similar (error de Supabase: "Cannot coerce the result to a single JSON object"). No bloquea la importación: la fila igualmente se importa creando o reutilizando la institución correcta.

---

## Requisitos previos

- Node.js 20+
- npm 9+
- Cuenta en [Supabase](https://supabase.com) (gratis)
- Cuenta en [Vercel](https://vercel.com) (gratis)
- Cuenta en [Resend](https://resend.com) para emails (gratis hasta 3.000/mes)

---

## Setup paso a paso

### 1. Clonar e instalar dependencias

```bash
git clone <tu-repo>
cd chilecompra2
npm install
```

### 2. Crear proyecto Supabase

1. Ve a [supabase.com](https://supabase.com) → New Project
2. Elige región **South America (São Paulo)** para menor latencia
3. Copia las credenciales: `Project URL` y `anon public key`

### 3. Ejecutar migraciones SQL

En el SQL Editor de Supabase, ejecuta en orden:

```sql
-- Archivo: supabase/migrations/001_initial_schema.sql
-- Copia y pega el contenido completo en el editor
```

Esto crea:
- Enums, tablas, índices, triggers de auditoría
- Vista `v_licitaciones_con_alerta` con lógica de alertas
- Función `buscar_licitaciones` (full-text + filtros)
- Políticas RLS para multi-tenant

### 4. Cargar datos seed (opcional)

```sql
-- Primero crea un usuario vía Signup en la app
-- Luego ejecuta: supabase/seed/001_seed.sql
-- Ajusta el UUID de creado_por si es necesario
```

### 5. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Settings > API > service_role
RESEND_API_KEY=re_...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

#### Generar claves VAPID (Web Push):

```bash
npx web-push generate-vapid-keys
```

Copia ambas claves al `.env.local`.

### 6. Configurar Supabase Auth

En Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3000` (dev) / `https://tu-app.vercel.app` (prod)
- **Redirect URLs:** agrega `https://tu-app.vercel.app/**`

### 7. Crear primer usuario y organización

1. Corre la app: `npm run dev`
2. Ve a `http://localhost:3000/login` → Crear cuenta
3. En Supabase SQL Editor, crea la organización y el perfil:

```sql
-- Reemplaza el UUID con el id del usuario creado (Authentication > Users)
INSERT INTO organizaciones (id, nombre, slug) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Mi Empresa SpA', 'mi-empresa');

INSERT INTO usuarios (id, org_id, email, nombre, rol)
VALUES (
  'UUID-DEL-USUARIO',   -- de auth.users
  '00000000-0000-0000-0000-000000000001',
  'tu@email.cl',
  'Tu Nombre',
  'admin'
);
```

### 8. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### 9. Ejecutar tests

```bash
npm test
```

---

## Deploy en Vercel

1. Sube el repo a GitHub
2. Ve a [vercel.com/new](https://vercel.com/new) → importa el repositorio
3. En Environment Variables, agrega todas las del `.env.example`
4. Deploy

---

## Importar planilla Excel existente

Desde la app (como admin): **Config → Importar desde Excel**.

O directamente vía API:

```bash
curl -X POST https://tu-app.vercel.app/api/import \
  -H "Cookie: <tu-session-cookie>" \
  -F "file=@planilla_licitaciones.xlsx"
```

**Columnas reconocidas automáticamente:**

| Columna Excel | Campo en BD |
|---|---|
| `ID` / `Código` | `codigo_chilecompra` |
| `Nombre` | `nombre` |
| `Institución` | `institución` (crea si no existe) |
| `Estado` | normalizado: ENVIADA, REVISAR, NO PARTICIPE… |
| `RESULTADO` | normalizado: GANADA, PERDIDA, DESIERTA… |
| `Fecha de cierre 1ER LLAMADO` | `fecha_cierre_1` (soporta varios formatos) |
| `Fecha de cierre 2DO LLAMADO` | `fecha_cierre_2` |
| `Fecha de publicación` | `fecha_publicacion` |
| `Orden de compra` | `orden_compra` |
| `Monto` | `monto_clp` |

El import hace upsert por `(org_id, codigo_chilecompra)` — se puede re-importar sin duplicar. Los logs quedan en `logs/import-<timestamp>.log`.

Para eliminar registros importados por error: selecciona los códigos en la UI y usa "Eliminar seleccionadas", o `POST /api/import/delete` con `{ codigos: [...] }`.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/          # Login
│   ├── (app)/                 # Rutas protegidas con sidebar
│   │   ├── dashboard/         # Dashboard con cards y gráficos
│   │   ├── licitaciones/      # Listado + filtros + paginación
│   │   ├── licitaciones/[id]/ # Detalle con tabs
│   │   ├── licitaciones/nueva/# Formulario nueva licitación
│   │   ├── calendario/        # Vista mensual de cierres
│   │   ├── reportes/          # Gráficos y métricas
│   │   └── config/            # Config + importar (solo admin)
│   ├── actions/               # Server Actions: licitaciones, instituciones, usuarios
│   └── api/
│       ├── import/route.ts    # POST: importar XLSX
│       ├── import/delete/     # POST: eliminar por código
│       └── notifications/     # Web Push
├── components/
│   ├── dashboard/             # ResumenCards, TablaPrioritaria, GraficoMensual, TopInstituciones
│   ├── layout/                # Sidebar, ServiceWorkerInit
│   └── ui/                    # BadgeAlerta
├── hooks/
│   ├── useRealtimeLicitaciones.ts  # Suscripción Supabase realtime
│   ├── useCategoriaAlerta.ts
│   └── useSupabase.ts             # Auth + perfil
├── lib/
│   ├── supabase/              # client.ts, server.ts, middleware.ts
│   └── utils/
│       ├── categoria-alerta.ts     # Lógica de prioridad (pura, testeable)
│       ├── format.ts               # formatCLP, formatFecha
│       └── export.ts               # Exportar a XLSX (exceljs)
├── types/index.ts             # Tipos + ALERTAS config
└── proxy.ts

supabase/
├── migrations/001_initial_schema.sql   # Schema completo + RLS
└── seed/001_seed.sql

tests/
└── categoria-alerta.test.ts            # 14 tests de lógica de alertas

logs/                                   # Logs de importaciones (generados automáticamente)
```

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Para notif. | Clave service role (solo server) |
| `RESEND_API_KEY` | Para emails | API key de Resend |
| `VAPID_PUBLIC_KEY` | Para push | Clave pública VAPID |
| `VAPID_PRIVATE_KEY` | Para push | Clave privada VAPID |

---

## Roles

| Rol | Ver | Crear/Editar | Eliminar | Config/Importar |
|-----|-----|-------------|---------|----------------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ❌ | ❌ |
| Lector | ✅ | ❌ | ❌ | ❌ |

Las políticas RLS en Postgres hacen cumplir los permisos independientemente del frontend.
