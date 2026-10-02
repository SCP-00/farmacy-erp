import { useState } from 'react'
import { Printer, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { imprimirTirilla } from '@/services/impresion'

interface InvoiceProps {
  venta: any
  onClose: () => void
  /** Id de la venta en el servidor (necesario para imprimir en térmica). */
  ventaId?: string
}

export default function InvoicePreview({ venta, onClose, ventaId }: InvoiceProps) {
  const [imprimiendo, setImprimiendo] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const handleImprimirTermica = async () => {
    if (!ventaId) {
      toast('Venta aún no sincronizada: use la impresión del navegador', { icon: '🖨️' })
      window.print()
      return
    }
    setImprimiendo(true)
    try {
      const res = await imprimirTirilla(ventaId, { abrirCajon: true })
      if (res.impreso) {
        toast.success('Tirilla enviada a la impresora')
      } else {
        toast.error(res.motivo ?? 'No hay impresora configurada')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'No se pudo imprimir')
    } finally {
      setImprimiendo(false)
    }
  }

  // Estilos pensados para impresora térmica de 80mm
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:bg-white print:fixed print:inset-0 print:z-[9999]">
      {/* Botones de acción (ocultos al imprimir) */}
      <div className="absolute top-4 right-4 flex gap-3 print:hidden">
        <button onClick={handleImprimirTermica} disabled={imprimiendo} className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-xl font-medium hover:bg-teal-600 disabled:opacity-50 transition shadow-lg">
          <Printer size={18} /> {imprimiendo ? 'Imprimiendo...' : 'Imprimir en térmica'}
        </button>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-800 rounded-xl font-medium hover:bg-gray-100 transition shadow-lg">
          <Printer size={18} /> Imprimir tirilla
        </button>
        <button onClick={onClose} className="p-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition shadow-lg">
          <X size={20} />
        </button>
      </div>

      {/* Contenedor del recibo */}
      <div className="bg-white w-[80mm] min-h-[100mm] p-4 shadow-2xl text-black font-mono text-xs print:shadow-none print:p-0 print:m-0 mx-auto">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold uppercase tracking-wider">FARMACY</h2>
          <p className="text-[10px]">NIT: 900.000.000-1</p>
          <p className="text-[10px]">Sede Principal</p>
          <p className="text-[10px]">Tel: (606) 335-0000</p>
          <div className="border-b-2 border-dashed border-black my-2"></div>
        </div>

        <div className="mb-4">
          <p>FECHA: {venta.fecha ? new Date(venta.fecha).toLocaleString('es-CO') : new Date().toLocaleString('es-CO')}</p>
          <p>TICKET: #F-{String(venta.numero ?? 0).padStart(5, '0')}</p>
          <p>CAJERO: {venta.cajero ?? 'Empleado'}</p>
          <p>CLIENTE: {venta.cliente?.nombre ?? 'Consumidor Final'}</p>
          {venta.cliente?.documento && <p>CC/NIT: {venta.cliente.documento}</p>}
        </div>

        <div className="border-b-2 border-dashed border-black my-2"></div>

        <table className="w-full text-left mb-2">
          <thead>
            <tr>
              <th className="py-1">CANT</th>
              <th className="py-1">PRODUCTO</th>
              <th className="py-1 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {venta.items.map((it: any, idx: number) => (
              <tr key={idx}>
                <td className="py-1 align-top">{it.cantidad}</td>
                <td className="py-1 align-top pr-1">{it.nombre}</td>
                <td className="py-1 align-top text-right">${(it.precioUnitario * it.cantidad).toLocaleString('es-CO')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-b-2 border-dashed border-black my-2"></div>

        <div className="space-y-1">
          <div className="flex justify-between"><span>SUBTOTAL:</span><span>${(venta.subtotal ?? 0).toLocaleString('es-CO')}</span></div>
          {venta.descuento > 0 && <div className="flex justify-between"><span>DESCUENTO:</span><span>-${venta.descuento.toLocaleString('es-CO')}</span></div>}
          <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-black">
            <span>TOTAL:</span><span>${(venta.total ?? 0).toLocaleString('es-CO')}</span>
          </div>
        </div>

        <div className="text-center mt-6 space-y-1">
          <p>MÉTODO DE PAGO: {venta.metodoPago ?? 'EFECTIVO'}</p>
          <div className="border-b-2 border-dashed border-black my-3"></div>
          <p className="font-bold">¡GRACIAS POR SU COMPRA!</p>
          <p className="text-[9px]">Conserve este recibo para cualquier reclamo.</p>
          <p className="text-[9px]">Devoluciones max. 15 dias.</p>
        </div>
      </div>
    </div>
  )
}
