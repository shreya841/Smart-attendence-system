import { getDb } from '../database/db.js';

/**
 * AI Voice synthesis engine synthesizer.
 * Generates custom contextual vocal messages based on check-in parameters.
 */
export const synthesizeVoiceGreeting = (employeeName, eventDetails) => {
  const { eventType, timeString, lateMinutes, lateDuration } = eventDetails;
  
  if (eventType === 'CHECK_IN') {
    if (lateMinutes && lateMinutes > 0) {
      return `Access granted. Welcome back, ${employeeName}. You are checked in. You are late by ${lateDuration || `${lateMinutes} minutes`}.`;
    }
    return `Access granted. Welcome back, ${employeeName}. You are checked in on time.`;
  }
  
  if (eventType === 'CHECK_OUT') {
    return `Access granted. Goodbye, ${employeeName}. Exit registered successfully.`;
  }

  if (eventType === 'UNAUTHORIZED_SCAN') {
    return `Access denied. Unauthorized individual detected. Security has been notified.`;
  }

  return `Access granted. Welcome back, ${employeeName}. Update recorded.`;
};

/**
 * Triggers AI reasoning logs for suspicious activities, security logs, or anomalies.
 */
export const triggerAIAnomalyReport = async (anomalyType, sessionData) => {
  const db = getDb();
  
  let description = '';
  if (anomalyType === 'SPOOF_ATTEMPT') {
    description = `AI biometric model flagged high spoofing risk (Score: ${sessionData.spoofIndex}) on Webcam Scanner.`;
  } else if (anomalyType === 'OUT_OF_HOURS_SCAN') {
    description = `Employee attempted scan outside typical working windows.`;
  } else {
    description = `Anomalous attendance request flagged by security auditor.`;
  }

  // Insert alert into system log database
  await db.run(
    `INSERT INTO logs (employee_id, event_type, location, details) VALUES (?, ?, ?, ?)`,
    [
      sessionData.employeeId || null,
      'SECURITY_ALERT',
      sessionData.location || 'Unknown',
      JSON.stringify({
        type: anomalyType,
        description,
        timestamp: new Date().toISOString(),
        deviceFingerprint: sessionData.userAgent || 'Chrome / Windows'
      })
    ]
  );

  console.log(`[AI AGENT ALERT]: Generated security anomaly flag of type: ${anomalyType}`);
};
