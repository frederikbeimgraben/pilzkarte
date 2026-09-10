"""Wer sich anmeldet, bekommt eine Zeile.

Das SSO gibt keine Liste der Konten heraus. Ohne diese Zeile wüsste die
Rollenverwaltung nicht, wem sie überhaupt eine Rolle geben kann.

Geschrieben wird nur, wenn sich etwas geändert hat. Ein Name oder eine
E-Mail-Adresse ändert sich selten, ein Zugriff kommt oft.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Person


async def remember(
    session: AsyncSession,
    sub: str,
    email: str | None,
    name: str | None,
) -> None:
    """Legt die Person an oder zieht Name und E-Mail aus dem Token nach.

    Die Ansprüche kommen einzeln statt als ``User``: sonst hinge das
    Gedächtnis an der Anmeldung und die Anmeldung am Gedächtnis.
    """
    row = await session.get(Person, sub)
    if row is None:
        session.add(Person(sub=sub, email=email, name=name))
    elif (row.email, row.name) != (email, name):
        row.email = email
        row.name = name
    else:
        return
    await session.commit()
