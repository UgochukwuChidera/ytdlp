import { ref } from 'vue'

// Global in-app confirm dialog state, shared app-wide like useToast.
const dialog = ref(null)
let dialogId = 0

export function useDialog() {
  function confirmDialog({
    title = 'Are you sure?',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
  } = {}) {
    return new Promise(resolve => {
      // A second confirm while one is open would orphan the first promise;
      // settle it as cancelled so its caller never hangs.
      if (dialog.value) {
        dialog.value.resolve(false)
      }
      dialog.value = { id: ++dialogId, title, message, confirmLabel, cancelLabel, danger, resolve }
    })
  }

  function resolveDialog(result) {
    if (!dialog.value) return
    dialog.value.resolve(result)
    dialog.value = null
  }

  return { dialog, confirmDialog, resolveDialog }
}
