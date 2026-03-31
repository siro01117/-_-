const { useState, useMemo, useEffect, useRef } = React;

// [1. 시스템 인프라 설정]
const SUPABASE_URL = 'https://ovnabmmofgujgefuamzn.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY_HERE'; // 본인의 Supabase ANON KEY 입력
const _db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const START_HOUR = 7;
const END_HOUR = 24;
const SLOT_HEIGHT = 100; // A4 규격 연산 기준 (1시간 = 100px)
const DEFAULT_COLORS = ['#E59A9A', '#E5B981', '#DEE08C', '#A8D99C', '#8CCEDB', '#89AED9', '#A59BD9', '#D9A9D9', '#C2CDC9'];

const App = () => {
    const captureRef = useRef(null);
    const [isAuth, setIsAuth] = useState(false); 
    const [students, setStudents] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    
    // 모달 및 데이터 폼 상태
    const [studentModal, setStudentModal] = useState({ open: false, editId: null, name: '' });
    const [scheduleModal, setScheduleModal] = useState({ open: false, editId: null });
    const [sForm, setSForm] = useState({ title: '', days: [], startH: '09', startM: '00', endH: '10', endM: '00', color: DEFAULT_COLORS[0] });

    // [2. 데이터 연산: 클라우드 동기화]
    useEffect(() => { if (isAuth) fetchStudents(); }, [isAuth]);

    const fetchStudents = async () => {
        const { data } = await _db.from('schedules').select('*').order('updated_at', { ascending: false });
        if (data) {
            setStudents(data.map(s => ({
                id: s.id, name: s.student_name, 
                schedules: s.data?.schedules || [], isDeleted: s.data?.isDeleted || false
            })));
        }
    };

    const syncToCloud = async (target) => {
        await _db.from('schedules').upsert({
            id: target.id, student_name: target.name,
            data: { schedules: target.schedules, isDeleted: target.isDeleted },
            updated_at: new Date()
        });
    };

    // [3. 핵심 연산: 일정 좌표 및 높이 계산]
    const calculateRect = (s) => {
        const startMin = (parseInt(s.startH) * 60 + parseInt(s.startM)) - (START_HOUR * 60);
        const durMin = (parseInt(s.endH) * 60 + parseInt(s.endM)) - (parseInt(s.startH) * 60 + parseInt(s.startM));
        const topPos = (startMin / 60) * SLOT_HEIGHT;
        const heightVal = (durMin / 60) * SLOT_HEIGHT;
        return { top: `${topPos}px`, height: `${heightVal}px`, backgroundColor: s.color };
    };

    // [4. 비즈니스 로직: 학생 및 일정 저장]
    const handleSaveStudent = async () => {
        if (!studentModal.name.trim()) return;
        const newStudent = { id: studentModal.editId || Date.now(), name: studentModal.name, schedules: current?.schedules || [], isDeleted: false };
        setStudents(prev => [newStudent, ...prev.filter(x => x.id !== newStudent.id)]);
        await syncToCloud(newStudent);
        setStudentModal({ open: false, editId: null, name: '' });
        setSelectedId(newStudent.id);
    };

    const handleSaveSchedule = async () => {
        if (!sForm.title || sForm.days.length === 0) return;
        const newSchedule = { ...sForm, id: scheduleModal.editId || Date.now() };
        const updatedSchedules = scheduleModal.editId 
            ? current.schedules.map(s => s.id === scheduleModal.editId ? newSchedule : s)
            : [...current.schedules, newSchedule];

        const updatedStudent = { ...current, schedules: updatedSchedules };
        setStudents(prev => prev.map(s => s.id === selectedId ? updatedStudent : s));
        await syncToCloud(updatedStudent);
        setScheduleModal({ open: false, editId: null });
    };

    const current = useMemo(() => students.find(s => s.id === selectedId), [students, selectedId]);

    // [보안 게이트웨이 호출]
    if (!isAuth) return window.AuthSystem.renderGate(setIsAuth);

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
            {/* 사이드바: 학생 리스트 */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-30 shadow-md no-print">
                <div className="p-8 border-b border-slate-100">
                    <h1 className="text-2xl font-black italic tracking-tighter uppercase mb-8 text-center text-slate-800">Study Cube</h1>
                    <button onClick={() => setStudentModal({ open: true, editId: null, name: '' })} className="w-full bg-blue-600 py-5 rounded-[2rem] font-black text-white shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                        <lucide.icons.UserPlus size={24} /> 학생 추가
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {students.map(s => (
                        <div key={s.id} onClick={() => setSelectedId(s.id)} className={`p-6 rounded-2xl cursor-pointer border-2 transition-all ${selectedId === s.id ? 'bg-blue-50 border-blue-400 shadow-md' : 'bg-white border-transparent hover:border-slate-100'}`}>
                            <span className="font-black text-xl text-slate-700 truncate">{s.name}</span>
                        </div>
                    ))}
                </div>
            </aside>

            {/* 메인 시스템 대시보드 */}
            <main className="flex-1 flex flex-col relative bg-white overflow-hidden">
                {current ? (
                    <>
                        <header className="h-24 border-b border-slate-100 flex items-center justify-between px-10 bg-white z-10 shadow-sm no-print">
                            <h2 className="text-2xl font-black italic uppercase tracking-tight text-slate-800">{current.name} : SYSTEM</h2>
                            <div className="flex items-center gap-4">
                                <button onClick={() => window.ExportSystem.generate(captureRef.current, current.name, 'png')} className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black shadow-lg">PNG</button>
                                <button onClick={() => window.ExportSystem.generate(captureRef.current, current.name, 'pdf')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg">PDF</button>
                                <button onClick={() => setIsEditMode(!isEditMode)} className={`px-8 py-3 rounded-xl font-black shadow-xl transition-all ${isEditMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                    {isEditMode ? '저장 종료' : '일정 편집'}
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-auto bg-slate-50/50 p-12 custom-scrollbar">
                            <div ref={captureRef} className="export-area mx-auto shadow-2xl rounded-[4rem]">
                                <div className="mb-14 border-b-4 border-slate-900 pb-10 flex justify-between items-end">
                                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">{current.name} 주간 계획표</h1>
                                    <span className="text-slate-300 font-black text-xl tracking-[0.4em] uppercase">STUDY CUBE</span>
                                </div>

                                <div className="flex gap-10">
                                    <div className="flex-1 grid-layout border-4 border-slate-900 rounded-[3rem] overflow-hidden bg-white relative">
                                        <div className="bg-slate-50/50 border-r-4 border-slate-900 flex flex-col text-center">
                                            <div className="h-20 border-b-4 border-slate-900 flex items-center justify-center text-[12px] font-black italic text-slate-300 uppercase">TIME</div>
                                            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                                                <div key={i} className="time-slot text-2xl font-black text-slate-200">{(START_HOUR + i).toString().padStart(2, '0')}</div>
                                            ))}
                                        </div>
                                        {DAYS.map(day => (
                                            <div key={day} className="flex flex-col relative border-r-2 last:border-r-0 border-slate-100">
                                                <div className="h-20 border-b-4 border-slate-900 flex items-center justify-center text-2xl font-black text-slate-900">{day}</div>
                                                <div className="flex-1 relative bg-white/30">
                                                    {current.schedules.filter(s => s.days.includes(day)).map(s => (
                                                        <div key={s.id} onClick={() => isEditMode && setScheduleModal({ open: true, editId: s.id })}
                                                            className="absolute left-1 right-1 rounded-2xl p-4 shadow-xl border-2 border-black/5 flex flex-col overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
                                                            style={calculateRect(s)}>
                                                            <span className="font-black text-[15px] uppercase leading-tight text-slate-900 truncate">{s.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isEditMode && (
                            <button onClick={() => { setSForm({title:'', days:[], startH:'09', startM:'00', endH:'10', endM:'00', color:DEFAULT_COLORS[0]}); setScheduleModal({ open: true, editId: null }); }} 
                                className="absolute bottom-12 right-12 w-24 h-24 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-20 hover:rotate-90">
                                <lucide.icons.Plus size={48} />
                            </button>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
                        <lucide.icons.Layout size={150} strokeWidth={1} className="mb-10 opacity-10" />
                        <p className="text-4xl font-black uppercase italic tracking-[0.5em] opacity-20">Select Identity</p>
                    </div>
                )}
            </main>

            {/* [A4 시스템 모달: 학생 추가] */}
            {studentModal.open && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-[500] p-6 modal-animate">
                    <div className="bg-white p-16 rounded-[4rem] w-full max-w-lg shadow-2xl text-center">
                        <h3 className="text-4xl font-black mb-10 italic uppercase text-slate-800">New Identity</h3>
                        <input type="text" autoFocus value={studentModal.name} onChange={(e) => setStudentModal({...studentModal, name: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && handleSaveStudent()} placeholder="이름 입력"
                            className="w-full border-4 border-slate-50 p-8 rounded-[2rem] text-center text-4xl font-black mb-10 bg-slate-50 outline-none focus:border-blue-500 transition-all" />
                        <div className="flex gap-6">
                            <button onClick={() => setStudentModal({ open: false, editId: null, name: '' })} className="flex-1 py-8 font-black text-slate-300 uppercase tracking-widest">CANCEL</button>
                            <button onClick={handleSaveStudent} className="flex-[2] py-8 bg-slate-900 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl">확정</button>
                        </div>
                    </div>
                </div>
            )}

            {/* [A4 시스템 모달: 일정 추가] */}
            {scheduleModal.open && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center z-[600] p-6 modal-animate">
                    <div className="bg-white p-16 rounded-[4rem] w-full max-w-4xl shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-4" style={{ backgroundColor: sForm.color }}></div>
                        <h3 className="text-3xl font-black mb-12 italic uppercase text-slate-800 tracking-tighter">{scheduleModal.editId ? 'Edit Schedule' : 'New Schedule'}</h3>
                        <div className="space-y-10">
                            <input type="text" placeholder="일정 제목" value={sForm.title} onChange={e => setSForm({...sForm, title: e.target.value})}
                                className="w-full border-b-8 border-slate-100 p-6 text-5xl font-black outline-none focus:border-blue-500 transition-all" />
                            <div className="flex gap-3">
                                {DAYS.map(day => (
                                    <button key={day} onClick={() => {
                                        const next = sForm.days.includes(day) ? sForm.days.filter(d => d !== day) : [...sForm.days, day];
                                        setSForm({...sForm, days: next});
                                    }} className={`flex-1 py-6 rounded-2xl font-black text-2xl transition-all ${sForm.days.includes(day) ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-300'}`}>{day}</button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-4 text-center">
                                    <label className="text-sm font-black text-slate-300 uppercase">Start Time</label>
                                    <div className="flex gap-2"><input type="number" value={sForm.startH} onChange={e => setSForm({...sForm, startH: e.target.value})} className="w-full bg-slate-50 p-6 rounded-2xl text-4xl font-black text-center" /><input type="number" value={sForm.startM} onChange={e => setSForm({...sForm, startM: e.target.value})} className="w-full bg-slate-50 p-6 rounded-2xl text-4xl font-black text-center" /></div>
                                </div>
                                <div className="space-y-4 text-center">
                                    <label className="text-sm font-black text-slate-300 uppercase">End Time</label>
                                    <div className="flex gap-2"><input type="number" value={sForm.endH} onChange={e => setSForm({...sForm, endH: e.target.value})} className="w-full bg-slate-50 p-6 rounded-2xl text-4xl font-black text-center" /><input type="number" value={sForm.endM} onChange={e => setSForm({...sForm, endM: e.target.value})} className="w-full bg-slate-50 p-6 rounded-2xl text-4xl font-black text-center" /></div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 p-8 rounded-[2.5rem]">
                                <span className="font-black text-slate-400 uppercase tracking-widest text-sm">Theme Color</span>
                                <div className="flex gap-4">
                                    {DEFAULT_COLORS.map(c => (
                                        <div key={c} onClick={() => setSForm({...sForm, color: c})} className={`w-12 h-12 rounded-full cursor-pointer transition-all ${sForm.color === c ? 'ring-4 ring-slate-900 ring-offset-4 scale-125' : ''}`} style={{ backgroundColor: c }}></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-6 mt-16">
                            <button onClick={() => setScheduleModal({ open: false, editId: null })} className="flex-1 py-8 font-black text-slate-300 uppercase tracking-widest text-xl">CANCEL</button>
                            <button onClick={handleSaveSchedule} className="flex-[2] py-8 bg-blue-600 text-white rounded-[2.5rem] font-black text-3xl shadow-2xl active:scale-95 transition-all">CONFIRM</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
