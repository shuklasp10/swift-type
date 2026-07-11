//! SwiftType - A Modern Text Expander
//!
//! Main library entry point that wires up the Tauri application
//! with the text expansion engine.

mod config;
mod keyboard_hook;
mod text_injector;
mod trigger_engine;

use parking_lot::RwLock;
use serde::Serialize;
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, State};

use config::{AppSettings, ConfigManager, Snippet};
use trigger_engine::TriggerEngine;

/// Application state shared across commands
pub struct AppState {
    config: Arc<RwLock<ConfigManager>>,
    engine: Arc<RwLock<TriggerEngine>>,
    keystroke_buffer: Arc<RwLock<String>>,
}

// ============================================================================
// Tauri Commands - Snippets Management
// ============================================================================

/// Get all snippets
#[tauri::command]
fn get_snippets(state: State<AppState>) -> Vec<Snippet> {
    state.config.read().snippets().to_vec()
}

/// Add a new snippet
#[tauri::command]
fn add_snippet(state: State<AppState>, snippet: Snippet) -> Result<(), String> {
    let mut config = state.config.write();
    config.add_snippet(snippet);
    config.save_config()?;
    Ok(())
}

/// Update an existing snippet
#[tauri::command]
fn update_snippet(state: State<AppState>, id: String, snippet: Snippet) -> Result<bool, String> {
    let mut config = state.config.write();
    let updated = config.update_snippet(&id, snippet);
    if updated {
        config.save_config()?;
    }
    Ok(updated)
}

/// Delete a snippet
#[tauri::command]
fn delete_snippet(state: State<AppState>, id: String) -> Result<bool, String> {
    let mut config = state.config.write();
    let deleted = config.remove_snippet(&id);
    if deleted {
        config.save_config()?;
    }
    Ok(deleted)
}

/// Export snippets to a YAML file
#[tauri::command]
fn export_snippets(state: State<AppState>, path: String) -> Result<(), String> {
    let config = state.config.read();
    config.export_data(&path)
}

/// Import snippets from a YAML file
#[tauri::command]
fn import_snippets(state: State<AppState>, path: String, merge: bool) -> Result<(), String> {
    let mut config = state.config.write();
    config.import_data(&path, merge)
}

// ============================================================================
// Tauri Commands - Settings
// ============================================================================

/// Get application settings
#[tauri::command]
fn get_settings(state: State<AppState>) -> AppSettings {
    state.config.read().settings().clone()
}

/// Update application settings
#[tauri::command]
fn update_settings(
    app: tauri::AppHandle,
    state: State<AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut config = state.config.write();
    let old_start = config.settings().start_with_windows;
    let new_start = settings.start_with_windows;

    *config.settings_mut() = settings;
    config.save_settings()?;

    if old_start != new_start {
        use tauri_plugin_autostart::ManagerExt;
        let autostart = app.autolaunch();
        if new_start {
            let _ = autostart.enable();
        } else {
            let _ = autostart.disable();
        }
    }

    Ok(())
}

/// Clear all data and reset to defaults
#[tauri::command]
fn clear_all_data(state: State<AppState>) -> Result<(), String> {
    let mut config = state.config.write();
    config.clear_all_data()
}

// ============================================================================
// Tauri Commands - Engine Control
// ============================================================================

/// Get engine status
#[tauri::command]
fn get_engine_status(state: State<AppState>) -> EngineStatus {
    let engine = state.engine.read();
    EngineStatus {
        enabled: engine.is_enabled(),
        hook_installed: keyboard_hook::is_hook_installed(),
    }
}

/// Toggle the text expansion engine
#[tauri::command]
fn toggle_engine(state: State<AppState>, enabled: bool) -> Result<(), String> {
    let mut engine = state.engine.write();
    engine.set_enabled(enabled);

    if enabled && !keyboard_hook::is_hook_installed() {
        keyboard_hook::install_hook()?;
    }

    Ok(())
}

/// Clear the keystroke buffer
#[tauri::command]
fn clear_buffer(state: State<AppState>) {
    state.keystroke_buffer.write().clear();
}

