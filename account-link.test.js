import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  new URL("./assets/account-link.js", import.meta.url),
  "utf8",
);
const proof = "a".repeat(64);
function page(path, fragment, extra = "", cachedMarkup = false) {
  const ids = ["title", "message", "open", "help"];
  if (!cachedMarkup) ids.push("installed", "fresh-steps");
  const elements = Object.fromEntries(
    ids.map((key) => [
      key,
      {
        textContent: "",
        hidden: false,
        disabled: true,
        addEventListener(event, callback) {
          this[event] = callback;
        },
        removeEventListener(event, callback) {
          if (this[event] === callback) delete this[event];
        },
      },
    ]),
  );
  const redirects = [];
  const history = [];
  const context = {
    window: {
      addEventListener(event, callback) {
        this[event] = callback;
      },
    },
    document: {
      getElementById: (id) => elements[id],
      body: { classList: { add() {}, remove() {} } },
    },
    location: {
      href: `https://account.eaze.co.uk${path}${extra}#${fragment}`,
      get hash() {
        return new URL(this.href).hash;
      },
      assign: (url) => redirects.push(url),
    },
    history: {
      replaceState: (_s, _t, url) => {
        history.push(url);
        context.location.href = new URL(url, context.location.href).href;
      },
    },
    URL,
    URLSearchParams,
  };
  vm.runInNewContext(source, context);
  function visit(fragment) {
    const next = new URL(context.location.href);
    next.hash = fragment;
    context.location.href = next.href;
    context.window.hashchange({ newURL: next.href });
  }
  return { elements, redirects, history, visit };
}

