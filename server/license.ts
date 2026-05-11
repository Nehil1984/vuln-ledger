// Copyright 2026 Daniel Schuh
// Licensed under the Apache License, Version 2.0
// http://www.apache.org/licenses/LICENSE-2.0

import fs from 'node:fs'
import path from 'node:path'
import type { LicenseRecord } from './models.js'

const dataDir = path.resolve(process.cwd(), 'data')
const licensePath = path.join(dataDir, 'license.json')

const defaultLicense: LicenseRecord = {
  status: 'trial',
  plan: 'Community Trial',
  key: 'VL-TRIAL-LOCAL',
  seats: 1,
  customer: 'Unlicensed Instance',
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  issuedAt: new Date().toISOString(),
  notes: 'Lokale Testlizenz für VulnLedger.',
}

function ensureLicense() {
  fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(licensePath)) {
    fs.writeFileSync(licensePath, JSON.stringify(defaultLicense, null, 2), 'utf8')
  }
}

export function readLicense(): LicenseRecord {
  ensureLicense()
  try {
    const parsed = JSON.parse(fs.readFileSync(licensePath, 'utf8')) as Partial<LicenseRecord>
    return {
      ...defaultLicense,
      ...parsed,
    }
  } catch {
    return defaultLicense
  }
}

export function writeLicense(next: Partial<LicenseRecord>) {
  const current = readLicense()
  const merged: LicenseRecord = {
    ...current,
    ...next,
  }
  fs.writeFileSync(licensePath, JSON.stringify(merged, null, 2), 'utf8')
  return merged
}
