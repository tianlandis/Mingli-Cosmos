#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mingli-Cosmos · SQLite 备份 / 恢复工具  (ADR-008 / P5-1)

为什么用 python3 标准库：
  生产宿主机是 Ubuntu（有 python3，**没有** sqlite3 CLI，也**没有** node），
  而容器内无 python3。用 python3 标准库 `sqlite3` 可在宿主机直接对
  挂载出来的数据库文件做**在线备份**，无需安装任何东西、**无需重建容器**（不中断线上服务）。

关键设计：
  1. 用 SQLite **在线备份 API**（`Connection.backup`），对 WAL 模式安全，
     不会因 -wal / -shm 未 checkpoint 而备份出损坏文件（普通 cp 会）。
  2. 备份后跑 `PRAGMA integrity_check`，**验证可读**才落盘（否则删除并报错）。
  3. 先写临时文件再原子重命名，避免半截文件被当成有效备份。
  4. 保留策略：按时间保留最近 N 份，其余删除。

用法：
  # 备份（默认：DB=/opt/mingli/data/mingli.db，备份到 /opt/mingli/backups，保留 14 份）
  python3 scripts/backup-db.py
  python3 scripts/backup-db.py --db data/mingli.db --out backups --retain 30
  python3 scripts/backup-db.py --gzip                       # 压缩为 .db.gz
  DB_PATH=data/mingli.db BACKUP_DIR=backups python3 scripts/backup-db.py

  # 恢复（务必先停容器：docker stop bazipaipan-prod）
  python3 scripts/backup-db.py --restore /opt/mingli/backups/mingli-20260928-031700.db \
                               --to /opt/mingli/data/mingli.db --force

退出码：0 成功 ｜ 2 路径不存在 ｜ 3 备份完整性校验失败 ｜ 4 拒绝覆盖目标（缺 --force）
"""

from __future__ import annotations

import argparse
import gc
import gzip
import os
import shutil
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

DEFAULT_DB = os.environ.get("DB_PATH", "/opt/mingli/data/mingli.db")
DEFAULT_DIR = os.environ.get("BACKUP_DIR", "/opt/mingli/backups")
DEFAULT_RETAIN = int(os.environ.get("BACKUP_RETAIN", "14"))


def log(msg: str) -> None:
    print(f"[backup] {datetime.now():%Y-%m-%d %H:%M:%S} {msg}", flush=True)


def integrity_ok(path: Path) -> bool:
    """对一个 SQLite 文件跑 PRAGMA integrity_check，返回是否 'ok'。

    注意：sqlite3 连接的 `with` 语句只管理**事务**，**不会关闭连接**；
    必须显式 close()，否则文件句柄残留（Windows 上会导致后续重命名/删除失败）。
    """
    conn = None
    try:
        conn = sqlite3.connect(str(path))
        row = conn.execute("PRAGMA integrity_check;").fetchone()
        return bool(row) and row[0] == "ok"
    except sqlite3.Error:
        return False
    finally:
        if conn is not None:
            conn.close()


def do_backup(db_path: str, outdir: str, retain: int, use_gzip: bool) -> int:
    db = Path(db_path)
    if not db.is_file():
        log(f"ERROR 数据库不存在: {db}")
        return 2

    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)

    ts = time.strftime("%Y%m%d-%H%M%S")
    tmp = out / f".mingli-{ts}.db.tmp"
    final = out / (f"mingli-{ts}.db.gz" if use_gzip else f"mingli-{ts}.db")

    # 1) 在线备份（WAL 安全，不阻塞应用写入）
    try:
        src = sqlite3.connect(str(db))
        dst = sqlite3.connect(str(tmp))
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
        del dst, src
        gc.collect()  # Windows：确保句柄在重命名前释放
    except sqlite3.Error as e:
        tmp.unlink(missing_ok=True)
        log(f"ERROR 在线备份失败: {e}")
        return 3

    # 2) 完整性校验（备份必须可读，否则不落盘）
    if not integrity_ok(tmp):
        tmp.unlink(missing_ok=True)
        log("ERROR 备份完整性校验失败，已丢弃该文件")
        return 3

    # 3) 可选压缩 + 原子落盘
    if use_gzip:
        with open(tmp, "rb") as fi, gzip.open(final, "wb") as fo:
            shutil.copyfileobj(fi, fo)
        tmp.unlink(missing_ok=True)
    else:
        tmp.replace(final)

    size_kib = final.stat().st_size / 1024
    log(f"OK 备份完成: {final} ({size_kib:.1f} KiB)")

    # 4) 保留策略：按 mtime 保留最近 retain 份
    backups = sorted(out.glob("mingli-*.db*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in backups[retain:]:
        old.unlink(missing_ok=True)
        log(f"清理旧备份: {old.name}")
    log(f"当前保留 {min(len(backups), retain)} 份（上限 {retain}）")
    return 0


def do_restore(backup: str, dest: str, force: bool) -> int:
    b = Path(backup)
    d = Path(dest)
    if not b.is_file():
        log(f"ERROR 备份文件不存在: {b}")
        return 2
    if d.exists() and not force:
        log(f"ERROR 目标已存在，拒绝覆盖（确认无误后加 --force）: {d}")
        return 4

    # 解压（若为 .gz）
    work = b
    if b.suffix == ".gz":
        work = b.with_suffix("")  # 去掉 .gz
        with gzip.open(b, "rb") as fi, open(work, "wb") as fo:
            shutil.copyfileobj(fi, fo)

    if not integrity_ok(work):
        log(f"ERROR 备份完整性校验失败，拒绝恢复: {work}")
        if work != b:
            work.unlink(missing_ok=True)
        return 3

    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(work, d)

    # WAL/SHM 残留清零，避免与恢复后的库不一致
    for suffix in ("-wal", "-shm"):
        residue = Path(str(d) + suffix)
        if residue.exists():
            residue.unlink()
            log(f"清理残留: {residue.name}")

    if work != b:
        work.unlink(missing_ok=True)

    log(f"OK 恢复完成: {b.name} → {d}（请重启容器使应用重连）")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Mingli-Cosmos SQLite 备份/恢复（ADR-008）")
    ap.add_argument("--db", default=DEFAULT_DB, help=f"数据库路径（默认 {DEFAULT_DB}）")
    ap.add_argument("--out", default=DEFAULT_DIR, help=f"备份目录（默认 {DEFAULT_DIR}）")
    ap.add_argument("--retain", type=int, default=DEFAULT_RETAIN, help=f"保留份数（默认 {DEFAULT_RETAIN}）")
    ap.add_argument("--gzip", action="store_true", help="压缩为 .db.gz")
    ap.add_argument("--restore", metavar="BACKUP_FILE", help="从指定备份恢复（需 --to）")
    ap.add_argument("--to", metavar="DEST_DB", help="恢复目标数据库路径")
    ap.add_argument("--force", action="store_true", help="恢复时允许覆盖已存在的目标")
    args = ap.parse_args()

    if args.restore:
        if not args.to:
            ap.error("--restore 需要同时指定 --to <目标数据库路径>")
        return do_restore(args.restore, args.to, args.force)

    return do_backup(args.db, args.out, args.retain, args.gzip)


if __name__ == "__main__":
    sys.exit(main())
