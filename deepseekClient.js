// deepseekClient.js

async function getDeepseekApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['deepseekApiKey'], function(result) {
      resolve(result.deepseekApiKey);
    });
  });
}

/**
 * Generates a summary for the given text using the Deepseek API.
 * @param {string} text - The text to summarize.
 * @returns {Promise<string>} - The summary text.
 * @throws {Error} - If the API call fails or the API key is not configured.
 */
export async function generateSummary(text) {
  const apiKey = await getDeepseekApiKey();
  if (!apiKey) {
    throw new Error("Deepseek API Key not configured.");
  }

  const deepseekUrl = "https://api.deepseek.com/v1/chat/completions";

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  const body = JSON.stringify({
    model: "deepseek-chat",
    messages: [
      {"role": "system", "content": "You are a concise summarization assistant. Summarize the given tweet text in a few sentences, focusing on the main points. If the text is too short, just return the original text."},
      {"role": "user", "content": `Summarize the following tweet: "${text}"`}
    ],
    stream: false
  });

  const response = await fetch(deepseekUrl, {
    method: "POST",
    headers: headers,
    body: body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepseek API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content || "";
}