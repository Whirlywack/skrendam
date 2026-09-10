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
          El. paštą; tavo pasirinkimus (iš kur skrendi, kelionių momentai); prenumeratos šaltinį
          ir UTM žymas (iš nuorodos, kuria atėjai — saugomos naršyklės sesijoje kaip{' '}
          <code>yip_attr</code>, kol užsiprenumeruoji); rekomendacijos kodą (<code>ref</code>), jei
          atėjai per draugo nuorodą; patvirtinimo slapuką <code>yip_pt</code> (tik prenumeratos
          patvirtinimui); IP adresą — tik piktnaudžiavimo apsaugai (užklausų ribojimui) ir tik
          techniniuose žurnaluose.
        </p>

        <h2>Teisinis pagrindas</h2>
        <p>
          Tavo sutikimas — užsiprenumeruodamas ir patvirtindamas el. paštą. Gali jį atšaukti bet
          kada.
        </p>

        <h2>Kam naudojame</h2>
        <p>Radiniams siųsti el. paštu ir paslaugai tobulinti.</p>

        <h2>Duomenų tvarkytojai</h2>
        <p>
          Resend (el. laiškų siuntimas), Neon (duomenų bazė, ES — Frankfurtas), Vercel (svetainės
          talpinimas).
        </p>

        <h2>Saugojimo trukmė</h2>
        <p>
          Kol prenumerata aktyvi. Atsisakius — duomenys ištrinami per 30 dienų. Techniniai
          žurnalai saugomi trumpalaikiai.
        </p>

        <h2>Tavo teisės</h2>
        <p>
          Gali peržiūrėti, ištaisyti, ištrinti savo duomenis ar apriboti jų tvarkymą, taip pat
          atsisakyti prenumeratos bet kada per nuorodą laiške arba parašęs mums. Taip pat turi
          teisę pateikti skundą Valstybinei duomenų apsaugos inspekcijai (VDAI, vdai.lrv.lt).
        </p>

        <p>Atnaujinta 2026-09-10.</p>
      </section>
    </main>
  );
}
