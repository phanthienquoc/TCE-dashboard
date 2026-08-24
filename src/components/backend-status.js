export function backendBanner(status) {
  if (status.checking) return '<div class="backend-status checking">● Checking backend…</div>';
  if (!status.ok) return '<div class="backend-status down">● Backend unavailable — please try again</div>';
  return '<div class="backend-status up">● Backend online</div>';
}
