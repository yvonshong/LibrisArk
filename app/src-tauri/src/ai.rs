use serde::{Serialize, Deserialize};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISettings {
    pub provider: String, // "openai", "anthropic", "gemini"
    pub model: String,
    pub api_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AISummaryResult {
    pub one_sentence_summary: String,
    pub structured_summary: serde_json::Value,
    pub tags: Vec<String>,
}

// OpenAI structures
#[derive(Serialize)]
struct OpenAIChatRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<OpenAIResponseFormat>,
    temperature: f32,
}

#[derive(Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAIResponseFormat {
    #[serde(rename = "type")]
    format_type: String, // "json_object"
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

// Anthropic structures
#[derive(Serialize)]
struct AnthropicMessageRequest {
    model: String,
    system: String,
    messages: Vec<AnthropicMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Serialize, Deserialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: String,
}

// Gemini structures
#[derive(Serialize)]
struct GeminiGenerateRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "systemInstruction", skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GeminiInstruction>,
    #[serde(rename = "generationConfig", skip_serializing_if = "Option::is_none")]
    generation_config: Option<GeminiConfig>,
}

#[derive(Serialize)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiInstruction {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiConfig {
    temperature: f32,
    #[serde(rename = "responseMimeType", skip_serializing_if = "Option::is_none")]
    response_mime_type: Option<String>, // "application/json"
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiCandidateContent,
}

#[derive(Deserialize)]
struct GeminiCandidateContent {
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub async fn call_llm(
    settings: &AISettings,
    messages: &[ChatMessage],
    force_json: bool,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    match settings.provider.as_str() {
        "openai" => {
            let mut headers = HeaderMap::new();
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", settings.api_key))
                    .map_err(|_| "Invalid API Key header format")?,
            );
            headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

            let response_format = if force_json {
                Some(OpenAIResponseFormat {
                    format_type: "json_object".to_string(),
                })
            } else {
                None
            };

            let req = OpenAIChatRequest {
                model: settings.model.clone(),
                messages: messages.iter().map(|m| OpenAIMessage {
                    role: m.role.clone(),
                    content: m.content.clone(),
                }).collect(),
                response_format,
                temperature: 0.2,
            };

            let res = client
                .post("https://api.openai.com/v1/chat/completions")
                .headers(headers)
                .json(&req)
                .send()
                .await
                .map_err(|e| format!("OpenAI HTTP request failed: {}", e))?;

            let status = res.status();
            let body = res.text().await.map_err(|e| e.to_string())?;

            if !status.is_success() {
                return Err(format!("OpenAI Error ({}): {}", status, body));
            }

            let parsed: OpenAIResponse = serde_json::from_str(&body)
                .map_err(|e| format!("Failed to parse OpenAI response: {}. Body: {}", e, body))?;

            parsed
                .choices
                .first()
                .map(|c| c.message.content.clone())
                .ok_or_else(|| "Empty choices from OpenAI response".to_string())
        }
        "anthropic" => {
            let mut headers = HeaderMap::new();
            headers.insert("x-api-key", HeaderValue::from_str(&settings.api_key).map_err(|_| "Invalid API Key")?);
            headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
            headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

            let system = messages.iter().find(|m| m.role == "system").map(|m| m.content.clone()).unwrap_or_default();
            let msg_list: Vec<AnthropicMessage> = messages.iter().filter(|m| m.role != "system").map(|m| AnthropicMessage {
                role: m.role.clone(),
                content: m.content.clone(),
            }).collect();

            let req = AnthropicMessageRequest {
                model: settings.model.clone(),
                system,
                messages: msg_list,
                max_tokens: 4000,
                temperature: 0.2,
            };

            let res = client
                .post("https://api.anthropic.com/v1/messages")
                .headers(headers)
                .json(&req)
                .send()
                .await
                .map_err(|e| format!("Anthropic HTTP request failed: {}", e))?;

            let status = res.status();
            let body = res.text().await.map_err(|e| e.to_string())?;

            if !status.is_success() {
                return Err(format!("Anthropic Error ({}): {}", status, body));
            }

            let parsed: AnthropicResponse = serde_json::from_str(&body)
                .map_err(|e| format!("Failed to parse Anthropic response: {}. Body: {}", e, body))?;

            parsed
                .content
                .first()
                .map(|c| c.text.clone())
                .ok_or_else(|| "Empty content from Anthropic response".to_string())
        }
        "gemini" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                settings.model, settings.api_key
            );

            let config = GeminiConfig {
                temperature: 0.2,
                response_mime_type: if force_json {
                    Some("application/json".to_string())
                } else {
                    None
                },
            };

            let system_instruction = messages.iter().find(|m| m.role == "system").map(|m| GeminiInstruction {
                parts: vec![GeminiPart { text: m.content.clone() }],
            });

            let mut contents = Vec::new();
            for m in messages.iter().filter(|m| m.role != "system") {
                let role = if m.role == "assistant" { "model" } else { "user" };
                contents.push(GeminiContent {
                    role: Some(role.to_string()),
                    parts: vec![GeminiPart { text: m.content.clone() }],
                });
            }

            let req = GeminiGenerateRequest {
                contents,
                system_instruction,
                generation_config: Some(config),
            };

            let res = client
                .post(&url)
                .header(CONTENT_TYPE, "application/json")
                .json(&req)
                .send()
                .await
                .map_err(|e| format!("Gemini HTTP request failed: {}", e))?;

            let status = res.status();
            let body = res.text().await.map_err(|e| e.to_string())?;

            if !status.is_success() {
                return Err(format!("Gemini Error ({}): {}", status, body));
            }

            let parsed: GeminiResponse = serde_json::from_str(&body)
                .map_err(|e| format!("Failed to parse Gemini response: {}. Body: {}", e, body))?;

            parsed
                .candidates
                .first()
                .and_then(|c| c.content.parts.first())
                .map(|p| p.text.clone())
                .ok_or_else(|| "Empty text from Gemini response".to_string())
        }
        _ => Err(format!("Unsupported AI provider: {}", settings.provider)),
    }
}

pub fn extract_json_block(text: &str) -> String {
    let text = text.trim();
    if text.starts_with("```json") {
        if let Some(end) = text.rfind("```") {
            if end > 7 {
                return text[7..end].trim().to_string();
            }
        }
    } else if text.starts_with("```") {
        if let Some(end) = text.rfind("```") {
            if end > 3 {
                return text[3..end].trim().to_string();
            }
        }
    }
    text.to_string()
}
