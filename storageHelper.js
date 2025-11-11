// storageHelper.js

/**
 * Sets the status for a specific tweet in chrome.storage.local.
 * Merges with existing data for that tweet.
 * @param {string} tweetId - The unique ID of the tweet.
 * @param {object} statusUpdate - The status object to merge.
 * @returns {Promise<void>}
 */
export async function setTweetStatus(tweetId, statusUpdate) {
  const key = `tweetStatus_${tweetId}`;
  const storedData = await chrome.storage.local.get(key);
  const existingData = storedData[key] || {};

  const newData = { ...existingData, ...statusUpdate };

  await chrome.storage.local.set({ [key]: newData });
  console.log(`Updated tweet status for ${tweetId}:`, newData);
}

/**
 * Gets the status for a specific tweet from chrome.storage.local.
 * @param {string} tweetId - The unique ID of the tweet.
 * @returns {Promise<object|null>} - The status object or null if not found.
 */
export async function getTweetStatus(tweetId) {
  const key = `tweetStatus_${tweetId}`;
  const storedData = await chrome.storage.local.get(key);
  return storedData[key] || null;
}