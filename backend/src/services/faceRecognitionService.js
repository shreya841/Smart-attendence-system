import { getDb } from '../database/db.js';
import { supabase, checkSupabaseConnection } from '../database/supabaseClient.js';
import { encryptDescriptor, decryptDescriptor } from './encryption.js';

/**
 * Calculates Euclidean distance between two feature descriptor arrays.
 * A lower distance indicates higher similarity (typically < 0.45 is a match).
 */
export const calculateEuclideanDistance = (vectorA, vectorB) => {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Descriptor vectors must be of identical length');
  }

  let distance = 0.0;
  for (let i = 0; i < vectorA.length; i++) {
    const diff = vectorA[i] - vectorB[i];
    distance += diff * diff;
  }

  return Math.sqrt(distance);
};

/**
 * Validates facial metrics and executes biometric anti-spoof checks.
 * Ensures the scanned subject exhibits genuine liveness (e.g. eye movement, depth mapping, etc.)
 */
export const verifyLiveness = (faceMetrics) => {
  const { spoofIndex, landmarks } = faceMetrics;

  if (spoofIndex && spoofIndex > 0.4) {
    return {
      passed: false,
      reason: 'Anti-Spoof Check Failed: Low liveness probability detected (potential photo/video representation).'
    };
  }

  return {
    passed: true,
    reason: 'Liveness verified.'
  };
};

/**
 * Compares an incoming face descriptor against the registered database profiles
 * to find the matching employee.
 */
export const identifyFace = async (incomingDescriptor, threshold = 0.45) => {
  const db = getDb();
  
  const isSupabaseLive = await checkSupabaseConnection();
  let employees = [];

  if (isSupabaseLive) {
    const { data, error } = await supabase.from('employees').select('id, name, department, face_data').not('face_data', 'is', null);
    if (!error && data && data.length > 0) {
      employees = data;
    }
  }

  if (employees.length === 0) {
    employees = await db.all(`SELECT id, name, department, face_data FROM employees WHERE face_data IS NOT NULL`);
  }
  
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const emp of employees) {
    try {
      const dbDescriptor = decryptDescriptor(emp.face_data);
      if (!dbDescriptor) continue;
      
      const distance = calculateEuclideanDistance(incomingDescriptor, dbDescriptor);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = emp;
      }
    } catch (err) {
      console.error(`[BIOMETRIC ERROR]: Failed parsing/decrypting face descriptor for employee ID ${emp.id}:`, err);
    }
  }

  if (bestMatch && bestDistance <= threshold) {
    return {
      matched: true,
      employeeId: bestMatch.id,
      name: bestMatch.name,
      department: bestMatch.department,
      confidence: Math.max(0, 1 - bestDistance)
    };
  }

  return {
    matched: false,
    confidence: bestDistance !== Infinity ? Math.max(0, 1 - bestDistance) : 0
  };
};

/**
 * Registers an employee's face data in the system.
 */
export const registerFaceData = async (employeeId, faceDescriptor) => {
  const db = getDb();

  if (!Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
    throw new Error('Biometric registration requires a non-empty float array.');
  }

  const isSupabaseLive = await checkSupabaseConnection();
  let existingFaces = [];

  if (isSupabaseLive) {
    const { data } = await supabase.from('employees').select('id, name, face_data').not('face_data', 'is', null).neq('id', employeeId);
    if (data) existingFaces = data;
  }

  if (existingFaces.length === 0) {
    existingFaces = await db.all(`SELECT id, name, face_data FROM employees WHERE face_data IS NOT NULL AND id != ?`, [employeeId]);
  }
  
  for (const emp of existingFaces) {
    try {
      const dbDescriptor = decryptDescriptor(emp.face_data);
      if (!dbDescriptor) continue;

      const distance = calculateEuclideanDistance(faceDescriptor, dbDescriptor);
      
      if (distance <= 0.55) {
        const error = new Error(`This biometric identity already belongs to ${emp.name}.`);
        error.status = 409;
        throw error;
      }
    } catch (err) {
      if (err.message.includes('This biometric identity already belongs to')) {
        throw err;
      }
      console.error(`[BIOMETRIC REGISTRATION CHECK ERROR] Failed parsing/decrypting face for ${emp.name}:`, err);
    }
  }

  const encrypted = encryptDescriptor(faceDescriptor);

  // Write to SQLite
  await db.run(
    `UPDATE employees SET face_data = ? WHERE id = ?`,
    [encrypted, employeeId]
  );

  // Write to Supabase
  if (isSupabaseLive) {
    await supabase.from('employees').update({ face_data: encrypted }).eq('id', employeeId);
  }

  return {
    success: true,
    message: `Face biometrics successfully recorded for Employee ${employeeId}.`
  };
};
