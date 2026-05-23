/**
 * Calculates the geodetic distance between two coordinates using the Haversine formula.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined || lon1 === undefined ||
    lat2 === undefined || lon2 === undefined ||
    isNaN(lat1) || isNaN(lon1) ||
    isNaN(lat2) || isNaN(lon2)
  ) {
    return Infinity;
  }

  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // in meters
  return distance;
};

/**
 * Validates if the coordinates are within the geofence radius (Legacy/Fallback).
 * @param {number} userLat Employee current latitude
 * @param {number} userLng Employee current longitude
 * @param {number} officeLat Office latitude
 * @param {number} officeLng Office longitude
 * @param {number} radius Allowed radius in meters
 * @returns {boolean}
 */
export const isInsideGeofence = (userLat, userLng, officeLat, officeLng, radius) => {
  const distance = calculateDistance(userLat, userLng, officeLat, officeLng);
  return distance <= radius;
};

/**
 * Validates if the coordinates are inside a polygon using Ray-Casting algorithm.
 * @param {number} pointLat User latitude
 * @param {number} pointLng User longitude
 * @param {Array<{lat: number, lng: number}>} polygon Boundary array
 * @returns {boolean}
 */
export const isPointInPolygon = (pointLat, pointLng, polygon) => {
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) return false;

  let isInside = false;
  const x = pointLng, y = pointLat;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  
  return isInside;
};

/**
 * Updates coordinates for an employee, queries database geofence configurations, and returns status.
 * @param {string} employeeId Employee ID
 * @param {number} latitude Employee current latitude
 * @param {number} longitude Employee current longitude
 */
export const processGeofenceUpdate = async (employeeId, latitude, longitude) => {
  const { getDb } = await import('../database/db.js');
  const { supabase, checkSupabaseConnection } = await import('../database/supabaseClient.js');
  
  const db = getDb();
  const isSupabaseLive = await checkSupabaseConnection();
  
  // Save coordinates to employee record in SQLite
  await db.run(
    'UPDATE employees SET latitude = ?, longitude = ? WHERE id = ?',
    [latitude, longitude, employeeId]
  );

  // Save to Supabase
  if (isSupabaseLive) {
    await supabase.from('employees').update({ latitude, longitude }).eq('id', employeeId);
  }

  // Retrieve advanced Polygon Geofence
  let activeGeofence = null;
  if (isSupabaseLive) {
    const { data } = await supabase.from('office_geofence').select('polygon_coordinates').order('created_at', { ascending: false }).limit(1).single();
    if (data) activeGeofence = data;
  }

  if (!activeGeofence) {
    activeGeofence = await db.get(`SELECT polygon_coordinates FROM office_geofence ORDER BY created_at DESC LIMIT 1`);
  }
  
  if (activeGeofence && activeGeofence.polygon_coordinates) {
    try {
      // Supabase JSONB returns object, SQLite returns string
      const polygon = typeof activeGeofence.polygon_coordinates === 'string' 
        ? JSON.parse(activeGeofence.polygon_coordinates) 
        : activeGeofence.polygon_coordinates;

      const isInside = isPointInPolygon(latitude, longitude, polygon);
      return {
        latitude,
        longitude,
        isInside,
        polygonBased: true
      };
    } catch (e) {
      console.error('[GEOFENCE PARSE ERROR]', e);
    }
  }

  // Fallback to Radius Settings
  let settings = {};
  if (isSupabaseLive) {
    const { data } = await supabase.from('settings').select('key, value').in('key', ['geofence_lat', 'geofence_lng', 'geofence_radius']);
    if (data && data.length > 0) {
      data.forEach(row => {
        settings[row.key] = parseFloat(row.value);
      });
    }
  }

  if (Object.keys(settings).length === 0) {
    const rows = await db.all("SELECT key, value FROM settings WHERE key IN ('geofence_lat', 'geofence_lng', 'geofence_radius')");
    rows.forEach(row => {
      settings[row.key] = parseFloat(row.value);
    });
  }

  const officeLat = settings.geofence_lat;
  const officeLng = settings.geofence_lng;
  const radius = settings.geofence_radius || 100;

  const distance = calculateDistance(latitude, longitude, officeLat, officeLng);
  const isInside = distance <= radius;

  return {
    latitude,
    longitude,
    distance,
    isInside,
    officeLatitude: officeLat,
    officeLongitude: officeLng,
    radius,
    polygonBased: false
  };
};

