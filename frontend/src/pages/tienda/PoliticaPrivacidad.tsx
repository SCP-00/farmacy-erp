import { Shield, FileText, Database, Server, Clock, Lock, Users, Globe, Mail, MapPin, Scale, AlertTriangle } from 'lucide-react'
import SEOHead from '@/components/shared/SEOHead'

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section className="mb-10 last:mb-0">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-teal-100 text-teal-700 flex-shrink-0">
        {icon}
      </div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
    <div className="pl-12 text-sm text-gray-600 leading-relaxed space-y-3">
      {children}
    </div>
  </section>
)

export default function PoliticaPrivacidad() {
  return (
    <>
      <SEOHead
        title="Política de privacidad y tratamiento de datos"
        description="Política de privacidad de Farmacy conforme a la Ley 1581 de 2012, Decreto 1377 de 2013 y Decreto 1074 de 2015. Conoce qué datos recopilamos, dónde se almacenan, por qué se guardan y tus derechos como titular."
        path="/privacidad"
      />
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <section className="rounded-[2rem] border border-white/70 bg-white/95 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-900 via-teal-700 to-blue-700 text-white px-6 py-8 md:px-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]">
              <Shield size={12} /> Privacidad
            </span>
            <h1 className="mt-4 text-3xl md:text-5xl font-serif leading-tight">
              Política de privacidad y<br />tratamiento de datos
              <span className="text-red-200">.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm md:text-base text-white/80">
              Cumplimiento de la Ley 1581 de 2012, Decreto 1377 de 2013 y Decreto Único Reglamentario 1074 de 2015
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center text-[10px] bg-white/15 px-2.5 py-1 rounded-full">Última actualización: mayo 2026</span>
              <span className="inline-flex items-center text-[10px] bg-white/15 px-2.5 py-1 rounded-full">Vigencia indefinida</span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-8 md:px-10">

            {/* 1. Responsable */}
            <Section icon={<Shield size={20} />} title="1. Responsable del tratamiento">
              <p>
                <strong>Antigravity Farmacy S.A.S.</strong> (en adelante, &laquo;Farmacy&raquo;), sociedad legalmente constituida bajo las leyes de la República de Colombia,
                identificada con <strong>NIT 901.xxx.xxx-x</strong>, con domicilio principal en la ciudad de Bogotá D.C., Colombia, 
                actúa como <strong>Responsable del Tratamiento</strong> de los datos personales suministrados por los titulares, 
                en los términos del artículo 13 de la Ley 1581 de 2012.
              </p>
              <p>
                El tratamiento de datos personales se realiza en el marco del ejercicio de actividades comerciales 
                relacionadas con la comercialización de productos farmacéuticos, dispositivos médicos, cosméticos y 
                productos de cuidado personal, en cumplimiento de la normatividad sanitaria colombiana vigente.
              </p>
            </Section>

            {/* 2. Marco legal */}
            <Section icon={<Scale size={20} />} title="2. Marco legal aplicable">
              <p>La presente política se rige por el siguiente ordenamiento jurídico colombiano:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Ley 1581 de 2012</strong> &mdash; &laquo;Por la cual se dictan disposiciones generales para la protección de datos personales&raquo;</li>
                <li><strong>Decreto 1377 de 2013</strong> &mdash; Reglamenta la Ley 1581 de 2012</li>
                <li><strong>Decreto Único Reglamentario 1074 de 2015</strong> &mdash; Compila los decretos reglamentarios en materia de comercio, industria y turismo, incluyendo el Título de Protección de Datos</li>
                <li><strong>Ley 1273 de 2009</strong> &mdash; &laquo;Por medio de la cual se modifica el Código Penal, se crea un nuevo bien jurídico tutelado &mdash; denominado &ldquo;de la protección de la información y de los datos&rdquo;&raquo;</li>
                <li><strong>Resolución 1403 de 2007</strong> del Ministerio de la Protección Social &mdash; Publicidad de medicamentos</li>
                <li><strong>Decreto 466 de 2020</strong> &mdash; Telesalud y receta electrónica</li>
                <li><strong>Decreto 780 de 2016</strong> &mdash; Decreto Único Reglamentario del Sector Salud y Protección Social</li>
                <li><strong>Circular Externa 002 de 2013</strong> de la Superintendencia de Industria y Comercio &mdash; Recomendaciones sobre publicidad de datos personales</li>
              </ul>
              <p className="text-xs text-gray-400 mt-2">
                Esta política se actualizará automáticamente para reflejar cambios en la legislación colombiana aplicable.
              </p>
            </Section>

            {/* 3. Datos que recopilamos */}
            <Section icon={<Database size={20} />} title="3. Categorías de datos recopilados">
              <p className="font-semibold text-gray-700">3.1. Datos de identificación y contacto</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Nombres y apellidos</strong> completos</li>
                <li><strong>Tipo y número de documento</strong> de identidad (CC, CE, NIT, PEP, PPT)</li>
                <li><strong>Correo electrónico</strong> personal</li>
                <li><strong>Número telefónico</strong> fijo y/o móvil</li>
                <li><strong>Dirección de residencia</strong> y ciudad</li>
              </ul>

              <p className="font-semibold text-gray-700 mt-4">3.2. Datos de salud (categoría sensible)</p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle size={14} className="inline mr-1" />
                Los datos de salud son considerados <strong>datos sensibles</strong> según el artículo 5 de la Ley 1581 de 2012. 
                Su suministro es <strong>voluntario</strong> y solo se recopilan con su <strong>consentimiento expreso</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Alérgenos y excipientes</strong> registrados voluntariamente</li>
                <li><strong>Condiciones preexistentes</strong> de salud (opcional)</li>
                <li><strong>Medicamentos</strong> de uso habitual (opcional)</li>
                <li><strong>Fórmulas médicas</strong> (prescripciones) cuando aplique para la dispensación</li>
                <li><strong>Historial de compras</strong> de medicamentos y productos farmacéuticos</li>
              </ul>

              <p className="font-semibold text-gray-700 mt-4">3.3. Datos de navegación y dispositivos</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Dirección IP</strong> desde la que se conecta</li>
                <li><strong>Tipo de navegador</strong> y sistema operativo</li>
                <li><strong>Páginas visitadas</strong> dentro del portal farmacy.co</li>
                <li><strong>Duración de la sesión</strong> y patrones de navegación</li>
                <li><strong>Cookies técnicas y funcionales</strong> para el correcto funcionamiento del sitio</li>
              </ul>

              <p className="font-semibold text-gray-700 mt-4">3.4. Datos de transacciones</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Historial de compras</strong> y órdenes realizadas</li>
                <li><strong>Método de pago</strong> seleccionado (NO almacenamos números completos de tarjetas de crédito/débito)</li>
                <li><strong>Referencias de pago</strong> y comprobantes de transacción</li>
                <li><strong>Direcciones de envío</strong> utilizadas para despachos</li>
              </ul>
            </Section>

            {/* 4. Finalidades */}
            <Section icon={<FileText size={20} />} title="4. Finalidades del tratamiento">
              <p className="font-semibold text-gray-700">4.1. Finalidades principales (necesarias para la prestación del servicio)</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Procesar y gestionar sus pedidos de medicamentos y productos farmacéuticos</li>
                <li>Verificar la validez de las fórmulas médicas (prescripciones) cuando aplique</li>
                <li>Facturar y gestionar los métodos de pago seleccionados a través de pasarelas de pago autorizadas (Wompi, Stripe, MercadoPago)</li>
                <li>Coordinar la logística de entrega con empresas de mensajería y transporte</li>
                <li>Enviar notificaciones sobre el estado de sus pedidos yconfirmaciones de despacho</li>
                <li>Mantener el historial de compras para fines de devoluciones y garantías</li>
                <li>Cumplir con obligaciones regulatorias ante el <strong>INVIMA</strong> (Instituto Nacional de Vigilancia de Medicamentos y Alimentos), la <strong>Superintendencia de Industria y Comercio</strong> y demás autoridades colombianas</li>
                <li>Prevenir el fraude y garantizar la seguridad de las transacciones</li>
              </ul>

              <p className="font-semibold text-gray-700 mt-4">4.2. Finalidades secundarias (requieren autorización expresa)</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Enviar comunicaciones comerciales y promocionales sobre productos y servicios (previo consentimiento)</li>
                <li>Realizar análisis de comportamiento de compra para mejorar la experiencia de usuario</li>
                <li>Evaluar la calidad del servicio mediante encuestas de satisfacción</li>
                <li>Generar alertas de interacciones medicamentosas basadas en el perfil de salud registrado voluntariamente</li>
              </ul>
            </Section>

            {/* 5. Almacenamiento */}
            <Section icon={<Server size={20} />} title="5. Almacenamiento, ubicación y medidas de seguridad">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-2">
                <p className="font-semibold text-sky-900 flex items-center gap-2">
                  <Globe size={16} /> ¿Dónde se almacenan sus datos?
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sky-800">
                  <li><strong>Infraestructura principal:</strong> Servidores ubicados en <strong>Colombia</strong> (Bogotá D.C.) con respaldo en centros de datos certificados <strong>ISO 27001</strong></li>
                  <li><strong>Base de datos:</strong> PostgreSQL 15 en servidores dedicados con cifrado en reposo (AES-256)</li>
                  <li><strong>Caché y sesiones:</strong> Redis 7 con expiración automática de datos temporales</li>
                  <li><strong>Respaldos (backups):</strong> Almacenados en infraestructura cloud con réplicas geográficas en <strong>Estados Unidos</strong> (cumplimiento de estándares SOC 2)</li>
                  <li><strong>Archivos adjuntos:</strong> Cloudinary (imágenes de productos) — servidores en Estados Unidos</li>
                </ul>
              </div>

              <p className="font-semibold text-gray-700 mt-4">5.1. Medidas de seguridad implementadas</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Cifrado en tránsito:</strong> TLS 1.3 para todas las comunicaciones HTTPS</li>
                <li><strong>Cifrado en reposo:</strong> AES-256 para datos almacenados en base de datos</li>
                <li><strong>Autenticación:</strong> JWT con tokens de acceso (expiración 8h para admin, 30d para clientes)</li>
                <li><strong>Contraseñas:</strong> Hash bcrypt con factor de costo 12</li>
                <li><strong>Firewall:</strong> Reglas de restricción por IP en servidores de producción</li>
                <li><strong>Rate limiting:</strong> Límites de solicitudes para prevenir ataques de fuerza bruta</li>
                <li><strong>Webhooks:</strong> Verificación de firmas HMAC para Wompi, Stripe y MercadoPago</li>
                <li><strong>Monitoreo:</strong> Logs de acceso y actividad auditados con retención de 90 días</li>
                <li><strong>Backups:</strong> Automáticos diarios con retención de 30 días</li>
              </ul>

              <p className="font-semibold text-gray-700 mt-4">5.2. Términos de conservación</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-2 font-semibold">Tipo de dato</th>
                      <th className="text-left p-2 font-semibold">Período de conservación</th>
                      <th className="text-left p-2 font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="p-2">Datos de identificación</td>
                      <td className="p-2">5 años desde última interacción</td>
                      <td className="p-2">Obligación contable y fiscal (Código de Comercio)</td>
                    </tr>
                    <tr>
                      <td className="p-2">Historial de compras</td>
                      <td className="p-2">5 años desde la última compra</td>
                      <td className="p-2">Obligaciones regulatorias INVIMA y fiscales</td>
                    </tr>
                    <tr>
                      <td className="p-2">Datos de salud (sensibles)</td>
                      <td className="p-2">Mientras dure la relación comercial</td>
                      <td className="p-2">Seguridad del paciente — se eliminan al solicitar la cancelación</td>
                    </tr>
                    <tr>
                      <td className="p-2">Logs de navegación</td>
                      <td className="p-2">90 días</td>
                      <td className="p-2">Seguridad informática y análisis de tráfico</td>
                    </tr>
                    <tr>
                      <td className="p-2">Cookies técnicas</td>
                      <td className="p-2">Sesión / 30 días</td>
                      <td className="p-2">Funcionamiento del sitio</td>
                    </tr>
                    <tr>
                      <td className="p-2">Suscripciones push</td>
                      <td className="p-2">Hasta desuscripción o inactividad &gt; 6 meses</td>
                      <td className="p-2">Notificaciones voluntarias</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 6. Transferencias */}
            <Section icon={<Users size={20} />} title="6. Transferencia y destinatarios de datos">
              <p>Sus datos personales <strong>no serán compartidos</strong> con terceros no vinculados sin su consentimiento previo y expreso.</p>
              <p className="font-semibold text-gray-700 mt-3">Destinatarios autorizados:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Pasarelas de pago:</strong> Wompi (Colombia), Stripe (EE.UU.), MercadoPago (Colombia/Argentina) — solo la información necesaria para procesar la transacción</li>
                <li><strong>Empresas de mensajería y logística:</strong> nombre, dirección y teléfono para la entrega de pedidos</li>
                <li><strong>Proveedores de infraestructura cloud:</strong> servidores con estrictos acuerdos de confidencialidad (NDA)</li>
                <li><strong>Autoridades competentes:</strong> INVIMA, Superintendencia de Industria y Comercio, DIAN, Fiscalía General de la Nación — en cumplimiento de requerimientos legales</li>
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                No realizamos transferencia internacional de datos personales a países que no ofrezcan niveles adecuados de protección según los estándares de la Superintendencia de Industria y Comercio.
              </p>
            </Section>

            {/* 7. Derechos ARCO */}
            <Section icon={<Lock size={20} />} title="7. Derechos del titular (ARCO)">
              <p>De conformidad con la Ley 1581 de 2012, usted tiene los siguientes <strong>derechos ARCO</strong> (Acceso, Rectificación, Cancelación y Oposición):</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="font-bold text-gray-900 text-sm">🔍 Acceder</p>
                  <p className="text-xs text-gray-600 mt-1">Conocer qué datos personales tenemos en nuestro poder y para qué han sido tratados</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="font-bold text-gray-900 text-sm">✏️ Rectificar</p>
                  <p className="text-xs text-gray-600 mt-1">Solicitar la corrección de datos inexactos, incompletos o desactualizados</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="font-bold text-gray-900 text-sm">🗑️ Cancelar (Eliminar)</p>
                  <p className="text-xs text-gray-600 mt-1">Solicitar la eliminación de sus datos cuando no sean necesarios para las finalidades descritas</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="font-bold text-gray-900 text-sm">⛔ Oponerse</p>
                  <p className="text-xs text-gray-600 mt-1">Oponerse al tratamiento de sus datos para finalidades específicas (ej. comunicaciones comerciales)</p>
                </div>
              </div>

              <p className="mt-3">Adicionalmente, usted tiene derecho a:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Solicitar prueba</strong> de la autorización otorgada para el tratamiento de datos</li>
                <li><strong>Revocar</strong> el consentimiento en cualquier momento, cuando no sea necesario para la prestación del servicio</li>
                <li><strong>Presentar quejas</strong> ante la <strong>Superintendencia de Industria y Comercio (SIC)</strong> por infracciones a la Ley 1581 de 2012</li>
                <li><strong>Ser informado</strong> del uso que se ha dado a sus datos personales</li>
              </ul>
            </Section>

            {/* 8. Procedimiento */}
            <Section icon={<Mail size={20} />} title="8. Procedimiento para ejercer sus derechos">
              <p>Para ejercer sus derechos ARCO, puede contactarnos a través de los siguientes medios:</p>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3 mt-3">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-teal-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Correo electrónico</p>
                    <a href="mailto:privacidad@antigravityfarmacy.co" className="text-xs text-teal-700 hover:underline">
                      privacidad@antigravityfarmacy.co
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-teal-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Dirección física</p>
                    <p className="text-xs text-gray-600">Bogotá D.C., Colombia</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-teal-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">A través de la plataforma</p>
                    <p className="text-xs text-gray-600">Desde su cuenta en &laquo;Mi cuenta&raquo; → &laquo;Datos personales&raquo;</p>
                  </div>
                </div>
              </div>

              <p className="mt-3">
                Su solicitud será atendida en un plazo máximo de <strong>15 días hábiles</strong> contados desde la fecha de recepción, 
                conforme al artículo 21 del Decreto 1377 de 2013. En caso de no ser posible atenderla en dicho plazo, 
                le informaremos los motivos de la demora y la fecha en que se dará trámite a su solicitud.
              </p>
            </Section>

            {/* 9. Datos sensibles */}
            <Section icon={<AlertTriangle size={20} />} title="9. Tratamiento de datos sensibles (salud)">
              <p>
                Los datos de salud (alérgenos, condiciones preexistentes, medicamentos de uso habitual) son considerados 
                <strong> datos sensibles</strong> según el artículo 5 de la Ley 1581 de 2012.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3 space-y-2">
                <p className="font-semibold text-amber-900">Su consentimiento es explícito y voluntario:</p>
                <ul className="list-disc pl-5 space-y-1 text-amber-800">
                  <li>Puede suministrar esta información de manera voluntaria desde su perfil de salud</li>
                  <li>NO es obligatorio registrar datos de salud para usar la plataforma</li>
                  <li>Puede eliminar o modificar estos datos en cualquier momento</li>
                  <li>Puede revocar el consentimiento para su tratamiento en cualquier momento</li>
                  <li>Estos datos solo se usan para alertas de interacciones medicamentosas y alérgenos</li>
                  <li>NO compartimos datos de salud con terceros sin su autorización expresa</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ⚕️ Esta herramienta es informativa y no reemplaza la consulta con un profesional de la salud.
              </p>
            </Section>

            {/* 10. Cookies */}
            <Section icon={<Globe size={20} />} title="10. Política de cookies">
              <p>Utilizamos cookies y tecnologías similares para el correcto funcionamiento del sitio web:</p>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left p-2 font-semibold">Tipo</th>
                      <th className="text-left p-2 font-semibold">Propósito</th>
                      <th className="text-left p-2 font-semibold">Duración</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="p-2">Técnicas (esenciales)</td>
                      <td className="p-2">Autenticación, carrito de compras, sesión de usuario</td>
                      <td className="p-2">Sesión / 30 días</td>
                    </tr>
                    <tr>
                      <td className="p-2">Funcionales</td>
                      <td className="p-2">Preferencias de usuario, idioma, ciudad de envío</td>
                      <td className="p-2">1 año</td>
                    </tr>
                    <tr>
                      <td className="p-2">Análisis (anónimas)</td>
                      <td className="p-2">Estadísticas de navegación para mejorar el servicio</td>
                      <td className="p-2">90 días</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                No utilizamos cookies de rastreo publicitario ni compartimos datos de navegación con terceros para fines de publicidad comportamental.
              </p>
            </Section>

            {/* 11. Vigencia */}
            <Section icon={<Clock size={20} />} title="11. Vigencia y actualizaciones">
              <p>
                La presente política entra en vigor a partir de su publicación y estará vigente hasta que sea modificada total o parcialmente.
              </p>
              <p>
                Nos reservamos el derecho de actualizarla en cualquier momento para reflejar cambios en la legislación aplicable, 
                en nuestras prácticas de tratamiento de datos, o en la infraestructura tecnológica.
              </p>
              <p>
                Las modificaciones sustanciales serán notificadas a los titulares a través de:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Publicación en nuestro portal web con 15 días calendario de antelación a su entrada en vigor</li>
                <li>Correo electrónico a los usuarios registrados</li>
                <li>Notificación push (para usuarios que hayan activado este canal)</li>
              </ul>
              <p>
                Se recomienda a los titulares revisar periódicamente esta política para estar informados sobre cómo protegemos su información.
              </p>
            </Section>

            {/* 12. Autoridad */}
            <Section icon={<Scale size={20} />} title="12. Autoridad de control">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="font-semibold text-gray-900">Superintendencia de Industria y Comercio (SIC)</p>
                <p className="text-xs text-gray-600 mt-1">Delegatura de Protección de Datos Personales</p>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <Globe size={12} className="text-gray-400" />
                  <a href="https://www.sic.gov.co" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
                    www.sic.gov.co
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Si considera que sus derechos han sido vulnerados, puede presentar una queja ante la SIC, 
                  en cumplimiento del artículo 22 de la Ley 1581 de 2012.
                </p>
              </div>
            </Section>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-gray-100">
              <div className="p-4 bg-gradient-to-r from-teal-50 to-blue-50 rounded-xl text-xs text-gray-600 space-y-1">
                <p><strong>Antigravity Farmacy S.A.S.</strong> — NIT 901.xxx.xxx-x</p>
                <p>Bogotá D.C., Colombia</p>
                <p>
                  Contacto: <a href="mailto:privacidad@antigravityfarmacy.co" className="text-teal-700 hover:underline">privacidad@antigravityfarmacy.co</a>
                </p>
                <p className="text-[10px] text-gray-400 pt-1">
                  Documento actualizado: mayo 2026 · Versión 2.0 · Cumplimiento Ley 1581 de 2012 y Decreto 1377 de 2013
                </p>
              </div>
            </div>

          </div>
        </section>
      </div>
    </>
  )
}
