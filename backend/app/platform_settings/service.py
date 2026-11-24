"""Read and change platform settings.

Reads: `await platform.get(db, "payment_window_minutes")` returns the owner's
value, or the built-in default if none has been set. Writes validate against
the registry (type and bounds) and report old and new values for the audit log.
"""

from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.orders import fees
from app.platform_settings.models import PlatformSetting
from app.platform_settings.registry import BY_KEY, SPECS, Spec


def _parse(spec: Spec, raw: Any) -> Any:
    """Turn a stored/submitted value into its real type, enforcing bounds."""
    try:
        if spec.kind == "bool":
            if isinstance(raw, bool):
                return raw
            if str(raw).lower() in ("true", "1", "yes", "on"):
                return True
            if str(raw).lower() in ("false", "0", "no", "off"):
                return False
            raise ValueError
        if spec.kind == "text":
            value = str(raw if raw is not None else "").strip()
            if spec.max is not None and len(value) > spec.max:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"{spec.label} can be at most {spec.max} characters",
                )
            return value
        if spec.kind == "int":
            dec = Decimal(str(raw))
            if dec != dec.to_integral_value():
                raise ValueError
            value: Any = int(dec)
        else:
            value = Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"{spec.label}: enter a valid {'whole ' if spec.kind == 'int' else ''}{'yes/no' if spec.kind == 'bool' else 'number'}"
        )
    if spec.min is not None and value < spec.min:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{spec.label} can't be below {spec.min}{spec.unit and ' ' + spec.unit}")
    if spec.max is not None and value > spec.max:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{spec.label} can't be above {spec.max}{spec.unit and ' ' + spec.unit}")
    return value


def _store(spec: Spec, value: Any) -> dict:
    return {"v": str(value) if spec.kind in ("decimal", "int") else value}


async def _overrides(db: AsyncSession) -> dict[str, PlatformSetting]:
    return {r.key: r for r in (await db.execute(select(PlatformSetting))).scalars().all()}


async def all_values(db: AsyncSession) -> dict[str, Any]:
    over = await _overrides(db)
    out = {}
    for spec in SPECS:
        row = over.get(spec.key)
        out[spec.key] = _parse(spec, row.value["v"]) if row is not None else spec.default_value()
    return out


async def get(db: AsyncSession, key: str) -> Any:
    spec = BY_KEY[key]
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))).scalar_one_or_none()
    return _parse(spec, row.value["v"]) if row is not None else spec.default_value()


async def pricing(db: AsyncSession) -> fees.PricingConfig:
    """The fee rules a NEW order would be priced by right now."""
    v = await all_values(db)
    return fees.PricingConfig(
        service_fee_rate=Decimal(v["service_fee_percent"]) / 100,
        agent_base_share=Decimal(v["agent_base_share"]),
        included_minutes=int(v["agent_included_minutes"]),
        per_minute=Decimal(v["agent_per_minute"]),
        delivery_fee=Decimal(v["delivery_fee"]),
        deposit_rate=Decimal(v["deposit_percent"]) / 100,
        add_item_fee=Decimal(v["add_item_fee"]),
        emtl_per_transfer=Decimal(v["emtl_per_transfer"]),
        emtl_threshold=Decimal(v["emtl_threshold"]),
    )


async def default_basket_cap_kobo(db: AsyncSession) -> int:
    return int(await get(db, "default_basket_cap_naira")) * 100


async def describe(db: AsyncSession) -> list[dict]:
    """Everything the settings screen needs: spec, current value, default,
    and whether an owner has changed it."""
    over = await _overrides(db)
    out = []
    for spec in SPECS:
        row = over.get(spec.key)
        current = _parse(spec, row.value["v"]) if row is not None else spec.default_value()
        out.append({
            "key": spec.key, "group": spec.group, "label": spec.label, "help": spec.help,
            "kind": spec.kind, "unit": spec.unit, "scope": spec.scope,
            "min": spec.min, "max": spec.max,
            "value": current if spec.kind == "bool" or spec.kind == "text" else str(current),
            "default": spec.default_value() if spec.kind in ("bool", "text") else str(spec.default_value()),
            "is_default": row is None,
            "updated_at": row.updated_at.isoformat() if row is not None and row.updated_at else None,
        })
    return out


async def set_value(db: AsyncSession, *, key: str, raw: Any, admin_id) -> tuple[Any, Any]:
    spec = BY_KEY.get(key)
    if spec is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such setting")
    new = _parse(spec, raw)
    old = await get(db, key)
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))).scalar_one_or_none()
    if row is None:
        db.add(PlatformSetting(key=key, value=_store(spec, new), updated_by=admin_id))
    else:
        row.value, row.updated_by = _store(spec, new), admin_id
    await db.flush()
    return old, new


async def reset(db: AsyncSession, *, key: str) -> tuple[Any, Any]:
    spec = BY_KEY.get(key)
    if spec is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such setting")
    old = await get(db, key)
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))).scalar_one_or_none()
    if row is not None:
        await db.delete(row)
        await db.flush()
    return old, spec.default_value()
