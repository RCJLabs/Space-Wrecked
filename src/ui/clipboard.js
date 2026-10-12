// Copies a text area's text, by the clipboard API where the browser has it
// and otherwise by selecting it and copying. Resolves to true if it copied.
export async function copyText(area) {
  try {
    await navigator.clipboard.writeText(area.value);
    return true;
  } catch {
    area.focus();
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}
