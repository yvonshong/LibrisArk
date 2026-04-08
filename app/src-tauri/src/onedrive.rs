use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use url::Url;

const REDIRECT_URI: &str = "http://localhost:3003/callback";
const AUTH_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const SCOPES: &str = "files.readwrite offline_access user.read";

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
        Self {
            client: reqwest::Client::new(),
            token: Arc::new(Mutex::new(None)),
        }
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
        
        *token_guard = Some(new_token);
        
        Ok(())
    }

    pub async fn list_files(&self, access_token: &str, folder_path: &str) -> Result<Vec<OneDriveItem>, String> {
        let url = if folder_path == "/" || folder_path.is_empty() {
            "https://graph.microsoft.com/v1.0/me/drive/root/children".to_string()
        } else {
            format!("https://graph.microsoft.com/v1.0/me/drive/root:/{}:/children", folder_path)
        };

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

        let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        println!("OneDrive: received JSON body with value length: {}", body["value"].as_array().map(|a| a.len()).unwrap_or(0));
        let items: Vec<OneDriveItem> = serde_json::from_value(body["value"].clone())
            .map_err(|e| format!("Failed to parse items: {}. Body: {:?}", e, body))?;
        
        for item in &items {
            if item.folder.is_some() {
                println!("OneDrive: Item '{}' is a folder", item.name);
            } else if item.file.is_some() {
                println!("OneDrive: Item '{}' is a file", item.name);
            }
        }

        Ok(items)
    }

    pub async fn upload_file(&self, access_token: &str, local_path: &std::path::Path, remote_path: &str) -> Result<(), String> {
        let file_content = std::fs::read(local_path).map_err(|e| e.to_string())?;
        let url = format!("https://graph.microsoft.com/v1.0/me/drive/root:/{}:/content", remote_path);

        let res = self.client
            .put(url)
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
