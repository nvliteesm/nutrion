"""Approved educational health documents for NutriON knowledge RAG.

These are controlled educational summaries — not medical advice.
Chunked and embedded into the `approved_health_knowledge` Chroma collection.
"""

from __future__ import annotations

APPROVED_DOCUMENTS: list[dict[str, str]] = [
    {
        "id": "hba1c",
        "title": "Understanding HbA1c",
        "topic": "hba1c",
        "text": """
HbA1c (glycated hemoglobin) is a blood test that reflects average blood glucose
over roughly the past 2–3 months. It is commonly reported as a percentage.

Educational context only: many lab reports print a reference range next to the
result. NutriON may show whether a confirmed value was marked low, normal, or
high based on the range printed on that report. NutriON does not diagnose
diabetes or prediabetes and cannot determine why a result changed.

Questions for a clinician may include: how often I should recheck HbA1c,
whether my result fits my overall health picture, and what lifestyle factors
they recommend discussing — not what medication to take.
""".strip(),
    },
    {
        "id": "fasting-glucose",
        "title": "Fasting blood glucose",
        "topic": "fasting_blood_glucose",
        "text": """
Fasting blood glucose is typically measured after not eating for several hours
(often overnight). It is one snapshot of blood sugar at a single time point,
unlike HbA1c which averages over months.

Lab reports usually list a reference interval. A value labeled high or low on a
report is not a diagnosis by itself. Illness, medications, timing of the last
meal, and lab methods can all affect results.

NutriON can show your confirmed fasting glucose value and the flag from your
report. It cannot link a specific food or drink to that lab result.
""".strip(),
    },
    {
        "id": "total-cholesterol",
        "title": "Total cholesterol",
        "topic": "total_cholesterol",
        "text": """
Total cholesterol is the overall amount of cholesterol measured in a blood lipid
panel. It includes contributions related to LDL, HDL, and other lipid fractions.

Reference ranges on reports vary by lab. Educational guidance often focuses on
patterns across the full lipid panel rather than a single number in isolation.

NutriON reports confirmed values only and does not recommend medications or
claim that one meal caused a cholesterol change.
""".strip(),
    },
    {
        "id": "ldl",
        "title": "LDL cholesterol",
        "topic": "ldl",
        "text": """
LDL (low-density lipoprotein) cholesterol is often discussed as “bad”
cholesterol in educational materials because higher levels are associated with
higher cardiovascular risk in population studies. Individual targets depend on
personal risk factors and clinician judgment.

A confirmed LDL value in NutriON comes from your saved report. Educational
content can explain what LDL is; only a clinician can interpret it for you.
""".strip(),
    },
    {
        "id": "hdl",
        "title": "HDL cholesterol",
        "topic": "hdl",
        "text": """
HDL (high-density lipoprotein) cholesterol is often called “good” cholesterol in
public education because higher HDL is generally associated with lower risk in
population studies. Context still matters: the full lipid panel and other risk
factors matter more than any single marker.

NutriON can display your confirmed HDL result and report flag. It does not
diagnose lipid disorders or prescribe treatments.
""".strip(),
    },
    {
        "id": "triglycerides",
        "title": "Triglycerides",
        "topic": "triglycerides",
        "text": """
Triglycerides are a type of fat in the blood. Levels can vary with recent meals,
alcohol, sugars, and overall metabolic health. Fasting status before the blood
draw often matters for interpretation.

Educational tip: very high triglycerides are a clinical concern that should be
discussed with a healthcare professional. NutriON will not claim that a logged
drink “caused” a triglyceride result.
""".strip(),
    },
    {
        "id": "added-sugar",
        "title": "Added sugar in drinks and foods",
        "topic": "added_sugar",
        "text": """
Added sugars are sugars put into foods and drinks during processing or
preparation. Sweetened beverages are a common concentrated source because liquid
calories are easy to overlook.

Nutrition labels list Total Sugars and, in many regions, Added Sugars. Reading
both the serving size and the number of servings per container is essential —
a bottle may contain more than one serving.

NutriON analytics can rank which confirmed drinks contributed the most sugar in
a period. That ranking is a logging summary, not proof that sugar caused a lab
result.
""".strip(),
    },
    {
        "id": "nutrition-labels",
        "title": "How to read nutrition labels",
        "topic": "nutrition_labels",
        "text": """
Key parts of a nutrition label:
1) Serving size — all nutrient numbers apply to one serving.
2) Servings per container — multiply if you drink or eat more than one serving.
3) Calories and macronutrients — protein, carbs, fat, fiber, sugars, sodium.
4) % Daily Value — a general reference for a typical adult diet, not a personal target.

When NutriON extracts a label via OCR, values should be confirmed before they
drive analytics. Estimated food photos are labeled as estimated and should not
be treated the same as confirmed label data.
""".strip(),
    },
    {
        "id": "lower-sugar-alternatives",
        "title": "Lower-sugar drink alternatives",
        "topic": "lower_sugar_alternatives",
        "text": """
Educational swaps people often discuss with clinicians or dietitians include:
unsweetened coffee or tea, sparkling water with citrus, diluted juice, and
smaller serving sizes of sweetened drinks.

This is general education, not a prescription. Preferences, culture, budget, and
medical conditions matter. Prefer gradual changes and confirm any dietary plan
with a qualified professional when you have medical conditions.
""".strip(),
    },
    {
        "id": "doctor-questions",
        "title": "Questions you can ask a doctor",
        "topic": "doctor_questions",
        "text": """
Helpful non-diagnostic questions to bring to a clinician:
- What do my latest lab flags mean in the context of my history?
- How often should these labs be repeated?
- Are there lifestyle topics (sleep, activity, sugar intake patterns) worth discussing?
- Which symptoms should prompt me to seek care sooner?

Avoid asking NutriON for medication names, doses, or diagnoses. Bring your
confirmed logs and reports to your appointment instead.
""".strip(),
    },
]


def chunk_document(doc: dict[str, str], *, max_chars: int = 500) -> list[dict[str, str]]:
    """Split a document into overlapping-ish paragraph chunks for embedding."""
    text = doc["text"].strip()
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[dict[str, str]] = []
    buffer = ""
    part = 0
    for para in paragraphs:
        candidate = f"{buffer}\n\n{para}".strip() if buffer else para
        if len(candidate) <= max_chars:
            buffer = candidate
            continue
        if buffer:
            part += 1
            chunks.append(
                {
                    "id": f"{doc['id']}-c{part}",
                    "title": doc["title"],
                    "topic": doc["topic"],
                    "text": buffer,
                }
            )
        if len(para) <= max_chars:
            buffer = para
        else:
            # Hard-split long paragraphs
            for i in range(0, len(para), max_chars):
                part += 1
                chunks.append(
                    {
                        "id": f"{doc['id']}-c{part}",
                        "title": doc["title"],
                        "topic": doc["topic"],
                        "text": para[i : i + max_chars],
                    }
                )
            buffer = ""
    if buffer:
        part += 1
        chunks.append(
            {
                "id": f"{doc['id']}-c{part}",
                "title": doc["title"],
                "topic": doc["topic"],
                "text": buffer,
            }
        )
    if not chunks:
        chunks.append(
            {
                "id": f"{doc['id']}-c1",
                "title": doc["title"],
                "topic": doc["topic"],
                "text": text[:max_chars],
            }
        )
    return chunks


def all_chunks() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for doc in APPROVED_DOCUMENTS:
        out.extend(chunk_document(doc))
    return out
