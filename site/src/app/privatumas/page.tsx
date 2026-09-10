import type { Metadata } from 'next';
import { S } from '@/lib/lt';

export const metadata: Metadata = {
  title: 'Privatumas · Yip',
  alternates: { canonical: '/privatumas' },
};

export default function Privatumas() {
  return (
    <main className="v2">
      <section className="wrap">
        <h1>Privatumo politika</h1>

        <p>
          Duomenų valdytojas — Yip, Vilnius. Kontaktas:{' '}
          <a href="mailto:hello@yip.lt">{S.footerContact}</a>.
        </p>

        <h2>Kokius duomenis renkame</h2>
        <p>
          El. paštą, tavo pasirinkimus (miestai, kelionės momentai), prenumeratos šaltinį ir UTM
          žymas, taip pat nuorodų paspaudimus laiškuose.
        </p>

        <h2>Kam naudojame</h2>
        <p>Radiniams siųsti el. paštu ir paslaugai tobulinti.</p>

        <h2>Duomenų tvarkytojai</h2>
        <p>Resend — el. laiškų siuntimui. Neon — duomenų saugojimui ES.</p>

        <h2>Saugojimo trukmė</h2>
        <p>Kol prenumerata aktyvi. Atsisakius — duomenys ištrinami per 30 dienų.</p>

        <h2>Tavo teisės</h2>
        <p>
          Gali peržiūrėti, ištaisyti ar ištrinti savo duomenis, taip pat atsisakyti prenumeratos
          bet kada per nuorodą laiške.
        </p>

        <p>Atnaujinta 2026-09-10.</p>
      </section>
    </main>
  );
}