/// Get current keystroke buffer (for debugging)
#[tauri::command]
fn get_buffer(state: State<AppState>) -> String {
    state.keystroke_buffer.read().clone()
}

#[derive(Serialize)]
struct EngineStatus {
    enabled: bool,
    hook_installed: bool,
}

// ============================================================================
// Tauri Commands - Search
// ============================================================================

/// Search snippets by trigger or label
#[tauri::command]
fn search_snippets(state: State<AppState>, query: String) -> Vec<Snippet> {
    let config = state.config.read();
    let query_lower = query.to_lowercase();

    config
        .snippets()
        .iter()
        .filter(|s| {
            if let Some(ref trigger) = s.trigger {
                if trigger.to_lowercase().contains(&query_lower) {
                    return true;
                }
            }
            if let Some(ref label) = s.label {
                if label.to_lowercase().contains(&query_lower) {
                    return true;
                }
            }
            s.replace.to_lowercase().contains(&query_lower)
        })
        .cloned()
        .collect()
}

// ============================================================================
// Application Setup
// ============================================================================

fn spawn_worker_thread(
    engine: Arc<RwLock<TriggerEngine>>,
    shared_buffer: Arc<RwLock<String>>,
) -> Result<(), &'static str> {
    let (tx, rx) = mpsc::channel();

    keyboard_hook::set_event_sender(tx)?;

    thread::spawn(move || {
        for event in rx {
            let mut current_buffer = shared_buffer.write();

            match event {
                keyboard_hook::HookEvent::Char(c) => {
                    if !keyboard_hook::is_injecting() {
                        current_buffer.push(c);
                        // Prevent buffer from growing unbounded
                        if current_buffer.len() > 256 {
                            let drain_count = current_buffer.len() - 128;
                            current_buffer.drain(..drain_count);
                        }
                    }
                }
                keyboard_hook::HookEvent::Backspace => {
                    if !keyboard_hook::is_injecting() {
                        current_buffer.pop();
                    }
                }
                keyboard_hook::HookEvent::Clear => {
                    current_buffer.clear();
                }
            }

            // Clone buffer and release lock before evaluating triggers
            let buffer_content = current_buffer.clone();
            drop(current_buffer);

            let mut eng = engine.write();
            if let Some(result) = eng.process_buffer(&buffer_content) {
                if !result.has_form {
                    if let Err(e) = eng.execute_expansion(&result) {
                        log::error!("Failed to execute expansion: {}", e);
                    } else {
                        // Success! Clear buffer
                        shared_buffer.write().clear();
                    }
                }
            }
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting SwiftType...");

    // Initialize configuration
    let config = match ConfigManager::new() {
        Ok(cfg) => Arc::new(RwLock::new(cfg)),
        Err(e) => {
            log::error!("Failed to initialize config: {}", e);
            eprintln!("Failed to initialize config: {}", e);
            return;
        }
    };

    // Initialize trigger engine
    let engine = Arc::new(RwLock::new(TriggerEngine::new(config.clone())));

    let shared_buffer = Arc::new(RwLock::new(String::with_capacity(256)));

    // Set up background worker
    if let Err(e) = spawn_worker_thread(engine.clone(), shared_buffer.clone()) {
        log::error!("Failed to spawn worker thread: {}", e);
    }

    // Install keyboard hook
    if let Err(e) = keyboard_hook::install_hook() {
        log::error!("Failed to install keyboard hook: {}", e);
    }

    let app_state = AppState {
        config,
        engine,
        keystroke_buffer: shared_buffer,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Always show the main window on startup
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Snippets
            get_snippets,
            add_snippet,
            update_snippet,
            delete_snippet,
            search_snippets,
            export_snippets,
            import_snippets,
            // Settings
            get_settings,
            update_settings,
            clear_all_data,
            // Engine
            get_engine_status,
            toggle_engine,
            clear_buffer,
            get_buffer,
        ])
        .on_window_event(|window, event| {
            // Handle window close - minimize to tray instead
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running SwiftType");
}
