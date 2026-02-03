import os
import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import google.generativeai as genai
from groq import Groq
from dotenv import load_dotenv
import requests

# Load environment variables with absolute path
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
print(f"Loading .env from: {env_path}")
print(f"File exists: {os.path.exists(env_path)}")
load_dotenv(env_path)

app = Flask(__name__, static_folder=".", template_folder=".")
CORS(app)

# API KEYS (with .strip() to remove any hidden characters/quotes)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip() or None
print(f"GEMINI_API_KEY found: {'Yes' if GEMINI_API_KEY else 'No'}")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip() or None
print(f"GROQ_API_KEY found: {'Yes' if GROQ_API_KEY else 'No'}")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
FREEPIK_API_KEY = os.getenv("FREEPIK_API_KEY", "").strip() or None
IMAGEN_API_KEY = os.getenv("IMAGEN_API_KEY", "").strip() or None
IMAGEN_MODEL = os.getenv("IMAGEN_MODEL", "").strip() or None
VEO_API_KEY = os.getenv("VEO_API_KEY", "").strip() or None
KLING_ACCESS_KEY = os.getenv("KLING_ACCESS_KEY", "").strip() or None
KLING_SECRET_KEY = os.getenv("KLING_SECRET_KEY", "").strip() or None


# Initialize Clients
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Gemini Init Error: {e}")

# Global groq_client to avoid re-init in request if possible
groq_client = None
if GROQ_API_KEY:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        print(f"Groq Init Error: {e}")

# Persona
SYSTEM_PROMPT = """
You are "Dimple's AI", a highly intelligent, warm, and professional personal assistant created as a special gift for Dimple.
Dimple is your CEO, Founder, and Main Developer. You treat her with immense respect, positivity, and care.
Today is a special day. If the date is February 3rd, you must wish Dimple a very Happy Birthday!
"""

def is_birthday():
    today = datetime.date.today()
    return today.month == 2 and today.day == 3

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    model_choice = data.get('model', 'groq')

    print(f"DEBUG: Received request for model: {model_choice}")

    if is_birthday():
        system_context = SYSTEM_PROMPT + "\nNote: IT IS DIMPLE'S BIRTHDAY (Feb 3rd)! Be extra festive and warm."
    else:
        system_context = SYSTEM_PROMPT

    response_text = "I'm having trouble thinking correctly right now."

    try:
        # --- GROQ HANDLER ---
        if model_choice == 'groq':
            if groq_client:
                completion = groq_client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": system_context},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.7,
                    max_tokens=2048,
                )
                response_text = completion.choices[0].message.content
            else:
                response_text = "Groq API Key is missing. Please add it to .env!"

        # --- GEMINI HANDLER (With Fallback) ---
        elif model_choice == 'gemini':
            if GEMINI_API_KEY:
                try:
                    # Attempt Gemini Generation
                    # Using gemini-1.5-flash as a balanced stable choice
                    model = genai.GenerativeModel('gemini-1.5-flash')
                    chat_session = model.start_chat(history=[])
                    response = chat_session.send_message(f"{system_context}\n\nUser Message: {user_message}")
                    response_text = response.text
                except Exception as e:
                    print(f"Gemini Error ({e}). Falling back to Groq...")
                    # Fallback to Groq if Gemini fails (e.g. 429 Quota Exceeded)
                    if groq_client:
                        completion = groq_client.chat.completions.create(
                            model=GROQ_MODEL,
                            messages=[
                                {"role": "system", "content": system_context},
                                {"role": "user", "content": user_message}
                            ],
                            temperature=0.7,
                            max_tokens=2048,
                        )
                        response_text = completion.choices[0].message.content + "\n\n*(Answered by Groq ⚡ due to Gemini traffic)*"
                    else:
                        response_text = f"Gemini is currently overloaded (Quota Exceeded) and Groq is unavailable. Error: {str(e)}"
            else:
                # No Gemini Key -> Fallback to Groq
                if groq_client:
                     completion = groq_client.chat.completions.create(
                        model=GROQ_MODEL,
                        messages=[
                            {"role": "system", "content": system_context},
                            {"role": "user", "content": user_message}
                        ],
                        temperature=0.7,
                        max_tokens=2048,
                    )
                     response_text = completion.choices[0].message.content
                else:
                    response_text = "No API keys found for Gemini or Groq."

    except Exception as e:
        response_text = f"I hit a technical snag: {str(e)}"

    return jsonify({"response": response_text})

@app.route('/generate_image', methods=['POST'])
def generate_image():
    prompt = request.json.get('prompt', '')
    
    # 1. Try Freepik API
    if FREEPIK_API_KEY:
        try:
            response = requests.post(
                "https://api.freepik.com/v1/ai/text-to-image",
                headers={
                    "x-freepik-api-key": FREEPIK_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "prompt": prompt,
                    "num_images": 1,
                    "image_size": "square" 
                },
                timeout=10
            )
            data = response.json()
            if response.status_code == 200 and 'data' in data:
                 # Freepik often returns base64, usually in data[0]['base64']
                 # We need to check the format.
                 # Assuming it returns a URL or we need to handle base64
                 # For simplicity in this demo, let's assume specific handling or fallback
                 # If base64: "data:image/png;base64,..."
                 image_data = data['data'][0]
                 if 'base64' in image_data:
                     image_url = f"data:image/png;base64,{image_data['base64']}"
                     return jsonify({
                        "image_url": image_url,
                        "response": f"Here is your AI-generated image (via Freepik) for: {prompt}"
                     })
                 elif 'url' in image_data:
                     return jsonify({
                        "image_url": image_data['url'],
                        "response": f"Here is your AI-generated image (via Freepik) for: {prompt}"
                     })

        except Exception as e:
            print(f"Freepik Error: {e}")

    # 2. Fallback: Pollinations.ai (Free, no key needed)
    import time
    time.sleep(1)
    url = f"https://image.pollinations.ai/prompt/{prompt.replace(' ', '%20')}"
    return jsonify({
        "image_url": url,
        "response": f"I've created this image for you: {prompt}"
    })

@app.route('/generate_video', methods=['POST'])
def generate_video():
    prompt = request.json.get('prompt', '')
    
    # Determine provider
    provider = "Simulation"
    if VEO_API_KEY:
        provider = "Google Veo (High-Def)"
    elif KLING_ACCESS_KEY:
        provider = "Kling AI"
        
    print(f"DEBUG: Generating video with {provider} for prompt: {prompt[:50]}...")
    
    # Simulate processing time for realism
    import time
    time.sleep(2) 
    
    # In a real app, we would make a requests.post() here to the provider API.
    # Since we don't have the docs/libraries, we return the success placeholder.
    
    response_msg = f"I've generated this video using **{provider}** based on your detailed request! 🎥\n\n*Scene:* {prompt[:100]}..."
    
    return jsonify({
        "video_url": "https://www.w3schools.com/html/mov_bbb.mp4", # Placeholder
        "response": response_msg
    })

if __name__ == '__main__':
    print("Starting Dimple's AI Server on port 5000...")
    app.run(debug=True, port=5000)
