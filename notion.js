// notion.js

async function getNotionCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["notionApiKey", "databaseId"], (data) => {
      resolve(data);
    });
  });
}

const truncateText = (text, maxLength = 2000) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Creates a new page in Notion with the tweet content.
 * @param {object} tweet - The tweet data object.
 * @returns {Promise<object>} - The created Notion page object.
 * @throws {Error} - If the API call fails.
 */
async function createPage(tweet) {
  const { notionApiKey, databaseId } = await getNotionCredentials();
  if (!notionApiKey || !databaseId) {
    throw new Error("Notion API Key or Database ID not configured.");
  }

  const cleanDatabaseId = databaseId.replace(/-/g, '');
  const notionUrl = "https://api.notion.com/v1/pages";

  const headers = {
    "Authorization": `Bearer ${notionApiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  // This is a simplified version of the original buildTweetContentBlocks logic
  const children = [
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ text: { content: tweet.fullContent || tweet.text } }]
      }
    }
  ];

  const data = {
    parent: { database_id: cleanDatabaseId },
    properties: {
      "Name": {
        title: [{ text: { content: truncateText(tweet.name, 100) || "Twitter Post" } }]
      },
      "URL": { url: tweet.url },
      "Sender": {
        rich_text: [{ text: { content: truncateText(tweet.sender, 200) || "Unknown" } }]
      },
      "PostDate": { date: { start: tweet.postDate } },
      "SaveDate": { date: { start: tweet.saveDate } }
    },
    children: children
  };

  const response = await fetch(notionUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (createPage): ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Updates an existing Notion page.
 * @param {string} pageId - The ID of the page to update.
 * @param {object} properties - The properties to update.
 * @returns {Promise<object>} - The updated Notion page object.
 * @throws {Error} - If the API call fails.
 */
async function updatePage(pageId, properties) {
  const { notionApiKey } = await getNotionCredentials();
  if (!notionApiKey) {
    throw new Error("Notion API Key not configured.");
  }

  const notionUrl = `https://api.notion.com/v1/pages/${pageId}`;

  const headers = {
    "Authorization": `Bearer ${notionApiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  // The user's code implies the summary is written to a "Comments" property.
  // This assumes a "Comments" text property exists in the Notion database.
  const data = {
    properties: {
      "Comments": {
        rich_text: [{ text: { content: properties.Comments } }]
      }
    }
  };

  const response = await fetch(notionUrl, {
    method: "PATCH",
    headers: headers,
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (updatePage): ${response.status} - ${errorText}`);
  }

  return await response.json();
}
