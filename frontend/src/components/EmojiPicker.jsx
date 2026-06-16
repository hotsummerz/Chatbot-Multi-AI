import { useState, useRef, useEffect } from "react";

// Comprehensive emoji list with search keywords
const EMOJI_DATA = [
  // Smileys & People
  { emoji: "😀", name: "grinning smile" },
  { emoji: "😃", name: "smile happy" },
  { emoji: "😄", name: "grin happy" },
  { emoji: "😁", name: "beaming grin" },
  { emoji: "😆", name: "laugh happy" },
  { emoji: "😅", name: "sweat smile" },
  { emoji: "🤣", name: "rofl laugh" },
  { emoji: "😂", name: "joy tears laugh" },
  { emoji: "🙂", name: "slight smile" },
  { emoji: "😉", name: "wink" },
  { emoji: "😊", name: "blush smile" },
  { emoji: "😇", name: "angel halo" },
  { emoji: "🥰", name: "love hearts" },
  { emoji: "😍", name: "heart eyes love" },
  { emoji: "🤩", name: "star struck" },
  { emoji: "😘", name: "kiss" },
  { emoji: "😜", name: "tongue wink" },
  { emoji: "🤔", name: "thinking" },
  { emoji: "🤨", name: "skeptical" },
  { emoji: "😐", name: "neutral" },
  { emoji: "😑", name: "expressionless" },
  { emoji: "😶", name: "no mouth" },
  { emoji: "🙄", name: "eye roll" },
  { emoji: "😏", name: "smirk" },
  { emoji: "😮", name: "open mouth surprise" },
  { emoji: "😯", name: "hushed surprise" },
  { emoji: "😲", name: "astonished" },
  { emoji: "😳", name: "flushed blush" },
  { emoji: "🥺", name: "pleading eyes" },
  { emoji: "😢", name: "cry sad" },
  { emoji: "😭", name: "sob cry sad" },
  { emoji: "😤", name: "angry steam" },
  { emoji: "😠", name: "angry" },
  { emoji: "😡", name: "rage angry" },
  { emoji: "🤬", name: "cursing swearing" },
  { emoji: "😈", name: "devil evil" },
  { emoji: "👿", name: "imp devil" },
  { emoji: "💀", name: "skull death" },
  { emoji: "☠️", name: "crossbones skull" },
  { emoji: "💩", name: "poop" },
  { emoji: "🤡", name: "clown" },
  { emoji: "👹", name: "ogre monster" },
  { emoji: "👺", name: "goblin" },
  { emoji: "👻", name: "ghost" },
  { emoji: "👽", name: "alien" },
  { emoji: "👾", name: "space invader" },
  { emoji: "🤖", name: "robot" },
  // Gestures & Body
  { emoji: "👋", name: "wave hand" },
  { emoji: "🤚", name: "raised hand" },
  { emoji: "✋", name: "hand stop" },
  { emoji: "🖐️", name: "hand fingers" },
  { emoji: "👌", name: "ok hand" },
  { emoji: "✌️", name: "peace victory" },
  { emoji: "🤞", name: "crossed fingers luck" },
  { emoji: "🤟", name: "love you rock" },
  { emoji: "🤘", name: "rock horns" },
  { emoji: "👊", name: "fist punch" },
  { emoji: "✊", name: "raised fist" },
  { emoji: "🤝", name: "handshake" },
  { emoji: "👏", name: "clap applause" },
  { emoji: "🙌", name: "raised hands celebrate" },
  { emoji: "👐", name: "open hands" },
  { emoji: "🙏", name: "pray please thanks" },
  { emoji: "💪", name: "muscle strong" },
  // People
  { emoji: "👤", name: "person silhouette" },
  { emoji: "👥", name: "people" },
  { emoji: "🧑", name: "person" },
  { emoji: "👨", name: "man" },
  { emoji: "👩", name: "woman" },
  { emoji: "👦", name: "boy" },
  { emoji: "👧", name: "girl" },
  { emoji: "🧓", name: "elder old" },
  { emoji: "👴", name: "old man" },
  { emoji: "👵", name: "old woman" },
  { emoji: "👶", name: "baby" },
  // Fantasy
  { emoji: "🧙", name: "mage wizard magic" },
  { emoji: "🧙‍♂️", name: "wizard mage male" },
  { emoji: "🧙‍♀️", name: "witch mage female" },
  { emoji: "🧚", name: "fairy" },
  { emoji: "🧛", name: "vampire" },
  { emoji: "🧜", name: "mermaid merperson" },
  { emoji: "🧝", name: "elf" },
  { emoji: "🧞", name: "genie" },
  { emoji: "🧟", name: "zombie" },
  { emoji: "🦸", name: "superhero" },
  { emoji: "🦹", name: "supervillain" },
  { emoji: "🥷", name: "ninja" },
  { emoji: "🤠", name: "cowboy" },
  { emoji: "🎅", name: "santa christmas" },
  { emoji: "🤴", name: "prince" },
  { emoji: "👸", name: "princess" },
  // Costumes & Roles
  { emoji: "👑", name: "crown king queen" },
  { emoji: "🎩", name: "top hat gentleman" },
  { emoji: "🎭", name: "theater drama mask" },
  { emoji: "🗡️", name: "sword dagger" },
  { emoji: "⚔️", name: "crossed swords" },
  { emoji: "🛡️", name: "shield" },
  { emoji: "🏹", name: "bow arrow" },
  { emoji: "🪄", name: "magic wand" },
  { emoji: "🔮", name: "crystal ball fortune" },
  // Animals
  { emoji: "🐱", name: "cat" },
  { emoji: "🐶", name: "dog puppy" },
  { emoji: "🐺", name: "wolf" },
  { emoji: "🦊", name: "fox" },
  { emoji: "🐻", name: "bear" },
  { emoji: "🐼", name: "panda" },
  { emoji: "🐨", name: "koala" },
  { emoji: "🐯", name: "tiger" },
  { emoji: "🦁", name: "lion" },
  { emoji: "🐮", name: "cow" },
  { emoji: "🐷", name: "pig" },
  { emoji: "🐸", name: "frog" },
  { emoji: "🐵", name: "monkey" },
  { emoji: "🐔", name: "chicken" },
  { emoji: "🐧", name: "penguin" },
  { emoji: "🐦", name: "bird" },
  { emoji: "🦅", name: "eagle" },
  { emoji: "🦉", name: "owl wise" },
  { emoji: "🦇", name: "bat" },
  { emoji: "🐉", name: "dragon" },
  { emoji: "🐲", name: "dragon face" },
  { emoji: "🦄", name: "unicorn" },
  { emoji: "🐴", name: "horse" },
  { emoji: "🦋", name: "butterfly" },
  { emoji: "🐛", name: "bug caterpillar" },
  { emoji: "🐍", name: "snake" },
  { emoji: "🦎", name: "lizard" },
  { emoji: "🐙", name: "octopus" },
  { emoji: "🦈", name: "shark" },
  { emoji: "🐬", name: "dolphin" },
  { emoji: "🐳", name: "whale" },
  { emoji: "🦀", name: "crab" },
  // Nature
  { emoji: "🌸", name: "cherry blossom flower" },
  { emoji: "🌹", name: "rose flower" },
  { emoji: "🌻", name: "sunflower" },
  { emoji: "🌺", name: "hibiscus flower" },
  { emoji: "🌷", name: "tulip flower" },
  { emoji: "🌲", name: "evergreen tree pine" },
  { emoji: "🌳", name: "deciduous tree" },
  { emoji: "🌴", name: "palm tree" },
  { emoji: "🍀", name: "four leaf clover luck" },
  { emoji: "🍁", name: "maple leaf" },
  { emoji: "🍂", name: "fallen leaf autumn" },
  { emoji: "🌊", name: "wave ocean water" },
  { emoji: "🌈", name: "rainbow" },
  { emoji: "⚡", name: "lightning thunder" },
  { emoji: "🔥", name: "fire hot" },
  { emoji: "❄️", name: "snowflake cold" },
  { emoji: "⭐", name: "star" },
  { emoji: "🌟", name: "glowing star" },
  { emoji: "💫", name: "dizzy star" },
  { emoji: "🌙", name: "crescent moon" },
  { emoji: "☀️", name: "sun" },
  { emoji: "🌌", name: "milky way galaxy" },
  { emoji: "💎", name: "gem diamond" },
  { emoji: "🪨", name: "rock stone" },
  // Objects & Symbols
  { emoji: "❤️", name: "red heart love" },
  { emoji: "🧡", name: "orange heart" },
  { emoji: "💛", name: "yellow heart" },
  { emoji: "💚", name: "green heart" },
  { emoji: "💙", name: "blue heart" },
  { emoji: "💜", name: "purple heart" },
  { emoji: "🖤", name: "black heart" },
  { emoji: "🤍", name: "white heart" },
  { emoji: "💔", name: "broken heart" },
  { emoji: "💕", name: "two hearts" },
  { emoji: "💖", name: "sparkling heart" },
  { emoji: "🎵", name: "music note" },
  { emoji: "🎶", name: "music notes" },
  { emoji: "🎸", name: "guitar" },
  { emoji: "🎹", name: "piano keyboard" },
  { emoji: "🎤", name: "microphone" },
  { emoji: "📚", name: "books" },
  { emoji: "📖", name: "open book" },
  { emoji: "✍️", name: "writing pen" },
  { emoji: "🎨", name: "art palette" },
  { emoji: "🎮", name: "game controller" },
  { emoji: "🏆", name: "trophy winner" },
  { emoji: "🎯", name: "target bullseye" },
  { emoji: "🔑", name: "key" },
  { emoji: "🗝️", name: "old key" },
  { emoji: "💰", name: "money bag" },
  { emoji: "💣", name: "bomb" },
  { emoji: "⏰", name: "alarm clock" },
  { emoji: "🕯️", name: "candle" },
  { emoji: "📜", name: "scroll" },
  { emoji: "🧪", name: "test tube science" },
  { emoji: "⚗️", name: "alembic chemistry" },
  { emoji: "🔬", name: "microscope" },
  { emoji: "🔭", name: "telescope" },
  { emoji: "🧬", name: "dna" },
  { emoji: "💊", name: "pill medicine" },
  { emoji: "🗺️", name: "world map" },
  { emoji: "🧭", name: "compass navigation" },
  { emoji: "⚓", name: "anchor ship" },
  { emoji: "🚀", name: "rocket space" },
  { emoji: "🛸", name: "flying saucer ufo" },
  // Food
  { emoji: "🍕", name: "pizza" },
  { emoji: "🍔", name: "burger" },
  { emoji: "🍟", name: "fries" },
  { emoji: "🌮", name: "taco" },
  { emoji: "🍣", name: "sushi" },
  { emoji: "🍰", name: "cake" },
  { emoji: "🍫", name: "chocolate" },
  { emoji: "☕", name: "coffee" },
  { emoji: "🍵", name: "tea" },
  { emoji: "🍷", name: "wine" },
  { emoji: "🍺", name: "beer" },
  // Flags & Symbols
  { emoji: "🏴‍☠️", name: "pirate flag" },
  { emoji: "🚩", name: "red flag" },
  { emoji: "🏁", name: "checkered flag" },
  { emoji: "✅", name: "check mark" },
  { emoji: "❌", name: "cross mark" },
  { emoji: "⚠️", name: "warning" },
  { emoji: "♾️", name: "infinity" },
  { emoji: "💯", name: "hundred perfect" },
];

function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = search.trim()
    ? EMOJI_DATA.filter((e) =>
        e.name.includes(search.toLowerCase()) ||
        e.emoji.includes(search)
      )
    : EMOJI_DATA;

  return (
    <div className="emoji-picker-panel">
      <div className="emoji-picker-search">
        <span className="emoji-search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="emoji-search-input"
          placeholder="Search emojis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="emoji-search-clear"
            onClick={() => setSearch("")}
            type="button"
          >
            ✕
          </button>
        )}
      </div>
      <div className="emoji-picker-grid">
        {filtered.length === 0 ? (
          <div className="emoji-picker-empty">No emojis found</div>
        ) : (
          filtered.map((item, i) => (
            <button
              key={i}
              className="emoji-picker-item"
              onClick={() => {
                onSelect(item.emoji);
                onClose();
              }}
              title={item.name}
              type="button"
            >
              {item.emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default EmojiPicker;
