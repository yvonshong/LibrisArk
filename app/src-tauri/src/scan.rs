use std::path::Path;
use rusqlite::Connection;
use rusqlite::params;
use uuid::Uuid;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;
use crate::metadata;

pub fn scan_directory(path: &Path, conn: &Connection) -> Result<(), String> {
    if !path.exists() || !path.is_dir() {
        return Ok(());
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

        let abs_path = file_path.to_string_lossy().to_string();
        let file_hash = compute_sha256(file_path)?;
        let (detected_doi, detected_title) = metadata::extract_pdf_doi_and_title(file_path);

        let mut existing_path_stmt = conn
            .prepare("SELECT id FROM papers WHERE path = ?1")
            .map_err(|e| e.to_string())?;
        let existing_at_path = existing_path_stmt
            .exists([&abs_path])
            .map_err(|e| e.to_string())?;

        if existing_at_path {
            conn.execute(
                "UPDATE papers
                 SET file_hash = ?1,
                     doi = COALESCE(doi, ?2),
                     title = COALESCE(title, ?3),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE path = ?4",
                params![file_hash, detected_doi, detected_title, abs_path],
            )
            .map_err(|e| e.to_string())?;
            continue;
        }

        let mut existing_hash_stmt = conn
            .prepare("SELECT id FROM papers WHERE file_hash = ?1 LIMIT 1")
            .map_err(|e| e.to_string())?;
        let duplicate_by_hash = existing_hash_stmt
            .exists([&file_hash])
            .map_err(|e| e.to_string())?;

        if duplicate_by_hash {
            continue;
        }

        let title = detected_title.unwrap_or_else(|| {
            file_path
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });
        let id = Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO papers (id, title, path, file_hash, doi) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, title, abs_path, file_hash, detected_doi],
        )
        .map_err(|e| e.to_string())?;
    }

    remove_missing_files(conn)?;
    
    Ok(())
}

fn compute_sha256(path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let digest = Sha256::digest(bytes);
    Ok(format!("{:x}", digest))
}

fn remove_missing_files(conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id, path FROM papers")
        .map_err(|e| e.to_string())?;
    let paper_rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;

    let mut stale_ids = Vec::new();
    for row in paper_rows {
        let (id, path) = row.map_err(|e| e.to_string())?;
        if !Path::new(&path).exists() {
            stale_ids.push(id);
        }
    }

    for id in stale_ids {
        conn.execute("DELETE FROM papers WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
