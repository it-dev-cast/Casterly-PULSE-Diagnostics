use serde::{Serialize, Deserialize};

/// An inspector record. Per the PRD there is no inspectors table; the list is
/// persisted as a JSON array in the settings key 'inspectors'. Serialized to the
/// frontend with camelCase keys.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Inspector {

    pub id: i64,

    pub inspector_name: String,

    pub employee_id: String,

    pub email: String,

    pub phone: String,

    pub created_date: String,
}
