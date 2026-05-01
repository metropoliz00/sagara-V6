
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Search, Calendar, User, BookOpen, Clock, 
  MessageSquare, Send, CheckCircle2, AlertCircle, Filter,
  ArrowRight, Info
} from 'lucide-react';
import { LearningJournalEntry, User as AppUser } from '../types';
import { apiService } from '../services/apiService';
import { motion, AnimatePresence } from 'framer-motion';

interface LearningMonitoringViewProps {
  currentUser: AppUser | null;
  onShowNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const LearningMonitoringView: React.FC<LearningMonitoringViewProps> = ({ 
  currentUser, 
  onShowNotification 
}) => {
  const [journals, setJournals] = useState<LearningJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<LearningJournalEntry | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAllLearningJournals();
      setJournals(data);
    } catch (error) {
      console.error("Error fetching journals:", error);
      onShowNotification("Gagal mengambil data jurnal", "error");
    } finally {
      setLoading(false);
    }
  };

  const groupedJournals = useMemo(() => {
    const academicExcludedKeywords = [
      'istirahat', 'pembiasaan', 'upacara', 'sholat', 'dhuha', 'dzuhur', 
      'senam', 'apel', 'istirahat 1', 'istirahat 2', 'upacara bendera'
    ];

    const filtered = journals.filter(j => {
      const matchesDate = j.date === filterDate;
      const subject = (j.subject || '').toLowerCase();
      
      const isAcademic = !academicExcludedKeywords.some(keyword => {
        return subject === keyword || subject.includes(` ${keyword}`) || subject.startsWith(`${keyword} `);
      });

      const matchesSearch = 
        (j.teacherName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (j.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (j.classId || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesDate && matchesSearch && isAcademic;
    });

    // Grouping logic: date + classId + subject + teacherName
    const groups: Record<string, LearningJournalEntry> = {};
    
    filtered.forEach(j => {
      const key = `${j.date}-${j.classId}-${j.subject}-${j.teacherName}`;
      if (!groups[key]) {
        groups[key] = { ...j };
      } else {
        // If we already have a group, keep the one with feedback if available
        // Or just keep the one where teacher is present
        if (!groups[key].supervisionFeedback && j.supervisionFeedback) {
          groups[key].supervisionFeedback = j.supervisionFeedback;
          groups[key].supervisorName = j.supervisorName;
        }
        if (!groups[key].isTeacherPresent && j.isTeacherPresent) {
          groups[key].isTeacherPresent = true;
        }
        // Merge time slots for display
        if (j.timeSlot && !groups[key].timeSlot?.includes(j.timeSlot)) {
          groups[key].timeSlot = `${groups[key].timeSlot}, ${j.timeSlot}`;
        }
      }
    });

    return Object.values(groups).sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''));
  }, [journals, filterDate, searchTerm]);

  const handleSaveFeedback = async () => {
    if (!selectedEntry || !feedback.trim()) return;

    setIsSubmitting(true);
    try {
      // Since we grouped them, we should find ALL specific entries that belong to this group
      // and update them with the same feedback.
      const entriesToUpdate = journals.filter(j => 
        j.date === selectedEntry.date && 
        j.classId === selectedEntry.classId && 
        j.subject === selectedEntry.subject && 
        j.teacherName === selectedEntry.teacherName
      );
      
      const updatedEntries = entriesToUpdate.map(j => ({
        ...j,
        supervisionFeedback: feedback,
        supervisorName: currentUser?.fullName || 'Supervisor',
        feedbackRead: false
      }));

      await apiService.saveLearningJournalBatch(updatedEntries);
      onShowNotification("Umpan balik per mata pelajaran berhasil disimpan", "success");
      
      // Update local state for all matching journals
      setJournals(prev => prev.map(j => {
        const isMatch = 
          j.date === selectedEntry.date && 
          j.classId === selectedEntry.classId && 
          j.subject === selectedEntry.subject && 
          j.teacherName === selectedEntry.teacherName;
        
        if (isMatch) {
          return {
            ...j,
            supervisionFeedback: feedback,
            supervisorName: currentUser?.fullName || 'Supervisor',
            feedbackRead: false
          };
        }
        return j;
      }));
      
      setSelectedEntry(null);
      setFeedback('');
    } catch (error) {
      console.error("Error saving feedback:", error);
      onShowNotification("Gagal menyimpan umpan balik", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const totalToday = groupedJournals.length;
    const withFeedback = groupedJournals.filter(j => j.supervisionFeedback).length;
    const attendance = groupedJournals.filter(j => j.isTeacherPresent).length;

    return { totalToday, withFeedback, attendance };
  }, [groupedJournals]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <BarChart3 className="mr-3 text-indigo-600" /> Monitoring Pembelajaran
          </h2>
          <p className="text-gray-500 text-sm">Pantau aktivitas mengajar harian guru dan berikan umpan balik langsung.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200">
           <div className="px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-bold text-indigo-700 border border-indigo-100">
             {stats.totalToday} JADWAL
           </div>
           <div className="px-3 py-1.5 bg-emerald-50 rounded-lg text-xs font-bold text-emerald-700 border border-emerald-100">
             {stats.attendance} HADIR
           </div>
           <div className="px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-bold text-blue-700 border border-blue-100">
             {stats.withFeedback} DIRESPON
           </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari guru, mata pelajaran, atau kelas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Memuat data jurnal...</p>
        </div>
      ) : groupedJournals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 text-center px-4">
          <div className="p-4 bg-gray-100 rounded-full text-gray-400 mb-4">
            <BookOpen size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-700">Tidak ada jurnal ditemukan</h3>
          <p className="text-gray-500 text-sm max-w-xs mt-1">Belum ada guru yang mengisi jurnal untuk tanggal ini atau kriteria pencarian Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {groupedJournals.map((journal) => (
            <motion.div 
              layout
              key={journal.id}
              className={`bg-white rounded-2xl border transition-all ${
                journal.supervisionFeedback 
                  ? 'border-gray-100' 
                  : 'border-rose-200 bg-rose-50/10 ring-1 ring-rose-100 animate-pulse-slow'
              }`}
            >
              <div className="p-4 flex items-center gap-4">
                {/* Status Indicator */}
                <div className={`w-1.5 h-14 rounded-full ${journal.isTeacherPresent ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                {/* Details */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Pelajaran</p>
                    <h4 className="font-extrabold text-gray-800 text-sm leading-tight flex items-center gap-2">
                       {journal.subject}
                       <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] rounded-md font-black">
                         {journal.classId}
                       </span>
                    </h4>
                    <p className="text-[10px] text-gray-500 line-clamp-1 italic">"{journal.topic}"</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Guru Pengajar</p>
                    <p className="font-bold text-gray-700 text-sm truncate">
                      {journal.teacherName || `Guru Kelas ${journal.classId}`}
                    </p>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                        <Clock size={11} className="text-indigo-400" /> {journal.timeSlot}
                      </div>
                      <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${journal.isTeacherPresent ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {journal.isTeacherPresent ? <CheckCircle2 size={11}/> : <AlertCircle size={11}/>}
                        {journal.isTeacherPresent ? 'Guru Hadir' : 'Guru Tidak Hadir'}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex justify-end gap-2">
                    {journal.supervisionFeedback ? (
                      <div className="flex-1 bg-white p-2.5 rounded-xl border border-gray-100 flex items-start gap-2 max-w-md shadow-sm">
                        <MessageSquare size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Umpan Balik</p>
                          <p className="text-xs text-gray-600 line-clamp-2 italic leading-tight">"{journal.supervisionFeedback}"</p>
                        </div>
                        <button 
                          onClick={() => {
                            setSelectedEntry(journal);
                            setFeedback(journal.supervisionFeedback || '');
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <Filter size={14} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setSelectedEntry(journal);
                          setFeedback('');
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
                      >
                         <MessageSquare size={14} />
                         Input Respon
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Feedback Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl overflow-hidden">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden border border-gray-100"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <div>
                  <h3 className="font-bold text-lg">Input Umpan Balik</h3>
                  <p className="text-indigo-100 text-xs">Memberikan masukan untuk {selectedEntry.teacherName}</p>
                </div>
                <button 
                  onClick={() => setSelectedEntry(null)} 
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <AlertCircle className="rotate-45" size={24}/>
                </button>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <div className="flex items-center gap-2 mb-2">
                      <BookOpen size={16} className="text-indigo-500" />
                      <span className="text-xs font-bold text-gray-500 uppercase">{selectedEntry.subject} — {selectedEntry.classId}</span>
                   </div>
                   <p className="text-sm font-bold text-gray-800 leading-tight">Materi: {selectedEntry.topic}</p>
                   <p className="text-xs text-gray-500 mt-2 line-clamp-3 italic">"{selectedEntry.activities}"</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <MessageSquare size={16} className="text-indigo-500" />
                    Pesan Umpan Balik
                  </label>
                  <textarea 
                    autoFocus
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tuliskan masukan atau catatan untuk guru..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[150px] transition-all"
                  />
                  <p className="text-[10px] text-gray-400 font-medium px-1">Umpan balik ini akan muncul di menu Supervisi dan Dashboard guru tersebut.</p>
                </div>
              </div>

              <div className="p-6 pt-0 flex gap-3">
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  disabled={isSubmitting || !feedback.trim()}
                  onClick={handleSaveFeedback}
                  className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : <Send size={18} />}
                  Simpan Umpan Balik
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LearningMonitoringView;
