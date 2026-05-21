use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use url::Url;

const REDIRECT_URI: &str = "http://localhost";
const AUTH_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const SCOPES: &str = "Files.ReadWrite offline_access user.read";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OneDriveToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub expires_at: Option<u64>, // Unix timestamp
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OneDriveItem {
    pub id: String,
    pub name: String,
    pub size: u64,
    #[serde(rename = "lastModifiedDateTime")]
    pub last_modified: String,
    pub file: Option<serde_json::Value>,
    pub folder: Option<serde_json::Value>,
}

pub struct OneDriveClient {
    client: reqwest::Client,
    token: Arc<Mutex<Option<OneDriveToken>>>,
}

impl OneDriveClient {
    pub fn new() -> Self {
        let mut initial_token = None;
        if let Ok(entry) = keyring::Entry::new("librisark", "onedrive_token") {
            if let Ok(token_str) = entry.get_password() {
                if let Ok(token) = serde_json::from_str::<OneDriveToken>(&token_str) {
                    initial_token = Some(token);
                }
            }
        }
        
        Self {
            client: reqwest::Client::new(),
            token: Arc::new(Mutex::new(initial_token)),
        }
    }

    fn save_token(token: &OneDriveToken) {
        if let Ok(entry) = keyring::Entry::new("librisark", "onedrive_token") {
            if let Ok(token_str) = serde_json::to_string(token) {
                let _ = entry.set_password(&token_str);
            }
        }
    }

    pub async fn has_token(&self) -> bool {
        let token_guard = self.token.lock().await;
        token_guard.is_some()
    }

    pub fn get_auth_url(&self, client_id: &str) -> String {
        Url::parse_with_params(
            AUTH_URL,
            &[
                ("client_id", client_id),
                ("response_type", "code"),
                ("redirect_uri", REDIRECT_URI),
                ("response_mode", "query"),
                ("scope", SCOPES),
                ("state", "12345"), // Should be random
            ],
        )
        .unwrap()
        .to_string()
    }

    pub async fn handle_callback(&self, client_id: &str, client_secret: Option<&str>, code: &str) -> Result<OneDriveToken, String> {
        let mut params = vec![
            ("client_id", client_id.to_string()),
            ("code", code.to_string()),
            ("redirect_uri", REDIRECT_URI.to_string()),
            ("grant_type", "authorization_code".to_string()),
            ("scope", SCOPES.to_string()),
        ];

        if let Some(secret) = client_secret {
            params.push(("client_secret", secret.to_string()));
        }

        let res = self.client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = res.status();
        let body = res.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Microsoft Error ({}): {}", status, body));
        }

        let mut token: OneDriveToken = serde_json::from_str(&body).map_err(|e| {
            format!("Failed to decode token: {}. Body: {}", e, body)
        })?;
        
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        token.expires_at = Some(now + token.expires_in);

        Self::save_token(&token);

        let mut token_guard = self.token.lock().await;
        *token_guard = Some(token.clone());
        
