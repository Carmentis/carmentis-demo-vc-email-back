# carmentis-demo-email-back

Backend NestJS du démo email Carmentis. Il expose deux flux principaux :

- **Issuer** : authentification par wallet Carmentis et émission d'une `EmailCredential` (SD-JWT) après vérification d'adresse email.
- **Demo** : authentification par wallet, soumission d'une Verifiable Presentation, et envoi d'emails.

## Prérequis

- Node.js >= 20
- pnpm

## Installation

```bash
pnpm install
```

## Configuration

Copier et adapter `config.toml` à la racine du projet :

```toml
[email]
host = "email-smtp.eu-west-1.amazonaws.com"
port = 465
secure = true
from = "demo@carmentis.io"

[email.auth]
user = "<SMTP_USER>"
pass = "<SMTP_PASSWORD>"

[operator]
url = "https://operator.arnauld.testnet.carmentis.io"
api_key = "<OPERATOR_API_KEY>"

[relay]
url = "https://relay.testnet.carmentis.io"
```

Le chemin du fichier de config est configurable via la variable d'environnement `CONFIG_FILE` (défaut : `config.toml`).

## Clés de signature (SD-JWT)

Au démarrage, le serveur charge la paire de clés Ed25519 depuis un fichier JSON (défaut : `keys.json` à la racine du projet).

**Si le fichier n'existe pas**, une nouvelle paire est générée automatiquement et sauvegardée dans ce fichier.

La clé publique est affichée dans les logs au démarrage.

Le chemin du fichier est configurable via la variable d'environnement `KEYS_FILE`.

Structure du fichier `keys.json` :

```json
{
  "publicJwk": {
    "crv": "Ed25519",
    "x": "<base64url>",
    "kty": "OKP"
  },
  "privateJwk": {
    "crv": "Ed25519",
    "d": "<base64url>",
    "x": "<base64url>",
    "kty": "OKP"
  }
}
```

> **Important** : ne pas committer `keys.json` (ajouter au `.gitignore`).

## Lancement

```bash
# Développement (watch mode)
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

Le serveur écoute sur le port `3000` par défaut (configurable via `PORT`).

## Variables d'environnement

| Variable      | Défaut        | Description                             |
|---------------|---------------|-----------------------------------------|
| `PORT`        | `3000`        | Port d'écoute HTTP                      |
| `CONFIG_FILE` | `config.toml` | Chemin vers le fichier de configuration |
| `KEYS_FILE`   | `keys.json`   | Chemin vers le fichier de clés JWK      |

## API

### Flux Issuer (`/issuer`)

| Méthode | Route                        | Auth    | Description                                   |
|---------|------------------------------|---------|-----------------------------------------------|
| GET     | `/issuer/config`             | -       | Retourne l'URL du relay Carmentis             |
| GET     | `/issuer/challenge`          | -       | Génère un challenge d'authentification        |
| POST    | `/issuer/auth`               | -       | Authentifie via signature JWS du challenge    |
| POST    | `/issuer/email/send-code`    | Session | Envoie un code de vérification par email      |
| POST    | `/issuer/email/verify-code`  | Session | Vérifie le code et émet une `EmailCredential` |

### Flux Demo (`/demo`)

| Méthode | Route                  | Auth    | Description                                  |
|---------|------------------------|---------|----------------------------------------------|
| GET     | `/demo/config`         | -       | Retourne l'URL du relay Carmentis            |
| GET     | `/demo/challenge`      | -       | Génère un challenge d'authentification       |
| POST    | `/demo/auth`           | -       | Authentifie via signature JWS du challenge   |
| GET     | `/demo/profile`        | Session | Retourne le profil de l'utilisateur connecté |
| POST    | `/demo/profile/vp`     | Session | Soumet une Verifiable Presentation           |
| POST    | `/demo/email/prepare`  | Session | Prépare un email (prévisualisation)          |
| POST    | `/demo/email/send`     | Session | Envoie un email (supporte les pièces jointes, max 10 × 10 Mo) |

### Authentification

Les endpoints protégés nécessitent un header `x-session-token` obtenu via le flux suivant :

1. `GET /*/challenge` → récupérer `{ challenge, challengeId }`
2. Signer le challenge avec la clé privée du wallet (JWS compact)
3. `POST /*/auth` avec `{ challengeId, pk, signature }` → recevoir `{ sessionToken }`
4. Utiliser `x-session-token: <sessionToken>` sur les requêtes suivantes

### Credential émis

Le credential `EmailCredential` est un SD-JWT signé Ed25519 avec les champs suivants :

| Champ   | Description                                              |
|---------|----------------------------------------------------------|
| `iss`   | DID JWK de l'issuer (clé publique du serveur)           |
| `sub`   | DID JWK de l'utilisateur (clé publique du wallet)       |
| `vct`   | `"EmailCredential"`                                      |
| `iat`   | Timestamp d'émission (Unix)                             |
| `email` | Adresse email vérifiée (champ sélectivement divulgable) |

## Stockage

Toutes les données (challenges, sessions, codes email, profils) sont stockées **en mémoire**. Elles sont perdues au redémarrage du serveur.

## Tests

```bash
pnpm run test        # tests unitaires
pnpm run test:e2e    # tests end-to-end
pnpm run test:cov    # couverture de code
```
