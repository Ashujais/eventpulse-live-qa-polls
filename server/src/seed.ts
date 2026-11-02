import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, execute, queryOne, persist } from './db/index.js';
import { Host, Session } from './types/index.js';

async function seed() {
  console.log('🌱 Starting EventPulse database seeding...');
  await getDb();

  const now = new Date();
  const pastMinutes = (m: number) => new Date(now.getTime() - m * 60000).toISOString();

  // 1. Create or get Demo Host
  const demoEmail = 'host@eventpulse.io';
  let host = queryOne<Host>('SELECT * FROM hosts WHERE email = ?', [demoEmail]);

  if (!host) {
    const hostId = uuidv4();
    const passwordHash = await bcrypt.hash('password123', 10);
    execute(
      'INSERT INTO hosts (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [hostId, demoEmail, 'Alex Chen (Host)', passwordHash, pastMinutes(120)]
    );
    host = queryOne<Host>('SELECT * FROM hosts WHERE id = ?', [hostId]);
    console.log('✅ Created Demo Host:', demoEmail);
  } else {
    console.log('ℹ️ Demo Host already exists:', demoEmail);
  }

  if (!host) throw new Error('Host creation failed');

  // 2. Create Demo Session with code DEMO26
  const demoCode = 'DEMO26';
  let session = queryOne<Session>('SELECT * FROM sessions WHERE code = ?', [demoCode]);

  if (session) {
    console.log('🔄 Cleaning previous demo session data for code:', demoCode);
    execute('DELETE FROM sessions WHERE code = ?', [demoCode]);
  }

  const sessionId = uuidv4();
  execute(`
    INSERT INTO sessions (id, code, title, description, host_id, is_active, require_approval, allow_anonymous, created_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?)
  `, [
    sessionId,
    demoCode,
    'NextGen Web & AI Summit 2026',
    'Welcome to the live interactive Q&A and polling session for our mainstage event! Ask questions, upvote others, and vote in live polls.',
    host.id,
    pastMinutes(60)
  ]);
  session = queryOne<Session>('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  console.log(`✅ Created Demo Session: "${session?.title}" with join code: [ ${demoCode} ]`);

  // 3. Create Sample Audience Participants (50 audience members)
  const firstNames = ['Jordan', 'Sophia', 'Marcus', 'Elena', 'David', 'Priya', 'Liam', 'Zoe', 'Noah', 'Ava', 'Lucas', 'Mia', 'Ethan', 'Chloe', 'Oliver', 'Emma', 'Daniel', 'Maya', 'Aiden', 'Grace'];
  const lastNames = ['Miller', 'Zhang', 'Brody', 'Rostova', 'Kim', 'Sharma', 'O\'Connor', 'Chen', 'Taylor', 'Patel', 'Novak', 'Singh', 'Dubois', 'Santos', 'Tanaka', 'Morales', 'Lee', 'Walker', 'Schmidt', 'Wright'];

  const participants: { id: string; name: string }[] = [];
  for (let i = 0; i < 50; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[Math.floor(i / 2) % lastNames.length];
    const pid = uuidv4();
    const pName = `${fn} ${ln}`;
    participants.push({ id: pid, name: pName });

    execute(
      'INSERT INTO participants (id, session_id, display_name, joined_at) VALUES (?, ?, ?, ?)',
      [pid, sessionId, pName, pastMinutes(50 - (i % 40))]
    );
  }
  console.log(`✅ Seeded ${participants.length} demo audience participants in session.`);

  // 4. Create Sample Questions
  const questionsData = [
    {
      id: uuidv4(),
      participant: participants[0],
      content: 'How are you handling real-time WebSocket connection limits and failover for 50,000+ concurrent attendees in large auditoriums?',
      is_pinned: 1,
      is_answered: 0,
      is_anonymous: 0,
      upvoteVoters: participants.slice(0, 16),
      minsAgo: 35
    },
    {
      id: uuidv4(),
      participant: participants[1],
      content: 'What is the roadmap for running local LLM agent inference directly in browser clients with WebGPU acceleration?',
      is_pinned: 0,
      is_answered: 0,
      is_anonymous: 0,
      upvoteVoters: participants.slice(5, 16),
      minsAgo: 28
    },
    {
      id: uuidv4(),
      participant: participants[2],
      content: 'Will React Server Components and Server Actions eventually make traditional client state stores obsolete for 90% of web apps?',
      is_pinned: 0,
      is_answered: 0,
      is_anonymous: 0,
      upvoteVoters: participants.slice(10, 18),
      minsAgo: 20
    },
    {
      id: uuidv4(),
      participant: participants[3],
      content: 'Can this architecture be deployed fully to edge compute nodes (e.g., Cloudflare Workers / Fly.io) with regional SQLite replicas?',
      is_pinned: 0,
      is_answered: 1,
      is_anonymous: 0,
      upvoteVoters: participants.slice(2, 8),
      minsAgo: 45
    },
    {
      id: uuidv4(),
      participant: participants[4],
      content: 'Is there an export feature for session data (CSV/JSON) so event organizers can run post-conference sentiment and voting analytics?',
      is_pinned: 0,
      is_answered: 0,
      is_anonymous: 1,
      upvoteVoters: participants.slice(15, 19),
      minsAgo: 15
    }
  ];

  for (const q of questionsData) {
    const authorName = q.is_anonymous ? 'Anonymous' : q.participant.name;
    const upvotesCount = q.upvoteVoters.length;

    execute(`
      INSERT INTO questions (
        id, session_id, participant_id, author_name, content,
        is_anonymous, is_answered, is_hidden, is_pinned, upvotes_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `, [
      q.id,
      sessionId,
      q.participant.id,
      authorName,
      q.content,
      q.is_anonymous,
      q.is_answered,
      q.is_pinned,
      upvotesCount,
      pastMinutes(q.minsAgo)
    ]);

    // Insert legitimate question votes adhering to foreign keys and unique constraint
    for (const voter of q.upvoteVoters) {
      execute(
        'INSERT INTO question_votes (question_id, participant_id, created_at) VALUES (?, ?, ?)',
        [q.id, voter.id, pastMinutes(q.minsAgo - 1)]
      );
    }
  }
  console.log(`✅ Seeded ${questionsData.length} questions with realistic upvotes and participant links.`);

  // 5. Create Live Active Poll
  const activePollId = uuidv4();
  execute(`
    INSERT INTO polls (id, session_id, question, status, show_results, created_at)
    VALUES (?, ?, ?, 'active', 1, ?)
  `, [
    activePollId,
    sessionId,
    'Which technology stack are you most excited to build with this year?',
    pastMinutes(30)
  ]);

  const activeOptions = [
    { id: uuidv4(), text: 'AI Agents & LLM Tool Use (Python / TS)', voters: participants.slice(0, 20) },
    { id: uuidv4(), text: 'Rust WebAssembly & High-Perf Systems', voters: participants.slice(20, 32) },
    { id: uuidv4(), text: 'Next.js 15 & React 19 Server Components', voters: participants.slice(32, 42) },
    { id: uuidv4(), text: 'Go Microservices & Event Streams', voters: participants.slice(42, 48) }
  ];

  activeOptions.forEach((opt, idx) => {
    execute(
      'INSERT INTO poll_options (id, poll_id, text, votes_count, sort_order) VALUES (?, ?, ?, ?, ?)',
      [opt.id, activePollId, opt.text, opt.voters.length, idx]
    );

    for (const voter of opt.voters) {
      execute(
        'INSERT INTO poll_votes (poll_id, participant_id, option_id, created_at) VALUES (?, ?, ?, ?)',
        [activePollId, voter.id, opt.id, pastMinutes(20)]
      );
    }
  });

  // 6. Create Closed Poll
  const closedPollId = uuidv4();
  execute(`
    INSERT INTO polls (id, session_id, question, status, show_results, created_at)
    VALUES (?, ?, ?, 'closed', 1, ?)
  `, [
    closedPollId,
    sessionId,
    'How are you attending this conference today?',
    pastMinutes(55)
  ]);

  const closedOptions = [
    { id: uuidv4(), text: 'In-person in the main auditorium', voters: participants.slice(0, 28) },
    { id: uuidv4(), text: 'Virtual livestream from home/office', voters: participants.slice(28, 48) }
  ];

  closedOptions.forEach((opt, idx) => {
    execute(
      'INSERT INTO poll_options (id, poll_id, text, votes_count, sort_order) VALUES (?, ?, ?, ?, ?)',
      [opt.id, closedPollId, opt.text, opt.voters.length, idx]
    );

    for (const voter of opt.voters) {
      execute(
        'INSERT INTO poll_votes (poll_id, participant_id, option_id, created_at) VALUES (?, ?, ?, ?)',
        [closedPollId, voter.id, opt.id, pastMinutes(45)]
      );
    }
  });

  persist();

  console.log('✅ Seeded 2 interactive polls with full relational voter distribution.');
  console.log('\n🎉 Database seeding completed successfully!');
  console.log('======================================================');
  console.log('🔑 DEMO LOGIN CREDENTIALS:');
  console.log('   Host Email:     host@eventpulse.io');
  console.log('   Host Password:  password123');
  console.log('   Demo Join Code: DEMO26');
  console.log('======================================================\n');
}

seed().catch(err => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
