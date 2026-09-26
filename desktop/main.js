// ══════════════════════════════════════════════════════════
//  Farmacy Desktop (Electron) — empaquetado portable.
//
//  A diferencia de Tauri (que carga el dist embebido), Electron aquí
//  carga la PWA servida por el BACKEND (local o de la empresa): una
//  sola fuente de verdad, actualizaciones del ERP sin reempaquetar
//  el cliente. El POS offline funciona igual: el outbox IndexedDB es
//  persistente en la partición userData de la app.
//
//  Variables de entorno:
//    FARMACY_SERVER_URL  — URL del servidor a cargar
//                          (default: http://localhost:3000)
// ══════════════════════════════════════════════════════════

const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('path')

const SERVER_URL = process.env.FARMACY_SERVER_URL || 'http://localhost:3000'

// Permisos de red del renderer: solo al servidor Farmacy configurado
function esOrigenPermitido(url) {
  try { return new URL(url).origin === new URL(SERVER_URL).origin } catch { return false }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    center: true,
    title: 'Farmacy — Punto de Venta',
    icon: path.join(__dirname, '../frontend/src-tauri/icons/icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Enlaces externos → navegador del sistema (nunca navegar la ventana fuera del ERP)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (esOrigenPermitido(url)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.loadURL(SERVER_URL)
}

// Menú mínimo en español (sin atajos de desarrollo en producción)
function crearMenu() {
  const esMenu = [
    ...(app.isPackaged ? [] : [{
      label: 'Desarrollo',
      submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }],
    }]),
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        { role: 'close', label: 'Cerrar' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(esMenu))
}

app.whenReady().then(() => {
  crearMenu()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
