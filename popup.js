// popup.js - 完整重构版 (支持 Thread 保存)

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// New function for auto-validation
async function handleAutoValidation() {
    const apiKey = document.getElementById("notionApiKey").value.trim();
    const dbId = document.getElementById("databaseId").value.trim();
    const apiKeyStatus = document.getElementById("apiKeyStatus");
    const dbIdStatus = document.getElementById("dbIdStatus");

    // Reset status if fields are empty
    if (!apiKey) {
        apiKeyStatus.className = 'validation-status';
        return;
    }
    if (!dbId) {
        dbIdStatus.className = 'validation-status';
        return;
    }

    apiKeyStatus.className = 'validation-status loading';
    dbIdStatus.className = 'validation-status loading';

    const isValid = await validateConfiguration(apiKey, dbId);

    if (isValid) {
        apiKeyStatus.className = 'validation-status valid';
        dbIdStatus.className = 'validation-status valid';
    } else {
        apiKeyStatus.className = 'validation-status invalid';
        dbIdStatus.className = 'validation-status invalid';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    // 加载保存的配置
    loadConfiguration();
    
    // 保存配置按钮
    document.getElementById("saveConfigBtn").addEventListener("click", saveConfiguration);
    
    // 编辑配置按钮
    document.getElementById("editConfigBtn").addEventListener("click", editConfiguration);
    
    // 设置配置状态栏点击事件
    setupConfigStatusClickHandler();

    // Auto-validation listeners
    const debouncedValidation = debounce(handleAutoValidation, 500);
    document.getElementById("notionApiKey").addEventListener("input", debouncedValidation);
    document.getElementById("databaseId").addEventListener("input", debouncedValidation);
});

function loadConfiguration() {
    // 仅加载 notionApiKey / databaseId / typeOptions / defaultSaveThread / defaultSaveComments
    chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions", "defaultSaveThread", "defaultSaveComments"], (data) => {
        console.log('Loaded config from storage:', {
            hasApiKey: !!data.notionApiKey,
            hasDatabaseId: !!data.databaseId,
            hasTypeOptions: !!data.typeOptions,
            typeOptionsValue: data.typeOptions,
            defaultSaveThread: data.defaultSaveThread,
            defaultSaveComments: data.defaultSaveComments
        });

        if (data.notionApiKey) {
            document.getElementById("notionApiKey").value = data.notionApiKey;
        }
        if (data.databaseId) {
            document.getElementById("databaseId").value = data.databaseId;
        }
        if (data.typeOptions) {
            document.getElementById("typeOptions").value = data.typeOptions;
            console.log('Loaded typeOptions:', data.typeOptions);
        } else {
            console.log('No typeOptions found in storage');
        }

        // 设置默认保存选项的复选框状态
        const defaultSaveThreadCheckbox = document.getElementById("defaultSaveThread");
        if (defaultSaveThreadCheckbox) {
            defaultSaveThreadCheckbox.checked = data.defaultSaveThread !== undefined ? data.defaultSaveThread : true; // 默认勾选
        }
        const defaultSaveCommentsCheckbox = document.getElementById("defaultSaveComments");
        if (defaultSaveCommentsCheckbox) {
            defaultSaveCommentsCheckbox.checked = data.defaultSaveComments !== undefined ? data.defaultSaveComments : false; // 默认不勾选
        }

        // 更新按钮状态
        updateUIState(data.notionApiKey, data.databaseId);
        
        // 如果配置存在，验证其有效性
        if (data.notionApiKey && data.databaseId) {
            validateConfiguration(data.notionApiKey, data.databaseId)
                .then(isValid => {
                    updateConfigStatusDisplay(data.notionApiKey, data.databaseId, isValid);
                })
                .catch(error => {
                    console.warn('Initial configuration validation failed:', error);
                    updateConfigStatusDisplay(data.notionApiKey, data.databaseId, false);
                });
        }
        // 如果是初始打开 popup（尚未尝试自动保存），则尝试一次自动保存
        try {
            if (data.notionApiKey && data.databaseId && !autoSaveAttempted) {
                autoSaveAttempted = true;
                // 延迟一点以保证 UI 已渲染
                setTimeout(() => {
                    saveCurrentTweet();
                }, 150);
            }
        } catch (e) {
            console.warn('Initial auto-save attempt failed:', e);
        }
    });
}

