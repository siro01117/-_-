const { useState, useMemo, useEffect, useRef } = React;

// [1. 시스템 환경 설정 및 상수]
const SUPABASE_URL = 'https://ovnabmmofgujgefuamzn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Sr-c62OzsZHne3xYwFuymw_qCz3fhy9'; 

const START_HOUR = 7;
const END_HOUR = 24;
const SLOT_HEIGHT = 80;
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const DEFAULT_TAGS = ['자습', '인강', '외부 학원', '수업', '상담'];
const DEFAULT_COLORS = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#dfe6e9'];

const App = () => {
    // [2. 시스템 상태 엔티티]
    const [dbClient, setDbClient] = useState(null);
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [trashMode, setTrashMode] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    
    // [3. UI 및 필터링 상태 (H 구역)]
    const [filterTitle, setFilterTitle] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [customTags, setCustomTags] = useState(DEFAULT_TAGS);
    const [customColors, setCustomColors] = useState(DEFAULT_COLORS);
    const [dragItem, setDragItem] = useState(null);

    const [studentModal, setStudentModal] = useState({ open: false, id: null, name: '' });
    const [scheduleModal, setScheduleModal] = useState({ open: false, id: null });
    const [detailModal, setDetailModal] = useState({ open: false, item: null });
    
    const [sForm, setSForm] = useState({ 
        title: '', days: [], startH: '09', startM: '00', endH: '10', endM: '00', 
        tags: [], color: DEFAULT_COLORS[0], memo: '' 
    });
    
    const captureRef = useRef(null);

    // [4. 실시간 서버 엔진 (Supabase)]
    useEffect(() => {
        if (window.supabase) {
            const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            setDbClient(client);
            // 초기 데이터 로드
            client.from('schedules').select('*').then(({ data, error }) => {
                if (data) setStudents(data.map(row => ({
                    id: row.id, 
                    name: row.student_name, 
                    schedules: row.data?.schedules || [], 
                    isDeleted: row.data?.isDeleted || false
                })));
                setIsLoading(false);
            });
        }
    }, []);

    const syncToDB = async (updatedStudents, targetStudent) => {
        setStudents(updatedStudents);
        if (dbClient && targetStudent) {
            await dbClient.from('schedules').upsert({
                id: targetStudent.id, 
                student_name: targetStudent.name,
                data: { schedules: targetStudent.schedules, isDeleted: targetStudent.isDeleted },
                updated_at: new Date()
            });
        }
    };

    // [5. 핵심 연산: 필터링 및 피드백 통계 (F, H 구역)]
    const current = useMemo(() => students.find(s => s.id === selectedId) || null, [students, selectedId]);
    
    const { filteredSchedules, stats } = useMemo(() => {
        if (!current) return { filteredSchedules: [], stats: { total: 0, avg: 0 } };
        
        // H 구역: 검색어 및 태그 필터 연동
        const filtered = current.schedules.filter(s => 
            (s.title || "").toLowerCase().includes(filterTitle.toLowerCase()) && 
            (filterTag === '' || (s.tags && s.tags.includes(filterTag)))
        );

        let totalMin = 0;
        filtered.forEach(s => {
            const duration = (parseInt(s.endH)*60 + parseInt(s.endM)) - (parseInt(s.startH)*60 + parseInt(s.startM));
            totalMin += duration * (s.days ? s.days.length : 0);
        });

        return { filteredSchedules: filtered, stats: { total: totalMin, avg: Math.floor(totalMin / 7) } };
    }, [current, filterTitle, filterTag]);

    const formatMinToTime = (min) => `${Math.floor(min/60).toString().padStart(2,'0')}h ${(min%60).toString().padStart(2,'0')}m`;
    
    const getRect = (s) => ({
        top: `${((parseInt(s.startH)*60 + parseInt(s.startM)) - (START_HOUR * 60)) / 60 * SLOT_HEIGHT}px`,
        height: `${((parseInt(s.endH)*60 + parseInt(s.endM)) - (parseInt(s.startH)*60 + parseInt(s.startM))) / 60 * SLOT_HEIGHT}px`,
        backgroundColor: s.color
    });

    // [6. 시스템 액션 메서드]
    const saveStudent = () => {
        if (!studentModal.name.trim()) return;
        const newOrUpdated = studentModal.id 
            ? { ...students.find(s => s.id === studentModal.id), name: studentModal.name }
            : { id: Date.now(), name: studentModal.name, schedules: [], isDeleted: false };
        
        const nextStudents = studentModal.id 
            ? students.map(s => s.id === studentModal.id ? newOrUpdated : s)
            : [...students, newOrUpdated];

        syncToDB(nextStudents, newOrUpdated);
        setStudentModal({ open: false, id: null, name: '' });
    };

    const handleStudentAction = (id, action) => {
        const target = students.find(s => s.id === id);
        if (!target) return;
        if (action === 'hardDelete' && !confirm("영구 삭제하시겠습니까?")) return;

        let updatedStudents;
        if (action === 'hardDelete') {
            updatedStudents = students.filter(s => s.id !== id);
            setStudents(updatedStudents);
            if (dbClient) dbClient.from('schedules').delete().eq('id', id).then();
            if (selectedId === id) setSelectedId(null);
        } else {
            const updatedTarget = { ...target, isDeleted: action === 'delete' };
            updatedStudents = students.map(s => s.id === id ? updatedTarget : s);
            syncToDB(updatedStudents, updatedTarget);
        }
    };

    const saveSchedule = () => {
        if (!sForm.title || !sForm.days.length) return alert('제목과 요일을 지정하십시오.');
        const start = parseInt(sForm.startH)*60 + parseInt(sForm.startM);
        const end = parseInt(sForm.endH)*60 + parseInt(sForm.endM);
        if (end <= start) return alert('시간 설정 오류: 종료 시간이 시작 시간보다 빨라야 합니다.');

        const newSch = { ...sForm, id: scheduleModal.id || Date.now() };
        const updatedSchList = scheduleModal.id 
            ? current.schedules.map(s => s.id === scheduleModal.id ? newSch : s)
            : [...current.schedules, newSch];
            
        const updatedStudent = { ...current, schedules: updatedSchList };
        syncToDB(students.map(s => s.id === selectedId ? updatedStudent : s), updatedStudent);
        setScheduleModal({ open: false, id: null });
    };

    const handleExport = (format) => { 
        if (window.ExportSystem && captureRef.current) {
            window.ExportSystem.generate(captureRef.current, current.name, format); 
        }
    };

    if (isLoading) return <div className="h-screen w-full flex items-center justify-center font-black animate-pulse bg-slate-900 text-white tracking-[0.5em]">SYSTEM LOADING...</div>;

    return (
        <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
            {/* 사이드바: 필터 및 리스트 (F, G, H 구역) */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm no-print">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h1 className="text-xl font-black italic tracking-tighter text-slate-800">STUDY CUBE</h1>
                    <button onClick={() => setTrashMode(!trashMode)} className={`text-[10px] font-black px-3 py-1 rounded-full transition-all ${trashMode ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{trashMode ? 'TRASH' : 'LIST'}</button>
                </div>
                
                {current && !trashMode && (
                    <div className="p-4 border-b border-slate-100 space-y-2">
                        <input type="text" placeholder="제목 검색" value={filterTitle} onChange={e=>setFilterTitle(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                        <select value={filterTag} onChange={e=>setFilterTag(e.target.value)} className="w-full bg-slate-100 p-3 rounded-xl text-xs font-bold outline-none">
                            <option value="">전체 태그</option>
                            {customTags.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="pt-4 border-t border-slate-50">
                            <div className="flex justify-between items-end"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total</span><span className="text-2xl font-black text-blue-600">{formatMinToTime(stats.total)}</span></div>
                            <div className="flex justify-between items-end"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Avg</span><span className="text-lg font-black text-slate-700">{formatMinToTime(stats.avg)}</span></div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {!trashMode && <button onClick={() => setStudentModal({open:true, id:null, name:''})} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 shadow-lg mb-4 active:scale-95 transition-all">NEW IDENTITY</button>}
                    {students.filter(s => s.isDeleted === trashMode).map(s => (
                        <div key={s.id} onClick={() => !trashMode && setSelectedId(s.id)} className={`group p-4 rounded-2xl border-2 flex justify-between items-center cursor-pointer transition-all ${selectedId === s.id ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white hover:bg-slate-50'}`}>
                            <span className="font-bold text-slate-700 truncate mr-2">{s.name}</span>
                            <div className="hidden group-hover:flex gap-1">
                                {trashMode ? (
                                    <button onClick={() => handleStudentAction(s.id, 'restore')} className="p-1 bg-green-50 text-green-600 rounded text-[10px] font-bold">복구</button>
                                ) : (
                                    <button onClick={(e) => { e.stopPropagation(); setStudentModal({open:true, id:s.id, name:s.name}); }} className="p-1 bg-slate-100 text-slate-400 rounded text-[10px] font-bold">수정</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleStudentAction(s.id, trashMode ? 'hardDelete' : 'delete'); }} className="p-1 bg-red-50 text-red-600 rounded text-[10px] font-bold">삭제</button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* 메인 뷰어: 시간표 (A, D, E 구역) */}
            <main className="flex-1 flex flex-col bg-slate-50 relative">
                {current ? (
                    <>
                        <header className="h-20 bg-white border-b px-8 flex items-center justify-between z-10 no-print">
                            <h2 className="text-xl font-black text-slate-800 italic uppercase tracking-tighter">{current.name}'s System</h2>
                            <div className="flex gap-2">
                                {!isEditMode && (
                                    <><button onClick={() => handleExport('png')} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all">PNG</button><button onClick={() => handleExport('pdf')} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all">PDF</button></>
                                )}
                                <button onClick={() => setIsEditMode(!isEditMode)} className={`px-6 py-2 rounded-xl font-black text-xs text-white shadow-md transition-all active:scale-95 ${isEditMode ? 'bg-blue-500' : 'bg-slate-800'}`}>
                                    {isEditMode ? 'DONE' : 'EDIT SYSTEM'}
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-auto p-10 flex justify-center custom-scrollbar">
                            {/* [A4 출력 대상] */}
                            <div ref={captureRef} className="export-area bg-white shadow-2xl relative w-[1100px] min-w-[1100px] h-fit p-16 box-border rounded-[4rem] font-sans">
                                {/* 출력물 상단 통계 (추가 내용 3번) */}
                                <div className="mb-12 flex justify-between items-end border-b-8 border-slate-900 pb-10">
                                    <h1 className="text-6xl font-black uppercase tracking-tighter text-slate-900 italic">{current.name}</h1>
                                    <div className="flex gap-10 text-right">
                                        <div className="flex flex-col"><span className="text-[12px] font-black text-slate-300 uppercase tracking-widest mb-1">Total</span><span className="text-4xl font-black text-blue-600 tabular-nums">{formatMinToTime(stats.total)}</span></div>
                                        <div className="flex flex-col"><span className="text-[12px] font-black text-slate-300 uppercase tracking-widest mb-1">Daily Avg</span><span className="text-4xl font-black text-slate-900 tabular-nums">{formatMinToTime(stats.avg)}</span></div>
                                    </div>
                                </div>

                                <div className="flex border-[6px] border-slate-900 rounded-[3rem] overflow-hidden bg-white shadow-xl">
                                    {/* Y축 시간 (7~24시) */}
                                    <div className="w-24 bg-slate-50 border-r-[6px] border-slate-900 flex flex-col text-center">
                                        <div className="h-16 border-b-[6px] border-slate-900 flex items-center justify-center text-[10px] font-black text-slate-300 italic uppercase">Time</div>
                                        {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                                            <div key={i} className="flex items-center justify-center text-3xl font-black text-slate-100 border-b border-slate-100 relative" style={{height: `${SLOT_HEIGHT}px`}}>
                                                <span className="tabular-nums">{(START_HOUR + i).toString().padStart(2, '0')}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* 요일 그리드 (월~일) */}
                                    {DAYS.map(day => (
                                        <div key={day} className="flex-1 flex flex-col relative border-r-2 border-slate-100 last:border-r-0">
                                            <div className="h-16 border-b-[6px] border-slate-900 flex items-center justify-center font-black text-slate-900 text-2xl italic">{day}</div>
                                            <div className="flex-1 relative bg-white">
                                                {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (<div key={i} className="border-b border-slate-50" style={{height: `${SLOT_HEIGHT}px`}}></div>))}
                                                {/* 필터링된 일정 렌더링 (D구역, 추가 4번) */}
                                                {filteredSchedules.filter(s => s.days && s.days.includes(day)).map(s => {
                                                    const durMin = (parseInt(s.endH) * 60 + parseInt(s.endM)) - (parseInt(s.startH) * 60 + parseInt(s.startM));
                                                    return (
                                                        <div key={s.id} onClick={() => isEditMode ? (setSForm(s), setScheduleModal({open:true, id:s.id})) : setDetailModal({open:true, item:s})}
                                                            className={`absolute left-[4px] right-[4px] p-4 rounded-[1.5rem] shadow-xl border-2 border-black/5 flex flex-col overflow-hidden cursor-pointer transition-all hover:scale-[1.03] hover:z-10 ${isEditMode ? 'ring-4 ring-blue-500 ring-offset-4' : ''}`}
                                                            style={getRect(s)}>
                                                            <span className="font-black text-base text-slate-900 leading-tight truncate uppercase italic">{s.title}</span>
                                                            <span className="text-[10px] font-bold text-black/30 mt-1">{s.startH}:{s.startM}</span>
                                                            {/* 추가 요구사항 4번: 블록 크기에 따른 태그 노출 제어 */}
                                                            {durMin >= 50 && s.tags && s.tags.length > 0 && (
                                                                <div className="mt-auto flex flex-wrap gap-1 overflow-hidden max-h-[40px]">
                                                                    {s.tags.map(t => <span key={t} className="text-[9px] font-black bg-white/50 px-2 py-0.5 rounded-lg text-slate-700">#{t}</span>)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-12 text-center text-[10px] font-black text-slate-200 uppercase tracking-[1em]">Study Cube Engine Management</div>
                            </div>
                        </div>

                        {/* 플로팅 일정 추가 버튼 (B 구역) */}
                        {isEditMode && (
                            <button onClick={() => { setSForm({title:'', days:[], startH:'09', startM:'00', endH:'10', endM:'00', tags:[], color:customColors[0], memo:''}); setScheduleModal({open:true, id:null}); }} 
                                className="absolute bottom-12 right-12 w-20 h-20 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center text-5xl font-light hover:bg-blue-700 hover:rotate-90 transition-all active:scale-90 z-30 shadow-blue-200">+</button>
                        )}
                    </>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-200 font-black text-4xl tracking-[0.5em] uppercase italic opacity-20">Select Identity</div>}
            </main>

            {/* [7. 모달 섹션: 기능 집약 (C 구역)] */}
            {scheduleModal.open && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center z-[500] p-4">
                    <div className="bg-white rounded-[4.5rem] w-[750px] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in duration-300">
                        <div className="h-8 w-full" style={{backgroundColor: sForm.color}}></div>
                        <div className="p-16 space-y-12">
                            <input type="text" placeholder="일정 제목 입력" value={sForm.title} onChange={e=>setSForm({...sForm, title:e.target.value})} className="w-full text-5xl font-black border-b-8 border-slate-100 pb-4 outline-none focus:border-blue-500 transition-all italic tracking-tighter" />
                            
                            {/* 요일 다중 선택 (C-iii) */}
                            <div className="flex gap-2">
                                {DAYS.map(d => (
                                    <button key={d} onClick={() => setSForm({...sForm, days: sForm.days.includes(d) ? sForm.days.filter(x=>x!==d) : [...sForm.days, d]})}
                                            className={`flex-1 py-5 rounded-2xl font-black transition-all ${sForm.days.includes(d) ? 'bg-slate-900 text-white scale-105 shadow-xl' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{d}</button>
                                ))}
                            </div>

                            {/* 태그 & 드래그 삭제 (C-ii) */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tag Selection</span>
                                    <div onDragOver={e=>e.preventDefault()} onDrop={() => { if(dragItem?.type === 'tag') setCustomTags(customTags.filter(t=>t!==dragItem.val)); setDragItem(null); }} className="px-6 py-2 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black border border-red-100 italic">Drop to Trash</div>
                                </div>
                                <div className="flex flex-wrap gap-2 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                    {customTags.map(t => (
                                        <button key={t} draggable onDragStart={()=>setDragItem({type:'tag', val:t})} onClick={() => setSForm({...sForm, tags: sForm.tags.includes(t) ? sForm.tags.filter(x=>x!==t) : [...sForm.tags, t]})}
                                                className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${sForm.tags.includes(t) ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}>#{t}</button>
                                    ))}
                                    <input type="text" placeholder="+ New" onKeyDown={e=>{if(e.key==='Enter'&&e.target.value){setCustomTags([...new Set([...customTags, e.target.value])]); e.target.value='';}}} className="bg-transparent text-xs font-black outline-none w-24 ml-3" />
                                </div>
                            </div>

                            <div className="flex p-8 bg-slate-900 rounded-[3rem] gap-6">
                                <button onClick={()=>setScheduleModal({open:false, id:null})} className="flex-1 py-7 font-black text-slate-500 uppercase tracking-[0.3em]">Cancel</button>
                                <button onClick={saveSchedule} className="flex-[2] py-7 font-black text-white bg-blue-600 rounded-[1.8rem] shadow-2xl active:scale-95 transition-all text-2xl uppercase tracking-tighter italic">Confirm System</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* [8. 기타 모달: 학생등록, 메모팝업 (E-i)] */}
            {detailModal.open && detailModal.item && (
                <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[600] p-4 backdrop-blur-xl animate-in fade-in" onClick={()=>setDetailModal({open:false, item:null})}>
                    <div className="bg-white rounded-[4rem] p-16 max-w-lg w-full shadow-2xl text-center" onClick={e=>e.stopPropagation()}>
                        <h3 className="text-5xl font-black text-slate-900 mb-2 italic tracking-tighter uppercase">{detailModal.item.title}</h3>
                        <p className="text-slate-400 font-bold mb-10 uppercase tracking-widest">{detailModal.item.days.join(', ')} | {detailModal.item.startH}:{detailModal.item.startM} - {detailModal.item.endH}:{detailModal.item.endM}</p>
                        <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 min-h-[200px] text-lg font-bold text-slate-600 whitespace-pre-wrap leading-relaxed shadow-inner italic">
                            {detailModal.item.memo || '작성된 메모가 없습니다.'}
                        </div>
                        <button onClick={()=>setDetailModal({open:false, item:null})} className="mt-12 w-full py-6 bg-slate-900 text-white font-black rounded-3xl text-xl tracking-[0.2em]">CLOSE</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
