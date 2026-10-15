import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

// Run the shipped widget in an isolated DOM adapter with deterministic time/input.
// No credentials, live requests or production test hooks are involved.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.style = { setProperty() {} }
    this.dataset = {}; this.classList = { add() {}, remove() {}, toggle() {} }
    this.width = 610; this.height = 610; this.validity = { valid: true }; this.open = false
  }
  appendChild(el) { this.children.push(el); el.parentNode = this; return el }
  removeChild(el) { this.children = this.children.filter(x => x !== el); el.parentNode = null }
  setAttribute(key, value) { this[key] = value }
  getAttribute(key) { return this[key] }
  removeAttribute(key) { delete this[key] }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800 } }
  getContext() { return { drawImage() {}, clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, getImageData() { return { data: new Uint8ClampedArray([0, 0, 0, 255]) } } } }
  toDataURL() { return 'data:image/png;base64,' }
  showModal() { this.open = true }
  close() { this.open = false }
}
const source = fs.readFileSync(new URL('../dsh-plugin/widget.js', import.meta.url), 'utf8')
function fixture(saved = {}) {
  const storage = new Map(Object.entries(saved))
  const documentEvents = new Map(), windowEvents = new Map()
  const add = (map, key, fn) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(fn) }
  const remove = (map, key, fn) => map.get(key)?.delete(fn)
  const document = {
    head: new Element(), body: new Element(), documentElement: { clientWidth: 1200, clientHeight: 800 },
    createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag),
    addEventListener: (key, fn) => add(documentEvents, key, fn), removeEventListener: (key, fn) => remove(documentEvents, key, fn), getElementById() { return null }, currentScript: { src: 'http://localhost/dsh-vk1/widget.js' },
  }
  class Audio extends Element { constructor() { super('audio') } play() { return Promise.resolve() } pause() {} load() {} }
  const context = vm.createContext({
    document, Audio, Image: Element, console, Blob, URL, crypto: { randomUUID: () => 'test-clip' },
    innerWidth: 1200, innerHeight: 800, addEventListener: (key, fn) => add(windowEvents, key, fn), removeEventListener: (key, fn) => remove(windowEvents, key, fn),
    requestAnimationFrame() { return 1 }, cancelAnimationFrame() {}, setInterval() { return 1 }, clearInterval() {},
    setTimeout() { return 1 }, clearTimeout() {}, fetch() { return new Promise(() => {}) },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
  })
  context.window = context
  const hook = `window.test = { state, pat, settings, hands, applyBalance, startCredit, onRiceFed, newBowl, dropIronPot, attachIronPot, ironHeadAnchor, ironStackIndex, ironOnHead, knockPotOff, updateBowls, updatePat, blockPat, tickTablet, updateTablet, onTablet, frame, makeTick, noteUsage, saveOptions, showSettings, wavBlob, stop, ready() { hitReady = true } };`
  vm.runInContext(source.replace('  window.__dshAppearanceWidgets = window.__dshAppearanceWidgets || {}', hook + '\n  window.__dshAppearanceWidgets = window.__dshAppearanceWidgets || {}'), context)
  return { ...context.test, storage, documentEvents, windowEvents }
}