let autoSaveAttempted = false; // 防止重复自动触发保存

function updateUIState(apiKey, databaseId) {
    const configSection = document.getElementById("configSection");
    const mainSection = document.getElementById("mainSection");
    const configStatusSection = document.getElementById("configStatusSection");
    const configStatusBar = document = document.getElementById("configStatusBar");
    const container = document.querySelector('.container');

    if (apiKey && databaseId) {
        // 有配置：显示主界面和状态栏
        if (configSection && mainSection && configStatusSection && configStatusBar && container) {
            // 在配置页面显示主界面
            configSection.style.display = 'none';
            mainSection.style.display = 'block';
            
            // 移除配置模式类，显示编辑按钮
            container.classList.remove('config-mode');
            
            // 检查是否正在显示保存成功页面
            const saveSuccessDiv = document.getElementById('saveSuccess');
            if (saveSuccessDiv && saveSuccessDiv.style.display === 'block') {
                // 保存成功页面：隐藏整个配置状态区域
                configStatusSection.style.display = 'none';
                configStatusBar.style.display = 'none';
            } else {
                // 主界面：显示配置状态区域
                configStatusSection.style.display = 'block';
                configStatusBar.style.display = 'flex';
                // 更新配置状态显示（初始显示为有效，后续会通过验证更新）
                updateConfigStatusDisplay(apiKey, databaseId, true);
                
                // 异步验证配置有效性
                validateConfiguration(apiKey, databaseId)
                    .then(isValid => {
                        updateConfigStatusDisplay(apiKey, databaseId, isValid);
                    })
                    .catch(error => {
                        console.warn('Configuration validation failed:', error);
                        updateConfigStatusDisplay(apiKey, databaseId, false);
                    });
            }
        }
    } else {
        // 无配置：显示配置界面
        if (configSection && mainSection && configStatusSection && configStatusBar && container) {
            configSection.style.display = 'block';
            mainSection.style.display = 'none';
            configStatusSection.style.display = 'none';
            configStatusBar.style.display = 'none';
            
            // 添加配置模式类，隐藏编辑按钮
            container.classList.add('config-mode');
        }
        showStatus("Please configure your Notion API settings first.", "error");
    }
}

// 更新配置状态显示
function updateConfigStatusDisplay(apiKey, databaseId, isValid = true) {
    const configStatusElement = document.querySelector('.config-status');
    if (!configStatusElement) return;
    
    const iconElement = configStatusElement.querySelector('span:first-child');
    const textElement = configStatusElement.querySelector('span:last-child');
    
    if (apiKey && databaseId && isValid) {
        // 配置正确且有效：显示绿色✅
        iconElement.textContent = '✅';
        textElement.textContent = 'Configuration Saved';
        textElement.style.color = '#059669'; // 绿色
    } else {
        // 配置错误或无效：显示红色❌
        iconElement.textContent = '❌';
        textElement.textContent = 'Configuration Error';
        textElement.style.color = '#dc2626'; // 红色
    }
}

