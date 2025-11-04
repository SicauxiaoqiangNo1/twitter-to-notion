// content.js - 修复加粗和图片位置问题，添加引用推文嵌入
console.log('Twitter to Notion content script loaded');

// 统一的推文数据提取函数
function extractTweetData(tweetElement = null) {
    try {
        const targetElement = tweetElement || document.querySelector('article[data-testid="tweet"]');
        if (!targetElement) {
            console.log('No tweet found on current page');
            return null;
        }

        console.log('=== 开始提取推文数据 ===');

        // 提取内容和媒体（保持相对位置）
        const contentWithMedia = extractContentWithMedia(targetElement);
        
        // 提取作者信息
        const authorElement = targetElement.querySelector('[data-testid="User-Name"]');
        let authorName = 'Unknown';
        let authorHandle = '';
        
        if (authorElement) {
            const authorLink = authorElement.querySelector('a[role="link"]');
            if (authorLink) {
                authorName = authorLink.querySelector('span')?.innerText || authorLink.innerText;
                authorHandle = authorLink.getAttribute('href') || '';
            }
        }

        // 提取发布时间
        const timeElement = targetElement.querySelector('time');
        const postTimestamp = timeElement ? timeElement.getAttribute('datetime') : new Date().toISOString();

        // 当前时间
        const saveTimestamp = new Date().toISOString();

        // 提取统计数据
        const getMetric = (testid) => {
            const element = targetElement.querySelector(`[data-testid="${testid}"]`);
            return element ? parseInt(element.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0') : 0;
        };

        // 构建数据
        const result = {
            name: contentWithMedia.text ? contentWithMedia.text.substring(0, 20) + (contentWithMedia.text.length > 20 ? '...' : '') : 'Twitter Post',
            url: window.location.href,
            type: '',
            sender: authorName,
            postDate: postTimestamp,
            saveDate: saveTimestamp,
            fullContent: contentWithMedia.text,
            contentBlocks: contentWithMedia.blocks, // 包含文本和媒体的混合内容
            metadata: {
                authorHandle: authorHandle,
                authorUrl: authorHandle ? `https://twitter.com${authorHandle}` : '',
                metrics: {
                    likes: getMetric('like'),
                    retweets: getMetric('retweet'),
                    replies: getMetric('reply')
                }
            }
        };
        
        console.log('=== 最终提取的数据 ===', result);
        return result;
        
    } catch (error) {
        console.error('Error extracting tweet data:', error);
        return null;
    }
}

// 提取内容和媒体（保持相对位置）
function extractContentWithMedia(tweetElement) {
    console.log('开始提取内容和媒体');
    
    // 查找推文内容容器 - 尝试多种选择器
    let contentContainer = tweetElement.querySelector('[data-testid="tweetText"]')?.parentElement;
    
    // 如果找不到，尝试其他可能的内容容器
    if (!contentContainer) {
        contentContainer = tweetElement.querySelector('[data-testid="tweet"]') ||
                          tweetElement.querySelector('article[data-testid="tweet"] div');
    }
    
    if (!contentContainer) {
        console.log('No content container found, using tweet element directly');
        contentContainer = tweetElement;
    }
    
    console.log('找到的内容容器:', {
        element: !!contentContainer,
        selector: contentContainer ? contentContainer.tagName + (contentContainer.className ? '.' + contentContainer.className.split(' ')[0] : '') : 'none'
    });

    const blocks = [];
    let fullText = '';

    // 首先检查并处理引用推文
    const quotedTweetUrl = extractQuotedTweetUrl(tweetElement);
    
    // 使用 TreeWalker 遍历推文内容区域，避免抓取头像等无关内容
    const walker = document.createTreeWalker(
        contentContainer,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // 跳过引用推文容器的内容
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const isQuoteTweet = node.closest('[data-testid="quote"]') ||
                                       (node.closest('article[data-testid="tweet"]') &&
                                        node.closest('article[data-testid="tweet"]') !== contentContainer.closest('article[data-testid="tweet"]'));
                    if (isQuoteTweet) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    // 跳过用户信息区域（头像、用户名等）
                    const isUserInfo = node.closest('[data-testid="User-Name"]') ||
                                     node.closest('[data-testid="UserAvatar-Container"]') ||
                                     node.closest('[class*="avatar"]') ||
                                     node.closest('[class*="Avatar"]');
                    if (isUserInfo) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    // 跳过操作按钮区域（订阅、关注等）
                    const isActionButton = node.closest('[data-testid="follow"]') ||
                                         node.closest('[data-testid="subscribe"]') ||
                                         node.closest('[class*="follow"]') ||
                                         node.closest('[class*="subscribe"]') ||
                                         node.closest('[class*="button"]') &&
                                         (node.textContent.includes('关注') ||
                                          node.textContent.includes('Follow') ||
                                          node.textContent.includes('订阅') ||
                                          node.textContent.includes('Subscribe'));
                    if (isActionButton) {
                        return NodeFilter.FILTER_REJECT;
                    }
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    let currentNode;
    let currentTextBlock = [];
    
    function flushTextBlock() {
        if (currentTextBlock.length > 0) {
            const textContent = currentTextBlock.map(item => item.text).join('');
            if (textContent.trim()) {
                console.log('📦 输出文本块:', {
                    content: textContent,
                    items: currentTextBlock.map(item => ({
                        text: item.text,
                        hasLink: !!item.link,
                        linkUrl: item.link?.url
                    }))
                });
                blocks.push({
                    type: 'text',
                    content: textContent,
                    richText: [...currentTextBlock] // 包含样式信息
                });
                fullText += textContent + '\n';
            }
            currentTextBlock = [];
        }
    }

    while (currentNode = walker.nextNode()) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
            // 检查这个文本节点是否在链接元素内，如果是则跳过，因为链接会在元素处理时单独处理
            const parentLink = currentNode.parentElement?.closest('a');
            if (parentLink && parentLink.href) {
                console.log('📝 跳过链接内的文本节点，将在链接元素中处理:', {
                    text: currentNode.textContent?.substring(0, 50),
                    parentLinkHref: parentLink.href
                });
                continue;
            }
            
            const text = currentNode.textContent;
            if (text && text.trim()) {
                // 获取文本的样式信息
                const parent = currentNode.parentElement;
                const isBold = isElementBold(parent);
                
                currentTextBlock.push({
                    text: text,
                    annotations: {
                        bold: isBold,
                        italic: false
                    }
                });
            }
        } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const tagName = currentNode.tagName.toLowerCase();
            
            // 处理链接
            if (tagName === 'a' && currentNode.href) {
                const linkText = currentNode.textContent?.trim();
                if (linkText) {
                    // 检查是否已经处理过相同文本和URL的链接，避免重复
                    const isDuplicateLink = currentTextBlock.some(item =>
                        item.text === linkText && item.link?.url === currentNode.href
                    );
                    
                    if (!isDuplicateLink) {
                        console.log('🔗 处理链接:', {
                            text: linkText,
                            href: currentNode.href,
                            currentTextBlockLength: currentTextBlock.length,
                            isDuplicate: false
                        });
                        currentTextBlock.push({
                            text: linkText,
                            annotations: { bold: false, italic: false },
                            link: { url: currentNode.href }
                        });
                    } else {
                        console.log('🔗 跳过重复链接:', {
                            text: linkText,
                            href: currentNode.href,
                            isDuplicate: true
                        });
                    }
                }
                continue;
            }
            
            // 处理图片 - 遇到图片时先输出之前的文本
            if (tagName === 'img') {
                // 检查图片是否在引用推文中
                const isInQuoteTweet = currentNode.closest('[data-testid="quote"]') ||
                                      (currentNode.closest('article[data-testid="tweet"]') &&
                                       currentNode.closest('article[data-testid="tweet"]') !== contentContainer.closest('article[data-testid="tweet"]'));
                
                // 调试信息：显示图片位置检测详情
                console.log('📍 图片位置检测详情:', {
                    src: currentNode.src,
                    isInQuoteTweet: isInQuoteTweet,
                    closestQuote: !!currentNode.closest('[data-testid="quote"]'),
                    closestArticle: !!currentNode.closest('article[data-testid="tweet"]'),
                    contentContainerArticle: !!contentContainer.closest('article[data-testid="tweet"]'),
                    sameArticle: currentNode.closest('article[data-testid="tweet"]') === contentContainer.closest('article[data-testid="tweet"]')
                });
                
                if (isInQuoteTweet) {
                    console.log('❌ 跳过引用推文中的图片:', currentNode.src);
                    continue;
                }
                
                console.log('发现图片元素:', {
                    src: currentNode.src,
                    dataTestid: currentNode.getAttribute('data-testid'),
                    alt: currentNode.alt,
                    className: currentNode.className,
                    isInQuoteTweet: isInQuoteTweet
                });
                
                // 首先检查是否是emoji图片
                const isEmojiImage = isEmojiImg(currentNode);
                if (isEmojiImage) {
                    console.log('✅ 检测到emoji图片，转换为文本:', currentNode.alt);
                    // emoji图片直接作为文本处理，不创建图片块
                    currentTextBlock.push({
                        text: currentNode.alt || '',
                        annotations: { bold: false, italic: false }
                    });
                    continue;
                }
                
                // 扩展图片检测条件 - 只抓取推文内容图片
                const isTweetPhoto = currentNode.getAttribute('data-testid') === 'tweetPhoto';
                const isTwitterImage = currentNode.src.includes('pbs.twimg.com') &&
                                      !currentNode.src.includes('profile_images'); // 排除头像
                const hasImageClass = currentNode.className && (
                    currentNode.className.includes('image') ||
                    currentNode.className.includes('media')
                ) && !currentNode.className.includes('avatar'); // 排除头像
                
                // 新增条件：检查图片是否在推文内容区域内
                const isInContentArea = contentContainer.contains(currentNode);
                
                // 调试信息：显示图片检测详情
                console.log('🔍 图片检测详情:', {
                    src: currentNode.src,
                    dataTestid: currentNode.getAttribute('data-testid'),
                    className: currentNode.className,
                    alt: currentNode.alt,
                    isTweetPhoto: isTweetPhoto,
                    isTwitterImage: isTwitterImage,
                    hasImageClass: hasImageClass,
                    isInContentArea: isInContentArea,
                    finalDecision: isTweetPhoto || isTwitterImage || hasImageClass
                });
                
                // 放宽图片检测条件：只要在内容区域内且是Twitter图片，就认为是推文图片
                if ((isTweetPhoto || isTwitterImage || hasImageClass) && isInContentArea) {
                    console.log('✅ 检测到推文图片（位置正确）:', currentNode.src);
                    flushTextBlock();
                    
                    blocks.push({
                        type: 'image',
                        url: currentNode.src,
                        alt: currentNode.alt || ''
                    });
                } else {
                    console.log('❌ 跳过非推文图片（可能是头像）:', {
                        src: currentNode.src,
                        reason: !isInContentArea ? '不在内容区域' :
                               !isTwitterImage ? '不是Twitter图片' :
                               '其他过滤条件'
                    });
                }
            }
            
            // 处理视频
            if (tagName === 'video' || 
                (currentNode.querySelector && currentNode.querySelector('video'))) {
                
                flushTextBlock();
                
                const videoElement = tagName === 'video' ? currentNode : currentNode.querySelector('video');
                if (videoElement) {
                    const videoSrc = videoElement.src || videoElement.querySelector('source')?.src;
                    if (videoSrc) {
                        blocks.push({
                            type: 'video',
                            url: videoSrc
                        });
                    }
                }
            }
            
            // 处理换行
            if (tagName === 'br') {
                currentTextBlock.push({
                    text: '\n',
                    annotations: { bold: false, italic: false }
                });
            }
        }
    }

    // 处理最后剩余的文本
    flushTextBlock();

    // 如果有引用推文，在内容末尾添加引用推文块
    if (quotedTweetUrl) {
        blocks.push({
            type: 'quoted_tweet',
            url: quotedTweetUrl
        });
    }

    // 备用图片检测：如果TreeWalker没有找到图片，直接在整个推文元素中查找
    const imageBlocksCount = blocks.filter(b => b.type === 'image').length;
    if (imageBlocksCount === 0) {
        console.log('🔍 TreeWalker未找到图片，启用备用图片检测');
        const allImages = tweetElement.querySelectorAll('img');
        console.log('📸 备用检测找到的图片数量:', allImages.length);
        
        allImages.forEach((img, index) => {
            // 检查图片是否在引用推文中
            const isInQuoteTweet = img.closest('[data-testid="quote"]') ||
                                  (img.closest('article[data-testid="tweet"]') &&
                                   img.closest('article[data-testid="tweet"]') !== tweetElement);
            
            if (isInQuoteTweet) {
                console.log(`❌ 备用检测跳过引用推文图片 ${index}:`, img.src);
                return;
            }
            
            // 检查是否是emoji图片
            if (isEmojiImg(img)) {
                console.log(`✅ 备用检测识别为emoji图片 ${index}:`, img.alt);
                return;
            }
            
            // 检查是否是推文图片
            const isTwitterImage = img.src.includes('pbs.twimg.com') &&
                                  !img.src.includes('profile_images');
            
            if (isTwitterImage) {
                console.log(`✅ 备用检测找到推文图片 ${index}:`, img.src);
                blocks.push({
                    type: 'image',
                    url: img.src,
                    alt: img.alt || ''
                });
            } else {
                console.log(`❌ 备用检测跳过非推文图片 ${index}:`, img.src);
            }
        });
    }

    console.log('提取的内容块:', blocks);
    console.log('📊 内容块统计:', {
        totalBlocks: blocks.length,
        textBlocks: blocks.filter(b => b.type === 'text').length,
        imageBlocks: blocks.filter(b => b.type === 'image').length,
        videoBlocks: blocks.filter(b => b.type === 'video').length,
        quotedTweetBlocks: blocks.filter(b => b.type === 'quoted_tweet').length,
        fullTextLength: fullText.length,
        fullTextPreview: fullText.substring(0, 100) + (fullText.length > 100 ? '...' : '')
    });
    return {
        text: fullText.trim(),
        blocks: blocks
    };
}

