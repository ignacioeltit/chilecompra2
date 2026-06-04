import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularCategoriaAlerta } from '@/lib/utils/categoria-alerta'
import { type Licitacion, type CategoriaAlerta } from '@/types'
import webpush from 'web-push'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@chilecompra.cl',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// ── Verificar clave secreta del cron ──
function verificarClave(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const clave = process.env.CRON_SECRET
  if (!clave) return true   // sin clave configurada → solo en dev
  return auth === `Bearer ${clave}`
}

export async function POST(req: NextRequest) {
  if (!verificarClave(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = await createClient()
  const ahora = new Date()
  const resultados = { enviados: 0, errores: 0 }

  // Obtener todas las licitaciones activas con usuarios asignados y sus suscripciones
  const { data: lics } = await supabase
    .from('licitaciones')
    .select(`
      *,
      usuario_asignado:asignado_a(
        id, email, nombre,
        push_subscription,
        notif_urgente, notif_pronto, notif_resultado, notif_email
      ),
      org:org_id(id)
    `)
    .not('estado', 'in', '("cancelada","no_participe")')

  if (!lics) return NextResponse.json(resultados)

  for (const lic of lics as (Licitacion & { usuario_asignado: any })[]) {
    const usuario = lic.usuario_asignado
    if (!usuario) continue

    const categoria = calcularCategoriaAlerta(lic, ahora)

    // Determinar si enviar y qué tipo
    const debeEnviar = await evaluarEnvio(supabase, lic.id, usuario.id, categoria, ahora)
    if (!debeEnviar) continue

    const mensaje = construirMensaje(lic, categoria)

    // Enviar push
    if (usuario.push_subscription && debeEnviarPush(usuario, categoria)) {
      try {
        await webpush.sendNotification(
          usuario.push_subscription,
          JSON.stringify({
            title: mensaje.titulo,
            body:  mensaje.cuerpo,
            url:   `/licitaciones/${lic.id}`,
          })
        )
        await registrarEnvio(supabase, lic.id, usuario.id, categoria, 'push')
        resultados.enviados++
      } catch {
        resultados.errores++
      }
    }

    // Enviar email
    if (usuario.notif_email && process.env.RESEND_API_KEY && debeEnviarEmail(usuario, categoria)) {
      try {
        await enviarEmail(usuario.email, mensaje.titulo, mensaje.cuerpo, lic.id)
        await registrarEnvio(supabase, lic.id, usuario.id, categoria, 'email')
        resultados.enviados++
      } catch {
        resultados.errores++
      }
    }
  }

  return NextResponse.json(resultados)
}

// ── Evitar spam: verificar si ya se envió en la ventana de tiempo ──
async function evaluarEnvio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  licId: string,
  userId: string,
  categoria: CategoriaAlerta,
  ahora: Date
): Promise<boolean> {
  if (!['urgente','pronto','revisar_resultado','cerrada_sin_cotizar'].includes(categoria)) return false

  // Ventanas de re-envío por tipo
  const ventanaHoras: Record<string, number> = {
    urgente:            6,
    pronto:             24,
    revisar_resultado:  48,
    cerrada_sin_cotizar: 9999,  // solo una vez
  }

  const ventana = ventanaHoras[categoria] ?? 24
  const desde = new Date(ahora.getTime() - ventana * 3600 * 1000)

  const { data: enviado } = await supabase
    .from('push_notificaciones')
    .select('id')
    .eq('licitacion_id', licId)
    .eq('usuario_id', userId)
    .eq('tipo', categoria)
    .gte('enviado_en', desde.toISOString())
    .maybeSingle()

  return !enviado
}

async function registrarEnvio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  licId: string,
  userId: string,
  tipo: CategoriaAlerta,
  canal: string
) {
  await supabase.from('push_notificaciones').insert({
    licitacion_id: licId,
    usuario_id:    userId,
    tipo,
    canal,
  })
}

function debeEnviarPush(usuario: any, categoria: CategoriaAlerta): boolean {
  if (categoria === 'urgente') return usuario.notif_urgente
  if (categoria === 'pronto')  return usuario.notif_pronto
  return false
}

function debeEnviarEmail(usuario: any, categoria: CategoriaAlerta): boolean {
  if (categoria === 'urgente')            return usuario.notif_urgente
  if (categoria === 'pronto')             return usuario.notif_pronto
  if (categoria === 'revisar_resultado')  return usuario.notif_resultado
  if (categoria === 'cerrada_sin_cotizar') return true
  return false
}

function construirMensaje(lic: Licitacion, categoria: CategoriaAlerta) {
  const mensajes: Record<string, { titulo: string; cuerpo: string }> = {
    urgente: {
      titulo: `⚠️ Cierre en menos de 24h`,
      cuerpo: `${lic.codigo_chilecompra} · ${lic.nombre} — ${lic.institucion}`,
    },
    pronto: {
      titulo: `🔔 Cierre próximo (< 72h)`,
      cuerpo: `${lic.codigo_chilecompra} · ${lic.nombre}`,
    },
    revisar_resultado: {
      titulo: `📋 Registrar resultado pendiente`,
      cuerpo: `La licitación ${lic.codigo_chilecompra} ya cerró. ¿Cuál fue el resultado?`,
    },
    cerrada_sin_cotizar: {
      titulo: `ℹ️ Licitación cerrada sin cotizar`,
      cuerpo: `${lic.codigo_chilecompra} · ${lic.nombre} — cerró sin participación`,
    },
  }
  return mensajes[categoria] ?? { titulo: 'Alerta Chilecompra2', cuerpo: lic.nombre }
}

async function enviarEmail(to: string, subject: string, text: string, licId: string) {
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'notif@chilecompra.cl',
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1E3A5F">${subject}</h2>
        <p style="color:#374151">${text}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/licitaciones/${licId}"
           style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Ver licitación
        </a>
      </div>
    `,
  })
}
