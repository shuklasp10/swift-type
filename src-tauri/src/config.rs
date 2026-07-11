//! Configuration Module
//!
//! Handles loading, saving, and managing snippets configuration.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// A single snippet/match definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    /// Unique identifier for this snippet
    #[serde(default = "generate_id")]
    pub id: String,

    /// The trigger text (e.g., ":hello")
    #[serde(alias = "trigger")]
    pub trigger: Option<String>,

    /// Regex trigger pattern (alternative to exact trigger)
    #[serde(alias = "regex")]
    pub regex: Option<String>,

    /// The replacement text
    pub replace: String,

    /// Optional label for display in UI
    #[serde(default)]
    pub label: Option<String>,

    /// Word-based trigger (requires word boundary)
    #[serde(default)]
    pub word: bool,

    /// Force uppercase matching
    #[serde(default)]
    pub uppercase_style: Option<String>,

    /// Image path for image expansion
    #[serde(default)]
    pub image_path: Option<String>,

    /// Shell command to execute
    #[serde(default)]
    pub shell: Option<String>,

    /// Form fields for dynamic input
    #[serde(default)]
    pub form_fields: Option<Vec<FormField>>,

    /// App-specific filter
    #[serde(default)]
    pub filter_app: Option<String>,

    /// Category for organization
    #[serde(default)]
    pub category: Option<String>,

    /// Usage count for tracking popularity
    #[serde(default)]
    pub usage_count: Option<u32>,

    /// Last updated timestamp
    #[serde(default)]
    pub updated_at: Option<u64>,

    /// Is favorite
    #[serde(default)]
    pub is_favorite: Option<bool>,

    /// Deleted at timestamp (soft delete)
    #[serde(default)]
    pub deleted_at: Option<u64>,
}

/// Form field definition for dynamic snippets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormField {
    pub name: String,
    pub label: Option<String>,
    #[serde(default)]
    pub default: String,
    #[serde(rename = "type", default = "default_field_type")]
    pub field_type: String,
    #[serde(default)]
    pub choices: Option<Vec<String>>,
}

fn default_field_type() -> String {
    "text".to_string()
}

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("snip_{}", timestamp)
}

/// Configuration file structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    /// List of snippets/matches
    #[serde(default)]
    pub matches: Vec<Snippet>,

    /// Global variables
    #[serde(default)]
    pub global_vars: HashMap<String, String>,
}

/// Application settings (stored separately from snippets)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// Enable/disable the expander
    pub enabled: bool,

    /// Injection method preference
    pub injection_method: String, // "auto", "keystrokes", "clipboard"

    /// Search bar hotkey
    pub search_hotkey: String,

    /// Backspace undo duration (ms)
    pub undo_backspace_ms: u32,

    /// Start with Windows
    pub start_with_windows: bool,

    /// Show in system tray
    pub show_in_tray: bool,

    /// Theme preference
    pub theme: String, // "dark", "light", "system"

    /// Toggle hotkey
    pub toggle_hotkey: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            injection_method: "auto".to_string(),
            search_hotkey: "Alt+Space".to_string(),
            undo_backspace_ms: 500,
            start_with_windows: false,
            show_in_tray: true,
            theme: "dark".to_string(),
            toggle_hotkey: None,
        }
    }
}

/// Configuration manager
pub struct ConfigManager {
    config: Config,
    settings: AppSettings,
    config_dir: PathBuf,
}

impl ConfigManager {
    /// Create a new config manager
    pub fn new() -> Result<Self, String> {
        let config_dir = get_config_dir()?;

        // Ensure config directory exists
        std::fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;

        let mut manager = Self {
            config: Config::default(),
            settings: AppSettings::default(),
            config_dir,
        };

        // Load existing config if available
        manager.load()?;

        Ok(manager)
    }

    /// Get the config directory path
    #[allow(dead_code)]
    pub fn config_dir(&self) -> &PathBuf {
        &self.config_dir
    }

