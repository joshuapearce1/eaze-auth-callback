(() => {
  if (window.top !== window.self) { document.documentElement.remove(); return; }
  const source = new URL(location.href);
  // Erase proof from browser history immediately. It is never sent to this host.
  history.replaceState(null, "", source.pathname);
  const params = new URLSearchParams(source.hash.slice(1));
  const tokenHash = params.get("token_hash") || "";
  const valid = source.pathname === "/confirm/" && !source.search &&
    [...params.keys()].length === 2 && params.getAll("token_hash").length === 1 &&
    params.getAll("type").length === 1 && params.get("type") === "signup" &&
    /^[a-f0-9]{56,64}$/.test(tokenHash);
  if (!valid) {
    document.getElementById("title").textContent = "Let’s try a fresh link.";
    document.getElementById("message").textContent = "This confirmation link cannot be used. Return to eaze and request a new confirmation email.";
    return;
  }
  const button = document.getElementById("open");
  button.disabled = false;
  button.addEventListener("click", () => {
    // Only an explicit tap can invoke the fallback. No automatic redirect or
    // token consumption: mail scanners cannot confirm an account by fetching us.
    location.assign("uk.co.eaze.app://auth/confirm#" + new URLSearchParams({token_hash:tokenHash,type:"signup"}));
  });
})();
