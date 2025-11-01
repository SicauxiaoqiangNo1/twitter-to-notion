// background.js - 修复加粗和图片位置问题，添加引用推文嵌入
console.log('Twitter to Notion background script loaded');

// ==================== 消息监听器 ====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action);
  
  if (message.action === "saveToNotion") {
    console.log('Processing saveToNotion request');
    
    saveToNotion(message.tweet, message.notionApiKey, message.databaseId)
      .then(result => {
        console.log('Save successful, sending response');
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Save failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// ==================== 扩展安装事件 ====================
chrome.runtime.onInstalled.addListener(() => {
  console.log('Twitter to Notion extension installed');
});

// ==================== 工具函数 ====================
const truncateText = (text, maxLength = 2000) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

// ==================== 主要功能函数 ====================
async function saveToNotion(tweet, apiKey, databaseId) {
  console.log('Starting saveToNotion with content blocks:', tweet.contentBlocks?.length);

  const cleanDatabaseId = databaseId.replace(/-/g, '');
  const notionUrl = "https://api.notion.com/v1/pages";
  
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  // 处理 multi_select 类型
  let typeMultiSelect = [];
  if (tweet.type && Array.isArray(tweet.type) && tweet.type.length > 0) {
    typeMultiSelect = tweet.type.map(type => ({ name: type }));
  }

  // 构建数据
  const data = {
    parent: { database_id: cleanDatabaseId },
    properties: {
      "Name": { 
        title: [{ text: { content: truncateText(tweet.name, 100) || "Twitter Post" } }] 
      },
      "URL": { url: tweet.url },
      "Type": { multi_select: typeMultiSelect },
      "Sender": { 
        rich_text: [{ text: { content: truncateText(tweet.sender, 200) || "Unknown" } }] 
      },
      "PostDate": { date: { start: tweet.postDate } },
      "SaveDate": { date: { start: tweet.saveDate } }
    },
    children: []
  };

  // 按顺序添加内容块（文本、媒体和引用推文混合）
  if (tweet.contentBlocks && tweet.contentBlocks.length > 0) {
    console.log('Processing content blocks in order');
    
    tweet.contentBlocks.forEach(block => {
      if (block.type === 'text') {
        // 处理文本块
        if (block.richText && block.richText.length > 0) {
          // 使用富文本格式
          const paragraphBlocks = createParagraphBlocksFromRichText(block.richText);
          paragraphBlocks.forEach(paragraph => {
            data.children.push(paragraph);
          });
        } else {
          // 回退到纯文本
          const textChunks = splitTextIntoChunks(block.content, 2000);
          textChunks.forEach(chunk => {
            data.children.push({
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ text: { content: chunk } }]
              }
            });
          });
        }
      } else if (block.type === 'image') {
        // 添加图片块
        data.children.push({
          object: "block",
          type: "image",
          image: {
            type: "external",
            external: { url: block.url }
          }
        });
      } else if (block.type === 'video') {
        // 添加视频块（Notion不支持直接嵌入，用链接代替）
        data.children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{
              type: "text",
              text: { content: "📹 视频: " }
            }, {
              type: "text",
              text: {
                content: "查看视频",
                link: { url: block.url }
              }
            }]
          }
        });
      } else if (block.type === 'quoted_tweet') {
        // 添加引用推文嵌入块
        console.log('Adding quoted tweet embed');
        data.children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{
              type: "text",
              text: { content: "🔁 引用推文" },
              annotations: { bold: true }
            }]
          }
        });
        data.children.push({
          object: "block",
          type: "embed",
          embed: {
            url: block.url
          }
        });
      }
    });
  } else if (tweet.fullContent) {
    // 回退到纯文本格式
    console.log('Falling back to plain text content');
    const contentChunks = splitTextIntoChunks(tweet.fullContent, 2000);
    contentChunks.forEach(chunk => {
      data.children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: chunk } }]
        }
      });
    });
  }

  // 添加作者信息
  if (tweet.metadata?.authorHandle) {
    const authorText = `作者: ${tweet.sender} (${tweet.metadata.authorHandle})`;
    data.children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{
          type: "text",
          text: { content: truncateText(authorText, 2000) }
        }]
      }
    });
  }

  // 添加统计数据
  if (tweet.metadata?.metrics) {
    const metrics = tweet.metadata.metrics;
    const metricsText = `❤️ ${metrics.likes} | 🔄 ${metrics.retweets} | 💬 ${metrics.replies}`;
    data.children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{
          type: "text",
          text: { content: truncateText(metricsText, 2000) }
        }]
      }
    });
  }

  // 添加分割线
  data.children.push({
    object: "block",
    type: "divider",
    divider: {}
  });

  // 添加保存信息
  const saveInfoText = `通过 Twitter to Notion 扩展保存于 ${new Date().toLocaleString('zh-CN')}`;
  data.children.push({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{
        type: "text",
        text: {
          content: truncateText(saveInfoText, 2000)
        },
        annotations: {
          italic: true,
          color: "gray"
        }
      }]
    }
  });

  try {
    console.log('Sending request to Notion API...');
    const response = await fetch(notionUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notion API error:', response.status, errorText);
      throw new Error(`Notion API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Successfully saved to Notion");
    return result;
    
  } catch (error) {
    console.error("❌ Error saving to Notion:", error);
    throw error;
  }
}

// 从富文本创建段落块
function createParagraphBlocksFromRichText(richTextArray) {
  const blocks = [];
  let currentParagraph = {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: []
    }
  };

  richTextArray.forEach((textItem, index) => {
    const notionTextItem = {
      type: "text",
      text: textItem.link ? 
        { 
          content: textItem.text,
          link: textItem.link 
        } : 
        { content: textItem.text },
      annotations: {
        bold: textItem.annotations.bold || false,
        italic: textItem.annotations.italic || false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default"
      }
    };

    // 检查当前段落长度
    const currentLength = currentParagraph.paragraph.rich_text
      .reduce((sum, item) => sum + (item.text.content?.length || 0), 0);
    
    const newItemLength = textItem.text?.length || 0;

    if (currentLength + newItemLength > 1800) {
      // 开始新段落
      if (currentParagraph.paragraph.rich_text.length > 0) {
        blocks.push(currentParagraph);
      }
      currentParagraph = {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [notionTextItem]
        }
      };
    } else {
      // 添加到当前段落
      currentParagraph.paragraph.rich_text.push(notionTextItem);
    }
  });

  // 添加最后一个段落
  if (currentParagraph.paragraph.rich_text.length > 0) {
    blocks.push(currentParagraph);
  }

  return blocks;
}

// 文本分块函数
function splitTextIntoChunks(text, maxLength = 2000) {
  if (!text || text.length <= maxLength) return [text];
  
  const chunks = [];
  let currentChunk = '';
  
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      if (paragraph.length > maxLength) {
        const subChunks = splitLongParagraph(paragraph, maxLength);
        chunks.push(...subChunks.slice(0, -1));
        currentChunk = subChunks[subChunks.length - 1];
      } else {
        currentChunk = paragraph;
      }
    } else {
      if (currentChunk) {
        currentChunk += '\n' + paragraph;
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function splitLongParagraph(text, maxLength) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxLength;
    
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastSpace = text.lastIndexOf(' ', end);
      
      if (lastPeriod > start && (lastPeriod - start) > maxLength * 0.7) {
        end = lastPeriod + 1;
      } else if (lastSpace > start && (lastSpace - start) > maxLength * 0.7) {
        end = lastSpace;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end;
  }
  
  return chunks;
}