# SSO-Client in Authentik

Einmal von Hand unter https://sso.beimgraben.net/. Die App ist ein
öffentlicher Client mit Authorization Code und PKCE. Das Backend prüft die
Token gegen JWKS. Es gibt kein Client-Secret.

## Provider

Anwendungen, Provider, Erstellen, Typ **OAuth2/OpenID Provider**.

| Feld | Wert |
| --- | --- |
| Name | `pilze` |
| Authorization flow | implicit-consent |
| Client type | Public |
| Client ID | `pilze` |
| Redirect URIs | siehe unten, Matching Strict |
| Signing Key | das selbstsignierte Zertifikat der Instanz |
| Access code validity | `minutes=1` |
| Access token validity | `hours=1` |
| Refresh token validity | `days=30` |
| Scopes | `openid`, `email`, `profile`, `offline_access` |
| Subject mode | Based on the User's hashed ID |
| Include claims in id_token | an |

Redirect URIs, je ein Eintrag:

```
https://pilze.beimgraben.net/anmeldung
https://pilze.beimgraben.net/anmeldung/still
http://localhost:4200/anmeldung
http://localhost:4200/anmeldung/still
```

`/anmeldung/still` ist die stille Erneuerung im iframe. Die
localhost-Einträge sind für die Entwicklung.

## Anwendung

Anwendungen, Erstellen.

| Feld | Wert |
| --- | --- |
| Name | `Pilzkarte` |
| Slug | `pilze` |
| Provider | `pilze` |
| Launch URL | `https://pilze.beimgraben.net/` |

Die App braucht keine Gruppen oder Rollen. Jede angemeldete Person sieht nur
ihre eigenen Objekte.

## Ergebnis

| Was | Wert |
| --- | --- |
| Issuer | `https://sso.beimgraben.net/application/o/pilze/` |
| Discovery | `https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration` |
| JWKS | `https://sso.beimgraben.net/application/o/pilze/jwks/` |
| Client ID | `pilze` |

Das NixOS-Modul `homeserver-pilze-app` setzt Issuer und Client ID als
`PILZE_OIDC_ISSUER` und `PILZE_OIDC_CLIENT_ID`. Das Frontend liest sie aus
`GET /api/config`.

## Prüfen

```
curl -s https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration | jq .issuer
```

Erwartet: `"https://sso.beimgraben.net/application/o/pilze/"`. Bei 404 stimmt
der Slug nicht.
