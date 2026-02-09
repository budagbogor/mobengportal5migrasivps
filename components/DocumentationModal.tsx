
import React, { useState } from 'react';
import { X, BookOpen, ShieldCheck, Target, Zap, Cpu, Code, Database, Lock, Layers, Server, BrainCircuit, Activity, Eye, FileText, Printer } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'candidate' | 'recruiter';
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose, role }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'tech'>('guide');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-start">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl shadow-sm ${role === 'candidate' ? 'bg-orange-100 text-mobeng-orange' : 'bg-mobeng-darkblue text-white'}`}>
              {role === 'candidate' ? <BookOpen size={24} /> : <Server size={24} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-mobeng-darkblue">
                {role === 'candidate' ? 'Panduan Kandidat Mobeng' : 'Mobeng Recruitment System Docs'}
              </h2>
              <p className="text-sm text-slate-600 font-medium mt-1">
                {role === 'candidate' ? 'Tips & Trik mengerjakan simulasi' : 'Dokumentasi Teknis & Arsitektur Sistem'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors bg-white hover:bg-slate-100 p-2 rounded-full border border-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation (Only for Recruiter) */}
        {role === 'recruiter' && (
          <div className="flex border-b border-slate-200 bg-white px-6">
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'guide' ? 'border-mobeng-blue text-mobeng-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Target size={16} /> Panduan Penilaian
            </button>
            <button
              onClick={() => setActiveTab('tech')}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tech' ? 'border-mobeng-blue text-mobeng-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Cpu size={16} /> Arsitektur Sistem (IT)
            </button>
          </div>
        )}

        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50/50">
          {role === 'candidate' ? (
            // CANDIDATE VIEW
            <div className="space-y-6">
              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <Activity className="text-mobeng-blue" size={18} /> Tahapan Seleksi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="font-bold text-slate-800 block text-sm mb-1">Tahap 1: Tes Logika</span>
                    <p className="text-xs text-slate-600">10 Soal Pilihan Ganda (5 Menit). Menguji kemampuan numerik, verbal, dan ketelitian. Wajib diselesaikan.</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="font-bold text-slate-800 block text-sm mb-1">Tahap 2: Simulasi Roleplay</span>
                    <p className="text-xs text-slate-600">Chat interaktif dengan AI. Anda akan menghadapi 5 skenario kerja nyata sesuai posisi yang dilamar.</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <Target className="text-mobeng-orange" size={18} /> Mekanisme Simulasi
                </h3>
                <p className="text-slate-700 text-sm leading-relaxed text-justify font-medium">
                  Di tahap simulasi, AI akan berperan sebagai Atasan/Customer. Tugas Anda adalah merespons situasi tersebut selayaknya Anda sedang bekerja nyata. Jawablah dengan kalimat langsung (contoh: "Selamat pagi Pak, mari saya bantu...").
                </p>
              </section>

              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <ShieldCheck className="text-mobeng-green" size={18} /> Kriteria Penilaian
                </h3>
                <ul className="space-y-3">
                  <li className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="font-bold text-mobeng-darkblue block text-sm mb-1">1. Operational Excellence (Kebersihan & SOP)</span>
                    <span className="text-xs text-slate-600 font-medium">Sangat krusial. Pastikan area toko bersih, aman, dan ikuti SOP Mobeng.</span>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="font-bold text-mobeng-darkblue block text-sm mb-1">2. Sales & Persuasion</span>
                    <span className="text-xs text-slate-600 font-medium">Edukasi pelanggan teknis secara sederhana. Lakukan upselling tanpa memaksa.</span>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="font-bold text-mobeng-darkblue block text-sm mb-1">3. Customer Experience</span>
                    <span className="text-xs text-slate-600 font-medium">Ramah, cepat, dan empati. Pelanggan adalah prioritas.</span>
                  </li>
                </ul>
              </section>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-mobeng-darkblue font-medium flex gap-3">
                <Zap size={20} className="shrink-0" />
                <div>
                  <strong>Informasi Penting:</strong>
                  <p className="mt-1 opacity-90">Sistem menggunakan Proctoring (Pengawas Otomatis). Wajah wajib terlihat di kamera dan dilarang pindah tab browser.</p>
                </div>
              </div>
            </div>
          ) : activeTab === 'guide' ? (
            // RECRUITER VIEW - GUIDE TAB
            <div className="space-y-8">
              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-lg border-b border-slate-200 pb-2">
                  <BrainCircuit className="text-mobeng-blue" size={20} /> Metodologi Penilaian AI
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">Analisis Semantik & Behavioral</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      AI (Gemini 2.0 Flash) menganalisis <i>intent</i>, nada bicara, dan logika penyelesaian masalah. Jawaban kandidat dikorelasikan dengan parameter Big Five Personality (OCEAN).
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-2">Full Page Detail View</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Klik tombol "Detail" pada tabel untuk melihat laporan lengkap satu halaman penuh. Mendukung fitur <strong>Cetak/PDF</strong> (<Printer size={10} className="inline" />) yang rapi untuk arsip fisik.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-lg border-b border-slate-200 pb-2">
                  <Activity className="text-mobeng-green" size={20} /> Scoring Matrix (Kelulusan)
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-800 font-bold">
                      <tr>
                        <th className="p-3 border-b border-slate-200">Weighted Score (0-10)</th>
                        <th className="p-3 border-b border-slate-200">Logic Score (Min)</th>
                        <th className="p-3 border-b border-slate-200">Status</th>
                        <th className="p-3 border-b border-slate-200">Rekomendasi</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr>
                        <td className="p-3 border-b border-slate-100 font-mono">≥ 7.5</td>
                        <td className="p-3 border-b border-slate-100 font-mono">≥ 6.0</td>
                        <td className="p-3 border-b border-slate-100"><span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Recommended</span></td>
                        <td className="p-3 border-b border-slate-100 text-xs">Lanjut Interview User (High Potential)</td>
                      </tr>
                      <tr>
                        <td className="p-3 border-b border-slate-100 font-mono">5.0 - 7.4</td>
                        <td className="p-3 border-b border-slate-100 font-mono">Any</td>
                        <td className="p-3 border-b border-slate-100"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">Consider</span></td>
                        <td className="p-3 border-b border-slate-100 text-xs">Perlu review manual / posisi cadangan</td>
                      </tr>
                      <tr>
                        <td className="p-3 border-b border-slate-100 font-mono text-red-600">&lt; 5.0</td>
                        <td className="p-3 border-b border-slate-100 font-mono">Any</td>
                        <td className="p-3 border-b border-slate-100"><span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">Reject</span></td>
                        <td className="p-3 border-b border-slate-100 text-xs">Tidak memenuhi standar kompetensi</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                  <strong>Rumus Kalkulasi:</strong> <code>(Rata-rata Simulasi x 60%) + (Skor Logika x 40%)</code>. Logika memiliki bobot 40% untuk memastikan kandidat tidak hanya pandai bicara tapi juga cerdas secara kognitif.
                </div>
              </section>
            </div>
          ) : (
            // RECRUITER VIEW - TECH DOCS TAB (UPDATED SYSTEM DOCUMENTATION)
            <div className="space-y-8">
              {/* Tech Stack Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center gap-2">
                  <Code className="text-blue-500" />
                  <span className="font-bold text-xs text-slate-700">Frontend</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">React + Vite + TS</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center gap-2">
                  <Cpu className="text-purple-500" />
                  <span className="font-bold text-xs text-slate-700">AI Engine</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">Gemini 3.0 Flash</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center gap-2">
                  <Layers className="text-cyan-500" />
                  <span className="font-bold text-xs text-slate-700">Styling</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">Tailwind CSS</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center gap-2">
                  <Database className="text-green-500" />
                  <span className="font-bold text-xs text-slate-700">Database</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">Supabase (PostgreSQL)</span>
                </div>
              </div>

              {/* 1. AI Architecture */}
              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 text-lg">
                  <Cpu size={20} className="text-mobeng-blue" /> 1. Arsitektur Kecerdasan Buatan (AI)
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 mb-1">Prompt Engineering & Temperature</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Aplikasi menggunakan <code>systemInstruction</code> bertingkat untuk setiap role. Parameter <strong>Temperature diset ke 0.3</strong> untuk mengurangi halusinasi dan memastikan penilaian AI konsisten, deterministik, dan faktual.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-xs font-bold text-slate-700 mb-1">Behavioral Analysis</div>
                      <p className="text-[10px] text-slate-500">
                        AI memetakan respons ke model Big Five (OCEAN) dan menghasilkan output JSON terstruktur untuk visualisasi grafik.
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-xs font-bold text-slate-700 mb-1">Final Summary Correlation</div>
                      <p className="text-[10px] text-slate-500">
                        Kesimpulan akhir menggunakan logika korelasi: Skor Logika vs Skor Interview. Jika logika rendah tapi interview bagus, AI akan menandai sebagai "Sweet Talker" (Red Flag).
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Security System */}
              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 text-lg">
                  <Lock size={20} className="text-red-500" /> 2. Sistem Keamanan & Proctoring
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-red-50 p-2 rounded text-red-600 font-mono text-xs font-bold mt-0.5">Face Mesh AI</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Menggunakan <strong>MediaPipe Face Mesh</strong> untuk mendeteksi keberadaan wajah dan orientasi kepala (Yaw). Jika kandidat menoleh ke kiri/kanan &gt; 1.5 detik atau wajah hilang dari frame, sistem mencatat pelanggaran.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-red-50 p-2 rounded text-red-600 font-mono text-xs font-bold mt-0.5">Dynamic Logic Sets</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Soal tes logika dapat diubah melalui menu Settings (Paket A - E) secara real-time untuk mencegah kebocoran soal antar kandidat.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-red-50 p-2 rounded text-red-600 font-mono text-xs font-bold mt-0.5">Visibility API</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Memantau perpindahan tab/window (cheatCount). Clipboard (Copy-Paste) dimatikan secara hardcode.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Database & Reporting */}
              <section>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 text-lg">
                  <Database size={20} className="text-green-500" /> 3. Data Persistence (Supabase)
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">
                    Semua hasil tes disimpan di Cloud Database (Supabase) pada tabel <code>submissions</code>. Data yang disimpan meliputi:
                  </p>
                  <ul className="list-disc list-inside text-[10px] text-slate-500 font-mono bg-slate-50 p-3 rounded">
                    <li>Profile Data & Role</li>
                    <li>Skor Logika & Simulasi</li>
                    <li>Analisa Psikometri (Big Five)</li>
                    <li>Integrity Log (Cheat Count)</li>
                    <li><strong>Chat History (Transcript Lengkap)</strong></li>
                  </ul>
                </div>
              </section>

              <div className="text-center pt-4 border-t border-slate-200">
                <p className="text-[10px] text-slate-400 font-mono">System Version: 2.2.0 (Proctoring Enhanced) | Build: React-Vite-Gemini</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-4 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-mobeng-darkblue text-white text-sm font-bold rounded-lg hover:bg-mobeng-blue transition-colors"
          >
            Tutup Dokumentasi
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentationModal;
