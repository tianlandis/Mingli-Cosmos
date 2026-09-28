# ADR-008: 备份与灾难恢复策略

- **状态**: `Accepted`（**P5-1 已实施**：`scripts/backup-db.py` 已就绪并部署至生产宿主机，每日 03:17 cron）
- **日期**: 2026-09-28
- **决策者**: 田哥
- **类别**: 🧱 骨架（数据健壮性）
- **关联**: `../arch/ARCHITECTURE-REVIEW.md` §4.1、`../deploy/DEPLOY-LOG-VPS.md`、`scripts/backup-db.py`

---

## 背景（Context）

生产库 `/opt/mingli/data/mingli.db` 是**唯一副本**：没有备份脚本、没有恢复演练、
没有版本化迁移链。一次误删 / 文件损坏 / 磁盘故障 = **用户与订单数据全丢**。

这是当前最"沉默"的 P0 风险 —— 不爆发则已，一旦爆发**不可逆**。

## 驱动因素（Decision Drivers）

- 数据是唯一无法重建的资产（代码在 Git，配置可重生成，**用户数据不能**）。
- 迁移（ADR-002）与合规（ADR-006）都依赖**可回滚、可追溯**的数据底座。
- 备份文件本身含 PII → 需加密 + 访问控制。

## 决策（Decision）

1. **自动备份**：每日用 `sqlite3 .backup`（或 `VACUUM INTO`，WAL 下安全）导出 →
   本地保留 N 份 + **异地一份**（对象存储 / 另一台机）；备份**加密**。
2. **恢复演练**：每季度一次"从备份恢复"演练，并记录实际 RTO / RPO。
3. **版本化迁移链**：以 `migrations/` 有序文件替代纯 `IF NOT EXISTS`，支持改列 / 回滚；
   启动时校验"已应用迁移 == 代码预期"，不一致**拒绝启动**（防脏库）。
4. **数据保留策略（TTL / 归档）**：为 `sessions` / `analytics_events` / `audit_logs`
   定义保留期与归档，防止表无界增长（同时降低备份体积）。

## 后果（Consequences）

**正向 (+)**
- 误删可恢复；迁移可回滚；表不再无界膨胀。

**负向 (−)**
- 增加定时任务与存储成本（很小）；迁移链需纪律维护。

**中性 / 风险**
- 备份文件含 PII → **必须加密 + 访问控制**（呼应 ADR-006）。
- 备份与恢复都要**演练过**才算数，只有脚本不算。

## 复审触发条件

- 迁移 PostgreSQL（ADR-002）→ 备份方案改为 `pg_dump` / WAL 归档 / PITR；
- 数据量增长导致备份窗口过长 → 改增量备份。

## 关联

ADR-002（迁移预案）｜ADR-006（PII 加密）｜ADR-007（备份任务需被监控）

---

## 实施记录（2026-09-28）

- **工具**：`scripts/backup-db.py`（Python 标准库）。
  - **为什么不用 shell + `sqlite3` CLI**：生产宿主机（Ubuntu）**无 sqlite3、无 node，有 python3**；
    用 python3 标准库可**零安装、免重建容器**地直接对挂载库文件做在线备份（不中断线上服务）。
  - **为什么必须用在线备份 API**：数据库是 WAL 模式，`cp mingli.db` 会漏掉未 checkpoint 的 `-wal`，
    可能备份出损坏库；`Connection.backup()` 才是 WAL 安全的正解。
- **本地验证（同一解释器实跑，9/9）**：建库 → 备份 → `integrity_check=ok` 且行数一致 →
  保留策略（上限命中）→ **恢复演练**（删库→恢复→数据一致）→ gzip → 覆盖保护（退出码 4）→
  缺库（退出码 2）→ 从 `.gz` 恢复。**过程中抓到并修复一个真 bug**：`sqlite3` 的 `with` 只管理事务、
  不关闭连接，导致文件句柄泄漏、重命名失败 → 改为显式 `close()`。
- **生产部署**：脚本置于 `/opt/mingli/scripts/backup-db.py`，备份目录 `/opt/mingli/backups/`，
  cron：`17 3 * * * … --retain 14`。

### 同批修复：数据目录移出仓库（事故驱动）
部署检查时发现**生产库磁盘文件与进程实际写入的 inode 不一致**（应用在写被 `git` 覆盖后
unlink 的幽灵文件），根因是 `data/mingli.db` 被 git 跟踪且 compose 挂载仓库内目录。
已根治：取消跟踪 + `HOST_DATA_DIR` 指向仓库之外（`/opt/mingli-data`）+ 部署守卫 + 启动自检。
**完整复盘见 `../deploy/DEPLOY-LOG-VPS.md` §八。**
