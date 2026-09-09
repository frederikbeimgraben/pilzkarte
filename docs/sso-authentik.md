# SSO-Client in Authentik anlegen

Einmalig von Hand in Authentik unter https://sso.beimgraben.net/. Die App
meldet sich als öffentlicher Client mit Authorization Code und PKCE an, das
Backend prüft die Token gegen den JWKS-Endpunkt. Es gibt kein Client-Secret.

## 1. Provider

Admin-Oberfläche, Anwendungen, Provider, Erstellen, Typ **OAuth2/OpenID
Provider**.

| Feld | Wert |
| --- | --- |
| Name | `pilze` |
| Authorization flow | der vorhandene implicit-consent Flow (kein Consent-Screen nötig, eigene App) |
| Client type | **Public** |
| Client ID | `pilze` (Vorgabe überschreiben, das Backend erwartet genau diesen Wert als `aud`) |
| Redirect URIs | siehe unten, je eine Zeile, Matching **Strict** |
| Signing Key | das selbstsignierte Zertifikat der Instanz (Pflicht, sonst sind Access-Token keine JWT) |
| Access code validity | `minutes=1` |
| Access token validity | `hours=1` |
| Refresh token validity | `days=30` |
| Scopes | `openid`, `email`, `profile`, `offline_access` |
| Subject mode | Based on the User's hashed ID (Vorgabe) |
| Include claims in id_token | an |

Redirect URIs, jede als eigener Eintrag:

```
https://pilze.beimgraben.net/anmeldung
https://pilze.beimgraben.net/anmeldung/still
http://localhost:4200/anmeldung
http://localhost:4200/anmeldung/still
```

`/anmeldung/still` ist die stille Erneuerung in einem iframe. Die beiden
localhost-Einträge sind für die Entwicklung auf dem eigenen Rechner. Weitere
Origins, etwa ein Telefon im LAN über `http://<ip>:4200`, brauchen einen
weiteren Eintrag oder einen Regex-Eintrag.

## 2. Anwendung

Anwendungen, Erstellen.

| Feld | Wert |
| --- | --- |
| Name | `Pilzkarte` |
| Slug | `pilze` (bestimmt die Issuer-URL) |
| Provider | `pilze` |
| Launch URL | `https://pilze.beimgraben.net/` |
| Policy engine mode | any |

Zugriff: entweder offen für alle Nutzer der Instanz oder über eine Gruppe
binden. Die App braucht keine Gruppen oder Rollen, jede angemeldete Person
sieht nur ihre eigenen Objekte.

## 3. Ergebnis, das die Konfiguration erwartet

| Was | Wert |
| --- | --- |
| Issuer | `https://sso.beimgraben.net/application/o/pilze/` |
| Discovery | `https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration` |
| JWKS | `https://sso.beimgraben.net/application/o/pilze/jwks/` |
| Client ID | `pilze` |

Diese drei Werte stehen fest im NixOS-Modul `homeserver-pilze-app`
(`PILZE_OIDC_ISSUER`, `PILZE_OIDC_CLIENT_ID`) und werden dem Frontend über
`GET /api/config` gereicht. Wer Slug oder Client ID anders wählt, passt die
zwei Umgebungsvariablen im Modul an.

## 4. Prüfen

```
curl -s https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration | jq .issuer
```

Erwartet `"https://sso.beimgraben.net/application/o/pilze/"`. Der Endpunkt ist
öffentlich; wenn er 404 liefert, stimmt der Slug nicht.
