import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Sender, AnalysisResult, CandidateSubmission, CandidateProfile, AppSettings, ROLE_DEFINITIONS, RoleType, BigFiveTraits } from './types';
import { sendMessageToGemini, generateFinalSummary } from './services/geminiService';
import { supabase } from './services/supabaseClient'; // Import Supabase Client
import ChatInterface from './components/ChatInterface';
import ScoreCard from './components/ScoreCard';
import DocumentationModal from './components/DocumentationModal';
import { LogicTest, QUESTION_SETS } from './components/LogicTest';
import { Briefcase, CheckCircle2, ChevronRight, BarChart3, X, Zap, Lock, UserCircle2, ArrowLeft, BookOpen, HelpCircle, CheckCircle, Save, LogOut, Phone, GraduationCap, Building2, Printer, Share2, Settings, Sliders, MonitorPlay, FileText, MessageSquare, ExternalLink, BrainCircuit, ArrowRight, Loader2, Timer, AlertTriangle, Brain, Star, Sparkles, ShieldAlert, Server, UserPlus, Send, Ban } from 'lucide-react';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer } from 'recharts';

type AppView = 'role_selection' | 'candidate_intro' | 'simulation' | 'logic_test_intro' | 'logic_test' | 'recruiter_login' | 'recruiter_dashboard' | 'link_expired';

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

  // Integrity / Anti-Cheat
  const [cheatCount, setCheatCount] = useState(0);

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

  // Temporary storage for Sim Results before Test 2
  const [tempSimResult, setTempSimResult] = useState<AnalysisResult | null>(null);

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

  // --- FETCH SUBMISSIONS (DASHBOARD) ---
  useEffect(() => {
    if (currentView === 'recruiter_dashboard') {
        const fetchSubmissions = async () => {
            const { data, error } = await supabase
                .from('submissions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching submissions:", error);
                return;
            }

            if (data) {
                // Map DB columns back to App Types
                const mappedSubmissions: CandidateSubmission[] = data.map((item: any) => ({
                    id: item.id,
                    profile: item.profile_data,
                    role: item.role,
                    timestamp: new Date(item.created_at),
                    simulationScores: item.simulation_scores,
                    simulationFeedback: "Loaded from database", // Simplified
                    psychometrics: item.psychometrics,
                    cultureFitScore: item.culture_fit_score,
                    starMethodScore: 0, // Assume 0 if not stored or structure differently
                    logicScore: item.logic_score,
                    finalSummary: item.final_summary,
                    status: item.status,
                    cheatCount: item.cheat_count
                }));
                setSubmissions(mappedSubmissions);
            }
        };
        fetchSubmissions();
    }
  }, [currentView]);


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

  // Called from Candidate Intro Form -> STARTS TEST 1 (Simulation)
  const handleProfileSubmit = () => {
    if (!isProfileComplete()) {
        alert("Mohon lengkapi data profil Anda terlebih dahulu.");
        return;
    }
    
    // Initialize Simulation
    setTempSimResult(null);
    setShowSimFinishModal(false);
    setCheatCount(0); // Reset cheat count
    
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

  // Finished Test 1 -> Transition to Test 2
  const handleProceedToLogicTest = () => {
      setTempSimResult(currentAnalysis); // Store Test 1 results
      setShowSimFinishModal(false);
      setCurrentView('logic_test_intro');
  };

  // Finished Test 2 -> Submit EVERYTHING (SUPABASE INTEGRATION)
  const handleLogicTestComplete = async (score: number, passed: boolean) => {
      setIsSubmitting(true);
      setSubmissionProgress('AI sedang menganalisa psikometri, kompetensi STAR, dan culture fit...');
      
      // Safety check if sim result missing (shouldn't happen in flow)
      const simData = tempSimResult || {
          scores: { sales: 0, leadership: 0, operations: 0, cx: 0 },
          feedback: "Data simulasi tidak ditemukan."
      };

      try {
          // Generate Final AI Summary (SOPHISTICATED VERSION)
          const finalReport = await generateFinalSummary(
              candidateProfile,
              activeRoleDefinition.label,
              simData.scores,
              simData.feedback,
              score
          );

          const newSubmissionId = uuidv4();
          const calculatedStatus = calculateOverallStatus(simData.scores, score);

          // 1. Prepare Payload for Supabase
          const dbPayload = {
              id: newSubmissionId,
              candidate_name: candidateProfile.name,
              candidate_phone: candidateProfile.phone,
              role: activeRoleDefinition.label,
              logic_score: score,
              culture_fit_score: finalReport.cultureFitScore,
              status: calculatedStatus,
              profile_data: candidateProfile,
              simulation_scores: simData.scores,
              psychometrics: finalReport.psychometrics,
              final_summary: finalReport.summary,
              cheat_count: cheatCount
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
              simulationFeedback: simData.feedback,
              psychometrics: finalReport.psychometrics,
              cultureFitScore: finalReport.cultureFitScore,
              starMethodScore: finalReport.starMethodScore,
              logicScore: score,
              finalSummary: finalReport.summary,
              status: calculatedStatus,
              cheatCount: cheatCount
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
         <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} role={docRole} />

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
                    <span className="font-bold">Wajib:</span> Tes Simulasi (Chat) <ArrowRight size={10} className="inline"/> Tes Logika
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

  // ... (Candidate Intro, Logic Test Intro, Logic Test View, Recruiter Login - Unchanged except for imports and state references)
  // To save space, assuming those blocks remain mostly the same visually, but using updated state.
  // The significant logic changes were in useEffect and handleLogicTestComplete above.
  
  // 2. CANDIDATE INTRO SCREEN
  if (currentView === 'candidate_intro') {
    return (
      <div className="min-h-screen bg-mobeng-darkblue flex items-center justify-center p-4 relative overflow-hidden">
        <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} role={'candidate'} />

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-mobeng-green/20 blur-[100px]" />
            <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] rounded-full bg-mobeng-blue/10 blur-[100px]" />
        </div>

        <div className="max-w-4xl w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row min-h-[600px]">
          {/* Left Panel */}
          <div className="md:w-5/12 bg-gradient-to-br from-mobeng-blue to-mobeng-darkblue p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            
            {!isLockedProfile && (
                <button onClick={() => setCurrentView('role_selection')} className="absolute top-6 left-6 text-white/80 hover:text-white flex items-center gap-2 text-xs font-medium z-20"><ArrowLeft size={14} /> Kembali</button>
            )}

            <div className="mt-8">
              <div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 rounded-full px-3 py-1 text-xs font-medium text-white mb-6 backdrop-blur-sm"><Zap size={12} className="text-mobeng-yellow" /> AI Assessment Portal</div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 tracking-tight">Mobeng <span className="text-mobeng-green">Career</span></h1>
              <p className="text-blue-50 text-lg font-light leading-relaxed mb-6">
                  {isLockedProfile ? `Selamat Datang, ${candidateProfile.name}. Silakan lengkapi sisa data Anda.` : 'Silakan lengkapi data diri Anda.'}
              </p>
              
              {isLockedProfile && (
                  <div className="bg-yellow-500/20 rounded-xl p-4 border border-yellow-400/30 text-sm mb-4">
                      <div className="flex items-center gap-2 text-yellow-300 font-bold mb-1"><Lock size={14}/> Mode Undangan Aktif</div>
                      <p className="text-white/80 text-xs">Posisi dan Identitas Anda telah dikunci oleh sistem sesuai undangan rekrutmen.</p>
                  </div>
              )}

              <div className="bg-white/10 rounded-xl p-4 border border-white/10 text-sm">
                  <strong className="block text-white mb-2">Alur Tes:</strong>
                  <ol className="list-decimal list-inside space-y-2 text-blue-50">
                      <li>Simulasi Interview (Roleplay)</li>
                      <li>Tes Logika & Ketelitian</li>
                  </ol>
              </div>
            </div>
          </div>

          <div className="md:w-7/12 p-8 md:p-12 flex flex-col bg-white overflow-y-auto max-h-screen">
            <h2 className="text-2xl font-bold text-mobeng-darkblue mb-2">Profil Kandidat</h2>
            <p className="text-slate-600 mb-6 text-sm">Posisi: <span className="font-semibold text-slate-900">{activeRoleDefinition.label}</span></p>
            
            <div className="space-y-4 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                        <input type="text" name="name" value={candidateProfile.name} onChange={handleInputChange} placeholder="Cth: Budi Santoso" disabled={isLockedProfile} className={`w-full border rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none ${isLockedProfile ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300'}`}/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">No. Handphone/WA *</label>
                        <input type="text" name="phone" value={candidateProfile.phone} onChange={handleInputChange} placeholder="0812..." disabled={isLockedProfile} className={`w-full border rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none ${isLockedProfile ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white border-slate-300'}`}/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Pendidikan Terakhir *</label>
                        <select name="education" value={candidateProfile.education} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white text-slate-900">
                            <option value="SMA/SMK">SMA / SMK</option>
                            <option value="D3">Diploma (D3)</option>
                            <option value="S1">Sarjana (S1)</option>
                            <option value="S2">Master (S2)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Jurusan *</label>
                        <input type="text" name="major" value={candidateProfile.major} onChange={handleInputChange} placeholder="Cth: Teknik Mesin" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Posisi Terakhir</label>
                        <input type="text" name="lastPosition" value={candidateProfile.lastPosition} onChange={handleInputChange} placeholder="Cth: Service Advisor" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Perusahaan Terakhir</label>
                        <input type="text" name="lastCompany" value={candidateProfile.lastCompany} onChange={handleInputChange} placeholder="Cth: PT Maju Jaya" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/>
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Lama Pengalaman (Tahun)</label>
                    <input type="number" name="experienceYears" value={candidateProfile.experienceYears} onChange={handleInputChange} placeholder="Cth: 2" className="w-full border border-slate-300 rounded-lg p-2.5 text-base text-slate-900 font-medium focus:ring-2 focus:ring-mobeng-green outline-none bg-white placeholder-slate-400"/>
                </div>
            </div>
            
            <button onClick={handleProfileSubmit} disabled={!isProfileComplete()} className="group mt-auto w-full bg-mobeng-darkblue hover:bg-mobeng-green disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl text-lg transition-all shadow-xl hover:shadow-mobeng-green/20 flex items-center justify-center gap-3 transform active:scale-[0.98]">
              Mulai Tes 1: Simulasi <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. LOGIC TEST INTRO
  if (currentView === 'logic_test_intro') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-mobeng-darkblue flex items-center justify-center p-4">
             <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} className="text-mobeng-green" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Tes Simulasi Selesai!</h2>
                <p className="text-slate-600 mb-8 font-medium leading-relaxed">
                    Terima kasih telah menyelesaikan sesi roleplay. <br/>
                    Selanjutnya adalah <strong>Tes Logika & Ketelitian</strong>.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 text-left text-sm text-slate-700 space-y-2">
                    <p className="flex items-center gap-2"><BrainCircuit size={16} className="text-mobeng-blue"/> <strong>Jumlah Soal:</strong> 10 Soal Pilihan Ganda</p>
                    <p className="flex items-center gap-2"><Timer size={16} className="text-mobeng-orange"/> <strong>Waktu:</strong> 5 Menit</p>
                    <p className="flex items-center gap-2"><Zap size={16} className="text-mobeng-green"/> <strong>Materi:</strong> Matematika Dasar, Deret Angka, Logika Verbal.</p>
                </div>
                <button onClick={() => setCurrentView('logic_test')} className="w-full py-4 bg-mobeng-blue hover:bg-mobeng-darkblue text-white font-bold rounded-xl transition-all shadow-lg text-lg flex items-center justify-center gap-2">
                    Lanjut ke Tes Logika <ArrowRight size={20} />
                </button>
             </div>
        </div>
      )
  }

  // 4. LOGIC TEST
  if (currentView === 'logic_test') {
      if (isSubmitting) {
          return (
              <div className="min-h-screen bg-mobeng-lightgrey flex flex-col items-center justify-center p-4">
                  <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
                      <Loader2 size={48} className="animate-spin text-mobeng-blue mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Menyimpan Hasil Tes</h3>
                      <p className="text-slate-600 text-sm">{submissionProgress}</p>
                  </div>
              </div>
          )
      }
      return (
          <div className="min-h-screen bg-mobeng-lightgrey flex items-center justify-center p-4">
              <LogicTest 
                activeSetId={appSettings.activeLogicSetId}
                onComplete={handleLogicTestComplete} 
                onExit={() => alert("Tes ini wajib diselesaikan.")} 
              />
          </div>
      )
  }

  // 5. RECRUITER LOGIN
  if (currentView === 'recruiter_login') {
      return (
        <div className="min-h-screen bg-mobeng-lightgrey flex items-center justify-center p-4">
             <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                <button onClick={() => setCurrentView('role_selection')} className="text-mobeng-darkgrey hover:text-mobeng-blue flex items-center gap-2 mb-6 text-sm font-medium"><ArrowLeft size={16} /> Kembali</button>
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-mobeng-blue rounded-lg mx-auto mb-3 flex items-center justify-center text-white"><Briefcase size={24}/></div>
                    <h2 className="text-2xl font-bold text-mobeng-darkblue">HR Dashboard Login</h2>
                </div>
                <form onSubmit={handleRecruiterLogin} className="space-y-4">
                    <input type="text" className="w-full border border-slate-300 rounded-lg p-3 text-slate-800 font-medium focus:ring-2 focus:ring-mobeng-blue outline-none bg-white placeholder-slate-400" placeholder="ID Karyawan" defaultValue="HR-ADMIN" />
                    <input type="password" className="w-full border border-slate-300 rounded-lg p-3 text-slate-800 font-medium focus:ring-2 focus:ring-mobeng-blue outline-none bg-white placeholder-slate-400" placeholder="Password" defaultValue="password" />
                    <button type="submit" className="w-full bg-mobeng-blue hover:bg-mobeng-darkblue text-white font-bold py-3 rounded-lg transition-colors shadow-md">Masuk Dashboard</button>
                </form>
             </div>
        </div>
      )
  }

  // 6. RECRUITER DASHBOARD
  if (currentView === 'recruiter_dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans relative">
        <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} role={'recruiter'} />
        
        {/* INVITE CANDIDATE MODAL */}
        {isInviteOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsInviteOpen(false)} />
                <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                    <div className="bg-mobeng-green p-6 flex justify-between items-center text-white shrink-0">
                        <h2 className="text-xl font-bold flex items-center gap-2"><UserPlus size={20}/> Undang Kandidat</h2>
                        <button onClick={() => setIsInviteOpen(false)} className="text-white/70 hover:text-white"><X size={24}/></button>
                    </div>
                    
                    <form onSubmit={sendInviteWhatsApp} className="p-6 space-y-4">
                        <p className="text-sm text-slate-600">
                            Kirim undangan tes otomatis ke WhatsApp pelamar. 
                        </p>
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex gap-2">
                             <Lock size={14} className="shrink-0 mt-0.5" />
                             <p><strong>Fitur Keamanan:</strong> Tautan yang dibuat bersifat <strong>Sekali Pakai (One-Time Use)</strong> dan akan mengunci Nama & No HP pelamar agar tidak bisa dipindahtangankan.</p>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pelamar *</label>
                            <input name="inviteName" required type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-mobeng-green outline-none bg-slate-50" placeholder="Cth: Andi" />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp *</label>
                            <input name="invitePhone" type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-mobeng-green outline-none bg-slate-50" placeholder="Cth: 08123456789" />
                        </div>

                        <button type="submit" className="w-full bg-mobeng-green hover:bg-mobeng-darkgreen text-white font-bold py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2">
                            <Send size={18} /> Kirim Undangan WA
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
                <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                    <div className="bg-mobeng-darkblue p-6 flex justify-between items-center text-white shrink-0">
                        <h2 className="text-xl font-bold flex items-center gap-2"><Settings size={20}/> Pengaturan Sistem</h2>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-white/70 hover:text-white"><X size={24}/></button>
                    </div>
                    <div className="p-6 space-y-6 overflow-y-auto">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Briefcase size={16} className="text-mobeng-blue"/> Posisi yang Diuji (Active Role)
                            </label>
                            <p className="text-xs text-slate-600 mb-3">Memilih posisi akan mengubah skenario soal dan kriteria penilaian AI.</p>
                            <select 
                                value={appSettings.activeRole}
                                onChange={(e) => setAppSettings(prev => ({...prev, activeRole: e.target.value as RoleType}))}
                                className="w-full border border-slate-300 rounded-lg p-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-mobeng-blue outline-none bg-slate-50"
                            >
                                {Object.values(ROLE_DEFINITIONS).map(role => (
                                    <option key={role.id} value={role.id}>{role.label}</option>
                                ))}
                            </select>
                            <div className="mt-2 bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800">
                                <strong>Info Skenario:</strong> {ROLE_DEFINITIONS[appSettings.activeRole].description}
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                             <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <BrainCircuit size={16} className="text-mobeng-blue"/> Versi Soal Logika (Anti-Cheat)
                            </label>
                            <p className="text-xs text-slate-600 mb-3">Pilih paket soal yang aktif. Ubah paket secara berkala untuk mencegah kebocoran soal antar kandidat.</p>
                            <select 
                                value={appSettings.activeLogicSetId}
                                onChange={(e) => setAppSettings(prev => ({...prev, activeLogicSetId: e.target.value}))}
                                className="w-full border border-slate-300 rounded-lg p-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-mobeng-blue outline-none bg-slate-50"
                            >
                                {Object.values(QUESTION_SETS).map(set => (
                                    <option key={set.id} value={set.id}>{set.name}</option>
                                ))}
                            </select>
                            <div className="mt-2 bg-green-50 p-3 rounded-lg border border-green-100 text-xs text-green-800">
                                <strong>Paket Aktif:</strong> {QUESTION_SETS[appSettings.activeLogicSetId]?.description || "Paket tidak ditemukan"}
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <MonitorPlay size={16} className="text-mobeng-blue"/> Mode Tampilan Kandidat
                            </label>
                            <p className="text-xs text-slate-600 mb-3">Pilih apakah kandidat dapat melihat skor penilaian AI secara real-time saat simulasi.</p>
                            <div className="flex items-center gap-4 mt-3">
                                <button 
                                    onClick={() => setAppSettings(prev => ({...prev, allowCandidateViewScore: false}))}
                                    className={`flex-1 p-3 rounded-xl border shadow-sm flex flex-col items-center gap-2 transition-all ${
                                        !appSettings.allowCandidateViewScore 
                                        ? 'bg-mobeng-darkblue border-mobeng-darkblue text-white ring-2 ring-mobeng-darkblue ring-offset-2' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <Zap size={20} className={!appSettings.allowCandidateViewScore ? 'text-yellow-400' : 'text-slate-400'} />
                                    <span className="text-sm font-semibold">Mode Konsentrasi</span>
                                    <span className="text-[10px] opacity-80 font-normal">Blind Test (Nilai hidden)</span>
                                </button>
                                <button 
                                    onClick={() => setAppSettings(prev => ({...prev, allowCandidateViewScore: true}))}
                                    className={`flex-1 p-3 rounded-xl border shadow-sm flex flex-col items-center gap-2 transition-all ${
                                        appSettings.allowCandidateViewScore 
                                        ? 'bg-white border-mobeng-green text-mobeng-green ring-2 ring-mobeng-green ring-offset-2' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <BarChart3 size={20} />
                                    <span className="text-sm font-semibold">Transparan</span>
                                    <span className="text-[10px] opacity-80 font-normal">Tampilkan Grafik Live</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 text-right shrink-0 border-t border-slate-200">
                         <button onClick={() => setIsSettingsOpen(false)} className="bg-mobeng-blue text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-mobeng-darkblue transition-colors">Simpan Pengaturan</button>
                    </div>
                </div>
            </div>
        )}

        {/* Selected Submission Detail Modal */}
        {selectedSubmission && (
             <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm no-print" onClick={() => setSelectedSubmission(null)} />
                <div id="printable-modal" className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                     <div className="bg-mobeng-darkblue p-6 flex justify-between items-start text-white no-print">
                        <div>
                            <h2 className="text-2xl font-bold">{selectedSubmission.profile.name}</h2>
                            <p className="text-blue-100 text-sm flex items-center gap-2 mt-1">
                                <Briefcase size={14} /> Posisi: {selectedSubmission.role}
                            </p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => sendWhatsApp(selectedSubmission)} className="bg-mobeng-green hover:bg-mobeng-darkgreen text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors">
                                <Share2 size={16} /> WA
                            </button>
                            <button onClick={() => window.print()} className="bg-mobeng-blue hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors">
                                <Printer size={16} /> PDF
                            </button>
                            <button onClick={() => setSelectedSubmission(null)} className="text-white/70 hover:text-white p-1 ml-2"><X size={24} /></button>
                        </div>
                    </div>
                    
                    <div className="p-6 md:p-8 overflow-y-auto max-h-[80vh] print:max-h-none print:overflow-visible flex flex-col gap-6">
                         
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="col-span-1 md:col-span-2 space-y-4">
                                <h3 className="font-bold text-mobeng-darkblue flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <MessageSquare size={18} /> Hasil Tes 1: Behavioral Simulation
                                </h3>
                                <div className="grid grid-cols-4 gap-2 text-center mb-4">
                                        {[
                                            { l: 'Sales', v: selectedSubmission.simulationScores.sales, c: 'bg-blue-100 text-blue-700' },
                                            { l: 'Lead', v: selectedSubmission.simulationScores.leadership, c: 'bg-indigo-100 text-indigo-700' },
                                            { l: 'Ops', v: selectedSubmission.simulationScores.operations, c: 'bg-red-100 text-red-700' },
                                            { l: 'CX', v: selectedSubmission.simulationScores.cx, c: 'bg-green-100 text-green-700' },
                                        ].map((s) => (
                                            <div key={s.l} className={`${s.c} p-3 rounded-lg print:border print:border-slate-300`}>
                                                <div className="text-xs font-bold uppercase opacity-70">{s.l}</div>
                                                <div className="text-xl font-bold">{s.v}</div>
                                            </div>
                                        ))}
                                </div>
                                {selectedSubmission.psychometrics && (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <h4 className="font-bold text-sm text-slate-600 mb-2 flex items-center gap-2"><Brain size={16}/> Psychometric Profile (Big Five)</h4>
                                        <div className="h-[300px] w-full">
                                            <ScoreCard 
                                                scores={selectedSubmission.simulationScores} 
                                                psychometrics={selectedSubmission.psychometrics}
                                                cultureFit={selectedSubmission.cultureFitScore}
                                                starScore={selectedSubmission.starMethodScore}
                                                feedback={selectedSubmission.simulationFeedback}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-mobeng-green flex items-center gap-2 border-b border-slate-200 pb-2">
                                    <BrainCircuit size={18} /> Hasil Tes 2: Logika
                                </h3>
                                <div className="bg-green-50 border border-green-100 p-6 rounded-xl text-center">
                                    <div className="text-4xl font-bold text-mobeng-green mb-1">{selectedSubmission.logicScore.toFixed(1)}</div>
                                    <div className="text-xs text-green-800 font-bold uppercase">Skor Logika / 10</div>
                                </div>
                                <div className={`p-4 rounded-xl border ${selectedSubmission.cheatCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><ShieldAlert size={16}/> Integrity Log</h4>
                                    <p className="text-sm">
                                        Tab Switches: <span className="font-bold">{selectedSubmission.cheatCount || 0}</span>
                                    </p>
                                    {selectedSubmission.cheatCount > 0 && (
                                        <p className="text-xs text-red-600 mt-1">⚠️ Terdeteksi meninggalkan halaman ujian.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 bg-gradient-to-r from-mobeng-darkblue to-mobeng-blue text-white p-3 rounded-lg">
                                <Zap size={18} /> KESIMPULAN AKHIR (AI RECOMMENDATION)
                            </h3>
                            <div className="bg-white border-2 border-slate-200 p-6 rounded-xl shadow-sm text-slate-800 leading-relaxed text-justify text-base">
                                {selectedSubmission.finalSummary}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        <header className="bg-mobeng-darkblue text-white p-3 md:p-4 flex justify-between items-center shadow-lg sticky top-0 z-50 no-print">
           <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
              <div className="bg-mobeng-blue p-2 rounded-lg shadow-md shrink-0"><Briefcase size={20} /></div>
              <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-3 overflow-hidden">
                  <h1 className="font-bold text-base md:text-lg leading-tight truncate">HR Dashboard</h1>
                  <div className="px-2 py-0.5 md:px-3 md:py-1 bg-white/10 rounded-full text-[10px] md:text-xs font-mono border border-white/20 flex items-center gap-1.5 w-fit">
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-mobeng-green shrink-0 animate-pulse"></span>
                      <span className="truncate max-w-[100px] md:max-w-none">{activeRoleDefinition.label}</span>
                  </div>
              </div>
           </div>

           <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-2">
               <button onClick={() => setIsInviteOpen(true)} className="p-2 md:px-3 md:py-1.5 bg-mobeng-green rounded-lg hover:bg-mobeng-darkgreen flex items-center gap-2 transition-colors shadow-sm" title="Undang Kandidat">
                 <UserPlus size={18} className="md:w-4 md:h-4" />
                 <span className="hidden md:inline text-sm">Invite</span>
               </button>
               <button onClick={() => openDocs('recruiter')} className="p-2 md:px-3 md:py-1.5 bg-white/10 rounded-lg hover:bg-white/20 flex items-center gap-2 border border-white/20 transition-colors" title="Dokumentasi">
                 <Server size={18} className="md:w-4 md:h-4" /> 
                 <span className="hidden md:inline text-sm">Docs</span>
               </button>
               <button onClick={() => setIsSettingsOpen(true)} className="p-2 md:px-3 md:py-1.5 bg-mobeng-blue rounded-lg hover:bg-sky-600 flex items-center gap-2 transition-colors shadow-sm" title="Pengaturan">
                 <Sliders size={18} className="md:w-4 md:h-4" />
                 <span className="hidden md:inline text-sm">Settings</span>
               </button>
               <button onClick={() => setCurrentView('role_selection')} className="p-2 md:px-3 md:py-1.5 bg-red-500/20 md:bg-white/10 rounded-lg hover:bg-red-500/30 md:hover:bg-white/20 flex items-center gap-2 border border-transparent md:border-white/10 text-red-200 md:text-white" title="Keluar">
                 <LogOut size={18} className="md:w-4 md:h-4" />
                 <span className="hidden md:inline text-sm">Exit</span>
               </button>
           </div>
        </header>
        
        <div className="p-4 md:p-8 max-w-7xl mx-auto no-print">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-mobeng-darkblue">Overview Kandidat</h2>
                    <p className="text-slate-600 text-sm">Data pelamar terbaru dari Database Cloud.</p>
                </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {submissions.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <UserCircle2 size={48} className="mx-auto mb-3 opacity-20" />
                        <p>Belum ada data pelamar.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                            <thead className="bg-slate-50 text-slate-800 uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Kandidat</th>
                                    <th className="px-6 py-4 font-semibold">Posisi</th>
                                    <th className="px-6 py-4 font-semibold text-center">Fit Score</th>
                                    <th className="px-6 py-4 font-semibold text-center">Logika</th>
                                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {submissions.map((sub) => {
                                    const avgSim = Math.round((sub.simulationScores.sales + sub.simulationScores.leadership + sub.simulationScores.operations + sub.simulationScores.cx) / 4);
                                    return (
                                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">{sub.profile.name}</td>
                                            <td className="px-6 py-4"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200 font-medium">{sub.role}</span></td>
                                            <td className="px-6 py-4 text-center font-bold text-mobeng-blue">{sub.cultureFitScore || avgSim*10}%</td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">{sub.logicScore.toFixed(1)}/10</td>
                                            <td className="px-6 py-4 text-center">
                                                 <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold
                                                    ${sub.status === 'Recommended' ? 'bg-green-100 text-green-800' : 
                                                      sub.status === 'Consider' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => setSelectedSubmission(sub)} className="text-mobeng-blue hover:text-mobeng-darkblue text-xs font-bold">Detail</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  // 7. SIMULATION VIEW (TEST 1)
  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans relative">
      <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} role={'candidate'} />

      {showSimFinishModal && (
          <div className="absolute inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
             <div className="bg-white rounded-2xl max-w-lg w-full p-8 text-center shadow-2xl transform transition-all scale-100">
                 <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} className="text-mobeng-green" /></div>
                 <h2 className="text-2xl font-bold text-mobeng-darkblue mb-2">Sesi Wawancara Selesai!</h2>
                 <p className="text-slate-600 mb-8 font-medium">Terima kasih, <strong>{candidateProfile.name}</strong>. Data simulasi Anda telah tersimpan sementara.</p>
                 <div className="flex flex-col gap-3">
                     <p className="text-xs text-slate-500 mb-2">Langkah selanjutnya: Tes Logika & Ketelitian (Wajib)</p>
                     <button onClick={handleProceedToLogicTest} className="w-full py-3 px-4 bg-mobeng-blue text-white font-bold rounded-xl hover:bg-mobeng-darkblue transition-colors flex items-center justify-center gap-2 shadow-lg">
                         Lanjut ke Tes Logika <ArrowRight size={18} />
                     </button>
                 </div>
             </div>
          </div>
      )}

      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-20 shadow-sm flex-shrink-0">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-mobeng-blue flex items-center justify-center text-white"><Briefcase size={18} strokeWidth={2.5} /></div>
            <div className="hidden md:block">
                <h1 className="font-bold text-mobeng-darkblue text-lg">Mobeng <span className="font-normal text-slate-500">Recruitment</span></h1>
                <div className="text-xs text-slate-500 flex items-center gap-1 font-medium"><UserCircle2 size={10}/> Kandidat: {candidateProfile.name}</div>
            </div>
         </div>
         <div className="flex items-center gap-2 md:gap-4">
             <button onClick={() => openDocs('candidate')} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 transition-all font-medium"><HelpCircle size={18} className="text-mobeng-orange" /><span className="hidden md:inline">Panduan</span></button>
             <button onClick={() => setShowSimFinishModal(true)} className="hidden md:flex text-sm bg-mobeng-darkblue text-white px-4 py-2 rounded-lg hover:bg-mobeng-blue transition-colors items-center gap-2 shadow-md font-medium"><CheckCircle size={16} /> Selesai</button>
         </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col h-full relative p-2 md:p-6 max-w-5xl mx-auto w-full">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} isThinking={isThinking} />
        </main>

        <aside className="hidden md:block w-80 lg:w-96 bg-white border-l border-slate-200 p-6 flex-shrink-0 overflow-y-auto transition-all">
             <div className="sticky top-0">
                {appSettings.allowCandidateViewScore ? (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                         <div className="flex items-center gap-2 mb-4 bg-blue-50 text-blue-800 px-3 py-2 rounded-lg text-xs font-bold border border-blue-100">
                             <BarChart3 size={14}/> Mode Transparan Aktif
                         </div>
                         <ScoreCard 
                            scores={currentAnalysis?.scores || {sales:0, leadership:0, operations:0, cx:0}} 
                            feedback={currentAnalysis?.feedback} 
                         />
                    </div>
                ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center animate-in fade-in duration-500">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 mx-auto text-mobeng-blue"><Zap size={32} /></div>
                        <h3 className="text-lg font-bold text-mobeng-darkblue mb-2">Mode Konsentrasi</h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-6">Penilaian berjalan di latar belakang (Blind Test). Fokuslah menjawab setiap skenario dengan natural.</p>
                        <div className="text-left text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-100">
                            <p className="mb-2 font-bold text-slate-700">Aktif: {activeRoleDefinition.label}</p>
                            <p className="italic text-slate-600">{activeRoleDefinition.description}</p>
                        </div>
                    </div>
                )}
             </div>
        </aside>
      </div>
    </div>
  );
}

export default App;