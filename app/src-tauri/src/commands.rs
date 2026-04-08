use tauri::{AppHandle, State};
use tauri::Emitter;
use crate::watcher;
use crate::scan;
use crate::metadata;
use crate::AppState;
use rusqlite::params;

#[tauri::command]
pub fn set_library_path(app_handle: AppHandle, state: State<'_, AppState>, path: String) -> Result<(), String> {
    // 1. Update DB
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        ["library_path", &path],
    ).map_err(|e| e.to_string())?;

    // 2. Start Watcher
    // We need to store the watcher in the state to keep it alive.
    // This requires updating AppState to hold the watcher.
    // For now, let's just create it and let it leak or store it if we update AppState.
    // Ideally: state.watcher.lock().unwrap().replace(watcher);
    
    // For simplicity in this step, we'll implement the AppState update in lib.rs first.
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    
    let new_watcher = watcher::watch(app_handle.clone(), &path).map_err(|e| e.to_string())?;
    *watcher_guard = Some(new_watcher);

    // 3. Scan directory
    // We need to release the watcher lock before potentially long operation if we wanted to be async,
    // but here we just do it. However, we need the DB connection.
    // The previous lock on `db` was dropped? No, `conn` is a MutexGuard?
    // Wait, state.db is Mutex<Connection>. `conn` is MutexGuard.
    // We still have `conn`.
    scan::scan_directory(std::path::Path::new(&path), &conn).map_err(|e| e.to_string())?;
    let _ = app_handle.emit("library-update", "rescan-complete");

    Ok(())
}

