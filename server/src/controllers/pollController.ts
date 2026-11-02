import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query, queryOne, execute, transaction } from '../db/index.js';
import { Poll, PollOption, PollVote, Session } from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { getSocketServer } from '../socket/index.js';

const createPollSchema = z.object({
  question: z.string().min(3, 'Poll question must be at least 3 characters long').max(300, 'Question cannot exceed 300 characters'),
  options: z.array(z.string().min(1, 'Option text cannot be empty').max(150, 'Option cannot exceed 150 characters'))
    .min(2, 'A poll must have at least 2 options')
    .max(10, 'A poll cannot have more than 10 options'),
  status: z.enum(['draft', 'active']).optional().default('active'),
  show_results: z.boolean().optional().default(true)
});

const votePollSchema = z.object({
  optionId: z.string().uuid('Invalid option ID'),
  participantId: z.string().uuid('Invalid participant ID')
});

function formatPollWithPercentages(poll: Poll, options: PollOption[], userVotedOptionId?: string | null): Poll {
  const totalVotes = options.reduce((sum, opt) => sum + opt.votes_count, 0);
  const enrichedOptions = options.map(opt => ({
    ...opt,
    percentage: totalVotes > 0 ? Math.round((opt.votes_count / totalVotes) * 100) : 0
  }));

  return {
    ...poll,
    show_results: Boolean(poll.show_results) as any,
    total_votes: totalVotes,
    options: enrichedOptions,
    user_voted_option_id: userVotedOptionId || null
  };
}

export function getPolls(req: Request, res: Response): void {
  const { sessionCode } = req.params;
  const participantId = (req.query.participantId as string) || (req.headers['x-participant-id'] as string) || '';

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [sessionCode.toUpperCase()]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const polls = query<Poll>('SELECT * FROM polls WHERE session_id = ? ORDER BY created_at DESC', [session.id]);

  const detailedPolls = polls.map(poll => {
    const options = query<PollOption>(
      'SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort_order ASC',
      [poll.id]
    );

    let userVotedOptionId: string | null = null;
    if (participantId) {
      const existingVote = queryOne<PollVote>(
        'SELECT option_id FROM poll_votes WHERE poll_id = ? AND participant_id = ?',
        [poll.id, participantId]
      );
      if (existingVote) {
        userVotedOptionId = existingVote.option_id;
      }
    }

    return formatPollWithPercentages(poll, options, userVotedOptionId);
  });

  res.status(200).json({ polls: detailedPolls });
}

export function getActivePoll(req: Request, res: Response): void {
  const { sessionCode } = req.params;
  const participantId = (req.query.participantId as string) || (req.headers['x-participant-id'] as string) || '';

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [sessionCode.toUpperCase()]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const poll = queryOne<Poll>(
    "SELECT * FROM polls WHERE session_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [session.id]
  );

  if (!poll) {
    res.status(200).json({ poll: null });
    return;
  }

  const options = query<PollOption>(
    'SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort_order ASC',
    [poll.id]
  );

  let userVotedOptionId: string | null = null;
  if (participantId) {
    const existingVote = queryOne<PollVote>(
      'SELECT option_id FROM poll_votes WHERE poll_id = ? AND participant_id = ?',
      [poll.id, participantId]
    );
    if (existingVote) {
      userVotedOptionId = existingVote.option_id;
    }
  }

  res.status(200).json({ poll: formatPollWithPercentages(poll, options, userVotedOptionId) });
}

export function createPoll(req: AuthRequest, res: Response): void {
  const { sessionCode } = req.params;

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

  const result = createPollSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { question, options, status, show_results } = result.data;
  const pollId = uuidv4();
  const createdAt = new Date().toISOString();

  transaction(() => {
    // If new poll is created as 'active', set any existing active polls in this session to 'closed'
    if (status === 'active') {
      execute("UPDATE polls SET status = 'closed' WHERE session_id = ? AND status = 'active'", [session.id]);
    }

    execute(
      'INSERT INTO polls (id, session_id, question, status, show_results, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [pollId, session.id, question.trim(), status, show_results ? 1 : 0, createdAt]
    );

    options.forEach((optText, index) => {
      const optId = uuidv4();
      execute(
        'INSERT INTO poll_options (id, poll_id, text, votes_count, sort_order) VALUES (?, ?, ?, 0, ?)',
        [optId, pollId, optText.trim(), index]
      );
    });
  });

  const createdPoll = queryOne<Poll>('SELECT * FROM polls WHERE id = ?', [pollId]);
  const pollOptions = query<PollOption>('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort_order ASC', [pollId]);

  if (!createdPoll) {
    res.status(500).json({ error: 'Failed to create poll' });
    return;
  }

  const formatted = formatPollWithPercentages(createdPoll, pollOptions, null);

  const io = getSocketServer();
  if (io) {
    io.to(`session:${session.code}`).emit('poll:created', formatted);
    if (status === 'active') {
      io.to(`session:${session.code}`).emit('poll:activated', formatted);
    }
  }

  res.status(201).json({
    message: 'Poll created successfully',
    poll: formatted
  });
}

