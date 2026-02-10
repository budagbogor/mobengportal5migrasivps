
import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { AlertTriangle, Eye, EyeOff, ShieldCheck, CameraOff, Mic, MicOff, CheckCircle2 } from 'lucide-react';

interface ProctoringCamProps {
    onViolation: (type: 'LOOKING_AWAY' | 'NO_FACE') => void;
    isActive: boolean;
    onDeviceStatus?: (isReady: boolean) => void;
    requireCamera: boolean;
    requireMicrophone: boolean;
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
    const [isMinimized, setIsMinimized] = useState(false);

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
        if (!requireCamera) return;
        console.warn("Camera Permission/Init Warning:", error);
        // Don't block completely, just show warning. 
        // User said "init error but visible is fine" -> so we try to be lenient.
        setStatus('WARNING');
        setMessage('Kamera Bermasalah?');
        // We only set permissionError if it's strictly NotAllowed
        if (typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'NotAllowedError') {
            setPermissionError(true);
            setMessage('Izin Ditolak');
        }
        if (onDeviceStatus) onDeviceStatus(false);
    };

    // Called when Webcam component successfully loads video stream
    const handleUserMedia = (stream: MediaStream) => {
        // Camera is ready
        if (onDeviceStatus) onDeviceStatus(true);
        setStatus('OK');
        setMessage('Kamera Aktif');

        // Check Microphone lazily (don't block UI)
        if (requireMicrophone && !micActive) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => {
                    setMicActive(true);
                })
                .catch((err) => {
                    console.warn("Mic Permission Error:", err);
                    setMessage('Mic Mati'); // Just warn, don't error blocking
                });
        }
    };

    useEffect(() => {
        // Init FaceMesh
        // If it fails, we just log it but don't stop the video feed.
        if (!isActive || !requireCamera) return;

        let camera: any = null;
        let faceMesh: any = null;

        const initAI = async () => {
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
                    // Logic remains mostly same but less aggressive on "Error" state visualization
                    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                        return; // Just ignore if no face for a bit, don't spam errors on UI
                    }

                    // Simple Head Pose
                    const landmarks = results.multiFaceLandmarks[0];
                    const nose = landmarks[1];
                    const leftEye = landmarks[33];
                    const rightEye = landmarks[263];
                    const distToLeft = Math.abs(nose.x - leftEye.x);
                    const distToRight = Math.abs(nose.x - rightEye.x);
                    const yawRatio = distToLeft / (distToLeft + distToRight);

                    if (yawRatio < 0.25 || yawRatio > 0.75) {
                        setStatus('WARNING');
                        setMessage('Menoleh');
                        // Count violation in background
                        violationStreak.current += 1;
                        if (violationStreak.current > 50) { // Slower trigger
                            onViolation('LOOKING_AWAY');
                            violationStreak.current = 0;
                        }
                    } else {
                        setStatus('OK');
                        setMessage('Fokus');
                        violationStreak.current = 0;
                    }
                });

                if (webcamRef.current && webcamRef.current.video) {
                    camera = new Camera(webcamRef.current.video, {
                        onFrame: async () => {
                            if (webcamRef.current && webcamRef.current.video && faceMesh) {
                                try {
                                    await faceMesh.send({ image: webcamRef.current.video });
                                } catch (err) { }
                            }
                        },
                        width: 320,
                        height: 240,
                    });
                    camera.start();
                }
            } catch (e) {
                console.error("AI Init Failed (Non-fatal):", e);
                // We do NOT set Status=ERROR here, we let the video continue
            }
        };

        initAI();

        return () => {
            if (camera) try { camera.stop(); } catch (e) { }
            if (faceMesh) try { faceMesh.close(); } catch (e) { }
        };
    }, [isActive, requireCamera]);


    if (permissionError) {
        // Minimalist Error
        return (
            <div className="fixed top-20 right-2 z-[50] animate-bounce">
                <div className="bg-red-600 text-white p-2 rounded-full shadow-xl">
                    <CameraOff size={20} />
                </div>
            </div>
        )
    }

    if (!requireCamera) return null;

    return (
        <div
            className="fixed z-[9999] flex flex-col items-end transition-all duration-300"
            style={{
                top: '5rem',
                right: '0.5rem',
                transform: `translate(${position.x}px, ${position.y}px)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none'
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
        >
            {/* Minimal Controller */}
            <div className="flex items-center gap-1 mb-1 bg-black/40 rounded-full px-2 py-0.5 backdrop-blur-sm opacity-50 hover:opacity-100">
                <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="text-white hover:text-mobeng-yellow p-0.5"
                >
                    {isMinimized ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
            </div>

            {/* Video Feed - ALWAYS VISIBLE unless minimized */}
            <div className={`relative bg-black rounded-lg overflow-hidden border-2 shadow-xl transition-all duration-300
         ${status === 'OK' ? 'border-green-400' : status === 'WARNING' ? 'border-yellow-400' : 'border-slate-500'}
         ${isMinimized ? 'w-12 h-12 rounded-full border-0' : 'w-24 h-18 md:w-32 md:h-24'}
       `}>
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    width={160}
                    height={120}
                    screenshotFormat="image/jpeg"
                    className={`w-full h-full object-cover mirror-mode transform -scale-x-100 pointer-events-none ${isMinimized ? 'opacity-50' : ''}`}
                    onUserMediaError={handleUserMediaError}
                    onUserMedia={handleUserMedia}
                />

                {!isMinimized && (
                    <div className="absolute bottom-0 left-0 w-full bg-black/60 text-[7px] text-white text-center py-0.5 flex items-center justify-center gap-1 select-none pointer-events-none">
                        <span>{message}</span>
                        {requireMicrophone && (micActive ? <Mic size={6} className="text-green-400" /> : <MicOff size={6} className="text-red-400" />)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProctoringCam;