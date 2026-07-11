import React, { useState } from "react";
import { Snippet, SnippetEditorProps } from "../../types";
import { Button } from "../ui/Button";


export function SnippetEditor({ snippet, existingCategories, onSave, onClose }: SnippetEditorProps) {
  const [trigger, setTrigger] = useState(snippet?.trigger || "");
  const [replace, setReplace] = useState(snippet?.replace || "");
  const [label, setLabel] = useState(snippet?.label || "");
  const [useRegex, setUseRegex] = useState(!!snippet?.regex);
  const [regex, setRegex] = useState(snippet?.regex || "");
  const [category, setCategory] = useState(snippet?.category || "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterApp, setFilterApp] = useState(snippet?.filter_app || "");
  const [shellCmd, setShellCmd] = useState(snippet?.shell || "");
  const [imagePath, setImagePath] = useState(snippet?.image_path || "");
  const [matchWord, setMatchWord] = useState(!!snippet?.word);

  const insertVariable = (variable: string) => {
    setReplace((prev) => prev + variable);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSnippet: Snippet = {
      id: snippet?.id || `snip_${Date.now()}`,
      trigger: useRegex ? null : trigger,
      regex: useRegex ? regex : null,
      replace,
      label: label || null,
      category: category || null,
      word: matchWord,
      uppercase_style: snippet?.uppercase_style || null,
      image_path: imagePath || null,
      shell: shellCmd || null,
      form_fields: snippet?.form_fields || null,
      filter_app: filterApp || null,
    };
    onSave(newSnippet);
  };

  return (
    <>
      <div className="content-area content-area-padded">
        <div className="view-header">
          <div>
            <h2 className="header-title">
              {snippet ? "Edit Snippet" : "Create Snippet"}
            </h2>
            <p className="view-description">
              Define your shortcut and expansion text.
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ maxWidth: 600 }}>
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
              <label className="form-label">Category</label>
              <input
                type="text"
                list="category-suggestions"
                className="form-input"
                placeholder="e.g., Development, Communication"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="category-suggestions">
                {existingCategories.map(cat => <option key={cat} value={cat} />)}
              </datalist>
            </div>

            <div className="form-group">
              <div className="form-group-header">
                <label className="form-label mb-0">
                  {useRegex ? "Regex Pattern" : "Trigger"}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={useRegex}
                    onChange={(e) => setUseRegex(e.target.checked)}
                  />
                  Use Regex
                </label>
              </div>
              <input
                className="form-input font-mono"
                placeholder={useRegex ? "e.g., :sig(\\d+)" : "e.g., :hello"}
                value={useRegex ? regex : trigger}
                onChange={(e) =>
                  useRegex ? setRegex(e.target.value) : setTrigger(e.target.value)
                }
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
              <p className="form-hint">
                Variables: 
                <button type="button" onClick={() => insertVariable("{{date}}")} style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer", padding: "0 4px" }}>{`{{date}}`}</button>,
                <button type="button" onClick={() => insertVariable("{{time}}")} style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer", padding: "0 4px" }}>{`{{time}}`}</button>,
                <button type="button" onClick={() => insertVariable("{{clipboard}}")} style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer", padding: "0 4px" }}>{`{{clipboard}}`}</button>,
                <button type="button" onClick={() => insertVariable("{{weekday}}")} style={{ background: "none", border: "none", color: "var(--primary-color)", cursor: "pointer", padding: "0 4px" }}>{`{{weekday}}`}</button>
              </p>
            </div>

            <div className="form-group" style={{ marginTop: "var(--space-lg)" }}>
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.875rem", padding: 0 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px", transition: "transform 0.2s", transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)" }}>
                  chevron_right
                </span>
                {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
              </button>
            </div>

            {showAdvanced && (
              <div style={{ paddingLeft: "28px", display: "flex", flexDirection: "column", gap: "var(--space-md)", borderLeft: "2px solid var(--border-color)", marginLeft: "10px", marginTop: "var(--space-md)" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="checkbox-label" style={{ color: "var(--text-primary)" }}>
                    <input
                      type="checkbox"
                      checked={matchWord}
                      onChange={(e) => setMatchWord(e.target.checked)}
                    />
                    Match Whole Word Only
                  </label>
                  <p className="form-hint" style={{ marginLeft: "24px" }}>
                    Trigger will only fire if surrounded by spaces or punctuation.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Filter by Application</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Code.exe, chrome.exe"
                    value={filterApp}
                    onChange={(e) => setFilterApp(e.target.value)}
                  />
                  <p className="form-hint">
                    Only expand this snippet when the specified app is in the foreground.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Run Shell Command</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g., echo 'Hello'"
                    value={shellCmd}
                    onChange={(e) => setShellCmd(e.target.value)}
                  />
                  <p className="form-hint">
                    Execute a system command after expanding the snippet.
                  </p>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Image Path</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="C:\path\to\image.png"
                    value={imagePath}
                    onChange={(e) => setImagePath(e.target.value)}
                  />
                  <p className="form-hint">
                    Optionally paste an image alongside the text.
                  </p>
                </div>
              </div>
            )}

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {snippet ? "Save Changes" : "Save Snippet"}
            </Button>
          </div>
          </div>
        </form>
      </div>
    </>
  );
}
