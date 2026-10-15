/* ===========================================================================
 * VK-1 余额挂件 —— 网页内挂件（纯插件形态）
 *
 * 上游：VKmich16/VK-1「大肥鱼桌宠现代化改_D-16BVM（2026）」571da3b。
 * 现代化移植新增：抚摸、铁盆堆叠、四页设置、分项音效、本地剪辑库、今日消费与峰谷时钟。
 * 本文件是它 dsh_pet.ps1 的网页移植：保留原本全部可观察行为，去掉「桌宠」
 * 相关的一切（置顶窗口 / 托盘 / 屏幕角吸附 / 点击穿透 / 独立进程）。
 *
 * v11 相对已移植的 v9（原版）新增，全部照搬：
 *   · 四种表情（expression_11 开心 / _22 紧张 / _12 傲娇 / _21 冷脸），按优先级
 *     自动切换——铁盆扣头且无米盆 > 扣费中(含 1s 保持) > 米盆闲置 10s > 开心
 *   · 充值不再直接改数字：掉一盆米饭，拖到角色身上才入账（掉盆/弹跳/拖拽/碰撞）
 *   · 铁盆：吃掉米盆后掉出，可拖到她头上戴住（换冷脸），双击头部取下
 *   · 火控雷达目标名牌：绿括号 + 「白饭」+ 距离/接近率/相对高度 + 方向环，
 *     任一盆闲置满 10s → 全部锁定 → 1s 后磁吸，吸到身上即入账
 *
 * 定位模型沿用 dsh-whale-widget：四边四分之一吸附 + 锚点持久化 + 滚动条避让；
 * 吸附在右边缘时只镜像「美术」，文字靠重算仿射矩阵保持正向。
 *
 * 移植来源字面值（dsh_pet.ps1 行号）：
 *   平板四角 2527-2528 · 表情优先级 1973-1985 · 雷达读数 2106+ / 几何 2277-2460
 *   重力/弹性 1039-1040 · 空气阻力/滑动 1069-1075 · 弹跳档位 1104-1109
 *   掉盆 2660-2689 · 物理 3024-3165 · 喂食判定 3298-3330 · 进食 2740-2777
 *   爱心 2712-2733 / 3485-3499 · 铁盆 2844-2886 · 常量 857-918
 * =========================================================================== */
