
import React, { useState, useRef, useEffect } from 'react';
import { processStoryAI, processStoryAIStream, expandSelectionAI, expandSelectionAIStream } from '../services/geminiService';
import { AIAction, StoryVersion, CharacterImage } from '../types';

interface StoryEditorProps {
  storyName: string;
  setStoryName: (val: string) => void;
  context: string;
  setContext: (val: string) => void;
  mainCharacters: string;
  setMainCharacters: (val: string) => void;
  supportingCharacters: string;
  setSupportingCharacters: (val: string) => void;
  powerSystem: string;
  setPowerSystem: (val: string) => void;
  characterImages: CharacterImage[];
  setCharacterImages: (val: CharacterImage[]) => void;
  content: string;
  setContent: (val: string) => void;
  instruction: string;
  setInstruction: (val: string) => void;
  onAction: () => boolean;
  energy: number;
  countdown: string;
  versions: StoryVersion[];
  onRestoreVersion: (ver: StoryVersion) => void;
  onDeleteCurrent: () => void;
  onExport: (format: 'txt' | 'md' | 'json') => void;
  hasCurrentStory: boolean;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ 
  storyName, setStoryName,
  context, setContext,
  mainCharacters, setMainCharacters,
  supportingCharacters, setSupportingCharacters,
  powerSystem, setPowerSystem,
  characterImages, setCharacterImages,
  content, setContent, 
  instruction, setInstruction,
  onAction, energy, countdown, versions, onRestoreVersion,
  onDeleteCurrent, onExport, hasCurrentStory
}) => {
  const [loading, setLoading] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // State mới cho việc chọn nhiều chế độ
  const [selectedModes, setSelectedModes] = useState<AIAction[]>(['continue']);
  const [isModesCollapsed, setIsModesCollapsed] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;
      const atBottom = scrollHeight - scrollTop <= clientHeight + 80;
      setIsAtBottom(atBottom);
    }
  };

  const toggleMode = (mode: AIAction) => {
    setSelectedModes(prev => 
      prev.includes(mode) 
        ? prev.filter(m => m !== mode) 
        : [...prev, mode]
    );
  };

  const handleAIExecute = async () => {
    if (loading || !onAction()) return;
    if (selectedModes.length === 0) {
      alert("Vui lòng chọn ít nhất một chế độ viết!");
      return;
    }

    setLoading(true);
    const initialContent = content;
    
    try {
      // Thêm khoảng cách nếu đã có nội dung
      if (initialContent) {
        setContent(prev => prev + "\n\n...");
      } else {
        setContent("...");
      }

      let isFirstChunk = true;
      await processStoryAIStream(
        selectedModes, 
        storyName, 
        context, 
        mainCharacters, 
        supportingCharacters,
        powerSystem,
        initialContent,
        (chunk) => {
          if (isFirstChunk) {
            // Thay thế dấu ba chấm bằng chunk đầu tiên
            setContent(prev => {
              const base = prev.endsWith("...") ? prev.slice(0, -3) : prev;
              return base + chunk;
            });
            isFirstChunk = false;
          } else {
            setContent(prev => prev + chunk);
          }
          
          if (isAtBottom) {
            scrollToBottom();
          }
        },
        instruction, 
        attachedImages
      );
      
      setInstruction('');
      setAttachedImages([]);
      
      if (isAtBottom) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (e) { 
      console.error(e); 
      alert("Lỗi AI: Nội dung yêu cầu có thể vi phạm chính sách hoặc lỗi kết nối.");
      // Không khôi phục hoàn toàn nếu đã có một phần nội dung được stream
    } finally { 
      setLoading(false); 
    }
  };

  const handleExpandSelection = async () => {
    if (!selection || selection.start === selection.end) return;
    if (loading || !onAction()) return;

    const selectedText = content.substring(selection.start, selection.end);
    if (!selectedText.trim()) return;

    setLoading(true);
    const startPos = selection.start;
    const endPos = selection.end;
    
    try {
      let expandedText = "";
      // Hiển thị trạng thái đang mở rộng ngay trong văn bản
      setContent(prev => 
        prev.substring(0, startPos) + 
        "[Đang mở rộng...]" + 
        prev.substring(endPos)
      );

      await expandSelectionAIStream(
        selectedText,
        storyName,
        context,
        mainCharacters,
        supportingCharacters,
        powerSystem,
        (chunk) => {
          expandedText += chunk;
          setContent(prev => {
            // Tìm vị trí của tag đang mở rộng
            const placeholder = "[Đang mở rộng...]";
            const index = prev.indexOf(placeholder);
            if (index !== -1) {
               return prev.substring(0, index) + expandedText + placeholder + prev.substring(index + placeholder.length);
            }
            // Nếu không tìm thấy (do user xóa), thì append vào vị trí cũ
            return prev.substring(0, startPos) + expandedText + prev.substring(startPos);
          });
        }
      );

      // Xóa placeholder cuối cùng
      setContent(prev => prev.replace("[Đang mở rộng...]", ""));
      setSelection(null);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi mở rộng đoạn văn bản.");
      // Khôi phục nếu lỗi nặng
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelection = () => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      if (selectionStart !== selectionEnd) {
        setSelection({ start: selectionStart, end: selectionEnd });
      } else {
        setSelection(null);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setAttachedImages(prev => [...prev, base64].slice(-10));
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setAttachedImages(prev => [...prev, base64].slice(-10));
        };
        reader.readAsDataURL(files[i]);
      }
    }
    e.target.value = '';
  };

  const handleGalleryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setCharacterImages(prev => {
            if (!prev.some(img => img.url === base64)) return [...prev, { url: base64, name: '' }];
            return prev;
          });
        };
        reader.readAsDataURL(files[i]);
      }
    }
    e.target.value = '';
  };

  const scrollToBottom = () => {
    if (textareaRef.current) {
      textareaRef.current.scrollTo({
        top: textareaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const MODES_CONFIG = [
    { id: 'continue', label: 'VIẾT TIẾP', icon: '📝' },
    { id: 'expand', label: 'CHI TIẾT', icon: '✨' },
    { id: 'rewrite', label: 'TRAU CHUỐT', icon: '💎' },
    { id: 'suggest_plot', label: 'GỢI Ý PLOT', icon: '💡' }
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative">
      <div className={`bg-slate-50/80 border-b border-slate-200 backdrop-blur-sm transition-all duration-300 z-10 ${isHeaderCollapsed ? 'p-2' : 'p-3 sm:p-5'}`}>
        <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-2">
             <button onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500">
                <svg className={`w-4 h-4 transition-transform duration-300 ${isHeaderCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
             </button>
             {isHeaderCollapsed && <h3 className="text-xs font-black text-slate-800 uppercase truncate max-w-[120px] sm:max-w-[200px]">{storyName || "Bản thảo mới"}</h3>}
           </div>
           <div className="flex gap-1.5 sm:gap-2">
             <div className="relative">
               <button 
                 onClick={() => setShowExportMenu(!showExportMenu)} 
                 className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all ${showExportMenu ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-600 shadow-sm'}`}
                 title="Xuất file"
               >
                 <svg className="w-3.5 h-3.5 sm:w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               </button>
               {showExportMenu && (
                 <div className="absolute top-full right-0 mt-2 w-28 sm:w-32 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                   <button onClick={() => { onExport('txt'); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-b border-slate-100 uppercase">FILE .TXT</button>
                   <button onClick={() => { onExport('md'); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 border-b border-slate-100 uppercase">FILE .MD</button>
                   <button onClick={() => { onExport('json'); setShowExportMenu(false); }} className="w-full px-3 py-2 text-left text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 uppercase">FILE .JSON</button>
                 </div>
               )}
             </div>
             {hasCurrentStory && <button onClick={onDeleteCurrent} className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-500 transition-all"><svg className="w-3.5 h-3.5 sm:w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
             <button onClick={() => setShowHistory(!showHistory)} className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all ${showHistory ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border-slate-200'}`}><svg className="w-3.5 h-3.5 sm:w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
           </div>
        </div>

        {!isHeaderCollapsed && (
          <div className="space-y-2 sm:space-y-3 animate-in fade-in duration-300">
            <input type="text" value={storyName} onChange={(e) => setStoryName(e.target.value)} placeholder="Tên truyện..." className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <input type="text" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Bối cảnh..." className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm outline-none" />
              <input type="text" value={mainCharacters} onChange={(e) => setMainCharacters(e.target.value)} placeholder="Nhân vật chính..." className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm outline-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <input type="text" value={supportingCharacters} onChange={(e) => setSupportingCharacters(e.target.value)} placeholder="Nhân vật phụ..." className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm outline-none" />
              <input type="text" value={powerSystem} onChange={(e) => setPowerSystem(e.target.value)} placeholder="Hệ thống sức mạnh..." className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm outline-none" />
            </div>

            {/* Character Gallery Section */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Minh họa nhân vật / Bối cảnh</span>
                <button 
                  onClick={() => galleryInputRef.current?.click()}
                  className="text-[8px] sm:text-[10px] font-bold text-indigo-600 hover:underline uppercase"
                >
                  + THÊM ẢNH
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {characterImages.length === 0 && (
                  <div className="w-full py-3 sm:py-4 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-[8px] sm:text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                    Dán hoặc tải ảnh lên
                  </div>
                )}
                {characterImages.map((img, i) => (
                  <div key={i} className="relative w-20 sm:w-24 shrink-0 group flex flex-col gap-1">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                      <img 
                        src={img.url} 
                        className="w-full h-full object-cover rounded-lg sm:rounded-xl border border-slate-200 shadow-sm" 
                        alt={img.name || `Illustration ${i}`}
                      />
                      <button 
                        onClick={() => setCharacterImages(characterImages.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                      >
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <button 
                        onClick={() => {
                          if (!attachedImages.includes(img.url)) {
                            setAttachedImages(prev => [...prev, img.url].slice(-10));
                          }
                        }}
                        className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                        title="Gửi cho AI"
                      >
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={img.name || ''} 
                      onChange={(e) => {
                        const newImages = [...characterImages];
                        newImages[i] = { ...newImages[i], name: e.target.value };
                        setCharacterImages(newImages);
                      }}
                      placeholder="Tên..."
                      className="w-full px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold text-slate-700 bg-white border border-slate-100 rounded-lg outline-none focus:border-indigo-300 text-center truncate"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 relative flex flex-col">
        <textarea 
          ref={textareaRef} 
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          onScroll={handleScroll} 
          onPaste={handlePaste}
          onSelect={handleTextSelection}
          className="flex-1 w-full p-6 sm:p-12 serif-font text-base sm:text-lg leading-relaxed outline-none resize-none bg-transparent placeholder:text-slate-300" 
          placeholder="Kể câu chuyện của bạn ở đây..." 
        />
        
        {selection && !loading && (
          <div className="absolute top-4 right-4 animate-in slide-in-from-top-2 duration-300 z-20">
            <button 
              onClick={handleExpandSelection}
              className="px-4 py-2 bg-amber-500 text-white rounded-full text-xs font-black shadow-lg hover:bg-amber-600 flex items-center gap-2 uppercase tracking-wider"
            >
              <span className="text-sm">✨</span> Mở rộng đoạn chọn
            </button>
          </div>
        )}
        {!isAtBottom && (
          <button onClick={scrollToBottom} className="absolute bottom-6 right-6 p-3 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition-all animate-bounce z-20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7" /></svg>
          </button>
        )}

        {loading && (
          <div className="absolute bottom-6 left-6 flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-indigo-100 animate-in slide-in-from-bottom-2 duration-300 z-30">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></div>
            </div>
            <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">AI đang viết...</span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-6 bg-slate-50/50 border-t border-slate-200 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Chế độ viết AI</span>
          </div>
          <button 
            onClick={() => setIsModesCollapsed(!isModesCollapsed)}
            className="text-[8px] sm:text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-end sm:self-auto"
          >
            {isModesCollapsed ? 'HIỆN TẤT CẢ' : 'THU GỌN'}
            <svg className={`w-3 h-3 transition-transform ${isModesCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
        
        {!isModesCollapsed && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {MODES_CONFIG.map(mode => (
              <button
                key={mode.id}
                onClick={() => toggleMode(mode.id as AIAction)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 sm:gap-2 border ${
                  selectedModes.includes(mode.id as AIAction)
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-100'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <span className="text-xs">{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={instruction} 
              onChange={(e) => setInstruction(e.target.value)} 
              placeholder="Ghi chú thêm cho AI..." 
              className="w-full pl-4 sm:pl-5 pr-16 sm:pr-20 py-2.5 sm:py-3.5 bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" 
            />
            <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex gap-0.5 sm:gap-1">
              <button onClick={() => fileInputRef.current?.click()} className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-600" title="Ảnh"><svg className="w-4 h-4 sm:w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
            <input type="file" ref={galleryInputRef} onChange={handleGalleryImageUpload} className="hidden" accept="image/*" multiple />
          </div>
          <button 
            onClick={handleAIExecute} 
            disabled={loading || energy <= 0 || !storyName} 
            className="px-6 sm:px-8 py-2.5 sm:py-3.5 bg-indigo-600 text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black shadow-lg hover:bg-indigo-700 disabled:opacity-30 uppercase transition-all"
          >
            {loading ? '...' : 'CHẠY AI'}
          </button>
        </div>
        
        {attachedImages.length > 0 && (
          <div className="flex gap-2 p-2 bg-indigo-50/50 rounded-xl overflow-x-auto">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative w-12 h-12 shrink-0 border-2 border-white rounded-lg overflow-hidden">
                <img src={img} className="w-full h-full object-cover" />
                <button onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryEditor;
