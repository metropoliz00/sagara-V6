import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Play, Pause, Eye, CheckCircle, XCircle, 
  Clock, BookOpen, AlertCircle, Save, ChevronLeft, ChevronRight,
  HelpCircle, Check, X, ListFilter, User as UserIcon, LogIn, Monitor,
  Maximize2, Minimize2, Type, ArrowLeft, ArrowRight, Flag, RefreshCw,
  Image as ImageIcon, Copy, Download, Upload, LayoutGrid, ZoomIn, ZoomOut
} from 'lucide-react';
import { Sumatif, Question, QuestionType, User, Student, Subject, SumatifResult } from '../types';
import { apiService } from '../services/apiService';
import { MOCK_SUBJECTS } from '../constants';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

const checkCorrect = (q: Question, studentAnswer: any) => {
  if (studentAnswer === undefined || studentAnswer === null) return false;
  
  if (q.type === 'pg') {
    const sAns = studentAnswer;
    const cAns = q.correctAnswer;
    
    if (typeof sAns === 'number' && typeof cAns === 'number') return sAns === cAns;
    if (typeof sAns === 'number') return String(q.options?.[sAns]).trim().toLowerCase() === String(cAns).trim().toLowerCase();
    if (typeof cAns === 'number') return String(sAns).trim().toLowerCase() === String(q.options?.[cAns]).trim().toLowerCase();
    
    return String(sAns).trim().toLowerCase() === String(cAns).trim().toLowerCase();
  } else if (q.type === 'pgk') {
    const sOnes = Array.isArray(studentAnswer) ? studentAnswer : [];
    const cOnes = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
    
    if (cOnes.length === 0) return false;
    if (sOnes.length !== cOnes.length) return false;
    
    // Normalize both to text for reliable comparison
    const sTexts = sOnes.map(s => {
      const val = typeof s === 'number' ? q.options?.[s] : s;
      return String(val || '').trim().toLowerCase();
    }).sort();

    const cTexts = cOnes.map(c => {
      const val = typeof c === 'number' ? q.options?.[c] : c;
      return String(val || '').trim().toLowerCase();
    }).sort();
    
    return sTexts.length === cTexts.length && 
           sTexts.every((val, index) => val === cTexts[index]);
  } else if (q.type === 'bs') {
    const subAnswers = studentAnswer as Record<string, string> || {};
    const subQs = q.subQuestions || [];
    return subQs.length > 0 && subQs.every(sq => {
      const s = String(subAnswers[sq.id] || '').trim().toLowerCase();
      const c = String(sq.correctAnswer || '').trim().toLowerCase();
      return s && c && s === c;
    });
  }
  return false;
};

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
  const [isEnteringToken, setIsEnteringToken] = useState(false);
  const [currentSumatif, setCurrentSumatif] = useState<Sumatif | null>(null);
  const [viewingResults, setViewingResults] = useState<Sumatif | null>(null);
  const [results, setResults] = useState<SumatifResult[]>([]);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: () => {}
  });

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
    setModal({
      isOpen: true,
      title: 'Hapus Sumatif',
      message: 'Apakah Anda yakin ingin menghapus sumatif ini?',
      type: 'confirm',
      onConfirm: async () => {
        setModal(prev => ({ ...prev, isOpen: false }));
        try {
          await apiService.deleteSumatif(id);
          onShowNotification('Sumatif berhasil dihapus', 'success');
          fetchSumatifs();
        } catch (error) {
          onShowNotification('Gagal menghapus sumatif', 'error');
        }
      }
    });
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
    try {
      onShowNotification('Sedang menyinkronkan nilai...', 'warning');
      for (const result of results) {
        const student = students.find(s => s.id === result.studentId);
        if (!student) continue;

        const existingGrades = await apiService.getGradesForStudent(student.id);
        const subjectGrades = existingGrades?.subjects[sumatif.subjectId] || {
          sum1: 0, sum2: 0, sum3: 0, sum4: 0, sas: 0
        };

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
        onShowNotification={onShowNotification}
      />
    );
  }

  if (isEnteringToken && currentSumatif && isStudent) {
    const student = students[0]; // In student portal, students array has only the current student
    return (
      <SumatifTokenEntry 
        sumatif={currentSumatif}
        student={student}
        onConfirm={() => {
          setIsEnteringToken(false);
          setIsTaking(true);
        }}
        onCancel={() => setIsEnteringToken(false)}
      />
    );
  }

  if (isTaking && currentSumatif && (currentUser?.studentId || isStudent)) {
    const studentId = currentUser?.studentId || (isStudent ? students[0]?.id : '');
    return (
      <SumatifTaking 
        sumatif={currentSumatif} 
        studentId={studentId}
        studentName={currentUser?.fullName || students[0]?.name || ''}
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
          <h2 className="text-2xl font-bold text-slate-800">PENILAIAN SUMATIF</h2>
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
                {s.token && isTeacher && (
                  <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl border border-slate-100 mt-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-400 uppercase tracking-wider">Token:</span>
                      <span className="font-mono font-black text-[#5AB2FF]">{s.token}</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(s.token || '');
                        onShowNotification('Token berhasil disalin', 'success');
                      }}
                      className="p-1.5 bg-white text-[#5AB2FF] rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                      title="Salin Token"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
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
                      if (s.token) {
                        setIsEnteringToken(true);
                      } else {
                        setIsTaking(true);
                      }
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

      <Modal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

// --- EDITOR COMPONENT ---
const SumatifEditor: React.FC<{ 
  sumatif: Sumatif, 
  onSave: (s: Sumatif) => void, 
  onCancel: () => void,
  activeClassId: string,
  onShowNotification: (message: string, type: 'success' | 'error' | 'warning') => void
}> = ({ sumatif, onSave, onCancel, activeClassId, onShowNotification }) => {
  const [formData, setFormData] = useState<Sumatif>({ ...sumatif });
  const [activeTab, setActiveTab] = useState<'info' | 'questions'>('info');

  const handleDownloadTemplate = () => {
    const template = [
      {
        No: 1,
        Pertanyaan: 'Contoh Pertanyaan Pilihan Ganda',
        Tipe: 'pg',
        Bobot: 1,
        Opsi_A: 'Pilihan A',
        Opsi_B: 'Pilihan B',
        Opsi_C: 'Pilihan C',
        Opsi_D: 'Pilihan D',
        Jawaban_Benar: 'Pilihan A',
        Gambar_URL: '',
        Keterangan_Gambar: ''
      },
      {
        No: 2,
        Pertanyaan: 'Contoh Pertanyaan Pilihan Ganda Kompleks',
        Tipe: 'pgk',
        Bobot: 1,
        Opsi_A: 'Pilihan A',
        Opsi_B: 'Pilihan B',
        Opsi_C: 'Pilihan C',
        Opsi_D: 'Pilihan D',
        Jawaban_Benar: 'Pilihan A, Pilihan B',
        Gambar_URL: '',
        Keterangan_Gambar: ''
      },
      {
        No: 3,
        Pertanyaan: 'Contoh Pertanyaan Benar Salah',
        Tipe: 'bs',
        Bobot: 1,
        Pernyataan_1: 'Pernyataan 1',
        Jawaban_1: 'Benar',
        Pernyataan_2: 'Pernyataan 2',
        Jawaban_2: 'Salah',
        Pernyataan_3: 'Pernyataan 3',
        Jawaban_3: 'Benar',
        Gambar_URL: '',
        Keterangan_Gambar: ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
    XLSX.writeFile(wb, 'Template_Soal_Sumatif.xlsx');
  };

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const newQuestions: Question[] = data.map((row) => {
          const type = (row.Tipe || 'pg').toLowerCase() as QuestionType;
          const q: Question = {
            id: Math.random().toString(36).substr(2, 9),
            text: row.Pertanyaan || '',
            type,
            points: parseInt(row.Bobot) || 1,
            imageUrl: row.Gambar_URL || '',
            imageCaption: row.Keterangan_Gambar || '',
            correctAnswer: '',
            options: [],
            subQuestions: []
          };

          if (type === 'pg' || type === 'pgk') {
            q.options = [row.Opsi_A, row.Opsi_B, row.Opsi_C, row.Opsi_D].map(o => o || '');
            
            const mapAnsToIdx = (ans: any) => {
              if (!ans) return '';
              const a = String(ans).trim().toUpperCase();
              if (a === 'A') return 0;
              if (a === 'B') return 1;
              if (a === 'C') return 2;
              if (a === 'D') return 3;
              return ans;
            };

            if (type === 'pg') {
              q.correctAnswer = mapAnsToIdx(row.Jawaban_Benar);
            } else {
              q.correctAnswer = String(row.Jawaban_Benar || '').split(',').map(s => mapAnsToIdx(s.trim()));
            }
          } else if (type === 'bs') {
            q.subQuestions = [
              { id: 'sq1', text: row.Pernyataan_1 || '', correctAnswer: (row.Jawaban_1 || 'Benar') as any },
              { id: 'sq2', text: row.Pernyataan_2 || '', correctAnswer: (row.Jawaban_2 || 'Benar') as any },
              { id: 'sq3', text: row.Pernyataan_3 || '', correctAnswer: (row.Jawaban_3 || 'Benar') as any }
            ];
          }

          return q;
        });

        setFormData({ ...formData, questions: [...formData.questions, ...newQuestions] });
        onShowNotification(`${newQuestions.length} soal berhasil diimpor`, 'success');
      } catch (error) {
        onShowNotification('Gagal mengimpor file Excel. Pastikan format benar.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: () => {}
  });

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      type: 'pg',
      options: ['', '', '', ''],
      optionImages: ['', '', '', ''],
      correctAnswer: '',
      points: 1,
      subQuestions: [
        { id: 'sq1', text: '', correctAnswer: 'Benar' },
        { id: 'sq2', text: '', correctAnswer: 'Benar' },
        { id: 'sq3', text: '', correctAnswer: 'Benar' }
      ]
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
        {activeTab === 'questions' && (
          <div className="ml-auto flex items-center space-x-2 px-6">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-sm font-bold"
            >
              <Download size={18} />
              <span className="hidden md:inline">Template Excel</span>
            </button>
            <label className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-sm font-bold cursor-pointer">
              <Upload size={18} />
              <span className="hidden md:inline">Upload Excel</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleUploadExcel} />
            </label>
          </div>
        )}
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
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Token Ujian</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formData.token || ''}
                    onChange={e => setFormData({ ...formData, token: e.target.value.toUpperCase() })}
                    placeholder="Contoh: ABCDEF"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] focus:border-transparent outline-none transition-all"
                  />
                  {formData.token && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(formData.token || '');
                        setModal({
                          isOpen: true,
                          title: 'Berhasil',
                          message: 'Token berhasil disalin ke clipboard!',
                          type: 'alert',
                          onConfirm: () => setModal(prev => ({ ...prev, isOpen: false }))
                        });
                      }}
                      className="px-4 py-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                      title="Copy Token"
                    >
                      <Copy size={20} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                      let result = '';
                      for (let i = 0; i < 6; i++) {
                        result += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      setFormData({ ...formData, token: result });
                    }}
                    className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                    title="Generate Token"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
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
                  <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 uppercase">Bobot:</span>
                    <input
                      type="number"
                      value={q.points}
                      onChange={e => updateQuestion(idx, { points: parseInt(e.target.value) || 0 })}
                      className="w-12 text-sm font-bold text-[#5AB2FF] outline-none"
                      min="0"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <textarea
                    value={q.text}
                    onChange={e => updateQuestion(idx, { text: e.target.value })}
                    placeholder="Tuliskan pertanyaan di sini..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] focus:border-transparent outline-none transition-all min-h-[100px]"
                  />

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <ImageIcon size={18} className="text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={q.imageUrl || ''}
                        onChange={e => updateQuestion(idx, { imageUrl: e.target.value })}
                        placeholder="Link Gambar Soal (Opsional)"
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all text-sm"
                      />
                    </div>
                    {q.imageUrl && (
                      <div className="space-y-2">
                        <div className="w-full max-h-[200px] rounded-xl overflow-hidden border border-slate-200 bg-white flex justify-center">
                          <img 
                            src={q.imageUrl} 
                            alt="Question Preview" 
                            className="max-w-full h-auto object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <input
                          type="text"
                          value={q.imageCaption || ''}
                          onChange={e => updateQuestion(idx, { imageCaption: e.target.value })}
                          placeholder="Keterangan Gambar"
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {q.type !== 'bs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(q.options || []).map((opt, optIdx) => {
                        const isCorrect = q.type === 'pg' 
                          ? q.correctAnswer === optIdx 
                          : (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optIdx));
                        
                        return (
                          <div key={optIdx} className={`space-y-3 p-4 rounded-2xl border transition-all ${
                            isCorrect ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-slate-100'
                          }`}>
                            <div className="flex items-center space-x-2">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                                isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400'
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
                                placeholder={`Teks Opsi ${String.fromCharCode(65 + optIdx)}`}
                                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all text-sm"
                              />
                              <button
                                onClick={() => {
                                  if (q.type === 'pg') {
                                    updateQuestion(idx, { correctAnswer: optIdx });
                                  } else {
                                    const current = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                                    const next = current.includes(optIdx) 
                                      ? current.filter(c => c !== optIdx)
                                      : [...current, optIdx];
                                    updateQuestion(idx, { correctAnswer: next });
                                  }
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  isCorrect ? 'text-green-600 bg-green-100' : 'text-slate-300 hover:text-green-500'
                                }`}
                                title="Set sebagai Jawaban Benar"
                              >
                                <CheckCircle size={20} />
                              </button>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <ImageIcon size={14} className="text-slate-300" />
                                <input
                                  type="text"
                                  value={q.optionImages?.[optIdx] || ''}
                                  onChange={e => {
                                    const newOptImgs = [...(q.optionImages || ['', '', '', ''])];
                                    newOptImgs[optIdx] = e.target.value;
                                    updateQuestion(idx, { optionImages: newOptImgs });
                                  }}
                                  placeholder="Link Gambar Opsi (Opsional)"
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-100 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all text-[10px]"
                                />
                              </div>
                              {q.optionImages?.[optIdx] && (
                                <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                                  <img 
                                    src={q.optionImages[optIdx]} 
                                    alt={`Preview ${optIdx}`} 
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'bs' && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">3 Pernyataan Benar/Salah</p>
                      {(q.subQuestions || []).map((sq, sqIdx) => (
                        <div key={sq.id} className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs font-bold text-slate-400">{sqIdx + 1}.</span>
                            <input
                              type="text"
                              value={sq.text}
                              onChange={e => {
                                const newSQs = [...(q.subQuestions || [])];
                                newSQs[sqIdx] = { ...newSQs[sqIdx], text: e.target.value };
                                updateQuestion(idx, { subQuestions: newSQs });
                              }}
                              placeholder={`Pernyataan ${sqIdx + 1}`}
                              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all text-sm"
                            />
                            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                              {['Benar', 'Salah'].map(ans => (
                                <button
                                  key={ans}
                                  onClick={() => {
                                    const newSQs = [...(q.subQuestions || [])];
                                    newSQs[sqIdx] = { ...newSQs[sqIdx], correctAnswer: ans as any };
                                    updateQuestion(idx, { subQuestions: newSQs });
                                  }}
                                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                                    sq.correctAnswer === ans 
                                      ? 'bg-white text-[#5AB2FF] shadow-sm' 
                                      : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  {ans}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 pl-6">
                            <ImageIcon size={14} className="text-slate-300" />
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                value={sq.imageUrl || ''}
                                onChange={e => {
                                  const newSQs = [...(q.subQuestions || [])];
                                  newSQs[sqIdx] = { ...newSQs[sqIdx], imageUrl: e.target.value };
                                  updateQuestion(idx, { subQuestions: newSQs });
                                }}
                                placeholder="Link Gambar Pernyataan"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-100 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all text-[10px]"
                              />
                              {sq.imageUrl && (
                                <div className="w-full h-20 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex justify-center">
                                  <img 
                                    src={sq.imageUrl} 
                                    alt={`Preview SQ ${sqIdx}`} 
                                    className="max-w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                              {sq.imageUrl && (
                                <input
                                  type="text"
                                  value={sq.imageCaption || ''}
                                  onChange={e => {
                                    const newSQs = [...(q.subQuestions || [])];
                                    newSQs[sqIdx] = { ...newSQs[sqIdx], imageCaption: e.target.value };
                                    updateQuestion(idx, { subQuestions: newSQs });
                                  }}
                                  placeholder="Keterangan Gambar Pernyataan"
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-100 focus:ring-2 focus:ring-[#5AB2FF] outline-none transition-all text-[10px]"
                                />
                              )}
                            </div>
                          </div>
                        </div>
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

      <Modal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

// --- TOKEN ENTRY COMPONENT ---
const SumatifTokenEntry: React.FC<{
  sumatif: Sumatif,
  student: Student,
  onConfirm: () => void,
  onCancel: () => void
}> = ({ sumatif, student, onConfirm, onCancel }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (token.toUpperCase() === sumatif.token?.toUpperCase()) {
      onConfirm();
    } else {
      setError('Token yang Anda masukkan salah.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Side: Info */}
        <div className="bg-[#5AB2FF] p-8 md:w-1/3 text-white flex flex-col justify-between">
          <div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <Monitor size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Konfirmasi Data Peserta</h2>
            <p className="text-blue-50 text-sm">Silakan periksa data Anda sebelum memulai ujian.</p>
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex items-center space-x-3">
              <UserIcon size={20} className="text-blue-200" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">Nama Peserta</p>
                <p className="font-bold">{student.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <LogIn size={20} className="text-blue-200" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">NIS / Username</p>
                <p className="font-bold">{student.nis}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Token Input */}
        <div className="p-8 md:w-2/3 bg-white">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Detail Ujian</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Mata Pelajaran</p>
                <p className="font-bold text-slate-700">{MOCK_SUBJECTS.find(s => s.id === sumatif.subjectId)?.name}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Waktu</p>
                <p className="font-bold text-slate-700">{sumatif.duration} Menit</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Masukkan Token</label>
              <input
                type="text"
                value={token}
                onChange={e => {
                  setToken(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="TOKEN"
                className={`w-full px-6 py-4 text-2xl font-mono font-bold tracking-[0.5em] text-center rounded-2xl border-2 transition-all outline-none ${
                  error ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-100 bg-slate-50 focus:border-[#5AB2FF] focus:bg-white'
                }`}
              />
              {error && <p className="text-red-500 text-xs mt-2 font-bold flex items-center"><AlertCircle size={14} className="mr-1" /> {error}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={onCancel}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleConfirm}
                className="flex-[2] py-4 bg-[#5AB2FF] text-white rounded-2xl font-bold hover:bg-[#4A9FE6] shadow-lg shadow-blue-200 transition-all flex items-center justify-center space-x-2"
              >
                <Play size={20} />
                <span>Mulai Ujian</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- TAKING COMPONENT ---
const SumatifTaking: React.FC<{
  sumatif: Sumatif,
  studentId: string,
  studentName: string,
  onComplete: () => void,
  onCancel: () => void
}> = ({ sumatif, studentId, studentName, onComplete, onCancel }) => {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState((sumatif.duration || 0) * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [showNavigation, setShowNavigation] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: () => {}
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle auto-submit when time is up
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitting) {
      handleSubmit();
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let totalPoints = 0;
    let earnedPoints = 0;

    sumatif.questions.forEach(q => {
      const qPoints = Number(q.points) || 0;
      totalPoints += qPoints;
      const studentAnswer = answers[q.id];
      
      if (q.type === 'pg' || q.type === 'pgk' || q.type === 'bs') {
        if (checkCorrect(q, studentAnswer)) {
          earnedPoints += qPoints;
        }
      }
    });

    const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    try {
      await apiService.submitSumatifResult({
        sumatifId: sumatif.id,
        studentId,
        score: finalScore,
        answers
      });
      setModal({
        isOpen: true,
        title: 'Ujian Selesai',
        message: `Selesai! Skor Anda: ${finalScore}`,
        type: 'alert',
        onConfirm: () => {
          setModal(prev => ({ ...prev, isOpen: false }));
          onComplete();
        }
      });
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Gagal',
        message: 'Gagal mengirim jawaban. Silakan coba lagi.',
        type: 'alert',
        onConfirm: () => setModal(prev => ({ ...prev, isOpen: false }))
      });
      setIsSubmitting(false);
    }
  };

  const currentQuestion = sumatif.questions[currentQuestionIdx];
  const isLastQuestion = currentQuestionIdx === sumatif.questions.length - 1;

  // Adaptive Font Size Calculation
  const adaptiveFontSize = useMemo(() => {
    const textLen = currentQuestion.text.length;
    if (textLen > 600) return 'text-base';
    if (textLen > 300) return 'text-lg';
    if (textLen > 100) return 'text-xl';
    return 'text-2xl';
  }, [currentQuestion.text]);

  // Reset zoom scale when question changes
  useEffect(() => {
    setZoomScale(1);
  }, [currentQuestionIdx]);

  return (
    <div className="fixed inset-0 z-50 bg-[#F0F4F8] flex flex-col font-sans">
      {/* CBT Header */}
      <div className="bg-[#5AB2FF] text-white px-6 py-3 flex items-center justify-between shadow-lg z-10">
        <div className="flex items-center space-x-4">
          <div className="bg-white p-1.5 rounded-lg">
            <Monitor size={24} className="text-[#5AB2FF]" />
          </div>
          <div>
            <h1 className="font-black text-lg leading-tight uppercase tracking-tight">CBT - {sumatif.title}</h1>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{MOCK_SUBJECTS.find(s => s.id === sumatif.subjectId)?.name}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4 md:space-x-8">
          <div className="flex flex-col items-end">
            <p className="hidden md:block text-[10px] font-black opacity-70 uppercase tracking-widest text-white/80">Sisa Waktu</p>
            <div className={`flex items-center px-3 md:px-4 py-1.5 rounded-xl backdrop-blur-sm border transition-all duration-300 ${
              timeLeft < 300 
                ? 'bg-red-500/20 border-red-500/40 text-red-100' 
                : 'bg-white/20 border-white/10 text-white'
            }`}>
              <Clock size={16} className="md:mr-2" />
              <span className="font-mono font-black text-base md:text-xl ml-1 md:ml-0">{formatTime(timeLeft)}</span>
            </div>
          </div>
          
          <div className="hidden sm:flex flex-col items-end border-l border-white/20 pl-4 md:pl-8">
            <p className="text-[10px] font-bold opacity-70 uppercase">Nama Peserta</p>
            <p className="font-bold text-xs md:text-sm">{studentName}</p>
          </div>

          <button
            onClick={() => setShowNavigation(!showNavigation)}
            className={`p-2 rounded-xl transition-all ${showNavigation ? 'bg-white text-[#5AB2FF]' : 'bg-white/20 text-white hover:bg-white/30'}`}
            title={showNavigation ? 'Sembunyikan Navigasi' : 'Tampilkan Navigasi'}
          >
            <LayoutGrid size={20} />
          </button>

          <button
            onClick={() => {
              setModal({
                isOpen: true,
                title: 'Akhiri Ujian',
                message: 'Apakah Anda yakin ingin mengakhiri ujian?',
                type: 'confirm',
                onConfirm: () => {
                  setModal(prev => ({ ...prev, isOpen: false }));
                  handleSubmit();
                }
              });
            }}
            className="bg-white text-[#5AB2FF] px-6 py-2 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-blue-50 transition-all shadow-md active:scale-95"
          >
            Selesai
          </button>
        </div>
      </div>

      {/* Main CBT Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Question Area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-8 transition-all duration-500">
          <div className={`max-w-[1440px] w-full mx-auto space-y-6 transition-all duration-500 ${!showNavigation ? 'flex flex-col items-center' : ''}`}>
            {/* Question Card */}
            <div className={`bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-slate-200 overflow-hidden min-h-[500px] flex flex-col transition-all duration-500 ${!showNavigation ? 'w-full max-w-4xl' : 'w-full'}`}>
              {/* Question Header */}
              <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="bg-[#5AB2FF] text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-md">
                    {currentQuestionIdx + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[#5AB2FF] font-black text-[10px] uppercase tracking-[0.2em] leading-none mb-1">
                      {MOCK_SUBJECTS.find(s => s.id === sumatif.subjectId)?.name || 'Mata Pelajaran'}
                    </span>
                    <span className="text-slate-600 font-bold text-sm uppercase tracking-wider leading-none">
                      {sumatif.title}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sisa Waktu</span>
                  <div className={`flex items-center font-mono font-black text-xl transition-all duration-300 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-[#5AB2FF]'}`}>
                    <Clock size={20} className="mr-2" />
                    {formatTime(timeLeft)}
                  </div>
                </div>
              </div>

              {/* Question Content */}
              <div className={`p-8 flex-1 overflow-y-auto scrollbar-hide ${
                (currentQuestion.imageUrl || currentQuestion.type === 'bs') 
                  ? 'grid grid-cols-1 lg:grid-cols-2 gap-10 items-start' 
                  : 'flex flex-col'
              }`}>
                {/* Left Side: Stimulus / Question Text */}
                <div className="space-y-6">
                  {currentQuestion.imageUrl && (
                    <div className="space-y-4">
                      <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm max-h-[500px] flex justify-center bg-slate-50 relative group">
                        <div className="p-3 absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-all flex space-x-2">
                          <button
                            onClick={() => setZoomScale(prev => Math.min(prev + 0.2, 3))}
                            className="w-10 h-10 bg-white shadow-xl rounded-xl flex items-center justify-center text-slate-600 hover:text-[#5AB2FF] hover:scale-110"
                            title="Zoom In"
                          >
                            <ZoomIn size={20} />
                          </button>
                          <button
                            onClick={() => setZoomScale(prev => Math.max(prev - 0.2, 0.5))}
                            className="w-10 h-10 bg-white shadow-xl rounded-xl flex items-center justify-center text-slate-600 hover:text-[#5AB2FF] hover:scale-110"
                            title="Zoom Out"
                          >
                            <ZoomOut size={20} />
                          </button>
                          <button
                            onClick={() => setZoomScale(1)}
                            className="w-10 h-10 bg-white shadow-xl rounded-xl flex items-center justify-center text-slate-600 hover:text-[#5AB2FF] hover:scale-110 font-bold text-xs"
                            title="Reset"
                          >
                            R
                          </button>
                        </div>
                        <div className="flex-1 w-full flex items-center justify-center p-4 overflow-auto scrollbar-hide">
                          <img 
                            src={currentQuestion.imageUrl} 
                            alt="Question" 
                            style={{ 
                              transform: `scale(${zoomScale})`, 
                              transformOrigin: 'center center',
                              transition: 'transform 0.2s ease-out'
                            }}
                            className="max-w-full h-auto object-contain cursor-grab active:cursor-grabbing"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                      {currentQuestion.imageCaption && (
                        <p className="text-center text-xs italic text-slate-400">{currentQuestion.imageCaption}</p>
                      )}
                    </div>
                  )}

                  {currentQuestion.type === 'bs' && (
                    <div className={`text-slate-800 font-medium leading-relaxed ${adaptiveFontSize}`}>
                      {currentQuestion.text}
                    </div>
                  )}
                </div>
                
                {/* Right Side / Content Flow: Text (for non-BS) + Interactions */}
                <div className="flex flex-col">
                  {currentQuestion.type !== 'bs' && (
                    <div className={`text-slate-800 font-medium leading-relaxed mb-10 ${adaptiveFontSize}`}>
                      {currentQuestion.text}
                    </div>
                  )}

                  <div className="space-y-4">
                  {currentQuestion.type === 'pg' && (currentQuestion.options || []).map((opt, idx) => {
                    if (!opt && !currentQuestion.optionImages?.[idx]) return null;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAnswer(currentQuestion.id, idx)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center space-x-4 group relative overflow-hidden ${
                          answers[currentQuestion.id] === idx
                            ? 'border-[#5AB2FF] bg-blue-50/50'
                            : 'border-slate-100 hover:border-[#5AB2FF]/30 bg-white'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black transition-all z-10 shrink-0 ${
                          answers[currentQuestion.id] === idx
                            ? 'bg-[#5AB2FF] text-white shadow-lg'
                            : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#5AB2FF]'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1 flex items-center space-x-4 z-10">
                          {currentQuestion.optionImages?.[idx] && (
                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-100 shrink-0 bg-slate-50">
                              <img 
                                src={currentQuestion.optionImages[idx]} 
                                alt={`Option ${idx}`} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <span className={`font-bold ${
                            answers[currentQuestion.id] === idx ? 'text-slate-800' : 'text-slate-600'
                          } ${fontSize === 'sm' ? 'text-sm' : fontSize === 'md' ? 'text-base' : 'text-lg'}`}>
                            {opt}
                          </span>
                        </div>
                        {answers[currentQuestion.id] === idx && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5AB2FF]">
                            <CheckCircle size={24} />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {currentQuestion.type === 'pgk' && (currentQuestion.options || []).map((opt, idx) => {
                    if (!opt && !currentQuestion.optionImages?.[idx]) return null;
                    const isSelected = (answers[currentQuestion.id] || []).includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          const current = answers[currentQuestion.id] || [];
                          const next = current.includes(idx)
                            ? current.filter((c: number) => c !== idx)
                            : [...current, idx];
                          handleAnswer(currentQuestion.id, next);
                        }}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center space-x-4 group relative overflow-hidden ${
                          isSelected
                            ? 'border-[#5AB2FF] bg-blue-50/50'
                            : 'border-slate-100 hover:border-[#5AB2FF]/30 bg-white'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black transition-all z-10 shrink-0 ${
                          isSelected
                            ? 'bg-[#5AB2FF] text-white shadow-lg'
                            : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#5AB2FF]'
                        }`}>
                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                            isSelected ? 'border-white' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check size={14} />}
                          </div>
                        </div>
                        <div className="flex-1 flex items-center space-x-4 z-10">
                          {currentQuestion.optionImages?.[idx] && (
                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-100 shrink-0 bg-slate-50">
                              <img 
                                src={currentQuestion.optionImages[idx]} 
                                alt={`Option ${idx}`} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <span className={`font-bold ${
                            isSelected ? 'text-slate-800' : 'text-slate-600'
                          } ${fontSize === 'sm' ? 'text-sm' : fontSize === 'md' ? 'text-base' : 'text-lg'}`}>
                            {opt}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {currentQuestion.type === 'bs' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Pernyataan Jawaban</th>
                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all text-center w-20">Benar</th>
                            <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all text-center w-20">Salah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(currentQuestion.subQuestions || []).map((sq, sqIdx) => {
                            const subAnswers = answers[currentQuestion.id] || {};
                            const currentAns = subAnswers[sq.id];
                            return (
                              <tr key={sq.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="space-y-2">
                                    {sq.imageUrl && (
                                      <div className="rounded-lg overflow-hidden border border-slate-100 max-h-[100px] inline-block">
                                        <img 
                                          src={sq.imageUrl} 
                                          alt="Statement" 
                                          className="max-w-full h-auto object-contain"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    )}
                                    <p className={`font-bold text-slate-700 leading-tight ${fontSize === 'sm' ? 'text-sm' : fontSize === 'md' ? 'text-base' : 'text-lg'}`}>
                                      {sq.text}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <button
                                    onClick={() => {
                                      const next = { ...subAnswers, [sq.id]: 'Benar' };
                                      handleAnswer(currentQuestion.id, next);
                                    }}
                                    className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center mx-auto ${
                                      currentAns === 'Benar'
                                        ? 'border-[#5AB2FF] bg-[#5AB2FF] text-white shadow-lg shadow-blue-100'
                                        : 'border-slate-200 text-slate-300 hover:border-[#5AB2FF]/50'
                                    }`}
                                  >
                                    <Check size={18} />
                                  </button>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <button
                                    onClick={() => {
                                      const next = { ...subAnswers, [sq.id]: 'Salah' };
                                      handleAnswer(currentQuestion.id, next);
                                    }}
                                    className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center mx-auto ${
                                      currentAns === 'Salah'
                                        ? 'border-red-500 bg-red-500 text-white shadow-lg shadow-red-100'
                                        : 'border-slate-200 text-slate-300 hover:border-red-500/50'
                                    }`}
                                  >
                                    <X size={18} />
                                  </button>
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
          </div>

      {/* CBT Footer Controls */}
      <div className={`flex items-center justify-between bg-white p-4 rounded-2xl shadow-lg border border-slate-200 transition-all duration-500 ${!showNavigation ? 'w-full max-w-4xl mx-auto' : ''}`}>
              <button
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl font-black bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-30 uppercase text-sm tracking-widest"
              >
                <ArrowLeft size={20} />
                <span>Sebelumnya</span>
              </button>

              <button
                onClick={() => toggleFlag(currentQuestion.id)}
                className={`flex items-center space-x-2 px-8 py-3 rounded-xl font-black transition-all uppercase text-sm tracking-widest border-2 ${
                  flaggedQuestions.has(currentQuestion.id)
                    ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                    : 'bg-white border-amber-500 text-amber-500 hover:bg-amber-50'
                }`}
              >
                <Flag size={20} fill={flaggedQuestions.has(currentQuestion.id) ? 'currentColor' : 'none'} />
                <span>Ragu-Ragu</span>
              </button>

              <button
                onClick={() => {
                  if (isLastQuestion) {
                    setModal({
                      isOpen: true,
                      title: 'Akhiri Ujian',
                      message: 'Apakah Anda yakin ingin mengakhiri ujian?',
                      type: 'confirm',
                      onConfirm: () => {
                        setModal(prev => ({ ...prev, isOpen: false }));
                        handleSubmit();
                      }
                    });
                  } else {
                    setCurrentQuestionIdx(prev => prev + 1);
                  }
                }}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-black text-white transition-all uppercase text-sm tracking-widest shadow-lg ${
                  isLastQuestion ? 'bg-green-500 hover:bg-green-600 shadow-green-200' : 'bg-[#5AB2FF] hover:bg-[#4A9FE6] shadow-blue-200'
                }`}
              >
                <span>{isLastQuestion ? 'Selesai' : 'Berikutnya'}</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Navigation Grid */}
        <div className={`bg-white border-l border-slate-200 flex flex-col shadow-2xl z-10 transition-all duration-500 overflow-hidden shrink-0 ${showNavigation ? 'w-80 opacity-100' : 'w-0 opacity-0 border-none pointer-events-none'}`}>
          <div className="w-80 flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Navigasi Soal</h3>
            <div className="grid grid-cols-5 gap-2">
              {sumatif.questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`w-full aspect-square rounded-lg flex items-center justify-center text-xs font-black transition-all relative ${
                    currentQuestionIdx === idx
                      ? 'bg-[#5AB2FF] text-white shadow-lg ring-4 ring-blue-100 scale-110 z-10'
                      : flaggedQuestions.has(q.id)
                        ? 'bg-amber-500 text-white'
                        : answers[q.id]
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                  {flaggedQuestions.has(q.id) && !answers[q.id] && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Keterangan</h4>
              <div className="space-y-2">
                <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase">
                  <div className="w-4 h-4 bg-[#5AB2FF] rounded mr-3 shadow-sm"></div>
                  <span>Posisi Sekarang</span>
                </div>
                <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase">
                  <div className="w-4 h-4 bg-green-500 rounded mr-3 shadow-sm"></div>
                  <span>Sudah Terjawab</span>
                </div>
                <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase">
                  <div className="w-4 h-4 bg-amber-500 rounded mr-3 shadow-sm"></div>
                  <span>Ragu-Ragu</span>
                </div>
                <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase">
                  <div className="w-4 h-4 bg-slate-100 rounded mr-3"></div>
                  <span>Belum Terjawab</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Progress</p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-black text-[#5AB2FF]">
                    {Math.round((Object.keys(answers).length / sumatif.questions.length) * 100)}%
                  </span>
                  <span className="text-[10px] font-bold text-blue-400">
                    {Object.keys(answers).length}/{sumatif.questions.length} Soal
                  </span>
                </div>
                <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#5AB2FF] transition-all duration-500"
                    style={{ width: `${(Object.keys(answers).length / sumatif.questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <Modal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal(prev => ({ ...prev, isOpen: false }))}
      />
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
  const [viewMode, setViewMode] = useState<'list' | 'analysis'>('list');

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
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-[#5AB2FF] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Daftar Nilai
            </button>
            <button
              onClick={() => setViewMode('analysis')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'analysis' ? 'bg-white text-[#5AB2FF] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Analisis Soal
            </button>
          </div>
          <button
            onClick={onSync}
            className="flex items-center space-x-2 px-6 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all shadow-md font-bold"
          >
            <Save size={20} />
            <span>Input ke Buku Nilai</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
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
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">Siswa</th>
                {sumatif.questions.map((_, idx) => (
                  <th key={idx} className="px-3 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                    S{idx + 1}
                  </th>
                ))}
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Skor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {results.map(r => {
                const student = students.find(s => s.id === r.studentId);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-50">
                      {student?.name || 'Unknown'}
                    </td>
                    {sumatif.questions.map(q => {
                      const isCorrect = checkCorrect(q, r.answers[q.id]);
                      return (
                        <td key={q.id} className="px-3 py-4 text-center">
                          <span className={`font-bold ${isCorrect ? 'text-green-500' : 'text-red-400'}`}>
                            {isCorrect ? '1' : '0'}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-center font-black text-[#5AB2FF]">
                      {r.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 font-bold">
              <tr>
                <td className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 z-10">Prosentase Benar</td>
                {sumatif.questions.map(q => {
                  const correctCount = results.filter(r => checkCorrect(q, r.answers[q.id])).length;
                  const percentage = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
                  return (
                    <td key={q.id} className="px-3 py-4 text-center text-[#5AB2FF]">
                      {percentage}%
                    </td>
                  );
                })}
                <td className="px-6 py-4"></td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-xs uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 z-10">Tingkat Kesulitan</td>
                {sumatif.questions.map(q => {
                  const correctCount = results.filter(r => checkCorrect(q, r.answers[q.id])).length;
                  const percentage = results.length > 0 ? (correctCount / results.length) * 100 : 0;
                  
                  // Dynamic Difficulty based on percentage
                  // > 70% = Mudah, 30-70% = Sedang, < 30% = Sulit
                  const difficulty = percentage >= 70 ? 'mudah' : percentage >= 30 ? 'sedang' : 'sulit';
                  
                  return (
                    <td key={q.id} className="px-3 py-4 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                        difficulty === 'mudah' ? 'bg-green-100 text-green-600' :
                        difficulty === 'sulit' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {difficulty}
                      </span>
                    </td>
                  );
                })}
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          </table>
          <div className="p-6 bg-slate-50/30 border-t border-slate-100">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs text-slate-500">1 = Benar</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span className="text-xs text-slate-500">0 = Salah</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- REUSABLE MODAL COMPONENT ---
const Modal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}> = ({ isOpen, title, message, type, onConfirm, onCancel, confirmText = 'OK', cancelText = 'Batal' }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2 rounded-lg ${type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                <AlertCircle size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">{title}</h3>
            </div>
            <p className="text-slate-600 leading-relaxed">{message}</p>
          </div>
          <div className="bg-slate-50 p-4 flex justify-end space-x-3">
            {type === 'confirm' && (
              <button
                onClick={onCancel}
                className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={onConfirm}
              className="px-6 py-2 rounded-xl font-bold bg-[#5AB2FF] text-white hover:bg-[#4A9FE6] shadow-md transition-all"
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SumatifView;
