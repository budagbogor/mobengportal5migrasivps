
import React, { useState, useEffect } from 'react';
import { Timer, CheckCircle2, AlertTriangle, ChevronRight, HelpCircle, ArrowRight, BrainCircuit } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number; // Index 0-3
}

export interface QuestionSet {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}

export const QUESTION_SETS: Record<string, QuestionSet> = {
  'set_a': {
    id: 'set_a',
    name: 'Paket A (Standard Mix)',
    description: 'Campuran Matematika Dasar, Deret Angka, dan Logika Verbal.',
    questions: [
      { id: 1, text: "Seorang mekanik butuh 5 menit untuk memasang 1 ban. Berapa waktu yang dibutuhkan 100 mekanik untuk memasang 100 ban (asumsi bekerja bersamaan)?", options: ["100 Menit", "5 Menit", "500 Menit", "1 Menit"], correctAnswer: 1 },
      { id: 2, text: "Lanjutkan deret angka ini: 3, 5, 9, 15, 23, ...", options: ["31", "33", "35", "32"], correctAnswer: 1 },
      { id: 3, text: "Ayah Rian memiliki 5 anak perempuan: Nana, Nini, Nunu, Nene. Siapa nama anak kelima?", options: ["Nono", "Rian", "Nana", "Tidak disebutkan"], correctAnswer: 1 },
      { id: 4, text: "Manakah yang tidak masuk dalam kelompoknya?", options: ["Kunci Pas", "Obeng", "Tang", "Baut"], correctAnswer: 3 },
      { id: 5, text: "Jika Anda menyalip orang di posisi terakhir dalam lomba lari, maka Anda sekarang di posisi...?", options: ["Terakhir", "Kedua dari belakang", "Pertama", "Tidak mungkin menyalip posisi terakhir"], correctAnswer: 3 },
      { id: 6, text: "Harga Oli Rp 50.000. Diskon 10%, kemudian harganya naik 10% dari harga setelah diskon. Berapa harga terakhir?", options: ["Rp 50.000", "Rp 49.500", "Rp 49.000", "Rp 55.000"], correctAnswer: 1 },
      { id: 7, text: "SOP: 'Kencangkan Baut A, B, C secara menyilang'. Jika Anda mengencangkan A lalu B lalu C secara berurutan, apa dampaknya?", options: ["Lebih cepat", "Baut patah", "Piringan tidak rata/miring", "Tidak ada dampak"], correctAnswer: 2 },
      { id: 8, text: "Ada berapa bulan dalam satu tahun yang memiliki 28 hari?", options: ["1 Bulan (Februari)", "6 Bulan", "12 Bulan", "Tidak ada"], correctAnswer: 2 },
      { id: 9, text: "Analogi Kata. PEDAL : REM = ... : ...", options: ["TANG : BENGKEL", "TOMBOL : KLAKSON", "MEKANIK : OLI", "RODA : JALAN"], correctAnswer: 1 },
      { id: 10, text: "Baca kalimat ini dengan teliti: 'BERAPA KALI HURUF A MUNCUL PADA KALIMAT INI?'. Jawabannya adalah:", options: ["8", "9", "10", "11"], correctAnswer: 0 }
    ]
  },
  'set_b': {
    id: 'set_b',
    name: 'Paket B (Numerik & Hitungan)',
    description: 'Fokus pada ketelitian angka, persen, dan hitungan uang.',
    questions: [
      { id: 1, text: "15% dari Rp 200.000 adalah...", options: ["Rp 20.000", "Rp 30.000", "Rp 15.000", "Rp 25.000"], correctAnswer: 1 },
      { id: 2, text: "Jika 1 liter oli = 1000ml. Maka 0.8 liter + 250ml = ...", options: ["1005ml", "1050ml", "1.5 liter", "1.25 liter"], correctAnswer: 1 },
      { id: 3, text: "Deret: 100, 95, 85, 70, 50, ...", options: ["25", "30", "35", "20"], correctAnswer: 0 },
      { id: 4, text: "Sebuah bengkel punya 4 mobil. Tiap mobil butuh 4 ban. Di gudang ada 15 ban. Berapa ban yang kurang?", options: ["1", "2", "3", "0"], correctAnswer: 0 },
      { id: 5, text: "Mana yang lebih besar? 2/3 atau 60%?", options: ["2/3", "60%", "Sama", "Tidak bisa dihitung"], correctAnswer: 0 },
      { id: 6, text: "Budi beli sparepart Rp 150.000, jual Rp 180.000. Berapa % keuntungannya?", options: ["10%", "15%", "20%", "25%"], correctAnswer: 2 },
      { id: 7, text: "7 x 8 + 4 : 2 = ...", options: ["30", "58", "60", "32"], correctAnswer: 1 },
      { id: 8, text: "Jika hari ini Senin, 10 hari lagi adalah hari...", options: ["Rabu", "Kamis", "Jumat", "Sabtu"], correctAnswer: 1 },
      { id: 9, text: "Total umur Andi dan Budi adalah 30. Andi 4 tahun lebih tua dari Budi. Berapa umur Budi?", options: ["13", "15", "17", "11"], correctAnswer: 0 },
      { id: 10, text: "Berapa banyak angka 9 dari 1 sampai 100?", options: ["10", "11", "19", "20"], correctAnswer: 3 }
    ]
  },
  'set_c': {
    id: 'set_c',
    name: 'Paket C (Logika & Analogi)',
    description: 'Fokus pada silogisme, analogi kata, dan logika spasial.',
    questions: [
      { id: 1, text: "Semua Mobil butuh Bensin. Sebagian Mobil berwarna Merah. Maka...", options: ["Semua mobil merah butuh bensin", "Semua mobil butuh bensin merah", "Sebagian mobil tidak butuh bensin", "Tidak dapat disimpulkan"], correctAnswer: 0 },
      { id: 2, text: "KAPAL : JANGKAR = MOBIL : ...", options: ["REM TANGAN", "RODA", "SETIR", "SPION"], correctAnswer: 0 },
      { id: 3, text: "Jika KEMARIN adalah BESOK dari hari SABTU. Hari apakah ini?", options: ["Minggu", "Senin", "Selasa", "Rabu"], correctAnswer: 1 },
      { id: 4, text: "Lawan kata dari 'ABSEN' adalah...", options: ["TIDAK HADIR", "HADIR", "IZIN", "BOLOS"], correctAnswer: 1 },
      { id: 5, text: "Air : Es = Uap : ...", options: ["Air", "Hujan", "Embun", "Gas"], correctAnswer: 0 },
      { id: 6, text: "Mana yang bukan alat ukur?", options: ["Termometer", "Speedometer", "Barometer", "Diameter"], correctAnswer: 3 },
      { id: 7, text: "Anda menghadap Utara. Belok kanan, lalu belok kanan lagi, lalu belok kiri. Arah mana sekarang?", options: ["Barat", "Timur", "Selatan", "Utara"], correctAnswer: 1 },
      { id: 8, text: "Manakah yang berbeda? Emas, Perak, Perunggu, Besi.", options: ["Emas", "Perak", "Perunggu", "Besi"], correctAnswer: 2 },
      { id: 9, text: "Obat : Penyakit = ... : ...", options: ["Lampu : Gelap", "Makanan : Lapar", "Air : Haus", "Semua benar"], correctAnswer: 3 },
      { id: 10, text: "Jika dibalik, angka digital mana yang tetap terbaca sama? (0, 1, 8)", options: ["180", "101", "808", "Semua benar"], correctAnswer: 3 }
    ]
  },
  'set_d': {
    id: 'set_d',
    name: 'Paket D (Situational & Etika)',
    description: 'Logika di tempat kerja, etika, dan prioritas.',
    questions: [
      { id: 1, text: "Ada oli tumpah di lantai. Apa yang Anda lakukan pertama kali?", options: ["Lapor atasan", "Ambil foto", "Pasang tanda bahaya/bersihkan", "Tunggu cleaning service"], correctAnswer: 2 },
      { id: 2, text: "Customer marah karena antrian disela orang lain. Anda...", options: ["Marah balik", "Minta maaf dan tegur penyela", "Diam saja", "Pura-pura tidak lihat"], correctAnswer: 1 },
      { id: 3, text: "Teman kerja mencuri sparepart kecil. Anda...", options: ["Ikutan", "Biarkan saja", "Lapor atasan secara rahasia", "Minta bagian"], correctAnswer: 2 },
      { id: 4, text: "SOP bilang A, tapi Senior bilang B (padahal salah). Anda ikut...", options: ["Senior", "SOP", "Insting", "Customer"], correctAnswer: 1 },
      { id: 5, text: "Toko tutup jam 17:00. Customer datang 16:55. Anda...", options: ["Tolak halus", "Terima dengan senyum", "Pura-pura tutup", "Marah-marah"], correctAnswer: 1 },
      { id: 6, text: "Prioritas utama saat bekerja di bengkel adalah...", options: ["Kecepatan", "Keuntungan", "Keselamatan (Safety)", "Kerapihan"], correctAnswer: 2 },
      { id: 7, text: "Alat pemadam api ringan (APAR) sebaiknya diletakkan di...", options: ["Dalam gudang terkunci", "Di kantor bos", "Tempat mudah dijangkau", "Dalam brankas"], correctAnswer: 2 },
      { id: 8, text: "Jika hasil kerja Anda salah, sikap terbaik adalah...", options: ["Menyalahkan alat", "Mengaku dan perbaiki", "Menyalahkan teman", "Sembunyikan"], correctAnswer: 1 },
      { id: 9, text: "Komunikasi yang efektif itu...", options: ["Bicara panjang lebar", "Singkat, Padat, Jelas", "Menggunakan istilah rumit", "Diam saja"], correctAnswer: 1 },
      { id: 10, text: "Siapa bos (pemberi gaji) yang sebenarnya?", options: ["Manager Toko", "Pemilik Perusahaan", "Customer", "HRD"], correctAnswer: 2 }
    ]
  },
  'set_e': {
    id: 'set_e',
    name: 'Paket E (Hard Logic - Pola)',
    description: 'Soal pola gambar (dideskripsikan) dan deret rumit.',
    questions: [
      { id: 1, text: "Pola: Lingkaran, Segitiga, Kotak, Lingkaran, Segitiga, ...", options: ["Lingkaran", "Segitiga", "Kotak", "Bintang"], correctAnswer: 2 },
      { id: 2, text: "A, C, E, G, ...", options: ["H", "I", "J", "K"], correctAnswer: 1 },
      { id: 3, text: "1, 1, 2, 3, 5, 8, ... (Fibonacci)", options: ["11", "12", "13", "14"], correctAnswer: 2 },
      { id: 4, text: "Jika KUCING = 6, ANJING = 6, BURUNG = 6, maka IKAN = ...", options: ["4", "5", "6", "3"], correctAnswer: 0 },
      { id: 5, text: "Bapak Budi punya 3 anak. Anak pertama April, kedua Mei. Anak ketiga?", options: ["Juni", "Juli", "Budi", "Agustus"], correctAnswer: 2 },
      { id: 6, text: "1 jam 45 menit + 50 menit = ...", options: ["2 jam 25 menit", "2 jam 35 menit", "2 jam 45 menit", "2 jam 15 menit"], correctAnswer: 1 },
      { id: 7, text: "Mobil A kecepatan 60km/jam. Mobil B 80km/jam. Setelah 2 jam, selisih jarak mereka?", options: ["20 km", "40 km", "60 km", "10 km"], correctAnswer: 1 },
      { id: 8, text: "Mana yang paling berat? 1kg Besi atau 1kg Kapas?", options: ["Besi", "Kapas", "Sama Berat", "Tergantung gravitasi"], correctAnswer: 2 },
      { id: 9, text: "Lampu merah menyala tiap 5 detik. Lampu hijau tiap 4 detik. Kapan mereka menyala bersamaan?", options: ["Detik ke-10", "Detik ke-15", "Detik ke-20", "Detik ke-9"], correctAnswer: 2 },
      { id: 10, text: "Benda apa yang naik tapi tidak pernah turun?", options: ["Hujan", "Umur", "Gaji", "Pesawat"], correctAnswer: 1 }
    ]
  }
};