// 验证配置是否有效（通过测试API连接）
async function validateConfiguration(apiKey, databaseId) {
    if (!apiKey || !databaseId) {
        return false;
    }
    
    try {
        const cleanDatabaseId = databaseId.replace(/-/g, '');
        const response = await fetch(`https://api.notion.com/v1/databases/${cleanDatabaseId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Notion-Version': '2022-06-28'
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('Configuration validation failed:', error);
        return false;
    }
}

// 点击配置状态栏时重新验证配置
function setupConfigStatusClickHandler() {
    const configStatusBar = document.getElementById('configStatusBar');
    if (!configStatusBar) return;
    
    configStatusBar.addEventListener('click', async () => {
        console.log('Config status bar clicked, revalidating configuration...');
        
        // 重新加载配置并验证
        chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions"], (data) => {
            console.log('Config loaded for validation:', {
                hasApiKey: !!data.notionApiKey,
                hasDatabaseId: !!data.databaseId,
                hasTypeOptions: !!data.typeOptions,
                typeOptionsValue: data.typeOptions
            });
            
            if (data.notionApiKey && data.databaseId) {
                // 验证配置是否真正有效
                validateConfiguration(data.notionApiKey, data.databaseId)
                    .then(isValid => {
                        if (isValid) {
                            updateConfigStatusDisplay(data.notionApiKey, data.databaseId, true);
                            showStatus("✅ Configuration is valid", "success");
                        } else {
                            updateConfigStatusDisplay(data.notionApiKey, data.databaseId, false);
                            showStatus("❌ Configuration is invalid - check API Key and Database ID", "error");
                        }
                    })
                    .catch(error => {
                        updateConfigStatusDisplay(data.notionApiKey, data.databaseId, false);
                        showStatus("❌ Configuration validation failed: " + error.message, "error");
                    });
            }
        });
    });
}

function saveConfiguration() {
    const notionApiKey = document.getElementById("notionApiKey").value.trim();
    const databaseId = document.getElementById("databaseId").value.trim();
    const typeOptions = document.getElementById("typeOptions").value.trim();
    const defaultSaveThread = document.getElementById("defaultSaveThread")?.checked || false;
    const defaultSaveComments = document.getElementById("defaultSaveComments")?.checked || false;

    console.log('Saving configuration:', {
        notionApiKey: notionApiKey ? '***' : 'empty',
        databaseId: databaseId || 'empty',
        typeOptions: typeOptions || 'empty',
        defaultSaveThread: defaultSaveThread,
        defaultSaveComments: defaultSaveComments
    });

    if (!notionApiKey) {
        showStatus("Please enter your Notion API Key.", "error");
        return;
    }
    
    if (!databaseId) {
        showStatus("Please enter your Database ID.", "error");
        return;
    }

    // 存储配置
    chrome.storage.local.set({ 
        notionApiKey: notionApiKey, 
        databaseId: databaseId,
        typeOptions: typeOptions, // 存储原始文本
        defaultSaveThread: defaultSaveThread,
        defaultSaveComments: defaultSaveComments
    }, () => {
        // 验证配置是否保存成功
        chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions", "defaultSaveThread", "defaultSaveComments"], (data) => {
            console.log('Verified storage after save:', {
                notionApiKey: data.notionApiKey ? '***' : 'missing',
                databaseId: data.databaseId || 'missing',
                typeOptions: data.typeOptions || 'missing',
                defaultSaveThread: data.defaultSaveThread,
                defaultSaveComments: data.defaultSaveComments
            });
            
            if (data.notionApiKey && data.databaseId) {
                showStatus("Configuration saved successfully!", "success");
                updateUIState(data.notionApiKey, data.databaseId);
                
                // 异步同步到Notion数据库（不阻塞UI）
                if (data.typeOptions) {
                    syncDatabaseOptions(data.notionApiKey, data.databaseId, data.typeOptions)
                        .then(() => {
                            showStatus(`Configuration saved and ${data.typeOptions.split(' ').filter(opt => opt.trim()).length} categories synced to Notion!`, "success");
                        })
                        .catch(error => {
                            console.warn('Database sync failed:', error);
                            showStatus("Configuration saved, but failed to sync categories to Notion: " + error.message, "error");
                            updateConfigStatusDisplay(data.notionApiKey, data.databaseId, false);
                        });
                }
            } else {
                showStatus("Failed to save configuration.", "error");
                updateConfigStatusDisplay(data.notionApiKey, data.databaseId);
            }
        });
    });
}

// 同步分类选项到 Notion 数据库
async function syncDatabaseOptions(notionApiKey, databaseId, typeOptions) {
    const cleanDatabaseId = databaseId.replace(/-/g, '');
    
    // 处理空格分隔的类型选项
    const processedOptions = typeOptions.split(' ')
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);
    
    const selectOptions = processedOptions.map(option => ({
        name: option
    }));
    
    const updateData = {
        properties: {
            "Type": {
                type: "multi_select",
                multi_select: {
                    options: selectOptions
                }
            }
        }
    };
    
    const response = await fetch(`https://api.notion.com/v1/databases/${cleanDatabaseId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${notionApiKey}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Notion API error: ${response.status} - ${errorData.message}`);
    }
    
    console.log('Database options synced successfully');
    return await response.json();
}


function editConfiguration() {
    const configSection = document.getElementById("configSection");
    const mainSection = document.getElementById("mainSection");
    const configStatusSection = document.getElementById("configStatusSection");
    const configStatusBar = document.getElementById("configStatusBar");
    const container = document.querySelector('.container');
    
    if (configSection && mainSection && configStatusSection && configStatusBar && container) {
        // 关闭任何可能存在的保存对话框和成功状态
        const existingDialog = document.getElementById('saveDialog');
        const saveSuccessDiv = document.getElementById('saveSuccess');
        if (existingDialog) {
            existingDialog.remove();
        }
        if (saveSuccessDiv) {
            saveSuccessDiv.style.display = 'none';
        }

        // 确保所有输入框都可见
        Array.from(configSection.querySelectorAll('.input-group')).forEach(group => {
            group.style.display = 'flex';
        });

        // 显示配置页面，隐藏主页面和状态栏
        configSection.style.display = 'block';
        mainSection.style.display = 'none';
        configStatusSection.style.display = 'none';
        configStatusBar.style.display = 'none';
        
        // 添加配置模式类，用于隐藏编辑按钮
        container.classList.add('config-mode');
    }
}

/**
 * 主要修改：saveCurrentTweet
 * (重构为支持 Thread 检测)
 */
async function saveCurrentTweet() {
    const { notionApiKey, databaseId, typeOptions, defaultSaveThread, defaultSaveComments } = await chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions", "defaultSaveThread", "defaultSaveComments"]);
    
    console.log('Current storage for save:', {
        notionApiKey: notionApiKey ? '***' : 'missing',
        databaseId: databaseId || 'missing',
        typeOptions: typeOptions || 'missing',
        defaultSaveThread,
        defaultSaveComments
    });
    
    if (!notionApiKey || !databaseId) {
        showStatus("Please save your Notion configuration first.", "error");
        editConfiguration(); // Automatically switch to config view
        return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
        showStatus("Please navigate to a Twitter page first.", "error");
        return;
    }

    try {
        showStatus("Analyzing tweet context...", "success");
        
        const context = await chrome.tabs.sendMessage(tab.id, { action: "getTweetContext" });
        console.log('Tweet context received:', context);
        
        if (!context || !context.mainTweetData) {
            showStatus("Could not extract tweet data. Make sure you're on a tweet page.", "error");
            return;
        }

        const { isThread, threadLength, hasComments, mainTweetData } = context;

        // Show the dialog to allow user to edit title and select types
        const result = await showSaveDialog(
            mainTweetData.name,
            typeOptions ? typeOptions.split(' ').map(opt => opt.trim()).filter(opt => opt.length > 0) : []
        );

        // If user cancelled the dialog
        if (result === null) {
            showStatus("Save cancelled.", "error");
            return;
        }

        const { title: finalTitle, types: selectedTypes } = result;
        
        // Use global settings for shouldSaveThread and shouldSaveComments
        const shouldSaveThread = defaultSaveThread !== undefined ? defaultSaveThread : true;
        const shouldSaveComments = defaultSaveComments !== undefined ? defaultSaveComments : false;

        console.log('Save options confirmed:', { finalTitle, selectedTypes, shouldSaveThread, shouldSaveComments });

        let action;
        let payload;

        if (shouldSaveThread && isThread) {
            showStatus(`Extracting full thread (${threadLength} tweets)...`, "success");
            const fullThreadData = await chrome.tabs.sendMessage(tab.id, { action: "getFullThreadData" });

            if (!fullThreadData || fullThreadData.length === 0) {
                showStatus("Failed to extract full thread data.", "error");
                return;
            }
            action = "saveThreadToNotion";
            payload = {
                thread: fullThreadData,
                title: finalTitle,
                types: selectedTypes,
                notionApiKey,
                databaseId
            };
        } else {
            action = "saveToNotion";
            mainTweetData.name = finalTitle;
            mainTweetData.type = selectedTypes;
            payload = {
                tweet: mainTweetData,
                notionApiKey,
                databaseId
            };
        }

        if (shouldSaveComments && hasComments) {
            showStatus("Extracting comments...", "success");
            let comments = await chrome.tabs.sendMessage(tab.id, { action: "extractCommentsAndChains" });
            
            if (shouldSaveThread && payload.thread && comments) {
                const threadUrls = new Set(payload.thread.map(t => t.url));
                const originalCommentCount = comments.length;
                comments = comments.filter(c => !threadUrls.has(c.url));
                console.log(`Deduplication: Removed ${originalCommentCount - comments.length} thread tweets from comments.`);
            }

            if (comments && comments.length > 0) {
                payload.comments = comments;
                console.log(`Added ${comments.length} comments to the payload.`);
            } else {
                console.log('No comments found or extracted.');
            }
        }
        
        showStatus("Saving to Notion...", "success");
        chrome.runtime.sendMessage({ action, ...payload }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("Error receiving response (popup likely closed):", chrome.runtime.lastError.message);
                return; // The popup was closed before we could respond.
            }
            
            console.log('Save response:', response);
            if (response && response.success) {
                const saveSuccessDiv = document.getElementById('saveSuccess');
                const statusMessageDiv = document.getElementById('statusMessage');
                const configStatusSection = document.getElementById('configStatusSection');
                
                if (saveSuccessDiv) {
                    if (statusMessageDiv) statusMessageDiv.remove();
                    saveSuccessDiv.style.display = 'block';
                    if (configStatusSection) configStatusSection.style.display = 'none';
                    
                    const pageUrl = response.data?.pageUrl;
                    if (pageUrl) {
                        const openInNotionBtn = document.getElementById('openInNotion');
                        if (openInNotionBtn) {
                            openInNotionBtn.replaceWith(openInNotionBtn.cloneNode(true));
                            document.getElementById('openInNotion').addEventListener('click', () => {
                                chrome.tabs.create({ url: pageUrl });
                            });
                        }
                    }
                }
            } else {
                if (response?.error === "该推文已存在于Notion中，请勿重复保存。") {
                    showStatus("该推文已存在于Notion中，请勿重复保存。", "error");
                } else {
                    showStatus("❌ Failed to save to Notion: " + (response?.error || 'Unknown error'), "error");
                }
            }
        });

    } catch (error) {
        console.error('Error in popup:', error);
        showStatus("Error: " + error.message, "error");
    }
}

