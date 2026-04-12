import React, { useState, useRef } from 'react';
import { AIModelId, UploadedFile, GradingResult } from '../types';
import { AI_MODELS } from '../constants';
import { gradeStudentPaper, analyzeStudentWeakness } from '../services/geminiService';

interface AIGraderProps {
  apiKey: string;
  onClose: () => void;
  initialAnswerKey?: string;  // Đáp án tự động từ tab Tạo Đề
  initialSubject?: string;    // Môn học tự động
}

export const AIGrader: React.FC<AIGraderProps> = ({ apiKey, onClose, initialAnswerKey = '', initialSubject = '' }) => {
  const [answerKeyContent, setAnswerKeyContent] = useState(initialAnswerKey);
  const [studentFiles, setStudentFiles] = useState<UploadedFile[]>([]);
  const [selectedModel, setSelectedModel] = useState<AIModelId>('gemini-2.5-flash');
  
  const [isGrading, setIsGrading] = useState(false);
  const [gradingStatus, setGradingStatus] = useState('');
  const [result, setResult] = useState<GradingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subjectLabel, setSubjectLabel] = useState(initialSubject);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [analysisError, setAnalysisError] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = event.target.files;
    if (!inputFiles) return;

    const newFilesPromises = Array.from(inputFiles).map(file => {
      return new Promise<UploadedFile | null>((resolve) => {
        if (file.size > 5 * 1024 * 1024) {
          alert(`File "${file.name}" quá lớn (>5MB).`);
          resolve(null);
          return;
        }

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
    const validFiles = results.filter((f) => f !== null) as UploadedFile[];
    
    setStudentFiles((prev) => [...prev, ...validFiles]);
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setStudentFiles(prev => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  const currentModelInfo = AI_MODELS.find(m => m.id === selectedModel);

  const startGrading = async () => {
    if (!apiKey) {
      alert("Vui lòng thiết lập API Key trước.");
      return;
    }
    if (!answerKeyContent.trim()) {
      alert("Vui lòng nhập Đáp Án Chuẩn / Barem Điểm.");
      return;
    }
    if (studentFiles.length === 0) {
      alert("Vui lòng tải lên ảnh chụp hoặc file bài làm của học sinh.");
      return;
    }

    setIsGrading(true);
    setErrorMsg('');
    setResult(null);
    setGradingStatus('Đang phân tích bài làm...');

    try {
      const gradingResponse = await gradeStudentPaper(
        apiKey,
        answerKeyContent,
        studentFiles,
        selectedModel,
        setGradingStatus
      );

      setResult(gradingResponse);
      setGradingStatus('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Lỗi không xác định.');
      setGradingStatus('');
    } finally {
      setIsGrading(false);
    }
  };

  const startDeepAnalysis = async () => {
    if (!result) return;
    setIsAnalyzing(true);
    setAnalysisText('');
    setAnalysisError('');
    try {
      const text = await analyzeStudentWeakness(
        apiKey, result, subjectLabel || 'Chung', selectedModel, (msg) => setAnalysisText(prev => prev + msg + '\n')
      );
      setAnalysisText(text);
    } catch (err: any) {
      setAnalysisError(err.message || 'Lỗi phân tích');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-teal-900 flex items-center gap-2">
          🤖 Chấm Điểm Tự Động (AI Auto Grader)
        </h2>
        <button
          onClick={onClose}
          className="text-xs font-semibold px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
        >
          ← Quay Lại
        </button>
      </div>

      {/* INPUT MÔN HỌC ↴ mới: có ô nhập môn */}
      <div className="flex gap-3 items-center bg-white rounded-xl border border-teal-100 p-3 shadow-sm">
        <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">Môn học:</span>
        <input
          type="text"
          placeholder="VD: Toán 12, Ngữ Văn 11, Vật Lý TN THPT..."
          value={subjectLabel}
          onChange={e => setSubjectLabel(e.target.value)}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:border-teal-400 outline-none"
        />
        <span className="text-[10px] text-slate-400">Dùng cho báo cáo Phân Tích Nâng Cao</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CỘT TRÁI: NHẬP DỮ LIỆU */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
            <h3 className="font-bold text-sm text-teal-800 mb-3 flex items-center gap-2">
              <span className="text-lg">✅</span> Đáp Án Chuẩn (Barem Điểm)
            </h3>
            <p className="text-[11px] text-slate-500 mb-2">
              Dán đáp án của bộ đề thi vào đây. Lưu ý ghi rõ cấu trúc điểm cho phần Tự Luận/Ngữ Văn (VD: Mở bài 0.5đ, Ý chính 1đ).
            </p>
            <textarea
              value={answerKeyContent}
              onChange={(e) => setAnswerKeyContent(e.target.value)}
              placeholder="Nhập hoặc dán đáp án vào đây..."
              className="w-full h-40 p-3 rounded-lg border border-slate-300 bg-slate-50 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-y"
            ></textarea>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
            <h3 className="font-bold text-sm text-teal-800 mb-3 flex items-center gap-2">
              <span className="text-lg">📸</span> Bài Làm Của Học Sinh
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">
              Chụp ảnh phiếu làm bài, bài tự luận, hoặc tải lên file PDF/kết quả ảnh.
            </p>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 px-4 border-2 border-dashed border-slate-300 hover:border-teal-400 hover:bg-teal-50 bg-slate-50 rounded-xl text-slate-600 transition-colors flex flex-col items-center justify-center gap-1"
            >
              <div className="text-2xl">📤</div>
              <span className="font-medium text-sm">Tải Lên Ảnh / PDF Bài Làm</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {studentFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {studentFiles.map((f, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2 bg-emerald-50 border border-emerald-100 rounded-md">
                    <span className="truncate flex-1 font-medium text-emerald-800 mr-2">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-red-500 font-bold hover:text-red-700">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CHỌN MODEL & NÚT CHẤM */}
          <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Mô hình AI Chấm Bài</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as AIModelId)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-500 outline-none"
              >
                {AI_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.desc}</option>
                ))}
              </select>
            </div>

            <button
              onClick={startGrading}
              disabled={isGrading || studentFiles.length === 0 || !answerKeyContent.trim()}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGrading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Đang chấm điểm...
                </>
              ) : (
                <>✨ Bắt Đầu Chấm Bài Điểm Tự Động</>
              )}
            </button>
            {isGrading && gradingStatus && (
              <p className="text-[11px] text-teal-600 font-medium text-center animate-pulse">{gradingStatus}</p>
            )}
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-200 text-[11px] rounded-lg">
                ❌ Lỗi: {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: KẾT QUẢ CHẤM ĐIỂM */}
        <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5 h-full flex flex-col">
          <h3 className="font-bold text-sm text-teal-800 mb-3 flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="text-lg">📊</span> Kết Quả Chấm Điểm
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {!result ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50 space-y-3">
                <span className="text-5xl">📄</span>
                <p className="text-xs">Chưa có kết quả. Vui lòng bắt đầu chấm điểm ở panel bênh cạnh.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Score Banner */}
                <div className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-xl p-4 text-white text-center shadow-lg transform transition-transform hover:scale-[1.02]">
                  <p className="text-sm font-semibold opacity-80 mb-1">TỔNG ĐIỂM BÀI LÀM</p>
                  <p className="text-4xl font-extrabold">{result.totalScore} <span className="text-xl font-normal opacity-70">/ {result.maxScore}</span></p>
                </div>

                {/* Overall Feedback */}
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                  <h4 className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-2">💡 Nhận Xét Tổng Quan</h4>
                  <p className="text-sm text-slate-700 leading-relaxed indent-4">{result.overallFeedback}</p>
                </div>

                {/* Detailed Questions */}
                <div className="space-y-3 mt-4">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">📋 Chi Tiết Từng Câu</h4>
                  {result.gradedQuestions.map((q, idx) => (
                    <div key={idx} className={`rounded-xl border ${q.isCorrect ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'} p-3 shadow-sm`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-xs text-slate-800 bg-white px-2 py-1 rounded shadow-sm">Câu {q.questionNumber}</span>
                        {q.earnedPoints !== undefined && q.maxPoints !== undefined ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {q.earnedPoints} / {q.maxPoints} đ
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {q.isCorrect ? 'Đúng' : 'Sai'}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[11px] mb-2 p-2 bg-white/60 rounded">
                        <div>
                          <span className="text-slate-400 block mb-0.5">HS Chọn/Làm:</span>
                          <span className={q.isCorrect ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold strike-through'}>{q.studentAnswer}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Đáp án Chuẩn:</span>
                          <span className="text-teal-700 font-semibold">{q.correctAnswer}</span>
                        </div>
                      </div>

                      {q.explanation && (
                        <p className="text-[10px] text-slate-600 leading-relaxed border-t border-slate-200 pt-2 mt-1">
                          <span className="font-semibold">Giải thích:</span> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* PANEL PHÂN TÍCH NÂNG CAO */}
      {result && (
        <div className="bg-white rounded-xl shadow-md border border-indigo-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2">
              <span className="text-xl">🧠</span> Phân Tích Nâng Cao (AI Agent)
            </h3>
            <button
              onClick={startDeepAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {isAnalyzing ? (
                <><svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Đang phân tích sâu...</>
              ) : (
                <>🧠 Phân Tích Điểm Yếu và Gợi Ý Bài Tập</>
              )}
            </button>
          </div>

          {!analysisText && !isAnalyzing && !analysisError && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center text-slate-500 text-xs">
              💡 Nhấn nút trên để AI phân tích sâu: điểm yếu, bài tập bổ trợ, dự đoán điểm thi thực tế...
            </div>
          )}

          {analysisError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
              ❌ Lỗi: {analysisError}
            </div>
          )}

          {analysisText && (
            <div className="prose prose-sm max-w-none bg-indigo-50/40 rounded-xl p-4 overflow-y-auto max-h-96 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
              {analysisText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
