# 🐦 Twitter to Notion

[中文](README_CN.md) | **English**

A Chrome extension to save Twitter tweets, images, and quoted content directly to Notion with one click.

---

## ✨ Key Features

- 📥 **One-Click Save** - Quickly save tweets to Notion database
- 🖼️ **Media Support** - Fully save images, videos, and quoted tweets
- 🏷️ **Smart Categorization** - Support multiple custom tags
- 📊 **Data Analytics** - Automatically record likes, retweets, and comment counts
- 🕒 **Time Tracking** - Record both tweet publication and save timestamps
- 📝 **Content Integrity** - Long texts automatically chunked to ensure no content loss

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
2. Open any tweet page and click the "💾 Save to Notion" button
3. Select categories and complete the save!

### 🔍 How to Get Configuration?

**Database ID**
- How to get: Extract the 32-character string from your Notion database page URL
- Visual guide: [Official Documentation](https://developers.notion.com/docs/getting-started#step-3-save-the-database-id)

**API Key**
- How to get: Create a new integration at [Notion Integrations](https://www.notion.so/my-integrations)
- Format: `secret_xxxxxxxxxxxxxxxxxxxxxxxx`

📚 Complete setup guide: [Notion API Getting Started](https://developers.notion.com/docs/getting-started)

---

## 📸 Preview

| Configuration | Save Button | Notion Result |
|---------------|-------------|---------------|
| ![config](screenshots/config.png) | ![save](screenshots/save-button.png) | ![result](C:\Users\Stark\Desktop\X2Notion\README.assets\notion-result-1761999665016-7.png) |
---

## 📁 Project Structure
```
twitter-to-notion-extension/
├── manifest.json # Extension configuration
├── background.js # Background script
├── content.js # Content script
├── popup.html # Popup interface
├── popup.js # Popup logic
├── icons/ # Extension icons
├── README.md # Documentation
└── .gitignore # Git ignore file
```

---

## 📄 License

MIT License - Free to use, modify, and distribute

---

## 👨‍💻 Author

- GitHub: [@SicauxiaoqiangNo1](https://github.com/SicauxiaoqiangNo1)
- Twitter: [@sicauman](https://x.com/sicauman)

---

## 🤝 Contributing

Issues and Pull Requests are welcome!