// 替换你原有的 extractQuotedTweetUrl() 函数为以下版本：

function extractQuotedTweetUrl(tweetElement) {
  try {
    // 获取当前推文的 status ID（用于排除自身）
    const currentUrl = window.location.href;
    const currentStatusMatch = currentUrl.match(/\/status\/(\d+)/);
    const currentStatusId = currentStatusMatch ? currentStatusMatch[1] : null;

    // 查找推文文本中所有 /status/ 链接
    const statusLinks = Array.from(tweetElement.querySelectorAll('a[href*="/status/"]'));

    for (const link of statusLinks) {
      const href = link.getAttribute('href');
      const match = href?.match(/^\/\w+\/status\/(\d+)$/);
      if (match) {
        const statusId = match[1];
        // ✅ 排除当前推文自身的链接
        if (statusId === currentStatusId) {
          console.log('跳过当前推文自身的链接:', href);
          continue;
        }

        const fullUrl = new URL(href, 'https://twitter.com').href;
        console.log('提取到引用推文链接：', fullUrl);
        return fullUrl;
      }
    }

    return null;
  } catch (error) {
    console.error('提取引用推文URL出错:', error);
    return null;
  }
}


// 检查是否是emoji图片
function isEmojiImg(imgElement) {
    if (!imgElement) return false;
    
    const src = imgElement.src || '';
    const alt = imgElement.alt || '';
    const className = imgElement.className || '';
    
    // 条件1: src包含emoji域名（最可靠的判断）
    const hasEmojiDomain = src.includes('twimg.com/emoji') ||
                          src.includes('abs-0.twimg.com/emoji') ||
                          src.includes('abs-1.twimg.com/emoji') ||
                          src.includes('abs-2.twimg.com/emoji');
    
    // 条件2: alt是短字符且不是描述性文本
    const isShortAlt = alt.length <= 3 && alt.length > 0;
    const isDescriptiveAlt = alt.includes(' ') || alt.length > 10; // 排除描述性alt
    
    // 条件3: alt是emoji字符（Unicode范围检查）
    const isEmojiChar = alt.length >= 1 && alt.length <= 3 &&
                       Array.from(alt).every(char => {
                           const code = char.codePointAt(0);
                           // 常见emoji Unicode范围
                           return (code >= 0x1F600 && code <= 0x1F64F) || // 表情符号
                                  (code >= 0x1F300 && code <= 0x1F5FF) || // 杂项符号和象形文字
                                  (code >= 0x1F680 && code <= 0x1F6FF) || // 交通和地图符号
                                  (code >= 0x2600 && code <= 0x26FF) ||   // 杂项符号
                                  (code >= 0x2700 && code <= 0x27BF) ||   // 装饰符号
                                  (code >= 0x1F900 && code <= 0x1F9FF) || // 补充符号和象形文字
                                  (code >= 0x1F1E6 && code <= 0x1F1FF);   // 区域指示符号
                       });
    
    // 条件4: 检查常见的emoji类名
    const hasEmojiClass = className.includes('emoji') ||
                         className.includes('r-4qtqp9') ||
                         className.includes('r-dflpy8') ||
                         className.includes('r-1kqtdi0') ||
                         className.includes('r-1sp51qo');
    
    // 条件5: 检查图片尺寸（emoji通常较小）
    const width = imgElement.width || imgElement.getAttribute('width');
    const height = imgElement.height || imgElement.getAttribute('height');
    const isSmallSize = (width && width <= 24) || (height && height <= 24);
    
    // 主要判断逻辑：有emoji域名 或者 (短字符+emoji类名) 或者 (emoji字符)
    const isEmoji = hasEmojiDomain ||
                   (isShortAlt && hasEmojiClass && !isDescriptiveAlt) ||
                   isEmojiChar;
    
    if (isEmoji) {
        console.log('🔍 识别为emoji图片:', {
            src: src.substring(0, 50) + '...',
            alt,
            className: className.substring(0, 30) + '...',
            hasEmojiDomain,
            isShortAlt,
            isEmojiChar,
            hasEmojiClass,
            isSmallSize
        });
    }
    
    return isEmoji;
}

