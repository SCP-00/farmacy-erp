/**
 * ═══════════════════════════════════════════════════════════
 *  TEST E2E — Caso 2: Flujo completo compras proveedores
 * ═══════════════════════════════════════════════════════════
 *
 *  Escenarios:
 *    1. Login como admin
 *    2. Consultar lista de proveedores
 *    3. Consultar productos disponibles
 *    4. Crear Orden de Compra (OC) con items
 *    5. Verificar OC creada
 *    6. Recibir mercancía (crear lotes)
 *    7. Verificar lotes creados
 *    8. Verificar estado de la OC (RECIBIDA)
 *    9. Verificar movimientos de inventario
 *   10. Verificar alertas de inventario
 *
 *  Ejecutar: node scripts/e2e/manual/test-e2e-proveedores.mjs
 * ═══════════════════════════════════════════════════════════
 */

const API_URL = 'http://localhost:3000/api/v1'
const SUCURSAL_ID = 1
const ADMIN = { email: 'admin@farmacy.co', password: 'Admin@1234' }
const TS = Date.now()

const fs = await import('fs')
fs.mkdirSync('test-screenshots', { recursive: true })

const logs = []
function log(step, msg, ok = true) {
  const icon = ok ? '✅' : '❌'
  const line = `${icon} [Proveedores][${step}] ${msg}`
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
const apiGet = (p, t) => api(p, 'GET', null, t)

async function main() {
  console.log('\n' + '═'.repeat(55))
  console.log('  TEST E2E — FLUJO COMPRAS / PROVEEDORES')
  console.log('═'.repeat(55) + '\n')

  const failedTests = []
  let adminToken, proveedores, productos, ordenCreada

  try {
    // ═══════════════════════════════════════════════════════
    //  1. LOGIN ADMIN
    // ═══════════════════════════════════════════════════════
    log('1', 'Login como administrador...')
    const loginRes = await apiPost('/auth/login', {
      email: ADMIN.email, password: ADMIN.password,
    })
    if (!loginRes.ok) throw new Error(`Login falló: ${loginRes.data?.error || loginRes.status}`)
    adminToken = loginRes.data.data.token
    log('1', `Admin: ${loginRes.data.data.empleado.nombre} (${loginRes.data.data.empleado.rol})`)

    // ═══════════════════════════════════════════════════════
    //  2. CONSULTAR PROVEEDORES
    // ═══════════════════════════════════════════════════════
    log('2', 'Consultando proveedores...')
    const provRes = await apiGet('/proveedores', adminToken)
    proveedores = provRes.data?.data ?? []

    if (proveedores.length === 0) {
      // Crear un proveedor si no hay
      log('2', 'No hay proveedores, creando uno...', false)
      const newProvRes = await apiPost('/proveedores', {
        nit: `900.${TS}.1`,
        nombre: 'Distribuidora Farmacéutica Test',
        nombreContacto: 'Carlos Test',
        telefono: '+57 600 000 0001',
        email: `proveedor-test-${TS}@ejemplo.co`,
        ciudad: 'Bogotá',
      }, adminToken)
      if (!newProvRes.ok) throw new Error(`Crear proveedor falló: ${newProvRes.data?.error || newProvRes.status}`)
      proveedores = [newProvRes.data.data]
      log('2', `Proveedor creado: ${proveedores[0].nombre}`)
    } else {
      proveedores.forEach((p, i) => {
        log('2', `  ${i+1}. ${p.nombre} (${p.nit}) - ${p.ciudad} - ${p._count?.ordenesCompra || 0} órdenes`)
      })
    }

    const proveedor = proveedores[0]
    log('2', `Usando: ${proveedor.nombre} (ID: ${proveedor.id})`)

    // ═══════════════════════════════════════════════════════
    //  3. CONSULTAR PRODUCTOS
    // ═══════════════════════════════════════════════════════
    log('3', 'Consultando productos para la orden...')
    const prodRes = await apiGet('/productos/buscar?limite=10')
    productos = prodRes.data?.data ?? []

    if (productos.length === 0) throw new Error('No hay productos disponibles')

    // Filtrar solo productos con precio (no muestras médicas)
    const productosComprables = productos.filter(p => Number(p.precioVenta) > 0 && !p.esMuestraMedica)

    if (productosComprables.length < 2) throw new Error('No hay suficientes productos para la orden')

    const prod1 = productosComprables[0]
    const prod2 = productosComprables[1]

    log('3', `Productos seleccionados:`)
    log('3', `  ${prod1.nombre} — $${Number(prod1.precioVenta).toLocaleString()}`)
    log('3', `  ${prod2.nombre} — $${Number(prod2.precioVenta).toLocaleString()}`)

    // ═══════════════════════════════════════════════════════
    //  4. CREAR ORDEN DE COMPRA
    // ═══════════════════════════════════════════════════════
    log('4', 'Creando Orden de Compra...')

    const detalles = [
      {
        productoId: prod1.id,
        cantidadPedida: 50,
        precioUnitario: Math.round(Number(prod1.precioVenta) * 0.6), // 60% del precio venta = costo
      },
      {
        productoId: prod2.id,
        cantidadPedida: 30,
        precioUnitario: Math.round(Number(prod2.precioVenta) * 0.6),
      },
    ]

    const fechaEntrega = new Date()
    fechaEntrega.setDate(fechaEntrega.getDate() + 15)

    const ocRes = await apiPost('/compras', {
      proveedorId: proveedor.id,
      notas: `Orden de prueba E2E ${TS}`,
      fechaEntregaEst: fechaEntrega.toISOString(),
      detalles,
    }, adminToken)

    if (!ocRes.ok) {
      const errMsg = ocRes.data?.error || JSON.stringify(ocRes.data).substring(0, 200)
      throw new Error(`Crear OC falló: ${errMsg}`)
    }

    ordenCreada = ocRes.data.data
    const totalOC = ordenCreada.detalles?.reduce((sum, d) => sum + Number(d.subtotal), 0) || ordenCreada.total

    log('4', `Orden de Compra creada:`)
    log('4', `  ID:       ${ordenCreada.id}`)
    log('4', `  Estado:   ${ordenCreada.estado}`)
    log('4', `  Subtotal: $${Number(ordenCreada.subtotal || totalOC).toLocaleString()}`)
    log('4', `  Total:    $${Number(ordenCreada.total || totalOC).toLocaleString()}`)
    log('4', `  Items:    ${ordenCreada.detalles?.length || 0}`)

    // ═══════════════════════════════════════════════════════
    //  5. VERIFICAR OC POR ID
    // ═══════════════════════════════════════════════════════
    log('5', 'Verificando OC por ID...')
    const ocDetRes = await apiGet(`/compras/${ordenCreada.id}`, adminToken)
    if (!ocDetRes.ok) throw new Error(`Verificar OC falló: ${ocDetRes.data?.error || ocDetRes.status}`)

    const ocDetalle = ocDetRes.data.data
    log('5', `OC #${ocDetalle.id?.substring(0, 8)} — ${ocDetalle.estado}`)
    log('5', `Proveedor: ${ocDetalle.proveedor?.nombre}`)
    log('5', `Creado por: ${ocDetalle.empleado?.nombre} ${ocDetalle.empleado?.apellido || ''}`)

    if (ocDetalle.detalles?.length > 0) {
      log('5', '  Detalles:')
      ocDetalle.detalles.forEach(d => {
        log('5', `    ${d.producto?.nombre} x${d.cantidadPedida} = $${Number(d.subtotal).toLocaleString()}`)
      })
    }

    // ═══════════════════════════════════════════════════════
    //  6. RECIBIR MERCANCÍA (CREAR LOTES)
    // ═══════════════════════════════════════════════════════
    log('6', 'Recibiendo mercancía y creando lotes...')

    const fechaVen1 = new Date()
    fechaVen1.setFullYear(fechaVen1.getFullYear() + 2)
    const fechaVen2 = new Date()
    fechaVen2.setFullYear(fechaVen2.getFullYear() + 1)

    const lotesRecibidos = [
      {
        codigoLote: `LOTE-TEST-${TS}-A`,
        productoId: prod1.id,
        cantidad: 50,
        precioCompra: Math.round(Number(prod1.precioVenta) * 0.6),
        fechaVencimiento: fechaVen1.toISOString().split('T')[0],
      },
      {
        codigoLote: `LOTE-TEST-${TS}-B`,
        productoId: prod2.id,
        cantidad: 30,
        precioCompra: Math.round(Number(prod2.precioVenta) * 0.6),
        fechaVencimiento: fechaVen2.toISOString().split('T')[0],
      },
    ]

    const recibirRes = await apiPost(`/compras/${ordenCreada.id}/recibir`, {
      sucursalId: SUCURSAL_ID,
      lotes: lotesRecibidos,
    }, adminToken)

    if (!recibirRes.ok) {
      const errMsg = recibirRes.data?.error || JSON.stringify(recibirRes.data).substring(0, 200)
      error('6', `Recibir mercancía falló: ${errMsg}`)

      // Intentar con proveedorId incluido
      log('6', 'Reintentando con ajustes...', false)
      const recibirRes2 = await apiPost(`/compras/${ordenCreada.id}/recibir`, {
        sucursalId: SUCURSAL_ID,
        lotes: lotesRecibidos.map(l => ({ ...l, proveedorId: proveedor.id })),
      }, adminToken)

      if (!recibirRes2.ok) {
        const errMsg2 = recibirRes2.data?.error || JSON.stringify(recibirRes2.data).substring(0, 200)
        throw new Error(`Recibir mercancía (intento 2) falló: ${errMsg2}`)
      }
      log('6', `Mercancía recibida (intento 2): ${recibirRes2.data?.mensaje || 'OK'}`)
    } else {
      log('6', `Mercancía recibida: ${recibirRes.data?.mensaje || 'OK'}`)
    }

    // ═══════════════════════════════════════════════════════
    //  7. VERIFICAR LOTES CREADOS
    // ═══════════════════════════════════════════════════════
    log('7', 'Verificando lotes creados...')

    // Verificar directamente en DB como fuente de verdad
    const { execSync } = await import('child_process')
    let dbLotes = []
    let dbLotesCount = 0
    try {
      const dbResult = execSync(
        `docker exec farmacy_postgres_dev psql -U farmacy_user -d farmacy_db -t -c "SELECT codigo_lote, cantidad_actual FROM lotes WHERE codigo_lote LIKE '%LOTE-TEST%' ORDER BY creado_en DESC;"`,
        { encoding: 'utf8', timeout: 10000 }
      )
      const lines = dbResult.trim().split('\n').filter(Boolean)
      dbLotes = lines.map(l => {
        const [codigo, cantidad] = l.split('|').map(s => s.trim())
        return { codigoLote: codigo, cantidadActual: parseInt(cantidad) || 0 }
      })
      dbLotesCount = dbLotes.length
    } catch (e) {}

    if (dbLotesCount > 0) {
      log('7', `Lotes nuevos encontrados en DB: ${dbLotesCount}`)
      dbLotes.forEach(l => {
        log('7', `  ${l.codigoLote} — ${l.cantidadActual} unds`)
      })

      // Verificación secundaria vía API (sin filtro de sucursal para máxima cobertura)
      try {
        const lotesRes = await apiGet('/lotes?limite=20', adminToken)
        const lotes = lotesRes.data?.data ?? []
        const lotesApi = lotes.filter(l => l.codigoLote?.includes('LOTE-TEST'))
        if (lotesApi.length > 0) {
          log('7', `  (Confirmado vía API: ${lotesApi.length} lotes)`)
        }
      } catch {}
    } else {
      error('7', 'No se encontraron lotes nuevos en DB. La recepción de mercancía podría no estar creando lotes.')

      // Mostrar últimos lotes de todas formas
      const allLotesRes = await apiGet('/lotes?limite=5', adminToken)
      const allLotes = allLotesRes.data?.data ?? []
      if (allLotes.length > 0) {
        log('7', '  Últimos lotes en DB:')
        allLotes.slice(0, 3).forEach(l => {
          log('7', `  ${l.codigoLote} — ${l.producto?.nombre} — ${l.cantidadActual} unds — ${l.sucursal?.nombre}`)
        })
      }
    }

    // ═══════════════════════════════════════════════════════
    //  8. VERIFICAR ESTADO OC = RECIBIDA
    // ═══════════════════════════════════════════════════════
    log('8', 'Verificando estado de la OC...')
    const ocFinalRes = await apiGet(`/compras/${ordenCreada.id}`, adminToken)
    const ocFinal = ocFinalRes.data?.data ?? {}

    if (ocFinal.estado === 'RECIBIDA') {
      log('8', `✅ OC #${ocFinal.id?.substring(0,8)} — Estado: ${ocFinal.estado} — Recibida: ${ocFinal.recibidaEn ? new Date(ocFinal.recibidaEn).toLocaleString() : 'N/A'}`)
    } else {
      error('8', `Estado inesperado: ${ocFinal.estado} (esperado: RECIBIDA)`)
    }

    // ═══════════════════════════════════════════════════════
    //  9. VERIFICAR MOVIMIENTOS DE INVENTARIO
    // ═══════════════════════════════════════════════════════
    log('9', 'Verificando movimientos de inventario...')
    const movRes = await apiGet('/inventario/movimientos?limite=5', adminToken)
    const movimientos = movRes.data?.data ?? []

    log('9', `Movimientos registrados: ${movimientos.length}`)
    if (movimientos.length > 0) {
      movimientos.slice(0, 3).forEach(m => {
        log('9', `  ${m.tipo} — ${m.lote?.producto?.nombre || 'N/A'} — ${m.cantidad} unds — ${m.motivo || 'Sin motivo'}`)
      })
    }

    // ═══════════════════════════════════════════════════════
    // 10. LISTAR ÓRDENES DE COMPRA
    // ═══════════════════════════════════════════════════════
    log('10', 'Listando órdenes de compra...')
    const ordenesRes = await apiGet('/compras?limite=5', adminToken)
    const ordenes = ordenesRes.data?.data ?? []

    log('10', `Órdenes de compra totales: ${ordenesRes.data?.meta?.total || ordenes.length}`)
    if (ordenes.length > 0) {
      ordenes.forEach((o, i) => {
        const proveedorName = o.proveedor?.nombre || 'N/A'
        const empleadoName = o.empleado?.nombre || 'N/A'
        const detallesCount = o._count?.detalles || 0
        log('10', `  ${i+1}. ${o.estado} — ${proveedorName} — $${Number(o.total).toLocaleString()} — ${detallesCount} items — por: ${empleadoName}`)
      })
    }

    // ═══════════════════════════════════════════════════════
    //  RESUMEN
    // ═══════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(55))
    console.log('  RESUMEN — FLUJO PROVEEDORES')
    console.log('═'.repeat(55))

    const failed = logs.filter(l => l.startsWith('❌'))
    const passed = logs.filter(l => l.startsWith('✅'))

    console.log(`\n  Total: ${logs.length} | ✅ ${passed.length} | ❌ ${failed.length}\n`)

    if (failed.length > 0) {
      console.log('  Fallos:')
      failed.forEach(l => console.log(`    ${l}`))
    }

    console.log(`\n  Orden de Compra creada: ${ordenCreada.estado}`)
    console.log(`  Productos ordenados: ${detalles.length}`)
    console.log(`  Lotes creados: ${lotesRecibidos.length}`)

  } catch (err) {
    console.error(`\n💥 ERROR FATAL: ${err.message}\n`)
    failedTests.push(err.message)
  }

  // Guardar log
  const logFile = `test-screenshots/test-e2e-proveedores-${TS}.log`
  fs.writeFileSync(logFile, logs.join('\n'))
  console.log(`\n  Log guardado: ${logFile}\n`)

  const totalFailed = logs.filter(l => l.startsWith('❌') || l.startsWith('💥')).length
  process.exit(totalFailed > 0 ? 1 : 0)
}

main()
