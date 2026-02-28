import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  background?: ReactNode; // Added background prop
}

export default function AuthLayout({ children, background }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center p-4 relative"> {/* Added relative to establish stacking context */}
      {background && <div className="absolute inset-0 z-0">{background}</div>} {/* Render background here */}
      <div className="w-full max-w-md relative z-10"> {/* Added relative z-10 to bring content forward */}
        <div className="bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl shadow-purple-500/10">
          {children}
        </div>
      </div>
    </div>
  );
}
