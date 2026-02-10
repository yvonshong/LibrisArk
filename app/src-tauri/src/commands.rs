use tauri::{AppHandle, State, Manager};
use crate::watcher;
use crate::scan;
use crate::AppState;

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
}

#[tauri::command]
pub fn get_papers(state: State<'_, AppState>) -> Result<Vec<Paper>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, title, path, publish_year FROM papers ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    
    let papers_iter = stmt.query_map([], |row| {
        Ok(Paper {
            id: row.get(0)?,
            title: row.get(1)?,
            path: row.get(2)?,
            year: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut papers = Vec::new();
    for paper in papers_iter {
        papers.push(paper.map_err(|e| e.to_string())?);
    }
    
    Ok(papers)
}
