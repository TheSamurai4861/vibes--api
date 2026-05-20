import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const windowMs = config.rateLimitWindowMs;

export const apiGlobalLimiter = rateLimit({
  windowMs,
  max: config.rateLimitGlobalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const searchDetailsLimiter = rateLimit({
  windowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many search or detail requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
