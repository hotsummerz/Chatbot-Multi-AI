import { useState } from "react";
import EmojiPicker from "./EmojiPicker";

function CreateCharacter({ onClose, onCreated, onUpdated, editCharacter }) {
  const isEditing = !!editCharacter;

  const [name, setName] = useState(editCharacter?.name || "");
  const [avatar, setAvatar] = useState(editCharacter?.avatar || "🎭");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [description, setDescription] = useState(editCharacter?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(editCharacter?.systemPrompt || "");
  const [greeting, setGreeting] = useState(editCharacter?.greeting || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !description.trim() || !systemPrompt.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      const url = isEditing
        ? `/api/characters/${editCharacter.id}`
        : "/api/characters";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar, description, systemPrompt, greeting }),
      });

      const data = await res.json();
      if (res.ok) {
        if (isEditing) {
          onUpdated(data);
        } else {
          onCreated(data);
        }
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error. Is the backend running?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-overlay" onClick={onClose}>
      <div className="create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-header">
          <h2>{isEditing ? "Edit Character" : "Create Character"}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="create-form">
          {/* Avatar picker */}
          <div className="form-group avatar-group">
            <label>Avatar</label>
            <div className="avatar-picker">
              <button
                type="button"
                className="avatar-display"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Click to search and pick emoji"
              >
                {avatar}
              </button>
              <p className="field-hint avatar-hint">Click to search emojis</p>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={setAvatar}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
          </div>

          {/* Name */}
          <div className="form-group">
            <label htmlFor="char-name">Name</label>
            <input
              id="char-name"
              type="text"
              placeholder="e.g. Captain Luna"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="char-desc">Short Description</label>
            <input
              id="char-desc"
              type="text"
              placeholder="e.g. A fearless space explorer seeking ancient civilizations"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* System Prompt */}
          <div className="form-group">
            <label htmlFor="char-prompt">
              Personality / System Prompt
            </label>
            <p className="field-hint">
              Describe who this character is, how they speak, and how they behave.
              The more detail, the better!
            </p>
            <textarea
              id="char-prompt"
              rows={6}
              placeholder={`e.g. You are Captain Luna, a fearless space explorer from the Andromeda galaxy. You speak confidently and reference your travels across star systems.`}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          {/* Greeting Message */}
          <div className="form-group">
            <label htmlFor="char-greeting">
              Greeting Message <span className="optional-label">(optional)</span>
            </label>
            <p className="field-hint">
              The first message the character sends when a new conversation starts.
            </p>
            <textarea
              id="char-greeting"
              rows={3}
              placeholder={`e.g. *looks up from the star map* Ah, a visitor! Welcome aboard the Andromeda.`}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving
                ? isEditing ? "Saving..." : "Creating..."
                : isEditing ? "Save Changes" : "Create Character"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateCharacter;
