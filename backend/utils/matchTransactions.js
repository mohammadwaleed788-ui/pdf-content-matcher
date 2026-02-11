import dayjs from "dayjs";

function extractChequeNo(narration) {
  const match = narration.match(/(?:CHQ|CHEQUE)[\s.:#\-]*(\d{6,})/i) ||
    narration.match(/(?:No:|#)[\s.]*(\d{6,})/i) ||
    narration.match(/(?:NO\.?|NUMBER)[\s.]*(\d{6,})/i);
  return match ? match[1] : null;
}

export const matchTransactions = (bankTxns, ledgerTxns) => {
  const matches = [];
  const unmatchedBank = [];
  const unmatchedLedger = [...ledgerTxns];
  const usedLedger = new Set();

  for (let bank of bankTxns) {
    let bestMatch = null;
    let bestScore = -1;
    let bestIndex = -1;

    for (let i = 0; i < unmatchedLedger.length; i++) {
      if (usedLedger.has(i)) continue;
      const ledger = unmatchedLedger[i];

      // Amount must match exactly (or with a tiny tolerance for rounding)
      if (Math.abs(ledger.amount - bank.amount) > 0.01) continue;

      const bankCheque = extractChequeNo(bank.narration);
      const ledgerCheque = extractChequeNo(ledger.narration);
      const dateDiff = Math.abs(dayjs(bank.date).diff(dayjs(ledger.date), "day"));

      let score = 0;

      // Exact cheque number match is strongest
      if (bankCheque && ledgerCheque && bankCheque === ledgerCheque) {
        score = 3;
      }
      // Otherwise, use date proximity
      else if (dateDiff <= 30) {
        score = 2;        // 30 days is reasonable for cheque clearing
      } else if (dateDiff <= 60) {
        score = 1;        // up to 2 months, still possible
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = ledger;
        bestIndex = i;
      }
    }

    // Accept a match if the best score is at least 1
    if (bestMatch && bestScore >= 1) {
      matches.push({ bank, ledger: bestMatch, status: "MATCHED" });
      usedLedger.add(bestIndex);
    } else {
      unmatchedBank.push(bank);
    }
  }

  const remainingLedger = unmatchedLedger.filter((_, i) => !usedLedger.has(i));

  console.log(`✅ Matched: ${matches.length}, Only in Bank: ${unmatchedBank.length}, Only in Ledger: ${remainingLedger.length}`);

  return { matches, unmatchedBank, unmatchedLedger: remainingLedger };
};