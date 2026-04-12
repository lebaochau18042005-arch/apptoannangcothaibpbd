import { SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION_GENERAL, STRUCTURE_VAO_10, STRUCTURE_VAO_10_TRACNGHIEM, STRUCTURE_TOT_NGHIEP, FALLBACK_ORDER, getSubjectConfig } from '../constants';
import { ExamRequest, ExamMode, ExamFormat, AIModelId, UploadedFile, QuestionSource, BankQuestion } from '../types';

// ============================================
// HÀM GỌI API CHUNG (có fallback)
// ============================================
async function callGeminiWithFallback(
  apiKey: string,
  selectedModel: AIModelId,
  parts: any[],
  systemInstruction: string,
  onStatus?: (msg: string) => void,
): Promise<string> {
  if (!apiKey) {
    throw new Error('Vui lòng nhập API Key để sử dụng.');
  }
  if (/[^\x00-\x7F]/.test(apiKey)) {
    throw new Error('API Key không hợp lệ (chứa ký tự tiếng Việt). Vui lòng xóa và nhập lại.');
  }

  const modelsToTry = [selectedModel, ...FALLBACK_ORDER.filter(m => m !== selectedModel)];
  const uniqueModels = [...new Set(modelsToTry)];
  let lastError: any = null;

  for (let i = 0; i < uniqueModels.length; i++) {
    const modelId = uniqueModels[i];

    try {
      if (onStatus) {
        onStatus(i > 0
          ? `Model ${uniqueModels[i - 1]} lỗi, đang thử ${modelId}...`
          : `Đang xử lý với ${modelId}...`
        );
      }

      console.log(`[GeminiService] Thử model: ${modelId}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 30000,
            },
          }),
        },
      );

      if (response.status === 429) {
        console.warn(`[GeminiService] Model ${modelId} rate limited (429)`);
        lastError = new Error(`Rate limit (429) — ${modelId}`);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[GeminiService] API Error ${response.status}:`, errText);
        lastError = new Error(`API Error ${response.status}: ${errText.substring(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.warn(`[GeminiService] Model ${modelId} trả về rỗng`);
        lastError = new Error('API trả về nội dung rỗng');
        continue;
      }

      console.log(`[GeminiService] Thành công với ${modelId}`);
      return text;

    } catch (error: any) {
      console.warn(`[GeminiService] Model ${modelId} failed:`, error);
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error('Không thể xử lý với bất kỳ model nào. Vui lòng kiểm tra API Key hoặc thử lại sau.');
}

// ============================================
// BƯỚC 1: TẠO ĐỀ BÀI (KHÔNG CÓ ĐÁP ÁN)
// ============================================
export const generateExamOnly = async (
  request: ExamRequest,
  apiKey: string,
  onStatus?: (msg: string) => void,
  bankQuestions?: BankQuestion[],
): Promise<string> => {
  const subject = request.subject || 'Toán';
  const isMath = subject === 'Toán';
  const isVao10 = request.examMode === ExamMode.Vao10;
  const isTracNghiem = request.examFormat === ExamFormat.TracNghiem;

  // Lấy config theo môn học (instruction + cấu trúc đề)
  const subjectConfig = getSubjectConfig(subject);
  const sysInstruction = subjectConfig.systemInstruction;

  // Xác định label & cấu trúc
  let examLabel: string;
  let structureGuide: string;
  let timeLimit: string;

  if (isMath) {
    // Toán: dùng cấu trúc chi tiết đã có
    if (isVao10) {
      if (isTracNghiem) {
        examLabel = 'TUYỂN SINH VÀO LỚP 10 (Trắc nghiệm)';
        structureGuide = STRUCTURE_VAO_10_TRACNGHIEM;
        timeLimit = '90';
      } else {
        examLabel = 'TUYỂN SINH VÀO LỚP 10 (Tự luận)';
        structureGuide = STRUCTURE_VAO_10;
        timeLimit = '120';
      }
    } else {
      examLabel = 'TỐT NGHIỆP THPT';
      structureGuide = STRUCTURE_TOT_NGHIEP;
      timeLimit = '90';
    }
  } else if (subjectConfig.structureTotNghiep) {
    // Môn có cấu trúc riêng (Lý, Hóa, Sử, Địa)
    const modeLabel = isVao10 ? 'TUYỂN SINH VÀO LỚP 10' : 'TỐT NGHIỆP THPT';
    examLabel = modeLabel;
    if (isVao10) {
      timeLimit = '60-120';
      structureGuide = subjectConfig.structureVao10 || `CẤU TRÚC ĐỀ THI MÔN ${subject.toUpperCase()} — ${modeLabel}: Tạo đề theo cấu trúc chuẩn Bộ GD&ĐT. Phân bố: Nhận biết → Thông hiểu → Vận dụng → Vận dụng cao.`;
    } else {
      timeLimit = '50';
      structureGuide = subjectConfig.structureTotNghiep;
    }
  } else {
    // Các môn khác: cấu trúc linh hoạt
    const modeLabel = isVao10 ? 'TUYỂN SINH VÀO LỚP 10' : 'TỐT NGHIỆP THPT';
    examLabel = modeLabel;
    timeLimit = isVao10 ? '60-120' : '50-90';
    structureGuide = `
CẤU TRÚC ĐỀ THI MÔN ${subject.toUpperCase()} — KỲ THI ${modeLabel}:
- HÃY PHÂN TÍCH CẤU TRÚC TỪ ĐỀ MẪU (nếu có) để xác định: số phần, số câu mỗi phần, dạng câu hỏi, thời gian, thang điểm
- Nếu KHÔNG CÓ ĐỀ MẪU: Tạo đề theo cấu trúc chuẩn của kỳ thi ${modeLabel} môn ${subject} theo quy định Bộ GD&ĐT hiện hành
- Đảm bảo phân bố kiến thức và mức độ khó phù hợp: Nhận biết → Thông hiểu → Vận dụng → Vận dụng cao
`;
  }


  const isFromBank = request.questionSource === QuestionSource.FromBank;

  // Xây dựng nội dung câu hỏi từ ngân hàng (nếu có)
  let bankQuestionsContext = '';
  if (isFromBank && bankQuestions && bankQuestions.length > 0) {
    bankQuestionsContext = `\n[CÂU HỎI TỪ NGÂN HÀNG CÂU HỎI: ${bankQuestions.length} câu]\n`;
    bankQuestions.forEach((q, i) => {
      bankQuestionsContext += `\n--- Câu ${i + 1} ---\n`;
      bankQuestionsContext += `Nội dung: ${q.content}\n`;
      if (q.options && q.options.length > 0) {
        bankQuestionsContext += `Phương án: ${q.options.join(' | ')}\n`;
      }
      bankQuestionsContext += `Đáp án: ${q.answer}\n`;
      bankQuestionsContext += `Chủ đề: ${q.topic} | Mức độ: ${q.level} | Lớp: ${q.grade}\n`;
    });
  }

  let fileContext = '';
  if (request.sampleExamFiles.length > 0) {
    fileContext += `
[ĐỀ MẪU ĐÃ TẢI LÊN: ${request.sampleExamFiles.length} file]
CÁCH XỬ LÝ ĐỀ MẪU — BẮT BUỘC TUÂN THỦ:
1. ĐỌC và PHÂN TÍCH cấu trúc đề mẫu: đếm số phần, số câu mỗi phần, cách đánh số, kiến thức mỗi câu, mức độ khó
2. TẠO ĐỀ MỚI có CẤU TRÚC GIỐNG HỆT (cùng số phần, cùng số câu, cùng cách đánh số)
3. TUYỆT ĐỐI KHÔNG COPY câu hỏi, số liệu, hoặc nội dung từ đề mẫu
4. KHÔNG lặp lại header/tiêu đề trường/sở của đề mẫu — chỉ giữ cấu trúc câu hỏi
`;
  }
  if (request.referenceFiles.length > 0) {
    fileContext += `
[TÀI LIỆU THAM KHẢO ĐÃ TẢI LÊN: ${request.referenceFiles.length} file]
CÁCH XỬ LÝ TÀI LIỆU THAM KHẢO — BẮT BUỘC:
1. Xác định DẠNG BÀI, kiến thức trọng tâm, phương pháp trong tài liệu
2. Tạo câu hỏi CÙNG DẠNG nhưng THAY ĐỔI HOÀN TOÀN nội dung và ngữ cảnh
3. Đảm bảo đáp án của câu hỏi mới là CHÍNH XÁC (tự kiểm tra)
`;
  }
  if (request.referenceUrls && request.referenceUrls.length > 0) {
    fileContext += `
[LIÊN KẾT THAM KHẢO: ${request.referenceUrls.length} link]
${request.referenceUrls.map((url, i) => `  ${i + 1}. ${url}`).join('\n')}
CÁCH XỬ LÝ LIÊN KẾT THAM KHẢO — BẮT BUỘC:
1. Truy cập và phân tích nội dung từ các liên kết trên
2. Xác định DẠNG BÀI, chủ đề, phương pháp giải từ tài liệu tham khảo
3. Tạo câu hỏi CÙNG DẠNG nhưng THAY ĐỔI HOÀN TOÀN nội dung và ngữ cảnh
4. KHÔNG sao chép trực tiếp không cần thiết
`;
  }

  // Prompt khác nhau theo nguồn câu hỏi
  let userPrompt: string;

  if (isFromBank && bankQuestions && bankQuestions.length > 0) {
    userPrompt = `
NHIỆM VỤ: SẮP XẾP các câu hỏi từ NGÂN HÀNG CÂU HỎI thành ĐỀ THI HOÀN CHỈNH cho kỳ thi: ${examLabel} MÔN ${subject.toUpperCase()}.

${structureGuide}

${bankQuestionsContext}

${fileContext}

${request.customRequirements ? `YÊU CẦU RIÊNG CỦA GIÁO VIÊN:\n${request.customRequirements}\n` : ''}

⚠️ QUY TẮC QUAN TRỌNG:
- SỬ DỤNG CÁC CÂU HỎI TỪ NGÂN HÀNG bên trên để tạo đề thi
- GIỮ NGUYÊN nội dung câu hỏi, phương án trả lời (KHÔNG thay đổi nội dung)
- Sắp xếp câu hỏi theo thứ tự hợp lý: Nhận biết → Thông hiểu → Vận dụng → Vận dụng cao
- Đánh số lại câu hỏi cho liên tục
- Format lại cho đẹp, dùng LaTeX cho công thức nếu có
- CHỈ TẠO ĐỀ BÀI, KHÔNG TẠO ĐÁP ÁN
- Nếu số câu hỏi từ ngân hàng không đủ theo cấu trúc, hãy sắp xếp tất cả câu có sẵn

ĐỊNH DẠNG OUTPUT:

**ĐỀ THI THỬ ${examLabel} MÔN ${subject.toUpperCase()}**
**Thời gian làm bài: ${timeLimit} phút**

[Câu hỏi từ ngân hàng được sắp xếp thành đề thi]

BẮT ĐẦU:
  `;
  } else {
    userPrompt = `
NHIỆM VỤ: Tạo 1 ĐỀ THI MỚI **ĐẦY ĐỦ** cho kỳ thi: ${examLabel} MÔN ${subject.toUpperCase()}.

${structureGuide}

${fileContext}

${request.customRequirements ? `YÊU CẦU RIÊNG CỦA GIÁO VIÊN:\n${request.customRequirements}\n` : ''}

Mức độ chủ đạo: ${request.difficulty}

⚠️ QUY TẮC QUAN TRỌNG:
- CHỈ TẠO ĐỀ BÀI, KHÔNG TẠO ĐÁP ÁN (đáp án sẽ tạo riêng ở bước sau)
- PHẢI TẠO ĐẦY ĐỦ TẤT CẢ CÁC CÂU theo cấu trúc (KHÔNG được bỏ sót câu nào)
- KHÔNG copy bất kỳ câu hỏi nào từ đề mẫu — tất cả câu hỏi phải HOÀN TOÀN MỚI
- KHÔNG lặp lại tiêu đề trường/sở/tên đề của đề mẫu
${isMath ? '- Dùng LaTeX cho công thức toán: $x^2$, $\\\\frac{a}{b}$, $\\\\sqrt{x}$' : '- Nếu có công thức, dùng LaTeX: $...$, $$...$$'}

ĐỊNH DẠNG OUTPUT (bắt đầu ngay bằng nội dung đề, không mở đầu bằng lời giới thiệu):

**ĐỀ THI THỬ ${examLabel} MÔN ${subject.toUpperCase()}**
**Thời gian làm bài: ${timeLimit} phút** *(không kể thời gian phát đề)*

[Tiếp theo là nội dung đề bài đầy đủ tất cả các câu]

BẮT ĐẦU VIẾT ĐỀ NGAY:
  `;
  }

  // Xây parts (file + text)
  const parts: any[] = [];

  for (const file of request.sampleExamFiles) {
    parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } });
  }
  for (const file of request.referenceFiles) {
    parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } });
  }
  parts.push({ text: userPrompt });

  return callGeminiWithFallback(apiKey, request.model, parts, sysInstruction, onStatus);
};

// ============================================
// BƯỚC 2: TẠO ĐÁP ÁN (GỬI ĐỀ BÀI ĐÃ TẠO LÀM CONTEXT)
// ============================================
export const generateAnswers = async (
  examContent: string,
  examMode: ExamMode,
  examFormat: ExamFormat,
  model: AIModelId,
  apiKey: string,
  onStatus?: (msg: string) => void,
  subject: string = 'Toán',
): Promise<string> => {
  const isMath = subject === 'Toán';
  const isVao10 = examMode === ExamMode.Vao10;
  const isTracNghiem = examFormat === ExamFormat.TracNghiem;
  const isTuLuan = isVao10 && !isTracNghiem;
  const hasTracNghiem = !isTuLuan;

  const sysInstruction = getSubjectConfig(subject).systemInstruction;

  let examLabel = 'TỐT NGHIỆP THPT';
  if (isVao10) examLabel = isTracNghiem ? 'TUYỂN SINH VÀO LỚP 10 (Trắc nghiệm)' : 'TUYỂN SINH VÀO LỚP 10 (Tự luận)';

  const answerPrompt = `
Dưới đây là ĐỀ THI ${examLabel} MÔN ${subject.toUpperCase()} đã được tạo:

---
${examContent}
---

Hãy tạo ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT cho đề thi trên.

QUY TẮC BẮT BUỘC:
1. GIẢI CHI TIẾT TỪNG CÂU — trình bày rõ từng bước, kiến thức sử dụng
2. MỌI KIẾN THỨC PHẢI ĐÚNG 100% — tự kiểm tra lại trước khi xuất
3. ${isMath ? 'Dùng LaTeX cho công thức: $x^2$, $\\\\frac{a}{b}$, $\\\\sqrt{x}$' : 'Nếu có công thức, dùng LaTeX: $...$, $$...$$'}
${hasTracNghiem ? `4. Trắc nghiệm nhiều lựa chọn: Giải thích tại sao chọn đáp án đó
5. Đúng-Sai: Giải thích rõ TẠI SAO mỗi mệnh đề Đúng/Sai
6. Trả lời ngắn: Giải chi tiết ra đáp số cuối cùng
7. Kết thúc bằng BẢNG ĐÁP ÁN NHANH (markdown table) cho phần trắc nghiệm nhiều lựa chọn` : `4. Giải đầy đủ từng ý (a, b, c, d...) của mỗi bài
5. Trình bày lời giải theo hướng dẫn chấm (có thang điểm nếu phù hợp)`}

ĐỊNH DẠNG OUTPUT:

### ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT

[Đáp án chi tiết từng câu]

${hasTracNghiem ? `BẢNG ĐÁP ÁN NHANH (PHẦN TRẮC NGHIỆM NHIỀU LỰA CHỌN):
| Câu | 1 | 2 | 3 | ... |
|-----|---|---|---|-----|
| Đáp án | ? | ? | ? | ... |` : ''}

BẮT ĐẦU TẠO ĐÁP ÁN:
  `;

  const parts = [{ text: answerPrompt }];

  return callGeminiWithFallback(apiKey, model, parts, sysInstruction, onStatus);
};

// ============================================
// TẠO LẠI HÌNH VẼ SVG
// ============================================
export const regenerateSvg = async (
  oldSvg: string,
  questionContext: string,
  editRequest: string,
  model: AIModelId,
  apiKey: string,
  onStatus?: (msg: string) => void,
): Promise<string> => {
  const prompt = `
Bạn là chuyên gia vẽ hình minh họa bằng SVG.

Dưới đây là HÌNH VẼ SVG CŨ cần sửa lại:

${oldSvg}

NGỮ CẢNH CÂU HỎI XUNG QUANH:
${questionContext}

${editRequest ? `YÊU CẦU SỬA CỦA GIÁO VIÊN:\n${editRequest}\n` : 'Hãy vẽ lại hình cho CHÍNH XÁC và ĐẸP HƠN.'}

QUY TẮC BẮT BUỘC:
1. CHỈ trả về MỘT thẻ <svg>...</svg> DUY NHẤT — KHÔNG viết gì khác (không giải thích, không markdown)
2. viewBox tối đa 400x350, stroke-width: 1.5-2.5px
3. Nhãn: text SVG tiếng Việt, font-size 12-14px, font-weight bold
4. Màu: đen (#000) nét chính, đỏ (#cc0000) đường cong/nét đặc biệt, xanh (#0066cc) trục tọa độ
5. Đánh dấu đỉnh bằng circle r=3-4
6. Đường nét đứt: stroke-dasharray="6,4"
7. Hình tự chứa, KHÔNG dùng external CSS/JS
8. Nếu có đồ thị hàm số: PHẢI có trục Oxy, nhãn đơn vị, lưới nền nhẹ
9. Dùng <polyline> hoặc <path> với nhiều điểm (≥10) để đường cong mượt

BẮT ĐẦU VẼ (trả về ĐÚNG 1 thẻ <svg>):
  `;

  const parts = [{ text: prompt }];
  const result = await callGeminiWithFallback(apiKey, model, parts, SYSTEM_INSTRUCTION, onStatus);

  // Extract SVG from response — chỉ lấy phần <svg>...</svg>
  const svgMatch = result.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) {
    throw new Error('AI không trả về hình SVG hợp lệ. Vui lòng thử lại.');
  }
  return svgMatch[0];
};

// ============================================
// CHẤM ĐIỂM BÀI LÀM QUA ẢNH (AI AUTO GRADER)
// ============================================
export const gradeStudentPaper = async (
  apiKey: string,
  answerKeyContent: string,
  studentFiles: UploadedFile[],
  modelId: AIModelId,
  onStatus?: (msg: string) => void,
): Promise<any> => { // Trả về GradingResult
  // Upload ảnh/file bài làm của học sinh format cho API raw
  const parts: any[] = [];
  
  studentFiles.forEach(file => {
    parts.push({
      inline_data: {
        data: file.base64,
        mime_type: file.mimeType,
      }
    });
  });

  const requestPrompt = `Đây là Đáp Án Chuẩn / Hướng Dẫn Chấm:
---
${answerKeyContent}
---
Dưới đây là hình ảnh/file bài làm của học sinh. Hãy kết hợp yêu cầu hệ thống ở trên để chấm bài và phân tích. BẮT BUỘC trả về ĐÚNG 1 CỤM JSON HỢP LỆ THEO ĐÚNG CẤU TRÚC ĐÃ YÊU CẦU, KHÔNG XUẤT MARKDOWN, KHÔNG CÓ BẤT KỲ COMMENT TEXT NÀO, BẮT ĐẦU VỚI { VÀ KẾT THÚC VỚI }.`;

  parts.push({ text: requestPrompt });

  const systemPrompt = `BẠN LÀ MỘT GIÁM KHẢO CHUYÊN NGHIỆP, TOÀN DIỆN VÀ VÔ CÙNG NGHIÊM NGẶT.
Bạn được cung cấp ĐÁP ÁN CHUẨN (HƯỚNG DẪN CHẤM / BAREM YÊU CẦU CẦN ĐẠT) và HÌNH ẢNH/FILE CHỤP BÀI LÀM CỦA HỌC SINH.
Nhiệm vụ của bạn là lấy đáp án chuẩn làm THƯỚC ĐO DUY NHẤT để chấm bài tự động.

📋 CHIẾN LƯỢC CHẤM CHẶT CHẼ:
1. ĐỐI VỚI CÂU TRẮC NGHIỆM (Chỉ có ký tự A,B,C,D / Đúng Sai / Điền Khuyết gọn nhẹ):
   - Quét kỹ hình ảnh (Double-check OCR) để đọc nét bút, nét khoanh, hoặc đáp án đã điền của học sinh.
   - So khớp tuyệt đối. Sai lệch 1 đáp án/ký tự -> Phán định sai không cho điểm.

2. ĐỐI VỚI CÂU TỰ LUẬN VÀ MÔN NGỮ VĂN (BẮT BUỘC CHẤM THEO ĐỌC Ý):
   - Đọc kỹ Barem điểm trong đáp án (nếu có chia nhỏ từng 0.5đ, 0.25đ).
   - "ĐỌC Ý ĐỂ CHẤM" (Read for intent): Học sinh viết tự luận/văn không bao giờ giống 100% từng chữ trong đáp án, mà phải đảm bảo CÓ CHỨA Ý TƯỞNG CỐT LÕI (Key Arguments).
   - Có n ý chuẩn thì cho n phần điểm. Dùng từ đồng nghĩa nhưng lột tả đúng bản chất -> Vẫn tính điểm. Viết dòng dài nhưng lan man, không trúng trọng tâm Barem -> Không tính điểm.
   - Trừ điểm khách quan nếu thiếu sót. Cộng điểm nếu có ý đúng trong Barem.

3. YÊU CẦU ĐỊNH DẠNG JSON:
BẠN PHẢI TRẢ VỀ CHÍNH XÁC MỘT ĐỐI TƯỢNG JSON (Không bọc markdowns \`\`\`json) theo cấu trúc (VÍ DỤ SAU):
{
  "totalScore": 8.5,
  "maxScore": 10.0,
  "overallFeedback": "Tổng quan bài làm...",
  "gradedQuestions": [
    {
      "questionNumber": "1",
      "studentAnswer": "Học sinh chọn A",
      "correctAnswer": "A",
      "isCorrect": true,
      "earnedPoints": 0.25,
      "maxPoints": 0.25,
      "explanation": "Khớp đáp án"
    }
  ]
}
BẮT BUỘC: ĐỐI TƯỢNG JSON LÀ KẾT QUẢ ĐẦU RA DUY NHẤT. KHÔNG IN BẤT KỲ VĂN BẢN NÀO KHÁC BÊN NGOÀI NGOẶC NHỌN {}.
`;

  try {
    const rawResult = await callGeminiWithFallback(apiKey, modelId, parts, systemPrompt, onStatus);

    // Filter clear markdown
    let cleanJSON = rawResult.trim();
    if (cleanJSON.startsWith('```json')) {
      cleanJSON = cleanJSON.replace(/^```json/, '');
      cleanJSON = cleanJSON.replace(/```$/, '');
    } else if (cleanJSON.startsWith('```')) {
      cleanJSON = cleanJSON.replace(/^```/, '');
      cleanJSON = cleanJSON.replace(/```$/, '');
    }
    
    const parsed = JSON.parse(cleanJSON.trim());
    return parsed;
  } catch (error: any) {
    console.error('Lỗi khi AI chấm bài: ', error);
    throw new Error('Đã xảy ra lỗi trong quá trình phân tích bài làm: ' + error.message);
  }
};

