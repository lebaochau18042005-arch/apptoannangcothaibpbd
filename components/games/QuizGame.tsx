import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FlashcardQuestion } from './FlashcardGame';

interface QuizGameProps {
  questions: FlashcardQuestion[];
  onClose: () => void;
}

export const QuizGame: React.FC<QuizGameProps> = ({ questions, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null);
  const [shakeIndex, setShakeIndex] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);

  // Chỉ lấy những câu hỏi CÓ TÙY CHỌN (Trắc nghiệm)
  const quizQuestions = questions.filter(q => q.options.length > 0);

  useEffect(() => {
     if (quizQuestions.length > 0 && currentIndex < quizQuestions.length) {
         // Auto-detect correct option from answerText
         const currentQ = quizQuestions[currentIndex];
         let foundCorrect = -1;
         
         // Thử tìm trong answerText các chữ "Đáp án A", "Chọn B", v.v.
         // Pattern phổ biến: "Đáp án: A", "=> A", "Chọn: A"
         const answerMatch = currentQ.answerText.match(/(?:Đáp\s*án|Chọn|=>|▶)\s*[:.\-]?\s*([A-D])/i);
         if (answerMatch) {
             const letter = answerMatch[1].toUpperCase();
             foundCorrect = currentQ.options.findIndex(opt => opt.trim().toUpperCase().startsWith(letter + '.'));
         } else {
             // Nếu không thấy pattern rõ ràng, thử tìm một ký tự A/B/C/D duy nhất nổi bật
             const backupMatch = currentQ.answerText.match(/\b([A-D])\b/i);
             if (backupMatch) {
                 const letter = backupMatch[1].toUpperCase();
                 foundCorrect = currentQ.options.findIndex(opt => opt.trim().toUpperCase().startsWith(letter + '.'));
             }
         }
         
         setCorrectOptionIndex(foundCorrect);
     }
     setTimer(30); // reset timer khi đổi câu
  }, [currentIndex, quizQuestions]);

  // Timer đếm ngược
  useEffect(() => {
    if (isRevealed || isFinished) return;
    if (timer <= 0) {
      setIsRevealed(true); // hết giờ -> tự reveal
      return;
    }
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer, isRevealed, isFinished]);

  if (!quizQuestions || quizQuestions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Không có câu trắc nghiệm</h2>
          <p className="text-slate-500 mb-6 text-sm">Trò chơi Quiz chỉ hỗ trợ các câu hỏi loại có đáp án A, B, C, D.</p>
          <button onClick={onClose} className="px-6 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-white font-medium">Đóng</button>
        </div>
      </div>
    );
  }

  const currentQ = quizQuestions[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isRevealed) return;
    setSelectedOption(idx);
    setIsRevealed(true);

    if (correctOptionIndex === idx) {
      setScore(prev => prev + 1);
    } else {
      // Shake animation khi sai
      setShakeIndex(idx);
      setTimeout(() => setShakeIndex(null), 600);
    }
  };

  const handleNext = () => {
    if (currentIndex < quizQuestions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsRevealed(false);
    } else {
        setIsFinished(true);
    }
  };

  const OptionLabel = ["A", "B", "C", "D", "E", "F"];

  if (isFinished) {
    const percentage = Math.round((score / quizQuestions.length) * 100);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-md">
        <div className="bg-white p-8 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-b-[50%] -translate-y-8"></div>
          <div className="relative z-10">
            <h2 className="text-4xl mb-4 mt-6">🏆</h2>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Kết Quả Quiz</h2>
            <p className="text-slate-500 mb-8">Tuyệt vời! Bạn đã hoàn thành bài kiểm tra.</p>
            
            <div className="flex justify-center items-center gap-6 mb-8">
               <div className="text-center">
                  <div className="text-5xl font-black text-indigo-600 mb-1">{score}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Câu Đúng</div>
               </div>
               <div className="w-px h-16 bg-slate-200"></div>
               <div className="text-center">
                  <div className={`text-5xl font-black mb-1 ${percentage >= 80 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{percentage}%</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Độ Chính Xác</div>
               </div>
            </div>

            <button 
              onClick={onClose} 
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 rounded-xl text-white font-bold transition-all transform hover:scale-[1.02]"
            >
              Trở về màn hình kết quả
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header Bar */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
         <div className="flex items-center gap-4">
             <button onClick={onClose} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
             <h2 className="font-bold text-slate-800 text-lg hidden sm:block">Trò chơi Trắc Nghiệm</h2>
         </div>

         {/* Timer + Score + Progress */}
         <div className="flex-1 max-w-md mx-6">
            <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Tiến độ</span>
                <span>{currentIndex + 1} / {quizQuestions.length}</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${((currentIndex) / quizQuestions.length) * 100}%` }}
                ></div>
            </div>
         </div>

         {/* Timer Ring */}
         <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 font-black text-sm transition-colors ${
           timer <= 5 ? 'border-rose-400 text-rose-600 animate-pulse' : timer <= 10 ? 'border-amber-400 text-amber-600' : 'border-indigo-300 text-indigo-600'
         }`}>
           {timer}
         </div>

         <div className="font-black text-indigo-600 text-xl tracking-tighter">
             {score} <span className="text-sm font-bold text-slate-400 tracking-normal">điểm</span>
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-50 relative p-4 flex justify-center">
         <div className="w-full max-w-3xl mt-4 sm:mt-10 mb-24">
            
            {/* Question Card */}
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 sm:p-10 mb-6 border border-slate-100 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
               <h3 className="text-indigo-600 font-bold mb-4 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                 Câu {currentQ.number}
               </h3>
               <div className="prose prose-slate max-w-none text-lg sm:text-xl text-slate-800 leading-relaxed font-medium">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                     {currentQ.text}
                  </ReactMarkdown>
               </div>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {currentQ.options.map((opt, idx) => {
                  
                  // Bóc tách text đáp án cho hiển thị đẹp hơn
                  let optText = opt;
                  const match = opt.match(/^([A-D])[.):)]\s*(.*)/i);
                  if (match) optText = match[2];

                  // Tự động phân loại trạng thái nút bấm
                  let stateClass = "bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 shadow-sm cursor-pointer";
                  let labelClass = "bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700";
                  
                  if (isRevealed) {
                      stateClass = "bg-white border-slate-200 text-slate-500 opacity-60 cursor-default";
                      labelClass = "bg-slate-100 text-slate-500";
                      
                      // Nút đúng
                      if (idx === correctOptionIndex || (correctOptionIndex === -1 && idx === selectedOption)) {
                          stateClass = "bg-emerald-50 border-emerald-500 text-emerald-800 ring-4 ring-emerald-500/20 shadow-md cursor-default z-10";
                          labelClass = "bg-emerald-500 text-white";
                      } 
                      // Nút bị chọn sai
                      else if (idx === selectedOption) {
                          stateClass = "bg-rose-50 border-rose-500 text-rose-800 ring-4 ring-rose-500/20 shadow-md cursor-default z-10";
                          labelClass = "bg-rose-500 text-white";
                      }
                  }

                  return (
                    <div 
                       key={idx} 
                       onClick={() => handleSelectOption(idx)}
                       className={`group relative p-4 flex items-center gap-4 rounded-2xl border-2 transition-all duration-200 ${stateClass} ${
                          shakeIndex === idx ? 'animate-[shake_0.5s_ease]' : ''
                        }`}
                    >
                       <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black text-lg transition-colors ${labelClass}`}>
                          {OptionLabel[idx] || match?.[1] || "?"}
                       </div>
                       <span className="font-medium text-[15px] sm:text-base leading-snug">
                          {optText}
                       </span>
                    </div>
                  );
               })}
            </div>

            {/* Answer Explanation */}
            {isRevealed && currentQ.answerText && (
               <div className="mt-8 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/50 animate-[fadeIn_0.3s_ease-out]">
                   <div className="px-5 py-3 bg-indigo-100 border-b border-indigo-200 flex items-center gap-2 text-indigo-800 font-bold text-sm">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                       Lời giải chi tiết
                   </div>
                   <div className="p-5 prose prose-slate prose-sm text-slate-700">
                       <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                           {currentQ.answerText}
                       </ReactMarkdown>
                   </div>
               </div>
            )}

         </div>
      </div>

      {/* Footer controls */}
      {isRevealed && (
          <div className="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 flex justify-center z-20 animate-[slideUp_0.3s_ease-out]">
              <button 
                  onClick={handleNext}
                  className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 transition-all flex items-center gap-2"
              >
                  {currentIndex < quizQuestions.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
          </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}} />

    </div>
  );
};