// 改进的加粗检测函数
function isElementBold(element) {
    if (!element) return false;
    
    // 检查标签
    if (element.tagName === 'STRONG' || element.tagName === 'B') {
        return true;
    }
    
    // 检查计算样式
    try {
        const style = window.getComputedStyle(element);
        const fontWeight = style.fontWeight;
        
        // 只有明确设置为 700 或 bold 才认为是加粗
        if (fontWeight === '700' || fontWeight === 'bold') {
            // 进一步验证：检查父元素是否也是加粗，避免继承
            let parent = element.parentElement;
            let parentBold = false;
            for (let i = 0; i < 2 && parent; i++) { // 检查两层父元素
                const parentStyle = window.getComputedStyle(parent);
                if (parentStyle.fontWeight === '700' || parentStyle.fontWeight === 'bold') {
                    parentBold = true;
                    break;
                }
                parent = parent.parentElement;
            }
            
            // 如果父元素不是加粗，当前元素明确加粗，才返回 true
            if (!parentBold) {
                return true;
            }
        }
    } catch (e) {
        console.warn('无法获取元素样式:', e);
    }
    
    return false;
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractTweetData") {
        const tweetData = extractTweetData();
        sendResponse(tweetData);
    }
    return true;
});

// 添加保存按钮到Twitter界面
function addSaveButton() {
    const observer = new MutationObserver(() => {
        addButtonsToTweets();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    setTimeout(addButtonsToTweets, 1000);
}

function addButtonsToTweets() {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    
    tweets.forEach(tweet => {
        if (tweet.querySelector('.x-to-notion-save-btn')) {
            return;
        }
        
        const shareButton = tweet.querySelector('[data-testid="share"]');
        if (!shareButton) return;
        
        const saveButton = document.createElement('div');
        saveButton.className = 'x-to-notion-save-btn';
        saveButton.innerHTML = `
            <button type="button" style="
                background: transparent;
                border: none;
                padding: 8px;
                cursor: pointer;
                border-radius: 50%;
                transition: background-color 0.2s;
                color: rgb(113, 118, 123);
            " title="Save to Notion">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
                </svg>
            </button>
        `;
        
        shareButton.parentNode.insertBefore(saveButton, shareButton.nextSibling);
        
        const button = saveButton.querySelector('button');
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await handleSaveButtonClick(tweet, button);
        });
    });
}

