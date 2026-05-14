import { ReactNode } from 'react';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import AlertToast from './AlertToast';
import { useWebSocket } from '../hooks/useWebSocket';

export default function AppLayout({ children }: { children: ReactNode }) {
  useWebSocket();
  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <TopBar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      <StatusBar />
      <AlertToast />
    </div>
  );
}
