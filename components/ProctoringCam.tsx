
import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as FaceMeshPkg from '@mediapipe/face_mesh';
import * as CameraUtilsPkg from '@mediapipe/camera_utils';
import { AlertTriangle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

// Robust import handling for MediaPipe packages (handles both named and default exports)
// This fixes the "does not provide an export named 'Camera'" error common with esm.sh/bundlers
const FaceMesh = (FaceMeshPkg as any).FaceMesh || (FaceMeshPkg as any).default?.FaceMesh || FaceMeshPkg;
const Camera = (CameraUtilsPkg as any).Camera || (CameraUtilsPkg as any).default?.Camera || CameraUtilsPkg;

interface ProctoringCamProps {
  onViolation: (type: 'LOOKING_AWAY' | 'NO_FACE') => void;
  isActive: boolean;
}

const ProctoringCam: React.FC<ProctoringCamProps> = ({ onViolation, isActive }) => {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState<'OK' | 'WARNING' | 'ERROR'>('OK');
  const [message, setMessage] = useState('Monitoring Aktif');
  
  // Throttle violations to avoid spamming
  const lastViolationTime = useRef<number>(0);
  const violationStreak = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;
    
    // Safety check if libraries loaded
    if (!FaceMesh || !Camera) {
        console.error("MediaPipe libraries failed to load correctly.");
        setStatus('ERROR');
        setMessage('Library Error');
        return;
    }

    let camera: any = null;
    let faceMesh: any = null;

    try {
        faceMesh = new FaceMesh({
        locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
        });

        faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
        const now = Date.now();

        // 1. Check if face exists
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            setStatus('ERROR');
            setMessage('Wajah Tidak Terdeteksi');
            violationStreak.current += 1;
            
            if (violationStreak.current > 30 && (now - lastViolationTime.current > 5000)) { // ~1 second of no face
            onViolation('NO_FACE');
            lastViolationTime.current = now;
            }
            return;
        }

        // 2. Head Pose Logic
        const landmarks = results.multiFaceLandmarks[0];
        
        // Key Landmarks Indices (MediaPipe Face Mesh)
        // 1: Nose Tip
        // 33: Left Eye Outer Corner
        // 263: Right Eye Outer Corner
        
        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        
        // Calculate Horizontal Ratio (Yaw)
        // Distance from Nose to Left Eye vs Nose to Right Eye
        const distToLeft = Math.abs(nose.x - leftEye.x);
        const distToRight = Math.abs(nose.x - rightEye.x);
        const totalDist = distToLeft + distToRight;
        
        // Ratio: 0.5 is perfect center. < 0.2 is looking Left. > 0.8 is looking Right.
        const yawRatio = distToLeft / totalDist;

        let isLookingAway = false;
        let warningMsg = '';

        // Tuning Thresholds
        if (yawRatio < 0.25) {
            isLookingAway = true;
            warningMsg = 'Menoleh ke KIRI';
        } else if (yawRatio > 0.75) {
            isLookingAway = true;
            warningMsg = 'Menoleh ke KANAN';
        } 
        
        if (isLookingAway) {
            setStatus('WARNING');
            setMessage(warningMsg);
            violationStreak.current += 1;

            // Trigger violation if persisted for ~1.5 seconds (approx 20 frames)
            if (violationStreak.current > 20 && (now - lastViolationTime.current > 3000)) {
                onViolation('LOOKING_AWAY');
                lastViolationTime.current = now;
                violationStreak.current = 0; // Reset streak after reporting
            }
        } else {
            setStatus('OK');
            setMessage('Fokus Terdeteksi');
            violationStreak.current = Math.max(0, violationStreak.current - 1); // Decay streak
        }
        });

        if (webcamRef.current && webcamRef.current.video) {
            camera = new Camera(webcamRef.current.video, {
                onFrame: async () => {
                // Check if component is still mounted/active before sending
                if (webcamRef.current && webcamRef.current.video && faceMesh) {
                    try {
                        await faceMesh.send({ image: webcamRef.current.video });
                    } catch (err) {
                        // Ignore send errors during shutdown
                    }
                }
                },
                width: 320,
                height: 240,
            });
            camera.start();
        }
    } catch (e) {
        console.error("Error initializing ProctoringCam:", e);
        setStatus('ERROR');
        setMessage('Init Error');
    }

    // CLEANUP FUNCTION: This runs when component unmounts (Test ends)
    return () => {
        // 1. Stop MediaPipe Camera Loop (stops requestAnimationFrame)
        if (camera) {
            try {
                camera.stop(); 
            } catch (e) {
                console.warn("Failed to stop MediaPipe camera:", e);
            }
        }
        
        // 2. Close FaceMesh instance
        if (faceMesh) {
            try {
                faceMesh.close();
            } catch (e) {
                console.warn("Failed to close FaceMesh:", e);
            }
        }

        // 3. HARD STOP: Manually stop all media tracks to turn off hardware light
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
            const stream = webcamRef.current.video.srcObject as MediaStream;
            const tracks = stream.getTracks();
            
            tracks.forEach(track => {
                track.stop();
                // console.log("Camera track stopped manually"); 
            });
        }
    };
  }, [isActive, onViolation]);

  return (
    <div className="fixed bottom-4 right-4 z-[50] flex flex-col items-end pointer-events-none">
       {/* Status Badge */}
       <div className={`mb-2 px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-bold transition-colors duration-300
         ${status === 'OK' ? 'bg-green-100 text-green-700 border border-green-200' : 
           status === 'WARNING' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse' : 
           'bg-red-100 text-red-700 border border-red-200 animate-bounce'}
       `}>
          {status === 'OK' ? <ShieldCheck size={14}/> : status === 'WARNING' ? <Eye size={14}/> : <EyeOff size={14}/>}
          {message}
       </div>

       {/* Camera Feed */}
       <div className={`relative w-32 h-24 bg-black rounded-lg overflow-hidden border-2 shadow-xl
         ${status === 'OK' ? 'border-green-400' : status === 'WARNING' ? 'border-yellow-400' : 'border-red-500'}
       `}>
          <Webcam
            ref={webcamRef}
            audio={false}
            width={128}
            height={96}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover mirror-mode transform -scale-x-100" // Mirror effect
          />
          <div className="absolute bottom-0 left-0 w-full bg-black/60 text-[8px] text-white text-center py-0.5">
              AI Proctoring
          </div>
       </div>
    </div>
  );
};

export default ProctoringCam;
