const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Who we are",
    body: (
      <p>
        SG Tutors (sgtutors.tertiaryinfotech.com) and the <strong>Tertiary SGTutors</strong>{" "}
        mobile app are operated by Tertiary Infotech Academy Pte. Ltd. (Singapore). This policy
        explains what personal data we collect through the website and the mobile app, how we
        use it, and the choices you have. We comply with the Singapore Personal Data Protection
        Act (PDPA).
      </p>
    ),
  },
  {
    title: "2. Data collected via the mobile app",
    body: (
      <>
        <p>
          The Tertiary SGTutors iOS app is a public directory for finding tutors. It requires{" "}
          <strong>no account and no login</strong>. The only personal data the app sends us is
          what you type into the enquiry form: your <strong>name, email address, Singapore
          mobile number and message</strong>. This is used solely to deliver your enquiry to the
          tutor you selected and to maintain an enquiry record for anti-abuse purposes.
        </p>
        <p>
          The app does not access your location, contacts, photos, camera or microphone, does
          not use analytics SDKs or advertising trackers, and does not track you across other
          apps or websites.
        </p>
      </>
    ),
  },
  {
    title: "3. Data collected via the website",
    body: (
      <>
        <p>
          <strong>Visitors and parents:</strong> the same enquiry details as the mobile app
          (name, email, mobile number, message), plus review submissions (name shown with your
          review). We keep a one-way hash of your IP address for rate limiting and abuse
          prevention.
        </p>
        <p>
          <strong>Tutors who register:</strong> identity and verification data you provide
          (full name, NRIC/FIN, date of birth, contact details, address, qualifications,
          certificates, CV) and payment records processed by Stripe. Sensitive identity data is
          never displayed publicly — public profiles show only your display name, region,
          gender, race, nationality, subjects, levels, qualifications and profile text.
        </p>
      </>
    ),
  },
  {
    title: "4. How we use and share data",
    body: (
      <>
        <p>
          We use personal data only to operate the tutor marketplace: delivering enquiries to
          tutors, verifying tutor identities, processing payments, preventing abuse, and
          responding to support requests. Enquiry contact details are shared{" "}
          <strong>only with the tutor you contact</strong>.
        </p>
        <p>
          We do not sell personal data and do not share it with advertisers. Service providers
          we use (e.g. payment processing, file storage, email delivery) process data on our
          behalf under their own security obligations.
        </p>
      </>
    ),
  },
  {
    title: "5. Retention and deletion",
    body: (
      <p>
        Tutor verification documents (NRIC, certificates, CV) are automatically erased three
        months after verification is completed. Enquiry and review records are retained while
        the platform operates. You may request access to, correction of, or deletion of your
        personal data at any time by contacting us (Section 7), and we will respond within 30
        days.
      </p>
    ),
  },
  {
    title: "6. Security",
    body: (
      <p>
        All traffic is encrypted with HTTPS/TLS. Sensitive tutor identity data is stored
        server-side only and is never exposed through public APIs. Access to admin functions is
        restricted and authenticated.
      </p>
    ),
  },
  {
    title: "7. Contact",
    body: (
      <p>
        For any privacy question or request, contact Tertiary Infotech Academy Pte. Ltd. at{" "}
        <a className="text-brand-600 underline" href="mailto:angch@tertiaryinfotech.com">
          angch@tertiaryinfotech.com
        </a>{" "}
        or via{" "}
        <a className="text-brand-600 underline" href="https://www.tertiaryinfotech.com" target="_blank" rel="noreferrer">
          tertiaryinfotech.com
        </a>
        .
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">
        SG Tutors website &amp; Tertiary SGTutors mobile app · Last updated 3 July 2026
      </p>
      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-semibold text-gray-900">{s.title}</h2>
            <div className="mt-2 space-y-3 text-gray-700">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
