/**
 * 沙箱验证 —— 不启动 Electron，不加载真实 profile。
 * 用假 Context 直接调 apply()，验证三件事：
 *   1. apply 能挂载，不抛错
 *   2. compaction/end 事件能把摘要写进 handoff 文件
 *   3. hintLine 只提示 pending，done/dropped 永不出现
 *
 * 跑法：node tests/smoke.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply, emptyStore, hintLine, readStore, writeStore } from '../lib/index.mjs'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS ', name, extra) }
  else { fail++; console.log('FAIL ', name, extra) }
}

// ---- 假 Context：收集事件监听器与日志
function fakeCtx() {
  const handlers = new Map()
  const logs = []
  return {
    handlers,
    logs,
    on(ev, fn) {
      if (!handlers.has(ev)) handlers.set(ev, [])
      handlers.get(ev).push(fn)
    },
    logger: {
      info: (m) => logs.push(m),
      warn: (m) => logs.push('WARN ' + m),
    },
    emit(ev, payload) {
      for (const fn of handlers.get(ev) ?? []) fn(payload)
    },
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-'))
const storePath = path.join(tmp, 'handoff.json')

// ---- 1) 挂载
const ctx = fakeCtx()
apply(ctx, { storePath, maxHints: 3, recordShadowedRange: true })
ok('apply 挂载不抛错',
  ctx.handlers.has('compaction/end')
  && ctx.handlers.has('turn/start')
  && ctx.handlers.has('session/fork'))

// ---- 2) 压缩事件写盘
ctx.emit('compaction/end', {
  compactionId: 'c-001',
  turn: 7,
  summary: [{ type: 'text', text: '前 20 轮：跑了模拟盘，修了 4 个真缺陷' }],
  shadowedRange: { start: 3, end: 41 },
})
const after = readStore(storePath)
ok('压缩摘要已落盘', after.lastCompaction?.compactionId === 'c-001', JSON.stringify(after.lastCompaction ?? {}).slice(0, 60))
ok('记录了被压缩区间', after.lastCompaction?.shadowed?.end === 41)

// ---- 3) 状态过滤
const s = emptyStore()
s.items = [
  { id: 'a', title: '30 秒混剪', status: 'pending', updatedAt: '2026-11-26T00:00:00Z' },
  { id: 'b', title: '已经做完的事', status: 'done', updatedAt: '2026-11-26T00:00:00Z' },
  { id: 'c', title: '用户说不做的事', status: 'dropped', updatedAt: '2026-11-26T00:00:00Z' },
  { id: 'd', title: '平台骨架', status: 'pending', updatedAt: '2026-11-26T00:00:00Z' },
]
const line = hintLine(s, 3)
ok('提示里只有 pending', line.includes('30 秒混剪') && line.includes('平台骨架'))
ok('done 不出现', !line.includes('已经做完的事'))
ok('dropped 不出现', !line.includes('用户说不做的事'))
ok('提示总数正确', line.includes('还有 2 件没做'), line)

// ---- 4) 空 store 不提示
ok('空清单不产生提示', hintLine(emptyStore(), 3) === '')

// ---- 5) turn/start 每会话只提示一次；session/fork 之后重新提示
writeStore(storePath, s)
const ctx2 = fakeCtx()
apply(ctx2, { storePath, maxHints: 3, recordShadowedRange: true })
const before = fs.readFileSync(storePath, 'utf8')
const countHints = () => ctx2.logs.filter((l) => l.includes('还有 2 件没做')).length

ctx2.emit('turn/start', {})
ctx2.emit('turn/start', {})
ctx2.emit('turn/start', {})
ok('turn/start 只提示一次', countHints() === 1, `hints=${countHints()}`)

ctx2.emit('session/fork', {})
ctx2.emit('turn/start', {})
ok('fork 后重新提示一次', countHints() === 2, `hints=${countHints()}`)

ok('turn/start 不改文件', fs.readFileSync(storePath, 'utf8') === before)

// ---- 6) 写读往返
writeStore(storePath, s)
ok('写读往返一致', readStore(storePath).items.length === 4)

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