describe("authentication-only branded fallback", () => {
  test("a second link in the same tab replaces the first action, including after an invalid link", () => {
    const p = page("/staging/sign-in/", `token_hash=${proof}&type=magiclink`);
    const second = "b".repeat(64);
    p.visit(`token_hash=${second}&type=magiclink`);
    p.elements.open.click();
    expect(p.redirects).toEqual([
      `uk.co.eaze.app://auth/staging/sign-in/#token_hash=${second}&type=magiclink`,
    ]);
    p.visit("type=magiclink");
    expect(p.elements.open.hidden).toBe(true);
    expect(p.elements.open.click).toBeUndefined();
    p.visit(`token_hash=${proof}&type=magiclink`);
    expect(p.elements.open.hidden).toBe(false);
    expect(p.elements.open.disabled).toBe(false);
    p.elements.open.click();
    expect(p.redirects.at(-1)).toBe(
      `uk.co.eaze.app://auth/staging/sign-in/#token_hash=${proof}&type=magiclink`,
    );
  });
  test("visiting never consumes proof or opens the app; an explicit tap uses the fixed app destination", () => {
    const p = page("/reset-password/", `token_hash=${proof}&type=recovery`);
    expect(p.history).toEqual(["/reset-password/"]);
    expect(p.redirects).toEqual([]);
    expect(p.elements.open.disabled).toBe(false);
    p.elements.open.click();
    expect(p.redirects).toEqual([
      `uk.co.eaze.app://auth/reset-password/#token_hash=${proof}&type=recovery`,
    ]);
    p.elements.open.click();
    expect(p.redirects.length).toBe(2);
    expect(p.elements.title.textContent).toBe("A fresh password.");
  });
  test("preserves installed-app compatibility for both existing links", () => {
    for (const [path, type, native] of [
      ["/", "email", "callback"],
      ["/confirm/", "signup", "confirm"],
    ]) {
      const p = page(path, `token_hash=${proof}&type=${type}`);
      p.elements.open.click();
      expect(p.redirects[0]).toBe(
        `uk.co.eaze.app://auth/${native}#token_hash=${proof}&type=${type}`,
      );
    }
  });
  test("fresh-email instructions follow the trusted action path for fresh and expired links", () => {
    for (const [path, type, step] of [
      ["/confirm/", "signup", "address you signed up with"],
      ["/sign-in/", "magiclink", "Send sign-in link"],
      ["/reset-password/", "recovery", "Send reset link"],
    ]) {
      for (const prefix of ["", "/staging"]) {
        const p = page(prefix + path, `token_hash=${proof}&type=${type}`);
        expect(p.elements["fresh-steps"].textContent).toContain(step);
        expect(p.elements.installed.hidden).toBe(false);
        expect(p.elements.installed.open).toBe(false);
        p.elements.installed.open = true;
        p.visit("error=access_denied&error_code=otp_expired");
        expect(p.elements["fresh-steps"].textContent).toContain(step);
        expect(p.elements.message.textContent).toContain("expired");
        expect(p.elements.installed.open).toBe(false);
        expect(p.elements.installed.hidden).toBe(true);
        expect(p.elements.open.click).toBeUndefined();
        expect(p.redirects).toEqual([]);
      }
    }
    const mismatched = page("/reset-password/", `token_hash=${proof}&type=signup`);
    expect(mismatched.elements["fresh-steps"].textContent).toContain("Forgot password?");
    expect(mismatched.elements.open.hidden).toBe(true);
  });
  test("query-form expiry, a second legacy action and cached pages retain their intended behavior", () => {
    const expired = page("/confirm/", "", "?error_code=otp_expired");
    expect(expired.elements.message.textContent).toContain("expired");
    expect(expired.elements.installed.hidden).toBe(true);
    const legacy = page("/", `token_hash=${proof}&type=magiclink`);
    legacy.elements.installed.open = true;
    legacy.visit(`token_hash=${proof}&type=recovery`);
    expect(legacy.elements.installed.open).toBe(false);
    expect(legacy.elements["fresh-steps"].textContent).toContain("Send reset link");
    const cached = page("/sign-in/", `token_hash=${proof}&type=magiclink`, "", true);
    cached.elements.open.click();
    expect(cached.redirects).toEqual([`uk.co.eaze.app://auth/sign-in/#token_hash=${proof}&type=magiclink`]);
  });
  test("staging links stay explicitly staging and distinguish sign-in from account confirmation", () => {
    const p = page("/staging/sign-in/", `token_hash=${proof}&type=magiclink`);
    expect(p.elements.title.textContent).toBe("Welcome back.");
    p.elements.open.click();
    expect(p.redirects[0]).toBe(
      `uk.co.eaze.app://auth/staging/sign-in/#token_hash=${proof}&type=magiclink`,
    );
  });
  test("rejects query proof, duplicate values, extra redirects, unknown paths and mismatched actions", () => {
    for (const [path, fragment, query] of [
      ["/reset-password/", `token_hash=${proof}&type=signup`, ""],
      ["/confirm/", `token_hash=${proof}&type=signup&type=signup`, ""],
      [
        "/confirm/",
        `token_hash=${proof}&type=signup&next=https://evil.test`,
        "",
      ],
      ["/confirm/", `token_hash=${proof}&type=signup`, `?token_hash=${proof}`],
      ["/unknown/", `token_hash=${proof}&type=signup`, ""],
      ["/confirm/", "token_hash=short&type=signup", ""],
      ["/confirm/", `token_hash=${proof}&type=__proto__`, ""],
    ]) {
      const p = page(path, fragment, query);
      expect(p.elements.open.hidden).toBe(true);
      expect(p.elements.open.click).toBeUndefined();
      expect(p.redirects).toEqual([]);
    }
  });
  test("every landing page offers the correct installation route before the installed-only button", () => {
    for (const path of [
      "index.html",
      "confirm/index.html",
      "sign-in/index.html",
      "reset-password/index.html",
      "email-change/index.html",
      "staging/confirm/index.html",
      "staging/sign-in/index.html",
      "staging/reset-password/index.html",
      "staging/email-change/index.html",
    ]) {
      const html = readFileSync(new URL(`./${path}`, import.meta.url), "utf8");
      expect(html).toContain("connect-src 'none'");
      expect(html).toContain("form-action 'none'");
      expect(html).toContain('content="no-referrer"');
      expect(html).not.toContain("supabase.co");
      const getApp = html.match(/<a class="get-app" href="([^"]+)" rel="noreferrer">/);
      const staging = path.startsWith("staging/");
      expect(getApp?.[1]).toBe(
        staging ? "https://testflight.apple.com/" : "https://testflight.apple.com/join/SarTE6My",
      );
      expect(html.indexOf('class="get-app"')).toBeLessThan(html.indexOf('<details id="installed" hidden>'));
      expect(html).toContain('<summary>I already have eaze</summary>');
      expect(html).toContain('id="fresh-steps"');
      if (staging) {
        expect(html).toContain('href="https://eaze.co.uk/support" rel="noreferrer">Request a test invitation');
        expect(html).not.toContain("testflight.apple.com/join/");
      }
    }
  });
});
