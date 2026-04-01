
import React, { useState } from 'react';
import { researchMovieInfo, fetchNotebookLMData } from '../services/geminiService';
import { ResearchResult } from '../types';

interface ResearchPanelProps {
  onInsertInfo: (text: string) => void;
  onAction: () => boolean;
  onClose?: () => void;
}

const ResearchPanel: React.FC<ResearchPanelProps> = ({ onInsertInfo, onAction, onClose }) => {
  const [query, setQuery] = useState('');
  const [notebookUrl, setNotebookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [notebookResult, setNotebookResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lore' | 'notebook'>('lore');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!onAction()) return;

    setLoading(true);
    setResult(null);
    setNotebookResult(null);
    try {
      const data = await researchMovieInfo(query);
      setResult(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotebookSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notebookUrl.trim()) return;
    if (!onAction()) return;

    setLoading(true);
    setResult(null);
    setNotebookResult(null);
    try {
      const data = await fetchNotebookLMData(notebookUrl);
      setNotebookResult(data);
    } catch (error) {
      console.error("Notebook sync error:", error);
      setNotebookResult("Lỗi khi đồng bộ dữ liệu từ NotebookLM. Vui lòng kiểm tra lại liên kết.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 shadow-sm">
      <div className="p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="text-base sm:text-lg font-black text-indigo-700 flex items-center gap-1.5 sm:gap-2 tracking-tight uppercase">
            {activeTab === 'lore' ? (
              <>
                <svg className="w-4 h-4 sm:w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                TRA CỨU LORE
              </>
            ) : (
              <>
                <svg className="w-4 h-4 sm:w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                NotebookLM
              </>
            )}
          </h2>
          <p className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Gemini AI</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <svg className="w-4 h-4 sm:w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      <div className="flex border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('lore')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === 'lore' ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Lore Search
        </button>
        <button 
          onClick={() => setActiveTab('notebook')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === 'notebook' ? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          NotebookLM
        </button>
      </div>

      <div className="p-3 sm:p-4">
        {activeTab === 'lore' ? (
          <form onSubmit={handleSearch} className="space-y-1.5 sm:space-y-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên phim hoặc nhân vật..."
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm disabled:opacity-50 shadow-md shadow-indigo-100 active:scale-95"
            >
              {loading ? 'Đang tra cứu...' : 'TÌM KIẾM (1 LƯỢT)'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleNotebookSync} className="space-y-1.5 sm:space-y-2">
            <input
              type="url"
              value={notebookUrl}
              onChange={(e) => setNotebookUrl(e.target.value)}
              placeholder="Dán liên kết NotebookLM vào đây..."
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm disabled:opacity-50 shadow-md shadow-emerald-100 active:scale-95"
            >
              {loading ? 'Đang đồng bộ...' : 'ĐỒNG BỘ DỮ LIỆU (1 LƯỢT)'}
            </button>
            <p className="text-[9px] text-slate-400 italic">Lưu ý: Liên kết NotebookLM cần ở chế độ công khai hoặc được chia sẻ.</p>
          </form>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 sm:py-10 text-slate-400">
            <div className={`animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 ${activeTab === 'lore' ? 'border-indigo-600' : 'border-emerald-600'} mb-3 sm:mb-4`}></div>
            <p className="text-xs sm:text-sm font-medium italic">{activeTab === 'lore' ? 'Đang thu thập lore...' : 'Đang phân tích NotebookLM...'}</p>
          </div>
        )}

        {!loading && !result && !notebookResult && (
          <div className="py-16 sm:py-20 text-center px-4 sm:px-6">
             <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-slate-200">
                {activeTab === 'lore' ? (
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                ) : (
                  <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                )}
             </div>
             <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
               {activeTab === 'lore' 
                 ? "Tìm kiếm để AI tóm tắt các thông tin quan trọng cho câu chuyện của bạn."
                 : "Dán liên kết NotebookLM để AI trích xuất bối cảnh, nhân vật và cốt truyện."}
             </p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-8 sm:pb-10">
            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Tóm tắt Lore</span>
                <button 
                  onClick={() => onInsertInfo(result.text)} 
                  className="bg-white border border-slate-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-indigo-600 hover:bg-indigo-600 hover:text-white text-[8px] sm:text-[10px] font-black transition-all shadow-sm"
                >
                  CHÈN
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap serif-font">{result.text}</p>
            </div>
            {result.sources.length > 0 && (
              <div className="space-y-1.5 sm:space-y-2">
                <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nguồn Tham Khảo</span>
                {result.sources.map((src, idx) => src.web && (
                  <a key={idx} href={src.web.uri} target="_blank" rel="noreferrer" className="block p-2 sm:p-3 bg-white border border-slate-100 rounded-lg sm:rounded-xl hover:border-indigo-200 hover:shadow-md transition-all group">
                    <p className="text-[10px] sm:text-xs font-bold text-indigo-600 truncate group-hover:text-indigo-800">{src.web.title}</p>
                    <p className="text-[8px] sm:text-[9px] text-slate-400 truncate mt-0.5 sm:mt-1">{src.web.uri}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {notebookResult && !loading && (
          <div className="space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 pb-8 sm:pb-10">
            <div className="bg-emerald-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-100 shadow-sm">
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <span className="text-[8px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-widest">Dữ liệu NotebookLM</span>
                <button 
                  onClick={() => onInsertInfo(notebookResult)} 
                  className="bg-white border border-emerald-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-emerald-600 hover:bg-emerald-600 hover:text-white text-[8px] sm:text-[10px] font-black transition-all shadow-sm"
                >
                  CHÈN
                </button>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap serif-font">{notebookResult}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchPanel;
