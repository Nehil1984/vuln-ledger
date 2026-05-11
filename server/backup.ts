// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { readDbBackend } from './db-config.js'
import type { BackupConfig, BackupPreflightResult, BackupRecord, BackupRetentionConfig, DbBackend } from './models.js'

const BACKUP_META_PREFIX = 'VLMETA1\n'
const defaultRetention: BackupRetentionConfig = { hourly: 24, daily: 7, weekly: 4, monthly: 12, yearly: 2 }

function getDataDir() {
  return path.resolve(process.cwd(), 'data')
}

function getBackupDir() {
  return path.join(getDataDir(), 'backups')
}

function getConfigPath() {
  return path.join(getBackupDir(), 'backup-config.json')
}

function ensureBackupDir() {
  fs.mkdirSync(getBackupDir(), { recursive: true })
}

export function readBackupConfig(): BackupConfig {
  ensureBackupDir()
  if (!fs.existsSync(getConfigPath())) {
    const cfg: BackupConfig = {
      enabled: false,
      backupDir: getBackupDir(),
      retention: defaultRetention,
      encrypt: false,
      passwordHint: '',
      updatedAt: new Date().toISOString(),
    }
    fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8')
    return cfg
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')) as Partial<BackupConfig>
    return {
      enabled: !!parsed.enabled,
      backupDir: parsed.backupDir || getBackupDir(),
      retention: { ...defaultRetention, ...(parsed.retention || {}) },
      encrypt: !!parsed.encrypt,
      passwordHint: parsed.passwordHint || '',
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      lastRunAt: parsed.lastRunAt,
      lastSuccessAt: parsed.lastSuccessAt,
      lastErrorAt: parsed.lastErrorAt,
      lastErrorMessage: parsed.lastErrorMessage,
    }
  } catch {
    return {
      enabled: false,
      backupDir: getBackupDir(),
      retention: defaultRetention,
      encrypt: false,
      passwordHint: '',
      updatedAt: new Date().toISOString(),
    }
  }
}

export function writeBackupConfig(next: Partial<BackupConfig> & { retention?: Partial<BackupRetentionConfig> }) {
  const current = readBackupConfig()
  const cfg: BackupConfig = {
    ...current,
    ...next,
    retention: { ...current.retention, ...(next.retention || {}) },
    backupDir: next.backupDir || current.backupDir || getBackupDir(),
    updatedAt: new Date().toISOString(),
  }
  fs.mkdirSync(cfg.backupDir, { recursive: true })
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8')
  return cfg
}

function updateBackupStatus(patch: Partial<BackupConfig>) {
  const current = readBackupConfig()
  const next = { ...current, ...patch }
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf8')
}

export function nextBackupRunEstimate() {
  const now = new Date()
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next.toISOString()
}

export function readBackupStatus() {
  const cfg = readBackupConfig()
  return {
    enabled: cfg.enabled,
    updatedAt: cfg.updatedAt,
    nextRunAt: nextBackupRunEstimate(),
    lastRunAt: cfg.lastRunAt || null,
    lastSuccessAt: cfg.lastSuccessAt || null,
    lastErrorAt: cfg.lastErrorAt || null,
    lastErrorMessage: cfg.lastErrorMessage || '',
    schedulerActive: !!backupTimer && cfg.enabled,
    schedulerRuntimePasswordConfigured: !!process.env.VULNLEDGER_BACKUP_PASSWORD,
  }
}

function getSourceFile() {
  return readDbBackend() === 'sqlite' ? path.join(getDataDir(), 'vulnledger.sqlite') : path.join(getDataDir(), 'vulnledger.lowdb.json')
}

function encryptBuffer(buffer: Buffer, password: string) {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = crypto.scryptSync(password, salt, 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from('VLB1'), salt, iv, tag, encrypted])
}

