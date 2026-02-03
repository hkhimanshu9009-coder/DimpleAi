
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load env
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

if not GEMINI_API_KEY:
    print("No GEMINI_API_KEY found.")
    exit()

print(f"Checking models for key ending in: ...{GEMINI_API_KEY[-4:]}")

try:
    genai.configure(api_key=GEMINI_API_KEY)
    print("Listing available models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name} (Display: {m.display_name})")
except Exception as e:
    print(f"Error listing models: {e}")
