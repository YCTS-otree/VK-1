import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundle = path.join(root, 'dsh-plugin')
const pkg = JSON.parse(fs.readFileSync(path.join(bundle, 'package.json'), 'utf8'))
assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
const entry = pkg.exports['.']
assert.ok(fs.readFileSync(path.join(bundle, 'cordis.patch.yml'), 'utf8').includes(`name: ${entry}`))
for (const file of [entry, 'widget.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(bundle, file)], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}
for (const file of pkg.files) assert.ok(fs.existsSync(path.join(bundle, file)), file)
const plugin = await import(pathToFileURL(path.join(bundle, entry)))
assert.equal(plugin.name, pkg.name)
const routes = new Map()
let cleanup
let disposed = 0
plugin.apply({
  webServer: {
    register(route) { routes.set(route.path, route); return () => { disposed++ } },
    tapIndex(transform) {
      const html = transform('<body></body>')
      assert.ok(html.includes('/dsh-vk1/widget.js'))
      assert.equal(transform(html), html, 'script injection must be idempotent')
      return () => { disposed++ }
    },
  },
  credentials: {},
  effect(factory) { cleanup = factory() },
})
for (const [url, route] of routes) {
  if (url.endsWith('/balance.json')) continue // No live credentials or paid API calls.
  let status, payload
  await route.handler({}, {
    writeHead(code) { status = code },
    end(body) { payload = body },
  })
  assert.equal(status, 200, url)
  assert.ok(payload.length > 0, url)
}
cleanup()
assert.equal(disposed, routes.size + 1)
for (const file of ['README.md', 'dsh-plugin/README.md', 'CHANGELOG.md']) {
  assert.ok(fs.readFileSync(path.join(root, file), 'utf8').includes(pkg.version), `${file}: version mismatch`)
}
console.log(`Verified plugin ${pkg.version}: syntax, entry, assets, routes, injection and cleanup.`)
