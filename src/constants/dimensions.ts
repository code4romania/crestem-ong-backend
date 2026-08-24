export interface DimensionOption {
  value: number;
  label: string;
}

export interface DimensionQuestion {
  id: string;
  question: string;
  options: DimensionOption[];
  tag: string | null;
}

export interface Dimension {
  key: string;
  name: string;
  quiz: DimensionQuestion[];
  description: string;
  tips: string;
  action: string;
}

export const DIMENSIONS: readonly Dimension[] = [
  {
    key: "guvernanta",
    name: "Guvernanță",
    description:
      "Guvernanța se referă la acele procese și activități care asigură funcționarea eficientă și corectă a unei organizații, la nivel strategic.",
    tips: "Gândește-te la modul în care organizația ta ia decizii strategice, cum sunt definite rolurile de conducere și cât de transparent este procesul decizional.",
    action:
      "Analizează documentele de guvernanță existente și evaluează dacă acestea reflectă realitatea organizației.",
    quiz: [
      {
        id: "guvernanta_q1",
        question: "În ce măsură viziunea și misiunea organizației sunt clare?",
        options: [
          {
            value: 1,
            label: "Nu există viziune și misiune scrise.",
          },
          {
            value: 2,
            label:
              "Există viziune și misiune scrise, însă organizația nu le urmărește în practică. Viziunea și misiunea sunt prea vaste/ includ prea multe aspecte.",
          },
          {
            value: 3,
            label:
              "Există viziune și misiune scrise și  acestea sunt urmărite în practică. Lipsește înțelegerea comună a oamenilor din organizație asupra „sensului de a exista” (raison d'être) al acesteia.",
          },
          {
            value: 4,
            label:
              "Viziunea și misiunea sunt clar exprimate și de cele mai multe ori (dar nu întotdeauna) sunt avute în vedere în direcționarea acțiunilor și stabilirea priorităților. ",
          },
          {
            value: 5,
            label:
              "Viziunea și misiunea sunt clar (de)scrise, revizuite/ evaluate/ promovate și urmărite în toate activitățile organizației. ",
          },
        ],
        tag: "Viziune și misiune",
      },
      {
        id: "guvernanta_q2",
        question:
          "În ce măsură este implementat un plan strategic în cadrul organizației? ",
        options: [
          {
            value: 1,
            label: "Nu există plan strategic.",
          },
          {
            value: 2,
            label:
              "Nu există un plan strategic scris, însă există o serie de linii directoare generale. ",
          },
          {
            value: 3,
            label:
              "Există un plan strategic scris, însă nu este operaționalizat/ implementat în totalitate. ",
          },
          {
            value: 4,
            label:
              "Există un plan strategic scris și implementat, dar nu este urmat în toate aspectele și evaluat.",
          },
          {
            value: 5,
            label:
              "Organizația are un plan strategic care este implementat în totalitate, revizuit și monitorizat regulat, evaluat. ",
          },
        ],
        tag: "Plan strategic",
      },
      {
        id: "guvernanta_q3",
        question:
          "Care este rolul structurii de guvernanță a organizației? (ex. Board/ Consiliul director, Adunarea generală) ",
        options: [
          {
            value: 1,
            label:
              "Organizația nu are o structură de guvernanță bine definită. ",
          },
          {
            value: 2,
            label: "Structura de guvernanță există doar formal/ pe hârtie. ",
          },
          {
            value: 3,
            label:
              "Structura de guvernanță are o înțelegere limitată asupra rolului său. De obicei doar adoptă formal deciziile luate de lider(i) ai organizației. ",
          },
          {
            value: 4,
            label:
              "Structura de guvernanță își înțelege într-o măsură relativ mare rolul. Nu întotdeauna este consultată pentru deciziile strategice ale organizației. ",
          },
          {
            value: 5,
            label:
              "Structura de guvernanță își înțelege în totalitate rolul și responsabilitățile. Ia decizii strategice pentru organizație și își îndeplinește cu succes atribuțiile.\n",
          },
        ],
        tag: "Structură guvernanță",
      },
      {
        id: "guvernanta_q4",
        question:
          "Componența structurii de guvernanță este bazată pe criterii clare ce reflectă o experiență diversă? ",
        options: [
          {
            value: 1,
            label:
              "Nu există niciun criteriu pentru componența structurii de guvernanță.",
          },
          {
            value: 2,
            label:
              "O serie de criterii sunt stabilite formal. Totuși acestea nu sunt respectate în componența actuală a structurii de guvernanță.",
          },
          {
            value: 3,
            label:
              "Există criterii pentru structura de guvernanță însă toate persoanele implicate au aproximativ aceleași abilități și cunoștințe.",
          },
          {
            value: 4,
            label:
              "Există criterii pentru structura de guvernanță însă toate persoanele implicate au aproximativ aceleași abilități și cunoștințe.",
          },
          {
            value: 5,
            label:
              "Există și sunt respectate criteriile pentru structura de guvernanță, iar persoanele implicate au diverse abilități și cunoștințe și provin din medii variate, necesare pentru dezvoltarea organizației.",
          },
        ],
        tag: "Abilități diverse",
      },
      {
        id: "guvernanta_q5",
        question: "Are organizația politici cu referire la etică/ valori? ",
        options: [
          {
            value: 1,
            label:
              "Nu există politici cu referire la etică/ valori nici la nivel formal nici la nivel informal.",
          },
          {
            value: 2,
            label:
              "Există câteva instrucțiuni privind principii etice sau  respectarea unor valori, însă nu există documente scrise în acest sens/ sunt prea vagi/ neclare.",
          },
          {
            value: 3,
            label:
              "Există documente în care se regăsesc și instrucțiuni privind etica/ valorile. Totuși acestea nu sunt urmate în practică (există doar pe hârtie), iar oamenii nu sunt informații și instruiți cu referire la acestea.",
          },
          {
            value: 4,
            label:
              "Există politici dedicate privind etica/ valorile, dar nu sunt implementate în totalitate.  Doar un număr mic de oameni din organizație sunt informați, instruiți și conștienți de existența lor. ",
          },
          {
            value: 5,
            label:
              "Există politici clare privind etica/ valorile ce ghidează activitățile zilnice ale organizației. Oamenii le conștientizează și le folosesc drept instrumente în luarea deciziilor și implementarea tuturor activităților.",
          },
        ],
        tag: "Politici de etică",
      },
    ],
  },
  {
    key: "aspecte_financiare",
    name: "Aspecte financiare",
    description:
      "Aspectele financiare vizează soliditatea financiară a organizației, diversificarea surselor de venit, transparența financiară și conformitatea cu obligațiile fiscale.",
    tips: "Gândește-te la capacitatea organizației de a-și susține activitățile pe termen lung și la gradul de diversificare a finanțării.",
    action:
      "Revizuiește bugetele și rapoartele financiare din ultimii 2 ani și identifică tendințele principale.",
    quiz: [
      {
        id: "aspecte_financiare_q1",
        question:
          "Își cunoaște organizația obligațiile prevăzute de lege (la nivel național)?",
        options: [
          {
            value: 1,
            label: "Organizația nu cunoaște obligațiile prevăzute de lege.\n",
          },
          {
            value: 2,
            label:
              "Organizația cunoaște principalele obligații prevăzute de lege. Are o persoană cu atribuții contabile care nu se implică în ansamblul managementului organizației.",
          },
          {
            value: 3,
            label:
              "Organizația cunoaște principalele obligații prevăzute de lege și are încredere în persoana cu atribuții contabile din organizație.\n",
          },
          {
            value: 4,
            label:
              "Organizația are o bună înțelegere a practicilor contabile generale și a prevederilor legislative pentru activitățile sale curente, persoana cu atribuții contabile fiind parte din organizație. ",
          },
          {
            value: 5,
            label:
              "Organizația înțelege foarte bine prevederile legislative și practicile contabile. În diferite situații se asigură că activitățile sale sunt conforme cu legislația în vigoare iar persoana cu atribuții contabile participă regulat la formări și se informează cu privire la modificări legislative.\n",
          },
        ],
        tag: "Legislație",
      },
      {
        id: "aspecte_financiare_q2",
        question: "Are organizația o bună gestiune financiară?",
        options: [
          {
            value: 1,
            label:
              "Fiecare persoană este responsabilă de propriile proiecte / activități, fără coordonare și fără practici/ proceduri comune.",
          },
          {
            value: 2,
            label:
              "Fiecare persoană este responsabilă de propriile proiecte/ activități. Există o oarecare coordonare între proiecte, însă nu există practici/ proceduri comune.",
          },
          {
            value: 3,
            label:
              "Fiecare persoană este responsabilă de propriile proiecte/ activități, cu o coordonare clară și câteva practici/ proceduri comune în cadrul organizației.",
          },
          {
            value: 4,
            label:
              "Managementul financiar al organizației este supervizat de o persoană care aplică proceduri/ practici comune și care nu este persoana cu atribuții contabile. Nu există practici/ proceduri coerente de monitorizare",
          },
          {
            value: 5,
            label:
              "Există cel puțin o persoană dedicată (nu persoana cu atribuții contabile ci o persoană cu atribuții de management financiar) care urmărește veniturile/ cheltuielile organizației, monitorizează fluxul de numerar/ cashflow și se asigură că banii sunt cheltuiți eficient. \n",
          },
        ],
        tag: "Management financiar",
      },
      {
        id: "aspecte_financiare_q3",
        question: "Urmărește organizația o planificare financiară coerentă?",
        options: [
          {
            value: 1,
            label: "Nu există o planificare financiară",
          },
          {
            value: 2,
            label:
              "Există o planificare financiară bazată doar pe situația anului precedent",
          },
          {
            value: 3,
            label:
              "Planificarea financiară este asigurată coerent pentru anul în curs.",
          },
          {
            value: 4,
            label:
              "Planificarea financiară este asigurată pentru cel puțin 2 ani înainte.",
          },
          {
            value: 5,
            label:
              "Organizația are un plan financiar coerent ce include proiecția fluxului de numerar/ cashflow pentru mai mult de 2 ani.",
          },
        ],
        tag: "Planificare financiară",
      },
      {
        id: "aspecte_financiare_q4",
        question:
          "În ce măsură organizația are capacitatea să asigure surse sustenabile/ de lungă durată de venit?",
        options: [
          {
            value: 1,
            label:
              "Nu există capacitate de asigurare a unor surse sustenabile/ de lungă durată de venit.",
          },
          {
            value: 2,
            label:
              "Capacitate limitată de asigurare a unui venit sustenabil/ de lungă durată. Veniturile se  bazează în special pe scriere de proiecte. Nicio persoană nu este implicată dedicat în această activitate.  ",
          },
          {
            value: 3,
            label:
              "Capacitate parțială de a asigura venit sustenabil/ de lungă durată. Există cel puțin o persoană implicată în acest demers, dar majoritatea eforturilor se concentrează pe scrierea de proiecte.",
          },
          {
            value: 4,
            label:
              "Capacitate clară de a asigura un venit sustenabil/ de lungă durată. Minim 40% din totalul veniturilor provin din alte surse decât scrierea de proiecte. Totuși, acest lucru nu este integrat la nivel strategic/ nu se realizează continuu.",
          },
          {
            value: 5,
            label:
              "Organizația are capacitate strategică de a asigura un venit sustenabil/ de lungă durată pentru diverse proiecte/ programe/ activități, utilizând metode variate (de la scriere de proiecte la donații, sponsorizări, etc.) care au procentaj echilibrat în totalul veniturilor.",
          },
        ],
        tag: "Venituri sustenabile",
      },
      {
        id: "aspecte_financiare_q5",
        question: "Are organizația în vedere diversificarea fondurilor?",
        options: [
          {
            value: 1,
            label:
              "Organizația este dependentă de o singură sursă de venit și nu este în căutare de altele.",
          },
          {
            value: 2,
            label:
              "Organizația are surse de venit diferite, însă una din ele predomină în mod semnificativ (peste 80% din venituri provin din acea sursă).",
          },
          {
            value: 3,
            label:
              "Organizația are 2-3 surse diferite de venit, dar toate provin din aceeași zonă (de ex. apeluri pentru cereri de finanțare din sfera publică). Doar unul sau doi donatori încă predomină.",
          },
          {
            value: 4,
            label:
              "Organizația are 3-5 surse diferite de venit ale căror procentaje sunt împărțite echilibrat.",
          },
          {
            value: 5,
            label:
              "Organizația are peste 5 surse diferite de venit și niciuna dintre acestea nu depășește 20% din totalul bugetului organizației. Resursele financiare sunt de proveniență diferită (public/ privat, național/ la nivelul Uniunii Europene, donatori individuali/ donații etc).",
          },
        ],
        tag: "Diversificare fonduri",
      },
    ],
  },
  {
    key: "managementul_informatiei",
    name: "Managementul informației",
    description:
      "Managementul informației vizează modul în care organizația colectează, stochează, procesează și utilizează informațiile pentru a lua decizii eficiente.",
    tips: "Gândește-te la sistemele de stocare a datelor, la accesibilitatea informațiilor pentru echipă și la protecția datelor.",
    action:
      "Identifică principalele fluxuri de informații din organizație și evaluează cât de eficient funcționează acestea.",
    quiz: [
      {
        id: "managementul_informatiei_q1",
        question: "Are organizația o memorie instituțională solidă?",
        options: [
          {
            value: 1,
            label:
              "Nu există înregistrări ale activităților anterioare ale organizației.",
          },
          {
            value: 2,
            label:
              "Există informații limitate asupra activităților anterioare, fără a fi arhivate. Doar o singură persoană cunoaște istoricul organizației. ",
          },
          {
            value: 3,
            label:
              "Există informații parțiale despre proiecte/ programe anterioare. Informația este prezentă în principal sub formă de descrieri succinte ale proiectelor implementate.",
          },
          {
            value: 4,
            label:
              "Există o evidență clară a proiectelor/ programelor anterioare, inclusiv a informațiilor financiare. Nu există însă informație asupra impactului/ rezultatelor.",
          },
          {
            value: 5,
            label:
              "Organizația menține o evidență clară a tuturor proiectelor/ programelor anterioare, a informațiilor financiare pentru fiecare dintre acestea cât și rapoarte de rezultate/ analize de impact.",
          },
        ],
        tag: "Memorie instituțională",
      },
      {
        id: "managementul_informatiei_q2",
        question: "Are organizația un sistem de date intern funcțional?",
        options: [
          {
            value: 1,
            label: "Nu există un sistem de date.",
          },
          {
            value: 2,
            label:
              "Câteva informații referitoare la organizație sunt colectate în format offline sau online. Nu există o modalitate coerentă de colectare a informației. ",
          },
          {
            value: 3,
            label:
              "Există un sistem de date intern (ex. server/ drive), totuși nu există o procedură coerentă prin care informația este colectată/ nu există instrucțiuni de utilizare a acestuia.",
          },
          {
            value: 4,
            label:
              "Există un sistem de date intern, iar informația este structurată. Nu este utilizat în totalitate de oamenii din organizație. Nu există instrucțiuni de utilizare a acestuia.",
          },
          {
            value: 5,
            label:
              "Organizația are un sistem structurat și funcțional de date (ex. al persoanelor beneficiare, angajate, voluntare, experte, etc.) ce include informații importante/ relevante. Există instrucțiuni clare de utilizare a acestuia.",
          },
        ],
        tag: "Sistem de date intern",
      },
      {
        id: "managementul_informatiei_q3",
        question: "Se bazează organizația pe un sistem de management specific?",
        options: [
          {
            value: 1,
            label: "Nu este implementat un sistem de management.",
          },
          {
            value: 2,
            label:
              "Există o practică minimă de lucru cu documente de management, în mare parte dosare fizice/ drive, dar aceasta nu este coerentă.",
          },
          {
            value: 3,
            label:
              "Există câteva practici de lucru, în mare parte online, dar nu și offline (nu sunt arhivate documente în format fizic).",
          },
          {
            value: 4,
            label:
              "Există practici/ proceduri clare de lucru cu documentele, online și offline, dar nu toate persoanele din organizație îl folosesc unitar.",
          },
          {
            value: 5,
            label:
              "Organizația folosește un sistem/ sisteme funcționale de management (ex. sisteme online de management al proiectului), este definită clar modalitatea păstrării documentelor și toată lumea le folosește unitar.",
          },
        ],
        tag: "Sistem de management",
      },
      {
        id: "managementul_informatiei_q4",
        question: "Învață organizația din experiențele anterioare?",
        options: [
          {
            value: 1,
            label:
              "Organizația nu colectează nicio informație pentru a învăța din experiențe anterioare.",
          },
          {
            value: 2,
            label:
              "Organizația are o practică limitată în a folosi lecțiile învățate, iar aceasta nu este folosită de toți oamenii din organizație.",
          },
          {
            value: 3,
            label:
              "Există o oarecare practică în a folosi experiențele anterioare, doar pentru aspecte tehnice (ex. scriere de proiecte).",
          },
          {
            value: 4,
            label:
              "Experiențele anterioare și lecțiile învățate sunt folosite pentru a planifica activitățile viitoare. Aceste informații nu sunt însă împărtășite cu toată lumea. ",
          },
          {
            value: 5,
            label:
              "Experiențele anterioare și lecțiile învățate sunt colectate eficient și folosite pentru a planifica activități viitoare, iar informațiile sunt împărtășite între toți oamenii din organizație.",
          },
        ],
        tag: "Lecții învățate",
      },
      {
        id: "managementul_informatiei_q5",
        question:
          "În ce măsură organizația publică un raport anual cuprinzător?",
        options: [
          {
            value: 1,
            label: "Organizația nu are un raport anual.",
          },
          {
            value: 2,
            label:
              "Sunt publicate câteva informații (articole/ social media) despre activitatea organizației, însă nu în cadrul unui raport anual.\n",
          },
          {
            value: 3,
            label:
              "Există un raport anual fără o structură clară, care nu este publicat/ disponibil publicului larg.",
          },
          {
            value: 4,
            label:
              "Un raport anual coerent și informativ este publicat pe site-ul organizației. Raportul nu este trimis către oamenii din organizație și/ sau donatori.",
          },
          {
            value: 5,
            label:
              "Raportul anual este considerat un instrument important de comunicare. Acesta este redactat într-o manieră coerentă, ținând cont de diverși actori interesați și trimis special către aceștia.",
          },
        ],
        tag: "Raport anual",
      },
    ],
  },
  {
    key: "monitorizare_si_evaluare",
    name: "Monitorizare și evaluare",
    description:
      "Monitorizarea și evaluarea reprezintă capacitatea organizației de a urmări sistematic progresul activităților și de a măsura impactul intervențiilor sale.",
    tips: "Gândește-te la indicatorii pe care îi folosiți pentru a măsura succesul programelor și la frecvența cu care evaluați rezultatele.",
    action:
      "Verifică dacă există un plan de monitorizare și evaluare pentru fiecare proiect/program major al organizației.",
    quiz: [
      {
        id: "monitorizare_si_evaluare_q1",
        question:
          "Există în organizație o practică continuă de monitorizare și evaluare?",
        options: [
          {
            value: 1,
            label:
              "Nu există o practică clară de monitorizare și evaluare la nivel de organizație",
          },
          {
            value: 2,
            label:
              "Monitorizarea și evaluarea sunt realizate doar atunci când sunt solicitate/ impuse de donator(i).",
          },
          {
            value: 3,
            label:
              "Există câteva activități standard în organizație care sunt monitorizate și evaluate, dar doar la nivel de rezultate cantitative. Alte măsurători nu sunt luate în considerare.",
          },
          {
            value: 4,
            label:
              "Există practici clare de monitorizare și evaluare realizate doar pentru activități specifice ale organizației (ex. formări, ateliere, etc.). Nu există practici de măsurare a impactului.",
          },
          {
            value: 5,
            label:
              "Monitorizarea și evaluarea sunt parte din cultura organizațională, sunt incluse pentru toate activitățile organizației și sunt actualizate/ revizuite în mod regulat. Monitorizarea și evaluarea includ și măsurarea impactului.",
          },
        ],
        tag: "Strategie M&E",
      },
      {
        id: "monitorizare_si_evaluare_q2",
        question:
          "În ce măsură organizația monitorizează și evaluează obiectivele și rezultatele activităților sale?",
        options: [
          {
            value: 1,
            label:
              "Nu se realizează monitorizare sau evaluare a activităților.",
          },
          {
            value: 2,
            label:
              "Există câteva practici în  organizație în ceea ce privește monitorizarea și evaluarea activităților. Cu toate acestea, nu sunt urmărite aspecte specifice.",
          },
          {
            value: 3,
            label:
              "Există câteva practici în organizație care monitorizează și evaluează în principal activitățile din punct de vedere administrativ. ",
          },
          {
            value: 4,
            label:
              "Chiar dacă organizația monitorizează și evaluează obiectivele activităților, o face doar dacă sunt cerințe de la donator(i) și nu pune accent pe rezultate.",
          },
          {
            value: 5,
            label:
              "Organizația monitorizează și evaluează obiectivele și rezultatele activităților, indiferent de cerințele donatorilor. ",
          },
        ],
        tag: "Practici M&E",
      },
      {
        id: "monitorizare_si_evaluare_q3",
        question:
          "În ce măsură organizația folosește indicatori pentru monitorizare și evaluare?",
        options: [
          {
            value: 1,
            label:
              "Nu se realizează monitorizare și evaluare în cadrul organizației.",
          },
          {
            value: 2,
            label:
              "Există câteva practici de colectare a informațiilor pentru monitorizare și evaluare. Cu toate acestea, nu există un set concret de indicatori.",
          },
          {
            value: 3,
            label:
              "Există câteva practici de colectare a informațiilor pentru monitorizare și evaluare. Cu toate acestea, nu există un set concret de indicatori.",
          },
          {
            value: 4,
            label:
              "Organizația folosește indicatori simpli cantitativi și calitativi și își evaluează periodic progresul.",
          },
          {
            value: 5,
            label:
              "Monitorizarea și evaluarea sunt realizate în mod regulat. Sunt stabilite obiective ce sunt monitorizate și actualizate constant, utilizând indicatori cantitativi și calitativi clari la nivel de organizație, dincolo de proiecte specifice.",
          },
        ],
        tag: "Practici M&E",
      },
      {
        id: "monitorizare_si_evaluare_q4",
        question: "Reflectă și învață organizația din activitatea sa?",
        options: [
          {
            value: 1,
            label: "Nu există un proces de reflecție sau învățare.",
          },
          {
            value: 2,
            label:
              "Practici limitate privind privind reflecția asupra activităților. Nu sunt evidențiate rezultatele în urma procesului de învățare.",
          },
          {
            value: 3,
            label:
              "Câteva practici de reflecție și învățare din majoritatea activităților, în principal în mod informal, nestructurat sau nedocumentat.",
          },
          {
            value: 4,
            label:
              "Practici clare de reflecție și învățare într-un mod participativ, luând în considerare și feedback-ul din partea beneficiarilor/ actorilor interesați.",
          },
          {
            value: 5,
            label:
              "Organizația are un proces continuu de reflecție asupra învățării sale (prin analiză de nevoi, cartografiere a actorilor interesați, colectare de feedback, activități de documentare și debriefing, etc.).",
          },
        ],
        tag: "Învățare M&E",
      },
      {
        id: "monitorizare_si_evaluare_q5",
        question:
          "În ce măsură folosește organizația rezultatele învățării pentru a crește?",
        options: [
          {
            value: 1,
            label: "Nu se folosesc rezultatele învățării.",
          },
          {
            value: 2,
            label:
              "Practici limitate în implementarea rezultatelor învățării, în mare parte realizată informal.",
          },
          {
            value: 3,
            label:
              "Câteva practici de utilizare a rezultatelor învățării, doar pentru activitățile și proiectele implementate.",
          },
          {
            value: 4,
            label:
              "Implementare clară și documentată a rezultatelor învățării pentru toate proiectele și programele.",
          },
          {
            value: 5,
            label:
              "Organizația folosește rezultatele învățării pentru creșterea sa și integrează toate rezultatele în activitatea generală a organizației și în proiectele/ programele specifice.",
          },
        ],
        tag: "Creștere M&E",
      },
    ],
  },
  {
    key: "structura_organizationala",
    name: "Structură organizațională",
    description:
      "Structura organizațională se referă la claritatea rolurilor, a proceselor interne și a modului în care sunt luate deciziile la nivelul echipei.",
    tips: "Gândește-te la organigramă, la fișele de post și la cât de clar sunt definite responsabilitățile fiecărui membru al echipei.",
    action:
      "Analizează dacă structura actuală sprijină sau îngreunează atingerea obiectivelor organizației.",
    quiz: [
      {
        id: "structura_organizationala_q1",
        question:
          "În ce măsură este definită și funcțională structura organizațională?",
        options: [
          {
            value: 1,
            label: "Nu există o structură clară în cadrul organizației.",
          },
          {
            value: 2,
            label:
              "Nu există o structură formal definită, chiar dacă direcții informale de interacțiune sunt înțelese de oamenii din organizație.",
          },
          {
            value: 3,
            label:
              "O structură formală există în organizație. Cu toate acestea, structura nu este respectată în totalitate.",
          },
          {
            value: 4,
            label:
              "Structura organizațională este definită. Cu toate acestea unele direcții de interacțiune nu sunt clare/ se suprapun.",
          },
          {
            value: 5,
            label:
              "Organizația are o structură bine definită, clară și interacțiuni ce funcționează în practică. Oamenii din organizație înțeleg interdependența rolurilor.",
          },
        ],
        tag: "Structură funcțională",
      },
      {
        id: "structura_organizationala_q2",
        question:
          "În ce măsură înțeleg oamenii din organizație, rolul și responsabilitățile lor?",
        options: [
          {
            value: 1,
            label: "Nu sunt definite roluri sau responsabilități.",
          },
          {
            value: 2,
            label:
              "Nu sunt definite roluri sau responsabilități în mod formal, dar informal este stabilită diviziunea muncii.",
          },
          {
            value: 3,
            label:
              "Rolurile și responsabilitățile sunt definite în mod formal, dar nu sunt respectate în toate cazurile.",
          },
          {
            value: 4,
            label:
              "Rolurile și responsabilitățile sunt clar definite. Acestea sunt documentate pentru fiecare poziție/ rol, dar sarcinile nu sunt întotdeauna corelate eficient cu persoanele din organizație.",
          },
          {
            value: 5,
            label:
              "Rolurile sunt clare și documentate pentru toate pozițiile, folosite pentru diviziunea responsabilităților. Organizația le utilizează în momentul în care sunt atribuite sarcinile.",
          },
        ],
        tag: "Structură funcțională",
      },
      {
        id: "structura_organizationala_q3",
        question:
          "În ce măsură corespund competențele oamenilor din organizație cu nevoile organizației?",
        options: [
          {
            value: 1,
            label:
              "Oamenii sunt implicați în funcție de disponibilitate și oportunitate, nu pe baza nevoilor organizației. ",
          },
          {
            value: 2,
            label:
              "Există expertiză limitată a persoanelor ce lucrează în cadrul organizației, ce nu corespunde nevoilor actuale ale organizației.",
          },
          {
            value: 3,
            label:
              "Organizația știe ce abilități/ expertiză îi lipsesc, dar nu încearcă în mod activ să includă acest tip de expertiză.",
          },
          {
            value: 4,
            label:
              "Organizația știe ce abilități/ expertiză îi lipsesc și are un plan de a include persoane adecvate în organizație. Cu toate acestea, există inconsecvențe (ex. recrutare făcută doar pe recomandări).",
          },
          {
            value: 5,
            label:
              "Organizația știe ce abilități/ expertiză îi lipsesc și include persoanele adecvate în organizație, pe baza unor proceduri/ procese clare/ documentate.",
          },
        ],
        tag: "Abilități folosite eficient",
      },
      {
        id: "structura_organizationala_q4",
        question: "Care este modalitatea de a lua decizii în organizație?",
        options: [
          {
            value: 1,
            label:
              "Nu există nicio politică de luare a deciziilor. Toate deciziile sunt luate ad hoc, în general de lider(i).",
          },
          {
            value: 2,
            label:
              "Sunt organizate consultări între persoanele cele mai apropiate ale organizației, dar deciziile sunt luate în general de către lider(i). Deciziile nu sunt comunicate.",
          },
          {
            value: 3,
            label:
              "Sunt organizate consultări cu persoanele implicate în organizație, dar deciziile sunt luate în general de lider(i) care informează oamenii din organizație.",
          },
          {
            value: 4,
            label:
              "Procesul de luare a deciziilor include oamenii din organizație. Nu este comunicat însă către alte persoane interesate (persoane beneficiare, donatori, etc.).",
          },
          {
            value: 5,
            label:
              "Procesul de luare a deciziilor în organizație este participativ, transparent și comunicat către toate persoanele cointeresate, acolo unde este cazul.",
          },
        ],
        tag: "Luare decizii",
      },
      {
        id: "structura_organizationala_q5",
        question: "Ia organizația deciziile ținând cont de viziune și misiune?",
        options: [
          {
            value: 1,
            label:
              "Procesul de luare a deciziilor este arbitrar și nu se bazează pe viziunea și misiunea organizației.",
          },
          {
            value: 2,
            label:
              "Procesul de luare a deciziilor este arbitrar și se bazează în mare parte pe lider(i). Viziunea acestora nu este întotdeauna concordantă cu viziunea și misiunea organizației.",
          },
          {
            value: 3,
            label:
              "Organizația consultă viziunea și misiunea în luarea deciziilor. Cu toate acestea, decizia încă se bazează pe lider(i), care se conformează viziunii și misiunii.",
          },
          {
            value: 4,
            label:
              "Organizația consultă viziunea și misiunea în luarea deciziilor. Cu toate acestea, ele nu sunt întotdeauna urmate (de ex. dacă apare o oportunitate de finanțare, organizația nu va mai ține cont de viziune și misiune).",
          },
          {
            value: 5,
            label:
              "Procesul de luare a deciziilor este în concordanță cu viziunea și misiunea, iar deciziile nu sunt luate în funcție de context/ politici sau oportunități de finanțare specifice.",
          },
        ],
        tag: "Decizii eficiente",
      },
    ],
  },
  {
    key: "leadership",
    name: "Leadership",
    description:
      "Leadership-ul se referă la calitatea conducerii organizației și la capacitatea liderilor de a motiva echipa, de a formula o viziune clară și de a naviga în contexte complexe.",
    tips: "Gândește-te la stilul de conducere predominant și la modul în care liderii inspiră și ghidează echipa.",
    action:
      "Reflectează la momentele de criză sau schimbare majoră din organizație și evaluează cum a răspuns conducerea.",
    quiz: [
      {
        id: "leadership_q1",
        question:
          "În ce măsură în organizație există un mix adecvat de leadership și management?",
        options: [
          {
            value: 1,
            label: "Nu există niciun mix între leadership și management.",
          },
          {
            value: 2,
            label:
              "Există un oarecare mix, cu accent pe management. Abilitățile de leadership lipsesc.",
          },
          {
            value: 3,
            label:
              "Există un oarecare mix, cu accent pe leadership. Abilitățile de management lipsesc. ",
          },
          {
            value: 4,
            label:
              "Există un mix clar între abilitățile de management și leadership, însă nu sunt acoperite toate competențele necesare din ambele perspective.",
          },
          {
            value: 5,
            label:
              "Există un mix adecvat între abilitățile de leadership și management în organizație, fapt ce asigură o bună funcționare a acesteia.",
          },
        ],
        tag: "Mix leadership",
      },
      {
        id: "leadership_q2",
        question:
          "Cum este recunoscut leadership-ul formal și informal în cadrul organizației?",
        options: [
          {
            value: 1,
            label:
              "În organizație este recunoscută doar o singură persoană ca lider formal, fără o viziune clară, fără deschidere către schimbare. ",
          },
          {
            value: 2,
            label:
              "În organizație este recunoscută doar o singură persoană ca lider formal care oferă viziune însă nu implică alte persoane.",
          },
          {
            value: 3,
            label:
              "Leadership-ul este dependent de o persoană, maxim două care îi implică și pe ceilalți în definirea viziunii.",
          },
          {
            value: 4,
            label:
              "În cadrul organizației leadership-ul formal este recunoscut și împărțit între mai multe persoane. Abordarea lor însă este „de modă veche”/ nu este conectată la realitățile curente.",
          },
          {
            value: 5,
            label:
              "Leadership-ul formal și informal există și este funcțional iar organizația este dispusă să-și asume riscuri și să încerce noi abordări pentru a crește.",
          },
        ],
        tag: "Leadership informal",
      },
      {
        id: "leadership_q3",
        question:
          "În ce măsură liderul/ liderii organizației oferă motivație oamenilor din organizație?",
        options: [
          {
            value: 1,
            label: "Nicio motivație oferită.",
          },
          {
            value: 2,
            label:
              "Motivația este parțial oferită de lider(i), iar ideea generală este că oamenii din organizație sunt motivați doar de cauza propriu-zisă.",
          },
          {
            value: 3,
            label:
              "Motivația este oferită parțial de lider(i), dar nu într-un mod coerent/  sistematic.\n",
          },
          {
            value: 4,
            label:
              "Motivația este recunoscută ca parte integrală a leadership-ului. Liderii își dedică timp să motiveze și să ofere un exemplu. Oamenii din organizație nu sunt încurajați să încerce lucruri noi sau să ofere feedback.",
          },
          {
            value: 5,
            label:
              "Liderii oferă motivație pozitivă și consistentă oamenilor. Organizația este condusă de abordarea „putem să facem”, iar eșecurile sunt acceptate ca pași în creșterea organizației. Există o deschidere clară către introducerea și punerea în aplicare a noilor idei.",
          },
        ],
        tag: "Motivație oameni",
      },
      {
        id: "leadership_q4",
        question:
          "În ce măsură liderii cresc noi lideri în cadrul organizației?",
        options: [
          {
            value: 1,
            label:
              "Nu există o astfel de cultură. Liderii văd noii lideri drept potențiale pericole pentru poziția lor.",
          },
          {
            value: 2,
            label:
              "Creșterea de noi lideri nu este recunoscută ca parte din activitatea organizației.\n",
          },
          {
            value: 3,
            label:
              "Nu există o abordare sistematică asupra creșterii liderilor, dar se întâmplă din când în când, în mod spontan.",
          },
          {
            value: 4,
            label:
              "Liderii cresc noi lideri în cadrul organizației. Nu toți oamenii sunt încurajați să devină lideri. Se conștientizează importanța creșterii de noi lideri, însă nu există timp sau abilități pentru a face acest lucru.",
          },
          {
            value: 5,
            label:
              "Liderii cresc constant noi lideri în cadrul organizației sau în afara ei. Le este oferit sprijin potențialilor lideri. Există programe/ activități speciale pentru creșterea de noi lideri în cadrul organizației sau în afara ei. ",
          },
        ],
        tag: "Creștere lideri",
      },
      {
        id: "leadership_q5",
        question:
          "În ce măsură leadership-ul organizației împuternicește oamenii să se dezvolte personal și profesional?",
        options: [
          {
            value: 1,
            label:
              "Leadership-ul organizației nu împuternicește oamenii să se dezvolte.",
          },
          {
            value: 2,
            label:
              "Dezvoltarea personală și profesională este accesibilă doar unui cerc restrâns de oameni din organizație.",
          },
          {
            value: 3,
            label:
              "Leadership-ul organizației împuternicește oamenii să se dezvolte, dar nu într-o manieră coerentă/ sistematică.\n",
          },
          {
            value: 4,
            label:
              "Deseori, leadership-ul organizației împuternicește oamenii să se dezvolte, dar nu există planuri individuale. ",
          },
          {
            value: 5,
            label:
              "Leadership-ul organizației încurajează și acționează pentru dezvoltarea atât personală, cât și profesională a oamenilor. Oamenii au planuri individuale de dezvoltare personală și profesională.",
          },
        ],
        tag: "Dezvoltare oameni",
      },
    ],
  },
  {
    key: "managementul_resurselor_umane",
    name: "Managementul resurselor umane",
    description:
      "Managementul resurselor umane vizează capacitatea organizației de a atrage, dezvolta și reține oameni valoroși, de a crea practici clare de evaluare și recunoaștere.",
    tips: "Gândește-te la procesele de recrutare, la oportunitățile de formare și la nivelul de satisfacție al echipei.",
    action:
      "Evaluează dacă organizația are politici clare de resurse umane și dacă acestea sunt aplicate consecvent.",
    quiz: [
      {
        id: "managementul_resurselor_umane_q1",
        question: "Are organizația practici de recrutare?",
        options: [
          {
            value: 1,
            label: "Nu există astfel de practici.",
          },
          {
            value: 2,
            label:
              "Există o înțelegere generală limitată, în mare parte informală,  asupra practicilor de recrutare.",
          },
          {
            value: 3,
            label:
              "Există câteva instrucțiuni cu privire la recrutare. Cu toate acestea, deseori nu sunt urmărite în practică.",
          },
          {
            value: 4,
            label:
              "Există practici/ proceduri clare de recrutare, urmate de câteva excepții (ex. situații de headhunting sau contractare directă).",
          },
          {
            value: 5,
            label:
              "Organizația respectă proceduri/ practici de recrutare pentru oameni noi. Organizația oferă oportunități reale și egale pentru toată lumea.",
          },
        ],
        tag: "Practici recrutare",
      },
      {
        id: "managementul_resurselor_umane_q2",
        question:
          "Are organizația practici de onboarding pentru persoanele nou venite?",
        options: [
          {
            value: 1,
            label: "Nu există astfel de practici.",
          },
          {
            value: 2,
            label:
              "Există parțial un proces de onboarding, dar este facut în general informal.",
          },
          {
            value: 3,
            label:
              "Organizația este conștientă de importanța onboarding-ului. Liderii îi întâmpină pe noii veniți. Nu există însă practici/ proceduri clare.",
          },
          {
            value: 4,
            label:
              "Există proceduri/ practici clare pentru onboarding-ul noilor persoane, dar nu există traininguri sau întâlniri formale. Organizația dedică resurse pentru inducția oamenilor noi.",
          },
          {
            value: 5,
            label:
              "Organizația furnizează întâlniri/ traininguri inițiale pentru oamenii noi. Acestora li se oferă un „pachet de bun venit” ce include viziunea și misiunea organizației, principiile și valorile acesteia, organigrama, etc.",
          },
        ],
        tag: "Practici onboarding",
      },
      {
        id: "managementul_resurselor_umane_q3",
        question:
          "Are organizația practici de dezvoltare personală și profesională?",
        options: [
          {
            value: 1,
            label: "Nu există astfel de practici",
          },
          {
            value: 2,
            label:
              "Există puține practici pentru dezvoltare, realizate informal.",
          },
          {
            value: 3,
            label:
              "În cadrul organizației se ține cont de câteva practici privind dezvoltarea, dar nu sunt suficient documentate (nu există criterii coerente).",
          },
          {
            value: 4,
            label:
              "Există practici/proceduri clare de dezvoltare, dar nu este oferită asistență într-un mod continuu.",
          },
          {
            value: 5,
            label:
              "Organizația are practici/proceduri de asistență și de dezvoltare personală și profesională pentru oamenii din organizație, care contribuie la motivația acestora.",
          },
        ],
        tag: "Practici dezvoltare",
      },
      {
        id: "managementul_resurselor_umane_q4",
        question: "Are organizația practici de evaluare?",
        options: [
          {
            value: 1,
            label: "Nu există astfel de practici.",
          },
          {
            value: 2,
            label:
              "Există puține practici de evaluare, realizate mai ales informal.",
          },
          {
            value: 3,
            label:
              "Există câteva instrucțiuni pentru evaluare urmate în organizație, dar nu sunt îndeajuns documentate (nu există criterii/ descrieri coerente).",
          },
          {
            value: 4,
            label:
              "Există practici/ proceduri clare, dar nu există o urmare a evaluării.",
          },
          {
            value: 5,
            label:
              "Organizația oferă evaluare în mod regulat pentru oamenii din organizație și are dezvoltată o metodologie de adresare a rezultatelor, pentru a asigura dezvoltarea personală și profesională a oamenilor.",
          },
        ],
        tag: "Practici evaluare",
      },
      {
        id: "managementul_resurselor_umane_q5",
        question:
          "Are organizația practici de recunoaștere și răsplătire a competențelor?",
        options: [
          {
            value: 1,
            label: "Nu există astfel de practici.\n",
          },
          {
            value: 2,
            label:
              "Există puține practici privind recunoașterea, realizate mai ales informal.",
          },
          {
            value: 3,
            label:
              "Există câteva practici urmate în organizație privind recunoașterea, dar nu sunt îndeajuns documentate (nu există criterii/ descrieri coerente).",
          },
          {
            value: 4,
            label:
              "Există practici/ proceduri clare privind recunoașterea muncii, dar informațiile nu sunt oferite și informal (se limitează doar la recunoașterea formală).",
          },
          {
            value: 5,
            label:
              "Organizația recunoaște în totalitate munca oamenilor, atât formal (de ex. performanță salarială), cât și informal (statut în organizație, aprecieri verbale, etc.).",
          },
        ],
        tag: "Practici recunoaștere",
      },
    ],
  },
  {
    key: "implicarea_persoanelor_beneficiare",
    name: "Implicarea persoanelor beneficiare",
    description:
      "Implicarea beneficiarilor se referă la măsura în care persoanele pe care organizația le deservește sunt consultate, implicate în decizii și împuternicite să contribuie activ.",
    tips: "Gândește-te la mecanismele prin care beneficiarii pot oferi feedback și la gradul în care nevoile lor ghidează programele organizației.",
    action:
      "Identifică cel puțin 3 modalități prin care beneficiarii contribuie activ la procesele organizației.",
    quiz: [
      {
        id: "implicarea_persoanelor_beneficiare_q1",
        question:
          "În ce măsură organizația își planifică activitățile pe baza identificării nevoilor reale ale persoanelor beneficiare?",
        options: [
          {
            value: 1,
            label:
              "Nu se realizează nicio identificare a nevoilor. Programele și activitățile sunt planificate pe baza unor ipoteze neverificate/ percepții fără documentare",
          },
          {
            value: 2,
            label:
              "O identificare a nevoilor se realizează, dar nu în mod organizat. Nu există un plan coerent pentru o identificare clară a nevoilor.",
          },
          {
            value: 3,
            label:
              "Există câteva practici pentru identificarea de nevoi, dar fără criterii/ metodologii coerente sau fără o colectare de date coerentă și sistematică.\n",
          },
          {
            value: 4,
            label:
              "O identificare de nevoi clară este parte a activităților organizației. Cu toate acestea,  activitățile nu urmăresc rezultatele. Persoanele beneficiare sunt, de regulă, deja active în cadrul organizației.",
          },
          {
            value: 5,
            label:
              "Identificarea de nevoi este parte integrantă a activităților organizației. Organizația planifică proiectele/ programele pe baza rezultatelor acestei analize. O varietate mare a persoanelor beneficiare actuale și potențiale sunt implicate în identificarea de nevoi.",
          },
        ],
        tag: "Identificare nevoi",
      },
      {
        id: "implicarea_persoanelor_beneficiare_q2",
        question:
          "În ce măsură persoanele beneficiare au diverse roluri în organizație?",
        options: [
          {
            value: 1,
            label: "Nicio implicare a persoanelor beneficiare în organizație.",
          },
          {
            value: 2,
            label:
              "Implicare limitată, în mare parte informală/ nestructurată.",
          },
          {
            value: 3,
            label:
              "Persoanele beneficiare pot influența proiectele și programele organizației într-o anumită măsură, doar punctual.",
          },
          {
            value: 4,
            label:
              "Organizația planifică majoritatea activităților împreună cu persoanele beneficiare, dar munca este în continuare realizată exclusiv de oamenii din organizație.",
          },
          {
            value: 5,
            label:
              "Organizația încurajează activ persoanele beneficiare să preia responsabilități și să își asume o varietate de roluri în organizație. Se fac demersuri ca persoanele beneficiare să devină parte din organizație.  ",
          },
        ],
        tag: "Implicare în organizație",
      },
      {
        id: "implicarea_persoanelor_beneficiare_q3",
        question:
          "În ce măsură organizația implică persoanele beneficiare în activități/ proiecte/ programe?",
        options: [
          {
            value: 1,
            label:
              "Persoanele beneficiare doar participă (pasiv) la activitățile organizației.",
          },
          {
            value: 2,
            label:
              "Implicare limitată, în mare parte informală/ nestructurată.",
          },
          {
            value: 3,
            label:
              "Persoanele beneficiare sunt implicate într-o anumită măsură în activități, în mare parte la nivel logistic.",
          },
          {
            value: 4,
            label:
              "Persoanele beneficiare sunt implicate în activitățile organizației, dar nu în toate etapele de realizare a activităților.",
          },
          {
            value: 5,
            label:
              "Persoanele beneficiare sunt implicate în toate etapele activităților, de la identificarea nevoilor, stabilirea indicatorilor, design, implementare, evaluare și continuare a activităților.",
          },
        ],
        tag: "Implicare în proiecte",
      },
      {
        id: "implicarea_persoanelor_beneficiare_q4",
        question: "Implică organizația noi persoane?",
        options: [
          {
            value: 1,
            label:
              "Nu sunt recrutate persoane beneficiare noi, organizația lucrează cu aceleași persoane. ",
          },
          {
            value: 2,
            label:
              "Implicare limitată din partea noilor persoane beneficiare, nestructurată/ neintenționată.",
          },
          {
            value: 3,
            label:
              "Noile persoane beneficiare sunt selectate doar pentru activități specifice, punctuale, fără a se avea în vedere implicarea lor pe termen lung.",
          },
          {
            value: 4,
            label:
              "Noile persoane beneficiare sunt selectate, dar nu există practici de primire a lor în organizație și de implicare activă.",
          },
          {
            value: 5,
            label:
              "Există o varietate de sisteme de selecție și implicare activă a noilor persoane beneficiare, ca parte a strategiei organizaționale.",
          },
        ],
        tag: "Oameni noi",
      },
      {
        id: "implicarea_persoanelor_beneficiare_q5",
        question: "Împuternicește organizația persoanele beneficiare?",
        options: [
          {
            value: 1,
            label: "Nu există nicio implicare a persoanelor beneficiare.",
          },
          {
            value: 2,
            label:
              "Implicare limitată din partea persoanelor beneficiare, în mare parte informală/ nestructurată.",
          },
          {
            value: 3,
            label:
              "Persoanele beneficiare sunt împuternicite să acționeze dar organizația nu le oferă oportunități concrete în acest sens.",
          },
          {
            value: 4,
            label:
              "Persoanele beneficiare sunt împuternicite să acționeze însă doar în activități punctuale, fără mize reale pentru organizație. ",
          },
          {
            value: 5,
            label:
              "Persoanele beneficiare sunt împuternicite să acționeze, să se mobilizeze și să-și susțină interesele, iar organizația le oferă toate instrumentele pentru ca ele să facă acest lucru independent.",
          },
        ],
        tag: "Oameni împuterniciți",
      },
    ],
  },
  {
    key: "advocacy_si_networking",
    name: "Advocacy și networking",
    description:
      "Advocacy-ul și parteneriatele se referă la capacitatea organizației de a influența politici publice, de a construi alianțe strategice și de a reprezenta interesele comunității.",
    tips: "Gândește-te la relațiile pe care organizația le are cu alte ONG-uri, autorități publice și mediul de afaceri.",
    action:
      "Listează principalele parteneriate active și evaluează dacă acestea aduc valoare reală organizației.",
    quiz: [
      {
        id: "advocacy_si_networking_q1",
        question: "În ce măsură organizația este activă în domeniul advocacy?",
        options: [
          {
            value: 1,
            label: "Advocacy nu este pe agenda organizației.",
          },
          {
            value: 2,
            label:
              "Advocacy este pe agenda organizației numai ad-hoc/ nestructurat.",
          },
          {
            value: 3,
            label:
              "Advocacy este pe agenda organizației, dar în mare parte la nivel reactiv, fără o agendă clară.",
          },
          {
            value: 4,
            label:
              "Există o implicare clară, proactivă în urmărirea unei agende. Activitatea de advocacy se realizează însă fără implicarea altor entități",
          },
          {
            value: 5,
            label:
              "Organizația are un plan concret și este proactivă în inițiative de advocacy care sunt în concordanță cu viziunea și misiunea organizației, implicând entități cointeresate.",
          },
        ],
        tag: "Plan advocacy",
      },
      {
        id: "advocacy_si_networking_q2",
        question:
          "În ce măsură organizația pledează în numele persoanelor beneficiare ale acesteia?",
        options: [
          {
            value: 1,
            label:
              "Organizația nu implică persoanele beneficiare în acțiunile de advocacy.",
          },
          {
            value: 2,
            label:
              "Organizația consultă ocazional persoanele beneficiare în acțiunile de advocacy, dar nu o face în mod sistematic.",
          },
          {
            value: 3,
            label:
              "Organizația consultă în mod constant persoanele beneficiare pentru acțiunile de advocacy. Interesele persoanelor beneficiare și cele ale organizației nu sunt întotdeauna aceleași.",
          },
          {
            value: 4,
            label:
              "Organizația are un sistem clar de implicare a persoanelor beneficiare în activitățile sale de advocacy. Cu toate acestea, nu sunt respectate întotdeauna sugestiile acestora.",
          },
          {
            value: 5,
            label:
              "Acțiunile și mesajele de advocacy ale organizației sunt consistente și coerente și întotdeauna direcționate în interesul suprem al persoanelor beneficiare.",
          },
        ],
        tag: "Implicare activă",
      },
      {
        id: "advocacy_si_networking_q3",
        question:
          "În ce măsură organizația deține abilitățile necesare pentru a întreprinde activități de advocacy/ a realiza parteneriate?",
        options: [
          {
            value: 1,
            label:
              "Nu există abilități de advocacy/ realizare de parteneriate în organizație.",
          },
          {
            value: 2,
            label:
              "Organizația are abilități limitate, majoritatea acumulate în mod informal/ nestructurat.",
          },
          {
            value: 3,
            label:
              "Organizația este conștientă de abilitățile specifice pentru advocacy/ networking și investește resurse în acest sens. Cu toate acestea, nicio persoană nu are responsabilități clare de advocacy/ networking.",
          },
          {
            value: 4,
            label:
              "Organizația are abilitățile de bază în advocacy și networking și investește resurse în dezvoltarea de abilități specifice, dar specializarea este restrânsă la o persoană/ grup restrâns de persoane.",
          },
          {
            value: 5,
            label:
              "Organizația are abilitățile necesare de a lucra în aspecte importante de advocacy și face networking la toate nivelurile și în interesul persoanelor beneficiare, implicând mai multe persoane din organizație pe diferite dimensiuni. ",
          },
        ],
        tag: "Implicare activă",
      },
      {
        id: "advocacy_si_networking_q4",
        question: "Organizația are în vedere lucrul în parteneriat?",
        options: [
          {
            value: 1,
            label: "Organizația lucrează în mod constant fără parteneri.",
          },
          {
            value: 2,
            label:
              "Organizația lucrează limitat cu parteneri, adesea informal/ nestructurat.",
          },
          {
            value: 3,
            label:
              "Organizația lucrează în diferite contexte cu parteneri, doar pe aspecte minore sau doar dacă este necesară implicarea unor parteneri",
          },
          {
            value: 4,
            label:
              "Organizația are parteneriate cu diferite entități, în special din zona privată, însă acestea sunt mai degrabă punctuale, bazate pe un interes imediat. ",
          },
          {
            value: 5,
            label:
              "Organizația înțelege în totalitate importanța parteneriatelor, inițiază și întreține parteneriate pe termen lung cu entități cointeresate din toate domeniile conexe ale activității acesteia (public, privat etc.). ",
          },
        ],
        tag: "Parteneriate",
      },
      {
        id: "advocacy_si_networking_q5",
        question:
          "Construiește organizația alianțe/ rețele/ coaliții pentru lucrul în advocacy/ politici?",
        options: [
          {
            value: 1,
            label: "Nicio implicare în alianțe/ rețele/ coaliții.",
          },
          {
            value: 2,
            label:
              "Implicare limitată, de cele mai multe ori informală/ nestructurată.",
          },
          {
            value: 3,
            label:
              "Implicare parțială, de multe ori ca rezultat al invitației altor actori interesați, nu într-un mod proactiv.",
          },
          {
            value: 4,
            label:
              "Implicare clară, proactivă în cadrul a diferite structuri, mai degrabă implicată în lucrul pe domeniul tematic al organizației, decât pe aspecte de advocacy/ politici.",
          },
          {
            value: 5,
            label:
              "Organizația inițiază și întreține relații clare în alianțe/ rețele/ coaliții cu alte entități cointeresate, atât pe domeniul tematic al organizației dar și alte aspecte, care implică și o intervenție specifică și eficientă în advocacy/ politici.",
          },
        ],
        tag: "Coaliții și rețele",
      },
    ],
  },
  {
    key: "comunicare_externa",
    name: "Comunicare externă",
    description:
      "Comunicarea externă se referă la modul în care organizația comunică cu publicul, partenerii și media, și cât de bine își promovează misiunea și impactul.",
    tips: "Gândește-te la prezența online a organizației, la relația cu presa și la cât de coerent este mesajul transmis publicului.",
    action:
      "Analizează canalele de comunicare actuale și evaluează dacă acestea ajung la publicul-țintă al organizației.",
    quiz: [
      {
        id: "comunicare_externa_q1",
        question: "Are organizația un brand/ o identitate vizuală clară?",
        options: [
          {
            value: 1,
            label: "Nicio identitate vizuală/ niciun brand.",
          },
          {
            value: 2,
            label: "Identitate vizuală/ brand limitate. Există doar un logo.",
          },
          {
            value: 3,
            label:
              "Identitate vizuală/ brand există, dar fără o viziune clară de utilizare și nu toată lumea din organizație le folosește.",
          },
          {
            value: 4,
            label:
              "Identitate vizuală/ brand clare, utilizate de toată lumea, dar care nu stau la baza tuturor activităților de informare.",
          },
          {
            value: 5,
            label:
              "Organizația are o identitate vizuală proprie/ un brand propriu. Un brand book stă la baza informării constante a comunității asupra activităților organizației.",
          },
        ],
        tag: "Coaliții și rețele",
      },
      {
        id: "comunicare_externa_q2",
        question: "Are organizația un plan de comunicare coerent?",
        options: [
          {
            value: 1,
            label:
              "Nu există un plan de comunicare. Organizația acționează doar conform regulamentelor donatorilor (dacă este cazul).",
          },
          {
            value: 2,
            label:
              "Nu există un plan de comunicare, dar există un acord asupra mesajelor generale ale organizației.",
          },
          {
            value: 3,
            label:
              "Există câteva instrucțiuni privind planul de comunicare. Organizația comunică mesajele cheie, dar are probleme în conectarea acestora la nivelul proiectelor individuale.",
          },
          {
            value: 4,
            label:
              "Există un plan clar de comunicare și mesaje cheie interdependente. Cu toate acestea, grupurile țintă nu sunt definite în mod specific.",
          },
          {
            value: 5,
            label:
              "Organizația are un plan de comunicare, ce include mesaje cheie clare, grupuri țintă definite specific și modalități de abordare a acestora.",
          },
        ],
        tag: "Plan de comunicare",
      },
      {
        id: "comunicare_externa_q3",
        question:
          "În ce măsură organizația folosește diferite canale de comunicare?",
        options: [
          {
            value: 1,
            label:
              "Organizația folosește un singur canal de comunicare (ex: doar o pagină web sau de Facebook).",
          },
          {
            value: 2,
            label:
              "Organizația are maxim două canale de comunicare  (o combinație de pagină web și cont de social media) însă informația nu este adaptată diverselor grupuri țintă/ este generalistă.",
          },
          {
            value: 3,
            label:
              "Organizația folosește diferite canale de comunicare în funcție de ce comunică însă nu adaptează informația la formatele specifice. Se bazează în mare parte pe canalele media personale (pagină web, Facebook).",
          },
          {
            value: 4,
            label:
              "Organizația utilizează canale diferite și ia în considerare diverse tipuri de public. În același timp cooperează cu alții pentru comunicare (platforme, mass media, forumuri, etc.).",
          },
          {
            value: 5,
            label:
              "Organizația utilizează canale diferite și selectează cele mai relevante canale pentru știrile pe care le promovează. Informația este adaptată nevoilor specifice și grupurilor țintă și se folosesc canalele în mod diferențiat.",
          },
        ],
        tag: "Canale de comunicare",
      },
      {
        id: "comunicare_externa_q4",
        question: "Colaborează organizația cu mass media?",
        options: [
          {
            value: 1,
            label: "Nu există o colaborare cu mass media.",
          },
          {
            value: 2,
            label:
              "Există colaborare limitată cu mass media, nestructurată, realizată în principal doar prin transmiterea de comunicate de presă.",
          },
          {
            value: 3,
            label:
              "Există o oarecare comunicare cu mass-media, se trimit informații clare/ structurate, dar nu în mod constant (în principal pentru evenimente).",
          },
          {
            value: 4,
            label:
              "Colaborare clară cu mass media, informarea lor constantă prin intermediul mai multor mijloace, fără însă ca agenda acestora să fie influențată.",
          },
          {
            value: 5,
            label:
              "Organizația are parteneriate bune și comunicare constantă cu mass media, influențându-le agenda și fiind o sursă credibilă de informație.",
          },
        ],
        tag: "Mass media",
      },
      {
        id: "comunicare_externa_q5",
        question: "În ce măsură organizația este transparentă și responsabilă?",
        options: [
          {
            value: 1,
            label:
              "Organizația nu are o politică/ practică privind transparența și responsabilitatea.",
          },
          {
            value: 2,
            label:
              "Organizația este în general conștientă de importanța transparenței și a responsabilității, însă îi lipsește dorința de a lucra activ la aceste aspecte. ",
          },
          {
            value: 3,
            label:
              "Organizația este în general conștientă de importanța transparenței și a responsabilității, dar oferă informații doar la cerere (în general doar donatorilor).",
          },
          {
            value: 4,
            label:
              "Există transparență și responsabilitate, însă nu către toate persoanele cointeresate, în special doar prin rapoarte anuale publicate, sau alte rapoarte interne. Informația nu este accesibilă publicului larg.",
          },
          {
            value: 5,
            label:
              "Organizația promovează activ transparența și responsabilitatea inclusiv prin propriul  exemplu. Este proactivă în asigurarea transparenței - publică informații online și permite tuturor accesul la aceste informații.",
          },
        ],
        tag: "Transparență",
      },
    ],
  },
];
