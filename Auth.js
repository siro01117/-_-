window.AuthSystem = {
    renderGate: (setIsAuth) => {
        const { useState, useEffect } = React;
        const [input, setInput] = useState("");
        const ACCESS_PW = "R040117!";

        const handleKeyDown = (e) => {
            // 1. 엔터 키: 인가 로직 실행
            if (e.key === 'Enter') {
                if (input === ACCESS_PW) {
                    setIsAuth(true);
                } else {
                    alert("인가 실패: 코드가 일치하지 않습니다.");
                    setInput("");
                }
                return;
            }

            // 2. 백스페이스 키: 데이터 무결성 보장 (제어 문자로 인식 방지)
            if (e.key === 'Backspace') {
                setInput(prev => prev.slice(0, -1));
                return;
            }

            // 3. 입력 필터링: 출력 가능한 일반 문자열만 수용
            if (e.key.length === 1) {
                setInput(prev => prev + e.key);
            }
        };

        useEffect(() => {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [input]);

        return (
            <div className="fixed inset-0 bg-[#1e293b] flex items-center justify-center z-[9999]">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center w-96 animate-in zoom-in duration-300">
                    <div className="mb-6 flex justify-center">
                        <div className="w-16 h-1 bg-slate-100 rounded-full"></div>
                    </div>
                    <h2 className="text-slate-300 font-black tracking-[0.2em] text-[10px] mb-2 uppercase">Security Gate</h2>
                    <h1 className="text-3xl font-black text-slate-800 mb-8 tracking-tighter">접근 코드가 필요합니다</h1>
                    
                    {/* [기능 복원] 시각적 지연 마스킹 구역 */}
                    <div className="flex justify-center gap-2 mb-8 h-8 items-center">
                        {input.split('').map((char, i) => (
                            <div key={i} className="relative flex items-center justify-center w-4 h-4">
                                {i === input.length - 1 ? (
                                    // 마지막 글자는 실제 텍스트로 노출 (다음 글자 입력 시 점으로 변환됨)
                                    <span className="text-blue-600 font-black text-xl animate-in fade-in duration-200">{char}</span>
                                ) : (
                                    // 이전 글자들은 보안 점으로 표시
                                    <div className="w-3 h-3 bg-slate-800 rounded-full"></div>
                                )}
                            </div>
                        ))}
                        {input.length === 0 && <span className="text-slate-200 font-bold tracking-widest text-sm uppercase">Enter Code</span>}
                    </div>

                    <button 
                        onClick={() => input === ACCESS_PW ? setIsAuth(true) : (alert("인가 실패"), setInput(""))}
                        className="w-full bg-[#0f172a] text-white py-5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all uppercase tracking-widest"
                    >
                        ENTER
                    </button>
                    
                    <p className="mt-8 text-[9px] font-bold text-slate-300 uppercase tracking-widest">STUDY CUBE PROTECTED AREA</p>
                </div>
            </div>
        );
    }
};
