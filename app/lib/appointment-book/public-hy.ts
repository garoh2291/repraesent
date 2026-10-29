/**
 * Armenian for the customer's own appointment page (/booking/:token) only.
 *
 * The app speaks EN/DE/FR/NL; forms and appointment messages also speak
 * Armenian, so a customer who booked in Armenian lands on this page from an
 * Armenian email. These are the words this page and its time picker use —
 * formal register (Դուք), like the emails. Added to i18next on that route.
 */
export const PUBLIC_BOOKING_HY = {
  appointmentBook: {
    public: {
      metaTitle: "Ձեր այցը",
      invalidTitle: "Այս հղումն այլևս չի գործում",
      invalidBody: "Հնարավոր է՝ այն ժամկետանց է այցից հետո։ Փոփոխությունների համար խնդրում ենք դիմել անմիջապես ընկերությանը։",
      taken: "Այդ ժամն արդեն զբաղված է։ Խնդրում ենք ընտրել այլ ժամ։",
      tooMany: "Կարճ ժամանակում չափազանց շատ փոփոխություններ։ Խնդրում ենք փորձել մի քանի րոպեից։",
      failed: "Չստացվեց։ Խնդրում ենք կրկին փորձել կամ դիմել անմիջապես ընկերությանը։",
      tooLate: "Այցին շատ քիչ ժամանակ է մնացել այն այստեղ փոխելու համար։ Խնդրում ենք դիմել անմիջապես {{business}}-ին։",
      notAllowed: "Այս այցը փոխելու համար խնդրում ենք դիմել անմիջապես {{business}}-ին։",
      cancelledTitle: "Ձեր այցը չեղարկված է",
      title: "Ձեր այցը",
      join: "Միանալ առցանց",
      confirmed: "Դուք հաստատել եք, որ կգաք",
      pickNew: "Ընտրեք նոր ժամ",
      back: "Հետ",
      moveConfirm: "Տեղափոխել իմ այցը",
      cancelTitle: "Չեղարկե՞լ այս այցը",
      reason: "Կցանկանա՞ք նշել պատճառը (ըստ ցանկության)",
      keep: "Պահել",
      cancelConfirm: "Այո, չեղարկել",
      willCome: "Այո, կգամ",
      move: "Ընտրել այլ ժամ",
      cancel: "Չեղարկել այցը",
    },
    form: {
      calendarOff: "Այս օրացույցն անջատված է և ժամեր չի առաջարկում։",
      day: "Օր",
      noTimes: "Այս օրը ազատ ժամ չկա։ Խնդրում ենք ընտրել այլ օր։",
      otherTime: "Այլ ժամ…",
      otherTimeHint: "Ազատ ժամերից դուրս՝ կպահանջվի հաստատում։",
      time: "Ժամ",
      wholeDayLabel: "Ամբողջ օրը",
    },
    wholeDay: "Ամբողջ օրը",
  },
  tracking: {
    footer: "Ապահովված է Repraesent-ի կողմից",
  },
} as const;
