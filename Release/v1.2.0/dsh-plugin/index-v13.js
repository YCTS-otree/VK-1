import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { createUpdateChecker } from './update-checker-v1.js'

// ============================================================================
// dsh-vk1-balance-widget —— Host half (v13 cache identity)
//
//   VK-1 余额挂件的宿主侧。上游是「大肥鱼桌宠改_D-16BVM」(v11)：四表情 / 米盆
//   充值 / 铁盆 / 火控雷达名牌，全部由 widget.js 在页面内实现。
//
//   素材（四张表情差分、米饭盆、铁盆、两个音效）都从包内读取并内存缓存；
//   余额用 DSH 凭据服务拉取；页面脚本通过 tapIndex 注入——与 dsh-whale-widget
//   同一套做法。
// ============================================================================

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(PACKAGE_ROOT, 'assets')
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const BALANCE_TTL_MS = 8000
const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version
const UPDATE_STATE = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'storages', 'dsh-vk1-balance-widget', 'update-state.json')

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
}

// path -> [file, content-type]
const ASSET_ROUTES = {
  '/dsh-vk1/expression_11.png': ['expression_11.png', 'image/png'],
  '/dsh-vk1/expression_12.png': ['expression_12.png', 'image/png'],
  '/dsh-vk1/expression_21.png': ['expression_21.png', 'image/png'],
  '/dsh-vk1/expression_22.png': ['expression_22.png', 'image/png'],
  '/dsh-vk1/rice.png': ['rice.png', 'image/png'],
  '/dsh-vk1/iron_bowl.png': ['iron_bowl.png', 'image/png'],
  '/dsh-vk1/hit.mp3': ['hit.mp3', 'audio/mpeg'],
  '/dsh-vk1/feed.mp3': ['feed.mp3', 'audio/mpeg'],
  '/dsh-vk1/pot_land.mp3': ['pot_land.mp3', 'audio/mpeg'],
  '/dsh-vk1/pot_off.mp3': ['pot_off.mp3', 'audio/mpeg'],
  ...Object.fromEntries(Array.from({ length: 5 }, (_, i) =>
    [`/dsh-vk1/pat_hand_${i}.png`, [`pat_hand_${i}.png`, 'image/png']])),
}

const name = 'dsh-vk1-balance-widget'
const inject = ['webServer', 'credentials']

