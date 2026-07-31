import React, { useState, useMemo } from "react";
import { Snippet, SnippetEditorProps } from "../../types";
import { Button } from "../ui/Button";


interface ValidationErrors {
  trigger?: string;
  replace?: string;
}

export function SnippetEditor({ snippet, existingCategories, existingSnippets, onSave, onClose }: SnippetEditorProps) {
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
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Get triggers from other snippets (exclude self when editing, exclude deleted)
  const otherTriggers = useMemo(() => {
    return existingSnippets
      .filter(s => !s.deleted_at && s.trigger && s.id !== snippet?.id)
      .map(s => ({ trigger: s.trigger!, label: s.label }));
  }, [existingSnippets, snippet?.id]);

  // Validate the form and return errors
  const errors = useMemo((): ValidationErrors => {
    const errs: ValidationErrors = {};

    if (useRegex) {
      // Regex validation
      if (!regex.trim()) {
        errs.trigger = "Regex pattern is required.";
      } else {
        try {
          new RegExp(regex);
        } catch {
          errs.trigger = "Invalid regex syntax.";
        }
      }
    } else {
      // Trigger validation
      if (!trigger.trim()) {
        errs.trigger = "Trigger is required.";
      } else {
        // Check for exact duplicate
        const duplicate = otherTriggers.find(t => t.trigger === trigger);
        if (duplicate) {
          const name = duplicate.label ? `"${duplicate.label}"` : `"${duplicate.trigger}"`;
          errs.trigger = `This trigger already exists in snippet ${name}.`;
        } else {
          // Check for prefix collisions
          // Case 1: An existing trigger is a prefix of the new one
          // e.g., existing ":mail" would fire before user can finish typing ":mail2"
          const blockedBy = otherTriggers.find(t => trigger.startsWith(t.trigger) && trigger !== t.trigger);
          if (blockedBy) {
            const name = blockedBy.label ? `"${blockedBy.label}"` : `"${blockedBy.trigger}"`;
            errs.trigger = `Conflict: existing snippet ${name} with trigger "${blockedBy.trigger}" will fire before you can finish typing this trigger.`;
          }

          // Case 2: The new trigger is a prefix of an existing one
          // e.g., adding ":mail" would prevent ":mail2" from ever being reached
          const blocks = otherTriggers.find(t => t.trigger.startsWith(trigger) && t.trigger !== trigger);
          if (!errs.trigger && blocks) {
            const name = blocks.label ? `"${blocks.label}"` : `"${blocks.trigger}"`;
            errs.trigger = `Conflict: this trigger will fire before the user can finish typing "${blocks.trigger}" (snippet ${name}).`;
          }
        }
      }
    }

    // Replacement text validation
    if (!replace.trim()) {
      errs.replace = "Replacement text is required.";
    }

    return errs;
  }, [trigger, regex, replace, useRegex, otherTriggers]);

  const hasErrors = Object.keys(errors).length > 0;

  const insertVariable = (variable: string) => {
    setReplace((prev) => prev + variable);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (hasErrors) {
      return;
    }

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
      usage_count: snippet?.usage_count ?? 0,
      updated_at: Math.floor(Date.now() / 1000),
      is_favorite: snippet?.is_favorite ?? false,
      deleted_at: snippet?.deleted_at ?? null,
    };
    onSave(newSnippet);
  };

  // Show error only after first submit attempt or if the field has been touched
  const showError = (field: keyof ValidationErrors) => hasAttemptedSubmit && errors[field];

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
                className={`form-input font-mono${showError("trigger") ? " form-input-error" : ""}`}
                placeholder={useRegex ? "e.g., :sig(\\d+)" : "e.g., :hello"}
                value={useRegex ? regex : trigger}
                onChange={(e) =>
                  useRegex ? setRegex(e.target.value) : setTrigger(e.target.value)
                }
              />
              {showError("trigger") && (
                <p className="form-error">{errors.trigger}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Replacement Text</label>
              <textarea
                className={`form-input form-textarea${showError("replace") ? " form-input-error" : ""}`}
                placeholder="Enter the text to expand to..."
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
              />
              {showError("replace") && (
                <p className="form-error">{errors.replace}</p>
              )}
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
            <Button type="submit" variant="primary" disabled={hasAttemptedSubmit && hasErrors}>
              {snippet ? "Save Changes" : "Save Snippet"}
            </Button>
          </div>
          </div>
        </form>
      </div>
    </>
  );
}
