// No verification request, analytics, cookies or session storage on this page.
// A mail scanner can fetch the page without using a member's one-time proof.
(() => {
  if (window.top !== window.self) {
    document.documentElement.remove();
    return;
  }
  const source = new URL(location.href);
  history.replaceState(null, "", source.pathname);
  const params = new URLSearchParams(source.hash.slice(1));
  const tokenHash = params.get("token_hash") || "";
  const type = params.get("type") || "";
  const staging = source.pathname.startsWith("/staging/");
  const path = staging
    ? source.pathname.slice("/staging".length)
    : source.pathname;
  const routes = {
    "/confirm/": "signup",
    "/sign-in/": "magiclink",
    "/reset-password/": "recovery",
    "/email-change/": "email_change",
  };
  const copy = {
    signup: [
      "Confirm your email.",
      "One tap, then you’re ready to make eaze yours.",
      "Confirm email in eaze",
    ],
    email: [
      "Continue in eaze.",
      "Open the app to finish securely.",
      "Open eaze",
    ],
    magiclink: [
      "Welcome back.",
      "Your sign-in link is ready. Let’s get you into eaze.",
      "Sign in to eaze",
    ],
    recovery: [
      "A fresh password.",
      "Open eaze to choose your new password.",
      "Reset password in eaze",
    ],
    email_change: [
      "Confirm your email.",
      "Open eaze to confirm your new email address.",
      "Confirm email in eaze",
    ],
  };
  const title = document.getElementById("title");
  const message = document.getElementById("message");
  const button = document.getElementById("open");
  const help = document.getElementById("help");
  const legacy = source.pathname === "/";
  const valid =
    !source.search &&
    !source.username &&
    !source.password &&
    (legacy || routes[path] === type) &&
    Object.hasOwn(copy, type) &&
    [...params.keys()].length === 2 &&
    params.getAll("token_hash").length === 1 &&
    params.getAll("type").length === 1 &&
    /^[A-Za-z0-9._~-]{32,512}$/.test(tokenHash);
  if (!valid) {
    document.body.classList.add("error");
    title.textContent = "Let’s try a fresh link.";
    message.textContent = "Open eaze and request a new account email.";
    help.textContent =
      "Use the most recent email, on the iPhone where eaze is installed.";
    button.hidden = true;
    return;
  }
  [title.textContent, message.textContent, button.textContent] = copy[type];
  document.title = `${title.textContent.replace(/\.$/, "")} — eaze`;
  button.disabled = false;
  const callback = new URL(
    legacy
      ? "uk.co.eaze.app://auth/callback"
      : source.pathname === "/confirm/"
        ? "uk.co.eaze.app://auth/confirm"
        : `uk.co.eaze.app://auth${source.pathname}`,
  );
  callback.hash = new URLSearchParams({
    token_hash: tokenHash,
    type,
  }).toString();
  button.addEventListener("click", () => {
    location.assign(callback.toString());
    help.textContent =
      "If eaze didn’t open, check it’s installed on this iPhone and tap again.";
  });
})();
