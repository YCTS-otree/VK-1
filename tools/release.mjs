import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import './verify.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'dsh-plugin')
const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
const destination = path.join(root, 'Release', `v${pkg.version}`)
if (fs.existsSync(destination)) throw new Error(`Release v${pkg.version} already exists; never overwrite it.`)
const files = ['package.json', 'LICENSE', 'README.md', ...pkg.files.filter(file => file !== 'assets')]
for (const file of fs.readdirSync(path.join(source, 'assets'))) {
  if (!/\.(png|mp3)$/.test(file)) throw new Error(`Unexpected asset: ${file}`)
  files.push(`assets/${file}`)
}
// Read only explicitly selected distribution files; credentials and keys are excluded.
const contents = files.map(file => [file, fs.readFileSync(path.join(source, file))])
const checksums = {}
fs.mkdirSync(destination, { recursive: true })
for (const [file, data] of contents) {
  const target = path.join(destination, 'dsh-plugin', file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, data)
  checksums[`dsh-plugin/${file}`] = crypto.createHash('sha256').update(data).digest('hex')
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({ name: pkg.name, version: pkg.version, sha256: checksums }, null, 2) + '\n')
fs.writeFileSync(path.join(destination, 'README.md'), `# ${pkg.name} v${pkg.version}\n\nInstall the dsh-plugin directory as a DSH bundle. See dsh-plugin/README.md.\n\nThis release is immutable. manifest.json records SHA-256 checksums.\n`)
console.log(`Created Release/v${pkg.version}/`)
