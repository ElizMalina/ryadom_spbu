import {
  crisis812Phone,
  restIntro,
  restSections,
  roundTheClock,
  selfHelp,
  spbuTrustPhone,
  yuventaAppointment,
} from '../content';

export function CrisisScreen() {
  return (
    <div className="crisisScreen">
      <header className="crisisIntro">
        <p className="crisisKicker">Помощь в трудной ситуации</p>
        <h1>Кризисная поддержка</h1>
        <p>Если есть непосредственная угроза жизни или здоровью, позвоните <a href="tel:112">112</a>.</p>
      </header>

      <section className="crisisPanel crisisUrgent" aria-labelledby="crisis-urgent-title">
        <h2 id="crisis-urgent-title">Круглосуточная поддержка</h2>
        <p className="crisisCaption">Экстренные телефоны в Санкт-Петербурге</p>
        <ul className="crisisPhoneList">
          {roundTheClock.map((contact) => (
            <li key={contact.title}>
              <h3>{contact.title}</h3>
              <div className="crisisPhoneNumbers">
                {contact.phones.map((phone) => (
                  <a key={phone.href} href={phone.href}>{phone.text}</a>
                ))}
              </div>
              <p>{contact.description}</p>
              {contact.title.includes('«ЮВЕНТА»') && (
                <p>Очная консультация: <a href={yuventaAppointment.href}>{yuventaAppointment.text}</a>.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="crisisPanel" aria-labelledby="crisis-spbu-title">
        <h2 id="crisis-spbu-title">Телефон доверия Психологической клиники СПбГУ</h2>
        <a className="crisisFeaturedPhone" href={spbuTrustPhone.href}>{spbuTrustPhone.text}</a>
        <p><strong>По будням с 14:00 до 22:00 (мск).</strong> Бесплатный звонок из любой точки России.</p>
        <p>Можно обратиться с вопросами о тревоге, стрессе, сложной жизненной ситуации, учёбе или отношениях.</p>
      </section>

      <section className="crisisPanel" aria-labelledby="crisis-812-title">
        <h2 id="crisis-812-title">Кризисный центр «812»</h2>
        <a className="crisisFeaturedPhone" href={crisis812Phone.href}>{crisis812Phone.text}</a>
        <p><strong>С 18:00 до 02:00 (мск).</strong> Бесплатные консультации. Не круглосуточно.</p>
      </section>

      <div className="crisisMore" aria-label="Дополнительная поддержка и материалы">
        <details className="crisisDisclosure">
          <summary>Записаться на консультацию в СПбГУ</summary>
          <div className="crisisDisclosureBody">
            <p>Консультации Психологической клиники СПбГУ для обучающихся и сотрудников:</p>
            <ul>
              <li><a href="https://anketa.spbu.ru/psikhologicheskaya-klinika-konsultatsiya-peterhof" target="_blank" rel="noopener noreferrer">Запись в Петергофе</a></li>
              <li><a href="https://anketa.spbu.ru/psikhologicheskaya-klinika-konsultatsiya" target="_blank" rel="noopener noreferrer">Запись на Васильевском острове</a></li>
            </ul>
          </div>
        </details>

        <details className="crisisDisclosure">
          <summary>«Мне только спросить» — консультация без записи</summary>
          <div className="crisisDisclosureBody">
            <p>Сокращённая консультация для обучающихся и сотрудников СПбГУ, если нужна встреча в кризисной ситуации или хочется понять, подходит ли формат пяти консультаций.</p>
            <p><strong>Продолжительность — 20 минут.</strong> Это разовая консультация, не полноценная сессия и не формат регулярных встреч.</p>
            <ul>
              <li><strong>Петергоф:</strong> понедельник, 16:00–17:30. Ботаническая ул., д. 68 (ДКиН), каб. 101.</li>
              <li><strong>Васильевский остров:</strong> вторник, 10:30–11:40. Менделеевская линия, д. 5, здание Института истории и Института философии СПбГУ; отдельный вход со двора, табличка «Психологический центр».</li>
            </ul>
          </div>
        </details>

        <details className="crisisDisclosure">
          <summary>Первая психологическая самопомощь при остром стрессе</summary>
          <div className="crisisDisclosureBody">
            <p>Рекомендации при апатии, двигательном возбуждении, гневе, нервной дрожи, слезах и истерике.</p>
            {selfHelp.map((group) => (
              <section className="crisisAdvice" key={group.title}>
                <h3>{group.title}</h3>
                {group.intro.map((text) => <p key={text}>{text}</p>)}
                <ul>{group.steps.map((step) => <li key={step}>{step}</li>)}</ul>
              </section>
            ))}
          </div>
        </details>

        <details className="crisisDisclosure">
          <summary>Как почувствовать себя по-настоящему отдохнувшим</summary>
          <div className="crisisDisclosureBody">
            <p>{restIntro}</p>
            {restSections.map((section) => (
              <section className="crisisAdvice" key={section.title}>
                <h3>{section.title}</h3>
                {section.text.map((text) => <p key={text}>{text}</p>)}
                {section.steps.length > 0 && <ul>{section.steps.map((step) => <li key={step}>{step}</li>)}</ul>}
              </section>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