// (这个函数在你的原始代码中存在，但未被调用，保留它)
// 在popup中显示多选类型选择
function showPopupMultiTypeSelection(typeOptions) {
    return new Promise((resolve) => {
        // 创建多选界面
        const selectionDiv = document.createElement('div');
        selectionDiv.innerHTML = `
            <div style="margin: 10px 0; padding: 15px; background: #f7f9fa; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                <label style="display: block; margin-bottom: 12px; font-weight: 600; font-size: 14px;">Select Categories (Multiple):</label>
                <div id="typeCheckboxes" style="margin-bottom: 15px;">
                    ${typeOptions.map((opt, index) => `
                        <label style="display: block; margin: 8px 0; cursor: pointer;">
                            <input type="checkbox" value="${opt}" id="type${index}" style="margin-right: 8px;">
                            ${opt}
                        </label>
                    `).join('')}
                </div>
                <div style="display: flex; gap: 8px; justify-content: space-between;">
                    <button id="selectAllTypes" style="padding: 6px 12px; background: #e8f5fe; color: #1da1f2; border: 1px solid #1da1f2; border-radius: 4px; cursor: pointer; font-size: 12px;">Select All</button>
                    <button id="clearAllTypes" style="padding: 6px 12px; background: #fef0ef; color: #e0245e; border: 1px solid #e0245e; border-radius: 4px; cursor: pointer; font-size: 12px;">Clear All</button>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 8px;">
                    <button id="confirmType" style="flex: 1; padding: 10px; background: #1da1f2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Confirm</button>
                    <button id="cancelType" style="flex: 1; padding: 10px; background: #cfd9de; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `;
        
        // 插入到主内容区域
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.appendChild(selectionDiv);
        } else {
            const statusDiv = document.getElementById('statusMessage');
            if (statusDiv) {
                statusDiv.parentNode.insertBefore(selectionDiv, statusDiv);
            } else {
                document.querySelector('.container').appendChild(selectionDiv);
            }
        }
        
        // 全选按钮事件
        document.getElementById('selectAllTypes').onclick = () => {
            const checkboxes = selectionDiv.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
        };
        
        // 清除所有按钮事件
        document.getElementById('clearAllTypes').onclick = () => {
            const checkboxes = selectionDiv.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        };
        
        // 确认按钮事件
        document.getElementById('confirmType').onclick = () => {
            const selected = Array.from(selectionDiv.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            selectionDiv.remove();
            resolve(selected);
        };
        
        // 取消按钮事件
        document.getElementById('cancelType').onclick = () => {
            selectionDiv.remove();
            resolve(null);
        };
    });
}