        Ok(token)
    }

    pub async fn get_access_token(&self, client_id: &str, client_secret: Option<&str>) -> Result<String, String> {
        let token_guard = self.token.lock().await;
        
        if let Some(token) = token_guard.as_ref() {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            if let Some(expires_at) = token.expires_at {
                if now + 60 < expires_at {
                    return Ok(token.access_token.clone());
                }
            }
        }
        
        // Refresh token if expired or nearly expired
        drop(token_guard);
        self.refresh_token(client_id, client_secret).await?;
        
        let token_guard = self.token.lock().await;
        token_guard.as_ref()
            .map(|t| t.access_token.clone())
            .ok_or("Failed to get access token after refresh".to_string())
    }

    pub async fn refresh_token(&self, client_id: &str, client_secret: Option<&str>) -> Result<(), String> {
        let mut token_guard = self.token.lock().await;
        let refresh_token = token_guard.as_ref()
            .and_then(|t| t.refresh_token.as_ref())
            .ok_or("No refresh token available")?;

        let mut params = vec![
            ("client_id", client_id.to_string()),
            ("refresh_token", refresh_token.clone()),
            ("grant_type", "refresh_token".to_string()),
            ("scope", SCOPES.to_string()),
        ];

        if let Some(secret) = client_secret {
            params.push(("client_secret", secret.to_string()));
        }

        let res = self.client
            .post(TOKEN_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = res.status();
        let body = res.text().await.map_err(|e| e.to_string())?;

        if !status.is_success() {
            return Err(format!("Microsoft Error ({}): {}", status, body));
        }

        let mut new_token: OneDriveToken = serde_json::from_str(&body).map_err(|e| {
            format!("Failed to decode token: {}. Body: {}", e, body)
        })?;
        
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        new_token.expires_at = Some(now + new_token.expires_in);
        
        Self::save_token(&new_token);

        *token_guard = Some(new_token);
        
        Ok(())
    }

    pub async fn list_files(&self, access_token: &str, folder_path: &str) -> Result<Vec<OneDriveItem>, String> {
        let mut items = Vec::new();
        let encoded_path = folder_path.split('/').map(|s| urlencoding::encode(s)).collect::<Vec<_>>().join("/");
        
        let mut url = if folder_path == "/" || folder_path.is_empty() {
            "https://graph.microsoft.com/v1.0/me/drive/root/children".to_string()
        } else {
            format!("https://graph.microsoft.com/v1.0/me/drive/root:/{}:/children", encoded_path)
        };

        loop {
            let res = self.client
                .get(&url)
                .bearer_auth(access_token)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let status = res.status();
            if !status.is_success() {
                if status.as_u16() == 404 {
                    // Folder doesn't exist yet, just return empty list
                    return Ok(items);
                }
                let body = res.text().await.map_err(|e| e.to_string())?;
                return Err(format!("Microsoft Error ({}): {}", status, body));
            }

            let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            if let Some(_value) = body.get("value").and_then(|v| v.as_array()) {
                let page_items: Vec<OneDriveItem> = serde_json::from_value(body["value"].clone())
                    .map_err(|e| format!("Failed to parse items: {}", e))?;
                items.extend(page_items);
            }

            if let Some(next_link) = body.get("@odata.nextLink").and_then(|v| v.as_str()) {
                url = next_link.to_string();
            } else {
                break;
            }
        }

        Ok(items)
    }

    pub async fn upload_file(&self, access_token: &str, local_path: &std::path::Path, remote_path: &str) -> Result<(), String> {
        let file_size = std::fs::metadata(local_path).map_err(|e| e.to_string())?.len();
        let encoded_path = remote_path.split('/').map(|s| urlencoding::encode(s)).collect::<Vec<_>>().join("/");
        
        if file_size <= 4 * 1024 * 1024 {
            // Small file: single PUT
            let file_content = std::fs::read(local_path).map_err(|e| e.to_string())?;
            let url = format!("https://graph.microsoft.com/v1.0/me/drive/root:/{}:/content", encoded_path);

            let res = self.client
                .put(&url)
                .bearer_auth(access_token)
                .body(file_content)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let status = res.status();
            if !status.is_success() {
                let body = res.text().await.map_err(|e| e.to_string())?;
                return Err(format!("Microsoft Error ({}): {}", status, body));
            }
        } else {
            // Large file: upload session
            let create_session_url = format!("https://graph.microsoft.com/v1.0/me/drive/root:/{}:/createUploadSession", encoded_path);
            let res = self.client
                .post(&create_session_url)
                .bearer_auth(access_token)
                .json(&serde_json::json!({
                    "item": {
                        "@microsoft.graph.conflictBehavior": "replace"
                    }
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;
                
            let status = res.status();
            if !status.is_success() {
                let body = res.text().await.map_err(|e| e.to_string())?;
                return Err(format!("Microsoft Error ({}): {}", status, body));
            }
            
            let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            let upload_url = body["uploadUrl"].as_str().ok_or("Failed to get uploadUrl")?;
            
            let mut file = std::fs::File::open(local_path).map_err(|e| e.to_string())?;
            let chunk_size = 320 * 1024 * 10; // 3.2 MB (must be multiple of 320 KB)
            let mut buffer = vec![0; chunk_size];
            let mut total_read = 0;
            
            use std::io::Read;
            loop {
                let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if bytes_read == 0 {
                    break;
                }
                
                let chunk = &buffer[..bytes_read];
                let content_range = format!("bytes {}-{}/{}", total_read, total_read + bytes_read - 1, file_size);
                
                let res = self.client
                    .put(upload_url)
                    .header("Content-Length", bytes_read.to_string())
                    .header("Content-Range", content_range)
                    .body(chunk.to_vec())
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;
                    
                let status = res.status();
                if !status.is_success() && status.as_u16() != 202 && status.as_u16() != 201 {
                    let body = res.text().await.map_err(|e| e.to_string())?;
                    return Err(format!("Upload chunk failed ({}): {}", status, body));
                }
                
                total_read += bytes_read;
            }
        }

        Ok(())
    }

    pub async fn download_file(&self, access_token: &str, remote_item_id: &str, local_path: &std::path::Path) -> Result<(), String> {
        let url = format!("https://graph.microsoft.com/v1.0/me/drive/items/{}/content", remote_item_id);

        let res = self.client
            .get(url)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.map_err(|e| e.to_string())?;
            return Err(format!("Microsoft Error ({}): {}", status, body));
        }

        let body = res.bytes().await.map_err(|e| e.to_string())?;
        std::fs::write(local_path, body).map_err(|e| e.to_string())?;

        Ok(())
    }
}
