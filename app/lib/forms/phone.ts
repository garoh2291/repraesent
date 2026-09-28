/**
 * Phone field of forms: country (flag + calling code) and the number.
 *
 * KEEP IN SYNC with nestjs-monolith/src/modules/forms/form-phone.ts, which
 * the website runtime (embed.js / HTML snippet) is built from. A spec there
 * checks the two tables are byte-identical.
 *
 * Table: "ISO:callingCode:trunkZero:mainForCode", generated from
 * libphonenumber-js metadata. trunkZero = people write a leading 0 at home
 * that is dropped internationally (DE 0151… → +49 151…; Italy keeps it).
 * mainForCode = the country a shared code belongs to first (+1 → US).
 *
 * The saved value is one string in international form, e.g. "+491511234567",
 * or "" when no number was typed. Flags are served by the app at /flags/xx.svg.
 */
export const PHONE_COUNTRIES_RAW =
  "AC:247:0:1,AD:376:0:1,AE:971:1:1,AF:93:1:1,AG:1:0:0,AI:1:0:0,AL:355:1:1,AM:374:1:1,AO:244:0:1,AR:54:1:1,AS:1:0:0,AT:43:1:1,AU:61:1:1,AW:297:0:1,AX:358:1:0,AZ:994:1:1,BA:387:1:1,BB:1:0:0,BD:880:1:1,BE:32:1:1,BF:226:0:1,BG:359:1:1,BH:973:0:1,BI:257:0:1,BJ:229:0:1,BL:590:1:0,BM:1:0:0,BN:673:0:1,BO:591:1:1,BQ:599:0:0,BR:55:1:1,BS:1:0:0,BT:975:0:1,BW:267:0:1,BY:375:0:1,BZ:501:0:1,CA:1:0:0,CC:61:1:0,CD:243:1:1,CF:236:0:1,CG:242:0:1,CH:41:1:1,CI:225:0:1,CK:682:0:1,CL:56:0:1,CM:237:0:1,CN:86:1:1,CO:57:1:1,CR:506:0:1,CU:53:1:1,CV:238:0:1,CW:599:0:1,CX:61:1:0,CY:357:0:1,CZ:420:0:1,DE:49:1:1,DJ:253:0:1,DK:45:0:1,DM:1:0:0,DO:1:0:0,DZ:213:1:1,EC:593:1:1,EE:372:0:1,EG:20:1:1,EH:212:1:0,ER:291:1:1,ES:34:0:1,ET:251:1:1,FI:358:1:1,FJ:679:0:1,FK:500:0:1,FM:691:0:1,FO:298:0:1,FR:33:1:1,GA:241:0:1,GB:44:1:1,GD:1:0:0,GE:995:1:1,GF:594:1:1,GG:44:1:0,GH:233:1:1,GI:350:0:1,GL:299:0:1,GM:220:0:1,GN:224:0:1,GP:590:1:1,GQ:240:0:1,GR:30:0:1,GT:502:0:1,GU:1:0:0,GW:245:0:1,GY:592:0:1,HK:852:0:1,HN:504:0:1,HR:385:1:1,HT:509:0:1,HU:36:0:1,ID:62:1:1,IE:353:1:1,IL:972:1:1,IM:44:1:0,IN:91:1:1,IO:246:0:1,IQ:964:1:1,IR:98:1:1,IS:354:0:1,IT:39:0:1,JE:44:1:0,JM:1:0:0,JO:962:1:1,JP:81:1:1,KE:254:1:1,KG:996:1:1,KH:855:1:1,KI:686:1:1,KM:269:0:1,KN:1:0:0,KP:850:1:1,KR:82:1:1,KW:965:0:1,KY:1:0:0,KZ:7:0:0,LA:856:1:1,LB:961:1:1,LC:1:0:0,LI:423:1:1,LK:94:1:1,LR:231:1:1,LS:266:0:1,LT:370:1:1,LU:352:0:1,LV:371:0:1,LY:218:1:1,MA:212:1:1,MC:377:1:1,MD:373:1:1,ME:382:1:1,MF:590:1:0,MG:261:1:1,MH:692:0:1,MK:389:1:1,ML:223:0:1,MM:95:1:1,MN:976:1:1,MO:853:0:1,MP:1:0:0,MQ:596:1:1,MR:222:0:1,MS:1:0:0,MT:356:0:1,MU:230:0:1,MV:960:0:1,MW:265:1:1,MX:52:0:1,MY:60:1:1,MZ:258:0:1,NA:264:1:1,NC:687:0:1,NE:227:0:1,NF:672:0:1,NG:234:1:1,NI:505:0:1,NL:31:1:1,NO:47:0:1,NP:977:1:1,NR:674:0:1,NU:683:0:1,NZ:64:1:1,OM:968:0:1,PA:507:0:1,PE:51:1:1,PF:689:0:1,PG:675:0:1,PH:63:1:1,PK:92:1:1,PL:48:0:1,PM:508:1:1,PR:1:0:0,PS:970:1:1,PT:351:0:1,PW:680:0:1,PY:595:1:1,QA:974:0:1,RE:262:1:1,RO:40:1:1,RS:381:1:1,RU:7:0:1,RW:250:1:1,SA:966:1:1,SB:677:0:1,SC:248:0:1,SD:249:1:1,SE:46:1:1,SG:65:0:1,SH:290:0:1,SI:386:1:1,SJ:47:0:0,SK:421:1:1,SL:232:1:1,SM:378:0:1,SN:221:0:1,SO:252:1:1,SR:597:0:1,SS:211:1:1,ST:239:0:1,SV:503:0:1,SX:1:0:0,SY:963:1:1,SZ:268:0:1,TA:290:0:0,TC:1:0:0,TD:235:0:1,TG:228:0:1,TH:66:1:1,TJ:992:0:1,TK:690:0:1,TL:670:0:1,TM:993:0:1,TN:216:0:1,TO:676:0:1,TR:90:1:1,TT:1:0:0,TV:688:0:1,TW:886:1:1,TZ:255:1:1,UA:380:1:1,UG:256:1:1,US:1:0:1,UY:598:1:1,UZ:998:0:1,VA:39:0:0,VC:1:0:0,VE:58:1:1,VG:1:0:0,VI:1:0:0,VN:84:1:1,VU:678:0:1,WF:681:0:1,WS:685:0:1,XK:383:1:1,YE:967:1:1,YT:262:1:0,ZA:27:1:1,ZM:260:1:1,ZW:263:1:1";

