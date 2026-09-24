import { Link } from 'react-router-dom'
import { MapPin, ChevronRight, ShoppingCart, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useCarrito, useFormateo, useCategorias } from '@/hooks'
import { CATEGORIAS_ICONOS } from '@/config/constants'
import { mockSedes } from '@/data/catalogo'
import { productosService } from '@/services'
import SEOHead from '@/components/shared/SEOHead'

function Hero() {
  const { data } = useQuery({ queryKey: ['productos-hero'], queryFn: () => productosService.buscar({ limite: 4 }) })
  const destacados = data?.data ?? []

  return (
    <section className="section-shell py-8 md:py-12">
      <div className="hero-panel overflow-hidden rounded-[2rem] text-white shadow-2xl">
        <div className="grid lg:grid-cols-[1.25fr_0.85fr] gap-8 items-center px-6 py-10 md:px-10 md:py-14">
          <div>
            <h1 className="mt-5 max-w-2xl text-4xl md:text-6xl font-bold tracking-tight">
              Farmacia digital con inventario en tiempo real.
            </h1>
            <p className="mt-5 max-w-xl text-base md:text-lg text-white/85 leading-7">
              Explora medicamentos, cuidado personal y vitaminas conectados directamente con nuestro inventario físico y método FEFO.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/productos" className="btn-primary bg-white text-teal-900 hover:bg-teal-50">
                Ver catálogo
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur border border-white/20">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Recomendados hoy</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {destacados.map((producto: any) => (
                  <Link key={producto.id} to={`/productos/${producto.id}`} className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/20">
                    <div className="text-2xl">{CATEGORIAS_ICONOS[producto.categoria?.nombre] ?? '💊'}</div>
                    <p className="mt-2 text-sm font-semibold leading-tight text-white">{producto.nombre}</p>
                    <p className="text-xs text-white/70">{producto.concentracion}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SeccionCategorias() {
  const { data: categorias } = useCategorias()
  
  return (
    <section className="section-shell py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <span className="section-kicker">Categorías</span>
          <h2 className="section-title mt-2">Explorar por categoría</h2>
        </div>
        <Link to="/productos" className="text-sm text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1">
          Ver todo <ChevronRight size={14}/>
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-3">
        {(categorias ?? []).map((cat: any) => (
          <Link key={cat.id} to={`/productos?categoria=${cat.slug}`} className="surface flex flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md group">
            <span className="text-2xl group-hover:scale-110 transition-transform">{CATEGORIAS_ICONOS[cat.nombre] ?? '💊'}</span>
            <span className="text-[11px] font-semibold text-slate-600 leading-tight">{cat.nombre}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ProductosDestacados() {
  const { agregar } = useCarrito()
  const { cop } = useFormateo()
  const { data } = useQuery({ queryKey: ['productos-destacados'], queryFn: () => productosService.buscar({ ordenar: 'stock', limite: 8 }) })
  const productos = data?.data ?? []

  return (
    <section className="section-shell py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <span className="section-kicker">Catálogo Vivo</span>
          <h2 className="section-title mt-2">Más vendidos en nuestras sedes</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {productos.map((p: any) => (
          <div key={p.id} className="card group hover:-translate-y-0.5 transition-transform">
            <div className="h-28 rounded-2xl mb-3 flex items-center justify-center bg-gradient-to-br from-teal-50 to-sky-50 group-hover:from-teal-100 group-hover:to-sky-100 transition-colors">
              <span className="text-4xl">{CATEGORIAS_ICONOS[p.categoria?.nombre] ?? '💊'}</span>
            </div>
            <span className="section-chip">{p.categoria?.nombre || 'General'}</span>
            <Link to={`/productos/${p.id}`} className="block text-sm font-semibold text-slate-900 hover:text-teal-700 transition-colors mt-2 mb-1 line-clamp-2 min-h-[40px]">
              {p.nombre} {p.concentracion}
            </Link>
            <p className="text-xs text-slate-500 mb-3 line-clamp-2">{p.presentacion}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="font-bold text-teal-700">{cop(Number(p.precioVenta))}</span>
              <button
                onClick={() => agregar({
                  productoId: p.id, nombre: p.nombre, marca: p.laboratorio || 'Genérico',
                  presentacion: p.presentacion ?? '', concentracion: p.concentracion ?? '',
                  precioUnitario: Number(p.precioVenta), cantidad: 1, stockMaximo: p.stockTotal,
                  requiereRx: p.requiereRx, disponibleEnvio: true, disponibleTienda: true,
                })}
                disabled={p.stockTotal === 0}
                className="w-9 h-9 bg-teal-700 text-white rounded-full flex items-center justify-center hover:bg-teal-500 disabled:opacity-40 transition-all hover:scale-110 active:scale-95"
              >
                <ShoppingCart size={13}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SeccionSedes() {
  return (
    <section className="section-shell py-10 pb-16">
      <div className="surface overflow-hidden bg-slate-950 text-white">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-0">
          <div className="p-8 md:p-10 bg-teal-900/95">
            <span className="section-kicker text-teal-200">Sedes</span>
            <h2 className="mt-3 text-3xl font-bold">Encuentra tu punto de atención más cercano</h2>
            <Link to="/sucursales" className="btn-primary mt-6 bg-white text-teal-900 hover:bg-teal-50">
              Ver sedes
            </Link>
          </div>
          <div className="grid gap-4 p-6 md:p-8">
            {mockSedes.map((sede) => (
              <div key={sede.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-lg font-semibold text-white">{sede.nombre}</h3>
                <div className="mt-3 space-y-2 text-sm text-white/75">
                  <p className="flex items-center gap-2"><MapPin size={14}/> {sede.direccion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Inicio() {
  return (
    <>
      <SEOHead
        title="Inicio"
        description="Farmacy — Tu farmacia digital de confianza en Pereira. Explora medicamentos, cuidado personal y vitaminas con inventario en tiempo real."
        path="/"
      />
      <Hero />
      <SeccionCategorias />
      <ProductosDestacados />
      <SeccionSedes />
    </>
  )
}