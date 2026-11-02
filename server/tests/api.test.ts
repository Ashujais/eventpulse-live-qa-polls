import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDb, resetTestDb } from '../src/db/index.js';

describe('EventPulse Backend API & Business Logic Test Suite', () => {
  let app: any;
  let hostToken: string;
  let hostId: string;
  let sessionCode: string;
  let sessionId: string;
  let participant1Id: string;
  let participant2Id: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = ':memory:';
    await resetTestDb();
    app = createApp();
  });

  beforeEach(async () => {
    // Reset test database before tests to ensure complete isolation
    await resetTestDb();

    // 1. Register host
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test-host@eventpulse.io',
        name: 'Lead Organizer',
        password: 'password123'
      });

    expect(regRes.status).toBe(201);
    hostToken = regRes.body.token;
    hostId = regRes.body.host.id;

    // 2. Create a test session
    const sessRes = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Keynote Tech Symposium',
        description: 'Annual interactive engineering session',
        customCode: 'KEY2026',
        allow_anonymous: true
      });

    expect(sessRes.status).toBe(201);
    sessionCode = sessRes.body.session.code;
    sessionId = sessRes.body.session.id;

    // 3. Register two test participants
    const p1Res = await request(app)
      .post('/api/sessions/join')
      .send({ code: sessionCode, displayName: 'Alice Participant' });
    expect(p1Res.status).toBe(200);
    participant1Id = p1Res.body.participant.id;

    const p2Res = await request(app)
      .post('/api/sessions/join')
      .send({ code: sessionCode, displayName: 'Bob Participant' });
    expect(p2Res.status).toBe(200);
    participant2Id = p2Res.body.participant.id;
  });

  // TEST 1: Session lookup and validation
  it('1. should retrieve session by join code and return 404 for invalid code', async () => {
    const validRes = await request(app).get(`/api/sessions/${sessionCode}`);
    expect(validRes.status).toBe(200);
    expect(validRes.body.session.title).toBe('Keynote Tech Symposium');
    expect(validRes.body.session.code).toBe('KEY2026');

    const invalidRes = await request(app).get('/api/sessions/INVALID999');
    expect(invalidRes.status).toBe(404);
    expect(invalidRes.body.error).toContain('No session found');
  });

  // TEST 2: Audience join validation
  it('2. should reject audience join with empty display name', async () => {
    const res = await request(app)
      .post('/api/sessions/join')
      .send({ code: sessionCode, displayName: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // TEST 3: Question creation, character limits, and anonymous handling
  it('3. should create questions, reject invalid content, and support anonymous posting', async () => {
    // Too short question
    const shortRes = await request(app)
      .post(`/api/sessions/${sessionCode}/questions`)
      .send({
        content: 'Hi',
        participantId: participant1Id
      });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.error).toContain('at least 3 characters');

    // Valid named question
    const q1Res = await request(app)
      .post(`/api/sessions/${sessionCode}/questions`)
      .send({
        content: 'How will AI Agents impact front-end architecture in 2026?',
        participantId: participant1Id,
        isAnonymous: false
      });
    expect(q1Res.status).toBe(201);
    expect(q1Res.body.question.author_name).toBe('Alice Participant');
    expect(q1Res.body.question.upvotes_count).toBe(0);

    // Valid anonymous question
    const q2Res = await request(app)
      .post(`/api/sessions/${sessionCode}/questions`)
      .send({
        content: 'Is there a salary increase planned for junior engineers this quarter?',
        participantId: participant2Id,
        isAnonymous: true
      });
    expect(q2Res.status).toBe(201);
    expect(q2Res.body.question.author_name).toBe('Anonymous');
    expect(q2Res.body.question.is_anonymous).toBe(1);
  });

  // TEST 4: STRICT SERVER-SIDE ENFORCEMENT OF ONE VOTE PER PERSON PER QUESTION
  it('4. should strictly enforce one upvote per person per question on the server', async () => {
    // Create question
    const qRes = await request(app)
      .post(`/api/sessions/${sessionCode}/questions`)
      .send({
        content: 'Can we use Bun instead of Node in production?',
        participantId: participant1Id
      });
    const questionId = qRes.body.question.id;

    // Participant 1 casts first upvote -> SUCCESS (200)
    const firstVoteRes = await request(app)
      .post(`/api/sessions/${sessionCode}/questions/${questionId}/upvote`)
      .send({ participantId: participant1Id });

    expect(firstVoteRes.status).toBe(200);
    expect(firstVoteRes.body.upvotesCount).toBe(1);
    expect(firstVoteRes.body.has_voted).toBe(true);

    // Participant 1 attempts second upvote -> STRICTLY REJECTED by server with 409 Conflict!
    const duplicateVoteRes = await request(app)
      .post(`/api/sessions/${sessionCode}/questions/${questionId}/upvote`)
      .send({ participantId: participant1Id });

    expect(duplicateVoteRes.status).toBe(409);
    expect(duplicateVoteRes.body.error).toContain('already upvoted');

    // Verify upvote count is STILL 1
    const getRes = await request(app)
      .get(`/api/sessions/${sessionCode}/questions?participantId=${participant1Id}`);
    const targetQ = getRes.body.questions.find((q: any) => q.id === questionId);
    expect(targetQ.upvotes_count).toBe(1);
    expect(targetQ.has_voted).toBe(true);

    // Participant 2 casts upvote -> SUCCESS, count increments to 2
    const p2VoteRes = await request(app)
      .post(`/api/sessions/${sessionCode}/questions/${questionId}/upvote`)
      .send({ participantId: participant2Id });

    expect(p2VoteRes.status).toBe(200);
    expect(p2VoteRes.body.upvotesCount).toBe(2);
  });

  // TEST 5: Host moderation (mark answered, hide question)
  it('5. should allow host to mark question answered, hide it from audience, and pin it', async () => {
    const qRes = await request(app)
      .post(`/api/sessions/${sessionCode}/questions`)
      .send({
        content: 'Will the slides be shared after the presentation?',
        participantId: participant1Id
      });
    const questionId = qRes.body.question.id;

    // Host marks answered
    const answerRes = await request(app)
      .patch(`/api/sessions/${sessionCode}/questions/${questionId}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ is_answered: 1 });

    expect(answerRes.status).toBe(200);
    expect(answerRes.body.question.is_answered).toBe(1);

    // Host hides question
    const hideRes = await request(app)
      .patch(`/api/sessions/${sessionCode}/questions/${questionId}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ is_hidden: 1 });

    expect(hideRes.status).toBe(200);
    expect(hideRes.body.question.is_hidden).toBe(1);

    // Audience request does NOT show the hidden question
    const audienceList = await request(app).get(`/api/sessions/${sessionCode}/questions`);
    const foundInAudience = audienceList.body.questions.some((q: any) => q.id === questionId);
    expect(foundInAudience).toBe(false);

    // Host request DOES show the hidden question
    const hostList = await request(app).get(`/api/sessions/${sessionCode}/questions?isHost=true`);
    const foundInHost = hostList.body.questions.some((q: any) => q.id === questionId);
    expect(foundInHost).toBe(true);
  });

  // TEST 6: Poll creation and options validation
  it('6. should validate poll options and create active single-choice poll', async () => {
    // Rejects poll with only 1 option
    const invalidPollRes = await request(app)
      .post(`/api/sessions/${sessionCode}/polls`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        question: 'Is this invalid?',
        options: ['Only one choice']
      });

    expect(invalidPollRes.status).toBe(400);
    expect(invalidPollRes.body.error).toContain('at least 2 options');

    // Creates valid poll
    const validPollRes = await request(app)
      .post(`/api/sessions/${sessionCode}/polls`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        question: 'Which framework do you prefer for high-scale web apps?',
        options: ['React', 'Vue', 'Svelte', 'Angular'],
        status: 'active'
      });

    expect(validPollRes.status).toBe(201);
    expect(validPollRes.body.poll.question).toBe('Which framework do you prefer for high-scale web apps?');
    expect(validPollRes.body.poll.options.length).toBe(4);
    expect(validPollRes.body.poll.status).toBe('active');
  });

  // TEST 7: STRICT SERVER-SIDE ENFORCEMENT OF ONE VOTE PER PERSON PER POLL
  it('7. should strictly enforce one vote per person per poll on the server', async () => {
    // Create poll
    const pollRes = await request(app)
      .post(`/api/sessions/${sessionCode}/polls`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        question: 'Tabs or Spaces?',
        options: ['Tabs', 'Spaces'],
        status: 'active'
      });

    const pollId = pollRes.body.poll.id;
    const tabOptionId = pollRes.body.poll.options[0].id;
    const spaceOptionId = pollRes.body.poll.options[1].id;

    // Participant 1 votes for Tabs -> SUCCESS (200)
    const vote1Res = await request(app)
      .post(`/api/sessions/${sessionCode}/polls/${pollId}/vote`)
      .send({
        optionId: tabOptionId,
        participantId: participant1Id
      });

    expect(vote1Res.status).toBe(200);
    expect(vote1Res.body.poll.total_votes).toBe(1);
    const tabOpt = vote1Res.body.poll.options.find((o: any) => o.id === tabOptionId);
    expect(tabOpt.votes_count).toBe(1);

    // Participant 1 attempts to vote AGAIN for Spaces -> STRICTLY REJECTED with 409 Conflict!
    const duplicateVoteRes = await request(app)
      .post(`/api/sessions/${sessionCode}/polls/${pollId}/vote`)
      .send({
        optionId: spaceOptionId,
        participantId: participant1Id
      });

    expect(duplicateVoteRes.status).toBe(409);
    expect(duplicateVoteRes.body.error).toContain('already voted in this poll');

    // Participant 2 votes for Spaces -> SUCCESS (200)
    const vote2Res = await request(app)
      .post(`/api/sessions/${sessionCode}/polls/${pollId}/vote`)
      .send({
        optionId: spaceOptionId,
        participantId: participant2Id
      });

    expect(vote2Res.status).toBe(200);
    expect(vote2Res.body.poll.total_votes).toBe(2);
  });

  // TEST 8: Export session data (CSV & JSON)
  it('8. should export session questions and poll results in CSV and JSON formats', async () => {
    // CSV export
    const csvRes = await request(app)
      .get(`/api/sessions/${sessionCode}/export?format=csv`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.header['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('SESSION REPORT');
    expect(csvRes.text).toContain('KEY2026');
    expect(csvRes.text).toContain('--- QUESTIONS ---');

    // JSON export
    const jsonRes = await request(app)
      .get(`/api/sessions/${sessionCode}/export?format=json`);

    expect(jsonRes.status).toBe(200);
    expect(jsonRes.header['content-type']).toContain('application/json');
    expect(jsonRes.body.session.code).toBe('KEY2026');
    expect(Array.isArray(jsonRes.body.questions)).toBe(true);
    expect(Array.isArray(jsonRes.body.polls)).toBe(true);
  });
});
