from flask import Flask, request, jsonify, render_template
import google.generativeai as genai
import os

app = Flask(__name__)

# Configure API key (use env var in real deployment)
API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBfkwKcTvrRJLRDPah5eR-JMPpgFpA32PQ")
genai.configure(api_key=API_KEY)

def generate_story(idea):
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = f"Expand this one-line idea into a detailed, engaging short story: {idea}"
    response = model.generate_content(prompt)
    return response.text

@app.route("/")
def home():
    return render_template("home.html")  # Loads HTML file from templates/

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    idea = data.get("idea", "").strip()
    if not idea:
        return jsonify({"error": "No idea provided"}), 400
    
    try:
        story = generate_story(idea)
        return jsonify({"story": story})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
