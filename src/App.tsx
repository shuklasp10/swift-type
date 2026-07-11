import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import snippetsIcon from "./assets/icons/snippets.svg";
import settingsIcon from "./assets/icons/settings.svg";
import plusIcon from "./assets/icons/plus.svg";
import searchIcon from "./assets/icons/search.svg";
import xIcon from "./assets/icons/x.svg";
import zapIcon from "./assets/icons/zap.svg";
import powerIcon from "./assets/icons/power.svg";
import trashIcon from "./assets/icons/trash.svg";
import editIcon from "./assets/icons/edit.svg";

// Types matching Rust structs
interface Snippet {
  id: string;
  trigger: string | null;
  regex: string | null;
  replace: string;
  label: string | null;
  word: boolean;
  uppercase_style: string | null;
  image_path: string | null;
  shell: string | null;
  form_fields: FormField[] | null;
  filter_app: string | null;
}

interface FormField {
  name: string;
  label: string | null;
  default: string;
  field_type: string;
  choices: string[] | null;
}

interface AppSettings {
  enabled: boolean;
  injection_method: string;
  search_hotkey: string;
  undo_backspace_ms: number;
  start_with_windows: boolean;
  show_in_tray: boolean;
  theme: string;
  toggle_hotkey: string | null;
}

interface EngineStatus {
  enabled: boolean;
  hook_installed: boolean;
}


// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState<"snippets" | "settings">("snippets");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [snips, sets, status] = await Promise.all([
        invoke<Snippet[]>("get_snippets"),
        invoke<AppSettings>("get_settings"),
        invoke<EngineStatus>("get_engine_status"),
      ]);
      setSnippets(snips);
      setSettings(sets);
      setEngineStatus(status);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  // Apply theme when settings change
  useEffect(() => {
    if (settings?.theme) {
      const root = document.documentElement;
      if (settings.theme === "system") {
        // Check system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", settings.theme);
      }
    }
  }, [settings?.theme]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      try {
        const results = await invoke<Snippet[]>("search_snippets", { query });
        setSnippets(results);
      } catch (err) {
        console.error("Search failed:", err);
      }
    } else {
      const snips = await invoke<Snippet[]>("get_snippets");
      setSnippets(snips);
    }
  };

  const handleToggleEngine = async () => {
    if (!engineStatus) return;
    try {
      await invoke("toggle_engine", { enabled: !engineStatus.enabled });
      const status = await invoke<EngineStatus>("get_engine_status");
      setEngineStatus(status);
    } catch (err) {
      console.error("Failed to toggle engine:", err);
    }
  };

  const handleSaveSnippet = async (snippet: Snippet) => {
    try {
      if (editingSnippet && editingSnippet.id) {
        await invoke("update_snippet", { id: editingSnippet.id, snippet });
      } else {
        await invoke("add_snippet", { snippet });
      }
      await loadData();
      setShowEditor(false);
      setEditingSnippet(null);
    } catch (err) {
      console.error("Failed to save snippet:", err);
    }
  };

  const handleDeleteSnippet = async (id: string) => {
    try {
      await invoke("delete_snippet", { id });
      await loadData();
    } catch (err) {
      console.error("Failed to delete snippet:", err);
    }
  };

  const handleEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setShowEditor(true);
  };

  const handleNewSnippet = () => {
    setEditingSnippet(null);
    setShowEditor(true);
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">⚡</div>
          <h1 className="sidebar-title">SwiftType</h1>
        </div>

        <nav className="sidebar-nav">
          <div
            className={`nav-item ${activeTab === "snippets" ? "active" : ""}`}
            onClick={() => setActiveTab("snippets")}
          >
            <img src={snippetsIcon} alt="Snippets" />
            <span>Snippets</span>
          </div>
          <div
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <img src={settingsIcon} alt="Settings" />
            <span>Settings</span>
          </div>
        </nav>

        {/* Engine Status */}
        <div style={{ marginTop: "auto", padding: "var(--space-md)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-md)",
              background: "var(--bg-tertiary)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <img src={powerIcon} alt="Power" />
              <span style={{ fontSize: "0.875rem" }}>Engine</span>
            </div>
            <div
              className={`toggle ${engineStatus?.enabled ? "active" : ""}`}
              onClick={handleToggleEngine}
            >
              <div className="toggle-knob" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === "snippets" ? (
          <SnippetsView
            snippets={snippets}
            searchQuery={searchQuery}
            onSearch={handleSearch}
            onNew={handleNewSnippet}
            onEdit={handleEditSnippet}
            onDelete={handleDeleteSnippet}
          />
        ) : (
          <SettingsView settings={settings} onSave={loadData} />
        )}
      </main>

      {/* Snippet Editor Modal */}
      {showEditor && (
        <SnippetEditor
          snippet={editingSnippet}
          onSave={handleSaveSnippet}
          onClose={() => {
            setShowEditor(false);
            setEditingSnippet(null);
          }}
        />
      )}
    </div>
  );
}

// Snippets View Component
interface SnippetsViewProps {
  snippets: Snippet[];
  searchQuery: string;
  onSearch: (query: string) => void;
  onNew: () => void;
  onEdit: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
}

