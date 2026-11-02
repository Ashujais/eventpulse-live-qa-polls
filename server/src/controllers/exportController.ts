import { Request, Response } from 'express';
import { query, queryOne } from '../db/index.js';
import { Session, Question, Poll, PollOption } from '../types/index.js';

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportSessionData(req: Request, res: Response): void {
  const { sessionCode } = req.params;
  const format = (req.query.format as string) || 'csv';

  const session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [sessionCode.toUpperCase()]);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const questions = query<Question>(
    'SELECT * FROM questions WHERE session_id = ? ORDER BY upvotes_count DESC, created_at ASC',
    [session.id]
  );

  const polls = query<Poll>(
    'SELECT * FROM polls WHERE session_id = ? ORDER BY created_at ASC',
    [session.id]
  );

  const pollsWithOptions = polls.map(poll => {
    const options = query<PollOption>(
      'SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort_order ASC',
      [poll.id]
    );
    const totalVotes = options.reduce((sum, opt) => sum + opt.votes_count, 0);
    return {
      ...poll,
      total_votes: totalVotes,
      options: options.map(opt => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.votes_count / totalVotes) * 100) : 0
      }))
    };
  });

  if (format.toLowerCase() === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${session.code}_report.json"`);
    res.status(200).json({
      session,
      exported_at: new Date().toISOString(),
      questions_count: questions.length,
      polls_count: polls.length,
      questions,
      polls: pollsWithOptions
    });
    return;
  }

  // Format as CSV
  const csvLines: string[] = [];

  // Header / Session Metadata
  csvLines.push(`"SESSION REPORT: ${session.title}"`);
  csvLines.push(`"Session Code",${escapeCsvField(session.code)}`);
  csvLines.push(`"Created At",${escapeCsvField(session.created_at)}`);
  csvLines.push(`"Exported At",${escapeCsvField(new Date().toISOString())}`);
  csvLines.push('');

  // Questions Section
  csvLines.push('"--- QUESTIONS ---"');
  csvLines.push('"Question ID","Author","Question Text","Upvotes","Is Answered","Is Hidden","Is Anonymous","Created At"');
  for (const q of questions) {
    csvLines.push([
      escapeCsvField(q.id),
      escapeCsvField(q.is_anonymous ? 'Anonymous' : q.author_name),
      escapeCsvField(q.content),
      escapeCsvField(q.upvotes_count),
      escapeCsvField(q.is_answered ? 'Yes' : 'No'),
      escapeCsvField(q.is_hidden ? 'Yes' : 'No'),
      escapeCsvField(q.is_anonymous ? 'Yes' : 'No'),
      escapeCsvField(q.created_at)
    ].join(','));
  }

  csvLines.push('');
  csvLines.push('"--- POLLS & RESULTS ---"');
  csvLines.push('"Poll ID","Poll Question","Status","Option Text","Votes","Percentage","Total Poll Votes"');
  for (const p of pollsWithOptions) {
    for (const opt of p.options) {
      csvLines.push([
        escapeCsvField(p.id),
        escapeCsvField(p.question),
        escapeCsvField(p.status),
        escapeCsvField(opt.text),
        escapeCsvField(opt.votes_count),
        escapeCsvField(`${opt.percentage}%`),
        escapeCsvField(p.total_votes)
      ].join(','));
    }
  }

  const csvContent = csvLines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${session.code}_event_report.csv"`);
  res.status(200).send(csvContent);
}
