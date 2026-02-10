use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use tauri::{AppHandle, Emitter};

pub fn watch<P: AsRef<Path>>(app_handle: AppHandle, path: P) -> notify::Result<RecommendedWatcher> {
    let app_handle_clone = app_handle.clone();
    
    let mut watcher = RecommendedWatcher::new(move |res| {
        match res {
            Ok(event) => {
                // Emit event to frontend
                // In a real app we'd also update the DB here or trigger a scan
                let _ = app_handle_clone.emit("library-update", event);
            },
            Err(e) => eprintln!("watch error: {:?}", e),
        }
    }, Config::default())?;

    watcher.watch(path.as_ref(), RecursiveMode::Recursive)?;

    Ok(watcher)
}
