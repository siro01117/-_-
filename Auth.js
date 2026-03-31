window.AuthSystem = {
    renderGate: (setIsAuth) => {
        const { useState, useEffect } = React;
        const [input, setInput] = useState("");
        const ACCESS_PW = "R040117!"; // 설정하신 비밀번호

        const handleKeyDown = (e) => {
            // 1. 엔터 키: 검증 실행
            if (e.key === 'Enter') {
                if (input === ACCESS_PW) {
                    setIsAuth(true);
                } else {
                    alert("인가 실패: 코드가 일치하지 않습니다.");
                    setInput("");
                }
                return;
            }

            // 2. 백스페이스 키: 마지막 글자 삭제
            if (e.key === 'Backspace') {
                setInput(prev => prev.slice(0, -1));
                return;
            }

            // 3. [핵심 교정] 입력 필터링
            // e.key의 길이가 1인 것만 허용 (Shift, Control, Alt, Tab 등 제어 문자 제외)
            // 정규표현식을 사용해 '출력 가능한 문자'만 입력값으로 수용
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
                    
                    {/* 시각적 피드백 구역 (입력된 글자 수만큼 점 표시) */}
                    <div className="flex justify-center gap-2 mb-8 h-4">
                        {input.split('').map((_, i) => (
                            <div key={i} className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
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
