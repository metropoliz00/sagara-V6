import React, { useState, useEffect, useMemo } from 'react';
import { GtkRecord, User } from '../types';
import { Save, Plus, Trash2, Edit2, Download, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface GtkDataViewProps {
  gtkData: GtkRecord[];
  users: User[];
  currentUser: User | null;
  onSaveGtk: (records: GtkRecord[]) => Promise<void>;
  onShowNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
}

const parseDate = (dateString: string) => {
  if (!dateString) return 0;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
  }
  return 0;
};

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  // dateString format is YYYY-MM-DD
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = months[parseInt(parts[1]) - 1];
    const day = parts[2];
    return `${day} ${month} ${year}`;
  }
  return dateString;
};

const getRankValue = (rank: string) => {
  if (!rank) return 0;
  // Convert standard rank format e.g. "IV/a", "III/b" to numeric value
  const r = rank.toLowerCase().trim();
  const rankMap: Record<string, number> = {
    'iv/e': 17, 'iv/d': 16, 'iv/c': 15, 'iv/b': 14, 'iv/a': 13,
    'iii/d': 12, 'iii/c': 11, 'iii/b': 10, 'iii/a': 9,
    'ii/d': 8, 'ii/c': 7, 'ii/b': 6, 'ii/a': 5,
    'i/d': 4, 'i/c': 3, 'i/b': 2, 'i/a': 1
  };
  return rankMap[r] || 0;
};

