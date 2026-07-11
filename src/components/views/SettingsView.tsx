import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings, SettingsViewProps } from "../../types";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";

export function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings);
  const [activeSection, setActiveSection] = useState<"behavior" | "data" | "appearance">("behavior");

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!localSettings) return;
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings); // Optimistic update
    try {
      await invoke("update_settings", { settings: newSettings });
      onSave(); // Refresh parent state
    } catch (err) {
      console.error("Failed to save settings:", err);
      setLocalSettings(localSettings); // Revert on failure
    }
  };

  const scrollToSection = (id: "behavior" | "data" | "appearance") => {
    setActiveSection(id);
    const element = document.getElementById(`section-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!localSettings) {
    return <div className="content-area">Loading...</div>;
  }

  return (
    <>
      <div className="content-area content-area-padded">
        <div className="view-header">
          <div>
            <h2 className="header-title">Settings</h2>
            <p className="view-description">
              Manage your app behavior and data preferences.
            </p>
          </div>
        </div>

        <div className="settings-layout">
          {/* Left Navigation */}
          <nav className="settings-nav">
            <button 
              className={`settings-nav-item ${activeSection === "behavior" ? "active" : ""}`}
              onClick={() => scrollToSection("behavior")}
            >
              <span className="material-symbols-outlined icon-md">tune</span>
              App Behavior
            </button>
            <button 
              className={`settings-nav-item ${activeSection === "data" ? "active" : ""}`}
              onClick={() => scrollToSection("data")}
            >
              <span className="material-symbols-outlined icon-md">storage</span>
              Data Management
            </button>
            <button 
              className={`settings-nav-item ${activeSection === "appearance" ? "active" : ""}`}
              onClick={() => scrollToSection("appearance")}
            >
              <span className="material-symbols-outlined icon-md">palette</span>
              Appearance
            </button>
          </nav>

          {/* Right Content */}
          <div className="settings-content">
            
            {/* App Behavior Card */}
            <div id="section-behavior" className="settings-card">
              <div className="settings-card-header">
                <span className="material-symbols-outlined icon-primary">tune</span>
                <h3 className="settings-card-title">App Behavior</h3>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>Launch at Startup</h4>
                  <p>Automatically open SnippetFlow when you log in.</p>
                </div>
                <Toggle
                  active={localSettings.start_with_windows}
                  onClick={() => updateSetting("start_with_windows", !localSettings.start_with_windows)}
                />
              </div>

              <div className="settings-row" style={{ borderTop: "1px solid var(--border-color)" }}>
                <div className="settings-row-info">
                  <h4>Background Sync</h4>
                  <p>Keep snippets updated in the background.</p>
                </div>
                <Toggle
                  active={localSettings.show_in_tray}
                  onClick={() => updateSetting("show_in_tray", !localSettings.show_in_tray)}
                />
              </div>

              <div className="slider-container">
                <div className="slider-header">
                  <h4>Auto-Expansion Delay</h4>
                  <span className="slider-value">{localSettings.undo_backspace_ms}ms</span>
                </div>
                <input 
                  type="range" 
                  className="range-slider" 
                  min="0" max="1000" step="50"
                  value={localSettings.undo_backspace_ms}
                  onChange={(e) => updateSetting("undo_backspace_ms", parseInt(e.target.value))}
                />
                <div className="slider-labels">
                  <span>Fast (0ms)</span>
                  <span>Slow (1s)</span>
                </div>
              </div>

              <div className="settings-row settings-row-bordered mt-sm">
                <div className="settings-row-info">
                  <h4>Injection Method</h4>
                  <p>How snippets are typed out.</p>
                </div>
                <select
                  className="form-input"
                  style={{ width: "200px" }}
                  value={localSettings.injection_method}
                  onChange={(e) => updateSetting("injection_method", e.target.value)}
                >
                  <option value="auto">Auto (Recommended)</option>
                  <option value="keystrokes">Keystrokes</option>
                  <option value="clipboard">Clipboard</option>
                </select>
              </div>

              <div className="settings-row" style={{ borderTop: "1px solid var(--border-color)" }}>
                <div className="settings-row-info">
                  <h4>Search Hotkey</h4>
                  <p>Global shortcut to open search.</p>
                </div>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: "200px" }}
                  value={localSettings.search_hotkey}
                  onChange={(e) => updateSetting("search_hotkey", e.target.value)}
                />
              </div>
            </div>

            {/* Data Management Card */}
            <div id="section-data" className="settings-card">
              <div className="settings-card-header">
                <span className="material-symbols-outlined icon-primary">storage</span>
                <h3 className="settings-card-title">Data Management</h3>
              </div>
              <p className="settings-card-desc">
                Manage your snippet database, sync with the cloud, or create local backups.
              </p>

              <div className="action-cards-grid">
                <div className="action-card">
                  <div className="action-card-header">
                    <span className="material-symbols-outlined">cloud_sync</span>
                    <h4>Cloud Sync</h4>
                  </div>
                  <p>Last synced: Today at 10:42 AM.</p>
                  <Button variant="secondary" className="action-btn-full" onClick={() => {}}>
                    Sync Now
                  </Button>
                </div>
                
                <div className="action-card">
                  <div className="action-card-header">
                    <span className="material-symbols-outlined">download</span>
                    <h4>Export Data</h4>
                  </div>
                  <p>Download all snippets as a JSON file.</p>
                  <Button variant="secondary" className="action-btn-outline" onClick={() => {}}>
                    Export to JSON
                  </Button>
                </div>
              </div>

              <div className="settings-row settings-row-bordered pt-md">
                <div className="settings-row-info">
                  <h4>Restore Backup</h4>
                  <p>Overwrite current data from a backup file.</p>
                </div>
                <Button variant="secondary" className="action-btn-danger" onClick={() => {}}>
                  Restore...
                </Button>
              </div>
            </div>

            {/* Appearance Card */}
            <div id="section-appearance" className="settings-card">
              <div className="settings-card-header">
                <span className="material-symbols-outlined icon-primary">palette</span>
                <h3 className="settings-card-title">Appearance</h3>
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <h4>Theme</h4>
                  <p>Choose your preferred color theme.</p>
                </div>
                <select
                  className="form-input"
                  style={{ width: "200px" }}
                  value={localSettings.theme}
                  onChange={(e) => updateSetting("theme", e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </>
  );
}
