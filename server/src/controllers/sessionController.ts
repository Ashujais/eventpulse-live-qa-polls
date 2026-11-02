import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query, queryOne, execute } from '../db/index.js';
import { Session, Participant } from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { getSocketServer } from '../socket/index.js';

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes easily confused 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const createSessionSchema = z.object({
  title: z.string().min(3, 'Session title must be at least 3 characters').max(100, 'Session title cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().default(''),
  customCode: z.string().regex(/^[A-Za-z0-9]{4,10}$/, 'Custom code must be 4-10 alphanumeric characters').optional().or(z.literal('')),
  allow_anonymous: z.boolean().optional().default(true)
});

const joinSessionSchema = z.object({
  code: z.string().min(4, 'Join code must be at least 4 characters').max(10, 'Join code cannot exceed 10 characters'),
  displayName: z.string().min(1, 'Display name is required').max(50, 'Display name cannot exceed 50 characters'),
  participantId: z.string().uuid('Invalid participant ID').optional()
});

export async function createSession(req: AuthRequest, res: Response): Promise<void> {
  if (!req.hostUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const result = createSessionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { title, description, customCode, allow_anonymous } = result.data;

  let code = customCode ? customCode.toUpperCase() : generateShortCode();

  if (customCode) {
    const existing = queryOne<Session>('SELECT id FROM sessions WHERE code = ?', [code]);
    if (existing) {
      res.status(409).json({ error: `Session code '${code}' is already in use. Please choose another code.` });
      return;
    }
  } else {
    // Generate unique code with retry
    let attempts = 0;
    while (attempts < 5) {
      const existing = queryOne<Session>('SELECT id FROM sessions WHERE code = ?', [code]);
      if (!existing) break;
      code = generateShortCode();
      attempts++;
    }
  }

  const sessionId = uuidv4();
  const createdAt = new Date().toISOString();

  execute(
    `INSERT INTO sessions (id, code, title, description, host_id, is_active, require_approval, allow_anonymous, created_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
    [sessionId, code, title.trim(), description?.trim() || '', req.hostUser.id, allow_anonymous ? 1 : 0, createdAt]
  );

  const session = queryOne<Session>('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  res.status(201).json({
    message: 'Session created successfully',
    session
  });
}

export function getSessionByCode(req: Request, res: Response): void {
  const code = (req.params.code || '').toUpperCase().trim();
  if (!code) {
    res.status(400).json({ error: 'Session code is required' });
    return;
  }

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [code]);
  if (!session) {
    res.status(404).json({ error: `No session found with code "${code}". Please check the code and try again.` });
    return;
  }

  res.status(200).json({ session });
}

export function joinSession(req: Request, res: Response): void {
  const result = joinSessionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { code, displayName, participantId: providedId } = result.data;
  const upperCode = code.toUpperCase().trim();

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [upperCode]);
  if (!session) {
    res.status(404).json({ error: `Session "${upperCode}" not found.` });
    return;
  }

  if (session.is_active === 0) {
    res.status(403).json({ error: 'This session has been concluded by the host.' });
    return;
  }

  const participantId = providedId || uuidv4();
  const joinedAt = new Date().toISOString();

  // Check if participant already exists in this session
  const existing = queryOne<Participant>(
    'SELECT * FROM participants WHERE session_id = ? AND id = ?',
    [session.id, participantId]
  );

  if (existing) {
    // Update display name if changed
    execute(
      'UPDATE participants SET display_name = ? WHERE id = ?',
      [displayName.trim(), participantId]
    );
  } else {
    execute(
      'INSERT INTO participants (id, session_id, display_name, joined_at) VALUES (?, ?, ?, ?)',
      [participantId, session.id, displayName.trim(), joinedAt]
    );
  }

  const participant = queryOne<Participant>('SELECT * FROM participants WHERE id = ?', [participantId]);

  res.status(200).json({
    message: 'Joined session successfully',
    session,
    participant
  });
}

export function getHostSessions(req: AuthRequest, res: Response): void {
  if (!req.hostUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const sessions = query<Session & { questions_count: number; polls_count: number; participants_count: number }>(`
    SELECT s.*,
      (SELECT COUNT(*) FROM questions q WHERE q.session_id = s.id AND q.is_hidden = 0) as questions_count,
      (SELECT COUNT(*) FROM polls p WHERE p.session_id = s.id) as polls_count,
      (SELECT COUNT(*) FROM participants pt WHERE pt.session_id = s.id) as participants_count
    FROM sessions s
    WHERE s.host_id = ?
    ORDER BY s.created_at DESC
  `, [req.hostUser.id]);

  res.status(200).json({ sessions });
}

export function updateSessionStatus(req: AuthRequest, res: Response): void {
  if (!req.hostUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { id } = req.params;
  const session = queryOne<Session>('SELECT * FROM sessions WHERE id = ? AND host_id = ?', [id, req.hostUser.id]);
  if (!session) {
    res.status(404).json({ error: 'Session not found or not owned by you' });
    return;
  }

  const { is_active } = req.body;
  if (typeof is_active !== 'number' && typeof is_active !== 'boolean') {
    res.status(400).json({ error: 'Invalid is_active value' });
    return;
  }

  const activeVal = is_active ? 1 : 0;
  execute('UPDATE sessions SET is_active = ? WHERE id = ?', [activeVal, id]);

  const updated = queryOne<Session>('SELECT * FROM sessions WHERE id = ?', [id]);

  const io = getSocketServer();
  if (io && updated) {
    io.to(`session:${updated.code}`).emit('session:updated', updated);
  }

  res.status(200).json({ session: updated });
}
