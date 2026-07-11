//! Keyboard Hook Module
//!
//! Implements a global low-level keyboard hook using Windows API
//! to capture keystrokes for text expansion functionality.

use once_cell::sync::Lazy;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, SetWindowsHookExW, UnhookWindowsHookEx, HC_ACTION, HHOOK, KBDLLHOOKSTRUCT,
    LLKHF_INJECTED, LLKHF_LOWER_IL_INJECTED, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
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

/// Convert virtual key code to character using current keyboard layout
fn vk_to_char(vk_code: u32, scan_code: u32) -> Option<char> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, GetKeyboardState, ToUnicode,
    };

    let mut keyboard_state = [0u8; 256];
    let _ = unsafe { GetKeyboardState(&mut keyboard_state) };

    const VK_SHIFT: i32 = 0x10;
    const VK_CONTROL: i32 = 0x11;
    const VK_MENU: i32 = 0x12;
    const VK_CAPITAL: i32 = 0x14;

    unsafe {
        // High bit for pressed state
        keyboard_state[VK_SHIFT as usize] = if GetAsyncKeyState(VK_SHIFT) < 0 {
            0x80
        } else {
            0
        };
        keyboard_state[VK_CONTROL as usize] = if GetAsyncKeyState(VK_CONTROL) < 0 {
            0x80
        } else {
            0
        };
        keyboard_state[VK_MENU as usize] = if GetAsyncKeyState(VK_MENU) < 0 {
            0x80
        } else {
            0
        };

        // Low bit for toggled state (CapsLock)
        let caps_state = GetAsyncKeyState(VK_CAPITAL);
        keyboard_state[VK_CAPITAL as usize] = if (caps_state & 1) != 0 { 1 } else { 0 };
    }

    let mut buffer = [0u16; 4];
    let result = unsafe { ToUnicode(vk_code, scan_code, Some(&keyboard_state), &mut buffer, 0) };

    if result > 0 {
        if let Ok(s) = String::from_utf16(&buffer[0..(result as usize)]) {
            if let Some(ch) = s.chars().next() {
                // Filter out non-printable / control characters
                if !ch.is_control() {
                    return Some(ch);
                }
            }
        }
    }
    None
}

/// Low-level keyboard hook callback
unsafe extern "system" fn keyboard_hook_callback(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    // If we're injecting, skip processing entirely - don't send to channel
    if is_injecting() {
        return CallNextHookEx(None, n_code, w_param, l_param);
    }

    if n_code == HC_ACTION as i32 {
        let kbd_struct = &*(l_param.0 as *const KBDLLHOOKSTRUCT);

        // Also skip injected keys from any process (belt + suspenders)
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
                    let scan_code = kbd_struct.scanCode;
                    if let Some(ch) = vk_to_char(vk_code, scan_code) {
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
        )
        .map_err(|e| format!("Failed to install hook: {:?}", e))?;

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
            UnhookWindowsHookEx(hook).map_err(|e| format!("Failed to uninstall hook: {:?}", e))?;
        }
        log::info!("Keyboard hook uninstalled");
    }

    Ok(())
}

/// Check if hook is installed
pub fn is_hook_installed() -> bool {
    HOOK_HANDLE.lock().is_some()
}
