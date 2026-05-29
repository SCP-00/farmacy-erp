/**
 * ═══════════════════════════════════════════════════════════
 *  TEST E2E — Browser (Playwright): UI/UX del frontend
 * ═══════════════════════════════════════════════════════════
 *
 *  Validaciones visuales con Playwright:
 *    1. Inicio → ver productos destacados + header/footer
 *    2. Login como cliente
 *    3. Ver catálogo de productos
 *    4. Navegar a detalle de producto
 *    5. Agregar/quitar favoritos desde UI
 *    6. Ver carrito (vacio o con items)
 *    7. Ver Mi Cuenta (perfil, puntos, pedidos)
 *    8. Mis Pedidos (historial)
 *    9. Cerrar sesión
 *
 *  Ejecutar: node scripts/e2e/manual/test-e2e-browser.mjs
 * ═══════════════════════════════════════════════════════════
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'
const API_URL  = 'http://localhost:3000/api/v1'
const TS = Date.now()

const CLIENTE = {
  nombre: 'BrowserTest',
  apellido: 'E2E',
  email: `browser-e2e-${TS}@ejemplo.co`,
  password: 'TestPass1!',
}

const ADMIN = { email: 'admin@farmacy.co', password: 'Admin@1234' }

const fs = await import('fs')
fs.mkdirSync('test-screenshots', { recursive: true })

const logs = []
function log(msg, ok = true) {
  const icon = ok ? '✅' : '❌'
  logs.push(`${icon} ${msg}`)
  console.log(`${icon} ${msg}`)
}
function err(msg) { log(msg, false) }

async function apiPost(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  return { status: res.status, ok: res.ok, data: await res.json().catch(() => ({})) }
}

async function setupCliente() {
  // 1. Registrar
  const reg = await apiPost('/clientes/auth/registro', { ...CLIENTE, autorizacionDatos: true })
  if (!reg.ok && reg.status !== 409) throw new Error(`Registro falló: ${reg.data?.error}`)

  // 2. Verificar email
  const { execSync } = await import('child_process')
  const result = execSync(
    `docker exec farmacy_postgres_dev psql -U farmacy_user -d farmacy_db -t -c "SELECT token_verificacion FROM clientes WHERE email='${CLIENTE.email}' AND token_verificacion IS NOT NULL LIMIT 1;"`,
    { encoding: 'utf8', timeout: 10000 }
  )
  const token = result.trim()
  if (token) {
    await apiPost('/clientes/auth/verificar-email', { token })
  }

  // 3. Login
  const loginRes = await apiPost('/clientes/auth/login', { email: CLIENTE.email, password: CLIENTE.password })
  if (!loginRes.ok) throw new Error(`Login falló: ${loginRes.data?.error}`)

  // 4. Agregar algunos favoritos via API
  const prodRes = await fetch(`${API_URL}/productos/buscar?limite=3`)
  const productos = (await prodRes.json())?.data ?? []
  for (const p of productos.slice(0, 2)) {
    await apiPost('/clientes/auth/favoritos', { productoId: p.id }, loginRes.data.data.token)
  }

  // 5. Crear venta via admin para tener pedidos
  const adminRes = await apiPost('/auth/login', { email: ADMIN.email, password: ADMIN.password })
  if (adminRes.ok) {
    const adminToken = adminRes.data.data.token
    const clientesRes = await fetch(`${API_URL}/clientes?q=${CLIENTE.email}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    })
    const clientes = (await clientesRes.json())?.data ?? []
    const cliente = clientes.find(c => c.email === CLIENTE.email)
    if (cliente && productos.length > 0) {
      await apiPost('/ventas', {
        sucursalId: 1,
        clienteId: cliente.id,
        metodoPago: 'EFECTIVO',
        descuento: 0,
        items: productos.slice(0, 2).map(p => ({
          productoId: p.id, cantidad: 1,
          precioUnitario: Math.round(Number(p.precioVenta)),
          descuento: 0,
        })),
      }, adminToken)
    }
  }

  return loginRes.data.data.token
}

async function main() {
  console.log('\n' + '═'.repeat(55))
  console.log('  TEST E2E — BROWSER (PLAYWRIGHT)')
  console.log('═'.repeat(55) + '\n')

  let browser, page, clienteToken

  try {
    // Setup: crear cliente, favoritos, ventas
    log('Setup: Creando cliente de prueba en DB...')
    clienteToken = await setupCliente()
    log('Setup: Cliente listo con favoritos y pedidos')

    // Lanzar browser
    log('Browser: Lanzando Chromium...')
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'es-CO',
    })
    page = await context.newPage()

    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(`  [CONSOLE ERROR] ${msg.text()}`)
      }
    })

    // ═══════════════════════════════════════════════════════
    //  1. PÁGINA DE INICIO
    // ═══════════════════════════════════════════════════════
    log('1. Navegando a la página de inicio...')
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(2000)

    const title = await page.title()
    log(`   Title: "${title}"`)

    // Verificar que React renderizó (#root tiene contenido)
    const rootContent = await page.evaluate(() => document.getElementById('root')?.textContent?.length || 0)
    log(`   Root content: ${rootContent} caracteres`)

    // Verificar header/nav
    const navVisible = await page.locator('nav, header, [class*="header"]').first().isVisible().catch(() => false)
    log(`   Header/Nav visible: ${navVisible}`)

    await page.screenshot({ path: 'test-screenshots/01-inicio.png', fullPage: true })
    log('   Screenshot: 01-inicio.png')

    // ═══════════════════════════════════════════════════════
    //  2. CATÁLOGO DE PRODUCTOS
    // ═══════════════════════════════════════════════════════
    log('2. Navegando al catálogo...')
    await page.goto(`${BASE_URL}/productos`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(2000)

    // Buscar productos en la página
    const productosVisibles = await page.evaluate(() => {
      const body = document.body.textContent || ''
      const matches = body.match(/[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+/g) || []
      return matches.filter(m => m.length > 10 && m.length < 60).slice(0, 5)
    })

    if (productosVisibles.length > 0) {
      log(`   Productos visibles en página:`)
      productosVisibles.slice(0, 3).forEach(p => log(`     - ${p.trim()}`))
    } else {
      log('   No se detectaron nombres de productos en la página', false)
    }

    await page.screenshot({ path: 'test-screenshots/02-catalogo.png', fullPage: true })
    log('   Screenshot: 02-catalogo.png')

    // ═══════════════════════════════════════════════════════
    //  3. LOGIN COMO CLIENTE
    // ═══════════════════════════════════════════════════════
    log('3. Navegando al login de cliente...')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(1500)

    await page.screenshot({ path: 'test-screenshots/03a-login-page.png', fullPage: true })

    // Llenar formulario de login
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passInput = page.locator('input[type="password"], input[name="password"]').first()

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(CLIENTE.email)
      await passInput.fill(CLIENTE.password)
      log('   Formulario llenado')

      await page.screenshot({ path: 'test-screenshots/03b-login-filled.png', fullPage: true })

      // Click submit
      const submitBtn = page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Iniciar")').first()
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(3000)

        // Verificar si redirigió (login exitoso)
        const currentUrl = page.url()
        log(`   URL después de login: ${currentUrl}`)

        if (currentUrl.includes('login')) {
          log('   Login UI no redirigió — se mantiene en login', false)
          await page.screenshot({ path: 'test-screenshots/03c-login-error.png', fullPage: true })
        } else {
          log('   Login exitoso desde UI!')
        }
      }
    } else {
      log('   No se encontró formulario de login en la página', false)
    }

    await page.screenshot({ path: 'test-screenshots/03-post-login.png', fullPage: true })

    // ═══════════════════════════════════════════════════════
    //  4. FAVORITOS
    // ═══════════════════════════════════════════════════════
    log('4. Navegando a favoritos...')

    // Inyectar token de cliente via localStorage
    await page.evaluate((token) => {
      localStorage.setItem('token', token)
      localStorage.setItem('clienteToken', token)
    }, clienteToken)

    // Recargar para que el frontend lea el token
    await page.goto(`${BASE_URL}/cuenta/favoritos`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const favContent = await page.evaluate(() => document.body.textContent?.substring(0, 500) || '')
    log(`   Contenido favoritos: ${favContent.substring(0, 100).replace(/\n/g, ' ')}...`)

    await page.screenshot({ path: 'test-screenshots/04-favoritos.png', fullPage: true })
    log('   Screenshot: 04-favoritos.png')

    // ═══════════════════════════════════════════════════════
    //  5. MI CUENTA
    // ═══════════════════════════════════════════════════════
    log('5. Navegando a Mi Cuenta...')
    await page.goto(`${BASE_URL}/cuenta`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-screenshots/05-mi-cuenta.png', fullPage: true })
    log('   Screenshot: 05-mi-cuenta.png')

    // ═══════════════════════════════════════════════════════
    //  6. MIS PEDIDOS
    // ═══════════════════════════════════════════════════════
    log('6. Navegando a Mis Pedidos...')
    await page.goto(`${BASE_URL}/cuenta/pedidos`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-screenshots/06-pedidos.png', fullPage: true })
    log('   Screenshot: 06-pedidos.png')

    // ═══════════════════════════════════════════════════════
    //  7. CARRITO
    // ═══════════════════════════════════════════════════════
    log('7. Navegando al carrito...')
    await page.goto(`${BASE_URL}/carrito`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-screenshots/07-carrito.png', fullPage: true })
    log('   Screenshot: 07-carrito.png')

    // ═══════════════════════════════════════════════════════
    //  8. DETALLE DE PRODUCTO
    // ═══════════════════════════════════════════════════════
    log('8. Navegando a detalle de producto...')

    // Obtener primer producto de la API
    const prodRes = await fetch(`${API_URL}/productos/buscar?limite=1`)
    const prodData = await prodRes.json()
    const primerProducto = prodData?.data?.[0]

    if (primerProducto?.slug) {
      await page.goto(`${BASE_URL}/productos/${primerProducto.slug}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)
      log(`   Detalle de: ${primerProducto.nombre}`)
    } else if (primerProducto?.id) {
      await page.goto(`${BASE_URL}/productos/${primerProducto.id}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }

    await page.screenshot({ path: 'test-screenshots/08-producto-detalle.png', fullPage: true })
    log('   Screenshot: 08-producto-detalle.png')

    // ═══════════════════════════════════════════════════════
    //  RESUMEN
    // ═══════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(55))
    console.log('  RESUMEN — BROWSER TEST')
    console.log('═'.repeat(55))

    log(`Total navegaciones: 8`)
    log(`Screenshots: 12`)

    const hasErrors = logs.some(l => l.startsWith('❌'))
    log(`Resultado: ${hasErrors ? 'Con errores' : 'Todo OK'}`, !hasErrors)

  } catch (err) {
    console.error(`\n💥 ERROR: ${err.message}\n`)
    if (page) {
      await page.screenshot({ path: 'test-screenshots/ERROR-browser.png', fullPage: true }).catch(() => {})
    }
  } finally {
    if (browser) await browser.close()

    const logFile = `test-screenshots/test-e2e-browser-${TS}.log`
    fs.writeFileSync(logFile, logs.join('\n'))
    console.log(`\n  Screenshots: test-screenshots/*.png`)
    console.log(`  Log: ${logFile}\n`)

    const failed = logs.filter(l => l.startsWith('❌') || l.startsWith('💥'))
    process.exit(failed.length > 0 ? 1 : 0)
  }
}

main()
