import { SnippetsViewProps } from "../../types";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";

export function SnippetsView({ snippets, onEdit }: SnippetsViewProps) {
  
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

  return (
    <>
      <div className="content-area content-area-padded">
        <div className="view-header">
          <div>
            <h2 className="header-title">All Snippets</h2>
            <p className="view-description">
              Manage and organize your reusable text blocks.
            </p>
          </div>
          <div className="view-actions">
            <Button variant="secondary" icon={<span className="material-symbols-outlined icon-sm">filter_list</span>}>
              Filter
            </Button>
            <Button variant="secondary" icon={<span className="material-symbols-outlined icon-sm">sort</span>}>
              Sort
            </Button>
          </div>
        </div>

        {/* Snippets Grid */}
        {snippets.length > 0 ? (
          <div className="snippet-grid snippet-grid-mt">
            {snippets.map((snippet) => (
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
                    <IconButton
                      icon={<span className="material-symbols-outlined icon-sm">star</span>}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Favorite toggle logic can be added here
                      }}
                    />
                    <IconButton
                      icon={<span className="material-symbols-outlined icon-sm">content_copy</span>}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(snippet.replace);
                      }}
                    />
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
            <h3 className="empty-state-title">No snippets yet</h3>
            <p className="empty-state-text">
              Create your first snippet to start expanding text automatically
            </p>
          </div>
        )}
      </div>
    </>
  );
}
