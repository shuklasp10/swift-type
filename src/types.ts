export interface Snippet {
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
  category?: string | null;
  usage_count?: number | null;
  updated_at?: number | null;
  is_favorite?: boolean | null;
  deleted_at?: number | null;
}

export interface FormField {
  name: string;
  label: string | null;
  default: string;
  field_type: string;
  choices: string[] | null;
}

export interface AppSettings {
  enabled: boolean;
  injection_method: string;
  search_hotkey: string;
  undo_backspace_ms: number;
  start_with_windows: boolean;
  show_in_tray: boolean;
  theme: string;
  toggle_hotkey: string | null;
}

export interface EngineStatus {
  enabled: boolean;
  hook_installed: boolean;
}

export interface SnippetsViewProps {
  activeTab: string;
  snippets: Snippet[];
  onEdit: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, snippet: Snippet) => void;
}

export interface SnippetEditorProps {
  snippet: Snippet | null;
  existingCategories: string[];
  onSave: (snippet: Snippet) => void;
  onClose: () => void;
}

export interface SettingsViewProps {
  settings: AppSettings | null;
  onSave: () => void;
}

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  snippets: Snippet[];
  onNewSnippet: () => void;
}

