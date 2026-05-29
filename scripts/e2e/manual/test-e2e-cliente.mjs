/**
 * ═══════════════════════════════════════════════════════════
 *  TEST E2E — Caso 1: Flujo completo cliente (B2C + POS)
 * ═══════════════════════════════════════════════════════════
 *
 *  Escenarios:
 *    1. Registrar nuevo cliente vía API
 *    2. Verificar email vía helper (DB + API)
 *    3. Login como cliente → obtener token
 *    4. Buscar productos en API
 *    5. Agregar producto a favoritos
 *    6. Login como admin (API) → crear venta POS con efectivo
 *    7. Verificar venta registrada
 *    8. Login como cliente nuevamente
 *    9. Ver historial de pedidos con detalles
 *   10. Verificar puntos acumulados
 *   11. (Opcional) Navegación frontend con screenshots
 *
 *  Ejecutar: node scripts/e2e/manual/test-e2e-cliente.mjs
 * ═══════════════════════════════════════════════════════════
 */

// ── Config ────────────────────────────────────────────────
const API_URL      = 'http://localhost:3000/api/v1'
const EMPLEADO     = { email: 'admin@farmacy.co', password: 'Admin@1234' }
const SUCURSAL_ID  = 1
const TS           = Date.now()
const CLIENTE      = {
  nombre:    'TestE2E',
  apellido:  'Usuario',
  email:     `test-e2e-${TS}@ejemplo.co`,
  password:  'TestPass1!',
}

// ── Helpers ───────────────────────────────────────────────
const fs = await import('fs')
fs.mkdirSync('test-screenshots', { recursive: true })

const logs = []
function log(step, msg, ok = true) {
  const icon = ok ? '✅' : '❌'
  const line = `${icon} [${step}] ${msg}`
  logs.push(line)
  console.log(line)
}
function error(step, msg) { log(step, msg, false) }

