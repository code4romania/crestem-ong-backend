export interface DimensionQuestion {
  question: string;
  options: [string, string, string, string, string];
  tag: string | null;
}

export interface Dimension {
  key: string;
  name: string;
  link: string | null;
  quiz: DimensionQuestion[];
}

export const DIMENSIONS: readonly Dimension[] = [
  {
    "key": "guvernanta",
    "name": "Guvernanță",
    "link": null,
    "quiz": [
      {
        "question": "În ce măsură viziunea și misiunea organizației sunt clare?",
        "options": [
          "Nu există viziune și misiune scrise.",
          "Există viziune și misiune scrise, însă organizația nu le urmărește în practică. Viziunea și misiunea sunt prea vaste/ includ prea multe aspecte.",
          "Există viziune și misiune scrise și  acestea sunt urmărite în practică. Lipsește înțelegerea comună a oamenilor din organizație asupra „sensului de a exista” (raison d'être) al acesteia.",
          "Viziunea și misiunea sunt clar exprimate și de cele mai multe ori (dar nu întotdeauna) sunt avute în vedere în direcționarea acțiunilor și stabilirea priorităților. ",
          "Viziunea și misiunea sunt clar (de)scrise, revizuite/ evaluate/ promovate și urmărite în toate activitățile organizației. "
        ],
        "tag": "Viziune și misiune"
      },
      {
        "question": "În ce măsură este implementat un plan strategic în cadrul organizației? ",
        "options": [
          "Nu există plan strategic.",
          "Nu există un plan strategic scris, însă există o serie de linii directoare generale. ",
          "Există un plan strategic scris, însă nu este operaționalizat/ implementat în totalitate. ",
          "Există un plan strategic scris și implementat, dar nu este urmat în toate aspectele și evaluat.",
          "Organizația are un plan strategic care este implementat în totalitate, revizuit și monitorizat regulat, evaluat. "
        ],
        "tag": "Plan strategic"
      },
      {
        "question": "Care este rolul structurii de guvernanță a organizației? (ex. Board/ Consiliul director, Adunarea generală) ",
        "options": [
          "Organizația nu are o structură de guvernanță bine definită. ",
          "Structura de guvernanță există doar formal/ pe hârtie. ",
          "Structura de guvernanță are o înțelegere limitată asupra rolului său. De obicei doar adoptă formal deciziile luate de lider(i) ai organizației. ",
          "Structura de guvernanță își înțelege într-o măsură relativ mare rolul. Nu întotdeauna este consultată pentru deciziile strategice ale organizației. ",
          "Structura de guvernanță își înțelege în totalitate rolul și responsabilitățile. Ia decizii strategice pentru organizație și își îndeplinește cu succes atribuțiile.\n"
        ],
        "tag": "Structură guvernanță"
      },
      {
        "question": "Componența structurii de guvernanță este bazată pe criterii clare ce reflectă o experiență diversă? ",
        "options": [
          "Nu există niciun criteriu pentru componența structurii de guvernanță.",
          "O serie de criterii sunt stabilite formal. Totuși acestea nu sunt respectate în componența actuală a structurii de guvernanță.",
          "Există criterii pentru structura de guvernanță însă toate persoanele implicate au aproximativ aceleași abilități și cunoștințe.",
          "Există criterii pentru structura de guvernanță însă toate persoanele implicate au aproximativ aceleași abilități și cunoștințe.",
          "Există și sunt respectate criteriile pentru structura de guvernanță, iar persoanele implicate au diverse abilități și cunoștințe și provin din medii variate, necesare pentru dezvoltarea organizației."
        ],
        "tag": "Abilități diverse"
      },
      {
        "question": "Are organizația politici cu referire la etică/ valori? ",
        "options": [
          "Nu există politici cu referire la etică/ valori nici la nivel formal nici la nivel informal.",
          "Există câteva instrucțiuni privind principii etice sau  respectarea unor valori, însă nu există documente scrise în acest sens/ sunt prea vagi/ neclare.",
          "Există documente în care se regăsesc și instrucțiuni privind etica/ valorile. Totuși acestea nu sunt urmate în practică (există doar pe hârtie), iar oamenii nu sunt informații și instruiți cu referire la acestea.",
          "Există politici dedicate privind etica/ valorile, dar nu sunt implementate în totalitate.  Doar un număr mic de oameni din organizație sunt informați, instruiți și conștienți de existența lor. ",
          "Există politici clare privind etica/ valorile ce ghidează activitățile zilnice ale organizației. Oamenii le conștientizează și le folosesc drept instrumente în luarea deciziilor și implementarea tuturor activităților."
        ],
        "tag": "Politici de etică"
      }
    ]
  },
  {
    "key": "aspecte_financiare",
    "name": "Aspecte financiare",
    "link": null,
    "quiz": [
      {
        "question": "Își cunoaște organizația obligațiile prevăzute de lege (la nivel național)?",
        "options": [
          "Organizația nu cunoaște obligațiile prevăzute de lege.\n",
          "Organizația cunoaște principalele obligații prevăzute de lege. Are o persoană cu atribuții contabile care nu se implică în ansamblul managementului organizației.",
          "Organizația cunoaște principalele obligații prevăzute de lege și are încredere în persoana cu atribuții contabile din organizație.\n",
          "Organizația are o bună înțelegere a practicilor contabile generale și a prevederilor legislative pentru activitățile sale curente, persoana cu atribuții contabile fiind parte din organizație. ",
          "Organizația înțelege foarte bine prevederile legislative și practicile contabile. În diferite situații se asigură că activitățile sale sunt conforme cu legislația în vigoare iar persoana cu atribuții contabile participă regulat la formări și se informează cu privire la modificări legislative.\n"
        ],
        "tag": "Legislație"
      },
      {
        "question": "Are organizația o bună gestiune financiară?",
        "options": [
          "Fiecare persoană este responsabilă de propriile proiecte / activități, fără coordonare și fără practici/ proceduri comune.",
          "Fiecare persoană este responsabilă de propriile proiecte/ activități. Există o oarecare coordonare între proiecte, însă nu există practici/ proceduri comune.",
          "Fiecare persoană este responsabilă de propriile proiecte/ activități, cu o coordonare clară și câteva practici/ proceduri comune în cadrul organizației.",
          "Managementul financiar al organizației este supervizat de o persoană care aplică proceduri/ practici comune și care nu este persoana cu atribuții contabile. Nu există practici/ proceduri coerente de monitorizare",
          "Există cel puțin o persoană dedicată (nu persoana cu atribuții contabile ci o persoană cu atribuții de management financiar) care urmărește veniturile/ cheltuielile organizației, monitorizează fluxul de numerar/ cashflow și se asigură că banii sunt cheltuiți eficient. \n"
        ],
        "tag": "Management financiar"
      },
      {
        "question": "Urmărește organizația o planificare financiară coerentă?",
        "options": [
          "Nu există o planificare financiară",
          "Există o planificare financiară bazată doar pe situația anului precedent",
          "Planificarea financiară este asigurată coerent pentru anul în curs.",
          "Planificarea financiară este asigurată pentru cel puțin 2 ani înainte.",
          "Organizația are un plan financiar coerent ce include proiecția fluxului de numerar/ cashflow pentru mai mult de 2 ani."
        ],
        "tag": "Planificare financiară"
      },
      {
        "question": "În ce măsură organizația are capacitatea să asigure surse sustenabile/ de lungă durată de venit?",
        "options": [
          "Nu există capacitate de asigurare a unor surse sustenabile/ de lungă durată de venit.",
          "Capacitate limitată de asigurare a unui venit sustenabil/ de lungă durată. Veniturile se  bazează în special pe scriere de proiecte. Nicio persoană nu este implicată dedicat în această activitate.  ",
          "Capacitate parțială de a asigura venit sustenabil/ de lungă durată. Există cel puțin o persoană implicată în acest demers, dar majoritatea eforturilor se concentrează pe scrierea de proiecte.",
          "Capacitate clară de a asigura un venit sustenabil/ de lungă durată. Minim 40% din totalul veniturilor provin din alte surse decât scrierea de proiecte. Totuși, acest lucru nu este integrat la nivel strategic/ nu se realizează continuu.",
          "Organizația are capacitate strategică de a asigura un venit sustenabil/ de lungă durată pentru diverse proiecte/ programe/ activități, utilizând metode variate (de la scriere de proiecte la donații, sponsorizări, etc.) care au procentaj echilibrat în totalul veniturilor."
        ],
        "tag": "Venituri sustenabile"
      },
      {
        "question": "Are organizația în vedere diversificarea fondurilor?",
        "options": [
          "Organizația este dependentă de o singură sursă de venit și nu este în căutare de altele.",
          "Organizația are surse de venit diferite, însă una din ele predomină în mod semnificativ (peste 80% din venituri provin din acea sursă).",
          "Organizația are 2-3 surse diferite de venit, dar toate provin din aceeași zonă (de ex. apeluri pentru cereri de finanțare din sfera publică). Doar unul sau doi donatori încă predomină.",
          "Organizația are 3-5 surse diferite de venit ale căror procentaje sunt împărțite echilibrat.",
          "Organizația are peste 5 surse diferite de venit și niciuna dintre acestea nu depășește 20% din totalul bugetului organizației. Resursele financiare sunt de proveniență diferită (public/ privat, național/ la nivelul Uniunii Europene, donatori individuali/ donații etc)."
        ],
        "tag": "Diversificare fonduri"
      }
    ]
  },
  {
    "key": "managementul_informatiei",
    "name": "Managementul informației",
    "link": null,
    "quiz": [
      {
        "question": "Are organizația o memorie instituțională solidă?",
        "options": [
          "Nu există înregistrări ale activităților anterioare ale organizației.",
          "Există informații limitate asupra activităților anterioare, fără a fi arhivate. Doar o singură persoană cunoaște istoricul organizației. ",
          "Există informații parțiale despre proiecte/ programe anterioare. Informația este prezentă în principal sub formă de descrieri succinte ale proiectelor implementate.",
          "Există o evidență clară a proiectelor/ programelor anterioare, inclusiv a informațiilor financiare. Nu există însă informație asupra impactului/ rezultatelor.",
          "Organizația menține o evidență clară a tuturor proiectelor/ programelor anterioare, a informațiilor financiare pentru fiecare dintre acestea cât și rapoarte de rezultate/ analize de impact."
        ],
        "tag": "Memorie instituțională"
      },
      {
        "question": "Are organizația un sistem de date intern funcțional?",
        "options": [
          "Nu există un sistem de date.",
          "Câteva informații referitoare la organizație sunt colectate în format offline sau online. Nu există o modalitate coerentă de colectare a informației. ",
          "Există un sistem de date intern (ex. server/ drive), totuși nu există o procedură coerentă prin care informația este colectată/ nu există instrucțiuni de utilizare a acestuia.",
          "Există un sistem de date intern, iar informația este structurată. Nu este utilizat în totalitate de oamenii din organizație. Nu există instrucțiuni de utilizare a acestuia.",
          "Organizația are un sistem structurat și funcțional de date (ex. al persoanelor beneficiare, angajate, voluntare, experte, etc.) ce include informații importante/ relevante. Există instrucțiuni clare de utilizare a acestuia."
        ],
        "tag": "Sistem de date intern"
      },
      {
        "question": "Se bazează organizația pe un sistem de management specific?",
        "options": [
          "Nu este implementat un sistem de management.",
          "Există o practică minimă de lucru cu documente de management, în mare parte dosare fizice/ drive, dar aceasta nu este coerentă.",
          "Există câteva practici de lucru, în mare parte online, dar nu și offline (nu sunt arhivate documente în format fizic).",
          "Există practici/ proceduri clare de lucru cu documentele, online și offline, dar nu toate persoanele din organizație îl folosesc unitar.",
          "Organizația folosește un sistem/ sisteme funcționale de management (ex. sisteme online de management al proiectului), este definită clar modalitatea păstrării documentelor și toată lumea le folosește unitar."
        ],
        "tag": "Sistem de management"
      },
      {
        "question": "Învață organizația din experiențele anterioare?",
        "options": [
          "Organizația nu colectează nicio informație pentru a învăța din experiențe anterioare.",
          "Organizația are o practică limitată în a folosi lecțiile învățate, iar aceasta nu este folosită de toți oamenii din organizație.",
          "Există o oarecare practică în a folosi experiențele anterioare, doar pentru aspecte tehnice (ex. scriere de proiecte).",
          "Experiențele anterioare și lecțiile învățate sunt folosite pentru a planifica activitățile viitoare. Aceste informații nu sunt însă împărtășite cu toată lumea. ",
          "Experiențele anterioare și lecțiile învățate sunt colectate eficient și folosite pentru a planifica activități viitoare, iar informațiile sunt împărtășite între toți oamenii din organizație."
        ],
        "tag": "Lecții învățate"
      },
      {
        "question": "În ce măsură organizația publică un raport anual cuprinzător?",
        "options": [
          "Organizația nu are un raport anual.",
          "Sunt publicate câteva informații (articole/ social media) despre activitatea organizației, însă nu în cadrul unui raport anual.\n",
          "Există un raport anual fără o structură clară, care nu este publicat/ disponibil publicului larg.",
          "Un raport anual coerent și informativ este publicat pe site-ul organizației. Raportul nu este trimis către oamenii din organizație și/ sau donatori.",
          "Raportul anual este considerat un instrument important de comunicare. Acesta este redactat într-o manieră coerentă, ținând cont de diverși actori interesați și trimis special către aceștia."
        ],
        "tag": "Raport anual"
      }
    ]
  },
  {
    "key": "monitorizare_si_evaluare",
    "name": "Monitorizare și evaluare",
    "link": null,
    "quiz": [
      {
        "question": "Există în organizație o practică continuă de monitorizare și evaluare?",
        "options": [
          "Nu există o practică clară de monitorizare și evaluare la nivel de organizație",
          "Monitorizarea și evaluarea sunt realizate doar atunci când sunt solicitate/ impuse de donator(i).",
          "Există câteva activități standard în organizație care sunt monitorizate și evaluate, dar doar la nivel de rezultate cantitative. Alte măsurători nu sunt luate în considerare.",
          "Există practici clare de monitorizare și evaluare realizate doar pentru activități specifice ale organizației (ex. formări, ateliere, etc.). Nu există practici de măsurare a impactului.",
          "Monitorizarea și evaluarea sunt parte din cultura organizațională, sunt incluse pentru toate activitățile organizației și sunt actualizate/ revizuite în mod regulat. Monitorizarea și evaluarea includ și măsurarea impactului."
        ],
        "tag": "Strategie M&E"
      },
      {
        "question": "În ce măsură organizația monitorizează și evaluează obiectivele și rezultatele activităților sale?",
        "options": [
          "Nu se realizează monitorizare sau evaluare a activităților.",
          "Există câteva practici în  organizație în ceea ce privește monitorizarea și evaluarea activităților. Cu toate acestea, nu sunt urmărite aspecte specifice.",
          "Există câteva practici în organizație care monitorizează și evaluează în principal activitățile din punct de vedere administrativ. ",
          "Chiar dacă organizația monitorizează și evaluează obiectivele activităților, o face doar dacă sunt cerințe de la donator(i) și nu pune accent pe rezultate.",
          "Organizația monitorizează și evaluează obiectivele și rezultatele activităților, indiferent de cerințele donatorilor. "
        ],
        "tag": "Practici M&E"
      },
      {
        "question": "În ce măsură organizația folosește indicatori pentru monitorizare și evaluare?",
        "options": [
          "Nu se realizează monitorizare și evaluare în cadrul organizației.",
          "Există câteva practici de colectare a informațiilor pentru monitorizare și evaluare. Cu toate acestea, nu există un set concret de indicatori.",
          "Există câteva practici de colectare a informațiilor pentru monitorizare și evaluare. Cu toate acestea, nu există un set concret de indicatori.",
          "Organizația folosește indicatori simpli cantitativi și calitativi și își evaluează periodic progresul.",
          "Monitorizarea și evaluarea sunt realizate în mod regulat. Sunt stabilite obiective ce sunt monitorizate și actualizate constant, utilizând indicatori cantitativi și calitativi clari la nivel de organizație, dincolo de proiecte specifice."
        ],
        "tag": "Practici M&E"
      },
      {
        "question": "Reflectă și învață organizația din activitatea sa?",
        "options": [
          "Nu există un proces de reflecție sau învățare.",
          "Practici limitate privind privind reflecția asupra activităților. Nu sunt evidențiate rezultatele în urma procesului de învățare.",
          "Câteva practici de reflecție și învățare din majoritatea activităților, în principal în mod informal, nestructurat sau nedocumentat.",
          "Practici clare de reflecție și învățare într-un mod participativ, luând în considerare și feedback-ul din partea beneficiarilor/ actorilor interesați.",
          "Organizația are un proces continuu de reflecție asupra învățării sale (prin analiză de nevoi, cartografiere a actorilor interesați, colectare de feedback, activități de documentare și debriefing, etc.)."
        ],
        "tag": "Învățare M&E"
      },
      {
        "question": "În ce măsură folosește organizația rezultatele învățării pentru a crește?",
        "options": [
          "Nu se folosesc rezultatele învățării.",
          "Practici limitate în implementarea rezultatelor învățării, în mare parte realizată informal.",
          "Câteva practici de utilizare a rezultatelor învățării, doar pentru activitățile și proiectele implementate.",
          "Implementare clară și documentată a rezultatelor învățării pentru toate proiectele și programele.",
          "Organizația folosește rezultatele învățării pentru creșterea sa și integrează toate rezultatele în activitatea generală a organizației și în proiectele/ programele specifice."
        ],
        "tag": "Creștere M&E"
      }
    ]
  },
  {
    "key": "structura_organizationala",
    "name": "Structură organizațională",
    "link": null,
    "quiz": [
      {
        "question": "În ce măsură este definită și funcțională structura organizațională?",
        "options": [
          "Nu există o structură clară în cadrul organizației.",
          "Nu există o structură formal definită, chiar dacă direcții informale de interacțiune sunt înțelese de oamenii din organizație.",
          "O structură formală există în organizație. Cu toate acestea, structura nu este respectată în totalitate.",
          "Structura organizațională este definită. Cu toate acestea unele direcții de interacțiune nu sunt clare/ se suprapun.",
          "Organizația are o structură bine definită, clară și interacțiuni ce funcționează în practică. Oamenii din organizație înțeleg interdependența rolurilor."
        ],
        "tag": "Structură funcțională"
      },
      {
        "question": "În ce măsură înțeleg oamenii din organizație, rolul și responsabilitățile lor?",
        "options": [
          "Nu sunt definite roluri sau responsabilități.",
          "Nu sunt definite roluri sau responsabilități în mod formal, dar informal este stabilită diviziunea muncii.",
          "Rolurile și responsabilitățile sunt definite în mod formal, dar nu sunt respectate în toate cazurile.",
          "Rolurile și responsabilitățile sunt clar definite. Acestea sunt documentate pentru fiecare poziție/ rol, dar sarcinile nu sunt întotdeauna corelate eficient cu persoanele din organizație.",
          "Rolurile sunt clare și documentate pentru toate pozițiile, folosite pentru diviziunea responsabilităților. Organizația le utilizează în momentul în care sunt atribuite sarcinile."
        ],
        "tag": "Structură funcțională"
      },
      {
        "question": "În ce măsură corespund competențele oamenilor din organizație cu nevoile organizației?",
        "options": [
          "Oamenii sunt implicați în funcție de disponibilitate și oportunitate, nu pe baza nevoilor organizației. ",
          "Există expertiză limitată a persoanelor ce lucrează în cadrul organizației, ce nu corespunde nevoilor actuale ale organizației.",
          "Organizația știe ce abilități/ expertiză îi lipsesc, dar nu încearcă în mod activ să includă acest tip de expertiză.",
          "Organizația știe ce abilități/ expertiză îi lipsesc și are un plan de a include persoane adecvate în organizație. Cu toate acestea, există inconsecvențe (ex. recrutare făcută doar pe recomandări).",
          "Organizația știe ce abilități/ expertiză îi lipsesc și include persoanele adecvate în organizație, pe baza unor proceduri/ procese clare/ documentate."
        ],
        "tag": "Abilități folosite eficient"
      },
      {
        "question": "Care este modalitatea de a lua decizii în organizație?",
        "options": [
          "Nu există nicio politică de luare a deciziilor. Toate deciziile sunt luate ad hoc, în general de lider(i).",
          "Sunt organizate consultări între persoanele cele mai apropiate ale organizației, dar deciziile sunt luate în general de către lider(i). Deciziile nu sunt comunicate.",
          "Sunt organizate consultări cu persoanele implicate în organizație, dar deciziile sunt luate în general de lider(i) care informează oamenii din organizație.",
          "Procesul de luare a deciziilor include oamenii din organizație. Nu este comunicat însă către alte persoane interesate (persoane beneficiare, donatori, etc.).",
          "Procesul de luare a deciziilor în organizație este participativ, transparent și comunicat către toate persoanele cointeresate, acolo unde este cazul."
        ],
        "tag": "Luare decizii"
      },
      {
        "question": "Ia organizația deciziile ținând cont de viziune și misiune?",
        "options": [
          "Procesul de luare a deciziilor este arbitrar și nu se bazează pe viziunea și misiunea organizației.",
          "Procesul de luare a deciziilor este arbitrar și se bazează în mare parte pe lider(i). Viziunea acestora nu este întotdeauna concordantă cu viziunea și misiunea organizației.",
          "Organizația consultă viziunea și misiunea în luarea deciziilor. Cu toate acestea, decizia încă se bazează pe lider(i), care se conformează viziunii și misiunii.",
          "Organizația consultă viziunea și misiunea în luarea deciziilor. Cu toate acestea, ele nu sunt întotdeauna urmate (de ex. dacă apare o oportunitate de finanțare, organizația nu va mai ține cont de viziune și misiune).",
          "Procesul de luare a deciziilor este în concordanță cu viziunea și misiunea, iar deciziile nu sunt luate în funcție de context/ politici sau oportunități de finanțare specifice."
        ],
        "tag": "Decizii eficiente"
      }
    ]
  },
  {
    "key": "leadership",
    "name": "Leadership",
    "link": null,
    "quiz": [
      {
        "question": "În ce măsură în organizație există un mix adecvat de leadership și management?",
        "options": [
          "Nu există niciun mix între leadership și management.",
          "Există un oarecare mix, cu accent pe management. Abilitățile de leadership lipsesc.",
          "Există un oarecare mix, cu accent pe leadership. Abilitățile de management lipsesc. ",
          "Există un mix clar între abilitățile de management și leadership, însă nu sunt acoperite toate competențele necesare din ambele perspective.",
          "Există un mix adecvat între abilitățile de leadership și management în organizație, fapt ce asigură o bună funcționare a acesteia."
        ],
        "tag": "Mix leadership"
      },
      {
        "question": "Cum este recunoscut leadership-ul formal și informal în cadrul organizației?",
        "options": [
          "În organizație este recunoscută doar o singură persoană ca lider formal, fără o viziune clară, fără deschidere către schimbare. ",
          "În organizație este recunoscută doar o singură persoană ca lider formal care oferă viziune însă nu implică alte persoane.",
          "Leadership-ul este dependent de o persoană, maxim două care îi implică și pe ceilalți în definirea viziunii.",
          "În cadrul organizației leadership-ul formal este recunoscut și împărțit între mai multe persoane. Abordarea lor însă este „de modă veche”/ nu este conectată la realitățile curente.",
          "Leadership-ul formal și informal există și este funcțional iar organizația este dispusă să-și asume riscuri și să încerce noi abordări pentru a crește."
        ],
        "tag": "Leadership informal"
      },
      {
        "question": "În ce măsură liderul/ liderii organizației oferă motivație oamenilor din organizație?",
        "options": [
          "Nicio motivație oferită.",
          "Motivația este parțial oferită de lider(i), iar ideea generală este că oamenii din organizație sunt motivați doar de cauza propriu-zisă.",
          "Motivația este oferită parțial de lider(i), dar nu într-un mod coerent/  sistematic.\n",
          "Motivația este recunoscută ca parte integrală a leadership-ului. Liderii își dedică timp să motiveze și să ofere un exemplu. Oamenii din organizație nu sunt încurajați să încerce lucruri noi sau să ofere feedback.",
          "Liderii oferă motivație pozitivă și consistentă oamenilor. Organizația este condusă de abordarea „putem să facem”, iar eșecurile sunt acceptate ca pași în creșterea organizației. Există o deschidere clară către introducerea și punerea în aplicare a noilor idei."
        ],
        "tag": "Motivație oameni"
      },
      {
        "question": "În ce măsură liderii cresc noi lideri în cadrul organizației?",
        "options": [
          "Nu există o astfel de cultură. Liderii văd noii lideri drept potențiale pericole pentru poziția lor.",
          "Creșterea de noi lideri nu este recunoscută ca parte din activitatea organizației.\n",
          "Nu există o abordare sistematică asupra creșterii liderilor, dar se întâmplă din când în când, în mod spontan.",
          "Liderii cresc noi lideri în cadrul organizației. Nu toți oamenii sunt încurajați să devină lideri. Se conștientizează importanța creșterii de noi lideri, însă nu există timp sau abilități pentru a face acest lucru.",
          "Liderii cresc constant noi lideri în cadrul organizației sau în afara ei. Le este oferit sprijin potențialilor lideri. Există programe/ activități speciale pentru creșterea de noi lideri în cadrul organizației sau în afara ei. "
        ],
        "tag": "Creștere lideri"
      },
      {
        "question": "În ce măsură leadership-ul organizației împuternicește oamenii să se dezvolte personal și profesional?",
        "options": [
          "Leadership-ul organizației nu împuternicește oamenii să se dezvolte.",
          "Dezvoltarea personală și profesională este accesibilă doar unui cerc restrâns de oameni din organizație.",
          "Leadership-ul organizației împuternicește oamenii să se dezvolte, dar nu într-o manieră coerentă/ sistematică.\n",
          "Deseori, leadership-ul organizației împuternicește oamenii să se dezvolte, dar nu există planuri individuale. ",
          "Leadership-ul organizației încurajează și acționează pentru dezvoltarea atât personală, cât și profesională a oamenilor. Oamenii au planuri individuale de dezvoltare personală și profesională."
        ],
        "tag": "Dezvoltare oameni"
      }
    ]
  },
  {
    "key": "managementul_resurselor_umane",
    "name": "Managementul resurselor umane",
    "link": null,
    "quiz": [
      {
        "question": "Are organizația practici de recrutare?",
        "options": [
          "Nu există astfel de practici.",
          "Există o înțelegere generală limitată, în mare parte informală,  asupra practicilor de recrutare.",
          "Există câteva instrucțiuni cu privire la recrutare. Cu toate acestea, deseori nu sunt urmărite în practică.",
          "Există practici/ proceduri clare de recrutare, urmate de câteva excepții (ex. situații de headhunting sau contractare directă).",
          "Organizația respectă proceduri/ practici de recrutare pentru oameni noi. Organizația oferă oportunități reale și egale pentru toată lumea."
        ],
        "tag": "Practici recrutare"
      },
      {
        "question": "Are organizația practici de onboarding pentru persoanele nou venite?",
        "options": [
          "Nu există astfel de practici.",
          "Există parțial un proces de onboarding, dar este facut în general informal.",
          "Organizația este conștientă de importanța onboarding-ului. Liderii îi întâmpină pe noii veniți. Nu există însă practici/ proceduri clare.",
          "Există proceduri/ practici clare pentru onboarding-ul noilor persoane, dar nu există traininguri sau întâlniri formale. Organizația dedică resurse pentru inducția oamenilor noi.",
          "Organizația furnizează întâlniri/ traininguri inițiale pentru oamenii noi. Acestora li se oferă un „pachet de bun venit” ce include viziunea și misiunea organizației, principiile și valorile acesteia, organigrama, etc."
        ],
        "tag": "Practici onboarding"
      },
      {
        "question": "Are organizația practici de dezvoltare personală și profesională?",
        "options": [
          "Nu există astfel de practici",
          "Există puține practici pentru dezvoltare, realizate informal.",
          "În cadrul organizației se ține cont de câteva practici privind dezvoltarea, dar nu sunt suficient documentate (nu există criterii coerente).",
          "Există practici/proceduri clare de dezvoltare, dar nu este oferită asistență într-un mod continuu.",
          "Organizația are practici/proceduri de asistență și de dezvoltare personală și profesională pentru oamenii din organizație, care contribuie la motivația acestora."
        ],
        "tag": "Practici dezvoltare"
      },
      {
        "question": "Are organizația practici de evaluare?",
        "options": [
          "Nu există astfel de practici.",
          "Există puține practici de evaluare, realizate mai ales informal.",
          "Există câteva instrucțiuni pentru evaluare urmate în organizație, dar nu sunt îndeajuns documentate (nu există criterii/ descrieri coerente).",
          "Există practici/ proceduri clare, dar nu există o urmare a evaluării.",
          "Organizația oferă evaluare în mod regulat pentru oamenii din organizație și are dezvoltată o metodologie de adresare a rezultatelor, pentru a asigura dezvoltarea personală și profesională a oamenilor."
        ],
        "tag": "Practici evaluare"
      },
      {
        "question": "Are organizația practici de recunoaștere și răsplătire a competențelor?",
        "options": [
          "Nu există astfel de practici.\n",
          "Există puține practici privind recunoașterea, realizate mai ales informal.",
          "Există câteva practici urmate în organizație privind recunoașterea, dar nu sunt îndeajuns documentate (nu există criterii/ descrieri coerente).",
          "Există practici/ proceduri clare privind recunoașterea muncii, dar informațiile nu sunt oferite și informal (se limitează doar la recunoașterea formală).",
          "Organizația recunoaște în totalitate munca oamenilor, atât formal (de ex. performanță salarială), cât și informal (statut în organizație, aprecieri verbale, etc.)."
        ],
        "tag": "Practici recunoaștere"
      }
    ]
  },
  {
    "key": "implicarea_persoanelor_beneficiare",
    "name": "Implicarea persoanelor beneficiare",
    "link": null,
    "quiz": [
      {
        "question": "În ce măsură organizația își planifică activitățile pe baza identificării nevoilor reale ale persoanelor beneficiare?",
        "options": [
          "Nu se realizează nicio identificare a nevoilor. Programele și activitățile sunt planificate pe baza unor ipoteze neverificate/ percepții fără documentare",
          "O identificare a nevoilor se realizează, dar nu în mod organizat. Nu există un plan coerent pentru o identificare clară a nevoilor.",
          "Există câteva practici pentru identificarea de nevoi, dar fără criterii/ metodologii coerente sau fără o colectare de date coerentă și sistematică.\n",
          "O identificare de nevoi clară este parte a activităților organizației. Cu toate acestea,  activitățile nu urmăresc rezultatele. Persoanele beneficiare sunt, de regulă, deja active în cadrul organizației.",
          "Identificarea de nevoi este parte integrantă a activităților organizației. Organizația planifică proiectele/ programele pe baza rezultatelor acestei analize. O varietate mare a persoanelor beneficiare actuale și potențiale sunt implicate în identificarea de nevoi."
        ],
        "tag": "Identificare nevoi"
      },
      {
        "question": "În ce măsură persoanele beneficiare au diverse roluri în organizație?",
        "options": [
          "Nicio implicare a persoanelor beneficiare în organizație.",
          "Implicare limitată, în mare parte informală/ nestructurată.",
          "Persoanele beneficiare pot influența proiectele și programele organizației într-o anumită măsură, doar punctual.",
          "Organizația planifică majoritatea activităților împreună cu persoanele beneficiare, dar munca este în continuare realizată exclusiv de oamenii din organizație.",
          "Organizația încurajează activ persoanele beneficiare să preia responsabilități și să își asume o varietate de roluri în organizație. Se fac demersuri ca persoanele beneficiare să devină parte din organizație.  "
        ],
        "tag": "Implicare în organizație"
      },
      {
        "question": "În ce măsură organizația implică persoanele beneficiare în activități/ proiecte/ programe?",
        "options": [
          "Persoanele beneficiare doar participă (pasiv) la activitățile organizației.",
          "Implicare limitată, în mare parte informală/ nestructurată.",
          "Persoanele beneficiare sunt implicate într-o anumită măsură în activități, în mare parte la nivel logistic.",
          "Persoanele beneficiare sunt implicate în activitățile organizației, dar nu în toate etapele de realizare a activităților.",
          "Persoanele beneficiare sunt implicate în toate etapele activităților, de la identificarea nevoilor, stabilirea indicatorilor, design, implementare, evaluare și continuare a activităților."
        ],
        "tag": "Implicare în proiecte"
      },
      {
        "question": "Implică organizația noi persoane?",
        "options": [
          "Nu sunt recrutate persoane beneficiare noi, organizația lucrează cu aceleași persoane. ",
          "Implicare limitată din partea noilor persoane beneficiare, nestructurată/ neintenționată.",
          "Noile persoane beneficiare sunt selectate doar pentru activități specifice, punctuale, fără a se avea în vedere implicarea lor pe termen lung.",
          "Noile persoane beneficiare sunt selectate, dar nu există practici de primire a lor în organizație și de implicare activă.",
          "Există o varietate de sisteme de selecție și implicare activă a noilor persoane beneficiare, ca parte a strategiei organizaționale."
        ],
        "tag": "Oameni noi"
      },
      {
        "question": "Împuternicește organizația persoanele beneficiare?",
        "options": [
          "Nu există nicio implicare a persoanelor beneficiare.",
          "Implicare limitată din partea persoanelor beneficiare, în mare parte informală/ nestructurată.",
          "Persoanele beneficiare sunt împuternicite să acționeze dar organizația nu le oferă oportunități concrete în acest sens.",
          "Persoanele beneficiare sunt împuternicite să acționeze însă doar în activități punctuale, fără mize reale pentru organizație. ",
          "Persoanele beneficiare sunt împuternicite să acționeze, să se mobilizeze și să-și susțină interesele, iar organizația le oferă toate instrumentele pentru ca ele să facă acest lucru independent."
        ],
        "tag": "Oameni împuterniciți"
      }
    ]
  },
  {
    "key": "advocacy_si_networking",
    "name": "Advocacy și networking",
    "link": null,
    "quiz": [
      {
        "question": "În ce măsură organizația este activă în domeniul advocacy?",
        "options": [
          "Advocacy nu este pe agenda organizației.",
          "Advocacy este pe agenda organizației numai ad-hoc/ nestructurat.",
          "Advocacy este pe agenda organizației, dar în mare parte la nivel reactiv, fără o agendă clară.",
          "Există o implicare clară, proactivă în urmărirea unei agende. Activitatea de advocacy se realizează însă fără implicarea altor entități",
          "Organizația are un plan concret și este proactivă în inițiative de advocacy care sunt în concordanță cu viziunea și misiunea organizației, implicând entități cointeresate."
        ],
        "tag": "Plan advocacy"
      },
      {
        "question": "În ce măsură organizația pledează în numele persoanelor beneficiare ale acesteia?",
        "options": [
          "Organizația nu implică persoanele beneficiare în acțiunile de advocacy.",
          "Organizația consultă ocazional persoanele beneficiare în acțiunile de advocacy, dar nu o face în mod sistematic.",
          "Organizația consultă în mod constant persoanele beneficiare pentru acțiunile de advocacy. Interesele persoanelor beneficiare și cele ale organizației nu sunt întotdeauna aceleași.",
          "Organizația are un sistem clar de implicare a persoanelor beneficiare în activitățile sale de advocacy. Cu toate acestea, nu sunt respectate întotdeauna sugestiile acestora.",
          "Acțiunile și mesajele de advocacy ale organizației sunt consistente și coerente și întotdeauna direcționate în interesul suprem al persoanelor beneficiare."
        ],
        "tag": "Implicare activă"
      },
      {
        "question": "În ce măsură organizația deține abilitățile necesare pentru a întreprinde activități de advocacy/ a realiza parteneriate?",
        "options": [
          "Nu există abilități de advocacy/ realizare de parteneriate în organizație.",
          "Organizația are abilități limitate, majoritatea acumulate în mod informal/ nestructurat.",
          "Organizația este conștientă de abilitățile specifice pentru advocacy/ networking și investește resurse în acest sens. Cu toate acestea, nicio persoană nu are responsabilități clare de advocacy/ networking.",
          "Organizația are abilitățile de bază în advocacy și networking și investește resurse în dezvoltarea de abilități specifice, dar specializarea este restrânsă la o persoană/ grup restrâns de persoane.",
          "Organizația are abilitățile necesare de a lucra în aspecte importante de advocacy și face networking la toate nivelurile și în interesul persoanelor beneficiare, implicând mai multe persoane din organizație pe diferite dimensiuni. "
        ],
        "tag": "Implicare activă"
      },
      {
        "question": "Organizația are în vedere lucrul în parteneriat?",
        "options": [
          "Organizația lucrează în mod constant fără parteneri.",
          "Organizația lucrează limitat cu parteneri, adesea informal/ nestructurat.",
          "Organizația lucrează în diferite contexte cu parteneri, doar pe aspecte minore sau doar dacă este necesară implicarea unor parteneri",
          "Organizația are parteneriate cu diferite entități, în special din zona privată, însă acestea sunt mai degrabă punctuale, bazate pe un interes imediat. ",
          "Organizația înțelege în totalitate importanța parteneriatelor, inițiază și întreține parteneriate pe termen lung cu entități cointeresate din toate domeniile conexe ale activității acesteia (public, privat etc.). "
        ],
        "tag": "Parteneriate"
      },
      {
        "question": "Construiește organizația alianțe/ rețele/ coaliții pentru lucrul în advocacy/ politici?",
        "options": [
          "Nicio implicare în alianțe/ rețele/ coaliții.",
          "Implicare limitată, de cele mai multe ori informală/ nestructurată.",
          "Implicare parțială, de multe ori ca rezultat al invitației altor actori interesați, nu într-un mod proactiv.",
          "Implicare clară, proactivă în cadrul a diferite structuri, mai degrabă implicată în lucrul pe domeniul tematic al organizației, decât pe aspecte de advocacy/ politici.",
          "Organizația inițiază și întreține relații clare în alianțe/ rețele/ coaliții cu alte entități cointeresate, atât pe domeniul tematic al organizației dar și alte aspecte, care implică și o intervenție specifică și eficientă în advocacy/ politici."
        ],
        "tag": "Coaliții și rețele"
      }
    ]
  },
  {
    "key": "comunicare_externa",
    "name": "Comunicare externă",
    "link": null,
    "quiz": [
      {
        "question": "Are organizația un brand/ o identitate vizuală clară?",
        "options": [
          "Nicio identitate vizuală/ niciun brand.",
          "Identitate vizuală/ brand limitate. Există doar un logo.",
          "Identitate vizuală/ brand există, dar fără o viziune clară de utilizare și nu toată lumea din organizație le folosește.",
          "Identitate vizuală/ brand clare, utilizate de toată lumea, dar care nu stau la baza tuturor activităților de informare.",
          "Organizația are o identitate vizuală proprie/ un brand propriu. Un brand book stă la baza informării constante a comunității asupra activităților organizației."
        ],
        "tag": "Coaliții și rețele"
      },
      {
        "question": "Are organizația un plan de comunicare coerent?",
        "options": [
          "Nu există un plan de comunicare. Organizația acționează doar conform regulamentelor donatorilor (dacă este cazul).",
          "Nu există un plan de comunicare, dar există un acord asupra mesajelor generale ale organizației.",
          "Există câteva instrucțiuni privind planul de comunicare. Organizația comunică mesajele cheie, dar are probleme în conectarea acestora la nivelul proiectelor individuale.",
          "Există un plan clar de comunicare și mesaje cheie interdependente. Cu toate acestea, grupurile țintă nu sunt definite în mod specific.",
          "Organizația are un plan de comunicare, ce include mesaje cheie clare, grupuri țintă definite specific și modalități de abordare a acestora."
        ],
        "tag": "Plan de comunicare"
      },
      {
        "question": "În ce măsură organizația folosește diferite canale de comunicare?",
        "options": [
          "Organizația folosește un singur canal de comunicare (ex: doar o pagină web sau de Facebook).",
          "Organizația are maxim două canale de comunicare  (o combinație de pagină web și cont de social media) însă informația nu este adaptată diverselor grupuri țintă/ este generalistă.",
          "Organizația folosește diferite canale de comunicare în funcție de ce comunică însă nu adaptează informația la formatele specifice. Se bazează în mare parte pe canalele media personale (pagină web, Facebook).",
          "Organizația utilizează canale diferite și ia în considerare diverse tipuri de public. În același timp cooperează cu alții pentru comunicare (platforme, mass media, forumuri, etc.).",
          "Organizația utilizează canale diferite și selectează cele mai relevante canale pentru știrile pe care le promovează. Informația este adaptată nevoilor specifice și grupurilor țintă și se folosesc canalele în mod diferențiat."
        ],
        "tag": "Canale de comunicare"
      },
      {
        "question": "Colaborează organizația cu mass media?",
        "options": [
          "Nu există o colaborare cu mass media.",
          "Există colaborare limitată cu mass media, nestructurată, realizată în principal doar prin transmiterea de comunicate de presă.",
          "Există o oarecare comunicare cu mass-media, se trimit informații clare/ structurate, dar nu în mod constant (în principal pentru evenimente).",
          "Colaborare clară cu mass media, informarea lor constantă prin intermediul mai multor mijloace, fără însă ca agenda acestora să fie influențată.",
          "Organizația are parteneriate bune și comunicare constantă cu mass media, influențându-le agenda și fiind o sursă credibilă de informație."
        ],
        "tag": "Mass media"
      },
      {
        "question": "În ce măsură organizația este transparentă și responsabilă?",
        "options": [
          "Organizația nu are o politică/ practică privind transparența și responsabilitatea.",
          "Organizația este în general conștientă de importanța transparenței și a responsabilității, însă îi lipsește dorința de a lucra activ la aceste aspecte. ",
          "Organizația este în general conștientă de importanța transparenței și a responsabilității, dar oferă informații doar la cerere (în general doar donatorilor).",
          "Există transparență și responsabilitate, însă nu către toate persoanele cointeresate, în special doar prin rapoarte anuale publicate, sau alte rapoarte interne. Informația nu este accesibilă publicului larg.",
          "Organizația promovează activ transparența și responsabilitatea inclusiv prin propriul  exemplu. Este proactivă în asigurarea transparenței - publică informații online și permite tuturor accesul la aceste informații."
        ],
        "tag": "Transparență"
      }
    ]
  }
];