#[tauri::command]
pub fn rescan_library(state: State<'_, AppState>) -> Result<(), String> {
    let Some(path) = get_library_path(state.clone())? else {
        return Err("Library path not configured".to_string());
    };

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    scan::scan_directory(std::path::Path::new(&path), &conn).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_library_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(["library_path"]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Paper {
    pub id: String,
    pub title: Option<String>,
    pub path: String,
    pub year: Option<i32>,
    pub doi: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FacetItem {
    pub value: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VirtualFacets {
    pub years: Vec<FacetItem>,
    pub authors: Vec<FacetItem>,
    pub tags: Vec<FacetItem>,
}

#[tauri::command]
pub fn get_papers(state: State<'_, AppState>) -> Result<Vec<Paper>, String> {
    get_papers_filtered(state, None, None, None)
}

#[tauri::command]
pub fn get_papers_filtered(
    state: State<'_, AppState>,
    filter_kind: Option<String>,
    filter_value: Option<String>,
    search: Option<String>,
) -> Result<Vec<Paper>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let search_pattern = search
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.trim()));

    let mut papers = Vec::new();

    let kind = filter_kind.unwrap_or_else(|| "all".to_string());
    let value = filter_value.unwrap_or_default();

    match kind.as_str() {
        "year" if !value.is_empty() => {
            if let Some(pattern) = search_pattern {
                let year: i32 = value.parse().map_err(|_| "Invalid year filter".to_string())?;
                let mut stmt = conn
                    .prepare(
                        "SELECT id, title, path, publish_year, doi
                         FROM papers
                         WHERE publish_year = ?1
                           AND (title LIKE ?2 OR path LIKE ?2)
                         ORDER BY created_at DESC",
                    )
                    .map_err(|e| e.to_string())?;
                let iter = stmt
                    .query_map(params![year, pattern], map_paper)
                    .map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            } else {
                let year: i32 = value.parse().map_err(|_| "Invalid year filter".to_string())?;
                let mut stmt = conn
                    .prepare(
                        "SELECT id, title, path, publish_year, doi
                         FROM papers
                         WHERE publish_year = ?1
                         ORDER BY created_at DESC",
                    )
                    .map_err(|e| e.to_string())?;
                let iter = stmt
                    .query_map(params![year], map_paper)
                    .map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            }
        }
        "author" if !value.is_empty() => {
            if let Some(pattern) = search_pattern {
                let mut stmt = conn
                    .prepare(
                        "SELECT p.id, p.title, p.path, p.publish_year, p.doi
                         FROM papers p
                         WHERE EXISTS (
                           SELECT 1
                           FROM paper_authors pa
                           JOIN authors a ON a.id = pa.author_id
                           WHERE pa.paper_id = p.id AND a.name = ?1
                         )
                         AND (p.title LIKE ?2 OR p.path LIKE ?2)
                         ORDER BY p.created_at DESC",
                    )
                    .map_err(|e| e.to_string())?;
                let iter = stmt
                    .query_map(params![value, pattern], map_paper)
                    .map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            } else {
                let mut stmt = conn
                    .prepare(
                        "SELECT p.id, p.title, p.path, p.publish_year, p.doi
                         FROM papers p
                         WHERE EXISTS (
                           SELECT 1
                           FROM paper_authors pa
                           JOIN authors a ON a.id = pa.author_id
                           WHERE pa.paper_id = p.id AND a.name = ?1
                         )
                         ORDER BY p.created_at DESC",
                    )
                    .map_err(|e| e.to_string())?;
                let iter = stmt
                    .query_map(params![value], map_paper)
                    .map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            }
        }
        "tag" if !value.is_empty() => {
            if let Some(pattern) = search_pattern {
                let mut stmt = conn
                    .prepare(
                        "SELECT p.id, p.title, p.path, p.publish_year, p.doi
                         FROM papers p
                         WHERE EXISTS (
                           SELECT 1
                           FROM paper_tags pt
                           JOIN tags t ON t.id = pt.tag_id
                           WHERE pt.paper_id = p.id AND t.name = ?1
                         )
                         AND (p.title LIKE ?2 OR p.path LIKE ?2)
                         ORDER BY p.created_at DESC",
                    )
                    .map_err(|e| e.to_string())?;
                let iter = stmt
                    .query_map(params![value, pattern], map_paper)
                    .map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            } else {
                let mut stmt = conn
                    .prepare(
                        "SELECT p.id, p.title, p.path, p.publish_year, p.doi
                         FROM papers p
                         WHERE EXISTS (
                           SELECT 1
                           FROM paper_tags pt
                           JOIN tags t ON t.id = pt.tag_id
                           WHERE pt.paper_id = p.id AND t.name = ?1
                         )
                         ORDER BY p.created_at DESC",
                    )
                    .map_err(|e| e.to_string())?;
                let iter = stmt
                    .query_map(params![value], map_paper)
                    .map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            }
        }
        _ => {
            if let Some(pattern) = search_pattern {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, title, path, publish_year, doi
                         FROM papers
                         WHERE title LIKE ?1 OR path LIKE ?1
                         ORDER BY created_at DESC",
                    )
                    .map_err(|e| e.to_string())?;
                let iter = stmt
                    .query_map(params![pattern], map_paper)
                    .map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            } else {
                let mut stmt = conn
                    .prepare("SELECT id, title, path, publish_year, doi FROM papers ORDER BY created_at DESC")
                    .map_err(|e| e.to_string())?;
                let iter = stmt.query_map([], map_paper).map_err(|e| e.to_string())?;
                for p in iter {
                    papers.push(p.map_err(|e| e.to_string())?);
                }
            }
        }
    }

    Ok(papers)
}

