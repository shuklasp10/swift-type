import { useState, useMemo } from "react";
import { SnippetsViewProps } from "../../types";
import { IconButton } from "../ui/IconButton";

export function SnippetsView({ activeTab, snippets, onEdit, onDelete, onUpdate }: SnippetsViewProps) {
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "usage-desc" | "updated-desc">("updated-desc");

  const filteredAndSortedSnippets = useMemo(() => {
    let filtered = snippets.filter(s => {
      if (activeTab === "trash") return !!s.deleted_at;
      if (activeTab === "favorites") return s.is_favorite && !s.deleted_at;
      if (activeTab.startsWith("collection:")) {
        const col = activeTab.split(":")[1];
        const snippetCat = s.category || "General";
        return snippetCat === col && !s.deleted_at;
      }
      return !s.deleted_at;
    });
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.label || a.id).localeCompare(b.label || b.id);
        case "name-desc":
          return (b.label || b.id).localeCompare(a.label || a.id);
        case "usage-desc":
          return (b.usage_count || 0) - (a.usage_count || 0);
        case "updated-desc":
          return (b.updated_at || 0) - (a.updated_at || 0);
        default:
          return 0;
      }
    });
  }, [snippets, activeTab, sortBy]);

  const getCategoryClass = (category?: string | null) => {
    switch (category?.toLowerCase()) {
      case 'communication': return 'category-communication';
      case 'development': return 'category-development';
      default: return 'category-general';
    }
  };

  const formatTimeAgo = (timestamp?: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor(Date.now() / 1000) - timestamp;
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  let title = "All Snippets";
  let description = "Manage and organize your reusable text blocks.";
  if (activeTab === "favorites") {
    title = "Favorites";
    description = "Your starred and most important snippets.";
  } else if (activeTab === "trash") {
    title = "Trash";
    description = "Deleted snippets. They will be permanently removed eventually.";
  } else if (activeTab.startsWith("collection:")) {
    title = activeTab.split(":")[1];
    description = `Snippets in the ${title} collection.`;
  }

  return (
    <>
      <div className="content-area content-area-padded">
        <div className="view-header">
          <div>
            <h2 className="header-title">{title}</h2>
            <p className="view-description">{description}</p>
          </div>
          <div className="view-actions" style={{ display: 'flex', gap: '8px' }}>
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as any)}
              className="form-input"
              style={{ width: 'auto', minWidth: '120px', padding: '4px 8px', fontSize: '13px', height: '32px' }}
            >
              <option value="updated-desc">Recently Updated</option>
              <option value="usage-desc">Most Used</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>
        </div>

        {filteredAndSortedSnippets.length > 0 ? (
          <div className="snippet-grid snippet-grid-mt">
            {filteredAndSortedSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="snippet-card"
                onClick={() => onEdit(snippet)}
              >
                <div className="card-indicator"></div>
                
                <div className="snippet-card-header">
                  <h3 className="snippet-card-title">
                    {snippet.label || snippet.id}
                  </h3>
                  <div className="snippet-card-actions">
                    {activeTab === "trash" ? (
                      <>
                        <IconButton
                          icon={<span className="material-symbols-outlined icon-sm">restore</span>}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(snippet.id, { ...snippet, deleted_at: null });
                          }}
                        />
                        <IconButton
                          icon={<span className="material-symbols-outlined icon-sm">delete_forever</span>}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(snippet.id);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <IconButton
                          icon={<span className="material-symbols-outlined icon-sm" style={{ color: snippet.is_favorite ? '#eab308' : 'inherit' }}>{snippet.is_favorite ? 'star' : 'star_border'}</span>}
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(snippet.id, { ...snippet, is_favorite: !snippet.is_favorite });
                          }}
                        />
                        <IconButton
                          icon={<span className="material-symbols-outlined icon-sm">delete</span>}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(snippet.id);
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="snippet-card-tags">
                  <span className={`tag-chip ${getCategoryClass(snippet.category)}`}>
                    {snippet.category || "General"}
                  </span>
                  <span className="trigger-chip">
                    {snippet.trigger || snippet.regex || "No trigger"}
                  </span>
                </div>

                <div className="snippet-content-box">
                  {snippet.replace}
                  <div className="snippet-content-fade"></div>
                </div>

                <div className="snippet-footer">
                  <span>Used {snippet.usage_count || 0} times</span>
                  <span>Updated {formatTimeAgo(snippet.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined icon-lg">dataset</span>
            </div>
            <h3 className="empty-state-title">No snippets found</h3>
            <p className="empty-state-text">
              {activeTab === "trash" 
                ? "Your trash is empty." 
                : activeTab === "favorites" 
                  ? "You haven't starred any snippets yet."
                  : "Create your first snippet to get started."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