async function handleSaveButtonClick(tweetElement, button) {
    try {
        button.style.color = '#1d9bf0';
        button.disabled = true;
        
        const tweetData = extractTweetData(tweetElement);
        console.log('📊 保存前的推文数据:', {
            hasContentBlocks: !!tweetData?.contentBlocks,
            contentBlocksCount: tweetData?.contentBlocks?.length,
            imageBlocks: tweetData?.contentBlocks?.filter(b => b.type === 'image').length,
            imageUrls: tweetData?.contentBlocks?.filter(b => b.type === 'image').map(b => b.url)
        });
        
        if (!tweetData) {
            showButtonFeedback(button, '❌ Failed to extract tweet data', false);
            return;
        }
        
        const config = await new Promise(resolve => {
            chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions"], resolve);
        });
        
        if (!config.notionApiKey || !config.databaseId) {
            showButtonFeedback(button, '❌ Please configure plugin first', false);
            return;
        }
        
        let typeOptions = [];
        if (config.typeOptions) {
            typeOptions = config.typeOptions.split('\n')
                .map(opt => opt.trim())
                .filter(opt => opt.length > 0);
        }
        
        let selectedTypes = [];
        if (typeOptions.length > 0) {
            selectedTypes = await showMultiTypeSelectionDialog(typeOptions);
            if (selectedTypes === null) {
                resetButton(button);
                return;
            }
        }
        
        tweetData.type = selectedTypes;
        
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({
                action: "saveToNotion",
                tweet: tweetData,
                notionApiKey: config.notionApiKey,
                databaseId: config.databaseId
            }, resolve);
        });
        
        if (response && response.success) {
            showButtonFeedback(button, '✅ Saved to Notion!', true);
        } else {
            showButtonFeedback(button, '❌ Save failed: ' + (response?.error || 'Unknown error'), false);
        }
        
    } catch (error) {
        console.error('Error saving tweet:', error);
        showButtonFeedback(button, '❌ Error: ' + error.message, false);
    }
}

