// Export.js: 고해상도 A4 출력 연산 모듈
window.ExportSystem = {
    // [시스템 상수: A4 150DPI 규격]
    A4_WIDTH: 1240,
    A4_HEIGHT: 1754,

    /**
     * @param {HTMLElement} element - 캡처 대상 (captureRef.current)
     * @param {string} studentName - 파일명에 사용될 학생 이름
     * @param {string} type - 'png' 또는 'pdf'
     */
    generate: async (element, studentName, type = 'png') => {
        if (!element) {
            console.error("Core Error: Capture target is undefined.");
            return;
        }

        // 1. 폰트 엔진 동기화 (텍스트 누락 방지)
        await document.fonts.ready;

        // 2. 가상 렌더링 연산 (html2canvas)
        const canvas = await html2canvas(element, {
            scale: 2,           // 해상도 밀도 배율
            useCORS: true,      // 외부 리소스 허용
            logging: false,     // 콘솔 정숙성 유지
            width: window.ExportSystem.A4_WIDTH,
            windowWidth: window.ExportSystem.A4_WIDTH,
            onclone: (clonedDoc) => {
                // 가상 DOM에서 A4 레이아웃 강제 교정
                const area = clonedDoc.querySelector('.export-area');
                if (area) {
                    area.style.width = `${window.ExportSystem.A4_WIDTH}px`;
                    area.style.minHeight = `${window.ExportSystem.A4_HEIGHT}px`;
                    area.style.height = 'auto';
                    area.style.margin = '0';
                    area.style.padding = '80px';
                    area.style.display = 'block';
                    
                    // 출력 시 불필요한 스크롤바 및 그림자 제거
                    area.style.boxShadow = 'none';
                    area.style.overflow = 'visible';
                }
            }
        });

        // 3. 이미지 데이터 추출
        const imgData = canvas.toDataURL('image/png', 1.0);

        // 4. 포맷별 출력 연산 실행
        if (type === 'png') {
            // [PNG 다운로드 프로토콜]
            const link = document.createElement('a');
            link.download = `[STUDYCUBE]_${studentName}_Report.png`;
            link.href = imgData;
            link.click();
        } else if (type === 'pdf') {
            // [PDF 벡터 변환 엔진: jsPDF]
            const { jsPDF } = window.jspdf;
            
            // 'p' (세로), 'pt' (포인트), 'a4' (표준규격)
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // 연산된 이미지를 A4 용지 크기에 정밀하게 피팅
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`[STUDYCUBE]_${studentName}_Report.pdf`);
        }
    }
};
