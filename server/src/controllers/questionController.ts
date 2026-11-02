import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query, queryOne, execute, transaction } from '../db/index.js';
import { Question, Session, Participant, QuestionVote } from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { getSocketServer } from '../socket/index.js';

const createQuestionSchema = z.object({
  content: z.string().min(3, 'Question must be at least 3 characters long').max(500, 'Question cannot exceed 500 characters'),
  participantId: z.string().uuid('Invalid participant ID'),
  isAnonymous: z.boolean().optional().default(false)
});

const moderateSchema = z.object({
  is_answered: z.number().int().min(0).max(1).optional(),
  is_hidden: z.number().int().min(0).max(1).optional(),
  is_pinned: z.number().int().min(0).max(1).optional()
});

export function getQuestions(req: Request, res: Response): void {
  const { sessionCode } = req.params;
  const participantId = (req.query.participantId as string) || (req.headers['x-participant-id'] as string) || '';
  const isHost = req.query.isHost === 'true';

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [sessionCode.toUpperCase()]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Audience only sees non-hidden questions; Hosts can see all (including hidden)
  const hideCondition = isHost ? '' : 'AND q.is_hidden = 0';

  const questions = query<Question>(`
    SELECT q.*,
      CASE WHEN qv.participant_id IS NOT NULL THEN 1 ELSE 0 END as has_voted
    FROM questions q
    LEFT JOIN question_votes qv ON qv.question_id = q.id AND qv.participant_id = ?
    WHERE q.session_id = ? ${hideCondition}
    ORDER BY q.is_pinned DESC, q.is_answered ASC, q.upvotes_count DESC, q.created_at DESC
  `, [participantId, session.id]);

  const sanitized = questions.map(q => ({
    ...q,
    has_voted: Boolean(q.has_voted),
    // Mask author info if anonymous for non-hosts
    author_name: q.is_anonymous ? 'Anonymous' : q.author_name,
    participant_id: q.is_anonymous && !isHost ? '' : q.participant_id
  }));

  res.status(200).json({ questions: sanitized });
}

export function createQuestion(req: Request, res: Response): void {
  const { sessionCode } = req.params;
  const upperCode = sessionCode.toUpperCase();

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [upperCode]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.is_active === 0) {
    res.status(403).json({ error: 'This session is closed. New questions cannot be submitted.' });
    return;
  }

  const result = createQuestionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { content, participantId, isAnonymous } = result.data;

  // Validate participant is registered in session
  const participant = queryOne<Participant>(
    'SELECT * FROM participants WHERE session_id = ? AND id = ?',
    [session.id, participantId]
  );

  if (!participant) {
    res.status(403).json({ error: 'Participant not registered in this session. Please rejoin.' });
    return;
  }

  const questionId = uuidv4();
  const createdAt = new Date().toISOString();
  const isAnonFlag = (isAnonymous && session.allow_anonymous) ? 1 : 0;
  const authorName = isAnonFlag ? 'Anonymous' : participant.display_name;

  execute(`
    INSERT INTO questions (
      id, session_id, participant_id, author_name, content,
      is_anonymous, is_answered, is_hidden, is_pinned, upvotes_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)
  `, [questionId, session.id, participantId, authorName, content.trim(), isAnonFlag, createdAt]);

  const question = queryOne<Question>('SELECT * FROM questions WHERE id = ?', [questionId]);
  if (!question) {
    res.status(500).json({ error: 'Failed to create question' });
    return;
  }

  const responseQuestion = {
    ...question,
    has_voted: false
  };

  // Broadcast to session room via Socket.IO
  const io = getSocketServer();
  if (io) {
    io.to(`session:${upperCode}`).emit('question:created', responseQuestion);
  }

  res.status(201).json({
    message: 'Question submitted successfully',
    question: responseQuestion
  });
}

/**
 * Upvote a question.
 * STRICTLY ENFORCES ONE VOTE PER PERSON PER QUESTION ON THE SERVER.
 */
export function upvoteQuestion(req: Request, res: Response): void {
  const { sessionCode, questionId } = req.params;
  const participantId = (req.body.participantId || req.headers['x-participant-id']) as string;

  if (!participantId) {
    res.status(400).json({ error: 'Participant ID is required to upvote' });
    return;
  }

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [sessionCode.toUpperCase()]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const question = queryOne<Question>('SELECT * FROM questions WHERE id = ? AND session_id = ?', [questionId, session.id]);
  if (!question) {
    res.status(404).json({ error: 'Question not found in this session' });
    return;
  }

  if (question.is_hidden) {
    res.status(400).json({ error: 'Cannot vote on a hidden question' });
    return;
  }

  // Server-side enforcement check: has this participant already voted?
  const existingVote = queryOne<QuestionVote>(
    'SELECT * FROM question_votes WHERE question_id = ? AND participant_id = ?',
    [questionId, participantId]
  );

  if (existingVote) {
    res.status(409).json({ error: 'You have already upvoted this question' });
    return;
  }

  const voteTime = new Date().toISOString();

  // Atomically insert vote and increment question upvotes count
  try {
    transaction(() => {
      execute(
        'INSERT INTO question_votes (question_id, participant_id, created_at) VALUES (?, ?, ?)',
        [questionId, participantId, voteTime]
      );
      execute(
        'UPDATE questions SET upvotes_count = upvotes_count + 1 WHERE id = ?',
        [questionId]
      );
    });
  } catch (error: any) {
    // If unique constraint was somehow hit concurrently
    if (error.message && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'You have already upvoted this question' });
      return;
    }
    throw error;
  }

  const updatedQuestion = queryOne<Question>('SELECT * FROM questions WHERE id = ?', [questionId]);
  const newCount = updatedQuestion ? updatedQuestion.upvotes_count : question.upvotes_count + 1;

  // Broadcast upvote update to all clients in session
  const io = getSocketServer();
  if (io) {
    io.to(`session:${session.code}`).emit('question:upvoted', {
      questionId,
      upvotesCount: newCount
    });
  }

  res.status(200).json({
    message: 'Question upvoted successfully',
    questionId,
    upvotesCount: newCount,
    has_voted: true
  });
}

