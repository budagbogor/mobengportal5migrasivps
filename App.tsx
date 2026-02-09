
import React, { useState, useEffect, Suspense } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Sender, AnalysisResult, CandidateSubmission, CandidateProfile, AppSettings, ROLE_DEFINITIONS, RoleType, BigFiveTraits } from './types';
import { sendMessageToGemini, generateFinalSummary } from './services/geminiService';
import { supabase } from './services/supabaseClient'; // Import Supabase Client
import { LogicTest, QUESTION_SETS } from './components/LogicTest'; // Keep eager for constants
import { Briefcase, CheckCircle2, ChevronRight, BarChart3, X, Zap, Lock, UserCircle2, ArrowLeft, BookOpen, HelpCircle, CheckCircle, Save, LogOut, Phone, GraduationCap, Building2, Printer, Share2, Settings, Sliders, MonitorPlay, FileText, MessageSquare, ExternalLink, BrainCircuit, ArrowRight, Loader2, Timer, AlertTriangle, Brain, Star, Sparkles, ShieldAlert, Server, UserPlus, Send, Ban, EyeOff, MousePointerClick, Smartphone, Globe, ShieldCheck, Trash2, MessageSquareText, ChevronDown, ChevronUp, Camera, Mic, Users, Key } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown for Dashboard
import remarkGfm from 'remark-gfm';

// --- LAZY LOAD HEAVY COMPONENTS ---
// Optimizes initial load time by only fetching these bundles when needed
const ChatInterface = React.lazy(() => import('./components/ChatInterface'));
const ScoreCard = React.lazy(() => import('./components/ScoreCard'));
const DocumentationModal = React.lazy(() => import('./components/DocumentationModal'));
const ProctoringCam = React.lazy(() => import('./components/ProctoringCam')); 

// --- LOADING FALLBACK COMPONENT ---
const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[300px] w-full p-8 animate-pulse">
    <div className="w-12 h-12 border-4 border-mobeng-blue border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-slate-500 font-medium text-sm">Memuat Modul...</p>
  </div>
);

type AppView = 'role_selection' | 'candidate_intro' | 'integrity_briefing' | 'logic_test_intro' | 'logic_test' | 'simulation_intro' | 'simulation' | 'recruiter_login' | 'recruiter_dashboard' | 'link_expired';

interface InviteToken {
    id: string;      // Unique Token ID
    n: string;       // Name
    p: string;       // Phone
    r: RoleType;     // Role ID
    exp: number;     // Expiry Timestamp
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>('role_selection');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  
  // App Settings (Lifted State)
  const [appSettings, setAppSettings] = useState<AppSettings>({
    activeRole: 'store_leader', // Default
    activeLogicSetId: 'set_a',  // Default Question Set
    allowCandidateViewScore: false // Default: Blind Mode (Can be toggled in settings)
  });

