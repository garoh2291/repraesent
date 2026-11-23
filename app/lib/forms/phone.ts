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

/**
 * Time zone → country, generated from the IANA zone.tab (plus the old names
 * some browsers still report, e.g. Europe/Kiev). Only countries in the phone
 * table. KEEP IN SYNC with the other copy (the spec checks byte equality).
 */
export const TZ_COUNTRIES_RAW =
  "Africa/Abidjan:CI,Africa/Accra:GH,Africa/Addis_Ababa:ET,Africa/Algiers:DZ,Africa/Asmara:ER,Africa/Asmera:ER,Africa/Bamako:ML,Africa/Bangui:CF,Africa/Banjul:GM,Africa/Bissau:GW,Africa/Blantyre:MW,Africa/Brazzaville:CG,Africa/Bujumbura:BI,Africa/Cairo:EG,Africa/Casablanca:MA,Africa/Ceuta:ES,Africa/Conakry:GN,Africa/Dakar:SN,Africa/Dar_es_Salaam:TZ,Africa/Djibouti:DJ,Africa/Douala:CM,Africa/El_Aaiun:EH,Africa/Freetown:SL,Africa/Gaborone:BW,Africa/Harare:ZW,Africa/Johannesburg:ZA,Africa/Juba:SS,Africa/Kampala:UG,Africa/Khartoum:SD,Africa/Kigali:RW,Africa/Kinshasa:CD,Africa/Lagos:NG,Africa/Libreville:GA,Africa/Lome:TG,Africa/Luanda:AO,Africa/Lubumbashi:CD,Africa/Lusaka:ZM,Africa/Malabo:GQ,Africa/Maputo:MZ,Africa/Maseru:LS,Africa/Mbabane:SZ,Africa/Mogadishu:SO,Africa/Monrovia:LR,Africa/Nairobi:KE,Africa/Ndjamena:TD,Africa/Niamey:NE,Africa/Nouakchott:MR,Africa/Ouagadougou:BF,Africa/Porto-Novo:BJ,Africa/Sao_Tome:ST,Africa/Tripoli:LY,Africa/Tunis:TN,Africa/Windhoek:NA,America/Adak:US,America/Anchorage:US,America/Anguilla:AI,America/Antigua:AG,America/Araguaina:BR,America/Argentina/Buenos_Aires:AR,America/Argentina/Catamarca:AR,America/Argentina/Cordoba:AR,America/Argentina/Jujuy:AR,America/Argentina/La_Rioja:AR,America/Argentina/Mendoza:AR,America/Argentina/Rio_Gallegos:AR,America/Argentina/Salta:AR,America/Argentina/San_Juan:AR,America/Argentina/San_Luis:AR,America/Argentina/Tucuman:AR,America/Argentina/Ushuaia:AR,America/Aruba:AW,America/Asuncion:PY,America/Atikokan:CA,America/Bahia:BR,America/Bahia_Banderas:MX,America/Barbados:BB,America/Belem:BR,America/Belize:BZ,America/Blanc-Sablon:CA,America/Boa_Vista:BR,America/Bogota:CO,America/Boise:US,America/Buenos_Aires:AR,America/Cambridge_Bay:CA,America/Campo_Grande:BR,America/Cancun:MX,America/Caracas:VE,America/Cayenne:GF,America/Cayman:KY,America/Chicago:US,America/Chihuahua:MX,America/Ciudad_Juarez:MX,America/Costa_Rica:CR,America/Coyhaique:CL,America/Creston:CA,America/Cuiaba:BR,America/Curacao:CW,America/Danmarkshavn:GL,America/Dawson:CA,America/Dawson_Creek:CA,America/Denver:US,America/Detroit:US,America/Dominica:DM,America/Edmonton:CA,America/Eirunepe:BR,America/El_Salvador:SV,America/Fort_Nelson:CA,America/Fortaleza:BR,America/Glace_Bay:CA,America/Godthab:GL,America/Goose_Bay:CA,America/Grand_Turk:TC,America/Grenada:GD,America/Guadeloupe:GP,America/Guatemala:GT,America/Guayaquil:EC,America/Guyana:GY,America/Halifax:CA,America/Havana:CU,America/Hermosillo:MX,America/Indiana/Indianapolis:US,America/Indiana/Knox:US,America/Indiana/Marengo:US,America/Indiana/Petersburg:US,America/Indiana/Tell_City:US,America/Indiana/Vevay:US,America/Indiana/Vincennes:US,America/Indiana/Winamac:US,America/Indianapolis:US,America/Inuvik:CA,America/Iqaluit:CA,America/Jamaica:JM,America/Juneau:US,America/Kentucky/Louisville:US,America/Kentucky/Monticello:US,America/Kralendijk:BQ,America/La_Paz:BO,America/Lima:PE,America/Los_Angeles:US,America/Louisville:US,America/Lower_Princes:SX,America/Maceio:BR,America/Managua:NI,America/Manaus:BR,America/Marigot:MF,America/Martinique:MQ,America/Matamoros:MX,America/Mazatlan:MX,America/Menominee:US,America/Merida:MX,America/Metlakatla:US,America/Mexico_City:MX,America/Miquelon:PM,America/Moncton:CA,America/Monterrey:MX,America/Montevideo:UY,America/Montreal:CA,America/Montserrat:MS,America/Nassau:BS,America/New_York:US,America/Nome:US,America/Noronha:BR,America/North_Dakota/Beulah:US,America/North_Dakota/Center:US,America/North_Dakota/New_Salem:US,America/Nuuk:GL,America/Ojinaga:MX,America/Panama:PA,America/Paramaribo:SR,America/Phoenix:US,America/Port-au-Prince:HT,America/Port_of_Spain:TT,America/Porto_Velho:BR,America/Puerto_Rico:PR,America/Punta_Arenas:CL,America/Rankin_Inlet:CA,America/Recife:BR,America/Regina:CA,America/Resolute:CA,America/Rio_Branco:BR,America/Santa_Isabel:MX,America/Santarem:BR,America/Santiago:CL,America/Santo_Domingo:DO,America/Sao_Paulo:BR,America/Scoresbysund:GL,America/Sitka:US,America/St_Barthelemy:BL,America/St_Johns:CA,America/St_Kitts:KN,America/St_Lucia:LC,America/St_Thomas:VI,America/St_Vincent:VC,America/Swift_Current:CA,America/Tegucigalpa:HN,America/Thule:GL,America/Tijuana:MX,America/Toronto:CA,America/Tortola:VG,America/Vancouver:CA,America/Whitehorse:CA,America/Winnipeg:CA,America/Yakutat:US,Antarctica/Macquarie:AU,Arctic/Longyearbyen:SJ,Asia/Aden:YE,Asia/Almaty:KZ,Asia/Amman:JO,Asia/Anadyr:RU,Asia/Aqtau:KZ,Asia/Aqtobe:KZ,Asia/Ashgabat:TM,Asia/Ashkhabad:TM,Asia/Atyrau:KZ,Asia/Baghdad:IQ,Asia/Bahrain:BH,Asia/Baku:AZ,Asia/Bangkok:TH,Asia/Barnaul:RU,Asia/Beirut:LB,Asia/Bishkek:KG,Asia/Brunei:BN,Asia/Calcutta:IN,Asia/Chita:RU,Asia/Chongqing:CN,Asia/Chungking:CN,Asia/Colombo:LK,Asia/Dacca:BD,Asia/Damascus:SY,Asia/Dhaka:BD,Asia/Dili:TL,Asia/Dubai:AE,Asia/Dushanbe:TJ,Asia/Famagusta:CY,Asia/Gaza:PS,Asia/Harbin:CN,Asia/Hebron:PS,Asia/Ho_Chi_Minh:VN,Asia/Hong_Kong:HK,Asia/Hovd:MN,Asia/Irkutsk:RU,Asia/Istanbul:TR,Asia/Jakarta:ID,Asia/Jayapura:ID,Asia/Jerusalem:IL,Asia/Kabul:AF,Asia/Kamchatka:RU,Asia/Karachi:PK,Asia/Kashgar:CN,Asia/Kathmandu:NP,Asia/Katmandu:NP,Asia/Khandyga:RU,Asia/Kolkata:IN,Asia/Krasnoyarsk:RU,Asia/Kuala_Lumpur:MY,Asia/Kuching:MY,Asia/Kuwait:KW,Asia/Macao:MO,Asia/Macau:MO,Asia/Magadan:RU,Asia/Makassar:ID,Asia/Manila:PH,Asia/Muscat:OM,Asia/Nicosia:CY,Asia/Novokuznetsk:RU,Asia/Novosibirsk:RU,Asia/Omsk:RU,Asia/Oral:KZ,Asia/Phnom_Penh:KH,Asia/Pontianak:ID,Asia/Pyongyang:KP,Asia/Qatar:QA,Asia/Qostanay:KZ,Asia/Qyzylorda:KZ,Asia/Rangoon:MM,Asia/Riyadh:SA,Asia/Saigon:VN,Asia/Sakhalin:RU,Asia/Samarkand:UZ,Asia/Seoul:KR,Asia/Shanghai:CN,Asia/Singapore:SG,Asia/Srednekolymsk:RU,Asia/Taipei:TW,Asia/Tashkent:UZ,Asia/Tbilisi:GE,Asia/Tehran:IR,Asia/Tel_Aviv:IL,Asia/Thimbu:BT,Asia/Thimphu:BT,Asia/Tokyo:JP,Asia/Tomsk:RU,Asia/Ujung_Pandang:ID,Asia/Ulaanbaatar:MN,Asia/Ulan_Bator:MN,Asia/Urumqi:CN,Asia/Ust-Nera:RU,Asia/Vientiane:LA,Asia/Vladivostok:RU,Asia/Yakutsk:RU,Asia/Yangon:MM,Asia/Yekaterinburg:RU,Asia/Yerevan:AM,Atlantic/Azores:PT,Atlantic/Bermuda:BM,Atlantic/Canary:ES,Atlantic/Cape_Verde:CV,Atlantic/Faeroe:FO,Atlantic/Faroe:FO,Atlantic/Madeira:PT,Atlantic/Reykjavik:IS,Atlantic/St_Helena:SH,Atlantic/Stanley:FK,Australia/Adelaide:AU,Australia/Brisbane:AU,Australia/Broken_Hill:AU,Australia/Canberra:AU,Australia/Darwin:AU,Australia/Eucla:AU,Australia/Hobart:AU,Australia/Lindeman:AU,Australia/Lord_Howe:AU,Australia/Melbourne:AU,Australia/Perth:AU,Australia/Sydney:AU,Europe/Amsterdam:NL,Europe/Andorra:AD,Europe/Astrakhan:RU,Europe/Athens:GR,Europe/Belfast:GB,Europe/Belgrade:RS,Europe/Berlin:DE,Europe/Bratislava:SK,Europe/Brussels:BE,Europe/Bucharest:RO,Europe/Budapest:HU,Europe/Busingen:DE,Europe/Chisinau:MD,Europe/Copenhagen:DK,Europe/Dublin:IE,Europe/Gibraltar:GI,Europe/Guernsey:GG,Europe/Helsinki:FI,Europe/Isle_of_Man:IM,Europe/Istanbul:TR,Europe/Jersey:JE,Europe/Kaliningrad:RU,Europe/Kiev:UA,Europe/Kirov:RU,Europe/Kyiv:UA,Europe/Lisbon:PT,Europe/Ljubljana:SI,Europe/London:GB,Europe/Luxembourg:LU,Europe/Madrid:ES,Europe/Malta:MT,Europe/Mariehamn:AX,Europe/Minsk:BY,Europe/Monaco:MC,Europe/Moscow:RU,Europe/Nicosia:CY,Europe/Oslo:NO,Europe/Paris:FR,Europe/Podgorica:ME,Europe/Prague:CZ,Europe/Riga:LV,Europe/Rome:IT,Europe/Samara:RU,Europe/San_Marino:SM,Europe/Sarajevo:BA,Europe/Saratov:RU,Europe/Simferopol:UA,Europe/Skopje:MK,Europe/Sofia:BG,Europe/Stockholm:SE,Europe/Tallinn:EE,Europe/Tirane:AL,Europe/Ulyanovsk:RU,Europe/Uzhgorod:UA,Europe/Vaduz:LI,Europe/Vatican:VA,Europe/Vienna:AT,Europe/Vilnius:LT,Europe/Volgograd:RU,Europe/Warsaw:PL,Europe/Zagreb:HR,Europe/Zaporozhye:UA,Europe/Zurich:CH,Indian/Antananarivo:MG,Indian/Chagos:IO,Indian/Christmas:CX,Indian/Cocos:CC,Indian/Comoro:KM,Indian/Mahe:SC,Indian/Maldives:MV,Indian/Mauritius:MU,Indian/Mayotte:YT,Indian/Reunion:RE,Pacific/Apia:WS,Pacific/Auckland:NZ,Pacific/Bougainville:PG,Pacific/Chatham:NZ,Pacific/Chuuk:FM,Pacific/Easter:CL,Pacific/Efate:VU,Pacific/Enderbury:KI,Pacific/Fakaofo:TK,Pacific/Fiji:FJ,Pacific/Funafuti:TV,Pacific/Galapagos:EC,Pacific/Gambier:PF,Pacific/Guadalcanal:SB,Pacific/Guam:GU,Pacific/Honolulu:US,Pacific/Kanton:KI,Pacific/Kiritimati:KI,Pacific/Kosrae:FM,Pacific/Kwajalein:MH,Pacific/Majuro:MH,Pacific/Marquesas:PF,Pacific/Nauru:NR,Pacific/Niue:NU,Pacific/Norfolk:NF,Pacific/Noumea:NC,Pacific/Pago_Pago:AS,Pacific/Palau:PW,Pacific/Pohnpei:FM,Pacific/Ponape:FM,Pacific/Port_Moresby:PG,Pacific/Rarotonga:CK,Pacific/Saipan:MP,Pacific/Samoa:AS,Pacific/Tahiti:PF,Pacific/Tarawa:KI,Pacific/Tongatapu:TO,Pacific/Truk:FM,Pacific/Wallis:WF";

