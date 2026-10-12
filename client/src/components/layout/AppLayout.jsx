import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import VerifyEmailBanner from '../security/VerifyEmailBanner';
import { LayoutProvider } from '../../context/LayoutContext';

function AppLayoutContent({ children }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex transition-colors duration-200">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <VerifyEmailBanner />

        {/* Main content with responsive padding and overflow-x protection */}
        <main className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}

function AppLayout({ children }) {
  return (
    <LayoutProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </LayoutProvider>
  );
}

export default AppLayout;
