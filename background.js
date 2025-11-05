// background.js - 完整重构版 (支持 Thread)
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
  
  // 新增：处理保存 Thread 的 action
  if (message.action === "saveThreadToNotion") {
    console.log(`Processing saveThreadToNotion for ${message.thread.length} tweets`);
    
    saveThreadToNotion(
      message.thread,
      message.title,       // 弹窗中编辑后的标题
      message.types,       // 弹窗中选择的分类
      message.notionApiKey,
      message.databaseId
    )
      .then(result => {
        console.log('Thread save successful, sending response');
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Thread save failed:', error);
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

/**
 * 新增：可重用的函数，用于构建一条推文的内容块
 * (从 saveToNotion 中提取)
 */
function buildTweetContentBlocks(tweet) {
  const children = [];

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
            children.push(paragraph);
          });
        } else {
          // 回退到纯文本
          const textChunks = splitTextIntoChunks(block.content, 2000);
          textChunks.forEach(chunk => {
            children.push({
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
        console.log('✅ 处理图片块:', block.url);
        const imageBlock = {
          object: "block",
          type: "image",
          image: {
            type: "external",
            external: { url: block.url }
          }
        };
        
        // !! 已移除 !!
        // (这里之前有添加 caption 的代码)
        // !! 已移除 !!
        
        children.push(imageBlock);
        
      } else if (block.type === 'video') {
        // 添加视频块（Notion不支持直接嵌入，用链接代替）
        children.push({
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
        children.push({
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
        children.push({
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
      children.push({
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
    children.push({
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
    children.push({
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
  
  return children;
}

/**
 * 新增：构建页脚的函数
 * (从 saveToNotion 中提取)
 */
function buildFooterBlocks() {
  const children = [];
  // 添加分割线
  children.push({
    object: "block",
    type: "divider",
    divider: {}
  });

  // 添加保存信息
  const saveInfoText = `通过 Twitter to Notion 扩展保存于 ${new Date().toLocaleString('zh-CN')}`;
  children.push({
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
  return children;
}


// ==================== 主要功能函数 ====================

/**
 * 修改：原 saveToNotion 函数，使用重构的 Buidler
 */
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
    // 使用重构的函数
    children: [
      ...buildTweetContentBlocks(tweet),
      ...buildFooterBlocks()
    ]
  };

  try {
    console.log('Sending request to Notion API...');
    console.log('📊 最终数据统计:', {
      totalBlocks: data.children.length,
      textBlocks: data.children.filter(child => child.type === 'paragraph').length,
      imageBlocks: data.children.filter(child => child.type === 'image').length,
      videoBlocks: data.children.filter(child => child.type === 'paragraph' && child.paragraph?.rich_text?.[0]?.text?.content?.includes('📹 视频')).length,
      quotedTweetBlocks: data.children.filter(child => child.type === 'embed').length,
      dividerBlocks: data.children.filter(child => child.type === 'divider').length
    });
    console.log('完整的请求数据:', JSON.stringify(data, null, 2));
    
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
    
    // 构造页面 URL
    const pageUrl = `https://notion.so/${result.id.replace(/-/g, '')}`;
    return {
      ...result,
      pageUrl: pageUrl
    };
    
  } catch (error) {
    console.error("❌ Error saving to Notion:", error);
    throw error;
  }
}

/**
 * 新增：保存完整 Thread 的函数
 */
async function saveThreadToNotion(thread, title, types, apiKey, databaseId) {
  if (!thread || thread.length === 0) {
    throw new Error("No tweet data provided for thread");
  }

  const firstTweet = thread[0]; // 使用第一条推文作为 Page 的元数据
  const cleanDatabaseId = databaseId.replace(/-/g, '');
  const notionUrl = "https://api.notion.com/v1/pages";
  
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  // 处理 multi_select 类型
  let typeMultiSelect = [];
  if (types && Array.isArray(types) && types.length > 0) {
    typeMultiSelect = types.map(type => ({ name: type }));
  }

  // 1. 使用第一条推文的数据创建 Page
  const data = {
    parent: { database_id: cleanDatabaseId },
    properties: {
      "Name": { 
        title: [{ text: { content: truncateText(title || firstTweet.name, 100) } }] 
      },
      "URL": { url: firstTweet.url }, // 主推文的 URL
      "Type": { multi_select: typeMultiSelect },
      "Sender": { 
        rich_text: [{ text: { content: truncateText(firstTweet.sender, 200) } }] 
      },
      "PostDate": { date: { start: firstTweet.postDate } },
      "SaveDate": { date: { start: new Date().toISOString() } } // 保存日期是现在
    },
    children: []
  };

  // 2. 循环所有推文，将它们的内容块添加到 children
  for (const [index, tweet] of thread.entries()) {
    
    // 从第二条推文开始，添加一个 H3 标题
    if (index > 0) {
      data.children.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ text: { content: `Tweet ${index + 1}` } }],
          "color": "gray"
        }
      });
    }

    // 使用重构的函数来构建内容块
    const tweetBlocks = buildTweetContentBlocks(tweet);
    data.children.push(...tweetBlocks);

    // 在每条推文之间添加分割线
    if (index < thread.length - 1) {
      data.children.push({
        object: "block",
        type: "divider",
        divider: {}
      });
    }
  }

  // 3. 添加统一的页脚
  data.children.push(...buildFooterBlocks());

  // 4. 发送请求
  try {
    console.log(`Sending thread (${thread.length} tweets) request to Notion API...`);
    
    const response = await fetch(notionUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Notion API error (Thread):', response.status, errorText);
      throw new Error(`Notion API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Successfully saved thread to Notion");
    
    const pageUrl = `https://notion.so/${result.id.replace(/-/g, '')}`;
    return { ...result, pageUrl: pageUrl };
    
  } catch (error) {
    console.error("❌ Error saving thread to Notion:", error);
    throw error;
  }
}


// ==================== 原始辅助函数 ====================

// (以下是你原有的辅助函数，保持不变)

// 从富文本创建段落块
function createParagraphBlocksFromRichText(richTextArray) {
  console.log('📝 开始处理富文本数组:', {
    totalItems: richTextArray.length,
    items: richTextArray.map(item => ({
      text: item.text,
      hasLink: !!item.link,
      linkUrl: item.link?.url
    }))
  });
  
  const blocks = [];
  let currentParagraph = {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: []
    }
  };

  richTextArray.forEach((textItem, index) => {
    console.log(`📝 处理富文本项 ${index}:`, {
      text: textItem.text,
      hasLink: !!textItem.link,
      linkUrl: textItem.link?.url
    });
    
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

    // 如果当前项是链接，尽量不分割，保持链接完整性
    const isLinkItem = textItem.link;
    
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
    
    // 如果是链接项，记录调试信息
    if (isLinkItem) {
      console.log('🔗 处理链接项:', {
        text: textItem.text,
        url: textItem.link?.url,
        paragraphLength: currentParagraph.paragraph.rich_text.length
      });
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