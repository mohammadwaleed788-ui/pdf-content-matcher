import dayjs from "dayjs";

function extractChequeNo(narration) {
  if (!narration) return null;
  const patterns = [
    /(?:CHQ|CHEQUE)\.?\s*(?:NO\.?|No\.?|No:)\s*(?:0*)(\d+)/i,
    /INWARD\s+CHEQUE\s+NO[.:]\s*(?:0*)(\d+)/i,
    /FAB\s+CHQ\s+(?:NO\.?\s*|No\.?\s*)?(?:0*)(\d+)/i,
    /Cheque\s+Deposit\s*[-–]\s*(?:0*)(\d+)/i,
    /Cheque\s+No:\s*(?:0*)(\d+)/i,
    /Cheque\s+N[o.]?[:\s]+(?:0*)(\d+)/i,
  ];
  for (const p of patterns) {
    const m = narration.match(p);
    if (m?.[1]) return m[1].replace(/^0+/, "") || "0";
  }
  return null;
}

function extractPersonName(narration) {
  if (!narration) return null;
  // Bank format: "BY <firstname>"
  const byMatch = narration.match(/\bBY\s+([A-Z][A-Za-z]+)/i);
  if (byMatch) return byMatch[1].toUpperCase();
  // Ledger format: "paid to <firstname>"
  const toMatch = narration.match(/\bto\s+([A-Z][a-z]+)/i);
  if (toMatch) return toMatch[1].toUpperCase();
  // Ledger compact: "Samuel - to deposit"
  const dashMatch = narration.match(/[-–]\s*([A-Z][a-z]+)\s*[-–]/i);
  if (dashMatch) return dashMatch[1].toUpperCase();
  return null;
}

// ─── Transaction Category Helpers ─────────────────────────────────────────────

function isDeposit(narration) {
  return /cash\s+dep(osit)?|cash\s+office\s+c\.?d|cash\s+rcvd|cash\s+paid\s+to|messrs/i.test(narration);
}

function isBankCharge(narration) {
  return /service\s+fee|book_charge|cheque\s+book|bank\s+charge|monthly\s+service|documentation\s+search/i.test(narration);
}

function isInterest(narration) {
  return /iccf|cr\s+int|interest\s+from\s+bank|interset\s+from\s+bank|other\s+revenue.*int/i.test(narration);
}

// ─── Levenshtein Similarity ────────────────────────────────────────────────────

function levenshteinDistance(a, b) {
  if (!a || !b) return Math.max(a?.length ?? 0, b?.length ?? 0);
  const mat = [];
  for (let i = 0; i <= b.length; i++) mat[i] = [i];
  for (let j = 0; j <= a.length; j++) mat[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      mat[i][j] = b[i-1] === a[j-1]
        ? mat[i-1][j-1]
        : 1 + Math.min(mat[i-1][j-1], mat[i][j-1], mat[i-1][j]);
  return mat[b.length][a.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1 - levenshteinDistance(a, b) / maxLen : 0;
}

function normalizeNarration(n) {
  return n.toLowerCase()
    .replace(/\b(the|a|an|of|in|at|to|and|or|for|by|on|from|with|ifo|b\/o|payee)\b/gi, "")
    .replace(/\b(fab|inward|issued|requested|s&s|realty|ltd|ghana|industries|limited|social|security|national|insurance|trust)\b/gi, "")
    .replace(/\d+/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

// ─── Main Matching Function ────────────────────────────────────────────────────

export const matchTransactions = (bankTxns, ledgerTxns) => {
  const matches = [];
  const unmatchedBank = [];
  const usedLedger = new Set();

  for (const bank of bankTxns) {
    const bankAmt = bank.credit || bank.debit;
    const bankCheque = extractChequeNo(bank.narration);
    const isReturned = /returned/i.test(bank.narration);
    let matched = false;

    // Helpers scoped to current bank entry
    const sameDir = (l) =>
      (bank.debit > 0 && l.debit > 0) || (bank.credit > 0 && l.credit > 0);
    const amtOk = (l) =>
      Math.abs(bankAmt - (l.debit || l.credit)) <= 1.0;

    // ── PASS 1: Cheque number ──────────────────────────────────────────────
    for (let i = 0; i < ledgerTxns.length; i++) {
      if (usedLedger.has(i)) continue;
      const l = ledgerTxns[i];
      if (!amtOk(l) || !sameDir(l)) continue;
      const lCheque = extractChequeNo(l.narration);
      if (bankCheque && lCheque && bankCheque === lCheque) {
        matches.push({
          bank, ledger: l,
          status: isReturned
            ? `MATCHED - RETURNED CHEQUE ${bankCheque}`
            : `MATCHED - CHEQUE ${bankCheque}`,
        });
        usedLedger.add(i); matched = true; break;
      }
    }
    if (matched) continue;

    if (isDeposit(bank.narration)) {
      const bankPerson = extractPersonName(bank.narration);
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtOk(l) || !sameDir(l) || !isDeposit(l.narration)) continue;
        const ledgerPerson = extractPersonName(l.narration);
        const nameOk = !bankPerson || !ledgerPerson ||
          bankPerson.substring(0, 4) === ledgerPerson.substring(0, 4);
        if (nameOk) {
          matches.push({ bank, ledger: l, status: "MATCHED - DEPOSIT" });
          usedLedger.add(i); matched = true; break;
        }
      }
    }
    if (matched) continue;

    if (isBankCharge(bank.narration)) {
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtOk(l) || !sameDir(l) || !isBankCharge(l.narration)) continue;
        matches.push({ bank, ledger: l, status: "MATCHED - BANK CHARGE" });
        usedLedger.add(i); matched = true; break;
      }
    }
    if (matched) continue;

    if (isInterest(bank.narration)) {
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtOk(l) || !sameDir(l) || !isInterest(l.narration)) continue;
        matches.push({ bank, ledger: l, status: "MATCHED - INTEREST" });
        usedLedger.add(i); matched = true; break;
      }
    }
    if (matched) continue;

    const bankNorm = normalizeNarration(bank.narration);
    for (let i = 0; i < ledgerTxns.length; i++) {
      if (usedLedger.has(i)) continue;
      const l = ledgerTxns[i];
      if (!amtOk(l) || !sameDir(l)) continue;
      const dateDiff = Math.abs(dayjs(bank.date).diff(dayjs(l.date), "day"));
      if (similarity(bankNorm, normalizeNarration(l.narration)) > 0.65 && dateDiff <= 30) {
        matches.push({ bank, ledger: l, status: "MATCHED - NARRATION" });
        usedLedger.add(i); matched = true; break;
      }
    }

    if (!matched) unmatchedBank.push(bank);
  }

  const unmatchedLedger = ledgerTxns.filter((_, i) => !usedLedger.has(i));

  console.log(`✅ Matched: ${matches.length}, Only in Bank: ${unmatchedBank.length}, Only in Ledger: ${unmatchedLedger.length}`);
  return { matches, unmatchedBank, unmatchedLedger };
};