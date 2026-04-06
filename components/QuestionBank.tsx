import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BankQuestion } from '../types';
import mammoth from 'mammoth';
import { parseDocxWithMath } from '../services/docxMathParser';

// ============================================
// CONSTANTS
// ============================================
const STORAGE_KEY = 'edugenvn_question_bank';

// ============================================
// DANH SÁCH MÔN HỌC + CHỦ ĐỀ THEO BỘ GD&ĐT
// ============================================
const SUBJECTS = [
  { id: 'Toán', name: 'Toán', icon: '📐' },
  { id: 'Vật Lý', name: 'Vật Lý', icon: '⚡' },
  { id: 'Hóa Học', name: 'Hóa Học', icon: '🧪' },
  { id: 'Sinh Học', name: 'Sinh Học', icon: '🧬' },
  { id: 'Ngữ Văn', name: 'Ngữ Văn', icon: '📖' },
  { id: 'Tiếng Anh', name: 'Tiếng Anh', icon: '🌐' },
  { id: 'Lịch Sử', name: 'Lịch Sử', icon: '🏛️' },
  { id: 'Địa Lý', name: 'Địa Lý', icon: '🌍' },
  { id: 'GDCD', name: 'GDCD', icon: '⚖️' },
  { id: 'Tin Học', name: 'Tin Học', icon: '💻' },
];

const SUBJECT_TOPICS: Record<string, string[]> = {
  'Toán': [
    'Hàm số', 'Đạo hàm', 'Nguyên hàm - Tích phân', 'Hình học không gian',
    'Xác suất - Thống kê', 'Số phức', 'Logarit - Mũ', 'Lượng giác',
    'Tổ hợp - Nhị thức Newton', 'Phương trình bậc hai', 'Hệ phương trình',
    'Bất phương trình', 'Đường tròn', 'Tam giác', 'Tứ giác nội tiếp',
    'Thống kê', 'Căn bậc hai', 'Hàm y=ax²', 'Dãy số - Cấp số', 'Khác',
  ],
  'Vật Lý': [
    'Cơ học', 'Động lực học', 'Công - Năng lượng', 'Nhiệt học',
    'Điện học', 'Điện từ học', 'Quang học', 'Vật lý hạt nhân',
    'Dao động - Sóng', 'Sóng ánh sáng', 'Vật lý lượng tử',
    'Chuyển động cơ', 'Lực - Định luật Newton', 'Chất khí', 'Khác',
  ],
  'Hóa Học': [
    'Nguyên tử - Bảng tuần hoàn', 'Liên kết hóa học', 'Phản ứng hóa học',
    'Dung dịch - Điện li', 'Phi kim', 'Kim loại', 'Hidrocacbon',
    'Dẫn xuất halogen - Ancol - Phenol', 'Andehit - Axit cacboxylic',
    'Este - Lipit', 'Cacbohidrat', 'Amin - Amino axit - Protein',
    'Polime', 'Hóa học và đời sống', 'Tốc độ phản ứng - Cân bằng', 'Khác',
  ],
  'Sinh Học': [
    'Tế bào học', 'Sinh học phân tử', 'Di truyền học', 'Tiến hóa',
    'Sinh thái học', 'Sinh lý thực vật', 'Sinh lý động vật',
    'Vi sinh vật', 'Đột biến', 'Quy luật di truyền', 'Di truyền quần thể',
    'Sinh học người', 'ƨng dụng di truyền', 'Khác',
  ],
  'Ngữ Văn': [
    'Văn học dân gian', 'Văn học trung đại', 'Văn học hiện đại',
    'Thơ', 'Truyện ngắn', 'Tiểu thuyết', 'Ký - Tùy bút',
    'Nghị luận xã hội', 'Nghị luận văn học', 'Đọc hiểu',
    'Tiếng Việt', 'Viết đoạn văn', 'Khác',
  ],
  'Tiếng Anh': [
    'Grammar', 'Vocabulary', 'Reading Comprehension', 'Listening',
    'Writing', 'Speaking', 'Phonetics', 'Word Formation',
    'Sentence Transformation', 'Error Identification', 'Cloze Test',
    'Communication', 'Khác',
  ],
  'Lịch Sử': [
    'Lịch sử thế giới cổ - trung đại', 'Lịch sử thế giới cận đại',
    'Lịch sử thế giới hiện đại', 'Lịch sử Việt Nam cổ - trung đại',
    'Lịch sử Việt Nam cận đại', 'Lịch sử Việt Nam hiện đại',
    'Chiến tranh thế giới', 'Phong trào giải phóng dân tộc',
    'Đảng Cộng sản Việt Nam', 'Khác',
  ],
  'Địa Lý': [
    'Địa lý tự nhiên', 'Địa lý dân cư', 'Địa lý kinh tế',
    'Địa lý các vùng kinh tế', 'Địa lý thế giới',
    'Bản đồ - Biểu đồ', 'Khí hậu - Thủy văn', 'Đất - Sinh vật',
    'Môi trường - Phát triển bền vững', 'Khác',
  ],
  'GDCD': [
    'Pháp luật', 'Kinh tế', 'Đạo đức', 'Chính trị - Xã hội',
    'Quyền và nghĩa vụ công dân', 'Nhà nước và pháp luật',
    'Hiến pháp', 'Giáo dục công dân', 'Khác',
  ],
  'Tin Học': [
    'Lập trình', 'Cơ sở dữ liệu', 'Mạng máy tính', 'Hệ điều hành',
    'Thuật toán', 'Biểu diễn thông tin', 'Tin học ứng dụng',
    'An toàn thông tin', 'Đạo đức và pháp luật CNTT', 'Khác',
  ],
};

