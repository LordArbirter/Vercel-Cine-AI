
import React, { useState, useEffect, useRef } from 'react';
import StoryEditor from './components/StoryEditor';
import ResearchPanel from './components/ResearchPanel';
import { Story, StoryVersion, StoryTemplate, CharacterImage } from './types';
import { generateStorySkeleton } from './services/geminiService';
import { storage, migrateFromLocalStorage } from './lib/storage';

const MAX_ENERGY = 10;
const RECOVERY_TIME_MS = 120000; 

const STORY_TEMPLATES: StoryTemplate[] = [
  { id: 'empty', name: 'Bản thảo trống', description: 'Bắt đầu từ một trang giấy trắng.', defaultContent: '', icon: '📄' },
  { id: 'adventure', name: 'Hành trình Anh hùng', description: 'Mẫu cấu trúc cho các truyện phiêu lưu, kỳ ảo.', defaultContent: '# MỞ ĐẦU: TIẾNG GỌI NƠI XA\n\n[Bối cảnh bình yên tại... bị phá vỡ bởi một sự kiện bí ẩn...]\n\n', icon: '⚔️' },
  { id: 'romance', name: 'Chương Tình cảm', description: 'Tập trung vào miêu tả tâm lý và cảm xúc lứa đôi.', defaultContent: '# GẶP GỠ: GIÂY PHÚT ĐỊNH MỆNH\n\n[Dưới ánh đèn vàng của quán cà phê cũ, họ đã nhìn thấy nhau...]\n\n', icon: '❤️' },
  { id: 'mystery', name: 'Vụ án Bí ẩn', description: 'Thích hợp cho truyện trinh thám, kinh dị.', defaultContent: '# HIỆN TRƯỜNG: MANH MỐI ĐẦU TIÊN\n\n[Cánh cửa kẽo kẹt mở ra, bên trong là một khung cảnh không ai ngờ tới...]\n\n', icon: '🔍' },
];

const getCoverGradient = (id: string) => {
  const gradients = [
    'from-indigo-500 to-purple-500', 'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500', 'from-sky-500 to-blue-500', 'from-violet-500 to-fuchsia-500',
  ];
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
};

