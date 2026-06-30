//! Trigger Engine Module
//! 
//! Handles trigger detection, variable expansion, and text replacement coordination.

use chrono::Local;
use regex::Regex;
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;

use crate::config::{ConfigManager, Snippet};
use crate::text_injector::{InjectionMethod, replace_text};
use crate::keyboard_hook;

/// Compiled regex cache
pub struct TriggerEngine {
    config: Arc<RwLock<ConfigManager>>,
    regex_cache: HashMap<String, Regex>,
    injection_method: InjectionMethod,
    enabled: bool,
}

impl TriggerEngine {
    /// Create a new trigger engine
    pub fn new(config: Arc<RwLock<ConfigManager>>) -> Self {
        let injection_method = {
            let cfg = config.read();
            match cfg.settings().injection_method.as_str() {
                "keystrokes" => InjectionMethod::Keystrokes,
                "clipboard" => InjectionMethod::Clipboard,
                _ => InjectionMethod::Auto,
            }
        };
        
        Self {
            config,
            regex_cache: HashMap::new(),
            injection_method,
            enabled: true,
        }
    }
    
    /// Enable or disable the engine
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
    
    /// Check if engine is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
    
    /// Set injection method
    pub fn set_injection_method(&mut self, method: InjectionMethod) {
        self.injection_method = method;
    }
    
    /// Process a keystroke buffer and check for triggers
    pub fn process_buffer(&mut self, buffer: &str) -> Option<ExpansionResult> {
        if !self.enabled {
            return None;
        }
        
        // Collect matching info first to avoid borrow issues
        let match_info: Option<(Option<(String, usize)>, Option<(String, String, String, bool)>)> = {
            let config = self.config.read();
            
            for snippet in config.snippets() {
                // Check exact trigger
                if let Some(ref trigger) = snippet.trigger {
                    if buffer.ends_with(trigger) {
                        return Some(ExpansionResult {
                            trigger_len: trigger.len(),
                            replacement: self.expand_variables(&snippet.replace),
                            snippet_id: snippet.id.clone(),
                            has_form: snippet.form_fields.is_some(),
                        });
                    }
                }
                
                // Check regex trigger - collect data for later processing
                if let Some(ref regex_pattern) = snippet.regex {
                    // Clone what we need to check regex outside the config borrow
                    let pattern = regex_pattern.clone();
                    let replace_text = snippet.replace.clone();
                    let snip_id = snippet.id.clone();
                    let has_form = snippet.form_fields.is_some();
                    drop(config);
                    
                    if let Some(result) = self.check_regex_trigger(buffer, &pattern, &replace_text, &snip_id, has_form) {
                        return Some(result);
                    }
                    
                    // Re-acquire config for next iteration
                    // But since we found no match, continue checking
                    // For simplicity, just return None here and let caller retry
                    return None;
                }
            }
            None
        };
        
        None
    }
    
    /// Check for regex trigger match
    fn check_regex_trigger(
        &mut self, 
        buffer: &str, 
        pattern: &str, 
        replace_text: &str,
        snippet_id: &str,
        has_form: bool,
    ) -> Option<ExpansionResult> {
        // Get or compile regex
        let regex = if let Some(cached) = self.regex_cache.get(pattern) {
            cached
        } else {
            match Regex::new(pattern) {
                Ok(re) => {
                    self.regex_cache.insert(pattern.to_string(), re);
                    self.regex_cache.get(pattern).unwrap()
                }
                Err(e) => {
                    log::error!("Invalid regex pattern '{}': {}", pattern, e);
                    return None;
                }
            }
        };
        
        // Check if buffer ends with a match
        if let Some(mat) = regex.find(buffer) {
            if mat.end() == buffer.len() {
                let matched_text = mat.as_str();
                let replacement = regex.replace(matched_text, replace_text);
                let replacement = self.expand_variables(&replacement);
                
                return Some(ExpansionResult {
                    trigger_len: matched_text.len(),
                    replacement,
                    snippet_id: snippet_id.to_string(),
                    has_form,
                });
            }
        }
        
        None
    }
    
    /// Expand built-in variables in replacement text
    fn expand_variables(&self, text: &str) -> String {
        let now = Local::now();
        
        let mut result = text.to_string();
        
        // Date/time variables
        result = result.replace("{{date}}", &now.format("%Y-%m-%d").to_string());
        result = result.replace("{{time}}", &now.format("%H:%M:%S").to_string());
        result = result.replace("{{datetime}}", &now.format("%Y-%m-%d %H:%M:%S").to_string());
        result = result.replace("{{year}}", &now.format("%Y").to_string());
        result = result.replace("{{month}}", &now.format("%m").to_string());
        result = result.replace("{{day}}", &now.format("%d").to_string());
        result = result.replace("{{hour}}", &now.format("%H").to_string());
        result = result.replace("{{minute}}", &now.format("%M").to_string());
        result = result.replace("{{second}}", &now.format("%S").to_string());
        
        // Day names
        result = result.replace("{{weekday}}", &now.format("%A").to_string());
        result = result.replace("{{weekday_short}}", &now.format("%a").to_string());
        result = result.replace("{{month_name}}", &now.format("%B").to_string());
        result = result.replace("{{month_short}}", &now.format("%b").to_string());
        
        // Clipboard (if requested)
        if result.contains("{{clipboard}}") {
            if let Some(clip_text) = get_clipboard_text() {
                result = result.replace("{{clipboard}}", &clip_text);
            } else {
                result = result.replace("{{clipboard}}", "");
            }
        }
        
        result
    }
    
    /// Execute the expansion
    pub fn execute_expansion(&self, result: &ExpansionResult) -> Result<(), String> {
        replace_text(result.trigger_len, &result.replacement, self.injection_method)?;
        keyboard_hook::clear_buffer();
        log::info!("Expanded snippet: {}", result.snippet_id);
        Ok(())
    }
}

/// Result of a trigger match
#[derive(Debug, Clone)]
pub struct ExpansionResult {
    /// Number of characters to remove (trigger length)
    pub trigger_len: usize,
    /// The replacement text (with variables expanded)
    pub replacement: String,
    /// ID of the matched snippet
    pub snippet_id: String,
    /// Whether this snippet has form fields
    pub has_form: bool,
}

/// Get text from clipboard
fn get_clipboard_text() -> Option<String> {
    use windows::Win32::System::DataExchange::{OpenClipboard, CloseClipboard, GetClipboardData};
    use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
    use windows::Win32::Foundation::{HWND, HGLOBAL};
    
    unsafe {
        if OpenClipboard(HWND::default()).is_err() {
            return None;
        }
        
        // CF_UNICODETEXT = 13
        let handle = match GetClipboardData(13) {
            Ok(h) => h,
            Err(_) => {
                let _ = CloseClipboard();
                return None;
            }
        };
        
        // Convert HANDLE to HGLOBAL
        let hglobal = HGLOBAL(handle.0);
        
        let ptr = GlobalLock(hglobal);
        if ptr.is_null() {
            let _ = CloseClipboard();
            return None;
        }
        
        // Read UTF-16 string
        let mut len = 0;
        let wptr = ptr as *const u16;
        while *wptr.add(len) != 0 {
            len += 1;
        }
        
        let slice = std::slice::from_raw_parts(wptr, len);
        let text = String::from_utf16_lossy(slice);
        
        let _ = GlobalUnlock(hglobal);
        let _ = CloseClipboard();
        
        Some(text)
    }
}
