/**
 * dsh-plugin-memory-handoff — 把「进度」放在上下文外面，而不是放在上下文里。
 *
 * 解决三件平台没做的事（都对着上游代码确认过）：
 *   1. 跨会话记忆：平台有会话存盘与全文搜索，但不会主动告诉模型「这件事还没做完」。
 *   2. 状态标记：pending / done / dropped，dropped 永不再提。
 *   3. 压缩即存档：订阅 compaction 事件的类型声明，压缩发生时把 summary 落到 handoff 文件。
 *
 * 不做的事（守边界）：
 *   · 不接管压缩（compaction-basic 已做：阈值 min(W*0.8, W-O-65536)）
 *   · 不拆重构会话存储（session-persistence 已做）
 *   · 不自动 fork（fork 是 remote.session.fork 契约，由上层决定何时调用）
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import fs from 'node:fs'
import path from 'node:path'

export const name = 'memory-handoff'

export interface Config {
  /** handoff 文件位置（JSON）。默认 $DSH_HOME/memory-handoff.json */
  storePath: string
  /** 一轮最多提示几条未完成事项 */
  maxHints: number
  /** 压缩存盘时是否记录被压缩掉的区间 */
  recordShadowedRange: boolean
}

export const Config = z.object({
  storePath: z.string().default(''),
  maxHints: z.natural().max(9).default(3),
  recordShadowedRange: z.boolean().default(true),
})

type Status = 'pending' | 'done' | 'dropped'

export interface Item {
  id: string
  title: string
  status: Status
  did?: string
  next?: string
  updatedAt: string
}

export interface Store {
  version: 1
  items: Item[]
  lastCompaction?: {
    at: string
    compactionId: string
    turn: number | null
    summary: string
    shadowed?: { start: number; end: number }
  }
}

export function emptyStore(): Store {
  return { version: 1, items: [] }
}

export function readStore(p: string): Store {
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as Store
    if (!parsed || !Array.isArray(parsed.items)) return emptyStore()
    return parsed
  } catch {
    return emptyStore()
  }
}

export function writeStore(p: string, s: Store): void {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf8')
  fs.renameSync(tmp, p)
}

/** 只把 pending 压成一行；done / dropped 永远不出现。 */
export function hintLine(s: Store, max: number): string {
  const pending = s.items.filter((i) => i.status === 'pending')
  if (pending.length === 0) return ''
  const shown = pending.slice(0, max).map((i, n) => `${n + 1}. ${i.title}`)
  const rest = pending.length - shown.length
  return `记忆里还有 ${pending.length} 件没做：${shown.join('；')}`
    + (rest > 0 ? `；另 ${rest} 件` : '')
    + '。要接哪件？不接的标 dropped 以后不再提。'
}

type CompactionEnd = {
  compactionId: string
  turn: number | null
  summary: unknown
  shadowedRange?: { start: number; end: number }
}

export function apply(ctx: Context, config: Config): void {
  const home = process.env.DSH_HOME || process.cwd()
  const storePath = config.storePath && config.storePath.length > 0
    ? config.storePath
    : path.join(home, 'memory-handoff.json')

  const store = readStore(storePath)

  // 压缩结束：把摘要落盘，细节丢了也能靠它接上。
  // Cordis 的事件名在未加载 compaction 包时不在 Events 联合类型里，
  // 所以这里用 ctx.on 的宽松签名（类型安全由下面的参数注解保证）。
  const on = ctx.on.bind(ctx) as unknown as (
    event: string,
    listener: (ev: CompactionEnd) => void,
  ) => void

  on('compaction/end', (ev) => {
    const summary = typeof ev.summary === 'string'
      ? ev.summary
      : JSON.stringify(ev.summary)
    store.lastCompaction = {
      at: new Date().toISOString(),
      compactionId: String(ev.compactionId),
      turn: ev.turn ?? null,
      summary: summary.slice(0, 4000),
      shadowed: config.recordShadowedRange ? ev.shadowedRange : undefined,
    }
    writeStore(storePath, store)
    ctx.logger.info(`[memory-handoff] 压缩已存档 -> ${storePath}`)
  })

  // 每轮开始：只在「本会话第一次」提示一次，之后不再念。
  // 事件名用 turn/start —— 在本机 runtime（dsh-desktop-runtime 0.2.1-rc.5）里
  // 实测存在；session/start 不存在（真实的是 session/create、session/created）。
  let hinted = false
  const onTurn = ctx.on.bind(ctx) as unknown as (
    event: string,
    listener: () => void,
  ) => void
  onTurn('turn/start', () => {
    if (hinted) return
    hinted = true
    const line = hintLine(store, config.maxHints)
    if (line) ctx.logger.info(`[memory-handoff] ${line}`)
  })

  // 分叉：本机 runtime 有 session/fork 事件，分叉后要重新给一次提示
  const onFork = ctx.on.bind(ctx) as unknown as (
    event: string,
    listener: () => void,
  ) => void
  onFork('session/fork', () => {
    hinted = false
  })

  ctx.logger.info(`[memory-handoff] 已挂载，store=${storePath}`)
}
