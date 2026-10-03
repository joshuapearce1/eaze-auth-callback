import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  new URL("./assets/account-link.js", import.meta.url),
  "utf8",
);
const proof = "a".repeat(64);
function page(path, fragment, extra = "") {
  const elements = Object.fromEntries(
    ["title", "message", "open", "help"].map((key) => [
      key,
      {
        textContent: "",
        hidden: false,
        disabled: true,
        addEventListener(event, callback) {
          this[event] = callback;
        },
      },
    ]),
  );
  const redirects = [];
  const history = [];
  const context = {
    window: {},
    document: {
      getElementById: (id) => elements[id],
      body: { classList: { add() {} } },
    },
    location: {
      href: `https://account.eaze.co.uk${path}${extra}#${fragment}`,
      assign: (url) => redirects.push(url),
    },
    history: { replaceState: (_s, _t, url) => history.push(url) },
    URL,
    URLSearchParams,
  };
  vm.runInNewContext(source, context);
  return { elements, redirects, history };
}

describe("authentication-only branded fallback", () => {
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
  test("all published landing pages forbid connections, forms and third-party resources", () => {
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
    }
  });
});