(function () {
  if (window.__dshVk1Widget) return
  window.__dshVk1Widget = true

  // A widget that dies silently is worse than one that complains — but the complaint has to
  // be OURS. Two rules keep that honest:
  //   · identity comes from document.currentScript at parse time, NOT from a hardcoded path.
  //     A path filter silently swallows every real error the day the widget is served from
  //     somewhere else — which would reintroduce exactly the silent death this exists for.
  //   · an error with no source at all is never attributed to us. The browser's own warnings
  //     (e.g. "ResizeObserver loop completed with undelivered notifications", which carries
  //     no script source) and cross-origin "Script error." land here.
  var SELF_SRC = ''
  try { SELF_SRC = (document.currentScript && document.currentScript.src) || '' } catch (e0) {}
  function isOurs(src) {
    var path = String(src || '').split('?')[0]
    if (!path) return false
    if (SELF_SRC) return path === String(SELF_SRC).split('?')[0]
    // Heuristic last resort, used only when currentScript is unavailable: any script whose
    // path ends in our route is treated as ours. It can in principle misattribute an
    // unrelated script served at the same path, which is why identity normally comes from
    // currentScript instead.
    return /dsh-vk1\/widget\.js$/.test(path)
  }
  function showFatal(text) {
    try {
      var existing = document.getElementById('dshvk1-fatal')
      if (existing) {
        // Keep the single box but do not swallow the new failure: show the latest message
        // plus how many have been seen. Stacking a box per error was the original bug.
        var n = (parseInt(existing.getAttribute('data-count') || '1', 10) || 1) + 1
        existing.setAttribute('data-count', String(n))
        existing.textContent = 'VK-1 widget error ×' + n + '（点击关闭）:\n' + text
        return
      }
      var d = document.createElement('div')
      d.id = 'dshvk1-fatal'
      d.setAttribute('data-count', '1')
      d.title = '点击关闭'
      d.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483600;max-width:74vw;' +
        'background:#8d1111;color:#fff;font:16px/1.5 Consolas,monospace;padding:12px 14px;' +
        'border:2px solid #fff;border-radius:10px;white-space:pre-wrap;cursor:pointer'
      d.textContent = 'VK-1 widget error（点击关闭）:\n' + text
      d.addEventListener('click', function () {
        try { if (d.parentNode) d.parentNode.removeChild(d) } catch (e3) {}
      })
      document.body.appendChild(d)
    } catch (e2) {}
  }
  function onWidgetError(ev) {
    var src = String((ev && ev.filename) || '')
    var msg = String((ev && ev.message) || 'unknown')
    if (!isOurs(src)) return                      // not ours, or unattributable
    if (/ResizeObserver loop/i.test(msg)) return  // benign browser warning
    showFatal(msg + '   @' + (ev && ev.lineno) + ':' + (ev && ev.colno))
  }
  window.addEventListener('error', onWidgetError)

  var BASE = '/dsh-vk1'
  var EXPR_URL = {
    happy: BASE + '/expression_11.png',
    nervous: BASE + '/expression_22.png',
    aloof: BASE + '/expression_12.png',
    calm: BASE + '/expression_21.png',
  }
  var EXPR_ORDER = ['happy', 'nervous', 'aloof', 'calm']
  var RICE_URL = BASE + '/rice.png'
  var IRON_URL = BASE + '/iron_bowl.png'
  var HIT_SOUND = BASE + '/hit.mp3'
  var FEED_SOUND = BASE + '/feed.mp3'
  var BALANCE_URL = BASE + '/balance.json'

  // ---- constants ported from dsh_pet.ps1 ----
  var STEP = 0.01
  var CUE_GAP = 0.2
  var MAX_CUES_PER_POLL = 40
  var HIT_DUR = 0.55
  var FLOAT_DUR = 1.05
  var POLL_MS = 2000
  var FLASH_COLOR = '#ff3022'
  var CUE_FILL = 'rgb(255,72,60)'
  var CUE_EDGE = 'rgb(92,8,8)'
  var GAIN_FILL = 'rgb(58,220,90)'
  var GAIN_EDGE = 'rgb(8,85,28)'
  var RADAR_GREEN = 'rgb(0,255,8)'
  var LABEL_TEXT = 'DSH 余额'
  var RADAR_TYPE = '白饭'

  // tablet screen quad in sprite-texture pixels (1024), dsh_pet.ps1:2527-2528
  var QX = [549.6, 949.7, 984.7, 584.6]
  var QY = [706.2, 642.0, 860.2, 924.3]

  var SIZES = [128, 192, 256, 384, 512]
  // 预设之外还有菜单里的「自定义」px 输入框（上游同样是「预设 + 自定义」的形状）。
  // 挂件是分辨率无关的等比布局，落在这个区间里都能正确排版。
  // 默认仍是上游大杯 454：没手动调过尺寸的安装不会被这次改预设悄悄缩小。
  var DEFAULT_SIZE = 454
  var MIN_SIZE = 96
  var MAX_SIZE = 1200

  var BOWL_WAIT = 10.0
  var LOCK_DELAY = 1.0
  var NERVOUS_HOLD = 1.0
  var SUCK_ACCEL = 960.0
  var SUCK_MAX = 2400.0
  var GRAVITY = 2100.0
  var RESTITUTION = 0.5
  var AIR_DRAG = 0.30
  var SLIDE_FRICTION = 1.40
  var SLIDE_STOP = 14.0
  var SQUISH_DUR = 0.40
  var HEAD_SQUASH_DUR = 0.5
  var IRON_TILT_DEG = -6.23
  var BOWL_W = 0.44
  var IRON_W_LOOSE = 0.44
  var IRON_W_WORN = 0.7391
  var IRON_H_WORN = 0.2629
  var BOWL_DIE = 0.14
  var IRON_FADE = 0.45
  var BTN_GRACE_MS = 1500

  var POS_KEY = 'dsh-vk1-pos'
  var SIZE_KEY = 'dsh-vk1-size'
  var GAP_KEY = 'dsh-vk1-gap'
  var SOUND_KEY = 'dsh-vk1-sound'
  var OPTIONS_KEY = 'dsh-vk1-options'
  var USAGE_KEY = 'dsh-vk1-usage'

  function round4(v) { return Math.round(v * 10000) / 10000 }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
  function amountText(v) { return String(Math.round(v * 10000) / 10000) }
  function fmt2(v) { return (Math.round(v * 100) / 100).toFixed(2) }
  function rnd(a, b) { return a + Math.random() * (b - a) }
  function svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag) }

  // --------------------------------------------------------------- styles ---
  var CSS = [
    // The bowl/rice layer must sit above every other appearance — dsh-whale-widget
    // sets no z-index at all (auto), so any positive value wins — and above this
    // plugin's own character, because upstream paints the bowls AFTER the sprite.
    // overflow:hidden keeps the above-the-viewport spawn from scrolling the page.
    '.dshvk1-stage{position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:10001;overflow:hidden}',
    // transform-origin:0 0 is load-bearing. renderBowls() emits the FULL transform
    // chain itself, in upstream's order (translate -> rotate -> scale -> anchor
    // offset), so the Q-bounce grows from the bowl's bottom edge and a worn pot tilts
    // about its own art centre. Any other origin re-anchors that chain and the art
    // ends up off the floor.
    '.dshvk1-bowl{position:absolute;left:0;top:0;pointer-events:none;will-change:transform;transform-origin:0 0}',
    '.dshvk1-heart{position:absolute;left:0;top:0;pointer-events:none;will-change:transform,opacity}',
    '.dshvk1-radar{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}',
    '.dshvk1-root{position:fixed;left:0;top:0;width:var(--dshvk1-s);height:var(--dshvk1-s);pointer-events:none;user-select:none;-webkit-user-select:none;z-index:9998;font-family:inherit;transition:left .16s ease,top .16s ease}',
    '.dshvk1-root.dshvk1-dragging{transition:none;cursor:grabbing}',
    '.dshvk1-body{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 100%}',
    '.dshvk1-art{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 50%;transition:transform .3s ease}',
    '.dshvk1-root.dshvk1-mirror .dshvk1-art{transform:scaleX(-1)}',
    '.dshvk1-face{position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;-webkit-user-drag:none}',
    '.dshvk1-flash{position:absolute;left:0;top:0;width:100%;height:100%;background:' + FLASH_COLOR + ';opacity:0;pointer-events:none;' +
      '-webkit-mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-size:100% 100%;mask-repeat:no-repeat}',
    '.dshvk1-panel{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;text-align:center}',
    '.dshvk1-label{position:absolute;left:0;right:0;top:4%;height:31.5%;display:flex;align-items:center;justify-content:center;' +
      'font-size:calc(var(--dshvk1-ph) * 0.21);font-weight:700;letter-spacing:.02em;color:rgba(158,182,224,.92);' +
      'text-shadow:calc(var(--dshvk1-ph) * 0.005) calc(var(--dshvk1-ph) * 0.005) 0 rgba(0,0,0,.59);white-space:nowrap}',
    '.dshvk1-amount{position:absolute;left:0;right:0;top:44%;display:flex;align-items:center;justify-content:center;white-space:nowrap}',
    '.dshvk1-cur{font-size:calc(var(--dshvk1-ph) * 0.27);font-weight:700;color:rgba(158,184,230,.92);' +
      'text-shadow:calc(var(--dshvk1-ph) * 0.005) calc(var(--dshvk1-ph) * 0.005) 0 rgba(0,0,0,.63)}',
    '.dshvk1-num{font-size:calc(var(--dshvk1-ph) * 0.48);font-weight:800;color:#f0f6ff;line-height:1;' +
      'text-shadow:calc(var(--dshvk1-ph) * 0.005) calc(var(--dshvk1-ph) * 0.005) 0 rgba(0,0,0,.63)}',
    '.dshvk1-floater{position:absolute;left:0;top:0;font-weight:800;white-space:nowrap;pointer-events:none;transform-origin:0 0;font-family:Arial,sans-serif}',
    '.dshvk1-dot{position:absolute;border-radius:50%;background:rgba(228,62,52,.92);border:1px solid rgba(255,255,255,.82);display:none;pointer-events:none}',
    '.dshvk1-btn{position:absolute;top:4px;right:4px;width:26px;height:26px;border:none;border-radius:7px;background:rgba(32,49,112,.86);color:#fff;' +
      'font-size:16px;line-height:1;cursor:pointer;padding:0;pointer-events:none;opacity:0;transition:opacity .15s ease;z-index:2}',
    '.dshvk1-btn.dshvk1-btn-on{opacity:1;pointer-events:auto}',
    '.dshvk1-btn:hover{background:#203170}',
    '.dshvk1-menu{position:fixed;min-width:206px;max-height:84vh;overflow:auto;background:var(--dsw-alias-bg-overlay,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(32,49,112,.35));' +
      'border-radius:10px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:10002;display:none;color-scheme:light dark}',
    '.dshvk1-menu.dshvk1-menu-open{display:block}',
    '.dshvk1-menu-row{display:block;width:100%;text-align:left;padding:6px 10px;border:none;border-radius:7px;background:transparent;' +
      'color:var(--dsw-alias-label-primary,#203170);font-size:12.5px;cursor:pointer;white-space:nowrap;box-sizing:border-box;font-family:inherit}',
    '.dshvk1-menu-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(32,49,112,.08))}',
    '.dshvk1-menu-row-flex{display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '.dshvk1-menu-sep{height:1px;background:var(--dsw-alias-border-l1,rgba(32,49,112,.25));margin:5px 2px}',
    '.dshvk1-menu-cap{padding:4px 10px 2px;font-size:11px;color:var(--dsw-alias-label-secondary,#7b86a6);letter-spacing:.03em}',
    '.dshvk1-menu-grid{display:flex;flex-wrap:wrap;gap:4px;padding:0 6px 2px}',
    '.dshvk1-menu-chip{flex:0 0 auto;padding:3px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(32,49,112,.35));' +
      'background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,#203170);font-size:11.5px;cursor:pointer;font-family:inherit}',
    '.dshvk1-menu-chip:hover{background:var(--dsw-alias-bg-layer-2,rgba(32,49,112,.14))}',
    '.dshvk1-menu-chip.dshvk1-chip-on{border-color:var(--dsw-alias-brand-primary,#203170);font-weight:700}',
    '.dshvk1-menu-num{width:56px;border:1px solid var(--dsw-alias-border-l2,rgba(32,49,112,.4));border-radius:6px;padding:2px 5px;' +
      'font-size:11.5px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#203170);box-sizing:border-box;font-family:inherit}',
    '.dshvk1-menu-num:disabled{opacity:.4;cursor:not-allowed}',
    '.dshvk1-menu-unit{font-size:11px;color:var(--dsw-alias-label-secondary,#7b86a6)}',
  ].join('\n')

  var styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)

  // ------------------------------------------------------------------ DOM ---
  // Bowls / hearts / radar live in VIEWPORT coordinates (the pet's window was
  // screen-sized for the same reason), so they do not move with the widget.
  var stage = document.createElement('div')
  stage.className = 'dshvk1-stage'
  var radarSvg = svgEl('svg')
  radarSvg.setAttribute('class', 'dshvk1-radar')
  stage.appendChild(radarSvg)
  document.body.appendChild(stage)

  var root = document.createElement('div')
  root.className = 'dshvk1-root'
  var body = document.createElement('div')
  body.className = 'dshvk1-body'
  var art = document.createElement('div')
  art.className = 'dshvk1-art'

  var faces = {}
  var flashes = {}
  EXPR_ORDER.forEach(function (key) {
    var im = document.createElement('img')
    im.className = 'dshvk1-face'
    im.src = EXPR_URL[key]
    im.alt = LABEL_TEXT
    im.draggable = false
    im.style.display = key === 'happy' ? 'block' : 'none'
    art.appendChild(im)
    faces[key] = im

    var fl = document.createElement('div')
    fl.className = 'dshvk1-flash'
    fl.style.webkitMaskImage = 'url(' + EXPR_URL[key] + ')'
    fl.style.maskImage = 'url(' + EXPR_URL[key] + ')'
    fl.style.display = key === 'happy' ? 'block' : 'none'
    art.appendChild(fl)
    flashes[key] = fl
  })

  var panel = document.createElement('div')
  panel.className = 'dshvk1-panel'
  var labelEl = document.createElement('div')
  labelEl.className = 'dshvk1-label'
  labelEl.textContent = LABEL_TEXT
  var amountEl = document.createElement('div')
  amountEl.className = 'dshvk1-amount'
  var curEl = document.createElement('span')
  curEl.className = 'dshvk1-cur'
  curEl.textContent = '\u00A5'
  var numEl = document.createElement('span')
  numEl.className = 'dshvk1-num'
  numEl.textContent = '--'
  amountEl.appendChild(curEl)
  amountEl.appendChild(numEl)
  panel.appendChild(labelEl)
  panel.appendChild(amountEl)

  var dot = document.createElement('div')
  dot.className = 'dshvk1-dot'

  body.appendChild(art)
  body.appendChild(panel)
  body.appendChild(dot)
  root.appendChild(body)

  var btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'dshvk1-btn'
  btn.title = '菜单'
  btn.textContent = '\u22EF'
  root.appendChild(btn)

  var menu = document.createElement('div')
  menu.className = 'dshvk1-menu'

  document.body.appendChild(root)
  document.body.appendChild(menu)

  // ----------------------------------------------------------------- state ---
  var state = {
    size: DEFAULT_SIZE,
    real: NaN,
    bookedAt: NaN,
    bookedBal: NaN,
    creditPending: 0,
    testOffset: 0,
    pending: 0,
    pendingStep: 0,
    dueGap: 0,
    demoLeft: 0,
    demoAmount: STEP,
    hits: [],
    floaters: [],
    hearts: [],
    bowls: [],
    expr: 'happy',
    nervousT: 0,
    bowlWait: 0,
    lockAll: false,
    lockT: 0,
    radarManual: false,
    headSquashT: HEAD_SQUASH_DUR,
    lastHeadClick: null,
    connected: false,
    soundOn: true,
    volume: 80,
    h: 'right', hOff: 0,
    v: 'bottom', vOff: 0,
    left: 0, top: 0,
    scrollGapOn: false,
    scrollGapPx: 17,
    dragWidget: null,
    grab: null,
    menuOpen: false,
    fxBowl: true, fxPat: true, fxHurt: true,
    theme: 'auto',
    cueVolumes: [100, 100, 100, 100],
    usage: null,
    peakMode: false, peakHold: 5,
    cloudOffset: 0,
    lastTabletClick: null,
  }

  function scaleOf() { return state.size / 1024 }
  function mirrored() { return state.h === 'right' }
  function headXLocal() { return state.size * (mirrored() ? 0.33 : 0.67) }
  function headYLocal() { return state.size * 0.36 }
  function headScreen() { return { x: state.left + headXLocal(), y: state.top + headYLocal() } }
  function floaterStep() { return Math.max(18, 34 * scaleOf() * 1.7) }
  function drawnBalance() {
    if (!isFinite(state.bookedBal)) return NaN
    var v = state.bookedBal - state.testOffset
    return Math.round((v < 0 ? 0 : v) * 100) / 100
  }

  // ------------------------------------------------------- layout / screen ---
  function quad() {
    var sc = scaleOf()
    var P = []
    for (var i = 0; i < 4; i++) P.push({ x: QX[i] * sc, y: QY[i] * sc })
    var lw = Math.sqrt(Math.pow(P[1].x - P[0].x, 2) + Math.pow(P[1].y - P[0].y, 2))
    var lh = Math.sqrt(Math.pow(P[3].x - P[0].x, 2) + Math.pow(P[3].y - P[0].y, 2))
    return { P: P, lw: lw, lh: lh }
  }

  function layout() {
    root.style.setProperty('--dshvk1-s', state.size + 'px')
    var flip = mirrored()
    root.classList.toggle('dshvk1-mirror', flip)
    var q = quad()
    var P = q.P
    if (q.lw < 8 || q.lh < 8) return
    var pw = 520
    var ph = Math.max(24, Math.round(pw * (q.lh / q.lw)))
    var a = (P[1].x - P[0].x) / pw
    var b = (P[1].y - P[0].y) / pw
    var c = (P[3].x - P[0].x) / ph
    var d = (P[3].y - P[0].y) / ph
    // Mirrored: the artwork flipped about the widget centre, so map the panel onto
    // the mirrored quad instead of flipping the glyphs (det stays positive).
    var m = flip ? [a, -b, -c, d, state.size - P[1].x, P[1].y] : [a, b, c, d, P[0].x, P[0].y]
    panel.style.width = pw + 'px'
    panel.style.height = ph + 'px'
    panel.style.setProperty('--dshvk1-ph', ph + 'px')
    panel.style.transform = 'matrix(' + m.join(',') + ')'
    var r = Math.max(2.5, state.size * 0.032)
    var cx = (P[1].x + P[2].x) / 2
    if (flip) cx = state.size - cx
    var cy = (P[1].y + P[2].y) / 2 + state.size * 0.05
    dot.style.width = (r * 2) + 'px'
    dot.style.height = (r * 2) + 'px'
    dot.style.left = (cx - r) + 'px'
    dot.style.top = (cy - r) + 'px'
  }

  // --------------------------------------------------------------- sounds ---
  function makePool(url, n) {
    var pool = []
    for (var i = 0; i < n; i++) {
      try {
        var a = new Audio(url)
        a.preload = 'auto'
        pool.push(a)
      } catch (err) {}
    }
    return { pool: pool, idx: 0, cue: 0 }
  }
  var hitPool = makePool(HIT_SOUND, 4)
  var feedPool = makePool(FEED_SOUND, 2)
  feedPool.cue = 1
  var landPool = makePool(BASE + '/pot_land.mp3', 2)
  landPool.cue = 2
  var offPool = makePool(BASE + '/pot_off.mp3', 2)
  offPool.cue = 3
  var cuePools = [hitPool, feedPool, landPool, offPool]
  function playPool(p) {
    if (!state.soundOn || state.volume <= 0 || !p.pool.length || stopped) return
    try {
      var a = p.pool[p.idx++ % p.pool.length]
      a.volume = state.volume / 100 * state.cueVolumes[p.cue] / 100
      a.currentTime = p.clip ? p.clip.start : 0
      clearTimeout(a.trimTimer)
      if (p.clip) a.trimTimer = setTimeout(function () { a.pause() }, (p.clip.end - p.clip.start) * 1000)
      var r = a.play()
      if (r && typeof r.catch === 'function') r.catch(function () {})
    } catch (err) {}
  }

  // -------------------------------------------------------------- floaters ---
  function spawnFloater(text, x, y, gain) {
    var em = Math.max(13, 34 * scaleOf())
    var el = document.createElement('div')
    el.className = 'dshvk1-floater'
    el.textContent = text
    el.style.fontSize = em + 'px'
    el.style.color = gain ? GAIN_FILL : CUE_FILL
    el.style.textShadow = '1px 1px 0 ' + (gain ? GAIN_EDGE : CUE_EDGE)
    stage.appendChild(el)
    state.floaters.push({ T: 0, x: x, y: y, jitter: 7 * scaleOf(), tw: el.offsetWidth || 0, gain: !!gain, el: el })
    if (state.floaters.length > 20) {
      var old = state.floaters.shift()
      if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el)
    }
  }

  function makeTick(amount, fromTest) {
    if (fromTest) state.testOffset = round4(state.testOffset + amount)
    else state.testOffset = 0
    if (!state.fxHurt) return
    if (state.hits.length < 3) state.hits.push({ T: 0 })

    var trail = 0
    for (var i = 0; i < state.floaters.length; i++) if (state.floaters[i].T < 0.5) trail++
    if (trail > 3) trail = 3

    var h = headScreen()
    spawnFloater('-' + amountText(amount),
      h.x - state.size * 0.06,
      h.y - Math.round(trail * floaterStep()),
      false)
    playPool(hitPool)
  }

  // --------------------------------------------------------------- hearts ---
  function heartEl(size) {
    var el = document.createElement('div')
    el.className = 'dshvk1-heart'
    el.style.width = size + 'px'
    el.style.height = size + 'px'
    el.innerHTML =
      '<svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true">' +
      '<path d="M2 5h3V3h3V2h3v1h3v3h-1v2h-1v1h-1v1h-1v1h-1v1H9v-1H8v-1H7V9H6V8H5V7H4V5H2z" ' +
      'fill="#ff5f8d" stroke="#8e1240" stroke-width="0.7"/></svg>'
    return el
  }
  function spawnHearts(cx, cy) {
    var n = 5 + Math.floor(Math.random() * 3)
    for (var i = 0; i < n; i++) {
      var size = Math.round(Math.max(14, state.size * (0.090 + 0.050 * Math.random())))
      var el = heartEl(size)
      stage.appendChild(el)
      state.hearts.push({
        T: 0,
        Dur: 0.75 + Math.random() * 0.35,
        x: cx + rnd(-state.size / 8, state.size / 8),
        y: cy - rnd(0, state.size / 12),
        phase: Math.random() * 6.283,
        drift: (Math.random() - 0.5) * 36.0,
        el: el,
      })
    }
  }

  // ----------------------------------------------------------------- bowls ---
  function bouncesForDrop(dropPx) {
    if (dropPx < 60) return 0
    if (dropPx < 260) return 1
    if (dropPx < 700) return 2
    return 3
  }
  function viewportRect() {
    return {
      left: 0,
      top: 0,
      right: window.innerWidth || document.documentElement.clientWidth || 1280,
      bottom: window.innerHeight || document.documentElement.clientHeight || 800,
    }
  }
  function bowlEl(url, width, height) {
    var el = document.createElement('img')
    el.className = 'dshvk1-bowl'
    el.src = url
    el.draggable = false
    el.style.width = Math.max(8, Math.round(width)) + 'px'
    el.style.height = Math.max(8, Math.round(height)) + 'px'
    stage.appendChild(el)
    return el
  }
  function ironLooseSize() {
    var w = Math.max(24, Math.round(state.size * IRON_W_LOOSE))
    return { w: w, h: Math.max(8, Math.round(w * (IRON_H_WORN / IRON_W_WORN))) }
  }
  function ironWornSize() {
    return { w: Math.max(24, Math.round(state.size * IRON_W_WORN)), h: Math.max(8, Math.round(state.size * IRON_H_WORN)) }
  }
  var riceSizeCache = null
  function riceDims() {
    if (!riceSizeCache || riceSizeCache.size !== state.size) {
      var w = Math.max(24, Math.round(state.size * BOWL_W))
      riceSizeCache = { size: state.size, w: w, h: w }
    }
    return riceSizeCache
  }

  function newBowl(fields) {
    var base = {
      iron: false, fed: false, dieT: 0, amount: 0,
      artW: 40, artH: 40, url: RICE_URL, R: 17,
      X: 0, Y: 0, VX: 0, VY: 0, rot: 0,
      bounces: 0, maxBounces: 0,
      squish: 0, squishT: SQUISH_DUR, squishDur: SQUISH_DUR,
      grounded: false, dragging: false, beingSucked: false, suckSpeed: 0,
      onHead: false, headFalling: false, headY: 0, headTarget: 0, fadeT: 0, headT: 0,
      sampleVX: 0, sampleVY: 0, el: null,
    }
    for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) base[k] = fields[k]
    base.el = bowlEl(base.url, base.artW, base.artH)
    state.bowls.push(base)
    return base
  }

  function startCredit(amount, demo) {
    if (!isFinite(amount) || amount <= 0) return
    if (demo) {
      // Rehearsals have their own bowls; real polling and today's usage never see fake money.
      if (!state.fxBowl) { state.testOffset = round4(state.testOffset - amount); updateScreen(); return }
    } else {
    state.creditPending = round4(state.creditPending + amount)
      if (!state.fxBowl) {
        applyCredit(amount)
        state.creditPending = Math.max(0, round4(state.creditPending - amount))
        updateScreen()
        return
      }
    }
    var vs = viewportRect()
    var d = riceDims()
    var R = d.w * 0.42
    newBowl({
      amount: amount,
      demo: !!demo,
      artW: d.w, artH: d.h, url: RICE_URL, R: R,
      X: vs.right - R * 1.2 - state.bowls.length * R * 0.5,
      Y: vs.top - R * 1.2,
      VX: -120, VY: 40,
      maxBounces: bouncesForDrop(vs.bottom - vs.top),
      el: null,
    })
  }

  function dropIronPot(x, y) {
    var d = ironLooseSize()
    var floor = viewportRect().bottom
    newBowl({
      iron: true,
      artW: d.w, artH: d.h, url: IRON_URL, R: d.w * 0.42,
      X: x, Y: y,
      maxBounces: bouncesForDrop(Math.max(0, floor - y)),
      el: null,
    })
  }

  function applyCredit(delta) {
    if (!(delta > 1e-9)) return
    state.bookedAt = round4(state.bookedAt + delta)
    state.bookedBal = round4(state.bookedBal + delta)
  }

  function onRiceFed(bowl) {
    if (bowl.fed) return
    bowl.fed = true
    bowl.dieT = 0
    bowl.dragging = false
    if (state.grab && state.grab.bowl === bowl) { state.grab = null; removeDragListeners() }
    var h = headScreen()
    spawnHearts(h.x, state.top + state.size * 0.20)
    playPool(feedPool)

    var haveFigures = isFinite(state.real) && isFinite(state.bookedBal)
    var shortfall = haveFigures ? Math.max(0, Math.round((state.real - state.bookedBal) * 100) / 100) : 0
    var owed = Math.max(state.creditPending, shortfall)
    var gain = bowl.demo ? bowl.amount : Math.min(bowl.amount, owed)
    if (gain <= 1e-9) gain = owed
    if (gain > 1e-9) {
      if (bowl.demo) state.testOffset = round4(state.testOffset - gain)
      else {
        applyCredit(gain)
        state.creditPending = Math.max(0, round4(state.creditPending - gain))
      }
      spawnFloater('+' + fmt2(gain), h.x - state.size * 0.06, h.y - Math.round(2 * floaterStep()), true)
    }
    dropIronPot(bowl.X, bowl.Y)
    // The original marks the canvas dirty on a credit; the readout must show the
    // money on this frame, not whenever the next cue happens to repaint it.
    updateScreen()
  }

  function charHitAt(x, y) {
    // Feed test uses the character's per-pixel alpha, exactly like RiceOnGirl.
    if (!hitCanvas || !hitReady) return false
    var w = state.size
    var lx = x - state.left
    var ly = y - state.top
    if (lx < 0 || ly < 0 || lx >= w || ly >= w) return false
    if (mirrored()) lx = w - lx
    try {
      var data = hitCanvas.getContext('2d').getImageData(
        Math.min(609, Math.max(0, Math.floor(lx / w * 610))),
        Math.min(609, Math.max(0, Math.floor(ly / w * 610))), 1, 1).data
      return data[3] > 8
    } catch (err) {
      return false
    }
  }
  function riceOnGirl(bowl) {
    var hw = bowl.artW / 2
    var r = hw * 0.45
    var r2 = r * r
    var need = Math.max(3, Math.round(r * 0.35))
    var hit = 0
    var x0 = Math.round(bowl.X - hw)
    var x1 = Math.round(bowl.X + hw)
    var y0 = Math.round(bowl.Y - hw)
    var y1 = Math.round(bowl.Y + hw)
    for (var y = y0; y <= y1; y += 2) {
      var dy = y - bowl.Y
      for (var x = x0; x <= x1; x += 2) {
        var dx = x - bowl.X
        if (dx * dx + dy * dy > r2) continue
        if (charHitAt(x, y)) { hit += 4; if (hit >= need) return true }
      }
    }
    return false
  }

  function ironAnchorX() { return state.left + state.size * (mirrored() ? (1 - 0.5558) : 0.5558) }
  var wornSequence = 0
  function ironStackIndex(p) {
    var index = 0
    for (var i = 0; i < state.bowls.length; i++) {
      var r = state.bowls[i]
      if (r !== p && r.iron && r.onHead && r.wornOrder < p.wornOrder) index++
    }
    return index
  }
  function ironHeadAnchor(p) {
    var worn = ironWornSize()
    var rimY = state.top + state.size * 0.3639
    return { x: Math.round(ironAnchorX()), y: Math.round(rimY - worn.h / 2 - (p ? ironStackIndex(p) : 0) * worn.h * 2 / 3), w: worn.w, h: worn.h }
  }
  function ironOnHead(p) {
    if (!p.iron || p.onHead || p.headFalling || p.fed || p.dragging) return false
    if (p.VY < 30) return false
    var rimX = p.X
    var rimY = p.Y + p.artH / 2
    var cx = ironAnchorX()
    var cy = state.top + state.size * 0.3639
    var top = null
    state.bowls.forEach(function (b) { if (b.onHead && (!top || b.Y < top.Y)) top = b })
    if (top) return Math.abs(p.X - top.X) <= p.artW / 2 && rimY >= top.Y - top.artH / 2 - 14 && rimY <= top.Y + top.artH / 2
    var halfW = state.size * 0.26
    var halfH = state.size * 0.18
    return rimX > cx - halfW && rimX < cx + halfW && rimY > cy - halfH && rimY < cy + halfH
  }
  function attachIronPot(p) {
    p.wornOrder = ++wornSequence
    var a = ironHeadAnchor(p)
    p.onHead = true
    p.headFalling = false
    p.Y = a.y
    p.headY = a.y
    p.headTarget = a.y
    p.X = a.x
    p.VX = 0
    p.VY = 0
    p.rot = 0
    p.grounded = false
    p.beingSucked = false
    var worn = ironWornSize()
    p.artW = worn.w
    p.artH = worn.h
    p.R = worn.w * 0.42
    p.el.style.width = worn.w + 'px'
    p.el.style.height = worn.h + 'px'
    state.headSquashT = 0
    playPool(landPool)
  }

  function knockPotOff() {
    var top = null
    state.bowls.forEach(function (p) {
      if (p.onHead && p.fadeT <= 0 && (!top || p.Y < top.Y)) top = p
    })
    if (!top) return false
    top.fadeT = 0.001
    state.headSquashT = 0
    playPool(offPool)
    return true
  }

  function updateBowls(dt) {
    var vs = viewportRect()
    for (var i = state.bowls.length - 1; i >= 0; i--) {
      var r = state.bowls[i]
      if (r.fed) {
        r.dieT += dt
        if (r.dieT > BOWL_DIE) {
          if (r.el.parentNode) r.el.parentNode.removeChild(r.el)
          state.bowls.splice(i, 1)
        }
        continue
      }
      if (r.squishT < r.squishDur) r.squishT += dt

      if (r.onHead) {
        var a = ironHeadAnchor(r)
        r.headTarget = a.y
        if (r.fadeT > 0) {
          r.fadeT += dt
          if (r.fadeT > IRON_FADE) {
            if (r.el.parentNode) r.el.parentNode.removeChild(r.el)
            state.bowls.splice(i, 1)
          }
          continue
        }
        if (r.headFalling) {
          r.headY += (r.headTarget - r.headY) * Math.min(1.0, dt * 9.0)
          if (Math.abs(r.headY - r.headTarget) < 0.6) { r.headY = r.headTarget; r.headFalling = false }
          r.Y = r.headY
        } else {
          r.Y = a.y
        }
        r.X = a.x
        r.VX = 0; r.VY = 0; r.squish = 0; r.rot = 0; r.grounded = false
        r.headT += dt
        continue
      }
      if (r.beingSucked) { r.squish = 0; continue }
      if (r.dragging) {
        r.squish = 0
      } else {
        // Arrival speed: the floor impact must be the speed the bowl CAME IN with, not
        // the speed after this frame's gravity. A coarse frame adds >90 px/s of gravity
        // on its own, so with the post-gravity value a bowl that is already sitting on
        // the floor registers a brand-new bounce — and restarts the Q-bounce squash —
        // on every single frame. That is the twitch seen on landing.
        var vBefore = r.VY
        r.VY += GRAVITY * dt
        r.VX *= (1.0 - AIR_DRAG * dt)
        r.X += r.VX * dt
        r.Y += r.VY * dt

        var floor = vs.bottom - r.R
        var left = vs.left + r.R
        var right = vs.right - r.R
        var top = vs.top + r.R
        if (r.Y >= floor) {
          r.Y = floor
          var impact = vBefore > 0 ? vBefore : 0
          var slide = Math.abs(r.VX) > SLIDE_STOP
          if (slide) r.VX *= 0.92
          r.VY = -impact * RESTITUTION
          if (impact > 90 && r.bounces < r.maxBounces) {
            r.bounces++
            r.squish = 1; r.squishT = 0; r.squishDur = SQUISH_DUR
          }
          if (r.bounces >= r.maxBounces || Math.abs(r.VY) < 45) {
            r.VY = 0
            if (!slide) { r.VX = 0; r.grounded = true; r.rot = 0 } else r.grounded = false
          } else r.grounded = false
        }
        if (!r.grounded && r.Y >= floor - 0.5 && Math.abs(r.VY) < 45) {
          r.VX *= (1.0 - SLIDE_FRICTION * dt)
          if (Math.abs(r.VX) <= SLIDE_STOP) { r.VX = 0; r.grounded = true; r.rot = 0 }
        }
        if (r.X < left) { r.X = left; r.VX = Math.abs(r.VX) * 0.5 }
        if (r.X > right) { r.X = right; r.VX = -Math.abs(r.VX) * 0.5 }
        if (r.Y < top) { r.Y = top; if (r.VY < 0) r.VY = 0 }
        if (ironOnHead(r)) attachIronPot(r)
      }

      if (!r.iron && !r.fed && riceOnGirl(r)) onRiceFed(r)
      if (r.squishT < r.squishDur) {
        var u = r.squishT / r.squishDur
        r.squish = Math.cos(u * 2.2 * Math.PI) * (1 - u) * 0.52
      } else r.squish = 0
    }

    // bowl-vs-bowl collisions (circles of radius R)
    for (var a2 = 0; a2 < state.bowls.length; a2++) {
      for (var b2 = a2 + 1; b2 < state.bowls.length; b2++) {
        var ra = state.bowls[a2], rb = state.bowls[b2]
        if (ra.fed || rb.fed || ra.onHead || rb.onHead) continue
        var dx = rb.X - ra.X, dy = rb.Y - ra.Y
        var d = Math.sqrt(dx * dx + dy * dy) || 0.001
        var minD = ra.R + rb.R
        if (d >= minD) continue
        var nx = dx / d, ny = dy / d
        var push = (minD - d) * 0.5
        var aFixed = ra.dragging || ra.beingSucked
        var bFixed = rb.dragging || rb.beingSucked
        var aw = aFixed ? 0 : (bFixed ? 1 : 0.5)
        var bw = bFixed ? 0 : (aFixed ? 1 : 0.5)
        ra.X -= nx * push * 2 * aw; ra.Y -= ny * push * 2 * aw
        rb.X += nx * push * 2 * bw; rb.Y += ny * push * 2 * bw
        var va = ra.VX * nx + ra.VY * ny
        var vb = rb.VX * nx + rb.VY * ny
        if (va - vb > 0 && !aFixed && !bFixed) {
          var imp = (va - vb) * 0.55
          ra.VX -= imp * nx; ra.VY -= imp * ny
          rb.VX += imp * nx; rb.VY += imp * ny
        }
      }
    }
  }

  // ---------------------------------------------------------------- radar ---
  function blip(bowl) {
    var G = headScreen()
    var dx = bowl.X - G.x
    var dy = bowl.Y - G.y
    var dist = Math.sqrt(dx * dx + dy * dy)
    var ux = dist > 0.001 ? dx / dist : 1
    var uy = dist > 0.001 ? dy / dist : 0
    var vx = bowl.dragging ? bowl.sampleVX : bowl.VX
    var vy = bowl.dragging ? bowl.sampleVY : bowl.VY
    var closure = -(vx * ux + vy * uy)
    var alt = -dy
    var ang = Math.atan2(uy, ux)
    var S = 1.33 * (2 * (bowl.artW * 0.42))
    function kpx(v) { return isFinite(v) ? (v / 1000).toFixed(1) + ' kpx' : '--' }
    function pxs(v) { return isFinite(v) ? (v === 0 ? '0' : String(Math.round(v))) + ' px/s' : '--' }
    function px(v) { return isFinite(v) ? (v === 0 ? '0' : String(Math.round(v))) + ' px' : '--' }
    return { S: S, Cx: bowl.X, Cy: bowl.Y, Dist: kpx(dist), Closure: pxs(closure), Alt: px(alt), Ang: ang }
  }
  function rectStr(x, y, w, h) {
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) +
      '" height="' + h.toFixed(1) + '" fill="' + RADAR_GREEN + '"/>'
  }
  function labelStr(text, x, y, h, anchor) {
    var edge = Math.max(1, h * 0.05)
    var common = ' font-family="Consolas,Menlo,monospace" font-weight="bold" font-size="' + h.toFixed(1) +
      '" text-anchor="' + anchor + '"'
    return '<text x="' + (x + edge).toFixed(1) + '" y="' + (y + edge).toFixed(1) + '"' + common +
      ' fill="rgba(0,40,0,0.667)">' + text + '</text>' +
      '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '"' + common + ' fill="' + RADAR_GREEN + '">' + text + '</text>'
  }
  function renderRadar(list) {
    var out = []
    for (var i = 0; i < list.length; i++) {
      var b = list[i]
      var S = b.S
      if (S < 24) continue
      var cx = b.Cx, cy = b.Cy
      var x0 = cx - S / 2, y0 = cy - S / 2, x1 = cx + S / 2, y1 = cy + S / 2
      var stroke = Math.max(2.0, 0.075 * S)
      var len = 0.30 * S
      var g = []
      g.push(rectStr(x0, y0, len, stroke))
      g.push(rectStr(x1 - len, y0, len, stroke))
      g.push(rectStr(x0, y1 - stroke, len, stroke))
      g.push(rectStr(x1 - len, y1 - stroke, len, stroke))
      g.push(rectStr(x0, y0, stroke, len))
      g.push(rectStr(x1 - stroke, y0, stroke, len))
      g.push(rectStr(x0, y1 - len, stroke, len))
      g.push(rectStr(x1 - stroke, y1 - len, stroke, len))

      var typeH = Math.max(11.0, 0.40 * S)
      var numH = Math.max(11.0, 0.30 * S)
      var gapX = 0.08 * S
      g.push(labelStr(RADAR_TYPE, cx, y0 - 0.06 * S - typeH * 0.78, typeH, 'middle'))
      g.push(labelStr(b.Dist, x1 + gapX, y0 + numH * 0.78, numH, 'start'))
      g.push(labelStr(b.Closure, x1 + gapX, y1, numH, 'start'))
      g.push(labelStr(b.Alt, x1 + 0.11 * S, y1 + 0.09 * S + numH, numH, 'end'))

      var ringR = 0.185 * S
      var ringStroke = 0.075 * S
      var rcx = cx, rcy = y1 + 0.70 * S
      g.push('<circle cx="' + rcx.toFixed(1) + '" cy="' + rcy.toFixed(1) + '" r="' + (ringR - ringStroke / 2).toFixed(1) +
        '" fill="none" stroke="' + RADAR_GREEN + '" stroke-width="' + ringStroke.toFixed(1) + '"/>')
      var ca = Math.cos(b.Ang), sa = Math.sin(b.Ang)
      g.push('<line x1="' + (rcx + ca * (ringR + ringStroke / 2)).toFixed(1) + '" y1="' + (rcy + sa * (ringR + ringStroke / 2)).toFixed(1) +
        '" x2="' + (rcx + ca * (ringR + 0.15 * S)).toFixed(1) + '" y2="' + (rcy + sa * (ringR + 0.15 * S)).toFixed(1) +
        '" stroke="' + RADAR_GREEN + '" stroke-width="' + ringStroke.toFixed(1) + '" stroke-linecap="square"/>')
      out.push('<g>' + g.join('') + '</g>')
    }
    radarSvg.innerHTML = out.join('')
  }

  function chargingBusy() {
    return state.pendingStep > 1e-9 || state.hits.length > 0 || state.demoLeft > 0
  }

  function updateRadar(dt) {
    var anyRice = false
    for (var i = 0; i < state.bowls.length; i++) {
      if (!state.bowls[i].iron && !state.bowls[i].fed) { anyRice = true; break }
    }
    if (!anyRice) {
      state.lockAll = false
      state.lockT = 0
      state.radarManual = false
      if (radarSvg.firstChild) radarSvg.innerHTML = ''
      return
    }
    if (state.bowlWait >= BOWL_WAIT) state.lockAll = true
    var showNow = state.lockAll || state.radarManual
    var blips = []
    for (var j = 0; j < state.bowls.length; j++) {
      var bowl = state.bowls[j]
      if (bowl.iron || bowl.fed) continue
      if (!showNow) continue
      blips.push(blip(bowl))
    }
    state.radarManual = state.radarManual && !state.lockAll
    if (!blips.length) {
      state.lockT = 0
      if (radarSvg.firstChild) radarSvg.innerHTML = ''
      return
    }

    // A charge that arrives now waits its turn: the pump pauses, it does not reset.
    if (!chargingBusy()) state.lockT += dt
    var magnet = state.lockAll && state.lockT >= LOCK_DELAY
    if (magnet) {
      var G = headScreen()
      for (var k = 0; k < state.bowls.length; k++) {
        var b = state.bowls[k]
        if (b.iron || b.fed) continue
        b.beingSucked = true
        var dx = G.x - b.X, dy = G.y - b.Y
        var d = Math.sqrt(dx * dx + dy * dy)
        b.suckSpeed = Math.min(SUCK_MAX, (b.suckSpeed || 0) + SUCK_ACCEL * dt)
        if (d <= Math.max(12, b.R) || d < 0.001) { onRiceFed(b); continue }
        var step = Math.min(d, b.suckSpeed * dt)
        b.X += dx / d * step
        b.Y += dy / d * step
      }
      // plates follow the bowls
      blips = []
      for (var m = 0; m < state.bowls.length; m++) {
        var bb = state.bowls[m]
        if (bb.iron || bb.fed) continue
        blips.push(blip(bb))
      }
    }
    renderRadar(blips)
  }

  // ----------------------------------------------------------- expression ---
  function setExpression(want) {
    if (state.expr === want) return
    state.expr = want
    for (var i = 0; i < EXPR_ORDER.length; i++) {
      var k = EXPR_ORDER[i]
      var on = k === want
      faces[k].style.display = on ? 'block' : 'none'
      flashes[k].style.display = on ? 'block' : 'none'
    }
    updateHitSource()
  }
  function updateExpression(dt) {
    if (state.nervousT > 0) state.nervousT -= dt
    var anyBowl = false
    for (var i = 0; i < state.bowls.length; i++) {
      if (!state.bowls[i].fed && !state.bowls[i].iron) { anyBowl = true; break }
    }
    var cueRunning = chargingBusy()
    if (anyBowl && !cueRunning && !state.lockAll) state.bowlWait += dt
    else if (!anyBowl) state.bowlWait = 0

    var headPotOn = false
    for (var j = 0; j < state.bowls.length; j++) {
      if (state.bowls[j].iron && state.bowls[j].onHead && state.bowls[j].fadeT <= 0) { headPotOn = true; break }
    }
    var want
    // DELIBERATE DEVIATION from upstream: there, a worn pot pins her to the flat face
    // even while a deduction plays (their own test is named "stillCalmWhileCharging").
    // Here the charge expression wins, so the planchette still reads as reacting to the
    // money going out. Calm keeps its place ahead of aloof.
    if (pat.active) want = 'happy'
    else if (cueRunning && state.fxHurt) { want = 'nervous'; state.nervousT = NERVOUS_HOLD }
    else if (state.nervousT > 0) want = 'nervous'
    else if (headPotOn && !anyBowl) want = 'calm'
    else if (state.bowlWait >= BOWL_WAIT) want = 'aloof'
    else want = 'happy'
    setExpression(want)
  }

  // ------------------------------------------------------- balance reading ---
  function applyBalance(bal, snap) {
    if (!isFinite(bal)) return
    noteUsage(bal)
    state.connected = true
    var first = !isFinite(state.real)
    var prev = state.real
    state.real = bal
    if (first) {
      state.bookedAt = bal
      state.bookedBal = bal
      state.pending = 0
    }
    if (snap) {
      state.bookedAt = bal
      state.bookedBal = bal
      state.testOffset = 0
      state.pending = 0
      state.pendingStep = 0
      state.dueGap = 0
      state.creditPending = 0
      state.bowls.filter(function (b) { return !b.iron }).forEach(function (b) { detach(b.el) })
      state.bowls = state.bowls.filter(function (b) { return b.iron })
    } else if (!first) {
      if (bal > prev + 1e-9) {
        // A top-up must NOT move the readout: it drops a bowl for you to collect.
        startCredit(round4(bal - prev))
      } else {
        var owed = round4(state.bookedAt - bal)
        if (owed < -1e-9) {
          owed = state.pending
          state.bookedAt = round4(bal + owed)
          state.bookedBal = round4(bal + owed)
        }
        if (owed >= state.pendingStep - 1e-9) owed = round4(owed - state.pendingStep)
        else owed = 0
        var cap = STEP * MAX_CUES_PER_POLL
        if (owed > cap) owed = cap
        state.pending = owed < 1e-9 ? 0 : owed
        if (state.pending > 1e-9 && state.dueGap <= 0) state.dueGap = 0
      }
    }
    updateScreen()
  }

  function updateScreen() {
    var v = drawnBalance()
    numEl.textContent = isFinite(v) ? v.toFixed(2) : '--'
    numEl.style.fontSize = 'calc(var(--dshvk1-ph) * ' + Math.min(0.48, 2.5 / Math.max(1, numEl.textContent.length)) + ')'
    updateTablet()
    dot.style.display = state.connected ? 'none' : 'block'
  }

  var busy = false
  function poll(snap) {
    if (busy) return
    busy = true
    fetch(BALANCE_URL, { cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (d) {
        if (stopped) return
        if (d && d.ok && d.totalBalance != null && isFinite(Number(d.totalBalance))) {
          if (d.serverTime && isFinite(Date.parse(d.serverTime))) state.cloudOffset = Date.parse(d.serverTime) - Date.now()
          applyBalance(Number(d.totalBalance), !!snap)
        }
        else { state.connected = false; updateScreen() }
      })
      .catch(function () { if (!stopped) { state.connected = false; updateScreen() } })
      .finally(function () { busy = false })
  }

  // ----------------------------------------------------------------- draw ---
  function renderBowls() {
    var worn = false
    for (var i = 0; i < state.bowls.length; i++) {
      var r = state.bowls[i]
      if (!r.el) continue
      if (r.iron && r.onHead) worn = true
      var sq = r.squish || 0
      var sw = 1.0 + sq * 0.75
      var sh = 1.0 - sq * 0.75
      // Upstream draws with TranslateTransform(anchor) then Rotate/Scale and finally
      // DrawImage at a fixed art offset relative to that anchor. Emitting the same
      // chain as one CSS transform list keeps the two anchor rules honest:
      var tf
      if (r.onHead) {
        // Worn pot: anchored on the art CENTRE (IronHeadAnchor) and tilted about it. It has
        // to be mirrored together with her: she is drawn with scaleX(-1) when pinned to the
        // right edge, and a pot living in screen coordinates would otherwise lean the wrong
        // way against a mirrored head. Mirroring negates the rotation and flips the
        // horizontal scale: M' = T(2C-X, Y) R(-T) S(-sw, sh) T(-c).
        var flip = mirrored() ? -1 : 1
        tf = 'translate(' + Math.round(r.X) + 'px,' + Math.round(r.Y) + 'px)' +
          ' rotate(' + (flip * -IRON_TILT_DEG) + 'deg)' +
          ' scale(' + (flip * sw).toFixed(3) + ',' + sh.toFixed(3) + ')' +
          ' translate(' + (-r.artW / 2).toFixed(1) + 'px,' + (-r.artH / 2).toFixed(1) + 'px)'
      } else {
        // Loose prop: anchored on its BOTTOM edge at Y + R, so at rest the art sits
        // exactly on the screen floor (anchoring the art on Y instead pushes its
        // bottom 0.08*artW through the floor, where it gets clipped), and the squash
        // then grows upward from that same edge.
        tf = 'translate(' + Math.round(r.X) + 'px,' + Math.round(r.Y + r.R) + 'px)' +
          ' scale(' + sw.toFixed(3) + ',' + sh.toFixed(3) + ')' +
          ' translate(' + (-r.artW / 2).toFixed(1) + 'px,' + (-r.artH).toFixed(1) + 'px)'
      }
      r.el.style.transform = tf
      r.el.style.zIndex = r.onHead ? String(10 + ironStackIndex(r)) : '0'
      if (r.fed) {
        var e = 1.0 - r.dieT / BOWL_DIE
        r.el.style.opacity = String(e > 0 ? e : 0)
      } else if (r.fadeT > 0) {
        var f = 1.0 - r.fadeT / IRON_FADE
        r.el.style.opacity = String(f > 0 ? f : 0)
      } else {
        r.el.style.opacity = '1'
      }
    }
    applyPotMask(worn)
  }

  var last = 0
  var rafId = 0
  var stopped = false
  function frame(now) {
    if (stopped) return
    rafId = requestAnimationFrame(frame)
    if (!last) { last = now; return }
    var dt = Math.min(0.1, (now - last) / 1000)
    last = now

    // ---- settlement: the only place the printed number moves ----
    if (state.dueGap > 0) state.dueGap -= dt
    var take = 0
    if (state.dueGap <= 0 && state.pendingStep <= 0) {
      if (state.pending >= STEP - 1e-9) take = STEP
      else if (state.pending > 1e-9) take = Math.round(state.pending * 100) / 100
    }
    if (take > 0) {
      state.pending = round4(state.pending - take)
      if (state.pending < 1e-9) state.pending = 0
      state.bookedAt = round4(state.bookedAt - take)
      state.bookedBal = round4(state.bookedBal - take)
      state.pendingStep = take
      state.dueGap = CUE_GAP
    }
    if (state.pendingStep > 0) { makeTick(state.pendingStep, false); state.pendingStep = 0; updateScreen() }
    if (state.demoLeft > 0 && state.pendingStep <= 0 && state.dueGap <= 0) {
      makeTick(state.demoAmount, true)
      state.demoLeft--
      state.dueGap = CUE_GAP
      updateScreen()
    }

    updateBowls(dt)
    updateRadar(dt)
    updatePat(dt)
    tickTablet(dt)
    updateExpression(dt)

    for (var i = state.hits.length - 1; i >= 0; i--) {
      state.hits[i].T += dt
      if (state.hits[i].T >= HIT_DUR) state.hits.splice(i, 1)
    }
    for (var j = state.floaters.length - 1; j >= 0; j--) {
      var fl = state.floaters[j]
      fl.T += dt
      if (fl.T >= FLOAT_DUR) {
        if (fl.el.parentNode) fl.el.parentNode.removeChild(fl.el)
        state.floaters.splice(j, 1)
      }
    }
    for (var k = state.hearts.length - 1; k >= 0; k--) {
      var hh = state.hearts[k]
      hh.T += dt
      if (hh.T >= hh.Dur) {
        if (hh.el.parentNode) hh.el.parentNode.removeChild(hh.el)
        state.hearts.splice(k, 1)
      }
    }

    var sx = 0, sy = 0
    for (var m = 0; m < state.hits.length; m++) {
      var h = state.hits[m]
      var e = Math.max(0, 1 - h.T / HIT_DUR)
      sx += Math.sin(h.T * 24) * 3.2 * e
      sy += Math.cos(h.T * 19) * 2.8 * e
    }
    var shakeMax = Math.min(12.0, state.size * 0.06)
    sx = clamp(sx, -shakeMax, shakeMax)
    sy = clamp(sy, -shakeMax, shakeMax)

    if (state.headSquashT < HEAD_SQUASH_DUR) state.headSquashT += dt
    var hu = state.headSquashT / HEAD_SQUASH_DUR
    var squash = hu < 1 ? Math.sin(Math.PI * hu) * (1 - hu) * 0.6 : 0
    var shakeTf = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px)'
    if (squash > 0.001) {
      shakeTf += ' scale(' + (1 + squash * 0.10).toFixed(4) + ',' + (1 - squash * 0.16).toFixed(4) + ')'
    }
    if (pat.active) {
      var pi = Math.floor(pat.t / 0.04) % 5
      // Upstream moves the compression pivot below her feet: displacement is shift*(1-scaleY).
      // Keep the feet inside the webpage when she is pinned against the viewport's bottom.
      var patShift = Math.min(state.size * pi * 0.05 * pi * 0.0625, Math.max(0, viewport().h - state.top - state.size))
      shakeTf += ' translateY(' + patShift.toFixed(2) + 'px) scale(' + (1 + pi * 0.025) + ',' + (1 - pi * 0.0625) + ')'
    }
    body.style.transform = shakeTf

    var flash = 0
    var maxTint = Math.max(0.30, 0.64 - scaleOf() * 0.75)
    for (var n = 0; n < state.hits.length; n++) {
      var hit = state.hits[n]
      var pulse
      if (hit.T < 0.20) pulse = 1.0
      else {
        var ee = Math.max(0, 1 - (hit.T - 0.20) / (HIT_DUR - 0.20))
        pulse = Math.sin((hit.T - 0.20) * 26) * 0.55 * ee * ee
      }
      if (pulse > 0.01) flash = Math.max(flash, Math.min(maxTint, maxTint * pulse))
    }
    var activeFlash = flashes[state.expr]
    if (activeFlash) activeFlash.style.opacity = String(flash)

    for (var p = 0; p < state.floaters.length; p++) {
      var f = state.floaters[p]
      var t = f.T / FLOAT_DUR
      var em = Math.max(13, 34 * scaleOf())
      var pop = t < 0.18 ? (0.62 + 0.38 * (t / 0.18)) : 1
      var alpha = t < 0.55 ? 1 : (1 - (t - 0.55) / 0.45)
      if (!f.el) continue
      if (alpha <= 0) { f.el.style.opacity = '0'; continue }
      var fx = f.x + Math.round(f.jitter * Math.sin(t * 9))
      if (mirrored()) fx = state.left + (state.size - (fx - state.left) - f.tw)
      var fy = f.y - Math.round(t * em * 2.7)
      f.el.style.opacity = String(alpha)
      f.el.style.transform = 'translate(' + fx + 'px,' + fy + 'px) scale(' + pop + ')'
    }

    for (var q = 0; q < state.hearts.length; q++) {
      var hd = state.hearts[q]
      var u = hd.T / hd.Dur
      var a = u < 0.15 ? u / 0.15 : 1.0 - (u - 0.15) / 0.85
      var rise = 46.0 * u
      var wob = Math.sin(hd.phase + u * 7.0) * 6.0
      hd.el.style.opacity = String(a > 0 ? a : 0)
      hd.el.style.transform = 'translate(' + Math.round(hd.x + hd.drift * u + wob) + 'px,' + Math.round(hd.y - rise) + 'px)'
    }

    renderBowls()
  }

  // ----------------------------------------------------------- hit testing ---
  var hitCanvas = null
  var hitReady = false
  var hitSrc = ''
  var potArt = null
  var potArtReady = false
  var potMask = { key: '', url: '', applied: '' }
  function updateHitSource() {
    var url = EXPR_URL[state.expr] || EXPR_URL.happy
    if (hitSrc === url) return
    hitSrc = url
    hitReady = false
    try {
      var probe = new Image()
      probe.onload = function () {
        try {
          hitCanvas.getContext('2d').drawImage(probe, 0, 0, 610, 610)
          hitReady = true
        } catch (err) {}
      }
      probe.src = url
    } catch (err) {}
  }
  function setupHitTest() {
    try {
      hitCanvas = document.createElement('canvas')
      hitCanvas.width = 610
      hitCanvas.height = 610
      updateHitSource()
    } catch (err) {}
    try {
      potArt = new Image()
      potArt.onload = function () { potArtReady = true }
      potArt.src = IRON_URL
    } catch (err) {}
  }

  // Wearing the pot must not leave her hair showing above it. Upstream ships a
  // hand-drawn erase mask (EraseStrokes) that clears her pixels inside the pot's
  // column and above the pot's own OUTLINE — note it follows the dome (deep in the
  // middle, shallow at the ends), because a flat cut would bite a notch out of her
  // hair beside the dome. Here the same shape is derived from the pot art instead of
  // pasted coordinates, so it tracks every size preset and the worn tilt.
  function potMaskUrl() {
    // The erase shape IS the pot, so without its art step 3 cannot run and the mask
    // degenerates into a flat cut of the whole column above the rim — which bites a
    // notch out of her hair beside the dome, the very thing the dome-following shape
    // avoids. Returning '' leaves the mask off entirely; applyPotMask() re-asks every
    // frame, so the mask appears on its own once the art lands (and never gets cached
    // in the degraded form, because nothing is cached on this path).
    if (!potArtReady) return ''
    var worn = ironWornSize()
    var key = state.size + '/' + worn.w + 'x' + worn.h
    if (potMask.key === key) return potMask.url
    potMask.key = key
    potMask.url = ''
    try {
      var W = state.size
      var cx = W * 0.5558
      var rimY = W * 0.3639
      var pad = Math.ceil(W * 0.02)                 // covers the worn tilt
      var x0 = Math.floor(cx - worn.w / 2 - pad)
      // Rasterise the pot exactly where the worn pot is drawn — same centre, same tilt —
      // and read its ALPHA back, so the erase boundary is the pot's REAL outline in every
      // column instead of a guessed shape. This is the shape upstream encodes by hand in
      // EraseStrokes. Deriving it also removes the need to re-show the pot body, and that
      // re-show was what let her hair leak back through the pot's anti-aliased top edge
      // as the little spikes the user photographed.
      var t = document.createElement('canvas')
      t.width = Math.max(1, Math.ceil(worn.w + pad * 2))
      t.height = Math.max(1, Math.ceil(rimY))
      var tg = t.getContext('2d')
      tg.save()
      tg.translate(cx - x0, rimY - worn.h / 2)
      // The mask is applied to the ART, and the art is flipped as a whole when she is pinned
      // to the right edge, so the mask's content must be the UNMIRRORED pot placement in
      // every case. Mirroring it here as well would flip twice and leave the erase boundary
      // 2*6.23deg out of step with the pot.
      tg.rotate(-IRON_TILT_DEG * Math.PI / 180)
      tg.drawImage(potArt, -worn.w / 2, -worn.h / 2, worn.w, worn.h)
      tg.restore()
      var alpha = tg.getImageData(0, 0, t.width, t.height).data
      var margin = Math.max(2, Math.round(W * 0.008))   // swallow the AA fringe
      var c = document.createElement('canvas')
      c.width = W
      c.height = W
      var g = c.getContext('2d')
      // A CSS mask fed an IMAGE is read through its ALPHA channel (mask-mode:
      // match-source), so "hidden" means alpha 0. Painting a region black would leave it
      // fully opaque and the mask would silently do nothing at all — which is what the
      // first version did.
      g.fillStyle = '#fff'
      g.fillRect(0, 0, W, W)
      g.globalCompositeOperation = 'destination-out'
      for (var x = 0; x < t.width; x++) {
        var top = -1
        for (var y = 0; y < t.height; y++) {
          if (alpha[(y * t.width + x) * 4 + 3] > 128) { top = y; break }
        }
        // Where the pot has no pixel at all, nothing covers her, so the whole column down
        // to the rim goes. Otherwise everything above the outline, plus a margin so the
        // pot's own soft edge cannot leak her hair back through.
        var bottom = top < 0 ? t.height : Math.min(t.height, top + margin)
        if (bottom > 0) g.fillRect(x0 + x, 0, 1, bottom)
      }
      g.globalCompositeOperation = 'source-over'
      potMask.url = c.toDataURL()
    } catch (err) {
      potMask.url = ''
    }
    return potMask.url
  }

  function applyPotMask(worn) {
    var url = worn ? potMaskUrl() : ''
    if (url === potMask.applied) return
    potMask.applied = url
    var cssUrl = url ? 'url("' + url + '")' : ''
    art.style.webkitMaskImage = cssUrl
    art.style.maskImage = cssUrl
    // Pinned explicitly: the canvas mask encodes the erase as transparency, and alpha is
    // the reading that matches it (luminance would invert the meaning of the punch).
    art.style.webkitMaskMode = url ? 'alpha' : ''
    art.style.maskMode = url ? 'alpha' : ''
    art.style.webkitMaskSize = url ? '100% 100%' : ''
    art.style.maskSize = url ? '100% 100%' : ''
    art.style.webkitMaskRepeat = url ? 'no-repeat' : ''
    art.style.maskRepeat = url ? 'no-repeat' : ''
  }
  function isHit(e) {
    if (!hitCanvas || !hitReady) return false
    try {
      var r = root.getBoundingClientRect()
      if (!r || r.width <= 0 || r.height <= 0) return false
      var lx = (e.clientX - r.left) / r.width * 610
      var ly = (e.clientY - r.top) / r.height * 610
      if (lx < 0 || ly < 0 || lx >= 610 || ly >= 610) return false
      var data = hitCanvas.getContext('2d').getImageData(Math.floor(lx), Math.floor(ly), 1, 1).data
      return data[3] > 10
    } catch (err) {
      return false
    }
  }
  function bowlAt(x, y) {
    for (var i = state.bowls.length - 1; i >= 0; i--) {
      var b = state.bowls[i]
      // A worn pot is not grabbable: it is removed by double-clicking her head.
      if (b.fed || b.fadeT > 0 || b.beingSucked || b.onHead) continue
      // The art hangs from its bottom edge at Y + R, so the pick circle tracks the
      // drawn art rather than the physics footprint centre.
      var cy = b.Y + b.R - b.artH / 2
      var dx = x - b.X, dy = y - cy
      if (dx * dx + dy * dy <= Math.pow(b.R * 1.15, 2)) return b
    }
    return null
  }
  function inHeadBox(x, y) {
    var cx = state.left + state.size * (mirrored() ? (1 - 0.47) : 0.47)
    var cy = state.top + state.size * 0.30
    return Math.abs(x - cx) < state.size * 0.26 && Math.abs(y - cy) < state.size * 0.18
  }

  // ================================================== position (whale port) ==
  function viewport() {
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 1280,
      h: window.innerHeight || document.documentElement.clientHeight || 800,
    }
  }
  function rightGap() {
    if (!state.scrollGapOn) return 0
    return state.scrollGapPx > 0 ? state.scrollGapPx : 0
  }
  function express() {
    root.style.left = state.left + 'px'
    root.style.top = state.top + 'px'
  }
  function settle() {
    var vp = viewport()
    var w = state.size, h = state.size
    if (state.dragWidget) {
      state.left = clamp(state.left, 0, Math.max(0, vp.w - w - rightGap()))
      state.top = clamp(state.top, 0, Math.max(0, vp.h - h))
      express(); layout(); return
    }
    if (state.h === 'right') state.left = Math.max(0, vp.w - w - state.hOff - rightGap())
    else if (state.h === 'left') state.left = state.hOff
    else state.left = clamp(state.left, 0, Math.max(0, vp.w - w - rightGap()))
    if (state.v === 'bottom') state.top = Math.max(0, vp.h - h - state.vOff)
    else if (state.v === 'top') state.top = state.vOff
    else state.top = clamp(state.top, 0, Math.max(0, vp.h - h))
    express()
    layout()
  }
  function saveAnchor() {
    try {
      var vp = viewport()
      var w = state.size, h = state.size
      var leftDist = state.left, rightDist = vp.w - state.left - w
      var topDist = state.top, bottomDist = vp.h - state.top - h
      var hAnchor = leftDist <= rightDist ? 'left' : 'right'
      var hDistRaw = Math.round(Math.min(leftDist, rightDist))
      var hDist = hAnchor === 'right' && state.scrollGapOn ? Math.max(0, hDistRaw - rightGap()) : hDistRaw
      localStorage.setItem(POS_KEY, JSON.stringify({
        v: 2, hAnchor: hAnchor, hDist: hDist,
        vAnchor: topDist <= bottomDist ? 'top' : 'bottom',
        vDist: Math.round(Math.min(topDist, bottomDist)),
      }))
    } catch (err) {}
  }
  function applyAnchorPos() {
    try {
      var a = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
      if (!a || a.v !== 2 || (a.hAnchor !== 'left' && a.hAnchor !== 'right') || typeof a.hDist !== 'number' ||
          (a.vAnchor !== 'top' && a.vAnchor !== 'bottom') || typeof a.vDist !== 'number') return false
      var vp = viewport()
      var w = state.size, h = state.size
      var effectiveRightDist = a.hAnchor === 'right' ? a.hDist + (state.scrollGapOn ? rightGap() : 0) : a.hDist
      var l = a.hAnchor === 'left' ? a.hDist : vp.w - effectiveRightDist - w
      var t = a.vAnchor === 'top' ? a.vDist : vp.h - a.vDist - h
      state.left = clamp(l, 0, Math.max(0, vp.w - w))
      state.top = clamp(t, 0, Math.max(0, vp.h - h))
      state.h = a.hAnchor; state.hOff = 0
      state.v = a.vAnchor; state.vOff = 0
      express(); layout()
      return true
    } catch (err) {
      return false
    }
  }

  // ------------------------------------------------------ drag & snapping ---
  function addDragListeners() {
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onUp, true)
  }
  function removeDragListeners() {
    document.removeEventListener('pointermove', onMove, true)
    document.removeEventListener('pointerup', onUp, true)
    document.removeEventListener('pointercancel', onUp, true)
  }
  function onDown(e) {
    blockPat()
    if (settings.open) return
    if (state.menuOpen) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (e.target && e.target.closest && e.target.closest('.dshvk1-menu')) return

    var onArt = isHit(e)
    // Double-clicking her head (with the pot on it) is decided FIRST: the worn pot
    // is a wide circle sitting right on that spot, so a bowl grab would eat it.
    var now = Date.now()
    var isHead = onArt && inHeadBox(e.clientX, e.clientY)
    if (isHead && state.lastHeadClick && now - state.lastHeadClick.t < 400 &&
        Math.abs(e.clientX - state.lastHeadClick.x) < 24 && Math.abs(e.clientY - state.lastHeadClick.y) < 24) {
      state.lastHeadClick = null
      knockPotOff()
      try { e.preventDefault(); e.stopPropagation() } catch (err) {}
      return
    }
    if (isHead) state.lastHeadClick = { t: now, x: e.clientX, y: e.clientY }
    if (onTablet(e.clientX, e.clientY)) {
      var tc = state.lastTabletClick
      if (tc && now - tc.t < 400 && Math.hypot(e.clientX - tc.x, e.clientY - tc.y) < 24) {
        state.peakMode = !state.peakMode
        state.peakHold = 5
        state.lastTabletClick = null
        updateTablet()
        e.preventDefault(); e.stopPropagation()
        return
      }
      state.lastTabletClick = { t: now, x: e.clientX, y: e.clientY }
    }

    var bowl = bowlAt(e.clientX, e.clientY)
    if (bowl) {
      try { e.preventDefault(); e.stopPropagation() } catch (err) {}
      bowl.beingSucked = false
      bowl.dragging = true
      bowl.VX = 0
      bowl.VY = 0
      state.grab = { bowl: bowl, dx: bowl.X - e.clientX, dy: bowl.Y - e.clientY, moved: false, x: e.clientX, y: e.clientY }
      addDragListeners()
      return
    }
    if (!onArt) return

    try { e.preventDefault(); e.stopPropagation() } catch (err) {}
    state.dragWidget = { x: e.clientX, y: e.clientY, left: state.left, top: state.top, moved: false }
    root.classList.add('dshvk1-dragging')
    addDragListeners()
  }
  function onMove(e) {
    var g = state.grab
    if (g) {
      var b = g.bowl
      if (Math.abs(e.clientX - g.x) + Math.abs(e.clientY - g.y) >= 3) g.moved = true
      var nx = e.clientX + g.dx
      var ny = e.clientY + g.dy
      b.sampleVX = (nx - b.X) / 0.016
      b.sampleVY = (ny - b.Y) / 0.016
      b.X = nx
      b.Y = ny
      renderBowls()
      return
    }
    var d = state.dragWidget
    if (!d) return
    var dx = e.clientX - d.x
    var dy = e.clientY - d.y
    if (dx * dx + dy * dy >= 9) d.moved = true
    var vp = viewport()
    state.left = clamp(d.left + dx, 0, Math.max(0, vp.w - state.size - rightGap()))
    state.top = clamp(d.top + dy, 0, Math.max(0, vp.h - state.size))
    express()
  }
  function onUp(e) {
    var g = state.grab
    if (g) {
      var b = g.bowl
      b.dragging = false
      state.grab = null
      removeDragListeners()
      if (b.iron) {
          b.VX = b.sampleVX * 0.35
          b.VY = b.sampleVY * 0.35
          var floor = viewportRect().bottom
          b.maxBounces = bouncesForDrop(Math.max(0, floor - b.Y))
          b.bounces = 0
          b.grounded = false
      } else if (riceOnGirl(b)) {
        onRiceFed(b)
      } else {
        b.VX = b.sampleVX * 0.35
        b.VY = b.sampleVY * 0.35
        var fl = viewportRect().bottom
        b.maxBounces = bouncesForDrop(Math.max(0, fl - b.Y))
        b.bounces = 0
        b.grounded = false
      }
      return
    }
    var d = state.dragWidget
    if (!d) return
    state.dragWidget = null
    root.classList.remove('dshvk1-dragging')
    removeDragListeners()
    if (!d.moved) { poll(true); return }

    var vp = viewport()
    var w = state.size, h = state.size
    var left = state.left, top = state.top
    var centerX = left + w / 2
    var centerY = top + h / 2
    if (centerX < vp.w / 4) { state.h = 'left'; state.hOff = 0 }
    else if (centerX > vp.w * 3 / 4) { state.h = 'right'; state.hOff = 0 }
    else { state.h = null; state.hOff = left }
    if (centerY < vp.h / 4) { state.v = 'top'; state.vOff = 0 }
    else if (centerY > vp.h * 3 / 4) { state.v = 'bottom'; state.vOff = 0 }
    else { state.v = null; state.vOff = top }
    settle()
    saveAnchor()
  }
  function onCursor(e) {
    pat.pointer = { x: e.clientX, y: e.clientY, buttons: e.buttons || 0 }
    if (state.dragWidget || state.grab) return
    var onArt = isHit(e)
    var onBowl = !!bowlAt(e.clientX, e.clientY)
    var onBtn = !!(e.target && e.target.closest && e.target.closest('.dshvk1-btn'))
    if (onArt || onBowl || onBtn || state.menuOpen) {
      btnOnSolid = true
      keepBtn()
    } else if (btnOnSolid) {
      btnOnSolid = false
      releaseBtn()
    }
    if (onBowl) root.style.cursor = 'grab'
    else root.style.cursor = onArt ? 'grab' : ''
  }
  function onContextMenu(e) {
    if (settings.open) return
    if (state.dragWidget || state.grab) return
    if (!isHit(e)) return
    try { e.preventDefault(); e.stopPropagation() } catch (err) {}
    openMenu(e.clientX, e.clientY)
  }
  function onResize() {
    if (state.h === null && state.v === null && applyAnchorPos()) return
    settle()
  }
  document.addEventListener('pointerdown', onDown, true)
  document.addEventListener('pointermove', onCursor, true)
  document.addEventListener('contextmenu', onContextMenu, true)
  window.addEventListener('resize', onResize)

  // ---------------------------------------------------------------- menu ----
  var btnOnSolid = false
  var btnHideTimer = null
  function keepBtn() {
    if (btnHideTimer) { clearTimeout(btnHideTimer); btnHideTimer = null }
    btn.classList.add('dshvk1-btn-on')
  }
  function releaseBtn() {
    if (btnHideTimer) clearTimeout(btnHideTimer)
    btnHideTimer = setTimeout(function () {
      btnHideTimer = null
      if (!state.menuOpen) { btn.classList.remove('dshvk1-btn-on'); btnOnSolid = false }
    }, BTN_GRACE_MS)
  }
  function menuRow(text, onClick) {
    var b = document.createElement('button')
    b.type = 'button'
    b.className = 'dshvk1-menu-row'
    b.textContent = text
    b.addEventListener('click', function (e) { e.stopPropagation(); closeMenu(); onClick() })
    menu.appendChild(b)
  }
  function buildMenu() {
    menu.textContent = ''
    menuRow('立即刷新余额', function () { poll(true) })
    menuRow('演示', function () { showSettings('demo') })
    menuRow('设置', function () { showSettings('display') })
    menuRow('显示峰谷时钟', function () { state.peakMode = !state.peakMode; state.peakHold = 5; updateTablet() })

  }
  function openMenu(clientX, clientY) {
    buildMenu()
    state.menuOpen = true
    menu.classList.add('dshvk1-menu-open')
    keepBtn()
    var mw = menu.offsetWidth || 220
    var mh = menu.offsetHeight || 300
    var vp = viewport()
    menu.style.left = clamp(clientX, 4, Math.max(4, vp.w - mw - 4)) + 'px'
    menu.style.top = clamp(clientY, 4, Math.max(4, vp.h - mh - 4)) + 'px'
  }
  function closeMenu() {
    state.menuOpen = false
    menu.classList.remove('dshvk1-menu-open')
    releaseBtn()
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation()
    if (state.menuOpen) { closeMenu(); return }
    var r = root.getBoundingClientRect()
    openMenu(r.right, r.bottom)
  })
  btn.addEventListener('pointerenter', function () { btnOnSolid = true; keepBtn() })
  btn.addEventListener('pointerleave', function () { if (!state.menuOpen) { btnOnSolid = false; releaseBtn() } })
  function onDocMenuClose(e) {
    if (!state.menuOpen) return
    if (e.target && e.target.closest && (e.target.closest('.dshvk1-menu') || e.target.closest('.dshvk1-btn') || e.target.closest('.dshvk1-dialog'))) return
    closeMenu()
  }
  document.addEventListener('pointerdown', onDocMenuClose, true)

  // ------------------------------------------------------------ size & gap ---
  function setSize(v) {
    state.size = clamp(Math.round(v) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE)
    try { localStorage.setItem(SIZE_KEY, String(state.size)) } catch (err) {}
    riceSizeCache = null
    for (var i = 0; i < state.bowls.length; i++) {
      var b = state.bowls[i]
      var s = b.iron ? (b.onHead ? ironWornSize() : ironLooseSize()) : riceDims()
      b.artW = s.w; b.artH = s.h; b.R = s.w * 0.42
      b.el.style.width = s.w + 'px'
      b.el.style.height = s.h + 'px'
    }
    layout()
    settle()
    saveAnchor()
  }
  function saveGap() {
    try { localStorage.setItem(GAP_KEY, JSON.stringify({ on: state.scrollGapOn, px: state.scrollGapPx })) } catch (err) {}
  }
  function setScrollGapOn(on) { state.scrollGapOn = !!on; saveGap(); settle(); saveAnchor() }
  function setScrollGapPx(v) {
    if (!state.scrollGapOn) return
    state.scrollGapPx = Math.max(0, Math.round(Number(v) || 0))
    saveGap(); settle(); saveAnchor()
  }
  function saveSound() {
    try { localStorage.setItem(SOUND_KEY, JSON.stringify({ on: state.soundOn, vol: state.volume })) } catch (err) {}
  }

  // Modernized upstream 571da3b (2026-10-15): hover strokes, usage and tablet clock.
  var pat = { active: false, t: 0, distance: 0, moveTime: 0, idle: 0, blocked: 0, pointer: null, previous: null, waiting: false }
  var hands = []
  for (var hi = 0; hi < 5; hi++) {
    var hand = document.createElement('img')
    hand.src = BASE + '/pat_hand_' + hi + '.png'
    hand.alt = ''
    hand.draggable = false
    hand.style.cssText = 'position:absolute;pointer-events:none;display:none;transform-origin:0 0'
    root.appendChild(hand)
    hands.push(hand)
  }
  function blockPat() {
    pat.active = false; pat.waiting = false; pat.t = 0
    pat.distance = 0; pat.moveTime = 0; pat.blocked = 1.16
    hands.forEach(function (h) { h.style.display = 'none' })
  }
  function pointerLeft() { pat.pointer = null }
  document.addEventListener('pointerleave', pointerLeft)
  window.addEventListener('blur', pointerLeft)
  function updatePat(dt) {
    var p = pat.pointer
    var onHer = p && charHitAt(p.x, p.y)
    var can = onHer && !p.buttons && !state.menuOpen && !settings.open && !state.dragWidget && !state.grab && state.fxPat
    var distance = p && pat.previous ? Math.hypot(p.x - pat.previous.x, p.y - pat.previous.y) : 0
    if (distance > 120) distance = 0
    pat.previous = p ? { x: p.x, y: p.y } : null
    if (state.dragWidget || state.grab || (p && p.buttons)) pat.blocked = 1.16
    else pat.blocked = Math.max(0, pat.blocked - dt)
    if (!can || pat.blocked > 0) {
      pat.distance = 0; pat.moveTime = 0
      if (!state.fxPat || pat.blocked > 0 || state.menuOpen || settings.open) pat.active = false
    }
    if (pat.waiting) {
      if (!can) pat.waiting = false
      else if (!state.bowls.some(function (b) { return b.onHead })) { pat.waiting = false; pat.active = true; pat.t = 0 }
      else if (!state.bowls.some(function (b) { return b.onHead && b.fadeT > 0 })) knockPotOff()
    }
    if (can && pat.blocked <= 0 && distance > 0) {
      pat.idle = 0
      pat.distance = Math.min(96, pat.distance + distance)
      if (pat.distance >= 24) pat.moveTime += dt
      if (!pat.active && !pat.waiting && pat.moveTime >= 0.5) {
        if (state.bowls.some(function (b) { return b.onHead })) { knockPotOff(); pat.waiting = true }
        else { pat.active = true; pat.t = 0 }
      }
    } else {
      pat.idle += dt
      if (!pat.active && pat.idle >= 0.15) { pat.distance = 0; pat.moveTime = 0 }
      if (pat.idle >= 0.15) { pat.active = false; pat.distance = 0; pat.moveTime = 0 }
    }
    if (pat.active) pat.t += dt
    var frameIndex = Math.floor(pat.t / 0.04) % 5
    hands.forEach(function (h, i) {
      h.style.display = pat.active && i === frameIndex ? 'block' : 'none'
    })
    if (!pat.active) return
    // Same measured palm anchors as PatGeometry; reflect the whole rectangle on the right.
    var k = state.size / 454
    var w = 446 * k, h = 392 * k
    var palmX = [0.319, 0.356, 0.318, 0.425, 0.298][frameIndex] + 0.393
    var palmY = [0.511, 0.720, 0.835, 0.744, 0.608][frameIndex] - 0.206
    var x = state.size * 0.67 - palmX * w
    if (mirrored()) x = state.size - x - w
    var y = 40 * (446 / 107) * k - palmY * h
    hands[frameIndex].style.width = w + 'px'
    hands[frameIndex].style.height = h + 'px'
    hands[frameIndex].style.left = x + 'px'
    hands[frameIndex].style.top = y + 'px'
    hands[frameIndex].style.transform = mirrored() ? 'scaleX(-1) translateX(-100%)' : ''
  }

  var clockEl = document.createElement('div')
  clockEl.style.cssText = 'position:absolute;inset:5% 0;display:none;flex-direction:column;justify-content:space-evenly;align-items:center;color:#ecf2fc;font-weight:bold;white-space:nowrap;font-size:calc(var(--dshvk1-ph) * .19)'
  var clockLines = [document.createElement('div'), document.createElement('div'), document.createElement('div')]
  clockLines.forEach(function (line) { clockEl.appendChild(line) })
  panel.appendChild(clockEl)
  function usageDay() {
    var d = new Date()
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
  }
  function saveUsage() { try { localStorage.setItem(USAGE_KEY, JSON.stringify(state.usage)) } catch (e) {} }
  function noteUsage(balance) {
    var u = state.usage
    if (!u || u.day !== usageDay() || !isFinite(u.base)) u = { day: usageDay(), base: balance, topup: 0, last: balance, used: 0 }
    else {
      if (balance > u.last) u.topup = round4(u.topup + balance - u.last)
      u.used = Math.max(0, round4(u.base + u.topup - balance))
      u.last = balance
    }
    state.usage = u
    saveUsage()
  }
  function onTablet(x, y) {
    var q = quad().P
    var lx = x - state.left, ly = y - state.top
    if (mirrored()) lx = state.size - lx
    var ax = q[1].x - q[0].x, ay = q[1].y - q[0].y
    var bx = q[3].x - q[0].x, by = q[3].y - q[0].y
    var det = ax * by - ay * bx
    var u = ((lx - q[0].x) * by - (ly - q[0].y) * bx) / det
    var v = (ax * (ly - q[0].y) - ay * (lx - q[0].x)) / det
    return u >= 0 && u <= 1 && v >= 0 && v <= 1
  }
  function updateTablet() {
    if (!clockEl) return
    labelEl.style.display = state.peakMode ? 'none' : ''
    amountEl.style.display = state.peakMode ? 'none' : ''
    clockEl.style.display = state.peakMode ? 'flex' : 'none'
    if (!state.peakMode) return
    var bj = new Date(Date.now() + state.cloudOffset + 8 * 3600000)
    var seconds = bj.getUTCHours() * 3600 + bj.getUTCMinutes() * 60 + bj.getUTCSeconds()
    var off = seconds >= 1800 && seconds < 30600
    var target = off ? 30600 : (seconds < 1800 ? 1800 : 88200)
    function pad(n) { return String(n).padStart(2, '0') }
    var left = target - seconds
    clockLines[0].textContent = pad(bj.getUTCHours()) + ':' + pad(bj.getUTCMinutes()) + ':' + pad(bj.getUTCSeconds())
    clockLines[1].textContent = off ? '梁文谷' : '梁文峰'
    clockLines[1].style.color = off ? '#96e2aa' : '#f0be78'
    clockLines[2].textContent = (off ? '距峰时 ' : '距谷时 ') + Math.floor(left / 3600) + ':' + pad(Math.floor(left / 60) % 60) + ':' + pad(left % 60)
    panel.title = '北京时间；沿用上游 00:30–08:30 谷时规则，不含节假日调整'
  }
  function tickTablet(dt) {
    if (!state.peakMode) return
    var p = pat.pointer
    if (p && charHitAt(p.x, p.y)) state.peakHold = 5
    else if (chargingBusy()) state.peakHold = 1
    else state.peakHold -= dt
    if (state.peakHold <= 0) state.peakMode = false
    updateTablet()
  }
  function saveOptions() {
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify({ fxBowl: state.fxBowl, fxPat: state.fxPat, fxHurt: state.fxHurt, theme: state.theme, cueVolumes: state.cueVolumes })) } catch (e) {}
  }

  // Four-page settings surface. All placement follows grid/flex layout, including narrow viewports.
  styleEl.textContent += '\n' + [
    '.dshvk1-dialog{--vk-bg:#fff;--vk-ink:#203052;--vk-muted:#65718b;--vk-border:#d9deea;--vk-card:#f2f5fa;--vk-accent:#3c5ddb;background:var(--vk-bg);color:var(--vk-ink);border:1px solid var(--vk-border);border-radius:16px;padding:0;width:min(650px,calc(100vw - 24px));max-height:calc(100dvh - 24px);box-sizing:border-box;box-shadow:0 18px 70px #0005;font:14px/1.5 system-ui,sans-serif}',
    '.dshvk1-dialog::backdrop{background:#0005}',
    '.dshvk1-dialog[data-theme=dark]{--vk-bg:#171e2d;--vk-ink:#edf2ff;--vk-muted:#a3b0ca;--vk-border:#3b4861;--vk-card:#232e43;--vk-accent:#9eb7ff;color-scheme:dark}',
    '@media(prefers-color-scheme:dark){.dshvk1-dialog[data-theme=auto]{--vk-bg:#171e2d;--vk-ink:#edf2ff;--vk-muted:#a3b0ca;--vk-border:#3b4861;--vk-card:#232e43;--vk-accent:#9eb7ff;color-scheme:dark}}',
    '.dshvk1-dialog header{position:sticky;top:0;z-index:2;background:var(--vk-bg);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--vk-border)}',
    '.dshvk1-dialog h2{margin:0;font-size:18px}.dshvk1-dialog h3{margin:12px 0 8px;font-size:14px}',
    '.dshvk1-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:12px 20px;border-bottom:1px solid var(--vk-border)}',
    '.dshvk1-dialog button,.dshvk1-dialog select,.dshvk1-dialog input{font:inherit;color:inherit;box-sizing:border-box}',
    '.dshvk1-dialog button,.dshvk1-dialog select{background:var(--vk-card);border:1px solid var(--vk-border);border-radius:8px;padding:7px 11px;cursor:pointer}',
    '.dshvk1-dialog button[aria-selected=true]{color:var(--vk-accent);border-color:var(--vk-accent);font-weight:700}',
    '.dshvk1-dialog button:focus-visible,.dshvk1-dialog input:focus-visible,.dshvk1-dialog select:focus-visible{outline:2px solid var(--vk-accent);outline-offset:2px}',
    '.dshvk1-dialog button:disabled{opacity:.5;cursor:default}.dshvk1-content{padding:4px 20px 20px;overflow-wrap:anywhere}',
    '.dshvk1-setting{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--vk-border)}',
    '.dshvk1-setting label{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dshvk1-setting input[type=number]{width:90px;padding:5px;background:var(--vk-card);border:1px solid var(--vk-border);border-radius:6px}',
    '.dshvk1-actions{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.dshvk1-hint{color:var(--vk-muted);font-size:12px}.dshvk1-status{min-height:1.5em;margin:8px 0;color:var(--vk-accent)}',
    '.dshvk1-clip{border:1px solid var(--vk-border);border-radius:10px;padding:12px;margin:10px 0}.dshvk1-dialog input[type=text]{max-width:100%;width:100%;padding:6px;background:var(--vk-card);border:1px solid var(--vk-border);border-radius:6px}',
    '.dshvk1-wave{display:block;width:100%;height:84px;background:var(--vk-card);border-radius:6px;margin:8px 0}',
    '@media(max-width:420px){.dshvk1-dialog header,.dshvk1-tabs{padding:12px}.dshvk1-content{padding:4px 12px 12px}.dshvk1-setting{align-items:flex-start}.dshvk1-dialog input[type=range]{max-width:145px}}'
  ].join('\n')
  var settings = document.createElement('dialog')
  settings.className = 'dshvk1-dialog'
  settings.setAttribute('aria-labelledby', 'dshvk1-settings-title')
  var settingsHeader = document.createElement('header')
  var settingsTitle = document.createElement('h2')
  settingsTitle.id = 'dshvk1-settings-title'
  settingsTitle.textContent = 'VK-1 设置'
  settingsHeader.appendChild(settingsTitle)
  var closeSettings = document.createElement('button')
  closeSettings.textContent = '关闭'
  closeSettings.addEventListener('click', function () { settings.close(); stopPreview() })
  settingsHeader.appendChild(closeSettings)
  settings.appendChild(settingsHeader)
  var tabs = document.createElement('nav')
  tabs.className = 'dshvk1-tabs'
  tabs.setAttribute('aria-label', '设置分类')
  settings.appendChild(tabs)
  var content = document.createElement('div')
  content.className = 'dshvk1-content'
  settings.appendChild(content)
  document.body.appendChild(settings)
  var settingsPage = 'display'
  var libraryCue = 0
  var renderGeneration = 0
  function element(tag, text, parent, className) {
    var el = document.createElement(tag)
    if (text != null) el.textContent = text
    if (className) el.className = className
    if (parent) parent.appendChild(el)
    return el
  }
  function action(parent, text, fn) {
    var b = element('button', text, parent)
    b.type = 'button'; b.addEventListener('click', fn)
    return b
  }
  function hint(text, parent) { return element('p', text, parent || content, 'dshvk1-hint') }
  function toggle(text, checked, fn) {
    var row = element('div', null, content, 'dshvk1-setting')
    var label = element('label', text, row)
    var input = element('input', null, label)
    input.type = 'checkbox'; input.checked = checked
    input.addEventListener('change', function () { fn(input.checked) })
  }
  function numeric(parent, text, value, min, max, step, fn, type) {
    var label = element('label', text, parent)
    var input = element('input', null, label)
    input.type = type || 'number'; input.min = min; input.max = max; input.step = step; input.value = value
    var output = type === 'range' ? element('span', value + '%', label) : null
    input.addEventListener('input', function () {
      if (input.value === '' || !input.validity.valid) return
      var v = Number(input.value)
      if (!isFinite(v) || v < min || v > max) return
      if (output) output.textContent = v + '%'
      fn(v)
    })
    return input
  }
  function onEscape(e) {
    if (e.key === 'Escape') { closeMenu(); if (settings.open) { settings.close(); stopPreview(); e.stopPropagation() } }
  }
  document.addEventListener('keydown', onEscape, true)
  settings.addEventListener('cancel', stopPreview)
  settings.addEventListener('close', stopPreview)
  function showSettings(page) {
    blockPat(); closeMenu()
    settingsPage = page || 'display'
    renderSettings()
    if (!settings.open) settings.showModal()
  }
  function renderSettings() {
    renderGeneration++
    settings.dataset.theme = state.theme
    tabs.textContent = ''; content.textContent = ''
    ;[['display', '显示'], ['sound', '声音'], ['library', '音效库'], ['demo', '演示']].forEach(function (tab) {
      var b = action(tabs, tab[1], function () { stopPreview(); settingsPage = tab[0]; renderSettings() })
      b.setAttribute('aria-selected', String(settingsPage === tab[0]))
    })
    if (settingsPage === 'display') {
      element('h3', '功能选择', content)
      ;[['fxBowl', '充值后掉落饭盆，手动拖取'], ['fxPat', '鼠标抚摸了会开心'], ['fxHurt', '扣费时播放音效与动画']].forEach(function (item) {
        toggle(item[1], state[item[0]], function (v) { state[item[0]] = v; saveOptions(); if (!v && item[0] === 'fxPat') blockPat() })
      })
      hint('关闭掉盆后，新充值直接入账；关闭扣费效果仍会结算余额。演示同样遵守开关。')
      element('h3', '外观与尺寸', content)
      var themes = element('div', null, content, 'dshvk1-actions')
      ;[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].forEach(function (t) {
        var b = action(themes, t[1], function () { state.theme = t[0]; saveOptions(); renderSettings() })
        b.setAttribute('aria-selected', String(state.theme === t[0]))
      })
      var sizes = element('div', null, content, 'dshvk1-actions')
      SIZES.forEach(function (s) { action(sizes, s + 'px', function () { setSize(s); renderSettings() }) })
      numeric(element('div', null, content, 'dshvk1-setting'), '自定义尺寸（px）', state.size, MIN_SIZE, MAX_SIZE, 1, setSize)
      toggle('避让滚动条', state.scrollGapOn, setScrollGapOn)
      numeric(element('div', null, content, 'dshvk1-setting'), '避让宽度（px）', state.scrollGapPx, 0, 100, 1, setScrollGapPx)
      element('h3', '今日消费', content)
      var used = state.usage && state.usage.day === usageDay() ? state.usage.used : 0
      hint('今日已用 ¥' + fmt2(used) + '。根据观察到的余额变化估算，充值和演示不计入消费；可用平台今日消费校准。')
      numeric(element('div', null, content, 'dshvk1-setting'), '校准今日已用（元）', used, 0, 1000000, 0.0001, function (v) {
        if (!isFinite(state.real)) return
        state.usage = { day: usageDay(), base: round4(state.real + v), topup: 0, last: state.real, used: v }
        saveUsage()
      }).disabled = !isFinite(state.real)
      action(content, '显示峰谷时钟', function () { state.peakMode = true; state.peakHold = 5; updateTablet(); settings.close() })
      hint('也可双击平板切换。离开角色 5 秒恢复余额；沿用上游北京时间 00:30–08:30 谷时规则，不含节假日调整。')
    } else if (settingsPage === 'sound') {
      toggle('开启声音', state.soundOn, function (on) { state.soundOn = on; saveSound(); if (!on) stopPlaying() })
      numeric(element('div', null, content, 'dshvk1-setting'), '总音量', state.volume, 0, 100, 1, function (v) { state.volume = v; saveSound() }, 'range')
      CUE_NAMES.forEach(function (name, i) {
        numeric(element('div', null, content, 'dshvk1-setting'), name, state.cueVolumes[i], 0, 100, 1, function (v) { state.cueVolumes[i] = v; saveOptions() }, 'range')
        action(content, '试听' + name, function () { playPool(cuePools[i]) })
      })
      hint('总音量与分项音量相乘；调至 0% 可单独静音该音效。')
    } else if (settingsPage === 'demo') {
      hint('仅本地演示，不发起实际扣费或充值，也不计入今日消费。刷新余额可清除演示数字与未领取的饭盆。')
      var demoActions = element('div', null, content, 'dshvk1-actions')
      action(demoActions, '单次扣费', function () { makeTick(STEP, true); updateScreen() })
      action(demoActions, '十次扣费', function () { state.demoAmount = STEP; state.demoLeft = 10 })
      var count = 10, amount = 3
      numeric(element('div', null, content, 'dshvk1-setting'), '自定义扣费次数', count, 1, 10000, 1, function (v) { count = v })
      action(content, '演示自定义扣费', function () { state.demoAmount = STEP; state.demoLeft = count })
      numeric(element('div', null, content, 'dshvk1-setting'), '自定义充值金额（元）', amount, 0.01, 1000000, 0.01, function (v) { amount = v })
      action(content, '模拟充值 3 元', function () { startCredit(3, true); settings.close() })
      action(content, '演示自定义充值', function () { startCredit(amount, true); settings.close() })
      action(content, '打开火控雷达', function () { state.radarManual = true; settings.close() })
    } else renderLibrary()
  }

  var CUE_NAMES = ['掉血音效', '回血音效', '铁盆落头音效', '双击取盆音效']
  var DEFAULT_SOUNDS = [HIT_SOUND, FEED_SOUND, BASE + '/pot_land.mp3', BASE + '/pot_off.mp3']
  var soundDb = null, audioContext = null, previewAudio = null, previewUrl = null
  var clips = [], activeClips = {}, libraryStatus = ''
  function stopPool(pool) {
    pool.pool.forEach(function (a) { clearTimeout(a.trimTimer); a.pause(); a.removeAttribute('src'); a.load() })
    if (pool.url) URL.revokeObjectURL(pool.url)
  }
  function stopPlaying() {
    cuePools.forEach(function (p) { p.pool.forEach(function (a) { clearTimeout(a.trimTimer); a.pause() }) })
    stopPreview()
  }
  function stopPreview() {
    if (previewAudio) { previewAudio.pause(); previewAudio.removeAttribute('src'); previewAudio.load(); previewAudio = null }
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null }
  }
  function stopAudio() {
    stopPreview(); cuePools.forEach(stopPool)
    if (audioContext) audioContext.close().catch(function () {})
  }
  function activateClip(cue, id, persist) {
    var clip = clips.find(function (c) { return c.id === id && c.cue === cue })
    stopPool(cuePools[cue])
    var url = clip ? URL.createObjectURL(clip.rendered) : DEFAULT_SOUNDS[cue]
    var p = makePool(url, cue === 0 ? 4 : 2)
    p.cue = cue; if (clip) p.url = url
    cuePools[cue] = p
    hitPool = cuePools[0]; feedPool = cuePools[1]; landPool = cuePools[2]; offPool = cuePools[3]
    activeClips[cue] = clip ? clip.id : ''
    if (persist) try { localStorage.setItem('dsh-vk1-active-clips', JSON.stringify(activeClips)) } catch (e) {}
  }
  function dbChange(mode, value) {
    return new Promise(function (resolve, reject) {
      if (!soundDb) return reject(new Error('浏览器音效存储不可用'))
      var tx = soundDb.transaction('clips', 'readwrite')
      var store = tx.objectStore('clips')
      if (mode === 'put') store.put(value)
      else store.delete(value)
      tx.oncomplete = resolve; tx.onerror = function () { reject(tx.error || new Error('音效保存失败')) }
      tx.onabort = function () { reject(tx.error || new Error('音效保存中止')) }
    })
  }
  function initSoundLibrary() {
    try {
      activeClips = JSON.parse(localStorage.getItem('dsh-vk1-active-clips') || '{}') || {}
      var request = indexedDB.open('dsh-vk1-sounds', 1)
      request.onupgradeneeded = function () { request.result.createObjectStore('clips', { keyPath: 'id' }) }
      request.onerror = function () { libraryStatus = '浏览器音效存储不可用，仍可使用出厂音效。' }
      request.onsuccess = function () {
        if (stopped) { request.result.close(); return }
        soundDb = request.result
        soundDb.onversionchange = function () { soundDb.close(); soundDb = null }
        var get = soundDb.transaction('clips', 'readonly').objectStore('clips').getAll()
        get.onsuccess = function () {
          if (stopped) return
          clips = get.result
          CUE_NAMES.forEach(function (_, i) { activateClip(i, activeClips[i], false) })
          if (settings.open && settingsPage === 'library') renderSettings()
        }
      }
    } catch (e) { libraryStatus = '浏览器音效存储不可用，仍可使用出厂音效。' }
  }
  async function decodeSound(blob) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)()
    return audioContext.decodeAudioData(await blob.arrayBuffer())
  }
  function wavBlob(buffer, start, end, gain) {
    var first = Math.floor(start * buffer.sampleRate)
    var lastFrame = Math.min(buffer.length, Math.floor(end * buffer.sampleRate))
    var count = lastFrame - first, channels = Math.min(2, buffer.numberOfChannels)
    if (count <= 0) throw new Error('终点必须大于起点')
    var data = new ArrayBuffer(44 + count * channels * 2), view = new DataView(data)
    function chars(offset, s) { for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)) }
    chars(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true); chars(8, 'WAVEfmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true)
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true)
    view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); chars(36, 'data')
    view.setUint32(40, count * channels * 2, true)
    for (var c = 0; c < channels; c++) {
      var samples = buffer.getChannelData(c)
      for (var f = 0; f < count; f++) {
        var sample = clamp(samples[first + f] * gain / 100, -1, 1)
        view.setInt16(44 + (f * channels + c) * 2, sample * (sample < 0 ? 32768 : 32767), true)
      }
    }
    return new Blob([data], { type: 'audio/wav' })
  }
  function renderLibrary() {
    hint('音频只保存在本浏览器，不上传服务器。支持浏览器能解码的 MP3 / WAV / M4A / AAC / FLAC / OGG 等，单文件最大 50 MB。')
    var select = element('select', null, content)
    select.setAttribute('aria-label', '选择音效类别')
    CUE_NAMES.forEach(function (name, i) { var o = element('option', name, select); o.value = i })
    select.value = libraryCue
    select.addEventListener('change', function () { libraryCue = Number(select.value); renderSettings() })
    var actions = element('div', null, content, 'dshvk1-actions')
    action(actions, '恢复出厂音效', function () { activateClip(libraryCue, '', true); renderSettings() })
    action(actions, '试听当前音效', function () { playPool(cuePools[libraryCue]) })
    var status = element('p', libraryStatus, content, 'dshvk1-status'); status.setAttribute('role', 'status')
    var file = element('input', null, content)
    file.type = 'file'; file.accept = '.mp3,.wav,.m4a,.wma,.aac,.flac,.ogg,audio/*'
    file.setAttribute('aria-label', '导入本地音效')
    file.disabled = !soundDb
    file.addEventListener('change', async function () {
      var selected = file.files[0], cue = libraryCue, generation = renderGeneration
      if (!selected) return
      if (selected.size > 50 * 1024 * 1024) { status.textContent = '文件过大，最大 50 MB。'; return }
      file.disabled = true; status.textContent = '正在解码音频…'
      try {
        var buffer = await decodeSound(selected)
        if (stopped || generation !== renderGeneration || !settings.open) return
        if (!isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('音频为空')
        editClip({ id: crypto.randomUUID(), cue: cue, name: selected.name.replace(/\.[^.]+$/, '').slice(0, 80), source: selected, start: 0, end: buffer.duration, gain: 100 }, buffer)
      } catch (e) { if (!stopped && generation === renderGeneration) { status.textContent = '无法读取音频：' + e.message; file.disabled = !soundDb } }
    })
    hint('当前：' + ((clips.find(function (c) { return c.id === activeClips[libraryCue] }) || {}).name || '出厂音效'))
    clips.filter(function (c) { return c.cue === libraryCue }).forEach(function (clip) {
      var row = element('div', null, content, 'dshvk1-clip')
      element('strong', clip.name + (activeClips[libraryCue] === clip.id ? ' · 使用中' : ''), row)
      var buttons = element('div', null, row, 'dshvk1-actions')
      action(buttons, '使用', function () { activateClip(clip.cue, clip.id, true); renderSettings() })
      action(buttons, '修改', async function () {
        var generation = renderGeneration
        try { var buffer = await decodeSound(clip.source); if (!stopped && generation === renderGeneration && settings.open) editClip(Object.assign({}, clip), buffer) }
        catch (e) { if (!stopped) status.textContent = '无法读取音频：' + e.message }
      })
      action(buttons, '删除', async function () {
        try {
          await dbChange('delete', clip.id)
          if (stopped) return
          clips = clips.filter(function (c) { return c.id !== clip.id })
          if (activeClips[clip.cue] === clip.id) activateClip(clip.cue, '', true)
          renderSettings()
        } catch (e) { status.textContent = '删除失败：' + e.message }
      })
    })
  }
  function editClip(clip, buffer) {
    content.textContent = ''; renderGeneration++
    element('h3', '剪辑音效 · ' + CUE_NAMES[clip.cue], content)
    var nameLabel = element('label', '音效名称', content)
    var name = element('input', null, nameLabel); name.type = 'text'; name.maxLength = 80; name.value = clip.name
    var canvas = element('canvas', null, content, 'dshvk1-wave'); canvas.width = 560; canvas.height = 100
    canvas.setAttribute('aria-label', '音频波形及裁剪范围')
    function drawWave() {
      var ctx = canvas.getContext('2d'), samples = buffer.getChannelData(0)
      ctx.clearRect(0, 0, 560, 100); ctx.fillStyle = '#7a8fd1'
      for (var x = 0; x < 560; x++) {
        var first = Math.floor(x * samples.length / 560), last = Math.floor((x + 1) * samples.length / 560), peak = 0
        for (var i = first; i < last; i++) peak = Math.max(peak, Math.abs(samples[i]))
        ctx.fillRect(x, 50 - peak * 46, 1, Math.max(1, peak * 92))
      }
      ctx.fillStyle = '#355ce833'
      ctx.fillRect(560 * clip.start / buffer.duration, 0, 560 * (clip.end - clip.start) / buffer.duration, 100)
    }
    var fields = element('div', null, content, 'dshvk1-setting')
    numeric(fields, '起点（秒）', clip.start, 0, buffer.duration, 0.001, function (v) { clip.start = v; drawWave() })
    numeric(fields, '终点（秒）', clip.end, 0, buffer.duration, 0.001, function (v) { clip.end = v; drawWave() })
    numeric(element('div', null, content, 'dshvk1-setting'), '音量增益', clip.gain, 0, 200, 1, function (v) { clip.gain = v }, 'range')
    var status = element('p', '', content, 'dshvk1-status'); status.setAttribute('role', 'status')
    var buttons = element('div', null, content, 'dshvk1-actions')
    action(buttons, '试听剪辑', function () {
      try { stopPreview(); previewUrl = URL.createObjectURL(wavBlob(buffer, clip.start, clip.end, clip.gain)); previewAudio = new Audio(previewUrl); previewAudio.volume = state.soundOn ? state.volume / 100 * state.cueVolumes[clip.cue] / 100 : 0; previewAudio.play().catch(function () { status.textContent = '浏览器暂时阻止了播放，请再次点击试听。' }) }
      catch (e) { status.textContent = e.message }
    })
    var save = action(buttons, '保存并使用', async function () {
      try {
        save.disabled = true
        clip.name = name.value.trim() || '自定义音效'
        clip.rendered = wavBlob(buffer, clip.start, clip.end, clip.gain)
        await dbChange('put', clip)
        if (stopped) return
        clips = clips.filter(function (c) { return c.id !== clip.id }); clips.push(clip)
        activateClip(clip.cue, clip.id, true); stopPreview(); renderSettings()
      } catch (e) { status.textContent = '保存失败：' + e.message; save.disabled = false }
    })
    action(buttons, '取消', function () { stopPreview(); renderSettings() })
    drawWave()
  }

  // ----------------------------------------------------------------- start ---
  try {
    var savedSize = parseInt(localStorage.getItem(SIZE_KEY) || '', 10)
    if (isFinite(savedSize) && savedSize >= MIN_SIZE && savedSize <= MAX_SIZE) state.size = savedSize
    var g = JSON.parse(localStorage.getItem(GAP_KEY) || 'null')
    if (g) { state.scrollGapOn = !!g.on; state.scrollGapPx = typeof g.px === 'number' && g.px > 0 ? Math.round(g.px) : 0 }
    var s = JSON.parse(localStorage.getItem(SOUND_KEY) || 'null')
    if (s) {
      state.soundOn = s.on !== false
      state.volume = typeof s.vol === 'number' && s.vol >= 0 && s.vol <= 100 ? s.vol : 80
    }
    var options = JSON.parse(localStorage.getItem(OPTIONS_KEY) || 'null')
    if (options) {
      ;['fxBowl', 'fxPat', 'fxHurt'].forEach(function (key) { state[key] = options[key] !== false })
      if (['auto', 'light', 'dark'].indexOf(options.theme) >= 0) state.theme = options.theme
      if (Array.isArray(options.cueVolumes) && options.cueVolumes.length === 4) state.cueVolumes = options.cueVolumes.map(function (n) { return isFinite(n) ? clamp(Number(n), 0, 100) : 100 })
    }
    var usage = JSON.parse(localStorage.getItem(USAGE_KEY) || 'null')
    if (usage && usage.day === usageDay() && [usage.base, usage.topup, usage.last, usage.used].every(function (n) { return typeof n === 'number' && isFinite(n) })) state.usage = usage
  } catch (err) {}

  layout()
  if (!applyAnchorPos()) { state.h = 'right'; state.v = 'bottom'; state.hOff = 0; state.vOff = 0; settle() }
  updateScreen()
  setupHitTest()
  initSoundLibrary()

  rafId = requestAnimationFrame(frame)
  poll(false)
  var pollTimer = setInterval(function () { poll(false) }, POLL_MS)

  // ------------------------------------------------- live mount/unmount hook ---
  // The appearance manager mounts this script when the bundle is enabled and asks
  // it to tear itself down (then removes the tag) when it is disabled — that is
  // what makes 切换外观 take effect without a page refresh.
  function detach(el) {
    try { if (el && el.parentNode) el.parentNode.removeChild(el) } catch (err) {}
  }
  function stop() {
    stopped = true
    try { cancelAnimationFrame(rafId) } catch (err) {}
    try { clearInterval(pollTimer) } catch (err) {}
    if (btnHideTimer) { clearTimeout(btnHideTimer); btnHideTimer = null }
    document.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('pointermove', onCursor, true)
    document.removeEventListener('contextmenu', onContextMenu, true)
    document.removeEventListener('pointerdown', onDocMenuClose, true)
    document.removeEventListener('pointerleave', pointerLeft)
    document.removeEventListener('keydown', onEscape, true)
    window.removeEventListener('blur', pointerLeft)
    window.removeEventListener('error', onWidgetError)
    removeDragListeners()
    window.removeEventListener('resize', onResize)
    try { if (document.body) document.body.style.cursor = '' } catch (err) {}
    detach(styleEl)
    detach(stage)
    detach(root)
    detach(menu)
    detach(settings)
    stopAudio()
    if (soundDb) soundDb.close()
    window.__dshVk1Widget = false
  }
  window.__dshAppearanceWidgets = window.__dshAppearanceWidgets || {}
  window.__dshAppearanceWidgets['dsh-vk1-balance-widget'] = { stop: stop }
})()
