import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export interface FlashcardQuestion {
  number: number;
  text: string;
  options: string[];
  answerText: string;
}

interface FlashcardGameProps {
  questions: FlashcardQuestion[];
  onClose: () => void;
}

export const FlashcardGame: React.FC<FlashcardGameProps> = ({ questions, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Không tìm thấy câu hỏi</h2>
          <button onClick={onClose} className="px-6 py-2 bg-slate-200 rounded-lg text-slate-700 font-medium">Đóng</button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
      {/* Header */}
      <div className="absolute top-6 left-0 w-full px-6 flex justify-between items-center text-white">
        <div>
          <h2 className="text-2xl font-bold text-amber-400">Flashcard Luyện Tập</h2>
          <p className="text-slate-300 text-sm">Câu {currentIndex + 1} / {questions.length}</p>
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Card Area */}
      <div className="relative w-full max-w-2xl aspect-[4/3] sm:aspect-[16/9] perspective-1000 mt-12">
        <div 
          className={`w-full h-full relative transition-transform duration-500 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Mặt trước: Câu hỏi */}
          <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl border-4 border-amber-200 p-6 flex flex-col">
             <div className="border-b border-amber-100 pb-3 mb-4 flex justify-between items-center text-amber-500 font-bold">
                 <span>MẶT TRƯỚC</span>
                 <span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4l3-9 5 18 3-9h5"/></svg></span>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar prose prose-slate">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                   {`**Câu ${currentQ.number}:** ${currentQ.text}`}
                </ReactMarkdown>
                {currentQ.options.length > 0 && (
                   <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {currentQ.options.map((opt, i) => (
                       <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm font-medium">
                         {opt}
                       </div>
                     ))}
                   </div>
                )}
             </div>
             <div className="mt-4 pt-4 border-t border-slate-100 text-center text-sm text-slate-400">
                Chạm vào thẻ để xem đáp án
             </div>
          </div>

          {/* Mặt sau: Đáp án */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl shadow-2xl border-4 border-emerald-200 p-6 flex flex-col">
             <div className="border-b border-emerald-200 pb-3 mb-4 flex justify-between items-center text-emerald-600 font-bold">
                 <span>MẶT SAU (LỜI GIẢI)</span>
                 <span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>
             </div>
             <div className="flex-1 overflow-auto custom-scrollbar prose prose-slate">
                {currentQ.answerText ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                       {currentQ.answerText}
                    </ReactMarkdown>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 italic">
                        Chưa có lời giải cho câu hỏi này.
                    </div>
                )}
             </div>
             <div className="mt-4 pt-4 border-t border-emerald-100/50 text-center text-sm text-slate-400">
                Chạm để quay lại mặt trước
             </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 mt-12">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="p-4 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white rounded-full transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div className="text-white font-bold tracking-widest px-4">
          <span className="text-amber-400 text-xl">{currentIndex + 1}</span> <span className="text-slate-400">/</span> {questions.length}
        </div>
        <button 
          onClick={handleNext}
          disabled={currentIndex === questions.length - 1}
          className="p-4 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white rounded-full transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}} />
    </div>
  );
};
