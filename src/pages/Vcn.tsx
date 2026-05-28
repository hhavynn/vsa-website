import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';

const highlights = [
  { title: 'Dance Performances', desc: 'VCN typically features multiple dance performances, from traditional Vietnamese dance to contemporary choreography.' },
  { title: 'Narrative Stage Production', desc: 'A student-produced play or theatrical performance that explores Vietnamese identity, family, tradition, and the Vietnamese-American experience.' },
  { title: 'Cultural Storytelling', desc: 'VCN is built around personal, cultural, and generational stories told through performance, art, and community.' },
  { title: 'Student-Led Production', desc: 'Every element of VCN is planned, built, and executed by UCSD students on stage and behind the scenes.' },
];

const committees = [
  { title: 'Dance Teams', desc: 'Coordinate choreography, rehearsals, and performance prep for each dance in the show.' },
  { title: 'Acting / Theatre', desc: 'Perform in the narrative stage production and participate in rehearsals and creative development.' },
  { title: 'Props', desc: "Design and build the set and prop pieces that bring the production's world to life." },
  { title: 'Stage Management', desc: 'Coordinate backstage operations and ensure smooth execution on show day.' },
];

const faqs = [
  { q: 'What is VCN?', a: "Vietnamese Culture Night (VCN) is VSA at UCSD's large annual culture show. It celebrates Vietnamese culture through storytelling, dance, theatre, and performance, all built and performed by UCSD students." },
  { q: 'What can I expect at the show?', a: "A VCN show typically includes a narrative stage production alongside multiple dance performances. Each year's show brings a new theme, story, and lineup of performances. The specific format and content vary by year." },
  { q: 'Is the show free?', a: 'Admission details vary by year. Follow @vsaatucsd on Instagram or check the current year\'s VCN page for the latest ticketing information.' },
  { q: 'How can I get involved?', a: 'Students can participate on stage through dance or acting, or contribute behind the scenes through committees like props and stage management. Opportunities are announced each production cycle.' },
  { q: 'Do I need experience to audition or join a committee?', a: 'Requirements vary by role and year. Many committees welcome students with no prior experience who are willing to commit and learn. Auditions and committee applications are announced each cycle.' },
  { q: 'How do I find out about auditions and applications?', a: 'Follow @vsaatucsd on Instagram and watch for official VCN announcements each year. Applications and auditions typically open during the fall or early production cycle.' },
  { q: 'Can community members or non-VSA students attend?', a: 'Yes. VCN is open to the campus community and beyond. It is a celebration of Vietnamese culture that welcomes all guests.' },
];

export function VCN() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="Vietnamese Culture Night" />

      <div className="program-app">
        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">Program Booklet</span>
            <h1 className="program-title">
              Vietnamese Culture <span className="program-title-script">Night</span>
            </h1>
            <p className="program-hero-meta">
              VSA at UCSD’s annual culture show, built by students through acting, dance, and behind-the-scenes production.
            </p>
            <div className="program-hero-actions">
              <Link to="/vcn/current" className="vsa-btn-primary font-sans text-sm font-medium">
                This Year's Show →
              </Link>
              <Link to="/vcn/archive" className="vsa-btn-ghost font-sans text-sm">
                Past Productions
              </Link>
            </div>
          </div>
          <div className="program-watermark">vcn</div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">What is VCN?</div>
            <div className="program-two-grid items-start md:gap-10">
              <div>
                <p className="program-body">
                Vietnamese Culture Night (VCN) is VSA at UCSD's large annual culture show. Each year, students come together to celebrate Vietnamese culture through performance and storytelling while inviting the broader community in.
                </p>
                <p className="program-body">
                VCN is fully student-led: from the creative vision to the choreography, props, costumes, and show-day execution, every part of the production is built and performed by UCSD students.
                </p>
              </div>
              <blockquote className="program-rich-card font-serif italic leading-[1.2]" style={{ fontSize: 24, color: 'var(--color-text)' }}>
              "A celebration of Vietnamese culture, built by students for the community."
              </blockquote>
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">What to Expect</div>
            <div className="program-two-grid">
            {highlights.map((item) => (
              <div key={item.title} className="program-feature-card">
                <div className="program-card-title">{item.title}</div>
                <p className="program-card-copy">{item.desc}</p>
              </div>
            ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">Get Involved</div>
            <div className="program-list">
            {committees.map((c) => (
              <div key={c.title} className="program-list-row">
                <div className="program-list-title">{c.title}</div>
                <p className="program-list-copy">{c.desc}</p>
              </div>
            ))}
            </div>
            <p className="font-sans text-xs mt-3" style={{ color: 'var(--color-text3)' }}>
            Auditions and committee applications are announced each production cycle. Follow @vsaatucsd for updates.
            </p>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">FAQ</div>
            <div className="program-faq-card">
            {faqs.map((faq, i) => (
              <div key={i} className="program-faq-row">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="program-faq-button"
                >
                  <span className="program-faq-question">{faq.q}</span>
                  <span className={`program-faq-plus ${openFaq === i ? 'is-open' : ''}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="program-faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-footer-actions-rich">
              <Link to="/vcn/current" className="vsa-btn-primary font-sans text-sm font-medium">
                This Year's Show →
              </Link>
              <Link to="/vcn/archive" className="vsa-btn-ghost font-sans text-sm">
                Past Productions
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
