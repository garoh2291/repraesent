/**
 * Czech for the customer's own appointment page (/booking/:token) only.
 *
 * The app speaks EN/DE/FR/NL; forms and appointment messages also speak
 * Czech (and Armenian, see public-hy.ts), so a customer who booked in Czech
 * lands on this page from a Czech email. These are the words this page and its
 * time picker use — formal register (Vy), like the emails. Added to i18next on
 * that route.
 */
export const PUBLIC_BOOKING_CS = {
  appointmentBook: {
    public: {
      metaTitle: "Váš termín",
      invalidTitle: "Tento odkaz už neplatí",
      invalidBody: "Po termínu mohl vypršet. Pro změny se prosím obraťte přímo na firmu.",
      taken: "Tento čas je už obsazený. Vyberte prosím jiný.",
      tooMany: "Příliš mnoho změn v krátké době. Zkuste to prosím za pár minut.",
      failed: "Nepovedlo se. Zkuste to prosím znovu nebo se obraťte přímo na firmu.",
      tooLate: "Do termínu zbývá příliš málo času na změnu zde. Obraťte se prosím přímo na {{business}}.",
      notAllowed: "Pro změnu tohoto termínu se prosím obraťte přímo na {{business}}.",
      cancelledTitle: "Váš termín je zrušen",
      title: "Váš termín",
      join: "Připojit se online",
      confirmed: "Potvrdili jste, že přijdete",
      pickNew: "Vyberte nový čas",
      back: "Zpět",
      moveConfirm: "Přesunout můj termín",
      cancelTitle: "Zrušit tento termín?",
      reason: "Chcete uvést důvod? (nepovinné)",
      keep: "Ponechat",
      cancelConfirm: "Ano, zrušit",
      willCome: "Ano, přijdu",
      move: "Vybrat jiný čas",
      cancel: "Zrušit termín",
    },
    form: {
      calendarOff: "Tento kalendář je vypnutý a nenabízí žádné časy.",
      day: "Den",
      noTimes: "V tento den nejsou volné časy. Vyberte prosím jiný den.",
      otherTime: "Jiný čas…",
      otherTimeHint: "Mimo volné časy — bude potřeba potvrzení.",
      time: "Čas",
      wholeDayLabel: "Celý den",
    },
    wholeDay: "Celý den",
  },
  dayField: {
    tomorrow: "Zítra",
    inTwoDays: "Za 2 dny",
    nextWeek: "Příští týden",
    placeholder: "Zadejte datum, např. 30. 9.",
    aria: "Datum",
    openCalendar: "Otevřít kalendář",
    invalid: "Toto není datum od dneška dál.",
  },
  tracking: {
    footer: "Běží na Repraesent",
  },
} as const;