function SnippetsView({ snippets, searchQuery, onSearch, onNew, onEdit, onDelete }: SnippetsViewProps) {
  return (
    <>
      <header className="header">
        <h2 className="header-title">Snippets</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <span className="search-icon">
              <img src={searchIcon} alt="Search" />
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Search snippets..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={onNew}>
            <img src={plusIcon} alt="Plus" />
            New Snippet
          </button>
        </div>
      </header>

      <div className="content-area">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{snippets.length}</div>
            <div className="stat-label">Total Snippets</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {snippets.filter((s) => s.regex).length}
            </div>
            <div className="stat-label">Regex Patterns</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {snippets.filter((s) => s.form_fields).length}
            </div>
            <div className="stat-label">With Forms</div>
          </div>
        </div>

        {/* Snippets Grid */}
        {snippets.length > 0 ? (
          <div className="snippet-grid">
            {snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="snippet-card"
                onClick={() => onEdit(snippet)}
              >
                <div className="snippet-trigger">
                  {snippet.trigger || snippet.regex || "No trigger"}
                </div>
                {snippet.label && (
                  <div className="snippet-label">{snippet.label}</div>
                )}
                <div className="snippet-preview">{snippet.replace}</div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "var(--space-sm)",
                    marginTop: "var(--space-md)",
                  }}
                >
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(snippet);
                    }}
                  >
                    <img src={editIcon} alt="Edit" />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(snippet.id);
                    }}
                  >
                    <img src={trashIcon} alt="Trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <img src={snippetsIcon} alt="Snippets" />
            </div>
            <h3 className="empty-state-title">No snippets yet</h3>
            <p className="empty-state-text">
              Create your first snippet to start expanding text automatically
            </p>
            <button className="btn btn-primary" onClick={onNew}>
              <img src={plusIcon} alt="Plus" />
              Create Snippet
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// Snippet Editor Modal
interface SnippetEditorProps {
  snippet: Snippet | null;
  onSave: (snippet: Snippet) => void;
  onClose: () => void;
}

function SnippetEditor({ snippet, onSave, onClose }: SnippetEditorProps) {
  const [trigger, setTrigger] = useState(snippet?.trigger || "");
  const [replace, setReplace] = useState(snippet?.replace || "");
  const [label, setLabel] = useState(snippet?.label || "");
  const [useRegex, setUseRegex] = useState(!!snippet?.regex);
  const [regex, setRegex] = useState(snippet?.regex || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSnippet: Snippet = {
      id: snippet?.id || `snip_${Date.now()}`,
      trigger: useRegex ? null : trigger,
      regex: useRegex ? regex : null,
      replace,
      label: label || null,
      word: snippet?.word || false,
      uppercase_style: snippet?.uppercase_style || null,
      image_path: snippet?.image_path || null,
      shell: snippet?.shell || null,
      form_fields: snippet?.form_fields || null,
      filter_app: snippet?.filter_app || null,
    };
    onSave(newSnippet);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {snippet ? "Edit Snippet" : "New Snippet"}
          </h3>
          <button className="btn-icon" onClick={onClose}>
            <img src={xIcon} alt="Close" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Label (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Email Signature"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-sm)" }}>
                <label className="form-label" style={{ margin: 0 }}>
                  {useRegex ? "Regex Pattern" : "Trigger"}
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={useRegex}
                    onChange={(e) => setUseRegex(e.target.checked)}
                  />
                  Use Regex
                </label>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder={useRegex ? "e.g., :sig(\\d+)" : "e.g., :hello"}
                value={useRegex ? regex : trigger}
                onChange={(e) =>
                  useRegex ? setRegex(e.target.value) : setTrigger(e.target.value)
                }
                style={{ fontFamily: "var(--font-mono)" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Replacement Text</label>
              <textarea
                className="form-input form-textarea"
                placeholder="Enter the text to expand to..."
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
                Variables: {"{{date}}"}, {"{{time}}"}, {"{{clipboard}}"}, {"{{weekday}}"}
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {snippet ? "Save Changes" : "Create Snippet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Settings View Component
interface SettingsViewProps {
  settings: AppSettings | null;
  onSave: () => void;
}

function SettingsView({ settings, onSave }: SettingsViewProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    if (!localSettings) return;
    try {
      await invoke("update_settings", { settings: localSettings });
      onSave();
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  if (!localSettings) {
    return <div className="content-area">Loading...</div>;
  }

  return (
    <>
      <header className="header">
        <h2 className="header-title">Settings</h2>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </header>

      <div className="content-area">
        <div style={{ maxWidth: 600 }}>
          <div className="form-group">
            <label className="form-label">Injection Method</label>
            <select
              className="form-input"
              value={localSettings.injection_method}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, injection_method: e.target.value })
              }
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="keystrokes">Keystrokes</option>
              <option value="clipboard">Clipboard</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Search Hotkey</label>
            <input
              type="text"
              className="form-input"
              value={localSettings.search_hotkey}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, search_hotkey: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">Theme</label>
            <select
              className="form-input"
              value={localSettings.theme}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, theme: e.target.value })
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          <div
            className="form-group"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <label className="form-label" style={{ marginBottom: 0 }}>
              Start with Windows
            </label>
            <div
              className={`toggle ${localSettings.start_with_windows ? "active" : ""}`}
              onClick={() =>
                setLocalSettings({
                  ...localSettings,
                  start_with_windows: !localSettings.start_with_windows,
                })
              }
            >
              <div className="toggle-knob" />
            </div>
          </div>

          <div
            className="form-group"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <label className="form-label" style={{ marginBottom: 0 }}>
              Show in System Tray
            </label>
            <div
              className={`toggle ${localSettings.show_in_tray ? "active" : ""}`}
              onClick={() =>
                setLocalSettings({
                  ...localSettings,
                  show_in_tray: !localSettings.show_in_tray,
                })
              }
            >
              <div className="toggle-knob" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
