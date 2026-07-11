import React, { useState } from "react";
import { Snippet, SnippetEditorProps } from "../../types";
import { Button } from "../ui/Button";


export function SnippetEditor({ snippet, onSave, onClose }: SnippetEditorProps) {
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
                Variables: {"{{date}}"}, {"{{time}}"}, {"{{clipboard}}"}, {"{{weekday}}"}
              </p>
            </div>
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
