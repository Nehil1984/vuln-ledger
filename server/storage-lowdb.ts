import fs from 'node:fs'
import path from 'node:path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import bcrypt from 'bcryptjs'
import type { ServerState, UserRecord, UserRole } from './types.js'

const dataDir = path.resolve(process.cwd(), 'data')
const filePath = path.join(dataDir, 'vulnledger.lowdb.json')

const defaultData: ServerState = {
  config: { dbBackend: 'lowdb' },
  users: [],
}

let db: Low<ServerState> | null = null

async function getDb() {
  if (db) return db
  fs.mkdirSync(dataDir, { recursive: true })
  const adapter = new JSONFile<ServerState>(filePath)
  db = new Low<ServerState>(adapter, defaultData)
  await db.read()
  db.data ||= structuredClone(defaultData)
  await ensureDefaultAdmin(db)
  return db
}

async function ensureDefaultAdmin(currentDb: Low<ServerState>) {
  currentDb.data ||= structuredClone(defaultData)
  if (currentDb.data.users.length > 0) {
    await currentDb.write()
    return
  }

  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123!'
  const passwordHash = await bcrypt.hash(password, 10)
  currentDb.data.users.push({
    id: 'u-admin',
    username,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  })
  await currentDb.write()
}

export async function listUsersLowdb() {
  const currentDb = await getDb()
  return currentDb.data.users
}

export async function findUserByUsernameLowdb(username: string) {
  const currentDb = await getDb()
  return currentDb.data.users.find((user: UserRecord) => user.username.toLowerCase() === username.toLowerCase()) ?? null
}

export async function createUserLowdb(username: string, password: string, role: UserRole): Promise<UserRecord> {
  const currentDb = await getDb()
  const passwordHash = await bcrypt.hash(password, 10)
  const user: UserRecord = {
    id: `u-${Date.now()}`,
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  }
  currentDb.data.users.push(user)
  await currentDb.write()
  return user
}
