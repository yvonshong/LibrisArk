# LibrisArk 产品设计方案 (Optimized)

## 1. 产品愿景
**LibrisArk** 是一款面向科研人员的**本地优先 (Local-First)**、**AI 增强 (AI-Enhanced)** 的桌面端文献管理工具。它旨在解决传统文献管理软件（如 Zotero, Mendeley）在 AI 整合、本地文件灵活管理及隐私保护方面的痛点，提供流畅的阅读体验和智能化的知识提取功能。

## 2. 技术栈架构 (Tech Stack)
*   **核心框架**: Tauri (Rust) - 保证高性能、低内存占用及原生系统交互能力。
*   **前端界面**: React + TypeScript + TailwindCSS + Shadcn/UI - 构建现代化、响应迅速的用户界面。
*   **数据存储**: SQLite (本地关系型数据库) + SQLite-vec (或 LanceDB，用于本地向量检索)。
*   **PDF 引擎**: Mozilla PDF.js (前端渲染) + Rust PDF libraries (后端元数据提取/文本解析)。
*   **AI 编排**: LangChain.js (或自定义 Rust AI 模块) 对接 OpenAI API / google gemini，claude code。
*   **系统支持**: 支持 Windows, macOS, Linux。

## 3. 核心功能模块 (Detailed Features)

### 3.1 智能书库管理 (Smart Library)
*   **数据监听**: 支持用户添加一个“监听文件夹”，作为项目总文件夹。软件自动监控这个文件夹下面的文件变动（新增/删除/移动），保持数据库与文件系统实时同步。
*   **文件指纹**: 使用 SHA-256 算法对文件进行去重识别，并且考虑文章的内容。即使文件名不同，内容相同的文件也不会重复入库。
*   **虚拟集合**: 除了物理文件夹视图，支持基于标签、作者、年份的“虚拟集合”视图。

### 3.2 元数据引擎 (Metadata Engine)
*   **自动化 DOI 识别**:
    *   **层级 1**: 尝试从 PDF 文本中正则匹配 DOI。如果没有，则调用ai来识别。
    *   **层级 2**: 提取 PDF 首页标题，通过 Semantic Scholar / CrossRef API 反向查找 DOI。
    *   **层级 3**: 如果存在 DOI，自动拉取标准元数据（标题、标准作者名、发表年份、期刊、摘要）。
*   **手动/半自动修正**: 允许用户手动编辑元数据，或输入 DOI 一键更新。

### 3.3 云同步策略 (Cloud Sync)
*   **数据分离存储**: 将“数据库文件 (.db)”与“源文件 (PDFs)”分离设计。
*   **网盘友好型架构**:
    *   推荐用户将“书库根目录”设置在 Dropbox/OneDrive/Google Drive 的本地同步文件夹中。
    *   应用支持“相对路径”索引，确保多端（不同电脑）同步时，只要相对结构不变，数据库依然有效。
*   **数据库备份**: 提供定期自动备份数据库到云同步目录的功能，防止数据库损坏。

### 3.4 AI 核心 (AI Core) & LLM 集成
*   **BYOK (Bring Your Own Key)**: 设置面板支持输入 OpenAI, Anthropic, Gemini 等主流大模型 API Key，并通过系统钥匙串 (Generate/Keychain) 安全存储。
*   **模型路由**: 允许用户为不同任务选择不同模型（例如：用 gpt-3.5-turbo 做简单重命名，用 claude-3-opus 做深度这论文分析）。

### 3.5 智能处理流 (Intelligent Processing)
*   **后台摄取队列**: 文件导入后，后台自动执行：文本提取 -> 元数据补全 -> AI 预处理。
*   **AI 自动标签**: 根据摘要和全文内容，AI 自动生成 3-5 个内容标签（如 "Deep Learning", "Transformer", "Review"）。
*   **智能摘要**: 生成“一句话总结”和“结构化摘要”（背景、方法、结果、结论），存入数据库，鼠标悬停封面即可预览。

### 3.6 沉浸式 AI 阅读器 (Interactive Reader)
*   **侧边栏 Copilot**: 阅读界面右侧集成 Chat 窗口。
    *   **RAG (检索增强生成)**: 用户提问时，系统检索当前 PDF 的相关段落作为上下文发送给 LLM，确保回答准确基于文档。
    *   **划词询问**: 选中 PDF 中的一段文字/公式，弹出浮窗：“解释这段代码”、“翻译”、“概括核心观点”。
    *   **笔记整合**: AI 的回答可以一键保存为“笔记/标注”，附在 PDF 对应位置。

### 3.7 智能重命名 (Smart Rename)
*   **动态模版**: 支持用户自定义重命名规则，支持变量：`{Author}` `{Year}` `{Title}` `{Journal}`。
    *   *默认*: `{Author}_{Year}_{Title}.pdf` (自动处理文件名中的非法字符，截断过长标题)。
*   **批量操作**: 支持选中多个文件进行批量重命名预览，确认后执行。

## 4. 数据流向设计 (Data Flow)
1.  **Input**: 用户放入 PDF -> 文件监听器触发。
2.  **Process**:
    *   Rust 后端计算 Hash，检查是否已存在。也检查doi或者标题是否已存在。
    *   解析 PDF 文本，提取 DOI。
    *   HTTP 请求元数据 API。
3.  **Storage**: 写入 SQLite 数据库 (`papers`, `authors`, `tags` 表)。
4.  **View**: React 前端从 SQLite 读取数据渲染列表。
5.  **Sync**: 用户网盘客户端自动同步变动的文件和数据库。

## 5. UI/UX 核心原则
*   **科研专注**: 界面保持极简，阅读模式下隐藏无关 UI。
*   **黑暗模式**: 原生支持深色模式，不仅是 UI，PDF 阅读器也支持“反色/护眼模式”。
*   **键盘优先**: 支持 Vim 风格或常用快捷键进行文献切换、翻页、标记。