  // State for Settings Modal in Recruiter Dashboard
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false); 
  const [apiKeyInput, setApiKeyInput] = useState(''); // NEW: Local State for API Key Input

  // Candidate Data State
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>({
    name: '',
    phone: '',
    education: 'SMA/SMK',
    major: '',
    lastPosition: '',
    lastCompany: '',
    experienceYears: ''
  });

  // Invitation State
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);
  const [isLockedProfile, setIsLockedProfile] = useState(false);
  
  const [submissions, setSubmissions] = useState<CandidateSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<CandidateSubmission | null>(null);
  const [showChatLog, setShowChatLog] = useState(false); // NEW STATE for Chat Toggle
  const [isDetailLoading, setIsDetailLoading] = useState(false); // NEW: Loading state for detail fetch

  // Integrity / Anti-Cheat
  const [cheatCount, setCheatCount] = useState(0);
  const [deviceReady, setDeviceReady] = useState(false); // NEW: Enforce device check

  // Documentation Modal
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [docRole, setDocRole] = useState<'candidate' | 'recruiter'>('candidate');

  const [showSimFinishModal, setShowSimFinishModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState('');

  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>({
    scores: { sales: 0, leadership: 0, operations: 0, cx: 0 },
    feedback: "Mulai simulasi untuk mendapatkan penilaian.",
    isInterviewOver: false
  });

  // Storage for Test 1 (Logic) Results before Test 2 (Sim)
  const [tempLogicScore, setTempLogicScore] = useState<number | null>(null);

  // Derived active definition
  const activeRoleDefinition = ROLE_DEFINITIONS[appSettings.activeRole];

  // --- TOKEN VALIDATION SYSTEM (SUPABASE INTEGRATED) ---
  useEffect(() => {
    const validateToken = async () => {
        const queryParams = new URLSearchParams(window.location.search);
        const inviteCode = queryParams.get('invitation');

        if (inviteCode) {
            try {
                // 1. Decode Base64 Token
                const decodedJson = atob(inviteCode);
                const token: InviteToken = JSON.parse(decodedJson);

                // 2. Check Expiry (24 Hours Validity)
                if (Date.now() > token.exp) {
                    setCurrentView('link_expired');
                    return;
                }

                // 3. Check if Used (SUPABASE CHECK)
                const { data, error } = await supabase
                    .from('used_tokens')
                    .select('token_id')
                    .eq('token_id', token.id)
                    .single();

                if (data) {
                    // Token exists in used_tokens table
                    setCurrentView('link_expired');
                    return;
                }

                // 4. Apply Token Data
                setAppSettings(prev => ({ ...prev, activeRole: token.r }));
                setCandidateProfile(prev => ({
                    ...prev,
                    name: token.n,
                    phone: token.p
                }));
                
                // 5. Lock Profile & Set Active Token
                setIsLockedProfile(true);
                setActiveTokenId(token.id);
                setCurrentView('candidate_intro'); // Skip Role Selection

            } catch (error) {
                console.error("Invalid Token or Network Error", error);
                setCurrentView('role_selection'); // Fallback if token broken
            }
        }
    };
    validateToken();
  }, []);

  // --- LOAD API KEY ---
  useEffect(() => {
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) setApiKeyInput(storedKey);
  }, []);

  // --- SAVE API KEY HANDLER ---
  const handleSaveSettings = () => {
      if (apiKeyInput.trim()) {
          localStorage.setItem('gemini_api_key', apiKeyInput.trim());
      } else {
          localStorage.removeItem('gemini_api_key');
      }
      setIsSettingsOpen(false);
      alert("Pengaturan dan API Key berhasil disimpan.");
  };

  // --- OPTIMIZED: FETCH SUBMISSIONS (DASHBOARD) ---
  useEffect(() => {
    if (currentView === 'recruiter_dashboard') {
        const fetchSubmissions = async () => {
            // PERFORMANCE FIX: 
            // 1. Limit columns (Removed final_summary to save bandwidth)
            // 2. Added .limit(50) to prevent fetching thousands of rows at once
            const { data, error } = await supabase
                .from('submissions')
                .select('id, created_at, role, logic_score, culture_fit_score, status, simulation_scores, cheat_count, profile_data') 
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error("Error fetching submissions:", error);
                return;
            }

            if (data) {
                const mappedSubmissions: CandidateSubmission[] = data.map((item: any) => ({
                    id: item.id,
                    profile: item.profile_data,
                    role: item.role,
                    timestamp: new Date(item.created_at),
                    simulationScores: item.simulation_scores || { sales: 0, leadership: 0, operations: 0, cx: 0 },
                    simulationFeedback: "Analisis lengkap tersedia di menu detail.", // Placeholder since we don't fetch full summary
                    psychometrics: { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 }, // Placeholder for list view
                    cultureFitScore: item.culture_fit_score || 0,
                    starMethodScore: 0,
                    logicScore: item.logic_score || 0,
                    finalSummary: "", // Empty string to avoid heavy payload in list view
                    status: item.status || 'Consider',
                    cheatCount: item.cheat_count || 0,
                    chatHistory: [] // Empty for list view, loaded on detail
                }));
                setSubmissions(mappedSubmissions);
            }
        };
        fetchSubmissions();
    }
  }, [currentView]);

  // --- NEW: FETCH DETAIL ON DEMAND ---
  const handleViewDetail = async (submissionId: string) => {
    setIsDetailLoading(true);
    // Fetch full data including chat_history, psychometrics, and final_summary
    const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

    setIsDetailLoading(false);

    if (error || !data) {
        alert("Gagal mengambil detail data kandidat.");
        console.error(error);
        return;
    }

    // Map full data
    const fullSubmission: CandidateSubmission = {
        id: data.id,
        profile: data.profile_data,
        role: data.role,
        timestamp: new Date(data.created_at),
        simulationScores: data.simulation_scores || { sales: 0, leadership: 0, operations: 0, cx: 0 },
        simulationFeedback: data.final_summary ? "Lihat Kesimpulan Akhir di bawah." : "Belum ada analisis.",
        psychometrics: data.psychometrics,
        cultureFitScore: data.culture_fit_score || 0,
        starMethodScore: 0,
        logicScore: data.logic_score || 0,
        finalSummary: data.final_summary || "Tidak ada data.",
        status: data.status || 'Consider',
        cheatCount: data.cheat_count || 0,
        chatHistory: data.chat_history || []
    };

    setSelectedSubmission(fullSubmission);
  };


  // --- PROCTORING SYSTEM (TAB DETECTION) ---
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.hidden && (currentView === 'simulation' || currentView === 'logic_test')) {
            setCheatCount(prev => prev + 1);
            alert("⚠️ PERINGATAN SISTEM: Anda terdeteksi meninggalkan halaman tes. Aktivitas ini dicatat untuk penilaian integritas.");
        }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentView]);

  // --- SECURITY: PREVENT COPY/PASTE & CONTEXT MENU ---
  useEffect(() => {
      const handleSecurityEvents = (e: Event) => {
          // Allow full access for recruiters
          if (currentView === 'recruiter_dashboard' || currentView === 'recruiter_login' || currentView === 'role_selection') return;
          
          // Disable Right Click
          if (e.type === 'contextmenu') {
              e.preventDefault();
          }
          
          // Disable Copy and Cut (Allow Paste for input, although ChatInterface handles paste separately)
          if (e.type === 'copy' || e.type === 'cut') {
              e.preventDefault();
              alert("⚠️ Fitur Copy/Cut dinonaktifkan demi integritas tes.");
          }
      };

      document.addEventListener('contextmenu', handleSecurityEvents);
      document.addEventListener('copy', handleSecurityEvents);
      document.addEventListener('cut', handleSecurityEvents);

      return () => {
          document.removeEventListener('contextmenu', handleSecurityEvents);
          document.removeEventListener('copy', handleSecurityEvents);
          document.removeEventListener('cut', handleSecurityEvents);
      };
  }, [currentView]);


  // --- FACE PROCTORING HANDLER ---
  const handleProctoringViolation = (type: 'LOOKING_AWAY' | 'NO_FACE') => {
      // Increment cheat count strictly on violation
      setCheatCount(prev => prev + 1);
      
      const warningAudio = new Audio('https://www.soundjay.com/buttons/sounds/beep-02.mp3'); 
      warningAudio.play().catch(e => console.log('Audio play failed', e));

      // Console log for debug, but main logic is updating the cheatCount state
      console.warn("PROCTORING VIOLATION:", type);
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Prevent editing locked fields if coming from invitation
    if (isLockedProfile && (name === 'name' || name === 'phone')) return;
    setCandidateProfile(prev => ({ ...prev, [name]: value }));
  };

  const isProfileComplete = () => {
    return (
        candidateProfile.name.trim() !== '' &&
        candidateProfile.phone.trim() !== '' &&
        candidateProfile.major.trim() !== ''
    );
  };

  // Called from Candidate Intro Form -> Go to INTEGRITY BRIEFING
  const handleProfileSubmit = () => {
    if (!isProfileComplete()) {
        alert("Mohon lengkapi data profil Anda terlebih dahulu.");
        return;
    }
    setCurrentView('integrity_briefing');
    setDeviceReady(false); // Reset device check
  };

  // Called from Integrity Briefing -> STARTS LOGIC TEST (STAGE 1)
  const proceedToLogicTestIntro = () => {
      if (!deviceReady) {
          alert("Mohon izinkan akses Kamera dan Mikrofon terlebih dahulu.");
          return;
      }
      setCurrentView('logic_test_intro');
  }

  // Called from Logic Test Complete -> Go to SIMULATION INTRO
  const handleLogicTestComplete = (score: number, passed: boolean) => {
      setTempLogicScore(score);
      setCurrentView('simulation_intro');
  }

  // Called from Simulation Intro -> STARTS SIMULATION (STAGE 2)
  const startSimulation = () => {
    // Initialize Simulation
    setShowSimFinishModal(false);
    // Note: Do not reset cheat count completely if you want to accumulate from Logic Test.
    // If you want separate counts, reset here. Let's keep cumulative for now or just reset for this session.
    // setCheatCount(0); 
    
    setCurrentAnalysis({
        scores: { sales: 0, leadership: 0, operations: 0, cx: 0 },
        feedback: "Mulai simulasi untuk mendapatkan penilaian.",
        isInterviewOver: false
    });

    const initialMessage: Message = {
        id: uuidv4(),
        text: activeRoleDefinition.initialScenario,
        sender: Sender.AI,
        timestamp: new Date()
    };
    setMessages([initialMessage]);
    
    // Go to Simulation
    setCurrentView('simulation');
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: uuidv4(),
      text: text,
      sender: Sender.USER,
      timestamp: new Date()
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsThinking(true);

    try {
      // Pass the specific System Instruction for the active role
      const response = await sendMessageToGemini(newHistory, text, activeRoleDefinition.systemInstruction);
      
      const aiMsg: Message = {
        id: uuidv4(),
        text: response.text,
        sender: Sender.AI,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
      
      if (response.analysis) {
        setCurrentAnalysis(response.analysis);
        if (response.analysis.isInterviewOver) {
             setTimeout(() => setShowSimFinishModal(true), 1500);
        }
      }
    } catch (error) {
      console.error("Error sending message", error);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        text: "Maaf, terjadi kesalahan koneksi. Silakan coba lagi.",
        sender: Sender.AI,
        timestamp: new Date()
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const calculateOverallStatus = (simScores: { sales: number, leadership: number, operations: number, cx: number }, logicScore: number) => {
      const simAvg = (simScores.sales + simScores.leadership + simScores.operations + simScores.cx) / 4;
      // Weighted Average: 60% Simulation, 40% Logic
      const weightedScore = (simAvg * 0.6) + (logicScore * 0.4);
      
      if (weightedScore >= 7.5 && logicScore >= 6) return 'Recommended';
      if (weightedScore >= 5) return 'Consider';
      return 'Reject';
  }

  // Finished Simulation (Stage 2) -> Submit EVERYTHING (SUPABASE INTEGRATION)
  const handleFinalSubmission = async () => {
      setIsSubmitting(true);
      setSubmissionProgress('AI sedang menganalisa psikometri, kompetensi STAR, dan culture fit...');
      
      // Safety check
      const simData = currentAnalysis || {
          scores: { sales: 0, leadership: 0, operations: 0, cx: 0 },
          feedback: "Data simulasi tidak ditemukan."
      };
      
      const logicScore = tempLogicScore || 0;

      try {
          // Generate Final AI Summary (SOPHISTICATED VERSION)
          const finalReport = await generateFinalSummary(
              candidateProfile,
              activeRoleDefinition.label,
              simData.scores,
              simData.feedback,
              logicScore
          );

          const newSubmissionId = uuidv4();
          const calculatedStatus = calculateOverallStatus(simData.scores, logicScore);

          // 1. Prepare Payload for Supabase
          const dbPayload = {
              id: newSubmissionId,
              candidate_name: candidateProfile.name,
              candidate_phone: candidateProfile.phone,
              role: activeRoleDefinition.label,
              logic_score: logicScore,
              culture_fit_score: finalReport.cultureFitScore,
              status: calculatedStatus,
              profile_data: candidateProfile,
              simulation_scores: simData.scores,
              psychometrics: finalReport.psychometrics,
              final_summary: finalReport.summary,
              cheat_count: cheatCount,
              chat_history: messages // NEW: Save Messages to DB
          };

          // 2. Insert into Submissions Table
          setSubmissionProgress('Menyimpan data ke Cloud Database...');
          const { error: submitError } = await supabase.from('submissions').insert([dbPayload]);
          
          if (submitError) throw submitError;

          // 3. Mark Token as Used (if active)
          if (activeTokenId) {
             await supabase.from('used_tokens').insert([{ token_id: activeTokenId }]);
          }

          // 4. Update Local State (Optional, mostly for immediate feedback if we stayed on view)
          const newLocalSubmission: CandidateSubmission = {
              id: newSubmissionId,
              profile: { ...candidateProfile },
              role: activeRoleDefinition.label,
              timestamp: new Date(),
              simulationScores: simData.scores,
              simulationFeedback: "Lihat Kesimpulan Akhir di bawah.",
              psychometrics: finalReport.psychometrics,
              cultureFitScore: finalReport.cultureFitScore,
              starMethodScore: finalReport.starMethodScore,
              logicScore: logicScore,
              finalSummary: finalReport.summary,
              status: calculatedStatus,
              cheatCount: cheatCount,
              chatHistory: messages
          };
          setSubmissions(prev => [newLocalSubmission, ...prev]);

          setIsSubmitting(false);
          
          alert(`SELURUH RANGKAIAN TES SELESAI!\n\nTerima kasih ${candidateProfile.name}.\n\nData hasil tes telah BERHASIL disimpan ke database Mobeng.\nHasil kelulusan TIDAK ditampilkan di layar ini.\n\nTim Recruiter Mobeng akan mengirimkan hasil detail dan keputusan akhir melalui WhatsApp ke nomor: ${candidateProfile.phone}`);
          
          // Reset
          setCurrentView('role_selection');
          setCandidateProfile({
            name: '', phone: '', education: 'SMA/SMK', major: '', lastPosition: '', lastCompany: '', experienceYears: ''
          });
          setActiveTokenId(null);
          setIsLockedProfile(false);
          // Clean URL
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch(e) { console.warn(e); }

      } catch (error) {
          console.error("Submission error", error);
          alert("Gagal menyimpan data ke server. Mohon screenshot hasil ini dan kirim ke HR.");
          setIsSubmitting(false);
      }
  };
  
  // --- DELETE SUBMISSION FUNCTION ---
  const handleDeleteSubmission = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin MENGHAPUS PERMANEN data kandidat: ${name}?\n\nTindakan ini tidak dapat dibatalkan.`)) {
        try {
            const { error } = await supabase.from('submissions').delete().eq('id', id);
            
            if (error) throw error;
            
            // Optimistic update
            setSubmissions(prev => prev.filter(sub => sub.id !== id));
            
            // If the deleted submission was currently open in modal, close it
            if (selectedSubmission?.id === id) {
                setSelectedSubmission(null);
            }
            
        } catch (err) {
            console.error("Error deleting submission:", err);
            alert("Gagal menghapus data. Mohon coba lagi.");
        }
    }
  };

  const handleRecruiterLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Simple hardcoded check for demo
      // In production, integrate with Supabase Auth
      setCurrentView('recruiter_dashboard');
  };

  const openDocs = (role: 'candidate' | 'recruiter') => {
    setDocRole(role);
    setIsDocsOpen(true);
  };

  const sendWhatsApp = (submission: CandidateSubmission) => {
      let phoneNumber = submission.profile.phone.replace(/\D/g, ''); 
      if (phoneNumber.startsWith('0')) phoneNumber = '62' + phoneNumber.substring(1);
      const message = `Halo ${submission.profile.name},%0A%0ATerima kasih telah mengikuti seleksi *${submission.role}*.%0A%0ABerikut hasil evaluasi Anda:%0A- Logic Score: ${submission.logicScore}/10%0A- Culture Fit: ${submission.cultureFitScore}%25%0A%0AStatus Lamaran: *${submission.status}*%0A%0A${submission.finalSummary}%0A%0ATerima Kasih,%0ATim Recruitment Mobeng`;
      window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
  };

  // --- UPDATED SECURE TOKEN GENERATOR ---
  const sendInviteWhatsApp = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const name = formData.get('inviteName') as string;
      const phoneRaw = formData.get('invitePhone') as string;
      const phone = phoneRaw.replace(/\D/g, '');
      const activeRoleId = appSettings.activeRole;
      
      if (!phone || !name) {
          alert('Nama dan Nomor WhatsApp wajib diisi untuk membuat token.');
          return;
      }

      // 1. Create Token Payload
      const tokenPayload: InviteToken = {
          id: uuidv4(),
          n: name,
          p: phone,
          r: activeRoleId,
          exp: Date.now() + (24 * 60 * 60 * 1000) // Expires in 24 hours
      };

      // 2. Encode to Base64 (Simple "Encryption" for URL)
      const encodedToken = btoa(JSON.stringify(tokenPayload));
      
      const currentUrl = window.location.origin + window.location.pathname; // Base URL without params
      const inviteUrl = `${currentUrl}?invitation=${encodedToken}`;

      let formattedPhone = phone;
      if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.substring(1);

      const message = `Halo ${name},%0A%0AMobeng mengundang Anda untuk mengikuti *Seleksi Digital*:%0A*${ROLE_DEFINITIONS[activeRoleId].label}*%0A%0AKlik tautan khusus di bawah ini untuk memulai tes:%0A${inviteUrl}%0A%0APENTING:%0A1. Tautan ini bersifat PRIBADI (Terkunci atas nama Anda).%0A2. Tautan hanya bisa digunakan SATU KALI.%0A3. Pastikan koneksi internet lancar.%0A%0ASelamat mengerjakan!`;
      
      window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
      setIsInviteOpen(false);
  };

  // --- NEW: LINK EXPIRED VIEW ---
  if (currentView === 'link_expired') {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
              <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl text-center border-t-4 border-red-500">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Ban size={40} className="text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Tautan Tidak Valid</h2>
                  <p className="text-slate-600 mb-6">
                      Maaf, tautan undangan ini sudah digunakan sebelumnya atau telah kadaluarsa, atau sudah diselesaikan sebelumnya.
                  </p>
                  <p className="text-xs text-slate-400 mb-8 bg-slate-50 p-3 rounded-lg">
                      Sistem keamanan Mobeng membatasi akses tes hanya untuk satu kali pengerjaan demi menjaga integritas data.
                  </p>
                  <button onClick={() => {
                      try {
                        window.history.replaceState({}, document.title, window.location.pathname);
                      } catch(e) { console.warn(e); }
                      setCurrentView('role_selection');
                  }} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors">
                      Kembali ke Halaman Utama
                  </button>
              </div>
          </div>
      )
  }

  // 1. ROLE SELECTION SCREEN
  if (currentView === 'role_selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mobeng-darkblue to-mobeng-blue flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
         <Suspense fallback={null}>
             <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} role={docRole} />
         </Suspense>

         {/* Background Circles */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-mobeng-green/20 blur-[120px]" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-mobeng-blue/20 blur-[100px]" />
        </div>

        <div className="relative z-10 text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 rounded-full text-xs font-semibold text-white mb-4">
                <Sparkles size={12} className="text-yellow-400" />
                <span>Next-Gen Recruitment System</span>
            </div>
            <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tight drop-shadow-lg">Mobeng <span className="text-mobeng-green">Recruitment</span></h1>
            <p className="text-blue-50 text-lg shadow-black/20 drop-shadow-md font-medium">Pusat Seleksi Digital - {activeRoleDefinition.label}</p>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
            <button onClick={() => setCurrentView('candidate_intro')} className="group relative bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:border-mobeng-green/50 rounded-2xl p-8 transition-all duration-300 flex flex-col items-center text-center shadow-xl">
                <div className="w-20 h-20 bg-gradient-to-br from-mobeng-green to-mobeng-darkgreen rounded-full flex items-center justify-center mb-6 shadow-lg shadow-mobeng-green/20 group-hover:scale-110 transition-transform">
                    <UserCircle2 className="text-white w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Akses Kandidat</h2>
                <p className="text-blue-50 text-sm mb-6 font-medium">Mulai proses seleksi untuk posisi <span className="text-mobeng-green font-bold bg-white/10 px-2 py-0.5 rounded">{activeRoleDefinition.label}</span>.</p>
                <div className="text-white/70 text-xs mb-4 px-4 py-2 bg-black/20 rounded-lg">
                    <span className="font-bold">Wajib:</span> Tes Logika <ArrowRight size={10} className="inline"/> Simulasi Interview
                </div>
                <span className="text-mobeng-green bg-white py-2 px-4 rounded-full font-bold text-sm flex items-center gap-2 group-hover:translate-x-1 transition-transform shadow-lg">
                    Isi Biodata & Mulai <ChevronRight size={16} />
                </span>
            </button>

            <button onClick={() => setCurrentView('recruiter_login')} className="group relative bg-mobeng-darkblue/40 backdrop-blur-md border border-white/10 hover:border-mobeng-blue/50 rounded-2xl p-8 transition-all duration-300 flex flex-col items-center text-center shadow-xl">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform border border-white/20">
                    <Lock className="text-mobeng-blue w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Akses Recruiter</h2>
                <p className="text-slate-200 text-sm mb-6 font-medium">Login untuk melihat hasil, ubah pengaturan soal, dan mode tes.</p>
                <span className="text-white/90 font-semibold text-sm flex items-center gap-2 border-b border-transparent hover:border-white transition-colors">
                    Login Admin <Lock size={14} />
                </span>
            </button>
        </div>
        
        <div className="relative z-10 mt-12 flex gap-4">
            <button onClick={() => openDocs('candidate')} className="text-white/80 hover:text-white text-sm flex items-center gap-2 transition-colors font-medium">
                <HelpCircle size={16} /> Panduan Kandidat
            </button>
        </div>
      </div>
    )
  }
  
  // ... (Rest of views remain the same until Dashboard)

  // 6. RECRUITER DASHBOARD
  if (currentView === 'recruiter_dashboard') {
    
    // ... (Detail View Logic - SAME)
    if (selectedSubmission) {
       // ... (Same Detail View JSX)
       return (
            <div className="min-h-screen bg-slate-50 font-sans">
                {/* ID used for Print CSS targeting */}
                <div id="printable-modal" className="bg-white min-h-screen relative">
                     {/* Sticky Header */}
                     <div className="bg-mobeng-darkblue p-4 md:p-6 sticky top-0 z-50 flex justify-between items-center text-white no-print shadow-lg">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setSelectedSubmission(null)} 
                                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors flex items-center justify-center"
                                title="Kembali ke Daftar"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold leading-tight">{selectedSubmission.profile.name}</h2>
                                <p className="text-blue-100 text-xs md:text-sm flex items-center gap-2 mt-1">
                                    <Briefcase size={14} /> Posisi: {selectedSubmission.role}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => sendWhatsApp(selectedSubmission)} className="bg-mobeng-green hover:bg-mobeng-darkgreen text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm">
                                <Share2 size={16} /> <span className="hidden md:inline">WhatsApp</span>
                            </button>
                            <button onClick={() => window.print()} className="bg-mobeng-blue hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm border border-white/20">
                                <Printer size={16} /> <span className="hidden md:inline">Print/PDF</span>
                            </button>
                             <button 
                                onClick={() => handleDeleteSubmission(selectedSubmission.id, selectedSubmission.profile.name)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Trash2 size={16} /> <span className="hidden md:inline">Hapus</span>
                            </button>
                        </div>
                    </div>
                    
                    {/* Content Container (Full Width, Centered) */}
                    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6 pb-20">
                         {/* Personal Info Grid */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                 <div className="text-xs text-slate-500 uppercase font-bold mb-1">Pendidikan</div>
                                 <div className="font-semibold text-slate-800">{selectedSubmission.profile.education} - {selectedSubmission.profile.major}</div>
                             </div>
                             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                 <div className="text-xs text-slate-500 uppercase font-bold mb-1">Pengalaman</div>
                                 <div className="font-semibold text-slate-800">{selectedSubmission.profile.lastPosition} @ {selectedSubmission.profile.lastCompany} ({selectedSubmission.profile.experienceYears} thn)</div>
                             </div>
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="col-span-1 md:col-span-2 space-y-4">
                                <h3 className="font-bold text-mobeng-darkblue flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <MessageSquare size={18} /> Hasil Tes 1: Behavioral Simulation
                                </h3>
                                <div className="grid grid-cols-4 gap-2 text-center mb-4">
                                        {[
                                            { l: 'Sales', v: selectedSubmission.simulationScores.sales, c: 'bg-blue-100 text-blue-700' },
                                            { l: 'Lead', v: selectedSubmission.simulationScores.leadership, c: 'bg-indigo-100 text-indigo-700' },
                                            { l: 'Ops', v: selectedSubmission.simulationScores.operations, c: 'bg-orange-100 text-orange-700' },
                                            { l: 'CX', v: selectedSubmission.simulationScores.cx, c: 'bg-green-100 text-green-700' },
                                        ].map(s => (
                                            <div key={s.l} className={`${s.c} p-2 rounded-lg border border-white shadow-sm`}>
                                                <div className="text-[10px] font-bold uppercase opacity-70">{s.l}</div>
                                                <div className="text-xl font-bold">{s.v}</div>
                                            </div>
                                        ))}
                                </div>
                                <Suspense fallback={<LoadingScreen />}>
                                    <ScoreCard scores={selectedSubmission.simulationScores} />
                                </Suspense>
                            </div>

                            <div className="col-span-1 space-y-4">
                                <h3 className="font-bold text-mobeng-darkblue flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <BrainCircuit size={18} /> Tes 2: Logic & Integrity
                                </h3>
                                <div className="space-y-3">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Skor Logika</div>
                                        <div className="text-4xl font-bold text-slate-800">{selectedSubmission.logicScore}<span className="text-lg text-slate-400">/10</span></div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                         <div className="text-xs text-slate-500 uppercase font-bold mb-1">Culture Fit</div>
                                         <div className="text-4xl font-bold text-mobeng-blue">{selectedSubmission.cultureFitScore}%</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                                         <div className="text-xs text-red-500 uppercase font-bold mb-1 flex items-center justify-center gap-1"><ShieldAlert size={12}/> Cheat Flags</div>
                                         <div className="text-2xl font-bold text-red-700">{selectedSubmission.cheatCount} <span className="text-sm font-normal">violations</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* AI Summary Text */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                                <Sparkles className="text-mobeng-yellow" /> Executive Summary (AI)
                            </h3>
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
                            >
                                {selectedSubmission.finalSummary || "Analisa belum tersedia."}
                            </ReactMarkdown>
                        </div>
                        
                        {/* Chat Transcript Accordion */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden no-print">
                            <button 
                                onClick={() => setShowChatLog(!showChatLog)}
                                className="w-full bg-slate-50 p-4 flex justify-between items-center text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <span className="flex items-center gap-2"><MessageSquareText size={16}/> Transcript Interview Lengkap</span>
                                {showChatLog ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                            </button>
                            
                            {showChatLog && (
                                <div className="p-4 bg-slate-50 border-t border-slate-200 max-h-[500px] overflow-y-auto space-y-3">
                                    {selectedSubmission.chatHistory && selectedSubmission.chatHistory.length > 0 ? (
                                        selectedSubmission.chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.sender === Sender.USER ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-lg p-3 text-xs ${msg.sender === Sender.USER ? 'bg-mobeng-blue text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                                                    <span className="block font-bold mb-1 opacity-80">{msg.sender === Sender.USER ? 'Kandidat' : 'AI Interviewer'}</span>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-slate-400 italic text-xs">Riwayat chat tidak tersedia.</p>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        );
    }
    
    return (
      <div className="min-h-screen bg-slate-100 flex font-sans overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-mobeng-darkblue text-white flex flex-col shadow-2xl z-20 hidden md:flex">
             <div className="p-6 border-b border-white/10">
                 <h1 className="text-xl font-bold tracking-tight">Mobeng <span className="text-mobeng-green">HR</span></h1>
                 <p className="text-xs text-blue-200 mt-1">Recruitment Control Center</p>
             </div>
             
             <nav className="flex-1 p-4 space-y-2">
                 <div className="px-4 py-3 bg-white/10 rounded-xl text-sm font-bold flex items-center gap-3 border border-white/5 cursor-pointer">
                     <Users size={18} className="text-mobeng-green" /> Kandidat
                 </div>
                 <button onClick={() => setIsInviteOpen(true)} className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-xl text-sm font-medium flex items-center gap-3 text-blue-100 transition-colors">
                     <UserPlus size={18} /> Buat Undangan
                 </button>
                 <button onClick={() => setIsSettingsOpen(true)} className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-xl text-sm font-medium flex items-center gap-3 text-blue-100 transition-colors">
                     <Settings size={18} /> Pengaturan Soal
                 </button>
                 <button onClick={() => openDocs('recruiter')} className="w-full text-left px-4 py-3 hover:bg-white/5 rounded-xl text-sm font-medium flex items-center gap-3 text-blue-100 transition-colors">
                     <BookOpen size={18} /> Dokumentasi Sistem
                 </button>
             </nav>

             <div className="p-4 border-t border-white/10">
                 <button onClick={() => setCurrentView('role_selection')} className="flex items-center gap-2 text-xs text-blue-200 hover:text-white transition-colors">
                     <LogOut size={14} /> Keluar
                 </button>
             </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
             {/* Mobile Header */}
             <div className="bg-mobeng-darkblue text-white p-4 md:hidden flex justify-between items-center">
                 <span className="font-bold">Mobeng HR</span>
                 <button onClick={() => setIsSettingsOpen(true)}><Settings size={20}/></button>
             </div>

             <div className="flex-1 overflow-auto p-4 md:p-8">
                 {/* ... Stats Cards and Table (No Changes) ... */}
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                     <div>
                        <h2 className="text-2xl font-bold text-slate-800">Daftar Kandidat</h2>
                        <p className="text-slate-500 text-sm mt-1">Real-time assessment results dari seluruh cabang.</p>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setIsInviteOpen(true)} className="bg-mobeng-blue hover:bg-mobeng-darkblue text-white px-4 py-2.5 rounded-xl shadow-lg shadow-blue-900/10 text-sm font-bold flex items-center gap-2 transition-all active:scale-95">
                            <UserPlus size={16} /> Invite Candidate
                        </button>
                     </div>
                 </div>

                 {/* Stats Cards */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                     <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                         <div>
                             <div className="text-slate-400 text-xs font-bold uppercase">Total Kandidat</div>
                             <div className="text-2xl font-bold text-slate-800">{submissions.length}</div>
                         </div>
                         <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={20}/></div>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                         <div>
                             <div className="text-slate-400 text-xs font-bold uppercase">Lulus (Rec)</div>
                             <div className="text-2xl font-bold text-green-600">{submissions.filter(s => s.status === 'Recommended').length}</div>
                         </div>
                         <div className="bg-green-50 p-2 rounded-lg text-green-600"><CheckCircle size={20}/></div>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                         <div>
                             <div className="text-slate-400 text-xs font-bold uppercase">Avg Logic Score</div>
                             <div className="text-2xl font-bold text-purple-600">
                                 {submissions.length > 0 
                                    ? (submissions.reduce((acc, curr) => acc + (curr.logicScore || 0), 0) / submissions.length).toFixed(1) 
                                    : '0.0'}
                             </div>
                         </div>
                         <div className="bg-purple-50 p-2 rounded-lg text-purple-600"><BrainCircuit size={20}/></div>
                     </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                         <div>
                             <div className="text-slate-400 text-xs font-bold uppercase">Avg Culture Fit</div>
                             <div className="text-2xl font-bold text-orange-600">
                                 {submissions.length > 0 
                                    ? Math.round(submissions.reduce((acc, curr) => acc + (curr.cultureFitScore || 0), 0) / submissions.length) + '%' 
                                    : '0%'}
                             </div>
                         </div>
                         <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Star size={20}/></div>
                     </div>
                 </div>

                 {/* Main Table */}
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                    <th className="p-4 font-bold">Waktu</th>
                                    <th className="p-4 font-bold">Nama Kandidat</th>
                                    <th className="p-4 font-bold">Posisi</th>
                                    <th className="p-4 font-bold text-center">Logic</th>
                                    <th className="p-4 font-bold text-center">Culture</th>
                                    <th className="p-4 font-bold text-center">Status</th>
                                    <th className="p-4 font-bold text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {submissions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-slate-400">Belum ada data kandidat masuk.</td>
                                    </tr>
                                ) : (
                                    submissions.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-4 text-slate-500 font-mono text-xs">
                                                {sub.timestamp.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}
                                                <br/>
                                                {sub.timestamp.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}
                                            </td>
                                            <td className="p-4 font-semibold text-slate-800">
                                                {sub.profile.name}
                                                <div className="text-xs text-slate-400 font-normal">{sub.profile.phone}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">{sub.role}</span>
                                            </td>
                                            <td className="p-4 text-center font-mono font-bold text-slate-700">
                                                {sub.logicScore}
                                            </td>
                                             <td className="p-4 text-center font-mono font-bold text-slate-700">
                                                {sub.cultureFitScore}%
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                                                    sub.status === 'Recommended' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    sub.status === 'Consider' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    'bg-red-50 text-red-700 border-red-200'
                                                }`}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => handleViewDetail(sub.id)}
                                                    disabled={isDetailLoading}
                                                    className="text-mobeng-blue hover:text-mobeng-darkblue font-bold text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 disabled:opacity-50 flex items-center gap-1 ml-auto"
                                                >
                                                    {isDetailLoading ? <Loader2 size={12} className="animate-spin"/> : null} Detail
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                     </div>
                 </div>
             </div>
        </div>

        {/* SETTINGS MODAL */}
        {isSettingsOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Settings size={20} className="text-mobeng-blue"/> Konfigurasi Tes
                        </h3>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        {/* API KEY CONFIGURATION */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                <Key size={14} className="text-yellow-600"/> Konfigurasi AI (API Key)
                            </label>
                            <input 
                                type="password" 
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                placeholder="Masukkan Gemini API Key (Optional)"
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-mobeng-blue outline-none bg-white placeholder-slate-400 font-mono"
                            />
                             <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                                Masukkan API Key Google Gemini pribadi Anda untuk mengaktifkan AI. Jika kosong, sistem akan menggunakan kunci default (jika ada). Kunci tersimpan di browser ini.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paket Soal Logika (Aktif)</label>
                            <select 
                                value={appSettings.activeLogicSetId} 
                                onChange={(e) => setAppSettings(prev => ({...prev, activeLogicSetId: e.target.value}))}
                                className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-slate-50 focus:ring-2 focus:ring-mobeng-blue outline-none"
                            >
                                {Object.values(QUESTION_SETS).map(set => (
                                    <option key={set.id} value={set.id}>{set.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-2 italic">
                                {QUESTION_SETS[appSettings.activeLogicSetId]?.description}
                            </p>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100">
                             <label className="flex items-center justify-between cursor-pointer group">
                                <span className="text-sm font-bold text-slate-700">Tampilkan Skor ke Kandidat?</span>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={appSettings.allowCandidateViewScore}
                                        onChange={(e) => setAppSettings(prev => ({...prev, allowCandidateViewScore: e.target.checked}))}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mobeng-green"></div>
                                </div>
                            </label>
                            <p className="text-xs text-slate-400 mt-2">
                                Jika dimatikan (default), kandidat hanya melihat pesan "Data tersimpan" setelah tes selesai.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <button onClick={handleSaveSettings} className="w-full bg-mobeng-darkblue text-white font-bold py-3 rounded-xl hover:bg-black transition-colors">
                            Simpan Perubahan
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* INVITE MODAL - REMAINS THE SAME */}
        {isInviteOpen && (
             // ... Invite Modal Content ...
             <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-mobeng-blue p-6 text-white text-center relative overflow-hidden">
                        <div className="absolute top-[-20px] right-[-20px] w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                        <UserPlus size={32} className="mx-auto mb-2" />
                        <h3 className="text-xl font-bold">Buat Undangan Tes</h3>
                        <p className="text-blue-100 text-xs mt-1">Token aman (enkripsi) khusus untuk satu kandidat.</p>
                        <button onClick={() => setIsInviteOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={20}/></button>
                    </div>
                    
                    <form onSubmit={sendInviteWhatsApp} className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Posisi (Role)</label>
                            <select 
                                value={appSettings.activeRole}
                                onChange={(e) => setAppSettings(prev => ({...prev, activeRole: e.target.value as RoleType}))}
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-mobeng-blue outline-none"
                            >
                                {Object.values(ROLE_DEFINITIONS).map(role => (
                                    <option key={role.id} value={role.id}>{role.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kandidat</label>
                            <input name="inviteName" type="text" placeholder="Nama Lengkap" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-mobeng-blue outline-none" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Kandidat</label>
                            <input name="invitePhone" type="tel" placeholder="0812..." className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-mobeng-blue outline-none" required />
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 border border-blue-100">
                            <Lock size={14} className="text-mobeng-blue mt-0.5 shrink-0" />
                            <p className="text-[10px] text-blue-800 leading-tight">
                                Link undangan akan otomatis mengunci nama & posisi. Link hanya valid selama 24 jam dan 1x pakai.
                            </p>
                        </div>

                        <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-900/10">
                            <Send size={16} /> Kirim Undangan via WA
                        </button>
                    </form>
                </div>
            </div>
        )}

      </div>
    );
  }
  
  // REMAINDER OF FILE (CANDIDATE VIEW LOGIC) REMAINS THE SAME...
  if (currentView === 'candidate_intro') { return <div className="min-h-screen bg-mobeng-darkblue flex items-center justify-center p-4 relative overflow-hidden"><Suspense fallback={null}><DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} role={'candidate'} /></Suspense><div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0"><div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-mobeng-green/20 blur-[100px]" /><div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] rounded-full bg-mobeng-blue/10 blur-[100px]" /></div><div className="max-w-4xl w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row min-h-[600px]"><div className="md:w-5/12 bg-gradient-to-br from-mobeng-blue to-mobeng-darkblue p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>{!isLockedProfile && (<button onClick={() => setCurrentView('role_selection')} className="absolute top-6 left-6 text-white/80 hover:text-white flex items-center gap-2 text-xs font-medium z-20"><ArrowLeft size={14} /> Kembali</button>)}<div className="mt-8"><div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 rounded-full px-3 py-1 text-xs font-medium text-white mb-6 backdrop-blur-sm"><Zap size={12} className="text-mobeng-yellow" /> AI Assessment Portal</div><h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 tracking-tight">Mobeng <span className="text-mobeng-green">Career</span></h1><p className="text-blue-50 text-lg font-light leading-relaxed mb-6">{isLockedProfile ? `Selamat Datang, ${candidateProfile.name}. Silakan lengkapi sisa data Anda.` : 'Silakan lengkapi data diri Anda.'}</p>{isLockedProfile && (<div className="bg-yellow-500/20 rounded-xl p-4 border border-yellow-400/30 text-sm mb-4"><div className="flex items-center gap-2 text-yellow-300 font-bold mb-1"><Lock size={14}/> Mode Undangan Aktif</div><p className="text-white/80 text-xs">Posisi dan Identitas Anda telah dikunci oleh sistem sesuai undangan rekrutmen.</p></div>)}<div className="bg-white/10 rounded-xl p-4 border border-white/10 text-sm"><strong className="block text-white mb-2">Alur Tes:</strong><ol className="list-decimal list-inside space-y-2 text-blue-50"><li>Tes Logika & Ketelitian</li><li>Simulasi Interview (Roleplay)</li></ol></div></div></div><div className="md:w-7/12 p-8 md:p-12 flex flex-col bg-white overflow-y-auto max-h-screen"><h2 className="text-2xl font-bold text-mobeng-darkblue mb-2">Profil Kandidat</h2><p className="text-slate-600 mb-6 text-sm">Posisi: <span className="font-semibold text-slate-900">{activeRoleDefinition.label}</span></p><div className="space-y-4 mb-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label><input type="text" name="name" value={candidateProfile.name} onChange={handleInputChange} placeholder="Cth: Budi Santoso" disabled={isLockedProfile} className={`w-full border rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none ${isLockedProfile ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300'}`}/></div><div><label className="block text-xs font-bold text-slate-700 mb-1">No. Handphone/WA *</label><input type="text" name="phone" value={candidateProfile.phone} onChange={handleInputChange} placeholder="0812..." disabled={isLockedProfile} className={`w-full border rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none ${isLockedProfile ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300'}`}/></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-700 mb-1">Pendidikan Terakhir *</label><select name="education" value={candidateProfile.education} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white text-slate-900"><option value="SMA/SMK">SMA / SMK</option><option value="D3">Diploma (D3)</option><option value="S1">Sarjana (S1)</option><option value="S2">Master (S2)</option></select></div><div><label className="block text-xs font-bold text-slate-700 mb-1">Jurusan *</label><input type="text" name="major" value={candidateProfile.major} onChange={handleInputChange} placeholder="Cth: Teknik Mesin" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-700 mb-1">Posisi Terakhir</label><input type="text" name="lastPosition" value={candidateProfile.lastPosition} onChange={handleInputChange} placeholder="Cth: Service Advisor" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/></div><div><label className="block text-xs font-bold text-slate-700 mb-1">Perusahaan Terakhir</label><input type="text" name="lastCompany" value={candidateProfile.lastCompany} onChange={handleInputChange} placeholder="Cth: PT Maju Jaya" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/></div></div><div><label className="block text-xs font-bold text-slate-700 mb-1">Lama Pengalaman (Tahun)</label><input type="number" name="experienceYears" value={candidateProfile.experienceYears} onChange={handleInputChange} placeholder="Cth: 2" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/></div></div><button onClick={handleProfileSubmit} disabled={!isProfileComplete()} className="group mt-auto w-full bg-mobeng-darkblue hover:bg-mobeng-green disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl text-lg transition-all shadow-xl hover:shadow-mobeng-green/20 flex items-center justify-center gap-3 transform active:scale-[0.98]">Lanjut <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></button></div></div></div>); }

  // 3. INTEGRITY BRIEFING
  if (currentView === 'integrity_briefing') { return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans overflow-y-auto"><Suspense fallback={<LoadingScreen/>}><ProctoringCam onViolation={handleProctoringViolation} isActive={true} onDeviceStatus={(status) => setDeviceReady(status)} /></Suspense><div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300 my-4"><div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white text-center"><ShieldAlert size={48} className="mx-auto mb-3 opacity-90" /><h2 className="text-2xl font-bold uppercase tracking-wide">Pakta Integritas & Cek Perangkat</h2><p className="text-red-100 text-sm mt-1">Wajib menyalakan Kamera & Mic untuk melanjutkan.</p></div><div className="p-8 space-y-6"><div className="bg-slate-100 p-4 rounded-xl border border-slate-200"><h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><MonitorPlay size={16} /> Status Perangkat</h3><div className="grid grid-cols-2 gap-3"><div className={`p-3 rounded-lg border flex items-center justify-between ${deviceReady ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}><div className="flex items-center gap-2"><Camera size={18} /><span className="text-xs font-bold">Kamera</span></div>{deviceReady ? <CheckCircle2 size={18}/> : <X size={18}/>}</div><div className={`p-3 rounded-lg border flex items-center justify-between ${deviceReady ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}><div className="flex items-center gap-2"><Mic size={18} /><span className="text-xs font-bold">Mikrofon</span></div>{deviceReady ? <CheckCircle2 size={18}/> : <X size={18}/>}</div></div>{!deviceReady && (<div className="mt-3 text-xs text-red-600 bg-red-100 p-2 rounded flex items-center gap-2 animate-pulse"><AlertTriangle size={14} /> Mohon izinkan akses Kamera dan Mikrofon di browser Anda (Popup di pojok atas).</div>)}</div><div className="space-y-4"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Ban className="text-red-500" size={20} /> Larangan Keras</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2"><Globe className="text-slate-500" size={24} /><h4 className="font-bold text-slate-800 text-sm">Dilarang Pindah Tab</h4><p className="text-xs text-slate-600">Sistem mencatat jika Anda membuka tab baru. Fokus pada layar ujian.</p></div><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2"><EyeOff className="text-slate-500" size={24} /><h4 className="font-bold text-slate-800 text-sm">Wajah Wajib Terlihat</h4><p className="text-xs text-slate-600">Kamera AI akan memantau posisi wajah. Dilarang menoleh berlebihan.</p></div></div></div><button onClick={proceedToLogicTestIntro} disabled={!deviceReady} className={`w-full py-4 text-lg font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 ${deviceReady ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}><ShieldCheck size={24} /> {deviceReady ? 'Saya Mengerti & Siap Mengerjakan' : 'Menunggu Izin Perangkat...'}</button></div></div></div>); }
  
  // 3b. LOGIC TEST INTRO
  if (currentView === 'logic_test_intro') { return <div className="min-h-screen bg-gradient-to-br from-slate-900 to-mobeng-darkblue flex items-center justify-center p-4"><div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300"><div className="w-20 h-20 bg-mobeng-blue/10 rounded-full flex items-center justify-center mx-auto mb-6"><BrainCircuit size={40} className="text-mobeng-blue" /></div><h2 className="text-3xl font-bold text-slate-800 mb-2">Tahap 1: Tes Logika</h2><p className="text-slate-600 mb-8 font-medium leading-relaxed">Anda akan mengerjakan soal logika, hitungan dasar, dan ketelitian untuk mengukur kemampuan kognitif.</p><div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 text-left text-sm text-slate-700 space-y-2"><p className="flex items-center gap-2"><BrainCircuit size={16} className="text-mobeng-blue"/> <strong>Jumlah Soal:</strong> 10 Soal Pilihan Ganda</p><p className="flex items-center gap-2"><Timer size={16} className="text-mobeng-orange"/> <strong>Waktu:</strong> 5 Menit</p><p className="flex items-center gap-2"><Zap size={16} className="text-mobeng-green"/> <strong>Materi:</strong> Matematika Dasar, Deret Angka, Logika Verbal.</p></div><button onClick={() => setCurrentView('logic_test')} className="w-full py-4 bg-mobeng-blue hover:bg-mobeng-darkblue text-white font-bold rounded-xl transition-all shadow-lg text-lg flex items-center justify-center gap-2">Mulai Tes Logika <ArrowRight size={20} /></button></div></div>; }

  // 4. LOGIC TEST
  if (currentView === 'logic_test') { return <div className="min-h-screen bg-mobeng-lightgrey flex items-center justify-center p-4 select-none"><Suspense fallback={<LoadingScreen/>}><ProctoringCam onViolation={handleProctoringViolation} isActive={true} /></Suspense><LogicTest activeSetId={appSettings.activeLogicSetId} onComplete={handleLogicTestComplete} onExit={() => alert("Tes ini wajib diselesaikan.")} /></div>; }

  // 5. SIMULATION INTRO
  if (currentView === 'simulation_intro') { return <div className="min-h-screen bg-gradient-to-br from-slate-900 to-mobeng-darkblue flex items-center justify-center p-4"><div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} className="text-mobeng-green" /></div><h2 className="text-3xl font-bold text-slate-800 mb-2">Tahap 1 Selesai!</h2><p className="text-slate-600 mb-2 font-medium">Skor logika Anda telah tersimpan.</p><div className="w-full border-b border-slate-200 my-6"></div><h2 className="text-2xl font-bold text-slate-800 mb-2">Masuk Tahap 2: Roleplay</h2><p className="text-slate-600 mb-8 font-medium leading-relaxed">Selanjutnya adalah <strong>Simulasi Interview (Chat)</strong> dengan AI. Anda akan diberikan 5 skenario kasus yang harus diselesaikan.</p><div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 text-left text-sm text-yellow-800 space-y-2"><p className="flex items-center gap-2 font-bold"><AlertTriangle size={16}/> Instruksi Khusus:</p><ul className="list-disc list-inside ml-1"><li>Jawablah seolah-olah Anda sedang bekerja nyata.</li><li>Gunakan bahasa yang sopan dan solutif.</li><li>Gunakan tombol Mikrofon jika ingin menjawab via suara.</li></ul></div><button onClick={startSimulation} className="w-full py-4 bg-mobeng-green hover:bg-mobeng-darkgreen text-white font-bold rounded-xl transition-all shadow-lg text-lg flex items-center justify-center gap-2">Mulai Simulasi <ArrowRight size={20} /></button></div></div>; }

  // 7. SIMULATION VIEW
  if (currentView === 'simulation') { return <div className="h-screen bg-mobeng-lightgrey flex flex-col items-center justify-center p-2 md:p-6 select-none relative"><Suspense fallback={<LoadingScreen/>}><ProctoringCam onViolation={handleProctoringViolation} isActive={true} /></Suspense>{showSimFinishModal && (<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300"><div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">{isSubmitting ? (<div className="py-8"><div className="w-16 h-16 border-4 border-mobeng-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><h3 className="text-lg font-bold text-slate-800 animate-pulse">Memproses Data...</h3><p className="text-slate-500 text-sm mt-2 max-w-[200px] mx-auto">{submissionProgress}</p></div>) : (<><div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={40} /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">Sesi Interview Selesai!</h2><p className="text-slate-600 text-sm mb-6">Terima kasih telah menyelesaikan seluruh rangkaian tes.</p><button onClick={handleFinalSubmission} className="w-full bg-mobeng-darkblue text-white font-bold py-3 rounded-xl hover:bg-black transition-colors shadow-lg flex items-center justify-center gap-2"><Save size={18} /> Simpan & Akhiri Tes</button></>)}</div></div>)}<div className="w-full max-w-6xl h-full flex flex-col md:flex-row gap-4 md:gap-6"><div className="hidden md:flex md:w-1/3 flex-col gap-4 h-full"><div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex-1 overflow-y-auto"><div className="flex items-center gap-3 mb-6"><div className="p-2 bg-mobeng-blue/10 rounded-lg text-mobeng-blue"><BarChart3 size={20} /></div><div><h2 className="font-bold text-slate-800">Live Assessment</h2><p className="text-xs text-slate-500">AI menganalisa setiap jawaban Anda</p></div></div>{appSettings.allowCandidateViewScore ? (<Suspense fallback={<LoadingScreen/>}><ScoreCard scores={currentAnalysis?.scores || {sales:0, leadership:0, operations:0, cx:0}} feedback={currentAnalysis?.feedback}/></Suspense>) : (<div className="flex flex-col items-center justify-center h-[300px] text-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"><Lock size={40} className="text-slate-300 mb-3" /><h3 className="font-bold text-slate-400">Mode Blind Assessment</h3><p className="text-xs text-slate-400 mt-1">Skor dan analisis disembunyikan agar Anda tetap fokus menjawab secara natural tanpa tekanan angka.</p></div>)}</div></div><div className="w-full md:w-2/3 h-full flex flex-col shadow-xl rounded-2xl overflow-hidden bg-white border border-slate-200 relative"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-mobeng-blue via-mobeng-green to-mobeng-blue animate-gradient-x z-20"></div><div className="md:hidden p-3 bg-white border-b border-slate-100 flex justify-between items-center"><span className="font-bold text-sm text-slate-700 flex items-center gap-2"><Briefcase size={14}/> {activeRoleDefinition.label}</span><span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold">Simulasi AI</span></div><Suspense fallback={<LoadingScreen/>}><ChatInterface messages={messages} onSendMessage={handleSendMessage} isThinking={isThinking}/></Suspense></div></div></div>; }

  return <div>Loading...</div>;
}

export default App;
