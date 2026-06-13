import sys
import os

# Add the project root to sys.path so that 'backend' package is importable
sys.path.insert(0, os.path.dirname(__file__))

# Keep tests offline — no Pinecone/Gemini calls during pytest
os.environ["MEDIUS_USE_PINECONE"] = "false"
os.environ["PINECONE_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""
