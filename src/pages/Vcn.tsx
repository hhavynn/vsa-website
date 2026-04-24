import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

const highlights = [
  { title: 'Dance Performances', desc: 'VCN typically features multiple dance performances spanning a range of styles — from traditional Vietnamese dance to contemporary choreography.' },
  { title: 'Narrative Stage Production', desc: 'A student-produced play or theatrical performance that explores themes of Vietnamese identity, family, tradition, and the Vietnamese-American experience.' },
  { title: 'Cultural Storytelling', desc: 'VCN is built around stories — personal, cultural, and generational — told through performance, art, and community.' },
  { title: 'Student-Led Production', desc: 'Every element of VCN is conceived, built, and executed by UCSD students — on stage and behind the scenes.' },
];

const committees = [
  { title: 'Dance Teams', desc: 'Coordinate choreography, rehearsals, and performance prep for each dance in the show.' },
  { title: 'Acting / Theatre', desc: 'Perform in the narrative stage production and participate in rehearsals and creative development.' },
  { title: 'Props', desc: "Design and build the set and prop pieces that bring the production's world to life." },
  { title: 'Stage Management', desc: 'Coordinate backstage operations and ensure smooth execution on show day.' },
];

const faqs = [
  { q: 'What is VCN?', a: "Vietnamese Culture Night (VCN) is UCSD VSA's large annual cultural production. It celebrates Vietnamese culture through storytelling, dance, theatre, and performance — all built and performed by UCSD students." },
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

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>Vietnamese Culture Night</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          Annual cultural production · UCSD VSA
        </p>
        <div className="flex gap-3 mt-4">
          <Link to="/vcn/current" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
            This Year's Show →
          </Link>
          <Link to="/vcn/archive" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            Past Productions
          </Link>
        </div>
      </div>

      <div style={{ padding: '40px 52px' }}>

        {/* What is VCN */}
        <div className="mb-10">
          <Label className="mb-4">What is VCN?</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
            <div>
              <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)' }}>
                Vietnamese Culture Night (VCN) is UCSD VSA's large annual cultural production. Each year, students come together to celebrate Vietnamese culture through performance and storytelling — creating an evening that honors tradition, explores identity, and invites the broader community in.
              </p>
              <p className="font-sans text-sm leading-[1.75] mt-3" style={{ color: 'var(--color-text2)' }}>
                VCN is fully student-led: from the creative vision to the choreography, props, costumes, and show-day execution, every part of the production is built and performed by UCSD students.
              </p>
            </div>
            <blockquote className="font-serif italic leading-[1.2] border-l-2 pl-6" style={{ fontSize: 22, color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
              "A celebration of Vietnamese culture — built by students, for the community."
            </blockquote>
          </div>
        </div>

        {/* What to Expect */}
        <div className="mb-10">
          <Label className="mb-4">What to Expect</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {highlights.map((item, i) => (
              <div key={item.title} className="border-t border-l" style={{ borderColor: 'var(--color-border)', padding: '16px 20px', ...(i % 2 === 0 ? {} : {}) }}>
                <div className="font-sans text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>{item.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />
        </div>

        {/* Get Involved */}
        <div className="mb-10">
          <Label className="mb-4">Get Involved</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {committees.map((c) => (
              <div key={c.title} className="flex items-start gap-6 border-b last:border-b-0" style={{ padding: '14px 20px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="font-sans text-sm font-semibold shrink-0" style={{ color: 'var(--color-text)', width: 160 }}>{c.title}</div>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="font-sans text-xs mt-3" style={{ color: 'var(--color-text3)' }}>
            Auditions and committee applications are announced each production cycle. Follow @vsaatucsd for updates.
          </p>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <Label className="mb-4">FAQ</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {faqs.map((faq, i) => (
              <div key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left"
                  style={{ padding: '14px 20px', background: 'var(--color-surface)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{faq.q}</span>
                  <span style={{ color: 'var(--color-text3)', transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block', fontSize: 18, marginLeft: 16, flexShrink: 0 }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="border-t" style={{ padding: '12px 20px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                    <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <Link to="/vcn/current" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
            This Year's Show →
          </Link>
          <Link to="/vcn/archive" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            Past Productions
          </Link>
        </div>

      </div>
    </>
  );
}
