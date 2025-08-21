from flask import Flask, redirect, request, jsonify, render_template, session
import google.generativeai as genai
import os, json, base64, hashlib, hmac, secrets
from dotenv import load_dotenv
from pathlib import Path

app = Flask(__name__)

# --- Session secret (for cookies) ---
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-me")

# --- Gemini API ---
load_dotenv()
API_KEY = os.getenv("API_KEY")
genai.configure(api_key=API_KEY)

# --- Files for user DB ---
ROOT = Path(__file__).resolve().parent
USERS_JSON = ROOT / "users.json"               # canonical
USERS_JS = ROOT / "static" / "users.js"        # browser mirror

# --- PBKDF2 parameters ---
PBKDF2_ITER = 150_000
PBKDF2_LEN = 32
PBKDF2_ALG = "sha256"

def load_users():
    if not USERS_JSON.exists():
        return []
    try:
        with open(USERS_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_users(users):
    # write canonical JSON
    with open(USERS_JSON, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)
    # write browser mirror JS
    with open(USERS_JS, "w", encoding="utf-8") as f:
        f.write("window.USER_DB = ")
        json.dump(users, f, indent=2)
        f.write(";")

def hash_password(password: str, salt: bytes, iterations: int = PBKDF2_ITER) -> bytes:
    return hashlib.pbkdf2_hmac(
        PBKDF2_ALG, password.encode("utf-8"), salt, iterations, dklen=PBKDF2_LEN
    )

def generate_story(idea, genre, tone, size):
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = f"""Expand the following one-line idea into a detailed and engaging short story.

Requirements:
- Genre: {genre}
- Tone: {tone}
- Size: {size}, where:
   • 1 = Short (~150–200 words)
   • 2 = Medium (~400–500 words)
   • 3 = Long (~700–900 words)

Idea: {idea}

Make sure the story length strictly follows the chosen size value.
"""
    response = model.generate_content(prompt)
    return response.text

@app.route("/")
def home():
    return render_template("home.html")

# --------------- AUTH ---------------
@app.route("/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if len(username) < 3 or len(password) < 6:
        return jsonify({"error": "Username must be ≥3 chars and password ≥6 chars"}), 400

    users = load_users()
    if any(u["username"].lower() == username.lower() for u in users):
        return jsonify({"error": "Username already exists"}), 400

    salt = secrets.token_bytes(16)
    pwd_hash = hash_password(password, salt)

    rec = {
        "username": username,
        "salt": base64.b64encode(salt).decode("utf-8"),
        "hash": base64.b64encode(pwd_hash).decode("utf-8"),
        "iterations": PBKDF2_ITER,
        "alg": PBKDF2_ALG,
        "dklen": PBKDF2_LEN,
    }
    users.append(rec)
    save_users(users)
    return jsonify({"ok": True})

@app.route("/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(force=True)
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    users = load_users()
    user = next((u for u in users if u["username"].lower() == username.lower()), None)
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    salt = base64.b64decode(user["salt"])
    expected = base64.b64decode(user["hash"])
    iterations = int(user.get("iterations", PBKDF2_ITER))

    candidate = hash_password(password, salt, iterations)
    if not hmac.compare_digest(candidate, expected):
        return jsonify({"error": "Invalid credentials"}), 401

    session["user"] = user["username"]
    return jsonify({"ok": True, "username": user["username"]})

@app.route("/auth/logout", methods=["POST"])
def auth_logout():
    session.pop("user", None)
    return jsonify({"ok": True})

@app.route("/auth/me", methods=["GET"])
def auth_me():
    user = session.get("user")
    if user:
        return jsonify({"authenticated": True, "username": user})
    return jsonify({"authenticated": False})

# --------------- PROTECTED STORY ---------------
@app.route("/generate", methods=["POST"])
def generate():
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401

    data = request.get_json()
    idea = (data.get("idea") or "").strip()
    genre = (data.get("genre") or "").strip()
    tone = (data.get("tone") or "").strip()
    size = int(data.get("size", 1))

    if not idea:
        return jsonify({"error": "No idea provided"}), 400

    try:
        story_text = generate_story(idea, genre, tone, size)

        # --- Save to user record ---
        users = load_users()
        for u in users:
            if u["username"] == session["user"]:
                if "stories" not in u:
                    u["stories"] = []
                new_story = {
                    "id": secrets.token_hex(8),
                    "idea": idea,
                    "genre": genre,
                    "tone": tone,
                    "size": size,
                    "story": story_text,
                    "favorite": False
                }
                u["stories"].append(new_story)
                save_users(users)
                break

        return jsonify({"story": story_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/stories", methods=["GET"])
def stories():
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401

    users = load_users()
    user = next((u for u in users if u["username"] == session["user"]), None)
    return jsonify({"stories": user.get("stories", [])})
@app.route("/stories/favorites", methods=["GET"])
def stories_favorites():
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401

    users = load_users()
    user = next((u for u in users if u["username"] == session["user"]), None)
    if not user:
        return jsonify([])

    # Just filter the current user's stories by "favorite" flag
    favorites = [s for s in user.get("stories", []) if s.get("favorite")]

    return jsonify(favorites)

@app.route("/about")
def about():
    return render_template("about.html")
@app.route("/profile")
def profile():
    if not session.get("user"):
        return redirect("/")

    users = load_users()
    user = next((u for u in users if u["username"] == session["user"]), None)
    story_count = len(user.get("stories", []))
    fav_count = sum(1 for s in user.get("stories", []) if s.get("favorite"))

    return render_template("profile.html", username=user["username"], story_count=story_count, fav_count=fav_count)

@app.route("/stories/favorite/<story_id>", methods=["POST"])
def favorite_story(story_id):
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401

    users = load_users()
    for u in users:
        if u["username"] == session["user"]:
            for s in u.get("stories", []):
                if s["id"] == story_id:
                    s["favorite"] = not s["favorite"]
                    save_users(users)
                    return jsonify({"ok": True, "favorite": s["favorite"]})
    return jsonify({"error": "Story not found"}), 404

@app.route("/stories/<story_id>", methods=["DELETE"])
def delete_story(story_id):
    if not session.get("user"):
        return jsonify({"error": "Not authenticated"}), 401

    users = load_users()
    for u in users:
        if u["username"] == session["user"]:
            stories = u.get("stories", [])
            for s in stories:
                if s["id"] == story_id:
                    u["stories"] = [st for st in stories if st["id"] != story_id]
                    save_users(users)
                    return jsonify({"ok": True})
    return jsonify({"error": "Story not found"}), 404

if __name__ == "__main__":
    # Ensure mirror exists
    if not (ROOT / "static").exists():
        (ROOT / "static").mkdir(parents=True, exist_ok=True)
    if not USERS_JSON.exists():
        save_users([])
    app.run(debug=True)
