import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { registerHost, loginHost, getCurrentHost } from '../controllers/hostAuthController.js';
import {
  createSession,
  getSessionByCode,
  joinSession,
  getHostSessions,
  updateSessionStatus
} from '../controllers/sessionController.js';
import {
  getQuestions,
  createQuestion,
  upvoteQuestion,
  removeUpvote,
  moderateQuestion,
  deleteQuestion
} from '../controllers/questionController.js';
import {
  getPolls,
  getActivePoll,
  createPoll,
  votePoll,
  updatePollStatus,
  deletePoll
} from '../controllers/pollController.js';
import { exportSessionData } from '../controllers/exportController.js';

const router = Router();

// Host Authentication
router.post('/auth/register', registerHost);
router.post('/auth/login', loginHost);
router.get('/auth/me', authMiddleware, getCurrentHost);

// Sessions
router.post('/sessions', authMiddleware, createSession);
router.get('/sessions/host', authMiddleware, getHostSessions);
router.get('/sessions/:code', getSessionByCode);
router.post('/sessions/join', joinSession);
router.patch('/sessions/:id/status', authMiddleware, updateSessionStatus);
router.get('/sessions/:sessionCode/export', exportSessionData);

// Questions
router.get('/sessions/:sessionCode/questions', getQuestions);
router.post('/sessions/:sessionCode/questions', createQuestion);
router.post('/sessions/:sessionCode/questions/:questionId/upvote', upvoteQuestion);
router.delete('/sessions/:sessionCode/questions/:questionId/upvote', removeUpvote);
router.patch('/sessions/:sessionCode/questions/:questionId', authMiddleware, moderateQuestion);
router.delete('/sessions/:sessionCode/questions/:questionId', authMiddleware, deleteQuestion);

// Polls
router.get('/sessions/:sessionCode/polls', getPolls);
router.get('/sessions/:sessionCode/polls/active', getActivePoll);
router.post('/sessions/:sessionCode/polls', authMiddleware, createPoll);
router.post('/sessions/:sessionCode/polls/:pollId/vote', votePoll);
router.patch('/sessions/:sessionCode/polls/:pollId', authMiddleware, updatePollStatus);
router.delete('/sessions/:sessionCode/polls/:pollId', authMiddleware, deletePoll);

export default router;
