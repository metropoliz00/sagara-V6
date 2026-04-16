import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Play, Pause, Eye, CheckCircle, XCircle, 
  Clock, BookOpen, AlertCircle, Save, ChevronLeft, ChevronRight,
  HelpCircle, Check, X, ListFilter
} from 'lucide-react';
import { Sumatif, Question, QuestionType, User, Student, Subject, SumatifResult } from '../types';
import { apiService } from '../services/apiService';
import { MOCK_SUBJECTS } from '../constants';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface SumatifViewProps {
  currentUser: User | null;
  activeClassId: string;
  students: Student[];
  onShowNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
  onRefresh?: () => void;
}

const SumatifView: React.FC<SumatifViewProps> = ({ 
  currentUser, 
  activeClassId, 
  students,
  onShowNotification,
  onRefresh
}) => {
  const [sumatifs, setSumatifs] = useState<Sumatif[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isTaking, setIsTaking] = useState(false);
  const [currentSumatif, setCurrentSumatif] = useState<Sumatif | null>(null);
  const [viewingResults, setViewingResults] = useState<Sumatif | null>(null);
  const [results, setResults] = useState<SumatifResult[]>([]);

  const isTeacher = currentUser?.role === 'guru' || currentUser?.role === 'admin';
  const isStudent = currentUser?.role === 'siswa';

  useEffect(() => {
    fetchSumatifs();
  }, [activeClassId]);

  const fetchSumatifs = async () => {
    setLoading(true);
    try {
      const data = await apiService.getSumatifs(activeClassId);
      setSumatifs(data);
    } catch (error) {
      onShowNotification('Gagal mengambil data sumatif', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSumatif = async (sumatif: Sumatif) => {
    try {
      await apiService.saveSumatif(sumatif);
      onShowNotification('Sumatif berhasil disimpan', 'success');
      setIsEditing(false);
      fetchSumatifs();
    } catch (error) {
      onShowNotification('Gagal menyimpan sumatif', 'error');
    }
  };

  const handleDeleteSumatif = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus sumatif ini?')) return;
    try {
      await apiService.deleteSumatif(id);
      onShowNotification('Sumatif berhasil dihapus', 'success');
      fetchSumatifs();
    } catch (error) {
      onShowNotification('Gagal menghapus sumatif', 'error');
    }
  };

  const handleToggleActive = async (sumatif: Sumatif) => {
    try {
      await apiService.saveSumatif({ ...sumatif, isActive: !sumatif.isActive });
      onShowNotification(`Sumatif ${!sumatif.isActive ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
      fetchSumatifs();
    } catch (error) {
      onShowNotification('Gagal mengubah status sumatif', 'error');
    }
  };

  const handleViewResults = async (sumatif: Sumatif) => {
    setLoading(true);
    try {
      const data = await apiService.getSumatifResults(sumatif.id);
      setResults(data);
      setViewingResults(sumatif);
    } catch (error) {
      onShowNotification('Gagal mengambil hasil sumatif', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToGrades = async (sumatif: Sumatif, results: SumatifResult[]) => {
    if (!window.confirm('Input nilai hasil sumatif ke buku nilai?')) return;
    try {
      for (const result of results) {
        const student = students.find(s => s.id === result.studentId);
        if (!student) continue;

        // Get existing grades for this student and subject
        const existingGrades = await apiService.getGradesForStudent(student.id);
        const subjectGrades = existingGrades?.subjects[sumatif.subjectId] || {
          sum1: 0, sum2: 0, sum3: 0, sum4: 0, sas: 0
        };

        // Update the specific sumatif type
        const updatedGrades = {
          ...subjectGrades,
          [sumatif.type]: result.score
        };

        await apiService.saveGrade(student.id, sumatif.subjectId, updatedGrades, activeClassId);
      }
      onShowNotification('Nilai berhasil disinkronkan ke buku nilai', 'success');
      if (onRefresh) onRefresh();
    } catch (error) {
      onShowNotification('Gagal sinkronisasi nilai', 'error');
    }
  };

  if (loading && !isTaking && !isEditing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5AB2FF]"></div>
      </div>
    );
  }

  if (isEditing && currentSumatif) {
    return (
      <SumatifEditor 
        sumatif={currentSumatif} 
        onSave={handleSaveSumatif} 
        onCancel={() => setIsEditing(false)} 
        activeClassId={activeClassId}
      />
    );
  }

  if (isTaking && currentSumatif && currentUser?.studentId) {
    return (
      <SumatifTaking 
        sumatif={currentSumatif} 
        studentId={currentUser.studentId}
        onComplete={() => {
          setIsTaking(false);
          fetchSumatifs();
        }}
        onCancel={() => setIsTaking(false)}
      />
    );
  }

  if (viewingResults && results) {
    return (
      <SumatifResultsView 
        sumatif={viewingResults}
        results={results}
        students={students}
        onBack={() => setViewingResults(null)}
        onSync={() => handleSyncToGrades(viewingResults, results)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sumatif & Asesmen</h2>
          <p className="text-slate-500 text-sm">Kelola dan kerjakan penilaian sumatif secara digital</p>
        </div>
        {isTeacher && (
          <button
            onClick={() => {
              setCurrentSumatif({
                id: '',
                classId: activeClassId,
                subjectId: MOCK_SUBJECTS[0].id,
                title: '',
                type: 'sum1',
                questions: [],
                duration: 60,
                isActive: false
              });
              setIsEditing(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-[#5AB2FF] text-white rounded-xl hover:bg-[#4A9FE6] transition-all shadow-md"
          >
            <Plus size={20} />
            <span>Tambah Sumatif</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sumatifs.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={40} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Belum ada Sumatif</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-2">
              {isTeacher ? 'Mulai buat sumatif baru untuk kelas ini.' : 'Belum ada tugas sumatif yang tersedia.'}
            </p>
          </div>
        ) : (
          sumatifs.map((s) => (
            <div key={s.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  s.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {s.isActive ? 'Aktif' : 'Draft'}
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {s.type.toUpperCase()}
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-1">{s.title}</h3>
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm text-slate-500">
                  <BookOpen size={16} className="mr-2 text-[#5AB2FF]" />
                  <span>{MOCK_SUBJECTS.find(sub => sub.id === s.subjectId)?.name || s.subjectId}</span>
                </div>
                <div className="flex items-center text-sm text-slate-500">
                  <Clock size={16} className="mr-2 text-[#5AB2FF]" />
                  <span>{s.duration} Menit</span>
                </div>
                <div className="flex items-center text-sm text-slate-500">
                  <HelpCircle size={16} className="mr-2 text-[#5AB2FF]" />
                  <span>{s.questions.length} Soal</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
                {isTeacher ? (
                  <>
                    <button
                      onClick={() => handleToggleActive(s)}
                      title={s.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      className={`p-2 rounded-xl transition-colors ${
                        s.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {s.isActive ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={() => {
                        setCurrentSumatif(s);
                        setIsEditing(true);
                      }}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleViewResults(s)}
                      className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors"
                      title="Lihat Hasil"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSumatif(s.id)}
                      className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors ml-auto"
                      title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    disabled={!s.isActive}
                    onClick={() => {
                      setCurrentSumatif(s);
                      setIsTaking(true);
                    }}
                    className={`w-full py-2.5 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 ${
                      s.isActive 
                        ? 'bg-[#5AB2FF] text-white hover:bg-[#4A9FE6] shadow-sm' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Play size={18} />
                    <span>Mulai Kerjakan</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- EDITOR COMPONENT ---
const SumatifEditor: React.FC<{ 
  sumatif: Sumatif, 
  onSave: (s: Sumatif) => void, 
  onCancel: () => void,
  activeClassId: string
}> = ({ sumatif, onSave, onCancel, activeClassId }) => {
  const [formData, setFormData] = useState<Sumatif>({ ...sumatif });
  const [activeTab, setActiveTab] = useState<'info' | 'questions'>('info');

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      type: 'pg',
      options: ['', '', '', ''],
      correctAnswer: '',
      points: 10
    };
    setFormData({ ...formData, questions: [...formData.questions, newQuestion] });
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setFormData({ ...formData, questions: newQuestions });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: newQuestions });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <button onClick={onCancel} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{sumatif.id ? 'Edit Sumatif' : 'Buat Sumatif Baru'}</h2>
            <p className="text-sm text-slate-500">Lengkapi detail dan butir soal</p>
          </div>
        </div>
        <button
          onClick={() => onSave(formData)}
          className="flex items-center space-x-2 px-6 py-2.5 bg-[#5AB2FF] text-white rounded-xl hover:bg-[#4A9FE6] transition-all shadow-md font-bold"
        >
          <Save size={20} />
          <span>Simpan Sumatif</span>
        </button>
      </div>

      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-8 py-4 text-sm font-bold transition-all border-b-2 ${
            activeTab === 'info' ? 'border-[#5AB2FF] text-[#5AB2FF]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Informasi Umum
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-8 py-4 text-sm font-bold transition-all border-b-2 ${
            activeTab === 'questions' ? 'border-[#5AB2FF] text-[#5AB2FF]' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Butir Soal ({formData.questions.length})
        </button>
      </div>

      <div className="p-8">
        {activeTab === 'info' ? (
          <div className="max-w-2xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Judul Sumatif</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Sumatif Akhir Bab 1"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Mata Pelajaran</label>
                <select
                  value={formData.subjectId}
                  onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] focus:border-transparent outline-none transition-all"
                >
                  {MOCK_SUBJECTS.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Jenis Sumatif</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] focus:border-transparent outline-none transition-all"
                >
                  <option value="sum1">Sumatif 1</option>
                  <option value="sum2">Sumatif 2</option>
                  <option value="sum3">Sumatif 3</option>
                  <option value="sum4">Sumatif 4</option>
                  <option value="sas">SAS (Sumatif Akhir Semester)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Durasi (Menit)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {formData.questions.map((q, idx) => (
              <div key={q.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                <button
                  onClick={() => removeQuestion(idx)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>

                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-[#5AB2FF] text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(idx, { 
                      type: e.target.value as QuestionType,
                      correctAnswer: e.target.value === 'pgk' ? [] : '',
                      options: e.target.value === 'bs' ? ['Benar', 'Salah'] : ['', '', '', '']
                    })}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 outline-none"
                  >
                    <option value="pg">Pilihan Ganda</option>
                    <option value="pgk">Pilihan Ganda Kompleks</option>
                    <option value="bs">Benar / Salah</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <textarea
                    value={q.text}
                    onChange={e => updateQuestion(idx, { text: e.target.value })}
                    placeholder="Tuliskan pertanyaan di sini..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] focus:border-transparent outline-none transition-all min-h-[100px]"
                  />

                  {q.type !== 'bs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center space-x-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                            q.type === 'pg' 
                              ? (q.correctAnswer === opt && opt !== '' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')
                              : (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt) && opt !== '' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400')
                          }`}>
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const newOpts = [...(q.options || [])];
                              newOpts[optIdx] = e.target.value;
                              updateQuestion(idx, { options: newOpts });
                            }}
                            placeholder={`Opsi ${String.fromCharCode(65 + optIdx)}`}
                            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all"
                          />
                          <button
                            onClick={() => {
                              if (q.type === 'pg') {
                                updateQuestion(idx, { correctAnswer: opt });
                              } else {
                                const current = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                                const next = current.includes(opt) 
                                  ? current.filter(c => c !== opt)
                                  : [...current, opt];
                                updateQuestion(idx, { correctAnswer: next });
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              (q.type === 'pg' ? q.correctAnswer === opt : Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt)) && opt !== ''
                                ? 'text-green-600 bg-green-50'
                                : 'text-slate-300 hover:text-green-500'
                            }`}
                          >
                            <CheckCircle size={20} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'bs' && (
                    <div className="flex space-x-4">
                      {['Benar', 'Salah'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => updateQuestion(idx, { correctAnswer: opt })}
                          className={`px-6 py-2 rounded-xl font-bold border transition-all ${
                            q.correctAnswer === opt
                              ? 'bg-green-500 border-green-500 text-white shadow-md'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-green-500'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={addQuestion}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-[#5AB2FF] hover:border-[#5AB2FF] hover:bg-blue-50/30 transition-all flex items-center justify-center space-x-2 font-bold"
            >
              <Plus size={20} />
              <span>Tambah Butir Soal</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// --- TAKING COMPONENT ---
const SumatifTaking: React.FC<{
  sumatif: Sumatif,
  studentId: string,
  onComplete: () => void,
  onCancel: () => void
}> = ({ sumatif, studentId, onComplete, onCancel }) => {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(sumatif.duration * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;

    sumatif.questions.forEach(q => {
      totalPoints += q.points;
      const studentAnswer = answers[q.id];
      
      if (q.type === 'pg' || q.type === 'bs') {
        if (studentAnswer === q.correctAnswer) earnedPoints += q.points;
      } else if (q.type === 'pgk') {
        const correctOnes = q.correctAnswer as string[];
        const studentOnes = studentAnswer as string[] || [];
        if (correctOnes.length === studentOnes.length && correctOnes.every(c => studentOnes.includes(c))) {
          earnedPoints += q.points;
        }
      }
    });

    const finalScore = Math.round((earnedPoints / totalPoints) * 100);

    try {
      await apiService.submitSumatifResult({
        sumatifId: sumatif.id,
        studentId,
        score: finalScore,
        answers
      });
      alert(`Selesai! Skor Anda: ${finalScore}`);
      onComplete();
    } catch (error) {
      alert('Gagal mengirim jawaban. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  const currentQuestion = sumatif.questions[currentQuestionIdx];

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-[#5AB2FF] rounded-xl flex items-center justify-center text-white">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 line-clamp-1">{sumatif.title}</h2>
            <p className="text-xs text-slate-500">Soal {currentQuestionIdx + 1} dari {sumatif.questions.length}</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-mono font-bold ${
            timeLeft < 300 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'
          }`}>
            <Clock size={18} />
            <span>{formatTime(timeLeft)}</span>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Apakah Anda yakin ingin mengakhiri ujian?')) {
                handleSubmit();
              }
            }}
            className="px-6 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all shadow-md"
          >
            Selesai
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Question Area */}
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[400px] flex flex-col">
              <div className="text-lg font-medium text-slate-800 mb-8 leading-relaxed">
                {currentQuestion.text}
              </div>

              <div className="space-y-4 mt-auto">
                {currentQuestion.type === 'pg' && (currentQuestion.options || []).map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(currentQuestion.id, opt)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center space-x-4 group ${
                      answers[currentQuestion.id] === opt
                        ? 'border-[#5AB2FF] bg-blue-50/50'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
                      answers[currentQuestion.id] === opt
                        ? 'bg-[#5AB2FF] text-white'
                        : 'bg-white text-slate-400 group-hover:text-slate-600'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className={`font-medium ${answers[currentQuestion.id] === opt ? 'text-slate-800' : 'text-slate-600'}`}>
                      {opt}
                    </span>
                  </button>
                ))}

                {currentQuestion.type === 'pgk' && (currentQuestion.options || []).map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const current = answers[currentQuestion.id] || [];
                      const next = current.includes(opt)
                        ? current.filter((c: string) => c !== opt)
                        : [...current, opt];
                      handleAnswer(currentQuestion.id, next);
                    }}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center space-x-4 group ${
                      (answers[currentQuestion.id] || []).includes(opt)
                        ? 'border-[#5AB2FF] bg-blue-50/50'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${
                      (answers[currentQuestion.id] || []).includes(opt)
                        ? 'bg-[#5AB2FF] text-white'
                        : 'bg-white text-slate-400 group-hover:text-slate-600'
                    }`}>
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                        (answers[currentQuestion.id] || []).includes(opt) ? 'border-white' : 'border-slate-300'
                      }`}>
                        {(answers[currentQuestion.id] || []).includes(opt) && <Check size={14} />}
                      </div>
                    </div>
                    <span className={`font-medium ${(answers[currentQuestion.id] || []).includes(opt) ? 'text-slate-800' : 'text-slate-600'}`}>
                      {opt}
                    </span>
                  </button>
                ))}

                {currentQuestion.type === 'bs' && (
                  <div className="grid grid-cols-2 gap-6">
                    {['Benar', 'Salah'].map(opt => (
                      <button
                        key={opt}
                        onClick={() => handleAnswer(currentQuestion.id, opt)}
                        className={`p-8 rounded-3xl border-2 text-center transition-all flex flex-col items-center space-y-4 ${
                          answers[currentQuestion.id] === opt
                            ? 'border-[#5AB2FF] bg-blue-50/50'
                            : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                        }`}
                      >
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                          answers[currentQuestion.id] === opt
                            ? 'bg-[#5AB2FF] text-white'
                            : 'bg-white text-slate-200'
                        }`}>
                          {opt === 'Benar' ? <CheckCircle size={40} /> : <XCircle size={40} />}
                        </div>
                        <span className={`text-xl font-bold ${answers[currentQuestion.id] === opt ? 'text-slate-800' : 'text-slate-400'}`}>
                          {opt}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-white transition-all disabled:opacity-30"
              >
                <ChevronLeft size={20} />
                <span>Sebelumnya</span>
              </button>
              <button
                disabled={currentQuestionIdx === sumatif.questions.length - 1}
                onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                className="flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold text-slate-600 hover:bg-white transition-all disabled:opacity-30"
              >
                <span>Selanjutnya</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Grid */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center">
                <ListFilter size={16} className="mr-2 text-[#5AB2FF]" />
                Navigasi Soal
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {sumatif.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`w-full aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                      currentQuestionIdx === idx
                        ? 'bg-[#5AB2FF] text-white shadow-md ring-4 ring-blue-100'
                        : answers[q.id]
                          ? 'bg-green-100 text-green-600'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
                <div className="flex items-center text-xs text-slate-400">
                  <div className="w-3 h-3 bg-[#5AB2FF] rounded-sm mr-2"></div>
                  <span>Sedang Dikerjakan</span>
                </div>
                <div className="flex items-center text-xs text-slate-400">
                  <div className="w-3 h-3 bg-green-100 rounded-sm mr-2"></div>
                  <span>Sudah Dijawab</span>
                </div>
                <div className="flex items-center text-xs text-slate-400">
                  <div className="w-3 h-3 bg-slate-50 rounded-sm mr-2"></div>
                  <span>Belum Dijawab</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- RESULTS VIEW COMPONENT ---
const SumatifResultsView: React.FC<{
  sumatif: Sumatif,
  results: SumatifResult[],
  students: Student[],
  onBack: () => void,
  onSync: () => void
}> = ({ sumatif, results, students, onBack, onSync }) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Hasil: {sumatif.title}</h2>
            <p className="text-sm text-slate-500">{results.length} Siswa telah mengerjakan</p>
          </div>
        </div>
        <button
          onClick={onSync}
          className="flex items-center space-x-2 px-6 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all shadow-md font-bold"
        >
          <Save size={20} />
          <span>Input ke Buku Nilai</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Siswa</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Skor</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Waktu Selesai</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {results.map(r => {
              const student = students.find(s => s.id === r.studentId);
              return (
                <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                        {student?.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{student?.name || 'Siswa Tidak Ditemukan'}</div>
                        <div className="text-xs text-slate-400">NIS: {student?.nis}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-lg font-bold ${
                      r.score >= 75 ? 'text-green-600' : r.score >= 60 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {r.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-500">
                    {format(new Date(r.submittedAt), 'dd MMM yyyy HH:mm', { locale: id })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">
                      Selesai
                    </span>
                  </td>
                </tr>
              );
            })}
            {results.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                  Belum ada data pengerjaan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SumatifView;
