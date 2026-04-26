import React, { useState, useEffect } from 'react';
import { Info, X, Edit, Save, MessageSquareText } from 'lucide-react';
import { User } from '../types';
import { apiService } from '../services/apiService';

interface ServiceInfoProps {
  currentUser: User | null;
  onShowNotification: (msg: string, type: 'success' | 'error' | 'warning') => void;
  trigger?: React.ReactNode;
}

const ServiceInfo: React.FC<ServiceInfoProps> = ({ currentUser, onShowNotification, trigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [infoText, setInfoText] = useState<string>('');
  const [draftText, setDraftText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const profiles = await apiService.getProfiles();
        const serviceInfoData = (profiles as any)['service_info'];
        if (serviceInfoData && serviceInfoData.text) {
          setInfoText(serviceInfoData.text);
          setDraftText(serviceInfoData.text);
        } else {
          const defaultText = 'Selamat datang di layanan kami. Hubungi admin untuk informasi lebih lanjut.';
          setInfoText(defaultText);
          setDraftText(defaultText);
        }
      } catch (error) {
        console.error("Failed to fetch service info", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInfo();
  }, []);

  const handleSave = async () => {
    try {
      await apiService.saveProfile('service_info', { text: draftText });
      setInfoText(draftText);
      setIsEditing(false);
      onShowNotification('Informasi Layanan berhasil diperbarui.', 'success');
    } catch (error) {
      onShowNotification('Gagal menyimpan Informasi Layanan.', 'error');
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setDraftText(infoText);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsEditing(false);
  };

  return (
    <>
      {trigger ? (
        <span onClick={handleOpen} className="cursor-pointer inline-flex">{trigger}</span>
      ) : (
        <button
          onClick={handleOpen}
          className="fixed bottom-24 right-6 z-40 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center group"
          title="Informasi Layanan"
        >
          <MessageSquareText size={28} className="group-hover:animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden transform transition-all animate-in fade-in zoom-in duration-300"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Info size={24} />
                </div>
                <h2 className="text-xl font-bold">Informasi Layanan</h2>
              </div>
              <button 
                onClick={handleClose}
                className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : isEditing ? (
                <div className="space-y-4 h-full flex flex-col">
                  <label className="block text-sm font-semibold text-gray-700">Edit Informasi Layanan</label>
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full min-h-[200px] flex-1 p-4 border-2 border-blue-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all resize-y text-gray-700 outline-none"
                    placeholder="Ketik informasi layanan di sini..."
                  />
                </div>
              ) : (
                <div className="prose prose-blue max-w-none">
                  <div className="bg-blue-50/50 p-6 rounded-2xl text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner border border-blue-100/50 break-words">
                    {infoText}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {isAdmin && (
              <div className="px-8 pb-8 shrink-0 flex justify-end">
                {isEditing ? (
                  <div className="flex space-x-3 w-full">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 px-4 rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 font-semibold transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 py-3 px-4 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-semibold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg"
                    >
                      <Save size={18} />
                      <span>Simpan</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-3 px-4 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 font-semibold flex items-center justify-center space-x-2 transition-colors border border-blue-200"
                  >
                    <Edit size={18} />
                    <span>Edit Informasi</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ServiceInfo;
