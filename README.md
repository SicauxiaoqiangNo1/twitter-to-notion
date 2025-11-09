<!--
 * @Author: stark sicauva3@gmail.com
 * @Date: 2025-11-01 21:40:00
 * @LastEditors: stark sicauva3@gmail.com
 * @LastEditTime: 2025-11-09 22:27:23
 * @FilePath: \X2Notion\README.md
 * @Description: Twitter to Notion Chrome extension English documentation with support for tweets, threads, and comments
-->

# 🐦 Twitter to Notion

[中文](README_CN.md) | **English**

A Chrome extension to save Twitter tweets, images, and quoted content directly to Notion with one click.

---

## ✨ Key Features

- 📥 **One-Click Save** - Quickly save tweets to Notion database
- 🧵 **Thread Support** - Smart detection and save complete tweet threads
- 💬 **Comment Extraction** - Automatically extract comments and conversation chains
- 🖼️ **Media Support** - Fully save images, videos, and quoted tweets
- 🏷️ **Smart Categorization** - Support multiple custom tags
- 📊 **Data Analytics** - Automatically record likes, retweets, and comment counts
- 🕒 **Time Tracking** - Record both tweet publication and save timestamps
- 📝 **Content Integrity** - Long texts automatically chunked to ensure no content loss
- ✅ **Configuration Status** - Real-time configuration validation with click-to-verify

---

## 🚀 Quick Start

### ① Install Extension

