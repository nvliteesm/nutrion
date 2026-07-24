import asyncio
from pathlib import Path

import httpx
from PIL import Image

base = "http://127.0.0.1:8000"


async def main() -> None:
    async with httpx.AsyncClient(timeout=120.0) as client:
        doc = Path("data/uploads/_smoke_oats.txt")
        doc.parent.mkdir(parents=True, exist_ok=True)
        doc.write_text(
            "Product: Overnight Oats\nServing Size 1 bowl\nCalories 280\n"
            "Total Fat 7g\nSodium 90mg\nTotal Carbohydrate 42g\n"
            "Dietary Fiber 6g\nTotal Sugars 12g\nProtein 11g\n",
            encoding="utf-8",
        )
        with doc.open("rb") as f:
            r = await client.post(
                base + "/document",
                data={"user_id": "default", "persist": "true"},
                files={"file": ("oats.txt", f, "text/plain")},
            )
        print("document", r.status_code, r.text[:500])
        r.raise_for_status()

        label = next(Path("data/uploads").glob("*sample_label*"), None)
        if label:
            with label.open("rb") as f:
                r = await client.post(
                    base + "/drink",
                    data={"user_id": "default", "persist": "true"},
                    files={"file": (label.name, f, "image/jpeg")},
                )
            print("drink", r.status_code, r.text[:600])
            r.raise_for_status()

        food = Path("data/uploads/_smoke_food.png")
        Image.new("RGB", (128, 128), (200, 120, 60)).save(food)
        with food.open("rb") as f:
            r = await client.post(
                base + "/food",
                data={"user_id": "default", "persist": "true"},
                files={"file": ("grilled_chicken.png", f, "image/png")},
            )
        print("food", r.status_code, r.text[:600])
        r.raise_for_status()


if __name__ == "__main__":
    asyncio.run(main())
