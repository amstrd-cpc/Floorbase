import { SettingsNav } from '@/components/admin/settings-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <SettingsNav />
      {children}
    </div>
  );
}
