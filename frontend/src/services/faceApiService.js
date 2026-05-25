import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let loadingPromise = null;

const MODEL_URL = './model/';

/**
 * Trigger loading of face-api.js neural networks.
 */
export const loadFaceApiModels = () => {
  if (modelsLoaded) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  console.log('[BIOMETRIC FACE-API]: Initiating model download from jsDelivr CDN...');
  loadingPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ])
    .then(() => {
      modelsLoaded = true;
      console.log('[BIOMETRIC FACE-API]: All neural networks loaded and ready.');
      return true;
    })
    .catch((err) => {
      console.error('[BIOMETRIC FACE-API]: Failed to load neural network weights:', err);
      loadingPromise = null;
      throw err;
    });

  return loadingPromise;
};

/**
 * Runs the face detector on a given HTMLVideoElement.
 * Returns the detection result with landmarks and descriptors.
 */
export const detectFaceBiometrics = async (videoElement) => {
  if (!modelsLoaded) {
    await loadFaceApiModels();
  }

  // inputSize 224 gives better landmark accuracy for blink detection (EAR)
  // scoreThreshold 0.4 allows faster detection at slight distance/angle
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.4
  });

  const detection = await faceapi
    .detectSingleFace(videoElement, options)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  return detection;
};

/**
 * Estimates head orientation (Front, Left profile, Right profile) using horizontal asymmetry
 * between eyes and the nose bridge from 68 landmarks.
 */
export const estimateHeadPose = (landmarks) => {
  if (!landmarks) return 'front';

  const nosePoints = landmarks.getNose();
  const leftEyePoints = landmarks.getLeftEye();
  const rightEyePoints = landmarks.getRightEye();

  if (!nosePoints.length || !leftEyePoints.length || !rightEyePoints.length) {
    return 'front';
  }

  // Use the top nose point (bridge) and outermost eye points
  const noseBridge = nosePoints[0];
  const leftEyeOuter = leftEyePoints[0];
  const rightEyeOuter = rightEyePoints[rightEyePoints.length - 1];

  const leftDist = noseBridge.x - leftEyeOuter.x;
  const rightDist = rightEyeOuter.x - noseBridge.x;

  if (leftDist <= 0 || rightDist <= 0) return 'front';

  const ratio = leftDist / rightDist;

  // Set calibrated thresholds for head turning
  if (ratio > 1.6) {
    return 'right'; // Face turned to the right (looking right from subject perspective)
  } else if (ratio < 0.6) {
    return 'left';  // Face turned to the left
  }

  return 'front';
};

/**
 * Averages a list of descriptors into a single robust template vector.
 * @param {Array<Float32Array>} descriptors 
 * @returns {Array<number>}
 */
export const calculateAverageDescriptor = (descriptors) => {
  if (!descriptors || descriptors.length === 0) return null;
  const vectorLength = descriptors[0].length;
  const avg = new Array(vectorLength).fill(0);

  for (const desc of descriptors) {
    for (let i = 0; i < vectorLength; i++) {
      avg[i] += desc[i];
    }
  }

  return avg.map(val => val / descriptors.length);
};

export { faceapi };
