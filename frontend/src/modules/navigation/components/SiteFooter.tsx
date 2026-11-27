/** Общий футер на всех страницах. Ссылки и подписи — из анкеты СПбГУ. */
const socialLinks = [
  { label: 'MAX', href: 'https://max.ru/spbuniversity1724?from=fsite' },
  { label: 'ВКонтакте', href: 'https://vk.com/spb1724' },
  { label: 'Rutube', href: 'https://rutube.ru/channel/24725063/' },
  { label: 'Дзен', href: 'https://dzen.ru/spbu' },
] as const;

const consentLinks = [
  {
    label: 'Согласие на обработку персональных данных',
    href: 'https://anketa.spbu.ru/soglasie-na-obrabotku-personalnykh-dannykh',
  },
  {
    label: 'Согласие на обработку персональных данных, собираемых посредством метрических программ',
    href: 'https://anketa.spbu.ru/soglasie-na-obrabotku-personalnyh-dannyh-metricheskih-programm',
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="ryFooter" aria-label="Информация Санкт-Петербургского государственного университета">
      <div className="ryFooterInner">
        <div className="ryFooterTop">
          <div className="ryFooterUniversity">
            <p>Санкт-Петербургский государственный университет © {new Date().getFullYear()}</p>
            <a
              href="https://spbu.ru/openuniversity/documents/politika-spbgu-v-otnoshenii-obrabotki-personalnyh-dannyh"
              target="_blank"
              rel="noopener noreferrer"
            >
              Политика СПбГУ в отношении обработки персональных данных
            </a>
          </div>
          <nav className="ryFooterSocial" aria-label="СПбГУ в социальных сетях">
            {socialLinks.map(({ label, href }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
            ))}
          </nav>
          <a className="ryFooterTopLink" href="#">Наверх</a>
        </div>
        <div className="ryFooterConsents">
          {consentLinks.map(({ label, href }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
