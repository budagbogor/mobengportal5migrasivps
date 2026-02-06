
import React from 'react';
import { AssessmentScores, BigFiveTraits } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, Users, ShieldAlert, HeartHandshake, AlertCircle, CheckCircle, Brain, Star } from 'lucide-react';

interface ScoreCardProps {
  scores: AssessmentScores;
  psychometrics?: BigFiveTraits;
  cultureFit?: number;
  starScore?: number;
  feedback?: string;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ scores, psychometrics, cultureFit, starScore, feedback }) => {
  // SAFETY CHECK: Prevent crash if scores are missing
  if (!scores) {
      return (
          <div className="p-6 bg-slate-50 rounded-xl text-center border border-slate-200">
              <AlertCircle className="mx-auto text-slate-400 mb-2" size={24} />
              <p className="text-slate-500 text-sm font-medium">Data penilaian belum tersedia.</p>
          </div>
      );
  }

  // Using Mobeng Brand Colors for charts
  const competencyData = [
    { name: 'Sales', value: scores.sales || 0, color: '#0085CA', icon: TrendingUp },  
    { name: 'Lead', value: scores.leadership || 0, color: '#005480', icon: Users },   
    { name: 'Ops', value: scores.operations || 0, color: '#F37021', icon: ShieldAlert }, 
    { name: 'CX', value: scores.cx || 0, color: '#78BE20', icon: HeartHandshake },    
  ];

  // Prepare Radar Data (Big Five)
  const radarData = psychometrics ? [
    { subject: 'Openness', A: psychometrics.openness, fullMark: 100 },
    { subject: 'Conscientiousness', A: psychometrics.conscientiousness, fullMark: 100 },
    { subject: 'Extraversion', A: psychometrics.extraversion, fullMark: 100 },
    { subject: 'Agreeableness', A: psychometrics.agreeableness, fullMark: 100 },
    { subject: 'Emotional Stability', A: psychometrics.neuroticism, fullMark: 100 },
  ] : [];

  const average = Math.round(
    ((scores.sales || 0) + (scores.leadership || 0) + (scores.operations || 0) + (scores.cx || 0)) / 4
  );

  let statusColor = 'text-slate-600';
  let statusText = 'Pending';
  let statusBg = 'bg-slate-100';

  if (average > 0) {
      if (average < 5) {
          statusColor = 'text-[#F37021]'; // Mobeng Orange
          statusText = 'Needs Improvement';
          statusBg = 'bg-orange-50 border-orange-100';
      } else if (average < 8) {
          statusColor = 'text-[#854d0e]'; 
          statusText = 'Potential';
          statusBg = 'bg-yellow-50 border-yellow-200';
      } else {
          statusColor = 'text-[#166534]'; // Darker Green for text
          statusText = 'Recommended';
          statusBg = 'bg-green-50 border-green-100';
      }
  }

  return (
    // CHANGED: Removed h-full, overflow-y-auto. Added w-full.
    <div className="flex flex-col w-full bg-white md:bg-transparent">
      {/* Header Score */}
      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Performance Index</h3>
           <span className={`text-3xl font-bold ${statusColor}`}>{average}<span className="text-lg text-slate-400 font-normal">/10</span></span>
        </div>
        <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${statusBg}`}>
            {average >= 8 ? <CheckCircle size={16} className={statusColor}/> : <AlertCircle size={16} className={statusColor}/>}
            <span className={`text-sm font-bold ${statusColor}`}>{statusText}</span>
        </div>
      </div>

      {/* Competency Chart (Bar) */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Competency Profile</h4>
        <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={competencyData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 10]} hide />
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={50} 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} 
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip 
                cursor={{fill: '#f1f5f9'}}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {competencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Psychometric Radar (Only visible if data exists) */}
      {psychometrics && (
         <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-100 p-4 print:break-inside-avoid">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                <Brain size={12}/> Psychometric (Big 5)
            </h4>
            <div className="h-[250px] -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="Candidate"
                        dataKey="A"
                        stroke="#0085CA"
                        strokeWidth={2}
                        fill="#0085CA"
                        fillOpacity={0.3}
                    />
                    <Tooltip />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
         </div>
      )}

      {/* Culture & STAR Score */}
      {(cultureFit !== undefined && starScore !== undefined) && (
          <div className="grid grid-cols-2 gap-3 mb-6 print:break-inside-avoid">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Culture Fit</div>
                  <div className="text-xl font-bold text-mobeng-darkblue">{cultureFit}%</div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2">
                      <div className="bg-mobeng-darkblue h-1.5 rounded-full" style={{width: `${cultureFit}%`}}></div>
                  </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1"><Star size={10} className="text-orange-400"/> STAR Method</div>
                  <div className="text-xl font-bold text-mobeng-orange">{starScore}/10</div>
                   <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2">
                      <div className="bg-mobeng-orange h-1.5 rounded-full" style={{width: `${starScore * 10}%`}}></div>
                  </div>
              </div>
          </div>
      )}

      {/* Feedback Section - Remove flex-1 to allow auto height */}
      <div className="flex flex-col mt-auto w-full print:break-inside-avoid">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            AI Recruiter Insights
        </h4>
        <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 text-slate-800 text-sm leading-relaxed shadow-sm font-medium">
        {feedback ? (
            feedback
        ) : (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 italic">
                <span>Menunggu respon kandidat...</span>
            </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default ScoreCard;
