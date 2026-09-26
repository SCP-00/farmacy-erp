// ══════════════════════════════════════════════════════════
//  Farmacy Desktop (Tauri v2) — wrapper nativo del POS.
//
//  El frontend es el MISMO build Vite/PWA de producción (dist/).
//  La ventana carga la PWA servida desde el backend (nube o LAN).
//  La lógica offline (outbox IndexedDB, idempotencia, cola de
//  excepciones) vive en el frontend: el wrapper aporta ventana
//  propia, icono en barra de tareas y arranque como app de escritorio.
// ══════════════════════════════════════════════════════════

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error al ejecutar Farmacy Desktop");
}