function showStatus(message, type) {
    // 清除之前的计时器
    if (window._statusHideTimeout) {
        clearTimeout(window._statusHideTimeout);
    }
    
    // 移除现有的状态消息
    const existingStatus = document.getElementById('statusMessage');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // 创建新的状态消息
    const statusDiv = document.createElement('div');
    statusDiv.id = 'statusMessage';
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // 插入到消息内容区域
    const messageContainer = document.getElementById('messageContainer');
    if (messageContainer) {
        messageContainer.appendChild(statusDiv);
    } else {
        // Fallback if messageContainer is not found (shouldn't happen if HTML is correct)
        document.querySelector('.container').appendChild(statusDiv);
    }
    
    // 根据消息类型设置不同的显示时间
    if (message.includes("Tweet saved to Notion successfully")) {
        // 推文保存成功的消息显示2秒后移除
        window._statusHideTimeout = setTimeout(() => {
            statusDiv.remove();
        }, 2000);
    } else if (type === 'success') {
        // 其他成功消息显示1.5秒后移除
        window._statusHideTimeout = setTimeout(() => {
            statusDiv.remove();
        }, 1500);
    }
    // 错误消息保持显示，不自动隐藏
}

/**
 * 修改：showSaveDialog，添加 Thread 复选框
 */