/**
 * Vote in a poll.
 * STRICTLY ENFORCES ONE VOTE PER PERSON PER POLL ON THE SERVER.
 */
export function votePoll(req: Request, res: Response): void {
  const { sessionCode, pollId } = req.params;

  const result = votePollSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: result.error.errors[0].message,
      details: result.error.errors
    });
    return;
  }

  const { optionId, participantId } = result.data;

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [sessionCode.toUpperCase()]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const poll = queryOne<Poll>('SELECT * FROM polls WHERE id = ? AND session_id = ?', [pollId, session.id]);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found in this session' });
    return;
  }

  if (poll.status !== 'active') {
    res.status(400).json({ error: 'This poll is closed or inactive. Votes are no longer accepted.' });
    return;
  }

  // Validate that option belongs to this poll
  const option = queryOne<PollOption>('SELECT * FROM poll_options WHERE id = ? AND poll_id = ?', [optionId, pollId]);
  if (!option) {
    res.status(404).json({ error: 'Selected poll option does not exist' });
    return;
  }

  // SERVER-SIDE STRICT ENFORCEMENT: has this participant already voted in this poll?
  const existingVote = queryOne<PollVote>(
    'SELECT * FROM poll_votes WHERE poll_id = ? AND participant_id = ?',
    [pollId, participantId]
  );

  if (existingVote) {
    res.status(409).json({ error: 'You have already voted in this poll. Only one vote per person is allowed.' });
    return;
  }

  const voteTime = new Date().toISOString();

  try {
    transaction(() => {
      execute(
        'INSERT INTO poll_votes (poll_id, participant_id, option_id, created_at) VALUES (?, ?, ?, ?)',
        [pollId, participantId, optionId, voteTime]
      );
      execute(
        'UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = ?',
        [optionId]
      );
    });
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'You have already voted in this poll.' });
      return;
    }
    throw error;
  }

  const options = query<PollOption>('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort_order ASC', [pollId]);
  const formatted = formatPollWithPercentages(poll, options, optionId);

  // Broadcast real-time live vote update to all session participants
  const io = getSocketServer();
  if (io) {
    io.to(`session:${session.code}`).emit('poll:voted', {
      pollId,
      options: formatted.options,
      total_votes: formatted.total_votes
    });
  }

  res.status(200).json({
    message: 'Vote recorded successfully',
    poll: formatted
  });
}

/**
 * Host updates poll status (activate, close, toggle results)
 */
export function updatePollStatus(req: AuthRequest, res: Response): void {
  const { sessionCode, pollId } = req.params;

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

  const poll = queryOne<Poll>('SELECT * FROM polls WHERE id = ? AND session_id = ?', [pollId, session.id]);
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }

  const { status, show_results } = req.body;

  if (status && !['draft', 'active', 'closed'].includes(status)) {
    res.status(400).json({ error: 'Status must be draft, active, or closed' });
    return;
  }

  transaction(() => {
    // If activating this poll, close other active polls in this session
    if (status === 'active') {
      execute("UPDATE polls SET status = 'closed' WHERE session_id = ? AND id != ?", [session.id, pollId]);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (show_results !== undefined) {
      updates.push('show_results = ?');
      params.push(show_results ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(pollId);
      execute(`UPDATE polls SET ${updates.join(', ')} WHERE id = ?`, params);
    }
  });

  const updatedPoll = queryOne<Poll>('SELECT * FROM polls WHERE id = ?', [pollId]);
  const options = query<PollOption>('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort_order ASC', [pollId]);

  if (!updatedPoll) {
    res.status(500).json({ error: 'Failed to update poll' });
    return;
  }

  const formatted = formatPollWithPercentages(updatedPoll, options, null);

  const io = getSocketServer();
  if (io) {
    io.to(`session:${session.code}`).emit('poll:updated', formatted);
    if (status === 'active') {
      io.to(`session:${session.code}`).emit('poll:activated', formatted);
    }
  }

  res.status(200).json({
    message: 'Poll updated successfully',
    poll: formatted
  });
}

/**
 * Delete a poll (Host only)
 */
export function deletePoll(req: AuthRequest, res: Response): void {
  const { sessionCode, pollId } = req.params;

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

  execute('DELETE FROM polls WHERE id = ? AND session_id = ?', [pollId, session.id]);

  const io = getSocketServer();
  if (io) {
    io.to(`session:${session.code}`).emit('poll:deleted', { pollId });
  }

  res.status(200).json({ message: 'Poll deleted successfully', pollId });
}
