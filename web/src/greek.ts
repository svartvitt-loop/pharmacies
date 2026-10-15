/** Uppercase and strip accents, so "Κυψέλη", "κυψελη" and "ΚΥΨΕΛΗ" compare equal. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

const LETTERS: Record<string, string> = {
  Α: "a", Β: "v", Γ: "g", Δ: "d", Ε: "e", Ζ: "z", Η: "i", Θ: "th", Ι: "i", Κ: "k", Λ: "l", Μ: "m",
  Ν: "n", Ξ: "x", Ο: "o", Π: "p", Ρ: "r", Σ: "s", Τ: "t", Υ: "y", Φ: "f", Χ: "ch", Ψ: "ps", Ω: "o",
};
const VOICELESS = new Set("ΘΚΞΠΣΤΦΧΨ");
const isGreek = (c: string | undefined) => !!c && c in LETTERS;

/** Greek → Latin, roughly following ELOT 743 (the system used on Greek street signs). */
export function transliterate(text: string): string {
  const s = fold(text);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const pair = c + (s[i + 1] ?? "");
    const wordStart = !isGreek(s[i - 1]);
    if (pair === "ΟΥ") {
      out += "ou";
    } else if (pair === "ΑΥ" || pair === "ΕΥ") {
      const after = s[i + 2];
      out += (c === "Α" ? "a" : "e") + (!isGreek(after) || VOICELESS.has(after) ? "f" : "v");
    } else if (pair === "ΓΓ") {
      out += "ng";
    } else if (wordStart && pair === "ΜΠ") {
      out += "b";
    } else if (wordStart && pair === "ΝΤ") {
      out += "d";
    } else if (wordStart && pair === "ΓΚ") {
      out += "g";
    } else {
      out += LETTERS[c] ?? c.toLowerCase();
      continue;
    }
    i++;
  }
  return out.replace(/(^|[\s.\-(/,&])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Key for matching a search query typed in either Greek or Latin letters. */
export function searchKey(text: string): string {
  return `${fold(text)} ${transliterate(text).toUpperCase()}`;
}
