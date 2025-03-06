console.log("LearnLens popup script loaded")

document.addEventListener("DOMContentLoaded", () => {
  const taskSelector = document.getElementById("taskSelector")
  const questionContainer = document.getElementById("questionContainer")
  const questionInput = document.getElementById("questionInput")
  const analyzeBtn = document.getElementById("analyzeBtn")
  const loadingIndicator = document.getElementById("loadingIndicator")
  const resultContainer = document.getElementById("resultContainer")
  const resultTitle = document.getElementById("resultTitle")
  const resultContent = document.getElementById("resultContent")
  const copyBtn = document.getElementById("copyBtn")

  taskSelector.addEventListener("change", () => {
    questionContainer.classList.toggle("hidden", taskSelector.value !== "question")

    const buttonText =
      taskSelector.value === "question"
        ? "Answer Question"
        : taskSelector.value === "keypoints"
          ? "Extract Key Points"
          : "Summarize Page"

    analyzeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 22V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 7L12 12L4 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>${buttonText}</span>
    `
  })

  // Copy results to clipboard
  copyBtn.addEventListener("click", () => {
    const textToCopy = resultContent.textContent
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Show temporary success message
      const originalHTML = copyBtn.innerHTML
      copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17L4 12" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML
      }, 2000)
    })
  })

  analyzeBtn.addEventListener("click", async () => {
    const task = taskSelector.value
    const question = questionInput.value

    if (task === "question" && !question.trim()) {
      questionInput.style.borderColor = "var(--error-color)"
      questionInput.focus()
      setTimeout(() => {
        questionInput.style.borderColor = ""
      }, 2000)
      return
    }

    loadingIndicator.classList.remove("hidden")
    resultContainer.classList.add("hidden")

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab || !tab.id) {
        throw new Error("No active tab found")
      }

      console.log("Injecting content script...")

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      })

      console.log("Content script injected, waiting for response...")

      // Extract content
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: "extractContent" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      })

      console.log("Content extraction response:", response)

      if (!response || response.error) {
        throw new Error(response?.error || "Failed to extract content")
      }

      const { content: pageContent, title: pageTitle, url: pageUrl } = response

      let prompt
      switch (task) {
        case "summarize":
          prompt = `Summarize the following web page content in a concise way. Focus on the most important information and provide a well-structured summary:\n\nTitle: ${pageTitle}\nURL: ${pageUrl}\n\nContent: ${pageContent}`
          resultTitle.textContent = "Summary"
          break
        case "keypoints":
          prompt = `Extract the key points from the following web page content. Identify the most important ideas, facts, and arguments. Format as a bulleted list:\n\nTitle: ${pageTitle}\nURL: ${pageUrl}\n\nContent: ${pageContent}`
          resultTitle.textContent = "Key Points"
          break
        case "question":
          prompt = `Answer the following question based on the web page content. Be specific and provide evidence from the content:\n\nQuestion: ${question}\n\nTitle: ${pageTitle}\nURL: ${pageUrl}\n\nContent: ${pageContent}`
          resultTitle.textContent = `Answer to: ${question}`
          break
      }

      console.log("Sending to Gemini for analysis...")

      const geminiResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "analyzeWithGemini",
            prompt: prompt,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response)
            }
          },
        )
      })

      if (geminiResponse.error) {
        throw new Error(geminiResponse.error)
      }

      loadingIndicator.classList.add("hidden")
      resultContainer.classList.remove("hidden")
      resultContent.innerHTML = formatResult(geminiResponse.result, task)

      resultContainer.style.opacity = "0"
      resultContainer.style.transform = "translateY(10px)"
      resultContainer.style.transition = "opacity 0.3s ease, transform 0.3s ease"

      setTimeout(() => {
        resultContainer.style.opacity = "1"
        resultContainer.style.transform = "translateY(0)"
      }, 50)
    } catch (error) {
      console.error("Error:", error)
      showError(error.message)
    }
  })

  function formatResult(result, task) {
    if (task === "keypoints") {
      if (result.includes("•") || result.includes("-") || result.includes("*")) {
        return result
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            line = line.trim().replace(/^[•\-*]\s*/, "")
            return `<li>${line}</li>`
          })
          .join("")
          .replace(/<li>/g, "<ul><li>")
          .replace(/<\/li>$/, "</li></ul>")
          .replace(/<\/li><ul>/g, "</li></ul><ul>")
      } else {
        return `<ul>${result
          .split("\n")
          .filter((line) => line.trim())
          .map((point) => `<li>${point}</li>`)
          .join("")}</ul>`
      }
    }

    return result
      .split("\n\n")
      .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
      .join("")
  }

  function showError(message) {
    loadingIndicator.classList.add("hidden")
    resultContainer.classList.remove("hidden")
    resultTitle.textContent = "Error"
    resultContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 0;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: var(--error-color); margin-bottom: 16px;">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 7V13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
        <p style="color: var(--error-color); font-weight: 500; margin-bottom: 8px;">Something went wrong</p>
        <p style="color: var(--text-secondary); font-size: 13px;">${message}</p>
      </div>
    `
  }

  taskSelector.dispatchEvent(new Event("change"))
})

