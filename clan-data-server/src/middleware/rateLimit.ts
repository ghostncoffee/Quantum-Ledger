import rateLimit from 'express-rate-limit';

const message = { error: 'Too many requests, please try again later.' };

// General API limit: 100 req/min per IP (authenticated calls)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

// Upload endpoints can be hit more frequently (real-time per activity)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

// Health is public — keep it strict to prevent enumeration
export const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});