// Hàm lấy topics theo môn học
function getTopicsForSubject(subject: string): string[] {
  return SUBJECT_TOPICS[subject] || ['Khác'];
}
const LEVELS: { value: BankQuestion['level']; label: string; color: string }[] = [
  { value: 'NB', label: 'Nhận biết', color: 'bg-green-100 text-green-700' },
  { value: 'TH', label: 'Thông hiểu', color: 'bg-blue-100 text-blue-700' },
  { value: 'VD', label: 'Vận dụng', color: 'bg-amber-100 text-amber-700' },
  { value: 'VDC', label: 'Vận dụng cao', color: 'bg-red-100 text-red-700' },
];

// PDF.js CDN URL
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

// MathJax + pdfjsLib global
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      startup?: { typeset?: boolean };
    };
    pdfjsLib?: any;
  }
}

// ============================================
// PARSE TEXT → CÂU HỎI
// ============================================
interface ParsedQuestion {
  content: string;
  options?: string[];
  answer: string;
  selected: boolean; // cho preview checkbox
}

function parseTextToQuestions(text: string): ParsedQuestion[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Pattern cho đầu câu hỏi:
  // Câu 1:, Câu 1., Câu 1), Bài 1:, Bài 1., 1., 1), Câu hỏi 1:, Question 1:
  const questionPattern = /(?:^|\n)\s*(?:Câu\s*(?:hỏi)?\s*|Bài\s*|Question\s*)?(?:(\d+))\s*[.:)]/gi;

  const matches: { index: number; num: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = questionPattern.exec(normalized)) !== null) {
    matches.push({ index: match.index, num: match[1] });
  }

  if (matches.length === 0) {
    // Fallback: thử tách theo dòng trống
    const paragraphs = normalized.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    if (paragraphs.length > 0) {
      return paragraphs.map(p => ({
        content: p.trim(),
        options: undefined,
        answer: '',
        selected: true,
      }));
    }
    return [];
  }

  const questions: ParsedQuestion[] = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    let block = normalized.substring(start, end).trim();

    // Tách phương án A/B/C/D
    const optionPattern = /(?:^|\n)\s*([A-D])[.):)]\s*(.+)/gi;
    const options: string[] = [];
    let optMatch: RegExpExecArray | null;
    const optionsCopy = block; // keep original for option extraction
    while ((optMatch = optionPattern.exec(optionsCopy)) !== null) {
      options.push(`${optMatch[1]}. ${optMatch[2].trim()}`);
    }

    // Tách đáp án nếu có pattern: "Đáp án: X", "ĐA: X", "Đáp án đúng: X"
    let answer = '';
    const answerPattern = /(?:Đáp\s*án(?:\s*đúng)?|ĐA)\s*[.:)]?\s*([A-D]|.{1,200})/i;
    const answerMatch = block.match(answerPattern);
    if (answerMatch) {
      answer = answerMatch[1].trim();
      // Xóa phần đáp án khỏi nội dung
      block = block.replace(answerMatch[0], '').trim();
    }

    // Nội dung câu hỏi: loại bỏ phần phương án
    let content = block;
    if (options.length > 0) {
      // Tìm vị trí bắt đầu phương án A
      const firstOptMatch = block.match(/(?:^|\n)\s*A[.):)]\s*/m);
      if (firstOptMatch && firstOptMatch.index !== undefined) {
        content = block.substring(0, firstOptMatch.index).trim();
      }
    }

    // Bỏ phần lời giải/hướng dẫn nếu có
    const solutionPattern = /(?:Lời\s*giải|Hướng\s*dẫn|Giải)[.:]/i;
    const solMatch = content.match(solutionPattern);
    if (solMatch && solMatch.index !== undefined && solMatch.index > 30) {
      const beforeSolution = content.substring(0, solMatch.index).trim();
      const afterSolution = content.substring(solMatch.index).trim();
      content = beforeSolution;
      if (!answer) answer = afterSolution;
    }

    if (content.length > 5) {
      questions.push({
        content,
        options: options.length > 0 ? options : undefined,
        answer,
        selected: true,
      });
    }
  }

  return questions;
}

