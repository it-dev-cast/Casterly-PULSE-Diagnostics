// Shared "refurb grade" derivation used both when persisting an inspection
// (so `grade` is stored as a real column/JSON field, not just implied by the
// grading blob) and when reading inspections back for the Dashboard. Keeping
// a single implementation guarantees the grade shown on screen always
// matches the grade written to the database and synced to Supabase.

use serde_json::Value;

/// A device is "failed" if any cosmetic component or functional test is FAIL.
pub fn is_failed(json: &Value) -> bool {
    if let Some(g) = json.get("grading").and_then(|v| v.as_object()) {
        for (k, v) in g {
            if k.ends_with("_status")
                && v.as_str()
                    .map(|s| s.eq_ignore_ascii_case("FAIL"))
                    .unwrap_or(false)
            {
                return true;
            }
        }
    }
    for t in [
        "speaker_test",
        "webcam_test",
        "keyboard_test",
        "touchpad_test",
        "battery_assessment",
    ] {
        if json
            .pointer(&format!("/{}/result", t))
            .and_then(|v| v.as_str())
            .map(|s| s.eq_ignore_ascii_case("FAIL"))
            .unwrap_or(false)
        {
            return true;
        }
    }
    false
}

/// Derive a refurb grade from the stored grading (C = any fail, A = all pass,
/// otherwise B).
pub fn grade_for(json: &Value) -> String {
    if is_failed(json) {
        return "C".to_string();
    }
    if let Some(g) = json.get("grading").and_then(|v| v.as_object()) {
        let all_pass = g
            .iter()
            .filter(|(k, _)| k.ends_with("_status"))
            .all(|(_, v)| {
                v.as_str()
                    .map(|s| s.eq_ignore_ascii_case("PASS"))
                    .unwrap_or(false)
            });
        if all_pass {
            return "A".to_string();
        }
    }
    "B".to_string()
}