/**
 * Toggle / Remove upvote (optional participant action)
 */
export function removeUpvote(req: Request, res: Response): void {
  const { sessionCode, questionId } = req.params;
  const participantId = (req.body.participantId || req.headers['x-participant-id']) as string;

  if (!participantId) {
    res.status(400).json({ error: 'Participant ID is required' });
    return;
  }

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [sessionCode.toUpperCase()]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const existingVote = queryOne<QuestionVote>(
    'SELECT * FROM question_votes WHERE question_id = ? AND participant_id = ?',
    [questionId, participantId]
  );

  if (!existingVote) {
    res.status(400).json({ error: 'You have not upvoted this question yet' });
    return;
  }

  transaction(() => {
    execute('DELETE FROM question_votes WHERE question_id = ? AND participant_id = ?', [questionId, participantId]);
    execute('UPDATE questions SET upvotes_count = MAX(0, upvotes_count - 1) WHERE id = ?', [questionId]);
  });

  const updated = queryOne<Question>('SELECT * FROM questions WHERE id = ?', [questionId]);
  const newCount = updated ? updated.upvotes_count : 0;

  const io = getSocketServer();
  if (io) {
    io.to(`session:${session.code}`).emit('question:upvoted', {
      questionId,
      upvotesCount: newCount
    });
  }

  res.status(200).json({
    message: 'Upvote removed',
    questionId,
    upvotesCount: newCount,
    has_voted: false
  });
}

/**
 * Moderate a question (Host only: mark answered, hide/unhide, spotlight/pin)
 */
export function moderateQuestion(req: AuthRequest, res: Response): void {
  const { sessionCode, questionId } = req.params;

  if (!req.hostUser) {
    res.status(401).json({ error: 'Host authentication required' });
    return;
  }

  const session = queryOne<Session>(
    'SELECT * FROM sessions WHERE code = ? AND host_id = ?',
    [sessionCode.toUpperCase(), req.hostUser.id]
  );

  if (!session) {
    res.status(404).json({ error: 'Session not found or not owned by you' });
    return;
  }

  const question = queryOne<Question>('SELECT * FROM questions WHERE id = ? AND session_id = ?', [questionId, session.id]);
  if (!question) {
    res.status(404).json({ error: 'Question not found in this session' });
    return;
  }

  const result = moderateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { is_answered, is_hidden, is_pinned } = result.data;

  const updates: string[] = [];
  const params: any[] = [];

  if (is_answered !== undefined) {
    updates.push('is_answered = ?');
    params.push(is_answered);
  }
  if (is_hidden !== undefined) {
    updates.push('is_hidden = ?');
    params.push(is_hidden);
  }
  if (is_pinned !== undefined) {
    // If pinning this question, unpin other questions first so only 1 question is spotlighted
    if (is_pinned === 1) {
      execute('UPDATE questions SET is_pinned = 0 WHERE session_id = ?', [session.id]);
    }
    updates.push('is_pinned = ?');
    params.push(is_pinned);
  }

  if (updates.length > 0) {
    params.push(questionId);
    execute(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const updated = queryOne<Question>('SELECT * FROM questions WHERE id = ?', [questionId]);

  const io = getSocketServer();
  if (io && updated) {
    io.to(`session:${session.code}`).emit('question:updated', updated);
  }

  res.status(200).json({
    message: 'Question updated successfully',
    question: updated
  });
}

/**
 * Delete a question (Host only)
 */
export function deleteQuestion(req: AuthRequest, res: Response): void {
  const { sessionCode, questionId } = req.params;

  if (!req.hostUser) {
    res.status(401).json({ error: 'Host authentication required' });
    return;
  }

  const session = queryOne<Session>(
    'SELECT * FROM sessions WHERE code = ? AND host_id = ?',
    [sessionCode.toUpperCase(), req.hostUser.id]
  );

  if (!session) {
    res.status(404).json({ error: 'Session not found or not owned by you' });
    return;
  }

  execute('DELETE FROM questions WHERE id = ? AND session_id = ?', [questionId, session.id]);

  const io = getSocketServer();
  if (io) {
    io.to(`session:${session.code}`).emit('question:deleted', { questionId });
  }

  res.status(200).json({ message: 'Question deleted successfully', questionId });
}
