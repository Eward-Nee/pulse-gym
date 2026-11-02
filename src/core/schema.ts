export const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS active_session (singleton INTEGER PRIMARY KEY CHECK(singleton=1), state TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workouts (id TEXT PRIMARY KEY, name TEXT NOT NULL, exercises TEXT NOT NULL, position INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, name TEXT NOT NULL, finishedAt INTEGER NOT NULL, seconds INTEGER NOT NULL, exercises TEXT NOT NULL, completedSets TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS session_time ON sessions(finishedAt DESC);
CREATE TABLE IF NOT EXISTS friends (id TEXT PRIMARY KEY, name TEXT NOT NULL, publicKey TEXT NOT NULL UNIQUE, host TEXT NOT NULL, port INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','accepted')), verified INTEGER NOT NULL DEFAULT 0, shareTemplates INTEGER NOT NULL DEFAULT 0, shareHistory INTEGER NOT NULL DEFAULT 0, templates TEXT NOT NULL DEFAULT '[]', history TEXT NOT NULL DEFAULT '[]', syncedAt INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS profile (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), settings TEXT NOT NULL, partnerId TEXT REFERENCES friends(id) ON DELETE SET NULL);
CREATE TRIGGER IF NOT EXISTS accepted_partner BEFORE UPDATE OF partnerId ON profile WHEN NEW.partnerId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM friends WHERE id=NEW.partnerId AND status='accepted' AND verified=1) BEGIN SELECT RAISE(ABORT, 'Partner must be an accepted verified friend'); END;
CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, friendId TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE, title TEXT NOT NULL, kind TEXT NOT NULL, target REAL NOT NULL, deadline INTEGER NOT NULL, createdAt INTEGER NOT NULL, direction TEXT NOT NULL, status TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS challenge_deadline ON challenges(deadline);
CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, friendId TEXT NOT NULL REFERENCES friends(id) ON DELETE CASCADE, packet TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, receivedAt INTEGER NOT NULL);
PRAGMA user_version = 1;
`;
