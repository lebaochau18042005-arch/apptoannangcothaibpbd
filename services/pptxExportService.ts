import pptxgen from "pptxgenjs";
import { SavedExam } from "../types";
import { parseExamContent, parseAnswersContent } from "../utils/examParser";

const AUTHOR = "Lê Thị Thái - THPT Bình Phú - Bình Dương";

export async function exportExamToPptx(exam: SavedExam) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = AUTHOR;
  pptx.company = "THPT Bình Phú";
  pptx.title = exam.title || "Đề kiểm tra";

  // ===== SLIDE TIÊU ĐỀ =====
  const slideTitle = pptx.addSlide();
  slideTitle.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "1e293b" } });
  slideTitle.addText(AUTHOR, { x: 0.5, y: 0.5, w: 9, h: 0.5, fontSize: 16, color: "94a3b8", align: "left" });
  slideTitle.addText(pptx.title, {
    x: 1, y: 2, w: 8, h: 1.5,
    fontSize: 40, color: "ffffff", bold: true, align: "center",
  });
  slideTitle.addText(`Môn: ${exam.subject || "Khác"} - ${exam.examMode || ""}`, {
    x: 1, y: 3.5, w: 8, h: 1,
    fontSize: 22, color: "94a3b8", align: "center"
  });

  // Thử parse câu hỏi
  const questions = parseExamContent(exam.examContent);
  const answersMap = parseAnswersContent(exam.answersContent);
  questions.forEach(q => {
    if (answersMap[q.number]) q.answerText += '\n' + answersMap[q.number];
  });

  if (questions.length > 0) {
    // ===== SLIDE CÂU HỎI (nếu parse thành công) =====
    questions.forEach((q) => {
      const slideQ = pptx.addSlide();
      slideQ.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "ffffff" } });
      slideQ.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: "0284c7" } });
      slideQ.addText(`Câu ${q.number}`, {
        x: 0.5, y: 0.1, w: 8, h: 0.6,
        color: "ffffff", fontSize: 22, bold: true, align: "left"
      });
      slideQ.addText(AUTHOR, {
        x: 0.5, y: 0.1, w: 9.2, h: 0.6,
        color: "bfdbfe", fontSize: 12, align: "right"
      });

      const qTextHeight = q.options.length > 0 ? 1.8 : 3.8;
      slideQ.addText(q.text.trim().slice(0, 500), {
        x: 0.5, y: 1.0, w: 9, h: qTextHeight,
        color: "1e293b", fontSize: 18, align: "left", valign: "top"
      });

      if (q.options.length > 0) {
        q.options.forEach((opt, optIdx) => {
          const row = Math.floor(optIdx / 2);
          const col = optIdx % 2;
          const yPos = 1.0 + qTextHeight + 0.2 + (row * 0.75);
          const xPos = 0.5 + (col * 4.6);
          slideQ.addText(opt.slice(0, 200), {
            x: xPos, y: yPos, w: 4.4, h: 0.6,
            color: "1e293b", fontSize: 16, bold: true,
            fill: { color: "f1f5f9" }
          });
        });
      }

      if (q.answerText && q.answerText.trim()) {
        const slideA = pptx.addSlide();
        slideA.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "f8fafc" } });
        slideA.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.8, fill: { color: "059669" } });
        slideA.addText(`Giải thích - Câu ${q.number}`, {
          x: 0.5, y: 0.1, w: 8, h: 0.6,
          color: "ffffff", fontSize: 22, bold: true, align: "left"
        });
        slideA.addText(q.answerText.trim().slice(0, 800), {
          x: 0.5, y: 1.0, w: 9, h: 4,
          color: "1e293b", fontSize: 16, align: "left", valign: "top"
        });
      }
    });
  } else {
    // ===== FALLBACK: Chia toàn bộ đề thi thành các slide văn bản =====
    const CHARS_PER_SLIDE = 900;
    const rawText = exam.examContent || "";
    const chunks: string[] = [];

    // Chia theo dòng để không cắt giữa câu
    let currentChunk = "";
    for (const line of rawText.split('\n')) {
      if ((currentChunk + line).length > CHARS_PER_SLIDE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    chunks.forEach((chunk, idx) => {
      const slide = pptx.addSlide();
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "ffffff" } });
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.7, fill: { color: "0f172a" } });
      slide.addText(`${exam.subject || "Đề thi"} — Trang ${idx + 1}/${chunks.length}`, {
        x: 0.5, y: 0.08, w: 8.5, h: 0.55,
        color: "e2e8f0", fontSize: 16, bold: true, align: "left"
      });
      slide.addText(chunk, {
        x: 0.4, y: 0.85, w: 9.2, h: 5.9,
        color: "1e293b", fontSize: 15, align: "left", valign: "top",
        fontFace: "Arial"
      });
    });

    // Slide đáp án nếu có
    if (exam.answersContent && exam.answersContent.trim()) {
      const ansChunks: string[] = [];
      let ansChunk = "";
      for (const line of exam.answersContent.split('\n')) {
        if ((ansChunk + line).length > CHARS_PER_SLIDE && ansChunk.length > 0) {
          ansChunks.push(ansChunk.trim());
          ansChunk = line + '\n';
        } else {
          ansChunk += line + '\n';
        }
      }
      if (ansChunk.trim()) ansChunks.push(ansChunk.trim());

      ansChunks.forEach((chunk, idx) => {
        const slide = pptx.addSlide();
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "f0fdf4" } });
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 0.7, fill: { color: "065f46" } });
        slide.addText(`ĐÁP ÁN & LỜI GIẢI — Trang ${idx + 1}/${ansChunks.length}`, {
          x: 0.5, y: 0.08, w: 8.5, h: 0.55,
          color: "ecfdf5", fontSize: 16, bold: true, align: "left"
        });
        slide.addText(chunk, {
          x: 0.4, y: 0.85, w: 9.2, h: 5.9,
          color: "14532d", fontSize: 15, align: "left", valign: "top",
          fontFace: "Arial"
        });
      });
    }
  }

  // ===== XUẤT FILE =====
  try {
    const filename = `${(exam.title || "de_thi").replace(/\s+/g, '_')}_${Date.now()}.pptx`;
    await pptx.writeFile({ fileName: filename });
  } catch (error) {
    console.error("Lỗi khi xuất file PPTX:", error);
    alert("Không thể xuất file PowerPoint lúc này. Vui lòng thử lại!");
  }
}