1. Download the latest [`twitter-to-notion.zip`](https://github.com/SicauxiaoqiangNo1/twitter-to-notion-extension/releases)
2. Open Chrome → Extensions → Enable "Developer mode"
3. Click "Load unpacked" and select the extension folder

### ② Setup Notion Database

👉 [Duplicate Notion Template Database](https://bytebit.notion.site/Template-Twitter-to-Notion-database-29e5b64bde9a805bb305ea6a1b471193)
(Open the link and click **Duplicate** in the top right to copy to your workspace)

### ③ Configure Credentials

1. Click the extension icon and enter your **Database ID** and **API Key**
2. **Add custom categories**: Input space-separated categories (e.g., trading DeFi news education)
3. Click the "💾 Save to Notion" button
4. Select categories in the save dialog and complete the save!

### 🧵 Thread and Comments Features

**Thread Detection & Save**:

- Extension automatically detects tweet threads on the current page
- If a thread is detected, the save dialog shows a "Save entire thread" option
- Check to save the complete thread to a single Notion page

**Comment Extraction**:

- Supports extracting comments and conversation chains
- Automatically identifies and highlights author replies
- Comments section is added after the main tweet/thread content

### 🔍 How to Get Configuration?

**Database ID**

- How to get: Extract the 32-character string from your Notion database page URL
- Visual guide: [Official Documentation](https://developers.notion.com/docs/getting-started#step-3-save-the-database-id)

**API Key**

- How to get: Create a new integration at [Notion Integrations](https://www.notion.so/my-integrations)
- Format: `secret_xxxxxxxxxxxxxxxxxxxxxxxx`

📚 Complete setup guide: [Notion API Getting Started](https://developers.notion.com/docs/getting-started)

### 🔧 Configuration Status Bar

The extension now provides intelligent configuration status display:

- **✅ Green Status**: Configuration is correct and valid
- **❌ Red Status**: Configuration is incorrect or invalid
- **Click to Verify**: Click the status bar to re-validate configuration

**Status Explanation**:

- Green✅: API Key and Database ID are correct, tweets can be saved normally
- Red❌: Configuration has issues, check API Key permissions or Database ID

This feature helps you quickly confirm if your configuration is working properly and avoid save failures.

---

## 📸 Preview

| Configuration                   | Save Dialog                        | Notion Result                          |
| ------------------------------- | ---------------------------------- | -------------------------------------- |
| ![config](screenshots/config.png) | ![save](screenshots/save-button.png) | ![result](screenshots/notion-result.png) |

### 📋 Save Dialog Features

**Title Editing**:

- Editable title for Notion page
- Support Ctrl+Enter for quick submission

**Category Selection**:

- Multiple tag selection support
- Real-time display of selected tags

**Thread Option**:

- Automatic thread length detection
- Check to save complete tweet thread

**Comments Option**:

- Extract comments and conversation chains
- Automatic deduplication to avoid duplicates

---

## 📁 Project Structure

```
twitter-to-notion-extension/
├── manifest.json     # Extension configuration
├── background.js     # Background script (API handling)
├── content.js        # Content script (data extraction)
├── popup.html        # Popup interface
├── popup.js          # Popup logic
├── icons/            # Extension icons
├── screenshots/      # Preview screenshots
├── README.md         # Documentation
└── .gitignore        # Git ignore file
```

### 🔧 Core Modules

**Data Extraction Module** ([`content.js`](content.js)):

- Tweet content and media extraction
- Thread detection and data collection
- Comment and conversation chain extraction
- Quoted tweet processing

**Save Processing Module** ([`background.js`](background.js)):

- Notion API integration
- Thread saving logic
- Comments section building
- Data chunking processing

**User Interface Module** ([`popup.js`](popup.js)):

- Configuration management
- Save dialog handling
- Category selection
- Status validation

---

## 🔬 Advanced Features

### Thread Smart Detection

- **Auto Recognition**: Continuous tweet detection based on author Handle
- **Smart Filtering**: Automatically skip ads and different author content
- **Thread Length**: Accurately calculate consecutive tweet count
- **One-Click Save**: Save entire Thread to a single Notion page

### Comment Smart Extraction

- **Conversation Chain**: Automatically identify continuous reply threads
- **Author Highlight**: Author replies automatically highlighted in blue
- **Deduplication**: Avoid Thread and comment content duplication
- **Structured Storage**: Maintain original comment hierarchy

### Rich Text Support

- **Format Preservation**: Retain bold, italic, and other formats from tweets
- **Link Handling**: Complete retention of link information in tweets
- **Emoji Conversion**: Smart identification and conversion of emoji images to text
- **Media Embedding**: Perfect support for image and video embedding in Notion

### Data Integrity

- **Chunk Processing**: Long text automatically chunked to ensure no content loss
- **Quoted Tweets**: Support both embed and link display for quoted tweets
- **Statistics**: Complete preservation of likes, retweets, and comment counts
- **Timestamps**: Record both tweet publication and save timestamps

---

## 📄 License

MIT License - Free to use, modify, and distribute

---

## 👨‍💻 Author

- GitHub: [@SicauxiaoqiangNo1](https://github.com/SicauxiaoqiangNo1)
- Twitter: [@sicauman](https://x.com/sicauman)

---

## 📋 Version Updates

### v2.1 (2025-11-09)

- ✨ Added Thread smart detection and save functionality
- 💬 Added comment and conversation chain extraction
- 🏷️ Added custom category tags support
- 🎨 Refactored save dialog interface with title editing
- 🔧 Enhanced configuration status validation
- 🚀 Optimized data extraction and processing logic

### v1.0 (2025-11-02)

- 🐦 Initial release
- 📥 Basic tweet saving functionality
- 🖼️ Media content support
- 📊 Data statistics recording

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

### 🐛 Issue Reporting

If you encounter problems, please provide the following information:

- Browser version and extension version
- Specific error description and screenshots
- Steps to reproduce the issue
- Relevant error logs (available in extension developer tools)

### 💡 Feature Suggestions

We welcome new feature suggestions and improvements!

---

## ❓ Frequently Asked Questions

### Q: How is long text content handled?

A: The extension automatically chunks long text to ensure complete saving to Notion, with a maximum of 2000 characters per chunk.

### Q: Will Thread and comments be duplicated?

A: No, the extension has built-in deduplication logic. If both Thread and comments are saved, duplicate tweets will be automatically removed.

### Q: What types of media are supported?

A: Supports images, videos, and quoted tweets. Images are displayed as embedded content, videos are saved as links.

### Q: Any limitations on category tags?

A: Tags are separated by spaces. We recommend using short, meaningful words like: tech tutorial news.

### Q: How to verify if configuration is correct?

A: Configuration is automatically validated after saving. You can also click the configuration status bar to re-validate. Green indicates correct configuration.

### Q: What to do if saving fails?

A: Check if the API Key permissions and Database ID are correct, and ensure the Notion integration has database edit permissions.