#[tauri::command]
pub fn get_virtual_facets(state: State<'_, AppState>) -> Result<VirtualFacets, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let years = {
        let mut stmt = conn
            .prepare(
                "SELECT CAST(publish_year AS TEXT) AS y, COUNT(1)
                 FROM papers
                 WHERE publish_year IS NOT NULL
                 GROUP BY publish_year
                 ORDER BY publish_year DESC
                 LIMIT 30",
            )
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(FacetItem {
                    value: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut data = Vec::new();
        for item in iter {
            data.push(item.map_err(|e| e.to_string())?);
        }
        data
    };

    let authors = {
        let mut stmt = conn
            .prepare(
                "SELECT a.name, COUNT(1)
                 FROM authors a
                 JOIN paper_authors pa ON pa.author_id = a.id
                 GROUP BY a.name
                 ORDER BY COUNT(1) DESC, a.name ASC
                 LIMIT 30",
            )
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(FacetItem {
                    value: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut data = Vec::new();
        for item in iter {
            data.push(item.map_err(|e| e.to_string())?);
        }
        data
    };

    let tags = {
        let mut stmt = conn
            .prepare(
                "SELECT t.name, COUNT(1)
                 FROM tags t
                 JOIN paper_tags pt ON pt.tag_id = t.id
                 GROUP BY t.name
                 ORDER BY COUNT(1) DESC, t.name ASC
                 LIMIT 40",
            )
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(FacetItem {
                    value: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut data = Vec::new();
        for item in iter {
            data.push(item.map_err(|e| e.to_string())?);
        }
        data
    };

    Ok(VirtualFacets { years, authors, tags })
}

fn map_paper(row: &rusqlite::Row<'_>) -> rusqlite::Result<Paper> {
    Ok(Paper {
        id: row.get(0)?,
        title: row.get(1)?,
        path: row.get(2)?,
        year: row.get(3)?,
        doi: row.get(4)?,
    })
}

#[derive(Debug)]
struct MetadataJob {
    id: String,
    title: Option<String>,
    doi: Option<String>,
}

#[tauri::command]
pub async fn enrich_metadata(state: State<'_, AppState>) -> Result<u32, String> {
    let jobs = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, doi FROM papers
                 WHERE doi IS NULL OR doi = '' OR publish_year IS NULL OR abstract IS NULL",
            )
            .map_err(|e| e.to_string())?;

        let iter = stmt
            .query_map([], |row| {
                Ok(MetadataJob {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    doi: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut collected = Vec::new();
        for row in iter {
            collected.push(row.map_err(|e| e.to_string())?);
        }
        collected
    };

    let mut updated_count = 0u32;

    for job in jobs {
        let candidate = if let Some(doi) = job.doi.as_ref().filter(|d| !d.is_empty()) {
            metadata::fetch_crossref_by_doi(doi).await?
        } else if let Some(title) = job.title.as_ref().filter(|t| !t.is_empty()) {
            metadata::fetch_crossref_by_title(title).await?
        } else {
            None
        };

        let Some(candidate) = candidate else {
            continue;
        };

        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let changed = conn
            .execute(
                "UPDATE papers
                 SET doi = COALESCE(NULLIF(doi, ''), ?1),
                     title = COALESCE(NULLIF(title, ''), ?2),
                     publish_year = COALESCE(publish_year, ?3),
                     abstract = COALESCE(NULLIF(abstract, ''), ?4),
                     journal = COALESCE(NULLIF(journal, ''), ?5),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?6",
                params![
                    candidate.doi,
                    candidate.title,
                    candidate.year,
                    candidate.abstract_text,
                    candidate.journal,
                    job.id
                ],
            )
            .map_err(|e| e.to_string())?;

        if changed > 0 {
            updated_count += 1;
        }
    }

    Ok(updated_count)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePreview {
    pub id: String,
    pub old_path: String,
    pub new_name: String,
    pub new_path: String,
}

#[tauri::command]
pub fn preview_rename(
    state: State<'_, AppState>,
    paper_ids: Vec<String>,
    template: String,
) -> Result<Vec<RenamePreview>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut previews = Vec::new();

    for paper_id in paper_ids {
        let mut stmt = conn
            .prepare(
                "SELECT p.id, p.path, p.title, p.publish_year, p.journal,
                        (SELECT a.name
                         FROM authors a
                         JOIN paper_authors pa ON pa.author_id = a.id
                         WHERE pa.paper_id = p.id
                         ORDER BY a.id
                         LIMIT 1) AS first_author
                 FROM papers p WHERE p.id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let row = stmt.query_row([&paper_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<i32>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        });

        let Ok((id, old_path, title, year, journal, author)) = row else {
            continue;
        };

        let rendered_name = render_template(
            &template,
            author.as_deref().unwrap_or("Unknown"),
            year,
            title.as_deref().unwrap_or("Untitled"),
            journal.as_deref().unwrap_or("Unknown"),
        );

        let safe_name = ensure_pdf_extension(sanitize_filename(rendered_name));
        let parent = std::path::Path::new(&old_path).parent();
        let Some(parent_dir) = parent else {
            continue;
        };
        let new_path = parent_dir.join(&safe_name).to_string_lossy().to_string();

        previews.push(RenamePreview {
            id,
            old_path,
            new_name: safe_name,
            new_path,
        });
    }

    Ok(previews)
}

#[tauri::command]
pub fn apply_rename(
    state: State<'_, AppState>,
    paper_ids: Vec<String>,
    template: String,
) -> Result<u32, String> {
    let previews = preview_rename(state.clone(), paper_ids, template)?;
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut renamed = 0u32;

    for preview in previews {
        if preview.old_path == preview.new_path {
            continue;
        }

        let resolved_target = resolve_rename_conflict(&preview.new_path);

        std::fs::rename(&preview.old_path, &resolved_target).map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE papers SET path = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            [&resolved_target, &preview.id],
        )
        .map_err(|e| e.to_string())?;

        renamed += 1;
    }

    Ok(renamed)
}

fn render_template(template: &str, author: &str, year: Option<i32>, title: &str, journal: &str) -> String {
    let year_text = year.map(|y| y.to_string()).unwrap_or_else(|| "n.d.".to_string());
    template
        .replace("{Author}", author)
        .replace("{Year}", &year_text)
        .replace("{Title}", title)
        .replace("{Journal}", journal)
}

fn sanitize_filename(name: String) -> String {
    let mut clean = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect::<String>();

    clean = clean.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.len() > 140 {
        clean.truncate(140);
    }

    clean.trim().trim_matches('.').to_string()
}

fn ensure_pdf_extension(name: String) -> String {
    if name.to_ascii_lowercase().ends_with(".pdf") {
        name
    } else {
        format!("{}.pdf", name)
    }
}

fn resolve_rename_conflict(target: &str) -> String {
    if !std::path::Path::new(target).exists() {
        return target.to_string();
    }

    let path = std::path::Path::new(target);
    let parent = path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");

    for idx in 1..10_000 {
        let candidate_name = if ext.is_empty() {
            format!("{}_{}", stem, idx)
        } else {
            format!("{}_{}.{}", stem, idx, ext)
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    target.to_string()
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub paper_id: String,
    pub content: String,
    pub anchor_text: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub fn save_note(
    state: State<'_, AppState>,
    paper_id: String,
    content: String,
    anchor_text: Option<String>,
) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("Note content cannot be empty".to_string());
    }

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO notes (paper_id, content, anchor_text) VALUES (?1, ?2, ?3)",
        params![paper_id, content, anchor_text],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_notes(state: State<'_, AppState>, paper_id: String) -> Result<Vec<Note>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, paper_id, content, anchor_text, created_at
             FROM notes
             WHERE paper_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let note_iter = stmt
        .query_map([paper_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                content: row.get(2)?,
                anchor_text: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for note in note_iter {
        notes.push(note.map_err(|e| e.to_string())?);
    }
    Ok(notes)
}

#[tauri::command]
pub fn ask_paper(
    state: State<'_, AppState>,
    paper_id: String,
    question: String,
    selected_text: Option<String>,
) -> Result<String, String> {
    if question.trim().is_empty() {
        return Ok("Please ask a non-empty question.".to_string());
    }

    let (path, title) = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT path, title FROM papers WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row([paper_id.clone()], |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)))
            .map_err(|e| e.to_string())?
    };

    {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        ensure_chunks_for_paper(&conn, &paper_id, &path)?;
    }

    let query = if let Some(sel) = selected_text.as_ref().filter(|s| !s.trim().is_empty()) {
        format!("{} {}", question, sel)
    } else {
        question.clone()
    };

    let snippets = {
        let conn = state.db.lock().map_err(|e| e.to_string())?;
        rank_chunk_snippets(&conn, &paper_id, &query, 3)?
    };

    if snippets.is_empty() {
        return Ok("I could not find relevant passages in this PDF yet. Try using more specific keywords from the paper.".to_string());
    }

    let mut answer = String::new();
    answer.push_str(&format!(
        "Based on {} I found the following relevant passages:\n\n",
        title.unwrap_or_else(|| "the selected paper".to_string())
    ));
    for (idx, snippet) in snippets.iter().enumerate() {
        answer.push_str(&format!("[{}] {}\n\n", idx + 1, snippet));
    }
    answer.push_str("If you want, I can refine this to a concise summary or explain one selected passage.");

    Ok(answer)
}

fn rank_chunk_snippets(
    conn: &rusqlite::Connection,
    paper_id: &str,
    question: &str,
    top_k: usize,
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT content
             FROM paper_chunks
             WHERE paper_id = ?1
             ORDER BY chunk_index ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([paper_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut all_chunks = Vec::new();
    for row in rows {
        all_chunks.push(row.map_err(|e| e.to_string())?);
    }

    Ok(rank_snippets_from_chunks(&all_chunks, question, top_k))
}

fn rank_snippets_from_chunks(chunks: &[String], question: &str, top_k: usize) -> Vec<String> {
    let query_terms: Vec<String> = question
        .to_ascii_lowercase()
        .split_whitespace()
        .filter(|t| t.len() > 2)
        .map(|s| s.to_string())
        .collect();

    let mut candidates: Vec<(usize, String)> = chunks
        .iter()
        .map(|chunk| chunk.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|chunk| chunk.len() > 100)
        .map(|chunk| {
            let lower = chunk.to_ascii_lowercase();
            let score = query_terms
                .iter()
                .map(|term| lower.matches(term).count())
                .sum::<usize>();
            (score, chunk)
        })
        .filter(|(score, _)| *score > 0)
        .collect();

    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates
        .into_iter()
        .take(top_k)
        .map(|(_, chunk)| {
            if chunk.len() > 420 {
                format!("{}...", &chunk[..420])
            } else {
                chunk
            }
        })
        .collect()
}

fn ensure_chunks_for_paper(conn: &rusqlite::Connection, paper_id: &str, path: &str) -> Result<(), String> {
    let mut count_stmt = conn
        .prepare("SELECT COUNT(1) FROM paper_chunks WHERE paper_id = ?1")
        .map_err(|e| e.to_string())?;
    let chunk_count: i64 = count_stmt
        .query_row([paper_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if chunk_count > 0 {
        return Ok(());
    }

    let text = pdf_extract::extract_text(std::path::Path::new(path)).map_err(|e| e.to_string())?;
    let chunks = split_text_into_chunks(&text, 1000);

    for (idx, chunk) in chunks.into_iter().enumerate() {
        conn.execute(
            "INSERT INTO paper_chunks (paper_id, chunk_index, content) VALUES (?1, ?2, ?3)",
            params![paper_id, idx as i64, chunk],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn split_text_into_chunks(text: &str, target_len: usize) -> Vec<String> {
    let paragraphs: Vec<String> = text
        .split("\n\n")
        .map(|p| p.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|p| p.len() > 40)
        .collect();

    if paragraphs.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let mut current = String::new();

    for p in paragraphs {
        if current.len() + p.len() + 1 > target_len && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current.clear();
        }

        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(&p);
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
}

#[tauri::command]
pub async fn onedrive_login(state: State<'_, AppState>) -> Result<String, String> {
    let client_id = get_setting(&state, "onedrive_client_id")?.ok_or("OneDrive Client ID not configured")?;
    Ok(state.onedrive.get_auth_url(&client_id))
}

#[tauri::command]
pub async fn onedrive_callback(state: State<'_, AppState>, code: String) -> Result<(), String> {
    let client_id = get_setting(&state, "onedrive_client_id")?.ok_or("OneDrive Client ID not configured")?;
    let client_secret = get_setting(&state, "onedrive_client_secret")?;
    state.onedrive.handle_callback(&client_id, client_secret.as_deref(), &code).await?;
    Ok(())
}

#[tauri::command]
pub fn set_onedrive_client_secret(state: State<'_, AppState>, client_secret: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        ["onedrive_client_secret", &client_secret],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_onedrive_client_secret(state: State<'_, AppState>) -> Result<Option<String>, String> {
    get_setting(&state, "onedrive_client_secret")
}

#[tauri::command]
pub fn set_onedrive_client_id(state: State<'_, AppState>, client_id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        ["onedrive_client_id", &client_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_onedrive_client_id(state: State<'_, AppState>) -> Result<Option<String>, String> {
    get_setting(&state, "onedrive_client_id")
}

#[tauri::command]
pub fn set_onedrive_sync_folder(state: State<'_, AppState>, folder: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        ["onedrive_sync_folder", &folder],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_onedrive_sync_folder(state: State<'_, AppState>) -> Result<Option<String>, String> {
    get_setting(&state, "onedrive_sync_folder")
}

#[tauri::command]
pub async fn sync_onedrive(state: State<'_, AppState>) -> Result<(), String> {
    let library_path = get_library_path(state.clone())?.ok_or("Library path not configured")?;
    let sync_folder = get_onedrive_sync_folder(state.clone())?.ok_or("OneDrive sync folder not configured")?;
    let client_id = get_onedrive_client_id(state.clone())?.ok_or("OneDrive Client ID not configured")?;
    let client_secret = get_onedrive_client_secret(state.clone())?;

    let access_token = state.onedrive.get_access_token(&client_id, client_secret.as_deref()).await?;
    
    // 1. List local files
    let local_dir = std::path::Path::new(&library_path);
    let mut local_files = std::collections::HashMap::new();
    println!("Sync: Checking local directory: {:?}", local_dir);
    if local_dir.is_dir() {
        for entry in std::fs::read_dir(local_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
                    let modified = metadata.modified().map_err(|e| e.to_string())?;
                    let modified_dt: chrono::DateTime<chrono::Utc> = modified.into();
                    local_files.insert(name.to_string(), (path, modified_dt));
                }
            }
        }
    }
    println!("Sync: Found {} local files", local_files.len());

    // 2. List remote files
    println!("Sync: Fetching remote files from: {}", sync_folder);
    let remote_items = state.onedrive.list_files(&access_token, &sync_folder).await?;
    let mut remote_files = std::collections::HashMap::new();
    for item in remote_items {
        if item.file.is_some() {
            let remote_modified = chrono::DateTime::parse_from_rfc3339(&item.last_modified)
                .map_err(|e| e.to_string())?
                .with_timezone(&chrono::Utc);
            remote_files.insert(item.name.clone(), (item, remote_modified));
        } else {
            println!("Sync: Skipping non-file item: {}", item.name);
        }
    }
    println!("Sync: Found {} remote files", remote_files.len());

    // 3. Compare and sync
    // Local to Remote
    for (name, (path, local_mtime)) in &local_files {
        match remote_files.get(name) {
            Some((_remote_item, remote_mtime)) => {
                if local_mtime > remote_mtime {
                    // Local is newer, upload
                    let remote_path = format!("{}/{}", sync_folder, name);
                    state.onedrive.upload_file(&access_token, path, &remote_path).await?;
                }
            }
            None => {
                // Not in remote, upload
                let remote_path = format!("{}/{}", sync_folder, name);
                state.onedrive.upload_file(&access_token, path, &remote_path).await?;
            }
        }
    }

    // Remote to Local
    for (name, (item, remote_mtime)) in &remote_files {
        match local_files.get(name) {
            Some((_local_path, local_mtime)) => {
                if remote_mtime > local_mtime {
                    // Remote is newer, download
                    let local_path = local_dir.join(name);
                    state.onedrive.download_file(&access_token, &item.id, &local_path).await?;
                }
            }
            None => {
                // Not in local, download
                let local_path = local_dir.join(name);
                state.onedrive.download_file(&access_token, &item.id, &local_path).await?;
            }
        }
    }

    Ok(())
}

fn get_setting(state: &State<'_, AppState>, key: &str) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([key]).map_err(|e| e.to_string())?;

    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}
