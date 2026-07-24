import asyncio
from datetime import datetime

from app.db import SessionLocal, init_db
from app.models.schemas import ExtractedMeal, MedicalMetricCreate, NutrientValues
from app.services import ai_analyzer, analytics, medical_store, structured_store
from app.services.knowledge_store import knowledge_store


async def main() -> None:
    await init_db()
    await knowledge_store.ensure_indexed()
    async with SessionLocal() as db:
        meal = ExtractedMeal(
            name="Iced coffee",
            serving="1 bottle",
            nutrients=NutrientValues(calories=180, sugar_g=46, carbs_g=48),
            confidence=0.95,
            source="drink_ocr",
        )
        await structured_store.save_intake(
            db, meal, user_id="analytics_demo", source="drink_ocr", input_type="drink"
        )

        meal2 = ExtractedMeal(
            name="Cola",
            serving="1 can",
            nutrients=NutrientValues(calories=140, sugar_g=39, carbs_g=39),
            confidence=0.9,
            source="drink_ocr",
        )
        await structured_store.save_intake(
            db, meal2, user_id="analytics_demo", source="drink_ocr", input_type="drink"
        )

        await medical_store.save_medical_metric(
            db,
            MedicalMetricCreate(
                user_id="analytics_demo",
                metric_key="hba1c",
                display_name="HbA1c",
                value=6.2,
                unit="%",
                range_low=4.0,
                range_high=5.6,
                flag="high",
                confirmed=True,
            ),
        )

        weekly = await analytics.get_weekly_summary(db, user_id="analytics_demo")
        sugar = await analytics.get_top_sugar_sources(db, user_id="analytics_demo")
        comp = await analytics.get_logging_completeness(db, user_id="analytics_demo")
        meds = await analytics.get_latest_medical_metrics(db, user_id="analytics_demo")
        ans = await ai_analyzer.analyze(
            db,
            question=(
                "Which drinks contributed most to my sugar intake this week? "
                "Also what about my HbA1c?"
            ),
            user_id="analytics_demo",
        )
        print("weekly_meals", weekly.meal_count, "sugar", weekly.totals.sugar_g)
        print(
            "top",
            sugar.items[0].name if sugar.items else None,
            sugar.items[0].sugar_g if sugar.items else None,
        )
        print("completeness", comp.completeness_percent)
        print("meds", [(m.metric_key, m.flag) for m in meds])
        print("tools", ans.tools_used)
        print("answer", ans.answer[:500])
        print("disclaimer", bool(ans.medical_disclaimer))
        print("kb", knowledge_store.collection.count())


asyncio.run(main())
