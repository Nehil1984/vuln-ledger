// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import express from 'express'
import session from 'express-session'
import createMemoryStore from 'memorystore'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { inspectBackup, inspectUploadedBackup, listBackups, readBackupConfig, readBackupStatus, restoreBackup, restoreUploadedBackup, runBackupNow, startBackupScheduler, writeBackupConfig } from './backup.js'
import { canGenerateReports, canReadTenant, canWriteTenant, createAssessment, createCustomer, createEvidence, createFinding, createGroup, createReport, createRetest, createUser, getDbBackend, listAssessments, listCustomers, listEvidence, listFindings, listGroups, listReports, listRetests, listUsers, migrateDbBackend, updateAssessmentStatus, updateCustomer, updateFindingStatus, updateGroup, updateReportStatus, verifyUser, type EvidenceWithFile, type GroupInput } from './storage.js'
import type { AssessmentRecord, CustomerRecord, DbBackend, FindingRecord, ReportRecord, UserRecord, UserRole } from './models.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const evidenceDir = path.resolve(process.cwd(), 'data', 'evidence')
const MemoryStore = createMemoryStore(session)
fs.mkdirSync(evidenceDir, { recursive: true })

app.use(express.json({ limit: '10mb' }))
app.use(session({
  secret: process.env.SESSION_SECRET || 'vulnledger-dev-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 },
}))

type SessionUser = { id: string; username: string; role: UserRole; tenantIds: string[] }
declare module 'express-session' { interface SessionData { user?: SessionUser } }

type ErrorWithMessage = { message?: string }
const msg = (error: unknown, fallback: string) => typeof error === 'object' && error && 'message' in error ? ((error as ErrorWithMessage).message || fallback) : fallback

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) })
const createUserSchema = z.object({ username: z.string().min(3), password: z.string().min(8), role: z.enum(['admin', 'verwalter', 'techniker', 'user']), tenantIds: z.array(z.string()).default([]) })
const groupSchema = z.object({ id: z.string().min(1), name: z.string().min(1), description: z.string().default(''), tenantIds: z.array(z.string()).default([]) })
const customerSchema = z.object({ id: z.string().min(1), groupId: z.string().optional(), name: z.string().min(1), sector: z.string().min(1), contactName: z.string().min(1), contactEmail: z.string().email(), contactPhone: z.string().default(''), notes: z.string().default('') })
const assessmentSchema = z.object({ id: z.string().min(1), customerId: z.string().min(1), title: z.string().min(1), type: z.string().min(1), mode: z.string().min(1), status: z.enum(['Geplant', 'Aktiv', 'Review', 'Abgeschlossen']), scope: z.string().min(1), leadTester: z.string().min(1), rulesOfEngagement: z.string().min(1) })
const findingSchema = z.object({ id: z.string().min(1), customerId: z.string().min(1), assessmentId: z.string().min(1), title: z.string().min(1), target: z.string().min(1), severity: z.enum(['Critical', 'High', 'Medium', 'Low']), status: z.enum(['Offen', 'Bestätigt', 'In Bearbeitung', 'Behoben']), cvssScore: z.string().default(''), cwe: z.string().default(''), recommendation: z.string().min(1) })
const reportSchema = z.object({ id: z.string().min(1), scopeType: z.enum(['tenant', 'group']), customerId: z.string().optional(), groupId: z.string().optional(), assessmentId: z.string().optional(), title: z.string().min(1), status: z.enum(['Draft', 'Internes Review', 'Freigegeben', 'Exportiert']), summary: z.string().min(1) })
const evidenceSchema = z.object({ id: z.string().min(1), customerId: z.string().min(1), findingId: z.string().min(1), assessmentId: z.string().min(1), type: z.enum(['Screenshot', 'Request', 'Response', 'Terminal', 'Datei', 'Notiz']), title: z.string().min(1), content: z.string().min(1), fileName: z.string().optional(), filePath: z.string().optional(), contentType: z.string().optional() })
const retestSchema = z.object({ id: z.string().min(1), customerId: z.string().min(1), findingId: z.string().min(1), assessmentId: z.string().min(1), result: z.enum(['Offen', 'Teilweise behoben', 'Behoben', 'Nicht reproduzierbar']), tester: z.string().min(1), notes: z.string().min(1) })
const dbSchema = z.object({ dbBackend: z.enum(['lowdb', 'sqlite']) })
const assessmentStatusSchema = z.object({ status: z.enum(['Geplant', 'Aktiv', 'Review', 'Abgeschlossen']) })
const findingStatusSchema = z.object({ status: z.enum(['Offen', 'Bestätigt', 'In Bearbeitung', 'Behoben']) })
const reportStatusSchema = z.object({ status: z.enum(['Draft', 'Internes Review', 'Freigegeben', 'Exportiert']) })
const backupConfigSchema = z.object({ enabled: z.boolean().optional(), encrypt: z.boolean().optional(), passwordHint: z.string().optional(), retention: z.object({ hourly: z.number().int().min(1).max(168).optional(), daily: z.number().int().min(1).max(366).optional(), weekly: z.number().int().min(1).max(104).optional(), monthly: z.number().int().min(1).max(120).optional(), yearly: z.number().int().min(1).max(20).optional() }).optional() })
const backupRestoreSchema = z.object({ fileName: z.string().min(1), password: z.string().optional(), dryRun: z.boolean().optional() })

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) { if (!req.session.user) return res.status(401).json({ message: 'Nicht authentifiziert' }); next() }
async function currentUser(req: express.Request): Promise<UserRecord | null> { return (await listUsers()).find((user) => user.id === req.session.user?.id) ?? null }
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) { if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ message: 'Nur für Admins' }); next() }
function requireManagerOrAdmin(req: express.Request, res: express.Response, next: express.NextFunction) { if (!req.session.user || !['admin', 'verwalter'].includes(req.session.user.role)) return res.status(403).json({ message: 'Nur für Admin oder Verwalter' }); next(); }

