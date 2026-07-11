# SwiftType ⚡

A modern, lightweight text expander for Windows. Alternative to Espanso with a beautiful UI.

![Dark Theme](https://img.shields.io/badge/theme-dark-1a1a20)
![Rust Backend](https://img.shields.io/badge/backend-Rust-orange)
![React Frontend](https://img.shields.io/badge/frontend-React-61dafb)

## Features

- **🚀 Fast & Lightweight** - Built with Rust and Tauri
- **✨ Modern UI** - Dark theme with glassmorphism effects
- **⌨️ Global Hotkeys** - Works in any application
- **📝 YAML Config** - Espanso-compatible format
- **🔄 Variable Expansion** - Date, time, clipboard, and more
- **🎯 Regex Triggers** - Advanced pattern matching

## Installation

> **Note on Windows Defender SmartScreen:** 
> Because SwiftType is currently an unsigned indie application, Windows Defender SmartScreen will likely show a warning when you run the installer ("Windows protected your PC"). 
> This is normal for new/unsigned apps. To proceed with the installation:
> 1. Click **"More info"** on the blue warning screen.
> 2. Click **"Run anyway"**.

### Prerequisites

- [Rust](https://rustup.rs/) 1.70+
- [Node.js](https://nodejs.org/) 18+
- [VS Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) with C++ workload

### Build from Source

```powershell
git clone https://github.com/yourusername/SwiftType.git
cd SwiftType
npm install
npm run tauri dev
```

## Usage

### Creating Snippets

1. Open SwiftType
2. Click **New Snippet**
3. Set a trigger (e.g., `:hello`)
4. Set the replacement text
5. Click **Create Snippet**

### Typing Triggers

Type your trigger in any application and it will automatically expand!

```
:hello → Hello, World!
:date  → 2026-02-05
:sig   → Your signature text
```

### Supported Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{date}}` | Current date | 2026-02-05 |
| `{{time}}` | Current time | 14:30:45 |
| `{{datetime}}` | Date and time | 2026-02-05 14:30:45 |
| `{{weekday}}` | Day name | Wednesday |
| `{{clipboard}}` | Clipboard content | (pasted text) |
| `{{year}}` | Current year | 2026 |
| `{{month}}` | Current month | 02 |
| `{{day}}` | Current day | 05 |

## Configuration

Snippets are stored in `%APPDATA%\swifttype\config.yml`:

```yaml
matches:
  - trigger: ":hello"
    replace: "Hello, World!"
    label: "Greeting"
    
  - trigger: ":date"
    replace: "{{date}}"
    label: "Current Date"
    
  - trigger: ":sig"
    replace: |
      Best regards,
      Your Name
      your@email.com
    label: "Email Signature"
    
  - regex: ":t(\\d+)"
    replace: "Task #$1"
    label: "Task Number"
```

## Development

```powershell
# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Tech Stack

- **Backend**: Rust with Tauri 2.x
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Custom CSS with CSS variables
- **Config**: serde_yaml for YAML parsing

## License

MIT License
