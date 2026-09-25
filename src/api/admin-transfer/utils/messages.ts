/**
 * Romanian copy for every refusal of the admin transfer.
 *
 * Every existing account that is not an active member of the initiating ONG
 * gets the same `NOT_ELIGIBLE` answer on purpose (US-2 AC2): the admin learns
 * what to do next, not which role or memberships the address has.
 */
export const TRANSFER_MESSAGES = {
  NOT_ELIGIBLE:
    "Această adresă nu poate primi rolul de administrator. Rolul poate fi transferat doar unui membru activ al organizației care nu face parte și din alte organizații, sau unei adrese care nu are cont pe platformă.",
  PENDING_MEMBER:
    "Acest membru nu și-a activat încă contul. Transferul este posibil după activare.",
  SELF: "Nu îți poți transfera rolul ție.",
  MEMBER_NOT_FOUND: "Membrul nu a fost găsit.",
  ALREADY_PENDING:
    "Există deja un transfer în așteptare. Anulează-l înainte de a iniția unul nou.",
  WRONG_PASSWORD: "Parola introdusă este incorectă.",
  ONG_NOT_ACTIVE: "Organizația nu este activă momentan.",
  ONG_NOT_FOUND: "Organizația nu a fost găsită.",
  INVALID_LINK: "Invitația nu mai este valabilă.",
  WRONG_ACCOUNT:
    "Această invitație este pentru alt cont. Autentifică-te cu contul căruia i-a fost trimisă.",
  NOT_ALLOWED: "Nu poți modifica acest transfer.",
  NO_PENDING: "Nu există niciun transfer în așteptare.",
  RECIPIENT_REMOVED:
    "Nu mai ești membru al organizației, așa că propunerea a fost anulată.",
  ONG_DELETED: "Organizația a fost ștearsă, așa că propunerea a fost anulată.",
  ACCOUNT_ALREADY_ACTIVE:
    "Contul tău este deja activ. Autentifică-te pentru a răspunde invitației.",
  ACCOUNT_NOT_ACTIVE:
    "Contul tău nu este activ. Folosește linkul din email pentru a-ți seta parola.",
} as const;
