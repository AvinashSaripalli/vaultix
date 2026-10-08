import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import VerifyEmailBanner from '../security/VerifyEmailBanner';

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex transition-colors duration-200">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <VerifyEmailBanner />

        {/* Main content */}
        <main className="p-6 flex-1">{children}</main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}

export default AppLayout;
