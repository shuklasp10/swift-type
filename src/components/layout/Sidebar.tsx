import { SidebarProps } from "../../types";

export function Sidebar({ activeTab, setActiveTab, onNewSnippet }: SidebarProps) {
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
        <div className="nav-item">
          <span className="material-symbols-outlined sidebar-icon">star</span>
          <span>Favorites</span>
        </div>
        <div className="nav-item">
          <span className="material-symbols-outlined sidebar-icon">folder</span>
          <span>Collections</span>
        </div>
        
        <div className="sidebar-divider"></div>
        
        <div className="nav-item">
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
