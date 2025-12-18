# Personnalisation des emails Supabase Auth

Les emails d'authentification Supabase (magic links) sont configurés dans le **Supabase Dashboard**, pas dans le code.

## Configuration dans Supabase Dashboard

1. Allez dans **Authentication** > **Email Templates**
2. Personnalisez les templates suivants pour correspondre au style de nos emails transactionnels :

### Template "Magic Link"

**Subject** : `Connexion à MyTable`

**Body HTML** : Utilisez le même style que nos emails transactionnels :

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #000;
        background-color: #f5f5f5;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      .email-wrapper {
        width: 100%;
        padding: 20px;
      }
      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .email-header {
        background-color: #ffffff;
        padding: 32px 40px 24px;
        text-align: center;
        border-bottom: 2px solid #FBCF03;
      }
      .email-header img {
        max-width: 200px;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .email-body {
        padding: 40px;
      }
      .email-title {
        font-size: 24px;
        font-weight: 700;
        color: #000;
        margin: 0 0 24px 0;
        line-height: 1.3;
      }
      .email-content {
        font-size: 16px;
        color: #000;
        line-height: 1.7;
        margin-bottom: 32px;
      }
      .email-content p {
        margin-bottom: 16px;
      }
      .email-button {
        display: inline-block;
        padding: 14px 32px;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        font-size: 16px;
        background-color: #000;
        color: #fff;
        transition: all 0.2s ease;
      }
      .email-button:hover {
        background-color: #333;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .email-cta {
        text-align: center;
        margin: 32px 0;
      }
      .email-footer {
        background-color: #f9f9f9;
        padding: 24px 40px;
        text-align: center;
        border-top: 1px solid #e8e8e8;
      }
      .email-footer p {
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
      }
      .email-footer a {
        color: #000;
        text-decoration: none;
        font-weight: 500;
      }
      .email-footer a:hover {
        color: #FBCF03;
      }
      @media only screen and (max-width: 600px) {
        .email-wrapper {
          padding: 0;
        }
        .email-container {
          border-radius: 0;
        }
        .email-header,
        .email-body,
        .email-footer {
          padding: 24px 20px;
        }
        .email-title {
          font-size: 20px;
        }
        .email-content {
          font-size: 15px;
        }
        .email-button {
          display: block;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-container">
        <div class="email-header">
          <img src="{{ .SiteURL }}/logo-banner.jpeg" alt="MyTable" />
        </div>
        <div class="email-body">
          <h1 class="email-title">Connexion à MyTable</h1>
          <div class="email-content">
            <p>Bonjour,</p>
            <p>Cliquez sur le bouton ci-dessous pour vous connecter à votre compte MyTable :</p>
          </div>
          <div class="email-cta">
            <a href="{{ .ConfirmationURL }}" class="email-button">Se connecter</a>
          </div>
          <div class="email-content">
            <p style="font-size: 14px; color: #666;">Si vous n'avez pas demandé cette connexion, vous pouvez ignorer cet email.</p>
          </div>
        </div>
        <div class="email-footer">
          <p>Besoin d'aide ? <a href="mailto:contact@mytable.com">contact@mytable.com</a></p>
          <p><a href="{{ .SiteURL }}">MyTable</a> - Votre chef à domicile</p>
        </div>
      </div>
    </div>
  </body>
</html>
```

## Variables Supabase disponibles

Dans les templates Supabase, vous pouvez utiliser :

- `{{ .ConfirmationURL }}` : URL de confirmation/connexion
- `{{ .SiteURL }}` : URL de base de votre application
- `{{ .Email }}` : Email de l'utilisateur
- `{{ .Token }}` : Token de confirmation (pour les emails de réinitialisation)

## Notes importantes

1. **Images** : Utilisez `{{ .SiteURL }}/logo-banner.jpeg` pour le logo dans le header
2. **URLs** : Toutes les URLs doivent être absolues (commençant par `{{ .SiteURL }}`)
3. **Style cohérent** : Utilisez exactement le même CSS que dans `lib/email.ts` pour une cohérence parfaite
4. **Responsive** : Le CSS inclut des media queries pour mobile

## Autres templates Supabase

Vous pouvez également personnaliser :
- **Change Email Address** : Pour les changements d'email
- **Reset Password** : Pour la réinitialisation de mot de passe
- **Invite User** : Pour les invitations d'utilisateurs

Utilisez le même style et structure pour tous ces templates.

