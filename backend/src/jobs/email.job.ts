// ══════════════════════════════════════════════════════════
//  email.job.ts — Email Worker para BullMQ
//  Procesa jobs de la cola 'emails' enviando correos de forma
//  asíncrona, sin bloquear la request HTTP.
// ══════════════════════════════════════════════════════════
import { logger } from '../utils/logger'
import type { EmailPayload } from './queue'

/**
 * Procesar un job de email: delega a mailer.sendEmail.
 * Separado del worker para poder testearlo independientemente.
 */
export async function procesarEmail(payload: EmailPayload): Promise<void> {
  const { to, subject, html } = payload

  if (!to || !subject || !html) {
    logger.warn(`[EmailJob] Payload inválido — to: ${to}, subject: ${subject?.slice(0, 30)}`)
    return
  }

  logger.info(`[EmailJob] Enviando email a ${to} — asunto: "${subject.slice(0, 60)}"`)

  // Import dinámico para evitar side effects al cargar el módulo
  // (mailer.ts crea un transporter y depende de env.ts)
  const { sendEmail } = await import('../config/mailer')
  await sendEmail({ to, subject, html })

  logger.info(`[EmailJob] Email enviado a ${to}`)
}
