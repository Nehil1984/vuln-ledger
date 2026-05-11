import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import type { UserRecord, UserRole } from './types.js'

const dataDir = path.resolve(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'vulnledger.sqlite')

let db: Database.Database | null = null

function getDb() {
  if (db) return db
  fs.mkdirSync(dataDir, { recursive: true })
  db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  ensureDefaultAdmin(db)
  return db
}

function ensureDefaultAdmin(database: Database.Database) {
  const existing = database.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined
  if (existing) return

  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123!'
  const passwordHash = bcrypt.hashSync(password, 10)
  database.prepare('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
    'u-admin',
    username,
    passwordHash,
    'admin',
    new Date().toISOString(),
  )
}

export async function listUsersSqlite(): Promise<UserRecord[]> {
  const database = getDb()
  const rows = database.prepare('SELECT id, username, password_hash, role, created_at FROM users ORDER BY created_at ASC').all() as Array<{ id: string; username: string; password_hash: string; role: string; created_at: string }>
  return rows.map((row) => ({ id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as UserRole, createdAt: row.created_at }))
}

export async function findUserByUsernameSqlite(username: string): Promise<UserRecord | null> {
  const database = getDb()
  const row = database.prepare('SELECT id, username, password_hash, role, created_at FROM users WHERE lower(username) = lower(?)').get(username) as { id: string; username: string; password_hash: string; role: string; created_at: string } | undefined
  if (!row) return null
  return { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as UserRole, createdAt: row.created_at }
}

export async function createUserSqlite(username: string, password: string, role: UserRole): Promise<UserRecord> {
  const database = getDb()
  const user: UserRecord = {
    id: `u-${Date.now()}`,
    username,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    createdAt: new Date().toISOString(),
  }
  database.prepare('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
    user.id,
    user.username,
    user.passwordHash,
    user.role,
    user.createdAt,
  )
  return user
}
