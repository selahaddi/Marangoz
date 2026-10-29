"""
AI Parametrik Semantik Ayrıştırıcı Kıyaslama ve Doğruluk (Benchmark) Testi.
apps/api/app/data/ai_training_corpus.json dosyasındaki marangozluk promptlarını çalıştırır,
çıkan CabinetConfig ile beklenen mühendislik parametrelerini kıyaslar ve doğruluk skorunu raporlar.
"""

import json
from pathlib import Path
import pytest
from app.engines.parser_engine import SemanticParserEngine


@pytest.fixture(scope="module")
def training_corpus():
    corpus_path = Path(__file__).parent.parent / "app" / "data" / "ai_training_corpus.json"
    assert corpus_path.exists(), f"Eğitim korpusu bulunamadı: {corpus_path}"
    with open(corpus_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) >= 10, "En az 10 örnek bekleniyor"
    return data


def test_ai_semantic_corpus_accuracy(training_corpus):
    """Tüm eğitim korpusu örneklerini ayrıştırır ve başarı oranını ölçer."""
    total = len(training_corpus)
    passed_count = 0
    failures = []

    for item in training_corpus:
        cid = item["id"]
        prompt = item["prompt"]
        expected = item["expected"]

        # Deterministik kural motoru ile ayrıştır
        cfg = SemanticParserEngine._deterministic_rule_parse(prompt)

        item_errors = []
        for key, exp_val in expected.items():
            actual_val = getattr(cfg, key, None)
            if hasattr(actual_val, "value"):
                actual_val = actual_val.value

            if isinstance(exp_val, float):
                if actual_val is None or abs(float(actual_val) - exp_val) > 0.01:
                    item_errors.append(f"{key}: beklenen {exp_val}, gelen {actual_val}")
            else:
                if actual_val != exp_val:
                    item_errors.append(f"{key}: beklenen {exp_val}, gelen {actual_val}")

        if not item_errors:
            passed_count += 1
        else:
            failures.append(f"[{cid}] '{prompt}': " + ", ".join(item_errors))

    accuracy_pct = (passed_count / total) * 100.0
    print(f"\nAI Semantik Doğruluk Skoru: {passed_count}/{total} (%{accuracy_pct:.1f})")

    if failures:
        print("\nBaşarısız Örnekler:")
        for fail in failures:
            print(" -", fail)

    # En az %80 doğruluk oranı beklenir
    assert accuracy_pct >= 80.0, f"AI doğruluk skoru yetersiz: %{accuracy_pct:.1f} < %80.0"
