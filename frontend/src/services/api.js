const API_BASE = `http://${window.location.hostname}:8080`;

/**
 * Fetch the latest sensor data from MongoDB via the REST API.
 */
export async function fetchSensorData() {
  const res = await fetch(`${API_BASE}/api/sensor-data`);
  if (!res.ok) throw new Error(`Failed to fetch sensor data: ${res.status}`);
  return res.json();
}

/**
 * Fetch sensor data history from MongoDB.
 * @param {number} limit - Number of records to fetch (default 50)
 */
export async function fetchSensorHistory(limit = 50) {
  const res = await fetch(`${API_BASE}/api/sensor-data/history?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch sensor history: ${res.status}`);
  return res.json();
}

/**
 * Fetch the full system status from MongoDB.
 */
export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.status}`);
  return res.json();
}

/**
 * Fetch notifications from MongoDB.
 * @param {number} limit - Number of notifications to fetch (default 50)
 */
export async function fetchNotifications(limit = 50) {
  const res = await fetch(`${API_BASE}/api/notifications?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json();
}
