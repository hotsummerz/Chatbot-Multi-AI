import { useState, useEffect, useCallback } from "react";
import CharacterSidebar from "./components/CharacterSidebar";
import ChatWindow from "./components/ChatWindow";
import CreateCharacter from "./components/CreateCharacter";
import "./App.css";

function App() {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCharacters = useCallback(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((data) => {
        setCharacters(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const handleCreated = (newChar) => {
    setCharacters((prev) => [...prev, newChar]);
    setShowCreate(false);
    setSelectedCharacter(newChar);
  };

  const handleUpdated = (updatedChar) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === updatedChar.id ? updatedChar : c))
    );
    setSelectedCharacter((prev) =>
      prev?.id === updatedChar.id ? updatedChar : prev
    );
    setEditingCharacter(null);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCharacters((prev) => prev.filter((c) => c.id !== id));
        if (selectedCharacter?.id === id) setSelectedCharacter(null);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <CharacterSidebar
        characters={characters}
        selectedId={selectedCharacter?.id}
        onSelect={setSelectedCharacter}
        onCreateNew={() => setShowCreate(true)}
        onEdit={setEditingCharacter}
        onDelete={handleDelete}
      />

      <main className="main-pane">
        {selectedCharacter ? (
          <ChatWindow character={selectedCharacter} />
        ) : (
          <div className="empty-chat">
            <div className="empty-chat-icon">💬</div>
            <h2>Select a character</h2>
            <p>Choose a conversation from the sidebar or create a new character</p>
          </div>
        )}
      </main>

      {showCreate && (
        <CreateCharacter
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {editingCharacter && (
        <CreateCharacter
          editCharacter={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

export default App;
