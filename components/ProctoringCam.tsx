
import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { AlertTriangle, Eye, EyeOff, ShieldCheck, CameraOff, Mic, MicOff, CheckCircle2 } from 'lucide-react';

interface ProctoringCamProps {
    onViolation: (type: 'LOOKING_AWAY' | 'NO_FACE') => void;
    isActive: boolean;
    onDeviceStatus?: (isReady: boolean) => void;
    requireCamera: boolean; // NEW: Control Camera Requirement
    requireMicrophone: boolean; // NEW: Control Mic Requirement
}

const ProctoringCam: React.FC<ProctoringCamProps> = ({ onViolation, isActive, onDeviceStatus, requireCamera, requireMicrophone }) => {
    const webcamRef = useRef<Webcam>(null);
    const [status, setStatus] = useState<'OK' | 'WARNING' | 'ERROR'>('OK');
    const [message, setMessage] = useState('Monitoring Aktif');
    const [permissionError, setPermissionError] = useState(false);
    const [micActive, setMicActive] = useState(false);

    // Draggable & Resizable State
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isMinimized, setIsMinimized] = useState(false); // Default expanded

    // Throttle violations
    const lastViolationTime = useRef<number>(0);
    const violationStreak = useRef<number>(0);

    // --- DRAG HANDLERS ---
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setDragStart({ x: clientX - position.x, y: clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        setPosition({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Attach global listeners for smoother dragging
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove as any);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleMouseMove as any);
            window.addEventListener('touchend', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove as any);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove as any);
            window.removeEventListener('touchend', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove as any);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove as any);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging]);


    const handleUserMediaError = (error: string | DOMException) => {
        if (!requireCamera) return; // Ignore if not required
        console.error("Camera Permission Error:", error);
        setStatus('ERROR');
        setMessage('Izin Kamera Ditolak');
        setPermissionError(true);
        if (onDeviceStatus) onDeviceStatus(false);
    };

    // Called when Webcam component successfully loads video stream
    const handleUserMedia = (stream: MediaStream) => {
        // 1. Video is ready (if required)
        // 2. Check Microphone permission (if required)
        if (requireMicrophone && !micActive) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => {
                    setMicActive(true);
                    if (!permissionError && onDeviceStatus) onDeviceStatus(true);
                })
                .catch((err) => {
                    console.error("Mic Permission Error:", err);
                    setMessage('Mic Wajib Nyala');
                    setStatus('ERROR');
                    if (onDeviceStatus) onDeviceStatus(false);
                });
        } else {
            // If mic not required or already active
            if (!permissionError && onDeviceStatus) onDeviceStatus(true);
        }
    };

    useEffect(() => {
        // If NO DEVICES REQUIRED, just report ready
        if (isActive && !requireCamera && !requireMicrophone) {
            if (onDeviceStatus) onDeviceStatus(true);
            setStatus('OK');
            setMessage('Monitoring Non-Aktif');
            return;
        }

        // Periodic check
        if (isActive) {
            const constraints: MediaStreamConstraints = {};
            if (requireCamera) constraints.video = true;
            if (requireMicrophone) constraints.audio = true;

            if (requireCamera || requireMicrophone) {
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(() => {
                        if (requireMicrophone) setMicActive(true);
                        setPermissionError(false);
                        if (onDeviceStatus) onDeviceStatus(true);
                    })
                    .catch((e) => {
                        console.error("Device check failed:", e);
                        setMicActive(false);
                        if (e.name === 'NotAllowedError' || e.name === 'NotFoundError') {
                            setMessage('Cek Izin Device');
                            setStatus('ERROR');
                            setPermissionError(true);
                        }
                        if (onDeviceStatus) onDeviceStatus(false);
                    });
            }
        }
    }, [isActive, requireCamera, requireMicrophone]);

    useEffect(() => {
        // SKIP IF NOT REQUIRED OR ERROR
        if (!isActive || !requireCamera || permissionError) return;

        // Safety check if libraries loaded
        console.log("ProctoringCam: FaceMesh import:", FaceMesh);
        console.log("ProctoringCam: Camera import:", Camera);

        if (!FaceMesh && !Camera) {
            console.error("Critical: Both FaceMesh and Camera are undefined.");
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
                const nose = landmarks[1];
                const leftEye = landmarks[33];
                const rightEye = landmarks[263];

                const distToLeft = Math.abs(nose.x - leftEye.x);
                const distToRight = Math.abs(nose.x - rightEye.x);
                const totalDist = distToLeft + distToRight;
                const yawRatio = distToLeft / totalDist;

                let isLookingAway = false;
                let warningMsg = '';

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

                    if (violationStreak.current > 20 && (now - lastViolationTime.current > 3000)) {
                        onViolation('LOOKING_AWAY');
                        lastViolationTime.current = now;
                        violationStreak.current = 0;
                    }
                } else {
                    setStatus('OK');
                    setMessage('Fokus Terdeteksi');
                    violationStreak.current = Math.max(0, violationStreak.current - 1);
                }
            });

            if (webcamRef.current && webcamRef.current.video) {
                camera = new Camera(webcamRef.current.video, {
                    onFrame: async () => {
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

        return () => {
            if (camera) try { camera.stop(); } catch (e) { }
            if (faceMesh) try { faceMesh.close(); } catch (e) { }
            if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
                const stream = webcamRef.current.video.srcObject as MediaStream;
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, [isActive, onViolation, permissionError, requireCamera]); // Added requireCamera dependency

    if (permissionError) {
        return (
            <div className="fixed top-20 right-2 md:top-auto md:bottom-4 md:right-4 z-[50] flex flex-col items-end animate-bounce">
                <div className="bg-red-600 text-white px-3 py-2 rounded-lg shadow-xl flex items-center gap-2 text-xs font-bold border border-red-400">
                    <CameraOff size={16} />
                    <div>
                        <div>AKSES DITOLAK</div>
                        <div className="text-[9px] font-normal">Izinkan Kamera & Mic di browser</div>
                    </div>
                </div>
            </div>
        )
    }

    // IF CAMERA NOT REQUIRED, Render nothing or minimal status
    if (!requireCamera) {
        if (!requireMicrophone) return null; // No monitoring at all

        // If Mic is required but Camera OFF
        return (
            <div className="fixed top-20 right-2 md:top-auto md:bottom-4 md:right-4 z-[50] flex flex-col items-end pointer-events-none">
                <div className={`mb-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-[10px] md:text-xs font-bold backdrop-blur-sm bg-opacity-90
               ${micActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}
             `}>
                    {micActive ? <Mic size={12} /> : <MicOff size={12} />}
                    {micActive ? 'Voice Ready' : 'Mic Wajib Nyala'}
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed z-[9999] flex flex-col items-end transition-shadow duration-300"
            style={{
                top: '5rem', // Default position equivalent to top-20
                right: '0.5rem', // Default position equivalent to right-2
                transform: `translate(${position.x}px, ${position.y}px)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none' // Prevent scrolling while dragging
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
        >
            {/* Controller Header (Mini) */}
            <div className="flex items-center gap-1 mb-1 opacity-50 hover:opacity-100 transition-opacity bg-black/40 rounded-full px-2 py-0.5 backdrop-blur-sm">
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="text-white hover:text-mobeng-yellow p-0.5 rounded-full"
                    title={isMinimized ? "Expand" : "Minimize"}
                >
                    {isMinimized ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
            </div>

            {/* Status Badge */}
            {!isMinimized && (
                <div className={`mb-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-[10px] md:text-xs font-bold transition-colors duration-300 backdrop-blur-sm bg-opacity-90 select-none
            ${status === 'OK' && (micActive || !requireMicrophone) ? 'bg-green-100 text-green-700 border border-green-200' :
                        status === 'WARNING' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse' :
                            'bg-red-100 text-red-700 border border-red-200 animate-bounce'}
            `}>
                    {status === 'OK' && (micActive || !requireMicrophone) ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                    {status === 'OK' && !micActive && requireMicrophone ? 'Mic Mati' : message}
                </div>
            )}

            {/* Camera Feed */}
            <div className={`relative bg-black rounded-lg overflow-hidden border-2 shadow-xl transition-all duration-300
         ${status === 'OK' && (micActive || !requireMicrophone) ? 'border-green-400' : status === 'WARNING' ? 'border-yellow-400' : 'border-red-500'}
         ${isMinimized ? 'w-16 h-12 md:w-20 md:h-16 opacity-50 hover:opacity-100' : 'w-24 h-18 md:w-32 md:h-24'}
       `}>
                <Webcam
                    ref={webcamRef}
                    audio={false} // We check audio manually via getUserMedia to avoid echo, but verify permission
                    width={128}
                    height={96}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover mirror-mode transform -scale-x-100 pointer-events-none"
                    onUserMediaError={handleUserMediaError}
                    onUserMedia={handleUserMedia}
                />
                <div className="absolute bottom-0 left-0 w-full bg-black/60 text-[8px] text-white text-center py-0.5 flex items-center justify-center gap-1 select-none pointer-events-none">
                    <span>{isMinimized ? '' : 'Proctoring'}</span>
                    {requireMicrophone && (micActive ? <Mic size={6} className="text-green-400" /> : <MicOff size={6} className="text-red-400" />)}
                </div>
            </div>
            {/* Drag Hint */}
            <div className="w-full text-center mt-1">
                <div className="w-8 h-1 bg-slate-400/30 rounded-full mx-auto"></div>
            </div>
        </div>
    );
};

export default ProctoringCam;