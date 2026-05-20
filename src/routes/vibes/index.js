import { Router } from 'express';
import { vibesWriteLimiter } from '../../middleware/rateLimit.js';
import authRouter from './auth.js';
import usersRouter from './users.js';
import ratingsRouter from './ratings.js';
import reviewsRouter from './reviews.js';
import musicRouter from './music.js';
import feedRouter from './feed.js';
import listsRouter from './lists.js';
import onboardingRouter from './onboarding.js';
import recommendationsRouter from './recommendations.js';
import conversationsRouter from './conversations.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/ratings', vibesWriteLimiter, ratingsRouter);
router.use('/reviews', vibesWriteLimiter, reviewsRouter);
router.use('/music', musicRouter);
router.use('/feed', feedRouter);
router.use('/lists', listsRouter);
router.use('/onboarding', onboardingRouter);
router.use('/recommendations', recommendationsRouter);
router.use('/conversations', vibesWriteLimiter, conversationsRouter);

router.use((req, res) => {
  res.status(404).json({ error: 'Vibes route not found.', code: 'NOT_FOUND' });
});

export default router;
