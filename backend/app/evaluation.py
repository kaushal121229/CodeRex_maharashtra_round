import re
from typing import Dict, List, Tuple

def normalize_text(text: str) -> List[str]:
    """Tokenizes and normalizes text for speech recognition evaluation."""
    clean = re.sub(r'[^\w\s]', '', text.lower()).strip()
    return clean.split()

def compute_wer_detailed(reference: str, hypothesis: str) -> Dict:
    """
    Computes exact Word Error Rate (WER) using dynamic programming Levenshtein distance.
    Returns: substitutions, deletions, insertions, hits, wer, accuracy, and aligned token details.
    """
    ref_words = normalize_text(reference)
    hyp_words = normalize_text(hypothesis)
    
    n = len(ref_words)
    m = len(hyp_words)

    if n == 0:
        if m == 0:
            return {
                "reference_text": reference,
                "hypothesis_text": hypothesis,
                "substitutions": 0,
                "deletions": 0,
                "insertions": 0,
                "hits": 0,
                "reference_words_count": 0,
                "wer": 0.0,
                "accuracy": 1.0,
                "alignment_details": []
            }
        else:
            return {
                "reference_text": reference,
                "hypothesis_text": hypothesis,
                "substitutions": 0,
                "deletions": 0,
                "insertions": m,
                "hits": 0,
                "reference_words_count": 0,
                "wer": 1.0,
                "accuracy": 0.0,
                "alignment_details": [{"type": "insertion", "ref": "", "hyp": w} for w in hyp_words]
            }

    # DP matrix: dp[i][j] = (cost, substitutions, deletions, insertions, hits)
    dp = [[(0, 0, 0, 0, 0) for _ in range(m + 1)] for _ in range(n + 1)]

    for i in range(1, n + 1):
        # cost, S, D, I, H
        dp[i][0] = (i, 0, i, 0, 0)

    for j in range(1, m + 1):
        dp[0][j] = (j, 0, 0, j, 0)

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                cost, s, d, ins, h = dp[i - 1][j - 1]
                dp[i][j] = (cost, s, d, ins, h + 1)
            else:
                # Substitution
                sub = (dp[i - 1][j - 1][0] + 1, dp[i - 1][j - 1][1] + 1, dp[i - 1][j - 1][2], dp[i - 1][j - 1][3], dp[i - 1][j - 1][4])
                # Deletion
                dele = (dp[i - 1][j][0] + 1, dp[i - 1][j][1], dp[i - 1][j][2] + 1, dp[i - 1][j][3], dp[i - 1][j][4])
                # Insertion
                inser = (dp[i][j - 1][0] + 1, dp[i][j - 1][1], dp[i][j - 1][2], dp[i][j - 1][3] + 1, dp[i][j - 1][4])

                dp[i][j] = min(sub, dele, inser, key=lambda x: x[0])

    _, subs, dels, inss, hits = dp[n][m]
    wer = round((subs + dels + inss) / n, 4)
    accuracy = round(max(0.0, 1.0 - wer), 4)

    # Backtracking for visual alignment inspection
    i, j = n, m
    alignment = []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and ref_words[i - 1] == hyp_words[j - 1]:
            alignment.append({"type": "hit", "ref": ref_words[i - 1], "hyp": hyp_words[j - 1]})
            i -= 1
            j -= 1
        else:
            candidates = []
            if i > 0 and j > 0:
                candidates.append((dp[i - 1][j - 1][0], "sub", i - 1, j - 1))
            if i > 0:
                candidates.append((dp[i - 1][j][0], "del", i - 1, j))
            if j > 0:
                candidates.append((dp[i][j - 1][0], "ins", i, j - 1))

            best = min(candidates, key=lambda x: x[0])
            if best[1] == "sub":
                alignment.append({"type": "substitution", "ref": ref_words[i - 1], "hyp": hyp_words[j - 1]})
            elif best[1] == "del":
                alignment.append({"type": "deletion", "ref": ref_words[i - 1], "hyp": ""})
            else:
                alignment.append({"type": "insertion", "ref": "", "hyp": hyp_words[j - 1]})
            i, j = best[2], best[3]

    alignment.reverse()

    return {
        "reference_text": reference,
        "hypothesis_text": hypothesis,
        "substitutions": subs,
        "deletions": dels,
        "insertions": inss,
        "hits": hits,
        "reference_words_count": n,
        "wer": wer,
        "accuracy": accuracy,
        "alignment_details": alignment
    }

def compute_attribution_accuracy(trials: List[Dict]) -> Dict:
    """
    Computes measured speaker attribution accuracy.
    trials: list of {"ground_truth_speaker": str, "predicted_speaker": str}
    """
    if not trials:
        return {
            "total_trials": 0,
            "correct_attributions": 0,
            "accuracy_percent": 100.0,
            "confusion_pairs": []
        }

    correct = sum(1 for t in trials if t.get("ground_truth_speaker") == t.get("predicted_speaker"))
    total = len(trials)
    acc = round((correct / total) * 100.0, 1)

    return {
        "total_trials": total,
        "correct_attributions": correct,
        "accuracy_percent": acc,
        "incorrect_attributions": total - correct
    }
