"""Smoke test for analyze → confirm flows."""

import asyncio
from pathlib import Path

import httpx
from PIL import Image

base = "http://127.0.0.1:8000"
uploads = Path("data/uploads")
uploads.mkdir(parents=True, exist_ok=True)


async def main() -> None:
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Drink label image
        drink_img = uploads / "_smoke_drink_label.png"
        Image.new("RGB", (320, 420), (245, 245, 245)).save(drink_img)
        with drink_img.open("rb") as f:
            r = await client.post(
                f"{base}/api/drinks/analyze",
                data={"user_id": "default"},
                files={"file": ("cola_label.png", f, "image/png")},
            )
        print("drinks/analyze", r.status_code, r.text[:500])
        r.raise_for_status()
        drink_body = r.json()
        aid = drink_body["analysis_id"]
        drink = drink_body["drink"]
        drink["product_name"] = "Smoke Cola"
        drink["calories"] = 140
        drink["total_sugar_g"] = 39
        drink["added_sugar_g"] = 39
        drink["drink_volume_ml"] = 355
        r = await client.post(
            f"{base}/api/drinks/{aid}/confirm",
            json={"drink": drink, "user_id": "default"},
        )
        print("drinks/confirm", r.status_code, r.text[:400])
        r.raise_for_status()

        # Food image
        food_img = uploads / "_smoke_food_meal.png"
        Image.new("RGB", (240, 240), (210, 140, 70)).save(food_img)
        with food_img.open("rb") as f:
            r = await client.post(
                f"{base}/api/foods/analyze",
                data={"user_id": "default"},
                files={"file": ("bowl.png", f, "image/png")},
            )
        print("foods/analyze", r.status_code, r.text[:500])
        r.raise_for_status()
        food_body = r.json()
        r = await client.post(
            f"{base}/api/foods/{food_body['analysis_id']}/confirm",
            json={"food": food_body["food"], "user_id": "default"},
        )
        print("foods/confirm", r.status_code, r.text[:400])
        r.raise_for_status()

        # Medical report text
        report = uploads / "_smoke_medical.txt"
        report.write_text(
            "Lab Report\nDate: 2026-07-01\n"
            "HbA1c 6.2 % (ref 4.0-5.6)\n"
            "Fasting Blood Glucose 118 mg/dL (70-99)\n"
            "Total Cholesterol 210 mg/dL\n"
            "LDL 130 mg/dL\n"
            "HDL 45 mg/dL\n"
            "Triglycerides 160 mg/dL\n",
            encoding="utf-8",
        )
        with report.open("rb") as f:
            r = await client.post(
                f"{base}/api/medical/analyze",
                data={"user_id": "default"},
                files={"file": ("labs.txt", f, "text/plain")},
            )
        print("medical/analyze", r.status_code, r.text[:700])
        r.raise_for_status()
        med = r.json()
        r = await client.post(
            f"{base}/api/medical/{med['analysis_id']}/confirm",
            json={"metrics": med["metrics"], "user_id": "default"},
        )
        print("medical/confirm", r.status_code, r.text[:500])
        r.raise_for_status()

        r = await client.get(f"{base}/api/medical/metrics")
        print("medical/metrics", r.status_code, f"count={len(r.json())}")


if __name__ == "__main__":
    asyncio.run(main())