const App: React.FC = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [storyName, setStoryName] = useState('');
  const [context, setContext] = useState('');
  const [mainCharacters, setMainCharacters] = useState('');
  const [supportingCharacters, setSupportingCharacters] = useState('');
  const [powerSystem, setPowerSystem] = useState('');
  const [characterImages, setCharacterImages] = useState<CharacterImage[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<import('./types').SavedPrompt[]>([]);
  const [instruction, setInstruction] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [libraryTab, setLibraryTab] = useState<'active' | 'trash'>('active');
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('');
  
  const [energy, setEnergy] = useState<number>(MAX_ENERGY);
  const [nextRecoveryTime, setNextRecoveryTime] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  const [pendingImportData, setPendingImportData] = useState<Story[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef(content);
  const storyNameRef = useRef(storyName);
  const contextRef = useRef(context);
  const mainCharsRef = useRef(mainCharacters);
  const supportingCharsRef = useRef(supportingCharacters);
  const powerSystemRef = useRef(powerSystem);
  const charImagesRef = useRef(characterImages);
  const currentIdRef = useRef(currentStoryId);
  const instructionRef = useRef(instruction);

  useEffect(() => {
    contentRef.current = content;
    storyNameRef.current = storyName;
    contextRef.current = context;
    mainCharsRef.current = mainCharacters;
    supportingCharsRef.current = supportingCharacters;
    powerSystemRef.current = powerSystem;
    charImagesRef.current = characterImages;
    currentIdRef.current = currentStoryId;
    instructionRef.current = instruction;
  }, [content, storyName, context, mainCharacters, supportingCharacters, powerSystem, characterImages, currentStoryId, instruction]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Migrate from localStorage if needed
        await migrateFromLocalStorage([
          'cine_scribe_library',
          'cine_scribe_last_session',
          'cine_scribe_saved_prompts',
          'cine_scribe_energy',
          'cine_scribe_recovery_start'
        ]);

        // 2. Load from IndexedDB
        const library = await storage.getItem<Story[]>('cine_scribe_library');
        if (library) setStories(library);

        const lastSession = await storage.getItem<any>('cine_scribe_last_session');
        if (lastSession) {
          setCurrentStoryId(lastSession.id);
          setContent(lastSession.content || '');
          setStoryName(lastSession.storyName || '');
          setContext(lastSession.context || '');
          setMainCharacters(lastSession.mainCharacters || '');
          setSupportingCharacters(lastSession.supportingCharacters || '');
          setPowerSystem(lastSession.powerSystem || '');
          setCharacterImages(lastSession.characterImages || []);
          setInstruction(lastSession.instruction || '');
        }

        const prompts = await storage.getItem<import('./types').SavedPrompt[]>('cine_scribe_saved_prompts');
        if (prompts) setSavedPrompts(prompts);

        const savedEnergy = await storage.getItem<string>('cine_scribe_energy');
        const savedRecovery = await storage.getItem<string>('cine_scribe_recovery_start');
        if (savedEnergy) {
          const e = parseInt(savedEnergy);
          const r = savedRecovery ? parseInt(savedRecovery) : null;
          const now = Date.now();
          if (r && e < MAX_ENERGY) {
            const elapsed = now - r;
            const recovered = Math.floor(elapsed / RECOVERY_TIME_MS);
            const newEnergy = Math.min(MAX_ENERGY, e + recovered);
            setEnergy(newEnergy);
            if (newEnergy < MAX_ENERGY) setNextRecoveryTime(r + (recovered + 1) * RECOVERY_TIME_MS);
          } else {
            setEnergy(e);
          }
        }
      } catch (error) {
        console.error("Error loading data from IndexedDB:", error);
      } finally {
        setIsDataLoaded(true);
      }
    };

    loadData();
    if (window.innerWidth > 1024) setSidebarOpen(true);
  }, []);

  useEffect(() => {
    if (isDataLoaded) {
      storage.setItem('cine_scribe_library', stories);
    }
  }, [stories, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) {
      const session = { 
        id: currentStoryId, content, storyName, context, mainCharacters, supportingCharacters, powerSystem, characterImages, instruction 
      };
      storage.setItem('cine_scribe_last_session', session);
    }
  }, [currentStoryId, content, storyName, context, mainCharacters, supportingCharacters, powerSystem, characterImages, instruction, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) {
      storage.setItem('cine_scribe_energy', energy.toString());
      if (nextRecoveryTime) storage.setItem('cine_scribe_recovery_start', (nextRecoveryTime - RECOVERY_TIME_MS).toString());
      else storage.removeItem('cine_scribe_recovery_start');
    }
  }, [energy, nextRecoveryTime, isDataLoaded]);

  useEffect(() => {
    if (isDataLoaded) {
      storage.setItem('cine_scribe_saved_prompts', savedPrompts);
    }
  }, [savedPrompts, isDataLoaded]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (nextRecoveryTime && now >= nextRecoveryTime) {
        setEnergy(prev => {
          const next = Math.min(MAX_ENERGY, prev + 1);
          setNextRecoveryTime(next < MAX_ENERGY ? now + RECOVERY_TIME_MS : null);
          return next;
        });
      }
      if (nextRecoveryTime) {
        const diff = nextRecoveryTime - now;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
      } else setCountdown('');
    }, 1000);
    return () => clearInterval(timer);
  }, [nextRecoveryTime]);

  useEffect(() => {
    const autoSaveTimer = setInterval(() => {
      if (!contentRef.current.trim() && !storyNameRef.current.trim()) return;
      const now = Date.now();
      setStories(prev => {
        if (currentIdRef.current) {
          return prev.map(s => s.id === currentIdRef.current ? { 
            ...s, content: contentRef.current, title: storyNameRef.current, context: contextRef.current, mainCharacters: mainCharsRef.current, supportingCharacters: supportingCharsRef.current, powerSystem: powerSystemRef.current, characterImages: charImagesRef.current, updatedAt: now 
          } : s);
        } else {
          const newId = 'story_' + now;
          setCurrentStoryId(newId);
          return [{ id: newId, title: storyNameRef.current || "Bản thảo " + now, context: contextRef.current, mainCharacters: mainCharsRef.current, supportingCharacters: supportingCharsRef.current, powerSystem: powerSystemRef.current, characterImages: charImagesRef.current, content: contentRef.current, updatedAt: now }, ...prev];
        }
      });
      setAutoSaveStatus('Đã tự động lưu'); 
      setTimeout(() => setAutoSaveStatus(''), 2000);
    }, 60000);
    return () => clearInterval(autoSaveTimer);
  }, []);

  const resetEditor = () => {
    setCurrentStoryId(null);
    setContent('');
    setStoryName('');
    setContext('');
    setMainCharacters('');
    setSupportingCharacters('');
    setPowerSystem('');
    setCharacterImages([]);
    setAutoSaveStatus('');
  };

  const useEnergyAction = () => {
    if (energy <= 0) { alert("Hết năng lượng! Vui lòng chờ hồi phục."); return false; }
    setEnergy(prev => {
      if (prev === MAX_ENERGY) setNextRecoveryTime(Date.now() + RECOVERY_TIME_MS);
      return prev - 1;
    });
    return true;
  };

  const handleSaveStory = () => {
    if (!content.trim() && !storyName.trim()) return;
    const now = Date.now();
    const finalTitle = storyName.trim() || "Truyện không tên";
    const newVersion: StoryVersion = { id: 'v_' + now, content, timestamp: now };
    
    setStories(prev => {
      if (currentStoryId) {
        return prev.map(s => s.id === currentStoryId ? { 
          ...s, title: finalTitle, context, mainCharacters, supportingCharacters, powerSystem, characterImages, content, updatedAt: now, 
          versions: [newVersion, ...(s.versions || [])].slice(0, 10) 
        } : s);
      } else {
        const newId = 'story_' + now; 
        setCurrentStoryId(newId);
        return [{ id: newId, title: finalTitle, context, mainCharacters, supportingCharacters, powerSystem, characterImages, content, updatedAt: now, versions: [newVersion] }, ...prev];
      }
    });
    setAutoSaveStatus('Đã lưu bản thảo'); 
    setTimeout(() => setAutoSaveStatus(''), 3000);
  };

  const handleCreateFromTemplate = (template: StoryTemplate) => {
    if (content.trim() && !confirm('Bắt đầu truyện mới? Nội dung hiện tại sẽ bị xóa (nếu chưa lưu).')) return;
    resetEditor();
    setContent(template.defaultContent); 
    setStoryName(template.id === 'empty' ? '' : template.name);
    setShowTemplatePicker(false);
  };

  const handleGenerateFromPrompt = async () => {
    if (!promptInput.trim()) return;
    if (!useEnergyAction()) return;
    
    const currentPrompt = promptInput;
    setPromptInput('');
    setShowPromptModal(false);
    setIsGenerating(true);
    setAutoSaveStatus('Đang khởi tạo truyện...');

    try {
      const result = await generateStorySkeleton(currentPrompt);
      resetEditor();
      setStoryName(result.title || "Truyện mới");
      setContext(result.context || "");
      setMainCharacters(result.mainCharacters || "");
      setSupportingCharacters(result.supportingCharacters || "");
      setPowerSystem(result.powerSystem || "");
      setContent(result.initialContent || "");
      setAutoSaveStatus('Đã tạo khung truyện từ AI');
      
      // Tạo story mới ngay lập tức
      const now = Date.now();
      const newId = 'story_' + now;
      const newStory: Story = {
        id: newId,
        title: result.title || "Truyện mới",
        context: result.context || "",
        mainCharacters: result.mainCharacters || "",
        supportingCharacters: result.supportingCharacters || "",
        powerSystem: result.powerSystem || "",
        content: result.initialContent || "",
        updatedAt: now,
        versions: [{ id: 'v_' + now, content: result.initialContent || "", timestamp: now }]
      };
      setStories(prev => [newStory, ...prev]);
      setCurrentStoryId(newId);
    } catch (e) {
      alert("Lỗi khi tạo truyện: " + (e as Error).message);
      setAutoSaveStatus('Lỗi tạo truyện');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadStory = (story: Story) => {
    if (story.deletedAt) return;
    setCurrentStoryId(story.id); 
    setContent(story.content); 
    setStoryName(story.title); 
    setContext(story.context || ''); 
    setMainCharacters(story.mainCharacters || ''); 
    setSupportingCharacters(story.supportingCharacters || '');
    setPowerSystem(story.powerSystem || '');
    setCharacterImages(story.characterImages || []);
    setLibraryOpen(false);
  };

  const handleRestoreVersion = (version: StoryVersion) => {
    setContent(version.content);
    setAutoSaveStatus('Đã khôi phục phiên bản');
    setTimeout(() => setAutoSaveStatus(''), 2000);
  };

  const handleDeleteStory = (e: React.MouseEvent | null, id: string) => {
    if (e) e.stopPropagation(); 
    if (confirm('Chuyển bản thảo này vào thùng rác?')) {
      setStories(prev => prev.map(s => s.id === id ? { ...s, deletedAt: Date.now() } : s));
      if (currentIdRef.current === id) resetEditor();
      setAutoSaveStatus('Đã chuyển vào Thùng rác');
    }
  };

  const handleRestoreStory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    setStories(prev => prev.map(s => s.id === id ? { ...s, deletedAt: null } : s));
    setAutoSaveStatus('Đã khôi phục truyện');
  };

  const handlePermanentDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    if (confirm('XÁC NHẬN: Xóa vĩnh viễn bản thảo này? Hành động này không thể khôi phục.')) {
      setStories(prev => {
        const newStories = prev.filter(s => s.id !== id);
        if (currentIdRef.current === id) resetEditor();
        return newStories;
      });
      setAutoSaveStatus('Đã xóa vĩnh viễn');
    }
  };

  const handleClearTrash = () => {
    if (confirm('DỌN RÁC: Xóa vĩnh viễn toàn bộ truyện trong thùng rác?')) {
      setStories(prev => prev.filter(s => !s.deletedAt));
      setAutoSaveStatus('Đã dọn sạch thùng rác');
    }
  };

  const handleClearAllData = async () => {
    if (confirm('CẢNH BÁO NGUY HIỂM: Bạn có muốn XÓA TOÀN BỘ dữ liệu của CineScribe?')) {
      if (confirm('XÁC NHẬN LẦN CUỐI: Hành động này không thể hoàn tác.')) {
        await storage.clearAll();
        localStorage.clear();
        window.location.reload();
      }
    }
  };

  const handleExportCurrent = (format: 'txt' | 'md' | 'json') => {
    if (!content.trim() && !storyName.trim()) return alert("Không có nội dung để xuất!");
    
    if (format === 'json') {
      const storyData: Story = stories.find(s => s.id === currentStoryId) || {
        id: 'export_' + Date.now(),
        title: storyName,
        context,
        mainCharacters,
        supportingCharacters,
        powerSystem,
        characterImages,
        content,
        updatedAt: Date.now(),
        versions: []
      };
      const data = JSON.stringify(storyData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(storyName || 'CineScribe_Story').replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setAutoSaveStatus(`Đã xuất file .json`);
      return;
    }

    let header = "";
    if (format === 'md') {
      header = `# ${storyName || 'Truyện không tên'}\n\n**Bối cảnh:** ${context || 'N/A'}\n**Nhân vật chính:** ${mainCharacters || 'N/A'}\n**Nhân vật phụ:** ${supportingCharacters || 'N/A'}\n**Hệ thống sức mạnh:** ${powerSystem || 'N/A'}\n\n`;
      if (characterImages && characterImages.length > 0) {
        header += `## MINH HỌA NHÂN VẬT\n\n`;
        characterImages.forEach(img => {
          header += `### ${img.name || 'Nhân vật'}\n![${img.name || 'Illustration'}](${img.url})\n\n`;
        });
      }
      header += `---\n\n`;
    } else {
      header = `TÊN TRUYỆN: ${storyName || 'Truyện không tên'}\nBỐI CẢNH: ${context || 'N/A'}\nNHÂN VẬT CHÍNH: ${mainCharacters || 'N/A'}\nNHÂN VẬT PHỤ: ${supportingCharacters || 'N/A'}\nHỆ THỐNG SỨC MẠNH: ${powerSystem || 'N/A'}\n${'='.repeat(30)}\n\n`;
      if (characterImages && characterImages.length > 0) {
        header += `DANH SÁCH MINH HỌA:\n`;
        characterImages.forEach(img => {
          header += `- ${img.name || 'Chưa đặt tên'}: [Hình ảnh đính kèm trong file JSON]\n`;
        });
        header += `${'='.repeat(30)}\n\n`;
      }
    }
    
    const blob = new Blob([header + content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(storyName || 'CineScribe_Story').replace(/\s+/g, '_')}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setAutoSaveStatus(`Đã xuất file .${format}`);
  };

  const handleExportFullLibrary = () => {
    const data = JSON.stringify(stories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CineScribe_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setAutoSaveStatus('Đã xuất file backup .json');
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (extension === 'json') {
          const imported = JSON.parse(text);
          if (Array.isArray(imported)) {
            setPendingImportData(imported);
          } else if (imported && typeof imported === 'object' && (imported.title || imported.content)) {
            const newStory: Story = { 
                ...imported,
                id: 'import_' + Date.now(), 
                updatedAt: Date.now() 
            };
            setStories(prev => [newStory, ...prev]); 
            handleLoadStory(newStory);
            setAutoSaveStatus('Đã nhập truyện từ JSON');
          } else {
             alert('File JSON không đúng định dạng!');
          }
        } else {
          const newStory: Story = { 
              id: 'import_' + Date.now(), title: file.name.replace(/\.[^/.]+$/, ""), content: text, updatedAt: Date.now(), versions: [] 
          };
          setStories(prev => [newStory, ...prev]); 
          handleLoadStory(newStory);
          setAutoSaveStatus('Đã nhập truyện mới');
        }
      } catch (err) { alert('Lỗi khi đọc file!'); }
    };
    reader.readAsText(file); 
    e.target.value = '';
  };

  const confirmImport = (mode: 'merge' | 'overwrite') => {
    if (!pendingImportData) return;
    if (mode === 'overwrite') {
      if (confirm("GHI ĐÈ: Toàn bộ thư viện hiện tại sẽ bị XÓA VÀ THAY THẾ. Tiếp tục?")) {
        setStories(pendingImportData);
        resetEditor();
        if (pendingImportData.length > 0) {
           const first = pendingImportData.find(s => !s.deletedAt) || pendingImportData[0];
           if (!first.deletedAt) handleLoadStory(first);
        }
        setAutoSaveStatus('Đã ghi đè thư viện');
      } else return;
    } else {
      setStories(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const uniqueNew = pendingImportData.filter((s: Story) => !existingIds.has(s.id));
        return [...uniqueNew, ...prev];
      });
      setAutoSaveStatus('Đã hợp nhất thư viện');
    }
    setPendingImportData(null);
  };

  const activeStories = stories.filter(s => !s.deletedAt);
  const deletedStories = stories.filter(s => s.deletedAt);
  const currentStory = stories.find(s => s.id === currentStoryId);

  if (!isDataLoaded) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-black uppercase tracking-widest text-sm animate-pulse">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 relative selection:bg-indigo-100 selection:text-indigo-900">
      <header className="h-14 sm:h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-4">
          <button onClick={() => setLibraryOpen(!libraryOpen)} className="p-2 sm:p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-all relative">
            <svg className="w-5 h-5 sm:w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            {deletedStories.length > 0 && <span className="absolute top-2 sm:top-2.5 right-2 sm:right-2.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-pulse"></span>}
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2" onClick={resetEditor} style={{cursor: 'pointer'}}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100 text-sm sm:text-base">C</div>
            <h1 className="text-base sm:text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 hidden xs:block tracking-tighter uppercase">CINESCRIBE</h1>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          {isGenerating && (
            <div className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-indigo-50 rounded-lg animate-pulse">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-indigo-600 rounded-full animate-bounce"></div>
              <span className="text-[8px] sm:text-[9px] font-black text-indigo-600 uppercase tracking-widest whitespace-nowrap">AI...</span>
            </div>
          )}
          {autoSaveStatus && <span className="hidden lg:block text-[10px] text-indigo-600 font-black animate-pulse uppercase mr-2">{autoSaveStatus}</span>}
          <button onClick={() => setShowPromptModal(true)} className="text-indigo-600 hover:text-indigo-700 p-1.5 sm:p-2 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-black uppercase group">
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-all"><svg className="w-4 h-4 sm:w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
            <span className="hidden md:inline">Ý TƯỞNG AI</span>
          </button>
          <button onClick={() => setShowTemplatePicker(true)} className="text-slate-600 hover:text-indigo-600 p-1.5 sm:p-2 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-black uppercase group">
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-all"><svg className="w-4 h-4 sm:w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div>
            <span className="hidden md:inline">MỚI</span>
          </button>
          <button onClick={handleSaveStory} className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-black shadow-lg shadow-indigo-100 active:scale-95 uppercase tracking-widest">
            <svg className="w-3.5 h-3.5 sm:w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            <span className="hidden xs:inline">LƯU</span>
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all ${sidebarOpen ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:bg-slate-100'}`}><svg className="w-5 h-5 sm:w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
        </div>
      </header>

      {showPromptModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isGenerating && setShowPromptModal(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-4">VIẾT TRUYỆN TỪ Ý TƯỞNG</h2>
            <textarea value={promptInput} onChange={(e) => setPromptInput(e.target.value)} placeholder="Mô tả ý tưởng của bạn..." disabled={isGenerating} className="w-full h-32 p-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 mb-6 resize-none text-sm font-medium" />
            <div className="flex gap-3">
              <button onClick={() => setShowPromptModal(false)} disabled={isGenerating} className="flex-1 py-3 text-sm font-black text-slate-400 uppercase tracking-widest">HỦY</button>
              <button onClick={handleGenerateFromPrompt} disabled={isGenerating || !promptInput.trim()} className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:opacity-50">
                {isGenerating ? 'ĐANG KHỞI TẠO...' : 'BẮT ĐẦU SÁNG TÁC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImportData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setPendingImportData(null)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
               <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">NHẬP DỮ LIỆU SAO LƯU</h2>
               <p className="text-sm text-slate-500 mt-2">Phát hiện {pendingImportData.length} truyện. Chọn phương thức xử lý:</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
               <button onClick={() => confirmImport('merge')} className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left">
                  <h4 className="font-black text-slate-800 uppercase text-xs">Hợp nhất (Merge)</h4>
                  <p className="text-[10px] text-slate-500">Giữ truyện hiện có, chỉ thêm truyện mới từ file.</p>
               </button>
               <button onClick={() => confirmImport('overwrite')} className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-red-600 hover:bg-red-50 transition-all text-left group">
                  <h4 className="font-black text-slate-800 uppercase text-xs group-hover:text-red-700">Ghi đè (Overwrite)</h4>
                  <p className="text-[10px] text-red-600 font-bold opacity-70">XÓA TẤT CẢ truyện hiện tại và thay bằng dữ liệu file.</p>
               </button>
            </div>
            <button onClick={() => setPendingImportData(null)} className="w-full mt-6 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">ĐÓNG</button>
          </div>
        </div>
      )}

      {libraryOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]" onClick={() => setLibraryOpen(false)}></div>
          <div className="relative w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tighter">THƯ VIỆN</h2>
              <button onClick={() => setLibraryOpen(false)} className="p-2 sm:p-2.5 hover:bg-slate-200 rounded-xl text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="px-4 sm:px-6 py-3 sm:py-4 flex gap-4 border-b border-slate-50 items-center justify-between">
              <div className="flex gap-4">
                <button onClick={() => setLibraryTab('active')} className={`text-[10px] font-black pb-2 border-b-2 uppercase tracking-widest transition-all ${libraryTab === 'active' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>BẢN THẢO ({activeStories.length})</button>
                <button onClick={() => setLibraryTab('trash')} className={`text-[10px] font-black pb-2 border-b-2 uppercase tracking-widest transition-all ${libraryTab === 'trash' ? 'border-red-500 text-red-500' : 'border-transparent text-slate-400'}`}>THÙNG RÁC ({deletedStories.length})</button>
              </div>
              {libraryTab === 'trash' && deletedStories.length > 0 && <button onClick={handleClearTrash} className="text-[9px] font-black text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 uppercase tracking-tighter">Dọn sạch</button>}
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/30">
              {(libraryTab === 'active' ? activeStories : deletedStories).map(story => (
                <div key={story.id} onClick={() => libraryTab === 'active' && handleLoadStory(story)} className={`flex bg-white rounded-2xl border transition-all cursor-pointer overflow-hidden group ${currentStoryId === story.id ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-lg' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                  <div className={`w-2 sm:w-3 h-auto bg-gradient-to-b ${getCoverGradient(story.id)}`} />
                  <div className="flex-1 p-3 sm:p-4 flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-800 truncate text-xs sm:text-sm uppercase">{story.title}</h3>
                      <p className="text-[8px] sm:text-[9px] text-slate-400 mt-1 uppercase font-bold">Ngày sửa: {new Date(story.updatedAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {libraryTab === 'active' ? (
                        <button onClick={(e) => handleDeleteStory(e, story.id)} className="p-1.5 sm:p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      ) : (
                        <>
                          <button onClick={(e) => handleRestoreStory(e, story.id)} className="p-1.5 sm:p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l5 5m-5-5l5-5" /></svg></button>
                          <button onClick={(e) => handlePermanentDelete(e, story.id)} className="p-1.5 sm:p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 sm:p-6 bg-white border-t border-slate-100 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button onClick={handleExportFullLibrary} className="bg-slate-800 text-white py-2.5 sm:py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest">BACKUP FULL</button>
                <button onClick={handleImportClick} className="bg-indigo-50 text-indigo-600 py-2.5 sm:py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest">NHẬP FILE</button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".txt,.md,.json" />
              <button onClick={() => {setShowTemplatePicker(true); setLibraryOpen(false);}} className="w-full bg-indigo-600 text-white py-3 sm:py-4 rounded-2xl text-[10px] sm:text-xs font-black shadow-xl uppercase tracking-widest hover:bg-indigo-700 transition-all">+ TRUYỆN MỚI</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 md:p-10 flex justify-center bg-slate-50/50 no-scrollbar">
          <div className="w-full max-w-4xl h-full flex flex-col">
             <StoryEditor 
              storyName={storyName} setStoryName={setStoryName}
              context={context} setContext={setContext}
              mainCharacters={mainCharacters} setMainCharacters={setMainCharacters}
              supportingCharacters={supportingCharacters} setSupportingCharacters={setSupportingCharacters}
              powerSystem={powerSystem} setPowerSystem={setPowerSystem}
              characterImages={characterImages} setCharacterImages={setCharacterImages}
              savedPrompts={savedPrompts} setSavedPrompts={setSavedPrompts}
              content={content} setContent={setContent} 
              instruction={instruction} setInstruction={setInstruction}
              onAction={useEnergyAction} energy={energy} countdown={countdown} versions={currentStory?.versions || []} 
              onRestoreVersion={handleRestoreVersion}
              onDeleteCurrent={() => currentStoryId && handleDeleteStory(null, currentStoryId)}
              onExport={(fmt) => handleExportCurrent(fmt)}
              hasCurrentStory={!!currentStoryId}
            />
          </div>
        </div>

        <div className={`fixed lg:relative top-0 right-0 h-full z-40 lg:z-10 transition-all duration-500 ease-in-out shrink-0 bg-white shadow-2xl lg:shadow-none ${sidebarOpen ? 'w-full sm:w-80 translate-x-0 opacity-100' : 'w-0 translate-x-full opacity-0 pointer-events-none'}`}>
          <div className="h-full flex flex-col">
            <ResearchPanel 
              onInsertInfo={(t) => { setContent(c => c + (c ? "\n\n" : "") + "[THÔNG TIN TRA CỨU]:\n" + t); setAutoSaveStatus('Đã chèn lore'); }} 
              onAction={useEnergyAction} onClose={() => setSidebarOpen(false)}
            />
          </div>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 left-[-40px] sm:left-[-48px] w-10 h-10 sm:w-12 sm:h-12 bg-white border border-slate-200 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 shadow-xl lg:hidden"><svg className="w-5 h-5 sm:w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          )}
        </div>
      </main>

      {showTemplatePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowTemplatePicker(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
               <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">BẮT ĐẦU TRUYỆN MỚI</h2>
               <button onClick={() => setShowTemplatePicker(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {STORY_TEMPLATES.map(t => (
                 <button key={t.id} onClick={() => handleCreateFromTemplate(t)} className="flex items-start gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-600 hover:shadow-xl hover:-translate-y-1 transition-all text-left group">
                    <div className="text-3xl p-3 bg-white rounded-xl shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">{t.icon}</div>
                    <div>
                       <h3 className="font-black text-slate-800 uppercase text-sm">{t.name}</h3>
                       <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t.description}</p>
                    </div>
                 </button>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
