// Copyright 2026 Daniel Schuh
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0

import express, { type Request, type Response } from 'express'
import session from 'express-session'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  inspectBackup,
  inspectUploadedBackup,
  listBackups,
  readBackupConfig,
  readBackupStatus,
  restoreBackup,
  restoreUploadedBackup,
  runBackupNow,
  startBackupScheduler,
  writeBackupConfig,
} from './backup.js'
import {
  createAssessment,
  createCustomer,
  createEvidence,
  createFinding,
  createReport,
  createRetest,
  createUser,
  getDbBackend,
  migrateDbBackend,
  getLicense,
  listAssessments,
  listCustomers,
  listEvidence,
  listFindings,
  listReports,
  listRetests,
  listUsers,
  updateAssessmentStatus,
  updateFindingStatus,
  updateLicense,
  updateReportStatus,
  verifyUser,
  type EvidenceWithFile,
} from './storage.js'
import type { AssessmentRecord, DbBackend, FindingRecord, ReportRecord, UserRole } from './models.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const evidenceDir = path.resolve(process.cwd(), 'data', 'evidence')
fs.mkdirSync(evidenceDir, { recursive: true })

app.use(express.json({ limit: '10mb' }))
app.use(session({ secret: process.env.SESSION_SECRET || 'vulnledger-dev-session-secret-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 } }))

type SessionUser = { id: string; username: string; role: UserRole }
type ErrorWithMessage = { message?: string }
function getErrorMessage(error: unknown, fallback: string) { if (typeof error === 'object' && error && 'message' in error) return (error as ErrorWithMessage).message || fallback; return fallback }

declare module 'express-session' { interface SessionData { user?: SessionUser } }

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) })
const createUserSchema = z.object({ username: z.string().min(3), password: z.string().min(8), role: z.enum(['admin', 'user']) })
const dbSchema = z.object({ dbBackend: z.enum(['lowdb', 'sqlite']) })
const backupConfigSchema = z.object({ enabled: z.boolean().optional(), backupDir: z.string().trim().optional(), encrypt: z.boolean().optional(), passwordHint: z.string().trim().optional(), retention: z.object({ hourly: z.number().int().min(1).max(168).optional(), daily: z.number().int().min(1).max(366).optional(), weekly: z.number().int().min(1).max(104).optional(), monthly: z.number().int().min(1).max(120).optional(), yearly: z.number().int().min(1).max(20).optional() }).optional() })
const backupRestoreSchema = z.object({ fileName: z.string().min(1), password: z.string().optional(), dryRun: z.boolean().optional() })
const licenseSchema = z.object({ status: z.enum(['active', 'inactive', 'trial']).optional(), plan: z.string().min(1).optional(), key: z.string().min(1).optional(), seats: z.number().int().min(1).optional(), customer: z.string().min(1).optional(), validUntil: z.string().min(1).optional(), issuedAt: z.string().min(1).optional(), notes: z.string().optional() })
const customerSchema = z.object({ id: z.string().min(1), name: z.string().min(1), sector: z.string().min(1), contactName: z.string().min(1), contactEmail: z.string().email(), contactPhone: z.string().optional().default(''), notes: z.string().optional().default('') })
const assessmentSchema = z.object({ id: z.string().min(1), title: z.string().min(1), customerId: z.string().min(1), type: z.string().min(1), mode: z.string().min(1), status: z.enum(['Geplant', 'Aktiv', 'Review', 'Abgeschlossen']), scope: z.string().min(1), leadTester: z.string().min(1), rulesOfEngagement: z.string().min(1) })
const findingSchema = z.object({ id: z.string().min(1), assessmentId: z.string().min(1), title: z.string().min(1), target: z.string().min(1), severity: z.enum(['Critical', 'High', 'Medium', 'Low']), status: z.enum(['Offen', 'Bestätigt', 'In Bearbeitung', 'Behoben']), cvssScore: z.string().optional().default(''), cwe: z.string().optional().default(''), recommendation: z.string().min(1) })
const reportSchema = z.object({ id: z.string().min(1), assessmentId: z.string().min(1), title: z.string().min(1), status: z.enum(['Draft', 'Internes Review', 'Freigegeben', 'Exportiert']), summary: z.string().min(1) })
const evidenceSchema = z.object({ id: z.string().min(1), findingId: z.string().min(1), assessmentId: z.string().min(1), type: z.enum(['Screenshot', 'Request', 'Response', 'Terminal', 'Datei', 'Notiz']), title: z.string().min(1), content: z.string().min(1), fileName: z.string().optional(), filePath: z.string().optional(), contentType: z.string().optional() })
const retestSchema = z.object({ id: z.string().min(1), findingId: z.string().min(1), assessmentId: z.string().min(1), result: z.enum(['Offen', 'Teilweise behoben', 'Behoben', 'Nicht reproduzierbar']), tester: z.string().min(1), notes: z.string().min(1) })
const assessmentStatusSchema = z.object({ status: z.enum(['Geplant', 'Aktiv', 'Review', 'Abgeschlossen']) })
const findingStatusSchema = z.object({ status: z.enum(['Offen', 'Bestätigt', 'In Bearbeitung', 'Behoben']) })
const reportStatusSchema = z.object({ status: z.enum(['Draft', 'Internes Review', 'Freigegeben', 'Exportiert']) })

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) { if (!req.session.user) return res.status(401).json({ message: 'Nicht authentifiziert' }); next() }
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) { if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ message: 'Nur für Admins' }); next() }

