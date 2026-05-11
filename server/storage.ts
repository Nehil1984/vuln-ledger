import bcrypt from 'bcryptjs'
import { readDbBackend, writeDbBackend } from './db-config.js'
import { createUserLowdb, findUserByUsernameLowdb, listUsersLowdb } from './storage-lowdb.js'
import { createUserSqlite, findUserByUsernameSqlite, listUsersSqlite } from './storage-sqlite.js'
import type { DbBackend, UserRecord, UserRole } from './types.js'

export async function listUsers(): Promise<UserRecord[]> {
  return readDbBackend() === 'sqlite' ? listUsersSqlite() : listUsersLowdb()
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  return readDbBackend() === 'sqlite' ? findUserByUsernameSqlite(username) : findUserByUsernameLowdb(username)
}

export async function verifyUser(username: string, password: string): Promise<UserRecord | null> {
  const user = await findUserByUsername(username)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? user : null
}

export async function createUser(username: string, password: string, role: UserRole) {
  return readDbBackend() === 'sqlite' ? createUserSqlite(username, password, role) : createUserLowdb(username, password, role)
}

export function getDbBackend(): DbBackend {
  return readDbBackend()
}

export function setDbBackend(dbBackend: DbBackend) {
  writeDbBackend(dbBackend)
}
