
import React, { useState, useEffect, useRef } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { SidebarProvider } from '../../context/SidebarContext';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { TransactionType } from '../../types';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- LOGIC NOTIFIKASI REAL-TIME (KHUSUS ADMIN) ---
  useEffect(() => {
    // 1. Cek Role User: Hanya jalankan jika role adalah 'admin'
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    
    if (!user || role !== 'admin') return;

    // 2. Minta Izin Notifikasi Browser/HP
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // Pre-load suara notifikasi
    // Menggunakan sound effect "Ping" yang sopan
    if (!audioRef.current) {
        audioRef.current = new Audio('https://cdn.freesound.org/previews/536/536108_11702744-lq.mp3'); 
    }

    console.log("Mengaktifkan Listener Notifikasi untuk Admin...");

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          const newTrx = payload.new;

          // Filter: Jangan notif jika Admin sendiri yang sedang menginput
          if (newTrx.pic === user.email) return;

          // Siapkan pesan
          const typeLabel = newTrx.type === TransactionType.IN ? 'Barang Masuk' : 'Barang Keluar';
          const title = `Info: ${typeLabel}`;
          // Jika pic null/undefined, gunakan 'Unknown'
          const operatorName = newTrx.pic || 'Unknown';
          const body = `Operator ${operatorName} baru saja menginput ${newTrx.quantity} unit.`;

          // 1. Bunyikan Suara
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.log("Gagal memutar audio (perlu interaksi user):", e));
          }

          // 2. Tampilkan Notifikasi Sistem (Pop-up di atas layar HP)
          if (Notification.permission === 'granted') {
             try {
                new Notification(title, {
                  body: body,
                  icon: '/vite.svg', // Ikon aplikasi
                  tag: 'transaction-update', // Mencegah spam notif menumpuk
                  renotify: true // Getar/bunyi ulang jika ada notif baru dengan tag sama
                } as any);
             } catch (e) {
               console.error("Error menampilkan notifikasi:", e);
             }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
        <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <div className="container mx-auto px-4 sm:px-6 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
