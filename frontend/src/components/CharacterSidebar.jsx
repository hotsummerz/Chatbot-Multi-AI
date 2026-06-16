import { useState } from "react";

function CharacterSidebar({ characters, selectedId, onSelect, onCreateNew, onEdit, onDelete }) {
  const [search, setSearch] = useState("");

  const filtered = characters.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <nav className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1 className="sidebar-title">Messages</h1>
        <button className="sidebar-create-btn" onClick={onCreateNew} title="Create character">
          ✏️
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Character list */}
      <div className="sidebar-list">
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            <p>{search ? "No characters found" : "Create your first character"}</p>
          </div>
        )}

        {filtered.map((char) => {
          const isActive = char.id === selectedId;

          return (
            <div
              key={char.id}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => onSelect(char)}
            >
              {/* Avatar */}
              <div className="sidebar-avatar">{char.avatar}</div>

              {/* Info */}
              <div className="sidebar-info">
                <div className="sidebar-info-top">
                  <span className="sidebar-name">{char.name}</span>
                </div>
                <p className="sidebar-desc">{char.description}</p>
              </div>

              {/* Actions (on hover for custom chars) */}
              {char.custom && (
                <div className="sidebar-actions">
                  <button
                    className="sidebar-action-btn"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(char);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="sidebar-action-btn delete"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${char.name}"? This can't be undone.`)) {
                        onDelete(char.id);
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default CharacterSidebar;
