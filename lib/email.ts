import { Resend } from 'resend'
import { getBaseUrl, escapeHtml } from './utils'
import { getBudgetGlobalLabel, getValidationMessage, getBookingValidatedToChefSubject } from './i18n/constants'

// Resend : tous les emails transactionnels (notifications, confirmations).
// L'authentification utilise email+mot de passe via /login.
const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailOptions {
  to: string
  subject: string
  html: string
  /** Override expéditeur Resend (ex. tests avec onboarding@resend.dev) */
  from?: string
}

/**
 * Abstraction pour l'envoi d'emails
 * Utilise Resend par défaut, mais peut être facilement remplacé par Make (webhook)
 */
export async function sendEmail({ to, subject, html, from: fromOverride }: EmailOptions): Promise<void> {
  // Option 1: Utiliser Resend (actuel)
  if (process.env.EMAIL_PROVIDER === 'resend' || !process.env.EMAIL_PROVIDER) {
    try {
      const startTime = Date.now()
      const from =
        fromOverride ||
        process.env.RESEND_FROM ||
        'MyTable <contact@guidemytable.fr>'
      const response = await resend.emails.send({
        from,
        to,
        subject,
        html,
      })
      const duration = Date.now() - startTime
      const res = response as { data?: { id?: string } | null; error?: { message?: string; name?: string } | null }
      if (res.error) {
        const msg = res.error.message || JSON.stringify(res.error)
        console.error('[email] ❌ Resend API error:', res.error)
        throw new Error(`Resend: ${msg}`)
      }
      console.log('[email] ✅ Resend sent', {
        to,
        subject,
        messageId: res.data?.id,
        durationMs: duration,
      })
    } catch (error) {
      console.error('[email] ❌ Error sending email with Resend:', error)
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
  const appUrl = getBaseUrl(baseUrl)
  const logoBannerUrl = `${appUrl}/logo-banner.jpeg`
  const logoCercleUrl = `${appUrl}/logo-cercle.png`
  
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
          a {
            color: #000 !important;
            text-decoration: none;
          }
          a:hover {
            color: #FBCF03 !important;
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
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 999px;
            font-weight: 600;
            font-size: 16px;
            margin-left: 24px;
            background-color: #000 !important;
            color: #FFFFFF !important;
            border: 2px solid #000 !important;
          }
          .email-button-secondary:hover {
            background-color: #000 !important;
            color: #FFFFFF !important;
          }
          .email-button-secondary:active {
            background-color: #000 !important;
            color: #FFFFFF !important;
          }
          .email-button-secondary:visited {
            background-color: #000 !important;
            color: #FFFFFF !important;
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
              margin-top: 16px;
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
              <p>Besoin d'aide ? <a href="mailto:contact@guidemytable.fr" style="color: #000; text-decoration: underline;">contact@guidemytable.fr</a></p>
              <p style="margin-top: 8px; font-size: 13px; color: #666; font-style: italic;">MyTable - L'art culinaire privé sélectionné avec soin pour vous</p>
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
  menuUpdated: 'Votre menu a été mis à jour',
  bookingConfirmationToClient: 'Votre demande de réservation a été transmise au Chef avec succès',
  bookingRequestToChef: 'Nouvelle demande de réservation',
  clientChatInactivityReminder: 'MyTable — Votre conversation vous attend',
  bookingReplacementRequestToChef: 'Remplacement prioritaire - demande de réservation',
  bookingReminderToChef: 'Relance - demande de réservation en attente',
  bookingNewToAdmin: 'Nouvelle demande de réservation',
  bookingRefusedToClient: 'Votre demande MyTable - disponibilité du chef',
  bookingAcceptedToClient: 'Réservation acceptée',
  bookingAcceptedToChef: 'Réservation acceptée',
  bookingValidatedToClient: 'Votre réservation est confirmée – paiement à venir',
  bookingValidatedToChef: getBookingValidatedToChefSubject('fr'), // Utilise i18n
  bookingValidatedToAdmin: 'Nouvelle offre validée !',
  bookingCancelledToClient: 'Réservation annulée',
  bookingCancelledToChef: 'Réservation annulée',
}

/**
 * Templates d'emails
 */
function buildBookingDetailsHtml(bookingDetails: any): string {
  // Construire les détails selon le type de service
  let detailsHtml = `
    <div class="email-details">
      <p><strong>Type de prestation :</strong> ${bookingDetails.serviceTypeLabel || 'Réservation'}</p>
      <p><strong>Client :</strong> ${bookingDetails.firstName} ${bookingDetails.lastName}</p>
      <p><strong>Ville :</strong> ${bookingDetails.city} (${bookingDetails.postalCode})</p>
      <p><strong>Nombre de convives :</strong> ${bookingDetails.guestsCount}${bookingDetails.childrenCount > 0 ? ` (dont ${bookingDetails.childrenCount} ${bookingDetails.childrenCount === 1 ? 'enfant' : 'enfants'})` : ''}</p>
  `

  // Détails spécifiques selon le type de service
  if (bookingDetails.serviceType === 'repas_domicile') {
    if (bookingDetails.bookingDate) {
      detailsHtml += `<p><strong>Date :</strong> ${bookingDetails.bookingDate}</p>`
    }
    if (bookingDetails.mealTimeLabel) {
      detailsHtml += `<p><strong>Moment du repas :</strong> ${bookingDetails.mealTimeLabel}</p>`
    }
    if (bookingDetails.menuName && !bookingDetails.hideSelectedMenu) {
      detailsHtml += `<p><strong>Menu choisi :</strong> ${bookingDetails.menuName}</p>`
    }
    if (bookingDetails.menuPricePerPerson) {
      detailsHtml += `<p><strong>Prix par personne (menu) :</strong> ${bookingDetails.menuPricePerPerson.toFixed(2)} €</p>`
    }
    if (bookingDetails.estimatedTotalPrice) {
      detailsHtml += `<p><strong>Prix total de la prestation :</strong> ${bookingDetails.estimatedTotalPrice.toFixed(2)} €</p>`
    }
    if (bookingDetails.hasAllergies) {
      detailsHtml += `<p><strong>Allergies :</strong> ${bookingDetails.allergiesDetails || 'Oui'}</p>`
    }
  } else if (bookingDetails.serviceType === 'cours_cuisine') {
    if (bookingDetails.bookingDate) {
      detailsHtml += `<p><strong>Date :</strong> ${bookingDetails.bookingDate}</p>`
    }
    const coursePricePerPerson = Number(bookingDetails.budgetPerPerson ?? bookingDetails.budget)
    const hasCoursePricePerPerson = Number.isFinite(coursePricePerPerson) && coursePricePerPerson > 0
    if (hasCoursePricePerPerson) {
      detailsHtml += `<p><strong>Prix par personne :</strong> ${coursePricePerPerson.toFixed(2)} €</p>`
    } else if (bookingDetails.budget) {
      detailsHtml += `<p><strong>Budget global :</strong> ${bookingDetails.budget.toFixed(2)} €</p>`
    }
    const estimatedCourseTotal = Number(bookingDetails.estimatedTotalPrice)
    if (Number.isFinite(estimatedCourseTotal) && estimatedCourseTotal > 0) {
      detailsHtml += `<p><strong>Prix total estimé :</strong> ${estimatedCourseTotal.toFixed(2)} €</p>`
    }
    if (bookingDetails.courseTopic) {
      detailsHtml += `<p><strong>Sujet du cours :</strong> ${bookingDetails.courseTopic}</p>`
    }
  } else if (bookingDetails.serviceType === 'mise_en_demeure') {
    if (bookingDetails.selectedDates && Array.isArray(bookingDetails.selectedDates) && bookingDetails.selectedDates.length > 0) {
      const datesFormatted = bookingDetails.selectedDates.map((date: string) => 
        new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      ).join(', ')
      detailsHtml += `<p><strong>Dates sélectionnées :</strong> ${datesFormatted}</p>`
    }
    if (bookingDetails.mealOptionsLabel) {
      detailsHtml += `<p><strong>Options de repas :</strong> ${bookingDetails.mealOptionsLabel}</p>`
    }
    const homeChefPricePerDay = Number(bookingDetails.pricePerDay ?? bookingDetails.totalPrice)
    if (Number.isFinite(homeChefPricePerDay) && homeChefPricePerDay > 0) {
      detailsHtml += `<p><strong>Prix par jour :</strong> ${homeChefPricePerDay.toFixed(2)} €</p>`
    } else if (bookingDetails.totalPrice) {
      // Rétrocompatibilité avec les anciennes réservations
      const budgetLabel = getBudgetGlobalLabel('fr')
      detailsHtml += `<p><strong>${budgetLabel} :</strong> ${bookingDetails.totalPrice.toFixed(2)} €</p>`
    }
    const estimatedHomeChefTotal = Number(bookingDetails.estimatedTotalPrice)
    if (Number.isFinite(estimatedHomeChefTotal) && estimatedHomeChefTotal > 0) {
      detailsHtml += `<p><strong>Prix total estimé :</strong> ${estimatedHomeChefTotal.toFixed(2)} €</p>`
    }
  }

  // Notes communes à tous les types
  if (bookingDetails.notes) {
    detailsHtml += `<p><strong>Notes :</strong> ${bookingDetails.notes}</p>`
  }

  detailsHtml += `</div>`

  return detailsHtml
}

export const emailTemplates = {
  bookingConfirmationToClient: (clientName: string, chefName: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${clientName},</p>
      <p>Votre demande de réservation a été transmise au Chef avec succès.</p>
      <p>Le Chef va examiner votre demande et vous recevrez une réponse par mail sous 24h.</p>
      <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e8e8e8;">
        <strong>Merci de votre confiance auprès du Guide MyTable !</strong>
      </p>
    `
    return emailLayout({
      title: 'Demande de réservation reçue',
      content,
      baseUrl,
    })
  },

  bookingRequestToChef: (
    chefName: string,
    bookingDetails: any,
    acceptUrl: string,
    refuseUrl: string,
    baseUrl?: string,
    options?: { showFallbackPriority?: boolean }
  ) => {
    const detailsHtml = buildBookingDetailsHtml(bookingDetails)

    const priorityBlock =
      options?.showFallbackPriority === true
        ? `
      <div style="background-color:#FFFBEB;border:2px solid #FBCF03;padding:18px 22px;margin:20px 0 24px 0;border-radius:8px;">
        <p style="margin:0;font-weight:700;font-size:16px;line-height:1.55;color:#111;">
          Vous êtes prioritaire pour cette demande pendant 6 heures ; après, elle sera attribuée à d'autres chefs.
        </p>
      </div>
    `
        : ''

    const content = `
      <p>Bonjour ${chefName},</p>
      <p>Vous avez reçu une nouvelle demande de ${bookingDetails.serviceTypeLabel?.toLowerCase() || 'réservation'} de la part de <strong>${bookingDetails.firstName} ${bookingDetails.lastName}</strong> :</p>
      ${priorityBlock}
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
      title: `Nouvelle demande de ${bookingDetails.serviceTypeLabel?.toLowerCase() || 'réservation'}`,
      content: contentWithButtons,
      baseUrl,
    })
  },

  bookingReplacementRequestToChef: (
    chefName: string,
    bookingDetails: any,
    acceptUrl: string,
    refuseUrl: string,
    baseUrl?: string
  ) => {
    const detailsHtml = buildBookingDetailsHtml({
      ...bookingDetails,
      hideSelectedMenu: true,
    })
    const guestsText = `${bookingDetails.guestsCount}${bookingDetails.childrenCount > 0 ? ` (dont ${bookingDetails.childrenCount} ${bookingDetails.childrenCount === 1 ? 'enfant' : 'enfants'})` : ''}`
    const budgetPerPersonText = bookingDetails.menuPricePerPerson
      ? `${bookingDetails.menuPricePerPerson.toFixed(2)} €`
      : 'non communiqué'
    const totalBudgetText = bookingDetails.estimatedTotalPrice
      ? `${bookingDetails.estimatedTotalPrice.toFixed(2)} €`
      : (bookingDetails.totalPrice ? `${bookingDetails.totalPrice.toFixed(2)} €` : 'non communiqué')

    const content = `
      <p>Bonjour ${chefName},</p>
      <p>Vous avez été sélectionné comme <strong>chef de remplacement</strong> pour une prestation de <strong>${guestsText} convives</strong>.</p>
      <p style="margin: 0 0 10px 0; color: #444;">
        Le Chef initialement prévu pour ce client n'est plus disponible. <strong>Tentez votre chance&nbsp;!</strong>
      </p>
      <p style="margin: 0 0 14px 0; color: #444;">
        <strong>Important :</strong> le montant affiché ci-dessous correspond au budget de cette demande de remplacement,
        et peut être différent du prix habituel de vos menus.
      </p>
      <p><strong>Budget par personne :</strong> ${budgetPerPersonText}<br/>
      <strong>Budget total estimé :</strong> ${totalBudgetText}</p>
      <p>Cette demande est également envoyée à d'autres chefs qualifiés à proximité.</p>
      <p><strong>Le premier chef qui accepte obtient la mission.</strong> Si le bouton n'aboutit pas, c'est qu'un autre chef a déjà confirmé avant vous.</p>
      ${detailsHtml}
      <p>Merci de répondre rapidement :</p>
    `

    const contentWithButtons = content + `
      <div class="email-cta">
        <a href="${acceptUrl}" class="email-button-yellow">Accepter et accéder au chat</a>
        <a href="${refuseUrl}" class="email-button-secondary">Refuser</a>
      </div>
    `

    return emailLayout({
      title: `Remplacement prioritaire - ${bookingDetails.serviceTypeLabel?.toLowerCase() || 'réservation'}`,
      content: contentWithButtons,
      baseUrl,
    })
  },

  bookingReminderToChef: (
    chefName: string,
    bookingDetails: any,
    acceptUrl: string,
    refuseUrl: string,
    timeElapsedLabel: string,
    baseUrl?: string
  ) => {
    const detailsHtml = buildBookingDetailsHtml(bookingDetails)
    
    const content = `
      <p>Bonjour ${chefName},</p>
      <p>Petit rappel : une demande de ${bookingDetails.serviceTypeLabel?.toLowerCase() || 'réservation'} de la part de <strong>${bookingDetails.firstName} ${bookingDetails.lastName}</strong> est toujours en attente.</p>
      <p><strong>Temps écoulé :</strong> ${timeElapsedLabel}</p>
      ${detailsHtml}
      <p>Merci de répondre dès que possible :</p>
    `
    
    const contentWithButtons = content + `
      <div class="email-cta">
        <a href="${acceptUrl}" class="email-button-yellow">Accepter et accéder au chat</a>
        <a href="${refuseUrl}" class="email-button-secondary">Refuser</a>
      </div>
    `
    
    return emailLayout({
      title: `Relance - demande de ${bookingDetails.serviceTypeLabel?.toLowerCase() || 'réservation'}`,
      content: contentWithButtons,
      baseUrl,
    })
  },

  bookingNewToAdmin: (
    clientName: string,
    clientEmail: string,
    chefName: string,
    chefEmail: string | null,
    bookingDetails: any,
    baseUrl?: string
  ) => {
    const detailsHtml = buildBookingDetailsHtml(bookingDetails)
    const content = `
      <p>Bonjour,</p>
      <p>Une nouvelle demande de réservation a été créée.</p>
      ${detailsHtml}
      <div class="email-details">
        <p><strong>Client :</strong> ${clientName} (${clientEmail})</p>
        <p><strong>Chef :</strong> ${chefName}${chefEmail ? ` (${chefEmail})` : ''}</p>
      </div>
    `
    return emailLayout({
      title: 'Nouvelle demande de réservation',
      content,
      baseUrl,
    })
  },

  bookingRefusedToClient: (clientFirstName: string, chefFirstName: string, baseUrl?: string) => {
    const ctaUrl = `${getBaseUrl(baseUrl)}/`
    const content = `
      <p>Bonjour ${clientFirstName},</p>
      <p>Votre demande avec le Chef <strong>${chefFirstName}</strong> n'a malheureusement pas pu être acceptée, mais nous avons d'autres profils de Chefs talentueux qui pourraient parfaitement correspondre à votre expérience.</p>
      <p>Vous pouvez les découvrir ici :</p>
      <div class="email-cta" style="margin-top: 12px; margin-bottom: 24px; text-align: center;">
        <a href="${ctaUrl}" class="email-button-yellow">Découvrir les autres Chefs</a>
      </div>
      <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e8e8e8;">
        Nous restons à votre disposition pour toute question,<br>
        À très vite autour de votre table !
      </p>
      <p style="margin-top: 8px; font-size: 13px; color: #666; font-style: italic;">
        L'équipe MyTable
      </p>
    `
    return emailLayout({
      title: 'Votre demande MyTable - disponibilité du chef',
      content,
      baseUrl,
    })
  },

  bookingAcceptedToClient: (clientName: string, chefFirstName: string, chefLastName: string, chatUrl: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${clientName},</p>
      <p>Excellente nouvelle ! Votre demande de réservation a été acceptée par le Chef <strong>${chefFirstName} ${chefLastName}</strong>.</p>
      <p>Vous pouvez dès maintenant échanger avec votre chef depuis votre espace de conversation.</p>
    `
    return emailLayout({
      title: 'Réservation acceptée',
      content,
      cta: {
        text: 'Accéder à ma conversation',
        url: chatUrl,
        variant: 'yellow',
      },
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
      <p style="margin-top: 16px;">Merci de votre confiance !</p>
    `
    return emailLayout({
      title: 'Réservation confirmée',
      content,
      baseUrl,
    })
  },

  bookingValidatedToChef: (chefName: string, clientName: string, bookingDate: string, guestsCount: number, childrenCount: number, totalAmount: number, city: string | null, postalCode: string | null, baseUrl?: string) => {
    const childrenText = childrenCount > 0 ? ` (dont ${childrenCount} ${childrenCount === 1 ? 'enfant' : 'enfants'})` : ''
    
    // Utiliser i18n pour le message de validation
    const validationMessage = getValidationMessage(clientName, 'fr')
    
    // Construire l'adresse complète
    const addressParts: string[] = []
    if (city) addressParts.push(city)
    if (postalCode) addressParts.push(postalCode)
    const fullAddress = addressParts.length > 0 ? addressParts.join(' ') : 'Non renseignée'
    
    // Construire le lien vers la messagerie
    const loginUrl = baseUrl ? `${baseUrl}/login` : '/login'
    
    const content = `
      <p>Bonjour ${chefName},</p>
      <p>${validationMessage}</p>
      <p><strong>Détails de la réservation :</strong></p>
      <ul style="list-style: none; padding-left: 0;">
        <li>📅 Date : ${bookingDate}</li>
        <li>📍 Adresse : ${fullAddress}</li>
        <li>👥 Nombre de convives : ${guestsCount}${childrenText}</li>
        <li>💰 Montant total : ${totalAmount.toFixed(2)} €</li>
      </ul>
      <p>Nous reviendrons vers vous par mail afin de vous confirmer le paiement définitif du client. Pendant ce temps, vous pouvez régler les derniers détails avec votre client directement depuis la <a href="${loginUrl}" style="color: #FBCF03; text-decoration: underline;">messagerie MyTable</a>. Nous comptons sur vous pour rendre cet évènement exceptionnel !</p>
    `
    return emailLayout({
      title: 'Réservation validée',
      content,
      baseUrl,
    })
  },

  bookingValidatedToAdmin: (
    clientName: string,
    clientEmail: string,
    chefName: string,
    chefEmail: string,
    bookingDate: string,
    guestsCount: number,
    childrenCount: number,
    totalAmount: number,
    menuName: string | null,
    extras: Array<{ name: string; price: number | string }>,
    baseUrl?: string
  ) => {
    const safeTotalAmount = Number.isFinite(Number(totalAmount)) ? Number(totalAmount) : 0
    const safeExtras = Array.isArray(extras) ? extras : []
    const extrasList = safeExtras.length > 0
      ? safeExtras.map((e) => {
          const price = Number(e?.price)
          const safePrice = Number.isFinite(price) ? price : 0
          return `<li>${e?.name || 'Extra'} : ${safePrice.toFixed(2)} €</li>`
        }).join('')
      : '<li>Aucun extra</li>'
    
    // Calculer le montant avec commission (total - 15%)
    const commissionRate = 0.15
    const commissionAmount = safeTotalAmount * commissionRate
    const amountAfterCommission = safeTotalAmount - commissionAmount
    
    const content = `
      <p><strong style="font-size: 18px; color: #000;">Action requise : Envoyer le lien de paiement</strong></p>
      
      <div style="background-color: #f9f9f9; border-left: 4px solid #FBCF03; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-weight: 600; color: #000; font-size: 16px;">📧 Envoyer le lien de paiement d'une valeur de <strong>${amountAfterCommission.toFixed(2)} €</strong> au client :</p>
        <p style="margin: 8px 0 0 0; font-size: 15px; color: #000;"><strong>${clientEmail}</strong></p>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #666; font-style: italic;">
          <strong>Note importante :</strong> Le montant à facturer est de <strong>${amountAfterCommission.toFixed(2)} €</strong> (prix total ${safeTotalAmount.toFixed(2)} € - commission plateforme de ${commissionAmount.toFixed(2)} € soit 15%)
        </p>
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
          <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">
            ${guestsCount} ${guestsCount === 1 ? 'convive' : 'convives'}${childrenCount > 0 ? ` (dont ${childrenCount} ${childrenCount === 1 ? 'enfant' : 'enfants'})` : ''}
          </p>
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
          <p style="margin: 4px 0 0 0; color: #000; font-size: 20px; font-weight: 700;">${safeTotalAmount.toFixed(2)} €</p>
        </div>
      </div>
      
      <div style="margin-top: 24px; padding: 20px; background-color: #FBCF03; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-weight: 600; color: #000; font-size: 16px;">
          ⚠️ Action requise : Envoyer le lien de paiement de <strong>${amountAfterCommission.toFixed(2)} €</strong> à ${clientEmail} dans les 24 heures
        </p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #000;">
          (Prix total : ${safeTotalAmount.toFixed(2)} € - Commission plateforme 15% : ${commissionAmount.toFixed(2)} € = ${amountAfterCommission.toFixed(2)} €)
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
        url: 'https://guidemytable.fr/',
        variant: 'yellow',
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

  menuUpdated: (clientFirstName: string, chefName: string, loginUrl: string, baseUrl?: string) => {
    const safeFirstName = escapeHtml(clientFirstName)
    const safeChefName = escapeHtml(chefName)
    const content = `
      <p>Bonjour ${safeFirstName},</p>
      <p><strong>${safeChefName}</strong> vient de mettre à jour le menu de votre évènement sur MyTable.</p>
      <p>Connectez-vous à votre espace pour consulter la proposition et échanger avec votre chef si besoin.</p>
    `
    return emailLayout({
      title: 'Votre menu a été mis à jour',
      content,
      cta: {
        text: 'Consulter mon menu',
        url: loginUrl,
        variant: 'yellow',
      },
      baseUrl,
    })
  },

  clientChatInactivityReminder: (clientFirstName: string, loginUrl: string, baseUrl?: string) => {
    const content = `
      <p>Bonjour ${clientFirstName},</p>
      <p>Vous avez une conversation en attente sur MyTable.</p>
      <p>Reconnectez-vous pour suivre l'échange avec votre chef.</p>
    `
    return emailLayout({
      title: 'Votre conversation vous attend',
      content,
      cta: {
        text: 'Se connecter au chat',
        url: loginUrl,
        variant: 'yellow',
      },
      baseUrl,
    })
  },
}
