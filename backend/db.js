import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "chatbot.db");
const OLD_CUSTOM_FILE = path.join(__dirname, "custom_characters.json");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🎭',
    description TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL,
    greeting TEXT NOT NULL DEFAULT '',
    custom INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    edited INTEGER NOT NULL DEFAULT 0,
    error INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_character
    ON chat_messages(character_id, created_at);
`);

// Migration: add greeting column if it doesn't exist
try {
  db.exec(`ALTER TABLE characters ADD COLUMN greeting TEXT NOT NULL DEFAULT ''`);
  console.log('Migrated: added greeting column.');
} catch {
  // Column already exists — ignore
}

// ===================== CHARACTER FUNCTIONS =====================

export function getAllCharacters() {
  return db
    .prepare("SELECT * FROM characters ORDER BY custom ASC, created_at DESC")
    .all()
    .map(rowToCharacter);
}

export function getCharacterById(id) {
  const row = db.prepare("SELECT * FROM characters WHERE id = ?").get(id);
  return row ? rowToCharacter(row) : null;
}

export function addCustomCharacter({ name, avatar, description, systemPrompt, greeting }) {
  const id = "custom_" + Date.now();
  db.prepare(
    `INSERT INTO characters (id, name, avatar, description, system_prompt, greeting, custom)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).run(id, name.trim(), avatar || "🎭", description.trim(), systemPrompt.trim(), (greeting || "").trim());
  return getCharacterById(id);
}

export function updateCustomCharacter(id, { name, avatar, description, systemPrompt, greeting }) {
  // Only allow updating custom characters
  const existing = db.prepare("SELECT * FROM characters WHERE id = ? AND custom = 1").get(id);
  if (!existing) return null;

  db.prepare(
    `UPDATE characters
     SET name = ?, avatar = ?, description = ?, system_prompt = ?, greeting = ?
     WHERE id = ?`
  ).run(
    name.trim(),
    avatar || existing.avatar,
    description.trim(),
    systemPrompt.trim(),
    (greeting || "").trim(),
    id
  );
  return getCharacterById(id);
}

export function deleteCustomCharacter(id) {
  // Delete messages first (or rely on CASCADE), then the character
  const result = db
    .prepare("DELETE FROM characters WHERE id = ? AND custom = 1")
    .run(id);
  return result.changes > 0;
}

// ===================== CHAT HISTORY FUNCTIONS =====================

export function getChatHistory(characterId) {
  return db
    .prepare(
      `SELECT role, content, edited, error FROM chat_messages
       WHERE character_id = ? ORDER BY created_at ASC`
    )
    .all(characterId)
    .map((row) => ({
      role: row.role,
      content: row.content,
      edited: !!row.edited,
      error: !!row.error,
    }));
}

export function saveChatMessage(characterId, { role, content, edited = false, error = false }) {
  db.prepare(
    `INSERT INTO chat_messages (character_id, role, content, edited, error)
     VALUES (?, ?, ?, ?, ?)`
  ).run(characterId, role, content, edited ? 1 : 0, error ? 1 : 0);
}

export function updateChatMessage(messageId, content) {
  db.prepare(
    `UPDATE chat_messages SET content = ?, edited = 1 WHERE id = ?`
  ).run(content, messageId);
}

export function deleteChatFromMessage(characterId, messageIndex) {
  // Get all message IDs for this character, ordered by creation time
  const messages = db
    .prepare("SELECT id FROM chat_messages WHERE character_id = ? ORDER BY created_at ASC")
    .all(characterId);

  if (messageIndex >= messages.length) return 0;

  const idsToDelete = messages.slice(messageIndex).map((m) => m.id);
  if (idsToDelete.length === 0) return 0;

  const placeholders = idsToDelete.map(() => "?").join(",");
  const result = db
    .prepare(`DELETE FROM chat_messages WHERE id IN (${placeholders})`)
    .run(...idsToDelete);
  return result.changes;
}

export function clearChatHistory(characterId) {
  db.prepare("DELETE FROM chat_messages WHERE character_id = ?").run(characterId);
}

// Replaces entire chat history (used for edit/regenerate from frontend)
export function replaceChatHistory(characterId, messages) {
  const deleteStmt = db.prepare("DELETE FROM chat_messages WHERE character_id = ?");
  const insertStmt = db.prepare(
    `INSERT INTO chat_messages (character_id, role, content, edited, error)
     VALUES (?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    deleteStmt.run(characterId);
    for (const msg of messages) {
      insertStmt.run(
        characterId,
        msg.role,
        msg.content,
        msg.edited ? 1 : 0,
        msg.error ? 1 : 0
      );
    }
  });

  transaction();
}

// ===================== MIGRATION =====================

// Migrate old custom_characters.json into SQLite if it exists
function migrateOldData() {
  try {
    if (fs.existsSync(OLD_CUSTOM_FILE)) {
      const data = JSON.parse(fs.readFileSync(OLD_CUSTOM_FILE, "utf-8"));
      const insert = db.prepare(
        `INSERT OR IGNORE INTO characters (id, name, avatar, description, system_prompt, custom)
         VALUES (?, ?, ?, ?, ?, 1)`
      );
      for (const c of data) {
        insert.run(c.id, c.name, c.avatar || "🎭", c.description, c.systemPrompt);
      }
      // Rename old file so we don't migrate again
      fs.renameSync(OLD_CUSTOM_FILE, OLD_CUSTOM_FILE + ".bak");
      console.log(`Migrated ${data.length} custom characters from JSON to SQLite.`);
    }
  } catch (err) {
    console.error("Migration error:", err);
  }
}

migrateOldData();

// ===================== HELPERS =====================

function rowToCharacter(row) {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    description: row.description,
    systemPrompt: row.system_prompt,
    greeting: row.greeting || "",
    custom: !!row.custom,
  };
}

export default db;
