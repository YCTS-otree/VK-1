// Daily checks are owned by the enabled host bundle, not by browser tabs.
export function compareVersions(left, right) {
  function parse(value) {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value)
    if (!match) throw new Error('Invalid version')
    return { core: match.slice(1, 4).map(Number), pre: match[4]?.split('.') }
  }
  const a = parse(left), b = parse(right)
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1
  if (!a.pre || !b.pre) return a.pre ? -1 : b.pre ? 1 : 0
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i]
    if (x === y) continue
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y)
    if (xn && yn) return Number(x) > Number(y) ? 1 : -1
    if (xn !== yn) return xn ? -1 : 1
    return x > y ? 1 : -1
  }
  return 0
}

export function createUpdateChecker({ currentVersion, readState, saveState, fetchVersion, now = () => new Date(), timers = globalThis }) {
  let state = {}, active = false, pending = null, controller, initialTimer, dailyTimer
  function day() {
    const d = now()
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
  }
  function load() { try { state = readState() || {} } catch { state = {} } }
  function persist() { saveState(state) }
  function snapshot() {
    let available = false, latestVersion = null
    try {
      if (typeof state.latestVersion === 'string') {
        available = compareVersions(state.latestVersion, currentVersion) > 0
        latestVersion = state.latestVersion
      }
    } catch {}
    return { ok: true, currentVersion, latestVersion, available, checkedOn: state.checkedOn || null,
      checking: active && (!!pending || state.checkedOn !== day()), error: state.error || null,
      url: 'https://github.com/YCTS-otree/VK-1' }
  }
  function check() {
    if (!active) return Promise.resolve(snapshot())
    if (pending) return pending
    if (state.checkedOn === day()) return Promise.resolve(snapshot())
    load()
    if (state.checkedOn === day()) return Promise.resolve(snapshot())
    state = { ...state, checkedOn: day(), error: null }
    // Claim the day before the request. Failures also count as today's attempt.
    try { persist() } catch { state.error = '无法保存更新检查记录'; return Promise.resolve(snapshot()) }
    controller = new AbortController()
    const requestController = controller
    pending = (async () => {
      try {
        const latest = await fetchVersion(requestController.signal)
        compareVersions(latest, currentVersion)
        if (!active || requestController.signal.aborted) return
        state = { ...state, latestVersion: latest, error: null }
      } catch {
        if (requestController.signal.aborted || !active) return
        state.error = '更新检查失败，明天再检查'
      }
      try { persist() } catch { state.error = '无法保存更新检查结果' }
    })().finally(() => { pending = null }).then(snapshot)
    return pending
  }
  load()
  return {
    snapshot, check,
    start() {
      if (active) return
      active = true
      initialTimer = timers.setTimeout(() => { void check() }, 1000)
      dailyTimer = timers.setInterval(() => { void check() }, 60 * 1000)
      initialTimer?.unref?.(); dailyTimer?.unref?.()
    },
    stop() {
      active = false
      timers.clearTimeout(initialTimer); timers.clearInterval(dailyTimer)
      controller?.abort()
    },
  }
}
