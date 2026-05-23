import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 1. BIOMETRIC CRYPTOGRAPHY (Web Crypto API)
// ==========================================

const ALGORITHM = 'AES-CBC';
const SECRET = 'super-secure-neon-quantum-jwt-secret-key-9824';

/**
 * Derives a secure 256-bit key from the local secret key using SHA-256.
 */
const getCryptoKey = async () => {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(SECRET);
  const hash = await window.crypto.subtle.digest('SHA-256', secretBytes);
  return await window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts a 128-float array biometric descriptor.
 */
export const encryptDescriptor = async (descriptorArray) => {
  if (!Array.isArray(descriptorArray) || descriptorArray.length === 0) {
    throw new Error('Biometric data must be a valid float array.');
  }

  const text = JSON.stringify(descriptorArray);
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(text);
  const cryptoKey = await getCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(16));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    plainBytes
  );

  // Convert Uint8Arrays to hexadecimal string
  const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${toHex(iv)}:${toHex(encryptedBuffer)}`;
};

/**
 * Decrypts a biometric descriptor string to a 128-float array.
 * Supports legacy unencrypted JSON representation fallbacks.
 */
export const decryptDescriptor = async (encryptedString) => {
  if (!encryptedString) return null;

  const trimmed = encryptedString.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      console.error('[BIOMETRIC DECRYPTION FALLBACK ERROR]: Failed parsing unencrypted JSON:', e);
      return null;
    }
  }

  try {
    const parts = trimmed.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid cipher format. Expected iv:data');
    }

    const hexToBytes = (hex) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, (i * 2) + 2), 16);
      }
      return bytes;
    };

    const iv = hexToBytes(parts[0]);
    const encryptedBytes = hexToBytes(parts[1]);
    const cryptoKey = await getCryptoKey();

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      cryptoKey,
      encryptedBytes
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (error) {
    console.error('[BIOMETRIC DECRYPTION ERROR]: Critical failure during decryption:', error);
    return null;
  }
};

// ==========================================
// 2. MATHEMATICAL GEOFENCING CALCULATIONS
// ==========================================

/**
 * Calculates geodetic distance between coordinates using Haversine formula.
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

  return R * c; // in meters
};

/**
 * Validates if coordinates are inside a polygon using Ray-Casting algorithm.
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

// ==========================================
// 3. SYSTEM BIOMETRIC ENGINE HELPERS
// ==========================================

export const calculateEuclideanDistance = (vectorA, vectorB) => {
  if (vectorA.length !== vectorB.length) return Infinity;
  let sum = 0.0;
  for (let i = 0; i < vectorA.length; i++) {
    const diff = vectorA[i] - vectorB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

export const verifyLiveness = (faceMetrics) => {
  const { spoofIndex } = faceMetrics || { spoofIndex: 0.1 };
  if (spoofIndex && spoofIndex > 0.4) {
    return {
      passed: false,
      reason: 'Anti-Spoof Check Failed: Low liveness probability.'
    };
  }
  return { passed: true, reason: 'Liveness verified.' };
};

const broadcastRealtimeEvent = async (eventName, payload) => {
  try {
    const channel = supabase.channel('system_events');
    await channel.send({
      type: 'broadcast',
      event: eventName,
      payload
    });
  } catch (err) {
    console.error('[REALTIME BROADCAST ERROR]:', err);
  }
};

// ==========================================
// 4. API CALL INTERCEPT ENGINE (100% Serverless)
// ==========================================

const matchRoute = (path, pattern) => {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].substring(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
};

export const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  console.log(`[CLIENT-SIDE API CALL INTERCEPT]: ${method} ${endpoint}`, body);

  try {
    // 1. GET /employees (Fetch all employees)
    if (endpoint === '/employees' && method === 'GET') {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, role, department, avatar, status, latitude, longitude, created_at, face_data');
      if (error) throw new Error(error.message);
      const employees = (data || []).map(emp => ({
        ...emp,
        is_face_registered: emp.face_data !== null
      }));
      employees.forEach(emp => delete emp.face_data);
      return { success: true, employees };
    }

    // 2. POST /employees (Add Employee & Silently create in Supabase Auth)
    if (endpoint === '/employees' && method === 'POST') {
      const { id, name, email, password, role, department } = body;
      
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email,
        password,
        options: { data: { name, role, department } }
      });

      if (authError && !authError.message.includes('already registered')) {
        throw new Error(`Auth Provider registration failed: ${authError.message}`);
      }

      // Add to employees table
      const { error: dbError } = await supabase.from('employees').insert({
        id, name, email, password, role, department, status: 'Offline'
      });

      if (dbError) throw new Error(`Database record insertion failed: ${dbError.message}`);
      return { success: true, message: 'Employee profile created successfully.' };
    }

    // 3. GET /employees/:id (Fetch single employee details)
    const empMatch = matchRoute(endpoint, '/employees/:id');
    if (empMatch && method === 'GET') {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, email, role, department, avatar, status, latitude, longitude, created_at, face_data')
        .eq('id', empMatch.id)
        .single();
      if (error) throw new Error(error.message);
      const employee = {
        ...data,
        is_face_registered: data.face_data !== null
      };
      delete employee.face_data;
      return { success: true, employee };
    }

    // 4. PUT /employees/:id (Update employee profile details)
    const empUpdateMatch = matchRoute(endpoint, '/employees/:id');
    if (empUpdateMatch && method === 'PUT') {
      const { name, email, role, department, password } = body;
      const updates = { name, email, role, department };
      if (password) updates.password = password;
      
      const { error } = await supabase.from('employees').update(updates).eq('id', empUpdateMatch.id);
      if (error) throw new Error(error.message);
      return { success: true, message: 'Employee profile updated successfully.' };
    }

    // 5. DELETE /employees/:id (Delete employee record)
    const empDeleteMatch = matchRoute(endpoint, '/employees/:id');
    if (empDeleteMatch && method === 'DELETE') {
      const { error } = await supabase.from('employees').delete().eq('id', empDeleteMatch.id);
      if (error) throw new Error(error.message);
      return { success: true, message: 'Employee profile deleted successfully.' };
    }

    // 6. POST /employees/:id/face (Enroll facial biometric template)
    const faceMatch = matchRoute(endpoint, '/employees/:id/face');
    if (faceMatch && method === 'POST') {
      const { faceDescriptor } = body;
      const empId = faceMatch.id;

      // Duplicate Check
      const { data: existingFaces, error: fetchError } = await supabase
        .from('employees')
        .select('id, name, face_data')
        .not('face_data', 'is', null)
        .neq('id', empId);
      if (fetchError) throw new Error(fetchError.message);

      for (const emp of (existingFaces || [])) {
        const dbDescriptor = await decryptDescriptor(emp.face_data);
        if (!dbDescriptor) continue;
        const distance = calculateEuclideanDistance(faceDescriptor, dbDescriptor);
        if (distance <= 0.55) {
          throw new Error(`This biometric identity already belongs to ${emp.name}.`);
        }
      }

      const encrypted = await encryptDescriptor(faceDescriptor);
      const { error: updateError } = await supabase
        .from('employees')
        .update({ face_data: encrypted })
        .eq('id', empId);
      if (updateError) throw new Error(updateError.message);

      return { success: true, message: `Face biometrics successfully recorded for Employee ${empId}.` };
    }

    // 7. POST /employees/:id/reset-face (Clear facial template)
    const faceResetMatch = matchRoute(endpoint, '/employees/:id/reset-face');
    if (faceResetMatch && method === 'POST') {
      const { error } = await supabase.from('employees').update({ face_data: null }).eq('id', faceResetMatch.id);
      if (error) throw new Error(error.message);
      return { success: true, message: 'Biometric face descriptor removed successfully.' };
    }

    // 8. GET /settings (Fetch settings ledger)
    if (endpoint === '/settings' && method === 'GET') {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw new Error(error.message);
      const settingsObj = {};
      (data || []).forEach(row => {
        settingsObj[row.key] = row.value;
      });
      // Seed default fallbacks
      if (Object.keys(settingsObj).length === 0) {
        settingsObj['geofence_lat'] = '28.6139';
        settingsObj['geofence_lng'] = '77.2090';
        settingsObj['geofence_radius'] = '100';
      }
      return { success: true, settings: settingsObj };
    }

    // 9. POST /settings (Writhe settings ledger values)
    if (endpoint === '/settings' && method === 'POST') {
      const rows = Object.entries(body).map(([key, val]) => ({ key, value: String(val) }));
      const { error } = await supabase.from('settings').upsert(rows);
      if (error) throw new Error(error.message);
      return { success: true, message: 'Settings saved successfully.' };
    }

    // 10. GET /settings/geofence (Get polygon coordinates)
    if (endpoint === '/settings/geofence' && method === 'GET') {
      const { data, error } = await supabase
        .from('office_geofence')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { success: true, geofence: data || null };
    }

    // 11. POST /settings/geofence (Add geofence polygon)
    if (endpoint === '/settings/geofence' && method === 'POST') {
      const { officeName, polygonCoordinates, createdBy } = body;
      const { error } = await supabase.from('office_geofence').insert({
        office_name: officeName,
        polygon_coordinates: polygonCoordinates,
        created_by: createdBy
      });
      if (error) throw new Error(error.message);
      return { success: true, message: 'Office geofence polygon saved successfully.' };
    }

    // 12. GET /attendance (Get unified check in records)
    if (endpoint === '/attendance' && method === 'GET') {
      const { data, error } = await supabase
        .from('attendance')
        .select('*, employees (name, department)')
        .order('date', { ascending: false })
        .order('check_in', { ascending: false });
      if (error) throw new Error(error.message);
      
      const logs = (data || []).map(item => ({
        ...item,
        name: item.employees?.name,
        department: item.employees?.department
      }));
      logs.forEach(item => delete item.employees);
      return { success: true, logs };
    }

    // 13. POST /attendance/clear (Wipe attendance ledger)
    if (endpoint === '/attendance/clear' && method === 'POST') {
      const { error: attErr } = await supabase.from('attendance').delete().neq('id', 0);
      if (attErr) throw new Error(attErr.message);

      const { error: empErr } = await supabase.from('employees').update({ status: 'Offline' }).neq('id', '0');
      if (empErr) throw new Error(empErr.message);

      return { success: true, message: 'All attendance records have been wiped successfully.' };
    }

    // 14. POST /logs/clear (Clear event logs)
    if (endpoint === '/logs/clear' && method === 'POST') {
      const { error } = await supabase.from('logs').delete().neq('id', 0);
      if (error) throw new Error(error.message);
      return { success: true, message: 'System audit logs cleared successfully.' };
    }

    // 15. GET /attendance/history/:employeeId (Fetch history for employee)
    const histMatch = matchRoute(endpoint, '/attendance/history/:employeeId');
    if (histMatch && method === 'GET') {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', histMatch.employeeId)
        .order('date', { ascending: false });
      if (error) throw new Error(error.message);
      return { success: true, history: data || [] };
    }

    // 16. POST /employees/:id/coordinates (Update location and recalculate boundary)
    const coordMatch = matchRoute(endpoint, '/employees/:id/coordinates');
    if (coordMatch && method === 'POST') {
      const { latitude, longitude } = body;
      const empId = coordMatch.id;

      // Update coordinates
      const { error: updateErr } = await supabase.from('employees').update({ latitude, longitude }).eq('id', empId);
      if (updateErr) throw new Error(updateErr.message);

      // Fetch employee name
      const { data: emp, error: empErr } = await supabase.from('employees').select('name').eq('id', empId).single();
      if (empErr) throw new Error(empErr.message);

      // Retrieve polygon geofence
      const { data: activeGeofence } = await supabase
        .from('office_geofence')
        .select('polygon_coordinates')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let isInside = false;
      let polygonBased = false;

      if (activeGeofence && activeGeofence.polygon_coordinates) {
        try {
          const polygon = typeof activeGeofence.polygon_coordinates === 'string'
            ? JSON.parse(activeGeofence.polygon_coordinates)
            : activeGeofence.polygon_coordinates;
          isInside = isPointInPolygon(latitude, longitude, polygon);
          polygonBased = true;
        } catch (e) {
          console.error('[GEOFENCE PARSE ERROR]', e);
        }
      }

      let distance = 0;
      let radius = 100;
      let officeLat = 28.6139;
      let officeLng = 77.2090;

      if (!polygonBased) {
        const { data: settingsData } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', ['geofence_lat', 'geofence_lng', 'geofence_radius']);
        
        const settings = {};
        (settingsData || []).forEach(row => {
          settings[row.key] = parseFloat(row.value);
        });

        officeLat = settings.geofence_lat || 28.6139;
        officeLng = settings.geofence_lng || 77.2090;
        radius = settings.geofence_radius || 100;

        distance = calculateDistance(latitude, longitude, officeLat, officeLng);
        isInside = distance <= radius;
      }

      const status = isInside ? 'Online' : 'Outside Office Limit';
      await supabase.from('employees').update({ status }).eq('id', empId);

      // Broadcast new status
      broadcastRealtimeEvent('employee:status', {
        id: empId,
        name: emp.name,
        status,
        latitude,
        longitude
      });

      return {
        success: true,
        data: {
          latitude,
          longitude,
          isInside,
          distance,
          radius,
          polygonBased,
          officeLatitude: officeLat,
          officeLongitude: officeLng
        }
      };
    }

    // 17. POST /employees/reset-db (Database seeder engine client-side)
    if (endpoint === '/employees/reset-db' && method === 'POST') {
      console.log('[DATABASE RESET REQUESTED]: Purging tables...');
      await supabase.from('logs').delete().neq('id', 0);
      await supabase.from('attendance').delete().neq('id', 0);
      await supabase.from('employees').delete().neq('id', '0');
      await supabase.from('settings').delete().neq('key', '');

      await supabase.from('settings').upsert([
        { key: 'geofence_lat', value: '28.6139' },
        { key: 'geofence_lng', value: '77.2090' },
        { key: 'geofence_radius', value: '100' }
      ]);

      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });

      console.log('[SEEDING]: Creating default Admin in Supabase Auth...');
      const { error: adminErr } = await tempClient.auth.signUp({
        email: 'admin@company.com',
        password: 'adminpassword',
        options: { data: { name: 'Administrator', role: 'admin', department: 'Security & HR' } }
      });

      if (!adminErr || adminErr.message.includes('already registered')) {
        const desc = [];
        const lower = 'administrator';
        for (let i = 0; i < 128; i++) {
          let charVal = lower.charCodeAt(i % lower.length) / 128.0;
          desc.push(Math.sin(i * charVal) * 0.8 + 0.1);
        }
        const adminFace = await encryptDescriptor(desc);

        await supabase.from('employees').insert({
          id: 'EMP-001',
          name: 'Administrator',
          email: 'admin@company.com',
          password: 'adminpassword',
          role: 'admin',
          department: 'Security & HR',
          face_data: adminFace,
          status: 'Offline'
        });
        console.log('[SEEDING]: Admin seeded successfully.');
      }

      console.log('[SEEDING]: Creating default Employee in Supabase Auth...');
      const { error: empErr } = await tempClient.auth.signUp({
        email: 'employee@company.com',
        password: 'employeepassword',
        options: { data: { name: 'Standard Employee', role: 'employee', department: 'Engineering' } }
      });

      if (!empErr || empErr.message.includes('already registered')) {
        const desc = [];
        const lower = 'standard employee';
        for (let i = 0; i < 128; i++) {
          let charVal = lower.charCodeAt(i % lower.length) / 128.0;
          desc.push(Math.sin(i * charVal) * 0.8 + 0.1);
        }
        const empFace = await encryptDescriptor(desc);

        await supabase.from('employees').insert({
          id: 'EMP-002',
          name: 'Standard Employee',
          email: 'employee@company.com',
          password: 'employeepassword',
          role: 'employee',
          department: 'Engineering',
          face_data: empFace,
          status: 'Offline'
        });
        console.log('[SEEDING]: Employee seeded successfully.');
      }

      return { success: true, message: 'Database reset successfully and default accounts re-seeded.' };
    }

    // 18. POST /attendance/scan (Face recognition kiosk scan engine client-side)
    if (endpoint === '/attendance/scan' && method === 'POST') {
      const { faceDescriptor, faceMetrics, location, userCoords } = body;
      
      if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
        throw new Error('Invalid or missing biometric descriptor.');
      }

      // Fetch active templates
      const { data: employees, error: fetchErr } = await supabase
        .from('employees')
        .select('id, name, department, face_data')
        .not('face_data', 'is', null);
      if (fetchErr) throw new Error(fetchErr.message);

      let bestMatch = null;
      let bestDistance = Infinity;
      const threshold = 0.45;

      for (const emp of (employees || [])) {
        const dbDescriptor = await decryptDescriptor(emp.face_data);
        if (!dbDescriptor) continue;
        const distance = calculateEuclideanDistance(faceDescriptor, dbDescriptor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = emp;
        }
      }

      // Unknown face check
      if (!bestMatch || bestDistance > threshold) {
        const confidence = bestDistance !== Infinity ? Math.max(0, 1 - bestDistance) : 0;
        
        await supabase.from('logs').insert({
          employee_id: null,
          event_type: 'UNAUTHORIZED_SCAN',
          location: location || 'Front Desk Camera',
          details: JSON.stringify({ confidence })
        });

        // Broadcast to Dashboard log feed & Alerts
        const alertData = {
          timestamp: new Date().toISOString(),
          location: location || 'Front Desk Camera',
          confidence
        };
        broadcastRealtimeEvent('unauthorized:alert', alertData);
        
        broadcastRealtimeEvent('logs:new', {
          event_type: 'UNAUTHORIZED_SCAN',
          timestamp: new Date().toISOString(),
          location: location || 'Front Desk Camera',
          details: JSON.stringify({ confidence }),
          name: 'Unknown Person'
        });

        const voiceMessage = `Access denied. Unauthorized person. Face not recognized.`;
        const error = new Error('Unauthorized Person: Face not recognized.');
        error.voiceMessage = voiceMessage;
        throw error;
      }

      const employeeId = bestMatch.id;
      const name = bestMatch.name;
      const department = bestMatch.department;
      const confidence = Math.max(0, 1 - bestDistance);

      // Anti-spoofing check
      const liveness = verifyLiveness(faceMetrics);
      if (!liveness.passed) {
        await supabase.from('logs').insert({
          employee_id: employeeId,
          event_type: 'SPOOF_ATTEMPT',
          location: location || 'Front Desk Camera',
          details: `Flagged biometric anti-spoof check: spoof coefficient ${faceMetrics?.spoofIndex || 0.9}`
        });

        broadcastRealtimeEvent('logs:new', {
          employee_id: employeeId,
          event_type: 'SPOOF_ATTEMPT',
          timestamp: new Date().toISOString(),
          location: location || 'Front Desk Camera',
          name,
          details: 'Flagged biometric anti-spoof check.'
        });

        const error = new Error('Biometric Scanner Blocked: Anti-Spoof Check Flagged.');
        error.voiceMessage = `Access denied. Anti-spoofing alert triggered for ${name}.`;
        throw error;
      }

      // GPS Coordinates Check
      const userLat = parseFloat(userCoords?.latitude);
      const userLng = parseFloat(userCoords?.longitude);

      if (!userCoords || isNaN(userLat) || isNaN(userLng) || userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
        await supabase.from('logs').insert({
          employee_id: employeeId,
          event_type: 'GPS_ERROR',
          location: location || 'Front Desk Camera',
          details: 'Attendance rejected: Missing or invalid GPS telemetry.'
        });
        
        broadcastRealtimeEvent('logs:new', {
          employee_id: employeeId,
          event_type: 'GPS_ERROR',
          timestamp: new Date().toISOString(),
          location: location || 'Front Desk Camera',
          name,
          details: 'Missing GPS telemetry.'
        });

        throw new Error('Location access is required for attendance validation. Missing GPS coordinates.');
      }

      // Polygon Boundary Geofence check
      const { data: activeGeofence } = await supabase
        .from('office_geofence')
        .select('polygon_coordinates')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let isInside = false;
      let polygonBased = false;

      if (activeGeofence && activeGeofence.polygon_coordinates) {
        try {
          const polygon = typeof activeGeofence.polygon_coordinates === 'string'
            ? JSON.parse(activeGeofence.polygon_coordinates)
            : activeGeofence.polygon_coordinates;
          isInside = isPointInPolygon(userLat, userLng, polygon);
          polygonBased = true;
        } catch (e) {
          console.error('[GEOFENCE PARSE ERROR]', e);
        }
      }

      let distance = 0;
      let radius = 100;
      let officeLat = 28.6139;
      let officeLng = 77.2090;

      if (!polygonBased) {
        const { data: settingsData } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', ['geofence_lat', 'geofence_lng', 'geofence_radius']);
        
        const settings = {};
        (settingsData || []).forEach(row => {
          settings[row.key] = parseFloat(row.value);
        });

        officeLat = settings.geofence_lat || 28.6139;
        officeLng = settings.geofence_lng || 77.2090;
        radius = settings.geofence_radius || 100;

        distance = calculateDistance(userLat, userLng, officeLat, officeLng);
        isInside = distance <= radius;
      }

      if (!isInside) {
        const breachDetails = polygonBased
          ? 'Geofence breach: employee outside mapped office polygon boundary.'
          : `Geofence breach: employee outside by ${Math.round(distance - radius)}m (Distance: ${Math.round(distance)}m).`;

        await supabase.from('logs').insert({
          employee_id: employeeId,
          event_type: 'GEOFENCE_VIOLATION',
          location: location || 'Front Desk Camera',
          details: breachDetails
        });

        broadcastRealtimeEvent('logs:new', {
          employee_id: employeeId,
          event_type: 'GEOFENCE_VIOLATION',
          timestamp: new Date().toISOString(),
          location: location || 'Front Desk Camera',
          name,
          details: breachDetails
        });

        broadcastRealtimeEvent('employee:status', {
          id: employeeId,
          name,
          status: 'Outside Office Limit',
          latitude: userLat,
          longitude: userLng
        });

        const error = new Error('You are outside office premises.');
        error.details = { polygonBased, distance, allowedRadius: radius };
        throw error;
      }

      // Mark Attendance
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      const { data: attRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      let eventType = 'CHECK_IN';
      let responseMessage = '';
      let lateMinutes = 0;
      let workingHours = 0;

      if (!attRecord) {
        // Mark Check-In
        const checkInHour = new Date().getHours();
        const checkInMinute = new Date().getMinutes();
        const isLate = checkInHour > 10 || (checkInHour === 10 && checkInMinute > 0);
        const status = isLate ? 'Late Arrival' : 'On Time';
        
        if (isLate) {
          lateMinutes = (checkInHour - 10) * 60 + checkInMinute;
        }

        const { error: insertErr } = await supabase.from('attendance').insert({
          employee_id: employeeId,
          date: today,
          check_in: timeString,
          working_hours: 0,
          status
        });
        if (insertErr) throw new Error(insertErr.message);

        await supabase.from('employees').update({ status: 'Online', latitude: userLat, longitude: userLng }).eq('id', employeeId);

        const logMsg = isLate 
          ? `Checked In late by ${lateMinutes} minutes (${timeString}).`
          : `Checked In on time (${timeString}).`;

        await supabase.from('logs').insert({
          employee_id: employeeId,
          event_type: 'CHECK_IN',
          location: location || 'Front Desk Camera',
          details: logMsg
        });

        broadcastRealtimeEvent('logs:new', {
          employee_id: employeeId,
          event_type: 'CHECK_IN',
          timestamp: now,
          location: location || 'Front Desk Camera',
          name,
          details: logMsg
        });

        broadcastRealtimeEvent('employee:status', {
          id: employeeId,
          name,
          status: 'Online',
          latitude: userLat,
          longitude: userLng
        });

        responseMessage = isLate
          ? `Welcome, ${name}. You are checked in. Late by ${lateMinutes} minutes.`
          : `Welcome, ${name}. You are checked in on time.`;

        return {
          success: true,
          message: responseMessage,
          employee: { id: employeeId, name, department },
          eventType,
          lateDuration: isLate ? `${lateMinutes} mins` : 'On Time',
          isLate
        };

      } else {
        // Mark Check-Out
        eventType = 'CHECK_OUT';

        const parseTime = (t) => {
          if (!t) return new Date();
          const [h, m] = t.split(':').map(Number);
          const d = new Date();
          d.setHours(h, m, 0, 0);
          return d;
        };

        const checkInDate = parseTime(attRecord.check_in);
        const checkOutDate = new Date();
        const diffMs = checkOutDate - checkInDate;
        workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

        const checkOutTimeString = checkOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        const { error: updateErr } = await supabase
          .from('attendance')
          .update({
            check_out: checkOutTimeString,
            working_hours: workingHours
          })
          .eq('id', attRecord.id);
        if (updateErr) throw new Error(updateErr.message);

        await supabase.from('employees').update({ status: 'Offline', latitude: userLat, longitude: userLng }).eq('id', employeeId);

        const logMsg = `Checked Out at ${checkOutTimeString}. Worked: ${workingHours} hrs.`;
        await supabase.from('logs').insert({
          employee_id: employeeId,
          event_type: 'CHECK_OUT',
          location: location || 'Front Desk Camera',
          details: logMsg
        });

        broadcastRealtimeEvent('logs:new', {
          employee_id: employeeId,
          event_type: 'CHECK_OUT',
          timestamp: now,
          location: location || 'Front Desk Camera',
          name,
          details: logMsg
        });

        broadcastRealtimeEvent('employee:status', {
          id: employeeId,
          name,
          status: 'Offline',
          latitude: userLat,
          longitude: userLng
        });

        responseMessage = `Goodbye, ${name}. Checked out successfully. Time worked: ${workingHours} hours.`;

        return {
          success: true,
          message: responseMessage,
          employee: { id: employeeId, name, department },
          eventType,
          workingHours
        };
      }
    }

    throw new Error(`Route handler not mapped client-side: ${method} ${endpoint}`);
  } catch (error) {
    console.error(`[API CALL EXCEPTION INTERCEPTED] URL: ${endpoint}`, error);
    throw error;
  }
};
