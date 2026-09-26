// Preload de Farmacy Desktop: puente mínimo y seguro entre el ERP
// (renderer aislado) y Electron. Expone SOLO lectura del nombre de la
// app — el POS no necesita más acceso nativo en esta fase.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  plataforma: process.platform,
  esFarmacyDesktop: true,
  version: process.env.npm_package_version ?? '1.0.0',
})