let TZ_MAP: Map<string, string> | undefined;

/**
 * The visitor's own country, for where the phone picker starts. The device
 * time zone first (Europe/Vienna → AT; it says where the person is even when
 * the browser is set to en-US), then a region in the browser languages
 * (de-AT → AT). Undefined when neither tells us — then the form's language
 * decides. No permission and no lookup: both come with every page load.
 */
export function visitorPhoneCountry(
  timeZone: string | undefined | null,
  languages: readonly string[] | undefined | null,
): string | undefined {
  if (!TZ_MAP) {
    TZ_MAP = new Map(TZ_COUNTRIES_RAW.split(",").map((row) => row.split(":") as [string, string]));
  }
  const fromZone = timeZone ? TZ_MAP.get(timeZone) : undefined;
  if (fromZone) return fromZone;
  for (const tag of languages ?? []) {
    const m = /^[a-z]{2,3}[-_](?:[a-z]{4}[-_])?([a-z]{2})(?:[-_]|$)/i.exec(tag || "");
    if (!m) continue;
    const iso = m[1].toUpperCase();
    if (BY_ISO.has(iso)) return iso;
  }
  return undefined;
}

/** visitorPhoneCountry for this browser. Call after mount only (SSR knows nothing). */
export function browserPhoneCountry(): string | undefined {
  if (typeof window === "undefined") return undefined;
  let zone: string | undefined;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = undefined;
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return visitorPhoneCountry(zone, langs);
}

/** Where the country picker starts when the visitor's country is unknown: the form's language. */
export function defaultPhoneCountry(locale: string | undefined | null): string {
  switch ((locale || "").slice(0, 2).toLowerCase()) {
    case "de":
      return "DE";
    case "fr":
      return "FR";
    case "nl":
      return "NL";
    case "hy":
      return "AM";
    case "cs":
      return "CZ";
    default:
      // English forms are US English.
      return "US";
  }
}

const digits = (s: string) => s.replace(/\D/g, "");

/** A field's chosen start country if the phone table knows it, else undefined (automatic). */
export function presetPhoneCountry(iso: string | undefined | null): string | undefined {
  return phoneCountry((iso || "").trim())?.iso;
}

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
