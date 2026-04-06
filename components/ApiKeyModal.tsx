import React, { useState, useEffect } from 'react';
import { AI_MODELS } from '../constants';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (key: string, model: string) => void;
  onClose: () => void;
  currentKey: string;
  currentModel: string;
  forceRequire: boolean; // Nếu true, không cho đóng modal nếu chưa có key
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose, currentKey, currentModel, forceRequire }) => {
  const [inputKey, setInputKey] = useState(currentKey);
  const [inputModel, setInputModel] = useState(currentModel);

  useEffect(() => {
    setInputKey(currentKey);
    setInputModel(currentModel);
  }, [currentKey, currentModel, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Tự động làm sạch key: Xóa khoảng trắng và các ký tự không phải ASCII (tiếng Việt, emoji...)
    const cleanKey = inputKey.replace(/[^\x00-\x7F]/g, "").trim();
    
    if (cleanKey || inputModel) {
      onSave(cleanKey, inputModel);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Thiết lập Model & API Key
          </h3>
          {!forceRequire && (
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
        
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm leading-relaxed">
            Ứng dụng sử dụng <strong>Google Gemini API</strong>. Để bắt đầu, bạn cần nhập API Key của riêng mình. Key được lưu an toàn trên trình duyệt của bạn.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Model Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Chọn Mô hình AI</label>
              <div className="flex flex-col gap-2">
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setInputModel(model.id)}
                    className={`relative px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      inputModel === model.id
                        ? 'border-teal-500 bg-teal-50 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-teal-300'
                    }`}
                  >
                    {model.badge && (
                      <span className={`absolute top-2 right-2 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ${model.badge === 'Mặc định' ? 'bg-teal-500' : 'bg-blue-500'}`}>
                        {model.badge}
                      </span>
                    )}
                    <div className="font-bold text-sm text-slate-800">{model.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{model.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 bg-teal-50 border border-teal-100 rounded-lg p-3 text-sm text-teal-800">
               <p className="mb-1">
                Lấy API key tại: <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="underline font-bold hover:text-teal-600">Google AI Studio</a>.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Dán API Key vào đây (Tắt bộ gõ Tiếng Việt nếu nhập lỗi)
              </label>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                autoFocus
              />
            </div>
            
            <button
              type="submit"
              disabled={!inputKey.trim() && !inputModel}
              className="w-full py-3 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-all transform active:scale-[0.98]"
            >
              Lưu Thiết Lập
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};