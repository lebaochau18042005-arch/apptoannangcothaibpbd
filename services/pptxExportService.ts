import pptxgen from "pptxgenjs";
import { SavedExam } from "../types";
import { parseExamContent, parseAnswersContent } from "../utils/examParser";

export async function exportExamToPptx(exam: SavedExam) {
  // 1. Phân tích nội dung đề thi
  const questions = parseExamContent(exam.examContent);
  const answersMap = parseAnswersContent(exam.answersContent);

  // Gộp lời giải từ answersContent sang những câu hỏi chưa có lời giải
  questions.forEach(q => {
      if (answersMap[q.number]) {
          q.answerText += '\n' + answersMap[q.number];
      }
  });

  // 2. Khởi tạo PPTX
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Lê Thị Thái - THPT Bình Phú - Bình Dương";
  pptx.company = "EDUGENVN";
  pptx.title = exam.title || "Đề kiểm tra EduGenVN";

  // ===== SLIDE TIÊU ĐỀ =====
  const slideTitle = pptx.addSlide();
  slideTitle.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "1e293b" } }); // Nền tối dark theme
  slideTitle.addText("EduGenVN - Đề Thi", { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 18, color: "cbd5e1", align: "left" });
  slideTitle.addText(pptx.title, { 
    x: 1, y: 2, w: 8, h: 1.5,
    fontSize: 44, color: "ffffff", bold: true, align: "center",
  });
  slideTitle.addText(`Môn: ${exam.subject || "Khác"} - Lớp: ${exam.difficulty}`, {
    x: 1, y: 3.5, w: 8, h: 1,
    fontSize: 24, color: "94a3b8", align: "center"
  });

  // ===== CÁC SLIDE CÂU HỎI =====
  questions.forEach((q, idx) => {
    // 1. Slide Câu hỏi
    const slideQ = pptx.addSlide();
    slideQ.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "ffffff" } });
    slideQ.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: "0284c7" } });
    
    // Header Câu X
    slideQ.addText(`Câu ${q.number}`, { 
        x: 0.5, y: 0.1, w: 9, h: 0.6, 
        color: "ffffff", fontSize: 24, bold: true, align: "left"
    });

    // Nội dung câu hỏi
    const qTextHeight = q.options.length > 0 ? 2 : 4;
    slideQ.addText(q.text.trim(), {
        x: 0.5, y: 1.0, w: 9, h: qTextHeight,
        color: "1e293b", fontSize: 20, align: "left", valign: "top"
    });

    // Các lựa chọn (nếu có)
    if (q.options.length > 0) {
        // Xếp theo dạng dải 2 cột (hoặc 1 cột nếu text quá dài)
        // Đảo bảo options ko bị lấn
        q.options.forEach((opt, optIdx) => {
            const row = Math.floor(optIdx / 2);
            const col = optIdx % 2;
            const yPos = 1.0 + qTextHeight + 0.3 + (row * 0.8);
            const xPos = 0.5 + (col * 4.6);
            
            slideQ.addText(opt, {
                x: xPos, y: yPos, w: 4.4, h: 0.6,
                color: "1e293b", fontSize: 18, bold: true,
                fill: { color: "f1f5f9" }
            });
        });
    }

    // 2. Slide Đáp án cho Câu X
    if (q.answerText && q.answerText.trim()) {
        const slideA = pptx.addSlide();
        slideA.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "f8fafc" } });
        slideA.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: "059669" } }); // Header xanh lá cây cho lời giải
        
        slideA.addText(`Giải thích - Câu ${q.number}`, { 
            x: 0.5, y: 0.1, w: 9, h: 0.6, 
            color: "ffffff", fontSize: 24, bold: true, align: "left"
        });

        slideA.addText(q.answerText.trim(), {
            x: 0.5, y: 1.0, w: 9, h: 4,
            color: "1e293b", fontSize: 18, align: "left", valign: "top"
        });
    }
  });

  // ===== XUẤT FILE =====
  try {
    const filename = `${exam.title || "export"}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: filename });
  } catch (error) {
    console.error("Lỗi khi xuất file PPTX:", error);
    alert("Không thể xuất file PowerPoint lúc này. Vui lòng thử lại!");
  }
}
