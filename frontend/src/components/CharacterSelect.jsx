function CharacterSelect({ characters, onSelect, onCreateNew, onEdit, onDelete }) {
  const builtin = characters.filter((c) => !c.custom);
  const custom = characters.filter((c) => c.custom);

  return (
    <div className="character-select">
      <div className="select-header">
        <h1>CharacterChat</h1>
        <p>
          {characters.length > 0
            ? "Choose a character to start chatting"
            : "Create your first character to start chatting"}
        </p>
      </div>

      {/* Built-in Characters */}
      {builtin.length > 0 && (
        <>
          <div className="section-title">
            <span>Default Characters</span>
          </div>
          <div className="character-grid">
            {builtin.map((char) => (
              <button
                key={char.id}
                className="character-card"
                onClick={() => onSelect(char)}
              >
                <span className="char-avatar">{char.avatar}</span>
                <h3 className="char-name">{char.name}</h3>
                <p className="char-desc">{char.description}</p>
                <span className="chat-btn">Start Chat →</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Custom Characters */}
      {builtin.length > 0 && (
        <div className="section-title">
          <span>Your Characters</span>
        </div>
      )}
      <div className="character-grid">
        {/* Create New Card */}
        <button className="character-card create-card" onClick={onCreateNew}>
          <span className="char-avatar create-icon">+</span>
          <h3 className="char-name">Create New</h3>
          <p className="char-desc">Design your own unique character</p>
        </button>

        {custom.map((char) => (
          <div key={char.id} className="character-card custom-card">
            <div className="card-top-actions">
              <button
                className="edit-btn"
                title="Edit character"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(char);
                }}
              >
                ✏️
              </button>
              <button
                className="delete-btn"
                title="Delete character"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      `Delete "${char.name}"? This can't be undone.`
                    )
                  ) {
                    onDelete(char.id);
                  }
                }}
              >
                ✕
              </button>
            </div>
            <span className="char-avatar">{char.avatar}</span>
            <h3 className="char-name">{char.name}</h3>
            <p className="char-desc">{char.description}</p>
            <button
              className="chat-btn"
              onClick={() => onSelect(char)}
            >
              Start Chat →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CharacterSelect;
