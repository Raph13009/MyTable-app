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
 * Templates d'emails
 */
export const emailTemplates = {
  bookingRequestToChef: (chefName: string, bookingDetails: any, acceptUrl: string, refuseUrl: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FBCF03; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #fff; }
          .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 4px; font-weight: bold; }
          .button-accept { background-color: #000; color: #fff; }
          .button-refuse { background-color: #666; color: #fff; }
          .details { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #000; margin: 0;">Nouvelle demande de réservation</h1>
          </div>
          <div class="content">
            <p>Bonjour ${chefName},</p>
            <p>Vous avez reçu une nouvelle demande de réservation :</p>
            <div class="details">
              <p><strong>Client:</strong> ${bookingDetails.firstName} ${bookingDetails.lastName}</p>
              <p><strong>Email:</strong> ${bookingDetails.email}</p>
              <p><strong>Téléphone:</strong> ${bookingDetails.phone}</p>
              <p><strong>Date:</strong> ${bookingDetails.bookingDate}</p>
              <p><strong>Ville:</strong> ${bookingDetails.city} (${bookingDetails.postalCode})</p>
              <p><strong>Nombre de convives:</strong> ${bookingDetails.guestsCount}</p>
              ${bookingDetails.hasAllergies ? `<p><strong>Allergies:</strong> ${bookingDetails.allergiesDetails || 'Oui'}</p>` : ''}
              ${bookingDetails.menuName ? `<p><strong>Menu choisi:</strong> ${bookingDetails.menuName}</p>` : ''}
              ${bookingDetails.notes ? `<p><strong>Notes:</strong> ${bookingDetails.notes}</p>` : ''}
            </div>
            <p>Veuillez accepter ou refuser cette demande :</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${acceptUrl}" class="button button-accept">Accepter</a>
              <a href="${refuseUrl}" class="button button-refuse">Refuser</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `,

  bookingRefusedToClient: (clientName: string, siteUrl: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FBCF03; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #fff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #000; margin: 0;">Demande de réservation</h1>
          </div>
          <div class="content">
            <p>Bonjour ${clientName},</p>
            <p>Nous sommes désolés, mais votre demande de réservation n'a pas pu être acceptée.</p>
            <p>N'hésitez pas à consulter nos autres chefs disponibles :</p>
            <p><a href="${siteUrl}" style="color: #FBCF03; font-weight: bold;">Voir les autres chefs</a></p>
          </div>
        </div>
      </body>
    </html>
  `,

  bookingAcceptedToClient: (clientName: string, chatUrl: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FBCF03; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #fff; }
          .button { display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #000; margin: 0;">Réservation acceptée !</h1>
          </div>
          <div class="content">
            <p>Bonjour ${clientName},</p>
            <p>Excellente nouvelle ! Votre demande de réservation a été acceptée.</p>
            <p>Vous pouvez maintenant accéder au chat pour échanger avec le chef :</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${chatUrl}" class="button">Accéder au chat</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `,

  bookingAcceptedToChef: (chefName: string, chatUrl: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FBCF03; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #fff; }
          .button { display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #000; margin: 0;">Réservation acceptée</h1>
          </div>
          <div class="content">
            <p>Bonjour ${chefName},</p>
            <p>Vous avez accepté une demande de réservation. Accédez au chat pour communiquer avec votre client :</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${chatUrl}" class="button">Accéder au chat</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `,
}

