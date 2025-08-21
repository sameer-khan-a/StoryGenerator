import React, { useState, useEffect } from "react";

export default function AuthApp() {
  const [user, setUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("Fantasy");
  const [tone, setTone] = useState("Neutral");
  const [size, setSize] = useState(3);
  const [output, setOutput] = useState("");
  const [activeTab, setActiveTab] = useState("stories");

  // --- Load session on mount ---
  useEffect(() => {
    refreshMe();
  }, []);

  async function refreshMe() {
    try {
      const res = await fetch("/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.username);
        await loadStories();
        await loadFavorites();
      } else {
        setUser(null);
        setStories([]);
        setFavorites([]);
      }
    } catch (err) {
      console.error("refreshMe failed:", err);
    }
  }

  // --- Auth actions ---
  async function login(username, password) {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      await refreshMe();
    } else {
      alert("Login failed");
    }
  }

  async function register(username, password) {
    const res = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      alert("Account created. Please login.");
    } else {
      alert("Registration failed");
    }
  }

  async function logout() {
    await fetch("/auth/logout", { method: "POST" });
    await refreshMe();
  }

  // --- Story actions ---
  async function generateStory(e) {
    e.preventDefault();
    if (!idea) {
      setOutput("Please enter a story idea!");
      return;
    }
    setOutput("Loading...");
    try {
      const res = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, genre, tone, size }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(data.story);
        await loadStories();
      } else {
        setOutput("Error: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      setOutput("Error: " + err.message);
    }
  }

  async function loadStories() {
    const res = await fetch("/stories");
    if (!res.ok) return;
    const data = await res.json();
    setStories(data.stories || []);
  }

  async function loadFavorites() {
    const res = await fetch("/stories/favorites");
    if (!res.ok) return;
    const favs = await res.json();
    setFavorites(favs);
  }

  async function toggleFavorite(id) {
    const res = await fetch(`/stories/${id}/favorite`, { method: "POST" });
    if (res.ok) {
      await loadStories();
      await loadFavorites();
    }
  }

  async function deleteStory(id) {
    if (!window.confirm("Are you sure?")) return;
    const res = await fetch(`/stories/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadStories();
      await loadFavorites();
    }
  }

  return (
    <div className="container my-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Story Generator</h3>
        <div>
          {user ? (
            <>
              <span className="me-2">Hello, {user}</span>
              <button className="btn btn-outline-danger btn-sm" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <span className="text-muted">Not logged in</span>
          )}
        </div>
      </div>

      {/* Story Form */}
      {user && (
        <form onSubmit={generateStory} className="card p-3 mb-3">
          <input
            className="form-control mb-2"
            placeholder="Enter story idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <div className="d-flex gap-2 mb-2">
            <select
              className="form-select"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option>Fantasy</option>
              <option>Horror</option>
              <option>Comedy</option>
            </select>
            <select
              className="form-select"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option>Neutral</option>
              <option>Dark</option>
              <option>Light</option>
            </select>
            <input
              type="range"
              min="1"
              max="5"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="form-range"
            />
          </div>
          <button className="btn btn-primary">Generate</button>
        </form>
      )}

      {/* Output */}
      {output && (
        <div className="alert alert-info">
          <pre>{output}</pre>
        </div>
      )}

      {/* Tabs */}
      {user && (
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "stories" ? "active" : ""}`}
              onClick={() => setActiveTab("stories")}
            >
              My Stories
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === "favorites" ? "active" : ""}`}
              onClick={() => setActiveTab("favorites")}
            >
              Favorites
            </button>
          </li>
        </ul>
      )}

      {/* Stories List */}
      {activeTab === "stories" &&
        stories.map((s) => (
          <div key={s.id} className="card p-2 mb-2">
            <h5>{s.idea}</h5>
            <p>
              <b>Genre:</b> {s.genre}, <b>Tone:</b> {s.tone}
            </p>
            <p>{s.story}</p>
            <div className="d-flex gap-2">
              <button
                className={`btn btn-sm ${
                  s.favorite ? "btn-warning" : "btn-outline-secondary"
                }`}
                onClick={() => toggleFavorite(s.id)}
              >
                {s.favorite ? "★ Favorite" : "☆ Mark Favorite"}
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => deleteStory(s.id)}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        ))}

      {/* Favorites List */}
      {activeTab === "favorites" &&
        (favorites.length ? (
          favorites.map((s) => (
            <div key={s.id} className="card p-2 mb-2">
              <h5>{s.idea}</h5>
              <p>{s.story}</p>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => toggleFavorite(s.id)}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p>No favorites yet.</p>
        ))}
    </div>
  );
}
