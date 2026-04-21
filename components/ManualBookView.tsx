import React, { useState, useEffect } from 'react';
import { SchoolProfileData } from '../types';
import { Edit2, Save, ExternalLink, Link as LinkIcon, Book } from 'lucide-react';
import { useModal } from '../context/ModalContext';

interface ManualBookViewProps {
  schoolProfile?: SchoolProfileData;
  onSaveProfile: (profile: Partial<SchoolProfileData>) => Promise<void>;
  isAdminRole: boolean;
}

const ManualBookView: React.FC<ManualBookViewProps> = ({ schoolProfile, onSaveProfile, isAdminRole }) => {
  const [link, setLink] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert } = useModal();

  useEffect(() => {
    setLink(schoolProfile?.manualBookLink || '');
  }, [schoolProfile?.manualBookLink]);

  const handleSave = async () => {
    if (!link.trim()) {
      showAlert('Link manual book tidak boleh kosong', 'error', 'Perhatian');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSaveProfile({ manualBookLink: link });
      showAlert('Link manual book berhasil disimpan', 'success', 'Berhasil');
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      showAlert('Gagal menyimpan link manual book', 'error', 'Gagal');
    } finally {
      setIsSaving(false);
    }
  };

  const hasLink = !!schoolProfile?.manualBookLink;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center">
            <Book className="mr-3 text-[#5AB2FF]" size={28} />
            Buku Panduan Aplikasi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Panduan lengkap penggunaan sistem bagi guru, sisa, dan tenaga kependidikan.
          </p>
        </div>
        {isAdminRole && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:shadow-amber-500/30 text-sm font-semibold"
          >
            <Edit2 size={16} />
            <span>Update Link</span>
          </button>
        )}
      </div>

      {isEditing && isAdminRole ? (
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6 animate-fade-in-up">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <LinkIcon className="mr-2 text-amber-500" size={20} />
            Pengaturan Link Buku Panduan
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">URL / Tautan Manual Book</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://docs.google.com/document/d/.../edit"
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              />
              <p className="text-xs text-slate-500 mt-2">
                Masukkan link Google Docs, PDF Viewer, atau video panduan (Slide/YouTube) yang dapat diakses oleh semua pengguna.
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center space-x-2 bg-[#5AB2FF] hover:bg-[#4a9ee0] text-white px-4 py-2 rounded-xl transition-all shadow-md font-semibold text-sm disabled:opacity-50"
              >
                <Save size={16} />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setLink(schoolProfile?.manualBookLink || '');
                }}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-sm font-semibold disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!hasLink && !isEditing ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <Book className="text-slate-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-slate-700 mb-2">Buku Panduan Belum Ditambahkan</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Admin sekolah belum menambahkan tautan buku panduan aplikasi ini. Silakan hubungi admin sekolah.
          </p>
        </div>
      ) : hasLink && !isEditing ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-[70vh] flex flex-col relative">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600 flex items-center">
              <Book size={16} className="mr-2 shrink-0 text-[#5AB2FF]" />
              Dokumen Panduan
            </span>
            <a 
              href={schoolProfile?.manualBookLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 text-xs font-semibold text-[#5AB2FF] hover:text-[#4a9ee0] bg-[#CAF4FF]/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>Buka di Tab Baru</span>
              <ExternalLink size={14} />
            </a>
          </div>
          <iframe 
            src={schoolProfile?.manualBookLink} 
            title="Buku Panduan Aplikasi"
            className="w-full h-full border-0 flex-1 bg-slate-50"
            allow="autoplay"
          >
            <p>Peramban Anda tidak mendukung iframe.</p>
          </iframe>
        </div>
      ) : null}
    </div>
  );
};

export default ManualBookView;
