console.log("Content script loaded and running")

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request)

  if (request.action === "extractContent") {
    try {
      const pageContent = getAllVisibleText()
      const pageTitle = document.title
      const pageUrl = window.location.href

      console.log("Content extracted successfully")

      if (!pageContent) {
        console.error("No content found on page")
        sendResponse({
          error: "No content found on page",
        })
        return true
      }

      sendResponse({
        content: pageContent,
        title: pageTitle,
        url: pageUrl,
      })
    } catch (error) {
      console.error("Error extracting content:", error)
      sendResponse({
        error: "Error extracting content: " + error.message,
      })
    }
  }
  return true
})

function getAllVisibleText() {
  const body = document.body

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const style = window.getComputedStyle(node.parentElement)
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return NodeFilter.FILTER_REJECT
      }

      if (
        node.parentElement.tagName === "SCRIPT" ||
        node.parentElement.tagName === "STYLE" ||
        node.parentElement.tagName === "NOSCRIPT" ||
        node.parentElement.tagName === "IFRAME"
      ) {
        return NodeFilter.FILTER_REJECT
      }

      return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  let text = ""
  let node

  while ((node = walker.nextNode())) {
    text += node.textContent.trim() + " "
  }

  return cleanText(text)
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").replace(/\n+/g, "\n").replace(/\t+/g, " ").replace(/\r/g, "").trim()
}

