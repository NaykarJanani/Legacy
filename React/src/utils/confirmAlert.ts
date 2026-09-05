import Swal from "sweetalert2";

export const confirmAlert = async (
  title: string,
  text: string,
  confirmText: string = "Yes",
  cancelText: string = "Cancel"
): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
  });

  return result.isConfirmed;
};
