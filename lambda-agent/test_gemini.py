from google import genai

client = genai.Client(api_key="***REMOVED-GOOGLE-API-KEY***")

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Say hello in one sentence."
)

print(response.text)
