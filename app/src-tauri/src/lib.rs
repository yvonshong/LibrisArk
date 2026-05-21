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
    #[cfg(target_os = "linux")]
    {
        // Disable DMA-BUF renderer to avoid blank/white screen issues and severe rendering lag under WebKitGTK
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
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

            // Spawn background auto-sync task
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                    let state = handle.state::<AppState>();
                    
                    let interval_str = {
                        let conn_guard = state.db.lock().unwrap();
                        let mut res = "30".to_string();
                        if let Ok(mut stmt) = conn_guard.prepare("SELECT value FROM settings WHERE key = 'sync_interval_minutes'") {
                            if let Ok(mut rows) = stmt.query([]) {
                                if let Ok(Some(row)) = rows.next() {
                                    res = row.get::<_, String>(0).unwrap_or_else(|_| "30".to_string());
                                }
                            }
                        }
                        res
                    };
                    
                    let interval_mins: u64 = interval_str.parse().unwrap_or(30);
                    if interval_mins == 0 {
                        continue; // 0 means disabled
                    }
                    
                    // Here we check if interval time has passed. For simplicity, we can just sleep interval_mins
                    // But to be robust against interval changes, we sleep 1 min, and check last_sync time.
                    let last_sync_str = {
                        let conn_guard = state.db.lock().unwrap();
                        let mut res = "0".to_string();
                        if let Ok(mut stmt) = conn_guard.prepare("SELECT value FROM settings WHERE key = 'last_sync_time'") {
                            if let Ok(mut rows) = stmt.query([]) {
                                if let Ok(Some(row)) = rows.next() {
                                    res = row.get::<_, String>(0).unwrap_or_else(|_| "0".to_string());
                                }
                            }
                        }
                        res
                    };
                    
                    let last_sync: u64 = last_sync_str.parse().unwrap_or(0);
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs();
                        
                    if now - last_sync >= interval_mins * 60 {
                        // Time to sync
                        let _ = commands::sync_onedrive(handle.clone(), state.clone()).await;
                        // Update last_sync_time
                        let new_now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
                        let conn_guard = state.db.lock().unwrap();
                        let _ = conn_guard.execute(
                            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                            ["last_sync_time", &new_now.to_string()],
                        );
                    }
                }
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
            commands::update_paper_metadata_by_doi,
            commands::update_paper_metadata_manual,
            commands::add_paper_tag,
            commands::remove_paper_tag,
            commands::get_virtual_facets,
            commands::delete_paper,
            commands::preview_rename,
            commands::apply_rename,
            commands::ask_paper,
            commands::save_note,
            commands::get_notes,
            commands::delete_note,
            commands::get_chat_history,
            commands::onedrive_login,
            commands::onedrive_callback,
            commands::set_onedrive_client_id,
            commands::get_onedrive_client_id,
            commands::set_onedrive_client_secret,
            commands::get_onedrive_client_secret,
            commands::set_onedrive_sync_folder,
            commands::get_onedrive_sync_folder,
            commands::get_onedrive_status,
            commands::sync_onedrive,
            commands::save_ai_key,
            commands::get_ai_key_exists,
            commands::delete_ai_key,
            commands::set_app_setting,
            commands::get_app_setting,
            commands::start_copilot_session,
            commands::check_for_updates,
            commands::get_app_version,
            commands::get_unparsed_papers,
            commands::check_paper_parsed,
            commands::read_local_file,
            commands::save_paper_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

