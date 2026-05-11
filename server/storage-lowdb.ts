// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import bcrypt from 'bcryptjs'
import { getDataDb } from './data-lowdb.js'
import type { UserRecord, UserRole } from './types.js'

async function ensureDefaultAdmin() {
  const db = await getDataDb()
  if (db.data.users.length > 0) return db

  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123!'
  const passwordHash = await bcrypt.hash(password, 10)
  db.data.users.push({
    id: 'u-admin',
    username,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
  })
  await db.write()
  return db
}

export async function listUsersLowdb() {
  const db = await ensureDefaultAdmin()
  return db.data.users
}

export async function findUserByUsernameLowdb(username: string) {
  const db = await ensureDefaultAdmin()
  return db.data.users.find((user: UserRecord) => user.username.toLowerCase() === username.toLowerCase()) ?? null
}

export async function createUserLowdb(username: string, password: string, role: UserRole): Promise<UserRecord> {
  const db = await ensureDefaultAdmin()
  const passwordHash = await bcrypt.hash(password, 10)
  const user: UserRecord = {
    id: `u-${Date.now()}`,
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  }
  db.data.users.push(user)
  await db.write()
  return user
}
