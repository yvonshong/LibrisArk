# LibrisArk 数据库表结构

以下是基于 `src-tauri/src/db.rs` 初始化脚本提取的当前 LibrisArk SQLite 数据库表结构及详细中文解释。

## `papers` (核心文献表)
用于存储导入文献的所有核心元数据。
```sql
CREATE TABLE papers (
    id TEXT PRIMARY KEY,                 -- 文献的唯一 ID (通常是 UUID)
    path TEXT NOT NULL UNIQUE,           -- PDF 文件的绝对或相对路径 (唯一)
    title TEXT,                          -- 文献标题
    abstract TEXT,                       -- 文献摘要
    publish_year INTEGER,                -- 发表年份
    journal TEXT,                        -- 发表期刊/会议名称
    doi TEXT,                            -- 文献的 DOI 标识符
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 记录创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 记录最后更新时间
    
    -- 以下字段是在版本迭代中通过数据迁移(Migration)动态添加的：
    one_sentence_summary TEXT,           -- AI 生成的一句话总结
    structured_summary TEXT,             -- AI 生成的结构化长摘要
    file_size INTEGER,                   -- PDF 文件大小 (字节)
    modified_at INTEGER,                 -- PDF 文件的最后修改时间 (Unix时间戳)
    file_hash TEXT                       -- 文件的哈希值 (用于唯一性检测)
);
```
**索引**:
- `idx_papers_file_hash`: 用于通过 `file_hash` 快速检索文献以防止重复导入。

---

## `authors` (作者表)
存储所有文献的唯一作者姓名，避免冗余。
```sql
CREATE TABLE authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 作者 ID (自增)
    name TEXT NOT NULL UNIQUE             -- 作者姓名 (唯一)
);
```

---

## `paper_authors` (文献-作者关联表)
多对多 (Many-to-Many) 关系表，用于关联 `papers` 和 `authors`。
```sql
CREATE TABLE paper_authors (
    paper_id TEXT NOT NULL,               -- 关联的文献 ID
    author_id INTEGER NOT NULL,           -- 关联的作者 ID
    PRIMARY KEY (paper_id, author_id),    -- 联合主键
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,   -- 级联删除: 文献删除时关联自动删除
    FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE  -- 级联删除: 作者删除时关联自动删除
);
```

---

## `tags` (标签表)
存储用户自定义的分类标签。
```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 标签 ID (自增)
    name TEXT NOT NULL UNIQUE             -- 标签名称 (唯一)
);
```

---

## `paper_tags` (文献-标签关联表)
多对多关联表，用于将标签打在特定的文献上。
```sql
CREATE TABLE paper_tags (
    paper_id TEXT NOT NULL,               -- 关联的文献 ID
    tag_id INTEGER NOT NULL,              -- 关联的标签 ID
    PRIMARY KEY (paper_id, tag_id),       -- 联合主键
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

---

## `paper_chunks` (文献文本分块表)
存储从 PDF 中提取并分块的文本，主要用于本地的全文检索和 AI 问答上下文。
```sql
CREATE TABLE paper_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 文本块 ID
    paper_id TEXT NOT NULL,               -- 归属的文献 ID
    chunk_index INTEGER NOT NULL,         -- 文本块的顺序索引 (第几块)
    content TEXT NOT NULL,                -- 提取的文本内容
    UNIQUE(paper_id, chunk_index),        -- 确保同一文献下的索引不重复
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);
```
**索引**:
- `idx_paper_chunks_paper_id`: 加速拉取某篇文献的所有文本块。

---

## `notes` (笔记表)
存储用户在特定文献下记录的个人笔记。
```sql
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 笔记 ID
    paper_id TEXT NOT NULL,               -- 关联的文献 ID
    content TEXT NOT NULL,                -- 笔记正文内容
    anchor_text TEXT,                     -- 锚点文本 (可能用于记录笔记对应的原文片段)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 笔记创建时间
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);
```
**索引**:
- `idx_notes_paper_id`: 加速拉取某篇文献的所有笔记。

---

## `chat_messages` (聊天记录表)
存储用户与 AI 助手针对特定文献的对话历史。
```sql
CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 消息 ID
    paper_id TEXT NOT NULL,               -- 关联的文献 ID
    role TEXT NOT NULL,                   -- 角色 (例如 'user' 或 'assistant')
    content TEXT NOT NULL,                -- 消息内容
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 发送时间
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);
```
**索引**:
- `idx_chat_messages_paper_id`: 加速加载历史聊天记录。

---

## `settings` (系统设置表)
以键值对 (Key-Value) 的形式存储整个应用程序的全局设置，例如 OneDrive 同步配置、Library 根目录路径等。
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,                 -- 设置键名 (如 'onedrive_sync_folder')
    value TEXT NOT NULL                   -- 设置键值
);
```
