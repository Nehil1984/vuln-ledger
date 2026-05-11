// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import fs from 'node:fs'
import path from 'node:path'
import type { DbBackend } from './types.js'

const dataDir = path.resolve(process.cwd(), 'data')
const configPath = path.join(dataDir, 'db-config.json')

function ensureDir() {
  fs.mkdirSync(dataDir, { recursive: true })
}

export function readDbBackend(): DbBackend {
  const env = process.env.DB_BACKEND
  if (env === 'lowdb' || env === 'sqlite') return env

  ensureDir()
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ dbBackend: 'lowdb' }, null, 2), 'utf8')
    return 'lowdb'
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { dbBackend?: DbBackend }
    return parsed.dbBackend === 'sqlite' ? 'sqlite' : 'lowdb'
  } catch {
    return 'lowdb'
  }
}

export function writeDbBackend(dbBackend: DbBackend) {
  ensureDir()
  fs.writeFileSync(configPath, JSON.stringify({ dbBackend }, null, 2), 'utf8')
}
