//! Keyboard Hook Module
//! 
//! Implements a global low-level keyboard hook using Windows API
//! to capture keystrokes for text expansion functionality.

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, 
    HC_ACTION, HHOOK, KBDLLHOOKSTRUCT, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
    LLKHF_INJECTED, LLKHF_LOWER_IL_INJECTED,
};

/// Maximum buffer size for typed characters
const MAX_BUFFER_SIZE: usize = 256;

/// Wrapper for HHOOK to make it Send + Sync safe
/// SAFETY: HHOOK is just a handle (pointer) that can be used from any thread
struct SendHHOOK(HHOOK);
unsafe impl Send for SendHHOOK {}
unsafe impl Sync for SendHHOOK {}

/// Global hook handle
static HOOK_HANDLE: Lazy<Mutex<Option<SendHHOOK>>> = Lazy::new(|| Mutex::new(None));

/// Buffer for typed characters
static KEYSTROKE_BUFFER: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::with_capacity(MAX_BUFFER_SIZE)));

/// Flag to indicate if we're currently injecting text (to avoid recursive hooks)
static IS_INJECTING: AtomicBool = AtomicBool::new(false);

/// Flag to indicate the current keystroke should be blocked (trigger was matched)
static SHOULD_BLOCK_KEYSTROKE: AtomicBool = AtomicBool::new(false);

/// Callback function pointer for when a trigger is detected
/// Returns true if a trigger was matched and keystroke should be blocked
static TRIGGER_CALLBACK: Lazy<Mutex<Option<Box<dyn Fn(String) -> bool + Send + Sync>>>> = 
    Lazy::new(|| Mutex::new(None));

/// Virtual key codes for printable characters
const VK_BACK: u32 = 0x08;
const VK_RETURN: u32 = 0x0D;
const VK_SPACE: u32 = 0x20;
const VK_TAB: u32 = 0x09;
const VK_ESCAPE: u32 = 0x1B;

/// Set the trigger detection callback
/// The callback should return true if a trigger was matched (to block the keystroke)
pub fn set_trigger_callback<F>(callback: F) 
where 
    F: Fn(String) -> bool + Send + Sync + 'static 
{
    let mut cb = TRIGGER_CALLBACK.lock();
    *cb = Some(Box::new(callback));
}

/// Get the current keystroke buffer
pub fn get_buffer() -> String {
    KEYSTROKE_BUFFER.lock().clone()
}

/// Clear the keystroke buffer
pub fn clear_buffer() {
    KEYSTROKE_BUFFER.lock().clear();
}

/// Set the injecting flag to prevent hook recursion
pub fn set_injecting(value: bool) {
    IS_INJECTING.store(value, Ordering::SeqCst);
}

/// Check if we're currently injecting
pub fn is_injecting() -> bool {
    IS_INJECTING.load(Ordering::SeqCst)
}

/// Remove characters from the end of the buffer
pub fn remove_chars_from_buffer(count: usize) {
    let mut buffer = KEYSTROKE_BUFFER.lock();
    let new_len = buffer.len().saturating_sub(count);
    buffer.truncate(new_len);
}

/// Convert virtual key code to character (simplified)
fn vk_to_char(vk_code: u32, shift_pressed: bool) -> Option<char> {
    match vk_code {
        // Letters A-Z
        0x41..=0x5A => {
            let base = (vk_code - 0x41) as u8 + b'a';
            Some(if shift_pressed { 
                (base - 32) as char 
            } else { 
                base as char 
            })
        }
        // Numbers 0-9
        0x30..=0x39 => Some((vk_code as u8) as char),
        // Numpad 0-9
        0x60..=0x69 => Some((b'0' + (vk_code - 0x60) as u8) as char),
        // Common punctuation
        VK_SPACE => Some(' '),
        0xBA => Some(if shift_pressed { ':' } else { ';' }),  // ; :
        0xBB => Some(if shift_pressed { '+' } else { '=' }),  // = +
        0xBC => Some(if shift_pressed { '<' } else { ',' }),  // , <
        0xBD => Some(if shift_pressed { '_' } else { '-' }),  // - _
        0xBE => Some(if shift_pressed { '>' } else { '.' }),  // . >
        0xBF => Some(if shift_pressed { '?' } else { '/' }),  // / ?
        0xC0 => Some(if shift_pressed { '~' } else { '`' }),  // ` ~
        0xDB => Some(if shift_pressed { '{' } else { '[' }),  // [ {
        0xDC => Some(if shift_pressed { '|' } else { '\\' }), // \ |
        0xDD => Some(if shift_pressed { '}' } else { ']' }),  // ] }
        0xDE => Some(if shift_pressed { '"' } else { '\'' }), // ' "
        _ => None,
    }
}