interface LogicTestProps {
  onComplete: (score: number, passed: boolean) => void;
  onExit: () => void;
  activeSetId: string;
}

export const LogicTest: React.FC<LogicTestProps> = ({ onComplete, onExit, activeSetId }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  // Initialize with -1, we'll resize correctly in useEffect once questions are loaded
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    // Load Questions based on activeSetId
    const set = QUESTION_SETS[activeSetId] || QUESTION_SETS['set_a'];
    setQuestions(set.questions);
    setSelectedAnswers(new Array(set.questions.length).fill(-1));
  }, [activeSetId]);

  useEffect(() => {
    if (isFinished || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished, questions]);

  const handleSelect = (optionIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentIndex] = optionIndex;
    setSelectedAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentIndex((prev) => {
          if (prev < questions.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 500); // Slight increase delay to appreciate the selection animation
    }
  };

  const finishTest = () => {
    setIsFinished(true);
    let correctCount = 0;
    selectedAnswers.forEach((ans, idx) => {
      if (questions[idx] && ans === questions[idx].correctAnswer) correctCount++;
    });
    const finalScore = questions.length > 0 ? (correctCount / questions.length) * 10 : 0;
    setTimeout(() => {
      onComplete(finalScore, finalScore >= 7);
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (questions.length === 0) return <div>Loading questions...</div>;

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in select-none">
        <div className="w-20 h-20 bg-mobeng-blue/10 rounded-full flex items-center justify-center mb-6">
          <BrainCircuit size={40} className="text-mobeng-blue animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Menghitung Skor...</h2>
        <p className="text-slate-600 font-medium">Mohon tunggu sebentar, sistem sedang memvalidasi jawaban Anda.</p>
      </div>
    )
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const currentQ = questions[currentIndex];

  return (
    // ADDED select-none class here
    <div className="max-w-3xl mx-auto w-full bg-white md:rounded-2xl shadow-xl overflow-hidden flex flex-col h-[100dvh] md:h-auto md:min-h-[600px] border-none md:border border-slate-200 select-none">
      {/* Header */}
      <div className="bg-mobeng-darkblue text-white p-4 flex justify-between items-center z-10 relative shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg"><BrainCircuit size={20} /></div>
          <div>
            <h2 className="font-bold text-sm md:text-base">Tes Logika & Ketelitian</h2>
            <p className="text-xs text-blue-50 font-medium">Soal {currentIndex + 1} dari {questions.length}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold ${timeLeft < 60 ? 'bg-red-500/20 text-red-100 animate-pulse' : 'bg-white/10 text-white'}`}>
          <Timer size={16} /> {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-1.5 z-10 relative shrink-0">
        <div className="bg-mobeng-green h-1.5 transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Question Content */}
      <div className="p-4 md:p-10 flex-1 overflow-y-auto overflow-x-hidden relative bg-slate-50/30">

        {/* Animated Container using Key Prop to force remount & animation on index change */}
        <div key={currentIndex} className="animate-slide-in-right">
          <div className="mb-8">
            <span className="text-mobeng-blue text-xs font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
              <span className="w-6 h-[1px] bg-mobeng-blue"></span> Pertanyaan {currentIndex + 1}
            </span>
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed">
              {currentQ.text}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {currentQ.options.map((opt, idx) => (
              <button
                key={`${currentIndex}-${idx}`} // Unique key ensures animation replays
                onClick={() => handleSelect(idx)}
                style={{ animationDelay: `${idx * 75}ms` }} // Staggered delay (Waterfall effect)
                className={`animate-slide-up-fade opacity-0 fill-mode-forwards text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between group relative overflow-hidden
                            ${selectedAnswers[currentIndex] === idx
                    ? 'border-mobeng-blue bg-blue-50 text-mobeng-darkblue shadow-md font-bold ring-1 ring-mobeng-blue'
                    : 'border-slate-200 bg-white hover:border-mobeng-blue/50 hover:bg-slate-50 text-slate-700 font-medium hover:shadow-sm'}`}
              >
                {/* Selection Indicator Strip */}
                {selectedAnswers[currentIndex] === idx && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-mobeng-blue animate-in slide-in-from-left duration-200"></div>
                )}

                <span className="text-base pl-2 relative z-10">{opt}</span>
                {selectedAnswers[currentIndex] === idx && (
                  <CheckCircle2 size={20} className="text-mobeng-blue animate-in zoom-in duration-300 relative z-10" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center z-10 relative">
        <button
          onClick={onExit}
          className="text-slate-500 hover:text-slate-700 text-sm font-bold px-4 py-2 hover:bg-slate-200/50 rounded-lg transition-colors"
        >
          Batalkan Tes
        </button>

        <div className="flex gap-3">
          {currentIndex > 0 && (
            <button
              onClick={() => setCurrentIndex(prev => prev - 1)}
              className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors active:scale-95"
            >
              Sebelumnya
            </button>
          )}

          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(prev => prev + 1)}
              className="px-6 py-2.5 rounded-xl bg-mobeng-darkblue text-white font-bold hover:bg-mobeng-blue transition-all active:scale-95 flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
              disabled={selectedAnswers[currentIndex] === -1}
            >
              Selanjutnya <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button
              onClick={finishTest}
              className="px-8 py-2.5 rounded-xl bg-mobeng-green text-white font-bold hover:bg-mobeng-darkgreen transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-green-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={selectedAnswers[currentIndex] === -1}
            >
              Selesai <CheckCircle2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