const GtkDataView: React.FC<GtkDataViewProps> = ({ gtkData, users, currentUser, onSaveGtk, onShowNotification }) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  const canEdit = (record: GtkRecord) => {
    return isAdmin || (currentUser && record.userId === currentUser.id);
  };
  const [data, setData] = useState<GtkRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GtkRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Merge users into GTK list
    const gtkMap = new Map(gtkData.map(g => [g.id, g]));

    // Find staff in users table
    const staffUsers = users.filter(u => u.role === 'admin' || u.role === 'guru' || u.role === 'supervisor');
    
    let hasChanges = false;
    const mergedData = [...gtkData];

    staffUsers.forEach(u => {
      // Find by userId first, or by NIP/Name
      const existingIdx = mergedData.findIndex(g => g.userId === u.id || (u.nip && g.nip === u.nip) || g.nama === u.fullName);
      
      if (existingIdx >= 0) {
        // Update some fields if empty in GTK but present in user profile
        const g = mergedData[existingIdx];
        let changed = false;
        if (!g.userId) { g.userId = u.id; changed = true; }
        if (!g.nama && u.fullName) { g.nama = u.fullName; changed = true; }
        if (!g.nip && u.nip) { g.nip = u.nip; changed = true; }
        if (!g.nuptk && u.nuptk) { g.nuptk = u.nuptk; changed = true; }
        if (!g.jabatan && u.position) { g.jabatan = u.position; changed = true; }
        if (!g.pangkatGolongan && u.rank) { g.pangkatGolongan = u.rank; changed = true; }
        if (!g.emailPribadi && u.email) { g.emailPribadi = u.email; changed = true; }
        if (!g.foto && u.photo) { g.foto = u.photo || ''; changed = true; }
        
        if (changed) hasChanges = true;
      } else {
        // Create new record for user
        const newRecord: GtkRecord = {
          id: `gtk-${Date.now()}-${Math.random().toString(36).substring(2,9)}`,
          userId: u.id,
          nama: u.fullName || '',
          nip: u.nip || '',
          nuptk: u.nuptk || '',
          jenisKelamin: '',
          tempatLahir: '',
          tanggalLahir: '',
          ijazahTertinggi: u.education || '',
          jabatan: u.position || '',
          statusPegawai: '',
          tmtPengangkatan: '',
          mulaiBekerjaDiSini: '',
          pangkatGolongan: u.rank || '',
          masaKerjaTahun: 0,
          masaKerjaBulan: 0,
          skTerakhir: '',
          emailPribadi: u.email || '',
          emailBelajar: '',
          foto: u.photo || ''
        };
        mergedData.push(newRecord);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onSaveGtk(mergedData).catch(e => console.error("Auto sync GTK error:", e));
    }
    
    setData(mergedData);
  }, [gtkData, users]);

  // Sort logic
  const sortedData = useMemo(() => {
    let result = [...data].filter(r => r.jabatan && r.jabatan.trim() !== '');
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        result = result.filter(r => r.nama.toLowerCase().includes(lowerSearch) || r.nip.includes(lowerSearch));
    }

    return result.sort((a, b) => {
      // Prioritization map
      const getRolePriority = (jabatan: string) => {
        const j = jabatan.toLowerCase();
        if (j.includes('kepala sekolah')) return 3;
        if (j.includes('guru')) return 2;
        return 1;
      };

      const statusPriority: Record<string, number> = {
        'pns': 4,
        'pppk': 3,
        'pppk pw': 2,
        'honorer': 0
      };

      // 1. Role priority
      const aRole = getRolePriority(a.jabatan);
      const bRole = getRolePriority(b.jabatan);
      if (aRole !== bRole) return bRole - aRole;

      const getPriority = (status: string) => {
        const s = status.toLowerCase().trim();
        if (statusPriority.hasOwnProperty(s)) {
          return statusPriority[s];
        }
        return 1; // Prioritize unknowns above Honorer, but below others
      };

      // 2. Status Pegawai sorting
      const aPriority = getPriority(a.statusPegawai);
      const bPriority = getPriority(b.statusPegawai);
      if (aPriority !== bPriority) return bPriority - aPriority;

      // 3. Rank sorting (descending)
      const aRank = getRankValue(a.pangkatGolongan);
      const bRank = getRankValue(b.pangkatGolongan);
      if (aRank !== bRank) return bRank - aRank;

      // 4. Birth date (older first)
      const aDate = parseDate(a.tanggalLahir);
      const bDate = parseDate(b.tanggalLahir);
      return aDate - bDate;
    });
  }, [data, searchTerm]);

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setIsSaving(true);
    
    try {
      let newData = [...data];
      if (data.find(d => d.id === editingRecord.id)) {
        newData = newData.map(d => d.id === editingRecord.id ? editingRecord : d);
      } else {
        newData.push(editingRecord);
      }
      
      await onSaveGtk(newData);
      setData(newData);
      setIsModalOpen(false);
      onShowNotification("Data GTK berhasil disimpan", "success");
    } catch (e) {
      console.error(e);
      onShowNotification("Gagal menyimpan data GTK", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data GTK ini?")) {
      try {
        const newData = data.filter(d => d.id !== id);
        await onSaveGtk(newData);
        setData(newData);
        onShowNotification("Data GTK berhasil dihapus", "success");
      } catch (e) {
        onShowNotification("Gagal menghapus data GTK", "error");
      }
    }
  };

  const handleExport = () => {
    const exportData = sortedData.map((d, index) => ({
      'NO': index + 1,
      'NAMA': d.nama,
      'NIP': d.nip,
      'NUPTK': d.nuptk,
      'JENIS KELAMIN': d.jenisKelamin === 'L' ? 'Laki-laki' : d.jenisKelamin === 'P' ? 'Perempuan' : '',
      'TEMPAT LAHIR': d.tempatLahir,
      'TANGGAL LAHIR': d.tanggalLahir,
      'IJAZAH TERTINGGI': d.ijazahTertinggi,
      'JABATAN': d.jabatan,
      'STATUS': d.statusPegawai,
      'TMT PENGANGKATAN': d.tmtPengangkatan,
      'MULAI BEKERJA DISINI': d.mulaiBekerjaDiSini,
      'PANGKAT/GOL': d.pangkatGolongan,
      'MASA KERJA (THN)': d.masaKerjaTahun,
      'MASA KERJA (BLN)': d.masaKerjaBulan,
      'TANGGAL DAN NO SK TERAKHIR': d.skTerakhir,
      'EMAIL PRIBADI': d.emailPribadi,
      'EMAIL BELAJAR': d.emailBelajar
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data GTK");
    XLSX.writeFile(wb, "Data_GTK.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Data Guru & Tenaga Kependidikan (GTK)</h2>
          <p className="text-gray-500">Kelola dan sinkronisasi data master GTK.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
          >
            <Download size={18} />
            <span>Export Excel</span>
          </button>
          {isAdmin && (
            <button 
              onClick={() => {
                setEditingRecord({
                  id: `gtk-${Date.now()}`,
                  nama: '', nip: '', nuptk: '', jenisKelamin: '', tempatLahir: '', tanggalLahir: '',
                  ijazahTertinggi: '', jabatan: '', statusPegawai: '', tmtPengangkatan: '',
                  mulaiBekerjaDiSini: '', pangkatGolongan: '', masaKerjaTahun: 0, masaKerjaBulan: 0,
                  skTerakhir: '', emailPribadi: '', emailBelajar: '', foto: ''
                });
                setIsModalOpen(true);
              }}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              <Plus size={18} />
              <span>Tambah Pendidik</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center mb-4">
        <Search className="text-gray-400 mr-2" size={20} />
        <input 
          type="text" 
          placeholder="Cari nama atau NIP..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b whitespace-nowrap">
              <tr>
                <th className="p-3">NO</th>
                <th className="p-3">NAMA</th>
                <th className="p-3">NIP</th>
                <th className="p-3">NUPTK</th>
                <th className="p-3 text-center">JENIS KELAMIN</th>
                <th className="p-3">TEMPAT, TANGGAL LAHIR</th>
                <th className="p-3">IJAZAH TER TINGGI</th>
                <th className="p-3">JABATAN</th>
                <th className="p-3">STATUS</th>
                <th className="p-3">TMT PENGANGKATAN</th>
                <th className="p-3">MULAI BEKERJA DISINI</th>
                <th className="p-3">PANGKAT/GOL</th>
                <th className="p-3 text-center">MASA KERJA</th>
                <th className="p-3">SK TERAKHIR</th>
                <th className="p-3">EMAIL PRIBADI</th>
                <th className="p-3">EMAIL BELAJAR</th>
                <th className="p-3 text-center sticky right-0 bg-gray-50">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={17} className="p-8 text-center text-gray-500">Belum ada data GTK.</td>
                </tr>
              ) : (
                sortedData.map((row, index) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50 whitespace-nowrap">
                    <td className="p-3 text-center">{index + 1}</td>
                    <td className="p-3 font-semibold text-gray-800 flex items-center gap-2">
                        {row.foto ? <img src={row.foto} alt="Foto" className="w-8 h-12 rounded object-cover" /> : <div className="w-8 h-12 bg-indigo-100 rounded flex items-center justify-center text-indigo-700 font-bold">{row.nama.charAt(0) || '?'}</div>}
                        {row.nama}
                    </td>
                    <td className="p-3">{row.nip}</td>
                    <td className="p-3">{row.nuptk}</td>
                    <td className="p-3 text-center">{row.jenisKelamin}</td>
                    <td className="p-3">{row.tempatLahir ? `${row.tempatLahir}, ${formatDate(row.tanggalLahir)}` : formatDate(row.tanggalLahir)}</td>
                    <td className="p-3">{row.ijazahTertinggi}</td>
                    <td className="p-3">{row.jabatan}</td>
                    <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.statusPegawai.toLowerCase() === 'pns' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {row.statusPegawai || '-'}
                        </span>
                    </td>
                    <td className="p-3">{row.tmtPengangkatan}</td>
                    <td className="p-3">{row.mulaiBekerjaDiSini}</td>
                    <td className="p-3">{row.pangkatGolongan}</td>
                    <td className="p-3 text-center">{row.masaKerjaTahun} th, {row.masaKerjaBulan} bln</td>
                    <td className="p-3">{row.skTerakhir}</td>
                    <td className="p-3 text-blue-600">{row.emailPribadi}</td>
                    <td className="p-3 text-emerald-600">{row.emailBelajar}</td>
                    <td className="p-3 text-center sticky right-0 bg-white group-hover:bg-gray-50">
                      <div className="flex justify-center gap-2">
                        {canEdit(row) && (
                          <button onClick={() => { setEditingRecord(row); setIsModalOpen(true); }} className="text-blue-600 p-1 hover:bg-blue-50 rounded" title="Edit">
                            <Edit2 size={16} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDelete(row.id)} className="text-red-600 p-1 hover:bg-red-50 rounded" title="Hapus">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg text-gray-800">Formulir Data GTK</h3>
              <button disabled={isSaving} onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <form id="gtkForm" onSubmit={handleSaveModal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Nama Lengkap</label>
                  <input type="text" required value={editingRecord.nama} onChange={e => setEditingRecord({...editingRecord, nama: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">NIP</label>
                  <input type="text" value={editingRecord.nip} onChange={e => setEditingRecord({...editingRecord, nip: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">NUPTK</label>
                  <input type="text" value={editingRecord.nuptk} onChange={e => setEditingRecord({...editingRecord, nuptk: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Jenis Kelamin</label>
                  <select value={editingRecord.jenisKelamin} onChange={e => setEditingRecord({...editingRecord, jenisKelamin: e.target.value as any})} className="w-full text-sm border rounded-lg p-2 bg-gray-50">
                    <option value="">Pilih</option>
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Tempat Lahir</label>
                  <input type="text" value={editingRecord.tempatLahir} onChange={e => setEditingRecord({...editingRecord, tempatLahir: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Tanggal Lahir</label>
                  <input type="date" value={editingRecord.tanggalLahir} onChange={e => setEditingRecord({...editingRecord, tanggalLahir: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Ijazah Tertinggi</label>
                  <input type="text" value={editingRecord.ijazahTertinggi} onChange={e => setEditingRecord({...editingRecord, ijazahTertinggi: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Jabatan</label>
                  <input type="text" value={editingRecord.jabatan} onChange={e => setEditingRecord({...editingRecord, jabatan: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Status Pegawai</label>
                  <select value={editingRecord.statusPegawai} onChange={e => setEditingRecord({...editingRecord, statusPegawai: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50">
                    <option value="">Pilih Status</option>
                    <option value="PNS">PNS</option>
                    <option value="PPPK">PPPK</option>
                    <option value="PPPK PW">PPPK PW</option>
                    <option value="Honorer">Honorer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Pangkat/Gologan</label>
                  <input type="text" value={editingRecord.pangkatGolongan} onChange={e => setEditingRecord({...editingRecord, pangkatGolongan: e.target.value})} placeholder="Contoh: III/b" className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">TMT Pengangkatan</label>
                  <input type="date" value={editingRecord.tmtPengangkatan} onChange={e => setEditingRecord({...editingRecord, tmtPengangkatan: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Mulai Bekerja di Sekolah Ini</label>
                  <input type="date" value={editingRecord.mulaiBekerjaDiSini} onChange={e => setEditingRecord({...editingRecord, mulaiBekerjaDiSini: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="flex gap-2">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold text-gray-600">Masa Kerja (Tahun)</label>
                    <input type="number" value={editingRecord.masaKerjaTahun} onChange={e => setEditingRecord({...editingRecord, masaKerjaTahun: Number(e.target.value)})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold text-gray-600">Masa Kerja (Bulan)</label>
                    <input type="number" value={editingRecord.masaKerjaBulan} onChange={e => setEditingRecord({...editingRecord, masaKerjaBulan: Number(e.target.value)})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Tanggal dan No SK Terakhir</label>
                  <input type="text" value={editingRecord.skTerakhir} onChange={e => setEditingRecord({...editingRecord, skTerakhir: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Email Pribadi</label>
                  <input type="email" value={editingRecord.emailPribadi} onChange={e => setEditingRecord({...editingRecord, emailPribadi: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Email Belajar.id</label>
                  <input type="email" value={editingRecord.emailBelajar} onChange={e => setEditingRecord({...editingRecord, emailBelajar: e.target.value})} className="w-full text-sm border rounded-lg p-2 bg-gray-50" />
                </div>
              </form>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <button disabled={isSaving} onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">Batal</button>
              <button disabled={isSaving} type="submit" form="gtkForm" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center">
                {isSaving ? <span className="mr-2">Menyimpan...</span> : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GtkDataView;
