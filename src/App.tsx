import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Clapperboard,
  Home,
  Settings,
  Library,
  PlaySquare,
  Film,
  Folder,
  Clock,
  Heart,
  ChevronRight,
  Bell,
  Info,
  Shield,
  Palette,
  ChevronDown,
  MoreVertical,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  Subtitles,
  Maximize,
  VolumeX,
  Minimize,
  Plus,
  ArrowLeft,
  ArrowUpDown,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { VideoPlayer as CapacitorVideoPlayer } from '@capgo/capacitor-video-player';
import { App as CapacitorApp } from '@capacitor/app';

if (typeof window !== 'undefined') {
  (window as any).backHandlers = [];
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.removeAllListeners();
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const handlers = (window as any).backHandlers;
      if (handlers && handlers.length > 0) {
         const handler = handlers[handlers.length - 1];
         handler(); // consume it
      } else {
         if (canGoBack) window.history.back();
         else CapacitorApp.exitApp();
      }
    });
  }
}

function useBackButton(handler: () => void, enabled: boolean) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;
    const handlers = (window as any).backHandlers;
    const currentHandler = () => handlerRef.current();
    handlers.push(currentHandler);
    return () => {
      const idx = handlers.indexOf(currentHandler);
      if (idx !== -1) handlers.splice(idx, 1);
    };
  }, [enabled]);
}

const VideoProvider = registerPlugin<any>('VideoProvider');

let ALBUMS = ["All", "Camera Roll", "Favorites", "Recent", "Downloads"];

let RECENT_VIDEOS: any[] = [
  { id: 1, title: "Summer Trip 2023", duration: "12:45", album: "Recent", path: "" },
  { id: 2, title: "Project Demo", duration: "04:30", album: "Recent", path: "" },
  { id: 3, title: "Birthday Party", duration: "24:10", album: "Recent", path: "" },
];

let ALL_VIDEOS: any[] = [
  { id: 101, title: "Workout Routine", album: "Favorites", duration: "18:20", path: "" },
  { id: 102, title: "Cooking Tutorial", album: "Recent", duration: "05:15", path: "" },
  { id: 103, title: "Review Video", album: "Downloads", duration: "10:00", path: "" },
  { id: 104, title: "Vlog #42", album: "Camera Roll", duration: "08:45", path: "" },
  { id: 105, title: "Design Sprint", album: "Favorites", duration: "32:10", path: "" },
  { id: 106, title: "Family Gathering", album: "Camera Roll", duration: "15:00", path: "" },
];

let FOLDERS = [
  { id: 1, name: "Downloads", count: 12, color: "bg-blue-500/20 text-blue-400" },
  { id: 2, name: "Camera Roll", count: 45, color: "bg-green-500/20 text-green-400" },
  { id: 3, name: "Screen Recordings", count: 8, color: "bg-purple-500/20 text-purple-400" },
  { id: 4, name: "Movies", count: 3, color: "bg-red-500/20 text-red-400" },
];


const PLAYLISTS = [
  { id: 1, name: "Watch Later", icon: Clock },
  { id: 2, name: "Favorites", icon: Heart },
];

const durationToSec = (d: string) => {
  if (!d) return 0;
  const parts = d.split(':').map(Number);
  if (parts.length === 2) return parts[0]*60 + parts[1];
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  return 0;
};


const SETTING_ITEMS = [
  { icon: Palette, label: "Appearance", value: "Dark" },
  { icon: Bell, label: "Notifications", value: "On" },
  { icon: PlaySquare, label: "Playback", value: "Hardware Dec." },
  { icon: Shield, label: "Privacy & Security", value: "" },
  { icon: Info, label: "About Lumi", value: "v1.0.4" },
];

const NAV_TABS = [
  { id: 'library', icon: Library },
  { id: 'home', icon: Home },
  { id: 'settings', icon: Settings }
];