function apply(ctx) {
  const disposers = []
  const assetCache = new Map()
  let widgetSource = null
  let balanceCache = null
  let balanceInFlight = null
  const updates = createUpdateChecker({
    currentVersion: VERSION,
    readState: () => JSON.parse(fs.readFileSync(UPDATE_STATE, 'utf8')),
    saveState: state => {
      fs.mkdirSync(path.dirname(UPDATE_STATE), { recursive: true })
      const temporary = UPDATE_STATE + '.' + process.pid + '.tmp'
      try {
        fs.writeFileSync(temporary, JSON.stringify(state) + '\n', 'utf8')
        fs.renameSync(temporary, UPDATE_STATE)
      } finally { try { fs.unlinkSync(temporary) } catch {} }
    },
    fetchVersion: async signal => {
      const res = await fetch('https://raw.githubusercontent.com/YCTS-otree/VK-1/main/dsh-plugin/package.json', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
        headers: { Accept: 'application/json' }, cache: 'no-store',
      })
      if (!res.ok) throw new Error('Update server unavailable')
      return (await res.json()).version
    },
  })

  function readWidget() {
    if (widgetSource === null) widgetSource = fs.readFileSync(path.join(PACKAGE_ROOT, 'widget.js'), 'utf8')
    return widgetSource
  }
  function readAsset(file) {
    if (!assetCache.has(file)) assetCache.set(file, fs.readFileSync(path.join(ASSETS, file)))
    return assetCache.get(file)
  }

  function pickBalanceInfo(infos) {
    if (!Array.isArray(infos) || infos.length === 0) return null
    const num = (x) => (x && x.total_balance !== undefined ? Number(x.total_balance) : NaN)
    return (
      infos.find((x) => x && x.currency === 'CNY' && num(x) > 0) ||
      infos.find((x) => num(x) > 0) ||
      infos.find((x) => x && x.currency === 'CNY') ||
      infos[0]
    )
  }

  async function fetchBalance() {
    let cred
    try {
      cred = await ctx.credentials.resolve('DEEPSEEK_API_KEY')
    } catch (err) {
      return { ok: false, code: 'NO_KEY', error: '凭据读取失败: ' + String((err && err.message) || err).slice(0, 160) }
    }
    if (!cred) return { ok: false, code: 'NO_KEY', error: '未配置 DEEPSEEK_API_KEY' }
    let lastErr = null
    for (let attempt = 0; attempt < 2; attempt++) {
      let res
      try {
        res = await fetch(BALANCE_URL, {
          headers: { Authorization: 'Bearer ' + cred.value },
          signal: AbortSignal.timeout(20000),
        })
      } catch (err) {
        lastErr = err
        if (attempt === 0) await new Promise((r) => setTimeout(r, 500))
        continue
      }
      if (!res.ok) {
        lastErr = new Error('HTTP ' + res.status)
        if (res.status < 500) break
        if (attempt === 0) await new Promise((r) => setTimeout(r, 500))
        continue
      }
      let data
      try {
        data = await res.json()
      } catch (err) {
        return { ok: false, code: 'PARSE', error: '余额接口返回不是合法 JSON' }
      }
      const info = pickBalanceInfo(data && data.balance_infos)
      if (!info || info.total_balance === undefined) {
        return { ok: false, code: 'SHAPE', error: '余额接口返回结构异常' }
      }
      return {
        ok: true,
        totalBalance: Number(info.total_balance),
        currency: String(info.currency || 'CNY'),
        updatedAt: new Date().toISOString(),
        serverTime: res.headers.get('date') || null,
      }
    }
    const transient = !(lastErr && /^HTTP 4\d\d/.test(lastErr.message))
    return {
      ok: false,
      code: 'HTTP',
      transient,
      error: '余额接口请求失败: ' + String((lastErr && lastErr.message) || lastErr).slice(0, 200),
    }
  }

  function getBalance() {
    const now = Date.now()
    if (balanceCache && now - balanceCache.at < BALANCE_TTL_MS) return Promise.resolve(balanceCache.payload)
    if (balanceInFlight) return balanceInFlight
    balanceInFlight = fetchBalance()
      .then((payload) => {
        if (payload.ok) {
          balanceCache = { at: now, payload }
          return payload
        }
        if (payload.transient && balanceCache) return { ...balanceCache.payload, stale: true, error: payload.error }
        return payload
      })
      .catch((err) => ({ ok: false, code: 'ERROR', error: '余额服务异常: ' + String((err && err.message) || err).slice(0, 200) }))
      .finally(() => { balanceInFlight = null })
    return balanceInFlight
  }

  for (const [routePath, [file, type]] of Object.entries(ASSET_ROUTES)) {
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: routePath,
      handler: (req, res) => {
        try {
          const bytes = readAsset(file)
          res.writeHead(200, {
            'Content-Type': type,
            'Cache-Control': 'no-store',
            'Content-Length': String(bytes.length),
          })
          res.end(bytes)
        } catch (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end(file + ' unavailable: ' + String((err && err.message) || err))
        }
      },
    }))
  }

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-vk1/balance.json',
    handler: async (req, res) => {
      try {
        const payload = await getBalance()
        // Cached balances retain their observation timestamp. Advance the server clock
        // for each response so a browser polling inside the TTL does not freeze its clock.
        const stamp = Date.parse(payload.serverTime)
        const age = Math.max(0, Date.now() - Date.parse(payload.updatedAt))
        const response = payload.ok && Number.isFinite(stamp) && Number.isFinite(age)
          ? { ...payload, serverTime: new Date(stamp + age).toISOString() }
          : payload
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify(response))
      } catch (err) {
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, code: 'ERROR', error: String((err && err.message) || err).slice(0, 200) }))
      }
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-vk1/widget.js',
    handler: (req, res) => {
      try {
        const src = readWidget()
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(src)
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('widget unavailable: ' + String((err && err.message) || err))
      }
    },
  }))

  disposers.push(ctx.webServer.tapIndex((html) => {
    if (/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/dsh-vk1\/widget\.js(?:\?[^"']*)?["']/i.test(html)) return html
    const tag = '<script defer src="/dsh-vk1/widget.js"></script>'
    if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
    return html + tag
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact', path: '/dsh-vk1/update.json',
    handler: (req, res) => { res.writeHead(200, JSON_HEADERS); res.end(JSON.stringify(updates.snapshot())) },
  }))

  ctx.effect(() => {
    updates.start()
    return () => {
      updates.stop()
      for (const d of disposers) {
        try { d() } catch (err) {}
      }
    }
  })
}

export { name, inject, apply }
