use std::fs;
use tauri::Manager;

fn ruta_datos(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("items.json"))
}

#[tauri::command]
fn ruta_datos_debug(app: tauri::AppHandle) -> Result<String, String> {
    let ruta = ruta_datos(&app)?;
    let existe = ruta.exists();
    let metadata_len = fs::metadata(&ruta).map(|m| m.len()).unwrap_or(0);
    Ok(format!(
        "{} | existe={} | bytes_metadata={}",
        ruta.to_string_lossy(),
        existe,
        metadata_len
    ))
}

#[tauri::command]
fn cargar_items(app: tauri::AppHandle) -> Result<String, String> {
    let ruta = ruta_datos(&app)?;
    if !ruta.exists() {
        return Ok("[]".to_string());
    }
    fs::read_to_string(&ruta).map_err(|e| e.to_string())
}

#[tauri::command]
fn guardar_items(app: tauri::AppHandle, contenido: String) -> Result<(), String> {
    let ruta = ruta_datos(&app)?;
    fs::write(&ruta, contenido).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![cargar_items, guardar_items, ruta_datos_debug])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
