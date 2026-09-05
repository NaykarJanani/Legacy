// src/utils/infoAlert.ts
import Swal from "sweetalert2";

/**
 * Show an informational alert using SweetAlert2
 * @param title - The title of the alert
 * @param text - The message/content of the alert
 * @param confirmText - Text for the confirm button (default: "OK")
 */
export const infoAlert = async (
  title: string,
  text: string,
  confirmText: string = "OK"
): Promise<void> => {
  await Swal.fire({
    title,
    text,
    icon: "info",
    confirmButtonText: confirmText,
    allowOutsideClick: false, // optional: prevent closing by clicking outside
  });
};
