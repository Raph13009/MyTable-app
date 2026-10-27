import Script from 'next/script'
import { resolveGtmId } from '@/lib/analytics/gtm-config'

/** Same CookieYes site as guidemytable.fr (WordPress). */
const COOKIEYES_CLIENT_ID = '90ad29c0b213067aa7718032337ff77c'

/**
 * Loads the shared GTM container (same as guidemytable.fr WordPress).
 * Consent Mode defaults to denied, then updates from:
 * - CookieYes banner on this app (same site id as WP)
 * - wp_consent_* cookies when shared on `.guidemytable.fr`
 * - cookieyes-consent cookie (`analytics:yes`)
 */
export default function GoogleTagManager() {
  const gtmId = resolveGtmId()
  if (!gtmId) return null

  return (
    <>
      <Script
        id="gtm-consent-default"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_personalization: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'granted',
  wait_for_update: 500
});
(function(){
  function applyConsent(analyticsGranted, adsGranted) {
    gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_storage: adsGranted ? 'granted' : 'denied',
      ad_user_data: adsGranted ? 'granted' : 'denied',
      ad_personalization: adsGranted ? 'granted' : 'denied'
    });
  }
  function readCookie(name) {
    var m = (document.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function syncFromCookies() {
    try {
      var cky = readCookie('cookieyes-consent');
      var ckyAnalytics = /(?:^|,)analytics:yes(?:,|$)/.test(cky);
      var ckyAds = /(?:^|,)advertisement:yes(?:,|$)/.test(cky);
      var wpStats = readCookie('wp_consent_statistics') === 'allow';
      var wpMkt = readCookie('wp_consent_marketing') === 'allow';
      var analytics = ckyAnalytics || wpStats;
      var ads = ckyAds || wpMkt || analytics;
      if (analytics || ads) applyConsent(analytics, ads);
    } catch (e) {}
  }
  syncFromCookies();
  document.addEventListener('cookieyes_consent_update', function () {
    syncFromCookies();
  });
  // CookieYes may set cookies slightly after load
  setTimeout(syncFromCookies, 600);
  setTimeout(syncFromCookies, 2000);
})();
          `.trim(),
        }}
      />
      <Script
        id="cookieyes"
        src={`https://cdn-cookieyes.com/client_data/${COOKIEYES_CLIENT_ID}/script.js`}
        strategy="beforeInteractive"
      />
      <Script
        id="gtm-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');
          `.trim(),
        }}
      />
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  )
}
