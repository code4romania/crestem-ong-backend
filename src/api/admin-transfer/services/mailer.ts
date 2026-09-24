/**
 * Emails of the admin transfer, in the branded layout of `renderEmail`.
 * Kept next to the feature rather than in `api::email.email`: nothing else
 * sends them, and the flow talks to them through `TransferMailer`.
 */
import { renderEmail } from "../../email/utils/template";
import { toDisplayDate } from "../../../utils/date";
import type { ProposalEmail, TransferEmail, TransferMailer } from "./transfer-flow";

type Message = { to: string; subject: string; text: string; html: string };

export function proposalMessage(args: ProposalEmail): Message {
  const proposer = args.fromFdsc ? "Echipa FDSC" : args.initiatorName;
  const subject = args.fromFdsc
    ? `FDSC te propune administrator al organizației ${args.ongName}`
    : `${args.initiatorName} te propune administrator al organizației ${args.ongName}`;
  const howTo = args.isNewAccount
    ? "Pentru a răspunde, accesează linkul de mai jos. Dacă accepți, îți setezi parola contului în același pas:"
    : "Pentru a accepta sau a refuza propunerea, accesează linkul de mai jos. Ți se va cere să te autentifici cu contul tău:";
  return {
    to: args.to,
    subject,
    ...renderEmail([
      `Bună, ${args.nume},`,
      "",
      `${proposer} te propune administrator al organizației ${args.ongName} pe platforma Creștem ONG.`,
      "Dacă accepți, vei prelua administrarea organizației, iar administratorul actual va ieși din organizație.",
      "",
      howTo,
      "",
      args.link,
      "",
      `Propunerea este valabilă până la ${toDisplayDate(new Date(args.expiresAt))}.`,
      "Dacă nu te aștepți la acest mesaj, poți ignora acest email.",
    ]),
  };
}

const simple = (args: TransferEmail, subject: string, lines: string[]): Message => ({
  to: args.to,
  subject,
  ...renderEmail([`Bună, ${args.nume},`, "", ...lines]),
});

export function fdscNoticeMessage(args: TransferEmail): Message {
  return simple(args, `Schimbarea administratorului organizației ${args.ongName}`, [
    `Echipa FDSC a propus ca ${args.otherName} să preia rolul de administrator al organizației ${args.ongName}.`,
    "Până când propunerea este acceptată, rămâi administrator cu toate drepturile.",
    "Dacă propunerea este acceptată, vei ieși din organizație, iar contul tău va deveni cont individual.",
  ]);
}

export function acceptedMessage(args: TransferEmail): Message {
  return simple(args, `Ești acum administratorul organizației ${args.ongName}`, [
    `Ai acceptat propunerea și ești acum administratorul organizației ${args.ongName} pe platforma Creștem ONG.`,
  ]);
}

export function replacedMessage(args: TransferEmail): Message {
  return simple(
    args,
    `Rolul de administrator al organizației ${args.ongName} a fost preluat`,
    [
      `${args.otherName} a acceptat rolul de administrator al organizației ${args.ongName}.`,
      "Nu mai faci parte din organizație, iar contul tău a devenit cont individual. Te poți autentifica în continuare cu aceleași date.",
    ],
  );
}

export function declinedMessage(args: TransferEmail): Message {
  return simple(args, `Propunerea de transfer pentru ${args.ongName} a fost refuzată`, [
    `${args.otherName} a refuzat propunerea de a deveni administratorul organizației ${args.ongName}.`,
    "Nu s-a schimbat nimic: administratorul organizației rămâne același.",
  ]);
}

export function cancelledMessage(args: TransferEmail): Message {
  return simple(args, `Propunerea pentru organizația ${args.ongName} a fost anulată`, [
    `Propunerea de a deveni administratorul organizației ${args.ongName} a fost anulată.`,
    "Linkul primit anterior nu mai este valabil.",
  ]);
}

export function cancelledByFdscMessage(args: TransferEmail): Message {
  return simple(args, `Propunerea de transfer pentru ${args.ongName} a fost anulată`, [
    `Echipa FDSC a anulat propunerea prin care ${args.otherName} ar fi preluat rolul de administrator al organizației ${args.ongName}.`,
    "Rămâi administratorul organizației.",
  ]);
}

export function autoCancelledMessage(args: TransferEmail): Message {
  return simple(args, `Propunerea de transfer pentru ${args.ongName} a fost anulată`, [
    `Propunerea prin care ${args.otherName} ar fi preluat rolul de administrator al organizației ${args.ongName} a fost anulată automat, deoarece nu mai putea fi finalizată.`,
    "Administratorul organizației rămâne același.",
  ]);
}

export function createTransferMailer(strapi: any): TransferMailer {
  const deliver = (message: Message) =>
    strapi.plugin("email").service("email").send(message);
  return {
    proposal: (a) => deliver(proposalMessage(a)),
    fdscNotice: (a) => deliver(fdscNoticeMessage(a)),
    accepted: (a) => deliver(acceptedMessage(a)),
    replaced: (a) => deliver(replacedMessage(a)),
    declined: (a) => deliver(declinedMessage(a)),
    cancelled: (a) => deliver(cancelledMessage(a)),
    cancelledByFdsc: (a) => deliver(cancelledByFdscMessage(a)),
    autoCancelled: (a) => deliver(autoCancelledMessage(a)),
  };
}
