use std::fs;
use std::path::Path;
use rusqlite::Connection;
use uuid::Uuid;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn scan_directory(path: &Path, conn: &Connection) -> Result<(), String> {
    if !path.exists() || !path.is_dir() {
        return Ok(());
    }

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_file() {
            if let Some(extension) = path.extension() {
                if extension.to_string_lossy().to_lowercase() == "pdf" {
                    // It's a PDF, add to DB
                    let file_name = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Unknown".to_string());
                    
                    let abs_path = path.to_string_lossy().to_string();
                    let id = Uuid::new_v4().to_string();
                    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
                    
                    // Basic insert - using filename as title for now
                    // We use INSERT OR IGNORE on path to avoid duplicates if we scan multiple times
                    // Ideally we should have a unique constraint on path in the DB schema
                    // For now let's query check or use INSERT OR IGNORE if schema supports it
                    
                    // Check if exists first
                    let mut stmt = conn.prepare("SELECT id FROM papers WHERE path = ?1").map_err(|e| e.to_string())?;
                    let exists = stmt.exists([&abs_path]).map_err(|e| e.to_string())?;
                    
                    if !exists {
                         conn.execute(
                            "INSERT INTO papers (id, title, path, created_at) VALUES (?1, ?2, ?3, ?4)",
                            [&id, &file_name, &abs_path, &now.to_string()],
                        ).map_err(|e| e.to_string())?;
                        println!("Inserted: {}", file_name);
                    }
                }
            }
        }
    }
    
    Ok(())
}