// Load PDF.js từ CDN
async function loadPdfJs(): Promise<void> {
  if (window.pdfjsLib) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
        resolve();
      } else {
        reject(new Error('Không thể tải PDF.js'));
      }
    };
    script.onerror = () => reject(new Error('Không thể tải PDF.js từ CDN'));
    document.head.appendChild(script);
  });
}

// Trích xuất text từ PDF
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  await loadPdfJs();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    pages.push(pageText);
  }
  return pages.join('\n\n');
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function loadQuestions(): BankQuestion[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveQuestions(questions: BankQuestion[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {
    alert('Lỗi lưu dữ liệu: localStorage đầy. Hãy xóa bớt câu hỏi cũ.');
  }
}

// ============================================
// COMPONENT
// ============================================
interface QuestionBankProps {
  onClose: () => void;
}

export const QuestionBank: React.FC<QuestionBankProps> = ({ onClose }) => {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<'all' | '10' | '12'>('all');
  const [filterLevel, setFilterLevel] = useState<'all' | BankQuestion['level']>('all');
  const [filterTopic, setFilterTopic] = useState('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formContent, setFormContent] = useState('');
  const [formOptions, setFormOptions] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formSubject, setFormSubject] = useState('Toán');
  const [formTopic, setFormTopic] = useState(getTopicsForSubject('Toán')[0]);
  const [formGrade, setFormGrade] = useState<'10' | '12'>('10');
  const [formLevel, setFormLevel] = useState<BankQuestion['level']>('NB');
  const [formTags, setFormTags] = useState('');

  // File import state
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [importParsedQuestions, setImportParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importGrade, setImportGrade] = useState<'10' | '12'>('10');
  const [importLevel, setImportLevel] = useState<BankQuestion['level']>('NB');
  const [importSubject, setImportSubject] = useState('Toán');
  const [importTopic, setImportTopic] = useState(getTopicsForSubject('Toán')[0]);
  const [importFileName, setImportFileName] = useState('');
  const fileImportRef = useRef<HTMLInputElement>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  // Load questions on mount
  useEffect(() => {
    setQuestions(loadQuestions());
  }, []);

  // MathJax rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.MathJax?.typesetPromise && previewRef.current) {
        window.MathJax.typesetPromise([previewRef.current]).catch(() => {});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formContent, questions, searchQuery]);

  // ============================================
  // CRUD
  // ============================================
  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormContent('');
    setFormOptions('');
    setFormAnswer('');
    setFormSubject('Toán');
    setFormTopic(getTopicsForSubject('Toán')[0]);
    setFormGrade('10');
    setFormLevel('NB');
    setFormTags('');
  };

  const handleSave = () => {
    if (!formContent.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    const now = new Date().toISOString();
    const optionsArr = formOptions
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);
    const tagsArr = formTags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    if (editingId) {
      // Update
      const updated = questions.map(q =>
        q.id === editingId
          ? {
              ...q,
              content: formContent.trim(),
              options: optionsArr.length > 0 ? optionsArr : undefined,
              answer: formAnswer.trim(),
              subject: formSubject,
              topic: formTopic,
              grade: formGrade,
              level: formLevel,
              tags: tagsArr,
              updatedAt: now,
            }
          : q
      );
      setQuestions(updated);
      saveQuestions(updated);
    } else {
      // Create
      const newQ: BankQuestion = {
        id: generateId(),
        content: formContent.trim(),
        options: optionsArr.length > 0 ? optionsArr : undefined,
        answer: formAnswer.trim(),
        subject: formSubject,
        topic: formTopic,
        grade: formGrade,
        level: formLevel,
        tags: tagsArr,
        createdAt: now,
        updatedAt: now,
      };
      const updated = [newQ, ...questions];
      setQuestions(updated);
      saveQuestions(updated);
    }

    resetForm();
  };

  const handleEdit = (q: BankQuestion) => {
    setIsEditing(true);
    setEditingId(q.id);
    setFormContent(q.content);
    setFormOptions(q.options?.join('\n') || '');
    setFormAnswer(q.answer);
    setFormSubject(q.subject || 'Toán');
    setFormTopic(q.topic);
    setFormGrade(q.grade);
    setFormLevel(q.level);
    setFormTags(q.tags.join(', '));
  };

  const handleDelete = (id: string) => {
    if (!confirm('Xóa câu hỏi này?')) return;
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    saveQuestions(updated);
  };

  // ============================================
  // IMPORT / EXPORT
  // ============================================
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ngan_hang_cau_hoi_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported: BankQuestion[] = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(imported)) throw new Error('Không phải mảng');
        const valid = imported.filter(q => q.id && q.content);
        const merged = [...valid, ...questions];
        // Remove duplicates by id
        const unique = merged.filter((q, i, arr) => arr.findIndex(x => x.id === q.id) === i);
        setQuestions(unique);
        saveQuestions(unique);
        alert(`Đã import ${valid.length} câu hỏi.`);
      } catch {
        alert('File JSON không hợp lệ.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ============================================
  // IMPORT TỪ FILE WORD / PDF
  // ============================================
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsImportingFile(true);
    setImportFileName(file.name);

    try {
      let extractedText = '';

      const isDocx = file.name.toLowerCase().endsWith('.docx') ||
        file.name.toLowerCase().endsWith('.doc') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword';

      const isPdf = file.name.toLowerCase().endsWith('.pdf') ||
        file.type === 'application/pdf';

      if (isDocx) {
        // Trích xuất text có chứa công thức LaTeX từ MathType/OMML
        const result = await parseDocxWithMath(file);
        if (result) {
            extractedText = result.text;
        } else {
            extractedText = '';
        }
      } else if (isPdf) {
        // Dùng PDF.js trích xuất text từ PDF
        const arrayBuffer = await file.arrayBuffer();
        extractedText = await extractTextFromPdf(arrayBuffer);
      } else {
        alert('Chỉ hỗ trợ file .docx và .pdf');
        setIsImportingFile(false);
        return;
      }

      if (!extractedText || extractedText.trim().length < 10) {
        alert(`File "${file.name}" không có nội dung hoặc không đọc được text.`);
        setIsImportingFile(false);
        return;
      }

      // Parse text thành câu hỏi
      const parsed = parseTextToQuestions(extractedText);

      if (parsed.length === 0) {
        alert(`Không tìm thấy câu hỏi nào trong file "${file.name}". Hãy đảm bảo câu hỏi được đánh số (VD: Câu 1, Câu 2...).`);
        setIsImportingFile(false);
        return;
      }

      setImportParsedQuestions(parsed);
      setShowImportPreview(true);
    } catch (err: any) {
      alert(`Lỗi đọc file: ${err.message || 'Không rõ nguyên nhân'}`);
    } finally {
      setIsImportingFile(false);
    }
  };

  // Toggle chọn câu hỏi trong preview
  const toggleImportQuestion = (index: number) => {
    setImportParsedQuestions(prev =>
      prev.map((q, i) => i === index ? { ...q, selected: !q.selected } : q)
    );
  };

  const toggleAllImportQuestions = () => {
    const allSelected = importParsedQuestions.every(q => q.selected);
    setImportParsedQuestions(prev =>
      prev.map(q => ({ ...q, selected: !allSelected }))
    );
  };

  // Xác nhận import câu hỏi đã chọn
  const confirmImport = () => {
    const now = new Date().toISOString();
    const selected = importParsedQuestions.filter(q => q.selected);

    if (selected.length === 0) {
      alert('Vui lòng chọn ít nhất 1 câu hỏi để import.');
      return;
    }

    const newQuestions: BankQuestion[] = selected.map(q => ({
      id: generateId(),
      content: q.content,
      options: q.options,
      answer: q.answer,
      subject: importSubject,
      topic: importTopic,
      grade: importGrade,
      level: importLevel,
      tags: [],
      createdAt: now,
      updatedAt: now,
    }));

    const updated = [...newQuestions, ...questions];
    setQuestions(updated);
    saveQuestions(updated);
    setShowImportPreview(false);
    setImportParsedQuestions([]);
    alert(`Đã import ${selected.length} câu hỏi từ file "${importFileName}" vào ngân hàng.`);
  };

  // ============================================
  // FILTER
  // ============================================
  const filteredQuestions = questions.filter(q => {
    if (filterGrade !== 'all' && q.grade !== filterGrade) return false;
    if (filterLevel !== 'all' && q.level !== filterLevel) return false;
    if (filterTopic !== 'all' && q.topic !== filterTopic) return false;
    if (filterSubject !== 'all' && (q.subject || 'Toán') !== filterSubject) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        q.content.toLowerCase().includes(query) ||
        q.answer.toLowerCase().includes(query) ||
        q.topic.toLowerCase().includes(query) ||
        (q.subject || '').toLowerCase().includes(query) ||
        q.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const levelInfo = useCallback(
    (level: BankQuestion['level']) => LEVELS.find(l => l.value === level) || LEVELS[0],
    []
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-[600px]" ref={previewRef}>
      {/* ====== MODAL PREVIEW IMPORT ====== */}
      {showImportPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2">
                📄 Import câu hỏi từ file
              </h3>
              <p className="text-sm text-amber-100 mt-1">
                {importFileName} — Tìm thấy {importParsedQuestions.length} câu hỏi
              </p>
            </div>

            {/* Thiết lập chung */}
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 shrink-0">
              <p className="text-xs font-semibold text-slate-700 mb-2">Thiết lập chung cho tất cả câu import:</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Môn học</label>
                  <select
                    value={importSubject}
                    onChange={(e) => {
                      setImportSubject(e.target.value);
                      setImportTopic(getTopicsForSubject(e.target.value)[0]);
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs focus:border-amber-500 outline-none"
                  >
                    {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Chủ đề</label>
                  <select
                    value={importTopic}
                    onChange={(e) => setImportTopic(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs focus:border-amber-500 outline-none"
                  >
                    {getTopicsForSubject(importSubject).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Khối lớp</label>
                  <select
                    value={importGrade}
                    onChange={(e) => setImportGrade(e.target.value as '10' | '12')}
                    className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs focus:border-amber-500 outline-none"
                  >
                    <option value="10">Lớp 10 (Vào 10)</option>
                    <option value="12">Lớp 12 (TN THPT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Mức độ</label>
                  <select
                    value={importLevel}
                    onChange={(e) => setImportLevel(e.target.value as BankQuestion['level'])}
                    className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs focus:border-amber-500 outline-none"
                  >
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Chọn tất cả / bỏ chọn */}
            <div className="px-5 py-2 flex items-center justify-between border-b border-slate-200 shrink-0">
              <button
                type="button"
                onClick={toggleAllImportQuestions}
                className="text-xs font-medium text-amber-600 hover:text-amber-800 underline"
              >
                {importParsedQuestions.every(q => q.selected) ? '☑ Bỏ chọn tất cả' : '☐ Chọn tất cả'}
              </button>
              <span className="text-xs text-slate-500">
                Đã chọn {importParsedQuestions.filter(q => q.selected).length} / {importParsedQuestions.length}
              </span>
            </div>

            {/* Danh sách câu hỏi preview */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {importParsedQuestions.map((q, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    q.selected
                      ? 'border-amber-400 bg-amber-50/60 ring-1 ring-amber-300/40'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={q.selected}
                    onChange={() => toggleImportQuestion(i)}
                    className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-400 mb-0.5">Câu {i + 1}</p>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{q.content}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-1.5 pl-3 border-l-2 border-slate-200 space-y-0.5">
                        {q.options.map((opt, j) => (
                          <p key={j} className="text-xs text-slate-600">{opt}</p>
                        ))}
                      </div>
                    )}
                    {q.answer && (
                      <p className="text-[10px] text-emerald-600 mt-1 font-medium">📌 Đáp án: {q.answer}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* Footer buttons */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
              <button
                onClick={() => { setShowImportPreview(false); setImportParsedQuestions([]); }}
                className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 font-medium text-sm transition-colors"
              >
                ✖ Hủy
              </button>
              <button
                onClick={confirmImport}
                disabled={importParsedQuestions.filter(q => q.selected).length === 0}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✔ Import {importParsedQuestions.filter(q => q.selected).length} câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-teal-900 flex items-center gap-2">
            📚 Ngân Hàng Câu Hỏi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {questions.length} câu hỏi • Dữ liệu lưu trên trình duyệt
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className={`text-xs px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium ${
            isImportingFile ? 'bg-amber-400 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}>
            {isImportingFile ? '⏳ Đang đọc...' : '📄 Import File'}
            <input
              ref={fileImportRef}
              type="file"
              accept=".docx,.doc,.pdf"
              onChange={handleImportFile}
              disabled={isImportingFile}
              className="hidden"
            />
          </label>
          <label className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium">
            📥 Import JSON
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
          <button
            onClick={handleExportJSON}
            disabled={questions.length === 0}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors font-medium disabled:opacity-50"
          >
            📤 Export
          </button>
          <button
            onClick={onClose}
            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-md transition-colors font-medium"
          >
            ← Về Tạo Đề
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Form thêm/sửa câu hỏi */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl shadow-md border border-teal-100 p-5">
            <h3 className="font-bold text-sm text-teal-800 mb-4">
              {editingId ? '✏️ Sửa câu hỏi' : '➕ Thêm câu hỏi mới'}
            </h3>

            {/* Nội dung câu hỏi */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nội dung câu hỏi <span className="text-slate-400">(hỗ trợ LaTeX: $x^2$)</span>
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={4}
                placeholder="VD: Tìm giá trị lớn nhất của hàm số $y = x^3 - 3x + 2$ trên đoạn $[-2, 2]$"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 px-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
              />
            </div>

            {/* Phương án (optional) */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phương án <span className="text-slate-400">(mỗi dòng 1 phương án, bỏ trống nếu tự luận)</span>
              </label>
              <textarea
                value={formOptions}
                onChange={(e) => setFormOptions(e.target.value)}
                rows={2}
                placeholder={"A. $y = 4$\nB. $y = 6$\nC. $y = 8$\nD. $y = 10$"}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 px-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
              />
            </div>

            {/* Đáp án */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đáp án / Lời giải
              </label>
              <textarea
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                rows={2}
                placeholder="VD: Đáp án C. Ta có $y' = 3x^2 - 3 = 0 \Rightarrow x = \pm 1$..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 px-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
              />
            </div>

            {/* Row: Môn học + Chủ đề + Khối lớp + Mức độ */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Môn học</label>
                <select
                  value={formSubject}
                  onChange={(e) => {
                    setFormSubject(e.target.value);
                    setFormTopic(getTopicsForSubject(e.target.value)[0]);
                  }}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
                >
                  {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Chủ đề</label>
                <select
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
                >
                  {getTopicsForSubject(formSubject).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Khối lớp</label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value as '10' | '12')}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
                >
                  <option value="10">Lớp 10 (Vào 10)</option>
                  <option value="12">Lớp 12 (TN THPT)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">Mức độ</label>
                <select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value as BankQuestion['level'])}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
                >
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Tags <span className="text-slate-400">(cách nhau bởi dấu phẩy)</span></label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="VD: PT bậc 2, Viète, thực tế"
                className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 px-2 text-xs focus:border-teal-500 outline-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg font-bold text-xs transition-all shadow-md"
              >
                {editingId ? '💾 Cập nhật' : '➕ Thêm câu hỏi'}
              </button>
              {isEditing && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                >
                  Hủy
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Danh sách câu hỏi */}
        <div className="lg:col-span-7">
          {/* Search & filters */}
          <div className="bg-white rounded-xl shadow-md border border-teal-100 p-4 mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Tìm kiếm câu hỏi..."
                className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-slate-50 py-2 px-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="rounded-md border border-slate-300 bg-slate-50 py-2 px-2 text-xs focus:border-teal-500 outline-none"
              >
                <option value="all">Tất cả môn</option>
                {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value as any)}
                className="rounded-md border border-slate-300 bg-slate-50 py-2 px-2 text-xs focus:border-teal-500 outline-none"
              >
                <option value="all">Tất cả lớp</option>
                <option value="10">Lớp 10</option>
                <option value="12">Lớp 12</option>
              </select>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as any)}
                className="rounded-md border border-slate-300 bg-slate-50 py-2 px-2 text-xs focus:border-teal-500 outline-none"
              >
                <option value="all">Tất cả mức độ</option>
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <select
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                className="rounded-md border border-slate-300 bg-slate-50 py-2 px-2 text-xs focus:border-teal-500 outline-none"
              >
                <option value="all">Tất cả chủ đề</option>
                {Array.from(new Set(questions.map(q => q.topic))).sort().map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Hiển thị {filteredQuestions.length} / {questions.length} câu hỏi
            </p>
          </div>

          {/* Question list */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-teal-200 p-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm font-semibold text-slate-600">
                  {questions.length === 0 ? 'Chưa có câu hỏi nào' : 'Không tìm thấy câu hỏi phù hợp'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {questions.length === 0 ? 'Thêm câu hỏi bằng form bên trái hoặc Import JSON' : 'Thử thay đổi bộ lọc'}
                </p>
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const lv = levelInfo(q.level);
                return (
                  <div key={q.id} className="bg-white rounded-xl shadow-sm border border-teal-100 p-4 hover:shadow-md transition-shadow">
                    {/* Header: tags + actions */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lv.color}`}>
                          {lv.label}
                        </span>
                        {q.subject && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                            {SUBJECTS.find(s => s.id === q.subject)?.icon || '📚'} {q.subject}
                          </span>
                        )}
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Lớp {q.grade}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                          {q.topic}
                        </span>
                        {q.tags.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500">
                            #{t}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleEdit(q)}
                          className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors font-medium"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="text-[10px] px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 rounded transition-colors font-medium"
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{q.content}</p>

                    {/* Options */}
                    {q.options && q.options.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-0.5">
                        {q.options.map((opt, i) => (
                          <p key={i} className="text-xs text-slate-600">{opt}</p>
                        ))}
                      </div>
                    )}

                    {/* Answer (collapsible) */}
                    {q.answer && (
                      <details className="mt-2">
                        <summary className="text-xs font-semibold text-emerald-600 cursor-pointer hover:text-emerald-700">
                          📌 Xem đáp án
                        </summary>
                        <p className="text-xs text-slate-600 mt-1 pl-3 border-l-2 border-emerald-200 whitespace-pre-wrap">
                          {q.answer}
                        </p>
                      </details>
                    )}

                    {/* Date */}
                    <p className="text-[9px] text-slate-400 mt-2">
                      {new Date(q.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
