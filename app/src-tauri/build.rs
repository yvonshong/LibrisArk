fn main() {
    let output = std::process::Command::new("git")
        .args(&["describe", "--tags", "--always", "--dirty"])
        .output();
    
    let git_version = match output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        _ => env!("CARGO_PKG_VERSION").to_string()
    };
    
    println!("cargo:rustc-env=APP_GIT_VERSION={}", git_version);
    tauri_build::build();
}
