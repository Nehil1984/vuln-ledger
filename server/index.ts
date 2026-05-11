import express from 'express'
import session from 'express-session'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { createUser, getDbBackend, listUsers, setDbBackend, verifyUser } from './storage.js'
import type { DbBackend, UserRole } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()

app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET || 'vulnledger-dev-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 8 * 60 * 60 * 1000,
  },
}))

type SessionUser = {
  id: string
  username: string
  role: UserRole
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser
  }
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(['admin', 'user']),
})

const dbSchema = z.object({
  dbBackend: z.enum(['lowdb', 'sqlite']),
})

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.user) return res.status(401).json({ message: 'Nicht authentifiziert' })
  next()
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ message: 'Nur für Admins' })
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, backend: getDbBackend() })
})

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Ungültige Login-Daten' })

  const user = await verifyUser(parsed.data.username, parsed.data.password)
  if (!user) return res.status(401).json({ message: 'Benutzername oder Passwort falsch' })

  req.session.user = { id: user.id, username: user.username, role: user.role }
  res.json({ user: req.session.user, backend: getDbBackend() })
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Nicht authentifiziert' })
  res.json({ user: req.session.user, backend: getDbBackend() })
})

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  const users = await listUsers()
  res.json(users.map((user) => ({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt })))
})

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Ungültige Benutzerdaten' })
  const user = await createUser(parsed.data.username, parsed.data.password, parsed.data.role)
  res.status(201).json({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt })
})

app.get('/api/admin/db-config', requireAuth, requireAdmin, (_req, res) => {
  res.json({ dbBackend: getDbBackend() })
})

app.post('/api/admin/db-config', requireAuth, requireAdmin, (req, res) => {
  const parsed = dbSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Ungültiges DB-Backend' })
  setDbBackend(parsed.data.dbBackend as DbBackend)
  res.json({ ok: true, dbBackend: getDbBackend() })
})

const clientDist = path.resolve(__dirname, '..', 'dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  console.log(`VulnLedger server listening on ${port}`)
})
