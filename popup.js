// popup.js - 修复 typeOptions 保存和同步问题
document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup loaded');
    
    // 加载保存的配置
    loadConfiguration();
    
    // 保存配置按钮
    document.getElementById("saveConfigBtn").addEventListener("click", saveConfiguration);
    
    // 保存推文按钮
    document.getElementById("saveBtn").addEventListener("click", saveCurrentTweet);
    
    // 编辑配置按钮
    document.getElementById("editConfigBtn").addEventListener("click", editConfiguration);
});

function loadConfiguration() {
    chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions"], (data) => {
        console.log('Loaded config from storage:', {
            hasApiKey: !!data.notionApiKey,
            hasDatabaseId: !!data.databaseId,
            hasTypeOptions: !!data.typeOptions,
            typeOptionsValue: data.typeOptions
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
        
        // 更新按钮状态
        updateUIState(data.notionApiKey, data.databaseId);
    });
}

function updateUIState(apiKey, databaseId) {
    const saveBtn = document.getElementById("saveBtn");
    const configSection = document.getElementById("configSection");
    const mainSection = document.getElementById("mainSection");
    
    if (apiKey && databaseId) {
        // 有配置：启用保存按钮，显示主界面
        saveBtn.disabled = false;
        if (configSection && mainSection) {
            configSection.style.display = 'none';
            mainSection.style.display = 'block';
        }
        showStatus("Configuration loaded! Ready to save tweets.", "success");
    } else {
        // 无配置：禁用保存按钮，显示配置界面
        saveBtn.disabled = true;
        if (configSection && mainSection) {
            configSection.style.display = 'block';
            mainSection.style.display = 'none';
        }
        showStatus("Please configure your Notion API settings first.", "error");
    }
}

function saveConfiguration() {
    const notionApiKey = document.getElementById("notionApiKey").value.trim();
    const databaseId = document.getElementById("databaseId").value.trim();
    const typeOptions = document.getElementById("typeOptions").value.trim();

    console.log('Saving configuration:', {
        notionApiKey: notionApiKey ? '***' : 'empty',
        databaseId: databaseId || 'empty',
        typeOptions: typeOptions || 'empty'
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
        typeOptions: typeOptions // 存储原始多行文本
    }, () => {
        // 验证配置是否保存成功
        chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions"], (data) => {
            console.log('Verified storage after save:', {
                notionApiKey: data.notionApiKey ? '***' : 'missing',
                databaseId: data.databaseId || 'missing',
                typeOptions: data.typeOptions || 'missing'
            });
            
            if (data.notionApiKey && data.databaseId) {
                showStatus("Configuration saved successfully!", "success");
                updateUIState(data.notionApiKey, data.databaseId);
                
                // 异步同步到Notion数据库（不阻塞UI）
                if (data.typeOptions) {
                    syncDatabaseOptions(data.notionApiKey, data.databaseId, data.typeOptions)
                        .then(() => {
                            showStatus(`Configuration saved and ${data.typeOptions.split('\n').filter(opt => opt.trim()).length} categories synced to Notion!`, "success");
                        })
                        .catch(error => {
                            console.warn('Database sync failed:', error);
                            showStatus("Configuration saved, but failed to sync categories to Notion: " + error.message, "error");
                        });
                }
            } else {
                showStatus("Failed to save configuration.", "error");
            }
        });
    });
}

// 同步分类选项到 Notion 数据库
async function syncDatabaseOptions(notionApiKey, databaseId, typeOptions) {
    const cleanDatabaseId = databaseId.replace(/-/g, '');
    
    // 处理多行类型选项
    const processedOptions = typeOptions.split('\n')
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
    
    if (configSection && mainSection) {
        configSection.style.display = 'block';
        mainSection.style.display = 'none';
    }
}

// popup.js - 修改类型选择为多选
async function saveCurrentTweet() {
    const { notionApiKey, databaseId, typeOptions } = await chrome.storage.local.get(["notionApiKey", "databaseId", "typeOptions"]);
    
    console.log('Current storage for save:', {
        notionApiKey: notionApiKey ? '***' : 'missing',
        databaseId: databaseId || 'missing',
        typeOptions: typeOptions || 'missing'
    });
    
    if (!notionApiKey || !databaseId) {
        showStatus("Please save your Notion configuration first.", "error");
        return;
    }

    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab:', tab);
    
    if (!tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
        showStatus("Please navigate to a Twitter page first.", "error");
        return;
    }

    try {
        showStatus("Extracting tweet data...", "success");
        
        // 发送消息到内容脚本获取推文数据
        const tweetData = await chrome.tabs.sendMessage(tab.id, { action: "extractTweetData" });
        console.log('Tweet data extracted:', tweetData);
        
        if (!tweetData) {
            showStatus("Could not extract tweet data. Make sure you're on a tweet page.", "error");
            return;
        }

        // 检查文本长度并给出警告（但不阻止保存）
        if (tweetData.fullContent && tweetData.fullContent.length > 2000) {
            showStatus("Warning: Tweet content is long and will be truncated in Notion.", "error");
            // 不返回，继续保存流程
        }

        // 处理类型选择 - 改为多选
        let selectedTypes = [];
        if (typeOptions) {
            const typeOptionsArray = typeOptions.split('\n')
                .map(opt => opt.trim())
                .filter(opt => opt.length > 0);
            
            if (typeOptionsArray.length > 0) {
                // 在popup中显示多选类型选择
                selectedTypes = await showPopupMultiTypeSelection(typeOptionsArray);
                if (selectedTypes === null) {
                    showStatus("Save cancelled.", "error");
                    return;
                }
            }
        }
        
        console.log('Selected types:', selectedTypes);
        
        // 更新推文数据的类型为数组
        tweetData.type = selectedTypes;
        console.log('Final tweet data with types:', tweetData);

        // 发送到background.js保存
        chrome.runtime.sendMessage({
            action: "saveToNotion",
            tweet: tweetData,
            notionApiKey: notionApiKey,
            databaseId: databaseId
        }, (response) => {
            console.log('Save response:', response);
            if (response && response.success) {
                showStatus("✅ Tweet saved to Notion successfully!", "success");
            } else {
                showStatus("❌ Failed to save tweet to Notion: " + (response?.error || 'Unknown error'), "error");
            }
        });

    } catch (error) {
        console.error('Error in popup:', error);
        showStatus("Error: " + error.message, "error");
    }
}

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
        
        // 插入到状态消息前面
        const statusDiv = document.getElementById('statusMessage');
        statusDiv.parentNode.insertBefore(selectionDiv, statusDiv);
        
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
    let statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'statusMessage';
        document.querySelector('.container').appendChild(statusDiv);
    }
    
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // 自动隐藏成功消息
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}