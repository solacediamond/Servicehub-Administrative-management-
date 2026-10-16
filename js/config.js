/* ServiceHub Admin — live Apps Script configuration. */
window.ADMIN_CONFIG = {
  MODE: 'live',
  API_URL: 'https://script.google.com/macros/s/AKfycbwXI0B1wI9BUFBtfEKkW5IenjTTaurofc61ClL6VJc9Oa9iT90biB7Xo7JkZOGlc08W/exec',
  SESSION_HOURS: 12,
  IDLE_MINUTES: 5,
  MIN_AGE: 12,
  STATUS_MAP: {
    approved: ['approved', 'active', 'live'],
    pending: ['pending', 'awaiting', 'awaiting approval', 'new'],
    disapproved: ['disapproved', 'rejected', 'declined'],
    expired: ['expired']
  }
};
