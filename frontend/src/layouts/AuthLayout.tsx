import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl shadow-purple-500/10">
          {children}
        </div>
      </div>
    </div>
  );
}
