// No verification request, analytics, cookies or session storage on this page.
// A mail scanner can fetch the page without using a member's one-time proof.
(() => {
  if (window.top !== window.self) {
    document.documentElement.remove();
    return;
  }
  const routes = {
    "/confirm/": "signup",
    "/sign-in/": "magiclink",
    "/reset-password/": "recovery",
    "/email-change/": "email_change",
  };
  const copy = {
    signup: [
      "Confirm your email.",
      "After installing eaze, reopen your confirmation email on this iPhone.",
      "Confirm email in eaze",
    ],
    email: [
      "Continue in eaze.",
      "After installing eaze, reopen your newest email on this iPhone.",
      "Open eaze",
    ],
    magiclink: [
      "Welcome back.",
      "After installing eaze, reopen your sign-in email on this iPhone.",
      "Sign in to eaze",
    ],
    recovery: [
      "A fresh password.",
      "After installing eaze, reopen your reset email on this iPhone to choose a new password.",
      "Reset password in eaze",
    ],
    email_change: [
      "Confirm your email.",
      "After installing eaze, reopen your email to confirm the new address.",
      "Confirm email in eaze",
    ],
  };
  const title = document.getElementById("title");
  const message = document.getElementById("message");
  const button = document.getElementById("open");
  const help = document.getElementById("help");
  const defaultHelp = help.textContent;
  const installed = document.getElementById("installed");
  const freshSteps = document.getElementById("fresh-steps");
  const defaultSteps = freshSteps?.textContent;
  const signInSteps =
    "On the eaze sign-in screen, choose “Use an email link instead”. Enter your email, tap “Send sign-in link” and open the newest email on this iPhone.";
  const steps = {
    signup:
      "For a signup you’ve started, choose “Use an email link instead” on the eaze sign-in screen. Enter the address you signed up with, tap “Send sign-in link” and open the newest email.",
    magiclink: signInSteps,
    recovery:
      "On the eaze sign-in screen, tap “Forgot password?”. Enter your email, tap “Send reset link” and open the newest email on this iPhone.",
    email: signInSteps,
    email_change:
      "Open your newest email about the address change. If you need another, choose “Need a hand?” to contact eaze support.",
  };
  let openLink;

  function refreshLink() {
    if (openLink) {
      button.removeEventListener("click", openLink);
      openLink = undefined;
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
    // Older cached pages still use this script with the original app button.
    if (installed) {
      installed.open = false;
      installed.hidden = !valid;
    }
    if (freshSteps) {
      const purpose = legacy && valid ? type : routes[path];
      freshSteps.textContent = steps[purpose] ?? defaultSteps;
    }
    if (!valid) {
      document.body.classList.add("error");
      title.textContent = "Let’s try a fresh link.";
      const expired =
        params.get("error_code") === "otp_expired" ||
        source.searchParams.get("error_code") === "otp_expired";
      message.textContent = expired
        ? "This link has expired or was already used. Follow the steps below for a fresh email."
        : "Open your newest account email, or request another from the eaze sign-in screen.";
      help.textContent = "";
      button.hidden = true;
      button.disabled = true;
      document.title = "Request a fresh link — eaze";
      return;
    }
    [title.textContent, message.textContent, button.textContent] = copy[type];
    document.title = `${title.textContent.replace(/\.$/, "")} — eaze`;
    document.body.classList.remove("error");
    help.textContent = defaultHelp;
    button.hidden = false;
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
    openLink = () => {
      if (location.hash) {
        refreshLink();
        return;
      }
      location.assign(callback.toString());
      help.textContent =
        installed
          ? "If eaze didn’t open, use the installation option above, then reopen your email."
          : "If eaze didn’t open, install it on this iPhone, then reopen your email.";
    };
    button.addEventListener("click", openLink);
  }

  window.addEventListener("hashchange", (event) => {
    if (event.newURL === location.href) refreshLink();
  });
  refreshLink();
})();
