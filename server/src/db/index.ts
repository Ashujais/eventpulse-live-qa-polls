import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: SqlJsDatabase | null = null;
let currentDbPath: string | null = null;

export interface DBRow {
  [key: string]: any;
}

export async function getDb(dbPath?: string): Promise<SqlJsDatabase> {
  if (dbInstance && (!dbPath || dbPath === currentDbPath)) {
    return dbInstance;
  }

  const SQL = await initSqlJs();
  currentDbPath = dbPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'eventpulse.sqlite');

  if (currentDbPath === ':memory:') {
    dbInstance = new SQL.Database();
  } else {
    const dir = path.dirname(currentDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(currentDbPath)) {
      const fileBuffer = fs.readFileSync(currentDbPath);
      dbInstance = new SQL.Database(fileBuffer);
    } else {
      dbInstance = new SQL.Database();
      persist();
    }
  }

  initSchema();
  return dbInstance;
}

export function persist(): void {
  if (!dbInstance || !currentDbPath || currentDbPath === ':memory:') return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(currentDbPath, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database to disk:', err);
  }
}

export function initSchema(): void {
  if (!dbInstance) throw new Error('Database not initialized');

  dbInstance.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS hosts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      host_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      require_approval INTEGER DEFAULT 0,
      allow_anonymous INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE(session_id, id)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_anonymous INTEGER DEFAULT 0,
      is_answered INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      upvotes_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);

    CREATE TABLE IF NOT EXISTS question_votes (
      question_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (question_id, participant_id),
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      show_results INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_polls_session ON polls(session_id);

    CREATE TABLE IF NOT EXISTS poll_options (
      id TEXT PRIMARY KEY,
      poll_id TEXT NOT NULL,
      text TEXT NOT NULL,
      votes_count INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);

    CREATE TABLE IF NOT EXISTS poll_votes (
      poll_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (poll_id, participant_id),
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    );
  `);

  persist();
}

/**
 * Execute a query that returns multiple rows.
 */
export function query<T = DBRow>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

/**
 * Execute a query that returns a single row.
 */
export function queryOne<T = DBRow>(sql: string, params: any[] = []): T | undefined {
  const rows = query<T>(sql, params);
  return rows[0];
}

/**
 * Execute a mutating statement (INSERT, UPDATE, DELETE).
 * Automatically persists changes to disk.
 */
export function execute(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  persist();
}

/**
 * Run operations inside a transaction block.
 */
export function transaction<T>(fn: () => T): T {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    dbInstance.run('COMMIT;');
    persist();
    return result;
  } catch (error) {
    dbInstance.run('ROLLBACK;');
    throw error;
  }
}

/**
 * Reset database (for tests)
 */
export async function resetTestDb(): Promise<void> {
  const SQL = await initSqlJs();
  currentDbPath = ':memory:';
  dbInstance = new SQL.Database();
  initSchema();
}
