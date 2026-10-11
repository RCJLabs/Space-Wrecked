// "Update ready, tap to reload". Shown when a new service worker is waiting.
// Tapping tells it to take over; the page reloads when it does.

let apply = null;

export function showUpdatePrompt(root, applyUpdate) {
  apply = applyUpdate;
  if (root.querySelector('.update-prompt')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'update-prompt';
  button.textContent = 'Update ready, tap to reload';
  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Updating…';
    apply();
  });
  root.append(button);
}
