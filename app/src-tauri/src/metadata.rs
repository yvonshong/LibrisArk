use regex::Regex;
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct MetadataCandidate {
    pub doi: Option<String>,
    pub title: Option<String>,
    pub year: Option<i32>,
    pub abstract_text: Option<String>,
    pub journal: Option<String>,
    pub authors: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CrossrefResponse {
    message: CrossrefMessage,
}

#[derive(Debug, Deserialize)]
struct CrossrefMessage {
    #[serde(default)]
    items: Vec<CrossrefItem>,
    #[serde(rename = "DOI")]
    doi: Option<String>,
    #[serde(default)]
    title: Vec<String>,
    #[serde(rename = "abstract")]
    abstract_text: Option<String>,
    #[serde(rename = "container-title", default)]
    container_title: Vec<String>,
    #[serde(rename = "published-print")]
    published_print: Option<CrossrefDateParts>,
    #[serde(rename = "published-online")]
    published_online: Option<CrossrefDateParts>,
    issued: Option<CrossrefDateParts>,
    #[serde(default)]
    author: Vec<CrossrefAuthor>,
}

#[derive(Debug, Deserialize, Clone)]
struct CrossrefItem {
    #[serde(rename = "DOI")]
    doi: Option<String>,
    #[serde(default)]
    title: Vec<String>,
    #[serde(rename = "abstract")]
    abstract_text: Option<String>,
    #[serde(rename = "container-title", default)]
    container_title: Vec<String>,
    #[serde(rename = "published-print")]
    published_print: Option<CrossrefDateParts>,
    #[serde(rename = "published-online")]
    published_online: Option<CrossrefDateParts>,
    issued: Option<CrossrefDateParts>,
    #[serde(default)]
    author: Vec<CrossrefAuthor>,
}

#[derive(Debug, Deserialize, Clone)]
struct CrossrefAuthor {
    given: Option<String>,
    family: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct CrossrefDateParts {
    #[serde(rename = "date-parts")]
    date_parts: Vec<Vec<i32>>,
}

pub fn extract_pdf_doi_and_title(path: &std::path::Path) -> (Option<String>, Option<String>) {
    let Ok(text) = pdf_extract::extract_text(path) else {
        return (None, None);
    };

    let doi = extract_doi(&text);
    let title = infer_title(&text);
    (doi, title)
}

pub fn extract_doi(text: &str) -> Option<String> {
    let Ok(doi_re) = Regex::new(r"(?i)10\.\d{4,9}/[-._;()/:A-Z0-9]+") else {
        return None;
    };

    doi_re
        .find(text)
        .map(|m| m.as_str().trim_end_matches('.').to_string())
}

pub async fn fetch_crossref_by_doi(doi: &str) -> Result<Option<MetadataCandidate>, String> {
    let url = format!("https://api.crossref.org/works/{}", doi);
    let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(None);
    }

    let parsed: CrossrefResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(Some(message_to_candidate(&parsed.message)))
}

pub async fn fetch_crossref_by_title(title: &str) -> Result<Option<MetadataCandidate>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.crossref.org/works")
        .query(&[("query.title", title), ("rows", "1")])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let parsed: CrossrefResponse = resp.json().await.map_err(|e| e.to_string())?;
    let Some(item) = parsed.message.items.first() else {
        return Ok(None);
    };

    Ok(Some(item_to_candidate(item.clone())))
}

fn message_to_candidate(message: &CrossrefMessage) -> MetadataCandidate {
    MetadataCandidate {
        doi: message.doi.clone(),
        title: message.title.first().cloned(),
        year: extract_year(
            message
                .published_print
                .as_ref()
                .or(message.published_online.as_ref())
                .or(message.issued.as_ref()),
        ),
        journal: message.container_title.first().cloned(),
        abstract_text: message
            .abstract_text
            .as_ref()
            .map(|a| strip_html_tags(a)),
        authors: extract_authors(&message.author),
    }
}

fn item_to_candidate(item: CrossrefItem) -> MetadataCandidate {
    MetadataCandidate {
        doi: item.doi,
        title: item.title.first().cloned(),
        year: extract_year(
            item
                .published_print
                .as_ref()
                .or(item.published_online.as_ref())
                .or(item.issued.as_ref()),
        ),
        journal: item.container_title.first().cloned(),
        abstract_text: item.abstract_text.as_ref().map(|a| strip_html_tags(a)),
        authors: extract_authors(&item.author),
    }
}

fn extract_authors(authors: &[CrossrefAuthor]) -> Vec<String> {
    authors
        .iter()
        .map(|a| {
            if let Some(ref name) = a.name {
                name.clone()
            } else {
                let given = a.given.as_deref().unwrap_or("");
                let family = a.family.as_deref().unwrap_or("");
                format!("{} {}", given, family).trim().to_string()
            }
        })
        .filter(|s| !s.is_empty())
        .collect()
}

fn extract_year(date_parts: Option<&CrossrefDateParts>) -> Option<i32> {
    date_parts
        .and_then(|d| d.date_parts.first())
        .and_then(|part| part.first())
        .copied()
}

fn infer_title(text: &str) -> Option<String> {
    for line in text.lines().take(30) {
        let cleaned = line.trim();
        if cleaned.len() < 15 {
            continue;
        }
        if cleaned.starts_with("http") || cleaned.to_ascii_lowercase().contains("doi") {
            continue;
        }
        if cleaned.chars().filter(|c| c.is_alphabetic()).count() < 8 {
            continue;
        }
        return Some(cleaned.to_string());
    }

    None
}

fn strip_html_tags(text: &str) -> String {
    let Ok(tag_re) = Regex::new(r"<[^>]+>") else {
        return text.to_string();
    };

    tag_re.replace_all(text, " ").split_whitespace().collect::<Vec<_>>().join(" ")
}
