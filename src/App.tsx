import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import type { Snippet, AppSettings, EngineStatus } from "./types";

import { Sidebar } from "./components/layout/Sidebar";
import { SnippetsView } from "./components/views/SnippetsView";
import { SettingsView } from "./components/views/SettingsView";
import { SnippetEditor } from "./components/modals/SnippetEditor";
import { Toggle } from "./components/ui/Toggle";

// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState<string>("snippets");
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  const existingCategories = Array.from(new Set(snippets.filter(s => !s.deleted_at).map(s => s.category || "General"))).sort();

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
      setActiveTab("snippets");
      setEditingSnippet(null);
    } catch (err) {
      console.error("Failed to save snippet:", err);
    }
  };

  const handleUpdateSnippet = async (id: string, snippet: Snippet) => {
    try {
      await invoke("update_snippet", { id, snippet });
      await loadData();
    } catch (err) {
      console.error("Failed to update snippet:", err);
    }
  };

  const handleDeleteSnippet = async (id: string) => {
    try {
      const snippet = snippets.find(s => s.id === id);
      if (snippet && !snippet.deleted_at && activeTab !== "trash") {
        // Soft delete
        const updated = { ...snippet, deleted_at: Date.now() };
        await invoke("update_snippet", { id, snippet: updated });
      } else {
        // Hard delete
        await invoke("delete_snippet", { id });
      }
      await loadData();
    } catch (err) {
      console.error("Failed to delete snippet:", err);
    }
  };

  const handleEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setActiveTab("editor");
  };

  const handleNewSnippet = () => {
    setEditingSnippet(null);
    setActiveTab("editor");
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        snippets={snippets}
        onNewSnippet={handleNewSnippet}
      />

      {/* Main Content */}
      <main className="main-content">
        {/* Top App Bar */}
        <header className="top-app-bar">
          <div className="search-wrapper">
            <span className="search-icon">
              <span className="material-symbols-outlined search-icon-symbol">search</span>
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Search snippets, tags, or content..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="top-bar-actions">
            <div className="engine-toggle-wrapper">
              <div className="engine-toggle-label">
                <span className="material-symbols-outlined engine-toggle-icon">power_settings_new</span>
                <span className="engine-toggle-text">Engine</span>
              </div>
              <Toggle active={engineStatus?.enabled || false} onClick={handleToggleEngine} />
            </div>
            <button className="btn-icon" onClick={loadData} title="Sync/Refresh">
              <span className="material-symbols-outlined">sync</span>
            </button>
            <button className="btn-icon" onClick={() => setActiveTab("settings")} title="Settings">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        {(activeTab === "snippets" || activeTab === "favorites" || activeTab === "trash" || activeTab.startsWith("collection:")) && (
          <SnippetsView
            activeTab={activeTab}
            snippets={snippets}
            onEdit={handleEditSnippet}
            onDelete={handleDeleteSnippet}
            onUpdate={handleUpdateSnippet}
          />
        )}
        
        {activeTab === "settings" && (
          <SettingsView settings={settings} onSave={loadData} />
        )}
        
        {activeTab === "editor" && (
          <SnippetEditor
            snippet={editingSnippet}
            existingCategories={existingCategories}
            onSave={handleSaveSnippet}
            onClose={() => {
              setActiveTab("snippets");
              setEditingSnippet(null);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
