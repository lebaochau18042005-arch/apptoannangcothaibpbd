import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AI_MODELS, DIFFICULTIES, SUBJECT_LIST } from '../constants';
import { ExamRequest, ExamMode, ExamFormat, Difficulty, AIModelId, UploadedFile, QuestionSource, BankQuestion } from '../types';
import { parseDocxWithMath } from '../services/docxMathParser';

// ============================================
// NGÂN HÀNG CÂU HỎI — Load từ localStorage
// ============================================
const BANK_STORAGE_KEY = 'edugenvn_question_bank';
function loadBankQuestions(): BankQuestion[] {
  try {
    const saved = localStorage.getItem(BANK_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

const BANK_LEVELS: { value: BankQuestion['level']; label: string; color: string }[] = [
  { value: 'NB', label: 'Nhận biết', color: 'bg-green-100 text-green-700' },
  { value: 'TH', label: 'Thông hiểu', color: 'bg-blue-100 text-blue-700' },
  { value: 'VD', label: 'Vận dụng', color: 'bg-amber-100 text-amber-700' },
  { value: 'VDC', label: 'Vận dụng cao', color: 'bg-red-100 text-red-700' },
];

interface InputFormProps {
  request: ExamRequest;
  onChange: (field: keyof ExamRequest, value: any) => void;
  onFilesChange: (type: 'sampleExamFiles' | 'referenceFiles', files: UploadedFile[]) => void;
  onSubmit: () => void;
  isGenerating: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({
  request,
  onChange,
  onFilesChange,
  onSubmit,
  isGenerating,
}) => {
  const sampleInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [draggingSample, setDraggingSample] = useState(false);
  const [draggingRef, setDraggingRef] = useState(false);

  // Ngân hàng câu hỏi state
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankFilterLevel, setBankFilterLevel] = useState<'all' | BankQuestion['level']>('all');
  const [bankFilterTopic, setBankFilterTopic] = useState('all');
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  // Load ngân hàng câu hỏi khi mount hoặc khi switch sang FromBank
  useEffect(() => {
    if (request.questionSource === QuestionSource.FromBank) {
      setBankQuestions(loadBankQuestions());
    }
  }, [request.questionSource]);

  // Danh sách chủ đề unique từ ngân hàng
  const bankTopics = Array.from(new Set(bankQuestions.map(q => q.topic))).sort();

  // Lọc câu hỏi ngân hàng
  const filteredBankQuestions = bankQuestions.filter(q => {
    if (bankFilterLevel !== 'all' && q.level !== bankFilterLevel) return false;
    if (bankFilterTopic !== 'all' && q.topic !== bankFilterTopic) return false;
    if (bankSearchQuery) {
      const query = bankSearchQuery.toLowerCase();
      return q.content.toLowerCase().includes(query) || q.topic.toLowerCase().includes(query);
    }
    return true;
  });

  const selectedIds = request.selectedBankQuestionIds || [];
  const selectedCount = selectedIds.length;

  const toggleBankQuestion = (id: string) => {
    const current = request.selectedBankQuestionIds || [];
    if (current.includes(id)) {
      onChange('selectedBankQuestionIds', current.filter((qid: string) => qid !== id));
    } else {
      onChange('selectedBankQuestionIds', [...current, id]);
    }
  };

  const toggleAllFiltered = () => {
    const filteredIds = filteredBankQuestions.map(q => q.id);
    const current = request.selectedBankQuestionIds || [];
    const allSelected = filteredIds.every(id => current.includes(id));
    if (allSelected) {
      // Bỏ chọn tất cả filtered
      onChange('selectedBankQuestionIds', current.filter((id: string) => !filteredIds.includes(id)));
    } else {
      // Chọn tất cả filtered
      const newIds = [...new Set([...current, ...filteredIds])];
      onChange('selectedBankQuestionIds', newIds);
    }
  };

  // Xử lý danh sách files (dùng chung cho cả click upload và drag-drop)
  const processFiles = async (
    type: 'sampleExamFiles' | 'referenceFiles',
    fileList: FileList,
  ) => {
    const existingFiles = type === 'sampleExamFiles' ? request.sampleExamFiles : request.referenceFiles;
    const newFilesPromises = Array.from(fileList).map(async (file): Promise<UploadedFile | UploadedFile[] | null> => {
      // Giới hạn 4MB
      if (file.size > 4 * 1024 * 1024) {
        alert(`File "${file.name}" quá lớn (>4MB). Vui lòng dùng file nhỏ hơn.`);
        return null;
      }

      // ===== DOC/DOCX: dùng mammoth trích xuất text =====
      const isDocx = file.name.toLowerCase().endsWith('.docx') ||
        file.name.toLowerCase().endsWith('.doc') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword';

      if (isDocx) {
        try {
          const result = await parseDocxWithMath(file);
          if (!result) {
             alert(`Không thể đọc nội dung file "${file.name}".`);
             return null;
          }

          if (result.method === 'hybrid' || result.wmfCount > 0) {
             console.log(`Phát hiện ${result.wmfCount} công thức MathType trong file ${file.name}. Đã được chuyển đổi.`);
          }

          const base64Text = btoa(unescape(encodeURIComponent(result.text)));
          const textFile: UploadedFile = {
            name: file.name + ' (text)',
            base64: base64Text,
            mimeType: 'text/plain',
            size: result.text.length,
          };

          // Trả về mảng: text + hình ảnh hỗ trợ (cho Gemini nhận diện)
          return [textFile, ...result.images];
        } catch {
          alert(`Không thể đọc file "${file.name}". File có thể bị hỏng.`);
          return null;
        }
      }

      // ===== Các file khác: đọc base64 bình thường =====
      return new Promise<UploadedFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Full = e.target?.result as string;
          const [header, base64Data] = base64Full.split(',');
          const mimeType = header.match(/data:(.*?);/)?.[1] || 'application/octet-stream';
          resolve({
            name: file.name,
            base64: base64Data,
            mimeType,
            size: file.size,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    const results = await Promise.all(newFilesPromises);
    // Flatten: docx trả về mảng (text + hình), file khác trả về đơn lẻ
    const validFiles = results.flatMap((r) => {
      if (!r) return [];
      if (Array.isArray(r)) return r;
      return [r];
    });
    onFilesChange(type, [...existingFiles, ...validFiles]);
  };

  // Upload file qua input click
  const handleFileUpload = async (
    type: 'sampleExamFiles' | 'referenceFiles',
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputFiles = event.target.files;
    if (!inputFiles) return;
    await processFiles(type, inputFiles);
    // Reset input
    event.target.value = '';
  };

  // Xóa 1 file
  const removeFile = (type: 'sampleExamFiles' | 'referenceFiles', index: number) => {
    const files = type === 'sampleExamFiles' ? [...request.sampleExamFiles] : [...request.referenceFiles];
    files.splice(index, 1);
    onFilesChange(type, files);
  };

  // Format kích thước file
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B';
    return (bytes / 1024).toFixed(0) + 'KB';
  };

  const hasSampleFiles = request.sampleExamFiles.length > 0;
  const hasRefFiles = request.referenceFiles.length > 0;
  const hasRefUrls = (request.referenceUrls?.length || 0) > 0;
  const hasSelectedBankQuestions = selectedCount > 0;
  const canSubmit = (hasSampleFiles || hasRefFiles || hasRefUrls || hasSelectedBankQuestions) && !isGenerating;

  // URL input state
  const [urlInput, setUrlInput] = useState('');

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      alert('Vui lòng nhập URL hợp lệ (bắt đầu bằng http:// hoặc https://)');
      return;
    }
    onChange('referenceUrls', [...(request.referenceUrls || []), url]);
    setUrlInput('');
  };

  const removeUrl = (index: number) => {
    const urls = [...(request.referenceUrls || [])];
    urls.splice(index, 1);
    onChange('referenceUrls', urls);
  };

  return (
    <div className="space-y-4">
      {/* ====== MÔN HỌC ====== */}
      <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
        <h2 className="text-base font-bold text-teal-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          Môn học
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {SUBJECT_LIST.map((subj) => (
            <button
              key={subj.id}
              type="button"
              onClick={() => onChange('subject', subj.id)}
              className={`relative p-2.5 rounded-xl border-2 transition-all text-center ${
                request.subject === subj.id
                  ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-400/30 shadow-md'
                  : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
              }`}
            >
              {request.subject === subj.id && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-teal-500 text-white rounded-full flex items-center justify-center text-[9px]">✓</span>
              )}
              <div className="text-xl mb-0.5">{subj.icon}</div>
              <div className="font-bold text-[11px] text-slate-800 leading-tight">{subj.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ====== LOẠI KỲ THI ====== */}
      <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
        <h2 className="text-base font-bold text-teal-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Loại kỳ thi
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {/* Vào 10 */}
          <button
            type="button"
            onClick={() => onChange('examMode', ExamMode.Vao10)}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              request.examMode === ExamMode.Vao10
                ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-400/30 shadow-md'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            {request.examMode === ExamMode.Vao10 && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
            )}
            <div className="text-2xl mb-1">📐</div>
            <div className="font-bold text-sm text-slate-800">Thi vào Lớp 10</div>
            <div className="text-xs text-slate-500 mt-0.5">THCS • Lớp 9</div>
          </button>

          {/* TN THPT */}
          <button
            type="button"
            onClick={() => onChange('examMode', ExamMode.TotNghiep)}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              request.examMode === ExamMode.TotNghiep
                ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-400/30 shadow-md'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            {request.examMode === ExamMode.TotNghiep && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
            )}
            <div className="text-2xl mb-1">🎓</div>
            <div className="font-bold text-sm text-slate-800">TN THPT</div>
            <div className="text-xs text-slate-500 mt-0.5">THPT • Lớp 12</div>
          </button>
        </div>

        {/* Hình thức đề — chỉ hiện khi Vào 10 + môn Toán */}
        {request.examMode === ExamMode.Vao10 && request.subject === 'Toán' && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-2">Hình thức đề thi</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange('examFormat', ExamFormat.TracNghiem)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  request.examFormat === ExamFormat.TracNghiem
                    ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-400/30'
                    : 'border-slate-200 hover:border-teal-300'
                }`}
              >
                <div className="font-bold text-xs text-slate-800">📋 Trắc nghiệm</div>
                <div className="text-[10px] text-slate-500 mt-0.5">3 phần: TN + Đ/S + TL ngắn • 90p</div>
                <div className="text-[9px] text-teal-600 font-semibold mt-1">Cấu trúc mới 2025</div>
              </button>
              <button
                type="button"
                onClick={() => onChange('examFormat', ExamFormat.TuLuan)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  request.examFormat === ExamFormat.TuLuan
                    ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-400/30'
                    : 'border-slate-200 hover:border-teal-300'
                }`}
              >
                <div className="font-bold text-xs text-slate-800">✍️ Tự luận</div>
                <div className="text-[10px] text-slate-500 mt-0.5">5-7 bài tự luận • 120 phút</div>
                <div className="text-[9px] text-slate-400 font-medium mt-1">Truyền thống</div>
              </button>
            </div>
          </div>
        )}

        {/* Ghi chú cho các môn khác */}
        {request.subject !== 'Toán' && (
          <div className="mt-3 bg-sky-50 border border-sky-200 rounded-lg p-3">
            <p className="text-[11px] text-sky-700 font-medium">
              💡 AI sẽ tự phân tích cấu trúc đề từ <strong>đề mẫu</strong> bạn tải lên. Nếu không có đề mẫu, AI sẽ tạo đề theo cấu trúc chuẩn Bộ GD&ĐT.
            </p>
          </div>
        )}
      </div>

      {/* ====== UPLOAD FILE ====== */}
      <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
        <h2 className="text-base font-bold text-teal-800 mb-1 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Tải lên tài liệu
        </h2>
        <p className="text-xs text-slate-500 mb-4">AI phân tích đề mẫu lấy cấu trúc + dùng tài liệu tham khảo để ra câu hỏi cùng dạng</p>

        <div className="grid grid-cols-1 gap-3">
          {/* === Đề mẫu === */}
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-teal-400 hover:bg-teal-50/30 ${
              draggingSample ? 'border-teal-500 bg-teal-100/50 scale-[1.02] shadow-lg' :
              hasSampleFiles ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200'
            }`}
            onClick={() => sampleInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingSample(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingSample(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingSample(false); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingSample(false); if (e.dataTransfer.files.length > 0) processFiles('sampleExamFiles', e.dataTransfer.files); }}
          >
            <input
              ref={sampleInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp"
              multiple
              onChange={(e) => handleFileUpload('sampleExamFiles', e)}
              className="hidden"
            />
            <div className={`text-2xl mb-1 ${draggingSample ? 'text-teal-600' : hasSampleFiles ? 'text-emerald-500' : 'text-slate-400'}`}>
              {draggingSample ? '⬇️' : hasSampleFiles ? '✅' : '📝'}
            </div>
            <div className="font-bold text-sm text-slate-700">{draggingSample ? 'Thả file vào đây!' : 'Đề mẫu'}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {hasSampleFiles
                ? `${request.sampleExamFiles.length} file đã tải`
                : 'Bấm chọn hoặc kéo thả file vào — Ảnh, PDF, DOC(X), TXT'
              }
            </div>

            {/* Danh sách file đã upload */}
            {hasSampleFiles && (
              <div className="mt-3 text-left space-y-1.5" onClick={(e) => e.stopPropagation()}>
                {request.sampleExamFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-emerald-100 text-xs">
                    <span className="text-emerald-500">📄</span>
                    <span className="flex-1 truncate font-medium text-slate-700">{f.name}</span>
                    <span className="text-slate-400">{formatSize(f.size)}</span>
                    <button
                      onClick={() => removeFile('sampleExamFiles', i)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === Tài liệu tham khảo === */}
          <div
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-teal-400 hover:bg-teal-50/30 ${
              draggingRef ? 'border-blue-500 bg-blue-100/50 scale-[1.02] shadow-lg' :
              hasRefFiles ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'
            }`}
            onClick={() => refInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingRef(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingRef(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingRef(false); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingRef(false); if (e.dataTransfer.files.length > 0) processFiles('referenceFiles', e.dataTransfer.files); }}
          >
            <input
              ref={refInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp"
              multiple
              onChange={(e) => handleFileUpload('referenceFiles', e)}
              className="hidden"
            />
            <div className={`text-2xl mb-1 ${draggingRef ? 'text-blue-600' : hasRefFiles ? 'text-blue-500' : 'text-slate-400'}`}>
              {draggingRef ? '⬇️' : hasRefFiles ? '✅' : '📚'}
            </div>
            <div className="font-bold text-sm text-slate-700">{draggingRef ? 'Thả file vào đây!' : 'Tài liệu tham khảo'}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {hasRefFiles
                ? `${request.referenceFiles.length} file đã tải`
                : 'Bấm chọn hoặc kéo thả file vào — Ảnh, PDF, DOC(X), TXT'
              }
            </div>

            {hasRefFiles && (
              <div className="mt-3 text-left space-y-1.5" onClick={(e) => e.stopPropagation()}>
                {request.referenceFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-blue-100 text-xs">
                    <span className="text-blue-500">📄</span>
                    <span className="flex-1 truncate font-medium text-slate-700">{f.name}</span>
                    <span className="text-slate-400">{formatSize(f.size)}</span>
                    <button
                      onClick={() => removeFile('referenceFiles', i)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === Liên kết tham khảo === */}
          <div className="bg-white/80 rounded-xl p-4 border border-indigo-100">
            <div className="font-bold text-sm text-slate-700 mb-1 flex items-center gap-1.5">
              🔗 Liên kết tham khảo
            </div>
            <p className="text-[10px] text-slate-500 mb-3">Dán link bài viết, đề thi online, tài liệu web</p>

            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                placeholder="https://..."
                className="flex-1 rounded-lg border border-slate-300 bg-slate-50 py-2 px-3 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={addUrl}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
              >
                Thêm
              </button>
            </div>

            {hasRefUrls && (
              <div className="space-y-1.5">
                {request.referenceUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-indigo-100 text-xs">
                    <span className="text-indigo-500">🔗</span>
                    <a href={url} target="_blank" rel="noreferrer" className="flex-1 truncate font-medium text-indigo-600 hover:underline">{url}</a>
                    <button
                      onClick={() => removeUrl(i)}
                      className="text-red-400 hover:text-red-600 ml-1"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== NGUỒN CÂU HỎI ====== */}
      <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
        <h2 className="text-base font-bold text-teal-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          Nguồn câu hỏi
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {/* Lấy từ ngân hàng câu hỏi */}
          <button
            type="button"
            onClick={() => onChange('questionSource', QuestionSource.FromBank)}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              request.questionSource === QuestionSource.FromBank
                ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-400/30 shadow-md'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            {request.questionSource === QuestionSource.FromBank && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
            )}
            <div className="text-2xl mb-1">📚</div>
            <div className="font-bold text-sm text-slate-800">Lấy từ NHCH</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Chọn câu hỏi từ ngân hàng, AI sắp xếp thành đề thi</div>
          </button>

          {/* AI tự sinh */}
          <button
            type="button"
            onClick={() => onChange('questionSource', QuestionSource.AiGenerated)}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              request.questionSource === QuestionSource.AiGenerated
                ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-400/30 shadow-md'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            {request.questionSource === QuestionSource.AiGenerated && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
            )}
            <div className="text-2xl mb-1">🤖</div>
            <div className="font-bold text-sm text-slate-800">AI tự sinh</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">AI tạo câu hỏi mới 100%, dựa trên cấu trúc đề mẫu</div>
          </button>
        </div>

        {/* === UI CHỌN CÂU HỎI TỪ NGÂN HÀNG === */}
        {request.questionSource === QuestionSource.FromBank && (
          <div className="mt-4">
            {bankQuestions.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <div className="text-2xl mb-1">📭</div>
                <p className="text-xs text-amber-700 font-medium">
                  Ngân hàng câu hỏi trống! Vui lòng vào <strong>Ngân hàng</strong> trên header để thêm câu hỏi trước.
                </p>
              </div>
            ) : (
              <>
                {/* Thông tin tổng quan */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-600 font-medium">
                    📚 {bankQuestions.length} câu hỏi trong ngân hàng
                    {selectedCount > 0 && (
                      <span className="ml-2 text-teal-600 font-bold">• Đã chọn {selectedCount} câu</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBankQuestions(loadBankQuestions())}
                    className="text-[10px] text-teal-600 hover:text-teal-800 font-medium"
                  >
                    🔄 Tải lại
                  </button>
                </div>

                {/* Bộ lọc */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <input
                    type="text"
                    value={bankSearchQuery}
                    onChange={(e) => setBankSearchQuery(e.target.value)}
                    placeholder="🔍 Tìm câu hỏi..."
                    className="flex-1 min-w-[120px] rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
                  />
                  <select
                    value={bankFilterLevel}
                    onChange={(e) => setBankFilterLevel(e.target.value as any)}
                    className="rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
                  >
                    <option value="all">Tất cả mức độ</option>
                    {BANK_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  <select
                    value={bankFilterTopic}
                    onChange={(e) => setBankFilterTopic(e.target.value)}
                    className="rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
                  >
                    <option value="all">Tất cả chủ đề</option>
                    {bankTopics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Chọn tất cả */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={toggleAllFiltered}
                    className="text-[10px] font-medium text-teal-600 hover:text-teal-800 underline"
                  >
                    {filteredBankQuestions.length > 0 && filteredBankQuestions.every(q => selectedIds.includes(q.id))
                      ? '☑ Bỏ chọn tất cả'
                      : '☐ Chọn tất cả'} ({filteredBankQuestions.length} câu)
                  </button>
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange('selectedBankQuestionIds', [])}
                      className="text-[10px] font-medium text-red-500 hover:text-red-700 underline ml-auto"
                    >
                      ✕ Xóa tất cả đã chọn
                    </button>
                  )}
                </div>

                {/* Danh sách câu hỏi */}
                <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {filteredBankQuestions.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Không tìm thấy câu hỏi phù hợp</p>
                  ) : (
                    filteredBankQuestions.map((q) => {
                      const isSelected = selectedIds.includes(q.id);
                      const lv = BANK_LEVELS.find(l => l.value === q.level) || BANK_LEVELS[0];
                      return (
                        <label
                          key={q.id}
                          className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                            isSelected
                              ? 'border-teal-400 bg-teal-50/60 ring-1 ring-teal-300/40'
                              : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleBankQuestion(q.id)}
                            className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-800 leading-relaxed line-clamp-2">{q.content}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${lv.color}`}>{lv.label}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">{q.topic}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Lớp {q.grade}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Tổng kết */}
                {selectedCount > 0 && (
                  <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p className="text-[11px] text-teal-700 font-medium">
                      ✅ Đã chọn <strong>{selectedCount}</strong> câu hỏi từ ngân hàng. AI sẽ sắp xếp và format thành đề thi hoàn chỉnh.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ====== MODEL + YÊU CẦU RIÊNG ====== */}
      <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
        <h2 className="text-base font-bold text-teal-800 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Tuỳ chỉnh
        </h2>

        {/* Mức độ */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-2">Mức độ chủ đạo</label>
          <select
            value={request.difficulty}
            onChange={(e) => onChange('difficulty', e.target.value as Difficulty)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 px-3 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 focus:ring-1 outline-none transition-all"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Yêu cầu riêng */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Yêu cầu riêng <span className="text-slate-400 font-normal">(tùy chọn)</span>
          </label>
          <textarea
            value={request.customRequirements}
            onChange={(e) => onChange('customRequirements', e.target.value)}
            rows={3}
            placeholder="Ví dụ: Tập trung hình học không gian, thêm câu xác suất, tránh câu lượng giác..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 px-3 text-sm text-slate-800 focus:border-teal-500 focus:ring-teal-500 focus:ring-1 outline-none transition-all resize-none"
          />
        </div>
      </div>

      {/* ====== NÚT TẠO ĐỀ ====== */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`w-full flex items-center justify-center py-4 px-6 rounded-xl text-white font-bold text-base transition-all duration-200 shadow-lg ${
          canSubmit
            ? 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-teal-500/30 transform hover:-translate-y-0.5 active:translate-y-0'
            : 'bg-slate-400 cursor-not-allowed shadow-none'
        }`}
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Đang tạo đề thi...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M15 4V2"></path><path d="M15 16v-2"></path><path d="M8 9h2"></path><path d="M20 9h2"></path>
              <path d="M17.8 11.8 19 13"></path><path d="M15 9h.01"></path><path d="M17.8 6.2 19 5"></path>
              <path d="m3 21 9-9"></path><path d="M12.2 6.2 11 5"></path>
            </svg>
            Tạo Đề Thi Ngay
          </>
        )}
      </button>

      {/* ====== GHI CHÚ ====== */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <h4 className="text-teal-900 font-bold text-xs mb-1.5 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          Cách hoạt động
        </h4>
        <ul className="text-[11px] text-teal-800 space-y-1 font-medium leading-relaxed">
          <li>📝 <strong>Đề mẫu:</strong> AI phân tích cấu trúc (số câu, phân bố, mức độ) → tạo đề mới giống cấu trúc</li>
          <li>📚 <strong>Tài liệu TK:</strong> AI lấy dạng bài, phương pháp giải → tạo câu hỏi cùng dạng, số liệu mới</li>
          <li>🔄 Hệ thống <strong>tự động chuyển model</strong> nếu gặp lỗi</li>
        </ul>
      </div>
    </div>
  );
};
