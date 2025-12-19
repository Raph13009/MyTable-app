import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Abstraction pour l'envoi d'emails
 * Utilise Resend par défaut, mais peut être facilement remplacé par Make (webhook)
 */
export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  // Option 1: Utiliser Resend (actuel)
  if (process.env.EMAIL_PROVIDER === 'resend' || !process.env.EMAIL_PROVIDER) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@mytable.com',
        to,
        subject,
        html,
      })
    } catch (error) {
      console.error('Error sending email with Resend:', error)
      throw error
    }
  }
  // Option 2: Utiliser Make (webhook) - à implémenter si besoin
  else if (process.env.EMAIL_PROVIDER === 'make') {
    try {
      const response = await fetch(process.env.MAKE_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          html,
        }),
      })

      if (!response.ok) {
        throw new Error(`Make webhook failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error sending email with Make:', error)
      throw error
    }
  }
}

/**
 * Layout réutilisable pour tous les emails
 * Design premium, moderne, minimal et cohérent
 */
interface EmailLayoutOptions {
  title: string
  content: string
  cta?: {
    text: string
    url: string
    variant?: 'primary' | 'secondary' | 'yellow'
  }
  baseUrl?: string
}

export function emailLayout({ title, content, cta, baseUrl }: EmailLayoutOptions): string {
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const logoBannerUrl = `${appUrl}/logo-banner.jpeg`
  const logoCercleUrl = `${appUrl}/logo-cercle.jpeg`
  
  let ctaButtonClass = 'background-color: #000; color: #fff;'
  let ctaButtonHover = 'background-color: #333;'
  
  if (cta?.variant === 'secondary' || cta?.variant === 'yellow') {
    ctaButtonClass = 'background-color: #FBCF03; color: #000;'
    ctaButtonHover = 'background-color: #E6BA00;'
  }

  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
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
          .email-content p:last-child {
            margin-bottom: 0;
          }
          .email-content strong {
            font-weight: 600;
            color: #000;
          }
          .email-details {
            background-color: #f9f9f9;
            border-left: 3px solid #FBCF03;
            padding: 20px;
            margin: 24px 0;
            border-radius: 4px;
          }
          .email-details p {
            margin-bottom: 8px;
            font-size: 15px;
          }
          .email-details p:last-child {
            margin-bottom: 0;
          }
          .email-details strong {
            display: inline-block;
            min-width: 120px;
            font-weight: 600;
          }
          .email-cta {
            text-align: center;
            margin: 32px 0;
          }
          .email-button {
            display: inline-block;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 999px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            ${ctaButtonClass}
          }
          .email-button:hover {
            ${ctaButtonHover}
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .email-button-yellow {
            display: inline-block;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 999px;
            font-weight: 600;
            font-size: 16px;
            background-color: #FBCF03;
            color: #000;
            transition: all 0.2s ease;
          }
          .email-button-yellow:hover {
            background-color: #E6BA00;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(251, 207, 3, 0.3);
          }
          .email-button-secondary {
            display: inline-block;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 999px;
            font-weight: 500;
            font-size: 15px;
            margin-left: 12px;
            background-color: #f5f5f5;
            color: #000;
            border: 1px solid #ddd;
          }
          .email-button-secondary:hover {
            background-color: #e8e8e8;
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
            .email-button,
            .email-button-yellow {
              display: block;
              margin-bottom: 12px;
            }
            .email-button-secondary {
              display: block;
              margin-left: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="email-container">
            <div class="email-header">
              <img src="${logoBannerUrl}" alt="MyTable" />
            </div>
            <div class="email-body">
              <h1 class="email-title">${title}</h1>
              <div class="email-content">
                ${content}
              </div>
              ${cta ? `
                <div class="email-cta">
                  <a href="${cta.url}" class="${cta.variant === 'yellow' ? 'email-button-yellow' : 'email-button'}">${cta.text}</a>
                </div>
              ` : ''}
            </div>
            <div class="email-footer">
              <p>Besoin d'aide ? <a href="mailto:contact@mytable.com">contact@mytable.com</a></p>
              <p><a href="${appUrl}">MyTable</a> - Votre chef à domicile</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}

/**
 * Subjects standardisés pour tous les emails
 */
export const emailSubjects = {
  bookingConfirmationToClient: 'Votre demande de réservation a été reçue',
  bookingRequestToChef: 'Nouvelle demande de réservation',
  bookingRefusedToClient: 'Votre demande de réservation',
  bookingAcceptedToClient: 'Réservation acceptée',
  bookingAcceptedToChef: 'Réservation acceptée',
  bookingValidatedToClient: 'Votre réservation est confirmée – paiement à venir',
  bookingValidatedToChef: 'Réservation validée par le client',
  bookingValidatedToAdmin: 'Nouvelle offre validée !',
  bookingCancelledToClient: 'Réservation annulée',
  bookingCancelledToChef: 'Réservation annulée',
}

/**
 * Templates d'emails
 */
export const emailTemplates = {
  bookingConfirmationToClient: (clientName: string, chefName: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${clientName},</p>
      <p>Votre demande de réservation a bien été prise en compte.</p>
      <p>Le chef <strong>${chefName}</strong> va examiner votre demande et vous répondra prochainement.</p>
      <p>Vous recevrez un email dès qu'une décision aura été prise.</p>
      <p>Merci de votre confiance !</p>
    `
    return emailLayout({
      title: 'Demande de réservation reçue',
      content,
      baseUrl,
    })
  },

  bookingRequestToChef: (chefName: string, bookingDetails: any, acceptUrl: string, refuseUrl: string, baseUrl?: string) => {
    const detailsHtml = `
      <div class="email-details">
        <p><strong>Client :</strong> ${bookingDetails.firstName} ${bookingDetails.lastName}</p>
        <p><strong>Téléphone :</strong> ${bookingDetails.phone}</p>
        <p><strong>Date :</strong> ${bookingDetails.bookingDate}</p>
        <p><strong>Ville :</strong> ${bookingDetails.city} (${bookingDetails.postalCode})</p>
        <p><strong>Nombre de convives :</strong> ${bookingDetails.guestsCount}</p>
        ${bookingDetails.hasAllergies ? `<p><strong>Allergies :</strong> ${bookingDetails.allergiesDetails || 'Oui'}</p>` : ''}
        ${bookingDetails.menuName ? `<p><strong>Menu choisi :</strong> ${bookingDetails.menuName}</p>` : ''}
        ${bookingDetails.notes ? `<p><strong>Notes :</strong> ${bookingDetails.notes}</p>` : ''}
      </div>
    `
    
    const content = `
      <p>Bonjour ${chefName},</p>
      <p>Vous avez reçu une nouvelle demande de réservation :</p>
      ${detailsHtml}
      <p>Veuillez accepter ou refuser cette demande :</p>
    `
    
    // Boutons jaunes et complètement arrondis pour le chef
    const contentWithButtons = content + `
      <div class="email-cta">
        <a href="${acceptUrl}" class="email-button-yellow">Accepter et accéder au chat</a>
        <a href="${refuseUrl}" class="email-button-secondary">Refuser</a>
      </div>
    `
    
    return emailLayout({
      title: 'Nouvelle demande de réservation',
      content: contentWithButtons,
      baseUrl,
    })
  },

  bookingRefusedToClient: (clientName: string, siteUrl: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${clientName},</p>
      <p>Nous sommes désolés, mais votre demande de réservation n'a pas pu être acceptée.</p>
      <p>N'hésitez pas à consulter nos autres chefs disponibles.</p>
    `
    return emailLayout({
      title: 'Demande de réservation',
      content,
      cta: {
        text: 'Voir les autres chefs',
        url: siteUrl,
        variant: 'secondary',
      },
      baseUrl,
    })
  },

  bookingAcceptedToClient: (clientName: string, chatUrl: string, baseUrl?: string) => {
    const dashboardUrl = `${baseUrl}/dashboard`
    const content = `
      <p>Bonjour ${clientName},</p>
      <p>Excellente nouvelle ! Votre demande de réservation a été acceptée.</p>
      <p>Vous pouvez maintenant accéder à vos conversations pour échanger avec le chef.</p>
    `
    // Utiliser un CTA jaune personnalisé au lieu du système par défaut
    const contentWithCta = content + `
      <div class="email-cta">
        <a href="${dashboardUrl}" class="email-button-yellow">Accéder à mes conversations</a>
      </div>
    `
    return emailLayout({
      title: 'Réservation acceptée',
      content: contentWithCta,
      baseUrl,
    })
  },

  bookingAcceptedToChef: (chefName: string, confirmationUrl: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${chefName},</p>
      <p>Vous avez accepté une demande de réservation.</p>
      <p>Cliquez sur le bouton ci-dessous pour confirmer votre acceptation.</p>
    `
    // Utiliser un CTA jaune personnalisé
    const contentWithCta = content + `
      <div class="email-cta">
        <a href="${confirmationUrl}" class="email-button-yellow">Confirmer l'acceptation</a>
      </div>
    `
    return emailLayout({
      title: 'Réservation acceptée',
      content: contentWithCta,
      baseUrl,
    })
  },

  bookingValidatedToClient: (clientName: string, bookingDate: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${clientName},</p>
      <p>Votre réservation du <strong>${bookingDate}</strong> a été validée avec succès.</p>
      <p>Vous recevrez un lien de paiement dans les prochaines 24 heures pour finaliser votre réservation.</p>
      <p>Merci de votre confiance !</p>
    `
    return emailLayout({
      title: 'Réservation confirmée',
      content,
      baseUrl,
    })
  },

  bookingValidatedToChef: (chefName: string, clientName: string, bookingDate: string, guestsCount: number, totalAmount: number, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${chefName},</p>
      <p>La réservation de <strong>${clientName}</strong> a été validée par le client.</p>
      <p><strong>Détails de la réservation :</strong></p>
      <ul style="list-style: none; padding-left: 0;">
        <li>📅 Date : ${bookingDate}</li>
        <li>👥 Nombre de convives : ${guestsCount}</li>
        <li>💰 Montant total : ${totalAmount.toFixed(2)} €</li>
      </ul>
      <p>Le paiement est attendu dans les 48 prochaines heures.</p>
    `
    return emailLayout({
      title: 'Réservation validée',
      content,
      baseUrl,
    })
  },

  bookingValidatedToAdmin: (clientName: string, clientEmail: string, chefName: string, chefEmail: string, bookingDate: string, guestsCount: number, totalAmount: number, menuName: string | null, extras: Array<{ name: string; price: number }>, baseUrl?: string) => {
    const extrasList = extras.length > 0 
      ? extras.map(e => `<li>${e.name} : ${e.price.toFixed(2)} €</li>`).join('')
      : '<li>Aucun extra</li>'
    
    const content = `
      <p><strong style="font-size: 18px; color: #000;">Action requise : Envoyer le lien de paiement</strong></p>
      
      <div style="background-color: #f9f9f9; border-left: 4px solid #FBCF03; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #000; font-size: 16px;">📧 Envoyer le lien de paiement d'une valeur de <strong>${totalAmount.toFixed(2)} €</strong> au client :</p>
        <p style="margin: 8px 0 0 0; font-size: 15px; color: #000;"><strong>${clientEmail}</strong></p>
      </div>
      
      <div style="margin: 24px 0; padding: 20px; background-color: #ffffff; border: 1px solid #e8e8e8; border-radius: 8px;">
        <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #000; font-weight: 600;">Détails de la réservation</h3>
        
        <div style="margin-bottom: 12px;">
          <p style="margin: 0; color: #666; font-size: 13px;"><strong>Client :</strong></p>
          <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${clientName}</p>
          <p style="margin: 2px 0 0 0; color: #666; font-size: 14px;">${clientEmail}</p>
        </div>
        
        <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
          <p style="margin: 0; color: #666; font-size: 13px;"><strong>Chef :</strong></p>
          <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${chefName}</p>
          <p style="margin: 2px 0 0 0; color: #666; font-size: 14px;">${chefEmail}</p>
        </div>
        
        <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
          <p style="margin: 0; color: #666; font-size: 13px;"><strong>Date de l'événement :</strong></p>
          <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${bookingDate}</p>
        </div>
        
        <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
          <p style="margin: 0; color: #666; font-size: 13px;"><strong>Nombre de convives :</strong></p>
          <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${guestsCount} ${guestsCount === 1 ? 'convive' : 'convives'}</p>
        </div>
        
        <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
          <p style="margin: 0; color: #666; font-size: 13px;"><strong>Menu sélectionné :</strong></p>
          <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${menuName || 'Non spécifié'}</p>
        </div>
        
        ${extras.length > 0 ? `
        <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
          <p style="margin: 0; color: #666; font-size: 13px;"><strong>Extras :</strong></p>
          <ul style="margin: 4px 0 0 0; padding-left: 20px; color: #000; font-size: 15px;">
            ${extrasList}
          </ul>
        </div>
        ` : ''}
        
        <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #000;">
          <p style="margin: 0; color: #666; font-size: 13px;"><strong>Montant total :</strong></p>
          <p style="margin: 4px 0 0 0; color: #000; font-size: 20px; font-weight: 700;">${totalAmount.toFixed(2)} €</p>
        </div>
      </div>
      
      <div style="margin-top: 24px; padding: 20px; background-color: #FBCF03; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-weight: 600; color: #000; font-size: 16px;">
          ⚠️ Action requise : Envoyer le lien de paiement de <strong>${totalAmount.toFixed(2)} €</strong> à ${clientEmail} dans les 24 heures
        </p>
      </div>
    `
    return emailLayout({
      title: 'Action requise – Lien de paiement à envoyer',
      content,
      baseUrl,
    })
  },

  bookingCancelledToClient: (clientName: string, bookingDate: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${clientName},</p>
      <p>Votre réservation du <strong>${bookingDate}</strong> a été annulée.</p>
      <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
    `
    return emailLayout({
      title: 'Réservation annulée',
      content,
      cta: {
        text: 'Voir les autres chefs',
        url: baseUrl || 'http://localhost:3000',
        variant: 'secondary',
      },
      baseUrl,
    })
  },

  bookingCancelledToChef: (chefName: string, clientName: string, bookingDate: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${chefName},</p>
      <p>La réservation de <strong>${clientName}</strong> prévue le <strong>${bookingDate}</strong> a été annulée.</p>
      <p>Cette réservation est maintenant fermée.</p>
    `
    return emailLayout({
      title: 'Réservation annulée',
      content,
      baseUrl,
    })
  },
}

