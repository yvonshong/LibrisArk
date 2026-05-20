use rusqlite::{Connection, Result};
use std::path::Path;

pub fn init<P: AsRef<Path>>(db_path: P) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS papers (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL UNIQUE,
            title TEXT,
            abstract TEXT,
            publish_year INTEGER,
            journal TEXT,
            doi TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS authors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS paper_authors (
            paper_id TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            PRIMARY KEY (paper_id, author_id),
            FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS paper_tags (
            paper_id TEXT NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (paper_id, tag_id),
            FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS paper_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            UNIQUE(paper_id, chunk_index),
            FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_id TEXT NOT NULL,
            content TEXT NOT NULL,
            anchor_text TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
        )",
        [],
    )?;

    ensure_papers_file_hash_column(&conn)?;
    ensure_papers_journal_column(&conn)?;
    ensure_papers_new_columns(&conn)?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_papers_file_hash ON papers(file_hash)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper_id ON paper_chunks(paper_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_paper_id ON notes(paper_id)",
        [],
    )?;

    Ok(conn)
}

fn ensure_papers_new_columns(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(papers)")?;
    let mut rows = stmt.query([])?;
    let mut has_one_sentence = false;
    let mut has_structured = false;
    let mut has_file_size = false;
    let mut has_modified_at = false;

    while let Some(row) = rows.next()? {
        let column_name: String = row.get(1)?;
        match column_name.as_str() {
            "one_sentence_summary" => has_one_sentence = true,
            "structured_summary" => has_structured = true,
            "file_size" => has_file_size = true,
            "modified_at" => has_modified_at = true,
            _ => {}
        }
    }

    if !has_one_sentence {
        conn.execute("ALTER TABLE papers ADD COLUMN one_sentence_summary TEXT", [])?;
    }
    if !has_structured {
        conn.execute("ALTER TABLE papers ADD COLUMN structured_summary TEXT", [])?;
    }
    if !has_file_size {
        conn.execute("ALTER TABLE papers ADD COLUMN file_size INTEGER", [])?;
    }
    if !has_modified_at {
        conn.execute("ALTER TABLE papers ADD COLUMN modified_at INTEGER", [])?;
    }

    Ok(())
}

fn ensure_papers_file_hash_column(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(papers)")?;
    let mut rows = stmt.query([])?;
    let mut has_file_hash = false;

    while let Some(row) = rows.next()? {
        let column_name: String = row.get(1)?;
        if column_name == "file_hash" {
            has_file_hash = true;
            break;
        }
    }

    if !has_file_hash {
        conn.execute("ALTER TABLE papers ADD COLUMN file_hash TEXT", [])?;
    }

    Ok(())
}

fn ensure_papers_journal_column(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(papers)")?;
    let mut rows = stmt.query([])?;
    let mut has_journal = false;

    while let Some(row) = rows.next()? {
        let column_name: String = row.get(1)?;
        if column_name == "journal" {
            has_journal = true;
            break;
        }
    }

    if !has_journal {
        conn.execute("ALTER TABLE papers ADD COLUMN journal TEXT", [])?;
    }

    Ok(())
}
