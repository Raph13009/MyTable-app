import Script from 'next/script'
import { resolveGtmId } from '@/lib/analytics/gtm-config'

/**
 * Loads the shared GTM container (same as guidemytable.fr WordPress).
 * Consent Mode defaults match Site Kit on the marketing site (denied until updated).
 * Analytics is granted when wp_consent_* cookies are shared from guidemytable.fr.
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
  try {
    var c = document.cookie || '';
    function allowed(name) {
      var m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m && decodeURIComponent(m[1]) === 'allow';
    }
    var analytics = allowed('wp_consent_statistics') ? 'granted' : 'denied';
    var ads = (allowed('wp_consent_marketing') || allowed('wp_consent_statistics')) ? 'granted' : 'denied';
    if (analytics === 'granted' || ads === 'granted') {
      gtag('consent', 'update', {
        analytics_storage: analytics,
        ad_storage: ads,
        ad_user_data: ads,
        ad_personalization: ads
      });
    }
  } catch (e) {}
})();
          `.trim(),
        }}
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
