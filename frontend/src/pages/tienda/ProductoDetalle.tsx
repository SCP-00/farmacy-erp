import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, ShoppingCart, Truck, ShieldAlert, Heart, AlertTriangle, Info, FileText, Pill, Eye, FlaskConical, Ban, Activity, Scale, ScrollText, CalendarDays, Building2, Hash, Syringe, Stethoscope } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCarritoStore } from '@/store/carritoStore'
import { useFormateo, useAuthCliente } from '@/hooks'
import { clientesService, productosService, chatbotService } from '@/services'
import toast from 'react-hot-toast'
import SEOHead from '@/components/shared/SEOHead'
import InteractionAlertModal from '@/components/shared/InteractionAlertModal'

export default function ProductoDetalle() {
  const { id } = useParams()
  const { cop } = useFormateo()
  const agregar = useCarritoStore((state) => state.agregar)
  const { estaLogueado } = useAuthCliente()
  const queryClient = useQueryClient()
  const [esFavorito, setEsFavorito] = useState(false)
  const [tabActiva, setTabActiva] = useState<'invima' | 'seguridad' | 'clinica'>('invima')

  const { data: producto, isLoading: isLoadingProducto } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => productosService.obtener(id!),
    enabled: !!id
  })

  const favoritosQuery = useQuery({
    queryKey: ['favoritos-cliente'],
    queryFn: clientesService.obtenerFavoritos,
    enabled: estaLogueado,
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (!producto || !favoritosQuery.data) return
    setEsFavorito(
      favoritosQuery.data.some((favorito: { productoId: string }) => favorito.productoId === producto.id)
    )
  }, [favoritosQuery.data, producto])

  const [alertasInteraccion, setAlertasInteraccion] = useState<any[] | null>(null)
  const [verificandoInteraccion, setVerificandoInteraccion] = useState(false)

  const verificarInteracciones = async () => {
    if (!producto) return
    setVerificandoInteraccion(true)
    try {
      // Mostrar interacciones locales del producto si existen
      if (producto.interacciones) {
        setAlertasInteraccion([{
          tipo: 'INFORMACION',
          severidad: 'MEDIA',
          productoA: producto.nombre,
          descripcion: producto.interacciones,
        }])
        return
      }
      // Intentar verificación en backend (requiere al menos 2 productos)
      const res = await chatbotService.verificarInteracciones([producto.id])
      if (res?.tieneAlertas && res?.alertas?.length > 0) {
        setAlertasInteraccion(res.alertas)
      } else {
        toast.success('No se detectaron interacciones medicamentosas documentadas para este producto')
      }
    } catch (err: any) {
      // Si el backend requiere 2+ productos, mostrar mensaje claro
      if (err?.response?.data?.error?.includes?.('dos productos')) {
        toast('Para verificar interacciones entre medicamentos, agrega otro producto al carrito y vuelve a intentar.', { icon: '💡' })
      } else {
        toast.error('Error al verificar interacciones. Intenta de nuevo.')
      }
    } finally {
      setVerificandoInteraccion(false)
    }
  }

  const favoritoMutation = useMutation({
    mutationFn: () => clientesService.toggleFavorito(producto?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoritos-cliente'] })
      setEsFavorito(prev => !prev)
      toast.success(esFavorito ? 'Eliminado de favoritos' : 'Agregado a favoritos')
    },
  })

  if (isLoadingProducto) {
    return (
      <>
        <SEOHead title="Cargando..." path={`/productos/${id}`} />
        <div className="py-20 text-center text-gray-500">Cargando información regulatoria de la base de datos...</div>
      </>
    )
  }

  if (!producto) {
    return (
      <>
        <SEOHead title="Producto no encontrado" path={`/productos/${id}`} />
        <div className="section-shell py-12">
        <div className="surface p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Producto no encontrado</h1>
          <p className="mt-3 text-slate-600">El producto no existe, es de uso institucional controlado o fue retirado del sistema INVIMA.</p>
          <Link to="/productos" className="btn-primary mt-6">
            <ArrowLeft className="w-4 h-4" /> Volver al catálogo
          </Link>
        </div>
      </div>
      </>
    )
  }

  const stockTotal = producto.lotes?.reduce((sum: number, l: any) => sum + l.cantidadActual, 0) ?? 0
  const precio = Number(producto.precioVenta)

  const agregarAlCarrito = () => {
    agregar({
      productoId: producto.id,
      nombre: producto.nombre,
      marca: producto.laboratorio || 'Genérico',
      presentacion: producto.presentacion || '',
      concentracion: producto.concentracion || '',
      precioUnitario: precio,
      cantidad: 1,
      stockMaximo: stockTotal,
      requiereRx: producto.requiereRx,
      disponibleEnvio: true,
      disponibleTienda: true,
      imagenUrl: producto.imagenUrl,
    })
  }

  const listaAlergenos = producto.alergenos
    ? producto.alergenos.split(',').map((a: string) => a.trim())
    : []

  const fmtFecha = (f: string | null | undefined) => {
    if (!f) return 'No registrada'
    return new Date(f).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const esControlEspecial = producto.requiereRx || producto.modalidad?.toLowerCase().includes('control')

  return (
    <>
      <SEOHead
        title={producto?.nombre ? `${producto.nombre} ${producto.concentracion || ''}` : 'Producto'}
        description={producto?.presentacion ? `${producto.nombre} — ${producto.presentacion}. ${producto.laboratorio || ''}. Precio: $${Number(producto.precioVenta).toLocaleString()}.` : `Detalle de ${producto?.nombre}`}
        path={`/productos/${id}`}
        image={producto?.imagenUrl || undefined}
      />
      <div className="section-shell py-8 md:py-10">
      <Link to="/productos" className="inline-flex items-center gap-2 text-teal-700 font-semibold hover:text-teal-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="surface p-6 md:p-8">
          <div className="aspect-square rounded-[2rem] bg-gradient-to-br from-teal-50 to-sky-50 flex items-center justify-center text-8xl">
            💊
          </div>
        </div>

        <div className="surface p-6 md:p-8 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="section-chip">{producto.categoria?.nombre || 'Antialérgicos'}</span>
              {producto.esMuestraMedica && (
                <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded-md border border-red-200">
                  🚫 Muestra Médica
                </span>
              )}
              {producto.estadoCum === 'Inactivo' && (
                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded-md border border-gray-200">
                  CUM Inactivo
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{producto.nombre} {producto.concentracion}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Por {producto.laboratorio || producto.titular || 'Laboratorio no registrado'}
            </p>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-teal-700">{cop(precio)}</span>
            {precio > 0 && (
              <span className="text-sm text-slate-400 line-through">{cop(Math.round(precio * 1.18))}</span>
            )}
            {producto.esMuestraMedica && (
              <span className="text-sm font-bold text-red-600">NO COMERCIALIZABLE</span>
            )}
          </div>

          <div className="space-y-3">
            {esControlEspecial && (
              <div className="flex gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-xs font-semibold">
                <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-wider">Medicamento de Control Especial</p>
                  <p className="font-normal text-red-700 mt-0.5">
                    {producto.requiereRx
                      ? 'Se requiere presentar la prescripción médica original firmada al momento del despacho.'
                      : 'Este producto está sujeto a vigilancia y control sanitario.'}
                  </p>
                </div>
              </div>
            )}

            {listaAlergenos.length > 0 && (
              <div className="flex gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-wider">Alerta de Excipientes / Alérgenos</p>
                  <p className="text-amber-800 mt-0.5 mb-1.5">Este medicamento contiene los siguientes excipientes con potencial alergénico:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {listaAlergenos.map((al: string) => (
                      <span key={al} className="px-2 py-0.5 bg-amber-200/50 text-amber-800 rounded-md font-bold text-[10px] uppercase">
                        {al}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {producto.advertencias && (
              <div className="flex gap-2.5 p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-xs">
                <Info className="w-5 h-5 text-sky-600 flex-shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-wider">Precauciones de Uso Seguro</p>
                  <p className="text-sky-800 mt-0.5 leading-relaxed">{producto.advertencias}</p>
                </div>
              </div>
            )}

            {producto.interacciones && (
              <div className="flex gap-2.5 p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 text-xs">
                <Activity className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="font-bold uppercase tracking-wider">Interacciones Medicamentosas</p>
                  <p className="text-purple-800 mt-0.5 leading-relaxed">{producto.interacciones}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
            <p className="flex items-center gap-2"><Truck className="w-4 h-4 text-teal-700" /> {producto.modalidad?.includes('IMPORTAR') ? 'Producto importado' : 'Fabricado en Colombia'} · Disponible para domicilio</p>
            <p className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600" /> {stockTotal > 0 ? `${stockTotal} unidades en inventario real (FEFO)` : 'Agotado temporalmente'}</p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={agregarAlCarrito} disabled={stockTotal === 0 || producto.esMuestraMedica} className="btn-primary disabled:opacity-50">
              <ShoppingCart className="w-4 h-4" /> Agregar al carrito
            </button>
            {estaLogueado && (
              <button
                onClick={() => favoritoMutation.mutate()}
                disabled={favoritoMutation.isPending}
                className={`btn-secondary ${esFavorito ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : ''}`}
              >
                <Heart className={`w-4 h-4 ${esFavorito ? 'fill-red-700' : ''}`} />
                {esFavorito ? 'En favoritos' : 'Guardar favorito'}
              </button>
            )}
            <button
              onClick={verificarInteracciones}
              disabled={verificandoInteraccion}
              className="btn-secondary border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Stethoscope className="w-4 h-4" />
              {verificandoInteraccion ? 'Verificando...' : 'Verificar interacciones'}
            </button>
          </div>
        </div>
      </div>

      <div className="surface p-6 md:p-8 mt-8">
        <div className="flex border-b border-slate-200 mb-6 -mx-6 md:-mx-8 px-6 md:px-8">
          {[
            { id: 'invima' as const, label: 'Registro Sanitario', icon: FileText },
            { id: 'seguridad' as const, label: 'Seguridad y Alérgenos', icon: ShieldAlert },
            { id: 'clinica' as const, label: 'Información Clínica', icon: Pill },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                tabActiva === tab.id
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {tabActiva === 'invima' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-teal-700" /> Ficha Técnica Autorizada (INVIMA)
            </h2>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <ScrollText size={14} /> Datos del Registro Sanitario
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs text-slate-700 bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><Hash size={12} /> Registro Sanitario:</span>
                  <span className="font-semibold text-slate-900 font-mono">{producto.registroInvima}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><Building2 size={12} /> Titular:</span>
                  <span className="font-semibold text-slate-900">{producto.titular || 'No registrado'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><CalendarDays size={12} /> Fecha Expedición:</span>
                  <span className="font-semibold text-slate-900">{fmtFecha(producto.fechaExpedicion)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><CalendarDays size={12} /> Vencimiento Registro:</span>
                  <span className="font-semibold text-slate-900">{fmtFecha(producto.fechaVencimientoRegistro)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Estado del Registro:</span>
                  <span className={`font-semibold ${producto.estadoRegistro === 'Vigente' ? 'text-green-600' : 'text-red-600'}`}>
                    {producto.estadoRegistro || 'Vigente'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Expediente:</span>
                  <span className="font-mono font-semibold text-slate-900">{producto.expediente || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Hash size={14} /> CUM — Código Único de Medicamento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs text-slate-700 bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">CUM (Código de Barras):</span>
                  <span className="font-mono font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded text-[11px]">{producto.cum}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Estado CUM:</span>
                  <span className={`font-semibold ${producto.estadoCum === 'Activo' ? 'text-green-600' : 'text-red-600'}`}>
                    {producto.estadoCum}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><CalendarDays size={12} /> Fecha Activación CUM:</span>
                  <span className="font-semibold text-slate-900">{fmtFecha(producto.fechaActivoCum)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><CalendarDays size={12} /> Fecha Inactivación CUM:</span>
                  <span className="font-semibold text-slate-900">{fmtFecha(producto.fechaInactivoCum)}</span>
                </div>
                {producto.ium && (
                  <div className="flex justify-between border-b border-slate-100 py-2 col-span-1 md:col-span-2">
                    <span className="text-slate-400">IUM (Identificador Único de Medicamento):</span>
                    <span className="font-mono font-semibold text-slate-900">{producto.ium}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Scale size={14} /> Clasificación ATC
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs text-slate-700 bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Código ATC:</span>
                  <span className="font-mono font-bold text-slate-900">{producto.atc || 'No asignado'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Descripción ATC:</span>
                  <span className="font-semibold text-slate-900 text-right max-w-[250px]">{producto.descripcionAtc || 'No registrada'}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Syringe size={14} /> Forma Farmacéutica y Administración
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs text-slate-700 bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><FlaskConical size={12} /> Forma Farmacéutica:</span>
                  <span className="font-semibold text-slate-900">{producto.formaFarmaceutica || 'No registrada'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><Eye size={12} /> Vía de Administración:</span>
                  <span className="font-semibold text-slate-900">{producto.viaAdministracion || 'No registrada'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Concentración:</span>
                  <span className="font-semibold text-slate-900">{producto.concentracion || 'No registrada'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Unidad de Medida:</span>
                  <span className="font-semibold text-slate-900">{producto.unidadMedida || 'No registrada'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Cantidad por Empaque:</span>
                  <span className="font-semibold text-slate-900">{producto.cantidad || 'No registrada'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-2">
                  <span className="text-slate-400">Unidad de Referencia:</span>
                  <span className="font-semibold text-slate-900">{producto.unidadReferencia || 'No registrada'}</span>
                </div>
              </div>
            </div>

            {producto.presentacion && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Presentación Comercial Autorizada</h3>
                <div className="bg-gradient-to-r from-slate-50 to-teal-50 border border-teal-100 p-4 rounded-xl">
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{producto.presentacion}</p>
                  {producto.modalidad && (
                    <p className="text-[10px] text-slate-400 mt-2">Modalidad: {producto.modalidad}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tabActiva === 'seguridad' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert size={18} className="text-teal-700" /> Seguridad y Farmacovigilancia
            </h2>

            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-5">
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-3">
                <AlertTriangle size={16} /> Excipientes y Alérgenos Críticos
              </h3>
              {listaAlergenos.length > 0 ? (
                <>
                  <p className="text-xs text-amber-800 mb-3">
                    Este producto contiene los siguientes excipientes que pueden causar reacciones alérgicas en personas sensibles:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {listaAlergenos.map((al: string) => (
                      <div key={al} className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs">
                        <span className="font-bold text-amber-900 uppercase">{al}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600 mt-3 italic">
                    Si es alérgico a alguno de estos componentes, consulte a su médico antes de usar este medicamento.
                  </p>
                </>
              ) : (
                <p className="text-xs text-amber-700">Este producto no declara excipientes con potencial alergénico conocido.</p>
              )}
            </div>

            {producto.advertencias && (
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-5">
                <h3 className="text-sm font-bold text-sky-900 flex items-center gap-2 mb-2">
                  <Info size={16} /> Precauciones y Advertencias
                </h3>
                <p className="text-xs text-sky-800 leading-relaxed">{producto.advertencias}</p>
              </div>
            )}

            {producto.esMuestraMedica && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2 mb-2">
                  <Ban size={16} /> Muestra Médica — Prohibida su Comercialización
                </h3>
                <p className="text-xs text-red-700 leading-relaxed">
                  Este producto está registrado como <strong>MUESTRA MÉDICA</strong>.
                  De acuerdo con la normativa INVIMA, las muestras médicas son de distribución
                  exclusiva para prescripción y no pueden ser comercializadas al público.
                </p>
              </div>
            )}
          </div>
        )}

        {tabActiva === 'clinica' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Pill size={18} className="text-teal-700" /> Información Farmacológica y Clínica
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-xl p-5 md:col-span-2">
                <h3 className="text-sm font-bold text-teal-900 flex items-center gap-2 mb-2">
                  <FlaskConical size={16} /> Principio Activo
                </h3>
                <p className="text-lg font-bold text-teal-800">{producto.principioActivo}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {producto.atc && (
                    <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono">
                      ATC: {producto.atc}
                    </span>
                  )}
                  {producto.descripcionAtc && (
                    <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                      {producto.descripcionAtc}
                    </span>
                  )}
                </div>
              </div>

              {producto.indicaciones && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2 mb-2">
                    <Info size={16} /> Indicaciones Terapéuticas
                  </h3>
                  <p className="text-xs text-blue-800 leading-relaxed whitespace-pre-line">{producto.indicaciones}</p>
                </div>
              )}

              {producto.modoUso && (
                <div className="bg-green-50/50 border border-green-100 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-green-900 flex items-center gap-2 mb-2">
                    <Info size={16} /> Modo de Uso / Dosificación
                  </h3>
                  <p className="text-xs text-green-800 leading-relaxed whitespace-pre-line">{producto.modoUso}</p>
                </div>
              )}

              {producto.contraindicaciones && (
                <div className="bg-red-50/50 border border-red-100 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-red-900 flex items-center gap-2 mb-2">
                    <Ban size={16} /> Contraindicaciones
                  </h3>
                  <p className="text-xs text-red-800 leading-relaxed whitespace-pre-line">{producto.contraindicaciones}</p>
                </div>
              )}

              {producto.reaccionesAdversas && (
                <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-orange-900 flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} /> Reacciones Adversas
                  </h3>
                  <p className="text-xs text-orange-800 leading-relaxed whitespace-pre-line">{producto.reaccionesAdversas}</p>
                </div>
              )}

              {producto.interacciones && (
                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-5 md:col-span-2">
                  <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2 mb-2">
                    <Activity size={16} /> Interacciones Medicamentosas
                  </h3>
                  <p className="text-xs text-purple-800 leading-relaxed whitespace-pre-line">{producto.interacciones}</p>
                </div>
              )}

              {!producto.indicaciones && !producto.modoUso && !producto.contraindicaciones && !producto.reaccionesAdversas && !producto.interacciones && (
                <div className="md:col-span-2 py-8 text-center">
                  <Pill size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-xs text-slate-400">
                    La información clínica detallada (indicaciones, modo de uso, contraindicaciones, reacciones adversas) está siendo cargada desde la base de datos INVIMA.
                  </p>
                  <p className="text-[10px] text-slate-300 mt-1">
                    Consulte siempre a su médico o farmacéutico antes de usar este medicamento.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {alertasInteraccion && (
        <InteractionAlertModal
          alertas={alertasInteraccion}
          onConfirm={() => setAlertasInteraccion(null)}
          onCancel={() => setAlertasInteraccion(null)}
          loading={false}
        />
      )}
    </div>
    </>
  )
}
