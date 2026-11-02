import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { queryOne, execute } from '../db/index.js';
import { Host } from '../types/index.js';
import { generateToken, AuthRequest } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(60, 'Name cannot exceed 60 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

export async function registerHost(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { email, name, password } = result.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = queryOne<Host>('SELECT * FROM hosts WHERE email = ?', [normalizedEmail]);
  if (existing) {
    res.status(409).json({ error: 'A host account with this email already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const hostId = uuidv4();
  const createdAt = new Date().toISOString();

  execute(
    'INSERT INTO hosts (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    [hostId, normalizedEmail, name.trim(), passwordHash, createdAt]
  );

  const token = generateToken({ id: hostId, email: normalizedEmail, name: name.trim() });
  res.status(201).json({
    message: 'Host account registered successfully',
    token,
    host: { id: hostId, email: normalizedEmail, name: name.trim() }
  });
}

export async function loginHost(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { email, password } = result.data;
  const normalizedEmail = email.toLowerCase().trim();

  const host = queryOne<Host>('SELECT * FROM hosts WHERE email = ?', [normalizedEmail]);
  if (!host) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const isMatch = await bcrypt.compare(password, host.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = generateToken({ id: host.id, email: host.email, name: host.name });
  res.status(200).json({
    message: 'Logged in successfully',
    token,
    host: { id: host.id, email: host.email, name: host.name }
  });
}

export function getCurrentHost(req: AuthRequest, res: Response): void {
  if (!req.hostUser) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const host = queryOne<Host>('SELECT id, email, name, created_at FROM hosts WHERE id = ?', [req.hostUser.id]);
  if (!host) {
    res.status(404).json({ error: 'Host account not found' });
    return;
  }
  res.status(200).json({ host });
}