async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_URL}${path}`, opts)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok, data }
}
const apiPost = (p, b, t) => api(p, 'POST', b, t)
const apiGet  = (p, t) => api(p, 'GET', null, t)

async function verifyEmailHelper(email) {
  const { execSync } = await import('child_process')
  const result = execSync(
    `docker exec farmacy_postgres_dev psql -U farmacy_user -d farmacy_db -t -c "SELECT token_verificacion FROM clientes WHERE email='${email}' AND token_verificacion IS NOT NULL LIMIT 1;"`,
    { encoding: 'utf8', timeout: 10000 }
  )
  const token = result.trim()
  if (!token) throw new Error('No se encontró token de verificación')

  const res = await apiPost('/clientes/auth/verificar-email', { token })
  if (!res.ok) throw new Error(`Error verificando email: ${res.data?.error || res.status}`)
  return true
}

// ── Main test ─────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(55))
  console.log('  TEST E2E — FLUJO COMPLETO CLIENTE')
  console.log('═'.repeat(55) + '\n')
  console.log(`Cliente:  ${CLIENTE.email}`)
  console.log(`Admin:    ${EMPLEADO.email}\n`)

  const failedTests = []
  let clienteToken, adminToken, clienteDb, productos

  try {
    // ═══════════════════════════════════════════════════════
    //  1. REGISTRAR CLIENTE (API)
    // ═══════════════════════════════════════════════════════
    log('1', `Registrando cliente: ${CLIENTE.email}`)
    const reg = await apiPost('/clientes/auth/registro', {
      ...CLIENTE, autorizacionDatos: true,
    })
    if (!reg.ok && reg.status !== 409) throw new Error(`Registro falló: ${reg.data?.error || reg.status}`)
    log('1', reg.ok ? 'Creado exitosamente' : 'Ya existía')

    // ═══════════════════════════════════════════════════════
    //  2. VERIFICAR EMAIL
    // ═══════════════════════════════════════════════════════
    log('2', 'Verificando email vía helper (DB + API)...')
    await verifyEmailHelper(CLIENTE.email)
    log('2', 'Email verificado exitosamente')

    // ═══════════════════════════════════════════════════════
    //  3. LOGIN CLIENTE (API) — obtener token de cliente
    // ═══════════════════════════════════════════════════════
    log('3', 'Login como cliente...')
    const loginRes = await apiPost('/clientes/auth/login', {
      email: CLIENTE.email, password: CLIENTE.password,
    })
    if (!loginRes.ok) throw new Error(`Login cliente falló: ${loginRes.data?.error || loginRes.status}`)
    clienteToken = loginRes.data.data.token
    log('3', `Token obtenido exitosamente`)

    // ═══════════════════════════════════════════════════════
    //  4. BUSCAR PRODUCTOS
    // ═══════════════════════════════════════════════════════
    log('4', 'Buscando productos disponibles...')
    const prodRes = await apiGet('/productos/buscar?limite=5')
    productos = prodRes.data?.data ?? []
    if (productos.length === 0) throw new Error('No hay productos disponibles')

    productos.forEach((p, i) => {
      log('4', `  #${i+1}: ${p.nombre} — $${Number(p.precioVenta).toLocaleString()} — Stock: ${p.stock || 'N/A'}`)
    })

    // ═══════════════════════════════════════════════════════
    //  5. AGREGAR A FAVORITOS
    // ═══════════════════════════════════════════════════════
    log('5', 'Agregando productos a favoritos...')
    let favCount = 0
    for (let i = 0; i < Math.min(2, productos.length); i++) {
      const favRes = await apiPost('/clientes/auth/favoritos', 
        { productoId: productos[i].id },
        clienteToken
      )
      if (favRes.ok) {
        favCount++
        log('5', `  + ${productos[i].nombre}`)
      } else {
        error('5', `Error favorito #${i+1}: ${favRes.data?.error || favRes.status}`)
      }
    }
    log('5', `${favCount} producto(s) agregado(s) a favoritos`)

    // ═══════════════════════════════════════════════════════
    //  6. LOGIN COMO ADMIN + VENTA POS (EFECTIVO)
    // ═══════════════════════════════════════════════════════
    log('6a', 'Login como admin...')
    const adminRes = await apiPost('/auth/login', {
      email: EMPLEADO.email, password: EMPLEADO.password,
    })
    if (!adminRes.ok) throw new Error(`Admin login falló: ${adminRes.data?.error || adminRes.status}`)
    adminToken = adminRes.data.data.token
    log('6a', `Admin: ${adminRes.data.data.empleado.nombre} (${adminRes.data.data.empleado.rol})`)
    log('6b', 'Buscando cliente en DB para la venta...')

    const clientesRes = await apiGet(`/clientes?q=${CLIENTE.email}`, adminToken)
    const clientesList = clientesRes.data?.data ?? []
    clienteDb = clientesList.find(c => c.email === CLIENTE.email)
    if (!clienteDb) throw new Error('Cliente no encontrado en DB')

    log('6b', `Cliente encontrado: ${clienteDb.nombre} ${clienteDb.apellido} (ID: ${clienteDb.id})`)

    // Crear venta POS con efectivo (2 productos)
    log('6c', 'Registrando venta POS (EFECTIVO)...')
    const itemsVenta = productos.slice(0, 2).map(p => ({
      productoId: p.id,
      cantidad: 1,
      precioUnitario: Math.round(Number(p.precioVenta)),
      descuento: 0,
    }))

    const ventaRes = await apiPost('/ventas', {
      sucursalId: SUCURSAL_ID,
      clienteId: clienteDb.id,
      metodoPago: 'EFECTIVO',
      descuento: 0,
      items: itemsVenta,
    }, adminToken)

    if (!ventaRes.ok) {
      // Try without clienteId (POS anonymous sale)
      log('6c', 'Intento sin clienteId...', false)
      const ventaRes2 = await apiPost('/ventas', {
        sucursalId: SUCURSAL_ID,
        metodoPago: 'EFECTIVO',
        descuento: 0,
        items: itemsVenta,
      }, adminToken)

      if (!ventaRes2.ok) {
        const errMsg = ventaRes2.data?.error || JSON.stringify(ventaRes2.data).substring(0, 200)
        throw new Error(`Venta falló: ${errMsg}`)
      }

      log('6c', `Venta registrada (sin cliente): #${ventaRes2.data.data?.numero || ventaRes2.data.data?.id}`)
    } else {
      const v = ventaRes.data.data
      log('6c', `Venta registrada: #${v.numero || v.id} — Total: $${Number(v.total).toLocaleString()} — ${v.metodoPago || 'EFECTIVO'}`)
    }

    // ═══════════════════════════════════════════════════════
    //  7. VERIFICAR VENTA EN API
    // ═══════════════════════════════════════════════════════
    log('7', 'Verificando ventas registradas...')
    const ventasRes = await apiGet('/ventas?limite=5', adminToken)
    const ventas = ventasRes.data?.data ?? []
    log('7', `Total ventas registradas: ${ventas.length}`)

    if (ventas.length > 0) {
      const ultima = ventas[0]
      log('7', `Última venta: #${ultima.numero} — ${ultima.estado} — $${Number(ultima.total).toLocaleString()}`)
      if (ultima.detalles?.length > 0) {
        log('7', `  Productos:`)
        ultima.detalles.forEach(d => {
          log('7', `    ${d.producto?.nombre || d.productoId} x${d.cantidad} = $${Number(d.subtotal).toLocaleString()}`)
        })
      }
    }

    // ═══════════════════════════════════════════════════════
    //  8. CERRAR SESIÓN ADMIN
    // ═══════════════════════════════════════════════════════
    log('8', 'Cerrando sesión admin...')
    await apiPost('/auth/logout', { refreshToken: '' }, adminToken)
    log('8', 'Sesión admin cerrada')

    // ═══════════════════════════════════════════════════════
    //  9. LOGIN CLIENTE NUEVAMENTE
    // ═══════════════════════════════════════════════════════
    log('9', 'Re-login como cliente...')
    const loginRes2 = await apiPost('/clientes/auth/login', {
      email: CLIENTE.email, password: CLIENTE.password,
    })
    if (!loginRes2.ok) throw new Error(`Re-login cliente falló: ${loginRes2.data?.error || loginRes2.status}`)
    clienteToken = loginRes2.data.data.token
    log('9', 'Login exitoso')

    // ═══════════════════════════════════════════════════════
    // 10. VER HISTORIAL DE PEDIDOS
    // ═══════════════════════════════════════════════════════
    log('10', 'Consultando historial de pedidos...')
    const pedidosRes = await apiGet('/clientes/auth/pedidos', clienteToken)
    const pedidos = pedidosRes.data?.data ?? []
    log('10', `Pedidos encontrados: ${pedidos.length}`)

    if (pedidos.length > 0) {
      pedidos.forEach((p, i) => {
        const num = p.numero ? `#F-${String(p.numero).padStart(5, '0')}` : `#${p.id?.substring(0,8)}`
        log('10', `  ${i+1}. ${num} — ${p.estado} — $${Number(p.total).toLocaleString()} — ${new Date(p.creadoEn).toLocaleDateString()}`)

        if (p.detalles?.length > 0) {
          p.detalles.forEach(d => {
            log('10', `       ${d.producto?.nombre || 'Producto'} x${d.cantidad} = $${Number(d.subtotal).toLocaleString()}`)
          })
        }
      })
    } else {
      // La venta se registró sin clienteId (venta anónima)
      log('10', '  (La venta fue registrada sin asociar al cliente — verificar configuración POS)', false)
    }

    // ═══════════════════════════════════════════════════════
    // 11. VERIFICAR PUNTOS ACUMULADOS
    // ═══════════════════════════════════════════════════════
    log('11', 'Consultando perfil y puntos...')
    const meRes = await apiGet('/clientes/auth/me', clienteToken)
    const perfil = meRes.data?.data ?? {}

    log('11', `Cliente: ${perfil.nombre || CLIENTE.nombre} ${perfil.apellido || CLIENTE.apellido}`)
    log('11', `Email:   ${perfil.email || CLIENTE.email}`)
    log('11', `Puntos:  ${perfil.puntosAcumulados ?? 0} puntos`)

    if (perfil.puntosExpiranEn) {
      log('11', `Expiran: ${new Date(perfil.puntosExpiranEn).toLocaleDateString()}`)
    }

    if (perfil.telefono) log('11', `Teléfono: ${perfil.telefono}`)
    if (perfil.ciudad) log('11', `Ciudad: ${perfil.ciudad}`)

    // ═══════════════════════════════════════════════════════
    // 12. CERRAR SESIÓN CLIENTE
    // ═══════════════════════════════════════════════════════
    log('12', 'Cerrando sesión cliente...')
    await apiPost('/clientes/auth/logout', {}, clienteToken)
    log('12', 'Sesión cliente cerrada')

  } catch (err) {
    console.error(`\n💥 ERROR FATAL: ${err.message}\n`)
    failedTests.push(err.message)
  }

  // ═══════════════════════════════════════════════════════
  //  RESUMEN
  // ═══════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(55))
  console.log('  RESUMEN DE PRUEBAS')
  console.log('═'.repeat(55))

  const failed = logs.filter(l => l.startsWith('❌') || l.startsWith('💥'))
  const passed = logs.filter(l => l.startsWith('✅'))

  console.log(`\n  Total: ${logs.length} | ✅ ${passed.length} | ❌ ${failed.length}\n`)

  if (failed.length > 0) {
    console.log('  Fallos:')
    failed.forEach(l => console.log(`    ${l}`))
  }

  // Guardar log
  const logFile = `test-screenshots/test-e2e-cliente-${TS}.log`
  fs.writeFileSync(logFile, logs.join('\n'))
  console.log(`\n  Log guardado: ${logFile}\n`)

  process.exit(failed.length > 0 ? 1 : 0)
}

main()