    /// Load configuration from disk
    pub fn load(&mut self) -> Result<(), String> {
        // Load snippets config
        let config_path = self.config_dir.join("config.yml");
        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)
                .map_err(|e| format!("Failed to read config file: {}", e))?;
            self.config = serde_yaml::from_str(&content)
                .map_err(|e| format!("Failed to parse config file: {}", e))?;
        } else {
            // Create default config
            self.config = create_default_config();
            self.save_config()?;
        }

        // Load settings
        let settings_path = self.config_dir.join("settings.json");
        if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path)
                .map_err(|e| format!("Failed to read settings file: {}", e))?;
            self.settings = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse settings file: {}", e))?;
        } else {
            self.save_settings()?;
        }

        log::info!("Loaded {} snippets", self.config.matches.len());
        Ok(())
    }

    /// Save snippets config to disk
    pub fn save_config(&self) -> Result<(), String> {
        let config_path = self.config_dir.join("config.yml");
        let content = serde_yaml::to_string(&self.config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        std::fs::write(&config_path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
        Ok(())
    }

    /// Export snippets config to a specific path
    pub fn export_data(&self, path: &str) -> Result<(), String> {
        let content = serde_yaml::to_string(&self.config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        std::fs::write(path, content)
            .map_err(|e| format!("Failed to write export file: {}", e))?;
        Ok(())
    }

    pub fn import_data(&mut self, path: &str, merge: bool) -> Result<(), String> {
        log::info!("Attempting to import from path: {}", path);
        let content = std::fs::read_to_string(path).map_err(|e| {
            let err_msg = format!("Failed to read import file {}: {}", path, e);
            log::error!("{}", err_msg);
            // Alert user: Failed to import snippets
            err_msg
        })?;
        
        let imported_config: Config = serde_yaml::from_str(&content).map_err(|e| {
            let err_msg = format!("Failed to parse imported config: {}", e);
            log::error!("{}", err_msg);
            // Alert user: Failed to import snippets
            err_msg
        })?;
        
        if merge {
            for snippet in imported_config.matches {
                if !self.config.matches.iter().any(|s| s.id == snippet.id) {
                    self.config.matches.push(snippet);
                }
            }
        } else {
            self.config = imported_config;
        }
        
        self.save_config()?;
        Ok(())
    }

    /// Save settings to disk
    pub fn save_settings(&self) -> Result<(), String> {
        let settings_path = self.config_dir.join("settings.json");
        let content = serde_json::to_string_pretty(&self.settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        std::fs::write(&settings_path, content)
            .map_err(|e| format!("Failed to write settings file: {}", e))?;
        Ok(())
    }

    /// Clear all data and reset to defaults
    pub fn clear_all_data(&mut self) -> Result<(), String> {
        self.config.matches.clear();
        self.settings = AppSettings::default();
        self.save_config()?;
        self.save_settings()?;
        Ok(())
    }

    /// Get all snippets
    pub fn snippets(&self) -> &[Snippet] {
        &self.config.matches
    }

    /// Get snippets as mutable
    #[allow(dead_code)]
    pub fn snippets_mut(&mut self) -> &mut Vec<Snippet> {
        &mut self.config.matches
    }

    /// Get settings
    pub fn settings(&self) -> &AppSettings {
        &self.settings
    }

    /// Get settings as mutable
    pub fn settings_mut(&mut self) -> &mut AppSettings {
        &mut self.settings
    }

    /// Add a new snippet
    pub fn add_snippet(&mut self, snippet: Snippet) {
        self.config.matches.push(snippet);
    }

    /// Remove a snippet by ID
    pub fn remove_snippet(&mut self, id: &str) -> bool {
        if let Some(pos) = self.config.matches.iter().position(|s| s.id == id) {
            self.config.matches.remove(pos);
            true
        } else {
            false
        }
    }

    /// Update a snippet by ID
    pub fn update_snippet(&mut self, id: &str, snippet: Snippet) -> bool {
        if let Some(existing) = self.config.matches.iter_mut().find(|s| s.id == id) {
            *existing = snippet;
            true
        } else {
            false
        }
    }

    /// Increment usage count for a snippet
    pub fn increment_usage(&mut self, id: &str) -> Result<(), String> {
        if let Some(existing) = self.config.matches.iter_mut().find(|s| s.id == id) {
            existing.usage_count = Some(existing.usage_count.unwrap_or(0) + 1);
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            existing.updated_at = Some(now);
            self.save_config()
        } else {
            Err(format!("Snippet not found: {}", id))
        }
    }

    /// Find a snippet that matches the given buffer
    #[allow(dead_code)]
    pub fn find_matching_snippet(&self, buffer: &str) -> Option<&Snippet> {
        for snippet in &self.config.matches {
            if let Some(ref trigger) = snippet.trigger {
                if buffer.ends_with(trigger) {
                    return Some(snippet);
                }
            }
            // TODO: Add regex matching
        }
        None
    }
}

/// Get the configuration directory path
fn get_config_dir() -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".config")))
        .ok_or_else(|| "Could not determine config directory".to_string())?;
    Ok(base.join("swifttype"))
}

/// Create default configuration with example snippets
fn create_default_config() -> Config {
    Config {
        matches: vec![
            Snippet {
                id: "example_hello".to_string(),
                trigger: Some(":hello".to_string()),
                regex: None,
                replace: "Hello, World!".to_string(),
                label: Some("Hello World".to_string()),
                word: false,
                uppercase_style: None,
                image_path: None,
                shell: None,
                form_fields: None,
                filter_app: None,
                category: Some("General".to_string()),
                usage_count: Some(42),
                updated_at: Some(1715424000), // Arbitrary past timestamp
                is_favorite: None,
                deleted_at: None,
            },
            Snippet {
                id: "example_date".to_string(),
                trigger: Some(":date".to_string()),
                regex: None,
                replace: "{{date}}".to_string(),
                label: Some("Current Date".to_string()),
                word: false,
                uppercase_style: None,
                image_path: None,
                shell: None,
                form_fields: None,
                filter_app: None,
                category: Some("Development".to_string()),
                usage_count: Some(15),
                updated_at: Some(1715424000),
                is_favorite: None,
                deleted_at: None,
            },
            Snippet {
                id: "example_email".to_string(),
                trigger: Some(":email".to_string()),
                regex: None,
                replace: "example@email.com".to_string(),
                label: Some("Email Address".to_string()),
                word: false,
                uppercase_style: None,
                image_path: None,
                shell: None,
                form_fields: None,
                filter_app: None,
                category: Some("Communication".to_string()),
                usage_count: Some(89),
                updated_at: Some(1715424000),
                is_favorite: None,
                deleted_at: None,
            },
        ],
        global_vars: HashMap::new(),
    }
}

// Add dirs crate dependency - this will be added to Cargo.toml
