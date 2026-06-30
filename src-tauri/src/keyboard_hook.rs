//! Keyboard Hook Module
//! 
//! Implements a global low-level keyboard hook using Windows API
//! to capture keystrokes for text expansion functionality.

use once_cell::sync::OnceCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use parking_lot::Mutex;
use once_cell::sync::Lazy;
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, 
    HC_ACTION, HHOOK, KBDLLHOOKSTRUCT, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
    LLKHF_INJECTED, LLKHF_LOWER_IL_INJECTED,
};

/// Keyboard event sent to the worker thread
#[derive(Debug, Clone, Copy)]
pub enum HookEvent {
    Char(char),
    Backspace,
    Clear,
}

/// Wrapper for HHOOK to make it Send + Sync safe
struct SendHHOOK(HHOOK);
unsafe impl Send for SendHHOOK {}
unsafe impl Sync for SendHHOOK {}

/// Global hook handle
static HOOK_HANDLE: Lazy<Mutex<Option<SendHHOOK>>> = Lazy::new(|| Mutex::new(None));

/// Global sender for passing keystrokes to the worker thread
static HOOK_SENDER: OnceCell<Sender<HookEvent>> = OnceCell::new();

/// Flag to indicate if we're currently injecting text (to avoid recursive hooks)
static IS_INJECTING: AtomicBool = AtomicBool::new(false);

/// Virtual key codes for printable characters
const VK_BACK: u32 = 0x08;
const VK_RETURN: u32 = 0x0D;
const VK_SPACE: u32 = 0x20;
const VK_TAB: u32 = 0x09;
const VK_ESCAPE: u32 = 0x1B;

/// Set the channel sender for keyboard events
pub fn set_event_sender(sender: Sender<HookEvent>) -> Result<(), &'static str> {
    HOOK_SENDER.set(sender).map_err(|_| "Sender already set")
}

/// Set the injecting flag to prevent hook recursion
pub fn set_injecting(value: bool) {
    IS_INJECTING.store(value, Ordering::SeqCst);
}

/// Check if we're currently injecting
pub fn is_injecting() -> bool {
    IS_INJECTING.load(Ordering::SeqCst)
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
                    if let Some(sender) = HOOK_SENDER.get() {
                        let _ = sender.send(HookEvent::Backspace);
                    }
                }
                VK_RETURN | VK_ESCAPE | VK_TAB => {
                    if let Some(sender) = HOOK_SENDER.get() {
                        let _ = sender.send(HookEvent::Clear);
                    }
                }
                _ => {
                    if let Some(ch) = vk_to_char(vk_code, is_shift_pressed()) {
                        if let Some(sender) = HOOK_SENDER.get() {
                            let _ = sender.send(HookEvent::Char(ch));
                        }
                    }
                }
            }
        }
    }
    
    // Always pass to the next hook. We never block keystrokes here to avoid deadlocks.
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
#[allow(dead_code)]
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
