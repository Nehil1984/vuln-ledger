export type UserRole = 'admin' | 'user'
export type DbBackend = 'lowdb' | 'sqlite'

export type UserRecord = {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  createdAt: string
}

export type AppConfig = {
  dbBackend: DbBackend
}

export type ServerState = {
  config: AppConfig
  users: UserRecord[]
}
