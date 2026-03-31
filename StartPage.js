// [시작 레이어: 디자인 및 진입 로직 응집]
const StartPage = ({ onStart }) => {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-between text-white font-black overflow-hidden relative">
            
            {/* 1단계: 상단 다크 영역 (image_0.png 상단부 반영) */}
            <div className="flex-1 w-full flex items-center justify-center p-20 gap-16 relative" style={{ backgroundColor: '#1E1E22' }}>
                
                {/* 2단계: 중앙 도형 덩어리 배치 (기하학적 수치 모사) */}
                
                {/* 좌측 박스 (Dummy Item 1) */}
                <div className="w-[180px] h-[180px] rounded-[3rem] bg-white opacity-90 shadow-2xl transition-all hover:scale-105" />
                
                {/* 중앙 박스: 실제 시스템 진입 트리거 (핵심 연결고리) */}
                <button 
                    onClick={onStart}
                    className="w-[300px] h-[300px] rounded-[5rem] bg-white text-[#1E1E22] flex items-center justify-center shadow-3xl shadow-blue-500/30 transition-all hover:scale-105 active:scale-95 hover:z-10 relative group"
                >
                    {/* [인지적 평형] 디자인은 깔끔하게 유지하되, 기능의 이름(START)만 미니멀하게 주입 */}
                    <span className="text-[2.5rem] uppercase tracking-[-0.1em] leading-none transform -translate-y-1">START</span>
                    
                    {/* Hover 효과: 시스템 활성화 신호 시각화 */}
                    <div className="absolute inset-0 rounded-[5rem] bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[2.5rem]">
                        STUDY<br/>CUBE
                    </div>
                </button>
                
                {/* 우측 박스 (Dummy Item 2) */}
                <div className="w-[180px] h-[180px] rounded-[3rem] bg-white opacity-90 shadow-2xl transition-all hover:scale-105" />
                
            </div>

            {/* 3단계: 하단 화이트 영역 (image_0.png 하단부 반영) */}
            <div className="w-full h-40 bg-white flex items-center justify-between px-16 border-t border-slate-100 relative shadow-inner z-20">
                <h1 className="text-4xl italic uppercase tracking-tighter text-[#1E1E22]">Study Cube</h1>
                <p className="text-slate-400 text-lg uppercase tracking-widest leading-none">Management System v2.0</p>
            </div>
            
        </div>
    );
};