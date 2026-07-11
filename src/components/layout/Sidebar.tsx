import { useMemo } from "react";
import { SidebarProps } from "../../types";

export function Sidebar({ activeTab, setActiveTab, snippets, onNewSnippet }: SidebarProps) {
  
  const collections = useMemo(() => {
    const cats = new Set(
      snippets
        .filter(s => !s.deleted_at)
        .map(s => s.category || "General")
    );
    return Array.from(cats).sort();
  }, [snippets]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">⚡</div>
        <h1 className="sidebar-title">SwiftType</h1>
      </div>

      <div className="sidebar-new-btn-wrapper">
        <button 
          className="btn btn-primary sidebar-new-btn" 
          onClick={onNewSnippet}
        >
          <span className="material-symbols-outlined sidebar-icon">add</span>
          New Snippet
        </button>
      </div>

      <nav className="sidebar-nav">
        <div
          className={`nav-item ${activeTab === "snippets" ? "active" : ""}`}
          onClick={() => setActiveTab("snippets")}
        >
          <span className="material-symbols-outlined sidebar-icon">description</span>
          <span>All Snippets</span>
        </div>
        <div 
          className={`nav-item ${activeTab === "favorites" ? "active" : ""}`}
          onClick={() => setActiveTab("favorites")}
        >
          <span className="material-symbols-outlined sidebar-icon">star</span>
          <span>Favorites</span>
        </div>
        
        <div className="nav-item" style={{ pointerEvents: 'none', opacity: 0.7, marginTop: '0.5rem' }}>
          <span className="material-symbols-outlined sidebar-icon">folder</span>
          <span style={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collections</span>
        </div>
        
        {collections.length === 0 && (
           <div className="nav-item" style={{ paddingLeft: '2.5rem', opacity: 0.5, pointerEvents: 'none' }}>
             <span style={{ fontSize: '0.85rem' }}>No collections yet</span>
           </div>
        )}
        
        {collections.map(col => (
          <div 
            key={col}
            className={`nav-item ${activeTab === `collection:${col}` ? "active" : ""}`}
            onClick={() => setActiveTab(`collection:${col}`)}
            style={{ paddingLeft: '2.5rem' }}
          >
            <span className="material-symbols-outlined sidebar-icon" style={{ fontSize: '18px' }}>folder_open</span>
            <span>{col}</span>
          </div>
        ))}
        
        <div className="sidebar-divider"></div>
        
        <div 
          className={`nav-item ${activeTab === "trash" ? "active" : ""}`}
          onClick={() => setActiveTab("trash")}
        >
          <span className="material-symbols-outlined sidebar-icon">delete</span>
          <span>Trash</span>
        </div>
      </nav>
        
      <div className="sidebar-bottom">
        <div className="nav-item">
          <span className="material-symbols-outlined sidebar-icon-small">help</span>
          <span className="sidebar-text-small">Help</span>
        </div>
      </div>
    </aside>
  );
}
