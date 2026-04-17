import dayjs from "dayjs";

// ─── Extraction Helpers ──────────────────────────────────────────────────────

function extractChequeNo(narration) {
  if (!narration) return null;
  const patterns = [
    /(?:CHQ|CHEQUE)\.?\s*(?:NO\.?|No\.?|No:)\s*(?:0*)(\d+)/i,
    /INWARD\s+CHEQUE\s+NO[.:]\s*(?:0*)(\d+)/i,
    /FAB\s+CHQ\s+(?:NO\.?\s*|No\.?\s*)?(?:0*)(\d+)/i,
    /Cheque\s+Deposit\s*[-–]\s*(?:0*)(\d+)/i,
    /Cheque\s+No:\s*(?:0*)(\d+)/i,
    /Cheque\s+N[o.]?[:\s]+(?:0*)(\d+)/i,
    /EXP\.?CHQ\s+Charges?\s+(\d+)/i,
  ];
  for (const p of patterns) {
    const m = narration.match(p);
    if (m?.[1]) return m[1].replace(/^0+/, "") || "0";
  }
  return null;
}

function extractPersonName(narration) {
  if (!narration) return null;
  const byMatch = narration.match(/\bBY\s+([A-Z][A-Za-z]+)/i);
  if (byMatch) return byMatch[1].toUpperCase();
  const toMatch = narration.match(/\bto\s+([A-Z][a-z]+)/i);
  if (toMatch) return toMatch[1].toUpperCase();
  const dashMatch = narration.match(/[-–]\s*([A-Z][a-z]+)\s*[-–]/i);
  if (dashMatch) return dashMatch[1].toUpperCase();
  return null;
}

// ─── Category Detection ──────────────────────────────────────────────────────

function isDeposit(narration) {
  return /cash\s+dep(osit)?|cash\s+office|cash\s+rcvd|cash\s+paid\s+to|messrs/i.test(narration);
}

function isBankCharge(narration) {
  return /service\s+(fee|charge)|book.?charge|cheque\s+book|bank\s+charge|monthly\s+service|documentation\s+search|search\s+fee|token\s+charge|e-?banking\s+charge|monthly\s+e-?banking|momo\s+ch(a)?rg|charge\s+on\s+funds|ach.*charges?|commission|exp\.?chq\s+charges?|c\.?o\.?t\.?/i.test(narration);
}

function isInterest(narration) {
  return /iccf|cr\s+int|interest\s+from\s+bank|interset\s+from\s+bank|other\s+revenue.*int/i.test(narration);
}

function isTransfer(narration) {
  return /funds\s+transfer|funds\s+trf|trsf\s+bo|ft\s+bo|ft\s+ifo|ach\s+nrt|ach\s+normal|transfer\s+from/i.test(narration);
}

// ─── Similarity ──────────────────────────────────────────────────────────────

