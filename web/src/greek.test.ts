import { describe, expect, it } from "vitest";
import { fold, searchKey, transliterate } from "./greek";

describe("fold", () => {
  it("drops accents and case", () => {
    expect(fold("Κυψέλη")).toBe("ΚΥΨΕΛΗ");
    expect(fold("κυψελη")).toBe("ΚΥΨΕΛΗ");
    expect(fold("Πρωί")).toBe("ΠΡΩΙ");
  });
});

describe("transliterate", () => {
  it("maps letters and capitalises each word", () => {
    expect(transliterate("ΦΑΡΜΑΚΕΙΟ ΚΥΨΕΛΗΣ")).toBe("Farmakeio Kypselis");
    expect(transliterate("ΑΘΗΝΑΣ 50")).toBe("Athinas 50");
    expect(transliterate("ΑΓ.ΔΗΜΗΤΡΙΟΣ")).toBe("Ag.Dimitrios");
  });

  it("writes ΟΥ as ou and ΓΓ as ng", () => {
    expect(transliterate("ΚΟΛΩΝΑΚΙΟΥ")).toBe("Kolonakiou");
    expect(transliterate("ΕΥΑΓΓΕΛΙΣΜΟΣ")).toBe("Evangelismos");
  });

  it("writes ΑΥ/ΕΥ as av/ev before vowels and voiced consonants, af/ef otherwise", () => {
    expect(transliterate("ΠΑΥΛΟΥ")).toBe("Pavlou");
    expect(transliterate("ΕΥΚΛΕΙΔΟΥ")).toBe("Efkleidou");
    expect(transliterate("ΑΥΤΟ")).toBe("Afto");
  });

  it("writes ΜΠ, ΝΤ, ΓΚ as b, d, g only at the start of a word", () => {
    expect(transliterate("ΜΠΟΤΣΑΡΗ")).toBe("Botsari");
    expect(transliterate("ΛΑΜΠΡΟΣ")).toBe("Lampros");
    expect(transliterate("ΝΤΑΒΑΚΗ")).toBe("Davaki");
    expect(transliterate("ΠΕΝΤΕΛΗΣ")).toBe("Pentelis");
    expect(transliterate("ΓΚΥΖΗ")).toBe("Gyzi");
    expect(transliterate("ΑΓΚΥΡΑΣ")).toBe("Agkyras");
  });
});

describe("searchKey", () => {
  it("matches queries typed in Greek or Latin letters, with or without accents", () => {
    const key = searchKey("ΚΥΨΕΛΗ");
    expect(key).toContain(fold("κυψέ"));
    expect(key).toContain(fold("kyps"));
  });
});
