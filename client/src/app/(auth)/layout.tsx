/**
 * Auth layout — used by login, register, forgot-password, reset-password
 * Centers content on screen with TeamFlow branding at top
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 lab(80 2.05 -15.26) dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* TeamFlow Branding */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">TF</span>
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Team<span className="text-indigo-600">Flow</span>
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Project management for modern teams
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}