/// Check if shift key is pressed
fn is_shift_pressed() -> bool {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    const VK_SHIFT: i32 = 0x10;
    unsafe { GetAsyncKeyState(VK_SHIFT) < 0 }
}

/// Low-level keyboard hook callback
unsafe extern "system" fn keyboard_hook_callback(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    // If we're injecting, skip processing
    if is_injecting() {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    if n_code == HC_ACTION as i32 {
        let kbd_struct = &*(l_param.0 as *const KBDLLHOOKSTRUCT);
        
        // Skip injected keys to prevent infinite loops
        let flags = kbd_struct.flags.0;
        if (flags & LLKHF_INJECTED.0) != 0 || (flags & LLKHF_LOWER_IL_INJECTED.0) != 0 {
            return CallNextHookEx(None, n_code, w_param, l_param);
        }

        let msg_type = w_param.0 as u32;
        if msg_type == WM_KEYDOWN || msg_type == WM_SYSKEYDOWN {
            let vk_code = kbd_struct.vkCode;
            
            match vk_code {
                VK_BACK => {
                    // Handle backspace - remove last character from buffer
                    let mut buffer = KEYSTROKE_BUFFER.lock();
                    buffer.pop();
                }
                VK_RETURN | VK_ESCAPE | VK_TAB => {
                    // Clear buffer on Enter, Escape, or Tab
                    clear_buffer();
                }
                _ => {
                    // Try to convert to character
                    if let Some(ch) = vk_to_char(vk_code, is_shift_pressed()) {
                        let mut buffer = KEYSTROKE_BUFFER.lock();
                        buffer.push(ch);
                        
                        // Prevent buffer from growing too large
                        if buffer.len() > MAX_BUFFER_SIZE {
                            let drain_count = buffer.len() - MAX_BUFFER_SIZE / 2;
                            buffer.drain(..drain_count);
                        }
                        
                        // Clone buffer and trigger callback
                        let buffer_content = buffer.clone();
                        drop(buffer); // Release lock before callback
                        
                        // Call trigger callback if set
                        let callback = TRIGGER_CALLBACK.lock();
                        if let Some(ref cb) = *callback {
                            if cb(buffer_content) {
                                // Trigger was matched - block this keystroke
                                SHOULD_BLOCK_KEYSTROKE.store(true, Ordering::SeqCst);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Check if we should block the keystroke
    if SHOULD_BLOCK_KEYSTROKE.swap(false, Ordering::SeqCst) {
        return LRESULT(1); // Block the keystroke
    }

    CallNextHookEx(None, n_code, w_param, l_param)
}

/// Install the keyboard hook
pub fn install_hook() -> Result<(), String> {
    let mut handle = HOOK_HANDLE.lock();
    
    if handle.is_some() {
        return Err("Hook already installed".to_string());
    }

    unsafe {
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_hook_callback),
            HINSTANCE::default(),
            0,
        ).map_err(|e| format!("Failed to install hook: {:?}", e))?;
        
        *handle = Some(SendHHOOK(hook));
    }
    
    log::info!("Keyboard hook installed successfully");
    Ok(())
}

/// Uninstall the keyboard hook
pub fn uninstall_hook() -> Result<(), String> {
    let mut handle = HOOK_HANDLE.lock();
    
    if let Some(SendHHOOK(hook)) = handle.take() {
        unsafe {
            UnhookWindowsHookEx(hook)
                .map_err(|e| format!("Failed to uninstall hook: {:?}", e))?;
        }
        log::info!("Keyboard hook uninstalled");
    }
    
    Ok(())
}

/// Check if hook is installed
pub fn is_hook_installed() -> bool {
    HOOK_HANDLE.lock().is_some()
}
