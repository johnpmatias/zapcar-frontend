const META_PIXEL_ID_REGEX = /^\d{5,20}$/
const GOOGLE_TAG_ID_REGEX = /^(G|GTM|AW|UA|DC)-[A-Z0-9-]{4,20}$/i

export function injetarMetaPixel(pixelId: string): () => void {
  if (!META_PIXEL_ID_REGEX.test(pixelId)) return () => {}

  const id = 'zapcar-meta-pixel'
  if (document.getElementById(id)) return () => {}

  const script = document.createElement('script')
  script.id = id
  script.innerHTML =
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?` +
    `n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;` +
    `n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;` +
    `t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,` +
    `document,'script','https://connect.facebook.net/en_US/fbevents.js');` +
    `fbq('init','${pixelId}');fbq('track','PageView');`

  document.head.appendChild(script)
  return () => script.remove()
}

export function injetarGoogleTag(tagId: string): () => void {
  if (!GOOGLE_TAG_ID_REGEX.test(tagId)) return () => {}

  const idLib = 'zapcar-google-tag-lib'
  const idConfig = 'zapcar-google-tag-config'
  if (document.getElementById(idConfig)) return () => {}

  const scriptLib = document.createElement('script')
  scriptLib.id = idLib
  scriptLib.async = true
  scriptLib.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`
  document.head.appendChild(scriptLib)

  const scriptConfig = document.createElement('script')
  scriptConfig.id = idConfig
  scriptConfig.innerHTML =
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
    `gtag('js',new Date());gtag('config','${tagId}');`
  document.head.appendChild(scriptConfig)

  return () => {
    scriptLib.remove()
    scriptConfig.remove()
  }
}
