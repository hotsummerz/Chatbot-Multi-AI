import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

const CHAT_MODES = [
  { id: "casual", label: "💬 Casual" },
  { id: "roleplay", label: "🎭 Roleplay" },
  { id: "story", label: "📖 Story" },
];

// Version history helpers (stored in localStorage per character)
const VERSIONS_PREFIX = "chatchat_versions_";

function getVersionsKey(characterId) {
  return VERSIONS_PREFIX + characterId;
}

function loadVersions(characterId) {
  try {
    const raw = localStorage.getItem(getVersionsKey(characterId));
    return raw ? JSON.parse(raw) : {}; // { messageIndex: [v1, v2, ...] }
  } catch { return {}; }
}

function saveVersions(characterId, versionsMap) {
  try {
    localStorage.setItem(getVersionsKey(characterId), JSON.stringify(versionsMap));
  } catch { /* ignore */ }
}

function clearVersions(characterId) {
  localStorage.removeItem(getVersionsKey(characterId));
}

function ChatWindow({ character }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [chatMode, setChatMode] = useState(() => localStorage.getItem("chat_mode") || "roleplay");
  const [fallbackNotice, setFallbackNotice] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [versionsMap, setVersionsMap] = useState(() => loadVersions(character.id));
  const [activeVersions, setActiveVersions] = useState({}); // { msgIndex: currentVersionIndex }
  const bottomRef = useRef(null);
  const abortRef = useRef(null);
  const modelPickerRef = useRef(null);

  // Load available models
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data);
        // Default to first available model
        if (data.length > 0) {
          const saved = localStorage.getItem("preferred_model");
          const preferred = data.find((m) => m.id === saved);
          setSelectedModel(preferred ? preferred.id : data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Persist model selection
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("preferred_model", selectedModel);
    }
  }, [selectedModel]);

  // Persist chat mode
  useEffect(() => {
    localStorage.setItem("chat_mode", chatMode);
  }, [chatMode]);

  // Close model picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load chat history from backend on mount
  useEffect(() => {
    fetch(`/api/chat/${character.id}`)
      .then((r) => r.json())
      .then((data) => {
        const history = Array.isArray(data) ? data : [];
        // If empty history and character has a greeting, add it
        if (history.length === 0 && character.greeting) {
          const greetingMsg = { role: "assistant", content: character.greeting };
          setMessages([greetingMsg]);
          // Save greeting to backend
          fetch(`/api/chat/${character.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [greetingMsg] }),
          }).catch(() => {});
        } else {
          setMessages(history);
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [character.id, character.greeting]);

  // Sync messages to backend whenever they change
  const syncToServer = useCallback(
    (msgs) => {
      fetch(`/api/chat/${character.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      }).catch(() => {});
    },
    [character.id]
  );

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, streamingContent]);

  // Streaming fetch for AI reply
  const fetchStreamReply = async (conversationMessages) => {
    setIsTyping(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          modelId: selectedModel,
          mode: chatMode,
          messages: conversationMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setIsTyping(false);
        setStreamingContent("");
        return {
          role: "assistant",
          content: `⚠️ ${errData.error || "Something went wrong."}`,
          error: true,
        };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.fallback) {
                setFallbackNotice(payload.modelName);
                continue;
              }
              if (payload.error) {
                setIsTyping(false);
                setStreamingContent("");
                return {
                  role: "assistant",
                  content: `⚠️ ${payload.error}`,
                  error: true,
                };
              }
              if (payload.done) {
                setIsTyping(false);
                setStreamingContent("");
                // Clear fallback notice after 5s
                setTimeout(() => setFallbackNotice(""), 5000);
                return { role: "assistant", content: fullContent };
              }
              if (payload.content) {
                fullContent += payload.content;
                setStreamingContent(fullContent);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      // If stream ended without done signal
      setIsTyping(false);
      setStreamingContent("");
      return fullContent
        ? { role: "assistant", content: fullContent }
        : { role: "assistant", content: "...", error: true };
    } catch (err) {
      setIsTyping(false);
      setStreamingContent("");
      if (err.name === "AbortError") {
        return { role: "assistant", content: "⚠️ Response cancelled.", error: true };
      }
      return {
        role: "assistant",
        content: "⚠️ Network error. Is the backend running?",
        error: true,
      };
    } finally {
      abortRef.current = null;
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

    const reply = await fetchStreamReply(updatedMessages);
    const finalMessages = [...updatedMessages, reply];
    setMessages(finalMessages);
    syncToServer(finalMessages);
  };

  // Regenerate the last AI response (save old version for rewind)
  const handleRegenerate = async (index) => {
    if (isTyping) return;

    const oldMsg = messages[index];
    const messagesBefore = messages.slice(0, index);

    // Save the old response as a version
    const newVersionsMap = { ...versionsMap };
    if (!newVersionsMap[index]) {
      newVersionsMap[index] = [oldMsg.content];
    }
    // Don't add duplicate
    setVersionsMap(newVersionsMap);
    saveVersions(character.id, newVersionsMap);

    setMessages(messagesBefore);

    const reply = await fetchStreamReply(messagesBefore);
    const finalMessages = [...messagesBefore, reply];
    setMessages(finalMessages);

    // Append the new reply as the latest version
    const updatedVersionsMap = { ...newVersionsMap };
    updatedVersionsMap[index] = [...(updatedVersionsMap[index] || []), reply.content];
    setVersionsMap(updatedVersionsMap);
    saveVersions(character.id, updatedVersionsMap);

    // Point to the latest version
    setActiveVersions((prev) => ({ ...prev, [index]: updatedVersionsMap[index].length - 1 }));
    syncToServer(finalMessages);
  };

  // Swipe between response versions
  const swipeVersion = (msgIndex, direction) => {
    const versions = versionsMap[msgIndex];
    if (!versions || versions.length === 0) return;

    const total = versions.length;
    const current = activeVersions[msgIndex] ?? (total - 1);
    const newIdx = direction === "prev"
      ? Math.max(0, current - 1)
      : Math.min(total - 1, current + 1);

    if (newIdx === current) return;

    setActiveVersions((prev) => ({ ...prev, [msgIndex]: newIdx }));

    // Update the displayed message content from versions array
    setMessages((prev) =>
      prev.map((msg, i) => {
        if (i === msgIndex) {
          const isLatest = newIdx === total - 1;
          return {
            ...msg,
            content: versions[newIdx],
            _isOldVersion: !isLatest,
          };
        }
        return msg;
      })
    );
  };

  // Get version display info for a message
  const getVersionInfo = (msgIndex) => {
    const versions = versionsMap[msgIndex];
    if (!versions || versions.length <= 1) return null;
    const current = activeVersions[msgIndex] ?? (versions.length - 1);
    return {
      current: current + 1, // 1-based
      total: versions.length,
      canPrev: current > 0,
      canNext: current < versions.length - 1,
    };
  };

  // Start editing an AI message
  const startEdit = (index) => {
    setEditingIndex(index);
    setEditText(messages[index].content);
  };

  // Save the edited message
  const saveEdit = () => {
    if (editText.trim()) {
      const updated = messages.map((msg, i) =>
        i === editingIndex
          ? { ...msg, content: editText.trim(), edited: true }
          : msg
      );
      setMessages(updated);
      syncToServer(updated);
    }
    setEditingIndex(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  // Copy message text
  const copyMessage = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // Delete a message and all after it
  const handleDeleteMessage = (index) => {
    if (window.confirm("Delete this message and everything after it?")) {
      const updated = messages.slice(0, index);
      setMessages(updated);
      syncToServer(updated);
    }
  };

  // Branch from a user message — truncate to before this message
  const handleBranch = (index) => {
    if (isTyping) return;
    const updated = messages.slice(0, index);
    setMessages(updated);
    syncToServer(updated);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClearChat = async () => {
    if (window.confirm("Clear all messages with this character?")) {
      setMessages([]);
      setVersionsMap({});
      setActiveVersions({});
      clearVersions(character.id);
      try {
        await fetch(`/api/chat/${character.id}`, { method: "DELETE" });
      } catch {}
    }
  };

  // Find the index of the last assistant message
  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && !messages[i].error) return i;
    }
    return -1;
  })();

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-char-info" onClick={() => setShowProfile(true)} title="View character profile">
          <span className="chat-avatar">{character.avatar}</span>
          <span className="chat-char-name">{character.name}</span>
        </button>
        {/* Chat mode selector */}
        <div className="mode-selector">
          {CHAT_MODES.map((m) => (
            <button
              key={m.id}
              className={`mode-btn ${chatMode === m.id ? "active" : ""}`}
              onClick={() => setChatMode(m.id)}
              title={m.id.charAt(0).toUpperCase() + m.id.slice(1) + " mode"}
            >
              {m.label}
            </button>
          ))}
        </div>
        {/* Model selector - rich dropdown */}
        {models.length > 1 && (
          <div className="model-picker" ref={modelPickerRef}>
            <button
              className="model-picker-trigger"
              onClick={() => setShowModelPicker(!showModelPicker)}
              title="Choose AI model"
            >
              <span className="model-picker-name">
                {models.find((m) => m.id === selectedModel)?.name || "Select Model"}
              </span>
              <span className="model-picker-arrow">▾</span>
            </button>
            {showModelPicker && (
              <div className="model-picker-dropdown">
                {models.map((m) => (
                  <button
                    key={m.id}
                    className={`model-picker-item ${selectedModel === m.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setShowModelPicker(false);
                    }}
                  >
                    <span className="model-item-name">{m.name}</span>
                    <span className="model-item-desc">{m.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.length > 0 && (
          <button
            className="clear-btn"
            onClick={handleClearChat}
            title="Clear chat"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="messages-area">
        {/* Fallback notice */}
        {fallbackNotice && (
          <div className="fallback-notice">
            ⚡ Switched to <strong>{fallbackNotice}</strong> (primary model was rate limited)
          </div>
        )}
        {!historyLoaded && (
          <div className="empty-state">
            <div className="spinner" />
            <p>Loading chat history...</p>
          </div>
        )}
        {historyLoaded && messages.length === 0 && !isTyping && (
          <div className="empty-state">
            <span className="empty-avatar">{character.avatar}</span>
            <p>
              Say something to <strong>{character.name}</strong>!
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isAssistant = msg.role === "assistant";
          const isUser = msg.role === "user";
          const isEditing = editingIndex === i;
          const isHovered = hoveredIndex === i;
          const isLastAssistant = i === lastAssistantIndex;
          const showActions =
            isAssistant && !msg.error && isHovered && !isEditing && !isTyping;
          const showBranchBtn =
            isUser && isHovered && !isTyping && i < messages.length - 1;
          const versionInfo = isAssistant ? getVersionInfo(i) : null;
          const hasVersions = versionInfo && versionInfo.total > 1;

          return (
            <div
              key={i}
              className={`message ${msg.role}${msg.error ? " error" : ""}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {isAssistant && (
                <span className="msg-avatar">{character.avatar}</span>
              )}
              <div className="msg-bubble-wrap">
                {isEditing ? (
                  <div className="edit-mode">
                    <textarea
                      className="edit-textarea"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={Math.min(editText.split("\n").length + 1, 10)}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button className="edit-cancel" onClick={cancelEdit}>
                        Cancel
                      </button>
                      <button className="edit-save" onClick={saveEdit}>
                        Save & Continue
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`msg-bubble${msg.edited ? " edited" : ""}${msg._isOldVersion ? " old-version" : ""}`}>
                    {isAssistant && !msg.error ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                )}

                {/* Version swipe controls */}
                {hasVersions && !isEditing && !isTyping && (
                  <div className="version-swipe">
                    <button
                      className="swipe-btn"
                      disabled={!versionInfo.canPrev}
                      onClick={() => swipeVersion(i, "prev")}
                      title="Previous response"
                    >
                      ‹
                    </button>
                    <span className="version-counter">
                      {versionInfo.current}/{versionInfo.total}
                    </span>
                    <button
                      className="swipe-btn"
                      disabled={!versionInfo.canNext}
                      onClick={() => swipeVersion(i, "next")}
                      title="Next response"
                    >
                      ›
                    </button>
                  </div>
                )}

                {showActions && (
                  <div className="msg-actions">
                    <button
                      className="action-btn"
                      onClick={() => copyMessage(msg.content)}
                      title="Copy"
                    >
                      📋
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => startEdit(i)}
                      title="Edit response"
                    >
                      ✏️
                    </button>
                    {isLastAssistant && (
                      <button
                        className="action-btn"
                        onClick={() => handleRegenerate(i)}
                        title="Regenerate"
                      >
                        🔄
                      </button>
                    )}
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteMessage(i)}
                      title="Delete from here"
                    >
                      🗑️
                    </button>
                  </div>
                )}

                {/* Branch button on user messages */}
                {showBranchBtn && (
                  <div className="msg-actions">
                    <button
                      className="action-btn branch-btn"
                      onClick={() => handleBranch(i)}
                      title="Branch from here — remove everything after this and try a different reply"
                    >
                      🔀 Branch
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming response in progress */}
        {isTyping && streamingContent && (
          <div className="message assistant">
            <span className="msg-avatar">{character.avatar}</span>
            <div className="msg-bubble-wrap">
              <div className="msg-bubble streaming">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
                <span className="streaming-cursor">▊</span>
              </div>
            </div>
          </div>
        )}

        {/* Typing dots (before stream starts) */}
        {isTyping && !streamingContent && (
          <div className="message assistant">
            <span className="msg-avatar">{character.avatar}</span>
            <div className="msg-bubble typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="input-area">
        {isTyping && (
          <button className="stop-btn" onClick={stopStreaming} title="Stop generating">
            ⬛
          </button>
        )}
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${character.name}...`}
          rows={1}
          disabled={isTyping || editingIndex !== null}
        />
        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || isTyping || editingIndex !== null}
        >
          Send
        </button>
      </div>

      {/* Character Profile Panel */}
      {showProfile && (
        <div className="profile-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
            <div className="profile-header">
              <span className="profile-avatar">{character.avatar}</span>
              <div className="profile-title">
                <h2>{character.name}</h2>
                <p>{character.description}</p>
              </div>
              <button className="close-btn" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <div className="profile-body">
              <div className="profile-section">
                <h3>Personality</h3>
                <p className="profile-prompt">{character.systemPrompt}</p>
              </div>
              {character.greeting && (
                <div className="profile-section">
                  <h3>Greeting Message</h3>
                  <p className="profile-greeting">{character.greeting}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
