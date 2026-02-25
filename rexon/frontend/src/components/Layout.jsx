import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatPanel from './ChatPanel';

const NAV = [
  { path: '/',              label: 'Dashboard',    icon: '⬡' },
  { path: '/testcases',     label: 'Test Cases',   icon: '◈' },
  { path: '/runs',          label: 'Runs',         icon: '▶' },
  { path: '/credentials',   label: 'Credentials',  icon: '🔑' },
];

export default function Layout({ children, projectId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#060d1a] text-slate-200 flex flex-col">
      {/* Top nav */}
      <header className="border-b border-[#1a3050] px-6 py-3 flex items-center justify-between sticky top-0 z-40 bg-[#060d1a]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">R</div>
            <div>
              <div className="font-bold text-white tracking-widest text-xs">REXON</div>
              <div className="text-[10px] text-slate-500 tracking-wider">AI QA PLATFORM</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(n => (
              <button key={n.path} onClick={() => navigate(n.path)}
                className={`px-3 py-1.5 rounded text-xs tracking-wider transition-colors flex items-center gap-1.5
                  ${location.pathname === n.path
                    ? 'bg-[#1a3050] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-[#0d1929]'}`}>
                <span className="text-xs">{n.icon}</span> {n.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
            AGENT READY
          </div>
          <button onClick={() => setChatOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs tracking-wider transition-all border
              ${chatOpen
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-[#1a3050] text-slate-400 hover:text-white hover:border-blue-600'}`}>
            <span>💬</span> AI CHAT
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <main className={`flex-1 overflow-auto transition-all duration-300 ${chatOpen ? 'mr-[380px]' : ''}`}>
          {children}
        </main>

        {/* Floating chat panel */}
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          projectId={projectId}
        />
      </div>
    </div>
  );
}
