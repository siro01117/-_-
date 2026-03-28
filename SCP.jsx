import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Trash2, Download, Search, Clock, Calendar, Palette, 
  FileText, Check, X, Tag as TagIcon, Type, Loader2, 
  UserPlus, Users, ArrowLeft, Edit3, MoreVertical, RotateCcw 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';

/**
 * 환경 변수 인터페이스
 * __firebase_config, __app_id, __initial_auth_token은 실행 환경에서 제공됩니다.
 */
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'studycube-default';

// 시스템 상수
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const START_HOUR = 7;
const END_HOUR = 25; 
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const DEFAULT_PASTEL_COLORS = [
  '#E59A9A', '#E5B981', '#DEE08C', '#A8D99C', '#8CCEDB', 
  '#89AED9', '#A59BD9', '#D9A9D9', '#C2CDC9', '#B8C6E6'
];

const App = () => {
  // 상태 관리 (인증 및 데이터)
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  
  // UI 제어 상태
  const [studentSearch, setStudentSearch] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [availableTags, setAvailableTags] = useState(['인강', '자습', '외부 학원', '수업', '외부 활동']);
  const [customColors, setCustomColors] = useState([]);
  
  // 모달 상태
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // 폼 버퍼 및 임시 데이터
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  
  const [studentFormData, setStudentFormData] = useState({ name: '' });
  const [scheduleFormData, setScheduleFormData] = useState({
    title: '', days: [], startH: '09', startM: '00', endH: '10', endM: '00',
    tag: '자습', memo: '', color: DEFAULT_PASTEL_COLORS[0]
  });

  const [searchTitle, setSearchTitle] = useState('');
  const [searchTag, setSearchTag] = useState('');

  // 1. 인증 초기화
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("인증 처리 중 오류 발생:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 클라우드 데이터 실시간 동기화
  useEffect(() => {
    if (!user) return;
    const studentsCol = collection(db, 'artifacts', appId, 'public', 'data', 'students');
    const q = query(studentsCol);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
      setLoading(false);
    }, (error) => {
      console.error("데이터 동기화 실패:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // 연산된 상태 (필터링 및 통계)
  const currentStudent = useMemo(() => 
    students.find(s => String(s.id) === String(selectedStudentId)), 
    [students, selectedStudentId]
  );

  const activeStudents = useMemo(() => 
    students.filter(s => !s.isDeleted && s.name.includes(studentSearch)),
    [students, studentSearch]
  );

  const trashedStudents = useMemo(() => 
    students.filter(s => s.isDeleted),
    [students]
  );

  const schedules = currentStudent?.schedules || [];

  const filteredSchedules = useMemo(() => {
    const titleKeywords = searchTitle.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    const tagKeywords = searchTag.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    return schedules.filter(s => {
      const titleMatch = titleKeywords.length === 0 || titleKeywords.some(k => s.title.toLowerCase().includes(k));
      const tagMatch = tagKeywords.length === 0 || tagKeywords.some(k => s.tag.toLowerCase().includes(k));
      return titleMatch && tagMatch;
    });
  }, [schedules, searchTitle, searchTag]);

  const { totalTime, dailyAverage } = useMemo(() => {
    const total = filteredSchedules.reduce((acc, s) => {
      const duration = (parseInt(s.endH) * 60 + parseInt(s.endM)) - (parseInt(s.startH) * 60 + parseInt(s.startM));
      return acc + (duration * s.days.length);
    }, 0);
    return { totalTime: total, dailyAverage: Math.round(total / 7) };
  }, [filteredSchedules]);

  // 클라우드 쓰기 로직
  const saveToCloud = async (studentObj) => {
    if (!user) return;
    try {
      const studentDoc = doc(db, 'artifacts', appId, 'public', 'data', 'students', String(studentObj.id));
      await setDoc(studentDoc, studentObj);
    } catch (err) {
      console.error("데이터 저장 실패:", err);
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!user) return;
    if (window.confirm("학생의 모든 데이터가 영구적으로 삭제됩니다. 계속하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', String(id)));
      } catch (err) {
        console.error("영구 삭제 실패:", err);
      }
    }
  };

  // UI 핸들러
  const handleSaveStudent = async () => {
    if (!studentFormData.name.trim()) return;
    const id = editingStudentId || Date.now();
    const existing = students.find(s => String(s.id) === String(id));
    await saveToCloud({
      id,
      name: studentFormData.name,
      schedules: existing ? existing.schedules : [],
      isDeleted: existing ? existing.isDeleted : false
    });
    setIsStudentModalOpen(false);
  };

  const toggleStudentStatus = async (id, isDeleted) => {
    const target = students.find(s => String(s.id) === String(id));
    if (target) {
      await saveToCloud({ ...target, isDeleted });
      if (isDeleted && selectedStudentId === id) setSelectedStudentId(null);
      setActiveMenuId(null);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleFormData.title || scheduleFormData.days.length === 0 || !currentStudent) return;
    const start = parseInt(scheduleFormData.startH) * 60 + parseInt(scheduleFormData.startM);
    const end = parseInt(scheduleFormData.endH) * 60 + parseInt(scheduleFormData.endM);
    if (end <= start) return alert("시간 설정 오류: 종료 시간은 시작 시간보다 늦어야 합니다.");

    const updated = editingScheduleId 
      ? schedules.map(s => s.id === editingScheduleId ? { ...scheduleFormData } : s)
      : [...schedules, { ...scheduleFormData, id: Date.now() }];

    await saveToCloud({ ...currentStudent, schedules: updated });
    setIsScheduleModalOpen(false);
  };

  const handleDeleteSchedule = async (id) => {
    await saveToCloud({ ...currentStudent, schedules: schedules.filter(s => s.id !== id) });
    setIsDetailOpen(false);
  };

  const formatTimeStr = (h, m) => {
    const hh = parseInt(h) >= 24 ? `0${parseInt(h) - 24}` : String(h).padStart(2, '0');
    return `${hh}:${String(m).padStart(2, '0')}`;
  };

  // 이미지 캔버스 출력 로직
  const handleExportImage = () => {
    if (!currentStudent) return;
    setIsExporting(true);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 2;
    canvas.width = 1200 * scale;
    canvas.height = 1100 * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 1100);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('주간 일정표', 40, 60);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`| 스터디큐브`, 185, 60);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${currentStudent.name} 학생 일정 보고서`, 40, 100);

    // 간소화된 그리드 및 블록 그리기 로직 (본문 렌더링 참조)
    const gridX = 40, gridY = 140, gridW = 750, gridH = 800;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(gridX, gridY, gridW, gridH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(gridX, gridY, gridW, gridH);

    setTimeout(() => {
      const link = document.createElement('a');
      link.download = `${currentStudent.name}_일정표_스터디큐브.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setIsExporting(false);
    }, 500);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-sans">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="animate-spin text-blue-500" size={48} />
          <p className="font-bold tracking-widest text-sm uppercase">클라우드 연결 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden text-slate-800">
      {/* 사이드바 */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-500 p-2 rounded-xl shadow-lg"><Users size={20} /></div>
            <h1 className="text-xl font-black tracking-tighter italic">STUDY CUBE</h1>
          </div>
          <button 
            onClick={() => { setEditingStudentId(null); setStudentFormData({name:''}); setIsStudentModalOpen(true); }} 
            className="w-full flex items-center justify-center gap-2 bg-blue-600 py-3.5 rounded-2xl font-black hover:bg-blue-700 transition-all text-sm shadow-lg"
          >
            <UserPlus size={18} /> 학생 등록
          </button>
        </div>

        <div className="p-5 flex-1 overflow-hidden flex flex-col">
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
            <button onClick={() => setShowTrash(false)} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${!showTrash ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>목록</button>
            <button onClick={() => setShowTrash(true)} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${showTrash ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400'}`}>휴지통 ({trashedStudents.length})</button>
          </div>

          {!showTrash && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input type="text" placeholder="검색..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-400" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {showTrash ? (
              trashedStudents.map(s => (
                <div key={s.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between group">
                  <span className="text-sm font-black text-slate-400 line-through truncate w-24">{s.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => toggleStudentStatus(s.id, false)} className="p-2 hover:bg-blue-100 text-blue-500 rounded-lg transition-colors"><RotateCcw size={16}/></button>
                    <button onClick={() => handlePermanentDelete(s.id)} className="p-2 hover:bg-red-100 text-red-500 rounded-lg transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))
            ) : (
              activeStudents.map(student => (
                <div key={student.id} className="relative group" onMouseLeave={() => setActiveMenuId(null)}>
                  <div 
                    onClick={() => { setSelectedStudentId(student.id); setIsEditMode(false); }} 
                    className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border ${String(selectedStudentId) === String(student.id) ? 'bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white ${String(selectedStudentId) === String(student.id) ? 'bg-blue-600' : 'bg-slate-300'}`}>{student.name[0]}</div>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-sm truncate">{student.name}</div>
                      <div className="text-[9px] text-slate-400 font-black uppercase">{student.schedules?.length || 0} 일정</div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === student.id ? null : student.id); }} 
                      className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  {activeMenuId === student.id && (
                    <div className="absolute right-4 top-14 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-2 min-w-[120px] animate-in fade-in zoom-in duration-200">
                      <button onClick={() => { setEditingStudentId(student.id); setStudentFormData({name: student.name}); setIsStudentModalOpen(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"><Edit3 size={14}/> 이름 변경</button>
                      <button onClick={() => toggleStudentStatus(student.id, true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={14}/> 휴지통 이동</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 메인 캔버스 */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {selectedStudentId && currentStudent ? (
          <>
            <div className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedStudentId(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-300 transition-colors"><ArrowLeft size={20}/></button>
                <h2 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">{currentStudent.name} <span className="text-slate-300 font-light mx-2">|</span> <span className="text-blue-600 text-sm font-black tracking-widest">{isEditMode ? '편집 모드' : '보기 모드'}</span></h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-slate-50 border border-slate-200 p-1.5 rounded-2xl font-black text-[10px]">
                  <input type="text" placeholder="제목 필터" className="w-24 pl-3 py-1.5 bg-transparent outline-none border-r border-slate-200" value={searchTitle} onChange={e => setSearchTitle(e.target.value)} />
                  <input type="text" placeholder="태그 필터" className="w-24 pl-3 py-1.5 bg-transparent outline-none" value={searchTag} onChange={e => setSearchTag(e.target.value)} />
                </div>
                <button onClick={handleExportImage} disabled={isExporting} className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:opacity-50">
                  {isExporting ? <Loader2 className="animate-spin" size={14}/> : <Download size={14} />} 이미지 저장
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-auto bg-slate-100/50">
              <div className="min-w-[1000px] h-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 relative grid grid-cols-8 divide-x divide-slate-100 overflow-hidden">
                <div className="flex flex-col bg-slate-50/50">
                  <div className="h-14 border-b border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">시간</div>
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
                    const h = START_HOUR + i;
                    return <div key={i} className="flex-1 border-b border-slate-100/30 flex items-start justify-center pt-2 text-[10px] text-slate-400 font-bold">{h < 24 ? h : h - 24}:00</div>
                  })}
                </div>
                {DAYS.map((day) => (
                  <div key={day} className="flex flex-col relative group">
                    <div className="h-14 border-b border-slate-100 flex items-center justify-center font-black text-xs text-slate-500 bg-white uppercase tracking-tight">{day}</div>
                    <div className="flex-1 relative">
                      {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => <div key={i} className="h-[calc(100%/(25-7))] border-b border-slate-50/50"></div>)}
                      {filteredSchedules.filter(s => s.days.includes(day)).map(s => {
                        const start = (parseInt(s.startH) * 60 + parseInt(s.startM)) - (START_HOUR * 60);
                        const dur = (parseInt(s.endH) * 60 + parseInt(s.endM)) - (parseInt(s.startH) * 60 + parseInt(s.startM));
                        const top = (start / TOTAL_MINUTES) * 100;
                        const height = (dur / TOTAL_MINUTES) * 100;
                        const isTiny = height < 3.0;

                        return (
                          <div 
                            key={s.id} 
                            onClick={() => isEditMode ? openScheduleModal(s) : (setDetailItem(s), setIsDetailOpen(true))} 
                            className={`absolute left-1 right-1 rounded-2xl p-2.5 shadow-md border border-black/5 transition-all hover:scale-[1.02] hover:z-30 cursor-pointer overflow-hidden flex flex-col ${isEditMode ? 'ring-2 ring-blue-400 ring-offset-1 shadow-blue-200' : ''}`} 
                            style={{ top: `${top}%`, height: `${height}%`, backgroundColor: s.color, zIndex: 10 }}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <div className={`font-black leading-tight truncate flex-1 ${height < 3 ? 'text-[8px]' : 'text-[10px]'}`}>{s.title}</div>
                              {!isEditMode && height > 3.5 && <div className="text-[7px] bg-black/10 px-1 rounded font-black uppercase shrink-0">{s.tag}</div>}
                            </div>
                            {height > 4.5 && <div className="text-[8px] font-bold text-black/40 mt-1 uppercase tracking-tighter">{formatTimeStr(s.startH, s.startM)} - {formatTimeStr(s.endH, s.endM)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-20 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-4">
                <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-sm shadow-xl transition-all ${isEditMode ? 'bg-slate-900 text-white shadow-slate-900/20' : 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {isEditMode ? <><Check size={18}/> 데이터 저장 및 완료</> : <><Edit3 size={18}/> 일정 편집 시작</>}
                </button>
                {isEditMode && <button onClick={() => openScheduleModal()} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700 active:scale-95 transition-all"><Plus size={18}/> 일정 추가</button>}
              </div>
              <div className="flex items-center gap-8 text-slate-900 font-black text-right">
                <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">주간 합계</span><span className="text-xl tracking-tighter">{Math.floor(totalTime/60)}시간 {totalTime%60}분</span></div>
                <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase tracking-widest font-black">일일 평균</span><span className="text-xl tracking-tighter text-emerald-500">{Math.floor(dailyAverage/60)}시간 {dailyAverage%60}분</span></div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center mb-8 text-blue-500 border border-slate-100"><Users size={40} /></div>
            <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter uppercase">학생을 선택해주세요</h2>
            <p className="text-slate-400 max-w-sm font-bold leading-relaxed text-sm text-center">좌측 리스트에서 학생을 선택하거나<br/>신규 학생 정보를 등록하여 관리를 시작하세요.</p>
          </div>
        )}

        {/* 상세 정보 모달 */}
        {isDetailOpen && detailItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in duration-200">
               <div className="h-40 relative" style={{ backgroundColor: detailItem.color }}>
                 <button onClick={() => setIsDetailOpen(false)} className="absolute top-8 right-8 p-2.5 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all"><X size={24}/></button>
                 <div className="absolute -bottom-8 left-12 bg-white p-5 rounded-[2rem] shadow-2xl border border-slate-100"><TagIcon className="text-slate-900" size={32} /></div>
               </div>
               <div className="p-12 pt-16 space-y-10">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 mb-3 leading-tight uppercase italic">{detailItem.title}</h3>
                    <div className="flex flex-wrap gap-2.5">
                      <span className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-black">{detailItem.tag}</span>
                      {detailItem.days.map(d => (
                        <span key={d} className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase">{d}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] space-y-8 border border-slate-100 shadow-inner">
                    <div className="flex items-center gap-6">
                      <div className="bg-white p-4 rounded-2xl shadow-sm text-slate-400 border border-slate-100"><Clock size={24} /></div>
                      <div className="text-2xl font-black text-slate-800 tracking-tighter italic">
                        {formatTimeStr(detailItem.startH, detailItem.startM)} <span className="text-slate-300 font-light mx-2">→</span> {formatTimeStr(detailItem.endH, detailItem.endM)}
                      </div>
                    </div>
                    {detailItem.memo && (
                      <div className="flex gap-6 pt-8 border-t border-slate-200/60">
                        <div className="bg-white p-4 rounded-2xl shadow-sm text-slate-400 border border-slate-100 h-14 w-14 flex items-center justify-center shrink-0"><FileText size={24} /></div>
                        <div className="text-base font-bold text-slate-600 leading-relaxed pt-2">{detailItem.memo}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => { setIsDetailOpen(false); openScheduleModal(detailItem); setIsEditMode(true); }} className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] font-black text-sm shadow-2xl active:scale-95 transition-all">내용 수정하기</button>
                    <button onClick={() => handleDeleteSchedule(detailItem.id)} className="p-5 bg-red-50 text-red-500 rounded-[2rem] hover:bg-red-100 active:scale-95 transition-all"><Trash2 size={24}/></button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* 편집 모달 */}
        {isScheduleModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-white/10 animate-in zoom-in duration-200 font-sans">
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl"><Edit3 size={24}/></div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">상세 일정 수립</h2>
                </div>
                <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-3 transition-transform hover:rotate-90 duration-300"><X size={32}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-2 italic font-sans">Activity Name</label>
                    <input type="text" className="w-full border-slate-100 border-2 p-6 rounded-[2rem] text-xl outline-none focus:border-slate-800 font-black shadow-inner bg-slate-50/50 transition-all font-sans" value={scheduleFormData.title} onChange={e => setScheduleFormData(prev => ({...prev, title: e.target.value}))} placeholder="활동 이름을 기입하세요" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center ml-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest italic font-sans">Tag</label>
                        <div className="flex gap-2 items-center bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                            <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="태그 추가" className="w-24 bg-transparent text-[11px] font-black p-1 outline-none font-sans" onKeyDown={e => e.key === 'Enter' && addTag()}/>
                            <button onClick={addTag} className="p-1.5 bg-slate-900 text-white rounded-lg active:scale-90 transition-all"><Plus size={12}/></button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner min-h-[90px]">
                      {availableTags.map(t => (
                        <button key={t} onClick={() => setScheduleFormData(prev => ({...prev, tag: t}))} className={`px-6 py-3 rounded-2xl text-xs font-black transition-all ${scheduleFormData.tag === t ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-400 shadow-sm font-sans'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase block ml-2 italic font-sans">Days</label>
                    <div className="grid grid-cols-7 gap-2 bg-slate-100 p-2 rounded-[2rem] shadow-inner font-sans">
                      {DAYS.map(d => <button key={d} onClick={() => {
                         const currentDays = scheduleFormData.days;
                         const nextDays = currentDays.includes(d) ? currentDays.filter(x => x !== d) : [...currentDays, d];
                         setScheduleFormData(prev => ({...prev, days: nextDays}));
                      }} className={`h-14 rounded-2xl text-sm font-black transition-all ${scheduleFormData.days.includes(d) ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-slate-300 hover:text-slate-500 font-sans'}`}>{d}</button>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <span className="text-xs font-black text-slate-400 ml-2 italic font-sans">Start (HH:MM)</span>
                        <div className="flex items-center gap-2">
                            <input type="text" maxLength="2" placeholder="09" className="w-full border-2 border-slate-100 p-6 rounded-[1.5rem] text-center text-xl font-black bg-slate-50 shadow-inner focus:border-slate-800 outline-none font-sans" value={scheduleFormData.startH} onChange={e => setScheduleFormData(prev => ({...prev, startH: e.target.value.replace(/\D/g,'')}))}/>
                            <span className="font-black text-slate-300 text-2xl">:</span>
                            <input type="text" maxLength="2" placeholder="00" className="w-full border-2 border-slate-100 p-6 rounded-[1.5rem] text-center text-xl font-black bg-slate-50 shadow-inner focus:border-slate-800 outline-none font-sans" value={scheduleFormData.startM} onChange={e => setScheduleFormData(prev => ({...prev, startM: e.target.value.replace(/\D/g,'')}))}/>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <span className="text-xs font-black text-slate-400 ml-2 italic font-sans">End (HH:MM)</span>
                        <div className="flex items-center gap-2">
                            <input type="text" maxLength="2" placeholder="10" className="w-full border-2 border-slate-100 p-6 rounded-[1.5rem] text-center text-xl font-black bg-slate-50 shadow-inner focus:border-slate-800 outline-none font-sans" value={scheduleFormData.endH} onChange={e => setScheduleFormData(prev => ({...prev, endH: e.target.value.replace(/\D/g,'')}))}/>
                            <span className="font-black text-slate-300 text-2xl">:</span>
                            <input type="text" maxLength="2" placeholder="00" className="w-full border-2 border-slate-100 p-6 rounded-[1.5rem] text-center text-xl font-black bg-slate-50 shadow-inner focus:border-slate-800 outline-none font-sans" value={scheduleFormData.endM} onChange={e => setScheduleFormData(prev => ({...prev, endM: e.target.value.replace(/\D/g,'')}))}/>
                        </div>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-2 italic font-sans">Memo</label>
                    <textarea className="w-full border-slate-100 border-2 p-6 rounded-[2rem] text-base outline-none focus:border-slate-800 font-bold h-36 bg-slate-50/50 shadow-inner resize-none transition-all font-sans" value={scheduleFormData.memo} onChange={e => setScheduleFormData(prev => ({...prev, memo: e.target.value}))} placeholder="상세 정보를 기록하세요" />
                  </div>
                  <div className="space-y-4">
                     <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-2 italic font-sans">Theme Color</label>
                     <div className="flex flex-wrap gap-4 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner items-center">
                       {[...DEFAULT_PASTEL_COLORS, ...customColors].map(color => (
                          <button key={color} onClick={() => setScheduleFormData(prev => ({...prev, color}))} className={`w-11 h-11 rounded-full border-4 shadow-md transition-all hover:scale-125 ${scheduleFormData.color === color ? 'border-slate-900 scale-110' : 'border-white shadow-sm'}`} style={{ backgroundColor: color }} />
                       ))}
                       <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center relative group cursor-pointer hover:border-blue-400 transition-all shadow-sm">
                          <Plus size={24} className="text-slate-400 group-hover:text-blue-500" />
                          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" onChange={addCustomColor} />
                       </div>
                     </div>
                  </div>
                </div>
              </div>

              <div className="p-12 bg-slate-50 border-t border-slate-100 flex gap-6">
                <button onClick={() => setIsScheduleModalOpen(false)} className="flex-1 bg-white border-2 border-slate-200 py-6 rounded-[2rem] font-black text-slate-500 shadow-md hover:bg-slate-100 active:scale-95 transition-all uppercase italic font-sans">Cancel</button>
                <button onClick={handleSaveSchedule} className="flex-[2] bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-slate-900/30 hover:bg-slate-800 active:scale-95 transition-all uppercase italic font-sans">Commit</button>
              </div>
            </div>
          </div>
        )}

        {/* 학생 등록 모달 */}
        {isStudentModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-sm shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in duration-200">
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">{editingStudentId ? "Identity 수정" : "신규 Enrollment"}</h2>
                <button onClick={() => setIsStudentModalOpen(false)} className="text-slate-300 hover:text-slate-900 p-2"><X size={24}/></button>
              </div>
              <div className="p-12 space-y-8 text-center">
                <input type="text" className="w-full border-slate-100 border-2 p-6 rounded-[2rem] text-xl outline-none focus:border-slate-800 font-black shadow-inner bg-slate-50/50 text-center uppercase italic" value={studentFormData.name} onChange={e => setStudentFormData({ name: e.target.value })} placeholder="Student Name" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveStudent()} />
                <button onClick={handleSaveStudent} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all uppercase italic font-sans">Enroll</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;