function decryptBuffer(buffer: Buffer, password: string) {
  if (buffer.subarray(0, 4).toString('utf8') !== 'VLB1') throw new Error('Ungültiges verschlüsseltes Backup-Format')
  const salt = buffer.subarray(4, 20)
  const iv = buffer.subarray(20, 32)
  const tag = buffer.subarray(32, 48)
  const encrypted = buffer.subarray(48)
  const key = crypto.scryptSync(password, salt, 32)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

function parseBackupMeta(raw: Buffer, encrypted: boolean, passwordOverride?: string) {
  let decoded = raw
  if (encrypted) {
    const password = passwordOverride || process.env.VULNLEDGER_BACKUP_PASSWORD
    if (!password) return null
    try {
      decoded = decryptBuffer(raw, password)
    } catch {
      return null
    }
  }
  const text = decoded.toString('utf8')
  if (!text.startsWith(BACKUP_META_PREFIX)) return null
  const end = text.indexOf('\n', BACKUP_META_PREFIX.length)
  if (end === -1) return null
  try {
    const meta = JSON.parse(text.slice(BACKUP_META_PREFIX.length, end)) as { backend?: DbBackend }
    if (meta.backend === 'lowdb' || meta.backend === 'sqlite') return meta
  } catch {
    return null
  }
  return null
}

function splitBackupPayload(raw: Buffer, encrypted: boolean, passwordOverride?: string) {
  const meta = parseBackupMeta(raw, encrypted, passwordOverride)
  if (!meta) return { meta: null, payload: raw }
  let decoded = raw
  if (encrypted) {
    const password = passwordOverride || process.env.VULNLEDGER_BACKUP_PASSWORD
    if (!password) throw new Error('Für verschlüsselte Wiederherstellung wurde kein Kennwort übergeben')
    decoded = decryptBuffer(raw, password)
  }
  const firstNewline = decoded.indexOf(0x0a, BACKUP_META_PREFIX.length)
  return { meta, payload: firstNewline === -1 ? decoded : decoded.subarray(firstNewline + 1) }
}

function parseFile(filePath: string): BackupRecord | null {
  const name = path.basename(filePath)
  const match = /^backup-(hourly|daily|weekly|monthly|yearly)-([^.]+)\.(bak|enc)$/.exec(name)
  if (!match) return null
  const stat = fs.statSync(filePath)
  const encrypted = match[3] === 'enc'
  const meta = parseBackupMeta(fs.readFileSync(filePath), encrypted)
  const currentBackend = readDbBackend()
  return {
    fileName: name,
    filePath,
    createdAt: stat.mtime.toISOString(),
    size: stat.size,
    encrypted,
    slot: match[1] as BackupRecord['slot'],
    label: match[2],
    backend: (meta?.backend as DbBackend | undefined) || null,
    backendMismatch: !!meta?.backend && meta.backend !== currentBackend,
  }
}

export function listBackups(): BackupRecord[] {
  const cfg = readBackupConfig()
  fs.mkdirSync(cfg.backupDir, { recursive: true })
  return fs.readdirSync(cfg.backupDir)
    .map((fileName) => parseFile(path.join(cfg.backupDir, fileName)))
    .filter((item): item is BackupRecord => Boolean(item))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

function pruneSlot(slot: BackupRecord['slot'], keep: number) {
  const rows = listBackups().filter((row) => row.slot === slot)
  const grouped = new Map<string, BackupRecord[]>()
  for (const row of rows) {
    const arr = grouped.get(row.label) || []
    arr.push(row)
    grouped.set(row.label, arr)
  }
  Array.from(grouped.keys()).sort().reverse().slice(keep).forEach((label) => {
    for (const row of grouped.get(label) || []) {
      if (fs.existsSync(row.filePath)) fs.unlinkSync(row.filePath)
    }
  })
}

function buildLabel(slot: BackupRecord['slot'], d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  if (slot === 'hourly') return `${y}${m}${day}-${h}`
  if (slot === 'daily') return `${y}${m}${day}`
  if (slot === 'monthly') return `${y}-${m}`
  if (slot === 'yearly') return `${y}`
  const oneJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = String(Math.ceil((((d.getTime() - oneJan.getTime()) / 86400000) + oneJan.getUTCDay() + 1) / 7)).padStart(2, '0')
  return `${y}-W${week}`
}

export function runBackupNow(passwordOverride?: string) {
  const cfg = readBackupConfig()
  const source = getSourceFile()
  const backend = readDbBackend()
  if (!fs.existsSync(source)) throw new Error(`Quelldatei nicht gefunden: ${source}`)
  fs.mkdirSync(cfg.backupDir, { recursive: true })
  const now = new Date()
  const sourceBuffer = fs.readFileSync(source)
  const metaBuffer = Buffer.from(`${BACKUP_META_PREFIX}${JSON.stringify({ backend, createdAt: now.toISOString(), sourceFile: source })}\n`, 'utf8')
  const raw = Buffer.concat([metaBuffer, sourceBuffer])
  const shouldEncrypt = cfg.encrypt
  const password = passwordOverride || process.env.VULNLEDGER_BACKUP_PASSWORD
  if (shouldEncrypt && !password) throw new Error('Backup-Verschlüsselung ist aktiv, aber kein Kennwort gesetzt')
  const finalBuffer = shouldEncrypt ? encryptBuffer(raw, password as string) : raw
  const ext = shouldEncrypt ? 'enc' : 'bak'
  const slots: BackupRecord['slot'][] = ['hourly', 'daily', 'weekly', 'monthly', 'yearly']
  const created: BackupRecord[] = []
  for (const slot of slots) {
    const label = buildLabel(slot, now)
    const fileName = `backup-${slot}-${label}.${ext}`
    const filePath = path.join(cfg.backupDir, fileName)
    fs.writeFileSync(filePath, finalBuffer)
    created.push({ fileName, filePath, createdAt: now.toISOString(), size: finalBuffer.length, encrypted: shouldEncrypt, slot, label, backend, backendMismatch: false })
  }
  pruneSlot('hourly', cfg.retention.hourly)
  pruneSlot('daily', cfg.retention.daily)
  pruneSlot('weekly', cfg.retention.weekly)
  pruneSlot('monthly', cfg.retention.monthly)
  pruneSlot('yearly', cfg.retention.yearly)
  updateBackupStatus({ lastRunAt: now.toISOString(), lastSuccessAt: now.toISOString(), lastErrorAt: undefined, lastErrorMessage: undefined })
  return { ok: true, created, backups: listBackups() }
}

function assertRestorePayloadLooksSafe(fileName: string, payload: Buffer, meta: { backend?: DbBackend } | null) {
  if (!payload || payload.length === 0) throw new Error('Backup-Inhalt ist leer')
  if ((meta?.backend || readDbBackend()) === 'lowdb') {
    try {
      JSON.parse(payload.toString('utf8'))
    } catch {
      throw new Error('Backup-Datei enthält ungültiges JSON')
    }
  }
  if ((meta?.backend || readDbBackend()) === 'sqlite') {
    if (payload.length < 16) throw new Error('SQLite-Backup ist offensichtlich ungültig')
  }
  if (!fileName.startsWith('backup-')) throw new Error('Ungültiger Backup-Dateiname')
}

export function inspectBackupBuffer(fileName: string, raw: Buffer, encrypted: boolean, passwordOverride?: string): BackupPreflightResult {
  const { meta, payload } = splitBackupPayload(raw, encrypted, passwordOverride)
  assertRestorePayloadLooksSafe(fileName, payload, meta)
  const currentBackend = readDbBackend()
  const backupBackend = (meta?.backend as DbBackend | undefined) || null
  const backendMismatch = !!backupBackend && backupBackend !== currentBackend
  const migrationRequired = false
  const warnings: string[] = []
  if (!meta) warnings.push('Backup enthält keine auswertbaren Metadaten.')
  if (backendMismatch) warnings.push(`Backup-Backend '${backupBackend}' passt nicht zum aktiven Backend '${currentBackend}'.`)
  if (encrypted && !passwordOverride && !process.env.VULNLEDGER_BACKUP_PASSWORD) warnings.push('Für verschlüsselte Backups ist aktuell kein Laufzeitkennwort gesetzt.')
  return { ok: warnings.filter((item) => item.includes('passt nicht')).length === 0, fileName, encrypted, currentBackend, backupBackend, backendMismatch, migrationRequired, sizeBytes: payload.length, warnings }
}

async function restoreBackupBuffer(fileName: string, raw: Buffer, encrypted: boolean, passwordOverride?: string) {
  const preflight = inspectBackupBuffer(fileName, raw, encrypted, passwordOverride)
  if (!preflight.ok) throw new Error(preflight.warnings[0] || 'Backup-Vorprüfung fehlgeschlagen')
  const { meta, payload } = splitBackupPayload(raw, encrypted, passwordOverride)
  const currentBackend = readDbBackend()
  if (meta?.backend && meta.backend !== currentBackend) {
    throw new Error(`Backup-Backend '${meta.backend}' passt nicht zum aktuell aktiven Backend '${currentBackend}'. Bitte Zielsystem umstellen.`)
  }
  const targetFile = getSourceFile()
  fs.mkdirSync(path.dirname(targetFile), { recursive: true })
  fs.writeFileSync(targetFile, payload)
  updateBackupStatus({ lastErrorAt: undefined, lastErrorMessage: undefined })
  return { ok: true, restoredFrom: fileName, restoredAt: new Date().toISOString(), targetFile, backend: meta?.backend || currentBackend, backendMismatch: false }
}

export function inspectBackup(fileName: string, passwordOverride?: string) {
  const backup = listBackups().find((row) => row.fileName === fileName)
  if (!backup) throw new Error('Backup nicht gefunden')
  return inspectBackupBuffer(backup.fileName, fs.readFileSync(backup.filePath), backup.encrypted, passwordOverride)
}

export async function restoreBackup(fileName: string, passwordOverride?: string) {
  const backup = listBackups().find((row) => row.fileName === fileName)
  if (!backup) throw new Error('Backup nicht gefunden')
  return restoreBackupBuffer(backup.fileName, fs.readFileSync(backup.filePath), backup.encrypted, passwordOverride)
}

export function inspectUploadedBackup(fileName: string, raw: Buffer, passwordOverride?: string) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext !== '.bak' && ext !== '.enc') throw new Error('Nur Backup-Dateien mit .bak oder .enc sind erlaubt')
  return inspectBackupBuffer(fileName, raw, ext === '.enc', passwordOverride)
}

export async function restoreUploadedBackup(fileName: string, raw: Buffer, passwordOverride?: string) {
  const ext = path.extname(fileName).toLowerCase()
  if (ext !== '.bak' && ext !== '.enc') throw new Error('Nur Backup-Dateien mit .bak oder .enc sind erlaubt')
  return restoreBackupBuffer(fileName, raw, ext === '.enc', passwordOverride)
}

let backupTimer: NodeJS.Timeout | null = null
export function startBackupScheduler() {
  if (backupTimer) clearTimeout(backupTimer)
  backupTimer = null
  const cfg = readBackupConfig()
  if (!cfg.enabled) return
  const schedule = () => {
    const now = new Date()
    const next = new Date(now)
    next.setMinutes(0, 0, 0)
    next.setHours(next.getHours() + 1)
    const delay = Math.max(1000, next.getTime() - now.getTime())
    backupTimer = setTimeout(() => {
      try {
        const current = readBackupConfig()
        if (current.enabled) runBackupNow(process.env.VULNLEDGER_BACKUP_PASSWORD)
      } catch (error) {
        console.error('[Backup] Scheduler-Lauf fehlgeschlagen', error)
      } finally {
        schedule()
      }
    }, delay)
  }
  schedule()
}
