// Export.js
window.ExportSystem = {
    generate: async (element, studentName, type = 'png') => {
        if (!element) return;
        await document.fonts.ready;

        const canvas = await html2canvas(element, {
            scale: 3,
            useCORS: true,
            width: 1700,
            windowWidth: 1700,
            onclone: (cloned) => { cloned.querySelector('.export-area').style.height = 'auto'; }
        });

        const imgData = canvas.toDataURL('image/png', 1.0);

        if (type === 'png') {
            const link = document.createElement('a');
            link.download = `${studentName}_STUDYCUBE.png`;
            link.href = imgData;
            link.click();
        } else {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('l', 'px', [canvas.width, canvas.height]);
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${studentName}_STUDYCUBE.pdf`);
        }
    }
};
