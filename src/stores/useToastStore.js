import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  showToast: (message, type = 'info', title = null, options = {}) => {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const duration = options.duration || (type === 'error' ? 6500 : 5200);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, title, duration }].slice(-4),
    }));
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  clearToasts: () => set({ toasts: [] }),
}));

export default useToastStore;
