// Background script for LearnLens AI Agent
const GEMINI_API_KEY = "PleaseEnterYourOwnKeyHere"
const GEMINI_MODEL = "gemini-1.5-flash" 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeWithGemini") {
    handleGeminiAnalysis(request.prompt)
      .then((result) => sendResponse({ result }))
      .catch((error) => sendResponse({ error: error.message }))
    return true
  }
})

async function handleGeminiAnalysis(prompt) {
  try {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Invalid prompt provided")
    }

    console.log("Making API request to Gemini 1.5 Flash...")

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
          },
        }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("API Error:", response.status, errorData)
      throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || "Unknown error"}`)
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error("Invalid API response:", data)
      throw new Error("Invalid response from Gemini API")
    }

    const text = data.candidates[0].content.parts[0].text

    if (!text) {
      throw new Error("No response generated from Gemini")
    }

    return text
  } catch (error) {
    console.error("Error in Gemini analysis:", error)
    throw new Error(`Gemini analysis failed: ${error.message}`)
  }
}