// 多选类型选择对话框
function showMultiTypeSelectionDialog(typeOptions) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 300px;
            max-width: 400px;
            max-height: 500px;
            overflow: hidden;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; font-size: 18px;">选择分类 (可多选)</h3>
            <div style="margin-bottom: 10px; display: flex; gap: 10px;">
                <button id="selectAllBtn" style="padding: 6px 12px; background: #e8f5fe; color: #1da1f2; border: 1px solid #1da1f2; border-radius: 4px; cursor: pointer; font-size: 12px;">全选</button>
                <button id="clearAllBtn" style="padding: 6px 12px; background: #fef0ef; color: #e0245e; border: 1px solid #e0245e; border-radius: 4px; cursor: pointer; font-size: 12px;">清除</button>
            </div>
            <div id="typeOptionsContainer" style="margin-bottom: 15px; max-height: 300px; overflow-y: auto; border: 1px solid #e1e8ed; border-radius: 8px; padding: 10px;"></div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 8px 16px; border: 1px solid #cfd9de; background: white; border-radius: 20px; cursor: pointer;">取消</button>
                <button id="confirmBtn" style="padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 20px; cursor: pointer; font-weight: 600;">确认</button>
            </div>
        `;
        
        const container = dialog.querySelector('#typeOptionsContainer');
        
        if (typeOptions.length === 0) {
            const noOptions = document.createElement('div');
            noOptions.textContent = '没有可用的分类选项';
            noOptions.style.cssText = `padding: 12px; text-align: center; color: #536471;`;
            container.appendChild(noOptions);
        } else {
            typeOptions.forEach((type, index) => {
                const label = document.createElement('label');
                label.style.cssText = `
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    margin: 5px 0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                `;
                label.onmouseover = () => label.style.background = '#f7f9fa';
                label.onmouseout = () => label.style.background = 'transparent';
                label.innerHTML = `<input type="checkbox" value="${type}" id="type${index}" style="margin-right: 10px;"><span>${type}</span>`;
                container.appendChild(label);
            });
        }
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;
        
        dialog.querySelector('#selectAllBtn').onclick = () => {
            dialog.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = true;
            });
        };
        
        dialog.querySelector('#clearAllBtn').onclick = () => {
            dialog.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        };
        
        dialog.querySelector('#confirmBtn').onclick = () => {
            const selected = Array.from(dialog.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            document.body.removeChild(overlay);
            resolve(selected);
        };
        
        dialog.querySelector('#cancelBtn').onclick = () => {
            document.body.removeChild(overlay);
            resolve(null);
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(null);
            }
        };
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleKeydown);
                resolve(null);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    });
}

function showButtonFeedback(button, message, isSuccess) {
    const originalColor = button.style.color;
    const originalHTML = button.innerHTML;
    button.innerHTML = message;
    button.style.color = isSuccess ? '#00ba7c' : '#f91880';
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.color = originalColor;
        button.disabled = false;
    }, 3000);
}

function resetButton(button) {
    button.style.color = 'rgb(113, 118, 123)';
    button.disabled = false;
}

// 启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSaveButton);
} else {
    addSaveButton();
}