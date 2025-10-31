/**
 * Simple toast notification utility for displaying error and success messages.
 * This is a minimal implementation that can be replaced with a more sophisticated
 * toast library like react-hot-toast or sonner if needed.
 */

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  duration?: number;
  position?: "top" | "bottom";
}

class ToastManager {
  private container: HTMLDivElement | null = null;

  private ensureContainer() {
    if (this.container) return this.container;

    this.container = document.createElement("div");
    this.container.id = "toast-container";
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
    return this.container;
  }

  show(message: string, type: ToastType = "info", options: ToastOptions = {}) {
    const { duration = 5000, position = "top" } = options;
    const container = this.ensureContainer();

    const toast = document.createElement("div");
    toast.style.cssText = `
      background: ${this.getBackgroundColor(type)};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 400px;
      word-wrap: break-word;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
    `;

    toast.textContent = message;

    if (position === "bottom") {
      container.style.top = "auto";
      container.style.bottom = "20px";
    }

    container.appendChild(toast);

    // Auto-dismiss after duration
    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease-in";
      setTimeout(() => {
        container.removeChild(toast);
        if (container.children.length === 0 && this.container) {
          document.body.removeChild(this.container);
          this.container = null;
        }
      }, 300);
    }, duration);
  }

  private getBackgroundColor(type: ToastType): string {
    switch (type) {
      case "success":
        return "#10b981";
      case "error":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "info":
      default:
        return "#3b82f6";
    }
  }
}

// Add CSS animations
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

const toastManager = new ToastManager();

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    toastManager.show(message, "success", options),
  error: (message: string, options?: ToastOptions) =>
    toastManager.show(message, "error", options),
  info: (message: string, options?: ToastOptions) =>
    toastManager.show(message, "info", options),
  warning: (message: string, options?: ToastOptions) =>
    toastManager.show(message, "warning", options),
};
