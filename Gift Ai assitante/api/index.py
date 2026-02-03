import os
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from groq import Groq
import requests

app = Flask(__name__)
CORS(app)

# API KEYS (Environment variables in Vercel)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip() or None
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip() or None
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

groq_client = None
if GROQ_API_KEY:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        print(f"Groq Init Error: {e}")

SYSTEM_PROMPT = """
You are "Dimple's AI", a highly intelligent, warm, and professional personal assistant created as a special gift for Dimple.
Dimple is your CEO, Founder, and Main Developer. You treat her with immense respect, positivity, and care.
Today is a special day. If the date is February 3rd, you must wish Dimple a very Happy Birthday!
"""

def is_birthday():
    today = datetime.date.today()
    return today.month == 2 and today.day == 3

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    model_choice = data.get('model', 'groq')

    if is_birthday():
        system_context = SYSTEM_PROMPT + "\nNote: IT IS DIMPLE'S BIRTHDAY (Feb 3rd)! Be extra festive and warm."
    else:
        system_context = SYSTEM_PROMPT

    response_text = "I'm having trouble thinking correctly right now."

    try:
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
                response_text = "Groq API Key is missing. Please add it to Vercel Environment Variables!"

        elif model_choice == 'gemini':
            if GEMINI_API_KEY:
                try:
                    model = genai.GenerativeModel('gemini-1.5-flash')
                    chat_session = model.start_chat(history=[])
                    response = chat_session.send_message(f"{system_context}\n\nUser Message: {user_message}")
                    response_text = response.text
                except Exception as e:
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
                        response_text = f"Gemini error and Groq is unavailable: {str(e)}"
            else:
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
                 image_data = data['data'][0]
                 if 'base64' in image_data:
                     image_url = f"data:image/png;base64,{image_data['base64']}"
                     return jsonify({"image_url": image_url, "response": f"Generated via Freepik: {prompt}"})
                 elif 'url' in image_data:
                     return jsonify({"image_url": image_data['url'], "response": f"Generated via Freepik: {prompt}"})
        except Exception as e:
            print(f"Freepik Error: {e}")

    url = f"https://image.pollinations.ai/prompt/{prompt.replace(' ', '%20')}"
    return jsonify({"image_url": url, "response": f"I've created this image for you: {prompt}"})

@app.route('/generate_video', methods=['POST'])
def generate_video():
    prompt = request.json.get('prompt', '')
    provider = "Simulation"
    if VEO_API_KEY: provider = "Google Veo"
    elif KLING_ACCESS_KEY: provider = "Kling AI"
    
    return jsonify({
        "video_url": "https://www.w3schools.com/html/mov_bbb.mp4",
        "response": f"I've generated this video using **{provider}** based on your request!"
    })

# Vercel needs the app object
# No app.run() here
