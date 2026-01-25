import { CheckCircle, XCircle, X } from 'lucide-react';
import { useToast } from '../hooks/useToast';

function Toast() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
            ${toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-200'}
          `}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <XCircle size={20} />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="ml-2 p-1 hover:bg-black/10 rounded"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toast;
