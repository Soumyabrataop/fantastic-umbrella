// Simple toast hook (you can replace with a library like react-hot-toast later)

type ToastType = "success" | "error" | "info";

export const toast = {
  success: (message: string) => {
    if (typeof window !== "undefined") {
      // For now, use console.log - replace with actual toast library later
      console.log("✅ Success:", message);
      // You can use react-hot-toast, sonner, or any toast library here
      alert(`✅ ${message}`);
    }
  },
  error: (message: string) => {
    if (typeof window !== "undefined") {
      console.error("❌ Error:", message);
      alert(`❌ ${message}`);
    }
  },
  info: (message: string) => {
    if (typeof window !== "undefined") {
      console.info("ℹ️ Info:", message);
      alert(`ℹ️ ${message}`);
    }
  },
};
