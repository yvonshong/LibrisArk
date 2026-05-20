use std::path::Path;
use rusqlite::Connection;
use rusqlite::params;
use uuid::Uuid;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;
use crate::metadata;

pub fn scan_directory(path: &Path, conn: &Connection) -> Result<Vec<String>, String> {
    let mut new_paper_ids = Vec::new();
    if !path.exists() || !path.is_dir() {
        return Ok(new_paper_ids);
    }

    for entry in WalkDir::new(path).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path();
        let extension = file_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("pdf"))
            .unwrap_or(false);

        if !extension {
            continue;
        }

        let rel_path = file_path
            .strip_prefix(path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        let metadata_fs = std::fs::metadata(file_path).map_err(|e| e.to_string())?;
        let file_size = metadata_fs.len() as i64;
        let modified_at = metadata_fs
            .modified()
            .map_err(|e| e.to_string())?
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_secs() as i64;

        // Check if file is already in the database at this relative path
        let mut stmt = conn
            .prepare("SELECT id, file_hash, file_size, modified_at FROM papers WHERE path = ?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt.query([&rel_path]).map_err(|e| e.to_string())?;

        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let id: String = row.get(0).map_err(|e| e.to_string())?;
            let stored_hash: Option<String> = row.get(1).map_err(|e| e.to_string())?;
            let stored_size: Option<i64> = row.get(2).map_err(|e| e.to_string())?;
            let stored_mtime: Option<i64> = row.get(3).map_err(|e| e.to_string())?;

            if stored_size == Some(file_size) && stored_mtime == Some(modified_at) && stored_hash.is_some() {
                // File hasn't changed. Skip re-hashing and re-scanning.
                continue;
            }

            // File changed, update hash, size, and mtime
            let file_hash = compute_sha256(file_path)?;
            conn.execute(
                "UPDATE papers
                 SET file_hash = ?1,
                     file_size = ?2,
                     modified_at = ?3,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?4",
                params![file_hash, file_size, modified_at, id],
            )
            .map_err(|e| e.to_string())?;
            continue;
        }

        // Check if the file's hash is already in the database under a different path (de-duplication/rename)
        let file_hash = compute_sha256(file_path)?;
        let mut existing_hash_stmt = conn
            .prepare("SELECT id, path FROM papers WHERE file_hash = ?1 LIMIT 1")
            .map_err(|e| e.to_string())?;
        let mut hash_rows = existing_hash_stmt.query([&file_hash]).map_err(|e| e.to_string())?;

        if let Some(row) = hash_rows.next().map_err(|e| e.to_string())? {
            let id: String = row.get(0).map_err(|e| e.to_string())?;
            let db_path: String = row.get(1).map_err(|e| e.to_string())?;

            if db_path != rel_path {
                // File was renamed or moved. Update path, size, and mtime
                conn.execute(
                    "UPDATE papers
                     SET path = ?1,
                         file_size = ?2,
                         modified_at = ?3,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?4",
                    params![rel_path, file_size, modified_at, id],
                )
                .map_err(|e| e.to_string())?;
            }
            continue;
        }

        // New paper
        let (detected_doi, detected_title) = metadata::extract_pdf_doi_and_title(file_path);
        let title = detected_title.unwrap_or_else(|| {
            file_path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO papers (id, title, path, file_hash, doi, file_size, modified_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, title, rel_path, file_hash, detected_doi, file_size, modified_at],
        )
        .map_err(|e| e.to_string())?;
        new_paper_ids.push(id);
    }

    remove_missing_files(conn, path)?;

    Ok(new_paper_ids)
}

fn compute_sha256(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let digest = Sha256::digest(bytes);
    Ok(format!("{:x}", digest))
}

fn remove_missing_files(conn: &Connection, library_path: &Path) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id, path FROM papers")
        .map_err(|e| e.to_string())?;
    let paper_rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;

    let mut stale_ids = Vec::new();
    for row in paper_rows {
        let (id, path) = row.map_err(|e| e.to_string())?;
        
        let path_exists = if Path::new(&path).is_absolute() {
            Path::new(&path).exists()
        } else {
            library_path.join(&path).exists()
        };

        if !path_exists {
            stale_ids.push(id);
        }
    }

    for id in stale_ids {
        conn.execute("DELETE FROM papers WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
