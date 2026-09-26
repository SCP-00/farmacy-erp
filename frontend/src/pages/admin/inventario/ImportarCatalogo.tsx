import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Upload, FileText, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { importadorService } from '@/services'

interface ResultadoFila {
  fila: number
  cum: string
  accion: 'creado' | 'actualizado' | 'error'
  detalle?: string
}

const CSV_EJEMPLO = `cum,nombre,principioActivo,laboratorio,presentacion,concentracion,precioVenta,stockMinimo,requiereRx,categoria,alergenos,advertencias
1998346-R1,Acetaminofén 500mg,Acetaminofén,Genfar,Caja x 10,500 mg,3500,10,no,Analgésicos,Lactosa,No exceder la dosis
2000123-R2,Ibuprofeno 400mg,Ibuprofeno,MK,Caja x 10,400 mg,5200,8,no,Antiinflamatorios,,`

export default function ImportarCatalogo() {
  const [csv, setCsv] = useState('')
  const qc = useQueryClient()

  const importMut = useMutation({
    mutationFn: () => importadorService.productos(csv),
    onSuccess: (data: any) => {
      toast.success(`${data.creados} creados, ${data.actualizados} actualizados, ${data.errores} errores`)
      qc.invalidateQueries({ queryKey: ['productos'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Error al importar'),
  })

  const leerArchivo = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result ?? ''))
    reader.readAsText(file, 'utf-8')
  }

  const data = importMut.data

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Importar catálogo</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carga masiva de medicamentos por CSV. Cada fila se procesa por separado: los productos
          existentes (por CUM) se actualizan, los nuevos se crean, y los errores no detienen la carga.
        </p>
      </div>

      <div className="surface p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold flex items-center gap-2"><FileText size={16} /> Contenido CSV</h2>
          <label className="btn-secondary !px-3 !py-1.5 text-sm cursor-pointer">
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => leerArchivo(e.target.files?.[0])} />
            Cargar archivo .csv
          </label>
        </div>
        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          rows={8}
          placeholder={CSV_EJEMPLO}
          className="input-base font-mono text-xs resize-y"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={() => importMut.mutate()}
            disabled={!csv.trim() || importMut.isPending}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar {csv.trim() ? `(${csv.trim().split('\n').length - 1} filas)` : ''}
          </button>
          <span className="text-xs text-gray-400">La primera línea debe ser la cabecera de columnas</span>
        </div>
      </div>

      {data && (
        <div className="surface p-5 space-y-4">
          <div className="flex gap-6 text-sm font-medium">
            <span className="text-green-600">✓ {data.creados} creados</span>
            <span className="text-blue-600">↻ {data.actualizados} actualizados</span>
            <span className="text-red-600">✗ {data.errores} errores</span>
            <span className="text-gray-400">de {data.totalFilas} filas</span>
          </div>
          <div className="max-h-96 overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">Fila</th>
                  <th className="px-4 py-2 text-left">CUM</th>
                  <th className="px-4 py-2 text-left">Resultado</th>
                  <th className="px-4 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {data.resultados.map((r: ResultadoFila) => (
                  <tr key={r.fila} className="border-t dark:border-slate-700">
                    <td className="px-4 py-2">{r.fila}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.cum}</td>
                    <td className="px-4 py-2">
                      {r.accion === 'creado' && <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14} /> Creado</span>}
                      {r.accion === 'actualizado' && <span className="text-blue-600 flex items-center gap-1"><RefreshCw size={14} /> Actualizado</span>}
                      {r.accion === 'error' && <span className="text-red-600 flex items-center gap-1"><XCircle size={14} /> Error</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.detalle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