app.get('/api/health', (_req, res) => res.json({ ok: true, backend: getDbBackend() }))
app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Ungültige Login-Daten' })

  const user = await verifyUser(parsed.data.username, parsed.data.password)
  if (!user) return res.status(401).json({ message: 'Benutzername oder Passwort falsch' })

  req.session.user = { id: user.id, username: user.username, role: user.role, tenantIds: user.tenantIds }
  req.session.save((error) => {
    if (error) {
      console.error('session save failed after login', error)
      return res.status(500).json({ message: 'Session konnte nicht gespeichert werden' })
    }
    res.json({ user: req.session.user, backend: getDbBackend() })
  })
})
app.post('/api/auth/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })) })
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.session.user, backend: getDbBackend() }))

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => { const users = await listUsers(); res.json(users.map((user) => ({ id: user.id, username: user.username, role: user.role, tenantIds: user.tenantIds, createdAt: user.createdAt }))) })
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => { const parsed = createUserSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Benutzerdaten' }); const user = await createUser(parsed.data); res.status(201).json({ id: user.id, username: user.username, role: user.role, tenantIds: user.tenantIds, createdAt: user.createdAt }) })
app.get('/api/admin/db-config', requireAuth, requireAdmin, (_req, res) => res.json({ dbBackend: getDbBackend() }))
app.post('/api/admin/db-config', requireAuth, requireAdmin, async (req, res) => { const parsed = dbSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültiges DB-Backend' }); res.json(await migrateDbBackend(parsed.data.dbBackend as DbBackend)) })
app.get('/api/admin/backups/config', requireAuth, requireAdmin, (_req, res) => { const cfg = readBackupConfig(); res.json({ backupDir: cfg.backupDir, retention: cfg.retention, encrypt: cfg.encrypt, passwordHint: cfg.passwordHint || '', ...readBackupStatus() }) })
app.post('/api/admin/backups/config', requireAuth, requireAdmin, (req, res) => { const parsed = backupConfigSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Backup-Konfiguration' }); const cfg = writeBackupConfig(parsed.data as Parameters<typeof writeBackupConfig>[0]); startBackupScheduler(); res.json({ backupDir: cfg.backupDir, retention: cfg.retention, encrypt: cfg.encrypt, passwordHint: cfg.passwordHint || '', ...readBackupStatus() }) })
app.get('/api/admin/backups', requireAuth, requireAdmin, (_req, res) => res.json(listBackups()))
app.post('/api/admin/backups/run', requireAuth, requireAdmin, (req, res) => { try { res.json(runBackupNow(req.body?.password)) } catch (error: unknown) { res.status(400).json({ message: msg(error, 'Backup fehlgeschlagen') }) } })
app.post('/api/admin/backups/restore', requireAuth, requireAdmin, async (req, res) => { const parsed = backupRestoreSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Restore-Anfrage' }); try { const preflight = inspectBackup(parsed.data.fileName, parsed.data.password); if (parsed.data.dryRun) return res.json({ ok: true, dryRun: true, preflight }); const result = await restoreBackup(parsed.data.fileName, parsed.data.password); res.json({ ...result, preflight }) } catch (error: unknown) { res.status(400).json({ message: msg(error, 'Backup konnte nicht wiederhergestellt werden') }) } })
app.post('/api/admin/backups/restore-upload', requireAuth, requireAdmin, express.raw({ type: 'application/octet-stream', limit: '250mb' }), async (req: express.Request & { body: Buffer; query: Record<string, string | undefined> }, res) => { try { const fileName = String(req.query.fileName || '').trim(); const password = typeof req.query.password === 'string' ? req.query.password : undefined; const dryRun = String(req.query.dryRun || '').trim() === 'true'; if (!fileName) return res.status(400).json({ message: 'Dateiname fehlt' }); if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: 'Keine Backup-Datei hochgeladen' }); const preflight = inspectUploadedBackup(fileName, req.body, password); if (dryRun) return res.json({ ok: true, dryRun: true, preflight }); const result = await restoreUploadedBackup(fileName, req.body, password); res.json({ ...result, preflight }) } catch (error: unknown) { res.status(400).json({ message: msg(error, 'Hochgeladenes Backup konnte nicht wiederhergestellt werden') }) } })

app.get('/api/groups', requireAuth, async (req, res) => {
  const user = await currentUser(req)
  if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' })
  const groups = await listGroups()
  res.json(user.role === 'admin' ? groups : groups.filter((group) => group.tenantIds.some((tenantId) => user.tenantIds.includes(tenantId))))
})
app.post('/api/groups', requireAuth, requireManagerOrAdmin, async (req, res) => { const parsed = groupSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Konzern-Daten' }); const input: GroupInput = { id: parsed.data.id, name: parsed.data.name, description: parsed.data.description, tenantIds: parsed.data.tenantIds }; res.status(201).json(await createGroup(input)) })
app.put('/api/groups/:id', requireAuth, requireManagerOrAdmin, async (req, res) => { const parsed = groupSchema.safeParse({ ...req.body, id: req.params.id }); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Konzern-Daten' }); const updated = await updateGroup({ id: parsed.data.id, name: parsed.data.name, description: parsed.data.description, tenantIds: parsed.data.tenantIds, createdAt: new Date().toISOString() }); if (!updated) return res.status(404).json({ message: 'Konzern nicht gefunden' }); res.json(updated) })

app.get('/api/customers', requireAuth, async (req, res) => { const user = await currentUser(req); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); const rows = await listCustomers(); res.json(user.role === 'admin' ? rows : rows.filter((row) => canReadTenant(user, row.id))) })
app.post('/api/customers', requireAuth, requireManagerOrAdmin, async (req, res) => { const parsed = customerSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Mandanten-Daten' }); res.status(201).json(await createCustomer(parsed.data)) })
app.put('/api/customers/:id', requireAuth, requireManagerOrAdmin, async (req, res) => { const parsed = customerSchema.safeParse({ ...req.body, id: req.params.id }); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Mandanten-Daten' }); const updated = await updateCustomer(parsed.data as CustomerRecord); if (!updated) return res.status(404).json({ message: 'Mandant nicht gefunden' }); res.json(updated) })

app.get('/api/assessments', requireAuth, async (req, res) => { const user = await currentUser(req); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); const rows = await listAssessments(); res.json(user.role === 'admin' ? rows : rows.filter((row) => canReadTenant(user, row.customerId))) })
app.post('/api/assessments', requireAuth, async (req, res) => { const user = await currentUser(req); const parsed = assessmentSchema.safeParse(req.body); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Assessment-Daten' }); if (!canWriteTenant(user, parsed.data.customerId)) return res.status(403).json({ message: 'Keine Berechtigung für diesen Mandanten' }); res.status(201).json(await createAssessment(parsed.data)) })
app.patch('/api/assessments/:id/status', requireAuth, async (req, res) => { const user = await currentUser(req); const parsed = assessmentStatusSchema.safeParse(req.body); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); if (!parsed.success) return res.status(400).json({ message: 'Ungültiger Assessment-Status' }); const all = await listAssessments(); const row = all.find((entry) => entry.id === req.params.id); if (!row) return res.status(404).json({ message: 'Assessment nicht gefunden' }); if (!canWriteTenant(user, row.customerId)) return res.status(403).json({ message: 'Keine Berechtigung für diesen Mandanten' }); res.json(await updateAssessmentStatus(row.id, parsed.data.status as AssessmentRecord['status'])) })

app.get('/api/findings', requireAuth, async (req, res) => { const user = await currentUser(req); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); const rows = await listFindings(); res.json(user.role === 'admin' ? rows : rows.filter((row) => canReadTenant(user, row.customerId))) })
app.post('/api/findings', requireAuth, async (req, res) => { const user = await currentUser(req); const parsed = findingSchema.safeParse(req.body); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Finding-Daten' }); if (!canWriteTenant(user, parsed.data.customerId)) return res.status(403).json({ message: 'Keine Berechtigung für diesen Mandanten' }); res.status(201).json(await createFinding(parsed.data)) })
app.patch('/api/findings/:id/status', requireAuth, async (req, res) => { const user = await currentUser(req); const parsed = findingStatusSchema.safeParse(req.body); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); if (!parsed.success) return res.status(400).json({ message: 'Ungültiger Finding-Status' }); const all = await listFindings(); const row = all.find((entry) => entry.id === req.params.id); if (!row) return res.status(404).json({ message: 'Finding nicht gefunden' }); if (!canWriteTenant(user, row.customerId)) return res.status(403).json({ message: 'Keine Berechtigung für diesen Mandanten' }); res.json(await updateFindingStatus(row.id, parsed.data.status as FindingRecord['status'])) })

app.get('/api/reports', requireAuth, async (req, res) => {
  const user = await currentUser(req)
  if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' })
  const reports = await listReports()
  const groups = await listGroups()
  res.json(user.role === 'admin' ? reports : reports.filter((report) => {
    if (report.scopeType === 'tenant' && report.customerId) return canGenerateReports(user, report.customerId)
    if (report.scopeType === 'group' && report.groupId) {
      const group = groups.find((entry) => entry.id === report.groupId)
      return !!group && group.tenantIds.some((tenantId) => user.tenantIds.includes(tenantId))
    }
    return false
  }))
})
app.post('/api/reports', requireAuth, async (req, res) => {
  const user = await currentUser(req)
  const parsed = reportSchema.safeParse(req.body)
  if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' })
  if (!parsed.success) return res.status(400).json({ message: 'Ungültige Report-Daten' })
  const allowed = parsed.data.scopeType === 'tenant'
    ? !!parsed.data.customerId && canGenerateReports(user, parsed.data.customerId)
    : !!parsed.data.groupId && (user.role === 'admin' || (await listGroups()).find((group) => group.id === parsed.data.groupId)?.tenantIds.some((tenantId) => user.tenantIds.includes(tenantId)))
  if (!allowed) return res.status(403).json({ message: 'Keine Berechtigung für diesen Report-Kontext' })
  res.status(201).json(await createReport(parsed.data))
})
app.patch('/api/reports/:id/status', requireAuth, async (req, res) => { const parsed = reportStatusSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültiger Report-Status' }); const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id; const updated = await updateReportStatus(reportId, parsed.data.status as ReportRecord['status']); if (!updated) return res.status(404).json({ message: 'Report nicht gefunden' }); res.json(updated) })

app.get('/api/evidence', requireAuth, async (req, res) => { const user = await currentUser(req); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); const rows = await listEvidence(); res.json(user.role === 'admin' ? rows : rows.filter((row) => canReadTenant(user, row.customerId))) })
app.post('/api/evidence', requireAuth, async (req, res) => { const user = await currentUser(req); const parsed = evidenceSchema.safeParse(req.body); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Evidence-Daten' }); if (!canWriteTenant(user, parsed.data.customerId)) return res.status(403).json({ message: 'Keine Berechtigung für diesen Mandanten' }); res.status(201).json(await createEvidence(parsed.data)) })
app.post('/api/evidence/upload', requireAuth, express.raw({ type: '*/*', limit: '50mb' }), async (req: express.Request & { body: Buffer; query: Record<string, string | undefined> }, res) => {
  try {
    const user = await currentUser(req)
    if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' })
    const customerId = String(req.query.customerId || '').trim()
    const findingId = String(req.query.findingId || '').trim()
    const assessmentId = String(req.query.assessmentId || '').trim()
    const title = String(req.query.title || '').trim()
    const type = String(req.query.type || 'Datei').trim()
    if (!customerId || !findingId || !assessmentId || !title) return res.status(400).json({ message: 'customerId, findingId, assessmentId und title sind erforderlich' })
    if (!canWriteTenant(user, customerId)) return res.status(403).json({ message: 'Keine Berechtigung für diesen Mandanten' })
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: 'Keine Datei hochgeladen' })
    const originalName = String(req.query.fileName || 'evidence.bin').trim()
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const evidenceId = `e${Date.now()}`
    const storedPath = path.join(evidenceDir, `${evidenceId}-${safeName}`)
    fs.writeFileSync(storedPath, req.body)
    const row: Omit<EvidenceWithFile, 'createdAt'> = { id: evidenceId, customerId, findingId, assessmentId, type: type as EvidenceWithFile['type'], title, content: `Datei hochgeladen: ${originalName}`, fileName: originalName, filePath: storedPath, contentType: req.headers['content-type'] || 'application/octet-stream' }
    res.status(201).json(await createEvidence(row))
  } catch (error: unknown) { res.status(400).json({ message: msg(error, 'Evidence-Upload fehlgeschlagen') }) }
})

app.get('/api/retests', requireAuth, async (req, res) => { const user = await currentUser(req); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); const rows = await listRetests(); res.json(user.role === 'admin' ? rows : rows.filter((row) => canReadTenant(user, row.customerId))) })
app.post('/api/retests', requireAuth, async (req, res) => { const user = await currentUser(req); const parsed = retestSchema.safeParse(req.body); if (!user) return res.status(401).json({ message: 'Nicht authentifiziert' }); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Retest-Daten' }); if (!canWriteTenant(user, parsed.data.customerId)) return res.status(403).json({ message: 'Keine Berechtigung für diesen Mandanten' }); res.status(201).json(await createRetest(parsed.data)) })

app.use('/api/evidence/files', requireAuth, express.static(evidenceDir))

startBackupScheduler()
const appRoot = path.resolve(__dirname, '..', '..')
const clientDist = path.join(appRoot, 'dist')
app.use(express.static(clientDist, {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  },
}))
app.get('/{*any}', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.sendFile(path.join(clientDist, 'index.html'))
})
const port = Number(process.env.PORT || 3000)
app.listen(port, () => { console.log(`VulnLedger server listening on ${port}`) })
