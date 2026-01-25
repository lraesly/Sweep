use keyring::Entry;
use std::sync::mpsc;
use std::thread;
use tiny_http::{Response, Server};
use url::Url;

const SERVICE_NAME: &str = "autosort";

// ============ KEYCHAIN COMMANDS ============

#[tauri::command]
fn store_token(token: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "access_token").map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stored_token() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, "access_token").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "access_token").map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn store_refresh_token(token: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "refresh_token").map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stored_refresh_token() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, "refresh_token").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_refresh_token() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, "refresh_token").map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ============ OAUTH CALLBACK SERVER ============

#[tauri::command]
async fn start_oauth_callback_server() -> Result<String, String> {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let server = Server::http("127.0.0.1:9876").unwrap();

        if let Some(request) = server.incoming_requests().next() {
            let url_str = format!("http://localhost{}", request.url());

            if let Ok(url) = Url::parse(&url_str) {
                if let Some(code) = url
                    .query_pairs()
                    .find(|(key, _)| key == "code")
                    .map(|(_, value)| value.to_string())
                {
                    let response = Response::from_string(
                        "<html><body><h1>Success!</h1><p>You can close this window and return to AutoSort.</p><script>window.close();</script></body></html>"
                    ).with_header(
                        tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap()
                    );
                    let _ = request.respond(response);
                    let _ = tx.send(Ok(code));
                    return;
                }
            }

            let response = Response::from_string(
                "<html><body><h1>Error</h1><p>Authentication failed. Please try again.</p></body></html>",
            );
            let _ = request.respond(response);
            let _ = tx.send(Err("No authorization code received".to_string()));
        }
    });

    rx.recv_timeout(std::time::Duration::from_secs(300))
        .map_err(|_| "OAuth timeout".to_string())?
}

// ============ APP SETUP ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            store_token,
            get_stored_token,
            delete_token,
            store_refresh_token,
            get_stored_refresh_token,
            delete_refresh_token,
            start_oauth_callback_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
