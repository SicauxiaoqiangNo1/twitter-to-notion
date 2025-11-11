// content.js - 完整重构版 (支持 Thread 提取)
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

        // 提取推文的唯一链接
        const permalink = timeElement ? timeElement.closest('a')?.getAttribute('href') : null;
        const tweetUrl = permalink ? new URL(permalink, 'https://twitter.com').href : window.location.href;

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
            url: tweetUrl, // 使用唯一的推文链接
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
    
    // 查找推文内容容器 - 严格模式
    let contentContainer = tweetElement.querySelector('[data-testid="tweetText"]');
    
    if (!contentContainer) {
        console.log('严格模式：未找到 [data-testid="tweetText"]，返回空内容。');
        return { text: '', blocks: [] };
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
                    // 新增：跳过时间戳链接
                    if (node.tagName === 'A' && node.querySelector('time')) {
                        console.log('发现并拒绝时间戳链接节点:', node);
                        return NodeFilter.FILTER_REJECT;
                    }

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

                    // 新增：跳过翻译按钮区域
                    const text = node.textContent || "";
                    if (text.includes('Show translation') || text.includes('翻译帖子') || text.includes('Translate post')) {
                        const isButton = node.tagName === 'BUTTON' || node.closest('button');
                        const hasTranslateIcon = node.querySelector('svg path[d^="M12.745"]');
                        if (isButton || hasTranslateIcon) {
                            console.log('发现并拒绝翻译相关节点:', node);
                            return NodeFilter.FILTER_REJECT;
                        }
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
            const text = currentNode.textContent;
            if (text && text.trim()) {
                const parent = currentNode.parentElement;
                const isBold = isElementBold(parent);
                const linkInfo = parent.closest('a');

                const textData = {
                    text: text,
                    annotations: {
                        bold: isBold,
                        italic: false
                    }
                };

                if (linkInfo && linkInfo.href) {
                    textData.link = { url: linkInfo.href };
                }

                currentTextBlock.push(textData);
            }
        } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const tagName = currentNode.tagName.toLowerCase();
            
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
                        // alt: currentNode.alt || '' // !! 已移除 !!
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
                    // alt: img.alt || '' // !! 已移除 !!
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

/**
 * 隐藏广告推文
 * @param {Element} tweetElement
 */
function hideAdTweet(tweetElement) {
    if (tweetElement && tweetElement.style) {
        tweetElement.style.display = 'none';
        console.log('隐藏广告推文:', tweetElement);
    }
}

/**
 * 新增：检查一个推文元素是否是广告
 * @param {Element} tweetElement
 * @returns {boolean}
 */
function isAdTweet(tweetElement) {
    if (!tweetElement) return false;
    // 查找所有span元素并检查文本内容是否为 "Ad" 或 "Promoted" (不区分大小写)
    const adSpans = tweetElement.querySelectorAll('span');
    for (const span of adSpans) {
        const text = span.textContent.trim();
        if (text.toLowerCase() === 'ad' || text.toLowerCase() === 'promoted') {
            console.log('发现广告推文（通过文本识别），将跳过:', tweetElement);
            return true;
        }
    }
    return false;
}

// ==================== Thread 提取逻辑 (新增) ====================
/**
 * 新增：提取作者 Handle 的辅助函数
 * @param {Element} tweetElement
 * @returns {string | null}
 */
function extractAuthorHandle(tweetElement) {
    const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
    if (authorElement) {
        const authorLink = authorElement.querySelector('a[role="link"]');
        if (authorLink) {
            return authorLink.getAttribute('href'); // e.g., "/sicauman"
        }
    }
    return null;
}

/**
 * 新增：获取当前页面的推文上下文
 * (轻量级检查，只获取第一条推文数据和 Thread 长度)
 */
function getTweetContext() {
    try {
        const allTweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        if (allTweetElements.length === 0) {
            return null;
        }

        let startIndex = 0;
        while(startIndex < allTweetElements.length && isAdTweet(allTweetElements[startIndex])) {
            startIndex++;
        }

        if (startIndex >= allTweetElements.length) {
            console.log('页面上只找到了广告推文');
            return null;
        }

        const mainTweetElement = allTweetElements[startIndex];
        const mainAuthorHandle = extractAuthorHandle(mainTweetElement);
        
        // 新增：判断是否存在评论（页面上推文数量 > 1）
        const hasComments = allTweetElements.length > 1;

        if (!mainAuthorHandle) {
             // 无法识别作者，可能在非推文页，仅返回单条
             return {
                isThread: false,
                threadLength: 1,
                hasComments: hasComments,
                mainTweetData: extractTweetData(mainTweetElement)
             };
        }

        let threadLength = 0;
        for (let i = startIndex; i < allTweetElements.length; i++) {
            const el = allTweetElements[i];
            if (isAdTweet(el)) {
                continue; // 跳过广告
            }
            if (extractAuthorHandle(el) === mainAuthorHandle) {
                threadLength++;
            } else {
                // 遇到不同作者，停止计数
                break;
            }
        }
        
        const mainTweetData = extractTweetData(mainTweetElement);
        
        return {
            isThread: threadLength > 1,
            threadLength: threadLength,
            hasComments: hasComments,
            mainTweetData: mainTweetData
        };

    } catch (error) {
        console.error('Error getting tweet context:', error);
        return { isThread: false, threadLength: 1, hasComments: false, mainTweetData: extractTweetData() };
    }
}

/**
 * 新增：获取完整的 Thread 数据
 * (重量级操作，提取所有推文)
 */
function getFullThreadData() {
    const threadTweets = [];
    const allTweetElements = document.querySelectorAll('article[data-testid="tweet"]');
    
    if (allTweetElements.length === 0) return [];

    let startIndex = 0;
    while(startIndex < allTweetElements.length && isAdTweet(allTweetElements[startIndex])) {
        startIndex++;
    }

    if (startIndex >= allTweetElements.length) return [];
    
    const mainAuthorHandle = extractAuthorHandle(allTweetElements[startIndex]);
    if (!mainAuthorHandle) {
        // 无作者，只返回第一条非广告推文
        const data = extractTweetData(allTweetElements[startIndex]);
        return data ? [data] : [];
    }

    for (let i = startIndex; i < allTweetElements.length; i++) {
        const tweetElement = allTweetElements[i];
        if (isAdTweet(tweetElement)) {
            console.log('在 getFullThreadData 中跳过广告');
            continue; // 跳过广告
        }

        if (extractAuthorHandle(tweetElement) === mainAuthorHandle) {
            const tweetData = extractTweetData(tweetElement);
            if (tweetData) {
                threadTweets.push(tweetData);
            }
        } else {
            break; // 遇到不同作者的真实推文，停止
        }
    }
    return threadTweets;
}

/**
 * 新增：提取与博主的直接对话回复
 * @param {Element[]} threadElements - 推文元素数组
 * @param {string} mainAuthorHandle - 主推文作者的handle
 * @returns {Array} 筛选后的直接回复数组
 */
function extractDirectRepliesFromThread(threadElements, mainAuthorHandle) {
    console.log('开始提取与博主的直接对话回复');
    const replies = [];
    const normalizedHandle = mainAuthorHandle ? mainAuthorHandle.replace('@', '') : '';
    
    console.log('目标博主handle:', normalizedHandle);
    
    for (let i = 0; i < threadElements.length; i++) {
        const tweetElement = threadElements[i];
        const content = extractReplyContent(tweetElement);
        const authorHandle = extractAuthorHandle(tweetElement);
        
        // 跳过博主自己的回复
        if (authorHandle === mainAuthorHandle) {
            continue;
        }
        
        console.log(`检查第${i + 1}条回复:`, {
            author: authorHandle,
            content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            contentLength: content.length
        });
        
        // 新逻辑：只检查内容长度是否≥5个字符
        if (content.length >= 5) {
            console.log('✅ 识别为有效问答对 (长度符合)');
            replies.push({
                question: content,
                author: authorHandle,
                timestamp: extractTimestamp(tweetElement),
                authorName: extractAuthorName(tweetElement)
            });
        } else {
            console.log('❌ 跳过（内容太短）');
        }
    }
    
    console.log('最终筛选出的问答对数量:', replies.length);
    return replies;
}

/**
 * 检查回复是否@了博主
 * @param {string} content - 回复内容
 * @param {string} authorHandle - 博主handle（不含@）
 * @returns {boolean} 是否@了博主
 */
function isReplyToAuthor(content, authorHandle) {
    if (!content || !authorHandle) return false;
    
    // 检查是否包含@博主
    const hasAtSymbol = content.includes(`@${authorHandle}`);
    const hasFullHandle = content.includes(authorHandle);
    
    console.log('回复检测结果:', {
        content: content.substring(0, 30),
        authorHandle: authorHandle,
        hasAtSymbol: hasAtSymbol,
        hasFullHandle: hasFullHandle,
        isReply: hasAtSymbol || hasFullHandle
    });
    
    return hasAtSymbol || hasFullHandle;
}

/**
 * 从tweet元素中提取回复内容
 * @param {Element} tweetElement - tweet元素
 * @returns {string} 提取的内容
 */
function extractReplyContent(tweetElement) {
    if (!tweetElement) return '';
    
    // 查找推文文本内容
    const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
    if (textElement) {
        return textElement.textContent || '';
    }
    
    // 备用方案：查找其他可能的文本容器
    const contentSelectors = [
        '[data-testid="tweet"]',
        'div[lang]',
        '.tweet-text',
        '.css-901oao'
    ];
    
    for (const selector of contentSelectors) {
        const element = tweetElement.querySelector(selector);
        if (element) {
            return element.textContent || '';
        }
    }
    
    return '';
}

/**
 * 提取作者名称
 * @param {Element} tweetElement - tweet元素
 * @returns {string} 作者名称
 */
function extractAuthorName(tweetElement) {
    const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
    if (authorElement) {
        const nameElement = authorElement.querySelector('span');
        if (nameElement) {
            return nameElement.textContent || '';
        }
    }
    return '';
}

/**
 * 提取时间戳
 * @param {Element} tweetElement - tweet元素
 * @returns {string} 格式化的时间戳
 */
function extractTimestamp(tweetElement) {
    const timeElement = tweetElement.querySelector('time');
    if (timeElement) {
        const datetime = timeElement.getAttribute('datetime');
        if (datetime) {
            return new Date(datetime).toLocaleString('zh-CN');
        }
    }
    return new Date().toLocaleString('zh-CN');
}


// ==================== 核心逻辑 (SPA, Debounce, Page-Type) ====================

let lastUrl = location.href;

/**
 * Debounce function to limit how often a function gets called.
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * 处理 DOM 变化的函数 (经过 debounce 处理)
 */
const handleDomChanges = debounce((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查节点本身是否是推文
                    if (node.matches('article[data-testid="tweet"]')) {
                        console.log("[content.js] New tweet detected:", node);
                        if (isAdTweet(node)) {
                            hideAdTweet(node);
                        }
                    }
                    // 检查节点内部是否有推文
                    node.querySelectorAll('article[data-testid="tweet"]').forEach(tweetNode => {
                        // 避免重复记录
                        if (!tweetNode.dataset.tweetDetected) {
                            console.log("[content.js] New tweet detected (in subtree):", tweetNode);
                            tweetNode.dataset.tweetDetected = 'true';
                            if (isAdTweet(tweetNode)) {
                                hideAdTweet(tweetNode);
                            }
                        }
                    });
                }
            }
        }
    }
}, 300); // 300ms 延迟，避免频繁触发