function showSaveDialog(defaultTitle, typeOptions) {
    return new Promise((resolve) => {
        // 创建对话框界面
        const selectionDiv = document.createElement('div');
        selectionDiv.id = 'saveDialog';

        selectionDiv.innerHTML = `
                        <div class="card" style="margin: 8px 0px;">
                            <div class="block align-out">
                              <label class="card-title">编辑标题</label>
                              <textarea id="editTitle"
                                style="width: 100%; box-sizing: border-box; min-height: 80px; padding: var(--v-pad) var(--h-pad); border: 1px solid #cfd9de;
                                    border-radius: 6px; font-size: 14px; line-height: 1.5; resize: vertical;
                                    background-color: #fff; font-family: inherit; outline: none;"
                                onfocus="this.style.borderColor='#1da1f2'"
                                onblur="this.style.borderColor='#cfd9de'">${defaultTitle}</textarea>
                            </div>
            
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px; margin-top: 10px;">
                                <div style="flex: 0 0 auto;">
                                    <button id="confirmSave" style="padding: 8px 12px; background: #2563eb; color: white;
                                                               border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                                                               font-size: 13px; transition: all 0.15s; height: 36px; box-shadow: 0 2px 6px rgba(37,99,235,0.12);"
                                            onmouseover="this.style.background='#1d4ed8'"
                                            onmouseout="this.style.background='#2563eb'">
                                        保存到 Notion
                                    </button>
                                </div>
            
                                <div id="selectedTags" style="flex: 1 1 auto; min-height: 36px; padding: 6px 10px;
                                     border: 1px solid #eef2ff; border-radius: 10px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; background: linear-gradient(180deg,#ffffff,#fbfdff);">
                                    <div style="color: #94a3b8; font-size: 12px;" id="selectedTagsPlaceholder">尚未选择标签</div>
                                </div>
                            </div>
            
                            <div class="block align-out">
                              <label class="card-title">选择标签</label>
                              <div id="tagOptions" class="card tight" style="max-height: 200px; overflow-y: auto;">
                                <div id="typeCheckboxes" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">
                                    ${typeOptions.map((opt, index) => `
                                        <label style="display: flex; align-items: center; cursor: pointer; padding: 2px 4px;
                                                   font-size: 12px; white-space: nowrap; overflow: hidden;">
                                            <input type="checkbox" value="${opt}" id="type${index}"
                                                   style="margin-right: 6px; width: 14px; height: 14px;">
                                            <span style="overflow: hidden; text-overflow: ellipsis;">${opt}</span>
                                        </label>
                                    `).join('')}
                                </div>
                              </div>
                            </div>
                        </div>        `;
        
        // 插入到主内容区域
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.appendChild(selectionDiv);
        } else {
            const statusDiv = document.getElementById('statusMessage');
            if (statusDiv) {
                statusDiv.parentNode.insertBefore(selectionDiv, statusDiv);
            } else {
                document.querySelector('.container').appendChild(selectionDiv);
            }
        }
        
        // 标签选择相关功能（简化为网格多选）
        const selectedTags = selectionDiv.querySelector('#selectedTags');
        const selectedTagsPlaceholder = selectionDiv.querySelector('#selectedTagsPlaceholder');
        const checkboxes = selectionDiv.querySelectorAll('#typeCheckboxes input[type="checkbox"]');

        // 更新已选标签显示
        function updateSelectedTags() {
            const checkedTags = Array.from(checkboxes).filter(cb => cb.checked);
            // 清除当前 pills
            selectionDiv.querySelectorAll('.selected-pill').forEach(p => p.remove());

            if (checkedTags.length > 0) {
                selectedTagsPlaceholder.style.display = 'none';
                checkedTags.forEach(cb => {
                    const pill = document.createElement('div');
                    pill.className = 'selected-pill';
                    pill.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; ' +
                                      'background: #e8f5fe; color: #1da1f2; border-radius: 999px; font-size: 12px;';
                    pill.innerHTML = `
                        <span style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cb.value}</span>
                    `;
                    // 不再通过 pill 上的 × 来移除，用户可以在网格中取消勾选
                    selectedTags.insertBefore(pill, selectedTagsPlaceholder);
                });
            } else {
                selectedTagsPlaceholder.style.display = 'block';
            }
        }

        // 绑定 checkbox change 事件
        checkboxes.forEach(checkbox => checkbox.addEventListener('change', updateSelectedTags));

        // 确认按钮事件
        document.getElementById('confirmSave').onclick = () => {
            const selectedTypes = Array.from(selectionDiv.querySelectorAll('#typeCheckboxes input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            const editedTitle = document.getElementById('editTitle').value.trim();
            
            selectionDiv.remove();
            
            resolve({
                title: editedTitle || defaultTitle,
                types: selectedTypes
            });
        };
        
        // 点击对话框外部关闭
        document.addEventListener('click', (e) => {
            const dialog = document.getElementById('saveDialog');
            if (dialog && !dialog.contains(e.target)) {
                dialog.remove();
                resolve(null);
            }
        });
    });
}