export interface PhoneCountry {
  iso: string;
  dial: string;
  trunkZero: boolean;
  main: boolean;
}

export const PHONE_COUNTRIES: PhoneCountry[] = PHONE_COUNTRIES_RAW.split(",").map((row) => {
  const [iso, dial, tz, main] = row.split(":");
  return { iso, dial, trunkZero: tz === "1", main: main === "1" };
});

const BY_ISO = new Map(PHONE_COUNTRIES.map((c) => [c.iso, c]));

export function phoneCountry(iso: string | undefined | null): PhoneCountry | undefined {
  return iso ? BY_ISO.get(iso.toUpperCase()) : undefined;
}

/** Where the country picker starts: the form's language decides. */
export function defaultPhoneCountry(locale: string | undefined | null): string {
  switch ((locale || "").slice(0, 2).toLowerCase()) {
    case "de":
      return "DE";
    case "fr":
      return "FR";
    case "nl":
      return "NL";
    default:
      return "GB";
  }
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Country + what the visitor typed → the saved value ("" when empty). */
export function joinPhone(iso: string, national: string): string {
  const typed = national.trim();
  if (!typed) return "";
  // A full international number typed or pasted into the box wins.
  if (/^(\+|00)/.test(typed)) {
    const d = digits(typed.replace(/^00/, ""));
    return d ? `+${d}` : "";
  }
  const c = phoneCountry(iso);
  let d = digits(typed);
  if (!d) return "";
  if (!c) return `+${d}`;
  if (c.trunkZero && d.startsWith("0")) d = d.slice(1);
  return `+${c.dial}${d}`;
}

/**
 * Which country a typed or saved international number belongs to: the
 * current pick when its code matches, else the longest matching code
 * (its main country first).
 */
export function countryForInternational(value: string, current?: string): PhoneCountry | undefined {
  const d = digits(value.replace(/^00/, ""));
  if (!d) return undefined;
  const cur = phoneCountry(current);
  if (cur && d.startsWith(cur.dial)) return cur;
  let best: PhoneCountry | undefined;
  for (const c of PHONE_COUNTRIES) {
    if (!d.startsWith(c.dial)) continue;
    if (!best || c.dial.length > best.dial.length || (c.dial.length === best.dial.length && c.main && !best.main)) {
      best = c;
    }
  }
  return best;
}

/** A saved value back into (country, number) for the two controls. */
export function splitPhone(value: string, fallbackIso: string): { iso: string; national: string } {
  const v = (value || "").trim();
  if (!v) return { iso: fallbackIso, national: "" };
  if (!/^(\+|00)/.test(v)) return { iso: fallbackIso, national: v };
  const c = countryForInternational(v, fallbackIso);
  if (!c) return { iso: fallbackIso, national: v };
  return { iso: c.iso, national: digits(v.replace(/^00/, "")).slice(c.dial.length) };
}

/** Country name in the form's language (the browser knows them all). */
export function countryName(iso: string, locale: string | undefined): string {
  try {
    const names = new Intl.DisplayNames([locale || "en"], { type: "region" });
    return names.of(iso) || iso;
  } catch {
    return iso;
  }
}