function VideoPlayer({ video, onClose, onNext, onPrev }: { video: any; onClose: () => void; onNext?: () => void; onPrev?: () => void; }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(30);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [showVolumeMenu, setShowVolumeMenu] = useState(false);
  const [quality, setQuality] = useState('1080p');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [availableSubtitles, setAvailableSubtitles] = useState([
    { id: 'en', name: 'English (Built-in)', type: 'embedded' },
    { id: 'es', name: 'Spanish', type: 'embedded' }
  ]);
  const [activeSubtitle, setActiveSubtitle] = useState('en');

  const [indicatorText, setIndicatorText] = useState<string | null>(null);
  const tapTimeoutRef = useRef<any>(null);
  const tapsRef = useRef({ side: '', count: 0 });
  const holdTimeoutRef = useRef<any>(null);
  const isHolding = useRef(false); const vidRef = useRef<HTMLVideoElement>(null);
  const holdTriggeredRef = useRef(false);
  const originalSpeedRef = useRef(1);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    holdTriggeredRef.current = false;
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (!isHolding.current) originalSpeedRef.current = playbackSpeed;

    holdTimeoutRef.current = setTimeout(() => {
      isHolding.current = true;
      holdTriggeredRef.current = true;
      setPlaybackSpeed(2); if(vidRef.current) vidRef.current.playbackRate=2;
      setIndicatorText("2X Speed");
    }, 500);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (isHolding.current) {
      isHolding.current = false;
      setPlaybackSpeed(originalSpeedRef.current); if(vidRef.current) vidRef.current.playbackRate=originalSpeedRef.current;
      setIndicatorText(null);
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp(e);
  };

  const handlePlayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    const side = isLeft ? 'left' : 'right';

    if (tapsRef.current.side !== side) {
      tapsRef.current = { side, count: 1 };
    } else {
      tapsRef.current.count++;
    }

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);

    if (tapsRef.current.count === 1) {
      tapTimeoutRef.current = setTimeout(() => {
        handleTap();
        tapsRef.current = { side: '', count: 0 };
      }, 300);
    } else {
      const totalSeconds = (tapsRef.current.count - 1) * 10;
      setIndicatorText(`${side === 'left' ? '-' : '+'}${totalSeconds}s`);

      tapTimeoutRef.current = setTimeout(() => {
        const sign = tapsRef.current.side === 'left' ? -1 : 1;
        const finalSeconds = (tapsRef.current.count - 1) * 10;
        
        if (finalSeconds > 0) {
          if(vidRef.current && vidRef.current.duration) vidRef.current.currentTime += (finalSeconds * sign); setProgress(p => Math.max(0, Math.min(100, p + (finalSeconds * sign * 0.5))));
        }
        
        setIndicatorText(null);
        tapsRef.current = { side: '', count: 0 };
      }, 500);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return p + (playbackSpeed * 0.15); // Auto progress simulation
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const handleTap = () => {
    if (showSettings || showOptionsMenu || showSubtitlesMenu || showVolumeMenu) {
      setShowSettings(false);
      setShowOptionsMenu(false);
      setShowSubtitlesMenu(false);
      setShowVolumeMenu(false);
      return;
    }
    setShowControls(!showControls);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`fixed z-[100] bg-black text-white flex flex-col origin-center transition-all duration-300 ease-in-out ${
        isFullscreen 
          ? "top-1/2 left-1/2 w-[100dvh] h-[100dvw] -translate-x-1/2 -translate-y-1/2 rotate-90" 
          : "inset-0"
      }`}
    >
      {/* Video Container (Placeholder) */}
      <div 
        className="relative flex-1 bg-[#0a0a0a] flex items-center justify-center overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        onClick={handlePlayerClick}
      >
        {video.path ? <video src={video.path} autoPlay={isPlaying} ref={vidRef} className="w-full aspect-video bg-black z-0 object-contain" onTimeUpdate={(e)=>setProgress((e.target.currentTime/e.target.duration)*100)} onEnded={()=>{if(onNext) onNext(); else onClose();}} /> : <motion.div animate={{scale:isPlaying?[1,1.05,1]:1}} transition={{duration:15,repeat:Infinity,ease:"linear"}} className="w-full aspect-video bg-gradient-to-br from-zinc-800 via-zinc-900 to-black z-0 relative flex items-center justify-center"><Film className="w-24 h-24 text-white/10"/></motion.div>}
        
        {/* Indicator UI for skips/speeds */}
        <AnimatePresence>
          {indicatorText && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white font-bold text-lg tracking-wider pointer-events-none shadow-[0_0_20px_rgba(0,0,0,0.5)] z-[110]"
            >
              {indicatorText}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtitles Overlay Layer */}
        {subtitlesOn && (
           <div className={`absolute left-0 right-0 pointer-events-none flex items-center justify-center text-center p-4 transition-all duration-300 ${showControls ? 'bottom-28' : 'bottom-10'}`}>
              <div className="bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded text-sm sm:text-base md:text-lg font-medium tracking-wide shadow-lg border border-white/10 inline-block max-w-[80%]">
                 {activeSubtitle === 'es' ? 'Este es un subtítulo de ejemplo...' : 'This is a sample subtitle track...'}
              </div>
           </div>
        )}

        {/* Controls Overlay */}
        <AnimatePresence>
          {showControls && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col justify-between"
            >
              {/* Top Bar */}
              <div className={`flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent ${isFullscreen ? 'pt-6 pb-6 px-12' : 'pt-12 pb-12 px-4'}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); onClose(); }} 
                  className="p-3 rounded-full bg-black/20 hover:white/20 backdrop-blur-md transition-colors"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
                <div className="flex-1 px-4 text-center">
                  <h3 className="font-semibold text-[15px] truncate text-white/90 drop-shadow-md">{video.title}</h3>
                  <p className="text-xs text-white/60 font-medium drop-shadow-md">{video.duration || '00:00'}</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(true); setShowControls(false); }} 
                  className="p-3 rounded-full bg-black/20 hover:white/20 backdrop-blur-md transition-colors"
                >
                  <MoreVertical className="w-6 h-6" />
                </button>
              </div>

              {/* Center Playback Controls */}
              <div className="flex items-center justify-center gap-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); onPrev?.(); setProgress(0); }}
                  className="p-3 rounded-full hover:bg-white/20 transition-all active:scale-90 text-white/80 hover:text-white"
                >
                  <SkipBack className="w-8 h-8 fill-current" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); if(vidRef.current) { if(!isPlaying) vidRef.current.play(); else vidRef.current.pause(); } }}
                  className="w-20 h-20 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all active:scale-95 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 fill-white" />
                  ) : (
                    <Play className="w-8 h-8 fill-white ml-2" />
                  )}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onNext?.(); setProgress(0); }}
                  className="p-3 rounded-full hover:bg-white/20 transition-all active:scale-90 text-white/80 hover:text-white"
                >
                  <SkipForward className="w-8 h-8 fill-current" />
                </button>
              </div>

              {/* Bottom Scrubber & Options */}
              <div 
                className={`bg-gradient-to-t from-black via-black/80 to-transparent ${isFullscreen ? 'pt-8 pb-6 px-12' : 'pt-16 pb-10 px-6'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-white/60 mb-3 font-mono tracking-wider">
                  <span>{Math.floor(progress / 100 * 12).toString().padStart(2, '0')}:{Math.floor((progress / 100 * 45) % 60).toString().padStart(2, '0')}</span>
                  <span>{video.duration || '12:45'}</span>
                </div>
                
                {/* Scrubber Area */}
                <div className="h-10 -mt-4 w-full flex items-center relative group">
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 touch-none"
                  />
                  <div className="h-1.5 w-full bg-white/20 rounded-full relative transition-all group-hover:h-2 pointer-events-none">
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                      <div className="absolute left-0 h-full bg-white/30 w-[60%] rounded-full"></div>
                      <div 
                        className="absolute left-0 h-full bg-[var(--theme-color)] rounded-full transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    {/* Thumb */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.5)] z-20 scale-75 group-hover:scale-100 transition-transform duration-200"
                      style={{ left: `calc(${progress}% - 8px)` }}
                    ></div>
                  </div>
                </div>
                
                {/* Extra tools */}
                <div className="flex items-center justify-between mt-4">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowVolumeMenu(!showVolumeMenu); setShowControls(false); }}
                    className={`p-3 rounded-full transition-colors ${isMuted || volume === 0 ? 'text-[var(--theme-color)] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowSubtitlesMenu(!showSubtitlesMenu); setShowControls(false); }}
                    className={`p-3 rounded-full transition-colors ${subtitlesOn ? 'text-[var(--theme-color)] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                  >
                    <Subtitles className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { setShowSettings(true); setShowControls(false); }}
                    className="p-3 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => { setIsFullscreen(!isFullscreen); }}
                    className={`p-3 rounded-full transition-colors ${isFullscreen ? 'text-[var(--theme-color)] bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Subtitles Menu */}
          {showSubtitlesMenu && (
             <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              className={`absolute bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 rounded-t-3xl p-6 shadow-2xl flex flex-col gap-4 z-50 ${
                isFullscreen ? "right-0 top-0 bottom-0 w-80 rounded-l-3xl rounded-r-none border-r-0" : "bottom-0 left-0 right-0 border-b-0 pb-10 max-h-[80vh] overflow-y-auto"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-zinc-100 font-semibold text-lg">Subtitles & Captions</h4>
                <button onClick={() => setShowSubtitlesMenu(false)} className="p-2 -mr-2 text-zinc-400 hover:text-white">
                   <ChevronDown className={isFullscreen ? "-rotate-90 w-6 h-6" : "w-6 h-6"} />
                </button>
              </div>

              {/* Toggle Subtitles */}
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl">
                 <span className="font-medium text-sm text-zinc-200">Show Subtitles</span>
                 <button 
                   onClick={() => setSubtitlesOn(!subtitlesOn)}
                   className={`w-12 h-6 rounded-full p-1 transition-colors ${subtitlesOn ? 'bg-[var(--theme-color)]' : 'bg-zinc-600'}`}
                 >
                    <div className={`w-4 h-4 rounded-full transition-transform ${subtitlesOn ? 'translate-x-6 bg-[#1c1c1e]' : 'bg-white'}`} />
                 </button>
              </div>
              
              {/* List of valid subtitles */}
              <div className="mt-2">
                 <h5 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Select Subtitle</h5>
                 <div className="space-y-2">
                   {availableSubtitles.map(sub => (
                     <button
                       key={sub.id}
                       onClick={() => { setActiveSubtitle(sub.id); setSubtitlesOn(true); }}
                       className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                         activeSubtitle === sub.id && subtitlesOn ? 'bg-[var(--theme-color)] text-zinc-900' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                       }`}
                     >
                       <span>{sub.name}</span>
                       <div className="flex items-center gap-2">
                         {sub.type === 'imported' && (
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                              activeSubtitle === sub.id && subtitlesOn ? 'bg-black/20 text-zinc-900' : 'bg-black/40 text-zinc-300'
                            }`}>Imported</span>
                         )}
                       </div>
                     </button>
                   ))}
                 </div>
              </div>

              {/* Import Subtitle Option */}
              <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-2">
                <label className="flex-1 bg-white/5 border border-white/10 border-dashed hover:bg-white/10 text-white p-4 rounded-xl text-sm font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> Import external subtitle file (.srt, .vtt)
                  <input 
                    type="file" 
                    accept=".srt,.vtt,.ass,.ssa" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const newSub = {
                          id: Date.now().toString(),
                          name: file.name,
                          type: 'imported'
                        };
                        setAvailableSubtitles(prev => [...prev, newSub]);
                        setActiveSubtitle(newSub.id);
                        setSubtitlesOn(true);
                      }
                    }} 
                  />
                </label>
                <button 
                  onClick={() => {
                    const imported = availableSubtitles.filter(s => s.type === 'imported');
                    if (imported.length > 0) {
                      setAvailableSubtitles(prev => prev.filter(s => s.type !== 'imported'));
                      if (imported.find(s => s.id === activeSubtitle)) {
                        setActiveSubtitle('en');
                        setSubtitlesOn(false);
                      }
                    }
                  }}
                  className="bg-white/5 hover:bg-white/10 text-zinc-300 p-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" /> Clear Imported Subtitles
                </button>
              </div>
            </motion.div>
          )}

          {/* Settings Popup */}
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`absolute bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-2 z-50 ${
                isFullscreen ? "right-8 top-1/2 -translate-y-1/2 min-w-[200px]" : "bottom-24 right-4 min-w-[200px]"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-2">Video Quality</h4>
              {['1080p', '720p', '480p'].map(q => (
                <button
                  key={q}
                  onClick={() => { setQuality(q); setShowSettings(false); }}
                  className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    quality === q ? 'bg-[var(--theme-color)] text-zinc-900' : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  {q}
                </button>
              ))}

              <div className="h-px bg-white/10 my-2" />

              <h4 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-2 mt-2">Playback Speed</h4>
              <div className="grid grid-cols-2 gap-2">
                {[0.5, 1, 1.5, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => { setPlaybackSpeed(speed); setShowSettings(false); }}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors text-center ${
                      playbackSpeed === speed ? 'bg-[var(--theme-color)] text-zinc-900' : 'bg-white/5 text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Volume Menu */}
          {showVolumeMenu && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              className={`absolute bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 rounded-t-3xl p-6 shadow-2xl flex flex-col gap-4 z-50 ${
                isFullscreen ? "right-0 top-0 bottom-0 w-80 rounded-l-3xl rounded-r-none border-r-0" : "bottom-0 left-0 right-0 border-b-0 pb-10"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-zinc-100 font-semibold text-lg">Volume</h4>
                <button onClick={() => setShowVolumeMenu(false)} className="p-2 -mr-2 text-zinc-400 hover:text-white">
                   <ChevronDown className={isFullscreen ? "-rotate-90 w-6 h-6" : "w-6 h-6"} />
                </button>
              </div>

              <div className="bg-white/5 p-6 rounded-2xl flex items-center justify-between gap-6 shadow-inner">
                 <button 
                   onClick={() => setIsMuted(!isMuted)} 
                   className={`p-3 rounded-full transition-colors flex-none ${isMuted || volume === 0 ? 'bg-[var(--theme-color)] text-zinc-900' : 'bg-black/20 text-white/80 hover:text-white hover:bg-white/10'}`}
                 >
                   {isMuted || volume === 0 ? <VolumeX className="w-7 h-7" /> : <Volume2 className="w-7 h-7" />}
                 </button>
                 <div className="flex-1 relative flex items-center group h-10 -my-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVolume(val);
                        if (isMuted && val > 0) setIsMuted(false);
                        if (val === 0) setIsMuted(true);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 touch-none" 
                    />
                    <div className="h-2 w-full bg-black/40 rounded-full relative transition-all group-hover:h-3 pointer-events-none">
                      <div className="absolute inset-0 rounded-full overflow-hidden">
                        <div 
                          className={`absolute left-0 h-full rounded-full transition-all duration-75 ${isMuted ? 'bg-zinc-500' : 'bg-[var(--theme-color)] shadow-[0_0_10px_rgba(var(--theme-rgb),0.5)]'}`}
                          style={{ width: `${isMuted ? 0 : volume}%` }}
                        ></div>
                      </div>
                      <div 
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-md z-20 ${isMuted || volume === 0 ? 'bg-zinc-400' : 'bg-white'}`}
                        style={{ left: `calc(${isMuted ? 0 : volume}% - 8px)` }}
                      ></div>
                    </div>
                 </div>
                 <div className="w-12 text-right">
                    <span className="text-zinc-400 font-mono text-sm tracking-wider">{isMuted ? 0 : Math.round(volume)}%</span>
                 </div>
              </div>
            </motion.div>
          )}

          {/* 3 Dots Menu (Options Sheet) */}
          {showOptionsMenu && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              className={`absolute bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 rounded-t-3xl p-6 shadow-2xl flex flex-col gap-4 z-50 ${
                isFullscreen ? "right-0 top-0 bottom-0 w-80 rounded-l-3xl rounded-r-none border-r-0" : "bottom-0 left-0 right-0 border-b-0 pb-10"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-zinc-100 font-semibold text-lg">Playback Options</h4>
                <button onClick={() => setShowOptionsMenu(false)} className="p-2 -mr-2 text-zinc-400 hover:text-white">
                   <ChevronDown className={isFullscreen ? "-rotate-90 w-6 h-6" : "w-6 h-6"} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">Playback Speed</h5>
                  <div className="flex gap-2">
                    {[0.5, 1, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          playbackSpeed === speed ? 'bg-[var(--theme-color)] text-zinc-900' : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">Audio</h5>
                  <button className="w-full text-left bg-white/5 hover:bg-white/10 p-4 rounded-xl text-sm font-medium text-zinc-300 flex justify-between items-center transition-colors">
                    <span>Audio Track</span>
                    <span className="text-zinc-500">English</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function HomeSection({ onPlay }: { onPlay: (video: any) => void }) {
  const [activeAlbum, setActiveAlbum] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Default");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filteredRecent = RECENT_VIDEOS.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()) && (activeAlbum === "All" || v.album === activeAlbum));
  let filteredAll = ALL_VIDEOS.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()) && (activeAlbum === "All" || v.album === activeAlbum));
  if (sortBy === "A-Z") filteredAll.sort((a,b) => a.title.localeCompare(b.title));
  if (sortBy === "Duration (Longest)") filteredAll.sort((a,b) => durationToSec(b.duration || "") - durationToSec(a.duration || ""));
  if (sortBy === "Duration (Shortest)") filteredAll.sort((a,b) => durationToSec(a.duration || "") - durationToSec(b.duration || ""));

  return (
    <div className="pb-32">
      {/* Header / Search */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="px-5 pt-8 sticky top-0 z-10 bg-[#1c1c1e]/80 backdrop-blur-xl pb-4 shadow-sm shadow-black/10"
      >
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-[var(--theme-color)] transition-colors" />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#2c2c2e] hover:bg-[#323235] text-zinc-100 rounded-2xl pl-12 pr-14 py-3.5 outline-none focus:ring-2 focus:ring-[rgba(var(--theme-rgb),0.5)] transition-all text-lg placeholder:text-zinc-500 shadow-inner"
          />
          <button 
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#2c2c2e] hover:bg-[#323235] p-1.5 rounded-lg transition-colors border-l border-zinc-600 pl-3 -ml-2"
          >
            <ArrowUpDown className="w-5 h-5 text-zinc-400" />
          </button>
          
          <AnimatePresence>
            {showSortMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-[#2c2c2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
              >
                {["Default", "A-Z", "Duration (Longest)", "Duration (Shortest)"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${sortBy === opt ? 'bg-[var(--theme-color)] text-zinc-900 font-medium' : 'text-zinc-300 hover:bg-white/10'}`}
                  >
                    {opt}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Album Filters */}
      <div className="pl-5 py-2 mt-2">
        <div className="flex gap-3 overflow-x-auto hide-scrollbar remove-scrollbar pb-2 pr-5">
          {ALBUMS.map((album, idx) => {
            const isActive = activeAlbum === album;
            return (
              <motion.button
                key={album}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveAlbum(album)}
                className={`flex-none px-6 py-2.5 rounded-full text-[15px] font-medium tracking-wide transition-colors ${
                  isActive
                    ? "bg-[var(--theme-color)] text-zinc-900 shadow-[0_0_15px_rgba(var(--theme-rgb),0.3)]"
                    : "bg-[#2c2c2e] text-zinc-400 hover:bg-[#3a3a3c] hover:text-zinc-200"
                }`}
              >
                {album}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Recently Added Carousel */}
      <section className="mt-8">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-5 text-[22px] font-normal text-zinc-100 tracking-wide mb-4"
        >
          Recently Added
        </motion.h2>

        <div className="pl-5 overflow-x-auto hide-scrollbar remove-scrollbar pb-6 snap-x snap-mandatory">
          <div className="flex gap-4 pr-5">
            {filteredRecent.length === 0 && (
              <p className="text-zinc-500 text-sm py-4">No recent videos found.</p>
            )}
            {filteredRecent.map((video, idx) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 + idx * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onPlay(video)}
                className="snap-center flex-none w-[280px] sm:w-[320px] aspect-video bg-gradient-to-br from-[#3a3a3c] to-[#2c2c2e] rounded-3xl flex items-center justify-center relative overflow-hidden group cursor-pointer shadow-lg shadow-black/20"
              >
                {/* Simulated playback progress visual */}
                <div className="absolute bottom-0 left-0 h-1 bg-black/40 w-full z-20">
                  <div
                    className="h-full bg-[var(--theme-color)]"
                    style={{ width: `${Math.random() * 60 + 10}%` }}
                  />
                </div>

                {video.thumbnail ? (
                   <img src={video.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
                 ) : (
                   <Film className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-white/10" />
                 )}
                
                {/* Overlay data ALWAYS VISIBLE */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 z-20">
                   <p className="text-white font-medium truncate drop-shadow-md">{video.title}</p>
                   <p className="text-zinc-300 font-mono text-xs drop-shadow-md">{video.duration}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* All Videos Grid */}
      <section className="px-5 mt-4">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="text-[22px] font-normal text-zinc-100 tracking-wide mb-5"
        >
          All Videos
        </motion.h2>

        <div className="grid grid-cols-2 gap-4">
          {filteredAll.length === 0 && (
            <p className="text-zinc-500 text-sm py-4 col-span-2 text-center">No videos match your search.</p>
          )}
          {filteredAll.map((video, idx) => (
            <motion.div
              key={video.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPlay(video)}
              className="aspect-square bg-[#2c2c2e] rounded-[24px] flex items-center justify-center relative overflow-hidden group cursor-pointer border border-[#3a3a3c]/30 hover:border-[rgba(var(--theme-rgb),0.3)] transition-colors shadow-sm"
            >
              {video.thumbnail ? (
                 <img src={video.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
               ) : (
                 <Film className="w-12 h-12 text-white/10" />
               )}
               <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-between items-end">
                  <p className="text-zinc-200 text-sm font-medium truncate bg-black/60 px-2 py-1 rounded-md backdrop-blur-md inline-block max-w-[70%]">
                    {video.title}
                  </p>
                  <p className="text-white font-mono text-[10px] bg-black/60 px-1.5 py-1 rounded backdrop-blur-md">
                    {video.duration}
                  </p>
               </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LibrarySection({ onPlay }: { onPlay: (video: any) => void }) {
  const [activeView, setActiveView] = useState<{type: 'folder'|'playlist', id: number} | null>(null);
  const [sortBy, setSortBy] = useState("Default");
  const [showSortMenu, setShowSortMenu] = useState(false);

  useBackButton(() => {
     setActiveView(null);
  }, !!activeView);

  if (activeView) {
     const viewData = activeView.type === 'folder' 
       ? FOLDERS.find(f => f.id === activeView.id) 
       : PLAYLISTS.find(p => p.id === activeView.id);
       
     return (
       <motion.div 
         initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} 
         className="pt-8 pb-32 px-5 min-h-screen bg-[#1c1c1e] absolute inset-0 z-40 overflow-y-auto"
       >
         <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveView(null)} className="p-2 bg-[#2c2c2e] rounded-full text-zinc-300 hover:text-white">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-semibold">{viewData?.name}</h1>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="p-2 bg-[#2c2c2e] hover:bg-[#323235] rounded-full text-zinc-300 hover:text-white transition-colors"
              >
                <ArrowUpDown className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-[#2c2c2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                  >
                    {["Default", "A-Z", "Duration (Longest)", "Duration (Shortest)"].map(opt => (
                      <button
                        key={opt}
                        onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${sortBy === opt ? 'bg-[var(--theme-color)] text-zinc-900 font-medium' : 'text-zinc-300 hover:bg-white/10'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
         <div className="grid grid-cols-2 gap-4">
           {(() => {
              let sortedVideos = ALL_VIDEOS.filter(v => 
                activeView.type === 'folder' && viewData ? v.album === viewData.name : true
              );
              if (sortBy === "A-Z") sortedVideos.sort((a,b) => a.title.localeCompare(b.title));
              if (sortBy === "Duration (Longest)") sortedVideos.sort((a,b) => durationToSec(b.duration || "") - durationToSec(a.duration || ""));
              if (sortBy === "Duration (Shortest)") sortedVideos.sort((a,b) => durationToSec(a.duration || "") - durationToSec(b.duration || ""));
              return sortedVideos.map(video => (
             <motion.div
               key={video.id}
               whileTap={{ scale: 0.95 }}
               onClick={() => onPlay(video)}
               className="bg-[#2c2c2e] rounded-3xl p-3 cursor-pointer group"
             >
               <div className="aspect-[4/5] bg-[#3a3a3c] rounded-2xl mb-3 relative overflow-hidden">
                 {video.thumbnail ? (
                   <img src={video.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
                 ) : (
                   <Film className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-white/10" />
                 )}
                 <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-medium text-white/90 shadow-md">
                   {video.duration || "00:00"}
                 </div>
               </div>
               <h3 className="font-medium text-zinc-200 text-sm truncate px-1">{video.title}</h3>
              </motion.div>
            ))})()}
          </div>
       </motion.div>
     );
  }

  return (
    <div className="pt-8 pb-32">
      <div className="flex justify-between items-center px-5 mb-6">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} 
          className="text-3xl font-semibold tracking-tight"
        >
          My Library
        </motion.h1>
        <div className="relative z-50">
          <button 
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="p-2 bg-[#2c2c2e] hover:bg-[#323235] rounded-full text-zinc-300 hover:text-white transition-colors"
          >
            <ArrowUpDown className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {showSortMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 bg-[#2c2c2e] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
              >
                {["Default", "A-Z", "Items Count"].map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setShowSortMenu(false); }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${sortBy === opt ? 'bg-[var(--theme-color)] text-zinc-900 font-medium' : 'text-zinc-300 hover:bg-white/10'}`}
                  >
                    {opt}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <section className="px-5 mb-8">
        <h2 className="text-[18px] text-zinc-400 mb-4 font-medium tracking-wide">Local Folders</h2>
        <div className="grid grid-cols-2 gap-4">
          {(() => {
            let sortedFolders = [...FOLDERS];
            if (sortBy === "A-Z") sortedFolders.sort((a,b) => a.name.localeCompare(b.name));
            if (sortBy === "Items Count") sortedFolders.sort((a,b) => b.count - a.count);
            return sortedFolders.map((folder, idx) => (
             <motion.div
               key={folder.id}
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: idx * 0.1 }}
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={() => setActiveView({ type: 'folder', id: folder.id })}
             >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${folder.color}`}>
                  <Folder className="w-6 h-6" />
                </div>
                <h3 className="font-medium text-zinc-100">{folder.name}</h3>
                <p className="text-sm text-zinc-500 mt-1">{folder.count} videos</p>
             </motion.div>
          ))})()}
        </div>
      </section>

      <section className="px-5">
        <h2 className="text-[18px] text-zinc-400 mb-4 font-medium tracking-wide">Smart Playlists</h2>
        <div className="flex flex-col gap-3">
          {(() => {
            let sortedPlaylists = [...PLAYLISTS];
            if (sortBy === "A-Z") sortedPlaylists.sort((a,b) => a.name.localeCompare(b.name));
            // no items count in playsts...
            return sortedPlaylists.map((playlist, idx) => (
            <motion.div
               key={playlist.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3 + idx * 0.1 }}
               whileHover={{ x: 5, backgroundColor: "#3a3a3c" }}
               whileTap={{ scale: 0.98 }}
               onClick={() => setActiveView({ type: 'playlist', id: playlist.id })}
               className="flex items-center justify-between bg-[#2c2c2e] p-4 rounded-[20px] cursor-pointer border border-transparent transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#1c1c1e] flex items-center justify-center shadow-inner">
                  <playlist.icon className="w-5 h-5 text-[var(--theme-color)]" />
                </div>
                <span className="font-medium text-[16px]">{playlist.name}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-500" />
            </motion.div>
          ))})()}
        </div>
      </section>
    </div>
  );
}

function SettingsSection() {
  const [settings, setSettings] = useState(SETTING_ITEMS);
  const [activePage, setActivePage] = useState<string | null>(null);

  useBackButton(() => setActivePage(null), !!activePage);

  const handleSettingClick = (label: string) => {
    if (label === 'Appearance') {
       setSettings(prev => prev.map(s => s.label === label ? { ...s, value: s.value === 'Dark' ? 'Light' : 'Dark' } : s));
    } else if (label === 'Notifications') {
       setSettings(prev => prev.map(s => s.label === label ? { ...s, value: s.value === 'On' ? 'Off' : 'On' } : s));
    } else {
       setActivePage(label);
    }
  };

  if (activePage) {
     return (
       <motion.div 
         initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} 
         className="pt-8 pb-32 px-5 min-h-screen bg-[#1c1c1e] absolute inset-0 z-40 overflow-y-auto"
       >
         <div className="flex items-center gap-4 mb-8">
           <button onClick={() => setActivePage(null)} className="p-2 bg-[#2c2c2e] rounded-full text-zinc-300 hover:text-white transition-colors">
             <ArrowLeft className="w-6 h-6" />
           </button>
           <h1 className="text-2xl font-semibold">{activePage}</h1>
         </div>
         <div className="text-zinc-400 p-6 bg-[#2c2c2e] rounded-3xl shadow-sm">
           {activePage === "Privacy & Security" && <p>Your privacy settings and security configurations go here. You can manage passwords and telemetry data.</p>}
           {activePage === "Playback" && <p>Default playback settings. Hardware Decoding: Enabled. Auto-Play Next: Enabled. Default Quality: Auto.</p>}
           {activePage === "About Lumi" && <p>Lumi Video Player v1.0.4. Developed utilizing modern web technologies for a seamless experience.</p>}
         </div>
       </motion.div>
     );
  }

  return (
    <div className="pt-8 pb-32">
      <motion.h1 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} 
        className="px-5 text-3xl font-semibold mb-6 tracking-tight"
      >
        Settings
      </motion.h1>

      {/* User Profile Card */}
      <motion.div 
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ delay: 0.1 }}
         className="mx-5 bg-gradient-to-br from-[#3a3a3c] to-[#2c2c2e] p-5 rounded-[24px] mb-8 flex items-center gap-5 shadow-lg border border-zinc-700/50"
      >
        <div className="w-16 h-16 rounded-full bg-[var(--theme-color)] flex items-center justify-center text-zinc-900 font-bold text-2xl shadow-inner border-[4px] border-[#2c2c2e]">
          KS
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 tracking-wide">K. Shenaaz</h2>
          <p className="text-[rgba(var(--theme-rgb),0.8)] text-sm font-medium mt-0.5">Pro User</p>
        </div>
      </motion.div>

      {/* Settings Options */}
      <section className="px-5 space-y-3">
         {settings.map((item, idx) => (
           <motion.div
             key={item.label}
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.2 + idx * 0.05 }}
             whileHover={{ scale: 1.02, backgroundColor: "#3a3a3c" }}
             whileTap={{ scale: 0.98 }}
             onClick={() => handleSettingClick(item.label)}
             className="flex items-center justify-between bg-[#2c2c2e] p-4 rounded-[20px] cursor-pointer shadow-sm"
           >
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center shadow-inner">
                 <item.icon className="w-5 h-5 text-zinc-300" />
               </div>
               <span className="font-medium text-[16px]">{item.label}</span>
             </div>
             <div className="flex items-center gap-3">
               {item.value && <span className="text-zinc-400 text-sm font-medium">{item.value}</span>}
               <ChevronRight className="w-5 h-5 text-zinc-600" />
             </div>
           </motion.div>
         ))}
      </section>
    </div>
  );
}

function BottomNav({ activeTab, onTabSelect }: { activeTab: string, onTabSelect: (id: string) => void }) {
  const activeIndex = NAV_TABS.findIndex(t => t.id === activeTab);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-4 pointer-events-none">
      <div className="max-w-md mx-auto relative pointer-events-auto">
        <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
            className="h-[72px] bg-white/5 backdrop-blur-2xl rounded-[36px] flex items-center relative shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10"
         >
         
         {/* Floating Circle that moves with active tab.
             It matches the background color of the body to create the cutout illusion seamlessly. */}
         <motion.div
           initial={false}
           animate={{ x: `${activeIndex * 100}%` }}
           transition={{ type: "spring", stiffness: 450, damping: 30 }}
           className="absolute top-0 left-0 w-1/3 h-full pointer-events-none z-20"
         >
            <div className="absolute left-1/2 -translate-x-1/2 -top-7 w-[76px] h-[76px] bg-[var(--theme-color)] rounded-full flex items-center justify-center text-[#1c1c1e] shadow-[0_8px_30px_rgba(var(--theme-rgb),0.4)] border-[6px] border-[#1c1c1e]">
               <AnimatePresence mode="wait">
                 {NAV_TABS.map((tab) => (
                   tab.id === activeTab && (
                     <motion.div
                       key={`floating-${tab.id}`}
                       initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                       animate={{ opacity: 1, scale: 1, rotate: 0 }}
                       exit={{ opacity: 0, scale: 0.5, rotate: 45, position: 'absolute' }}
                       transition={{ duration: 0.2 }}
                     >
                       <tab.icon strokeWidth={2.5} className="w-8 h-8" />
                     </motion.div>
                   )
                 ))}
               </AnimatePresence>
            </div>
         </motion.div>

         {/* Inner interactive tabs */}
         <div className="flex w-full h-full relative z-10">
           {NAV_TABS.map(tab => {
             const isActive = activeTab === tab.id;
             return (
               <button
                 key={tab.id}
                 onClick={() => onTabSelect(tab.id)}
                 className="flex-1 flex items-center justify-center w-full h-full cursor-pointer tap-highlight-transparent"
                 style={{ WebkitTapHighlightColor: 'transparent' }}
               >
                 {/* Inactive Icon Container */}
                 <motion.div 
                   animate={{ 
                      opacity: isActive ? 0 : 1, 
                      y: isActive ? 24 : 0, 
                      scale: isActive ? 0.5 : 1 
                   }}
                   transition={{ duration: 0.3, ease: 'easeOut' }}
                   className="text-zinc-400 hover:text-zinc-100 transition-colors"
                 >
                   <tab.icon strokeWidth={2.5} className="w-7 h-7" />
                 </motion.div>
               </button>
             )
           })}
         </div>
        </motion.div>
      </div>
    </div>
  );
}

const APP_COLORS = [
  { hex: "#FDFB71", rgb: "253, 251, 113" },
  { hex: "#A3FF8A", rgb: "163, 255, 138" }, // Green
  { hex: "#73E2DF", rgb: "115, 226, 223" }, // Cyan
  { hex: "#F9A8D4", rgb: "249, 168, 212" }, // Pink
  { hex: "#C084FC", rgb: "192, 132, 252" }, // Purple
  { hex: "#FF9D76", rgb: "255, 157, 118" }, // Orange
  { hex: "#818CF8", rgb: "129, 140, 248" }, // Indigo
];

const NativeOrWebPlayer = ({ video, onClose, onNext, onPrev }: any) => {
   useEffect(() => {
      if (Capacitor.isNativePlatform()) {
         let isCleanedUp = false;
         const playNative = async () => {
             try {
                 let rawUrl = (video.rawPath || video.path);
                 if (rawUrl && !rawUrl.startsWith('http') && !rawUrl.startsWith('content://')) {
                     rawUrl = 'file://' + rawUrl;
                 }
                 const opts: any = { mode: 'fullscreen', url: rawUrl.replace('file://file://', 'file://') };
                 if (video.rawSubtitle) {
                     opts.subtitle = video.rawSubtitle && !video.rawSubtitle.startsWith('http') ? 'file://' + video.rawSubtitle : video.rawSubtitle;
                     opts.subtitle = opts.subtitle.replace('file://file://', 'file://');
                 }
                 await CapacitorVideoPlayer.initPlayer(opts);
             } catch(e) { console.error('playerr', e); onClose(); }
         };
         
         const listeners = [
            (CapacitorVideoPlayer as any).addListener('jeepCapVideoPlayerExit', () => {
               if (!isCleanedUp) onClose();
            }),
            (CapacitorVideoPlayer as any).addListener('jeepCapVideoPlayerEnded', () => {
               if (!isCleanedUp) onClose();
            })
         ];
         
         playNative();
         
         return () => {
            isCleanedUp = true;
            listeners.forEach(l => l.then(sub => sub.remove()));
            CapacitorVideoPlayer.stopAllPlayers().catch(()=>{});
         };
      }
   }, [video]);
   
   if (Capacitor.isNativePlatform()) return null; // Native overlay is handled
   return <VideoPlayer video={video} onClose={onClose} onNext={onNext} onPrev={onPrev} />;
};

export default function App() {
  const [isNativeReady, setIsNativeReady] = useState(false);

  useEffect(() => {
    const loadNativeMedia = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const formatDuration = (sec?: number) => {
            if (!sec) return '00:00';
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          };

          const res = await VideoProvider.getVideos();

          if (res && res.videos && res.videos.length > 0) {
            const vids = res.videos.map((v: any, i: number) => {
              return {
                id: v.id,
                title: v.title || `Video ${i+1}`,
                duration: formatDuration(Math.floor(v.duration / 1000)),
                album: v.album || 'Gallery',
                path: Capacitor.convertFileSrc(v.path),
                rawPath: v.path,
                subtitle: v.subtitle ? Capacitor.convertFileSrc(v.subtitle) : undefined,
                rawSubtitle: v.subtitle,
                thumbnail: v.thumbnail ? Capacitor.convertFileSrc(v.thumbnail) : undefined
              };
            });

            const albumCounts: Record<string, number> = {};
            vids.forEach((v: any) => {
                albumCounts[v.album] = (albumCounts[v.album] || 0) + 1;
            });

            FOLDERS = Object.keys(albumCounts).map((album, index) => ({
                id: 1000 + index,
                name: album,
                count: albumCounts[album],
                color: APP_COLORS[index % APP_COLORS.length].hex
            }));

            ALBUMS = ["All", ...FOLDERS.map(f => f.name)];

            ALL_VIDEOS = vids;
            RECENT_VIDEOS = vids.slice(0, 10);
          } else {
             ALL_VIDEOS = [];
             RECENT_VIDEOS = [];
             FOLDERS = [];
          }
        } catch(e) { 
           console.error("Media load err: ", e); 
           ALL_VIDEOS = [];
           RECENT_VIDEOS = [];
           FOLDERS = [];
        }
      }
      setIsNativeReady(true);
    };
    loadNativeMedia();
  }, []);

  const [activeTab, setActiveTab] = useState("home");
  const [direction, setDirection] = useState(0);
  const [playingVideo, setPlayingVideo] = useState<any>(null);
  const [currentColor, setCurrentColor] = useState(APP_COLORS[0]);

  useBackButton(() => {
    setActiveTab("home");
  }, activeTab !== "home");

  const handleNextVideo = () => {
    if (!playingVideo) return;
    const allAvailable = [...RECENT_VIDEOS, ...ALL_VIDEOS];
    const currentIndex = allAvailable.findIndex(v => v.id === playingVideo.id);
    if (currentIndex >= 0 && currentIndex < allAvailable.length - 1) {
      setPlayingVideo(allAvailable[currentIndex + 1]);
    } else if (currentIndex === allAvailable.length - 1) {
      setPlayingVideo(allAvailable[0]); // Loop back
    }
  };

  const handlePrevVideo = () => {
    if (!playingVideo) return;
    const allAvailable = [...RECENT_VIDEOS, ...ALL_VIDEOS];
    const currentIndex = allAvailable.findIndex(v => v.id === playingVideo.id);
    if (currentIndex > 0) {
      setPlayingVideo(allAvailable[currentIndex - 1]);
    } else if (currentIndex === 0) {
      setPlayingVideo(allAvailable[allAvailable.length - 1]); // Loop to end
    }
  };

  const handleTabChange = (newTab: string) => {
    if (newTab === activeTab) return;
    const oldIdx = NAV_TABS.findIndex(t => t.id === activeTab);
    const newIdx = NAV_TABS.findIndex(t => t.id === newTab);
    setDirection(newIdx > oldIdx ? 1 : -1);
    setActiveTab(newTab);

    const availableColors = APP_COLORS.filter(c => c.hex !== currentColor.hex);
    const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
    setCurrentColor(randomColor);
  };

  const variants = {
    initial: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 40 : -40,
      filter: 'blur(8px)',
    }),
    animate: {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } // Custom spring-like easing
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -40 : 40,
      filter: 'blur(8px)',
      transition: { duration: 0.3, ease: 'easeIn' }
    })
  };

  return (
    <div 
      className="min-h-screen bg-[#1c1c1e] text-zinc-100 font-sans selection:bg-[rgba(var(--theme-rgb),0.3)] overflow-x-hidden relative"
      style={{
        '--theme-color': currentColor.hex,
        '--theme-rgb': currentColor.rgb,
      } as any}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .remove-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .remove-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .tap-highlight-transparent {
          -webkit-tap-highlight-color: transparent;
        }
      `}} />

      <AnimatePresence>
        {playingVideo && (
          <NativeOrWebPlayer 
            video={playingVideo} 
            onClose={() => setPlayingVideo(null)} 
            onNext={handleNextVideo}
            onPrev={handlePrevVideo}
          />
        )}
      </AnimatePresence>

      <div className="w-full h-full pb-20">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div 
            key={activeTab} 
            custom={direction}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full h-full absolute top-0 left-0"
          >
             {activeTab === 'home' && <HomeSection onPlay={setPlayingVideo} />}
             {activeTab === 'library' && <LibrarySection onPlay={setPlayingVideo} />}
             {activeTab === 'settings' && <SettingsSection />}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav activeTab={activeTab} onTabSelect={handleTabChange} />
    </div>
  );
}
