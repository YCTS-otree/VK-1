import assert from 'node:assert/strict'
import { createUpdateChecker, compareVersions } from '../dsh-plugin/update-checker-v1.js'

assert.equal(compareVersions('1.10.0', '1.9.9'), 1)
assert.equal(compareVersions('1.2.0', '1.2.0-rc.2'), 1)
assert.equal(compareVersions('1.2.0-rc.10', '1.2.0-rc.2'), 1)
assert.equal(compareVersions('1.2.0+build', '1.2.0'), 0)
assert.throws(() => compareVersions('bad-version', '1.2.0'))

let date = new Date(2026, 9, 16, 10), stored, calls = 0, failing = false
const jobs = new Set()
const timers = {
  setTimeout(fn) { jobs.add(fn); return fn }, clearTimeout(fn) { jobs.delete(fn) },
  setInterval(fn) { jobs.add(fn); return fn }, clearInterval(fn) { jobs.delete(fn) },
}
const options = {
  currentVersion: '1.2.0', now: () => date, timers,
  readState: () => stored ? structuredClone(stored) : null,
  saveState: state => { stored = structuredClone(state) },
  fetchVersion: async () => { calls++; if (failing) throw new Error('offline'); return '1.3.0' },
}
let checker = createUpdateChecker(options)
await checker.check(); assert.equal(calls, 0, 'disabled plugin does not check')
checker.start()
const [a, b] = await Promise.all([checker.check(), checker.check()])
assert.equal(calls, 1, 'concurrent callers share one request')
assert.equal(a.available, true); assert.equal(b.latestVersion, '1.3.0')
await checker.check(); assert.equal(calls, 1, 'same day is skipped')
checker.stop(); assert.equal(jobs.size, 0, 'disabling removes every scheduled check')
checker = createUpdateChecker(options); checker.start()
await checker.check(); assert.equal(calls, 1, 'same-day reload/re-enable reads persistent state')
date = new Date(2026, 9, 17, 0, 1)
await checker.check(); assert.equal(calls, 2, 'next calendar day gets one request')
date = new Date(2026, 9, 18, 0, 1); failing = true
await checker.check(); await checker.check()
assert.equal(calls, 3, 'network failure still counts as the day\'s attempt')
assert.ok(checker.snapshot().error)
checker.stop()
checker = createUpdateChecker({ ...options, currentVersion: '2.0.0' })
assert.equal(checker.snapshot().available, false, 'never suggest an older version')

let resolveFetch, signal
date = new Date(2026, 9, 19, 0, 1)
checker = createUpdateChecker({ ...options, fetchVersion: s => { signal = s; return new Promise(resolve => { resolveFetch = resolve }) } })
checker.start(); const request = checker.check()
checker.stop(); assert.equal(signal.aborted, true)
resolveFetch('9.0.0'); await request
assert.notEqual(stored.latestVersion, '9.0.0', 'late response after disable cannot change state')
assert.equal(jobs.size, 0)
console.log('Verified daily updates: enabled lifecycle, persistent calendar-day deduplication, concurrent callers, failure handling, version comparison and cancellation.')
