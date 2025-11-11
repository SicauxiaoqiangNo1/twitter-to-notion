// summaryQueue.js
import { generateSummary } from './deepseekClient.js';
import { updatePage } from './notion.js';
import { setTweetStatus } from './storageHelper.js';

const SUMMARY_QUEUE_KEY = 'summaryQueue';
const SUMMARY_ALARM_NAME = 'summaryQueueAlarm';

/**
 * Adds a summary task to the persistent queue.
 * @param {object} summaryTask - The task to add.
 * @returns {Promise<void>}
 */
export async function setPendingSummary(summaryTask) {
  const data = await chrome.storage.local.get(SUMMARY_QUEUE_KEY);
  const queue = data[SUMMARY_QUEUE_KEY] || [];
  queue.push(summaryTask);
  await chrome.storage.local.set({ [SUMMARY_QUEUE_KEY]: queue });
  console.log('Added task to summary queue:', summaryTask);
}

/**
 * Processes all pending summaries in the queue.
 */
export async function processPendingSummaries() {
  console.log('Processing summary queue...');
  const data = await chrome.storage.local.get(SUMMARY_QUEUE_KEY);
  let queue = data[SUMMARY_QUEUE_KEY] || [];

  if (queue.length === 0) {
    console.log('Summary queue is empty.');
    return;
  }

  let stillPending = [];

  for (const task of queue) {
    try {
      console.log(`Retrying summary for tweet ${task.tweetId}...`);
      const summary = await generateSummary(task.text);
      if (summary) {
        await updatePage(task.pageId, { Comments: summary });
        await setTweetStatus(task.tweetId, { status: 'done' });
        console.log(`Successfully processed summary for tweet ${task.tweetId}.`);
      } else {
        // If summary is empty, consider it done.
        await setTweetStatus(task.tweetId, { status: 'done' });
        console.log(`Summary for tweet ${task.tweetId} was empty, task considered done.`);
      }
    } catch (error) {
      console.error(`Failed to process summary for tweet ${task.tweetId}:`, error);
      task.retries = (task.retries || 0) + 1;
      if (task.retries < 3) { // Limit to 3 retries
        stillPending.push(task);
      } else {
        console.warn(`Task for tweet ${task.tweetId} has failed too many times and will be dropped.`);
      }
    }
  }

  await chrome.storage.local.set({ [SUMMARY_QUEUE_KEY]: stillPending });
  console.log('Summary queue processing finished.');
}

/**
 * Registers the alarm to process the summary queue periodically.
 */
export function registerAlarm() {
  chrome.alarms.get(SUMMARY_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(SUMMARY_ALARM_NAME, {
        delayInMinutes: 1, // Fire for the first time in 1 minute
        periodInMinutes: 5  // Then fire every 5 minutes
      });
      console.log('Summary queue alarm registered.');
    }
  });
}

// Add a listener for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SUMMARY_ALARM_NAME) {
    processPendingSummaries();
  }
});