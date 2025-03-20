export function showToast(message: string, type: "success" | "error" = "success"): void {
    // Create a toast element
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
  
    // Append the toast to the container
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      console.error("Toast container not found. Ensure a container with id 'toast-container' exists in the DOM.");
      return;
    }
    toastContainer.appendChild(toast);
  
    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  