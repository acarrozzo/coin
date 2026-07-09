export type ToastKind = 'info' | 'good' | 'level';

export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

function createNotify() {
  let toasts = $state<Toast[]>([]);
  let nextId = 0;

  function dismiss(id: number): void {
    toasts = toasts.filter((t) => t.id !== id);
  }

  function push(text: string, kind: ToastKind = 'info', ttl = 3200): void {
    const id = nextId++;
    toasts.push({ id, text, kind });
    setTimeout(() => dismiss(id), ttl);
  }

  return {
    get toasts() {
      return toasts;
    },
    push,
    dismiss,
  };
}

export const notify = createNotify();
