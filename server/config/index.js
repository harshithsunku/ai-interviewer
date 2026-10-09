// Load server/.env whatever the working directory (the root `npm start` runs from the repo root);
// variables already set in the environment (e.g. on Render) take precedence
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

module.exports = {
  PORT: process.env.PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL: process.env.DATABASE_SSL, // unset (auto) | "false" | "no-verify" — see utils/db.js
  DATABASE_SSL_CA: process.env.DATABASE_SSL_CA, // optional path to a PEM CA for the database
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

  AI_PROVIDER: process.env.AI_PROVIDER,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  GROQ_STT_MODEL: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
  GROQ_TTS_MODEL: process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english',
  GROQ_TTS_VOICE: process.env.GROQ_TTS_VOICE || 'hannah',
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'groq', // "groq" | "browser"
};
