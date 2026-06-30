//! Text Injector Module
//! 
//! Handles injecting replacement text via simulated keystrokes or clipboard.

use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, 
    KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    VK_BACK, VK_CONTROL, VIRTUAL_KEY,
};

use crate::keyboard_hook;

/// Injection method
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum InjectionMethod {
    /// Simulate keystrokes (default)
    Keystrokes,
    /// Use clipboard paste (faster for long text)
    Clipboard,
    /// Automatically choose based on text length
    Auto,
}

impl Default for InjectionMethod {
    fn default() -> Self {
        InjectionMethod::Auto
    }
}

/// Threshold for switching to clipboard method in auto mode
const CLIPBOARD_THRESHOLD: usize = 32;

/// Send a single virtual key press
fn send_key(vk: VIRTUAL_KEY, key_up: bool) {
    let flags = if key_up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS::default() };
    
    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    
    unsafe {
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }
}

/// Send a Unicode character
fn send_unicode_char(ch: char) {
    let scan_code = ch as u16;
    
    // Key down
    let input_down = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(0),
                wScan: scan_code,
                dwFlags: KEYEVENTF_UNICODE,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    
    // Key up
    let input_up = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(0),
                wScan: scan_code,
                dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    
    unsafe {
        SendInput(&[input_down, input_up], std::mem::size_of::<INPUT>() as i32);
    }
}

/// Send multiple backspace key presses
pub fn send_backspaces(count: usize) {
    keyboard_hook::set_injecting(true);
    
    for _ in 0..count {
        send_key(VK_BACK, false);
        send_key(VK_BACK, true);
        // Small delay to ensure keys are processed
        std::thread::sleep(std::time::Duration::from_micros(100));
    }
    
    keyboard_hook::set_injecting(false);
}

/// Inject text using keystrokes
fn inject_via_keystrokes(text: &str) {
    keyboard_hook::set_injecting(true);
    
    for ch in text.chars() {
        send_unicode_char(ch);
        // Small delay between characters for reliability
        std::thread::sleep(std::time::Duration::from_micros(50));
    }
    
    keyboard_hook::set_injecting(false);
}

/// Inject text using clipboard
fn inject_via_clipboard(text: &str) -> Result<(), String> {
    use windows::Win32::System::DataExchange::{
        OpenClipboard, CloseClipboard, EmptyClipboard, SetClipboardData, GetClipboardData,
    };
    use windows::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE,
    };
    use windows::Win32::Foundation::HWND;
    
    keyboard_hook::set_injecting(true);
    
    let result = unsafe {
        // Open clipboard
        OpenClipboard(HWND::default())
            .map_err(|e| format!("Failed to open clipboard: {:?}", e))?;
        
        // Save current clipboard content (optional, for restore)
        let _old_data = GetClipboardData(13); // CF_UNICODETEXT
        
        // Empty clipboard
        if let Err(e) = EmptyClipboard() {
            let _ = CloseClipboard();
            return Err(format!("Failed to empty clipboard: {:?}", e));
        }
        
        // Convert text to UTF-16
        let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let size = wide.len() * 2;
        
        // Allocate global memory
        let hglobal = match GlobalAlloc(GMEM_MOVEABLE, size) {
            Ok(h) => h,
            Err(e) => {
                let _ = CloseClipboard();
                return Err(format!("Failed to allocate memory: {:?}", e));
            }
        };
        
        // Lock and copy data
        let ptr = GlobalLock(hglobal);
        if ptr.is_null() {
            let _ = CloseClipboard();
            return Err("Failed to lock memory".to_string());
        }
        
        std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr as *mut u16, wide.len());
        let _ = GlobalUnlock(hglobal);
        
        // Set clipboard data (CF_UNICODETEXT = 13)
        if let Err(e) = SetClipboardData(13, windows::Win32::Foundation::HANDLE(hglobal.0)) {
            let _ = CloseClipboard();
            return Err(format!("Failed to set clipboard data: {:?}", e));
        }
        
        // Close clipboard
        let _ = CloseClipboard();
        
        Ok(())
    };
    
    // Simulate Ctrl+V
    if result.is_ok() {
        send_key(VK_CONTROL, false);
        send_key(VIRTUAL_KEY(0x56), false); // V key
        send_key(VIRTUAL_KEY(0x56), true);
        send_key(VK_CONTROL, true);
        
        // Small delay for paste to complete
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    
    keyboard_hook::set_injecting(false);
    result
}

/// Inject replacement text using the specified method
pub fn inject_text(text: &str, method: InjectionMethod) -> Result<(), String> {
    let actual_method = match method {
        InjectionMethod::Auto => {
            if text.len() > CLIPBOARD_THRESHOLD {
                InjectionMethod::Clipboard
            } else {
                InjectionMethod::Keystrokes
            }
        }
        other => other,
    };
    
    match actual_method {
        InjectionMethod::Keystrokes => {
            inject_via_keystrokes(text);
            Ok(())
        }
        InjectionMethod::Clipboard => inject_via_clipboard(text),
        InjectionMethod::Auto => unreachable!(),
    }
}

/// Perform a text replacement: remove trigger chars and inject replacement
pub fn replace_text(trigger_len: usize, replacement: &str, method: InjectionMethod) -> Result<(), String> {
    // First, send backspaces to remove the trigger
    send_backspaces(trigger_len);
    
    // Small delay before injecting replacement
    std::thread::sleep(std::time::Duration::from_millis(5));
    
    // Inject the replacement text
    inject_text(replacement, method)?;
    
    Ok(())
}