function levenshteinDistance(a, b) {
  if (!a || !b) return Math.max(a?.length ?? 0, b?.length ?? 0);
  const mat = [];
  for (let i = 0; i <= b.length; i++) mat[i] = [i];
  for (let j = 0; j <= a.length; j++) mat[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      mat[i][j] =
        b[i - 1] === a[j - 1]
          ? mat[i - 1][j - 1]
          : 1 + Math.min(mat[i - 1][j - 1], mat[i][j - 1], mat[i - 1][j]);
  return mat[b.length][a.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1 - levenshteinDistance(a, b) / maxLen : 0;
}

function normalizeNarration(n) {
  return n
    .toLowerCase()
    .replace(
      /\b(the|a|an|of|in|at|to|and|or|for|by|on|from|with|ifo|b\/o|payee|bo|iro|ach|nrt|ft|trsf|btv#?\d*)\b/gi,
      ""
    )
    .replace(
      /\b(fab|inward|issued|requested|s&s|realty|ltd|ghana|industries|limited|social|security|national|insurance|trust|real\s+estate|company|enterprise)\b/gi,
      ""
    )
    .replace(/\d+/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyVendorName(narration) {
  if (!narration) return null;
  const patterns = [
    /IFO\s+([A-Z][A-Za-z\s]+?)(?:\s*[-–]|\s*$)/i,
    /BO\s+(?:VAAL[^I]*IFO\s+)?([A-Z][A-Za-z\s]+?)(?:\s*[-–]|\s*$)/i,
  ];
  for (const p of patterns) {
    const m = narration.match(p);
    if (m?.[1]) {
      const name = m[1].replace(/\s+(ltd|limited|co|ent|company)\s*$/i, "").trim();
      if (name.length > 3) return name.toUpperCase();
    }
  }
  return null;
}

// ─── Amount helpers ──────────────────────────────────────────────────────────

function txnAmount(t) {
  return t.debit || t.credit || 0;
}

function amtClose(a, b, tolerance = 1.0) {
  return Math.abs(txnAmount(a) - txnAmount(b)) <= tolerance;
}

function dateDiffDays(a, b) {
  return Math.abs(dayjs(a.date).diff(dayjs(b.date), "day"));
}

// ─── Main Matching ───────────────────────────────────────────────────────────

export const matchTransactions = (bankTxns, ledgerTxns) => {
  const matches = [];
  const unmatchedBank = [];
  const usedLedger = new Set();

  const tryMatch = (bankIdx, bank, ledgerIdx, ledger, status, confidence) => {
    matches.push({ bank, ledger, status, confidence });
    usedLedger.add(ledgerIdx);
    return true;
  };

  for (const bank of bankTxns) {
    const bankCheque = extractChequeNo(bank.narration);
    const isReturned = /returned/i.test(bank.narration);
    let matched = false;

    // ── PASS 1: Cheque number match ──────────────────────────────────────
    if (bankCheque) {
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtClose(bank, l)) continue;
        const lCheque = extractChequeNo(l.narration);
        if (lCheque && bankCheque === lCheque) {
          const status = isReturned
            ? `MATCHED - RETURNED CHEQUE ${bankCheque}`
            : `MATCHED - CHEQUE ${bankCheque}`;
          matched = tryMatch(null, bank, i, l, status, "HIGH");
          break;
        }
      }
      if (matched) continue;
    }

    // ── PASS 2: Exact amount + close date (≤5 days) ─────────────────────
    {
      let bestIdx = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtClose(bank, l, 0.01)) continue;
        const diff = dateDiffDays(bank, l);
        if (diff <= 5 && diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        matched = tryMatch(
          null, bank, bestIdx, ledgerTxns[bestIdx],
          "MATCHED - EXACT AMOUNT + DATE", "HIGH"
        );
      }
    }
    if (matched) continue;

    // ── PASS 3: Deposit category match ───────────────────────────────────
    if (isDeposit(bank.narration)) {
      const bankPerson = extractPersonName(bank.narration);
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtClose(bank, l)) continue;
        if (!isDeposit(l.narration)) continue;
        const ledgerPerson = extractPersonName(l.narration);
        const nameOk =
          !bankPerson ||
          !ledgerPerson ||
          bankPerson.substring(0, 4) === ledgerPerson.substring(0, 4);
        if (nameOk) {
          matched = tryMatch(null, bank, i, l, "MATCHED - DEPOSIT", "HIGH");
          break;
        }
      }
    }
    if (matched) continue;

    // ── PASS 4: Bank charge / fee match ──────────────────────────────────
    if (isBankCharge(bank.narration)) {
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtClose(bank, l)) continue;
        if (!isBankCharge(l.narration)) continue;
        matched = tryMatch(null, bank, i, l, "MATCHED - BANK CHARGE", "HIGH");
        break;
      }
    }
    if (matched) continue;

    // ── PASS 5: Interest match ───────────────────────────────────────────
    if (isInterest(bank.narration)) {
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtClose(bank, l)) continue;
        if (!isInterest(l.narration)) continue;
        matched = tryMatch(null, bank, i, l, "MATCHED - INTEREST", "HIGH");
        break;
      }
    }
    if (matched) continue;

    // ── PASS 6: Vendor-name keyword match ────────────────────────────────
    {
      const bankVendor = extractKeyVendorName(bank.narration);
      if (bankVendor) {
        for (let i = 0; i < ledgerTxns.length; i++) {
          if (usedLedger.has(i)) continue;
          const l = ledgerTxns[i];
          if (!amtClose(bank, l)) continue;
          if (dateDiffDays(bank, l) > 30) continue;
          const upperNar = l.narration.toUpperCase();
          if (upperNar.includes(bankVendor) || upperNar.includes(bankVendor.split(" ")[0])) {
            matched = tryMatch(
              null, bank, i, l,
              `MATCHED - VENDOR ${bankVendor}`, "MEDIUM"
            );
            break;
          }
        }
      }
    }
    if (matched) continue;

    // ── PASS 7: Fuzzy narration match ────────────────────────────────────
    {
      const bankNorm = normalizeNarration(bank.narration);
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtClose(bank, l)) continue;
        const diff = dateDiffDays(bank, l);
        if (diff > 30) continue;
        if (similarity(bankNorm, normalizeNarration(l.narration)) > 0.5) {
          matched = tryMatch(
            null, bank, i, l, "MATCHED - NARRATION", "MEDIUM"
          );
          break;
        }
      }
    }
    if (matched) continue;

    // ── PASS 8: Amount-only with date proximity (≤7 days) ────────────────
    {
      let bestIdx = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < ledgerTxns.length; i++) {
        if (usedLedger.has(i)) continue;
        const l = ledgerTxns[i];
        if (!amtClose(bank, l)) continue;
        const diff = dateDiffDays(bank, l);
        if (diff <= 7 && diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        matched = tryMatch(
          null, bank, bestIdx, ledgerTxns[bestIdx],
          "MATCHED - AMOUNT + DATE PROXIMITY", "LOW"
        );
      }
    }

    if (!matched) unmatchedBank.push(bank);
  }

  const unmatchedLedger = ledgerTxns.filter((_, i) => !usedLedger.has(i));

  console.log(
    `✅ Matched: ${matches.length}, Only in Bank: ${unmatchedBank.length}, Only in Ledger: ${unmatchedLedger.length}`
  );
  return { matches, unmatchedBank, unmatchedLedger };
};