{
  const t = fixture(); t.applyBalance(10, false); t.applyBalance(9.95, false)
  for (let ms = 1; ms < 2000; ms += 50) t.frame(ms)
  assert.ok(Math.abs(t.state.bookedBal - 9.95) < 1e-8, 'deductions must settle exactly')
  assert.ok(Math.abs(t.state.usage.used - 0.05) < 1e-8)
  t.applyBalance(12.95, false)
  const rice = t.state.bowls.find(b => !b.iron)
  assert.equal(t.state.bookedBal, 9.95, 'top-up waits for collection')
  t.onRiceFed(rice); assert.equal(t.state.bookedBal, 12.95)
  t.startCredit(3, true); const demo = t.state.bowls.find(b => b.demo)
  t.onRiceFed(demo)
  assert.equal(t.state.real, 12.95); assert.equal(t.state.bookedBal, 12.95)
  assert.equal(t.state.creditPending, 0)
  assert.equal(t.state.testOffset, -3)
  t.applyBalance(12.94, false)
  assert.ok(Math.abs(t.state.usage.used - 0.06) < 1e-8, 'recharges and rehearsals do not count as spending')
  t.applyBalance(12.94, true)
  assert.equal(t.state.testOffset, 0)
  assert.ok(t.state.bowls.every(b => b.iron), 'refresh clears unclaimed and phantom bowls')
  t.stop()
}
{
  const t = fixture(); t.state.fxBowl = false; t.state.fxHurt = false
  t.applyBalance(10, false); t.applyBalance(13, false)
  assert.equal(t.state.bowls.length, 0); assert.equal(t.state.bookedBal, 13)
  t.applyBalance(12.98, false)
  for (let ms = 1; ms < 1200; ms += 50) t.frame(ms)
  assert.equal(t.state.bookedBal, 12.98); assert.equal(t.state.hits.length, 0)
  assert.equal(t.state.floaters.length, 0)
  t.makeTick(0.01, true); assert.equal(t.state.hits.length, 0)
  t.startCredit(3, true); assert.equal(t.state.creditPending, 0); assert.equal(t.state.real, 12.98)
  t.stop()
}
{
  const t = fixture(); t.ready()
  t.pat.pointer = { x: t.state.left + 100, y: t.state.top + 100, buttons: 0 }
  for (let n = 0; n < 40; n++) t.updatePat(0.02)
  assert.equal(t.pat.active, false, 'stationary hover is not a stroke')
  for (let n = 0; n < 80; n++) { if (n % 2) t.pat.pointer.x += n % 4 === 1 ? 4 : -4; t.updatePat(0.02) }
  assert.equal(t.pat.active, true, 'normal gaps between pointer events must not reset a continuous stroke')
  for (let n = 0; n < 9; n++) t.updatePat(0.02)
  for (let n = 0; n < 60; n++) { t.pat.pointer.x += n % 2 ? 4 : -4; t.updatePat(0.02) }
  assert.equal(t.pat.active, true, 'sustained movement triggers the hand')
  for (let n = 0; n < 9; n++) t.updatePat(0.02)
  assert.equal(t.pat.active, false, 'stopping movement lifts the hand after 150ms')
  t.blockPat(); assert.equal(t.pat.active, false)
  t.state.fxPat = false
  for (let n = 0; n < 100; n++) { t.pat.pointer.x += n % 2 ? 4 : -4; t.updatePat(0.02) }
  assert.equal(t.pat.active, false)
  t.stop()
}
{
  const t = fixture(); t.applyBalance(10, false); t.startCredit(3, true); t.ready()
  const bowl = t.state.bowls[0]
  bowl.X = t.state.left + 100; bowl.Y = t.state.top + 100; bowl.dragging = true
  t.state.grab = { bowl }
  t.updateBowls(0.016)
  assert.equal(bowl.fed, true, 'dragging a bowl into her feeds on contact')
  assert.equal(t.state.grab, null, 'feeding releases the grabbed bowl')
  t.onRiceFed(bowl)
  assert.equal(t.state.testOffset, -3, 'feeding the same bowl twice cannot credit twice')
  t.stop()
}
{
  const t = fixture()
  t.dropIronPot(300, 300); t.dropIronPot(350, 300); t.dropIronPot(400, 300)
  assert.equal(t.state.bowls.length, 3, 'multiple iron pots survive')
  const [a, b, c] = t.state.bowls
  t.attachIronPot(c); t.attachIronPot(a); t.attachIronPot(b)
  assert.equal(t.ironStackIndex(c), 0); assert.equal(t.ironStackIndex(a), 1); assert.equal(t.ironStackIndex(b), 2)
  assert.ok(t.ironHeadAnchor(b).y < t.ironHeadAnchor(a).y)
  assert.equal(t.knockPotOff(), true)
  assert.ok(b.fadeT > 0 && a.fadeT === 0 && c.fadeT === 0, 'one double click removes only the top pot')
  for (let i = 0; i < 10; i++) t.updateBowls(0.05)
  assert.equal(t.state.bowls.length, 2)
  const loose = t.newBowl({ iron: true, X: t.ironHeadAnchor().x, Y: t.ironHeadAnchor().y, VY: 0 })
  assert.equal(t.ironOnHead(loose), false, 'placing or holding a pot does not seat it')
  t.stop()
}
{
  const t = fixture(); t.applyBalance(10, false)
  for (const page of ['display', 'sound', 'library', 'demo']) t.showSettings(page)
  t.state.peakMode = true; t.state.peakHold = 5
  for (let i = 0; i < 51; i++) t.tickTablet(0.1)
  assert.equal(t.state.peakMode, false)
  const wav = t.wavBlob({ sampleRate: 1000, length: 1000, numberOfChannels: 1, getChannelData: () => new Float32Array(1000).fill(0.25) }, 0.2, 0.5, 200)
  const view = new DataView(await wav.arrayBuffer())
  assert.equal(wav.size, 644); assert.equal(view.getInt16(44, true), 16383)
  assert.throws(() => t.wavBlob({ sampleRate: 1000, length: 1000, numberOfChannels: 1 }, 1, 0, 100))
  t.state.fxPat = false; t.state.cueVolumes[2] = 35; t.saveOptions()
  const restored = fixture(Object.fromEntries(t.storage))
  assert.equal(restored.state.fxPat, false); assert.equal(restored.state.cueVolumes[2], 35)
  assert.equal(restored.state.usage.used, 0)
  restored.stop(); t.stop()
  assert.ok([...t.documentEvents.values(), ...t.windowEvents.values()].every(set => set.size === 0), 'unmount removes every global listener')
}
console.log('Verified modern widget behavior: settlement, isolated demos, switches, stroke timing, pot stacks, usage, settings, WAV trim/gain and persistence.')