app.get('/api/health', (_req, res) => res.json({ ok: true, backend: getDbBackend(), license: getLicense().status }))
app.get('/api/license', (_req, res) => res.json(getLicense()))
app.post('/api/auth/login', async (req, res) => { const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Login-Daten' }); const user = await verifyUser(parsed.data.username, parsed.data.password); if (!user) return res.status(401).json({ message: 'Benutzername oder Passwort falsch' }); req.session.user = { id: user.id, username: user.username, role: user.role }; res.json({ user: req.session.user, backend: getDbBackend(), license: getLicense() }) })
app.post('/api/auth/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })) })
app.get('/api/auth/me', (req, res) => { if (!req.session.user) return res.status(401).json({ message: 'Nicht authentifiziert' }); res.json({ user: req.session.user, backend: getDbBackend(), license: getLicense() }) })
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => { const users = await listUsers(); res.json(users.map((user) => ({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt }))) })
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => { const parsed = createUserSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Benutzerdaten' }); const user = await createUser(parsed.data.username, parsed.data.password, parsed.data.role); res.status(201).json({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt }) })
app.get('/api/admin/db-config', requireAuth, requireAdmin, (_req, res) => res.json({ dbBackend: getDbBackend() }))
app.post('/api/admin/db-config', requireAuth, requireAdmin, async (req, res) => { const parsed = dbSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültiges DB-Backend' }); const result = await migrateDbBackend(parsed.data.dbBackend as DbBackend); res.json({ ...result, dbBackend: getDbBackend() }) })
app.get('/api/admin/license', requireAuth, requireAdmin, (_req, res) => res.json(getLicense()))
app.post('/api/admin/license', requireAuth, requireAdmin, (req, res) => { const parsed = licenseSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Lizenzdaten' }); res.json(updateLicense(parsed.data)) })
app.get('/api/admin/backups/config', requireAuth, requireAdmin, (_req, res) => { const cfg = readBackupConfig(); res.json({ backupDir: cfg.backupDir, retention: cfg.retention, encrypt: cfg.encrypt, passwordHint: cfg.passwordHint || '', ...readBackupStatus() }) })
app.post('/api/admin/backups/config', requireAuth, requireAdmin, (req, res) => { const parsed = backupConfigSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Backup-Konfiguration' }); const cfg = writeBackupConfig(parsed.data as Parameters<typeof writeBackupConfig>[0]); startBackupScheduler(); res.json({ backupDir: cfg.backupDir, retention: cfg.retention, encrypt: cfg.encrypt, passwordHint: cfg.passwordHint || '', ...readBackupStatus() }) })
app.get('/api/admin/backups', requireAuth, requireAdmin, (_req, res) => res.json(listBackups()))
app.post('/api/admin/backups/run', requireAuth, requireAdmin, (req, res) => { try { res.json(runBackupNow(req.body?.password)) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Backup fehlgeschlagen') }) } })
app.post('/api/admin/backups/restore', requireAuth, requireAdmin, async (req, res) => { const parsed = backupRestoreSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Restore-Anfrage' }); try { const preflight = inspectBackup(parsed.data.fileName, parsed.data.password); if (parsed.data.dryRun === true) return res.json({ ok: true, dryRun: true, preflight }); const result = await restoreBackup(parsed.data.fileName, parsed.data.password); res.json({ ...result, preflight }) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Backup konnte nicht wiederhergestellt werden') }) } })
type RawUploadRequest = Request & { body: Buffer; query: Record<string, string | undefined> }
app.post('/api/admin/backups/restore-upload', requireAuth, requireAdmin, express.raw({ type: 'application/octet-stream', limit: '250mb' }), async (req: RawUploadRequest, res: Response) => { try { const fileName = String(req.query.fileName || '').trim(); const password = typeof req.query.password === 'string' ? req.query.password : undefined; const dryRun = String(req.query.dryRun || '').trim() === 'true'; if (!fileName) return res.status(400).json({ message: 'Dateiname fehlt' }); if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: 'Keine Backup-Datei hochgeladen' }); const preflight = inspectUploadedBackup(fileName, req.body, password); if (dryRun) return res.json({ ok: true, dryRun: true, preflight }); const result = await restoreUploadedBackup(fileName, req.body, password); res.json({ ...result, preflight }) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Hochgeladenes Backup konnte nicht wiederhergestellt werden') }) } })
app.get('/api/customers', requireAuth, async (_req, res) => { try { res.json(await listCustomers()) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Kunden konnten nicht geladen werden') }) } })
app.post('/api/customers', requireAuth, async (req, res) => { const parsed = customerSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Kundendaten' }); try { res.status(201).json(await createCustomer(parsed.data)) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Kunde konnte nicht gespeichert werden') }) } })
app.get('/api/assessments', requireAuth, async (_req, res) => { try { res.json(await listAssessments()) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Assessments konnten nicht geladen werden') }) } })
app.post('/api/assessments', requireAuth, async (req, res) => { const parsed = assessmentSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Assessment-Daten' }); try { res.status(201).json(await createAssessment(parsed.data)) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Assessment konnte nicht gespeichert werden') }) } })
app.patch('/api/assessments/:id/status', requireAuth, async (req, res) => { const parsed = assessmentStatusSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültiger Assessment-Status' }); try { const assessmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id; const updated = await updateAssessmentStatus(assessmentId, parsed.data.status as AssessmentRecord['status']); if (!updated) return res.status(404).json({ message: 'Assessment nicht gefunden' }); res.json(updated) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Assessment-Status konnte nicht aktualisiert werden') }) } })
app.get('/api/findings', requireAuth, async (_req, res) => { try { res.json(await listFindings()) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Findings konnten nicht geladen werden') }) } })
app.post('/api/findings', requireAuth, async (req, res) => { const parsed = findingSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Finding-Daten' }); try { res.status(201).json(await createFinding(parsed.data)) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Finding konnte nicht gespeichert werden') }) } })
app.patch('/api/findings/:id/status', requireAuth, async (req, res) => { const parsed = findingStatusSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültiger Finding-Status' }); try { const findingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id; const updated = await updateFindingStatus(findingId, parsed.data.status as FindingRecord['status']); if (!updated) return res.status(404).json({ message: 'Finding nicht gefunden' }); res.json(updated) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Finding-Status konnte nicht aktualisiert werden') }) } })
app.get('/api/reports', requireAuth, async (_req, res) => { try { res.json(await listReports()) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Reports konnten nicht geladen werden') }) } })
app.post('/api/reports', requireAuth, async (req, res) => { const parsed = reportSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Report-Daten' }); try { res.status(201).json(await createReport(parsed.data)) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Report konnte nicht gespeichert werden') }) } })
app.patch('/api/reports/:id/status', requireAuth, async (req, res) => { const parsed = reportStatusSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültiger Report-Status' }); try { const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id; const updated = await updateReportStatus(reportId, parsed.data.status as ReportRecord['status']); if (!updated) return res.status(404).json({ message: 'Report nicht gefunden' }); res.json(updated) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Report-Status konnte nicht aktualisiert werden') }) } })
app.get('/api/evidence', requireAuth, async (_req, res) => { try { res.json(await listEvidence()) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Evidence konnte nicht geladen werden') }) } })
app.post('/api/evidence', requireAuth, async (req, res) => { const parsed = evidenceSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Evidence-Daten' }); try { res.status(201).json(await createEvidence(parsed.data)) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Evidence konnte nicht gespeichert werden') }) } })
type EvidenceUploadRequest = Request & { body: Buffer; query: Record<string, string | undefined> }
app.post('/api/evidence/upload', requireAuth, express.raw({ type: '*/*', limit: '50mb' }), async (req: EvidenceUploadRequest, res: Response) => { try { const findingId = String(req.query.findingId || '').trim(); const assessmentId = String(req.query.assessmentId || '').trim(); const title = String(req.query.title || '').trim(); const type = String(req.query.type || 'Datei').trim(); if (!findingId || !assessmentId || !title) return res.status(400).json({ message: 'findingId, assessmentId und title sind erforderlich' }); if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: 'Keine Datei hochgeladen' }); const originalName = String(req.query.fileName || 'evidence.bin').trim(); const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_'); const evidenceId = `e${Date.now()}`; const storedPath = path.join(evidenceDir, `${evidenceId}-${safeName}`); fs.writeFileSync(storedPath, req.body); const row: Omit<EvidenceWithFile, 'createdAt'> = { id: evidenceId, findingId, assessmentId, type: type as EvidenceWithFile['type'], title, content: `Datei hochgeladen: ${originalName}`, fileName: originalName, filePath: storedPath, contentType: req.headers['content-type'] || 'application/octet-stream' }; const created = await createEvidence(row); res.status(201).json(created) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Evidence-Upload fehlgeschlagen') }) } })
app.get('/api/retests', requireAuth, async (_req, res) => { try { res.json(await listRetests()) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Retests konnten nicht geladen werden') }) } })
app.post('/api/retests', requireAuth, async (req, res) => { const parsed = retestSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Ungültige Retest-Daten' }); try { res.status(201).json(await createRetest(parsed.data)) } catch (error: unknown) { res.status(400).json({ message: getErrorMessage(error, 'Retest konnte nicht gespeichert werden') }) } })
app.use('/api/evidence/files', requireAuth, express.static(evidenceDir))

startBackupScheduler()
const appRoot = path.resolve(__dirname, '..', '..')
const clientDist = path.join(appRoot, 'dist')
app.use(express.static(clientDist))
app.get('/{*any}', (_req, res) => { res.sendFile(path.join(clientDist, 'index.html')) })
const port = Number(process.env.PORT || 3000)
app.listen(port, () => { console.log(`VulnLedger server listening on ${port}`) })
