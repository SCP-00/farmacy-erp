import { useEffect, useState } from 'react'
import { Download, X, Sparkles } from 'lucide-react'
import { verificarActualizacion, VERSION_ACTUAL, type InfoActualizacion } from '@/services/actualizacion'

const CLAVE_OCULTO = 'farmacy.actualizacionOculta'

/**
 * Aviso de nueva versión en el panel admin.
 *
 * El instalador no puede auto-actualizarse sin firma de código, pero sí
 * avisar cuando hay una versión nueva y ofrecer la descarga. Se oculta
 * hasta que salga OTRA versión posterior.
 */
export default function AvisoActualizacion() {
  const [info, setInfo] = useState<InfoActualizacion | null>(null)
  const [oculto, setOculto] = useState(() => localStorage.getItem(CLAVE_OCULTO) === VERSION_ACTUAL)

  useEffect(() => {
    let vivo = true
    verificarActualizacion().then((r) => { if (vivo && r?.hayNueva) setInfo(r) })
    return () => { vivo = false }
  }, [])

  if (!info || oculto) return null

  const ocultar = () => {
    localStorage.setItem(CLAVE_OCULTO, VERSION_ACTUAL)
    setOculto(true)
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:bg-teal-900/20 dark:text-teal-200 dark:border-teal-800">
      <div className="flex items-center gap-2">
        <Sparkles size={16} />
        <span>
          Nueva versión <strong>{info.version}</strong> disponible (tienes la {VERSION_ACTUAL}).
        </span>
      </div>
      <div className="flex items-center gap-2">
        {info.url && (
          <a
            href={info.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-600"
          >
            <Download size={14} /> Descargar
          </a>
        )}
        <button onClick={ocultar} title="Ocultar hasta la próxima versión" className="p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
