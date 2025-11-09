<!--
 * @Author: stark sicauva3@gmail.com
 * @Date: 2025-11-01 21:40:00
 * @LastEditors: stark sicauva3@gmail.com
 * @LastEditTime: 2025-11-09 22:27:12
 * @FilePath: \X2Notion\README_CN.md
 * @Description: Twitter to Notion Chrome 扩展中文说明文档，支持推文、Thread 和评论保存到 Notion
-->
# 🐦 Twitter to Notion

 [English](README.md)|**中文** 

一键将 Twitter 推文、图片和引用内容保存到 Notion 的 Chrome 扩展。

---

## ✨ 功能亮点

- 📥 **一键保存** - 快速将推文保存到 Notion 数据库
- 🧵 **Thread 支持** - 智能检测并保存完整的推文线程
- 💬 **评论提取** - 自动提取评论和对话链
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
2. **新增分类标签**：在配置页面输入自定义分类（用空格分隔，如：交易 DeFi 新闻 教育）
3. 点击「💾 保存到 Notion」按钮
4. 在保存对话框中选择分类标签，完成保存！

### 🧵 Thread 和评论功能

**Thread 检测与保存**：
- 扩展会自动检测当前页面是否为推文线程
- 如果检测到 Thread，保存对话框会显示"保存整个线程"选项
- 勾选后可一次性保存完整的推文线程到单个 Notion 页面

**评论提取**：
- 支持提取推文下的评论和对话链
- 自动识别博主回复并高亮显示
- 评论区会添加到推文或 Thread 内容之后

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

| 配置界面                          | 保存对话框                           | Notion 效果                              |
| --------------------------------- | ------------------------------------ | ---------------------------------------- |
| ![config](screenshots/config.png) | ![save](screenshots/save-button.png) | ![result](screenshots/notion-result.png) |

### 📋 保存对话框功能

**标题编辑**：
- 可编辑保存到 Notion 的标题
- 支持 Ctrl+Enter 快捷提交

**分类选择**：
- 支持多选标签分类
- 实时显示已选择的标签

**Thread 选项**：
- 自动检测线程长度
- 勾选后保存完整的推文线程

**评论选项**：
- 提取推文下的评论和对话链
- 自动去重，避免重复保存

---

## 📁 项目结构

```
twitter-to-notion-extension/
├── manifest.json     # 扩展配置文件
├── background.js     # 后台脚本（处理 API 请求）
├── content.js        # 内容脚本（数据提取）
├── popup.html        # 弹出窗口界面
├── popup.js          # 弹出窗口逻辑
├── icons/            # 扩展图标
├── screenshots/      # 效果截图
├── README.md         # 说明文档
└── .gitignore        # Git忽略配置
```

### 🔧 核心功能模块

**数据提取模块** ([`content.js`](content.js))：
- 推文内容和媒体提取
- Thread 检测和线程数据获取
- 评论和对话链提取
- 引用推文处理

**保存处理模块** ([`background.js`](background.js))：
- Notion API 集成
- Thread 保存逻辑
- 评论区构建
- 数据分块处理

**用户界面模块** ([`popup.js`](popup.js))：
- 配置管理
- 保存对话框
- 分类选择
- 状态验证

---

## 🔬 高级功能

### Thread 智能检测
- **自动识别**：基于作者 Handle 的连续推文检测
- **智能过滤**：自动跳过广告推文和不同作者的内容
- **线程长度**：准确计算连续推文数量
- **一键保存**：将整个 Thread 保存到单个 Notion 页面

### 评论智能提取
- **对话链识别**：自动识别连续的对话回复
- **博主高亮**：博主回复自动使用蓝色高亮显示
- **去重处理**：避免 Thread 和评论内容重复
- **结构化存储**：保持评论的原始层级关系

### 富文本支持
- **格式保留**：保留推文中的粗体、斜体等格式
- **链接处理**：完整保留推文中的链接信息
- **emoji 转换**：智能识别并转换 emoji 图片为文本
- **媒体嵌入**：完美支持图片、视频的 Notion 嵌入

### 数据完整性
- **分块处理**：长文本自动分块，确保内容不丢失
- **引用推文**：支持嵌入和链接两种引用推文显示方式
- **统计信息**：完整保存点赞、转推、评论数
- **时间戳**：记录推文发布时间和保存时间

---

## 📄 开源协议

MIT License - 可自由使用、修改和分发

---

## 👨‍💻 作者信息

- GitHub: [@SicauxiaoqiangNo1](https://github.com/SicauxiaoqiangNo1)
- Twitter: [@sicauman](https://x.com/sicauman)

---

## 📋 版本更新

### v2.1 (2025-11-09)
- ✨ 新增 Thread 智能检测与保存功能
- 💬 新增评论和对话链提取
- 🏷️ 新增自定义分类标签支持
- 🎨 重构保存对话框界面，支持标题编辑
- 🔧 增强配置状态验证功能
- 🚀 优化数据提取和处理逻辑

### v1.0 (2025-11-02)
- 🐦 初始版本发布
- 📥 基础推文保存功能
- 🖼️ 媒体内容支持
- 📊 数据统计记录

---

## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！

### 🐛 问题报告

如果遇到问题，请提供以下信息：
- 浏览器版本和扩展版本
- 具体的错误描述和截图
- 操作步骤和重现方法
- 相关的错误日志（可在扩展开发工具中查看）

### 💡 功能建议

欢迎提出新功能建议或改进建议！

---

## ❓ 常见问题

### Q: 如何处理长文本内容？
A: 扩展会自动将长文本分块处理，确保内容完整保存到 Notion，每块最大 2000 字符。

### Q: Thread 和评论会重复保存吗？
A: 不会，扩展内置去重逻辑，如果同时保存 Thread 和评论，会自动移除重复的推文内容。

### Q: 支持保存哪些类型的媒体？
A: 支持图片、视频和引用推文。图片会以嵌入形式显示，视频会保存为链接。

### Q: 分类标签有什么限制？
A: 标签之间用空格分隔，建议使用简短有意义的词汇，如：技术 教程 新闻。

### Q: 如何验证配置是否正确？
A: 配置保存后会自动验证，也可以点击配置状态栏重新验证，绿色表示配置正确。

### Q: 保存失败怎么办？
A: 检查 API Key 权限和 Database ID 是否正确，确保 Notion 集成有数据库编辑权限。