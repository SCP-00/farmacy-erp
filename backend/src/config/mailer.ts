import nodemailer from 'nodemailer'
import { env } from './env'
import { logger } from '../utils/logger'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT),
  ...(env.SMTP_USER
    ? {
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        // En desarrollo, no rechazar certificados si el hostname no coincide
        // (ocurre con Brevo en algunas regiones como Sudamérica)
        ...(env.NODE_ENV === 'development' ? { tls: { rejectUnauthorized: false } } : {}),
      }
    : { ignoreTLS: true }),
})

// ── Templates HTML ────────────────────────────────────────
const base = (content: string) => `
<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', sans-serif; background:#f5f8f6; margin:0; padding:0; }
  .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px;
          overflow:hidden; box-shadow:0 4px 20px #0f6e5620; }
  .header { background:#0F6E56; padding:28px 32px; text-align:center; }
  .header h1 { color:#fff; margin:0; font-size:22px; letter-spacing:-0.5px; }
  .header p { color:#9FE1CB; margin:4px 0 0; font-size:13px; }
  .body { padding:32px; color:#1a2b23; line-height:1.7; }
  .btn { display:inline-block; padding:12px 28px; background:#0F6E56; color:#fff;
         border-radius:50px; text-decoration:none; font-weight:600; margin:18px 0; }
  .code { font-size:32px; font-weight:700; letter-spacing:6px; color:#0F6E56;
          text-align:center; padding:16px; background:#f0faf6; border-radius:10px; margin:16px 0; }
  .footer { padding:16px 32px; text-align:center; font-size:12px; color:#9eb3a6;
            border-top:1px solid #d8ebe4; }
</style></head><body>
<div class="wrap">
  <div class="header">
    <h1>💊 Farmacy</h1>
    <p>Sistema de Gestión de Farmacias</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    © ${new Date().getFullYear()} Farmacy · Este correo es automático, no respondas a él.
  </div>
</div></body></html>`

export const emailTemplates = {
  verificarEmail: (nombre: string, url: string) =>
    base(`<p>Hola <strong>${nombre}</strong>,</p>
    <p>Gracias por registrarte en Farmacy. Por favor verifica tu correo electrónico haciendo clic en el botón:</p>
    <center><a href="${url}" class="btn">Verificar mi correo</a></center>
    <p style="color:#9eb3a6;font-size:12px;">Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este correo.</p>`),

  resetPassword: (nombre: string, url: string) =>
    base(`<p>Hola <strong>${nombre}</strong>,</p>
    <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón:</p>
    <center><a href="${url}" class="btn">Restablecer contraseña</a></center>
    <p style="color:#9eb3a6;font-size:12px;">Expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>`),

  confirmacionCompra: (nombre: string, numeroPedido: number, total: number) =>
    base(`<p>Hola <strong>${nombre}</strong>,</p>
    <p>¡Tu pedido <strong>#PED-${String(numeroPedido).padStart(6,'0')}</strong> fue confirmado!</p>
    <p>Total pagado: <strong>$${total.toLocaleString('es-CO')}</strong></p>
    <p>Pronto recibirás una notificación cuando esté listo para envío o recogida.</p>
    <center><a href="${env.FRONTEND_URL}/cuenta/pedidos" class="btn">Ver mis pedidos</a></center>`),

  alertaStockMinimo: (producto: string, stock: number, sede: string) =>
    base(`<p>⚠️ <strong>Alerta de stock mínimo</strong></p>
    <p>El producto <strong>${producto}</strong> en la sede <strong>${sede}</strong> tiene solo <strong>${stock} unidades</strong>.</p>
    <p>Se recomienda generar una orden de compra.</p>
    <center><a href="${env.FRONTEND_URL}/admin/compras/nueva" class="btn">Crear orden de compra</a></center>`),
}

// ── Función de envío ──────────────────────────────────────
export async function sendEmail(options: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, ...options })
    logger.info(`[Mailer] Email enviado a ${options.to}`)
  } catch (err) {
    logger.error(`[Mailer] Error enviando a ${options.to}: ${(err as Error).message}`)
  }
}