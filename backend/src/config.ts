import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || 'bookflow-super-secret-jwt-key-2026';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'bookflow-super-secret-refresh-key-2026';
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookflow?schema=public';

// Security settings
export const BCRYPT_SALT_ROUNDS = 10;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window per IP

// Notification simulation constants
export const TWILIO_MOCK_NUM = '+15550000000';
export const SENDGRID_MOCK_EMAIL = 'no-reply@bookflow.com';
