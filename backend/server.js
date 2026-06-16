import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getAllCharacters,
  getCharacterById,
  addCustomCharacter,
  updateCustomCharacter,
  deleteCustomCharacter,
  getChatHistory,
  replaceChatHistory,
  clearChatHistory,
} from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===================== AI PROVIDERS =====================

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// OpenRouter uses OpenAI-compatible API via fetch
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Available models configuration
const OR_AVAILABLE = !!OPENROUTER_KEY && OPENROUTER_KEY !== "your_openrouter_api_key_here";

const MODELS = [
  {
    id: "groq-llama3.3",
    name: "Llama 3.3 70B",
    provider: "groq",
    description: "Fast responses, great for roleplay and casual chat",
    available: !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your_groq_api_key_here",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    description: "Smartest model, massive memory (1M tokens), best for long conversations",
    available: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here",
  },
  {
    id: "or-llama3.3",
    name: "Llama 3.3 70B (OR)",
    provider: "openrouter",
    description: "Same quality as Groq, reliable backup option",
    available: OR_AVAILABLE,
    openrouterModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
  {
    id: "or-deepseek-v3",
    name: "Hermes 3 405B",
    provider: "openrouter",
    description: "Massive 405B parameter model, best for complex roleplay",
    available: OR_AVAILABLE,
    openrouterModel: "nousresearch/hermes-3-llama-3.1-405b:free",
  },
  {
    id: "or-qwen2.5",
    name: "Gemma 4 31B",
    provider: "openrouter",
    description: "Google's efficient model, balanced quality for all modes",
    available: OR_AVAILABLE,
    openrouterModel: "google/gemma-4-31b-it:free",
  },
];

// Chat mode definitions
const CHAT_MODES = {
  casual: {
    id: "casual",
    label: "Casual Chat",
    instruction: "\n\n[Mode: Casual Chat]\nBe conversational, friendly, and helpful. You can step out of character when appropriate and chat naturally like a friend. Always respond in the same language the user is using — if the user writes in Indonesian, respond in Indonesian; if in English, respond in English; if in Japanese, respond in Japanese, etc.",
  },
  roleplay: {
    id: "roleplay",
    label: "Roleplay",
    instruction: "\n\n[Mode: Roleplay]\nStay fully in character at all times. Respond as this character would, using their speech patterns, knowledge, and personality. Use *actions in asterisks* for physical actions. Never break character or acknowledge you are an AI. Always respond in the same language the user is using.",
  },
  story: {
    id: "story",
    label: "Story",
    instruction: "\n\n[Mode: Story]\nAct as a narrative storyteller. Describe the world, setting, and atmosphere vividly. Narrate events, plot developments, and NPC actions. Use rich descriptive prose. Advance the plot based on the user's choices. Include scene-setting, sensory details, and dramatic tension. Always write the narrative in the same language the user is using.",
  },
};

function getAvailableModels() {
  return MODELS.filter((m) => m.available);
}

function resolveModel(modelId) {
  return MODELS.find((m) => m.id === modelId) || getAvailableModels()[0] || null;
}

// Get fallback models (all available except the primary)
function getFallbackModels(excludeId) {
  return getAvailableModels().filter((m) => m.id !== excludeId);
}

// Build the final system prompt with mode
function buildSystemPrompt(characterPrompt, modeId) {
  const mode = CHAT_MODES[modeId] || CHAT_MODES.roleplay;
  return characterPrompt + mode.instruction;
}

// Check if an error is a rate limit / overload
function isRateLimitError(err) {
  const msg = (err?.error?.message || err?.message || "").toLowerCase();
  const code = (err?.error?.code || err?.code || err?.error?.metadata?.raw || "").toString().toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("quota") ||
    msg.includes("503") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("provider returned error") ||
    msg.includes("unavailable for free") ||
    code.includes("429") ||
    code.includes("rate") ||
    code.includes("temporarily")
  );
}

app.use(cors());
app.use(express.json());

// ===================== CHARACTERS =====================

app.get("/api/characters", (req, res) => {
  const allChars = getAllCharacters();
  const publicChars = allChars.map(
    ({ id, name, avatar, description, systemPrompt, greeting, custom }) => ({
      id, name, avatar, description, systemPrompt, greeting, custom: !!custom,
    })
  );
  res.json(publicChars);
});

app.post("/api/characters", (req, res) => {
  const { name, avatar, description, systemPrompt, greeting } = req.body;
  if (!name || !description || !systemPrompt) {
    return res.status(400).json({ error: "name, description, and systemPrompt are required." });
  }
  try {
    const newChar = addCustomCharacter({ name, avatar, description, systemPrompt, greeting });
    res.status(201).json(newChar);
  } catch (err) {
    console.error("Failed to create character:", err);
    res.status(500).json({ error: "Failed to create character." });
  }
});

app.put("/api/characters/:id", (req, res) => {
  const { id } = req.params;
  const { name, avatar, description, systemPrompt, greeting } = req.body;
  if (!name || !description || !systemPrompt) {
    return res.status(400).json({ error: "name, description, and systemPrompt are required." });
  }
  try {
    const updated = updateCustomCharacter(id, { name, avatar, description, systemPrompt, greeting });
    if (!updated) return res.status(404).json({ error: "Character not found or not editable." });
    res.json(updated);
  } catch (err) {
    console.error("Failed to update character:", err);
    res.status(500).json({ error: "Failed to update character." });
  }
});

app.delete("/api/characters/:id", (req, res) => {
  const success = deleteCustomCharacter(req.params.id);
  if (!success) return res.status(404).json({ error: "Custom character not found." });
  res.json({ success: true });
});

// ===================== MODELS & MODES =====================

