import React, { useEffect, useState, useRef } from 'react';
import Peer from 'peerjs';
import { FlashcardQuestion } from './games/FlashcardGame';

interface LiveMonitorProps {
  questions: FlashcardQuestion[];
  onClose: () => void;
}

interface StudentState {
  id: string;
  name: string;
  answers: Record<number, number>; // index câu hỏi -> index đáp án chọn
  score: number;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({ questions, onClose }) => {
  const [peerId, setPeerId] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [students, setStudents] = useState<Record<string, StudentState>>({});
  const peerRef = useRef<Peer | null>(null);

  // Chỉ lấy câu hỏi trắc nghiệm
  const quizQuestions = questions.filter(q => q.options.length > 0);

  // Xác định dáp án đúng
  const correctOptions = quizQuestions.map(q => {
      let foundCorrect = -1;
      const answerMatch = q.answerText.match(/(?:Đáp\s*án|Chọn|=>|▶)\s*[:.\-]?\s*([A-D])/i);
      if (answerMatch) {
          const letter = answerMatch[1].toUpperCase();
          foundCorrect = q.options.findIndex(opt => opt.trim().toUpperCase().startsWith(letter + '.'));
      } else {
          const backupMatch = q.answerText.match(/\b([A-D])\b/i);
          if (backupMatch) {
              const letter = backupMatch[1].toUpperCase();
              foundCorrect = q.options.findIndex(opt => opt.trim().toUpperCase().startsWith(letter + '.'));
          }
      }
      return foundCorrect;
  });

  useEffect(() => {
    // Generate a simple numeric room ID
    const customId = Math.floor(1000 + Math.random() * 9000).toString();
    const newPeer = new Peer('EDU-' + customId);

    newPeer.on('open', (id) => {
        setPeerId(id.replace('EDU-', '')); // Hiển thị mã ngắn cho dễ nhìn
        setIsReady(true);
    });

    newPeer.on('connection', (conn) => {
        conn.on('data', (data: any) => {
            if (data.type === 'JOIN') {
                setStudents(prev => ({
                    ...prev,
                    [conn.peer]: { id: conn.peer, name: data.name, answers: {}, score: 0 }
                }));

                // Gửi cấu trúc câu hỏi cho học sinh
                conn.send({
                    type: 'EXAM_DATA',
                    payload: quizQuestions.map(q => ({
                        number: q.number,
                        text: q.text,
                        options: q.options
                    })) // KHÔNG GỬI KÈM ĐÁP ÁN (answerText)
                });
            }

            if (data.type === 'ANSWER') {
                setStudents(prev => {
                    const student = prev[conn.peer];
                    if (!student) return prev;
                    
                    const qIdx = data.questionIndex;
                    const optIdx = data.optionIndex;
                    
                    const isCorrect = correctOptions[qIdx] === optIdx;
                    
                    return {
                        ...prev,
                        [conn.peer]: {
                            ...student,
                            answers: { ...student.answers, [qIdx]: optIdx },
                            score: student.score + (isCorrect ? 1 : 0)
                        }
                    };
                });
            }
        });
    });

    peerRef.current = newPeer;

    return () => {
        newPeer.destroy();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-slate-900/90 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
        <div className="bg-slate-50 w-full max-w-6xl h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
            
            {/* Header */}
            <div className="flex justify-between items-center px-8 py-5 bg-slate-900 border-b border-slate-700 shrink-0 text-white">
                <div className="flex items-center gap-4">
                     <span className="relative flex h-4 w-4">
                        {isReady && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-4 w-4 ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                     </span>
                     <h2 className="text-xl font-bold tracking-wide">HỆ THỐNG GIÁM SÁT LỚP</h2>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-500 hover:text-white text-slate-300 rounded-full transition-colors">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Content Top */}
            <div className="p-8 pb-4 shrink-0 bg-white border-b border-slate-200">
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start justify-between">
                     <div className="flex flex-col items-center justify-center mx-auto md:mx-0 p-6 bg-slate-100 border-2 border-dashed border-indigo-300 rounded-3xl w-72">
                         <span className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">MÃ PHÒNG THI (CODE)</span>
                         <div className="text-6xl font-black text-indigo-600 tracking-wider">
                             {isReady ? peerId : "----"}
                         </div>
                     </div>
                     <div className="flex-1 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                          <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                             Hướng dẫn kết nối
                          </h3>
                          <ul className="text-sm space-y-2 text-blue-800 font-medium list-decimal pl-5">
                             <li>Học sinh truy cập vào EduGenVN.</li>
                             <li>Nhấp vào nút <strong className="bg-white px-2 py-0.5 rounded shadow-sm">Giành cho Sinh viên</strong> ở góc phải trên.</li>
                             <li>Nhập <strong>Mã phòng</strong> ở bên phải và tên học sinh.</li>
                             <li>Tiến độ đánh trắc nghiệm sẽ nhảy Real-time tại đây bên dưới.</li>
                          </ul>
                     </div>
                </div>
            </div>

            {/* Students Grid */}
            <div className="flex-1 overflow-auto bg-slate-50 p-8">
               <h3 className="text-lg font-bold text-slate-700 mb-6 uppercase tracking-wider flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                   Tiến độ Học sinh ({Object.keys(students).length})
               </h3>

               {Object.keys(students).length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-48 text-slate-400 font-medium">
                       <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="19" x2="20" y2="19"></line><line x1="4" y1="5" x2="20" y2="5"></line></svg>
                       Chưa có học sinh nào kết nối.
                   </div>
               ) : (
                   <div className="space-y-4">
                      {Object.values(students).sort((a,b) => b.score - a.score).map((student, idx) => (
                           <div key={student.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
                               <div className="flex items-center gap-4 w-48 shrink-0">
                                   <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex justify-center items-center">
                                       {idx + 1}
                                   </div>
                                   <div>
                                       <div className="font-bold text-slate-800 text-lg line-clamp-1">{student.name}</div>
                                       <div className="text-xs font-bold text-slate-500 uppercase">Code: {student.id.substring(0,6)}</div>
                                   </div>
                               </div>
                               <div className="flex-1 flex gap-2 flex-wrap items-center">
                                   {quizQuestions.map((_, qIdx) => {
                                       const pickedOpt = student.answers[qIdx];
                                       const isCorrect = correctOptions[qIdx] === pickedOpt;
                                       const answered = pickedOpt !== undefined;

                                       let colorObj = "bg-slate-100 border-slate-200 text-slate-400";
                                       if (answered && isCorrect) colorObj = "bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/30 shadow-md";
                                       if (answered && !isCorrect) colorObj = "bg-rose-500 border-rose-600 text-white shadow-rose-500/30 shadow-md relative";
                                       
                                       return (
                                          <div key={qIdx} className={`w-10 h-10 shrink-0 border rounded-lg flex items-center justify-center text-sm font-bold transition-all transform ${answered ? 'scale-110 z-10' : ''} ${colorObj}`}>
                                             {answered ? ["A","B","C","D","E","F"][pickedOpt] : "?"}
                                             {answered && !isCorrect && <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center text-[10px] text-rose-500 font-black">!</div>}
                                          </div>
                                       )
                                   })}
                               </div>
                               <div className="w-24 shrink-0 text-right">
                                   <div className="text-3xl font-black text-indigo-600">{student.score} <span className="text-sm font-bold text-slate-400">câu</span></div>
                               </div>
                           </div>
                      ))}
                   </div>
               )}
            </div>

        </div>
        <style dangerouslySetInnerHTML={{__html: `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}} />
    </div>
  );
};
