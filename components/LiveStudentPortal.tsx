import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface LiveStudentPortalProps {
  onBack: () => void;
}

export const LiveStudentPortal: React.FC<LiveStudentPortalProps> = ({ onBack }) => {
  const [roomId, setRoomId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [examData, setExamData] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const handleConnect = (e: React.FormEvent) => {
      e.preventDefault();
      if (!roomId || !studentName) return;

      setStatus('connecting');
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', () => {
          const conn = peer.connect('EDU-' + roomId);
          connRef.current = conn;

          conn.on('open', () => {
              setStatus('connected');
              conn.send({ type: 'JOIN', name: studentName });
          });

          conn.on('data', (data: any) => {
              if (data.type === 'EXAM_DATA') {
                  setExamData(data.payload);
              }
          });

          conn.on('close', () => {
              setStatus('error');
              alert('Giáo viên đã đóng phòng thi hoặc mất kết nối!');
          });
          
          conn.on('error', () => {
              setStatus('error');
          });
      });

      peer.on('error', (err) => {
          console.error(err);
          setStatus('error');
      });
  };

  const handleSelectOption = (optIdx: number) => {
      setSelectedAnswers(prev => ({ ...prev, [currentIndex]: optIdx }));
      if (connRef.current) {
          connRef.current.send({
              type: 'ANSWER',
              questionIndex: currentIndex,
              optionIndex: optIdx
          });
      }
      
      // Auto move to next question after 0.4s
      setTimeout(() => {
          if (currentIndex < examData.length - 1) {
              setCurrentIndex(prev => prev + 1);
          }
      }, 400);
  };

  if (status === 'idle' || status === 'error') {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
               <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                   <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-xl"></div>
                       <button onClick={onBack} className="absolute top-4 left-4 text-white/70 hover:text-white p-2">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                       </button>
                       <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-lg transform rotate-3 mb-4">
                           <span className="text-4xl">👩‍🎓</span>
                       </div>
                       <h2 className="text-2xl font-bold text-white relative z-10">Vào Phòng Thi</h2>
                       <p className="text-indigo-200 text-sm mt-1 mb-2 relative z-10">Nhập mã phòng từ giáo viên để bắt đầu</p>
                   </div>
                   
                   <form onSubmit={handleConnect} className="p-8">
                       {status === 'error' && (
                           <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">
                               Không thể kết nối. Kiểm tra lại Mã Phòng!
                           </div>
                       )}
                       
                       <div className="space-y-4 mb-6">
                           <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mã Phòng Thi (Code)</label>
                               <input 
                                  type="text" 
                                  value={roomId}
                                  onChange={e => setRoomId(e.target.value)}
                                  placeholder="Ví dụ: 1234"
                                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-slate-800 text-center tracking-widest text-xl transition-colors"
                                  autoFocus
                                  required
                               />
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Họ Tên Học Sinh</label>
                               <input 
                                  type="text" 
                                  value={studentName}
                                  onChange={e => setStudentName(e.target.value)}
                                  placeholder="Nhập tên của bạn..."
                                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-medium text-slate-800 transition-colors"
                                  required
                               />
                           </div>
                       </div>
                       
                       <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-600/30">
                           KẾT NỐI VÀ LÀM BÀI
                       </button>
                   </form>
               </div>
          </div>
      );
  }

  if (status === 'connecting') {
      return (
          <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-4 text-white">
              <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h2 className="text-xl font-bold">Đang kết nối...</h2>
              <p className="opacity-80 mt-2">Vui lòng chờ lấy dữ liệu đề thi.</p>
          </div>
      );
  }

  // Đã kết nối nhưng chưa có data
  if (examData.length === 0) {
      return (
          <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-4 text-white text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Kết nối thành công!</h2>
              <p className="opacity-80">Đang nhận dữ liệu đề thi từ giáo viên...</p>
          </div>
      );
  }

  // Màn hình làm bài (Quiz)
  const currentQ = examData[currentIndex];
  const OptionLabel = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       {/* Header */}
       <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shrink-0">
           <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                   {studentName.substring(0,2)}
               </div>
               <div>
                   <div className="text-sm font-bold text-slate-800 line-clamp-1">{studentName}</div>
                   <div className="text-[10px] uppercase font-bold text-slate-400">Phòng: {roomId}</div>
               </div>
           </div>
           
           {/* Progress */}
           <div className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
               {currentIndex + 1} / {examData.length}
           </div>
       </div>

       {/* Question Area */}
       <div className="flex-1 overflow-auto p-4 flex justify-center pb-24">
           <div className="w-full max-w-2xl mt-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 mb-6 animate-[fadeIn_0.3s_ease-out]">
                 <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-4">Câu {currentQ.number}</h3>
                 <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed font-medium sm:text-lg">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                       {currentQ.text}
                    </ReactMarkdown>
                 </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                 {currentQ.options.map((opt: string, idx: number) => {
                    let optText = opt;
                    const match = opt.match(/^([A-D])[.):)]\s*(.*)/i);
                    if (match) optText = match[2];

                    const isSelected = selectedAnswers[currentIndex] === idx;

                    return (
                        <div 
                           key={idx} 
                           onClick={() => handleSelectOption(idx)}
                           className={`group relative p-4 flex items-center gap-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                               isSelected 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-sm ring-2 ring-indigo-500/20' 
                                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                           }`}
                        >
                           <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center font-black transition-colors ${
                               isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                           }`}>
                              {OptionLabel[idx] || match?.[1] || "?"}
                           </div>
                           <span className="font-medium text-sm sm:text-base leading-snug">
                              {optText}
                           </span>
                        </div>
                    );
                 })}
              </div>
           </div>
       </div>

       {/* Bottom Controls */}
       <div className="fixed bottom-0 w-full bg-white border-t border-slate-200 p-4 flex justify-between items-center z-10 max-w-7xl inset-x-0 mx-auto">
          <button 
             onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
             disabled={currentIndex === 0}
             className="px-6 py-3 rounded-lg font-bold text-sm bg-slate-100 text-slate-500 disabled:opacity-50 hover:bg-slate-200 transition-colors"
          >
             X Bỏ qua / Câu trước
          </button>
          {currentIndex < examData.length - 1 ? (
              <button 
                 onClick={() => setCurrentIndex(prev => prev + 1)}
                 className="px-6 py-3 rounded-lg font-bold text-sm bg-indigo-600 text-white shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                 Câu tiếp theo <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </button>
          ) : (
              <div className="px-6 py-3 rounded-lg font-bold text-sm bg-emerald-500 text-white shadow-md">
                 🎉 Đã đến câu cuối!
              </div>
          )}
       </div>

       <style dangerouslySetInnerHTML={{__html: `@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}} />
    </div>
  );
};
