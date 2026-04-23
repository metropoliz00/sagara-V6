import React, { useState, useEffect } from 'react';
import { Users, X, Circle, BookOpen } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import { getLocalISODate } from '../utils/dateUtils';

interface OnlineUsersWidgetProps {
  currentUser: User | null;
}

interface PresenceState {
  id: string;
  name: string;
  role: string;
  photo?: string;
  onlineAt: string;
}

const OnlineUsersWidget: React.FC<OnlineUsersWidgetProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [activeTeachingMap, setActiveTeachingMap] = useState<Record<string, { subject: string, classId: string }>>({});

  useEffect(() => {
    // Check if supabase is initialized
    if (!supabase) {
      setIsDemo(true);
      return;
    }
    if (!currentUser) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users: PresenceState[] = [];
        
        for (const key in newState) {
          const presences = newState[key] as any[];
          if (presences && presences.length > 0) {
              const p = presences[0];
              users.push({
                  id: p.id,
                  name: p.name,
                  role: p.role,
                  photo: p.photo,
                  onlineAt: p.onlineAt,
              });
          }
        }
        
        // Remove duplicates by ID (in case of multiple tabs)
        const uniqueUsers = Array.from(new Map(users.map(item => [item.id, item])).values());
        setOnlineUsers(uniqueUsers);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentUser.id,
            name: currentUser.fullName,
            role: currentUser.role,
            photo: currentUser.photo || '',
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Fetch teaching status from journal when widget is open
  useEffect(() => {
    if (isOpen && !isDemo && supabase) {
      const fetchTeachingData = async () => {
        try {
          const { data, error } = await supabase
            .from('jurnal_kelas')
            .select('class_id, content')
            .eq('date', getLocalISODate());
            
          if (!error && data) {
             const map: Record<string, { subject: string, classId: string }> = {};
             data.forEach((row: any) => {
                 if (row.content && Array.isArray(row.content)) {
                     row.content.forEach((entry: any) => {
                         if (entry.isTeacherPresent && entry.teacherName) {
                             // The last row processed per teacher sets their current known activity
                             map[entry.teacherName.toLowerCase()] = {
                                 subject: entry.subject || 'Mapel Umum',
                                 classId: row.class_id
                             };
                         }
                     });
                 }
             });
             setActiveTeachingMap(map);
          }
        } catch (e) {
            console.error(e);
        }
      };

      fetchTeachingData();
      const interval = setInterval(fetchTeachingData, 10000); // Polling every 10s
      return () => clearInterval(interval);
    }
  }, [isOpen, isDemo]);

  if (!currentUser) return null;

  // Filter based on roles
  // Admin sees all
  // Kepala Sekolah (supervisor) sees Guru & Siswa
  // Guru sees Siswa
  // Siswa sees nothing (widget won't be shown or empty)
  let visibleRoles: string[] = [];
  if (currentUser.role === 'admin') {
    visibleRoles = ['admin', 'supervisor', 'guru', 'siswa'];
  } else if (currentUser.role === 'supervisor') {
    visibleRoles = ['guru', 'siswa'];
  } else if (currentUser.role === 'guru') {
    visibleRoles = ['siswa'];
  }

  if (visibleRoles.length === 0) return null;

  const filteredUsers = onlineUsers.filter(u => visibleRoles.includes(u.role) && u.id !== currentUser.id);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'supervisor': return 'Kepala Sekolah';
      case 'guru': return 'Guru';
      case 'siswa': return 'Siswa';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'supervisor': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'guru': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'siswa': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <>
      {/* Floating Button Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 bg-[#5AB2FF] text-white rounded-full p-4 shadow-lg hover:bg-[#4A9FE6] transition-transform transform hover:-translate-y-1 flex items-center justify-center group"
        title="Lihat Status Online"
      >
        <div className="relative">
          <Users size={24} />
          {filteredUsers.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white truncate max-w-[24px] text-center">
               {filteredUsers.length}
            </span>
          )}
        </div>
      </button>

      {/* Pop Up */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl h-[80vh] sm:h-auto sm:max-h-[80vh] flex flex-col transform transition-all translate-y-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 sm:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#CAF4FF] rounded-full flex items-center justify-center text-[#5AB2FF]">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Status Online</h3>
                  <p className="text-xs text-gray-500 font-medium">{filteredUsers.length} pengguna online {isDemo && '(Demo Mode)'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-2 sm:p-4 bg-gray-50/30">
              {isDemo && onlineUsers.length === 0 && (
                <div className="text-center p-6 text-gray-500">
                  <p className="text-sm">Tidak dapat melacak pengguna di Mode Demo karena tidak ada koneksi database aktif.</p>
                </div>
              )}
              
              {!isDemo && filteredUsers.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-10 px-4 text-center h-full">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                       <Users size={28} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">Belum ada pengguna aktif lain yang dapat Anda lihat saat ini.</p>
                 </div>
              )}

              {filteredUsers.length > 0 && (
                <ul className="space-y-2">
                  {filteredUsers.map((user, idx) => {
                    const teachingInfo = user.role === 'guru' ? activeTeachingMap[user.name.toLowerCase()] : null;
                    return (
                      <li key={idx} className="bg-white border border-gray-100 p-3 sm:p-4 rounded-xl flex flex-col shadow-sm hover:shadow transition-shadow shrink-0">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0">
                                    <img src={user.photo ? user.photo : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="Avatar" className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-sm sm:text-base capitalize line-clamp-1">{user.name}</p>
                                <div className={`mt-0.5 inline-block px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border ${getRoleColor(user.role)}`}>
                                  {getRoleLabel(user.role)}
                                </div>
                              </div>
                           </div>
                           <div className="text-xs text-green-600 font-medium flex items-center bg-green-50 px-2 py-1 rounded-lg">
                              <Circle size={8} fill="currentColor" className="mr-1.5 animate-pulse shrink-0" />
                              Online
                           </div>
                         </div>
                         
                         {teachingInfo && (
                             <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-600 bg-[#CAF4FF]/30 p-2.5 rounded-lg">
                                 <BookOpen size={14} className="text-[#5AB2FF] shrink-0" />
                                 <span>Saat ini mengajar <b>{teachingInfo.subject}</b> di <b>Kelas {teachingInfo.classId}</b></span>
                             </div>
                         )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OnlineUsersWidget;
