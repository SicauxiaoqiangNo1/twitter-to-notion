<!--
 * @Author: stark sicauva3@gmail.com
 * @Date: 2025-11-01 21:40:00
 * @LastEditors: stark sicauva3@gmail.com
 * @LastEditTime: 2025-11-02 22:10:57
 * @FilePath: \X2Notion\README_CN.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
# 🐦 Twitter to Notion

 [English](README.md)|**中文** 

一键将 Twitter 推文、图片和引用内容保存到 Notion 的 Chrome 扩展。

---

## ✨ 功能亮点

- 📥 **一键保存** - 快速将推文保存到 Notion 数据库
- 🖼️ **媒体支持** - 完整保存图片、视频和引用推文
- 🏷️ **智能分类** - 支持多选自定义标签分类
- 📊 **数据统计** - 自动记录点赞、转推、评论数量
- 🕒 **时间标记** - 记录推文发布时间和保存时间
- 📝 **内容完整** - 长文本自动分块，确保内容不丢失
- ✅ **配置状态** - 实时显示配置有效性，支持点击验证

---

## 🚀 快速开始

### ① 安装扩展

1. 下载最新的 [`twitter-to-notion.zip`](https://github.com/SicauxiaoqiangNo1/twitter-to-notion-extension/releases)
2. 打开 Chrome → 扩展程序 → 开启"开发者模式"
3. 点击"加载已解压的扩展程序"并选择扩展文件夹

### ② 设置 Notion 数据库

👉 [复制 Notion 模板数据库](https://bytebit.notion.site/Template-Twitter-to-Notion-database-29e5b64bde9a805bb305ea6a1b471193)
（打开链接后点击右上角 **Duplicate** 复制到你的工作区）

### ③ 配置凭据

1. 点击扩展图标，输入 **Database ID** 和 **API Key**
2. 打开任意推文页面，点击「💾 保存到 Notion」按钮
3. 选择分类标签，完成保存！

### 🔍 如何获取配置信息？

**Database ID**
- 获取方式：从你的 Notion 数据库页面 URL 中提取 32 位字符串
- 参考图示：[官方获取指南](https://developers.notion.com/docs/getting-started#step-3-save-the-database-id)

**API Key**
- 获取方式：在 [Notion 集成平台](https://www.notion.so/my-integrations) 创建新集成后生成
- 格式：`secret_xxxxxxxxxxxxxxxxxxxxxxxx`

📚 完整配置教程：[Notion API 入门指南](https://developers.notion.com/docs/getting-started)

### 🔧 配置状态栏功能

扩展现在提供了智能的配置状态显示：

- **✅ 绿色状态**：配置正确且有效
- **❌ 红色状态**：配置错误或无效
- **点击验证**：点击状态栏可重新验证配置有效性

**状态说明**：
- 绿色✅：API Key 和 Database ID 正确，可以正常保存推文
- 红色❌：配置存在问题，需要检查 API Key 权限或 Database ID 是否正确

这个功能帮助你快速确认配置是否有效，避免保存失败。

---

## 📸 效果预览

| 配置界面                          | 保存按钮                             | Notion 效果                              |
| --------------------------------- | ------------------------------------ | ---------------------------------------- |
| ![config](screenshots/config.png) | ![save](screenshots/save-button.png) | ![result](screenshots/notion-result.png) |

---

## 📁 项目结构

```
twitter-to-notion-extension/
├── manifest.json # 扩展配置文件
├── background.js # 后台脚本
├── content.js # 内容脚本
├── popup.html # 弹出窗口界面
├── popup.js # 弹出窗口逻辑
├── icons/ # 扩展图标
├── README.md # 说明文档
└── .gitignore # Git忽略配置
```

---

## 📄 开源协议

MIT License - 可自由使用、修改和分发

---

## 👨‍💻 作者信息

- GitHub: [@SicauxiaoqiangNo1](https://github.com/SicauxiaoqiangNo1)
- Twitter: [@sicauman](https://x.com/sicauman)

---

## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！