app.get("/api/models", (req, res) => {
  const models = getAvailableModels().map(({ id, name, description, provider }) => ({
    id, name, description, provider,
  }));
  res.json(models);
});

app.get("/api/modes", (req, res) => {
  res.json(Object.values(CHAT_MODES));
});

// ===================== CHAT HISTORY =====================

app.get("/api/chat/:characterId", (req, res) => {
  const character = getCharacterById(req.params.characterId);
  if (!character) return res.status(404).json({ error: "Character not found." });
  res.json(getChatHistory(req.params.characterId));
});

app.put("/api/chat/:characterId", (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages array is required." });
  const character = getCharacterById(req.params.characterId);
  if (!character) return res.status(404).json({ error: "Character not found." });
  replaceChatHistory(req.params.characterId, messages);
  res.json({ success: true });
});

app.delete("/api/chat/:characterId", (req, res) => {
  clearChatHistory(req.params.characterId);
  res.json({ success: true });
});

// ===================== AI STREAMING HELPERS =====================

async function streamGroq(systemPrompt, messages, res) {
  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.85,
    max_tokens: 1024,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
  }
}

async function streamGemini(systemPrompt, messages, res) {
  const model = googleAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(messages[messages.length - 1].content);

  for await (const chunk of result.stream) {
    const content = chunk.text();
    if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
  }
}

async function streamOpenRouter(systemPrompt, messages, res, openrouterModel) {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: openrouterModel,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.85,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const err = new Error(errData?.error?.message || `OpenRouter ${response.status}`);
    err.error = errData?.error;
    err.code = errData?.error?.code;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content || "";
          if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
        } catch { /* skip */ }
      }
    }
  }
}

// Try streaming with a specific model, returns true on success
async function tryStreamWithModel(model, systemPrompt, messages, res) {
  if (model.provider === "groq") {
    await streamGroq(systemPrompt, messages, res);
  } else if (model.provider === "gemini") {
    await streamGemini(systemPrompt, messages, res);
  } else if (model.provider === "openrouter") {
    await streamOpenRouter(systemPrompt, messages, res, model.openrouterModel);
  }
}

// ===================== CHAT (AI) =====================

app.post("/api/chat", async (req, res) => {
  const { characterId, messages, modelId, mode } = req.body;
  if (!characterId || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "characterId and messages are required." });
  }

  const character = getCharacterById(characterId);
  if (!character) return res.status(404).json({ error: "Character not found." });

  const model = resolveModel(modelId);
  const systemPrompt = buildSystemPrompt(character.systemPrompt, mode);

  // Try primary, then fallback
  const modelsToTry = [model, ...getFallbackModels(model?.id)];

  for (const m of modelsToTry) {
    try {
      let reply = "";

      if (m.provider === "gemini") {
        const geminiModel = googleAI.getGenerativeModel({
          model: "gemini-2.5-flash", systemInstruction: systemPrompt,
        });
        const history = messages.slice(0, -1).map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        }));
        const chat = geminiModel.startChat({ history });
        const result = await chat.sendMessage(messages[messages.length - 1].content);
        reply = result.response.text();
      } else if (m.provider === "openrouter") {
        const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_KEY}` },
          body: JSON.stringify({
            model: m.openrouterModel,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature: 0.85, max_tokens: 1024,
          }),
        });
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const err = new Error(errData?.error?.message || `OpenRouter ${resp.status}`);
          err.error = errData?.error;
          err.code = errData?.error?.code;
          throw err;
        }
        const data = await resp.json();
        reply = data.choices?.[0]?.message?.content || "";
        if (!reply) throw new Error("Empty response from OpenRouter");
      } else {
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.85, max_tokens: 1024,
        });
        reply = completion.choices[0]?.message?.content || "...";
      }

      res.json({
        reply,
        character: { name: character.name, avatar: character.avatar },
        usedModel: m.id,
      });
      return;
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn(`${m.name} rate limited, trying fallback...`);
        continue;
      }
      const errorMessage = err?.error?.message || err?.message || "Unknown error";
      console.error("AI error:", errorMessage);
      res.status(500).json({ error: `AI error: ${errorMessage}` });
      return;
    }
  }

  res.status(503).json({ error: "All AI models are currently rate limited. Please try again later." });
});

// POST /api/chat/stream - streaming with automatic fallback
app.post("/api/chat/stream", async (req, res) => {
  const { characterId, messages, modelId, mode } = req.body;
  if (!characterId || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "characterId and messages are required." });
  }

  const character = getCharacterById(characterId);
  if (!character) return res.status(404).json({ error: "Character not found." });

  const model = resolveModel(modelId);
  const systemPrompt = buildSystemPrompt(character.systemPrompt, mode);

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Try primary model, then fallbacks
  const modelsToTry = [model, ...getFallbackModels(model?.id)];

  for (let i = 0; i < modelsToTry.length; i++) {
    const m = modelsToTry[i];
    try {
      // Notify client if using a different model than requested
      if (i > 0) {
        res.write(`data: ${JSON.stringify({ fallback: true, modelName: m.name })}\n\n`);
      }

      await tryStreamWithModel(m, systemPrompt, messages, res);
      res.write(`data: ${JSON.stringify({ done: true, usedModel: m.id })}\n\n`);
      res.end();
      return;
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn(`${m.name} rate limited, trying next fallback...`);
        continue;
      }
      // Non-rate-limit error — report it
      const errorMessage = err?.error?.message || err?.message || "Unknown error";
      console.error(`${m?.provider} stream error:`, errorMessage);
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
      return;
    }
  }

  // All models failed
  res.write(`data: ${JSON.stringify({ error: "All AI models are currently rate limited. Please try again later." })}\n\n`);
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Available models: ${getAvailableModels().map(m => m.name).join(", ") || "None"}`);
});