/**
 * 当页面加载或 URL 变化时运行的函数
 */
function onPageLoadOrUrlChange() {
    console.log("[content.js] URL changed or page loaded:", location.href);
    lastUrl = location.href;

    // 区分页面类型
    const pathname = location.pathname;
    if (pathname === '/home') {
        console.log('[content.js] Page type: Home Feed');
    } else if (pathname.includes('/status/')) {
        console.log('[content.js] Page type: Tweet Detail (Status)');
    } else if (pathname.startsWith('/') && pathname.split('/').length === 2 && !['home', 'explore', 'notifications', 'messages'].includes(pathname.slice(1))) {
        console.log('[content.js] Page type: User Profile');
    } else {
        console.log('[content.js] Page type: Other');
    }

    // 过滤页面上已存在的广告推文
    document.querySelectorAll('article[data-testid="tweet"]').forEach(tweetElement => {
        if (isAdTweet(tweetElement)) {
            hideAdTweet(tweetElement);
        }
    });

    // 重新初始化 MutationObserver 以监听新页面的 DOM 变化
    initializeMutationObserver();
}

/**
 * 初始化 MutationObserver，用于检测新推文（滚动加载）
 */
function initializeMutationObserver() {
    // 如果已存在 observer，先断开连接，避免重复监听
    if (window.tweetObserver) {
        window.tweetObserver.disconnect();
        console.log("[content.js] Disconnected existing MutationObserver.");
    }

    const observer = new MutationObserver(handleDomChanges);

    // 监听主内容区域的变化，比监听整个 body 更高效
    const mainContentArea = document.querySelector('main');
    if (mainContentArea) {
        observer.observe(mainContentArea, { childList: true, subtree: true });
        console.log("[content.js] MutationObserver started on <main> element.");
    } else {
        console.warn("[content.js] Could not find <main> element to observe. Falling back to <body>.");
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 将 observer 实例存放在 window 对象上，方便管理
    window.tweetObserver = observer;
}

/**
 * 初始化脚本，设置所有事件监听器
 */
function initializeContentScript() {
    // 监听浏览器的前进/后退操作
    window.addEventListener('popstate', () => {
        if (location.href !== lastUrl) {
            onPageLoadOrUrlChange();
        }
    });

    // 通过劫持 history API 来监听 SPA 内部的路由跳转
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        window.dispatchEvent(new Event('urlchange'));
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        window.dispatchEvent(new Event('urlchange'));
    };

    // 监听自定义的 urlchange 事件
    window.addEventListener('urlchange', () => {
        if (location.href !== lastUrl) {
            onPageLoadOrUrlChange();
        }
    });

    console.log("[content.js] Initialized and listening for all URL changes.");
    
    // 首次加载时运行
    onPageLoadOrUrlChange();
}

