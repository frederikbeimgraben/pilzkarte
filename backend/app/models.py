"""Tabellen der App. Die Baseline-Migration baut das Schema aus diesen Modellen."""

from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Gemeinsame Wurzel aller Tabellen."""


class Nutzer(Base):
    """Ein Konto. Es entsteht beim ersten Zugriff, erkannt am ``sub`` des Tokens."""

    __tablename__ = "nutzer"

    sub: Mapped[str] = mapped_column(String(255), primary_key=True)
    erstellt_am: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
