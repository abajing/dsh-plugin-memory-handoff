# dsh-plugin-memory-handoff

> Cross-session memory handoff for DeepSeek Harness — keep progress **outside** the context, surface unfinished work **once** per session, and archive compaction summaries so nothing is silently lost.

> 给 DeepSeek Harness 的跨会话记忆交接 —— 把进度放在上下文**外面**，每个会话只提示**一次**未完成的事，压缩时自动存档摘要，细节丢了也能接上。

MIT · Works with plain `dsh web` and DSH Desktop / DSH Next.

---

## 它解决什么

DSH 把「会话」管得很好：存盘、恢复、回放、全文搜索、压缩、分叉，都有。但这些是**记录**，不是**记忆**。

三个真实缺口：

| 缺口 | 现象 | 本插件 |
|---|---|---|
| 跨会话记忆 | 新会话不知道「那件事还没做完」，要么重做，要么忘掉 | 读 handoff 文件，开场给一行提示 |
| 状态标记 | 所有事都被当成未完成，每次开场念一堆 | `pending` / `done` / `dropped`，`dropped` 永不再提 |
| 压缩即丢细节 | 上下文压完，早期判断和细节没了 | 订阅压缩事件，把摘要与被压缩区间落盘 |

**不做什么**（守边界，不与平台重复）：

- 不接管压缩 —— `compaction-basic` 已有阈值 `min(W×0.8, W−O−65536)`；
- 不重构会话存储 —— `session-persistence` 已做；
- 不自动 fork —— `remote.session.fork` 是平台契约，何时分叉由上层决定。

---

## 安装

```bash
# 在你的 profile 里
dsh plugin add dsh-plugin-memory-handoff
```

或在 profile 的 `cordis.patch.yml` 里显式挂载：

```yaml
- insert:
    - id: memory-handoff
      name: dsh-plugin-memory-handoff
      config:
        maxHints: 3
```

## 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `storePath` | `$DSH_HOME/memory-handoff.json` | handoff 文件位置 |
| `maxHints` | `3` | 一次最多提示几条未完成事项（上限 9） |
| `recordShadowedRange` | `true` | 压缩存盘时记录被压缩掉的事件区间 |

## 数据格式

`memory-handoff.json`：

```json
{
  "version": 1,
  "items": [
    {
      "id": "a1",
      "title": "30 秒混剪",
      "status": "pending",
      "did": "跑完样片",
      "next": "看前 10 秒给结论",
      "updatedAt": "2026-11-26T00:00:00Z"
    }
  ],
  "lastCompaction": {
    "at": "2026-11-26T01:46:53Z",
    "compactionId": "c-001",
    "turn": 7,
    "summary": "前 20 轮：跑了模拟盘，修了 4 个真缺陷",
    "shadowed": { "start": 3, "end": 41 }
  }
}
```

`status` 三种：`pending`（会提示）· `done`（不提示）· `dropped`（**永不再提**）。

---

## 实现要点（对着上游代码确认过）

- **压缩事件**：`compaction/start` / `compaction/end` —— 已在本机运行时（`@deepseek-ai/dsh-desktop-runtime 0.2.1-rc.5`）实测存在，声明在 `packages/compaction/compaction/src/types.ts`，注释写明这对事件是 contractual；`compaction/end` 带 `summary`、`shadowedRange`、`shadowedSeqs`。
- **开场钩子**：本运行时里**没有** `session/start`。插件改为监听 `turn/start`，每个会话只在第一轮提示一次，`session/fork` 之后重置。
- **压缩阈值**：`packages/compaction/compaction-basic` 文档给出 `min(W×0.8, W−O−65536)`，可配 `thresholdRatio` / `headroomTokens` / `retainTokens`。
- **分叉契约**：`packages/api/session-controller/src/types.ts` 的 `SessionForkRequest { sessionId, atSeq?, allowMigration? }`，实现见 `commands.ts` 的 `fork()`。

## 已知限制

- 上下文压缩是**有损**的，摘要存下来不等于细节存下来；真正要做到「细节不丢」，需在压缩前另存原始事件（属于上层决策）。
- 上游 `dsh-compaction@0.0.1-rc.5` 依赖 `dsh-session@^0.0.1-rc.5`，而 npm 上 `dsh-session` 只到 `rc.1`；装依赖时需 `--legacy-peer-deps`。这是上游版本链问题，不是本插件引入的。

## 测试

```bash
npm run build
node tests/smoke.mjs
```

当前：10 项断言全过（挂载、压缩落盘、区间记录、状态过滤、空清单、session/start 不写盘、写读往返）。

## License

MIT