// ==================== 消息与事件处理 ====================

// 修改：原有的消息监听器，增加 Thread 相关 action
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({ status: "pong" });
        return true;
    }
    if (request.action === "getTweetContext") {
        // 新增：Popup 打开时请求上下文
        const context = getTweetContext();
        sendResponse(context);
    } else if (request.action === "getFullThreadData") {
        // 新增：用户确认保存 Thread 后，请求完整数据
        const threadData = getFullThreadData();
        sendResponse(threadData);
    } else if (request.action === "extractCommentsAndChains") {
        console.log('收到提取评论和对话链的请求');
        const items = extractCommentsAndChains();
        sendResponse(items);
    }
    return true;
});

/**
 * 新增：提取评论和对话链
 * @returns {Array<Object|Array<Object>>} 一个混合数组，包含独立的评论对象和对话链数组
 */
function extractCommentsAndChains() {
    console.log('开始提取评论和对话链 (V6 - 新筛选逻辑)');
    const results = [];
    const allTweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));

    if (allTweetElements.length <= 1) {
        return [];
    }

    // 获取主博主 handle
    const mainAuthorHandle = extractAuthorHandle(allTweetElements[0]);

    // 跳过主推文和广告
    let startIndex = 0;
    while (startIndex < allTweetElements.length && (isAdTweet(allTweetElements[startIndex]) || startIndex === 0)) {
        startIndex++;
    }

    // 1. 预处理所有评论，获取所需信息，但不进行最终过滤
    const allCommentsProcessed = allTweetElements.slice(startIndex).map(el => {
        if (isAdTweet(el)) return null;
        
        const tweetData = extractTweetData(el);
        if (!tweetData) return null;
        
        return {
            tweetData: tweetData,
            isMainAuthor: tweetData.metadata.authorHandle === mainAuthorHandle,
            hasSeparator: el.querySelector('div.css-175oi2r.r-1bimlpy.r-f8sm7e.r-m5arl1.r-16y2uox.r-14gqq1x') !== null
        };
    }).filter(Boolean);

    // 2. 识别对话链
    const itemsWithChainInfo = [];
    let i = 0;
    while (i < allCommentsProcessed.length) {
        const currentComment = allCommentsProcessed[i];

        if (currentComment.hasSeparator) {
            const currentChain = [currentComment]; // Keep the full object for now
            let j = i + 1;
            while (j < allCommentsProcessed.length && allCommentsProcessed[j - 1].hasSeparator) {
                currentChain.push(allCommentsProcessed[j]);
                j++;
            }
            itemsWithChainInfo.push({ isChain: true, data: currentChain });
            i = j;
        } else {
            itemsWithChainInfo.push({ isChain: false, data: currentComment });
            i++;
        }
    }

    // 3. 应用新的过滤规则并构建最终结果
    itemsWithChainInfo.forEach(item => {
        if (item.isChain) {
            // 规则2: 属于对话链内的内容均保存
            const chainData = item.data.map(c => c.tweetData); // Extract just the tweetData
            results.push(chainData);
            console.log(`📦 保留一个对话链 (共 ${chainData.length} 条)`);
        } else {
            // 是独立评论
            const comment = item.data;
            if (comment.isMainAuthor) {
                // 规则2: 是博主本人...的内容均保存
                results.push(comment.tweetData);
                console.log(`📝 保留一条博主本人的评论`);
            } else {
                // 规则1: 非博主本人的且字符长度小于10的不保存
                if (comment.tweetData.fullContent.trim().length >= 10) {
                    results.push(comment.tweetData);
                    console.log(`📝 保留一条独立评论 (长度: ${comment.tweetData.fullContent.trim().length})`);
                } else {
                    console.log(`❌ 丢弃一条独立评论 (长度: ${comment.tweetData.fullContent.trim().length}, 小于10)`);
                }
            }
        }
    });

    console.log(`=== 对话链提取完成 === 共找到 ${results.length} 个项目（独立评论或对话链）`);
    const chainCount = results.filter(item => Array.isArray(item)).length;
    const commentCount = results.filter(item => !Array.isArray(item)).length;
    console.log(`📊 最终统计: ${chainCount} 个对话链, ${commentCount} 条独立评论`);

    return results;
}


// ==================== 启动入口 ====================
initializeContentScript();