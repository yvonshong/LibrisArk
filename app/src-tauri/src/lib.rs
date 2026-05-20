// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod db;
mod watcher;
mod commands;
mod scan;
mod metadata;
mod ai;

use std::sync::Mutex;
use rusqlite::Connection;
use notify::RecommendedWatcher;

mod onedrive;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    pub onedrive: onedrive::OneDriveClient,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            use tauri::Manager;
            let app_handle = app.handle();
             // Get app data directory
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
            let db_path = app_dir.join("librisark.db");
            
            let conn = db::init(db_path).expect("failed to init db");
            
            // Check for existing library path to start watching
            let mut watcher: Option<RecommendedWatcher> = None;
            {
                let stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").ok();
                if let Some(mut statement) = stmt {
                     let rows = statement.query(["library_path"]).ok();
                     if let Some(mut r) = rows {
                         if let Ok(Some(row)) = r.next() {
                             if let Ok(path) = row.get::<_, String>(0) {
                                  // Start scanning existing files
                                  let _ = scan::scan_directory(std::path::Path::new(&path), &conn);

                                  if let Ok(w) = watcher::watch(app_handle.clone(), &path) {
                                      watcher = Some(w);
                                  }
                             }
                         }
                     }
                }
            }

            app.manage(AppState {
                db: Mutex::new(conn),
                watcher: Mutex::new(watcher),
                onedrive: onedrive::OneDriveClient::new(),
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_library_path, 
            commands::get_library_path, 
            commands::rescan_library,
            commands::enrich_metadata,
            commands::get_papers,
            commands::get_papers_filtered,
            commands::get_virtual_facets,
            commands::preview_rename,
            commands::apply_rename,
            commands::ask_paper,
            commands::save_note,
            commands::get_notes,
            commands::onedrive_login,
            commands::onedrive_callback,
            commands::set_onedrive_client_id,
            commands::get_onedrive_client_id,
            commands::set_onedrive_client_secret,
            commands::get_onedrive_client_secret,
            commands::set_onedrive_sync_folder,
            commands::get_onedrive_sync_folder,
            commands::sync_onedrive,
            commands::save_ai_key,
            commands::get_ai_key_exists,
            commands::delete_ai_key,
            commands::set_app_setting,
            commands::get_app_setting,
            commands::generate_ai_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

