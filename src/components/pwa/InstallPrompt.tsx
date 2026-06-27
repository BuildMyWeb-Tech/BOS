'use client';
// src/components/pwa/InstallPrompt.tsx
//
// Captures the browser's beforeinstallprompt event (Chrome/Edge/Android —
// Safari/iOS has no equivalent API and always relies on manual
// "Add to Home Screen") and shows a small dismissible banner offering
// to install the PWA. Remembers dismissal in sessionStorage so it doesn't
// nag on every page load within the same session.

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'bos_install_dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
        <Download size={16} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Install BOS</p>
        <p className="text-xs text-gray-500 mt-0.5">Add to your home screen for quick, full-screen access.</p>
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={handleInstall}
            className="text-xs font-medium px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs font-medium px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
